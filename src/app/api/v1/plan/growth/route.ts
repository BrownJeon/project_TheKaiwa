import { ok, requireSession, withApi } from '@/modules/infra'
import { getGrowth, parseGrowthWeeks } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #78 성장 탭 `?weeks=4|8|12`(생략 4) — DAILY·EVALUATION 스냅샷 + 출석만 읽는다(원본 삭제와 무관). 세션 사용자 자기 기록만. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const weeks = parseGrowthWeeks(req.nextUrl.searchParams.get('weeks'))
  return ok(await getGrowth(s.user.id, weeks))
})
