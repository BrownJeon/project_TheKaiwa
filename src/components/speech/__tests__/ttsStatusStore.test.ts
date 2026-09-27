import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TtsStatusResponse } from '@/types/tts'
import { createTtsStatusStore, deriveFromResponse, pollIntervalFor, POLL_DEGRADED_MS, POLL_HEALTHY_MS, SWITCHING_MIN_MS, type TtsStatusDeps } from '../ttsStatusStore'

const ONLINE: TtsStatusResponse = { executionMode: 'SERVER', networkStatus: 'ONLINE', serverHealth: 'HEALTHY', fallbackReason: null, lastUpdatedAt: '2026-09-27T12:00:00.000Z' }
const DEGRADED: TtsStatusResponse = { ...ONLINE, serverHealth: 'DEGRADED' }
const TEXT_ONLY: TtsStatusResponse = { executionMode: 'TEXT_ONLY', networkStatus: 'ONLINE', serverHealth: 'UNAVAILABLE', fallbackReason: 'NO_CONNECTION', lastUpdatedAt: null }

/** 수동 시계 + 타이머 큐 + 조회 응답 대본. */
function harness(script: (TtsStatusResponse | 'fail')[]) {
  let now = 1_000_000
  let online = true
  let calls = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  let seq = 0
  const deps: TtsStatusDeps = {
    fetchStatus: async () => {
      const next = script[Math.min(calls++, script.length - 1)]
      if (next === 'fail') throw new Error('fail')
      return next
    },
    isOnline: () => online,
    now: () => now,
    setTimer: (fn, ms) => {
      const id = ++seq
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimer: (h) => void timers.delete(h as number),
  }
  const flush = async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r))
  }
  const advance = async (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      now = due[1].at
      timers.delete(due[0])
      due[1].fn()
      await flush()
    }
    now = end
    await flush()
  }
  const store = createTtsStatusStore(deps)
  return {
    store,
    flush,
    advance,
    calls: () => calls,
    setOnline: (v: boolean) => (online = v),
    pendingDelays: () => [...timers.values()].map((t) => t.at - now).sort((a, b) => a - b),
  }
}

test('판정표: SERVER → 온라인 · TEXT_ONLY → 자막만(사유 없으면 NO_CONNECTION) · ON_DEVICE → 온디바이스', () => {
  assert.deepEqual(deriveFromResponse(ONLINE), { state: 'ONLINE', reason: null })
  assert.deepEqual(deriveFromResponse({ ...TEXT_ONLY, fallbackReason: null }), { state: 'TEXT_ONLY', reason: 'NO_CONNECTION' })
  assert.deepEqual(deriveFromResponse({ ...TEXT_ONLY, fallbackReason: 'SERVER_TIMEOUT' }), { state: 'TEXT_ONLY', reason: 'SERVER_TIMEOUT' })
  assert.equal(deriveFromResponse({ ...TEXT_ONLY, executionMode: 'ON_DEVICE' }).state, 'ON_DEVICE')
  assert.equal(pollIntervalFor('ONLINE', 'HEALTHY'), POLL_HEALTHY_MS)
  assert.equal(pollIntervalFor('ONLINE', 'DEGRADED'), POLL_DEGRADED_MS)
  assert.equal(pollIntervalFor('TEXT_ONLY', 'UNAVAILABLE'), POLL_DEGRADED_MS)
})

test('첫 구독: 확인 중 → 온라인, 첫 결과엔 토스트 없음, 폴링 5분(정상)·30초(느림)', async () => {
  const h = harness([ONLINE, DEGRADED])
  const unsub = h.store.subscribe(() => undefined)
  assert.equal(h.store.getSnapshot().state, 'CHECKING')
  await h.flush()
  const s = h.store.getSnapshot()
  assert.equal(s.state, 'ONLINE')
  assert.equal(s.transitionSeq, 0)
  assert.equal(h.store.consumeAnnouncement(s.transitionSeq), null)
  assert.equal(s.pollMs, POLL_HEALTHY_MS)
  assert.deepEqual(h.pendingDelays(), [POLL_HEALTHY_MS])
  await h.advance(POLL_HEALTHY_MS)
  assert.equal(h.store.getSnapshot().pollMs, POLL_DEGRADED_MS)
  unsub()
  assert.deepEqual(h.pendingDelays(), [])
})

test('조회 실패: 1회째는 직전 상태 유지, 연속 2회째 자막만(NO_CONNECTION) + 토스트 1회', async () => {
  const h = harness([ONLINE, 'fail', 'fail', ONLINE])
  h.store.subscribe(() => undefined)
  await h.flush()
  await h.advance(POLL_HEALTHY_MS)
  assert.equal(h.store.getSnapshot().state, 'ONLINE')
  await h.advance(POLL_DEGRADED_MS)
  const s = h.store.getSnapshot()
  assert.equal(s.state, 'TEXT_ONLY')
  assert.equal(s.reason, 'NO_CONNECTION')
  assert.equal(s.transitionSeq, 1)
  assert.match(h.store.consumeAnnouncement(1) ?? '', /자막만/)
  assert.equal(h.store.consumeAnnouncement(1), null) // 표시등이 둘이어도 한 번
  await h.advance(POLL_DEGRADED_MS)
  assert.equal(h.store.getSnapshot().state, 'ONLINE')
  assert.match(h.store.consumeAnnouncement(2) ?? '', /다시 연결/)
})

test('합성 신호: 502·504·0 연속 2회면 재확인(전환 중 표시 ≥600ms), 캐시 적중은 무변화, 422 는 즉시 재확인', async () => {
  const h = harness([ONLINE, TEXT_ONLY, ONLINE])
  h.store.subscribe(() => undefined)
  await h.flush()
  const before = h.calls()
  h.store.reportSynthesis({ ok: true, cacheHit: true })
  h.store.reportSynthesis({ ok: false, status: 502 })
  h.store.reportSynthesis({ ok: false, status: 429 })
  await h.flush()
  assert.equal(h.calls(), before)
  h.store.reportSynthesis({ ok: false, status: 504 })
  assert.equal(h.store.getSnapshot().state, 'SWITCHING')
  await h.flush()
  assert.equal(h.store.getSnapshot().state, 'SWITCHING') // 최소 표시 시간
  await h.advance(SWITCHING_MIN_MS)
  assert.equal(h.store.getSnapshot().state, 'TEXT_ONLY')
  assert.equal(h.calls(), before + 1)
  // 자막만 상태에서 새 합성 성공 → 재확인 → 온라인
  h.store.reportSynthesis({ ok: true, cacheHit: false })
  await h.advance(SWITCHING_MIN_MS)
  assert.equal(h.store.getSnapshot().state, 'ONLINE')
  // 422 는 한 번에 재확인
  const c = h.calls()
  h.store.reportSynthesis({ ok: false, status: 422 })
  await h.advance(SWITCHING_MIN_MS)
  assert.equal(h.calls(), c + 1)
})

test('오프라인 이벤트 → 즉시 자막만(OFFLINE)·폴링 정지, 온라인 이벤트 → 전환 중 + 즉시 조회', async () => {
  const h = harness([ONLINE, ONLINE])
  h.store.subscribe(() => undefined)
  await h.flush()
  h.setOnline(false)
  h.store.handleOffline()
  const off = h.store.getSnapshot()
  assert.equal(off.state, 'TEXT_ONLY')
  assert.equal(off.reason, 'OFFLINE')
  assert.equal(off.networkOnline, false)
  assert.deepEqual(h.pendingDelays(), [])
  h.setOnline(true)
  h.store.handleOnline()
  assert.equal(h.store.getSnapshot().state, 'SWITCHING')
  await h.advance(SWITCHING_MIN_MS)
  assert.equal(h.store.getSnapshot().state, 'ONLINE')
})

test('가려지면 타이머 정지, 보이면 주기가 지났을 때만 바로 조회 · pause 중엔 폴링 없음', async () => {
  const h = harness([ONLINE])
  h.store.subscribe(() => undefined)
  await h.flush()
  h.store.handleVisibility(false)
  assert.deepEqual(h.pendingDelays(), [])
  await h.advance(60_000)
  const c = h.calls()
  h.store.handleVisibility(true)
  await h.flush()
  assert.equal(h.calls(), c) // 아직 5분 전
  assert.equal(h.pendingDelays()[0], POLL_HEALTHY_MS - 60_000)
  h.store.pause(true)
  assert.deepEqual(h.pendingDelays(), [])
  await h.advance(POLL_HEALTHY_MS)
  h.store.pause(false)
  await h.flush()
  assert.equal(h.calls(), c + 1) // 주기가 지나 바로 조회
})
