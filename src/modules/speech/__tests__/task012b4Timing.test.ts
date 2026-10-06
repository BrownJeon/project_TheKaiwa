/**
 * task-012b-4 단어 timing — L4 speech/tts: 정규화 글 좌표 → 조각 글 좌표(정규화기 token map), 캐시 형식·DB 칸(create·update),
 * 앱 헤더 상한, 토큰에 묶인 timing(#24), Trace `TTS_TIMING` 허용 키, #62c `charStart`. DB 없이 돈다.
 * 완료 기준 3: `words[].charStart/charEnd` 로 조각 글을 자르면 단어 글과 같다(숫자·이모지·앞 공백·약어·서로게이트 포함).
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma } from '@prisma/client'
import type { TtsTiming } from '@/types/tts'
import { clearTokenTiming, readSignedTtsAudio, signTtsAudioToken } from '../tts/audioUrl'
import { timingColumns, ttsCacheUpsertArgs, type CacheKeyParts } from '../tts/cache'
import { lessonClipPieces } from '../tts/lessonAudio'
import { ttsStep } from '../tts/metrics'
import { normalizeJapanese } from '../tts/normalizer'
import { clearRecentAudio, rememberRecentAudio } from '../tts/recentAudio'
import { chunkTiming, encodeTimingHeader, normalizationUnitMap, parseStoredTiming, toStoredTiming, TTS_TIMING_HEADER_MAX, type StoredTiming } from '../tts/timing'

const saved = process.env.JWT_SECRET
before(() => {
  process.env.JWT_SECRET = 'unit-test-secret-0123456789abcdef'
})
after(() => {
  process.env.JWT_SECRET = saved
})

type W = [number, number, number, number]
const sliceCp = (s: string, a: number, b: number) => Array.from(s).slice(a, b).join('')
const cp = (s: string) => Array.from(s).length

function stored(words: W[], durationMs = 3000): StoredTiming {
  return { v: 1, method: 'ENGINE_DURATION', alignerVersion: 'engine-duration-1', coord: 'codepoint', base: 'normalizedText', durationMs, words }
}

/** 실제 정규화기로 조각을 만들고 정규화 글 좌표 단어를 조각 글 좌표로 되돌린다. */
function project(text: string, words: W[], opts: { protect?: { start: number; end: number }[]; durationMs?: number } = {}) {
  const n = normalizeJapanese(text, { protect: opts.protect })
  const r = chunkTiming(stored(words, opts.durationMs ?? 3000), 'NONE', { text, tokens: n.tokens, normalizedText: n.normalizedText }, opts.durationMs ?? 3000)
  return { n, r, slices: r.timing?.words.map((w) => sliceCp(text, w[2], w[3])) ?? null }
}

test('숫자 정규화(3→三·15→十五) — 단어가 원문 숫자 구간으로 돌아가고, 十|五 처럼 한 숫자를 나눈 단어는 합친다', () => {
  const text = '今日は3時15分に会いましょう。'
  const a = project(text, [[0, 200, 0, 2], [200, 300, 2, 3], [300, 500, 3, 5], [500, 700, 5, 8], [700, 800, 8, 9], [800, 1500, 9, 15]])
  assert.equal(a.n.normalizedText, '今日は三時十五分に会いましょう。')
  assert.equal(a.r.status, 'OK')
  assert.deepEqual(a.slices, ['今日', 'は', '3時', '15分', 'に', '会いましょう'])
  const b = project(text, [[300, 500, 3, 5], [500, 600, 5, 6], [600, 700, 6, 8]])
  assert.deepEqual(b.r.timing?.words, [[300, 500, 3, 5], [500, 700, 5, 8]], '十 · 五分 → 15분 하나로')
  assert.deepEqual(b.slices, ['3時', '15分'])
})

test('앞 공백·이모지(서로게이트 쌍)·약어 — 지워진 글자를 건너뛰고 원문 코드포인트로 센다', () => {
  const lead = project(' おはよう😊ございます！', [[0, 400, 0, 4], [400, 900, 4, 9]])
  assert.equal(lead.n.normalizedText, 'おはようございます！')
  assert.deepEqual(lead.r.timing?.words.map((w) => [w[2], w[3]]), [[1, 5], [6, 11]])
  assert.deepEqual(lead.slices, ['おはよう', 'ございます'])

  const ok = project('OKです。', [[0, 150, 0, 2], [150, 300, 2, 4], [300, 500, 4, 6]])
  assert.deepEqual(ok.slices, ['OK', 'です'], 'オー|ケー → OK 하나로')

  const sur = project('𠮷野家で12人と会った。', [[0, 300, 0, 3], [300, 400, 3, 4], [400, 700, 4, 7], [700, 800, 7, 8], [800, 1200, 8, 11]])
  assert.deepEqual(sur.slices, ['𠮷野家', 'で', '12人', 'と', '会った'])
  assert.deepEqual(sur.r.timing?.words[2], [400, 700, 4, 7])

  const longVowel = project('すご〜い！', [[0, 600, 0, 4]])
  assert.deepEqual(longVowel.slices, ['すご〜い'])
})

test('사전 보호 구간(바뀌지 않은 token)은 한 글자씩 그대로 — 표기 안 경계도 유지', () => {
  const r = project('日本橋で会いましょう。', [[0, 500, 0, 3], [500, 600, 3, 4], [600, 1400, 4, 10]], { protect: [{ start: 0, end: 3 }] })
  assert.deepEqual(r.slices, ['日本橋', 'で', '会いましょう'])
  // REV-133 L-4: 보호 구간 **안쪽** 경계(日本|橋) — 블록 지도(바뀐 token 취급)면 둘이 [0,3) 하나로 합쳐진다.
  const split = project('日本橋で会いましょう。', [[0, 300, 0, 2], [300, 500, 2, 3], [500, 600, 3, 4], [600, 1400, 4, 10]], { protect: [{ start: 0, end: 3 }] })
  assert.ok(split.n.tokens.some((t) => t.srcStart === 0 && t.srcEnd === 3 && t.replaced === '日本橋'), '시험 전제: 보호 구간은 바뀌지 않은 token')
  assert.deepEqual(split.r.timing?.words.map((w) => [w[2], w[3]]), [[0, 2], [2, 3], [3, 4], [4, 10]])
  assert.deepEqual(split.slices, ['日本', '橋', 'で', '会いましょう'])
})

test('되돌릴 수 없으면 전체 null — 정규화 글 밖·token map 불일치·지도 없음·오디오 길이 어긋남·저장값 없음', () => {
  const text = '今日はいい天気です。'
  const n = normalizeJapanese(text)
  const chunk = { text, tokens: n.tokens, normalizedText: n.normalizedText }
  assert.equal(chunkTiming(stored([[0, 100, 0, 2], [100, 200, 2, 30]]), 'NONE', chunk, 3000).status, 'PROJECT_FAILED', '정규화 글 밖 단어 하나 → 전체 null')
  assert.equal(chunkTiming(stored([[0, 100, 0, 2]]), 'NONE', { ...chunk, normalizedText: '違う文です。' }, 3000).status, 'PROJECT_FAILED')
  assert.equal(chunkTiming(stored([[0, 100, 0, 2]]), 'NONE', { ...chunk, tokens: undefined }, 3000).status, 'NO_TOKEN_MAP')
  assert.equal(chunkTiming(stored([[0, 100, 0, 2]]), 'NONE', chunk, 3003).status, 'DURATION_MISMATCH')
  assert.equal(chunkTiming(stored([[0, 100, 0, 2]]), 'NONE', chunk, null).status, 'DURATION_MISMATCH')
  assert.equal(chunkTiming(stored([[0, 100, 0, 2]]), 'NONE', chunk, 3002).status, 'OK', '허용 차 2ms')
  const none = chunkTiming(null, 'TOKEN_MISMATCH', chunk, 3000)
  assert.deepEqual(none, { timing: null, status: 'TOKEN_MISMATCH', words: 0, bytes: null })
  assert.equal(normalizationUnitMap(text, [{ srcStart: 5, srcEnd: 3, surface: '', replaced: 'x', rule: 'SYMBOL' }], n.normalizedText), null, '뒤집힌 token')
})

test('헤더 상한 3KB — 넘으면 timing 전체 null(TOO_LARGE), 안이면 base64url JSON 왕복', () => {
  const text = 'あ'.repeat(130)
  const words = Array.from({ length: 130 }, (_, i): W => [10_000 + i * 10, 10_000 + i * 10 + 5, i, i + 1])
  const big = chunkTiming(stored(words, 11_305), 'NONE', { text, tokens: normalizeJapanese(text).tokens, normalizedText: text }, 11_305)
  assert.equal(big.status, 'HEADER_TOO_LARGE')
  assert.equal(big.timing, null)
  const small = project('今日はいい天気です。', [[0, 300, 0, 2], [300, 400, 2, 3]])
  const value = encodeTimingHeader(small.r.timing)!
  assert.ok(value.length <= TTS_TIMING_HEADER_MAX && /^[A-Za-z0-9_-]+$/.test(value))
  assert.equal(small.r.bytes, value.length)
  assert.deepEqual(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')), { v: 1, coord: 'codepoint', durationMs: 3000, words: [[0, 300, 0, 2], [300, 400, 2, 3]] })
  assert.equal(encodeTimingHeader(null), null)
  assert.ok(!/今日|天気|ENGINE|engine|method/.test(Buffer.from(value, 'base64url').toString('utf8')), '글·엔진 정보 없음')
})

test('캐시 형식 — 엔진 결과 검사(오디오 길이·정규화 글 범위), DB JSON 왕복은 timingVersion 칸과 맞을 때만', () => {
  const t = { method: 'ENGINE_DURATION' as const, version: 'engine-duration-1', durationMs: 2000, words: [[0, 300, 0, 2]] as const }
  const s = toStoredTiming(t, '今日は。', 2001)
  assert.ok(s)
  assert.equal(toStoredTiming(t, '今日は。', 2003), null, '오디오 길이 3ms 차')
  assert.equal(toStoredTiming({ ...t, words: [[0, 300, 0, 9]] }, '今日は。', 2000), null, '정규화 글 밖')
  assert.equal(toStoredTiming(null, '今日は。', 2000), null)
  assert.equal(toStoredTiming({ ...t, version: 'bad version' }, '今日は。', 2000), null)
  const col = timingColumns(s)
  assert.equal(col.timingVersion, 'engine-duration-1')
  assert.deepEqual(parseStoredTiming(col.timing, col.timingVersion), s)
  assert.equal(parseStoredTiming(col.timing, 'engine-duration-2'), null, '버전 칸 불일치')
  assert.equal(parseStoredTiming(col.timing, null), null)
  assert.equal(parseStoredTiming({ method: 'ENGINE', alignerVersion: 'x', words: [{ text: '今日', startMs: 0, endMs: 1, charStart: 0, charEnd: 2 }] }, 'x'), null, '설계 초안 모양(글 포함) 거부')
  assert.equal(parseStoredTiming(null, null), null)
  assert.ok(!JSON.stringify(col.timing).includes('今日'), '캐시 timing 에 글 없음')
})

const PARTS: CacheKeyParts = {
  normalizedText: '今日は。',
  voiceProfileId: 'teacher_haruka',
  modelVersion: '1.0.0',
  dictionaryVersion: 2,
  lexiconDigest: null,
  speechProfile: 'NATIVE',
  style: 'Neutral',
  styleWeight: 0.8,
  speed: 1,
  pitch: 1,
  intonation: 1,
  engineConnectionKey: 'tts-primary',
  textVersion: 1,
}

test('캐시 upsert — timing·timingVersion 을 create 와 update 둘 다에 싣고, 없으면 둘 다 지운다(DbNull)', () => {
  const s = stored([[0, 300, 0, 2]], 2000)
  const a = ttsCacheUpsertArgs('a'.repeat(40), PARTS, Buffer.alloc(100), 2000, s)
  assert.deepEqual(a.create.timing, JSON.parse(JSON.stringify(s)))
  assert.equal(a.create.timingVersion, 'engine-duration-1')
  assert.deepEqual(a.update.timing, JSON.parse(JSON.stringify(s)), 'update(같은 키 재합성 — 파일이 바뀜)도 timing 갱신')
  assert.equal(a.update.timingVersion, 'engine-duration-1')
  assert.equal(a.update.durationMs, 2000)
  const b = ttsCacheUpsertArgs('a'.repeat(40), PARTS, Buffer.alloc(100), 2000, null)
  assert.equal(b.create.timing, Prisma.DbNull)
  assert.equal(b.update.timing, Prisma.DbNull, '옛 오디오의 timing 이 새 오디오에 남지 않는다')
  assert.equal(b.update.timingVersion, null)
})

const KEY = 'ab'.repeat(20)
const U1 = 'user-1'
const U2 = 'user-2'
const T1: TtsTiming = { v: 1, coord: 'codepoint', durationMs: 900, words: [[0, 300, 0, 2]] }
const T2: TtsTiming = { v: 1, coord: 'codepoint', durationMs: 900, words: [[0, 300, 1, 3]] }
const wavStub = Buffer.from('RIFF....WAVEfmt ')

test('#24 timing — 서명 때 묶은 조각 글 timing 만 준다(타인·없음·길이 어긋남·같은 토큰에 다른 값은 null)', async () => {
  clearRecentAudio()
  clearTokenTiming()
  rememberRecentAudio(KEY, { audio: wavStub, durationMs: 900, modelVersion: '1.0.0', dictionaryVersion: 3 })
  const now = Date.now()
  const s = signTtsAudioToken(U1, KEY, { now, timing: T1 })
  assert.deepEqual((await readSignedTtsAudio(U1, s.token))?.timing, T1)
  assert.equal(await readSignedTtsAudio(U2, s.token), null, '타인 세션')
  assert.equal((await readSignedTtsAudio(U1, signTtsAudioToken(U1, KEY, { now: now + 1000 }).token))?.timing, null, 'timing 을 묶지 않은 토큰')
  // 같은 사용자·키·초(같은 토큰)에 원문이 다른 조각이 서명하면 둘 다 null
  const c1 = signTtsAudioToken(U1, KEY, { now: now + 2000, timing: T1 })
  const c2 = signTtsAudioToken(U1, KEY, { now: now + 2000, timing: T2 })
  assert.equal(c1.token, c2.token)
  assert.equal((await readSignedTtsAudio(U1, c1.token))?.timing, null)
  // 같은 값이면 유지
  const d = signTtsAudioToken(U1, KEY, { now: now + 3000, timing: T1 })
  signTtsAudioToken(U1, KEY, { now: now + 3000, timing: T1 })
  assert.deepEqual((await readSignedTtsAudio(U1, d.token))?.timing, T1)
  // 줄 오디오 길이가 timing 길이와 다르면 null
  rememberRecentAudio(KEY, { audio: wavStub, durationMs: 950, modelVersion: '1.0.0', dictionaryVersion: 3 })
  assert.equal((await readSignedTtsAudio(U1, s.token))?.timing, null)
  clearRecentAudio()
  clearTokenTiming()
})

test('Trace TTS_TIMING — 허용 키만(상태·출처·단어 수·방식·엔진 ms·헤더 길이), 글·좌표는 버린다', () => {
  const st = ttsStep('TTS_TIMING[2]', 0.04, { chunkIndex: 2, status: 'OK', source: 'ENGINE', words: 5, method: 'ENGINE_DURATION', alignMs: 0.17, bytes: 120, text: '今日は', charStart: 3 })
  assert.deepEqual(st, { name: 'TTS_TIMING[2]', ms: 0, chunkIndex: 2, status: 'OK', source: 'ENGINE', words: 5, method: 'ENGINE_DURATION', alignMs: 0.17, bytes: 120 })
})

test('합성 경로 — TTS_TIMING 단계는 그 합성의 finishTrace(recordTrace) **전에** 같은 steps 에 들어간다(REV-123, 나중 append 금지)', () => {
  const src = readFileSync(join(__dirname, '..', 'tts', 'synthesize.ts'), 'utf8')
  const body = src.slice(src.indexOf('export async function synthesizeSentence'), src.indexOf('async function finishTrace'))
  const okTraces = [...body.matchAll(/void finishTrace\(traceId, steps, ttfaMs, 'OK'/g)].map((m) => m.index!)
  assert.equal(okTraces.length, 3, 'CACHE · SHARED · SYNTH')
  let from = 0
  for (const at of okTraces) {
    assert.ok(body.slice(from, at).includes('attachTiming(steps'), `finishTrace(${at}) 앞에 attachTiming`)
    from = at + 1
  }
  assert.ok(!/appendTraceSteps/.test(src))
})

test('#62c charStart — 조각 글이 줄 글에서 시작하는 코드포인트(이모지 포함), 줄을 잘라 보면 조각 글과 같다', () => {
  const line = 'はい😊、そうです。今日は晴れです！明日も晴れるでしょう。'
  const pieces = lessonClipPieces(line)
  assert.ok(pieces.length >= 2)
  assert.equal(pieces[0].charStart, 0)
  for (const p of pieces) assert.equal(sliceCp(line, p.charStart, p.charStart + cp(p.text)), p.text)
  assert.ok(pieces[1].charStart > cp('はい😊、そうです') - 1)
})
