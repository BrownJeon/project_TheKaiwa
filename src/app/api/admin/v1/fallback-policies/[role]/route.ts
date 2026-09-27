import { ok, withApi } from '@/modules/infra'
import { getFallbackPolicyDto, requireCapability, roleParam, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ role: string }> }

/** #99a 역할 단건. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('engine.read')
  const { role } = await ctx.params
  return ok(await getFallbackPolicyDto(viewEnvironment(actor, req.nextUrl.searchParams.get('environment')), roleParam(role)))
})
