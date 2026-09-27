import { ok, requireSession, withApi } from '@/modules/infra'
import { rejectCorrection } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #36 교정 무시 — 아무 행도 만들지 않는다. 이미 처리 409 `{status}`. */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await rejectCorrection(s.user.id, id))
})
