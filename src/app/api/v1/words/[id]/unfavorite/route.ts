import { ok, requireSession, withApi } from '@/modules/infra'
import { setWordFavorite } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #183 즐겨찾기 풀기(task-074) — 나의 `UserWordState` 만 바꾼다(기본 단어 포함). 이미 아니면 그대로(상태 행을 새로 만들지 않음). 남의 단어 404. */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await setWordFavorite(s.user.id, id, false))
})
