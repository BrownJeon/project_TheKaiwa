import { ok, requireSession, withApi } from '@/modules/infra'
import { getCalendar, parseCalendarMonth } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #70 월 달력 `?month=YYYY-MM`(생략하면 이번 달, KST) — StudyLog·Attendance·복습 예정일 파생. 자기 기록만 집계한다. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const month = parseCalendarMonth(req.nextUrl.searchParams.get('month'))
  return ok(await getCalendar(s.user.id, month))
})
