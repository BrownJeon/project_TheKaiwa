import { ok, withApi } from '@/modules/infra'
import { getOverview, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #80 대시보드 — 역할별 활성 connection·모델·상태·Voice 수·설정 활동·24h 턴·최근 Health. */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('engine.read')
  return ok(await getOverview(viewEnvironment(actor, req.nextUrl.searchParams.get('environment'))))
})
