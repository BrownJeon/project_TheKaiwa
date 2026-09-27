import { ok, requireSession, withApi } from '@/modules/infra'
import { reviewChat } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 동기 점검은 LLM 90s 예산 — 플랫폼 상한이 있는 배포에서도 끊기지 않게(자체 호스팅 next start 는 상한 없음).
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

/**
 * #33 표현 점검(A3). 사용자 메시지 ≤20건은 동기(결과), 초과는 `{ jobId }`(#55 로 폴링 후 #34·#37 조회).
 * 이미 점검 `409 ALREADY_REVIEWED`, 진행 중 `409 CONFLICT {jobId}`, 사용자 메시지 0건 400. 클라이언트가 떠나도 끝까지 저장한다(D3).
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const r = await reviewChat(s.user.id, id)
  return ok(r.mode === 'sync' ? r.result : { jobId: r.jobId })
})
