import { ApiError, dates, ok, requireSession, withApi } from '@/modules/infra'
import { listMonth } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #26 월 출석 `?month=YYYY-MM`(생략하면 이번 달, KST). */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const month = req.nextUrl.searchParams.get('month') ?? dates.todayKst().slice(0, 7)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new ApiError('VALIDATION', 'month 는 YYYY-MM 형식이어야 합니다.', { field: 'month' })
  return ok(await listMonth(s.user.id, month))
})
