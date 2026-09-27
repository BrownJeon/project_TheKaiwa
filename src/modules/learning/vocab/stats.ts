/**
 * 오늘의 단어 통계(#54, task-008 E10) — **`StatsSnapshot(VOCAB_SESSION)` 만 읽는다**. 단어·세트를 지워도 값이 변하지 않는다(규칙 2).
 *
 * - `byCount`: 기간 안 세트를 `cardCount` 별로 묶은 합계(design-spec §7-2 "생성 개수별 맞춘/틀린").
 * - `daily`: 세트가 있었던 날만(날짜 오름차순). 날짜는 스냅샷 `data.date`(세션 시작 KST 날짜, E3).
 * - `streakDays`: 세트를 끝낸 날이 끊김 없이 이어진 일수. 오늘 아직 안 풀었으면 어제부터 센다(오늘 풀면 이어짐).
 */
import { ApiError, dates, prisma } from '@/modules/infra'

export const STATS_DAYS_MAX = 365
const STREAK_LOOKBACK_DAYS = 400
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export interface VocabStatsDto {
  byCount: { cardCount: number; sessions: number; correct: number; wrong: number; skipped: number }[]
  daily: { date: string; sessions: number; correct: number; wrong: number; skipped: number }[]
  streakDays: number
}

export function parseStatsDays(raw: string | null): number {
  if (raw == null || raw === '') return 30
  if (!/^\d{1,3}$/.test(raw) || Number(raw) < 1 || Number(raw) > STATS_DAYS_MAX) {
    throw new ApiError('VALIDATION', `days 는 1~${STATS_DAYS_MAX} 사이 정수여야 합니다.`, { field: 'days' })
  }
  return Number(raw)
}

interface SnapRow {
  date: string
  cardCount: number
  correct: number
  wrong: number
  skipped: number
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

/** 스냅샷 `data` 해석 — 형태가 어긋난 행은 0 으로 읽고, 날짜가 없으면 생성 시각의 KST 날짜. */
export function readSnapshot(data: unknown, createdAt: Date): SnapRow {
  const d = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  return {
    date: dates.isDateString(d.date) ? d.date : dates.todayKst(createdAt),
    cardCount: num(d.cardCount),
    correct: num(d.correct),
    wrong: num(d.wrong),
    skipped: num(d.skipped),
  }
}

/** 순수 집계 — 테스트가 DB 없이 부른다. */
export function aggregateVocabStats(rows: SnapRow[], today: string, days: number): VocabStatsDto {
  const from = dates.addDays(today, -(days - 1))
  const inRange = rows.filter((r) => r.date >= from && r.date <= today)
  const byCount = new Map<number, VocabStatsDto['byCount'][number]>()
  const daily = new Map<string, VocabStatsDto['daily'][number]>()
  for (const r of inRange) {
    const c = byCount.get(r.cardCount) ?? { cardCount: r.cardCount, sessions: 0, correct: 0, wrong: 0, skipped: 0 }
    c.sessions++
    c.correct += r.correct
    c.wrong += r.wrong
    c.skipped += r.skipped
    byCount.set(r.cardCount, c)
    const d = daily.get(r.date) ?? { date: r.date, sessions: 0, correct: 0, wrong: 0, skipped: 0 }
    d.sessions++
    d.correct += r.correct
    d.wrong += r.wrong
    d.skipped += r.skipped
    daily.set(r.date, d)
  }
  const doneDays = new Set(rows.map((r) => r.date))
  let cursor = doneDays.has(today) ? today : dates.addDays(today, -1)
  let streakDays = 0
  while (doneDays.has(cursor)) {
    streakDays++
    cursor = dates.addDays(cursor, -1)
  }
  return {
    byCount: [...byCount.values()].sort((a, b) => a.cardCount - b.cardCount),
    daily: [...daily.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    streakDays,
  }
}

export async function getVocabStats(userId: string, days: number): Promise<VocabStatsDto> {
  const today = dates.todayKst()
  // 스냅샷은 세션 date(시작일) 이후에 만들어지므로 "조회 시작일의 KST 자정" 이후 생성분만 보면 빠짐이 없다.
  const since = new Date(dates.toDbDate(dates.addDays(today, -STREAK_LOOKBACK_DAYS)).getTime() - KST_OFFSET_MS)
  const snaps = await prisma.statsSnapshot.findMany({
    where: { userId, kind: 'VOCAB_SESSION', createdAt: { gte: since } },
    select: { data: true, createdAt: true },
  })
  return aggregateVocabStats(snaps.map((s) => readSnapshot(s.data, s.createdAt)), today, days)
}
