/**
 * 오늘의 복습(ReviewSchedule) 공통 — 최소 기록 가드 집계·오늘 세션 만들기(균등 랜덤 추출)·카드 DTO·다음 복습 묶음·상태 전이.
 * A11 잡(`repetition/decision`)과 #58·#63·#64·#62 가 같이 쓴다. 쓰기는 모두 **호출자 tx, 사용자 행 잠금 뒤**.
 *
 * 상태(domain-model §5 ReviewStatus): DUE → DONE(복습 레슨 완료) / SKIPPED(#64) / EXPIRED(예정일에서 7일 넘게 지남 — 항목은 nextDueAt 그대로라
 * 다음 세션이 자동으로 이어받는다). 하루 한 행(`@@unique([userId, dueDate])`) — 이미 있으면 다시 뽑지 않는다(카드가 눈앞에서 바뀌지 않게).
 */
import { randomBytes } from 'node:crypto'
import type { DecidedBy, LessonStatus, Prisma, RepetitionItemType, RepetitionPriority, ReviewStatus } from '@prisma/client'
import { ApiError, dates, lockUserRow, prisma, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { repetitionSourceOf, type RepetitionSource } from '../repetition'
import {
  groupNextReview,
  isStudyDay,
  nextReviewOf,
  pickReviewSession,
  REVIEW_FALLBACK_RATIONALE_KO,
  REVIEW_GUARD_STUDY_DAYS,
  REVIEW_PREVIEW_MAX,
  REVIEW_RECENT_SESSIONS,
  reviewSessionSize,
  type NextReviewGroup,
  type NextReviewSummary,
} from '../repetition/review'

/** EXPIRED 기준 — 예정일에서 간격 상한(7일)만큼 지난 DUE(domain-model ReviewStatus). */
export const REVIEW_EXPIRE_AFTER_DAYS = 7
/** `ReviewSchedule.tutorRationale` 상한(VARCHAR 300). */
export const REVIEW_RATIONALE_MAX = 300
const REVIEW_ID_MAX = 40

export function reviewNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '복습을 찾을 수 없어요.')
}

export function isReviewId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= REVIEW_ID_MAX && /^[A-Za-z0-9_-]+$/.test(id)
}

export function idList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** KST 그날 0시(UTC 시각) — "오늘 만든 잡" 판정. */
export function kstDayStart(today: string): Date {
  return new Date(dates.toDbDate(today).getTime() - 9 * 3_600_000)
}

// ── 최소 기록 가드 ──────────────────────────────────────────────────────────

const GUARD_PAGE = 31

/** 공부한 날(DAILY 스냅샷 기준 — 기록을 지워도 불변, 규칙 2)·반복 항목 수. 공부한 날은 가드 기준(2)까지만 센다. */
export async function countGuard(userId: string, db: Tx | typeof prisma = prisma): Promise<{ studyDays: number; items: number }> {
  let studyDays = 0
  let cursor: string | null = null
  for (let page = 0; page < 13 && studyDays < REVIEW_GUARD_STUDY_DAYS; page++) {
    const rows: { periodKey: string; data: Prisma.JsonValue }[] = await db.statsSnapshot.findMany({
      where: { userId, kind: 'DAILY', ...(cursor ? { periodKey: { lt: cursor } } : {}) },
      orderBy: { periodKey: 'desc' },
      take: GUARD_PAGE,
      select: { periodKey: true, data: true },
    })
    for (const r of rows) if (isStudyDay(r.data) && ++studyDays >= REVIEW_GUARD_STUDY_DAYS) break
    if (rows.length < GUARD_PAGE) break
    cursor = rows[rows.length - 1].periodKey
  }
  const items = await db.repetitionItem.count({ where: { userId } })
  return { studyDays, items }
}

// ── 오늘 세션 만들기 ─────────────────────────────────────────────────────────

export interface ScheduleDecision {
  decidedBy: DecidedBy
  /** 화면 근거 한 줄(≤300). 폴백이면 코드 문구. */
  rationaleKo: string | null
}

export function newReviewSeed(): string {
  return randomBytes(16).toString('hex')
}

/**
 * 오늘(KST) 복습 세션이 없고 due 항목이 있으면 균등 랜덤 추출로 만든다. 있으면 그대로(다시 뽑지 않음). 반환 = 오늘 행 id(없으면 null).
 * 호출자 tx, 사용자 행 잠금 뒤 — 같은 사용자의 두 생성이 겹쳐도 하나만 만든다. `dailyMinutes` 는 호출자가 **트랜잭션 전에** 읽어 넘긴다
 * (`getProfile` 은 Profile 을 upsert 한다 — 사용자 행을 잡은 tx 안에서 다른 연결로 부르면 FK 검사가 그 잠금을 기다려 스스로 막힌다).
 */
export async function ensureTodaySchedule(userId: string, today: string, tx: Tx, decision: ScheduleDecision, opts: { seed?: string; dailyMinutes: number | null | undefined }): Promise<{ id: string; created: boolean } | null> {
  const dueDate = dates.toDbDate(today)
  const existing = await tx.reviewSchedule.findUnique({ where: { userId_dueDate: { userId, dueDate } }, select: { id: true } })
  if (existing) return { id: existing.id, created: false }
  const select = { id: true, studiedCount: true, priority: true, nextDueAt: true } as const
  const due = await tx.repetitionItem.findMany({ where: { userId, nextDueAt: { lte: dueDate } }, select, take: 500 })
  if (!due.length) return null
  const upcoming = await tx.repetitionItem.findMany({ where: { userId, nextDueAt: { gt: dueDate } }, orderBy: [{ nextDueAt: 'asc' }, { id: 'asc' }], take: 10, select })
  const recent = await tx.reviewSchedule.findMany({
    where: { userId, dueDate: { lt: dueDate } },
    orderBy: { dueDate: 'desc' },
    take: REVIEW_RECENT_SESSIONS,
    select: { itemIds: true },
  })
  const seed = opts.seed ?? newReviewSeed()
  const toSample = (r: (typeof due)[number]) => ({ id: r.id, studiedCount: r.studiedCount, priority: r.priority, nextDueAt: r.nextDueAt ? dates.fromDbDate(r.nextDueAt) : null })
  const itemIds = pickReviewSession({
    due: due.map(toSample),
    upcoming: upcoming.map(toSample),
    size: reviewSessionSize(opts.dailyMinutes),
    seed,
    recentIds: new Set(recent.flatMap((r) => idList(r.itemIds))),
  })
  if (!itemIds.length) return null
  const row = await tx.reviewSchedule.create({
    data: {
      userId,
      dueDate,
      itemIds,
      seed,
      status: 'DUE',
      decidedBy: decision.decidedBy,
      tutorRationale: truncateCodePoints((decision.rationaleKo ?? '').trim() || REVIEW_FALLBACK_RATIONALE_KO, REVIEW_RATIONALE_MAX),
    },
    select: { id: true },
  })
  return { id: row.id, created: true }
}

/** 강사 판단 경로가 없을 때(잡이 죽음·판단 엔진 없음) — due 가 있으면 폴백 세션을 만든다. 짧은 자체 트랜잭션. */
export async function ensureFallbackSchedule(userId: string, today: string): Promise<string | null> {
  const { dailyMinutes } = await getProfile(userId)
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const r = await ensureTodaySchedule(userId, today, tx, { decidedBy: 'FALLBACK', rationaleKo: REVIEW_FALLBACK_RATIONALE_KO }, { dailyMinutes })
    return r?.id ?? null
  })
}

/** 예정일에서 7일 넘게 지난 DUE → EXPIRED(항목은 그대로 due 라 다음 세션이 이어받는다). */
export async function expireOldSchedules(userId: string, today: string): Promise<number> {
  const r = await prisma.reviewSchedule.updateMany({
    where: { userId, status: 'DUE', dueDate: { lt: dates.toDbDate(dates.addDays(today, -REVIEW_EXPIRE_AFTER_DAYS)) } },
    data: { status: 'EXPIRED', resolvedAt: new Date() },
  })
  return r.count
}

/** 복습 레슨 완료 → 그 세션 DONE(#62, 완료 트랜잭션 안). 건너뛴·지난 세션도 레슨을 끝냈으면 DONE. 반환 = 세션 id·mixSpec. */
export async function completeScheduleForLesson(userId: string, lessonId: string, tx: Tx, now: Date): Promise<{ id: string; itemIds: string[] } | null> {
  const s = await tx.reviewSchedule.findFirst({ where: { userId, lessonId }, select: { id: true, itemIds: true, status: true } })
  if (!s) return null
  if (s.status !== 'DONE') await tx.reviewSchedule.updateMany({ where: { id: s.id, status: { not: 'DONE' } }, data: { status: 'DONE', resolvedAt: now } })
  return { id: s.id, itemIds: idList(s.itemIds) }
}

// ── #64 건너뛰기 ────────────────────────────────────────────────────────────

/**
 * #64 — 소유자만(404), DUE 만(409 `{reason:'NOT_DUE', status}`). 연결된 복습 레슨을 하는 중(IN_PROGRESS)이면 409 `{reason:'IN_PROGRESS'}`
 * (Leader 결정 (d) — 만들기 실패(FAILED)·준비됨·만드는 중은 건너뛸 수 있다). 항목은 그대로 due 라 다음 학습일 세션에 다시 나온다.
 */
export async function skipReview(userId: string, id: string): Promise<SkipReviewResult> {
  if (!isReviewId(id)) throw reviewNotFound()
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    return skipReviewIn(tx, userId, id, new Date())
  })
}

export interface SkipReviewResult {
  id: string
  status: 'SKIPPED'
  resolvedAt: string
}

/** #64 본체(호출자 tx, 사용자 행 잠금 뒤) — 단위 테스트가 가짜 tx 로 부른다. 전이는 `status=DUE` 조건부라 동시 건너뛰기·시작은 한쪽만 이긴다. */
export async function skipReviewIn(tx: Tx, userId: string, id: string, now: Date): Promise<SkipReviewResult> {
  if (!isReviewId(id)) throw reviewNotFound()
  const s = await tx.reviewSchedule.findFirst({ where: { id, userId }, select: { id: true, status: true, lesson: { select: { status: true } } } })
  if (!s) throw reviewNotFound()
  if (s.status !== 'DUE') throw new ApiError('CONFLICT', s.status === 'SKIPPED' ? '이미 건너뛴 복습이에요.' : '지금은 건너뛸 수 없는 복습이에요.', { reason: 'NOT_DUE', status: s.status })
  if (s.lesson?.status === 'IN_PROGRESS') throw new ApiError('CONFLICT', '하던 복습은 건너뛸 수 없어요. 이어서 해 주세요.', { reason: 'IN_PROGRESS', status: s.status })
  const n = await tx.reviewSchedule.updateMany({ where: { id, userId, status: 'DUE' }, data: { status: 'SKIPPED', resolvedAt: now } })
  if (n.count !== 1) throw new ApiError('CONFLICT', '지금은 건너뛸 수 없는 복습이에요.', { reason: 'NOT_DUE', status: s.status })
  return { id, status: 'SKIPPED', resolvedAt: now.toISOString() }
}

// ── #58 카드 DTO ──────────────────────────────────────────────────────────

export interface TodayReviewDto {
  id: string
  status: ReviewStatus
  itemCount: number
  focusCount: number
  /** 우선순위(FOCUS 먼저) 순 ≤7 — 표기만(읽기·뜻 없음, Leader 결정 ②③). */
  preview: { textJa: string; priority: RepetitionPriority }[]
  decidedBy: DecidedBy
  tutorRationale: string | null
  decidedAt: string
  lessonId: string | null
  /** 복습 레슨 상태(만드는 중·실패·준비됨·하는 중·끝) — 카드 상태 구분용(additive, ★⑧). 레슨 없으면 null. */
  lessonStatus: LessonStatus | null
  /** 끝낸 복습 레슨 점수(additive, ★⑧ — 홈 완료 카드 "문제 c/5"). 없으면 null. */
  score: number | null
  stageDone: number | null
  /** 복습 레슨 생성 잡(#55) — 만드는 중일 때만. */
  jobId: string | null
}

export const SCHEDULE_SELECT = {
  id: true, status: true, itemIds: true, decidedBy: true, tutorRationale: true, createdAt: true, lessonId: true, dueDate: true,
  lesson: { select: { id: true, status: true, stageDone: true, score: true } },
} as const
export type ScheduleRow = Prisma.ReviewScheduleGetPayload<{ select: typeof SCHEDULE_SELECT }>

export function orderPreview<T extends { id: string; priority: RepetitionPriority }>(itemIds: readonly string[], rows: readonly T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ordered = itemIds.flatMap((id) => (byId.get(id) ? [byId.get(id) as T] : []))
  return [...ordered.filter((r) => r.priority === 'FOCUS'), ...ordered.filter((r) => r.priority !== 'FOCUS')]
}

export async function toTodayReviewDto(userId: string, s: ScheduleRow, jobId: string | null): Promise<TodayReviewDto> {
  const ids = idList(s.itemIds)
  const rows = ids.length
    ? await prisma.repetitionItem.findMany({ where: { userId, id: { in: ids } }, select: { id: true, textJa: true, priority: true } })
    : []
  const ordered = orderPreview(ids, rows)
  return {
    id: s.id,
    status: s.status,
    itemCount: ids.length,
    focusCount: ordered.filter((r) => r.priority === 'FOCUS').length,
    preview: ordered.slice(0, REVIEW_PREVIEW_MAX).map((r) => ({ textJa: r.textJa, priority: r.priority })),
    decidedBy: s.decidedBy,
    tutorRationale: s.tutorRationale,
    decidedAt: s.createdAt.toISOString(),
    lessonId: s.lesson?.id ?? null,
    lessonStatus: s.lesson?.status ?? null,
    score: s.lesson?.score ?? null,
    stageDone: s.lesson ? s.lesson.stageDone : null,
    jobId: s.lesson?.status === 'GENERATING' ? jobId : null,
  }
}

/** #58 `nextReview` = `{date, days, itemCount, decidedBy}`(`decidedBy` 는 Leader ④ 선택값 — TUTOR|FALLBACK). */
export type TodayNextReview = NextReviewSummary

/** #58 `nextReview` — 오늘 뒤 가장 이른 예정일 묶음. */
export async function nextReviewForUser(userId: string, today: string): Promise<TodayNextReview | null> {
  const after = dates.toDbDate(today)
  const first = await prisma.repetitionItem.findFirst({ where: { userId, nextDueAt: { gt: after } }, orderBy: { nextDueAt: 'asc' }, select: { nextDueAt: true } })
  if (!first?.nextDueAt) return null
  const by = await prisma.repetitionItem.groupBy({ by: ['decidedBy'], where: { userId, nextDueAt: first.nextDueAt }, _count: { _all: true } })
  return nextReviewOf(dates.fromDbDate(first.nextDueAt), today, by.map((r) => ({ decidedBy: r.decidedBy, n: r._count._all })))
}

// ── #60 복습 레슨 항목 · 다음 복습 ───────────────────────────────────────────

export interface ReviewItemDto {
  id: string
  itemType: RepetitionItemType
  /** 원천 종류(TopicChunk·Expr·Grammar·Correction·WordEntry) — 화면 출처 3종은 이 값으로 가른다(Leader 결정 ④·★②). */
  refType: string
  /** refType 을 3종으로 묶은 값(LESSON·CORRECTION·WORDS) — 편의(additive). */
  source: RepetitionSource
  textJa: string
  meaningKo: string | null
  priority: RepetitionPriority
  studiedCount: number
  wrongCount: number
  feedbackCount: number
}

/** mixSpec 항목(세션 순서) — 남의·없는 id 는 빠진다. 읽기(가나)는 싣지 않는다(Leader 결정 ③ — 스냅샷 없음). */
export async function reviewItemsFor(userId: string, itemIds: readonly string[]): Promise<ReviewItemDto[]> {
  if (!itemIds.length) return []
  const rows = await prisma.repetitionItem.findMany({
    where: { userId, id: { in: [...itemIds] } },
    select: { id: true, itemType: true, refType: true, textJa: true, meaningKo: true, priority: true, studiedCount: true, wrongCount: true, feedbackCount: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  return itemIds.flatMap((id) => {
    const r = byId.get(id)
    return r ? [{ id: r.id, itemType: r.itemType, refType: r.refType, source: repetitionSourceOf(r.refType), textJa: r.textJa, meaningKo: r.meaningKo, priority: r.priority, studiedCount: r.studiedCount, wrongCount: r.wrongCount, feedbackCount: r.feedbackCount }] : []
  })
}

export interface LessonNextReview {
  decidedBy: DecidedBy
  rationaleKo: string
  groups: NextReviewGroup[]
}

/** 항목들의 지금 예정일로 묶음(폴백 표시 — 판단이 저장되지 않았을 때). */
export async function liveNextReview(userId: string, itemIds: readonly string[], from: string, decidedBy: DecidedBy, rationaleKo: string): Promise<LessonNextReview | null> {
  if (!itemIds.length) return null
  const rows = await prisma.repetitionItem.findMany({ where: { userId, id: { in: [...itemIds] } }, select: { id: true, nextDueAt: true } })
  const byId = new Map(rows.map((r) => [r.id, r.nextDueAt ? dates.fromDbDate(r.nextDueAt) : null]))
  const groups = groupNextReview(itemIds.flatMap((id) => (byId.has(id) ? [{ id, nextDueAt: byId.get(id) ?? null }] : [])), from)
  return groups.length ? { decidedBy, rationaleKo, groups } : null
}
