import { test } from 'node:test'
import assert from 'node:assert/strict'
import { styleBertVits2Provider } from '../adapters/tts/styleBertVits2.provider'
import { substituteReadings, synthesizeHttp } from '../adapters/tts/styleBertHttp'
import type { ConnectionProfile, TtsSegmentInput } from '../registry/types'
import { TtsEngineError } from '../tts/errors'

const SECRET = 'test-secret-0123456789abcdef'
const PROFILE: ConnectionProfile = {
  id: 'c1',
  key: 'tts-primary',
  connectionType: 'HTTP',
  values: { 'connection.baseUrl': 'http://127.0.0.1:65530', 'connection.timeoutMs': 20000, 'runtime.maxChars': 100, 'runtime.sdpRatio': 0.2, 'runtime.noise': 0.6, 'runtime.noiseW': 0.8, 'runtime.defaultModel': 'model-a' },
}
const SEG: TtsSegmentInput = { text: '日本橋で会いましょう。', style: 'Neutral', styleWeight: 0.8, speed: 0.9, pitch: 1, intonation: 1.1, lexiconHints: [{ surface: '日本橋', reading: 'ニホンバシ', accentType: 3, wordType: 'PLACE' }], dictionaryVersion: 2, speechProfile: 'NATIVE' }
const VOICE = { model: 'model-a', speakerId: 0, modelVersion: '1.0.0' }

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

type FetchImpl = (url: URL, init: RequestInit) => Promise<Response>
async function withFetch<T>(impl: FetchImpl, fn: () => Promise<T>, secret: string | null = SECRET): Promise<T> {
  const keepFetch = globalThis.fetch
  const keepSecret = process.env.TTS_SERVICE_SECRET
  globalThis.fetch = impl as unknown as typeof fetch
  if (secret === null) delete process.env.TTS_SERVICE_SECRET
  else process.env.TTS_SERVICE_SECRET = secret
  try {
    return await fn()
  } finally {
    globalThis.fetch = keepFetch
    if (keepSecret === undefined) delete process.env.TTS_SERVICE_SECRET
    else process.env.TTS_SERVICE_SECRET = keepSecret
  }
}

const kindOf = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return e instanceof TtsEngineError ? `${e.kind}:${e.code}` : `other:${(e as Error).name}`
  }
}

test('플랫폼 치환(방식 A 강등): 표기 → 가타카나 읽기, 최장 일치', () => {
  assert.equal(substituteReadings('日本橋駅と日本橋', [{ surface: '日本橋', reading: 'ニホンバシ', accentType: 0, wordType: null }, { surface: '日本橋駅', reading: 'ニホンバシエキ', accentType: 0, wordType: null }]), 'ニホンバシエキとニホンバシ')
  assert.equal(substituteReadings('そのまま', []), 'そのまま')
})

test('합성 요청: 시크릿 헤더·엔진 중립 본문·리다이렉트 미추종, 헤더 계측값을 읽는다', async () => {
  let seen: { url: string; init: RequestInit } | null = null
  const out = await withFetch(
    async (url, init) => {
      seen = { url: String(url), init }
      return new Response(new Uint8Array(wav()), { status: 200, headers: { 'content-type': 'audio/wav', 'x-kaiwa-synth-ms': '210', 'x-kaiwa-queue-ms': '3', 'x-kaiwa-audio-ms': '10', 'x-kaiwa-style-fallback': '1' } })
    },
    () => synthesizeHttp(PROFILE, VOICE, SEG, { traceId: 't_x', timeoutMs: 8000 }),
  )
  assert.ok(seen)
  const s = seen as { url: string; init: RequestInit }
  assert.equal(s.url, 'http://127.0.0.1:65530/synthesize')
  assert.equal(s.init.redirect, 'manual')
  assert.equal((s.init.headers as Record<string, string>)['x-internal-secret'], SECRET)
  const body = JSON.parse(String(s.init.body))
  assert.deepEqual(body, {
    text: 'ニホンバシで会いましょう。',
    voice: { model: 'model-a', speaker: 0, style: 'Neutral', styleWeight: 0.8 },
    controls: { speed: 0.9, pitch: 1, intonation: 1.1 },
    engine: { sdpRatio: 0.2, noise: 0.6, noiseW: 0.8 },
    profile: 'NATIVE',
    traceId: 't_x',
  })
  assert.equal(out.metrics.synthMs, 210)
  assert.equal(out.metrics.queueMs, 3)
  assert.equal(out.metrics.styleFallback, true)
})

test('합성 실패 분류 — 시크릿 없음은 호출 전 차단, 401·413·503·5xx·연결 거부·시간 초과·비 WAV', async () => {
  let called = 0
  const count: FetchImpl = async () => {
    called++
    return new Response('x')
  }
  assert.equal(await kindOf(withFetch(count, () => synthesizeHttp(PROFILE, VOICE, SEG, { traceId: 't', timeoutMs: 8000 }), 'short')), 'MISCONFIGURED:SECRET_MISSING')
  assert.equal(called, 0)
  assert.equal(await kindOf(withFetch(count, () => synthesizeHttp({ ...PROFILE, values: { ...PROFILE.values, 'connection.baseUrl': 'file:///etc/passwd' } }, VOICE, SEG, { traceId: 't', timeoutMs: 8000 }))), 'MISCONFIGURED:BAD_BASE_URL')
  assert.equal(await kindOf(withFetch(count, () => synthesizeHttp({ ...PROFILE, values: { ...PROFILE.values, 'connection.baseUrl': 'http://u:p@127.0.0.1:1' } }, VOICE, SEG, { traceId: 't', timeoutMs: 8000 }))), 'MISCONFIGURED:BAD_BASE_URL')
  assert.equal(called, 0)
  const json = (status: number, code: string, headers: Record<string, string> = {}) => async () => new Response(JSON.stringify({ error: { code, message: 'm' } }), { status, headers: { 'content-type': 'application/json', ...headers } })
  const run = (impl: FetchImpl) => kindOf(withFetch(impl, () => synthesizeHttp(PROFILE, VOICE, SEG, { traceId: 't', timeoutMs: 8000 })))
  assert.equal(await run(json(401, 'UNAUTHORIZED')), 'MISCONFIGURED:HTTP_401')
  assert.equal(await run(json(400, 'TEXT_TOO_LONG')), 'TEXT_TOO_LONG:TEXT_TOO_LONG')
  assert.equal(await run(json(400, 'UNKNOWN_MODEL')), 'REJECTED:UNKNOWN_MODEL')
  assert.equal(await run(json(503, 'BUSY', { 'retry-after': '2' })), 'UNAVAILABLE:BUSY')
  assert.equal(await run(json(500, 'SYNTH_FAILED')), 'ENGINE_ERROR:SYNTH_FAILED')
  assert.equal(await run(async () => new Response('<html>', { status: 200 })), 'BAD_AUDIO:NOT_WAV')
  assert.equal(
    await run(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    }),
    'UNAVAILABLE:ECONNREFUSED',
  )
  assert.equal(
    await run(async () => {
      throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    }),
    'TIMEOUT:ETIMEDOUT',
  )
  // 치환 뒤 상한 초과는 보내지 않는다
  called = 0
  assert.equal(await kindOf(withFetch(count, () => synthesizeHttp(PROFILE, VOICE, { ...SEG, text: '橋'.repeat(90), lexiconHints: [{ surface: '橋', reading: 'ハシ', accentType: 0, wordType: null }] }, { traceId: 't', timeoutMs: 8000 }))), 'TEXT_TOO_LONG:TEXT_TOO_LONG')
  assert.equal(called, 0)
})

test('오류에는 요청 문장·시크릿이 실리지 않는다', async () => {
  try {
    await withFetch(async () => new Response(JSON.stringify({ error: { code: 'SYNTH_FAILED', message: '日本橋で会いましょう' } }), { status: 500 }), () => synthesizeHttp(PROFILE, VOICE, SEG, { traceId: 't', timeoutMs: 8000 }))
    assert.fail('throw 해야 한다')
  } catch (e) {
    const s = `${(e as Error).message} ${JSON.stringify(e)}`
    assert.ok(!s.includes('日本橋') && !s.includes(SECRET))
  }
})

test('Health: /health status 로 판정 + 앱 시크릿 설정 여부(무인증, 시크릿 헤더 없음)', async () => {
  const health = (body: Record<string, unknown>, secret: string | null = SECRET) => {
    let sentSecret: string | undefined
    return withFetch(
      async (_u, init) => {
        sentSecret = (init.headers as Record<string, string>)['x-internal-secret']
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
      },
      async () => ({ out: await styleBertVits2Provider.healthCheck(PROFILE), sentSecret }),
      secret,
    )
  }
  const ok = await health({ ok: true, status: 'OK', modelsLoaded: 3, models: ['a', 'b', 'c'], device: 'mps', warmedUp: true, memoryMb: 2900 })
  assert.equal(ok.out.status, 'HEALTHY')
  assert.equal(ok.out.detail.models, 3)
  assert.equal(ok.out.detail.device, 'mps')
  assert.equal(ok.sentSecret, undefined)
  assert.equal((await health({ ok: true, status: 'DEGRADED', warmedUp: false })).out.status, 'DEGRADED')
  assert.equal((await health({ ok: false, status: 'LOADING' })).out.status, 'UNAVAILABLE')
  assert.equal((await health({ ok: false, status: 'FAILED', modelsLoaded: 0 })).out.status, 'UNAVAILABLE')
  assert.equal((await health({ ok: false, status: 'MISCONFIGURED' })).out.status, 'MISCONFIGURED')
  const noSecret = await health({ ok: true, status: 'OK' }, null)
  assert.equal(noSecret.out.status, 'MISCONFIGURED')
  assert.equal(noSecret.out.detail.errorCode, 'CREDENTIAL_MISSING')
})

test('Functional Test: 고정 문장 1회 합성 → 크기·길이만(오디오 저장 없음)', async () => {
  const r = await withFetch(async () => new Response(new Uint8Array(wav()), { status: 200, headers: { 'x-kaiwa-audio-ms': '10' } }), () => styleBertVits2Provider.functionalTest!(PROFILE))
  assert.equal(r.ok, true)
  assert.equal(r.detail.audioBytes, 926)
  assert.equal(r.detail.durationMs, 10)
  assert.equal(r.detail.model, 'model-a')
  const down = await withFetch(
    async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    },
    () => styleBertVits2Provider.functionalTest!(PROFILE),
  )
  assert.equal(down.ok, false)
  assert.equal(down.status, 'UNAVAILABLE')
  assert.equal(down.detail.errorCode, 'ECONNREFUSED')
})
