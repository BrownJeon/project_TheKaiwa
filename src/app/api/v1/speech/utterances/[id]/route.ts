import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getUtteranceView, parseResolveBody, resolveFinalText } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #22 발화·분석 결과(task-012b, 화면은 012b-2) — 소유자만(타인·없음 404, 세션 없음 401). 엔진 정보는 싣지 않는다.
 * 분석 전이면 analysisText·transcriptConfidence 는 null. 사용자당 60/분.
 */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  rateLimit(`utterance-view:${s.user.id}`, 60)
  const { id } = await ctx.params
  return ok(await getUtteranceView(s.user.id, id))
})

/**
 * #21a 재확인 발화의 텍스트 확정 — `{choice:'REALTIME'|'ANALYSIS'|'USER', text?}`(USER 만 text 1~1,000자). 조건부 갱신 1회:
 * `status=ANALYZED AND requiresReview=true` 인 내 발화만 → finalText·finalSource=고른 출처·requiresReview=false. 없음·타인 404,
 * 분석 전·재확인 대상 아님·이미 확정 409 NOT_REVIEWABLE, 고른 안이 비었으면 400. **Utterance 만 바뀐다**(채팅 메시지·교정 원문·평가 답 불변).
 * 응답은 #22 형태. 사용자당 30/분.
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  rateLimit(`utterance-resolve:${s.user.id}`, 30)
  const { id } = await ctx.params
  const input = parseResolveBody(await readJsonObject(req, 8 * 1024))
  return ok(await resolveFinalText(s.user.id, id, input))
})
