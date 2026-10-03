/**
 * 오늘의 복습(api-contract #58 review·guard·cycle·decisionPending·nextReview / #63 시작 / #64 건너뛰기 / #62·#60 nextReview, task-010b).
 * 상태·추출 규칙은 `./core`, 강사 판단 잡은 `../repetition/decision`.
 *
 * #63(복습 시작, L6): 라우트가 conversation `buildReviewMixRequest`(A5 `reviewMix@v2`, A4 스키마·후검증 재사용 — `chunks ⊆ mixSpec`, 위반은
 * 1회 재시도)로 요청을 만들어 값으로 넘기면, 여기서 점유 트랜잭션(사용자 행 → 세션 행 FOR UPDATE)을 열고 `Lesson(kind=REVIEW)` +
 * `AiJob(REVIEW_GEN)` 을 만들어 레슨 생성 잡(`runLessonGeneration`, 같은 세대 펜싱)을 백그라운드로 건다. mixSpec = 세션 `itemIds` 의
 * `RepetitionItem`(표기·뜻 스냅샷, 조각·단어는 원천의 읽기를 곁들인다).
 *   이미 연결된 레슨이 READY·IN_PROGRESS·DONE·(살아 있는 잡의) GENERATING 이면 그 레슨을 돌려준다(새 잡 없음). **FAILED(또는 잡이 죽은
 *   GENERATING)면 그 레슨 행을 GENERATING 으로 되살리고 새 잡을 건다**(Leader 결정 ★③ — #59 의 FAILED 행 되살림과 같은 규칙, 세션 연결 그대로).
 *   세션이 DUE 가 아니면 409 `{reason:'NOT_DUE', status}`. 사용자당 복습 수업 생성 동시 1(409 `GENERATING`).
 */
import { Prisma, type ChunkType, type JlptLevel, type LessonKind, type LessonStatus, type RepetitionItemType } from '@prisma/client'
import { ApiError, dates, jobs, lockUserRow, prisma, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { newTraceId } from '@/modules/engine'
import { activeDecisionJob, decisionJobToday, scheduleReviewDecision, type ReviewDecisionDriver, type ReviewDecisionTrigger, type StoredReviewDecision } from '../repetition/decision'
import { REVIEW_FALLBACK_RATIONALE_KO, reviewGuardOf, type ReviewGuard } from '../repetition/review'
import { runLessonGeneration, settleGenerating, type LessonGeneration } from '../lessons/generate'
import {
  countGuard,
  ensureFallbackSchedule,
  expireOldSchedules,
  idList,
  isReviewId,
  liveNextReview,
  nextReviewForUser,
  reviewItemsFor,
  reviewNotFound,
  SCHEDULE_SELECT,
  toTodayReviewDto,
  type LessonNextReview,
  type ReviewItemDto,
  type TodayNextReview,
  type TodayReviewDto,
} from './core'

export { skipReview, skipReviewIn, isReviewId, completeScheduleForLesson, ensureTodaySchedule, countGuard, REVIEW_EXPIRE_AFTER_DAYS } from './core'
export type { TodayReviewDto, ReviewItemDto, LessonNextReview, TodayNextReview, SkipReviewResult } from './core'

/** `cycle.reviewEvery` 참고값(정합 #14·15 — 실제 간격은 항목별 3~7) 범위·기본. */
const REVIEW_EVERY_MIN = 2
const REVIEW_EVERY_MAX = 4
const REVIEW_EVERY_DEFAULT = 3
const REVIEW_LESSON_TITLE = '오늘의 복습'

export interface TodayReviewState {
  /** NEW = 새 수업만 · BOTH = 오늘 할 복습(DUE)이 있다. REVIEW(복습만)는 예약값. */
  mode: 'NEW' | 'REVIEW' | 'BOTH'
  review: TodayReviewDto | null
  guard: ReviewGuard | null
  cycle: { reviewEvery: number } | null
  /** 강사 판단 잡이 진행 중(오늘 판단 전 포함) — 화면은 기다리지 않고 잠시 뒤 #58 을 다시 읽는다. */
  decisionPending: boolean
  /** 진행 중 판단 잡(#55 폴링용, additive). */
  decisionJobId: string | null
  nextReview: TodayNextReview | null
}

export const EMPTY_REVIEW_STATE: TodayReviewState = { mode: 'NEW', review: null, guard: null, cycle: null, decisionPending: false, decisionJobId: null, nextReview: null }

async function readCycle(userId: string): Promise<{ reviewEvery: number }> {
  const plan = await prisma.studyPlan.findFirst({ where: { userId, status: 'ACCEPTED' }, orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }], select: { curriculum: true } })
  const raw = plan?.curriculum && typeof plan.curriculum === 'object' && !Array.isArray(plan.curriculum) ? (plan.curriculum as Record<string, unknown>).reviewEvery : undefined
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : REVIEW_EVERY_DEFAULT
  return { reviewEvery: Math.min(REVIEW_EVERY_MAX, Math.max(REVIEW_EVERY_MIN, n)) }
}

/**
 * #58 복습 칸. 가드에 걸리면 `guard` 만. 아니면 오늘 세션(있으면) + 판단 대기 여부 + 다음 복습. 오늘 판단 잡이 하나도 없고 세션도 없으면
 * 여기서 판단 잡을 건다(`driver` 가 있을 때 — 하루 한 번). 판단 경로가 없는데 due 가 남았으면(잡이 죽음) 폴백 세션을 바로 만든다.
 * 7일 넘게 지난 DUE 세션은 EXPIRED 로 닫는다.
 */
export async function getTodayReviewState<T>(userId: string, driver: ReviewDecisionDriver<T> | null, today = dates.todayKst()): Promise<TodayReviewState> {
  await expireOldSchedules(userId, today)
  const guard = reviewGuardOf(await countGuard(userId))
  const cycle = await readCycle(userId)
  if (guard) return { ...EMPTY_REVIEW_STATE, guard, cycle }
  const dueDate = dates.toDbDate(today)
  let schedule = await prisma.reviewSchedule.findUnique({ where: { userId_dueDate: { userId, dueDate } }, select: SCHEDULE_SELECT })
  let job = await activeDecisionJob(userId)
  if (!schedule && !job && driver && !(await decisionJobToday(userId, today))) {
    const r = await scheduleReviewDecision(userId, { trigger: 'DAILY' }, driver)
    if (r) job = { id: r.jobId, status: 'QUEUED' }
  }
  // 판단 경로가 없을 때(잡이 죽음·driver 없음)만 폴백 세션 — due 가 없으면 잠금 트랜잭션을 열지 않는다(#58 은 홈마다 읽힌다).
  if (!schedule && !job && (await prisma.repetitionItem.findFirst({ where: { userId, nextDueAt: { lte: dueDate } }, select: { id: true } }))) {
    const id = await ensureFallbackSchedule(userId, today)
    if (id) schedule = await prisma.reviewSchedule.findUnique({ where: { id }, select: SCHEDULE_SELECT })
  }
  let genJobId: string | null = null
  if (schedule?.lesson?.status === 'GENERATING') {
    genJobId = await settleGenerating(userId, schedule.lesson.id, undefined, 'REVIEW_GEN')
    if (!genJobId) schedule = await prisma.reviewSchedule.findUnique({ where: { id: schedule.id }, select: SCHEDULE_SELECT })
  }
  const review = schedule ? await toTodayReviewDto(userId, schedule, genJobId) : null
  return {
    mode: review?.status === 'DUE' ? 'BOTH' : 'NEW',
    review,
    guard: null,
    cycle,
    decisionPending: !!job,
    decisionJobId: job?.id ?? null,
    nextReview: await nextReviewForUser(userId, today),
  }
}

// ── 완료 뒤 판단(#62·#51) ────────────────────────────────────────────────────

/**
 * 완료 트랜잭션 **뒤** 판단 잡 적재(실패해도 완료 응답은 그대로 — 로그만). 반환 = #62 `reviewDecisionJobId`·`nextReview`.
 * 잡이 걸리면 nextReview 는 null(판단 대기 — #55 → #60). 가드에 걸리면 null(복습이 아직 열리지 않음). 그 밖(적재 실패·판단할 항목 없음)은
 * 지금 간격 그대로의 폴백 묶음.
 */
export async function afterStudyCompleted<T>(
  userId: string,
  input: { trigger: Exclude<ReviewDecisionTrigger, 'DAILY'>; lesson?: { id: string; itemIds: string[] } | null },
  driver: ReviewDecisionDriver<T>,
): Promise<{ reviewDecisionJobId: string | null; nextReview: LessonNextReview | null }> {
  try {
    const r = await scheduleReviewDecision(userId, input, driver)
    if (r) return { reviewDecisionJobId: r.jobId, nextReview: null }
  } catch (e) {
    console.error('[reviewDecision] 적재 실패:', e instanceof Error ? e.name : 'unknown')
  }
  try {
    if (!input.lesson || reviewGuardOf(await countGuard(userId))) return { reviewDecisionJobId: null, nextReview: null }
    return { reviewDecisionJobId: null, nextReview: await liveNextReview(userId, input.lesson.itemIds, dates.todayKst(), 'FALLBACK', REVIEW_FALLBACK_RATIONALE_KO) }
  } catch {
    return { reviewDecisionJobId: null, nextReview: null }
  }
}

// ── #60 복습 레슨 항목 · 다음 복습 ───────────────────────────────────────────

function storedDecision(progress: unknown): StoredReviewDecision | null {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return null
  const d = (progress as Record<string, unknown>).reviewDecision as Partial<StoredReviewDecision> | undefined
  if (!d || typeof d !== 'object' || (d.decidedBy !== 'TUTOR' && d.decidedBy !== 'FALLBACK') || !Array.isArray(d.groups)) return null
  return d as StoredReviewDecision
}

/**
 * #60 추가 칸 — `reviewItems`(복습 레슨이면 모든 상태에서 mixSpec 항목, 아니면 null — ★②) · `nextReview`(끝낸 레슨: 판단 결과 저장분 →
 * 판단 대기면 null → 판단이 저장되지 않았고 대기도 아니면(잡이 죽음) 복습 레슨에 한해 지금 간격 폴백).
 */
export async function lessonReviewExtras(
  userId: string,
  lesson: { id: string; kind: LessonKind; status: LessonStatus; progress: unknown; completedAt: Date | null; scheduleItemIds: unknown },
): Promise<{ reviewItems: ReviewItemDto[] | null; nextReview: LessonNextReview | null }> {
  const itemIds = lesson.kind === 'REVIEW' ? idList(lesson.scheduleItemIds) : []
  const reviewItems = lesson.kind === 'REVIEW' ? await reviewItemsFor(userId, itemIds) : null
  if (lesson.status !== 'DONE') return { reviewItems, nextReview: null }
  const stored = storedDecision(lesson.progress)
  if (stored) return { reviewItems, nextReview: { decidedBy: stored.decidedBy, rationaleKo: stored.rationaleKo, groups: stored.groups } }
  if (lesson.kind !== 'REVIEW' || (await activeDecisionJob(userId))) return { reviewItems, nextReview: null }
  const from = lesson.completedAt ? dates.todayKst(lesson.completedAt) : dates.todayKst()
  return { reviewItems, nextReview: await liveNextReview(userId, itemIds, from, 'FALLBACK', REVIEW_FALLBACK_RATIONALE_KO) }
}

// ── #63 복습 시작 ───────────────────────────────────────────────────────────

export interface ReviewMixMaterialItem {
  id: string
  itemType: RepetitionItemType
  /** A5 입력의 조각 분류 추정(주제 조각은 원래 분류, 그 밖은 종류로 — LLM 이 다시 분류하므로 틀려도 검증엔 영향 없음, PE 인계). */
  chunkType: ChunkType
  textJa: string
  /** 원천(주제 조각·단어)의 읽기 — 없으면 null. */
  reading: string | null
  meaningKo: string | null
}

const CHUNK_TYPE_BY_ITEM: Record<RepetitionItemType, ChunkType> = { WORD: 'NAME', CHUNK: 'NAME', EXPRESSION: 'ACTION', GRAMMAR: 'MODIFIER', SCENARIO: 'ACTION', LESSON: 'ACTION' }

export interface ReviewMixMaterials {
  scheduleId: string
  todayKst: string
  level: JlptLevel
  items: ReviewMixMaterialItem[]
}

function notDue(status: string): ApiError {
  return new ApiError('CONFLICT', status === 'DONE' ? '이미 끝낸 복습이에요.' : status === 'SKIPPED' ? '건너뛴 복습이에요.' : '지금은 시작할 수 없는 복습이에요.', { reason: 'NOT_DUE', status })
}

/** #63 재료(점유 전 읽기) — 소유자만(404), DUE 만(409). mixSpec 순서대로, 남의·없는 id 는 빠진다. */
export async function loadReviewMixMaterials(userId: string, scheduleId: string): Promise<ReviewMixMaterials> {
  if (!isReviewId(scheduleId)) throw reviewNotFound()
  const s = await prisma.reviewSchedule.findFirst({ where: { id: scheduleId, userId }, select: { id: true, status: true, itemIds: true } })
  if (!s) throw reviewNotFound()
  if (s.status !== 'DUE') throw notDue(s.status)
  const ids = idList(s.itemIds)
  const rows = ids.length
    ? await prisma.repetitionItem.findMany({ where: { userId, id: { in: ids } }, select: { id: true, itemType: true, refType: true, refId: true, textJa: true, meaningKo: true } })
    : []
  const chunkIds = rows.filter((r) => r.refType === 'TopicChunk').map((r) => r.refId)
  const wordIds = rows.filter((r) => r.refType === 'WordEntry').map((r) => r.refId)
  const [chunks, words, profile] = await Promise.all([
    chunkIds.length ? prisma.topicChunk.findMany({ where: { id: { in: chunkIds } }, select: { id: true, reading: true, chunkType: true } }) : [],
    wordIds.length ? prisma.wordEntry.findMany({ where: { userId, id: { in: wordIds } }, select: { id: true, reading: true } }) : [],
    getProfile(userId),
  ])
  const readingOf = new Map<string, string | null>([...chunks.map((c) => [`TopicChunk:${c.id}`, c.reading] as const), ...words.map((w) => [`WordEntry:${w.id}`, w.reading] as const)])
  const chunkTypeOf = new Map(chunks.map((c) => [c.id, c.chunkType]))
  const byId = new Map(rows.map((r) => [r.id, r]))
  return {
    scheduleId: s.id,
    todayKst: dates.todayKst(),
    level: profile.level as JlptLevel,
    items: ids.flatMap((id) => {
      const r = byId.get(id)
      if (!r) return []
      const chunkType = (r.refType === 'TopicChunk' ? chunkTypeOf.get(r.refId) : undefined) ?? CHUNK_TYPE_BY_ITEM[r.itemType]
      return [{ id: r.id, itemType: r.itemType, chunkType, textJa: r.textJa, reading: readingOf.get(`${r.refType}:${r.refId}`) ?? null, meaningKo: r.meaningKo }]
    }),
  }
}

export interface StartReviewResult {
  lessonId: string
  jobId: string | null
  status: LessonStatus
  /** 이미 연결된 레슨을 그대로 돌려줬는가(새 잡 없음). */
  reused: boolean
}

export interface ReviewClaim {
  lessonId: string
  jobId: string
  traceId: string
}

async function lockSchedule(tx: Tx, userId: string, id: string): Promise<{ id: string; status: string; lessonId: string | null }> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM ReviewSchedule WHERE id = ${id} AND userId = ${userId} FOR UPDATE`
  if (!rows.length) throw reviewNotFound()
  return tx.reviewSchedule.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, lessonId: true } })
}

/** #63 — 위 머리말. `gen` 은 라우트가 A5 요청으로 만든 값(재사용이면 쓰지 않는다). */
export async function startReview(userId: string, scheduleId: string, m: ReviewMixMaterials, gen: LessonGeneration): Promise<StartReviewResult> {
  if (!isReviewId(scheduleId)) throw reviewNotFound()
  const traceId = newTraceId()
  const r = await withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    return claimReviewStart(tx, userId, scheduleId, m, gen, traceId)
  })
  if (r.claim) {
    const claim = r.claim
    jobs.runJobInBackground(claim.jobId, () => runLessonGeneration(userId, { ...claim, kind: 'REVIEW_GEN' }, gen))
  }
  return r.result
}

/**
 * #63 점유 본체(호출자 tx, 사용자 행 잠금 뒤 — 단위 테스트가 가짜 tx 로 부른다). 세션 행 FOR UPDATE → DUE 확인 → 연결 레슨 재사용·되살리기 판정 →
 * 사용자당 생성 1 → 레슨(새 행 또는 **같은 행 되살림**, #59 FAILED 행 규칙과 같음 — ★③) + 잡(QUEUED).
 */
export async function claimReviewStart(
  tx: Tx,
  userId: string,
  scheduleId: string,
  m: ReviewMixMaterials,
  gen: LessonGeneration,
  traceId: string,
): Promise<{ result: StartReviewResult; claim: ReviewClaim | null }> {
  const s = await lockSchedule(tx, userId, scheduleId)
  if (s.status !== 'DUE') throw notDue(s.status)
  let revive: string | null = null
  if (s.lessonId) {
    const l = await tx.lesson.findFirst({ where: { id: s.lessonId, userId }, select: { id: true, status: true } })
    if (l && (l.status === 'READY' || l.status === 'IN_PROGRESS' || l.status === 'DONE')) return { result: { lessonId: l.id, jobId: null, status: l.status, reused: true }, claim: null }
    if (l?.status === 'GENERATING') {
      const active = await jobs.findActiveJob({ userId, kind: 'REVIEW_GEN', refId: l.id }, tx)
      if (active) return { result: { lessonId: l.id, jobId: active.id, status: 'GENERATING', reused: true }, claim: null }
      await tx.lesson.updateMany({ where: { id: l.id, status: 'GENERATING' }, data: { status: 'FAILED', error: 'stale' } })
    }
    if (l) revive = l.id
  }
  const busy = await jobs.findActiveJobByKind({ userId, kind: 'REVIEW_GEN' }, tx)
  if (busy) throw new ApiError('CONFLICT', '다른 복습 수업을 만들고 있어요. 다 되면 시작할 수 있어요.', { reason: 'GENERATING', jobId: busy.id, lessonId: busy.refId })
  const base = {
    date: dates.toDbDate(m.todayKst),
    title: truncateCodePoints(REVIEW_LESSON_TITLE, 120),
    level: m.level,
    status: 'GENERATING' as const,
    stageDone: 0,
    score: null,
    error: null,
    completedAt: null,
    content: Prisma.DbNull,
    progress: Prisma.DbNull,
  }
  let lessonId: string
  if (revive) {
    // 되살린 행의 옛 잡이 늦게 끝나도 `isCurrentJob`(더 새 잡 있음)으로 버려진다 — #59 와 같은 세대 펜싱.
    await tx.lesson.update({ where: { id: revive }, data: base })
    lessonId = revive
  } else {
    const lesson = await tx.lesson.create({ data: { ...base, userId, topicId: null, kind: 'REVIEW' }, select: { id: true } })
    await tx.reviewSchedule.update({ where: { id: s.id }, data: { lessonId: lesson.id } })
    lessonId = lesson.id
  }
  const job = await jobs.createJob(
    { userId, kind: 'REVIEW_GEN', refId: lessonId, traceId, payload: { promptKey: 'reviewMix', promptVersion: gen.promptVersion, inputMeta: gen.inputMeta } as Prisma.InputJsonValue },
    tx,
  )
  return { result: { lessonId, jobId: job.id, status: 'GENERATING', reused: false }, claim: { lessonId, jobId: job.id, traceId } }
}

