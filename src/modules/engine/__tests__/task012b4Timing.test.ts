/**
 * task-012b-4 단어 timing — 엔진 층: 공용 검사·좌표 되돌리기(`engine/tts/timing`) · 어댑터 헤더 읽기(서비스 0.4.0 계약) ·
 * 합성 요청 무변경 · 012b-3 지표 집계가 새 Trace 단계를 무시하는지.
 * 원칙: timing 이 없거나 틀리면 **null**(오디오·합성은 그대로), 일부 단어만 버리지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readTimingHeaders, substituteReadings, substituteReadingsMapped, synthesizeHttp, TIMING_HEADER_MAX } from '../adapters/tts/styleBertHttp'
import { extractTtsSamples } from '../metrics/ttsAggregate'
import type { ConnectionProfile, TtsSegmentInput, TtsTimingWord } from '../registry/types'
import { checkTimingWords, identityUnitMap, projectTimingWords } from '../tts/timing'

const HINT = { surface: '日本橋', reading: 'ニホンバシ', accentType: 3, wordType: 'PLACE' }
const SEG: TtsSegmentInput = { text: '日本橋で会いましょう。', style: 'Neutral', styleWeight: 0.8, speed: 1, pitch: 1, intonation: 1, lexiconHints: [HINT], dictionaryVersion: 2, speechProfile: 'NATIVE' }
const PROFILE: ConnectionProfile = { id: 'c1', key: 'tts-primary', connectionType: 'HTTP', values: { 'connection.baseUrl': 'http://127.0.0.1:65530', 'connection.timeoutMs': 20000, 'runtime.maxChars': 100 } }
const VOICE = { model: 'model-a', speakerId: 0, modelVersion: '1.0.0' }
const SECRET = 'test-secret-0123456789abcdef'

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url')
const payload = (words: unknown, extra: Record<string, unknown> = {}) => ({ v: 1, method: 'ENGINE_DURATION', alignerVersion: 'engine-duration-1', coord: 'codepoint', durationMs: 2000, words, ...extra })
const hdr = (h: Record<string, string>) => new Headers(h)
const okHeaders = (p: unknown, more: Record<string, string> = {}) => hdr({ 'x-kaiwa-timing': 'ok', 'x-tts-timing': typeof p === 'string' ? p : b64(p), 'x-kaiwa-timing-ms': '0.17', ...more })
const sliceCp = (s: string, a: number, b: number) => Array.from(s).slice(a, b).join('')

// 보낸 글 'ニホンバシで会いましょう。'(13 코드포인트) 기준 서비스 단어 — ニホン|バシ 는 같은 표기 日本橋 안이라 합쳐져야 한다.
const SENT_WORDS: TtsTimingWord[] = [
  [0, 300, 0, 3],
  [300, 520, 3, 5],
  [520, 640, 5, 6],
  [640, 1500, 6, 12],
]

test('checkTimingWords — 정수 4-튜플·0≤start<end≤duration·글 범위·시간과 글 오름차순·겹침 0, 하나라도 틀리면 null', () => {
  const lim = { textCodePoints: 13, durationMs: 2000 }
  assert.deepEqual(checkTimingWords(SENT_WORDS, lim), SENT_WORDS)
  const bad: [string, unknown][] = [
    ['빈 배열', []],
    ['배열 아님', { 0: [0, 1, 0, 1] }],
    ['소수', [[0, 1.5, 0, 1]]],
    ['문자열', [['0', 1, 0, 1]]],
    ['3-튜플', [[0, 1, 0]]],
    ['start=end', [[5, 5, 0, 1]]],
    ['음수', [[-1, 5, 0, 1]]],
    ['duration 초과', [[0, 2001, 0, 1]]],
    ['글 범위 밖', [[0, 10, 12, 14]]],
    ['charStart=charEnd', [[0, 10, 3, 3]]],
    ['글 겹침', [[0, 10, 0, 3], [10, 20, 2, 4]]],
    ['시간 겹침', [[0, 10, 0, 3], [9, 20, 3, 4]]],
    ['시간 역행', [[100, 200, 0, 3], [0, 50, 3, 4]]],
  ]
  for (const [name, w] of bad) assert.equal(checkTimingWords(w, lim), null, name)
  assert.equal(checkTimingWords(Array.from({ length: 401 }, (_, i) => [i, i + 1, i, i + 1]), { textCodePoints: 1000, durationMs: null }), null, '단어 수 상한')
})

test('사전 치환 지도 — 치환 결과는 기존 substituteReadings 와 같고, 읽기 글자는 표기 전체를 가리킨다', () => {
  const m = substituteReadingsMapped(SEG.text, SEG.lexiconHints)
  assert.equal(m.derived, 'ニホンバシで会いましょう。')
  assert.equal(m.derived, substituteReadings(SEG.text, SEG.lexiconHints))
  assert.deepEqual([m.start[0], m.end[0]], [0, 3], 'ニ → 日本橋')
  assert.deepEqual([m.start[4], m.end[4]], [0, 3], 'シ → 日本橋')
  assert.deepEqual([m.start[5], m.end[5]], [3, 4], 'で → で')
  assert.equal(substituteReadingsMapped('こんにちは', []).derived, 'こんにちは')
})

test('projectTimingWords — 보낸 글 → 세그먼트 글: 표기 안에 걸친 단어는 넓혀 합치고, 서로게이트 쌍은 코드포인트로 센다', () => {
  const back = projectTimingWords(SENT_WORDS, substituteReadingsMapped(SEG.text, SEG.lexiconHints))
  assert.deepEqual(back, [
    [0, 520, 0, 3],
    [520, 640, 3, 4],
    [640, 1500, 4, 10],
  ])
  assert.deepEqual(back!.map((w) => sliceCp(SEG.text, w[2], w[3])), ['日本橋', 'で', '会いましょう'])
  // 서로게이트 쌍(𠮷 = 코드 유닛 2개, 코드포인트 1개)
  const t = '𠮷野家です。'
  assert.deepEqual(projectTimingWords([[0, 300, 0, 3], [300, 600, 3, 5]], identityUnitMap(t)), [[0, 300, 0, 3], [300, 600, 3, 5]])
  assert.equal(projectTimingWords([[0, 300, 0, 7]], identityUnitMap(t)), null, '글 밖 → null')
})

test('readTimingHeaders — ok 이면 세그먼트 글 좌표 timing, 아니면 이유와 함께 null', () => {
  const sent = substituteReadingsMapped(SEG.text, SEG.lexiconHints)
  const r = readTimingHeaders(okHeaders(payload(SENT_WORDS)), sent)
  assert.equal(r.status, 'OK')
  assert.equal(r.ms, 0.17)
  assert.deepEqual(r.timing, { method: 'ENGINE_DURATION', version: 'engine-duration-1', durationMs: 2000, words: [[0, 520, 0, 3], [520, 640, 3, 4], [640, 1500, 4, 10]] })

  const cases: [string, Headers, string][] = [
    ['구 서비스(헤더 없음)', hdr({}), 'ABSENT'],
    ['서비스 사유', hdr({ 'x-kaiwa-timing': 'token_mismatch' }), 'TOKEN_MISMATCH'],
    ['too_long', hdr({ 'x-kaiwa-timing': 'too_long' }), 'TOO_LONG'],
    ['이상한 사유 문자열', hdr({ 'x-kaiwa-timing': 'oops!<script>' }), 'UNKNOWN'],
    ['목록에 없는 사유(형식은 맞음)', hdr({ 'x-kaiwa-timing': 'new_reason' }), 'UNKNOWN'],
    ...['unavailable', 'frame_mismatch', 'word_mismatch', 'text_mismatch', 'empty', 'too_large', 'error'].map((s): [string, Headers, string] => [`서비스 사유 ${s}`, hdr({ 'x-kaiwa-timing': s }), s.toUpperCase()]),
    ['ok 인데 값 없음', hdr({ 'x-kaiwa-timing': 'ok' }), 'INVALID'],
    ['base64url 아님', okHeaders('ab+c/='), 'INVALID'],
    ['JSON 아님', okHeaders(Buffer.from('not json').toString('base64url')), 'INVALID'],
    ['배열 JSON', okHeaders([1, 2]), 'INVALID'],
    ['버전 2', okHeaders(payload(SENT_WORDS, { v: 2 })), 'INVALID'],
    ['좌표 단위 다름', okHeaders(payload(SENT_WORDS, { coord: 'utf16' })), 'INVALID'],
    ['모르는 방식', okHeaders(payload(SENT_WORDS, { method: 'MAGIC' })), 'INVALID'],
    ['버전 문자열 형식', okHeaders(payload(SENT_WORDS, { alignerVersion: 'a b' })), 'INVALID'],
    ['길이 0', okHeaders(payload(SENT_WORDS, { durationMs: 0 })), 'INVALID'],
    ['보낸 글 밖 좌표', okHeaders(payload([[0, 100, 0, 14]])), 'INVALID'],
    ['길이 초과 단어', okHeaders(payload([[0, 2100, 0, 3]])), 'INVALID'],
    ['겹침', okHeaders(payload([[0, 300, 0, 3], [200, 400, 3, 4]])), 'INVALID'],
    ['상한 초과', okHeaders('A'.repeat(TIMING_HEADER_MAX + 1)), 'INVALID'],
  ]
  for (const [name, h, status] of cases) {
    const x = readTimingHeaders(h, sent)
    assert.equal(x.timing, null, name)
    assert.equal(x.status, status, name)
  }
})

type FetchImpl = (url: URL, init: RequestInit) => Promise<Response>
async function withFetch<T>(impl: FetchImpl, fn: () => Promise<T>): Promise<T> {
  const keepFetch = globalThis.fetch
  const keep = { secret: process.env.TTS_SERVICE_SECRET, url: process.env.TTS_SERVICE_URL }
  globalThis.fetch = impl as unknown as typeof fetch
  process.env.TTS_SERVICE_SECRET = SECRET
  process.env.TTS_SERVICE_URL = 'http://127.0.0.1:65530'
  try {
    return await fn()
  } finally {
    globalThis.fetch = keepFetch
    for (const [k, v] of [['TTS_SERVICE_SECRET', keep.secret], ['TTS_SERVICE_URL', keep.url]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

function wav(): Buffer {
  const b = Buffer.alloc(44 + 882)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + 882, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(44100, 24)
  b.writeUInt32LE(88200, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(882, 40)
  return b
}

test('synthesizeHttp — 요청 본문 무변경(새 키 0), timing 은 응답 헤더에서만, 없거나 깨져도 오디오 성공', async () => {
  const bodies: Record<string, unknown>[] = []
  const run = (headers: Record<string, string>) =>
    withFetch(
      async (_u, init) => {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return new Response(new Uint8Array(wav()), { status: 200, headers: { 'content-type': 'audio/wav', ...headers } })
      },
      () => synthesizeHttp(PROFILE, VOICE, SEG, { traceId: 't1', timeoutMs: 8000 }),
    )
  const ok = await run({ 'x-kaiwa-timing': 'ok', 'x-tts-timing': b64(payload(SENT_WORDS)), 'x-kaiwa-timing-ms': '0.2' })
  assert.equal(ok.metrics.timingStatus, 'OK')
  assert.equal(ok.metrics.timingMs, 0.2)
  assert.deepEqual(ok.timing?.words, [[0, 520, 0, 3], [520, 640, 3, 4], [640, 1500, 4, 10]])
  const old = await run({})
  assert.equal(old.timing, null)
  assert.equal(old.metrics.timingStatus, 'ABSENT')
  assert.ok(old.audio.length > 44)
  const broken = await run({ 'x-kaiwa-timing': 'ok', 'x-tts-timing': '%%%' })
  assert.equal(broken.timing, null)
  assert.equal(broken.metrics.timingStatus, 'INVALID')
  assert.ok(broken.audio.equals(wav()))
  for (const b of bodies) assert.deepEqual(Object.keys(b).sort(), ['controls', 'engine', 'profile', 'text', 'traceId', 'voice'])
})

test('synthesizeHttp 안전망 — timing 헤더 읽기가 던져도(REV-133 M-1) 오디오는 성공하고 상태 INVALID, 다른 헤더 계측은 그대로', async () => {
  const out = await withFetch(
    async () => {
      const res = new Response(new Uint8Array(wav()), { status: 200, headers: { 'content-type': 'audio/wav', 'x-kaiwa-timing': 'ok', 'x-kaiwa-synth-ms': '120' } })
      const real = res.headers
      const trap = new Proxy(real, {
        get(target, prop) {
          if (prop === 'get')
            return (name: string) => {
              if (/^x-(kaiwa-timing|tts-timing)/i.test(name)) throw new Error('header read failed')
              return target.get(name)
            }
          const v: unknown = Reflect.get(target, prop, target)
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
        },
      })
      Object.defineProperty(res, 'headers', { value: trap })
      return res
    },
    () => synthesizeHttp(PROFILE, VOICE, SEG, { traceId: 't-guard', timeoutMs: 8000 }),
  )
  assert.ok(out.audio.equals(wav()))
  assert.equal(out.timing, null)
  assert.equal(out.metrics.timingStatus, 'INVALID')
  assert.equal(out.metrics.timingMs, null)
  assert.equal(out.metrics.synthMs, 120, 'timing 밖 헤더는 그대로 읽는다(대역이 실제로 끼었는지)')
})

test('012b-3 지표 집계는 TTS_TIMING[i] 단계를 무시한다(표본·연결·TTFA 동일)', () => {
  const synth = { name: 'TTS_SYNTH[0]', ms: 300, chunkIndex: 0, connectionKey: 'tts-primary', voiceId: 'v1', cacheHit: false, rtf: 0.1, status: 'OK' }
  const parent = { name: 'TTS', ms: 320, ttfaMs: 320, status: 'OK' }
  const timingStep = { name: 'TTS_TIMING[0]', ms: 0, chunkIndex: 0, status: 'INVALID', source: 'ENGINE', words: 0 }
  for (const kind of ['PREVIEW', 'TURN'] as const) {
    const base = extractTtsSamples({ kind, steps: [parent, synth, { name: 'TTS[0]', ms: 330, status: 'OK', ttfaServerMs: 330 }] })
    const withTiming = extractTtsSamples({ kind, steps: [parent, synth, timingStep, { name: 'TTS[0]', ms: 330, status: 'OK', ttfaServerMs: 330 }] })
    assert.deepEqual(withTiming, base, kind)
  }
})
