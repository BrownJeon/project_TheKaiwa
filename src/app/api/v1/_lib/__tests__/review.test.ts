/**
 * task-010b 라우트 조합(`_lib/review`) — A11 후검증 연결(`normalizeReviewDecision` 이 completeJson 직후 driver.finalize 에서 불린다)과
 * 교정 관측 훅이 넘겨받은 tx 로만 쓰는지(DB 없음).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Prisma } from '@prisma/client'
import type { Tx } from '@/modules/infra'
import { REVIEW_DECISION_PROMPT_VERSION, type ReviewDecisionResponse } from '@/modules/conversation'
import type { ReviewDecisionCandidate } from '@/modules/learning'
import { correctionProposedHook, reviewCorrectionHooks, reviewDecisionDriver } from '../review'

const U = 'cuser00000000000000000001'
const c = (itemId: string, intervalDays: number, priority: 'NORMAL' | 'FOCUS'): ReviewDecisionCandidate => ({
  itemId,
  itemType: 'EXPRESSION',
  textJa: '会う',
  meaningKo: '만나다',
  studiedCount: 1,
  correctCount: 0,
  wrongCount: 1,
  feedbackCount: 0,
  lastStudiedAt: '2026-10-01',
  intervalDays,
  priority,
})

test('A11 finalize = normalizeReviewDecision: 후보 1:1·3~7·FOCUS ≤3·입력에 없던 id·중복 폐기·판단 못 받은 항목은 폴백(byTutor false)', () => {
  const driver = reviewDecisionDriver(U)
  assert.equal(driver.promptVersion, REVIEW_DECISION_PROMPT_VERSION)
  const data: ReviewDecisionResponse = {
    decisions: [
      { itemId: 'a', nextIntervalDays: 9, priority: 'NORMAL', reason_ko: '잘 기억해요' },
      { itemId: 'b', nextIntervalDays: 6, priority: 'FOCUS', reason_ko: '또 틀렸어요' },
      { itemId: 'ghost', nextIntervalDays: 4, priority: 'NORMAL', reason_ko: '?' },
      { itemId: 'a', nextIntervalDays: 3, priority: 'NORMAL', reason_ko: '중복' },
    ],
    sessionPlan: { itemIds: ['a', 'ghost'], mixNote_ko: '' },
    rationale_ko: '조사 실수가 남아 있어 먼저 골랐어요.',
  }
  const plan = driver.finalize([c('a', 5, 'NORMAL'), c('b', 3, 'NORMAL'), c('c', 6, 'NORMAL')], data)
  assert.deepEqual(
    plan.decisions.map((d) => [d.itemId, d.intervalDays, d.priority, d.byTutor]),
    [
      ['a', 7, 'NORMAL', true],
      ['b', 3, 'FOCUS', true],
      ['c', 6, 'NORMAL', false],
    ],
  )
  assert.equal(plan.decisions[2].reasonKo, '이번엔 판단하지 못해 기존 간격을 유지해요')
  assert.equal(plan.rationaleKo, data.rationale_ko)
  assert.deepEqual(plan.counts, { clamped: 2, discarded: 2, fallback: 1, sessionPlanPruned: 1 })
})

function obsTx() {
  const rows: Prisma.LearningObservationCreateManyInput[] = []
  const daily: unknown[] = []
  const tx = {
    learningObservation: {
      createMany: async ({ data }: { data: Prisma.LearningObservationCreateManyInput[] }) => {
        rows.push(...data)
        return { count: data.length }
      },
    },
    $executeRaw: async () => 1,
    $queryRaw: async () => [{ id: 'daily1' }],
    statsSnapshot: {
      findUnique: async () => ({ data: daily.at(-1) ?? null }),
      update: async ({ data }: { data: { data: unknown } }) => {
        daily.push(data.data)
        return {}
      },
    },
  } as unknown as Tx
  return { tx, rows, daily }
}

test('교정 제안 관측 훅: 턴(#32)·점검(#33) 모두 넘겨받은 tx 에 CORRECTION_PROPOSED + DAILY observations, 입력 경로는 meta 만', async () => {
  const t = obsTx()
  await correctionProposedHook(U)(t.tx, { correctionId: 'c1', errorType: 'PARTICLE', severity: 'MAJOR', inputSource: 'REALTIME_STT' })
  await reviewCorrectionHooks(U).recordCorrectionsProposed!(t.tx, [
    { correctionId: 'c2', errorType: 'VOCABULARY', severity: 'MINOR' },
    { correctionId: 'c3', errorType: 'NATURALNESS', severity: 'MAJOR' },
  ])
  assert.deepEqual(
    t.rows.map((r) => [r.userId, r.kind, r.outcome, r.skill, r.refType, r.refId, (r.meta as { input?: string } | undefined)?.input ?? null]),
    [
      [U, 'CORRECTION_PROPOSED', 'FAIL', 'GRAMMAR_PARTICLE', 'Correction', 'c1', 'VOICE'],
      [U, 'CORRECTION_PROPOSED', 'PARTIAL', 'VOCAB_RECALL', 'Correction', 'c2', null],
      [U, 'CORRECTION_PROPOSED', 'FAIL', 'SENTENCE_PRODUCTION', 'Correction', 'c3', null],
    ],
  )
  assert.equal((t.daily.at(-1) as { observations: { total: number } }).observations.total, 3)
})
