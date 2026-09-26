/**
 * 출석(api-contract #25·#26) — 날짜는 서버 KST, `@@unique([userId, date])` 가 최종 보증(멱등).
 * streak = 오늘 포함 연속 출석일(오늘 행이 있을 때 기준, 어제까지 끊김 없이 이어진 날 수).
 */
import { prisma, dates } from '@/modules/infra'

export function computeStreak(sortedDesc: string[], today: string): number {
  let expect = today
  let n = 0
  for (const d of sortedDesc) {
    if (d === expect) {
      n++
      expect = dates.addDays(expect, -1)
    } else if (d < expect) {
      break
    }
  }
  return n
}

async function recentDays(userId: string, today: string): Promise<string[]> {
  const rows = await prisma.attendance.findMany({
    where: { userId, date: { lte: dates.toDbDate(today) } },
    orderBy: { date: 'desc' },
    take: 400,
    select: { date: true },
  })
  return rows.map((r) => dates.fromDbDate(r.date))
}

export async function checkIn(userId: string, source = 'APP_OPEN'): Promise<{ date: string; isNew: boolean; streak: number; source: string }> {
  const today = dates.todayKst()
  let isNew = true
  try {
    await prisma.attendance.create({ data: { userId, date: dates.toDbDate(today), source } })
  } catch (e) {
    // P2002 = 이미 오늘 출석(동시 요청 포함). 행을 더 만들지 않는다.
    if ((e as { code?: string }).code !== 'P2002') throw e
    isNew = false
  }
  const streak = computeStreak(await recentDays(userId, today), today)
  return { date: today, isNew, streak, source }
}

export async function listMonth(userId: string, month: string): Promise<{ month: string; days: string[]; count: number; streak: number }> {
  const { from, to } = dates.monthBounds(`${month}-01`)
  const rows = await prisma.attendance.findMany({
    where: { userId, date: dates.dbDateRange(from, to) },
    orderBy: { date: 'asc' },
    select: { date: true },
  })
  const today = dates.todayKst()
  return { month, days: rows.map((r) => dates.fromDbDate(r.date)), count: rows.length, streak: computeStreak(await recentDays(userId, today), today) }
}
