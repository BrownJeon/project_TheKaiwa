import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { keepVocabSession, parseKeepBody } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #52 세트 보관 `{kept}` — 끝낸 세트만(409). */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const kept = parseKeepBody(await readJsonObject(req))
  return ok(await keepVocabSession(s.user.id, id, kept))
})
