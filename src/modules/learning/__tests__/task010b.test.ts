/**
 * task-010b 반복 학습 — 서버 1단계 단위 테스트(DB 없음). 순수 규칙(세션 크기·가중 추출·가드·후보 순서·다음 복습 묶음)과
 * 가짜 tx 로 본 쓰기 경로(항목 등록 3경로·복습 완료·A11 적재·판단 저장·#63 되살리기·#64 건너뛰기·관측 + DAILY, 롤백 시 0행).
 * 실제 DB·LLM 은 `tests/live/task010b-smoke.ts`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { ApiError, dates, type Tx } from '@/modules/infra'
import {
  clampInterval,
  correctionMeaningSnap,
  markRepetitionStudied,
  mergeRepetitionInputs,
  priorityAfterFeedback,
  registerRepetitionItems,
  repetitionSourceOf,
  REPETITION_FOCUS_FEEDBACK,
} from '../repetition'
import {
  groupNextReview,
  isStudyDay,
  isUndecided,
  needsDecision,
  nextDueDate,
  nextReviewOf,
  orderCandidates,
  pickReviewSession,
  REVIEW_FALLBACK_RATIONALE_KO,
  REVIEW_SESSION_MIN,
  reviewGuardOf,
  reviewSessionSize,
  reviewWeight,
  type CandidateRow,
  type SampleItem,
} from '../repetition/review'
import {
  applyReviewDecisions,
  claimDecisionJob,
  fallbackPlan,
  REVIEW_FALLBACK_REASON_KO,
  runReviewDecisionJob,
  type DecisionRunnerDeps,
  type ReviewDecisionCandidate,
  type ReviewDecisionDriver,
  type ReviewDecisionPlan,
} from '../repetition/decision'
import { parseProgressPatch } from '../lessons/progress'
import { completeScheduleForLesson, ensureTodaySchedule, kstDayStart, orderPreview, skipReviewIn } from '../reviewSchedule/core'
import { claimReviewStart, resolveDecisionJob, type DecisionPathDeps, type ReviewMixMaterials } from '../reviewSchedule'
import { correctionSkill, observationDailyDelta, observationRow, recordObservations, summarizeRecentObservations, OBSERVATION_META_MAX, OBSERVATION_CONFIDENCE_MIN } from '../observations'
import { correctionProposedObservation, recordCorrectionIgnored, recordCorrectionsProposed, registerAcceptedCorrection } from '../observations/corrections'
import { lessonObservations, quizTargetTally } from '../lessons/observations'
import { vocabObservations, vocabRepetitionInputs } from '../vocab/sessions'
import { mergeDaily } from '../snapshots'
import { toLessonDto, type LessonRow } from '../lessons/rows'
import type { LessonGeneration } from '../lessons/generate'

const U = 'cuser00000000000000000001'
const OTHER = 'cuser00000000000000000002'
const code = (c: string, reason?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (reason === undefined || (e.details as { reason?: string } | undefined)?.reason === reason)
const ymd = (d: unknown) => (d as Date).toISOString().slice(0, 10)

// ── 순수 규칙 ───────────────────────────────────────────────────────────────

test('세션 크기: dailyMinutes 의 절반, 15분 → 8(6~8 안), 항상 ≥4(A5 chunks 최소)·≤12, 없으면 15분 기준', () => {
  assert.equal(reviewSessionSize(15), 8)
  assert.equal(reviewSessionSize(12), 6)
  assert.equal(reviewSessionSize(5), REVIEW_SESSION_MIN)
  assert.equal(reviewSessionSize(1), 4)
  assert.equal(reviewSessionSize(60), 12)
  assert.equal(reviewSessionSize(null), 8)
  assert.equal(reviewSessionSize(0), 8)
  assert.equal(reviewSessionSize(Number.NaN), 8)
})

test('가중치: 1/(1+studiedCount) × (FOCUS 2) × (최근 3세션 0.5)', () => {
  assert.equal(reviewWeight({ studiedCount: 0, priority: 'NORMAL' }, false), 1)
  assert.equal(reviewWeight({ studiedCount: 1, priority: 'FOCUS' }, false), 1)
  assert.equal(reviewWeight({ studiedCount: 3, priority: 'NORMAL' }, true), 0.125)
  assert.equal(reviewWeight({ studiedCount: -4, priority: 'NORMAL' }, false), 1, '음수는 0 으로')
})

const sample = (id: string, over: Partial<SampleItem> = {}): SampleItem => ({ id, studiedCount: 1, priority: 'NORMAL', nextDueAt: '2026-10-02', ...over })

test('균등 랜덤 추출: 같은 시드·후보 → 같은 결과(입력 순서 무관)·비복원·크기 상한', () => {
  const due = Array.from({ length: 10 }, (_, i) => sample(`r${String(i).padStart(2, '0')}`))
  const a = pickReviewSession({ due, upcoming: [], size: 6, seed: 'seed-1', recentIds: new Set() })
  const b = pickReviewSession({ due: [...due].reverse(), upcoming: [], size: 6, seed: 'seed-1', recentIds: new Set() })
  assert.deepEqual(a, b)
  assert.equal(a.length, 6)
  assert.equal(new Set(a).size, 6, '중복 없음')
  assert.ok(a.every((id) => due.some((d) => d.id === id)))
})

test('균등 랜덤 추출: due 가 4 미만이면 가까운 예정 항목으로 4까지 채우고, 전체가 4 미만이면 있는 만큼', () => {
  const due = [sample('d1')]
  const upcoming = [sample('u3', { nextDueAt: '2026-10-06' }), sample('u1', { nextDueAt: '2026-10-03' }), sample('u2', { nextDueAt: '2026-10-04' }), sample('u4', { nextDueAt: '2026-10-07' })]
  assert.deepEqual(pickReviewSession({ due, upcoming, size: 8, seed: 's', recentIds: new Set() }), ['d1', 'u1', 'u2', 'u3'])
  assert.deepEqual(pickReviewSession({ due, upcoming: [sample('u1', { nextDueAt: '2026-10-03' })], size: 8, seed: 's', recentIds: new Set() }), ['d1', 'u1'])
  assert.deepEqual(pickReviewSession({ due: [], upcoming, size: 8, seed: 's', recentIds: new Set() }), ['u1', 'u2', 'u3', 'u4'])
})

test('균등 랜덤 추출: FOCUS·덜 본 항목이 더 자주, 최근 세션 항목은 덜 자주(시드 300개 집계)', () => {
  const due = [
    sample('focus', { priority: 'FOCUS', studiedCount: 0 }),
    sample('fresh', { studiedCount: 0 }),
    sample('old', { studiedCount: 9 }),
    sample('recent', { studiedCount: 0 }),
    ...Array.from({ length: 8 }, (_, i) => sample(`n${i}`, { studiedCount: 2 })),
  ]
  const hits = new Map<string, number>()
  for (let s = 0; s < 300; s++) for (const id of pickReviewSession({ due, upcoming: [], size: 4, seed: `seed-${s}`, recentIds: new Set(['recent']) })) hits.set(id, (hits.get(id) ?? 0) + 1)
  const h = (id: string) => hits.get(id) ?? 0
  assert.ok(h('focus') > h('fresh'), `FOCUS ${h('focus')} > NORMAL ${h('fresh')}`)
  assert.ok(h('fresh') > h('old'), `덜 본 ${h('fresh')} > 많이 본 ${h('old')}`)
  assert.ok(h('fresh') > h('recent'), `최근 노출 감쇠 ${h('fresh')} > ${h('recent')}`)
})

test('최소 기록 가드: 공부한 날 2·항목 2 — 모자라면 insufficient + 막대 값(have 는 need 에서 자른다)', () => {
  assert.deepEqual(reviewGuardOf({ studyDays: 1, items: 5 }), { reason: 'insufficient', needed: 1, studyDays: { have: 1, need: 2 }, items: { have: 2, need: 2 } })
  assert.deepEqual(reviewGuardOf({ studyDays: 2, items: 1 }), { reason: 'insufficient', needed: 1, studyDays: { have: 2, need: 2 }, items: { have: 1, need: 2 } })
  assert.equal(reviewGuardOf({ studyDays: 0, items: 0 })?.needed, 2)
  assert.equal(reviewGuardOf({ studyDays: 2, items: 2 }), null)
  assert.equal(reviewGuardOf({ studyDays: 9, items: 40 }), null)
})

test('공부한 날: 출석만 한 날은 아니다(레슨·복습·세트·평가·교정 채택·대화 기록 중 하나)', () => {
  assert.equal(isStudyDay({ attended: true }), false)
  assert.equal(isStudyDay({ attended: true, lessons: 1 }), true)
  assert.equal(isStudyDay({ reviews: 1 }), true)
  assert.equal(isStudyDay({ words: { sessions: 1 } }), true)
  assert.equal(isStudyDay({ corrections: { proposed: 3, accepted: 0 } }), false)
  assert.equal(isStudyDay({ corrections: { accepted: 1 } }), true)
  assert.equal(isStudyDay({ chatTurns: 2 }), true)
  assert.equal(isStudyDay(null), false)
  assert.equal(isStudyDay('x'), false)
})

const cand = (id: string, over: Partial<CandidateRow> = {}): CandidateRow => ({
  id,
  studiedCount: 1,
  wrongCount: 0,
  priority: 'NORMAL',
  nextDueAt: '2026-10-10',
  lastStudiedAt: new Date('2026-09-30T00:00:00Z'),
  decidedAt: new Date('2026-09-30T01:00:00Z'),
  ...over,
})

test('A11 후보 순서: 내일까지 예정 → 판단 전 → FOCUS → 오답 많은 순 → 예정일 → id', () => {
  const rows = [
    cand('z-late'),
    cand('y-focus', { priority: 'FOCUS' }),
    cand('x-wrong', { wrongCount: 5 }),
    cand('w-undecided', { decidedAt: null }),
    cand('v-due', { nextDueAt: '2026-10-03' }),
    cand('u-due-today', { nextDueAt: '2026-10-02' }),
    cand('t-studied-after', { lastStudiedAt: new Date('2026-10-01T00:00:00Z') }),
  ]
  const out = orderCandidates(rows, '2026-10-02').map((r) => r.id)
  assert.deepEqual(out, ['u-due-today', 'v-due', 't-studied-after', 'w-undecided', 'y-focus', 'x-wrong', 'z-late'])
  assert.equal(isUndecided(cand('a', { decidedAt: null })), true)
  assert.equal(isUndecided(cand('a')), false)
  assert.equal(needsDecision(cand('a'), '2026-10-02'), false)
  assert.equal(needsDecision(cand('a', { nextDueAt: '2026-10-03' }), '2026-10-02'), true)
})

test('다음 복습일 = 마지막 학습일(KST) + 간격 — 학습 기록이 없으면 오늘 기준', () => {
  assert.equal(nextDueDate(new Date('2026-10-01T16:00:00Z'), 3, '2026-10-02'), '2026-10-05', 'UTC 16시 = KST 다음날 01시')
  assert.equal(nextDueDate(new Date('2026-10-01T14:00:00Z'), 3, '2026-10-02'), '2026-10-04')
  assert.equal(nextDueDate(null, 5, '2026-10-02'), '2026-10-07')
})

test('#60 nextReview.groups: 예정일별 묶음(오름차순)·기준일에서 며칠 뒤·예정일 없는 항목 제외', () => {
  const g = groupNextReview(
    [
      { id: 'a', nextDueAt: '2026-10-09' },
      { id: 'b', nextDueAt: '2026-10-05' },
      { id: 'c', nextDueAt: '2026-10-09' },
      { id: 'd', nextDueAt: null },
      { id: 'e', nextDueAt: '2026-09-30' },
    ],
    '2026-10-02',
  )
  assert.deepEqual(g, [
    { days: 0, date: '2026-09-30', itemIds: ['e'] },
    { days: 3, date: '2026-10-05', itemIds: ['b'] },
    { days: 7, date: '2026-10-09', itemIds: ['a', 'c'] },
  ])
})

test('#58 nextReview: 가장 이른 묶음 — 전부 강사 판단이면 TUTOR, 하나라도 기본 규칙이면 FALLBACK(★④), 없음·지난 날짜 null', () => {
  assert.deepEqual(nextReviewOf('2026-10-05', '2026-10-02', [{ decidedBy: 'TUTOR', n: 3 }]), { date: '2026-10-05', days: 3, itemCount: 3, decidedBy: 'TUTOR' })
  assert.deepEqual(nextReviewOf('2026-10-05', '2026-10-02', [{ decidedBy: 'TUTOR', n: 3 }, { decidedBy: 'FALLBACK', n: 1 }]), { date: '2026-10-05', days: 3, itemCount: 4, decidedBy: 'FALLBACK' })
  assert.equal(nextReviewOf('2026-10-05', '2026-10-02', []), null)
  assert.equal(nextReviewOf('2026-10-02', '2026-10-02', [{ decidedBy: 'TUTOR', n: 1 }]), null)
})

test('KST 하루 시작(오늘 만든 판단 잡 판정): 2026-10-02 KST 0시 = 10-01 15:00Z', () => {
  assert.equal(kstDayStart('2026-10-02').toISOString(), '2026-10-01T15:00:00.000Z')
})

// ── 반복 항목 규칙 ─────────────────────────────────────────────────────────────

test('우선순위: 피드백 3회↑ 또는 이미 FOCUS → FOCUS(이 경로는 풀지 않는다), FOCUS 간격 ≤3', () => {
  assert.equal(REPETITION_FOCUS_FEEDBACK, 3)
  assert.equal(priorityAfterFeedback('NORMAL', 2), 'NORMAL')
  assert.equal(priorityAfterFeedback('NORMAL', 3), 'FOCUS')
  assert.equal(priorityAfterFeedback(null, 0), 'NORMAL')
  assert.equal(priorityAfterFeedback('FOCUS', 0), 'FOCUS')
  assert.equal(clampInterval(7, 'FOCUS'), 3)
  assert.equal(clampInterval(1, 'NORMAL'), 3)
  assert.equal(clampInterval(12, 'NORMAL'), 7)
})

test('교정 뜻 스냅샷: 설명 첫 문장(≤80자), 빈 설명 null · 출처 3종(refType 으로만, Leader ④)', () => {
  assert.equal(correctionMeaningSnap('「に」가 아니라 「を」를 씁니다. 목적어 조사예요.'), '「に」가 아니라 「を」를 씁니다.')
  assert.equal(correctionMeaningSnap('  '), null)
  assert.equal(correctionMeaningSnap(null), null)
  assert.equal([...(correctionMeaningSnap('가'.repeat(200)) ?? '')].length, 80)
  assert.deepEqual(['TopicChunk', 'Expr', 'Grammar', 'Correction', 'WordEntry', '???'].map(repetitionSourceOf), ['LESSON', 'LESSON', 'LESSON', 'CORRECTION', 'WORDS', 'LESSON'])
})

interface RepRow {
  id: string
  userId: string
  refType: string
  refId: string
  itemType: string
  textJa: string
  meaningKo: string | null
  studiedCount: number
  lastStudiedAt: Date | null
  correctCount: number
  wrongCount: number
  feedbackCount: number
  intervalDays: number
  priority: 'NORMAL' | 'FOCUS'
  nextDueAt: Date | null
  decidedBy: 'TUTOR' | 'FALLBACK'
  decisionReason?: string | null
  decidedAt?: Date | null
}

type IncData = Record<string, unknown>
function applyData(row: Record<string, unknown>, data: IncData): void {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && 'increment' in (v as object)) row[k] = (Number(row[k]) || 0) + Number((v as { increment: number }).increment)
    else row[k] = v
  }
}

test('교정 채택 등록(studied:false): 새 항목은 studiedCount 0·lastStudiedAt null·피드백 1, 재채택은 피드백만 +1 → 3회면 FOCUS·3일', async () => {
  const rows: RepRow[] = []
  let n = 0
  const tx = {
    repetitionItem: {
      findMany: async ({ where }: { where: { userId: string; OR: { refType: string; refId: string }[] } }) =>
        rows.filter((r) => r.userId === where.userId && where.OR.some((o) => o.refType === r.refType && o.refId === r.refId)),
      create: async ({ data }: { data: Omit<RepRow, 'id'> }) => {
        const row = { ...data, id: `rep${++n}` } as RepRow
        rows.push(row)
        return { id: row.id }
      },
      update: async ({ where, data }: { where: { id: string }; data: IncData }) => {
        applyData(rows.find((r) => r.id === where.id) as unknown as Record<string, unknown>, data)
        return {}
      },
    },
  } as unknown as Tx
  const input = { itemType: 'EXPRESSION' as const, refType: 'Correction', refId: 'h1', textJa: '友だちに会いました', meaningKo: '「に」', feedback: 1, studied: false }
  const opts = { today: '2026-10-02', now: new Date('2026-10-02T01:00:00Z') }
  const [first] = await registerRepetitionItems(U, [input], tx, opts)
  assert.equal(first.created, true)
  assert.deepEqual([rows[0].studiedCount, rows[0].lastStudiedAt, rows[0].feedbackCount, rows[0].priority, ymd(rows[0].nextDueAt)], [0, null, 1, 'NORMAL', '2026-10-05'])
  await registerRepetitionItems(U, [input], tx, opts)
  const [third] = await registerRepetitionItems(U, [input], tx, { ...opts, today: '2026-10-03' })
  assert.equal(rows.length, 1, '같은 표현은 같은 항목')
  assert.equal(third.priority, 'FOCUS')
  assert.deepEqual([rows[0].studiedCount, rows[0].lastStudiedAt, rows[0].feedbackCount, rows[0].priority, rows[0].intervalDays, ymd(rows[0].nextDueAt)], [0, null, 3, 'FOCUS', 3, '2026-10-06'])
  // 공부 경로(기본 studied)는 그대로 +1
  await registerRepetitionItems(U, [{ ...input, feedback: 0, studied: undefined }], tx, opts)
  assert.equal(rows[0].studiedCount, 1)
  assert.ok(rows[0].lastStudiedAt instanceof Date)
  assert.equal(mergeRepetitionInputs([input, { ...input, studied: true }])[0].studied, true, '같은 키에 공부가 하나라도 있으면 공부')
})

test('복습 레슨 완료(markRepetitionStudied): 이 사용자 항목만 studiedCount+1·정오답·FOCUS ≤3·FALLBACK, 중복 id 합침', async () => {
  const updates: { id: string; data: IncData }[] = []
  const tx = {
    repetitionItem: {
      findMany: async ({ where }: { where: { userId: string; id: { in: string[] } } }) =>
        [
          { id: 'r1', userId: U, intervalDays: 6, priority: 'NORMAL', feedbackCount: 0 },
          { id: 'r2', userId: U, intervalDays: 6, priority: 'NORMAL', feedbackCount: 4 },
          { id: 'rX', userId: OTHER, intervalDays: 5, priority: 'NORMAL', feedbackCount: 0 },
        ].filter((r) => r.userId === where.userId && where.id.in.includes(r.id)),
      update: async ({ where, data }: { where: { id: string }; data: IncData }) => {
        updates.push({ id: where.id, data })
        return {}
      },
    },
  } as unknown as Tx
  const out = await markRepetitionStudied(U, [{ id: 'r1', correct: 1 }, { id: 'r2', wrong: 1 }, { id: 'r1', correct: 1, wrong: 1 }, { id: 'rX' }, { id: 'gone' }], tx, { today: '2026-10-02', now: new Date('2026-10-02T03:00:00Z') })
  assert.deepEqual(out, ['r1', 'r2'], '남의·없는 id 는 건너뜀')
  const r1 = updates.find((u) => u.id === 'r1')!.data
  assert.deepEqual([r1.studiedCount, r1.correctCount, r1.wrongCount, r1.intervalDays, r1.priority, r1.decidedBy, ymd(r1.nextDueAt)], [{ increment: 1 }, { increment: 2 }, { increment: 1 }, 6, 'NORMAL', 'FALLBACK', '2026-10-08'])
  const r2 = updates.find((u) => u.id === 'r2')!.data
  assert.deepEqual([r2.priority, r2.intervalDays, ymd(r2.nextDueAt)], ['FOCUS', 3, '2026-10-05'], '피드백 4회 → FOCUS 3일')
  assert.deepEqual(await markRepetitionStudied(U, [], tx), [])
})

// ── A11 판단: 폴백·저장 ─────────────────────────────────────────────────────────

test('폴백 판단(LLM 실패·타임아웃): 기존 간격 클램프 유지·피드백 3회↑ FOCUS 3·코드 근거·byTutor false', () => {
  const p = fallbackPlan([
    { itemId: 'a', intervalDays: 6, priority: 'NORMAL', feedbackCount: 0 },
    { itemId: 'b', intervalDays: 9, priority: 'NORMAL', feedbackCount: 0 },
    { itemId: 'c', intervalDays: 6, priority: 'NORMAL', feedbackCount: 3 },
  ])
  assert.deepEqual(p.decisions.map((d) => [d.itemId, d.intervalDays, d.priority, d.byTutor]), [['a', 6, 'NORMAL', false], ['b', 7, 'NORMAL', false], ['c', 3, 'FOCUS', false]])
  assert.ok(p.decisions.every((d) => d.reasonKo === REVIEW_FALLBACK_REASON_KO))
  assert.equal(p.rationaleKo, REVIEW_FALLBACK_RATIONALE_KO)
})

test('판단 저장(applyReviewDecisions): 코드가 다시 3~7·FOCUS ≤3·피드백 3회 FOCUS 유지, nextDueAt = 마지막 학습일 + 간격, TUTOR/FALLBACK, 없는 id 건너뜀', async () => {
  const updates: { id: string; data: Record<string, unknown> }[] = []
  const fresh = [
    { id: 'a', lastStudiedAt: new Date('2026-10-01T03:00:00Z'), feedbackCount: 0 },
    { id: 'b', lastStudiedAt: new Date('2026-10-01T03:00:00Z'), feedbackCount: 0 },
    { id: 'c', lastStudiedAt: new Date('2026-09-25T03:00:00Z'), feedbackCount: 0 },
    { id: 'd', lastStudiedAt: null, feedbackCount: 5 },
  ]
  const tx = {
    repetitionItem: {
      findMany: async ({ where }: { where: { userId: string; id: { in: string[] } } }) => (where.userId === U ? fresh.filter((f) => where.id.in.includes(f.id)) : []),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data })
        return {}
      },
    },
  } as unknown as Tx
  const plan: ReviewDecisionPlan = {
    decisions: [
      { itemId: 'a', intervalDays: 9, priority: 'NORMAL', reasonKo: '잘 기억해요', byTutor: true },
      { itemId: 'b', intervalDays: 6, priority: 'FOCUS', reasonKo: '조사를 또 틀렸어요', byTutor: true },
      { itemId: 'c', intervalDays: 5, priority: 'NORMAL', reasonKo: 'x'.repeat(500), byTutor: false },
      { itemId: 'd', intervalDays: 7, priority: 'NORMAL', reasonKo: '', byTutor: true },
      { itemId: 'ghost', intervalDays: 4, priority: 'NORMAL', reasonKo: '?', byTutor: true },
    ],
    rationaleKo: '근거',
  }
  const decidedAt = new Date('2026-10-02T00:00:00Z')
  const n = await applyReviewDecisions(U, plan, tx, { today: '2026-10-02', decidedAt })
  assert.equal(n, 4)
  const by = (id: string) => updates.find((u) => u.id === id)!.data
  assert.deepEqual([by('a').intervalDays, by('a').priority, by('a').decidedBy, ymd(by('a').nextDueAt)], [7, 'NORMAL', 'TUTOR', '2026-10-08'])
  assert.deepEqual([by('b').intervalDays, by('b').priority, ymd(by('b').nextDueAt)], [3, 'FOCUS', '2026-10-04'])
  assert.deepEqual([by('c').decidedBy, ymd(by('c').nextDueAt), [...String(by('c').decisionReason)].length], ['FALLBACK', '2026-09-30', 200], '오래 쉰 항목은 지난 날짜 = 바로 due')
  assert.deepEqual([by('d').priority, by('d').intervalDays, ymd(by('d').nextDueAt), by('d').decisionReason], ['FOCUS', 3, '2026-10-05', REVIEW_FALLBACK_REASON_KO], '피드백 5회 → 강사가 NORMAL 이어도 FOCUS·근거 빈 값은 코드 문구')
  assert.ok(updates.every((u) => u.data.decidedAt === decidedAt))
  assert.equal(await applyReviewDecisions(U, { decisions: [], rationaleKo: '' }, tx, { today: '2026-10-02', decidedAt }), 0)
})

// ── A11 적재(claimDecisionJob) — 가짜 AiJob·스냅샷 ─────────────────────────────

interface FakeJob {
  id: string
  userId: string
  kind: string
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'
  refId: string | null
  payload: unknown
  createdAt: Date
  startedAt: Date | null
  progress: number
  stage: string | null
  error: string | null
  finishedAt: Date | null
}

function decisionWorld(opts: { studyDays: number; items: number; needing: number; jobs?: Partial<FakeJob>[] }) {
  const jobs: FakeJob[] = (opts.jobs ?? []).map((j, i) => ({
    id: `job${i}`,
    userId: U,
    kind: 'REVIEW_DECISION',
    status: 'QUEUED',
    refId: null,
    payload: null,
    createdAt: new Date(),
    startedAt: null,
    progress: 0,
    stage: null,
    error: null,
    finishedAt: null,
    ...j,
  }))
  let n = jobs.length
  const snaps = Array.from({ length: opts.studyDays }, (_, i) => ({ periodKey: `2026-09-${String(20 + i).padStart(2, '0')}`, data: { lessons: 1 } }))
  const match = (j: FakeJob, w: Record<string, unknown>) =>
    (w.userId === undefined || j.userId === w.userId) &&
    (w.kind === undefined || j.kind === w.kind) &&
    (w.status === undefined || (typeof w.status === 'string' ? j.status === w.status : (w.status as { in: string[] }).in.includes(j.status))) &&
    (w.createdAt === undefined || j.createdAt >= (w.createdAt as { gte: Date }).gte) &&
    (w.id === undefined || (typeof w.id === 'string' ? j.id === w.id : (w.id as { in: string[] }).in.includes(j.id)))
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      if (strings.join('?').includes('COUNT(*)')) return [{ n: BigInt(opts.needing) }]
      return []
    },
    statsSnapshot: { findMany: async () => snaps },
    repetitionItem: { count: async () => opts.items },
    aiJob: {
      findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: { createdAt: 'asc' | 'desc' } }) => {
        const list = jobs.filter((j) => match(j, where)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        return (orderBy?.createdAt === 'desc' ? list.reverse() : list)[0] ?? null
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => jobs.filter((j) => match(j, where)),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<FakeJob> }) => {
        const hit = jobs.filter((j) => match(j, where))
        for (const j of hit) Object.assign(j, data)
        return { count: hit.length }
      },
      create: async ({ data }: { data: Partial<FakeJob> }) => {
        const j = { ...data, id: `job${n++}`, createdAt: new Date(), startedAt: null, progress: 0, stage: null, error: null, finishedAt: null } as FakeJob
        jobs.push(j)
        return { id: j.id }
      },
    },
  } as unknown as Tx
  return { tx, jobs }
}

const TODAY = '2026-10-02'
const meta = (j: FakeJob) => (j.payload as { inputMeta: { trigger: string; triggers: string[]; lessons: { id: string; itemIds: string[] }[] } }).inputMeta

test('A11 적재: 최소 기록 가드에 걸리면 잡 없음(null)', async () => {
  const w = decisionWorld({ studyDays: 1, items: 9, needing: 5 })
  assert.equal(await claimDecisionJob(w.tx, U, { trigger: 'LESSON', lesson: { id: 'l1', itemIds: ['a'] } }, 'reviewDecision@v1', TODAY), null)
  const w2 = decisionWorld({ studyDays: 3, items: 1, needing: 5 })
  assert.equal(await claimDecisionJob(w2.tx, U, { trigger: 'DAILY' }, 'reviewDecision@v1', TODAY), null)
  assert.equal(w.jobs.length + w2.jobs.length, 0)
})

test('A11 적재(DAILY): 하루 첫 진입만 새 잡, 같은 날 진행 중이면 그 잡(실행 안 깨움), 이미 끝났으면 null — 같은 날 두 번 판단 안 함', async () => {
  const w = decisionWorld({ studyDays: 2, items: 4, needing: 3 })
  const first = await claimDecisionJob(w.tx, U, { trigger: 'DAILY' }, 'reviewDecision@v1', TODAY)
  assert.deepEqual([first?.merged, first?.run, w.jobs.length], [false, true, 1])
  assert.deepEqual(meta(w.jobs[0]), { trigger: 'DAILY', triggers: ['DAILY'], lessons: [] })
  const again = await claimDecisionJob(w.tx, U, { trigger: 'DAILY' }, 'reviewDecision@v1', TODAY)
  assert.deepEqual([again?.jobId, again?.merged, again?.run, w.jobs.length], [first?.jobId, true, false, 1])
  w.jobs[0].status = 'DONE'
  assert.equal(await claimDecisionJob(w.tx, U, { trigger: 'DAILY' }, 'reviewDecision@v1', TODAY), null)
  const none = decisionWorld({ studyDays: 2, items: 4, needing: 0 })
  assert.equal(await claimDecisionJob(none.tx, U, { trigger: 'DAILY' }, 'reviewDecision@v1', TODAY), null, '판단할 항목 없음')
})

/** #58 판단 경로 가짜 deps — 진행 중 잡·오늘 잡을 정하고 킥·DAILY 적재 호출을 센다. */
function decisionPath(active: { id: string; status: 'QUEUED' | 'RUNNING' } | null, todayJob: { id: string; status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' } | null = null) {
  const kicks: string[] = []
  const scheduled: string[] = []
  const deps: DecisionPathDeps = {
    activeDecisionJob: async () => active,
    decisionJobToday: async () => todayJob,
    scheduleReviewDecision: async (userId, input) => {
      scheduled.push(`${userId}:${input.trigger}`)
      return { jobId: 'jobNew', merged: false }
    },
    kickDecisionQueue: (userId) => {
      kicks.push(userId)
    },
  }
  return { deps, kicks, scheduled }
}
const PATH_DRIVER = { promptVersion: 'reviewDecision@v1', build: async () => ({ request: {} as never, keptItemIds: [] }), finalize: () => ({ decisions: [], rationaleKo: '' }) } as ReviewDecisionDriver<unknown>

test('#58 판단 경로(REV-064-F1): 진행 중 잡이 대기(QUEUED)면 실행 줄을 다시 깨운다(고아 구제) — 세션이 있어도, 새 DAILY 는 안 건다', async () => {
  for (const hasSchedule of [false, true]) {
    const p = decisionPath({ id: 'jobQ', status: 'QUEUED' }, { id: 'jobQ', status: 'QUEUED' })
    const job = await resolveDecisionJob(U, hasSchedule, PATH_DRIVER, TODAY, p.deps)
    assert.deepEqual(job, { id: 'jobQ', status: 'QUEUED' })
    assert.deepEqual(p.kicks, [U], `hasSchedule=${hasSchedule}`)
    assert.deepEqual(p.scheduled, [])
  }
  const noDriver = decisionPath({ id: 'jobQ', status: 'QUEUED' })
  assert.deepEqual(await resolveDecisionJob(U, false, null, TODAY, noDriver.deps), { id: 'jobQ', status: 'QUEUED' })
  assert.deepEqual(noDriver.kicks, [], 'driver 없으면 깨울 수 없다(잡은 그대로 돌려줌)')
})

test('#58 판단 경로(REV-064-F1): 실행 중(RUNNING) 잡은 깨우지 않는다 — 5분 stale 뒤 폴백', async () => {
  const p = decisionPath({ id: 'jobR', status: 'RUNNING' }, { id: 'jobR', status: 'RUNNING' })
  assert.deepEqual(await resolveDecisionJob(U, false, PATH_DRIVER, TODAY, p.deps), { id: 'jobR', status: 'RUNNING' })
  assert.deepEqual([p.kicks, p.scheduled], [[], []])
})

test('#58 판단 경로(REV-064-F1): 진행 중 잡 없음 — 오늘 잡이 DONE·FAILED 면 깨우지도 새로 걸지도 않고(하루 한 번), 없으면 DAILY 적재만', async () => {
  for (const status of ['DONE', 'FAILED'] as const) {
    const p = decisionPath(null, { id: 'jobT', status })
    assert.equal(await resolveDecisionJob(U, false, PATH_DRIVER, TODAY, p.deps), null)
    assert.deepEqual([p.kicks, p.scheduled], [[], []], status)
  }
  const fresh = decisionPath(null, null)
  assert.deepEqual(await resolveDecisionJob(U, false, PATH_DRIVER, TODAY, fresh.deps), { id: 'jobNew', status: 'QUEUED' })
  assert.deepEqual([fresh.kicks, fresh.scheduled], [[], [`${U}:DAILY`]], '새 잡의 실행은 scheduleReviewDecision 이 깨운다(고아 킥 아님)')
  const withSchedule = decisionPath(null, null)
  assert.equal(await resolveDecisionJob(U, true, PATH_DRIVER, TODAY, withSchedule.deps), null)
  const noDriver = decisionPath(null, null)
  assert.equal(await resolveDecisionJob(U, false, null, TODAY, noDriver.deps), null)
  assert.deepEqual([withSchedule.kicks, withSchedule.scheduled, noDriver.kicks, noDriver.scheduled], [[], [], [], []])
})

test('A11 적재(완료 뒤): 대기 중 잡에 합치기(레슨 id·트리거 추가), 실행 중이면 새 잡, 오래된 대기 잡은 버리고 새 잡', async () => {
  const w = decisionWorld({ studyDays: 2, items: 4, needing: 2, jobs: [{ status: 'QUEUED', payload: { promptKey: 'reviewDecision', promptVersion: 'v', inputMeta: { trigger: 'DAILY', triggers: ['DAILY'], lessons: [] } } }] })
  const r = await claimDecisionJob(w.tx, U, { trigger: 'LESSON', lesson: { id: 'l1', itemIds: ['a', 'b'] } }, 'reviewDecision@v1', TODAY)
  assert.deepEqual([r?.jobId, r?.merged, r?.run, w.jobs.length], ['job0', true, true, 1])
  assert.deepEqual(meta(w.jobs[0]), { trigger: 'DAILY', triggers: ['DAILY', 'LESSON'], lessons: [{ id: 'l1', itemIds: ['a', 'b'] }] })
  await claimDecisionJob(w.tx, U, { trigger: 'LESSON', lesson: { id: 'l1', itemIds: ['a', 'b'] } }, 'reviewDecision@v1', TODAY)
  assert.equal(meta(w.jobs[0]).lessons.length, 1, '같은 레슨은 한 번만')

  const running = decisionWorld({ studyDays: 2, items: 4, needing: 2, jobs: [{ status: 'RUNNING', startedAt: new Date() }] })
  const r2 = await claimDecisionJob(running.tx, U, { trigger: 'WORDS' }, 'reviewDecision@v1', TODAY)
  assert.deepEqual([r2?.merged, running.jobs.length, running.jobs[1].status, running.jobs[1].refId], [false, 2, 'QUEUED', null])

  const stale = decisionWorld({ studyDays: 2, items: 4, needing: 2, jobs: [{ status: 'QUEUED', createdAt: new Date(Date.now() - 60 * 60_000) }] })
  const r3 = await claimDecisionJob(stale.tx, U, { trigger: 'REVIEW', lesson: { id: 'l9', itemIds: [] } }, 'reviewDecision@v1', TODAY)
  assert.deepEqual([r3?.merged, stale.jobs.length, stale.jobs[1].refId], [false, 2, 'l9'])
})

// ── 오늘 세션(ensureTodaySchedule) ───────────────────────────────────────────

function scheduleWorld(opts: { existing?: boolean; due: number; upcoming?: number; recent?: string[][] }) {
  const created: Record<string, unknown>[] = []
  const due = Array.from({ length: opts.due }, (_, i) => ({ id: `d${i}`, studiedCount: i % 3, priority: i === 0 ? 'FOCUS' : 'NORMAL', nextDueAt: new Date('2026-10-01T00:00:00Z') }))
  const upcoming = Array.from({ length: opts.upcoming ?? 0 }, (_, i) => ({ id: `u${i}`, studiedCount: 0, priority: 'NORMAL', nextDueAt: new Date(Date.UTC(2026, 9, 3 + i)) }))
  const tx = {
    reviewSchedule: {
      findUnique: async () => (opts.existing ? { id: 'rsOld' } : null),
      findMany: async () => (opts.recent ?? []).map((itemIds) => ({ itemIds })),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data)
        return { id: 'rsNew' }
      },
    },
    repetitionItem: {
      findMany: async ({ where }: { where: { nextDueAt: { lte?: Date; gt?: Date } } }) => (where.nextDueAt.lte ? due : upcoming),
    },
  } as unknown as Tx
  return { tx, created }
}

test('오늘 세션: 이미 있으면 그대로(다시 뽑지 않음), due 없으면 null, 있으면 시드 저장·크기·근거(빈 값이면 코드 문구·≤300)', async () => {
  const kept = scheduleWorld({ existing: true, due: 9 })
  assert.deepEqual(await ensureTodaySchedule(U, TODAY, kept.tx, { decidedBy: 'TUTOR', rationaleKo: 'x' }, { dailyMinutes: 15 }), { id: 'rsOld', created: false })
  assert.equal(kept.created.length, 0)
  const empty = scheduleWorld({ due: 0, upcoming: 5 })
  assert.equal(await ensureTodaySchedule(U, TODAY, empty.tx, { decidedBy: 'TUTOR', rationaleKo: 'x' }, { dailyMinutes: 15 }), null, 'due 없으면 미래 항목만으로는 만들지 않는다')

  const w = scheduleWorld({ due: 12, recent: [['d1', 'd2']] })
  assert.deepEqual(await ensureTodaySchedule(U, TODAY, w.tx, { decidedBy: 'TUTOR', rationaleKo: '「を」를 자주 틀려서 먼저 골랐어요.'.repeat(30) }, { dailyMinutes: 15, seed: 'abc' }), { id: 'rsNew', created: true })
  const c = w.created[0]
  assert.equal((c.itemIds as string[]).length, 8)
  assert.deepEqual([c.seed, c.status, c.decidedBy, c.userId, ymd(c.dueDate)], ['abc', 'DUE', 'TUTOR', U, TODAY])
  assert.equal([...String(c.tutorRationale)].length, 300)
  const again = scheduleWorld({ due: 12, recent: [['d1', 'd2']] })
  await ensureTodaySchedule(U, TODAY, again.tx, { decidedBy: 'TUTOR', rationaleKo: null }, { dailyMinutes: 15, seed: 'abc' })
  assert.deepEqual(again.created[0].itemIds, c.itemIds, '같은 시드 → 같은 추출(재현)')
  assert.equal(again.created[0].tutorRationale, REVIEW_FALLBACK_RATIONALE_KO)

  const small = scheduleWorld({ due: 2, upcoming: 3 })
  await ensureTodaySchedule(U, TODAY, small.tx, { decidedBy: 'FALLBACK', rationaleKo: null }, { dailyMinutes: 15, seed: 's' })
  assert.equal((small.created[0].itemIds as string[]).length, 4, 'due 2 + 가까운 예정 2 → A5 최소 4')
})

test('복습 레슨 완료 → 세션 DONE(건너뛴 세션도), 이미 DONE 이면 그대로, 연결 없으면 null', async () => {
  const calls: unknown[] = []
  const mk = (row: unknown) =>
    ({
      reviewSchedule: {
        findFirst: async () => row,
        updateMany: async (a: unknown) => {
          calls.push(a)
          return { count: 1 }
        },
      },
    }) as unknown as Tx
  const now = new Date('2026-10-02T05:00:00Z')
  assert.deepEqual(await completeScheduleForLesson(U, 'l1', mk({ id: 'rs1', itemIds: ['a', 'b', 3], status: 'SKIPPED' }), now), { id: 'rs1', itemIds: ['a', 'b'] })
  assert.deepEqual(calls[0], { where: { id: 'rs1', status: { not: 'DONE' } }, data: { status: 'DONE', resolvedAt: now } })
  await completeScheduleForLesson(U, 'l1', mk({ id: 'rs1', itemIds: [], status: 'DONE' }), now)
  assert.equal(calls.length, 1)
  assert.equal(await completeScheduleForLesson(U, 'l1', mk(null), now), null)
})

test('#58 미리보기: FOCUS 먼저(세션 순서 유지)·없는 id 제외', () => {
  const rows = [
    { id: 'a', priority: 'NORMAL' as const },
    { id: 'b', priority: 'FOCUS' as const },
    { id: 'c', priority: 'NORMAL' as const },
    { id: 'd', priority: 'FOCUS' as const },
  ]
  assert.deepEqual(orderPreview(['c', 'b', 'x', 'a', 'd'], rows).map((r) => r.id), ['b', 'd', 'c', 'a'])
})

// ── #64 건너뛰기(★⑦) ─────────────────────────────────────────────────────────

function skipWorld(row: { id: string; userId: string; status: string; lessonStatus?: string } | null) {
  const writes: unknown[] = []
  const tx = {
    reviewSchedule: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
        row && row.id === where.id && row.userId === where.userId ? { id: row.id, status: row.status, lesson: row.lessonStatus ? { status: row.lessonStatus } : null } : null,
      updateMany: async (a: { where: { status: string } }) => {
        writes.push(a)
        return { count: row && row.status === a.where.status ? 1 : 0 }
      },
    },
  } as unknown as Tx
  return { tx, writes }
}

test('#64: DUE 만(레슨 없음·FAILED·READY·GENERATING 허용), 하던 복습(IN_PROGRESS) 409, 이미 처리 409 NOT_DUE, 타인·없음·잘못된 id 404', async () => {
  const now = new Date('2026-10-02T05:00:00Z')
  for (const lessonStatus of [undefined, 'FAILED', 'READY', 'GENERATING']) {
    const w = skipWorld({ id: 'rs1', userId: U, status: 'DUE', lessonStatus })
    assert.deepEqual(await skipReviewIn(w.tx, U, 'rs1', now), { id: 'rs1', status: 'SKIPPED', resolvedAt: now.toISOString() })
    assert.deepEqual(w.writes[0], { where: { id: 'rs1', userId: U, status: 'DUE' }, data: { status: 'SKIPPED', resolvedAt: now } })
  }
  const busy = skipWorld({ id: 'rs1', userId: U, status: 'DUE', lessonStatus: 'IN_PROGRESS' })
  await assert.rejects(skipReviewIn(busy.tx, U, 'rs1', now), code('CONFLICT', 'IN_PROGRESS'))
  assert.equal(busy.writes.length, 0)
  for (const status of ['SKIPPED', 'DONE', 'EXPIRED']) await assert.rejects(skipReviewIn(skipWorld({ id: 'rs1', userId: U, status }).tx, U, 'rs1', now), code('CONFLICT', 'NOT_DUE'))
  await assert.rejects(skipReviewIn(skipWorld({ id: 'rs1', userId: OTHER, status: 'DUE' }).tx, U, 'rs1', now), code('NOT_FOUND'))
  await assert.rejects(skipReviewIn(skipWorld(null).tx, U, 'rs1', now), code('NOT_FOUND'))
  await assert.rejects(skipReviewIn(skipWorld(null).tx, U, '../x', now), code('NOT_FOUND'))
})

// ── #63 복습 시작(★③ 같은 행 되살리기) ─────────────────────────────────────────

function startWorld(opts: { schedule: { id: string; userId: string; status: string; lessonId: string | null } | null; lesson?: { id: string; status: string }; jobs?: Partial<FakeJob>[] }) {
  const lessons = opts.lesson ? [{ ...opts.lesson, userId: U } as Record<string, unknown>] : []
  const jobs: FakeJob[] = (opts.jobs ?? []).map((j, i) => ({ id: `gj${i}`, userId: U, kind: 'REVIEW_GEN', status: 'RUNNING', refId: null, payload: null, createdAt: new Date(), startedAt: new Date(), progress: 0, stage: null, error: null, finishedAt: null, ...j }))
  const log: string[] = []
  const s = opts.schedule ? { ...opts.schedule } : null
  const tx = {
    $queryRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => (s && s.id === values[0] && s.userId === values[1] ? [{ id: s.id }] : []),
    reviewSchedule: {
      findUniqueOrThrow: async () => ({ id: s!.id, status: s!.status, lessonId: s!.lessonId }),
      update: async ({ data }: { data: { lessonId: string } }) => {
        log.push(`schedule.link:${data.lessonId}`)
        s!.lessonId = data.lessonId
        return {}
      },
    },
    lesson: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => lessons.find((l) => l.id === where.id && l.userId === where.userId) ?? null,
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
        const l = lessons.find((x) => x.id === where.id && x.status === where.status)
        if (l) Object.assign(l, data)
        log.push(`lesson.updateMany:${String(data.status)}`)
        return { count: l ? 1 : 0 }
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(lessons.find((x) => x.id === where.id)!, data)
        log.push(`lesson.revive:${where.id}`)
        return {}
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        lessons.push({ ...data, id: 'lNew' })
        log.push('lesson.create')
        return { id: 'lNew' }
      },
    },
    aiJob: {
      findMany: async ({ where }: { where: { userId: string; kind: string; refId?: string } }) =>
        jobs.filter((j) => j.userId === where.userId && j.kind === where.kind && (where.refId === undefined || j.refId === where.refId) && (j.status === 'QUEUED' || j.status === 'RUNNING')),
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<FakeJob> }) => {
        for (const j of jobs) if (where.id.in.includes(j.id)) Object.assign(j, data)
        return { count: 1 }
      },
      create: async ({ data }: { data: Partial<FakeJob> }) => {
        const j = { ...data, id: `gj${jobs.length}` } as FakeJob
        jobs.push(j)
        log.push(`job.create:${String(data.refId)}`)
        return { id: j.id }
      },
    },
  } as unknown as Tx
  return { tx, lessons, jobs, log, schedule: s }
}

const MIX: ReviewMixMaterials = { scheduleId: 'rs1', todayKst: TODAY, level: 'N4', items: [] }
const GEN = { request: {} as LessonGeneration['request'], promptVersion: 'reviewMix@v2', inputMeta: { items: 6 } } satisfies LessonGeneration

test('#63 ★③: 연결 레슨이 FAILED 면 같은 행을 GENERATING 으로 되살리고 새 잡(세션 연결 그대로·새 행 없음)', async () => {
  const w = startWorld({ schedule: { id: 'rs1', userId: U, status: 'DUE', lessonId: 'l1' }, lesson: { id: 'l1', status: 'FAILED' } })
  const r = await claimReviewStart(w.tx, U, 'rs1', MIX, GEN, 'tr1')
  assert.deepEqual(r.result, { lessonId: 'l1', jobId: 'gj0', status: 'GENERATING', reused: false })
  assert.deepEqual(r.claim, { lessonId: 'l1', jobId: 'gj0', traceId: 'tr1' })
  assert.deepEqual(w.log, ['lesson.revive:l1', 'job.create:l1'])
  assert.deepEqual([w.lessons.length, w.lessons[0].status, w.lessons[0].error, w.lessons[0].stageDone, w.schedule!.lessonId], [1, 'GENERATING', null, 0, 'l1'])
  assert.equal(w.jobs[0].kind, 'REVIEW_GEN')
  assert.deepEqual((w.jobs[0].payload as { promptKey: string }).promptKey, 'reviewMix')
})

test('#63: 잡이 죽은 GENERATING 은 FAILED 로 닫고 같은 행 되살림 / 살아 있으면 그 잡 반환(새 잡 없음)', async () => {
  const dead = startWorld({ schedule: { id: 'rs1', userId: U, status: 'DUE', lessonId: 'l1' }, lesson: { id: 'l1', status: 'GENERATING' } })
  const r = await claimReviewStart(dead.tx, U, 'rs1', MIX, GEN, 't')
  assert.deepEqual(dead.log, ['lesson.updateMany:FAILED', 'lesson.revive:l1', 'job.create:l1'])
  assert.equal(r.result.reused, false)
  const live = startWorld({ schedule: { id: 'rs1', userId: U, status: 'DUE', lessonId: 'l1' }, lesson: { id: 'l1', status: 'GENERATING' }, jobs: [{ refId: 'l1' }] })
  const r2 = await claimReviewStart(live.tx, U, 'rs1', MIX, GEN, 't')
  assert.deepEqual([r2.result, r2.claim, live.log], [{ lessonId: 'l1', jobId: 'gj0', status: 'GENERATING', reused: true }, null, []])
})

test('#63: 준비됨·하는 중·끝남은 그 레슨(새 잡 없음), 연결 없으면 새 행+연결, 다른 복습 생성 중 409, DUE 아님 409, 타인 404', async () => {
  for (const status of ['READY', 'IN_PROGRESS', 'DONE']) {
    const w = startWorld({ schedule: { id: 'rs1', userId: U, status: 'DUE', lessonId: 'l1' }, lesson: { id: 'l1', status } })
    const r = await claimReviewStart(w.tx, U, 'rs1', MIX, GEN, 't')
    assert.deepEqual([r.result, r.claim, w.log], [{ lessonId: 'l1', jobId: null, status, reused: true }, null, []])
  }
  const fresh = startWorld({ schedule: { id: 'rs1', userId: U, status: 'DUE', lessonId: null } })
  const r = await claimReviewStart(fresh.tx, U, 'rs1', MIX, GEN, 't')
  assert.deepEqual(fresh.log, ['lesson.create', 'schedule.link:lNew', 'job.create:lNew'])
  assert.deepEqual([r.result.lessonId, fresh.lessons[0].kind, fresh.lessons[0].topicId, fresh.lessons[0].status, ymd(fresh.lessons[0].date)], ['lNew', 'REVIEW', null, 'GENERATING', TODAY])
  const busy = startWorld({ schedule: { id: 'rs1', userId: U, status: 'DUE', lessonId: null }, jobs: [{ refId: 'lOther' }] })
  await assert.rejects(claimReviewStart(busy.tx, U, 'rs1', MIX, GEN, 't'), code('CONFLICT', 'GENERATING'))
  assert.deepEqual(busy.log, [])
  for (const status of ['DONE', 'SKIPPED', 'EXPIRED']) await assert.rejects(claimReviewStart(startWorld({ schedule: { id: 'rs1', userId: U, status, lessonId: null } }).tx, U, 'rs1', MIX, GEN, 't'), code('CONFLICT', 'NOT_DUE'))
  await assert.rejects(claimReviewStart(startWorld({ schedule: { id: 'rs1', userId: OTHER, status: 'DUE', lessonId: null } }).tx, U, 'rs1', MIX, GEN, 't'), code('NOT_FOUND'))
})

// ── 관측(LearningObservation) ───────────────────────────────────────────────

test('관측 행: kind 기본 축·축 없는 kind 는 오류·신뢰도 0~1·지연 반올림·refId 40자·meta 1KB 넘으면 버림(관측은 남김)', () => {
  const r = observationRow(U, { kind: 'VOCAB_RECOGNITION', outcome: 'SUCCESS', refType: 'VocabAttempt', refId: 'x'.repeat(50), confidence: 1.7, latencyMs: 1234.6, meta: { mode: 'CHOICE' } })
  assert.deepEqual([r.skill, r.confidence, r.latencyMs, (r.refId as string).length, r.meta], ['VOCAB_RECALL', 1, 1235, 40, { mode: 'CHOICE' }])
  assert.throws(() => observationRow(U, { kind: 'CORRECTION_ACCEPTED', outcome: 'SUCCESS', refType: 'Correction', refId: 'c' }), /능력 축/)
  const big = observationRow(U, { kind: 'GRAMMAR_USE', outcome: 'FAIL', refType: 'Lesson', refId: 'l', confidence: -1, latencyMs: -5, meta: { s: 'x'.repeat(OBSERVATION_META_MAX) } })
  assert.deepEqual([big.confidence, big.latencyMs, 'meta' in big], [0, null, false])
})

test('교정 관측: 제안 MAJOR=FAIL·MINOR=PARTIAL, 축은 오류 유형(조사·활용·문법→문법, 어휘→어휘, 그 밖→문장), 입력 경로는 meta 만', () => {
  assert.deepEqual(['PARTICLE', 'CONJUGATION', 'GRAMMAR', 'VOCABULARY', 'POLITENESS', 'NATURALNESS', 'PRONUNCIATION'].map(correctionSkill), [
    'GRAMMAR_PARTICLE',
    'GRAMMAR_PARTICLE',
    'GRAMMAR_PARTICLE',
    'VOCAB_RECALL',
    'SENTENCE_PRODUCTION',
    'SENTENCE_PRODUCTION',
    'LISTEN_RESPOND',
  ])
  const major = correctionProposedObservation({ id: 'c1', errorType: 'PARTICLE', severity: 'MAJOR', inputSource: 'REALTIME_STT' })
  assert.deepEqual([major.kind, major.outcome, major.skill, major.refType, major.refId, major.confidence, major.meta], ['CORRECTION_PROPOSED', 'FAIL', 'GRAMMAR_PARTICLE', 'Correction', 'c1', 1, { errorType: 'PARTICLE', severity: 'MAJOR', input: 'VOICE' }])
  const minor = correctionProposedObservation({ id: 'c2', errorType: 'VOCABULARY', severity: 'MINOR' })
  assert.deepEqual([minor.outcome, minor.skill, minor.meta], ['PARTIAL', 'VOCAB_RECALL', { errorType: 'VOCABULARY', severity: 'MINOR' }])
})

test('DAILY observations 증가분: 축별 결과 수·자기수정(고친 것만)·재사용(성공만), 병합은 증가만·없던 날은 칸을 만들지 않는다', () => {
  const delta = observationDailyDelta([
    { kind: 'VOCAB_RECOGNITION', outcome: 'SUCCESS', skill: 'VOCAB_RECALL' },
    { kind: 'VOCAB_RECOGNITION', outcome: 'FAIL', skill: 'VOCAB_RECALL' },
    { kind: 'SELF_CORRECTION', outcome: 'PARTIAL', skill: 'CONVERSATION_MAINTAIN' },
    { kind: 'EXPRESSION_REUSE', outcome: 'SUCCESS', skill: 'SENTENCE_PRODUCTION' },
    { kind: 'CORRECTION_REUSED', outcome: 'FAIL', skill: 'SENTENCE_PRODUCTION' },
  ])
  assert.deepEqual(delta, {
    total: 5,
    bySkill: {
      VOCAB_RECALL: { success: 1, partial: 0, fail: 1, skipped: 0 },
      CONVERSATION_MAINTAIN: { success: 0, partial: 1, fail: 0, skipped: 0 },
      SENTENCE_PRODUCTION: { success: 1, partial: 0, fail: 1, skipped: 0 },
    },
    selfCorrections: 1,
    reuses: 1,
  })
  assert.equal('observations' in mergeDaily({ lessons: 1 }, { lessons: 1 }), false, '관측 없는 날 행 모양 불변')
  const once = mergeDaily({ lessons: 1, extra: 'keep' }, { observations: delta })
  const twice = mergeDaily(once, { observations: { total: 1, bySkill: { VOCAB_RECALL: { success: 1, fail: -3 } } } })
  assert.deepEqual(twice.observations, {
    total: 6,
    bySkill: {
      VOCAB_RECALL: { success: 2, partial: 0, fail: 1, skipped: 0 },
      CONVERSATION_MAINTAIN: { success: 0, partial: 1, fail: 0, skipped: 0 },
      SENTENCE_PRODUCTION: { success: 1, partial: 0, fail: 1, skipped: 0 },
    },
    selfCorrections: 1,
    reuses: 1,
  })
  assert.equal(twice.extra, 'keep')
})

// ── 쓰기 경로 + 트랜잭션 롤백(가짜 커밋 저장소) ───────────────────────────────────

interface Store {
  items: RepRow[]
  observations: Prisma.LearningObservationCreateManyInput[]
  daily: Map<string, unknown>
}

/** 가짜 트랜잭션: 저장소 사본에 쓰고, 콜백이 성공해야만 원본에 반영한다(실패하면 버림 — MariaDB 롤백 흉내). */
async function fakeTransaction<T>(store: Store, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const draft: Store = { items: store.items.map((r) => ({ ...r })), observations: [...store.observations], daily: new Map([...store.daily].map(([k, v]) => [k, structuredClone(v)])) }
  let n = draft.items.length
  const key = (userId: unknown, date: unknown) => `${String(userId)}|${String(date)}`
  const tx = {
    $executeRaw: async (strings: TemplateStringsArray, ...v: unknown[]) => {
      if (strings.join('?').includes('INSERT INTO StatsSnapshot') && !draft.daily.has(key(v[1], v[2]))) draft.daily.set(key(v[1], v[2]), JSON.parse(String(v[3])))
      return 1
    },
    $queryRaw: async (strings: TemplateStringsArray, ...v: unknown[]) => (strings.join('?').includes('FROM StatsSnapshot') ? [{ id: key(v[0], v[1]) }] : []),
    statsSnapshot: {
      findUnique: async ({ where }: { where: { id: string } }) => ({ data: draft.daily.get(where.id) }),
      update: async ({ where, data }: { where: { id: string }; data: { data: unknown } }) => {
        draft.daily.set(where.id, data.data)
        return {}
      },
    },
    learningObservation: {
      createMany: async ({ data }: { data: Prisma.LearningObservationCreateManyInput[] }) => {
        draft.observations.push(...data)
        return { count: data.length }
      },
    },
    repetitionItem: {
      findMany: async ({ where }: { where: { userId: string; OR: { refType: string; refId: string }[] } }) =>
        draft.items.filter((r) => r.userId === where.userId && where.OR.some((o) => o.refType === r.refType && o.refId === r.refId)),
      create: async ({ data }: { data: Omit<RepRow, 'id'> }) => {
        const row = { ...data, id: `rep${++n}` } as RepRow
        draft.items.push(row)
        return { id: row.id }
      },
      update: async ({ where, data }: { where: { id: string }; data: IncData }) => {
        applyData(draft.items.find((r) => r.id === where.id) as unknown as Record<string, unknown>, data)
        return {}
      },
    },
  } as unknown as Tx
  const out = await fn(tx)
  store.items = draft.items
  store.observations = draft.observations
  store.daily = draft.daily
  return out
}

const emptyStore = (): Store => ({ items: [], observations: [], daily: new Map() })
const dailyObs = (s: Store, date: string) => (s.daily.get(`${U}|${date}`) as { observations?: { total: number; bySkill: Record<string, Record<string, number>> } } | undefined)?.observations
// task-080: DAILY `skills`(성장 탭 공부결과 — 교정 채택·무시는 세지 않는다)
const dailySkills = (s: Store, date: string) => (s.daily.get(`${U}|${date}`) as { skills?: Record<string, Record<string, number>> } | undefined)?.skills

test('교정 채택(#35 조합): 같은 tx 에 반복 항목 EXPRESSION + CORRECTION_ACCEPTED + DAILY observations — 뒤에서 실패하면(409 단어 중복 등) 전부 0', async () => {
  const today = dates.todayKst()
  const accepted = { id: 'corr1', errorType: 'PARTICLE', severity: 'MAJOR', corrected: '友だちに会いました。', explanation: '「を」가 아니라 「に」를 써요. 만나다는 に.' }

  const failed = emptyStore()
  await assert.rejects(
    fakeTransaction(failed, async (tx) => {
      await registerAcceptedCorrection(U, accepted, tx)
      throw new ApiError('CONFLICT', '이미 단어장에 있어요.', { existingId: 'w1' })
    }),
    code('CONFLICT'),
  )
  assert.deepEqual([failed.items.length, failed.observations.length, failed.daily.size], [0, 0, 0], '롤백 → 항목·관측·DAILY 0')

  const ok = emptyStore()
  const item = await fakeTransaction(ok, (tx) => registerAcceptedCorrection(U, accepted, tx))
  assert.equal(item?.created, true)
  assert.equal(ok.items.length, 1)
  const it = ok.items[0]
  assert.deepEqual(
    [it.itemType, it.refType, it.refId, it.textJa, it.meaningKo, it.studiedCount, it.feedbackCount],
    ['EXPRESSION', 'Correction', createHash('sha1').update('友だちに会いました', 'utf8').digest('hex'), '友だちに会いました。', '「を」가 아니라 「に」를 써요.', 0, 1],
  )
  assert.deepEqual(ok.observations.map((o) => [o.kind, o.outcome, o.skill, o.refType, o.refId]), [['CORRECTION_ACCEPTED', 'SUCCESS', 'GRAMMAR_PARTICLE', 'Correction', 'corr1']])
  assert.deepEqual(dailyObs(ok, today)?.total, 1)
  assert.deepEqual(dailyObs(ok, today)?.bySkill.GRAMMAR_PARTICLE, { success: 1, partial: 0, fail: 0, skipped: 0 })
  assert.equal(dailySkills(ok, today), undefined, 'task-080: 교정 채택만 한 날은 skills 칸이 생기지 않는다(채택 ≠ 습득)')
})

test('교정 거절·제안 관측: IGNORED=SKIPPED 1행, 제안 여러 건은 한 번에 + DAILY 한 번 증가', async () => {
  const today = dates.todayKst()
  const s = emptyStore()
  await fakeTransaction(s, (tx) => recordCorrectionIgnored(U, { id: 'c9', errorType: 'VOCABULARY', severity: 'MINOR' }, tx))
  await fakeTransaction(s, (tx) =>
    recordCorrectionsProposed(
      U,
      [
        { id: 'c1', errorType: 'PARTICLE', severity: 'MAJOR' },
        { id: 'c2', errorType: 'NATURALNESS', severity: 'MINOR', inputSource: 'TEXT' },
      ],
      tx,
    ),
  )
  assert.deepEqual(s.observations.map((o) => [o.kind, o.outcome, o.refId]), [['CORRECTION_IGNORED', 'SKIPPED', 'c9'], ['CORRECTION_PROPOSED', 'FAIL', 'c1'], ['CORRECTION_PROPOSED', 'PARTIAL', 'c2']])
  assert.equal(dailyObs(s, today)?.total, 3)
  assert.deepEqual(dailySkills(s, today), {
    GRAMMAR_PARTICLE: { success: 0, partial: 0, fail: 1, skipped: 0, uncertain: 0, fromCorrection: 1 },
    SENTENCE_PRODUCTION: { success: 0, partial: 1, fail: 0, skipped: 0, uncertain: 0, fromCorrection: 1 },
  }, 'task-080: 제안 MAJOR=틀림·MINOR=일부, 거절(VOCABULARY)은 세지 않음')
  assert.equal(s.items.length, 0, '거절·제안은 반복 항목을 만들지 않는다')
  assert.equal(await fakeTransaction(s, (tx) => recordObservations(U, [], tx)), 0)
})

test('단어 세트(#51): 답한 카드만 WORD 항목(정오답), 카드마다 VOCAB_RECOGNITION(건너뜀 SKIPPED·지연 없음), DAILY 는 세트 날짜', async () => {
  const cards = [
    { id: 'va1', order: 0, wordId: 'w1', answer: 'CORRECT' as const, responseMs: 1500, surfaceSnap: '会う', meaningSnap: '만나다' },
    { id: 'va2', order: 1, wordId: 'w2', answer: 'WRONG' as const, responseMs: 4000, surfaceSnap: '話す', meaningSnap: '이야기하다' },
    { id: 'va3', order: 2, wordId: 'w3', answer: 'SKIPPED' as const, responseMs: 900, surfaceSnap: '見る', meaningSnap: '보다' },
    { id: 'va4', order: 3, wordId: null, answer: 'CORRECT' as const, responseMs: 800, surfaceSnap: '消えた', meaningSnap: '삭제됨' },
  ]
  assert.deepEqual(vocabRepetitionInputs(cards).map((i) => [i.itemType, i.refType, i.refId, i.textJa, i.correct, i.wrong]), [
    ['WORD', 'WordEntry', 'w1', '会う', 1, 0],
    ['WORD', 'WordEntry', 'w2', '話す', 0, 1],
  ])
  const obs = vocabObservations('CHOICE', cards)
  assert.deepEqual(obs.map((o) => [o.kind, o.outcome, o.refType, o.refId, o.wordId, o.latencyMs]), [
    ['VOCAB_RECOGNITION', 'SUCCESS', 'VocabAttempt', 'va1', 'w1', 1500],
    ['VOCAB_RECOGNITION', 'FAIL', 'VocabAttempt', 'va2', 'w2', 4000],
    ['VOCAB_RECOGNITION', 'SKIPPED', 'VocabAttempt', 'va3', 'w3', null],
    ['VOCAB_RECOGNITION', 'SUCCESS', 'VocabAttempt', 'va4', null, 800],
  ])
  const s = emptyStore()
  await fakeTransaction(s, async (tx) => {
    await registerRepetitionItems(U, vocabRepetitionInputs(cards), tx)
    await recordObservations(U, obs, tx, { date: '2026-09-30' })
  })
  assert.deepEqual(s.items.map((i) => [i.refId, i.studiedCount, i.correctCount, i.wrongCount]), [['w1', 1, 1, 0], ['w2', 1, 0, 1]])
  assert.deepEqual(dailyObs(s, '2026-09-30')?.bySkill.VOCAB_RECALL, { success: 2, partial: 0, fail: 1, skipped: 1 })
  assert.deepEqual(dailySkills(s, '2026-09-30'), { VOCAB_RECALL: { success: 2, partial: 0, fail: 1, skipped: 1, uncertain: 0, fromCorrection: 0 } }, 'task-080: 같은 호출·같은 세트 날짜로 skills 증가')
})

test('레슨 완료 관측: quiz 문항마다(문법 대상이면 GRAMMAR_USE), 말하기 과제마다 SENTENCE_PRODUCTION — 모두/일부/못 씀/판정 불가/안 함, 발화면 STT 신뢰도', () => {
  const content = {
    grammar: [{ id: 'g1', pattern: '〜に会う', explanationKo: '', exampleJa: '', exampleReading: '', exampleKo: '' }],
    quiz: [
      { id: 'q1', promptKo: '.', promptJa: null, choices: ['a', 'b', 'c', 'd'], answer: 0, targetIds: ['c1'], explanationKo: '.' },
      { id: 'q2', promptKo: '.', promptJa: null, choices: ['a', 'b', 'c', 'd'], answer: 0, targetIds: ['c1', 'g1'], explanationKo: '.' },
      { id: 'q3', promptKo: '.', promptJa: null, choices: ['a', 'b', 'c', 'd'], answer: 0, targetIds: ['c2'], explanationKo: '.' },
    ],
    speaking: [
      { id: 's1', promptKo: '.', targetIds: ['c1'], modelAnswerJa: '', modelReading: '', modelKo: '' },
      { id: 's2', promptKo: '.', targetIds: ['c1', 'c2'], modelAnswerJa: '', modelReading: '', modelKo: '' },
      { id: 's3', promptKo: '.', targetIds: ['c2'], modelAnswerJa: '', modelReading: '', modelKo: '' },
      { id: 's4', promptKo: '.', targetIds: [], modelAnswerJa: '', modelReading: '', modelKo: '' },
      { id: 's5', promptKo: '.', targetIds: ['c1'], modelAnswerJa: '', modelReading: '', modelKo: '' },
    ],
  }
  const spoken = [
    { itemId: 's1', matchedIds: ['c1'], missedIds: [], utteranceId: 'u1' },
    { itemId: 's2', matchedIds: ['c1'], missedIds: ['c2'], utteranceId: null },
    { itemId: 's3', matchedIds: [], missedIds: ['c2'], utteranceId: 'u3' },
    { itemId: 's4', matchedIds: [], missedIds: [], utteranceId: null },
  ]
  const out = lessonObservations('l1', content, ['CORRECT', 'WRONG', null], spoken, new Map([['u1', 0.5]]))
  assert.deepEqual(out.map((o) => [o.kind, o.outcome, o.confidence, o.refType, o.refId]), [
    ['VOCAB_RECOGNITION', 'SUCCESS', 1, 'Lesson', 'l1'],
    ['GRAMMAR_USE', 'FAIL', 1, 'Lesson', 'l1'],
    ['VOCAB_RECOGNITION', 'SKIPPED', 1, 'Lesson', 'l1'],
    ['SENTENCE_PRODUCTION', 'SUCCESS', 0.5, 'Lesson', 'l1'],
    ['SENTENCE_PRODUCTION', 'PARTIAL', 1, 'Lesson', 'l1'],
    ['SENTENCE_PRODUCTION', 'FAIL', 1, 'Lesson', 'l1'],
    ['SENTENCE_PRODUCTION', 'PARTIAL', 1, 'Lesson', 'l1'],
    ['SENTENCE_PRODUCTION', 'SKIPPED', 1, 'Lesson', 'l1'],
  ])
  assert.equal(out[6].meta?.unjudged, true)
  assert.equal(out[5].confidence, 1, '신뢰도를 모르는 발화는 1.0')
  assert.ok(out.every((o) => !JSON.stringify(o.meta).includes('会')), '원문 없음')
  const tally = quizTargetTally(content.quiz, ['CORRECT', 'WRONG', null])
  assert.deepEqual([...tally.entries()], [['c1', { correct: 1, wrong: 1 }], ['g1', { correct: 0, wrong: 1 }]])
})

// ── #60 progress 서버 칸 숨김 ───────────────────────────────────────────────────

test('#60: 강사 판단 저장 칸(progress.reviewDecision)은 응답 progress 에 싣지 않는다(nextReview 로만)', () => {
  const now = new Date('2026-10-02T00:00:00Z')
  const row = {
    id: 'l1', userId: U, topicId: null, date: new Date('2026-10-02T00:00:00Z'), kind: 'REVIEW', title: '오늘의 복습', level: 'N4', content: null, status: 'DONE', stageDone: 5,
    progress: { quiz: { answers: [0] }, reviewDecision: { jobId: 'j', decidedBy: 'TUTOR', rationaleKo: '.', decidedAt: '', groups: [] } },
    score: 80, sourceLessonIds: null, sourceText: null, error: null, createdAt: now, updatedAt: now, completedAt: now, topic: null, reviewSchedule: { id: 'rs1', itemIds: ['a'] },
  } as unknown as LessonRow
  const dto = toLessonDto(row)
  assert.deepEqual(dto.progress, { quiz: { answers: [0] } })
  assert.equal(dto.reviewScheduleId, 'rs1')
})

// ── REV-061 L-9: 서버 전용 칸 #61 쓰기 차단 ─────────────────────────────────────

test('L-9 #61: 서버 전용 칸 reviewDecision 은 클라이언트가 쓸 수 없다(400 unknown_key)', () => {
  const lim = { segmentCount: 3, quizCount: 5, applicationCount: 3 }
  const forged = { reviewDecision: { jobId: 'j', decidedBy: 'TUTOR', rationaleKo: '위조', decidedAt: '2026-10-02T00:00:00Z', groups: [{ days: 7, date: '2026-10-09', itemIds: ['a'] }] } }
  assert.throws(() => parseProgressPatch(forged, lim), code('VALIDATION', 'unknown_key'))
  assert.throws(() => parseProgressPatch({ quiz: { answers: [0] }, ...forged }, lim), code('VALIDATION', 'unknown_key'), '정상 칸과 섞여 있어도 거부')
})

// ── REV-061 M-1: A11 러너(runReviewDecisionJob) — 펜싱·같은 tx FALLBACK·롤백·잠금 순서 ──────────────

interface RunnerItem {
  id: string
  userId: string
  lastStudiedAt: Date | null
  feedbackCount: number
  studiedCount: number
  intervalDays: number
  priority: 'NORMAL' | 'FOCUS'
  nextDueAt: Date | null
  decidedBy: 'TUTOR' | 'FALLBACK'
  decisionReason: string | null
  decidedAt: Date | null
}
interface RunnerStore {
  items: RunnerItem[]
  schedules: Record<string, unknown>[]
  lessons: { id: string; userId: string; status: string; progress: Record<string, unknown>; completedAt: Date }[]
  job: { id: string; status: string; stage: string | null; error: string | null }
}

const R_JOB = 'cjob0000000000000000000001'
const R_TODAY = dates.todayKst()
const R_STUDIED = new Date(Date.now() - 8 * 86_400_000)

function runnerStore(jobStatus = 'RUNNING', jobError: string | null = null): RunnerStore {
  const item = (id: string, intervalDays: number, priority: 'NORMAL' | 'FOCUS', feedbackCount = 0): RunnerItem => ({
    id, userId: U, lastStudiedAt: R_STUDIED, feedbackCount, studiedCount: 1, intervalDays, priority, nextDueAt: dbDay(dates.addDays(R_TODAY, -5)), decidedBy: 'FALLBACK', decisionReason: null, decidedAt: null,
  })
  return {
    items: [item('a', 6, 'NORMAL'), item('b', 5, 'NORMAL'), item('c', 3, 'FOCUS', 3)],
    schedules: [],
    lessons: [{ id: 'l1', userId: U, status: 'DONE', progress: { quiz: { answers: [0] } }, completedAt: new Date() }],
    job: { id: R_JOB, status: jobStatus, stage: 'LLM', error: jobError },
  }
}
const dbDay = (d: string) => new Date(`${d}T00:00:00Z`)

/**
 * 가짜 러너 세계 — 저장 트랜잭션은 저장소 사본에 쓰고 콜백이 끝까지 성공해야만 반영한다(MariaDB 롤백 흉내). tx 안 연산 순서를 `ops` 에 남긴다.
 * `beforeJobWrite` 는 잡 행 갱신 직전에 끼어드는 "잠금 밖 stale 정리"(다른 연결이 커밋한 값)를 흉내 낸다. `failCommit` 이면 커밋 직전에 실패한다.
 */
function runnerWorld(store: RunnerStore, opts: { llm: 'ok' | 'throw'; candidates?: boolean; beforeJobWrite?: (data: Record<string, unknown>, draft: RunnerStore) => void; failCommit?: boolean }) {
  const ops: string[] = []
  const calls = { transaction: 0, completeJson: 0, progress: 0 }
  const traces: { status: string; errorCode: string | null; steps: { name: string; [k: string]: unknown }[] }[] = []
  const inList = (v: unknown, x: string) => (v && typeof v === 'object' && 'in' in (v as object) ? ((v as { in: string[] }).in.includes(x)) : v === undefined || v === x)
  const deps: DecisionRunnerDeps = {
    readJob: async () => ({ payload: { promptKey: 'reviewDecision', inputMeta: { trigger: 'REVIEW', triggers: ['REVIEW'], lessons: [{ id: 'l1', itemIds: ['a', 'b', 'c'] }] } }, traceId: 'trace-1' }),
    loadMaterials: async (_userId, today) => ({
      todayKst: today,
      candidates: opts.candidates === false ? [] : store.items.map((i): ReviewDecisionCandidate => ({ itemId: i.id, itemType: 'EXPRESSION', textJa: '会う', meaningKo: '만나다', studiedCount: i.studiedCount, correctCount: 0, wrongCount: 1, feedbackCount: i.feedbackCount, lastStudiedAt: dates.todayKst(R_STUDIED), intervalDays: i.intervalDays, priority: i.priority })),
      observationSummary: [],
      errorStats: [],
    }),
    completeJson: (async () => {
      calls.completeJson++
      if (opts.llm === 'throw') {
        const e = new Error('시간 초과')
        e.name = 'LlmTimeoutError'
        throw e
      }
      return { data: { ok: true }, connectionKey: 'k', model: 'm', attempts: 1, promptChars: 10 }
    }) as unknown as DecisionRunnerDeps['completeJson'],
    dailyMinutes: async () => 15,
    updateJobProgress: async () => {
      calls.progress++
    },
    recordTrace: async (t) => {
      traces.push({ status: t.status, errorCode: t.errorCode ?? null, steps: t.steps as { name: string }[] })
    },
    transaction: async <R>(fn: (tx: Tx) => Promise<R>): Promise<R> => {
      calls.transaction++
      const draft: RunnerStore = structuredClone(store)
      const tx = {
        $queryRaw: async (strings: TemplateStringsArray, ...v: unknown[]) => {
          if (strings.join('?').includes('`User`')) {
            ops.push('lock')
            return [{ id: v[0] }]
          }
          return []
        },
        aiJob: {
          updateMany: async ({ where, data }: { where: { id: string; status: { in: string[] } }; data: Record<string, unknown> }) => {
            opts.beforeJobWrite?.(data, draft)
            const hit = draft.job.id === where.id && where.status.in.includes(draft.job.status)
            if (hit) Object.assign(draft.job, { ...(data.status ? { status: data.status } : {}), ...(data.stage ? { stage: data.stage } : {}), ...('error' in data ? { error: data.error } : {}) })
            ops.push(`job:${String(data.status ?? data.stage)}:${hit ? 1 : 0}`)
            return { count: hit ? 1 : 0 }
          },
        },
        repetitionItem: {
          findMany: async ({ where }: { where: { userId: string; id?: unknown; nextDueAt?: { lte?: Date; gt?: Date } } }) => {
            ops.push('items:read')
            return draft.items.filter(
              (i) => i.userId === where.userId && (where.id === undefined || inList(where.id, i.id)) &&
                (where.nextDueAt?.lte === undefined || (!!i.nextDueAt && i.nextDueAt <= where.nextDueAt.lte)) && (where.nextDueAt?.gt === undefined || (!!i.nextDueAt && i.nextDueAt > where.nextDueAt.gt)),
            )
          },
          update: async ({ where, data }: { where: { id: string }; data: Partial<RunnerItem> }) => {
            ops.push('items:update')
            Object.assign(draft.items.find((i) => i.id === where.id)!, data)
            return {}
          },
        },
        reviewSchedule: {
          findUnique: async () => null,
          findMany: async () => [],
          create: async ({ data }: { data: Record<string, unknown> }) => {
            ops.push('schedule:create')
            draft.schedules.push({ ...data, id: 'rs1' })
            return { id: 'rs1' }
          },
        },
        lesson: {
          findFirst: async ({ where }: { where: { id: string; userId: string; status: string } }) => draft.lessons.find((l) => l.id === where.id && l.userId === where.userId && l.status === where.status) ?? null,
          update: async ({ where, data }: { where: { id: string }; data: { progress: Record<string, unknown> } }) => {
            ops.push('lesson:update')
            draft.lessons.find((l) => l.id === where.id)!.progress = data.progress
            return {}
          },
        },
      } as unknown as Tx
      const out = await fn(tx)
      if (opts.failCommit) throw Object.assign(new Error('커밋 실패'), { name: 'CommitError' })
      Object.assign(store, draft)
      return out
    },
  }
  return { deps, ops, calls, traces }
}

const runnerDriver: ReviewDecisionDriver<{ ok: true }> = {
  promptVersion: 'reviewDecision@v1',
  build: async (m) => ({ request: {} as never, keptItemIds: m.candidates.map((c) => c.itemId) }),
  finalize: (kept) => ({ decisions: kept.map((c) => ({ itemId: c.itemId, intervalDays: 9, priority: c.priority, reasonKo: '강사 판단', byTutor: true })), rationaleKo: '「を」를 자주 틀려서 먼저 골랐어요.' }),
}
const unchanged = (before: RunnerStore, after: RunnerStore) => JSON.stringify({ i: before.items, s: before.schedules, l: before.lessons }) === JSON.stringify({ i: after.items, s: after.schedules, l: after.lessons })

test('M-1 ① A11 실패(LLM throw) → FALLBACK 저장과 잡 FAILED 가 같은 트랜잭션 하나(잠금 → 펜싱 → 저장 → FAILED)', async () => {
  const store = runnerStore()
  const w = runnerWorld(store, { llm: 'throw' })
  await runReviewDecisionJob(U, R_JOB, runnerDriver, w.deps)
  assert.equal(w.calls.completeJson, 1)
  assert.equal(w.calls.transaction, 1, '저장 트랜잭션은 한 번')
  assert.deepEqual(w.ops.slice(0, 2), ['lock', 'job:SAVE:1'], '사용자 행 잠금 → 잡 펜싱 순서')
  assert.equal(w.ops.at(-1), 'job:FAILED:1', '잡 FAILED 전이가 같은 tx 의 마지막 쓰기')
  assert.ok(!w.ops.some((o) => o.startsWith('job:DONE')), 'LLM 실패면 DONE 전이 없음')
  assert.deepEqual([store.job.status, store.job.error], ['FAILED', 'ENGINE_TIMEOUT'])
  assert.ok(store.items.every((i) => i.decidedBy === 'FALLBACK' && i.decisionReason === REVIEW_FALLBACK_REASON_KO && !!i.decidedAt))
  assert.deepEqual(store.items.map((i) => [i.id, i.intervalDays, i.priority]), [['a', 6, 'NORMAL'], ['b', 5, 'NORMAL'], ['c', 3, 'FOCUS']], '폴백 = 지난 간격(클램프)')
  assert.deepEqual([store.schedules.length, store.schedules[0]?.decidedBy, store.schedules[0]?.tutorRationale], [1, 'FALLBACK', REVIEW_FALLBACK_RATIONALE_KO])
  const stored = store.lessons[0].progress.reviewDecision as { decidedBy: string; jobId: string; groups: { itemIds: string[] }[] }
  assert.deepEqual([stored.decidedBy, stored.jobId, stored.groups.flatMap((g) => g.itemIds).sort().join()], ['FALLBACK', R_JOB, 'a,b,c'])
  assert.deepEqual([w.traces[0]?.status, w.traces[0]?.errorCode], ['ERROR', 'ENGINE_TIMEOUT'])
})

test('M-1 ①′ 같은 트랜잭션 증명: 커밋이 실패하면 FALLBACK 저장도 잡 FAILED 도 둘 다 없다(러너는 던진다)', async () => {
  const store = runnerStore()
  const before: RunnerStore = structuredClone(store)
  const w = runnerWorld(store, { llm: 'throw', failCommit: true })
  await assert.rejects(runReviewDecisionJob(U, R_JOB, runnerDriver, w.deps), /커밋 실패/)
  assert.equal(w.ops.at(-1), 'job:FAILED:1', 'FAILED 전이는 트랜잭션 안에서 시도됐다')
  assert.ok(unchanged(before, store), '항목·세션·레슨 변화 0')
  assert.deepEqual([store.job.status, store.job.error], ['RUNNING', null], '잡도 그대로(FAILED 는 같이 롤백)')
  assert.equal(w.traces[0]?.status, 'ERROR')
})

test('M-1 ② 펜싱: 잡이 이미 닫혔으면(markJobStage=false) 잠금 뒤 바로 멈추고 저장 0 — DecisionSuperseded 는 삼킨다', async () => {
  const store = runnerStore('FAILED', 'stale')
  const before: RunnerStore = structuredClone(store)
  const w = runnerWorld(store, { llm: 'ok' })
  await runReviewDecisionJob(U, R_JOB, runnerDriver, w.deps)
  assert.equal(w.calls.completeJson, 1, 'LLM 결과는 나왔지만 버린다')
  assert.deepEqual(w.ops, ['lock', 'job:SAVE:0'], '잠금 → 펜싱 실패 → 그 뒤 읽기·쓰기 없음')
  assert.ok(unchanged(before, store))
  assert.deepEqual([store.job.status, store.job.error], ['FAILED', 'stale'])
  assert.equal(w.traces[0]?.status, 'ERROR')
})

test('M-1 ③ completeJob=false(저장 직전 잠금 밖 stale 정리에 짐) → 트랜잭션 전체 롤백·결과 버림(삼킴)', async () => {
  const store = runnerStore()
  const before: RunnerStore = structuredClone(store)
  const w = runnerWorld(store, {
    llm: 'ok',
    beforeJobWrite: (data, draft) => {
      if (data.status === 'DONE') {
        draft.job.status = 'FAILED'
        draft.job.error = 'stale'
        store.job.status = 'FAILED'
        store.job.error = 'stale'
      }
    },
  })
  await runReviewDecisionJob(U, R_JOB, runnerDriver, w.deps)
  assert.deepEqual(w.ops.slice(0, 2), ['lock', 'job:SAVE:1'])
  assert.equal(w.ops.at(-1), 'job:DONE:0')
  assert.ok(w.ops.includes('items:update') && w.ops.includes('schedule:create'), '저장은 시도됐지만')
  assert.ok(unchanged(before, store), '롤백 → 항목·세션·레슨 변화 0')
  assert.deepEqual([store.job.status, store.job.error], ['FAILED', 'stale'])
})

test('M-1 ④ 정상: 강사 판단 → 항목 TUTOR(3~7·FOCUS ≤3)·세션 TUTOR·레슨 판단 기록·잡 DONE(같은 tx, 잠금 먼저)', async () => {
  const store = runnerStore()
  const w = runnerWorld(store, { llm: 'ok' })
  await runReviewDecisionJob(U, R_JOB, runnerDriver, w.deps)
  assert.equal(w.calls.transaction, 1)
  assert.deepEqual(w.ops.slice(0, 2), ['lock', 'job:SAVE:1'])
  assert.equal(w.ops.at(-1), 'job:DONE:1')
  assert.ok(!w.ops.some((o) => o.startsWith('job:FAILED')))
  assert.deepEqual([store.job.status, store.job.error], ['DONE', null])
  assert.deepEqual(store.items.map((i) => [i.id, i.intervalDays, i.priority, i.decidedBy]), [['a', 7, 'NORMAL', 'TUTOR'], ['b', 7, 'NORMAL', 'TUTOR'], ['c', 3, 'FOCUS', 'TUTOR']])
  assert.deepEqual([store.schedules[0]?.decidedBy, store.schedules[0]?.tutorRationale], ['TUTOR', '「を」를 자주 틀려서 먼저 골랐어요.'])
  assert.equal((store.lessons[0].progress.reviewDecision as { decidedBy: string }).decidedBy, 'TUTOR')
  assert.deepEqual((store.lessons[0].progress as { quiz: unknown }).quiz, { answers: [0] }, '기존 진행 칸 보존')
  assert.equal(w.traces[0]?.status, 'OK')
})

test('M-1 ⑤ 후보가 없으면 LLM 을 부르지 않고 같은 tx 로 잡 DONE(항목 0건·FALLBACK 근거) — REV-061 L-7 현행 동작 고정', async () => {
  const store = runnerStore()
  const w = runnerWorld(store, { llm: 'throw', candidates: false })
  await runReviewDecisionJob(U, R_JOB, runnerDriver, w.deps)
  assert.equal(w.calls.completeJson, 0)
  assert.equal(w.ops[0], 'lock')
  assert.ok(!w.ops.includes('items:update'))
  assert.deepEqual([store.job.status, w.ops.at(-1)], ['DONE', 'job:DONE:1'])
})

// ---- task-010b2 ★결정 3: 관측 신뢰도 가중(confidence < 0.6 → uncertain) ----
type ObsRow = { userId: string; skill: string; outcome: string; confidence: number; occurredAt: Date }
/** groupBy 가짜 — where(userId·occurredAt·outcome in·confidence gte/lt)를 그대로 평가해 쿼리 조건이 틀리면 집계가 어긋난다. */
function fakeObsGroupBy(rows: ObsRow[]) {
  const groupBy = async (args: { by: string[]; where: { userId: string; occurredAt: { gte: Date }; outcome: { in: string[] }; confidence: { gte?: number; lt?: number } } }) => {
    const w = args.where
    const hit = rows.filter(
      (r) => r.userId === w.userId && r.occurredAt >= w.occurredAt.gte && w.outcome.in.includes(r.outcome) && (w.confidence.gte === undefined || r.confidence >= w.confidence.gte) && (w.confidence.lt === undefined || r.confidence < w.confidence.lt),
    )
    const groups = new Map<string, Record<string, unknown>>()
    for (const r of hit) {
      const g = Object.fromEntries(args.by.map((k) => [k, (r as unknown as Record<string, unknown>)[k]]))
      const key = JSON.stringify(g)
      const cur = groups.get(key) ?? { ...g, _count: { _all: 0 } }
      ;(cur._count as { _all: number })._all++
      groups.set(key, cur)
    }
    return [...groups.values()]
  }
  return { groupBy } as unknown as Parameters<typeof summarizeRecentObservations>[3]
}

test('관측 신뢰도 가중: 0.59 → uncertain, 0.6(경계) → 집계 포함, 1.0 은 집계, 축별 success+fail+uncertain = SUCCESS·FAIL 관측 전부', async () => {
  assert.equal(OBSERVATION_CONFIDENCE_MIN, 0.6)
  const now = new Date('2026-10-03T00:00:00Z')
  const at = new Date('2026-10-01T00:00:00Z')
  const o = (skill: string, outcome: string, confidence: number, occurredAt = at, userId = U): ObsRow => ({ userId, skill, outcome, confidence, occurredAt })
  const rows: ObsRow[] = [
    o('VOCAB_RECALL', 'SUCCESS', 0.6),
    o('VOCAB_RECALL', 'FAIL', 0.59),
    o('VOCAB_RECALL', 'SUCCESS', 1),
    o('VOCAB_RECALL', 'SUCCESS', 0.5),
    o('LISTEN_RESPOND', 'FAIL', 0.1),
    o('GRAMMAR_PARTICLE', 'FAIL', 0.9),
    o('GRAMMAR_PARTICLE', 'PARTIAL', 0.2), // 세지 않는다(PARTIAL·SKIPPED)
    o('GRAMMAR_PARTICLE', 'SKIPPED', 0.2),
    o('VOCAB_RECALL', 'FAIL', 0.3, new Date('2026-09-01T00:00:00Z')), // 14일 밖
    o('VOCAB_RECALL', 'FAIL', 0.3, at, 'other'), // 다른 사용자
  ]
  const out = await summarizeRecentObservations(U, 14, now, fakeObsGroupBy(rows))
  assert.deepEqual(out, [
    { skill: 'GRAMMAR_PARTICLE', success: 0, fail: 1, uncertain: 0 },
    { skill: 'LISTEN_RESPOND', success: 0, fail: 0, uncertain: 1 },
    { skill: 'VOCAB_RECALL', success: 2, fail: 0, uncertain: 2 },
  ])
  const inWindow = rows.filter((r) => r.userId === U && r.occurredAt >= new Date(now.getTime() - 14 * 86_400_000) && (r.outcome === 'SUCCESS' || r.outcome === 'FAIL'))
  assert.equal(out.reduce((n, s) => n + s.success + s.fail + s.uncertain, 0), inWindow.length, '축별 합 = 전체 SUCCESS·FAIL 관측 수')
  assert.deepEqual(await summarizeRecentObservations(U, 14, now, fakeObsGroupBy([])), [])
})
