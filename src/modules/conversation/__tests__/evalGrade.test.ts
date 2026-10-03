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
  judgeSpotPick,
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
  assert.equal(EVAL_GRADE_PROMPT_VERSION, 'evalGrade@v3')
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

// ── evalGrade@v3: CORRECTION_SPOT 고른 조각 답(`고른 곳 「…」 / 고친 말·이유: …`) ─────────────────────

const spotWithSegments: EvalGradeSubjectiveItem = {
  order: 2, kind: 'CORRECTION_SPOT',
  prompt: { sentenceJa: 'コーヒーを飲むたいです。', segments: ['コーヒーを', '飲む', 'たいです。'] },
  expected: { wrongSpan: '飲むたい', correctedJa: 'コーヒーを飲みたいです。', explanationKo: 'たい는 ます형에 붙습니다' },
  answerText: '고른 곳 「飲む」 / 고친 말·이유: 飲み',
}

function buildSpotRequest(item: EvalGradeSubjectiveItem) {
  return buildEvalGradeRequest({ evalKind: 'TALK', level: 'N4' as EvalGradeInput['level'], objectiveSummary: [], subjectiveItems: [item] })
}

test('evalGrade@v3: 문항 줄에 정답 조각(wrongSpan 과 겹치는 조각)을 코드가 미리 계산해 싣는다', () => {
  const content = buildSpotRequest(spotWithSegments).messages[0].content as string
  assert.ok(content.includes('정답 조각 「飲む」「たいです。」'), content)
  assert.ok(content.includes('학습자 답: 고른 곳 「飲む」 / 고친 말·이유: 飲み'))
})

test('evalGrade@v3: segments 가 없는 옛 문항은 정답 조각 없이 기존 줄 그대로(자유 입력 폴백)', () => {
  const old: EvalGradeSubjectiveItem = { ...spotWithSegments, prompt: { sentenceJa: 'コーヒーを飲むたいです。' }, answerText: '「飲むたい」がおかしいです。「飲みたい」が正しいです。' }
  const content = buildSpotRequest(old).messages[0].content as string
  assert.ok(!content.includes('정답 조각'))
  assert.ok(content.includes('틀린 곳("飲むたい")'))
})

test('evalGrade@v3: segments 이음이 sentenceJa 와 다르면 정답 조각을 싣지 않는다(잘못된 힌트 방지)', () => {
  const broken: EvalGradeSubjectiveItem = { ...spotWithSegments, prompt: { sentenceJa: 'コーヒーを飲むたいです。', segments: ['コーヒーを', '飲み', 'たいです。'] } }
  assert.ok(!(buildSpotRequest(broken).messages[0].content as string).includes('정답 조각'))
})

test('evalGrade@v3: 지시문에 고른 곳 답 형식·겹침 채점·한국어 이유 예외가 있다', () => {
  const sys = buildSpotRequest(spotWithSegments).system
  assert.ok(sys.includes('고른 곳 「…」 / 고친 말·이유: …'))
  assert.ok(sys.includes('정답 조각'))
  assert.ok(sys.includes('겹치'))
  assert.ok(sys.includes('예외'), '한국어 이유는 「일본어가 아니면 0~2」 규칙 예외')
  assert.ok(!/model_id|speaker_id|claude|qwen/i.test(sys), '엔진 식별 정보 없음')
})

test('evalGrade@v3: judgeSpotPick — 정답 조각이 둘이면 앞·뒤 어느 쪽을 골라도 MATCH, 그 밖의 조각은 MISS', () => {
  const pick = (seg: string) => judgeSpotPick({ ...spotWithSegments, answerText: `고른 곳 「${seg}」 / 고친 말·이유: 飲みたいです` })
  assert.equal(pick('飲む'), 'MATCH')
  assert.equal(pick('たいです。'), 'MATCH', '실측 g26 — 뒤 조각을 골라도 정답(LLM 이 5점으로 깎았던 사례)')
  assert.equal(pick('コーヒーを'), 'MISS')
})

test('evalGrade@v3: judgeSpotPick — 판정 불가(null): 조각 없는 옛 문항·자유 글 답·문항에 없는 조각·다른 종류', () => {
  assert.equal(judgeSpotPick({ ...spotWithSegments, prompt: { sentenceJa: 'コーヒーを飲むたいです。' } }), null)
  assert.equal(judgeSpotPick({ ...spotWithSegments, answerText: '「飲むたい」がおかしいです' }), null)
  assert.equal(judgeSpotPick({ ...spotWithSegments, answerText: '고른 곳 「紅茶を」 / 고친 말·이유: 飲みたい' }), null, '조각 목록에 없는 글자는 판정하지 않는다')
  assert.equal(judgeSpotPick({ ...spotWithSegments, kind: 'SITUATION_RESPOND' }), null)
  const broken: EvalGradeSubjectiveItem = { ...spotWithSegments, prompt: { sentenceJa: 'コーヒーを飲むたいです。', segments: ['コーヒーを', '飲み', 'たいです。'] } }
  assert.equal(judgeSpotPick(broken), null, '이음이 어긋난 조각은 판정하지 않는다')
})

test('evalGrade@v3: 사용자 프롬프트에 고른 곳 판정(코드 확인) 줄 — MATCH·MISS 만, 판정 불가는 줄 없음', () => {
  const match = buildSpotRequest({ ...spotWithSegments, answerText: '고른 곳 「たいです。」 / 고친 말·이유: 飲みたいです' }).messages[0].content as string
  assert.ok(match.includes('고른 곳 판정(코드 확인): 정답 조각입니다'), match)
  const miss = buildSpotRequest({ ...spotWithSegments, answerText: '고른 곳 「コーヒーを」 / 고친 말·이유: 紅茶を' }).messages[0].content as string
  assert.ok(miss.includes('고른 곳 판정(코드 확인): 정답 조각이 아닙니다'), miss)
  const free = buildSpotRequest({ ...spotWithSegments, answerText: '飲むたいがおかしい' }).messages[0].content as string
  assert.ok(!free.includes('고른 곳 판정'))
  assert.ok(buildSpotRequest(spotWithSegments).system.includes('고른 곳 판정(코드 확인)'), '지시문이 판정 줄을 따르라고 안내')
  assert.ok(buildSpotRequest(spotWithSegments).system.includes('어느 하나만 골라도'))
})

test('evalGrade@v3: 예산 — 조각 12개·긴 조각 40자 + 고른 곳 답 최대 길이 최악 조합도 ≤ EVAL_GRADE_USER_PROMPT_CAP', () => {
  const longSeg = 'あ'.repeat(10)
  const segments = Array.from({ length: 12 }, () => longSeg)
  const sentence = segments.join('')
  const worst: EvalGradeSubjectiveItem[] = Array.from({ length: 5 }, (_, i) => ({
    order: i, kind: 'CORRECTION_SPOT' as const,
    prompt: { sentenceJa: sentence, segments },
    expected: { wrongSpan: 'あ'.repeat(15), correctedJa: 'あ'.repeat(120), explanationKo: 'あ'.repeat(160) },
    answerText: `고른 곳 「${longSeg}」 / 고친 말·이유: ${'あ'.repeat(2_000)}`,
  }))
  const req = buildEvalGradeRequest({ evalKind: 'TALK', level: 'N1' as EvalGradeInput['level'], objectiveSummary: [{ kind: 'ASSEMBLE', correct: 1, total: 1 }], subjectiveItems: worst })
  const len = renderTranscript(req.system, req.messages).length
  assert.ok(len <= EVAL_GRADE_USER_PROMPT_CAP, `${len}자 > ${EVAL_GRADE_USER_PROMPT_CAP}`)
})
