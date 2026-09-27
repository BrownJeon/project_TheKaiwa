import { ok, withApi } from '@/modules/infra'
import { getEnvironmentInfo, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #81 현재 APP_ENV·보호 정책(배지). */
export const GET = withApi(async () => {
  const actor = await requireCapability('console.access')
  return ok(await getEnvironmentInfo(actor.environment))
})
