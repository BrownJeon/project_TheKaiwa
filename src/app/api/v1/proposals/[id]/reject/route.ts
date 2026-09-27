import { ok, requireSession, withApi } from '@/modules/infra'
import { rejectProposal } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #39 제안 거절 — 아무 행도 만들지 않는다. */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await rejectProposal(s.user.id, id))
})
