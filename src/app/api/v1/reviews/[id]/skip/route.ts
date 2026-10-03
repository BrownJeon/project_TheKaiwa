import { ok, requireSession, withApi } from '@/modules/infra'
import { skipReview } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #64 오늘 복습 건너뛰기 — 본문 없음. `{id, status:'SKIPPED', resolvedAt}`. 소유자만(404), DUE 만(409 `NOT_DUE`), 하던 복습 레슨(IN_PROGRESS)이
 * 있으면 409 `IN_PROGRESS`. 항목은 그대로 due 라 다음 학습일에 코드가 다시 DUE 세션을 만든다.
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await skipReview(s.user.id, id))
})
