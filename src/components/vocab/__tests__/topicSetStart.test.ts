/**
 * task-044 — 새 단어 대기 화면 상태 기계(가이드 §3-5·E3·E4). 타이머·요청을 손으로 돌린다(실제 #47·A12 호출 없음).
 * 떠나면(dispose) 진행 중 요청 signal 이 취소되고, [주제 표현으로 바로 풀기]는 먼저 취소한 뒤 generate:false 한 번, 409 GENERATING 은 3초 × 5번.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateSessionResult, VocabSessionInfo } from '@/types/vocab'
import { BUSY_RETRY_MAX, createTopicSetStarter, type StartFailure, type StarterState, type TopicStartBody } from '../topicSetStart'

interface Call {
  body: TopicStartBody
  signal: AbortSignal
  resolve: (r: CreateSessionResult) => void
  reject: (e: unknown) => void
}

function harness() {
  const calls: Call[] = []
  const states: StarterState[] = []
  let timers: { id: number; at: number; fn: () => void }[] = []
  let now = 0
  let seq = 0
  const s = createTopicSetStarter({
    body: { topicId: 'tp1', count: 10, mode: 'CHOICE' },
    post: (body, signal) => new Promise<CreateSessionResult>((resolve, reject) => calls.push({ body, signal, resolve, reject })),
    toFailure: (e) => e as StartFailure,
    setTimer: (fn, ms) => {
      const id = ++seq
      timers.push({ id, at: now + ms, fn })
      return id
    },
    clearTimer: (id) => {
      timers = timers.filter((t) => t.id !== id)
    },
    onState: (st) => states.push(st),
  })
  const advance = async (ms: number) => {
    const end = now + ms
    for (;;) {
      const next = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0]
      if (!next) break
      timers = timers.filter((t) => t.id !== next.id)
      now = next.at
      next.fn()
      await flush()
    }
    now = end
  }
  return { s, calls, states, advance }
}
const flush = () => new Promise((r) => setImmediate(r))
const session = { id: 's1', date: '2026-10-07', mode: 'CHOICE', requestedCount: 10, cardCount: 10, status: 'IN_PROGRESS' } as VocabSessionInfo
const fail = (status: number, extra: Partial<StartFailure> = {}): StartFailure => ({ abort: false, status, reason: null, sessionId: null, ...extra })

test('시작: generate:true 한 번 · 0.6초 전엔 quiet · 0.6초 gen · 20초 long · 성공이면 done(generation 포함)', async () => {
  const h = harness()
  h.s.start()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].body.generate, true)
  assert.deepEqual(h.states.at(-1), { kind: 'quiet' })
  await h.advance(599)
  assert.deepEqual(h.states.at(-1), { kind: 'quiet' })
  await h.advance(1)
  assert.deepEqual(h.states.at(-1), { kind: 'gen', long: false })
  await h.advance(19_400)
  assert.deepEqual(h.states.at(-1), { kind: 'gen', long: true })
  h.calls[0].resolve({ session, cards: [], generation: { source: 'AI', generatedNow: true, reason: null } })
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'done', session, generation: { source: 'AI', generatedNow: true, reason: null } })
})

test('떠남(dispose): 진행 중 요청 signal 취소 · 늦게 온 성공은 버림(상태 알림 0)', async () => {
  const h = harness()
  h.s.start()
  await h.advance(700)
  const n = h.states.length
  h.s.dispose()
  assert.equal(h.calls[0].signal.aborted, true)
  h.calls[0].resolve({ session, cards: [] })
  await flush()
  await h.advance(30_000)
  assert.equal(h.states.length, n, 'dispose 뒤 onState 호출 0')
})

test('[주제 표현으로 바로 풀기]: 먼저 앞 요청 취소 → generate:false 한 번, 앞 요청의 늦은 응답은 무시', async () => {
  const h = harness()
  h.s.start()
  await h.advance(5_000)
  h.s.skip()
  assert.equal(h.calls[0].signal.aborted, true, '앞 요청 취소가 먼저')
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].body.generate, false)
  assert.deepEqual(h.states.at(-1), { kind: 'skipping' })
  h.calls[0].resolve({ session: { ...session, id: 'old' }, cards: [] })
  await flush()
  assert.notEqual(h.states.at(-1)?.kind, 'done')
  await h.advance(20_000)
  assert.equal(h.states.at(-1)?.kind, 'skipping', '바로 풀기는 gen 문구로 돌아가지 않는다')
  h.calls[1].resolve({ session, cards: [], generation: { source: 'TOPIC', generatedNow: false, reason: 'SKIPPED' } })
  await flush()
  assert.equal(h.states.at(-1)?.kind, 'done')
})

test('409 GENERATING: 3초 간격 같은 요청 최대 5번 → 그 뒤 포기(다시 시도·바로 풀기)', async () => {
  const h = harness()
  h.s.start()
  for (let i = 0; i < BUSY_RETRY_MAX; i++) {
    h.calls.at(-1)!.reject(fail(409, { reason: 'GENERATING' }))
    await flush()
    assert.deepEqual(h.states.at(-1), { kind: 'busy409', attempt: i + 1, gaveUp: false })
    await h.advance(2_999)
    assert.equal(h.calls.length, i + 1, '3초 전엔 다시 보내지 않는다')
    await h.advance(1)
    assert.equal(h.calls.length, i + 2)
    assert.equal(h.calls.at(-1)!.body.generate, true)
  }
  h.calls.at(-1)!.reject(fail(409, { reason: 'GENERATING' }))
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'busy409', attempt: BUSY_RETRY_MAX, gaveUp: true })
  await h.advance(10_000)
  assert.equal(h.calls.length, BUSY_RETRY_MAX + 1, '포기한 뒤 자동 요청 없음')
})

test('409 재시도 중 떠나면 남은 재시도도 멈춘다', async () => {
  const h = harness()
  h.s.start()
  h.calls[0].reject(fail(409, { reason: 'GENERATING' }))
  await flush()
  h.s.dispose()
  await h.advance(10_000)
  assert.equal(h.calls.length, 1)
})

test('멱등(REV-125 M-2): [주제 표현으로 바로 풀기] 두 번 누름 → 요청 1번 · 첫 요청은 끊지 않는다 · 세트가 정해진 뒤 누름도 무시', async () => {
  const h = harness()
  h.s.start()
  await h.advance(5_000)
  assert.equal(h.s.skip(), true)
  assert.equal(h.s.skip(), false, '두 번째 누름은 무시')
  assert.equal(h.calls.length, 2, '새 단어 요청 1 + 바로 풀기 1')
  assert.equal(h.calls[1].signal.aborted, false, '바로 풀기 요청을 끊지 않는다')
  h.calls[1].resolve({ session, cards: [], generation: { source: 'TOPIC', generatedNow: false, reason: 'SKIPPED' } })
  await flush()
  assert.equal(h.states.at(-1)?.kind, 'done')
  assert.equal(h.s.skip(), false, '덱으로 가는 중 누름 무시')
  assert.equal(h.s.retry(), false)
  assert.equal(h.calls.length, 2)
})

test('멱등(REV-125 M-2): [다시 시도] 두 번 누름 → 요청 1번, 진행 중(409 재시도 대기 포함) 다시 시도는 무시', async () => {
  const h = harness()
  h.s.start()
  assert.equal(h.s.retry(), false, '첫 요청이 나가 있는 동안 무시')
  h.calls[0].reject(fail(503))
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'error', rate: false })
  assert.equal(h.s.retry(), true)
  assert.equal(h.s.retry(), false, '두 번째 누름은 무시')
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].signal.aborted, false)
  h.calls[1].reject(fail(409, { reason: 'GENERATING' }))
  await flush()
  assert.equal(h.s.retry(), false, '409 재시도를 기다리는 중')
  await h.advance(3_000)
  assert.equal(h.calls.length, 3, '자동 재시도만 나간다')
})

test('409 풀던 세트: 이 화면이 앞 요청을 끊은 뒤면 그 세트 덱으로 바로(resume), 아니면 오늘 탭 안내(inProgress)', async () => {
  const h = harness()
  h.s.start()
  await h.advance(5_000)
  h.s.skip()
  h.calls[1].reject(fail(409, { sessionId: 's-made' }))
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'resume', sessionId: 's-made' })
  assert.equal(h.s.skip(), false)
  // 409 GENERATING 재시도 대기 중 바로 풀기 — 끊은 요청이 없으므로(재시도 전) 409 풀던 세트는 원래 안내
  const g = harness()
  g.s.start()
  g.calls[0].reject(fail(409, { reason: 'GENERATING' }))
  await flush()
  g.s.skip()
  g.calls[1].reject(fail(409, { sessionId: 'other' }))
  await flush()
  assert.deepEqual(g.states.at(-1), { kind: 'inProgress', sessionId: 'other' })
})

test('그 밖 실패: 409 풀던 세트 → inProgress · 429 → rate · 5xx·네트워크 → error · 빈 풀 → empty · 취소는 무시', async () => {
  let h = harness()
  h.s.start()
  h.calls[0].reject(fail(409, { sessionId: 'ip1' }))
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'inProgress', sessionId: 'ip1' })
  h = harness()
  h.s.start()
  h.calls[0].reject(fail(429))
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'error', rate: true })
  h.s.retry()
  assert.equal(h.calls[1].body.generate, true, '다시 시도는 같은 방식')
  h.calls[1].reject(fail(0))
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'error', rate: false })
  h = harness()
  h.s.start()
  h.calls[0].resolve({ session: null, empty: { reason: 'TOPIC_ALL_DONE_TODAY' } })
  await flush()
  assert.deepEqual(h.states.at(-1), { kind: 'empty', reason: 'TOPIC_ALL_DONE_TODAY' })
  h = harness()
  h.s.start()
  const before = h.states.length
  h.calls[0].reject({ abort: true, status: 0, reason: null, sessionId: null })
  await flush()
  assert.equal(h.states.length, before, '취소는 오류가 아니다')
})
