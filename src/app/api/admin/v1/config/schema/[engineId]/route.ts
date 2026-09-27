import { ok, withApi } from '@/modules/infra'
import { getSchemaDto, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ engineId: string }> }

/** #103 Configuration Schema(configuration-resolution §5 규격). */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  await requireCapability('config.raw.read')
  const { engineId } = await ctx.params
  return ok(getSchemaDto(engineId))
})
