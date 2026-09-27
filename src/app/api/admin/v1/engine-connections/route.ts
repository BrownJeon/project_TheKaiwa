import { ok, withApi } from '@/modules/infra'
import { listEngineConnections, parseEngineId, parseEngineRole, parseEngineStatus, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #91 Connection 목록(credentialRef 는 이름만, 시크릿 의심 값·서버 경로는 가림). `?environment=` 는 SUPER_ADMIN 만. */
export const GET = withApi(async (req) => {
  const actor = await requireCapability('engine.read')
  const q = req.nextUrl.searchParams
  const environment = viewEnvironment(actor, q.get('environment'))
  return ok(await listEngineConnections(environment, { role: parseEngineRole(q.get('role')), engineId: parseEngineId(q.get('engineId')), status: parseEngineStatus(q.get('status')) }))
})
