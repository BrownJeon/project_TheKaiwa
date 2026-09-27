import { ok, withApi } from '@/modules/infra'
import { listPluginDtos, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #121 Plugin Registry(코드 로드 상태·initError·orphan). */
export const GET = withApi(async () => {
  const actor = await requireCapability('plugins.read')
  return ok(await listPluginDtos(actor.environment))
})
