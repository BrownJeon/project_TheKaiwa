/**
 * task-081 서버 갈래 1 — 조각(pieces) 저장·읽기(37-12-1·37-12-9)·소리 kind piece/phrase(37-12-6)·진행 pieces.seen(37-12-8)·오늘 조각 수(37-12-7).
 * `phraseText`·`pieceCount` 기대값은 화면 chunkLogic 과 공유하는 `pieceRuleCases.json` 에 있다(같은 규칙 두 벌을 한 픽스처로 묶음).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import { audioText, AUDIO_KINDS, phraseText, pieceCount, readStoredContent, toStoredContent, type LessonGenOutput, type StoredLessonContent, type StoredPiece } from '../content'
import { mergeProgress, parseProgressPatch, type LessonProgress, type ProgressLimits } from '../progress'
import { parseAudioBody } from '../validate'

const err = (field: string, reason?: string) => (e: unknown) => {
  if (!(e instanceof ApiError) || e.code !== 'VALIDATION') return false
  const d = e.details as { field?: string; reason?: string } | undefined
  return d?.field === field && (reason === undefined || d?.reason === reason)
}

const P = (ja: string, type: StoredPiece['type'], ko: string | null, slash = false): StoredPiece => ({ ja, type, ko, ...(slash ? { slash: true as const } : {}) })
const DEMO1: StoredPiece[] = [P('温かい', 'FEELING', '따뜻한'), P('コーヒー', 'NAME', '커피'), P('を', 'LINK', '~을/를', true), P('一つ', 'NAME', '하나', true), P('ください', 'ACTION', '주세요'), P('。', null, null)]

/** 새 A4 응답(lesson@v10 — 문항 없음·줄마다 pieces). 줄 1 은 분해 실패(null). */
function genNew(): LessonGenOutput {
  return {
    title: 'カフェ',
    titleKo: '카페',
    rolesKo: { A: '점원', B: '손님' },
    dialogue: [
      { speaker: 'B', ja: '温かいコーヒーを一つください。', reading: 'あたたかいこーひーをひとつください。', ko: '따뜻한 커피 하나 주세요.', pieces: DEMO1 },
      { speaker: 'A', ja: 'かしこまりました。', reading: 'かしこまりました。', ko: '알겠습니다.', pieces: null },
      { speaker: 'B', ja: 'はい。', reading: 'はい。', ko: '네.', pieces: [P('はい', 'EXPRESSION', '네'), P('。', null, null)] },
    ],
    chunks: [{ id: 'c1', textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME', isNew: false }],
    grammar: [{ id: 'g1', pattern: '〜をください', explanationKo: '~을 주세요', exampleJa: '水をください。', exampleReading: 'みずをください。', exampleKo: '물 주세요.' }],
    application: [{ id: 'a1', promptKo: '.', hintJa: null, modelAnswerJa: '紅茶をください。', modelReading: 'こうちゃをください。', modelKo: '.', targetIds: ['g1'] }],
    speaking: [{ id: 's1', promptKo: '.', targetIds: ['c1'], modelAnswerJa: 'コーヒーをください。', modelReading: 'こーひーをください。', modelKo: '.' }],
    nextPreview: { titleKo: '다음', teaserKo: '.' },
  }
}

/** 저장 JSON 처럼 한 번 직렬화한 뒤 읽는다. */
const roundTrip = (v: unknown) => readStoredContent(JSON.parse(JSON.stringify(v)))

// ── 저장·읽기(37-12-1·37-12-9) ─────────────────────────────────────────────

test('toStoredContent(새 수업): quiz 키 없음·pieces 그대로·키가 빠진 줄은 null·스키마 밖 quiz 는 버림', () => {
  const out = genNew() as LessonGenOutput & { quiz?: unknown }
  out.quiz = [{ id: 'q1' }]
  ;(out.dialogue[2] as { pieces?: unknown }).pieces = undefined
  const c = toStoredContent(out)
  assert.equal('quiz' in c, false, '새 수업 내용에는 quiz 키 자체가 없다')
  assert.deepEqual(c.dialogue[0].pieces, DEMO1)
  assert.equal(c.dialogue[1].pieces, null)
  assert.equal(c.dialogue[2].pieces, null, '키가 빠진 새 줄은 null(키 없음 = 옛 수업 표시라서)')
  assert.deepEqual(c.dialogue.map((d) => d.segment), [1, 1, 1])
  assert.equal(c.segmentCount, 1)
})

test('readStoredContent: 새 수업(quiz 없음) → quiz [] 로 채움, 저장 JSON 은 바꾸지 않음', () => {
  const raw = JSON.parse(JSON.stringify(toStoredContent(genNew())))
  const c = readStoredContent(raw)
  assert.ok(c)
  assert.deepEqual(c.quiz, [])
  assert.equal('quiz' in raw, false, '읽기가 원본 객체에 quiz 를 쓰지 않는다')
  assert.deepEqual(c.dialogue[0].pieces, DEMO1)
  assert.equal(c.dialogue[1].pieces, null)
})

test('readStoredContent: 옛 수업(quiz 있음·pieces 없음)은 저장 객체를 그대로', () => {
  const old = { v: 1, title: 't', titleKo: 'k', rolesKo: { A: 'a', B: 'b' }, dialogue: [{ speaker: 'A', ja: 'はい。', reading: 'はい。', ko: '네.', segment: 1 }], chunks: [], grammar: [], quiz: [{ id: 'q1', promptKo: null, promptJa: null, choices: ['a', 'b', 'c', 'd'], answer: 0, targetIds: [], explanationKo: '.' }], application: [], speaking: [], nextPreview: { titleKo: '.', teaserKo: '.' }, segmentCount: 1 }
  const c = readStoredContent(old)
  assert.equal(c, old as unknown as StoredLessonContent, '같은 객체')
  assert.equal(c!.quiz.length, 1)
  assert.equal('pieces' in c!.dialogue[0], false)
  assert.equal(pieceCount(c!), null)
})

test('readStoredContent: quiz 가 있으면 배열이어야 한다(null·객체·문자열은 손상), 다른 필수 배열은 그대로 필수', () => {
  const base = JSON.parse(JSON.stringify(toStoredContent(genNew())))
  for (const bad of [null, {}, 'x', 3]) assert.equal(readStoredContent({ ...base, quiz: bad }), null, `quiz=${JSON.stringify(bad)}`)
  for (const k of ['dialogue', 'chunks', 'grammar', 'application', 'speaking']) {
    const { [k]: _gone, ...rest } = base
    void _gone
    assert.equal(readStoredContent(rest), null, `${k} 없음`)
  }
  assert.ok(readStoredContent({ ...base, dialogue: [{ ...base.dialogue[0], pieces: 'garbage' }] }), 'pieces 는 읽기에서 검사하지 않는다(생성 때 정리)')
})

// ── 소리 #62c(37-12-6) ────────────────────────────────────────────────────

test('parseAudioBody: piece·phrase 는 sub 필수(0~23 정수)', () => {
  assert.deepEqual(parseAudioBody({ kind: 'piece', idx: 0, sub: 1 }), { kind: 'piece', idx: 0, pace: 'normal', sub: 1 })
  assert.deepEqual(parseAudioBody({ kind: 'phrase', idx: 2, sub: 0, pace: 'slow' }), { kind: 'phrase', idx: 2, pace: 'slow', sub: 0 })
  assert.equal(parseAudioBody({ kind: 'piece', idx: 0, sub: 23 }).sub, 23)
  assert.throws(() => parseAudioBody({ kind: 'piece', idx: 0 }), err('sub', 'required'))
  assert.throws(() => parseAudioBody({ kind: 'phrase', idx: 0, sub: null }), err('sub', 'required'))
  for (const sub of [24, -1, 1.5, '1', true]) assert.throws(() => parseAudioBody({ kind: 'piece', idx: 0, sub }), err('sub', 'invalid'), `sub=${String(sub)}`)
})

test('parseAudioBody: 다른 kind 에 sub 가 오면 400, 응답 모양은 sub 없이 지금과 같음, 글 키는 unknown_key', () => {
  for (const kind of ['dialogue', 'grammar', 'application', 'speaking', 'chunk']) {
    assert.throws(() => parseAudioBody({ kind, idx: 0, sub: 1 }), err('sub', 'not_allowed'), kind)
    assert.throws(() => parseAudioBody({ kind, idx: 0, sub: null }), err('sub', 'not_allowed'), `${kind} sub:null`)
  }
  assert.deepEqual(parseAudioBody({ kind: 'dialogue', idx: 2 }), { kind: 'dialogue', idx: 2, pace: 'normal' })
  assert.throws(() => parseAudioBody({ kind: 'piece', idx: 0, sub: 1, text: '任意' }), err('text', 'unknown_key'))
  assert.throws(() => parseAudioBody({ kind: 'phrase', idx: 0, sub: 0, ja: 'x' }), err('ja', 'unknown_key'))
  assert.ok((AUDIO_KINDS as readonly string[]).includes('piece') && (AUDIO_KINDS as readonly string[]).includes('phrase'))
})

test('audioText piece: 저장된 조각 글만 — 문장부호·없는 조각·null 줄·옛 줄·범위 밖은 null', () => {
  const c = roundTrip(toStoredContent(genNew()))!
  const old = { ...c, dialogue: [...c.dialogue, { speaker: 'A' as const, ja: 'いいえ。', reading: 'いいえ。', ko: '아니요.', segment: 1 }] }
  assert.equal(audioText(c, 'piece', 0, 0), '温かい')
  assert.equal(audioText(c, 'piece', 0, 4), 'ください')
  assert.equal(audioText(c, 'piece', 0, 5), null, '。(type null) 은 소리 없음')
  assert.equal(audioText(c, 'piece', 0, 6), null)
  assert.equal(audioText(c, 'piece', 1, 0), null, '분해 실패 줄')
  assert.equal(audioText(old, 'piece', 3, 0), null, 'pieces 키 없는 옛 줄')
  assert.equal(audioText(c, 'piece', 9, 0), null)
  assert.equal(audioText(c, 'piece', 0, undefined), null)
  assert.equal(audioText(c, 'piece', 0, -1), null)
  assert.equal(audioText(c, 'dialogue', 0), '温かいコーヒーを一つください。', '다른 kind 는 그대로')
  assert.equal(audioText(c, 'dialogue', 0, 3), '温かいコーヒーを一つください。', '다른 kind 는 sub 를 보지 않는다')
  const broken = { ...c, dialogue: [{ ...c.dialogue[0], pieces: [123] as unknown as StoredPiece[] }] }
  assert.equal(audioText(broken, 'piece', 0, 0), null, '모양이 어긋난 저장 조각에도 던지지 않음')
  assert.equal(audioText(broken, 'phrase', 0, 0), null)
})

test('audioText phrase: slash 경계 구간, 끝 문장부호 제외', () => {
  const c = roundTrip(toStoredContent(genNew()))!
  assert.deepEqual([0, 1, 2, 3].map((k) => audioText(c, 'phrase', 0, k)), ['温かいコーヒーを', '一つ', 'ください', null])
  assert.equal(audioText(c, 'phrase', 1, 0), null)
  assert.equal(audioText(c, 'phrase', 2, 0), 'はい')
})

// ── 공용 픽스처(화면 chunkLogic 과 같은 기대값) ──────────────────────────────

type RuleCases = {
  phrase: { name: string; pieces: StoredPiece[]; expect: (string | null)[] }[]
  count: { name: string; content: { dialogue: { pieces?: unknown }[] }; expect: number | null }[]
}
const cases = JSON.parse(readFileSync(join(process.cwd(), 'src/modules/learning/lessons/__tests__/pieceRuleCases.json'), 'utf8')) as RuleCases

test('phraseText: 공용 픽스처', () => {
  assert.ok(cases.phrase.length >= 6)
  for (const c of cases.phrase) assert.deepEqual(c.expect.map((_, k) => phraseText(c.pieces, k)), c.expect, c.name)
  assert.equal(phraseText(DEMO1, -1), null)
  assert.equal(phraseText(DEMO1, 0.5), null)
  assert.equal(phraseText([], 0), null)
})

test('pieceCount: 공용 픽스처 + 실제 저장 모양', () => {
  assert.ok(cases.count.length >= 5)
  for (const c of cases.count) assert.equal(pieceCount(c.content), c.expect, c.name)
  const c = roundTrip(toStoredContent(genNew()))!
  assert.equal(pieceCount(c), 6, 'DEMO1 5개 + はい 1개(null 줄 0)')
})

// ── 진행 #61 pieces.seen(37-12-8) ────────────────────────────────────────

const LIM: ProgressLimits = { segmentCount: 3, quizCount: 0, applicationCount: 2, dialogueCount: 3 }

test('parseProgressPatch pieces.seen: 0 ≤ 정수 < 줄 수, 정렬해 돌려줌', () => {
  assert.deepEqual(parseProgressPatch({ pieces: { seen: [2, 0] } }, LIM), { pieces: { seen: [0, 2] } })
  assert.deepEqual(parseProgressPatch({ pieces: { seen: [] } }, LIM), { pieces: { seen: [] } })
  assert.deepEqual(parseProgressPatch({ pieces: { seen: [0, 1, 2] } }, LIM).pieces, { seen: [0, 1, 2] })
  for (const x of [3, -1, 1.5, '1', null]) assert.throws(() => parseProgressPatch({ pieces: { seen: [x] } }, LIM), err('progress.pieces.seen', 'invalid'), `seen=[${String(x)}]`)
  assert.throws(() => parseProgressPatch({ pieces: { seen: [1, 1] } }, LIM), err('progress.pieces.seen', 'DUPLICATE'))
  assert.throws(() => parseProgressPatch({ pieces: { seen: [0, 1, 2, 0] } }, LIM), err('progress.pieces.seen', 'invalid'), '길이 > 줄 수')
})

test('parseProgressPatch pieces: 모양·허용 키·줄 수 미지정', () => {
  assert.throws(() => parseProgressPatch({ pieces: {} }, LIM), err('progress.pieces.seen'))
  assert.throws(() => parseProgressPatch({ pieces: [] }, LIM), err('progress.pieces'))
  assert.throws(() => parseProgressPatch({ pieces: null }, LIM), err('progress.pieces'))
  assert.throws(() => parseProgressPatch({ pieces: { seen: [0], done: true } }, LIM), err('progress.pieces.done', 'unknown_key'))
  assert.throws(() => parseProgressPatch({ pieces: { seen: [0] } }, { segmentCount: 3, quizCount: 0, applicationCount: 2 }), err('progress.pieces', 'unsupported'))
  assert.throws(() => parseProgressPatch({ chunk: {} }, LIM), err('progress.chunk', 'unknown_key'), '다른 키는 여전히 400')
})

test('parseProgressPatch quiz: 옛 수업 호환으로 허용, 새 수업(quizCount 0)은 빈 배열만', () => {
  assert.deepEqual(parseProgressPatch({ quiz: { answers: [] } }, LIM), { quiz: { answers: [] } })
  assert.throws(() => parseProgressPatch({ quiz: { answers: [0] } }, LIM), err('progress.quiz.answers'))
  assert.deepEqual(parseProgressPatch({ quiz: { answers: [1, null] } }, { ...LIM, quizCount: 5 }), { quiz: { answers: [1, null] } })
})

test('mergeProgress pieces.seen: 합집합(되돌리지 않음), 다른 칸 보존, 저장값이 어긋나도 던지지 않음', () => {
  const cur: LessonProgress = { pieces: { seen: [1] }, listen: { segmentsDone: [1] }, speaking: [] }
  const next = mergeProgress(cur, { pieces: { seen: [0, 1] } })
  assert.deepEqual(next.pieces, { seen: [0, 1] })
  assert.deepEqual(next.listen, { segmentsDone: [1] })
  assert.deepEqual(mergeProgress(next, { pieces: { seen: [] } }).pieces, { seen: [0, 1] }, '빈 배열은 지우지 않음')
  assert.deepEqual(mergeProgress({}, { pieces: { seen: [2] } }).pieces, { seen: [2] })
  assert.deepEqual(mergeProgress({ pieces: 'x' } as unknown as LessonProgress, { pieces: { seen: [2] } }).pieces, { seen: [2] })
  assert.deepEqual(mergeProgress({ pieces: { seen: [0, 'a', 1.5] } } as unknown as LessonProgress, { pieces: { seen: [2] } }).pieces, { seen: [0, 2] })
  assert.equal(mergeProgress(cur, { application: { answers: ['x'] } }).pieces, cur.pieces, 'pieces 를 보내지 않으면 그대로')
})
