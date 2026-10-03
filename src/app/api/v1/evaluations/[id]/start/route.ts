import { ok, requireSession, withApi } from '@/modules/infra'
import { startEvaluation } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #67b 평가 시작 — READY → IN_PROGRESS·`startedAt`(10분 시계). IN_PROGRESS 면 그대로(멱등), 그 밖 409. 응답 = #66 과 같은 상세(정답 숨김).
 * **데모 결정 (d)=B(2026-10-01 사용자 승인)** — 화면이 준비 화면의 [시작하기]에서 부른다(10분 시계는 이때 시작). #67 첫 답에서 시작하는
 * 경로도 남아 있어 `startedAt` 은 처음 한 번만 정해진다.
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await startEvaluation(s.user.id, id), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
