import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseAttemptBody, recordAttempt } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #50 카드 답(서버 채점) — `order` 멱등(재전송은 첫 결과), 답 없이 `{order, flagged}` 면 표시만(E2·F9). 끝난 세트 409. */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const input = parseAttemptBody(await readJsonObject(req))
  return ok(await recordAttempt(s.user.id, id, input))
})
