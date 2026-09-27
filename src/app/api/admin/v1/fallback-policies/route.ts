import { ok, withApi } from '@/modules/infra'
import { listFallbackPolicyDtos, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #99 역할별 fallback(+ Router 가 지금 도는 순서 effectiveOrder). */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('engine.read')
  return ok(await listFallbackPolicyDtos(viewEnvironment(actor, req.nextUrl.searchParams.get('environment'))))
})
