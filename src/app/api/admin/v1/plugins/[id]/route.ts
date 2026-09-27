import { ok, withApi } from '@/modules/infra'
import { getPluginDto, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #122 Plugin 상세(descriptor·capabilities·defaultConfiguration·schema·sourcePath). */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const actor = await requireCapability('plugins.read')
  const { id } = await ctx.params
  return ok(await getPluginDto(actor.environment, id))
})
