import { ok, requireSession, withApi } from '@/modules/infra'
import { getTodayLessons } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #58 오늘의 회화 — `{mode:'NEW', date, review:null, guard:null, cycle:null, todayLessons[], resume, recommendation}`.
 * 복습 칸은 task-010b 가 채운다. 날짜는 서버 KST.
 */
export const GET = withApi(async () => {
  const s = await requireSession()
  return ok(await getTodayLessons(s.user.id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
