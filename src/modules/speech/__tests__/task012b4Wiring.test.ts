/**
 * task-012b-4 REV-133 M-1·L-1 — timing 을 **실제로 내보내는 배선**과 안전망(순수 로직 시험은 task012b4Timing.test.ts).
 *
 *  - 캐시 HIT: `readCachedAudio` 가 저장 timing 을 돌려주고(옛 행·버전 불일치 null), `synthesizeSentence` CACHE 경로가 그것을 조각 글 좌표로.
 *  - 서명 배선: 회화 턴(`createTurnSpeaker`)·레슨(`synthesizeLessonClips`)이 토큰에 timing 을 묶어 #24 가 돌려준다, #62c `charStart`.
 *  - #24 토큰 맵: 상한 512·만료 청소(가짜 시계 = `signTtsAudioToken` 의 `now`).
 *  - 라우트(#23·#24·#62c)·`attachTiming` 안전망: 모듈 시험은 `@/app` 을 import 하지 못해(eslint 경계) 소스 정적 확인.
 * DB 는 prisma 델리게이트 대역(Object.defineProperty — task037·039 와 같은 방식), 오디오 파일은 임시 DATA_ROOT. 엔진 호출 0(MISS 경로에 들어오면 실패).
 */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prisma, writeDataFile } from '@/modules/infra'
import { TTS_HEADERS, type TtsTiming } from '@/types/tts'
import { clearTokenTiming, readSignedTtsAudio, signTtsAudioToken, TOKEN_TIMING_MAX_ENTRIES, TTS_AUDIO_URL_PATH, TTS_AUDIO_URL_TTL_SEC } from '../tts/audioUrl'
import { cacheSegments, readCachedAudio } from '../tts/cache'
import { lessonClipPieces, synthesizeLessonClips } from '../tts/lessonAudio'
import { clearRecentAudio } from '../tts/recentAudio'
import { prepareSentence, synthesizeSentence, type SynthesizeInput } from '../tts/synthesize'
import { encodeTimingHeader, TTS_TIMING_HEADER_MAX } from '../tts/timing'
import { createTurnSpeaker } from '../tts/turnSpeaker'

type W = [number, number, number, number]
const sliceCp = (s: string, a: number, b: number) => Array.from(s).slice(a, b).join('')
const U1 = 'user-wiring-1'
const U2 = 'user-wiring-2'
const VERSION = 'engine-duration-1'
const VOICE_ROW = {
  id: 'voice-test',
  displayName: '테스트 목소리',
  voiceModelId: 'model-test',
  speakerId: 0,
  defaults: null,
  styles: [{ name: 'Neutral', styleWeightDefault: 0.8 }],
  model: { version: '1.0.0', status: 'AVAILABLE' },
}

/** 8kHz·모노·16비트 — `wavInfo().durationMs` 가 정확히 `ms`. */
function wav(ms: number): Buffer {
  const data = 16 * ms
  const b = Buffer.alloc(44 + data)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + data, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(8000, 24)
  b.writeUInt32LE(16000, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(data, 40)
  return b
}

const storedJson = (words: W[], durationMs: number) => ({ v: 1, method: 'ENGINE_DURATION', alignerVersion: VERSION, coord: 'codepoint', base: 'normalizedText', durationMs, words })

// ── prisma 대역 ─────────────────────────────────────────────────────────────────────────────

interface Row {
  durationMs: number | null
  modelVersion: string
  dictionaryVersion: number
  timing: unknown
  timingVersion: string | null
}
const rows = new Map<string, Row>()
const traces: { steps: { name: string; status?: unknown; source?: unknown; words?: unknown }[] }[] = []
const restores: (() => void)[] = []
let keepDataRoot: string | undefined
let keepJwt: string | undefined
let root = ''

function stub(name: string, value: unknown): void {
  const p = prisma as unknown as Record<string, unknown>
  const original = p[name]
  const descriptor = Object.getOwnPropertyDescriptor(prisma, name)
  Object.defineProperty(prisma, name, { configurable: true, writable: true, value })
  restores.push(() => Object.defineProperty(prisma, name, { configurable: true, writable: true, enumerable: true, ...descriptor, value: original }))
}

before(() => {
  keepDataRoot = process.env.DATA_ROOT
  keepJwt = process.env.JWT_SECRET
  root = mkdtempSync(join(tmpdir(), 'kaiwa-012b4w-'))
  process.env.DATA_ROOT = root
  process.env.JWT_SECRET = 'unit-test-secret-0123456789abcdef'
  stub('userVoiceSetting', { findUnique: async () => null })
  stub('appSetting', { findUnique: async (a: { where: { environment_key: { key: string } } }) => (a.where.environment_key.key === 'voice.default.profileId' ? { value: VOICE_ROW.id } : null) })
  stub('voiceProfile', { findFirst: async () => VOICE_ROW })
  stub('pronunciationLexiconVersion', { findFirst: async () => null })
  stub('engineFallbackPolicy', { findUnique: async () => ({ enabled: true, primaryConnectionId: 'conn-test', fallbackConnectionIds: [] }) })
  stub('engineConnection', {
    findMany: async () => [{ id: 'conn-test', key: 'tts-primary', engineId: 'tts-test', status: 'HEALTHY', lastHealthAt: new Date(), enabled: true }],
    findUnique: async () => {
      throw new Error('캐시 MISS 경로(엔진 호출)에 들어오면 안 된다 — 시험 준비(seed) 키가 실제 키와 다르다')
    },
  })
  stub('ttsCache', {
    findUnique: async (a: { where: { key: string } }) => rows.get(a.where.key) ?? null,
    update: async () => ({}),
    delete: async () => ({}),
  })
  stub('requestTrace', { create: async (a: { data: (typeof traces)[number] }) => (traces.push(a.data), a.data) })
})

after(() => {
  for (const r of restores.reverse()) r()
  if (keepDataRoot === undefined) delete process.env.DATA_ROOT
  else process.env.DATA_ROOT = keepDataRoot
  process.env.JWT_SECRET = keepJwt
  rmSync(root, { recursive: true, force: true })
  clearRecentAudio()
  clearTokenTiming()
})

async function putRow(key: string, durationMs: number, timing: unknown, timingVersion: string | null): Promise<Buffer> {
  const audio = wav(durationMs)
  await writeDataFile(cacheSegments(key), audio)
  rows.set(key, { durationMs, modelVersion: '1.0.0', dictionaryVersion: 0, timing, timingVersion })
  return audio
}

/** 그 입력이 만들 캐시 키를 실제 준비 경로로 계산해 행·파일을 심는다(words = 정규화 글 좌표, null = 012b-4 이전 행). */
async function seed(input: SynthesizeInput, words: W[] | null, durationMs: number) {
  const p = await prepareSentence(input)
  assert.ok(p.key, 'TTS 연결 대역이 있어야 캐시 키가 생긴다')
  const audio = await putRow(p.key, durationMs, words ? storedJson(words, durationMs) : null, words ? VERSION : null)
  return { key: p.key, normalizedText: p.normalizedText, audio }
}

const tokenOf = (url: string | null) => {
  assert.ok(url && url.startsWith(TTS_AUDIO_URL_PATH))
  return url.slice(TTS_AUDIO_URL_PATH.length)
}
const timingSteps = (steps: { name: string }[] | undefined) => (steps ?? []).filter((s) => /^TTS_TIMING\[\d+\]$/.test(s.name)) as { name: string; status?: unknown; source?: unknown; words?: unknown }[]

// 숫자 정규화(10→十)·지워지는 이모지가 섞인 조각 — 정규화 글 좌표와 조각 글 좌표가 달라 되돌리기가 실제로 일어난다.
const TEXT = '😊今日は10時です。'
const NORM_WORDS: W[] = [
  [0, 300, 0, 2],
  [300, 400, 2, 3],
  [400, 800, 3, 5],
  [800, 1100, 5, 7],
]
const CHUNK_WORDS: W[] = [
  [0, 300, 1, 3],
  [300, 400, 3, 4],
  [400, 800, 4, 7],
  [800, 1100, 7, 9],
]

test('readCachedAudio(HIT) — 새 행은 저장 timing 을, 옛 행(NULL)·timingVersion 칸 불일치는 null 을 준다(오디오는 같다)', async () => {
  const fresh = 'c1'.repeat(20)
  const old = 'c2'.repeat(20)
  const mismatch = 'c3'.repeat(20)
  const a = await putRow(fresh, 1200, storedJson(NORM_WORDS, 1200), VERSION)
  const b = await putRow(old, 900, null, null)
  await putRow(mismatch, 1200, storedJson(NORM_WORDS, 1200), 'engine-duration-0')
  const h = await readCachedAudio(fresh)
  assert.ok(h && h.audio.equals(a))
  assert.deepEqual(h.timing, { v: 1, method: 'ENGINE_DURATION', alignerVersion: VERSION, coord: 'codepoint', base: 'normalizedText', durationMs: 1200, words: NORM_WORDS })
  const o = await readCachedAudio(old)
  assert.ok(o && o.audio.equals(b))
  assert.equal(o.timing, null, '012b-4 이전 행')
  assert.equal((await readCachedAudio(mismatch))?.timing, null, 'timingVersion 칸 불일치')
})

test('synthesizeSentence CACHE 경로 — 저장 timing(정규화 글 좌표)을 조각 글 좌표로 돌려주고 TTS_TIMING 을 Trace 기록 **안에** 넣는다 · 옛 행은 null·NONE', async () => {
  const input: SynthesizeInput = { userId: U1, text: TEXT, trace: { refType: 'speechTts' } }
  const s = await seed(input, NORM_WORDS, 1200)
  assert.equal(s.normalizedText, '今日は十時です。', '정규화 전제')
  traces.length = 0
  const r = await synthesizeSentence(input)
  assert.equal(r.cached, true)
  assert.ok(r.audio.equals(s.audio))
  assert.deepEqual(r.timing, { v: 1, coord: 'codepoint', durationMs: 1200, words: CHUNK_WORDS })
  assert.deepEqual(r.timing!.words.map((w) => sliceCp(TEXT, w[2], w[3])), ['今日', 'は', '10時', 'です'])
  assert.deepEqual(timingSteps(r.steps).map((x) => [x.name, x.status, x.source, x.words]), [['TTS_TIMING[0]', 'OK', 'CACHE', 4]])
  assert.equal(traces.length, 1)
  assert.deepEqual(timingSteps(traces[0].steps).map((x) => x.status), ['OK'], '기록된 Trace 행에 TTS_TIMING 이 들어 있다(나중 append 아님)')

  const oldInput: SynthesizeInput = { userId: U1, text: 'おはようございます。', trace: { refType: 'speechTts' } }
  const o = await seed(oldInput, null, 900)
  const r2 = await synthesizeSentence(oldInput)
  assert.equal(r2.cached, true)
  assert.ok(r2.audio.equals(o.audio), '옛 행도 오디오는 그대로')
  assert.equal(r2.timing, null)
  assert.deepEqual(timingSteps(r2.steps).map((x) => [x.status, x.source]), [['NONE', 'CACHE']])
})

test('회화 턴(createTurnSpeaker) — 서명 토큰에 그 청크 글 기준 timing 을 묶어 #24(캐시 파일 경로)가 돌려준다, 타인 세션은 404', async () => {
  // turnSpeaker 가 synthesizeSentence 에 넘기는 것과 같은 입력(TALK·styleHint null) — chunk 는 키에 들어가지 않는다.
  await seed({ userId: U1, text: TEXT, styleHint: null, contextMode: 'TALK', trace: { refType: 'chatMessage', record: false } }, NORM_WORDS, 1200)
  clearTokenTiming()
  const speak = createTurnSpeaker({ userId: U1, messageId: 'msg-wiring' })
  const a = await speak({ chunkIndex: 0, text: TEXT, styleHint: null, previousDurationMs: null })
  assert.equal(a.status, 'OK')
  assert.equal(a.cached, true)
  assert.deepEqual(timingSteps(a.steps).map((x) => [x.status, x.source]), [['OK', 'CACHE']], '턴 Trace 가 합칠 steps 에 TTS_TIMING')
  clearRecentAudio()
  const token = tokenOf(a.url)
  const f = await readSignedTtsAudio(U1, token)
  assert.ok(f, '#24 캐시 파일 경로')
  assert.deepEqual(f.timing, { v: 1, coord: 'codepoint', durationMs: 1200, words: CHUNK_WORDS })
  assert.equal(await readSignedTtsAudio(U2, token), null, '타인 세션')
})

test('레슨 오디오(#62c) — clips[].charStart = 조각이 줄에서 시작하는 코드포인트, 각 clip 토큰에 그 조각 글 timing(charStart 를 더하면 줄 좌표)', async () => {
  const line = '😊はい、そうです。今日は10時に会いましょう！'
  const pieces = lessonClipPieces(line)
  assert.deepEqual(pieces, [
    { text: '😊はい、そうです。', charStart: 0 },
    { text: '今日は10時に会いましょう！', charStart: 9 },
  ])
  const lessonInput = (text: string): SynthesizeInput => ({ userId: U1, text, speechProfile: 'LEARNING_NORMAL', contextMode: 'LESSON_READ', scope: { lessonId: 'lesson-wiring', topicId: null }, trace: { refType: 'lessonAudio', refId: 'lesson-wiring' } })
  const s1 = await seed(lessonInput(pieces[0].text), [[0, 200, 0, 2], [300, 800, 3, 7]], 1000)
  const s2 = await seed(lessonInput(pieces[1].text), [[0, 300, 0, 2], [300, 400, 2, 3], [400, 800, 3, 5], [800, 900, 5, 6], [900, 1500, 6, 12]], 1600)
  assert.deepEqual([s1.normalizedText, s2.normalizedText], ['はい、そうです。', '今日は十時に会いましょう！'], '정규화 전제')
  clearTokenTiming()
  const r = await synthesizeLessonClips({ userId: U1, text: line, pace: 'normal', lessonId: 'lesson-wiring', topicId: null })
  assert.deepEqual(r.clips.map((c) => c.charStart), [0, 9])
  clearRecentAudio()
  const lineWords: string[][] = []
  for (const c of r.clips) {
    const f = await readSignedTtsAudio(U1, tokenOf(c.url))
    assert.ok(f?.timing, 'clip 토큰에 timing')
    lineWords.push(f.timing.words.map((w) => sliceCp(line, c.charStart! + w[2], c.charStart! + w[3])))
  }
  assert.deepEqual(lineWords, [
    ['はい', 'そうです'],
    ['今日', 'は', '10時', 'に', '会いましょう'],
  ])
})

test('#24 토큰 timing 맵 — 상한 512(가장 오래된 것부터 밀림)·만료 항목은 다음 서명 때 청소(가짜 시계)', () => {
  const map = globalThis.__kaiwaTtsTokenTiming
  assert.ok(map, '보관소는 globalThis 에 하나')
  const T: TtsTiming = { v: 1, coord: 'codepoint', durationMs: 900, words: [[0, 300, 0, 2]] }
  const keyOf = (i: number) => i.toString(16).padStart(40, '0')
  const now = Date.UTC(2026, 9, 7, 3, 0, 0)
  clearTokenTiming()
  const first = signTtsAudioToken(U1, keyOf(0), { now, timing: T }).token
  for (let i = 1; i < TOKEN_TIMING_MAX_ENTRIES; i++) signTtsAudioToken(U1, keyOf(i), { now, timing: T })
  assert.equal(map.size, TOKEN_TIMING_MAX_ENTRIES)
  assert.ok(map.has(first))
  const last = signTtsAudioToken(U1, keyOf(TOKEN_TIMING_MAX_ENTRIES), { now, timing: T }).token
  assert.equal(map.size, TOKEN_TIMING_MAX_ENTRIES, '상한을 넘지 않는다')
  assert.ok(!map.has(first), '가장 오래된 것이 밀린다')
  assert.ok(map.has(last))

  clearTokenTiming()
  const a = signTtsAudioToken(U1, keyOf(1), { now, timing: T }).token
  signTtsAudioToken(U1, keyOf(2), { now: now + (TTS_AUDIO_URL_TTL_SEC - 1) * 1000, timing: T })
  assert.ok(map.has(a), '만료 전에는 남는다')
  signTtsAudioToken(U1, keyOf(3), { now: now + TTS_AUDIO_URL_TTL_SEC * 1000, timing: T })
  assert.ok(!map.has(a), '만료된 항목은 다음 서명 때 지운다')
  assert.equal(map.size, 2)
  clearTokenTiming()
})

// ── 라우트·안전망(정적) ───────────────────────────────────────────────────────────────────────

const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const bodyOf = (s: string, from: string, to: string) => {
  const a = s.indexOf(from)
  assert.ok(a >= 0, `${from} 이 있어야 한다`)
  const b = s.indexOf(to, a + from.length)
  return s.slice(a, b < 0 ? undefined : b)
}

test('헤더 직렬화 상한 3KB — 라우트(#23·#24)가 쓰는 encodeTimingHeader 는 넘으면 null(헤더 생략)', () => {
  const words = Array.from({ length: 200 }, (_, i): W => [i * 10, i * 10 + 5, i, i + 1])
  const big: TtsTiming = { v: 1, coord: 'codepoint', durationMs: 5000, words }
  const raw = Buffer.from(JSON.stringify(big), 'utf8').toString('base64url')
  assert.ok(raw.length > TTS_TIMING_HEADER_MAX, '시험 전제: 상한을 넘는 값')
  assert.equal(encodeTimingHeader(big), null)
  const small: TtsTiming = { ...big, words: words.slice(0, 5) }
  assert.equal(encodeTimingHeader(small), Buffer.from(JSON.stringify(small), 'utf8').toString('base64url'))
  assert.equal(TTS_HEADERS.timing, 'X-Tts-Timing')
})

test('#23 라우트 배선(정적) — wav 는 X-Tts-Timing 헤더, JSON 은 timing 필드 + 같은 timing 을 #24 토큰에 묶는다', () => {
  const lib = bodyOf(src('src/app/api/v1/speech/_lib/tts.ts'), 'export function ttsAudioResponse', 'const REQUEST_MESSAGE')
  assert.match(lib, /const timing = encodeTimingHeader\(r\.timing\)/)
  assert.match(lib, /if \(timing\) headers\.set\(TTS_HEADERS\.timing, timing\)/)
  assert.match(lib, /return new Response\(new Uint8Array\(r\.audio\), \{ status: 200, headers \}\)/)
  const route = src('src/app/api/v1/speech/tts/route.ts')
  const json = bodyOf(route, "includes('application/json')", 'return ttsAudioResponse(r)')
  assert.match(json, /signTtsAudioToken\(s\.user\.id, r\.cacheKey, \{ timing: r\.timing \}\)/)
  assert.match(json, /\n\s+timing: r\.timing,\n/)
  assert.match(route, /return ttsAudioResponse\(r\)/)
  assert.doesNotMatch(route + lib, /x-kaiwa/i, '엔진 헤더를 그대로 넘기지 않는다')
})

test('#24·#62c 라우트 배선(정적) — #24 wav 헤더·JSON timing 은 토큰에 묶인 값(상한 넘으면 둘 다 없음), #62c 는 clips 를 그대로', () => {
  const route = src('src/app/api/v1/speech/tts/[token]/route.ts')
  assert.match(route, /const f = await readSignedTtsAudio\(s\.user\.id, token\)/)
  assert.match(route, /const timingHeader = encodeTimingHeader\(f\.timing\)/)
  assert.match(route, /timing: timingHeader \? f\.timing : null/)
  assert.match(route, /if \(timingHeader\) headers\.set\(TTS_HEADERS\.timing, timingHeader\)/)
  assert.doesNotMatch(route, /x-kaiwa/i)
  const lesson = src('src/app/api/v1/lessons/[id]/audio/route.ts')
  assert.match(lesson, /clips: r\.clips,/)
})

test('attachTiming 안전망(정적) — 되돌리기가 던져도 ERROR 상태로 흡수(오디오 응답은 그대로)', () => {
  const body = bodyOf(src('src/modules/speech/tts/synthesize.ts'), 'function attachTiming(', 'return r.timing')
  assert.match(body, /try \{\s*r = chunkTiming\(src\.stored, src\.missing, chunk, audioDurationMs\)\s*\} catch \{\s*r = \{ timing: null, status: 'ERROR', words: 0, bytes: null \}\s*\}/)
  assert.equal((body.match(/chunkTiming\(/g) ?? []).length, 1, 'try 밖 호출 없음')
})
