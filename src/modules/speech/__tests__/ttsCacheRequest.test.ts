import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { dataPath } from '@/modules/infra'
import { cacheSegments, ttsCacheKey, type CacheKeyParts } from '../tts/cache'
import { ttsStep } from '../tts/metrics'
import { parseTtsRequest } from '../tts/request'
import { breakerOpen, needsProbe, reasonOf, recordSynthFailure, recordSynthSuccess, resetTtsStatusForTest, PROBE_INTERVAL_DEGRADED_MS, PROBE_INTERVAL_HEALTHY_MS } from '../tts/status'
import { wavInfo } from '../tts/wav'

const P: CacheKeyParts = {
  normalizedText: '九時三十分に会いましょう。',
  voiceProfileId: 'teacher_haruka',
  modelVersion: '1.0.0',
  dictionaryVersion: 3,
  lexiconDigest: null,
  speechProfile: 'NATIVE',
  style: 'Neutral',
  styleWeight: 1,
  speed: 1,
  pitch: 1,
  intonation: 1,
  engineConnectionKey: 'tts-primary',
  textVersion: 1,
}

test('캐시 키 12요소 — 어느 하나만 바뀌어도 다른 키(완료 기준 3·5)', () => {
  const k = ttsCacheKey(P)
  assert.match(k, /^[0-9a-f]{40}$/)
  assert.equal(ttsCacheKey({ ...P }), k)
  const variants: Partial<CacheKeyParts>[] = [
    { normalizedText: '九時三十分に会いましょう！' },
    { voiceProfileId: 'teacher_sakura' },
    { modelVersion: '1.0.1' },
    { dictionaryVersion: 4 },
    { lexiconDigest: 'abc123' },
    { speechProfile: 'LEARNING_SLOW' },
    { style: 'Happy' },
    { styleWeight: 0.8 },
    { speed: 0.9 },
    { pitch: 1.05 },
    { intonation: 1.1 },
    { engineConnectionKey: 'tts-backup' },
    { textVersion: 2 },
  ]
  const keys = new Set([k, ...variants.map((v) => ttsCacheKey({ ...P, ...v }))])
  assert.equal(keys.size, variants.length + 1)
})

test('캐시 키: 부동소수 오차는 같은 키, 요소 경계는 섞이지 않는다', () => {
  assert.equal(ttsCacheKey({ ...P, speed: 0.8 }), ttsCacheKey({ ...P, speed: 0.8000000001 }))
  assert.notEqual(ttsCacheKey({ ...P, normalizedText: 'a|b', voiceProfileId: 'c' }), ttsCacheKey({ ...P, normalizedText: 'a', voiceProfileId: 'b|c' }))
})

test('캐시 경로는 키(16진 40자)만으로 — 형식이 다르면 거부(경로 탈출 불가)', () => {
  const k = ttsCacheKey(P)
  assert.deepEqual(cacheSegments(k), ['tts-cache', k.slice(0, 2), `${k}.wav`])
  for (const bad of ['../../etc/passwd', k.toUpperCase(), `${k}0`, '', 'a'.repeat(39) + '/', `..${k.slice(2)}`]) {
    assert.throws(() => cacheSegments(bad))
  }
})

test('DATA_ROOT 경로 도우미 — 조각 규칙 위반·루트 이탈 거부', () => {
  const keep = process.env.DATA_ROOT
  const root = mkdtempSync(join(tmpdir(), 'kaiwa-dr-'))
  try {
    process.env.DATA_ROOT = root
    const k = ttsCacheKey(P)
    const p = dataPath(...cacheSegments(k))
    assert.ok(p.startsWith(root + sep))
    for (const segs of [['..', 'x'], ['tts-cache', '../x'], ['/etc/passwd'], ['a/b'], ['.hidden'], ['tts-cache', 'a..b']]) assert.throws(() => dataPath(...segs), /경로|조각/)
    delete process.env.DATA_ROOT
    assert.throws(() => dataPath('tts-cache'), /DATA_ROOT/)
  } finally {
    if (keep === undefined) delete process.env.DATA_ROOT
    else process.env.DATA_ROOT = keep
    rmSync(root, { recursive: true, force: true })
  }
})

function wav(ms: number, rate = 44100): Buffer {
  const data = Math.round((rate * 2 * ms) / 1000)
  const b = Buffer.alloc(44 + data)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + data, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(data, 40)
  return b
}

test('WAV 헤더 → 길이(ms), WAV 가 아니면 null', () => {
  assert.equal(wavInfo(wav(1500))?.durationMs, 1500)
  assert.equal(wavInfo(wav(820, 24000))?.sampleRate, 24000)
  assert.equal(wavInfo(Buffer.from('{"error":1}')), null)
})

test('#23 본문 검증: 엔진 수치·모르는 키·긴 문장은 400, 라벨만 받는다', () => {
  const ok = parseTtsRequest({ text: ' そうですね。 ', speechProfile: 'LEARNING_SLOW', renderingPlan: { base: { speed: 2 }, segments: [{ style: 'ENCOURAGING', speed: 'SLOW', pauseBeforeMs: 300 }] }, context: { styleHint: 'CALM', sentenceIdx: 0 } })
  assert.equal(ok.text, 'そうですね。')
  assert.deepEqual(ok.requested, { style: 'ENCOURAGING', speed: 'SLOW', pauseBeforeMs: 300 })
  assert.equal(ok.styleHint, 'CALM')
  const reason = (body: Record<string, unknown>) => {
    try {
      parseTtsRequest(body)
      return 'passed'
    } catch (e) {
      return (e as { details?: { reason?: string } }).details?.reason
    }
  }
  assert.equal(reason({ text: 'a', speakerId: 3 }), 'engine_param')
  assert.equal(reason({ text: 'a', pitch: 1.1 }), 'engine_param')
  assert.equal(reason({ text: 'a', foo: 1 }), 'unknown_key')
  assert.equal(reason({ text: 'あ'.repeat(101) }), 'length ≤100')
  assert.equal(reason({ text: '   ' }), 'empty')
  assert.equal(reason({ text: 'a', renderingPlan: { segments: [{ speed: 0.7 }] } }), 'NORMAL|SLOW|VERY_SLOW')
  assert.equal(reason({ text: 'a', renderingPlan: { segments: [{ styleWeight: 2 }] } }), 'engine_param')
  assert.equal(reason({ text: 'a', renderingPlan: { segments: [{}, {}] } }), 'single')
  assert.equal(reason({ text: 'a', voiceId: '../x' }), 'id')
  assert.equal(reason({ text: 'a', speechProfile: 'FAST' }), 'enum')
})

test('Trace 단계는 허용 키·안전한 값만(본문·읽기 불가)', () => {
  const s = ttsStep('TTS_SYNTH[0]', 12.4, { chunkIndex: 0, cacheHit: true, connectionKey: 'tts-primary', errorCode: 'ECONNREFUSED', text: '本文' } as never)
  assert.deepEqual(s, { name: 'TTS_SYNTH[0]', ms: 12, chunkIndex: 0, cacheHit: true, connectionKey: 'tts-primary', errorCode: 'ECONNREFUSED' })
  assert.equal(ttsStep('TTS_PLAN', 1, { styleSource: '九時' } as never).styleSource, undefined)
})

test('상태 히스테리시스: 연속 2회 실패 → 불가, 성공 1회 → 복귀, 길이 초과는 세지 않음', () => {
  resetTtsStatusForTest()
  recordSynthFailure('TEXT_TOO_LONG', 'TEXT_TOO_LONG')
  recordSynthFailure('UNAVAILABLE', 'ECONNREFUSED')
  assert.equal(breakerOpen(), false)
  recordSynthFailure('TIMEOUT', 'ETIMEDOUT')
  assert.equal(breakerOpen(), true)
  recordSynthSuccess()
  assert.equal(breakerOpen(), false)
  assert.equal(reasonOf('UNAVAILABLE', 'ECONNREFUSED'), 'NO_CONNECTION')
  assert.equal(reasonOf('TIMEOUT', 'ETIMEDOUT'), 'SERVER_TIMEOUT')
  assert.equal(reasonOf('UNAVAILABLE', 'HTTP_503'), 'SERVER_ERROR')
  const now = 10_000_000
  assert.equal(needsProbe('HEALTHY', false, now - PROBE_INTERVAL_HEALTHY_MS + 1000, now), false)
  assert.equal(needsProbe('HEALTHY', false, now - PROBE_INTERVAL_HEALTHY_MS, now), true)
  assert.equal(needsProbe('UNAVAILABLE', false, now - PROBE_INTERVAL_DEGRADED_MS + 1000, now), false)
  assert.equal(needsProbe('HEALTHY', true, now - PROBE_INTERVAL_DEGRADED_MS, now), true)
  assert.equal(needsProbe('UNKNOWN', false, 0, now), true)
  resetTtsStatusForTest()
})
