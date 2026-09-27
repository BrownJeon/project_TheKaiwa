import { ok, withApi } from '@/modules/infra'
import { getEngineConnectionDetail, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #91a Connection 상세 + effectiveSummary + 최근 Health 5건. id 또는 key. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.read')
  const { id } = await ctx.params
  return ok(await getEngineConnectionDetail(actor, viewEnvironment(actor, req.nextUrl.searchParams.get('environment')), id))
})
