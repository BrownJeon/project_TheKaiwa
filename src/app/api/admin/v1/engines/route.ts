import { ok, withApi } from '@/modules/infra'
import { hasCapability, listEngineDtos, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #90 Engine descriptor(+ `includeSchema=true` 는 config.raw.read 보유 시에만 schema, 아니면 null). */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('engine.read')
  const q = req.nextUrl.searchParams
  const includeSchema = q.get('includeSchema') === 'true' && hasCapability(actor, 'config.raw.read')
  return ok(await listEngineDtos(viewEnvironment(actor, q.get('environment')), includeSchema))
})
