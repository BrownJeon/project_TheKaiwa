import { ok, withApi } from '@/modules/infra'
import { getVoiceDto, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #82a Voice 상세. */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  await requireCapability('voices.read')
  const { id } = await ctx.params
  return ok(await getVoiceDto(id))
})
