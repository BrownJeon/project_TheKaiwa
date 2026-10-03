import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EvalItemKind } from '@prisma/client'
import { ApiError } from '@/modules/infra'
import { buildItemRows, type EvalGenOutputLike } from '../evaluation/generate'
import { gradingMaterials, mergeGrades, type FinalizedEvalGrade } from '../evaluation/grade'
import { EVAL_MATERIAL_MIN, pickEvalMaterials, type EvalMaterialWord } from '../evaluation/materials'
import { answerConflict, toEvaluationDto, type EvaluationItemRow, type EvaluationRow } from '../evaluation/rows'
import {
  assembleOrder,
  computeTotal,
  displayAnswer,
  gradeObjective,
  gradeOf,
  levelUpBasis,
  normalizeAnswer,
  normalizeReading,
  objectiveSummary,
  shuffleForStorage,
  type DoneEvaluationBrief,
} from '../evaluation/scoring'
import { parseAnswerBody, parseCreateEvaluationBody, parseEvaluationListQuery } from '../evaluation/validate'
import { createRng } from '../vocab/setGenerator'

const code = (c: string, reason?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (reason === undefined || (e.details as { reason?: string } | undefined)?.reason === reason)

// ── 본문 검증 ──────────────────────────────────────────────────────────────

test('#65 본문: kind 필수·level·topicId 형식·모르는 키 400', () => {
  assert.deepEqual(parseCreateEvaluationBody({ kind: 'WORDS' }), { kind: 'WORDS', topicId: null, level: null })
  assert.deepEqual(parseCreateEvaluationBody({ kind: 'TALK', topicId: 'tp_1', level: 'N3' }), { kind: 'TALK', topicId: 'tp_1', level: 'N3' })
  assert.throws(() => parseCreateEvaluationBody({}), code('VALIDATION', 'enum'))
  assert.throws(() => parseCreateEvaluationBody({ kind: 'LESSON' }), code('VALIDATION', 'enum'))
  assert.throws(() => parseCreateEvaluationBody({ kind: 'WORDS', level: 'N6' }), code('VALIDATION', 'enum'))
  assert.throws(() => parseCreateEvaluationBody({ kind: 'WORDS', topicId: '../x' }), code('VALIDATION'))
  assert.throws(() => parseCreateEvaluationBody({ kind: 'WORDS', total: 100 }), code('VALIDATION', 'unknown_key'))
})

test('#67 본문: 입력 방식 기본값·음성인데 발화 없음 400·키보드인데 발화 400·조각 번호·길이', () => {
  assert.deepEqual(parseAnswerBody({ answerText: ' 역 ' }), { answerText: '역', inputSource: 'TEXT', utteranceId: null, pieceOrder: null, spotIndex: null })
  assert.equal(parseAnswerBody({ utteranceId: 'ut_1' }).inputSource, 'REALTIME_STT')
  assert.equal(parseAnswerBody({ answerText: '  ' }).answerText, null)
  assert.throws(() => parseAnswerBody({ inputSource: 'REALTIME_STT', answerText: 'x' }), code('VALIDATION', 'required'))
  assert.throws(() => parseAnswerBody({ inputSource: 'TEXT', utteranceId: 'ut_1' }), code('VALIDATION', 'mismatch'))
  assert.throws(() => parseAnswerBody({ inputSource: 'VOICE' }), code('VALIDATION', 'enum'))
  assert.throws(() => parseAnswerBody({ pieceOrder: [0, 9] }), code('VALIDATION'))
  assert.throws(() => parseAnswerBody({ pieceOrder: '0,1' }), code('VALIDATION'))
  assert.throws(() => parseAnswerBody({ answerText: 'あ'.repeat(2001) }), code('VALIDATION'))
  assert.throws(() => parseAnswerBody({ score: 10 }), code('VALIDATION', 'unknown_key'))
  assert.deepEqual(parseAnswerBody({ pieceOrder: [2, 0, 1] }).pieceOrder, [2, 0, 1])
})

test('#69 쿼리: limit 1~50·kind·커서 형식', () => {
  assert.deepEqual(parseEvaluationListQuery(new URLSearchParams('')), { limit: 20, cursor: null, kind: null })
  assert.equal(parseEvaluationListQuery(new URLSearchParams('kind=TALK&limit=50')).kind, 'TALK')
  assert.throws(() => parseEvaluationListQuery(new URLSearchParams('limit=51')), code('VALIDATION'))
  assert.throws(() => parseEvaluationListQuery(new URLSearchParams('kind=X')), code('VALIDATION', 'enum'))
  assert.throws(() => parseEvaluationListQuery(new URLSearchParams('cursor=zzz')), code('VALIDATION'))
})

// ── 채점 ───────────────────────────────────────────────────────────────────

const MC = { kind: 'MEANING_CHOICE' as EvalItemKind, prompt: { surface: '駅', reading: 'えき', choices: ['역', '학교', '병원', '공원'] }, expected: { answer: 0 } }
const RI = { kind: 'READING_INPUT' as EvalItemKind, prompt: { surface: '会計' }, expected: { reading: 'かいけい', accepted: ['かいけい'] } }
const CC = { kind: 'CHUNK_CLASSIFY' as EvalItemKind, prompt: { textJa: '冷たい', reading: 'つめたい' }, expected: { chunkType: 'MODIFIER' }, chunkType: 'MODIFIER' }
const AS = { kind: 'ASSEMBLE' as EvalItemKind, prompt: { promptKo: '조립', pieces: ['を', 'コーヒー', 'ください', 'を'] }, expected: { order: ['コーヒー', 'を', 'ください', 'を'] } }
const SR = { kind: 'SITUATION_RESPOND' as EvalItemKind, prompt: { situationKo: '카페에서 주문' }, expected: { expectedGistKo: '주문', modelAnswerJa: 'コーヒーをください', modelReading: 'こーひーをください' } }

test('답 정리: 보기 밖 400·조각 분류 소문자 허용·조립은 순열만·조립 아닌 문항의 pieceOrder 400·서술형 빈 답 400', () => {
  assert.equal(normalizeAnswer(MC, { answerText: '역', pieceOrder: null }), '역')
  assert.throws(() => normalizeAnswer(MC, { answerText: '기차', pieceOrder: null }), code('VALIDATION', 'not_a_choice'))
  assert.throws(() => normalizeAnswer(MC, { answerText: null, pieceOrder: null }), code('VALIDATION', 'required'))
  assert.throws(() => normalizeAnswer(MC, { answerText: '역', pieceOrder: [0] }), code('VALIDATION', 'not_assemble'))
  assert.equal(normalizeAnswer(CC, { answerText: 'modifier', pieceOrder: null }), 'MODIFIER')
  assert.throws(() => normalizeAnswer(CC, { answerText: 'VERB', pieceOrder: null }), code('VALIDATION', 'not_a_chunk_type'))
  assert.equal(normalizeAnswer(AS, { answerText: null, pieceOrder: [1, 0, 2, 3] }), '[1,0,2,3]')
  assert.throws(() => normalizeAnswer(AS, { answerText: null, pieceOrder: [1, 1, 2, 3] }), code('VALIDATION', 'not_a_permutation'))
  assert.throws(() => normalizeAnswer(AS, { answerText: null, pieceOrder: [1, 0, 2] }), code('VALIDATION', 'not_a_permutation'))
  assert.throws(() => normalizeAnswer(AS, { answerText: 'コーヒーをください', pieceOrder: null }), code('VALIDATION', 'required'))
  assert.throws(() => normalizeAnswer(SR, { answerText: null, pieceOrder: null }), code('VALIDATION', 'required'))
  assert.equal(normalizeAnswer(SR, { answerText: 'コーヒーください', pieceOrder: null }), 'コーヒーください')
})

test('객관식 채점: 보기·읽기(가타카나·공백·accepted)·조각 분류·조립(같은 조각 두 개)·미답 0·서술형 null', () => {
  assert.equal(gradeObjective(MC, '역'), 10)
  assert.equal(gradeObjective(MC, '학교'), 0)
  assert.equal(gradeObjective(MC, null), 0)
  assert.equal(gradeObjective(RI, 'カイケイ'), 10)
  assert.equal(gradeObjective(RI, ' かい けい。'), 10)
  assert.equal(gradeObjective(RI, 'かいけ'), 0)
  assert.equal(gradeObjective({ ...RI, expected: { reading: 'にほん', accepted: ['にほん', 'にっぽん'] } }, 'ニッポン'), 10)
  assert.equal(gradeObjective(CC, 'MODIFIER'), 10)
  assert.equal(gradeObjective(CC, 'NAME'), 0)
  // pieces = [を, コーヒー, ください, を] — 정답 [コーヒー, を, ください, を] 는 번호 1·0·2·3 또는 1·3·2·0 둘 다 맞다(같은 조각).
  assert.equal(gradeObjective(AS, '[1,0,2,3]'), 10)
  assert.equal(gradeObjective(AS, '[1,3,2,0]'), 10)
  assert.equal(gradeObjective(AS, '[0,1,2,3]'), 0)
  assert.equal(gradeObjective(AS, 'garbage'), 0)
  assert.equal(gradeObjective(SR, 'x'), null)
  assert.equal(normalizeReading('ｶｲｹｲ'), 'かいけい')
  assert.deepEqual(assembleOrder('[2,0,1]'), [2, 0, 1])
  assert.equal(displayAnswer(AS, '[1,0,2,3]'), 'コーヒーをくださいを')
})

test('총점 = round(Σscore/Σmax×100)·미채점 0·등급 경계', () => {
  const ten = (n: number) => Array.from({ length: 10 }, (_, i) => ({ score: i < n ? 10 : 0, maxScore: 10 }))
  assert.equal(computeTotal(ten(7)), 70)
  assert.equal(computeTotal([{ score: 7, maxScore: 10 }, { score: null, maxScore: 10 }, { score: 10, maxScore: 10 }]), 57)
  assert.equal(computeTotal([]), 0)
  assert.equal(computeTotal([{ score: 99, maxScore: 10 }]), 100)
  assert.equal(gradeOf(90), 'EXCELLENT')
  assert.equal(gradeOf(89), 'GOOD')
  assert.equal(gradeOf(75), 'GOOD')
  assert.equal(gradeOf(74), 'FAIR')
  assert.equal(gradeOf(60), 'FAIR')
  assert.equal(gradeOf(59), 'NEEDS_WORK')
  assert.deepEqual(
    objectiveSummary([
      { kind: 'MEANING_CHOICE', score: 10, maxScore: 10 },
      { kind: 'MEANING_CHOICE', score: 0, maxScore: 10 },
      { kind: 'LISTEN_RESPOND', score: 8, maxScore: 10 },
      { kind: 'ASSEMBLE', score: null, maxScore: 10 },
    ]),
    [
      { kind: 'MEANING_CHOICE', correct: 1, total: 2 },
      { kind: 'ASSEMBLE', correct: 0, total: 1 },
    ],
  )
})

test('보기·조각 섞기: 정답 글자 유지·결정적·14일 해시 재료(표기·문장·정렬 order) 불변·조립은 정답 순서로 두지 않음', () => {
  for (let i = 0; i < 30; i++) {
    const a = shuffleForStorage('MEANING_CHOICE', MC.prompt, MC.expected, `ev|${i}`)
    const choices = a.prompt.choices as string[]
    assert.equal(choices[a.expected.answer as number], '역')
    assert.deepEqual([...choices].sort(), [...MC.prompt.choices].sort())
    assert.equal(a.prompt.surface, '駅')
    const b = shuffleForStorage('ASSEMBLE', { promptKo: 'x', pieces: ['コーヒー', 'を', 'ください'] }, { order: ['コーヒー', 'を', 'ください'] }, `ev|${i}`)
    assert.notDeepEqual(b.prompt.pieces, ['コーヒー', 'を', 'ください'])
    assert.deepEqual([...(b.prompt.pieces as string[])].sort(), ['を', 'ください', 'コーヒー'].sort())
    assert.deepEqual(b.expected.order, ['コーヒー', 'を', 'ください'])
  }
  assert.deepEqual(shuffleForStorage('MEANING_CHOICE', MC.prompt, MC.expected, 'same'), shuffleForStorage('MEANING_CHOICE', MC.prompt, MC.expected, 'same'))
  const sr = shuffleForStorage('SITUATION_RESPOND', SR.prompt, SR.expected, 's')
  assert.deepEqual(sr, { prompt: SR.prompt, expected: SR.expected })
})

// ── 레벨 제안 조건 ──────────────────────────────────────────────────────────

const done = (id: string, level: 'N4' | 'N3' | 'N1', totalScore: number, day: number): DoneEvaluationBrief => ({ id, kind: 'WORDS', level, totalScore, completedAt: new Date(Date.UTC(2026, 8, day)) })

test('SET_LEVEL 후보: 가장 최근 두 건 같은 레벨·둘 다 ≥90·지금 레벨·위 단계 있을 때만, 근거는 오래된 것 → 최근', () => {
  const r = levelUpBasis([done('b', 'N4', 90, 28), done('a', 'N4', 92, 26)], 'N4')
  assert.deepEqual(r && { from: r.fromLevel, to: r.toLevel, basis: r.basis.map((x) => x.id) }, { from: 'N4', to: 'N3', basis: ['a', 'b'] })
  assert.equal(levelUpBasis([done('b', 'N4', 89, 28), done('a', 'N4', 95, 26)], 'N4'), null)
  assert.equal(levelUpBasis([done('b', 'N4', 95, 28), done('a', 'N3', 95, 26)], 'N4'), null)
  assert.equal(levelUpBasis([done('b', 'N4', 95, 28), done('a', 'N4', 95, 26)], 'N3'), null)
  assert.equal(levelUpBasis([done('b', 'N1', 100, 28), done('a', 'N1', 100, 26)], 'N1'), null)
  assert.equal(levelUpBasis([done('b', 'N4', 100, 28)], 'N4'), null)
})

// ── 재료 선택 ───────────────────────────────────────────────────────────────

const word = (i: number, wrongCount = 0): EvalMaterialWord => ({ id: `w${String(i).padStart(2, '0')}`, surface: `語${i}`, reading: null, meaning: `뜻${i}`, correctCount: 0, wrongCount, lastSeenAt: null })

test('재료: ≤15·오답 많은 순·최근 14일에 나온 표기는 덜 뽑힘·최소 개수(WORDS 6·TALK 4)', () => {
  const now = new Date('2026-09-28T00:00:00Z')
  const pool = Array.from({ length: 30 }, (_, i) => word(i, i === 7 ? 5 : i === 3 ? 2 : 0))
  const picked = pickEvalMaterials(pool, new Set(), createRng('s1'), now)
  assert.equal(picked.length, 15)
  assert.ok(picked.every((w, i) => i === 0 || picked[i - 1].wrongCount >= w.wrongCount))
  assert.equal(pickEvalMaterials(pool.slice(0, 4), new Set(), createRng('s1'), now).length, 4)
  let excluded = 0
  for (let s = 0; s < 40; s++) {
    const p = pickEvalMaterials(Array.from({ length: 16 }, (_, i) => word(i)), new Set(['語5']), createRng(`seed${s}`), now)
    if (!p.some((w) => w.surface === '語5')) excluded++
  }
  // 가중치가 같다면 16개 중 하나가 빠질 확률은 1/16(40번 중 2~3번) — ×0.1 가중이면 대부분 빠진다.
  assert.ok(excluded >= 20, `최근 표기가 빠진 횟수 ${excluded}/40`)
  assert.deepEqual(EVAL_MATERIAL_MIN, { WORDS: 6, TALK: 4 })
})

// ── 출제 저장 행 ────────────────────────────────────────────────────────────

test('A6 → 문항 행: 종류 표시 순서·재료 표기 일치만 wordId·wordSurfaceSnap 원본·chunkType 은 분류 문항만·보기 섞어도 정답 유지', () => {
  const out: EvalGenOutputLike = {
    items: [
      { kind: 'CHUNK_CLASSIFY', dims: ['vocabulary'], wordSurface: '冷たい', chunkType: 'MODIFIER', prompt: CC.prompt, expected: CC.expected },
      { kind: 'MEANING_CHOICE', dims: ['vocabulary'], wordSurface: '駅', chunkType: null, prompt: MC.prompt, expected: MC.expected },
      { kind: 'READING_INPUT', dims: ['accuracy'], wordSurface: '強い', chunkType: null, prompt: { surface: '強い' }, expected: { reading: 'つよい', accepted: ['つよい'] } },
      { kind: 'MEANING_CHOICE', dims: ['vocabulary'], wordSurface: null, chunkType: 'NAME', prompt: { surface: '本', reading: 'ほん', choices: ['책', '펜', '물', '밥'] }, expected: { answer: 0 } },
    ],
  }
  const mats = [
    { ...word(1), id: 'wA', surface: '駅' },
    { ...word(2), id: 'wB', surface: '冷たい' },
  ]
  const rows = buildItemRows('ev1', 'WORDS', out, mats)
  assert.deepEqual(rows.map((r) => r.kind), ['MEANING_CHOICE', 'MEANING_CHOICE', 'READING_INPUT', 'CHUNK_CLASSIFY'])
  assert.deepEqual(rows.map((r) => r.order), [0, 1, 2, 3])
  assert.deepEqual(rows.map((r) => r.wordId), ['wA', null, null, 'wB'])
  assert.deepEqual(rows.map((r) => r.wordSurfaceSnap), ['駅', null, '強い', '冷たい'])
  assert.deepEqual(rows.map((r) => r.chunkType), [null, null, null, 'MODIFIER'])
  const p0 = rows[0].prompt as { choices: string[] }
  assert.equal(p0.choices[(rows[0].expected as { answer: number }).answer], '역')
})

// ── 채점 마무리 ─────────────────────────────────────────────────────────────

const item = (over: Partial<EvaluationItemRow> & Pick<EvaluationItemRow, 'id' | 'order' | 'kind'>): EvaluationItemRow => ({
  prompt: {},
  expected: {},
  wordId: null,
  wordSurfaceSnap: null,
  chunkType: null,
  answerText: null,
  inputSource: null,
  score: null,
  maxScore: 10,
  feedback: null,
  dims: ['accuracy'],
  answeredAt: null,
  textRevealedAt: null,
  ...over,
})

test('채점 마무리: 서술형 A7 점수·미답 서술형은 A7 과 무관하게 0·객관식은 코드 재채점·총점', () => {
  const items = [
    item({ id: 'i0', order: 0, kind: 'LISTEN_RESPOND', prompt: { textJa: '何を飲みますか', instructionKo: '답해 보세요' }, expected: {}, answerText: 'コーヒーです', inputSource: 'REALTIME_STT' }),
    item({ id: 'i1', order: 1, kind: 'ASSEMBLE', prompt: AS.prompt, expected: AS.expected, answerText: '[1,0,2,3]', score: 10 }),
    item({ id: 'i2', order: 2, kind: 'SITUATION_RESPOND', prompt: SR.prompt, expected: SR.expected, answerText: null }),
    item({ id: 'i3', order: 3, kind: 'CORRECTION_SPOT', prompt: { sentenceJa: 'x' }, expected: {}, answerText: 'y' }),
  ]
  const m = gradingMaterials({ kind: 'TALK', level: 'N4' }, items)
  assert.deepEqual(m.objectiveSummary, [{ kind: 'ASSEMBLE', correct: 1, total: 1 }])
  assert.deepEqual(m.subjectiveItems.map((s) => [s.order, s.answerText]), [[0, 'コーヒーです'], [2, ''], [3, 'y']])
  const fin: FinalizedEvalGrade = {
    items: [
      { order: 0, score: 8, feedback: '좋아요' },
      { order: 2, score: 7, feedback: '미답인데 점수를 줌' },
      { order: 3, score: 12, feedback: '' },
    ],
    rubric: { accuracy: 4, vocabulary: 4, grammar: 3, naturalness: 4, assembly: 5 },
    comment: 'ok',
    nextFocus: [],
  }
  const { scores, total } = mergeGrades(items, fin)
  assert.equal(scores.get('i0')?.score, 8)
  assert.equal(scores.get('i1')?.score, 10)
  assert.equal(scores.get('i2')?.score, 0)
  assert.equal(scores.get('i3')?.score, 10)
  assert.equal(scores.get('i3')?.feedback, null)
  assert.equal(total, 70)
})

// ── 정답 숨김 DTO ──────────────────────────────────────────────────────────

const evRow = (over: Partial<EvaluationRow> = {}): EvaluationRow => ({
  id: 'ev1',
  userId: 'u1',
  kind: 'TALK',
  topicId: null,
  level: 'N4',
  status: 'IN_PROGRESS',
  totalScore: null,
  rubric: null,
  comment: null,
  nextFocus: null,
  studyLogId: null,
  error: null,
  startedAt: new Date('2026-09-28T10:00:00Z'),
  submittedAt: null,
  completedAt: null,
  topic: null,
  ...over,
})

test('상세 DTO: 제출 전엔 정답·점수·피드백·차원·들을 문장 숨김, DONE 이면 공개·READY 는 시작 시각 없음·10분 초과 표시', () => {
  const items = [
    item({ id: 'i0', order: 0, kind: 'LISTEN_RESPOND', prompt: { textJa: '何を飲みますか', instructionKo: '답해 보세요' }, expected: { modelAnswerJa: 'コーヒー' }, answerText: 'コーヒー', score: 8, feedback: 'f' }),
    item({ id: 'i1', order: 1, kind: 'ASSEMBLE', prompt: AS.prompt, expected: AS.expected, answerText: '[1,0,2,3]', score: 10 }),
  ]
  const live = toEvaluationDto(evRow(), items, { now: Date.parse('2026-09-28T10:05:00Z') })
  const json = JSON.stringify(live)
  assert.ok(!json.includes('何を飲みますか') && !json.includes('modelAnswerJa'))
  assert.deepEqual(live.items[0].prompt, { instructionKo: '답해 보세요', textHidden: true })
  assert.ok(live.items.every((i) => i.expected === null && i.score === null && i.feedback === null && i.dims === null && i.correct === null))
  assert.equal(live.items[1].answerText, 'コーヒーをくださいを')
  assert.deepEqual(live.items[1].answerOrder, [1, 0, 2, 3])
  assert.equal(live.deadlineAt, '2026-09-28T10:10:00.000Z')
  assert.equal(live.overtime, false)
  assert.equal(live.answeredCount, 2)
  assert.equal(toEvaluationDto(evRow(), items, { now: Date.parse('2026-09-28T10:11:00Z') }).overtime, true)
  assert.equal(toEvaluationDto(evRow({ status: 'READY' }), items).startedAt, null)
  assert.equal(toEvaluationDto(evRow({ status: 'GRADING', submittedAt: new Date('2026-09-28T10:04:00Z') }), items).items[0].expected, null)

  const fin = toEvaluationDto(evRow({ status: 'DONE', totalScore: 90, rubric: { accuracy: 9, vocabulary: 4 }, nextFocus: ['に/で'], submittedAt: new Date('2026-09-28T10:12:00Z'), completedAt: new Date('2026-09-28T10:13:00Z') }), items)
  assert.equal(fin.items[0].prompt.textJa, '何を飲みますか')
  assert.equal(fin.items[0].score, 8)
  assert.equal(fin.items[1].correct, true)
  assert.equal(fin.result?.grade, 'EXCELLENT')
  assert.deepEqual(fin.result?.rubric, { accuracy: 5, vocabulary: 4, grammar: 0, naturalness: 0, assembly: 0 })
  assert.equal(fin.result?.overtime, true)
  assert.equal(fin.result?.durationSec, 720)
})

test('답 저장 가능 상태: READY·IN_PROGRESS 만, 그 밖 409 이유', () => {
  assert.equal(answerConflict('READY'), null)
  assert.equal(answerConflict('IN_PROGRESS'), null)
  assert.equal((answerConflict('DONE')?.details as { reason: string }).reason, 'ALREADY_DONE')
  assert.equal((answerConflict('GRADING')?.details as { reason: string }).reason, 'SUBMITTED')
  assert.equal((answerConflict('GENERATING')?.details as { reason: string }).reason, 'NOT_READY')
  assert.equal((answerConflict('FAILED')?.details as { reason: string }).reason, 'NOT_READY')
})
