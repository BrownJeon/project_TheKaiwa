import { ok, withApi } from '@/modules/infra'
import { getTraceDto, requireCapability, viewEnvironment } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ traceId: string }> }

/** #129 Trace 상세(단계 ms·상태·모델·connection — 원문 없음). */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const actor = await requireCapability('trace.read')
  const { traceId } = await ctx.params
  return ok(await getTraceDto(viewEnvironment(actor, req.nextUrl.searchParams.get('environment')), traceId))
})
