import { ok, withApi } from '@/modules/infra'
import { getConfigVersion, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #108a 버전 상세 — `?compare=previous|active`. 손상 기록은 422 E_SNAPSHOT_INTEGRITY. 스냅샷 원문은 DEVELOPER 이상만. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('config.effective.read')
  const { id } = await ctx.params
  return ok(await getConfigVersion(actor, id, req.nextUrl.searchParams))
})
