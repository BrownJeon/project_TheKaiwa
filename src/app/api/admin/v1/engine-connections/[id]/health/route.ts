import { ok, parseLimit, rateLimit, withApi } from '@/modules/infra'
import { listConnectionHealth, parseHealthKind, requireCapability, runConnectionHealth, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #95 Health Check 실행 — 대상은 현재 APP_ENV 의 connection 행, 주소는 저장된 설정(요청 본문 없음).
 * 서비스가 없으면 200 + `status:UNAVAILABLE`(500 아님). 사용자당 분당 30회.
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const actor = await requireCapability('health.run')
  const { id } = await ctx.params
  rateLimit(`admin-health:${actor.id}`, 30)
  return ok(await runConnectionHealth(actor, id))
})

/** #95a 최근 Health/Functional 결과(kind·limit ≤ 50). */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.read')
  const { id } = await ctx.params
  const q = req.nextUrl.searchParams
  return ok(await listConnectionHealth(viewEnvironment(actor, q.get('environment')), id, { kind: parseHealthKind(q.get('kind')), limit: parseLimit(q.get('limit'), 20, 50) }))
})
