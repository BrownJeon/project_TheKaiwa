import { ok, requireSession, withApi } from '@/modules/infra'
import { setWordArchived } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #45 보관 — 나에게만 숨김(기본 단어도, task-068 D6 — `UserWordState` 만 쓴다). 목록·세트 풀·평가 재료에서 빠진다. 이미 보관이면 그대로. */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await setWordArchived(s.user.id, id, true))
})
