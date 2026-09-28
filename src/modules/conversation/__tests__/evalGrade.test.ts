import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderTranscript } from '../../engine/llm'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkEvalGradeResponse, clampRubric, finalizeEvalGradeItems } from '../structuredResponse/evalChecks'
import { buildEvalGradeSchema, EVAL_DIMS, type EvalGradeResponse, type EvalRubric } from '../structuredResponse/evalSchemas'
import {
  buildEvalGradeRequest,
  EVAL_GRADE_ANSWER_RENDER_MAX,
  EVAL_GRADE_PROMPT_VERSION,
  EVAL_GRADE_USER_PROMPT_CAP,
  EvalGradeInputError,
  type EvalGradeInput,
  type EvalGradeSubjectiveItem,
} from '../prompts/evalGrade'

function fullRubric(v: number): EvalRubric {
  return Object.fromEntries(EVAL_DIMS.map((d) => [d, v])) as EvalRubric
}

const talkSubjectiveItems: EvalGradeSubjectiveItem[] = [
  {
    order: 1, kind: 'LISTEN_RESPOND',
    prompt: { textJa: 'すみません、今何時ですか。', instructionKo: '들은 질문에 답해 보세요' },
    expected: { expectedGistKo: '지금 몇 시인지 답한다', modelAnswerJa: '今、三時です。', modelReading: 'いま、さんじです。' },
    answerText: '今、三時です。',
  },
  {
    order: 3, kind: 'SITUATION_RESPOND',
    prompt: { situationKo: '봉투가 필요 없다고 답해 보세요.' },
    expected: { expectedGistKo: '봉투가 필요 없다고 답한다', modelAnswerJa: 'いいえ、大丈夫です。', modelReading: 'いいえ、だいじょうぶです。' },
    answerText: '',
  },
  {
    order: 5, kind: 'CORRECTION_SPOT',
    prompt: { sentenceJa: 'コーヒーを飲むたいです。' },
    expected: { wrongSpan: '飲むたい', correctedJa: 'コーヒーを飲みたいです。', explanationKo: 'たい는 ます형에 붙습니다' },
    answerText: '「飲むたい」がおかしいです。「飲みたい」が正しいです。',
  },
]

test('버전·상수', () => {
  assert.equal(EVAL_GRADE_PROMPT_VERSION, 'evalGrade@v2')
  assert.equal(EVAL_GRADE_ANSWER_RENDER_MAX, 600)
})

test('buildEvalGradeRequest: 둘 다 비어 있으면 EvalGradeInputError', () => {
  assert.throws(() => buildEvalGradeRequest({ evalKind: 'WORDS', level: 'N4' as EvalGradeInput['level'], objectiveSummary: [], subjectiveItems: [] }), EvalGradeInputError)
})

test('buildEvalGradeRequest(TALK): task·jsonSchema·데이터 블록·지시문의 order 목록', () => {
  const req = buildEvalGradeRequest({
    evalKind: 'TALK', level: 'N4' as EvalGradeInput['level'],
    objectiveSummary: [{ kind: 'ASSEMBLE', correct: 1, total: 1 }],
    subjectiveItems: talkSubjectiveItems,
  })
  assert.equal(req.task, 'evalGrade')
  assert.equal(req.messages.length, 1)
  assert.ok((req.messages[0].content as string).includes('[객관식 요약]'))
  assert.ok((req.messages[0].content as string).includes('[서술형 문항]'))
  assert.ok((req.messages[0].content as string).includes('order=1'))
  assert.ok(req.system.includes('1, 3, 5'))
  assert.deepEqual(req.jsonSchema, buildEvalGradeSchema(5, 3))
})

test('buildEvalGradeRequest(WORDS, 서술형 0개): "빈 배열" 지시 + jsonSchema maxOrder=0', () => {
  const req = buildEvalGradeRequest({
    evalKind: 'WORDS', level: 'N3' as EvalGradeInput['level'],
    objectiveSummary: [{ kind: 'MEANING_CHOICE', correct: 3, total: 4 }, { kind: 'READING_INPUT', correct: 2, total: 2 }],
    subjectiveItems: [],
  })
  assert.ok(req.system.includes('빈 배열'))
  assert.deepEqual(req.jsonSchema, buildEvalGradeSchema(0, 1))
})

test('예산: 서술형 5개(TALK 최대) + 답 최대 길이 최악 조합도 ≤ EVAL_GRADE_USER_PROMPT_CAP', () => {
  const longAnswer = 'あ'.repeat(2_000)
  const items: EvalGradeSubjectiveItem[] = [
    { order: 0, kind: 'LISTEN_RESPOND', prompt: { textJa: 'あ'.repeat(80), instructionKo: 'あ'.repeat(120) }, expected: { expectedGistKo: 'あ'.repeat(200), modelAnswerJa: 'あ'.repeat(80), modelReading: 'あ'.repeat(160) }, answerText: longAnswer },
    { order: 1, kind: 'LISTEN_RESPOND', prompt: { textJa: 'あ'.repeat(80), instructionKo: 'あ'.repeat(120) }, expected: { expectedGistKo: 'あ'.repeat(200), modelAnswerJa: 'あ'.repeat(80), modelReading: 'あ'.repeat(160) }, answerText: longAnswer },
    { order: 2, kind: 'SITUATION_RESPOND', prompt: { situationKo: '가'.repeat(200) }, expected: { expectedGistKo: 'あ'.repeat(200), modelAnswerJa: 'あ'.repeat(80), modelReading: 'あ'.repeat(160) }, answerText: longAnswer },
    { order: 3, kind: 'SITUATION_RESPOND', prompt: { situationKo: '가'.repeat(200) }, expected: { expectedGistKo: 'あ'.repeat(200), modelAnswerJa: 'あ'.repeat(80), modelReading: 'あ'.repeat(160) }, answerText: longAnswer },
    { order: 4, kind: 'CORRECTION_SPOT', prompt: { sentenceJa: 'あ'.repeat(120) }, expected: { wrongSpan: 'あ'.repeat(40), correctedJa: 'あ'.repeat(120), explanationKo: 'あ'.repeat(160) }, answerText: longAnswer },
  ]
  const req = buildEvalGradeRequest({
    evalKind: 'TALK', level: 'N1' as EvalGradeInput['level'],
    objectiveSummary: [{ kind: 'ASSEMBLE', correct: 1, total: 1 }],
    subjectiveItems: items,
  })
  const prompt = renderTranscript(req.system, req.messages)
  assert.ok(prompt.length <= EVAL_GRADE_USER_PROMPT_CAP, `최악 조합 ${prompt.length}자 > ${EVAL_GRADE_USER_PROMPT_CAP}`)
})

test('합성 응답 — 스키마·후검증 모두 통과(부분 응답도 스키마 위반 아님)', () => {
  const full: EvalGradeResponse = {
    items: [
      { order: 1, score: 9, feedback_ko: '시간을 정확히 답했습니다.' },
      { order: 3, score: 6, feedback_ko: '의미는 통하지만 조금 더 정중하면 좋아요.' },
      { order: 5, score: 8, feedback_ko: '틀린 곳을 잘 짚고 고쳤습니다.' },
    ],
    rubric: fullRubric(4),
    comment_ko: '전반적으로 잘했습니다. 계속 이런 식으로 연습해 보세요.',
    next_focus: ['정중한 표현'],
  }
  assert.deepEqual(validateOutput(full, buildEvalGradeSchema(5, 3)), { ok: true })
  assert.deepEqual(checkEvalGradeResponse({ allowedOrders: [1, 3, 5] }, full), [])

  const partial: EvalGradeResponse = { items: [{ order: 1, score: 9, feedback_ko: '좋아요.' }], rubric: fullRubric(3), comment_ko: '잘했습니다.', next_focus: [] }
  assert.deepEqual(validateOutput(partial, buildEvalGradeSchema(5, 3)), { ok: true }, '일부만 채점해도 스키마 위반이 아니다(누락은 finalize 가 0점으로 채운다)')
  assert.deepEqual(checkEvalGradeResponse({ allowedOrders: [1, 3, 5] }, partial), [])
})

test('checkEvalGradeResponse: order 가 입력에 없으면 위반', () => {
  const data: EvalGradeResponse = { items: [{ order: 99, score: 5, feedback_ko: 'x' }], rubric: fullRubric(3), comment_ko: 'x', next_focus: [] }
  const v = checkEvalGradeResponse({ allowedOrders: [1, 3, 5] }, data)
  assert.ok(v.some((x) => x.includes('order 99')))
})

test('checkEvalGradeResponse: order 중복이면 위반', () => {
  const data: EvalGradeResponse = { items: [{ order: 1, score: 5, feedback_ko: 'x' }, { order: 1, score: 7, feedback_ko: 'y' }], rubric: fullRubric(3), comment_ko: 'x', next_focus: [] }
  const v = checkEvalGradeResponse({ allowedOrders: [1, 3, 5] }, data)
  assert.ok(v.some((x) => x.includes('중복')))
})

test('checkEvalGradeResponse: 엔진 식별 정보 누출 위반', () => {
  const data: EvalGradeResponse = { items: [{ order: 1, score: 5, feedback_ko: 'Claude 가 채점했습니다' }], rubric: fullRubric(3), comment_ko: 'x', next_focus: [] }
  const v = checkEvalGradeResponse({ allowedOrders: [1, 3, 5] }, data)
  assert.ok(v.some((x) => x.includes('엔진')))
})

test('finalizeEvalGradeItems: 누락 문항 0점으로 채우고 order 오름차순, 있는 항목은 클램프', () => {
  const data: EvalGradeResponse = {
    items: [
      { order: 5, score: 8, feedback_ko: '좋아요.' },
      { order: 1, score: 15, feedback_ko: '  범위 밖 점수  ' }, // 스키마 위반이지만 방어적 클램프 확인용
    ],
    rubric: fullRubric(3), comment_ko: 'x', next_focus: [],
  }
  const out = finalizeEvalGradeItems({ allowedOrders: [1, 3, 5] }, data)
  assert.deepEqual(out.map((o) => o.order), [1, 3, 5])
  assert.equal(out[0].score, 10, '15점은 10으로 클램프')
  assert.equal(out[0].feedback_ko, '범위 밖 점수') // trim
  assert.equal(out[1].order, 3)
  assert.equal(out[1].score, 0, '누락 문항은 0점')
  assert.ok(out[1].feedback_ko.length > 0)
  assert.equal(out[2].score, 8)
})

test('finalizeEvalGradeItems: 음수·소수 점수도 0~10 정수로 클램프', () => {
  const data: EvalGradeResponse = { items: [{ order: 1, score: -3, feedback_ko: 'a' }, { order: 2, score: 7.6, feedback_ko: 'b' }], rubric: fullRubric(3), comment_ko: 'x', next_focus: [] }
  const out = finalizeEvalGradeItems({ allowedOrders: [1, 2] }, data)
  assert.equal(out[0].score, 0)
  assert.equal(out[1].score, 8)
})

test('finalizeEvalGradeItems: feedback_ko 가 빈 문자열/공백뿐이면 기본 문구로', () => {
  const data: EvalGradeResponse = { items: [{ order: 1, score: 5, feedback_ko: '   ' }], rubric: fullRubric(3), comment_ko: 'x', next_focus: [] }
  const out = finalizeEvalGradeItems({ allowedOrders: [1] }, data)
  assert.ok(out[0].feedback_ko.length > 0)
})

test('clampRubric: 범위 밖·소수·누락 차원을 클램프', () => {
  const out = clampRubric({ accuracy: 7, vocabulary: -1, grammar: 3.6 } as Partial<EvalRubric>)
  assert.equal(out.accuracy, 5)
  assert.equal(out.vocabulary, 0)
  assert.equal(out.grammar, 4)
  assert.equal(out.naturalness, 0, '누락 차원은 0')
  assert.equal(out.assembly, 0)
})

test('clampRubric: null/undefined 입력도 전부 0', () => {
  assert.deepEqual(clampRubric(null), fullRubric(0))
  assert.deepEqual(clampRubric(undefined), fullRubric(0))
})
