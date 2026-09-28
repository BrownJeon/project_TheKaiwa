import { ok, requireSession, withApi } from '@/modules/infra'
import { startEvaluation } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #67b 평가 시작 — READY → IN_PROGRESS·`startedAt`(10분 시계). IN_PROGRESS 면 그대로(멱등), 그 밖 409. 응답 = #66 과 같은 상세(정답 숨김).
 * **사용자 결정 (d) 대기 훅(task-011 데모 v1)** — 권고 B("[시작하기] 누를 때 시계 시작")가 채택될 때만 화면이 부른다. 결정 전까지 화면은 쓰지 않고
 * 현 계약(#67 첫 답에서 IN_PROGRESS)대로 동작한다.
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await startEvaluation(s.user.id, id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
