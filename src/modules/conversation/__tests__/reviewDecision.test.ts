import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkReviewDecisionResponse } from '../structuredResponse/reviewChecks'
import { normalizeReviewDecision, REVIEW_FALLBACK_INTERVAL_DAYS, REVIEW_FALLBACK_REASON_KO, type ReviewDecisionCandidateRef } from '../structuredResponse/reviewRepair'
import { REVIEW_DECISION_SCHEMA, type ReviewDecisionResponse } from '../structuredResponse/reviewSchemas'
import {
  buildReviewDecisionRequest,
  REVIEW_DECISION_CANDIDATES_MAX_CHARS,
  REVIEW_DECISION_HEADER_CAP,
  REVIEW_DECISION_MAX_CANDIDATES,
  REVIEW_DECISION_PROMPT_VERSION,
  ReviewDecisionInputError,
  type ReviewDecisionCandidateInput,
} from '../prompts/reviewDecision'

interface Fixture {
  candidates: ReviewDecisionCandidateInput[]
  observationSummary: { skill: 'VOCAB_RECALL' | 'GRAMMAR_PARTICLE' | 'LISTEN_RESPOND' | 'SENTENCE_PRODUCTION' | 'CONVERSATION_MAINTAIN'; success: number; fail: number }[]
  errorStats: { type: string; count: number }[]
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/review-decision.json'), 'utf8')) as Fixture
const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

// ── buildReviewDecisionRequest 기본 형태 ──────────────────────────────────

test('buildReviewDecisionRequest: task·persona·jsonSchema·메시지 형태, keptItemIds 가 후보 순서 그대로', () => {
  const req = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: fixture.candidates })
  assert.equal(req.task, 'reviewDecision')
  assert.equal(req.persona?.name, 'tutor')
  assert.equal(req.jsonSchema, REVIEW_DECISION_SCHEMA)
  assert.equal(req.messages.length, 1)
  assert.equal(req.messages[0].role, 'user')
  assert.deepEqual(req.keptItemIds, fixture.candidates.map((c) => c.itemId))
  assert.equal(req.skippedCandidates, 0)
  assert.match(req.system, /\[모드\] REVIEW_DECISION/)
  assert.ok(req.messages[0].content.startsWith('[복습 후보]'))
  assert.ok(req.messages[0].content.includes('id=rep-01'))
  assert.equal(REVIEW_DECISION_PROMPT_VERSION, 'reviewDecision@v2')
})

test('후보가 비어 있으면 ReviewDecisionInputError', () => {
  assert.throws(() => buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: [] }), ReviewDecisionInputError)
})

test('관측 요약·오류 통계가 있으면 system 에 [최근 관측]·[반복 오류] 줄이 실리고, 없으면 생략된다', () => {
  const withSummary = buildReviewDecisionRequest({
    todayKst: '2026-09-28', learner, candidates: fixture.candidates, observationSummary: fixture.observationSummary, errorStats: fixture.errorStats,
  })
  assert.match(withSummary.system, /\[최근 관측\] VOCAB_RECALL 성공14·실패4/)
  assert.match(withSummary.system, /\[반복 오류\] PARTICLE\(7\)/)
  const without = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: fixture.candidates })
  assert.ok(!without.system.includes('[최근 관측]'))
  assert.ok(!without.system.includes('[반복 오류]'))
})

test('v2 지시문: 스키마 required 필드 이름이 전부 나오고(최상위·decisions[]·sessionPlan), 비허용 키 금지 문구가 있다', () => {
  const sys = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: fixture.candidates }).system
  const schema = REVIEW_DECISION_SCHEMA as unknown as {
    required: string[]
    properties: { decisions: { items: { required: string[] } }; sessionPlan: { required: string[] } }
  }
  const names = [...schema.required, ...schema.properties.decisions.items.required, ...schema.properties.sessionPlan.required]
  assert.ok(names.length >= 9)
  for (const n of names) assert.ok(sys.includes(n), `지시문에 ${n} 가 없다`)
  assert.match(sys, /이 밖의 키 금지/)
  assert.match(sys, /reason·note/, '비허용 이름 예시(reason)를 명시')
  // 응답 형태 골격의 키 집합이 스키마와 정확히 같다(지시-스키마 드리프트 방어).
  const shape = sys.match(/\{"decisions":.*"rationale_ko":"…"\}/)
  assert.ok(shape, '응답 형태 골격 줄이 있다')
  const skeleton = JSON.parse(shape![0].replace(/…/g, 'x'))
  assert.deepEqual(Object.keys(skeleton).sort(), [...schema.required].sort())
  assert.deepEqual(Object.keys(skeleton.decisions[0]).sort(), [...schema.properties.decisions.items.required].sort())
  assert.deepEqual(Object.keys(skeleton.sessionPlan).sort(), [...schema.properties.sessionPlan.required].sort())
})

test('v2 관측 신뢰도: uncertain>0 이면 불확실N 을 붙이고, 0·미지정이면 생략한다', () => {
  const sys = buildReviewDecisionRequest({
    todayKst: '2026-09-28', learner, candidates: fixture.candidates,
    observationSummary: [
      { skill: 'SENTENCE_PRODUCTION', success: 3, fail: 1, uncertain: 2 },
      { skill: 'VOCAB_RECALL', success: 14, fail: 4, uncertain: 0 },
      { skill: 'GRAMMAR_PARTICLE', success: 5, fail: 2 },
    ],
  }).system
  assert.match(sys, /SENTENCE_PRODUCTION 성공3·실패1·불확실2/)
  assert.match(sys, /VOCAB_RECALL 성공14·실패4(?!·불확실)/)
  assert.match(sys, /GRAMMAR_PARTICLE 성공5·실패2(?!·불확실)/)
  assert.match(sys, /불확실N 은 음성 인식 신뢰도가 낮은 관측이라 판단 근거로 약하게만/)
})

test('헤더 상한(≤600) 준수', () => {
  const heavy = { ...learner, displayName: '브라운'.repeat(30), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
  const req = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner: heavy, candidates: fixture.candidates })
  const headerLine = req.system.split('\n').find((l) => l.startsWith('[학습자]'))!
  assert.ok(headerLine.length <= REVIEW_DECISION_HEADER_CAP)
})

test(`후보 ${REVIEW_DECISION_MAX_CANDIDATES}건 초과는 앞에서부터 채우고 뒤에서 자른다(우선순위 순서 보존)`, () => {
  const many: ReviewDecisionCandidateInput[] = Array.from({ length: REVIEW_DECISION_MAX_CANDIDATES + 10 }, (_, i) => ({
    itemId: `many-${i}`, itemType: 'WORD', textJa: `単語${i}`, meaningKo: `단어${i}`,
    studiedCount: 1, correctCount: 1, wrongCount: 0, feedbackCount: 0, lastStudiedAt: null, intervalDays: 3, priority: 'NORMAL',
  }))
  const req = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: many })
  assert.equal(req.keptItemIds.length, REVIEW_DECISION_MAX_CANDIDATES)
  assert.deepEqual(req.keptItemIds, many.slice(0, REVIEW_DECISION_MAX_CANDIDATES).map((c) => c.itemId))
  assert.equal(req.skippedCandidates, 10)
  assert.ok(req.messages[0].content.includes('id=many-0'))
  assert.ok(!req.messages[0].content.includes(`id=many-${REVIEW_DECISION_MAX_CANDIDATES}`))
})

test(`후보 블록은 ${REVIEW_DECISION_CANDIDATES_MAX_CHARS}자를 넘지 않는다(개수는 적어도 각 줄이 길면 문자 상한으로 잘린다)`, () => {
  const long: ReviewDecisionCandidateInput[] = Array.from({ length: 39 }, (_, i) => ({
    itemId: `long-${'a'.repeat(30)}-${i}`, itemType: 'EXPRESSION', textJa: 'あ'.repeat(120), meaningKo: '가'.repeat(120),
    studiedCount: 9, correctCount: 5, wrongCount: 4, feedbackCount: 3, lastStudiedAt: '2026-09-01', intervalDays: 7, priority: 'FOCUS',
  }))
  const req = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: long })
  assert.ok(req.keptItemIds.length < long.length, '문자 상한 때문에 일부는 잘려야 한다')
  assert.ok(req.messages[0].content.length <= REVIEW_DECISION_CANDIDATES_MAX_CHARS + '[복습 후보]\n'.length)
  assert.equal(req.skippedCandidates, long.length - req.keptItemIds.length)
})

test('후보 1건이 상한보다 크면 ReviewDecisionInputError(itemId 는 렌더 상한 대상이 아니라 그대로 길이에 반영된다)', () => {
  const huge: ReviewDecisionCandidateInput[] = [
    { itemId: 'x'.repeat(6_000), itemType: 'EXPRESSION', textJa: 'あ', meaningKo: '가', studiedCount: 1, correctCount: 1, wrongCount: 0, feedbackCount: 0, lastStudiedAt: null, intervalDays: 3, priority: 'NORMAL' },
  ]
  assert.throws(() => buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: huge }), ReviewDecisionInputError)
})

// ── persona 안정성 ────────────────────────────────────────────────────

test('persona(→ --system-prompt)는 후보·관측 요약이 달라도 바이트 동일(같은 학습자·같은 모드)', () => {
  const a = buildReviewDecisionRequest({ todayKst: '2026-09-28', learner, candidates: fixture.candidates })
  const b = buildReviewDecisionRequest({ todayKst: '2026-10-05', learner: { ...learner, streakDays: 99 }, candidates: fixture.candidates.slice(0, 1), observationSummary: fixture.observationSummary })
  assert.equal(a.persona!.prompt, b.persona!.prompt)
  assert.ok(!a.persona!.prompt.includes('rep-01'), '후보 데이터는 persona 가 아니라 messages 쪽에만 있어야 한다')
})

// ── REVIEW_DECISION_SCHEMA ────────────────────────────────────────────

function validResponse(): ReviewDecisionResponse {
  return {
    decisions: [
      { itemId: 'rep-01', nextIntervalDays: 4, priority: 'NORMAL', reason_ko: '2회 연속 정답이라 4일' },
      { itemId: 'rep-03', nextIntervalDays: 3, priority: 'FOCUS', reason_ko: '오답 2회·피드백 3회라 FOCUS' },
    ],
    sessionPlan: { itemIds: ['rep-01', 'rep-03'], mixNote_ko: '학습 횟수가 적은 것부터 섞어요.' },
    rationale_ko: '오답·피드백이 많은 항목은 FOCUS 로 당기고, 잘하는 항목은 간격을 늘렸어요.',
  }
}

test('REVIEW_DECISION_SCHEMA: 유효 응답 통과, 필수 누락·잘못된 enum·범위 밖 정수는 실패', () => {
  const ok = validResponse()
  assert.deepEqual(validateOutput(ok, REVIEW_DECISION_SCHEMA), { ok: true })
  assert.equal(validateOutput({ ...ok, extra: 1 }, REVIEW_DECISION_SCHEMA).ok, false)
  const missing: Record<string, unknown> = { ...ok }
  delete missing.rationale_ko
  assert.equal(validateOutput(missing, REVIEW_DECISION_SCHEMA).ok, false)
  assert.equal(validateOutput({ ...ok, decisions: [{ ...ok.decisions[0], priority: 'URGENT' }, ok.decisions[1]] }, REVIEW_DECISION_SCHEMA).ok, false)
  assert.equal(validateOutput({ ...ok, decisions: [{ ...ok.decisions[0], nextIntervalDays: 0 }, ok.decisions[1]] }, REVIEW_DECISION_SCHEMA).ok, false, '0 은 정수 하한(1) 밖')
  assert.equal(validateOutput({ ...ok, decisions: [] }, REVIEW_DECISION_SCHEMA).ok, false, 'decisions 는 minItems 1')
})

test('REVIEW_DECISION_SCHEMA: 3~7 을 벗어난 값(예: 10, 15)은 스키마 자체로는 통과한다(클램프는 코드 몫)', () => {
  const ok = validResponse()
  const wide = { ...ok, decisions: [{ ...ok.decisions[0], nextIntervalDays: 15 }, ok.decisions[1]] }
  assert.deepEqual(validateOutput(wide, REVIEW_DECISION_SCHEMA), { ok: true })
})

// ── checkReviewDecisionResponse(재시도용 — 엔진명 노출만) ─────────────────

test('checkReviewDecisionResponse: 유효 응답은 위반 0', () => {
  assert.deepEqual(checkReviewDecisionResponse(validResponse()), [])
})

test('checkReviewDecisionResponse: rationale_ko·reason_ko·mixNote_ko 어디든 엔진명이 섞이면 위반', () => {
  const ok = validResponse()
  assert.ok(checkReviewDecisionResponse({ ...ok, rationale_ko: 'Claude 선생님이 판단했어요' }).length > 0)
  assert.ok(checkReviewDecisionResponse({ ...ok, decisions: [{ ...ok.decisions[0], reason_ko: 'GPT 모델 판단' }, ok.decisions[1]] }).length > 0)
  assert.ok(checkReviewDecisionResponse({ ...ok, sessionPlan: { ...ok.sessionPlan, mixNote_ko: 'sonnet 이 골랐어요' } }).length > 0)
})

// ── normalizeReviewDecision(결정적 보정, 재시도 아님) ──────────────────────

function candidatesFromFixture(): ReviewDecisionCandidateRef[] {
  return fixture.candidates.map((c) => ({ itemId: c.itemId, intervalDays: c.intervalDays, priority: c.priority }))
}

test('normalizeReviewDecision: 3~7 범위 밖 값을 클램프하고 건수를 센다', () => {
  const data: ReviewDecisionResponse = {
    decisions: [
      { itemId: 'rep-01', nextIntervalDays: 15, priority: 'NORMAL', reason_ko: '너무 길게 판단함' },
      { itemId: 'rep-02', nextIntervalDays: 1, priority: 'NORMAL', reason_ko: '너무 짧게 판단함' },
      { itemId: 'rep-04', nextIntervalDays: 5, priority: 'NORMAL', reason_ko: '정상 범위' },
    ],
    sessionPlan: { itemIds: ['rep-01'], mixNote_ko: 'ok' },
    rationale_ko: 'ok',
  }
  const r = normalizeReviewDecision({ candidates: candidatesFromFixture() }, data)
  assert.equal(r.decisions.find((d) => d.itemId === 'rep-01')!.nextIntervalDays, 7)
  assert.equal(r.decisions.find((d) => d.itemId === 'rep-02')!.nextIntervalDays, 3)
  assert.equal(r.decisions.find((d) => d.itemId === 'rep-04')!.nextIntervalDays, 5, '정상 범위는 그대로')
  assert.equal(r.counts.clamped, 2)
})

test('normalizeReviewDecision: FOCUS 는 3~7 클램프 뒤에도 ≤3 으로 한 번 더 강제된다(사실상 3)', () => {
  const data: ReviewDecisionResponse = {
    decisions: [{ itemId: 'rep-03', nextIntervalDays: 6, priority: 'FOCUS', reason_ko: 'FOCUS 인데 6일로 판단함' }],
    sessionPlan: { itemIds: [], mixNote_ko: 'ok' },
    rationale_ko: 'ok',
  }
  const r = normalizeReviewDecision({ candidates: candidatesFromFixture() }, data)
  const d = r.decisions.find((x) => x.itemId === 'rep-03')!
  assert.equal(d.nextIntervalDays, 3)
  assert.equal(d.priority, 'FOCUS')
  assert.equal(r.counts.clamped, 1)
})

test('normalizeReviewDecision: 후보 풀에 없는 itemId 를 참조한 결정은 버린다(환각 방어), 중복 itemId 는 처음 것만', () => {
  const data: ReviewDecisionResponse = {
    decisions: [
      { itemId: 'rep-01', nextIntervalDays: 5, priority: 'NORMAL', reason_ko: '첫 번째' },
      { itemId: 'rep-01', nextIntervalDays: 3, priority: 'FOCUS', reason_ko: '중복(무시돼야 함)' },
      { itemId: 'made-up-id', nextIntervalDays: 5, priority: 'NORMAL', reason_ko: '없는 id' },
    ],
    sessionPlan: { itemIds: [], mixNote_ko: 'ok' },
    rationale_ko: 'ok',
  }
  const r = normalizeReviewDecision({ candidates: candidatesFromFixture() }, data)
  const rep01 = r.decisions.filter((d) => d.itemId === 'rep-01')
  assert.equal(rep01.length, 1)
  assert.equal(rep01[0].nextIntervalDays, 5)
  assert.ok(!r.decisions.some((d) => d.itemId === 'made-up-id'))
  assert.equal(r.counts.discarded, 2)
})

test('normalizeReviewDecision: 판단하지 않은 후보는 기존 intervalDays 로 폴백 채워진다(신규 항목은 초기 3)', () => {
  const data: ReviewDecisionResponse = {
    decisions: [{ itemId: 'rep-01', nextIntervalDays: 5, priority: 'NORMAL', reason_ko: '판단됨' }],
    sessionPlan: { itemIds: [], mixNote_ko: 'ok' },
    rationale_ko: 'ok',
  }
  const candidates: ReviewDecisionCandidateRef[] = [
    { itemId: 'rep-01', intervalDays: 3, priority: 'NORMAL' },
    { itemId: 'rep-04', intervalDays: 7, priority: 'NORMAL' }, // 판단 안 됨 → 기존 간격 유지
    { itemId: 'new-item' }, // intervalDays 없음(신규) → 초기값 3
  ]
  const r = normalizeReviewDecision({ candidates }, data)
  assert.equal(r.decisions.length, 3, '후보 풀 전체를 정확히 한 번씩 담는다')
  const rep04 = r.decisions.find((d) => d.itemId === 'rep-04')!
  assert.equal(rep04.nextIntervalDays, 7)
  assert.equal(rep04.reason_ko, REVIEW_FALLBACK_REASON_KO)
  const newItem = r.decisions.find((d) => d.itemId === 'new-item')!
  assert.equal(newItem.nextIntervalDays, REVIEW_FALLBACK_INTERVAL_DAYS)
  assert.equal(newItem.priority, 'NORMAL')
  assert.equal(r.counts.fallback, 2)
})

test('normalizeReviewDecision: sessionPlan.itemIds 는 후보 풀의 부분집합만 남긴다(중복 제거, 순서 보존)', () => {
  const data: ReviewDecisionResponse = {
    decisions: [{ itemId: 'rep-01', nextIntervalDays: 5, priority: 'NORMAL', reason_ko: 'ok' }],
    sessionPlan: { itemIds: ['rep-01', 'rep-01', 'made-up-id', 'rep-04'], mixNote_ko: 'ok' },
    rationale_ko: 'ok',
  }
  const r = normalizeReviewDecision({ candidates: candidatesFromFixture() }, data)
  assert.deepEqual(r.sessionPlan.itemIds, ['rep-01', 'rep-04'])
  assert.equal(r.counts.sessionPlanPruned, 2)
})

test('normalizeReviewDecision: 후보가 비어 있으면 decisions·sessionPlan 도 빈 배열', () => {
  const data = validResponse()
  const r = normalizeReviewDecision({ candidates: [] }, data)
  assert.deepEqual(r.decisions, [])
  assert.deepEqual(r.sessionPlan.itemIds, [])
})
