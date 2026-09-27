import { ok, requireSession, withApi } from '@/modules/infra'
import { setWordArchived } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #45 보관 — 세트 생성 풀에서 빠진다. 이미 보관이면 그대로. */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await setWordArchived(s.user.id, id, true))
})
