import { ok, requireSession, withApi } from '@/modules/infra'
import { setWordArchived } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #45 보관 풀기 — 나의 `UserWordState` 만 바꾼다(기본 단어 포함). */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await setWordArchived(s.user.id, id, false))
})
