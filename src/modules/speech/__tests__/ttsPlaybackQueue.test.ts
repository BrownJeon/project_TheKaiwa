import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTtsPlaybackQueue, RETAIN_MESSAGES, type PlaybackDeps, type PlaybackHandle, type PlaybackSignal } from '../tts/client'

/** 손으로 풀고 막는 받기·재생 + 수동 타이머. 소리 = 버퍼의 첫 바이트(청크 번호)로 식별한다. */
function harness(opts: { blockPlay?: boolean } = {}) {
  let now = 1_000
  const timers = new Map<number, { at: number; fn: () => void }>()
  let seq = 0
  const fetches = new Map<string, { resolve: (b: ArrayBuffer) => void; reject: (e: unknown) => void; signal: AbortSignal }>()
  const fetchOrder: string[] = []
  const played: number[] = []
  const playing: Array<{ id: number; end: () => void; stopped: boolean }> = []
  const signals: PlaybackSignal[] = []
  const partErrors: unknown[] = []
  let block = !!opts.blockPlay

  const deps: PlaybackDeps = {
    fetchAudio: (url, signal) =>
      new Promise((resolve, reject) => {
        fetchOrder.push(url)
        fetches.set(url, { resolve, reject, signal })
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      }),
    play: async (buf) => {
      if (block) throw Object.assign(new Error('blocked'), { name: 'NotAllowedError' })
      const id = new Uint8Array(buf)[0]
      played.push(id)
      let end: () => void = () => undefined
      const ended = new Promise<void>((r) => (end = r))
      const rec = { id, end, stopped: false }
      playing.push(rec)
      const h: PlaybackHandle = {
        stop() {
          rec.stopped = true
          end()
        },
        ended,
      }
      return h
    },
    onSignal: (s) => signals.push(s),
    onPartError: (_s, _m, e) => partErrors.push(e),
    now: () => now,
    setTimer: (fn, ms) => {
      const id = ++seq
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimer: (h) => void timers.delete(h as number),
  }
  const q = createTtsPlaybackQueue(deps)
  const buf = (n: number) => new Uint8Array([n, 0, 0, 0]).buffer
  const url = (n: number) => `/api/v1/speech/tts/tok${n}`
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }
  return {
    q,
    url,
    buf,
    fetchOrder,
    played,
    signals,
    partErrors,
    fetched: (n: number) => fetches.has(url(n)),
    async resolveFetch(n: number) {
      fetches.get(url(n))?.resolve(buf(n))
      await flush()
    },
    async rejectFetch(n: number, status: number) {
      fetches.get(url(n))?.reject(Object.assign(new Error('x'), { status }))
      await flush()
    },
    aborted: (n: number) => !!fetches.get(url(n))?.signal.aborted,
    async endCurrent() {
      const p = playing.filter((x) => !x.stopped).pop()
      p?.end()
      await flush()
    },
    stoppedIds: () => playing.filter((x) => x.stopped).map((x) => x.id),
    async advance(ms: number) {
      now += ms
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id)
          t.fn()
        }
      }
      await flush()
    },
    setBlock(v: boolean) {
      block = v
    },
    flush,
  }
}

const OK = (i: number, url: string, last = false, extra: Record<string, unknown> = {}) => ({ chunkIndex: i, url, status: 'OK' as const, last, ...extra })

test('재생 큐: 캐시 HIT 가 먼저 와도 chunkIndex 순으로만 재생한다', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(1, h.url(1), true))
  await h.resolveFetch(1)
  assert.deepEqual(h.played, [], '0 이 오기 전엔 1 을 재생하지 않는다')
  assert.equal(h.q.getSnapshot().phase, 'waiting')
  h.q.push('m1', OK(0, h.url(0)))
  await h.resolveFetch(0)
  assert.deepEqual(h.played, [0])
  assert.equal(h.q.getSnapshot().phase, 'playing')
  assert.equal(h.q.getSnapshot().chunkIndex, 0)
  await h.endCurrent()
  assert.deepEqual(h.played, [0, 1])
  assert.equal(h.q.getSnapshot().chunkIndex, 1)
  await h.endCurrent()
  assert.equal(h.q.getSnapshot().phase, 'idle', 'last 청크가 끝나면 idle')
})

test('재생 큐: 받기는 도착 즉시·동시 2(낮은 index 먼저) — 재생 중 다음 청크를 미리 받는다', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(2, h.url(2)))
  h.q.push('m1', OK(0, h.url(0)))
  h.q.push('m1', OK(1, h.url(1), true))
  assert.deepEqual(h.fetchOrder, [h.url(2), h.url(0)], '동시 2')
  await h.resolveFetch(0)
  assert.deepEqual(h.fetchOrder, [h.url(2), h.url(0), h.url(1)], '하나가 끝나면 남은 것 중 낮은 index')
  assert.deepEqual(h.played, [0])
})

test('재생 큐: FAILED·서명 URL 아님·받기 실패는 건너뛰고, 받기 실패는 표시등 신호', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0)))
  h.q.push('m1', { chunkIndex: 1, status: 'FAILED', last: false })
  h.q.push('m1', OK(2, 'https://evil.example/x.wav'))
  h.q.push('m1', OK(3, h.url(3), true))
  assert.ok(!h.fetchOrder.includes('https://evil.example/x.wav'), '접두가 다른 URL 은 받지 않는다')
  await h.resolveFetch(0)
  await h.rejectFetch(3, 404)
  assert.deepEqual(h.signals, [{ ok: false, status: 404 }])
  await h.endCurrent()
  assert.deepEqual(h.played, [0], '1·2·3 은 소리 없음')
  assert.equal(h.q.getSnapshot().phase, 'idle')
})

test('재생 큐: endTurn 뒤엔 비어 있는 index 를 건너뛴다', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0)))
  h.q.push('m1', OK(2, h.url(2)))
  await h.resolveFetch(0)
  await h.resolveFetch(2)
  await h.endCurrent()
  assert.deepEqual(h.played, [0], '1 을 기다린다')
  assert.equal(h.q.getSnapshot().phase, 'waiting')
  h.q.endTurn('m1')
  await h.flush()
  assert.deepEqual(h.played, [0, 2])
})

test('재생 큐: pauseBeforeMs 만큼 쉬고 다음 청크(첫 청크엔 쉬지 않음), 쉬는 동안도 playing', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0), false, { pauseBeforeMs: 500 }))
  h.q.push('m1', OK(1, h.url(1), true, { pauseBeforeMs: 300 }))
  await h.resolveFetch(0)
  await h.resolveFetch(1)
  assert.deepEqual(h.played, [0], '첫 청크는 바로')
  await h.endCurrent()
  assert.deepEqual(h.played, [0])
  assert.equal(h.q.getSnapshot().phase, 'playing')
  await h.advance(299)
  assert.deepEqual(h.played, [0])
  await h.advance(1)
  assert.deepEqual(h.played, [0, 1])
})

test('재생 큐: interrupt(barge-in) 뒤엔 소리를 끊고 남은 청크는 받아 두되 자동재생하지 않는다', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0)))
  await h.resolveFetch(0)
  assert.deepEqual(h.played, [0])
  h.q.interrupt('BARGE_IN')
  await h.flush()
  assert.deepEqual(h.stoppedIds(), [0])
  assert.equal(h.q.getSnapshot().phase, 'idle')
  h.q.push('m1', OK(1, h.url(1), true))
  assert.ok(h.fetched(1), '계속 받는다')
  await h.resolveFetch(1)
  h.q.endTurn('m1')
  await h.flush()
  assert.deepEqual(h.played, [0], '자동재생 안 함')
  assert.equal(h.q.buffersOf('m1')?.length, 2, '다시 듣기용 보관본은 다 있다')
})

test('재생 큐: abortTurn(AUDIO_TEXT_MISMATCH)은 재생 중 소리도 즉시 끊고 남은 청크·보관본을 버린다', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0)))
  h.q.push('m1', OK(1, h.url(1)))
  await h.resolveFetch(0)
  h.q.abortTurn('m1')
  await h.flush()
  assert.deepEqual(h.stoppedIds(), [0])
  assert.ok(h.aborted(1), '받던 것도 abort')
  h.q.push('m1', OK(2, h.url(2), true))
  assert.ok(!h.fetched(2), '더 받지 않는다')
  assert.equal(h.q.buffersOf('m1'), null)
  assert.equal(h.q.getSnapshot().phase, 'idle')
})

test('재생 큐: 자동재생이 막히면 blocked → resumeBlocked 로 그 청크부터 이어서, autoplayed=false', async () => {
  const h = harness({ blockPlay: true })
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0)))
  h.q.push('m1', OK(1, h.url(1), true))
  await h.resolveFetch(0)
  await h.resolveFetch(1)
  assert.equal(h.q.getSnapshot().phase, 'blocked')
  assert.equal(h.q.getSnapshot().chunkIndex, 0)
  h.setBlock(false)
  h.q.resumeBlocked()
  await h.flush()
  assert.deepEqual(h.played, [0])
  await h.endCurrent()
  assert.deepEqual(h.played, [0, 1])
  const t = h.q.timingsOf('m1')
  assert.equal(t?.autoplayed, false)
  assert.ok(t?.firstPlayAt !== undefined && t?.firstAudioEventAt !== undefined)
})

test('재생 큐: 자동재생 성공이면 timingsOf 에 첫 수신·첫 재생 시각과 autoplayed=true', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0), true))
  await h.advance(120)
  await h.resolveFetch(0)
  const t = h.q.timingsOf('m1')
  assert.equal(t?.autoplayed, true)
  assert.equal(t?.firstAudioEventAt, 1_000)
  assert.equal(t?.firstPlayAt, 1_120)
})

test('재생 큐: 새 턴의 첫 소리가 준비되면 다시 듣기를 멈추고 턴이 이긴다', async () => {
  const h = harness()
  h.q.startTurn('m1')
  let replayResolve: (b: ArrayBuffer) => void = () => undefined
  h.q.playParts('replay', 'm0', [() => new Promise<ArrayBuffer>((r) => (replayResolve = r))])
  assert.equal(h.q.getSnapshot().source, 'replay')
  replayResolve(h.buf(90))
  await h.flush()
  assert.deepEqual(h.played, [90])
  h.q.push('m1', OK(0, h.url(0), true))
  await h.resolveFetch(0)
  assert.deepEqual(h.stoppedIds(), [90])
  assert.deepEqual(h.played, [90, 0])
  assert.equal(h.q.getSnapshot().source, 'turn')
})

test('재생 큐: 턴 재생 중 다시 듣기를 누르면 턴 자동재생을 멈춘다(청크는 계속 받아 둠)', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0)))
  await h.resolveFetch(0)
  h.q.playParts('mine', 'u1', [async () => h.buf(77)])
  await h.flush()
  assert.deepEqual(h.played, [0, 77])
  h.q.push('m1', OK(1, h.url(1), true))
  await h.resolveFetch(1)
  await h.endCurrent()
  assert.deepEqual(h.played, [0, 77], '다시 듣기가 끝나도 턴은 다시 자동재생하지 않는다')
  assert.equal(h.q.getSnapshot().phase, 'idle')
})

test('재생 큐: 다시 듣기는 조각을 차례로(다음 1개 미리 받기), 받기 실패는 onPartError', async () => {
  const h = harness()
  const calls: number[] = []
  const part = (n: number) => async () => {
    calls.push(n)
    return h.buf(n)
  }
  h.q.playParts('replay', 'm1', [part(10), part(11), part(12)])
  await h.flush()
  assert.deepEqual(calls, [10, 11], '첫 조각 + 다음 1개 미리')
  assert.deepEqual(h.played, [10])
  assert.equal(h.q.getSnapshot().chunkIndex, 0)
  await h.endCurrent()
  assert.deepEqual(h.played, [10, 11])
  assert.deepEqual(calls, [10, 11, 12])
  await h.endCurrent()
  await h.endCurrent()
  assert.deepEqual(h.played, [10, 11, 12])
  assert.equal(h.q.getSnapshot().phase, 'idle')

  h.q.playParts('mine', 'u1', [async () => Promise.reject(Object.assign(new Error('x'), { status: 404 }))])
  await h.flush()
  assert.equal(h.partErrors.length, 1)
  assert.equal((h.partErrors[0] as { status: number }).status, 404)
  assert.equal(h.q.getSnapshot().phase, 'idle')
})

test('재생 큐: interrupt(USER_STOP)은 다시 듣기 받기도 멈춘다', async () => {
  const h = harness()
  let signal: AbortSignal | null = null
  h.q.playParts('replay', 'm1', [(s) => {
    signal = s
    return new Promise<ArrayBuffer>(() => undefined)
  }])
  assert.equal(h.q.getSnapshot().phase, 'waiting')
  h.q.interrupt('USER_STOP')
  assert.equal((signal as AbortSignal | null)?.aborted, true)
  assert.equal(h.q.getSnapshot().phase, 'idle')
})

test('재생 큐: 화면 이탈(HIDDEN)은 받기도 abort 하고 이어서 재생하지 않는다', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0)))
  h.q.push('m1', OK(1, h.url(1), true))
  await h.resolveFetch(0)
  h.q.interrupt('HIDDEN')
  await h.flush()
  assert.ok(h.aborted(1))
  assert.equal(h.q.getSnapshot().phase, 'idle')
  assert.equal(h.q.buffersOf('m1'), null, '빈 조각이 있으면 보관본 없음 → 다시 듣기는 #23 으로')
})

test('재생 큐: 보관본은 최근 20 메시지(LRU)', async () => {
  const h = harness()
  for (let i = 0; i < RETAIN_MESSAGES + 2; i++) {
    const id = `m${i}`
    h.q.startTurn(id)
    h.q.push(id, OK(0, h.url(100 + i), true))
    await h.resolveFetch(100 + i)
    h.q.endTurn(id)
    h.q.interrupt('USER_STOP')
  }
  assert.equal(h.q.buffersOf('m0'), null)
  assert.equal(h.q.buffersOf('m1'), null)
  assert.equal(h.q.buffersOf('m2')?.length, 1)
  assert.equal(h.q.buffersOf(`m${RETAIN_MESSAGES + 1}`)?.length, 1)
})

test('재생 큐: 같은 메시지를 다시 받으면(다시 받기) 앞 조각을 버리고 새 청크로 시작', async () => {
  const h = harness()
  h.q.startTurn('m1')
  h.q.push('m1', OK(0, h.url(0), true))
  await h.resolveFetch(0)
  h.q.endTurn('m1')
  assert.equal(h.q.buffersOf('m1')?.length, 1)
  h.q.startTurn('m1')
  assert.equal(h.q.buffersOf('m1'), null)
  h.q.push('m1', OK(0, h.url(5), true))
  assert.ok(h.fetched(5))
})
