/**
 * task-081 화면 갈래 ③a — ③ 조각 단계의 순수 논리(`chunkLogic`)·문구(`lessonCopy` U3·STAGE·PIECE)·재생 요청(`useLessonPlayback`)·진행 쓰기(`useLesson`).
 * `phraseText`·`pieceCount` 기대값은 서버 `content.ts` 와 공유하는 `pieceRuleCases.json` 에서 읽는다(같은 규칙 두 벌을 한 픽스처로 묶음).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { createTtsPlaybackQueue, type PlaybackHandle } from '@/modules/speech/tts/client'
import { hangulLine, type ReadingSegment } from '@/modules/speech/reading/client'
import type { DialoguePiece } from '@/types/lesson'
import {
  chunkMode,
  collectPieces,
  phraseIndexOf,
  phraseKey,
  phraseText,
  pieceCount,
  pieceHangul,
  pieceHangulLine,
  pieceKey,
  pieceRanges,
  pieceRuns,
  type ChunkContent,
} from '../chunkLogic'
import { PIECE_TYPE_LABEL, PIECE_TYPE_ORDER, STAGE_COPULA, STAGE_NAMES, U3, stageLabel } from '../lessonCopy'
import { keyActive, lessonAudioBody } from '../useLessonPlayback'
import { patchOf } from '../useLesson'

interface RuleCases {
  phrase: { name: string; pieces: DialoguePiece[]; expect: (string | null)[] }[]
  count: { name: string; content: ChunkContent; expect: number | null }[]
}
const cases = JSON.parse(readFileSync(join(process.cwd(), 'src/modules/learning/lessons/__tests__/pieceRuleCases.json'), 'utf8')) as RuleCases

const P = (ja: string, type: DialoguePiece['type'], ko: string | null, slash = false): DialoguePiece => (slash ? { ja, type, ko, slash: true } : { ja, type, ko })
const S = (surface: string, pron: string | null, boundary: ReadingSegment['boundary'], ruby: ReadingSegment['ruby'] = null): ReadingSegment => ({ surface, ruby, pron, boundary })
const ready = (segments: ReadingSegment[]): AnnotationState => ({ s: 'ready', segments })

// 데모 1번 문장 — 温かい|コーヒー|を／一つ／ください|。
const JA = '温かいコーヒーを一つください。'
const PCS: DialoguePiece[] = [P('温かい', 'FEELING', '따뜻한'), P('コーヒー', 'NAME', '커피'), P('を', 'LINK', '~을/를', true), P('一つ', 'NAME', '하나', true), P('ください', 'ACTION', '주세요'), P('。', null, null)]
const SEGS: ReadingSegment[] = [
  S('温かい', 'アタタカイ', null, [['温', 'あたた'], ['かい', null]]),
  S('コーヒー', 'コーヒー', 'phrase'),
  S('を', 'オ', 'particle'),
  S('一つ', 'ヒトツ', 'phrase', [['一', 'ひと'], ['つ', null]]),
  S('ください', 'クダサイ', 'phrase'),
  S('。', '。', null),
]
const one = (s: ReadingSegment) => hangulLine([{ ...s, boundary: null }])

test('chunkMode — 어느 줄에도 pieces 배열이 없을 때만 none(null 줄만 있어도 none, 배열 하나면 lines)', () => {
  assert.equal(chunkMode({ dialogue: [{}, {}] }), 'none')
  assert.equal(chunkMode({ dialogue: [{ pieces: null }, { pieces: null }] }), 'none')
  assert.equal(chunkMode({ dialogue: [{ pieces: null }, { pieces: PCS }] }), 'lines')
  assert.equal(chunkMode({ dialogue: [{ pieces: [] }] }), 'lines')
})

test('pieceRanges — 코드포인트 누적, 이은 글이 원문과 다르면 null', () => {
  assert.deepEqual(pieceRanges(PCS, JA), [{ start: 0, end: 3 }, { start: 3, end: 7 }, { start: 7, end: 8 }, { start: 8, end: 10 }, { start: 10, end: 14 }, { start: 14, end: 15 }])
  // 서로게이트 한 글자(𠮷)는 1 칸
  assert.deepEqual(pieceRanges([P('𠮷野家', 'NAME', '요시노야'), P('へ', 'LINK', '~에')], '𠮷野家へ'), [{ start: 0, end: 3 }, { start: 3, end: 4 }])
  assert.equal(pieceRanges(PCS, '温かいコーヒーを一つください'), null, '끝 문장부호가 빠진 원문')
  assert.equal(pieceRanges(PCS, '温かい コーヒーを一つください。'), null, '공백 하나도 관용 없음')
  assert.equal(pieceRanges(PCS)?.length, 6, '원문을 주지 않으면 누적만')
})

test('pieceRuns — 문장 루비를 조각 경계로 자른다(읽기 없는 이웃은 조각마다 나뉨), 끔·대기·어긋남은 글자 그대로', () => {
  const runs = pieceRuns(ready(SEGS), JA, PCS, true)
  assert.deepEqual(runs, [
    [{ text: '温', reading: 'あたた' }, { text: 'かい', reading: null }],
    [{ text: 'コーヒー', reading: null }],
    [{ text: 'を', reading: null }],
    [{ text: '一', reading: 'ひと' }, { text: 'つ', reading: null }],
    [{ text: 'ください', reading: null }],
    [{ text: '。', reading: null }],
  ])
  const plain = PCS.map((p) => [{ text: p.ja, reading: null }])
  assert.deepEqual(pieceRuns(ready(SEGS), JA, PCS, false), plain, '히라가나 끔')
  assert.deepEqual(pieceRuns({ s: 'loading' }, JA, PCS, true), plain, '분석 대기')
  assert.deepEqual(pieceRuns({ s: 'none' }, JA, PCS, true), plain, '분석 실패')
  assert.deepEqual(pieceRuns(ready(SEGS.slice(0, 5)), JA, PCS, true), plain, '분석 글이 원문과 다름')
  assert.deepEqual(pieceRuns(ready(SEGS), JA + '!', PCS, true), plain.map((r) => r), '조각 범위 없음(이은 글 ≠ 원문)')
})

test('pieceRuns — 경계가 한자 묶음 한가운데면 그 묶음 읽기만 빠진다', () => {
  const pcs = [P('今', 'NAME', '지금'), P('日は', 'NAME', '날은')]
  const runs = pieceRuns(ready([S('今日は', 'キョーワ', null, [['今日', 'きょう'], ['は', null]])]), '今日は', pcs, true)
  assert.deepEqual(runs, [[{ text: '今', reading: null }], [{ text: '日は', reading: null }]])
  const ok = pieceRuns(ready([S('今日', 'キョー', null, [['今日', 'きょう']]), S('は', 'ワ', 'particle')]), '今日は', [P('今日', 'NAME', '오늘'), P('は', 'LINK', '~은/는')], true)
  assert.deepEqual(ok, [[{ text: '今日', reading: 'きょう' }], [{ text: 'は', reading: null }]], '경계가 묶음 사이면 읽기 유지')
})

test('pieceHangul — 시작 위치가 든 조각에 붙이고(첫 구분 없음), 문장부호 조각은 null, 경계를 넘는 분석 조각은 걸친 조각 모두 null', () => {
  const hs = pieceHangul(SEGS, JA, PCS)
  assert.deepEqual(hs, [one(SEGS[0]), one(SEGS[1]), one(SEGS[2]), one(SEGS[3]), one(SEGS[4]), null])
  assert.ok(hs.slice(0, 5).every((h) => typeof h === 'string' && h.length > 0 && h === h.trim()), '조각 한글은 비지 않고 앞뒤 공백 없음')
  const crossed = [SEGS[0], S('コーヒーを', 'コーヒーオ', 'phrase'), SEGS[3], SEGS[4], SEGS[5]]
  assert.deepEqual(pieceHangul(crossed, JA, PCS), [one(SEGS[0]), null, null, one(SEGS[3]), one(SEGS[4]), null])
  // 한 조각 안에 분석 조각 둘 — 묶음 하나로(안쪽 구분은 문장 한글 줄과 같게 둔다)
  const multi = pieceHangul([S('お待ち', 'オマチ', null, [['お', null], ['待', 'ま'], ['ち', null]]), S('ください', 'クダサイ', 'phrase'), S('。', '。', null)], 'お待ちください。', [P('お待ちください', 'ACTION', '기다려 주세요'), P('。', null, null)])
  assert.deepEqual(multi, [hangulLine([S('お待ち', 'オマチ', null), S('ください', 'クダサイ', 'phrase')]), null])
  assert.deepEqual(pieceHangul(SEGS.slice(0, 5), JA, PCS), PCS.map(() => null), '분석 글이 원문과 다르면 모두 null')
  assert.deepEqual(pieceHangul([S('温かい', null, null), ...SEGS.slice(1)], JA, PCS)[0], null, '발음을 못 구한 분석 조각')
})

test('pieceHangulLine — 연결 조각은 붙이고 나머지는 띄움, slash 뒤 « /», 끝 빗금 없음, 하나라도 null 이면 문장 한글 줄', () => {
  const [a, b, c, d, e] = PCS.slice(0, 5).map((_, j) => one(SEGS[j]))
  assert.equal(pieceHangulLine(SEGS, JA, PCS), `${a} ${b}${c} / ${d} / ${e}`)
  const crossed = [SEGS[0], S('コーヒーを', 'コーヒーオ', 'phrase'), SEGS[3], SEGS[4], SEGS[5]]
  assert.equal(pieceHangulLine(crossed, JA, PCS), hangulLine(crossed), '경계를 넘는 분석 조각 → 빗금 없는 문장 한글 줄')
  // 、 뒤 끊기(type null 조각의 slash) — 문장부호는 글 없이 빗금만
  const segs2 = [S('いいえ', 'イイエ', null), S('、', '、', null), S('持ち帰ります', 'モチカエリマス', 'phrase', [['持', 'も'], ['ち', null], ['帰', 'かえ'], ['ります', null]]), S('。', '。', null)]
  const pcs2 = [P('いいえ', 'EXPRESSION', '아니요'), P('、', null, null, true), P('持ち帰ります', 'ACTION', '가져갈게요'), P('。', null, null)]
  assert.equal(pieceHangulLine(segs2, 'いいえ、持ち帰ります。', pcs2), `${one(segs2[0])} / ${one(segs2[2])}`)
  // 마지막 조각의 slash 는 끝 빗금을 남기지 않는다 · 빗금 뒤 연결 조각은 한 칸 띄운다
  const segs3 = [S('駅', 'エキ', null, [['駅', 'えき']]), S('まで', 'マデ', 'particle')]
  assert.equal(pieceHangulLine(segs3, '駅まで', [P('駅', 'NAME', '역', true), P('まで', 'LINK', '~까지', true)]), `${one(segs3[0])} / ${one(segs3[1])}`)
})

test('phraseIndexOf — 앞 조각들의 slash 수(phraseText 와 같은 나눔)', () => {
  assert.deepEqual(PCS.map((_, j) => phraseIndexOf(PCS, j)), [0, 0, 0, 1, 2, 2])
  for (const c of cases.phrase) {
    c.pieces.forEach((p, j) => {
      if (p.type === null) return
      const k = phraseIndexOf(c.pieces, j)
      assert.ok(phraseText(c.pieces, k)?.includes(p.ja), `${c.name}: 조각 ${j} 의 구간 글에 그 조각이 있다`)
    })
  }
})

test('phraseText — 서버와 같은 픽스처·같은 기대값(끝 type null 제외·문장부호뿐인 구간 null·범위 밖 null)', () => {
  assert.ok(cases.phrase.length >= 6)
  for (const c of cases.phrase) assert.deepEqual(c.expect.map((_, k) => phraseText(c.pieces, k)), c.expect, c.name)
  assert.equal(phraseText(PCS, -1), null)
  assert.equal(phraseText(PCS, 0.5), null)
})

test('pieceCount — 서버와 같은 픽스처·같은 기대값(none → null)', () => {
  assert.ok(cases.count.length >= 5)
  for (const c of cases.count) assert.equal(pieceCount(c.content), c.expect, c.name)
})

test('collectPieces — type+ja 로 한 번만(처음 나온 줄·위치), 종류 순서 이름→액션→느낌→꾸밈→표현→연결, null·옛 줄 건너뜀', () => {
  const c3 = cases.count.find((c) => c.expect === 5)
  assert.ok(c3)
  assert.deepEqual(collectPieces(c3.content), [
    { type: 'NAME', ja: 'コーヒー', ko: '커피', line: 0, j: 0 },
    { type: 'ACTION', ja: 'ください', ko: '주세요', line: 0, j: 2 },
    { type: 'FEELING', ja: '温かい', ko: '따뜻한', line: 2, j: 2 },
    { type: 'LINK', ja: 'を', ko: '~을/를', line: 0, j: 1 },
    { type: 'LINK', ja: 'は', ko: '~은/는', line: 2, j: 1 },
  ])
  const mixed: ChunkContent = { dialogue: [{ pieces: [P('ね', 'LINK', '~네'), P('はい', 'EXPRESSION', '네'), P('とても', 'MODIFIER', '매우'), P('。', null, null)] }, { pieces: [P('はい', 'EXPRESSION', '네(두 번째)')] }] }
  assert.deepEqual(collectPieces(mixed).map((p) => `${p.type}:${p.ja}:${p.line}`), ['MODIFIER:とても:0', 'EXPRESSION:はい:0', 'LINK:ね:0'])
  assert.equal(collectPieces({ dialogue: [{}, { pieces: null }] }).length, 0)
})

test('pieceKey·phraseKey — 재생 키 모양, 서로·줄 사이 겹치지 않음', () => {
  assert.equal(pieceKey(2, 3), 'piece:2:3')
  assert.equal(phraseKey(2, 3), 'phrase:2:3')
  const keys = new Set([pieceKey(1, 12), pieceKey(11, 2), phraseKey(1, 12), phraseKey(11, 2)])
  assert.equal(keys.size, 4)
})

test('재생 요청 본문 — sub 는 piece·phrase 에서만, 다른 kind 는 지금과 같은 바이트', () => {
  assert.equal(JSON.stringify(lessonAudioBody({ kind: 'dialogue', idx: 0, pace: 'normal' })), '{"kind":"dialogue","idx":0,"pace":"normal"}')
  assert.equal(JSON.stringify(lessonAudioBody({ kind: 'dialogue', idx: 0, sub: 1, pace: 'slow' })), '{"kind":"dialogue","idx":0,"pace":"slow"}', '다른 kind 의 sub 는 싣지 않음(서버 400)')
  for (const kind of ['grammar', 'application', 'speaking', 'chunk'] as const) assert.equal('sub' in lessonAudioBody({ kind, idx: 1, sub: 0, pace: 'normal' }), false, kind)
  assert.deepEqual(lessonAudioBody({ kind: 'piece', idx: 2, sub: 1, pace: 'normal' }), { kind: 'piece', idx: 2, pace: 'normal', sub: 1 })
  assert.deepEqual(lessonAudioBody({ kind: 'phrase', idx: 0, sub: 0, pace: 'normal' }), { kind: 'phrase', idx: 0, pace: 'normal', sub: 0 }, 'sub 0 도 싣는다')
  assert.equal('sub' in lessonAudioBody({ kind: 'piece', idx: 0, pace: 'normal' }), false, 'sub 가 없으면 넣지 않음(서버가 required 로 막음)')
  assert.equal('text' in lessonAudioBody({ kind: 'piece', idx: 0, sub: 0, pace: 'normal' }), false, '글자는 보내지 않는다')
})

test('재생 키 판정 — 조각·구간 키로 재생하면 그 키만 active, 멈추면 아님', async () => {
  let end: () => void = () => undefined
  const q = createTtsPlaybackQueue({
    fetchAudio: async () => new ArrayBuffer(1),
    play: async () => {
      const ended = new Promise<void>((r) => (end = r))
      const h: PlaybackHandle = { stop: () => end(), ended }
      return h
    },
    now: () => 0,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  })
  q.playParts('replay', pieceKey(2, 3), [async () => new ArrayBuffer(1)])
  assert.equal(keyActive(q.getSnapshot(), pieceKey(2, 3)), true)
  assert.equal(keyActive(q.getSnapshot(), phraseKey(2, 3)), false)
  assert.equal(keyActive(q.getSnapshot(), pieceKey(2, 4)), false)
  q.playParts('replay', phraseKey(2, 1), [async () => new ArrayBuffer(1)])
  assert.equal(keyActive(q.getSnapshot(), phraseKey(2, 1)), true)
  assert.equal(keyActive(q.getSnapshot(), pieceKey(2, 3)), false, '다른 재생이 시작되면 앞 키는 아님')
  q.interrupt('USER_STOP')
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(keyActive(q.getSnapshot(), phraseKey(2, 1)), false)
  q.dispose()
})

test('진행 쓰기 — pieces 절은 seen 을 중복 없이 오름차순으로, 다른 절과 섞이지 않음', () => {
  assert.deepEqual(patchOf({ pieces: { seen: [2, 0, 2, 1] } }, new Set(['pieces'] as const)), { pieces: { seen: [0, 1, 2] } })
  assert.deepEqual(patchOf({}, new Set(['pieces'] as const)), { pieces: { seen: [] } })
  assert.deepEqual(patchOf({ pieces: { seen: [1] }, application: { answers: [] } }, new Set(['application'] as const)), { application: { answers: [] } }, 'pieces 가 대기 아니면 싣지 않음')
})

test('문구 — 단계 이름·받침 표·조각 종류 6종', () => {
  assert.deepEqual([...STAGE_NAMES], ['이해', '문법', '조각', '응용', '말하기'])
  assert.equal(stageLabel(3), '③ 조각')
  const hasBatchim = (w: string) => (w.charCodeAt(w.length - 1) - 0xac00) % 28 !== 0
  STAGE_NAMES.forEach((n, i) => assert.equal(STAGE_COPULA[i], hasBatchim(n) ? '이에요' : '예요', `${n} 받침`))
  assert.equal(`${stageLabel(2)}${STAGE_COPULA[1]}`, '② 문법이에요')
  assert.equal(`${stageLabel(3)}${STAGE_COPULA[2]}`, '③ 조각이에요')
  assert.deepEqual([...PIECE_TYPE_ORDER], ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION', 'LINK'])
  assert.deepEqual(Object.keys(PIECE_TYPE_LABEL).sort(), [...PIECE_TYPE_ORDER].sort())
  for (const t of PIECE_TYPE_ORDER) {
    const l = PIECE_TYPE_LABEL[t]
    assert.ok(l.short.length > 0 && l.full === `${l.short} 조각`, t)
  }
  assert.deepEqual(PIECE_TYPE_ORDER.map((t) => PIECE_TYPE_LABEL[t].short), ['이름', '액션', '느낌', '꾸밈', '표현', '연결'])
})

test('문구 — U3 가이드 글자 그대로(일부)·«문제» 0·엔진명 0·셈 뜻 «세요» 0', () => {
  assert.equal(U3.title, '③ 조각 · 문장 끊어 보기')
  assert.equal(U3.counter(1, 8), '문장 1 / 8')
  assert.equal(U3.seen(2), '2개 봤어요')
  assert.equal(U3.cardHead('손님', 3), '손님 · 3번째 문장')
  assert.equal(U3.gate(1, 8), '마지막 문장까지 보면 다음 단계로 갈 수 있어요. (1/8)')
  assert.equal(`${U3.collect}${U3.collectCount(34)}`, '오늘의 조각 모아 보기 · 34개')
  assert.equal(U3.group(PIECE_TYPE_LABEL.NAME.full, 5), '이름 조각 5개')
  assert.equal(`${PIECE_TYPE_LABEL.FEELING.short}${U3.tileSrTail('따뜻한')}`, '느낌 조각, 따뜻한')
  assert.equal(U3.phrase('温かいコーヒーを'), `${U3.phraseLead}温かいコーヒーを${U3.phraseTail}`)
  assert.equal(U3.phrase('一つ'), '▶ 구간 듣기 「一つ」')
  assert.equal(U3.tilesAriaTextOnly(6), '조각 6개 · 누르면 뜻이 나와요')
  const texts = Object.values(U3).map((v) => (typeof v === 'function' ? (v as (...a: unknown[]) => string)('X', 1) : v))
  texts.push(...PIECE_TYPE_ORDER.flatMap((t) => [PIECE_TYPE_LABEL[t].short, PIECE_TYPE_LABEL[t].full]), ...STAGE_NAMES)
  for (const s of texts) {
    assert.equal(typeof s, 'string')
    assert.doesNotMatch(s, /문제/, s)
    assert.doesNotMatch(s, /reazon|whisper|style-?bert|sbv2|claude|qwen|ollama|haiku|sonnet|opus|gemini|gpt/i, s)
    assert.doesNotMatch(s, /(^|[\s(])세(요|어|서)/, `셈 뜻 «세요»: ${s}`)
  }
})

test('배선 — chunkLogic 은 React·fetch 없이 순수, 엔진명 0', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/lesson/chunkLogic.ts'), 'utf8')
  assert.doesNotMatch(src, /from 'react'|useState|useEffect|fetch\(|window\./)
  for (const f of ['chunkLogic.ts', 'lessonCopy.ts', 'useLessonPlayback.ts', 'useLesson.ts']) {
    const s = readFileSync(join(process.cwd(), 'src/components/lesson', f), 'utf8')
    assert.doesNotMatch(s, /reazon|whisper|style-?bert|sbv2|claude|qwen|ollama|haiku|sonnet|opus/i, `${f}: 엔진명`)
  }
})
