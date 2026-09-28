/**
 * 달력(api-contract #70)·하루 상세(#71) — `StudyLog`+`Attendance`(+`ReviewSchedule` DUE) 파생. 전부 L3 자기 테이블이다.
 *
 * - 날짜 경계는 KST: 세 테이블의 날짜 컬럼이 이미 KST 달력 날짜(`@db.Date`, infra/dates 왕복 규칙)라
 *   월 범위 = 그 달 1일~말일 문자열 비교로 끝난다. "오늘"은 서버가 정한다(§0-6) — 응답 `today` 로 내려 준다.
 * - `days` 는 그 달의 **모든 날**(빈 날 포함, 날짜 오름차순) — 화면이 격자를 그대로 채운다.
 * - `minutes` = 그날 `StudyLog.durationSec` 합을 분으로 반올림(값이 없는 기록은 0 — 추정하지 않는다).
 * - `hasEvaluation` = 그날 EVALUATION 기록이 있는가 · `reviewDue` = 그날이 `ReviewSchedule(status=DUE)` 의 예정일인가.
 * - `summary.streak` 은 #25·#26 과 같은 "오늘 기준 연속 출석일", `summary.longestStreak` 은 그 달 안의 최장 연속 출석일.
 */
import type { ReviewStatus, StudyType } from '@prisma/client'
import { ApiError, dates, prisma } from '@/modules/infra'
import { listMonth } from '../attendance'
import { DAY_LOG_CAP, LOG_SELECT, serializeLogs, STUDY_TYPES, type StudyLogDto, type StudyLogRefs } from './logs'

export interface CalendarDayDto {
  date: string
  attended: boolean
  /** 그날 기록된 공부 종류(중복 없음, 고정 순서 TALK·CHAT·WORDS·LESSON·REVIEW·EVALUATION·ASK). */
  types: StudyType[]
  minutes: number
  logCount: number
  hasEvaluation: boolean
  reviewDue: boolean
}

export interface CalendarDto {
  month: string
  /** 서버 KST 오늘 — 오늘 표시·미래 달 비활성 판단용. */
  today: string
  days: CalendarDayDto[]
  summary: { attendedDays: number; studyDays: number; streak: number; longestStreak: number }
}

export interface CalendarLogGroup {
  date: string
  type: StudyType
  count: number
  durationSec: number
}

export interface CalendarInput {
  month: string
  today: string
  logGroups: CalendarLogGroup[]
  attendedDates: string[]
  reviewDueDates: string[]
  streak: number
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** `?month=YYYY-MM` — 생략하면 이번 달(KST). 연도는 2000~2100. */
export function parseCalendarMonth(raw: string | null | undefined, today: string = dates.todayKst()): string {
  if (raw == null || raw === '') return today.slice(0, 7)
  if (!MONTH_PATTERN.test(raw)) throw new ApiError('VALIDATION', 'month 는 YYYY-MM 형식이어야 합니다.', { field: 'month' })
  const year = Number(raw.slice(0, 4))
  if (year < 2000 || year > 2100) throw new ApiError('VALIDATION', 'month 의 연도가 범위를 벗어났습니다.', { field: 'month' })
  return raw
}

/** `?date=YYYY-MM-DD` — 필수, 실재하는 날짜. */
export function parseDayDate(raw: string | null | undefined): string {
  if (!dates.isDateString(raw)) throw new ApiError('VALIDATION', 'date 는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.', { field: 'date' })
  const year = Number(raw.slice(0, 4))
  if (year < 2000 || year > 2100) throw new ApiError('VALIDATION', 'date 의 연도가 범위를 벗어났습니다.', { field: 'date' })
  return raw
}

/** 순수 조립 — 월 밖 날짜는 버린다(경계 방어). */
export function buildCalendar(input: CalendarInput): CalendarDto {
  const { from, to } = dates.monthBounds(`${input.month}-01`)
  const inMonth = (d: string) => d >= from && d <= to
  const attended = new Set(input.attendedDates.filter(inMonth))
  const reviewDue = new Set(input.reviewDueDates.filter(inMonth))
  const byDate = new Map<string, { types: Set<StudyType>; count: number; sec: number }>()
  for (const g of input.logGroups) {
    if (!inMonth(g.date) || g.count <= 0) continue
    const cur = byDate.get(g.date) ?? { types: new Set<StudyType>(), count: 0, sec: 0 }
    cur.types.add(g.type)
    cur.count += g.count
    cur.sec += Math.max(0, g.durationSec)
    byDate.set(g.date, cur)
  }
  const days: CalendarDayDto[] = dates.eachDateInRange(from, to).map((date) => {
    const logs = byDate.get(date)
    return {
      date,
      attended: attended.has(date),
      types: logs ? STUDY_TYPES.filter((t) => logs.types.has(t)) : [],
      minutes: logs ? Math.round(logs.sec / 60) : 0,
      logCount: logs?.count ?? 0,
      hasEvaluation: logs?.types.has('EVALUATION') ?? false,
      reviewDue: reviewDue.has(date),
    }
  })
  return {
    month: input.month,
    today: input.today,
    days,
    summary: {
      attendedDays: attended.size,
      studyDays: days.filter((d) => d.logCount > 0).length,
      streak: input.streak,
      longestStreak: longestRun(days.map((d) => d.attended)),
    },
  }
}

export function longestRun(flags: boolean[]): number {
  let best = 0
  let run = 0
  for (const f of flags) {
    run = f ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

/** #70 — 로그는 (날짜, 종류) 묶음 집계 한 번, 출석·복습 예정일 각 한 번. */
export async function getCalendar(userId: string, month: string): Promise<CalendarDto> {
  const today = dates.todayKst()
  const { from, to } = dates.monthBounds(`${month}-01`)
  const range = dates.dbDateRange(from, to)
  const [groups, attendance, reviews] = await Promise.all([
    prisma.studyLog.groupBy({ by: ['date', 'type'], where: { userId, date: range }, _count: { _all: true }, _sum: { durationSec: true } }),
    listMonth(userId, month),
    prisma.reviewSchedule.findMany({ where: { userId, status: 'DUE', dueDate: range }, select: { dueDate: true } }),
  ])
  return buildCalendar({
    month,
    today,
    logGroups: groups.map((g) => ({ date: dates.fromDbDate(g.date), type: g.type, count: g._count._all, durationSec: g._sum.durationSec ?? 0 })),
    attendedDates: attendance.days,
    reviewDueDates: reviews.map((r) => dates.fromDbDate(r.dueDate)),
    streak: attendance.streak,
  })
}

export interface DayDto {
  date: string
  attended: boolean
  /** 그날 기록(작성 순, 최대 200). */
  logs: StudyLogDto[]
  /** 그날이 예정일인 복습(없으면 null). `lessonId` 는 복습을 시작해 만든 레슨(아직 없으면 null). */
  review: { id: string; status: ReviewStatus; lessonId: string | null } | null
}

/** #71 */
export async function getDay(userId: string, date: string, refs: StudyLogRefs): Promise<DayDto> {
  const d = dates.toDbDate(date)
  const [rows, attendance, review] = await Promise.all([
    prisma.studyLog.findMany({ where: { userId, date: d }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: DAY_LOG_CAP, select: LOG_SELECT }),
    prisma.attendance.findUnique({ where: { userId_date: { userId, date: d } }, select: { id: true } }),
    prisma.reviewSchedule.findUnique({ where: { userId_dueDate: { userId, dueDate: d } }, select: { id: true, status: true, lessonId: true } }),
  ])
  return { date, attended: !!attendance, logs: await serializeLogs(userId, rows, refs), review: review ? { id: review.id, status: review.status, lessonId: review.lessonId } : null }
}
