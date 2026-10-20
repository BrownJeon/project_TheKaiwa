/**
 * 조회 범위(KST) — `THIS_WEEK` = 이번 주 일~토(주 시작 = `dates.WEEK_START_DOW`, task-080), `LAST_30D` = 오늘 포함 30일, `ALL` = 하한 없음.
 * 달력 날짜(`@db.Date`·`periodKey`)는 문자열 구간으로, 시각 칸(`createdAt`·`completedAt`)은 KST 자정 경계의 UTC 시각으로 비교한다.
 */
import { dates } from '@/modules/infra'
import type { AskScopeKey } from './types'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export interface RetrievalRange {
  key: AskScopeKey
  /** 오늘(KST). */
  today: string
  /** 포함 하한 달력 날짜(ALL = null). */
  fromKst: string | null
  /** 포함 상한 달력 날짜(THIS_WEEK = 그 주 토요일, 그 밖 = 오늘). */
  toKst: string
  /** 포함 하한 시각(= fromKst 00:00 KST). */
  fromInstant: Date | null
  /** 미포함 상한 시각(= toKst 다음 날 00:00 KST). */
  toExclusive: Date
  /** 사람이 읽는 범위 이름(항목 글·라벨용). */
  labelKo: string
}

/** KST 달력 날짜의 00:00(KST) 시각. */
export function kstMidnight(date: string): Date {
  return new Date(dates.toDbDate(date).getTime() - KST_OFFSET_MS)
}

/** 시각 → KST 달력 날짜. */
export function kstDateOf(at: Date): string {
  return dates.todayKst(at)
}

export function resolveRange(key: AskScopeKey, now: Date): RetrievalRange {
  const today = dates.todayKst(now)
  if (key === 'THIS_WEEK') {
    const from = dates.weekStartOf(today)
    const to = dates.addDays(from, 6)
    return { key, today, fromKst: from, toKst: to, fromInstant: kstMidnight(from), toExclusive: kstMidnight(dates.addDays(to, 1)), labelKo: '이번 주' }
  }
  if (key === 'LAST_30D') {
    const from = dates.addDays(today, -29)
    return { key, today, fromKst: from, toKst: today, fromInstant: kstMidnight(from), toExclusive: kstMidnight(dates.addDays(today, 1)), labelKo: '지난 30일' }
  }
  return { key, today, fromKst: null, toKst: today, fromInstant: null, toExclusive: kstMidnight(dates.addDays(today, 1)), labelKo: '전체 기간' }
}

/** Prisma 시각 칸 조건(포함 하한·미포함 상한). */
export function instantWhere(r: RetrievalRange): { gte?: Date; lt: Date } {
  return r.fromInstant ? { gte: r.fromInstant, lt: r.toExclusive } : { lt: r.toExclusive }
}

/** Prisma `@db.Date` 칸 조건(양 끝 포함). */
export function dbDateWhere(r: RetrievalRange): { gte?: Date; lte: Date } {
  return r.fromKst ? { gte: dates.toDbDate(r.fromKst), lte: dates.toDbDate(r.toKst) } : { lte: dates.toDbDate(r.toKst) }
}

/** `StatsSnapshot.periodKey`(`YYYY-MM-DD` 문자열 — 사전순 = 시간순) 조건. */
export function periodKeyWhere(r: RetrievalRange): { gte?: string; lte: string } {
  return r.fromKst ? { gte: r.fromKst, lte: r.toKst } : { lte: r.toKst }
}
