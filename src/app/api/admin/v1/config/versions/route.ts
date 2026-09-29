import { ok, withApi } from '@/modules/infra'
import { listConfigVersions, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #108 설정 버전 목록 — `?scope=&targetId=&status=&limit=&cursor=&environment=` · 항목에 origin·integrity(손상 여부)·대상 이름. */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('config.effective.read')
  return ok(await listConfigVersions(actor, req.nextUrl.searchParams))
})
