import { ok, requireSession, withApi } from '@/modules/infra'
import { setWordFavorite } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #182 즐겨찾기(task-074) — 나의 `UserWordState` 만 쓴다(기본 단어도, 보관과 독립). 이미 즐겨찾기면 그대로(`favoritedAt` 유지). 남의 단어 404. */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await setWordFavorite(s.user.id, id, true))
})
