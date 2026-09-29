import { ok, readJsonObject, withApi } from '@/modules/infra'
import { getFallbackPolicyDto, requireCapability, roleParam, updateFallbackPolicy, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ role: string }> }

/** #99a 역할 단건. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.read')
  const { role } = await ctx.params
  return ok(await getFallbackPolicyDto(viewEnvironment(actor, req.nextUrl.searchParams.get('environment')), roleParam(role)))
})

/**
 * #100 Fallback 편집 — `{primaryConnectionId?, fallbackConnectionIds?, enabled?, baseVersion, reason, confirm?, summaryHash?, testResultId?}`.
 * 같은 환경·같은 역할·켜진 연결만, 중복 없음, 예비 ≤4. PRODUCTION 은 새 주 연결·새 예비 연결 기능 테스트 결과 필요(끄기 면제).
 */
export const PUT = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.connections.manage')
  const { role } = await ctx.params
  const r = await updateFallbackPolicy(actor, roleParam(role), await readJsonObject(req))
  return ok(r, null, { status: r.changed ? 201 : 200 })
})
