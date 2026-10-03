/**
 * A11 복습 판단 잡(REVIEW_DECISION, design-spec §7-4·§8 A11, learning-personalization §2-5, task-010b L2·L4·L5).
 *
 * 요청 빌더·후검증(`buildReviewDecisionRequest`·`normalizeReviewDecision`)은 L2 conversation 이라 learning 이 import 하지 않는다 —
 * 라우트가 `ReviewDecisionDriver`(함수 묶음)를 만들어 넘기고(module-dependency 판독 규칙 1, task-011 채점 잡과 같은 방식), 이 모듈은
 * 재료 읽기·잡 적재·실행·저장만 한다. LLM 은 `engine.llm` 만(learning → engine 허용).
 *
 * 언제(L4): 레슨·복습 레슨·단어 세트 완료 트랜잭션 **뒤** + #58 하루 첫 진입(그날 판단 잡이 하나도 없을 때만 — 같은 날 두 번 판단하지 않는다).
 *   최소 기록 가드(공부한 날 2·항목 2)에 걸리거나 판단할 항목(내일까지 예정·판단 전)이 없으면 잡을 만들지 않는다.
 * 합치기: 대기 중(QUEUED) 잡이 있으면 새로 만들지 않고 거기에 합친다(완료 레슨 id 를 payload 에 더함 — 조건부 갱신, 그 사이 시작됐으면 새 잡).
 *   실행은 프로세스 안에서 **사용자별 한 줄**(앞 잡이 끝나야 다음 잡) — 두 판단이 같은 항목을 동시에 쓰지 않게.
 * 실행: 후보(≤40, `orderCandidates`) + 최근 14일 관측 요약 + 오류 통계 top5 → driver.build → `llm.completeJson`(batch, 60s) →
 *   driver.finalize(= normalizeReviewDecision: 후보 1:1, 3~7·FOCUS≤3·id 폐기) → **한 트랜잭션**: 사용자 행 잠금 → 잡이 아직 내 것인지 →
 *   항목 갱신(간격·우선순위·nextDueAt = 마지막 학습일 + 간격·decidedBy·근거·decidedAt) → 오늘 due 가 있으면 오늘 세션 생성 →
 *   완료 레슨에 판단 결과 기록(#60 nextReview) → 잡 DONE. LLM 실패·타임아웃은 같은 트랜잭션을 **폴백**(기존 간격, decidedBy=FALLBACK,
 *   코드 근거 문구)으로 쓰고 잡은 FAILED(오류 코드만). 화면은 결과를 기다리지 않는다.
 * 잡 payload·Trace 에는 입력 메타(개수·id·트리거)만 — 프롬프트·항목 본문·LLM 근거는 넣지 않는다.
 */
import type { DecidedBy, JobStatus, Prisma, RepetitionItemType, RepetitionPriority, SkillAxis } from '@prisma/client'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type TraceStep } from '@/modules/engine'
import { classifyError, dates, jobs, lockUserRow, prisma, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { getErrorStats } from '../learningHistory'
import { summarizeRecentObservations } from '../observations'
import { countGuard, ensureTodaySchedule, kstDayStart, REVIEW_RATIONALE_MAX } from '../reviewSchedule/core'
import { clampInterval, priorityAfterFeedback } from './index'
import { groupNextReview, nextDueDate, orderCandidates, REVIEW_CANDIDATES_MAX, REVIEW_FALLBACK_RATIONALE_KO, reviewGuardOf, type NextReviewGroup } from './review'

/** 판단하지 못한 항목의 한 줄 근거(conversation `REVIEW_FALLBACK_REASON_KO` 와 같은 문구 — L3 는 L2 상수를 import 하지 않는다). */
export const REVIEW_FALLBACK_REASON_KO = '이번엔 판단하지 못해 기존 간격을 유지해요'
const DECISION_REASON_MAX = 200
/** 한 번의 잡 줄에서 연달아 처리할 최대 잡 수(무한 루프 방지). */
const CHAIN_MAX = 5
const LESSONS_PER_JOB_MAX = 10

export type ReviewDecisionTrigger = 'DAILY' | 'LESSON' | 'REVIEW' | 'WORDS'

export interface ReviewDecisionCandidate {
  itemId: string
  itemType: RepetitionItemType
  textJa: string
  meaningKo: string | null
  studiedCount: number
  correctCount: number
  wrongCount: number
  feedbackCount: number
  /** 마지막 학습 KST 날짜. */
  lastStudiedAt: string | null
  intervalDays: number
  priority: RepetitionPriority
}

export interface ReviewDecisionMaterials {
  todayKst: string
  candidates: ReviewDecisionCandidate[]
  observationSummary: { skill: SkillAxis; success: number; fail: number }[]
  errorStats: { type: string; count: number }[]
}

export interface ReviewDecisionPlanItem {
  itemId: string
  intervalDays: number
  priority: RepetitionPriority
  reasonKo: string
  /** 강사가 직접 판단했는가(false = 후검증이 채운 폴백). */
  byTutor: boolean
}

export interface ReviewDecisionPlan {
  decisions: ReviewDecisionPlanItem[]
  rationaleKo: string
  /** 로그용 보정 집계(clamped·discarded·fallback·sessionPlanPruned). */
  counts?: Record<string, number>
}

/** 라우트가 conversation 으로 만들어 넘기는 함수 묶음. */
export interface ReviewDecisionDriver<T = unknown> {
  promptVersion: string
  build(m: ReviewDecisionMaterials): Promise<{ request: LlmJsonRequest<T>; keptItemIds: string[] }>
  finalize(kept: ReviewDecisionCandidate[], data: T): ReviewDecisionPlan
}

interface LessonRef {
  id: string
  itemIds: string[]
}

interface DecisionPayload {
  promptKey: 'reviewDecision'
  promptVersion: string
  inputMeta: { trigger: ReviewDecisionTrigger; triggers: ReviewDecisionTrigger[]; lessons: LessonRef[] }
}

function readPayload(raw: unknown): DecisionPayload['inputMeta'] {
  const o = raw && typeof raw === 'object' ? ((raw as Record<string, unknown>).inputMeta as Record<string, unknown> | undefined) : undefined
  const lessons = Array.isArray(o?.lessons)
    ? (o.lessons as unknown[]).flatMap((l) => {
        const r = l as { id?: unknown; itemIds?: unknown }
        return typeof r?.id === 'string' ? [{ id: r.id, itemIds: Array.isArray(r.itemIds) ? r.itemIds.filter((x): x is string => typeof x === 'string') : [] }] : []
      })
    : []
  const trigger = (typeof o?.trigger === 'string' ? o.trigger : 'DAILY') as ReviewDecisionTrigger
  const triggers = Array.isArray(o?.triggers) ? (o.triggers as unknown[]).filter((t): t is ReviewDecisionTrigger => typeof t === 'string') : [trigger]
  return { trigger, triggers, lessons }
}

// ── 판단할 항목이 있는가 · 오늘 판단했는가 ─────────────────────────────────────

async function countNeedingDecision(userId: string, today: string, tx: Tx): Promise<number> {
  const soon = dates.toDbDate(dates.addDays(today, 1))
  const rows = await tx.$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(*) AS n FROM RepetitionItem
    WHERE userId = ${userId} AND (nextDueAt <= ${soon} OR decidedAt IS NULL OR lastStudiedAt > decidedAt)`
  return Number(rows[0]?.n ?? 0)
}

/** 오늘(KST) 만든 판단 잡(상태 무관) — "같은 날 두 번 판단하지 않는다"(L4). */
export async function decisionJobToday(userId: string, today: string, db: Tx | typeof prisma = prisma): Promise<{ id: string; status: JobStatus } | null> {
  return db.aiJob.findFirst({ where: { userId, kind: 'REVIEW_DECISION', createdAt: { gte: kstDayStart(today) } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true } })
}

/** 진행 중(QUEUED·RUNNING) 판단 잡 — 오래된 것은 정리하고 무시(infra jobs 규칙). */
export async function activeDecisionJob(userId: string, tx?: Tx): Promise<{ id: string; status: JobStatus } | null> {
  const j = await jobs.findActiveJobByKind({ userId, kind: 'REVIEW_DECISION' }, tx)
  return j ? { id: j.id, status: j.status } : null
}

// ── 적재 ───────────────────────────────────────────────────────────────────

export interface ScheduleDecisionInput {
  trigger: ReviewDecisionTrigger
  /** 완료한 레슨(새·복습) — 판단이 끝나면 그 레슨에 결과(#60 nextReview)를 남긴다. */
  lesson?: LessonRef | null
}

export interface ScheduledDecision {
  jobId: string
  /** 대기 중 잡에 합쳤다(새 잡 없음) · 이미 오늘 판단 진행 중(DAILY). */
  merged: boolean
}

/**
 * 판단 잡 적재(+ 프로세스 안 실행 예약). 가드·판단할 항목 없음·(DAILY) 오늘 이미 판단 → null. 짧은 자체 트랜잭션(사용자 행 잠금 —
 * 두 요청이 동시에 와도 잡 하나). 완료 트랜잭션이 **커밋된 뒤** 부른다.
 */
export async function scheduleReviewDecision<T>(userId: string, input: ScheduleDecisionInput, driver: ReviewDecisionDriver<T>): Promise<ScheduledDecision | null> {
  const today = dates.todayKst()
  const r = await withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    return claimDecisionJob(tx, userId, input, driver.promptVersion, today)
  })
  if (!r) return null
  if (r.run) kickDecisionChain(userId, driver)
  return { jobId: r.jobId, merged: r.merged }
}

export interface DecisionJobClaim extends ScheduledDecision {
  /** 실행 줄을 깨워야 하는가(DAILY 가 이미 진행 중인 잡을 돌려준 경우 false). */
  run: boolean
}

/**
 * 적재 판정·쓰기 본체(호출자 tx, 사용자 행 잠금 뒤 — 단위 테스트가 가짜 tx 로 부른다). 순서: 최소 기록 가드 → (DAILY) 오늘 이미 판단 잡이
 * 있으면 살아 있는 것만 돌려주고 끝 → 판단할 항목 없음 → 대기 중(QUEUED) 잡에 합치기(완료 레슨 id 추가, 조건부) → 새 잡.
 */
export async function claimDecisionJob(tx: Tx, userId: string, input: ScheduleDecisionInput, promptVersion: string, today: string): Promise<DecisionJobClaim | null> {
  const lesson = input.lesson ? { id: input.lesson.id, itemIds: input.lesson.itemIds.slice(0, 40) } : null
  if (reviewGuardOf(await countGuard(userId, tx))) return null
  if (input.trigger === 'DAILY') {
    const todayJob = await decisionJobToday(userId, today, tx)
    if (todayJob) {
      const live = await activeDecisionJob(userId, tx)
      return live ? { jobId: live.id, merged: true, run: false } : null
    }
  }
  if ((await countNeedingDecision(userId, today, tx)) === 0) return null
  const queued = await tx.aiJob.findFirst({ where: { userId, kind: 'REVIEW_DECISION', status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, status: true, createdAt: true, startedAt: true, payload: true } })
  if (queued && !jobs.isStaleJob(queued)) {
    const meta = readPayload(queued.payload)
    const lessons = lesson && !meta.lessons.some((l) => l.id === lesson.id) ? [...meta.lessons, lesson].slice(-LESSONS_PER_JOB_MAX) : meta.lessons
    const triggers = [...new Set([...meta.triggers, input.trigger])]
    const payload = { promptKey: 'reviewDecision', promptVersion, inputMeta: { trigger: meta.trigger, triggers, lessons } } satisfies DecisionPayload
    const upd = await tx.aiJob.updateMany({ where: { id: queued.id, status: 'QUEUED' }, data: { payload: payload as unknown as Prisma.InputJsonValue } })
    if (upd.count === 1) return { jobId: queued.id, merged: true, run: true }
  }
  const payload = { promptKey: 'reviewDecision', promptVersion, inputMeta: { trigger: input.trigger, triggers: [input.trigger], lessons: lesson ? [lesson] : [] } } satisfies DecisionPayload
  const job = await jobs.createJob({ userId, kind: 'REVIEW_DECISION', refId: lesson?.id ?? null, traceId: newTraceId(), payload: payload as unknown as Prisma.InputJsonValue }, tx)
  return { jobId: job.id, merged: false, run: true }
}

// ── 프로세스 안 실행 줄(사용자별 직렬) ─────────────────────────────────────────

declare global {
  var __kaiwaReviewDecisionChains: Map<string, Promise<void>> | undefined
}
const chains: Map<string, Promise<void>> = (globalThis.__kaiwaReviewDecisionChains ??= new Map())

function kickDecisionChain<T>(userId: string, driver: ReviewDecisionDriver<T>): void {
  const prev = chains.get(userId) ?? Promise.resolve()
  const next = prev
    .then(() => drainDecisions(userId, driver))
    .catch((e) => console.error('[reviewDecision] 실행 줄 오류:', e instanceof Error ? e.name : 'unknown'))
  chains.set(userId, next)
  void next.finally(() => {
    if (chains.get(userId) === next) chains.delete(userId)
  })
}

/** 테스트·스모크용 — 이 사용자의 실행 줄이 빌 때까지 기다린다. */
export async function waitDecisionChain(userId: string): Promise<void> {
  while (chains.get(userId)) await chains.get(userId)
}

async function drainDecisions<T>(userId: string, driver: ReviewDecisionDriver<T>): Promise<void> {
  for (let i = 0; i < CHAIN_MAX; i++) {
    const job = await prisma.aiJob.findFirst({ where: { userId, kind: 'REVIEW_DECISION', status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    if (!job) return
    const claimed = await prisma.aiJob.updateMany({ where: { id: job.id, status: 'QUEUED' }, data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } } })
    if (claimed.count !== 1) continue
    jobs.markLocalJob(job.id, true)
    try {
      await runReviewDecisionJob(userId, job.id, driver)
    } catch (e) {
      const c = classifyError(e)
      if (c.code === 'INTERNAL') console.error(`[reviewDecision] ${job.id} 실패:`, e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      await jobs.failJob(job.id, c.code)
    } finally {
      jobs.markLocalJob(job.id, false)
    }
  }
}

// ── 재료 ───────────────────────────────────────────────────────────────────

const CANDIDATE_SELECT = {
  id: true, itemType: true, textJa: true, meaningKo: true, studiedCount: true, correctCount: true, wrongCount: true, feedbackCount: true,
  lastStudiedAt: true, decidedAt: true, intervalDays: true, priority: true, nextDueAt: true,
} as const
type CandidateDbRow = Prisma.RepetitionItemGetPayload<{ select: typeof CANDIDATE_SELECT }>

/** A11 재료 — 후보 ≤40(우선순위 순) + 관측 요약 14일 + 오류 통계 top5. 원문 없음(항목 표기·뜻 스냅샷만). */
export async function loadReviewDecisionMaterials(userId: string, today: string): Promise<ReviewDecisionMaterials> {
  const soon = dates.toDbDate(dates.addDays(today, 1))
  const urgent = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM RepetitionItem
    WHERE userId = ${userId} AND (nextDueAt <= ${soon} OR decidedAt IS NULL OR lastStudiedAt > decidedAt)
    ORDER BY nextDueAt ASC, id ASC LIMIT 200`
  const focus = await prisma.repetitionItem.findMany({ where: { userId, priority: 'FOCUS' }, orderBy: [{ wrongCount: 'desc' }, { id: 'asc' }], take: REVIEW_CANDIDATES_MAX, select: { id: true } })
  const wrong = await prisma.repetitionItem.findMany({ where: { userId, wrongCount: { gt: 0 } }, orderBy: [{ wrongCount: 'desc' }, { id: 'asc' }], take: REVIEW_CANDIDATES_MAX, select: { id: true } })
  const ids = [...new Set([...urgent.map((r) => r.id), ...focus.map((r) => r.id), ...wrong.map((r) => r.id)])]
  const rows: CandidateDbRow[] = ids.length ? await prisma.repetitionItem.findMany({ where: { userId, id: { in: ids } }, select: CANDIDATE_SELECT }) : []
  const ordered = orderCandidates(
    rows.map((r) => ({ ...r, nextDueAt: r.nextDueAt ? dates.fromDbDate(r.nextDueAt) : null })),
    today,
  ).slice(0, REVIEW_CANDIDATES_MAX)
  const [observationSummary, errors] = await Promise.all([summarizeRecentObservations(userId, 14), getErrorStats(userId, 20)])
  const byType = new Map<string, number>()
  for (const e of errors) byType.set(e.type, (byType.get(e.type) ?? 0) + e.count)
  return {
    todayKst: today,
    candidates: ordered.map((r) => ({
      itemId: r.id,
      itemType: r.itemType,
      textJa: r.textJa,
      meaningKo: r.meaningKo,
      studiedCount: r.studiedCount,
      correctCount: r.correctCount,
      wrongCount: r.wrongCount,
      feedbackCount: r.feedbackCount,
      lastStudiedAt: r.lastStudiedAt ? dates.todayKst(r.lastStudiedAt) : null,
      intervalDays: r.intervalDays,
      priority: r.priority,
    })),
    observationSummary,
    errorStats: [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => ({ type, count })),
  }
}

/** 폴백 판단(L5 — 기존 간격 유지, 피드백 3회 이상은 FOCUS·≤3). */
export function fallbackPlan(candidates: readonly Pick<ReviewDecisionCandidate, 'itemId' | 'intervalDays' | 'priority' | 'feedbackCount'>[]): ReviewDecisionPlan {
  return {
    decisions: candidates.map((c) => {
      const priority = priorityAfterFeedback(c.priority, c.feedbackCount)
      return { itemId: c.itemId, intervalDays: clampInterval(c.intervalDays, priority), priority, reasonKo: REVIEW_FALLBACK_REASON_KO, byTutor: false }
    }),
    rationaleKo: REVIEW_FALLBACK_RATIONALE_KO,
  }
}

// ── 저장 ───────────────────────────────────────────────────────────────────

/**
 * 판단 결과를 항목에 쓴다(호출자 tx, 사용자 행 잠금 뒤). 간격·우선순위는 **다시 한 번** 코드 규칙으로 자른다: 3~7, 피드백 3회 이상 FOCUS
 * (강사가 NORMAL 로 내도 유지), FOCUS ≤3. nextDueAt = (잠금 아래에서 다시 읽은) 마지막 학습일 + 간격. `decidedAt` = 재료를 읽은 시각
 * (그 뒤 다시 공부한 항목은 다음 판단 대상으로 남는다). 반환 = 갱신한 항목 수.
 */
export async function applyReviewDecisions(userId: string, plan: ReviewDecisionPlan, tx: Tx, opts: { today: string; decidedAt: Date }): Promise<number> {
  if (!plan.decisions.length) return 0
  const fresh = await tx.repetitionItem.findMany({ where: { userId, id: { in: plan.decisions.map((d) => d.itemId) } }, select: { id: true, lastStudiedAt: true, feedbackCount: true } })
  const byId = new Map(fresh.map((r) => [r.id, r]))
  let n = 0
  for (const d of plan.decisions) {
    const cur = byId.get(d.itemId)
    if (!cur) continue
    const priority = priorityAfterFeedback(d.priority, cur.feedbackCount)
    const intervalDays = clampInterval(d.intervalDays, priority)
    const decidedBy: DecidedBy = d.byTutor ? 'TUTOR' : 'FALLBACK'
    await tx.repetitionItem.update({
      where: { id: d.itemId },
      data: {
        intervalDays,
        priority,
        nextDueAt: dates.toDbDate(nextDueDate(cur.lastStudiedAt, intervalDays, opts.today)),
        decidedBy,
        decisionReason: truncateCodePoints((d.reasonKo || REVIEW_FALLBACK_REASON_KO).trim(), DECISION_REASON_MAX),
        decidedAt: opts.decidedAt,
      },
    })
    n++
  }
  return n
}

/** `Lesson.progress.reviewDecision`(서버 전용 칸 — #60·#62 nextReview 의 근거, #61 은 받지 않는다). */
export interface StoredReviewDecision {
  jobId: string
  decidedBy: DecidedBy
  rationaleKo: string
  decidedAt: string
  /** 판단 직후의 다음 복습 묶음(그 뒤 판단이 바뀌어도 이 레슨의 종료 카드는 이 묶음을 보인다). */
  groups: NextReviewGroup[]
}

async function recordLessonDecisions(userId: string, lessons: readonly LessonRef[], d: Omit<StoredReviewDecision, 'groups'>, tx: Tx, today: string): Promise<number> {
  let n = 0
  for (const l of lessons) {
    const lesson = await tx.lesson.findFirst({ where: { id: l.id, userId, status: 'DONE' }, select: { id: true, progress: true, completedAt: true } })
    if (!lesson) continue
    const items = l.itemIds.length ? await tx.repetitionItem.findMany({ where: { userId, id: { in: l.itemIds } }, select: { id: true, nextDueAt: true } }) : []
    const byId = new Map(items.map((r) => [r.id, r.nextDueAt ? dates.fromDbDate(r.nextDueAt) : null]))
    const from = lesson.completedAt ? dates.todayKst(lesson.completedAt) : today
    const groups = groupNextReview(l.itemIds.flatMap((id) => (byId.has(id) ? [{ id, nextDueAt: byId.get(id) ?? null }] : [])), from)
    const progress = lesson.progress && typeof lesson.progress === 'object' && !Array.isArray(lesson.progress) ? (lesson.progress as Record<string, unknown>) : {}
    const stored: StoredReviewDecision = { ...d, groups }
    await tx.lesson.update({ where: { id: lesson.id }, data: { progress: { ...progress, reviewDecision: stored } as unknown as Prisma.InputJsonValue } })
    n++
  }
  return n
}

class DecisionSuperseded extends Error {
  constructor() {
    super('review decision superseded')
    this.name = 'DecisionSuperseded'
  }
}

/** 러너가 바깥(DB·LLM·Trace)과 닿는 지점 — 기본값이 운영 구현 그대로다. 단위 테스트만 가짜를 넣는다(REV-061 M-1, 동작 변경 없음). */
export interface DecisionRunnerDeps {
  readJob(userId: string, jobId: string): Promise<{ payload: Prisma.JsonValue | null; traceId: string | null } | null>
  loadMaterials(userId: string, today: string): Promise<ReviewDecisionMaterials>
  completeJson: typeof llm.completeJson
  dailyMinutes(userId: string): Promise<number | null | undefined>
  transaction: <R>(fn: (tx: Tx) => Promise<R>) => Promise<R>
  updateJobProgress: typeof jobs.updateJobProgress
  recordTrace: typeof recordTrace
}

const RUNNER_DEPS: DecisionRunnerDeps = {
  readJob: (userId, jobId) => prisma.aiJob.findFirst({ where: { id: jobId, userId }, select: { payload: true, traceId: true } }),
  loadMaterials: (userId, today) => loadReviewDecisionMaterials(userId, today),
  completeJson: (req) => llm.completeJson(req),
  dailyMinutes: async (userId) => (await getProfile(userId)).dailyMinutes,
  transaction: (fn) => withTransaction(fn),
  updateJobProgress: (id, progress, stage) => jobs.updateJobProgress(id, progress, stage),
  recordTrace: (t) => recordTrace(t),
}

/** 잡 1건 실행(RUNNING 으로 집은 뒤). LLM 실패는 폴백으로 저장하고 잡은 FAILED(오류 코드). 저장 실패는 던진다(호출자가 FAILED). */
export async function runReviewDecisionJob<T>(userId: string, jobId: string, driver: ReviewDecisionDriver<T>, deps: DecisionRunnerDeps = RUNNER_DEPS): Promise<void> {
  const startedAt = Date.now()
  const steps: TraceStep[] = []
  const job = await deps.readJob(userId, jobId)
  const meta = readPayload(job?.payload)
  const traceId = job?.traceId ?? newTraceId()
  const today = dates.todayKst()
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    let t = Date.now()
    const decidedAt = new Date()
    const m = await deps.loadMaterials(userId, today)
    steps.push({ name: 'MATERIALS', ms: Date.now() - t, candidates: m.candidates.length, trigger: meta.trigger, lessons: meta.lessons.length })
    let plan: ReviewDecisionPlan | null = null
    if (m.candidates.length) {
      try {
        await deps.updateJobProgress(jobId, 10, 'LLM')
        t = Date.now()
        const { request, keptItemIds } = await driver.build(m)
        const r = await deps.completeJson({ ...request, priority: 'batch', traceId })
        const keptSet = new Set(keptItemIds)
        plan = driver.finalize(m.candidates.filter((c) => keptSet.has(c.itemId)), r.data)
        steps.push({ name: 'LLM', ms: Date.now() - t, connection: r.connectionKey, model: r.model, attempts: r.attempts ?? 1, promptChars: r.promptChars, kept: keptItemIds.length, ...(plan.counts ?? {}) })
      } catch (e) {
        errorCode = classifyError(e).code
        steps.push({ name: 'LLM', ms: Date.now() - t, error: errorCode })
      }
    }
    const finalPlan = plan ?? fallbackPlan(m.candidates)
    const decidedBy: DecidedBy = plan ? 'TUTOR' : 'FALLBACK'
    const rationaleKo = truncateCodePoints((plan?.rationaleKo ?? '').trim() || REVIEW_FALLBACK_RATIONALE_KO, REVIEW_RATIONALE_MAX)
    t = Date.now()
    const dailyMinutes = await deps.dailyMinutes(userId)
    const saved = await deps.transaction(async (tx) => {
      await lockUserRow(tx, userId)
      if (!(await jobs.markJobStage(jobId, 90, 'SAVE', tx))) throw new DecisionSuperseded()
      const items = await applyReviewDecisions(userId, finalPlan, tx, { today, decidedAt })
      const schedule = await ensureTodaySchedule(userId, today, tx, { decidedBy, rationaleKo }, { dailyMinutes })
      const lessons = await recordLessonDecisions(userId, meta.lessons, { jobId, decidedBy, rationaleKo, decidedAt: new Date().toISOString() }, tx, today)
      if (errorCode) await jobs.failJob(jobId, errorCode, tx)
      else if (!(await jobs.completeJob(jobId, tx))) throw new DecisionSuperseded()
      return { items, scheduleCreated: schedule?.created ?? false, lessons }
    })
    steps.push({ name: 'SAVE', ms: Date.now() - t, decidedBy, ...saved })
    if (errorCode) status = 'ERROR'
  } catch (e) {
    status = 'ERROR'
    if (e instanceof DecisionSuperseded) {
      console.warn(`[reviewDecision] 잡이 이미 닫혀 결과를 버림 — job=${jobId}`)
      return
    }
    errorCode = classifyError(e).code
    throw e
  } finally {
    void deps.recordTrace({ traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - startedAt, errorCode, refType: 'reviewDecision', refId: jobId })
  }
}

