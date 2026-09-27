import { ok, withApi } from '@/modules/infra'
import { getEffectiveConfig, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #102 Effective Configuration(8층, 읽기 전용) — ADMIN 은 값+Source+shadowed, DEVELOPER 이상은 sourceRef·layers. SECRET 은 ref 이름만. */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('config.effective.read')
  const q = req.nextUrl.searchParams
  return ok(await getEffectiveConfig(actor, viewEnvironment(actor, q.get('environment')), { scope: q.get('scope'), targetId: q.get('targetId'), context: q.get('context') }))
})
