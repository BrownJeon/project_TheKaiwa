import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildClientTimings, TIMING_MAX_MS, type PrevTurn } from '../timings'

const prev = (p: Partial<PrevTurn> = {}): PrevTurn => ({
  assistantMessageId: 'm_prev',
  origin: 'release',
  originAt: 1_000,
  queue: { firstAudioEventAt: 4_200, firstPlayAt: 4_330, autoplayed: true },
  ...p,
})

test('clientTimings: 방에서 첫 음성 턴 — sttMs 만', () => {
  assert.deepEqual(buildClientTimings(null, { origin: 'release', originAt: 100, finalAt: 163.4 }), { sttMs: 63 })
})

test('clientTimings: 첫 글자 턴은 싣지 않는다', () => {
  assert.equal(buildClientTimings(null, { origin: 'send', originAt: 100 }), undefined)
})

test('clientTimings: 직전 음성 턴 + 이번 음성 턴 — 5필드', () => {
  assert.deepEqual(buildClientTimings(prev(), { origin: 'release', originAt: 9_000, finalAt: 9_070 }), {
    sttMs: 70,
    prevMessageId: 'm_prev',
    releaseToFirstAudioEventMs: 3_200,
    firstAudioAtMs: 3_330,
    playbackStartDelayMs: 130,
  })
})

test('clientTimings: 직전 턴이 글자면 releaseToFirstAudioEventMs 없음, firstAudioAtMs 기준은 보내기', () => {
  assert.deepEqual(buildClientTimings(prev({ origin: 'send' }), { origin: 'send', originAt: 9_000 }), {
    prevMessageId: 'm_prev',
    firstAudioAtMs: 3_330,
    playbackStartDelayMs: 130,
  })
})

test('clientTimings: 자동재생이 아니면(차단·barge-in·자막만·폴링) 재생 지연을 빼고, audio 0건이면 수신 지연도 뺀다', () => {
  assert.deepEqual(buildClientTimings(prev({ queue: { firstAudioEventAt: 4_200, firstPlayAt: 9_000, autoplayed: false } }), { origin: 'send', originAt: 10_000 }), {
    prevMessageId: 'm_prev',
    releaseToFirstAudioEventMs: 3_200,
  })
  assert.deepEqual(buildClientTimings(prev({ queue: { autoplayed: false } }), { origin: 'send', originAt: 10_000 }), { prevMessageId: 'm_prev' })
  assert.deepEqual(buildClientTimings(prev({ queue: null }), { origin: 'send', originAt: 10_000 }), { prevMessageId: 'm_prev' })
})

test('clientTimings: 0~120,000 밖·음수는 뺀다', () => {
  const far = prev({ queue: { firstAudioEventAt: 1_000 + TIMING_MAX_MS + 1, firstPlayAt: 500, autoplayed: true } })
  assert.deepEqual(buildClientTimings(far, { origin: 'release', originAt: 5, finalAt: 1 }), { prevMessageId: 'm_prev' })
})
