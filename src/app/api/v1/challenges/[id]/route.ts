import { ok, requireSession, withApi } from '@/modules/infra'
import { getChallengeDetail } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #157 상세 = 수행 현황(날짜 띠·달성률·연속·주제 표현·새 단어 진행·누적·오늘 할 일). 끝난 챌린지는 얼린 결과. 없거나 남의 것 404. */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await getChallengeDetail(s.user.id, id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
