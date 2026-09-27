import { ok, requireSession, withApi } from '@/modules/infra'
import { getVocabSession } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #49 세트 조회 — 답한 카드·끝난 세트만 정답 포함. 남의 세트 404. */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await getVocabSession(s.user.id, id))
})
