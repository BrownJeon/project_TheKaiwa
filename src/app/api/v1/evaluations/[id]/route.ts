import { ok, requireSession, withApi } from '@/modules/infra'
import { findEvaluationLevelProposal } from '@/modules/conversation'
import { getEvaluation } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #66 평가 상세 — 소유자만(타인·없음 404). READY·IN_PROGRESS·GRADING 에서는 문항별 정답(`expected`)·`score`·`feedback`·`dims` 를 싣지 않고,
 * 듣고 답하기는 들려줄 문장 없이 `{instructionKo, textHidden:true}`(소리는 #67a). DONE 이면 전부 공개 + `result`
 * `{totalScore, grade, rubric, comment, nextFocus, studyLogId, completedAt, overtime, durationSec, levelProposal}` — `levelProposal` 은
 * 이 평가가 만든 SET_LEVEL 제안(conversation 소유라 라우트가 붙인다, 없으면 null). GENERATING·GRADING 이면 `jobId`(#55 폴링).
 */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const dto = await getEvaluation(s.user.id, id)
  const result = dto.result ? { ...dto.result, levelProposal: await findEvaluationLevelProposal(s.user.id, dto.id) } : null
  return ok({ ...dto, result }, null, { headers: { 'Cache-Control': 'private, no-store' } })
})
