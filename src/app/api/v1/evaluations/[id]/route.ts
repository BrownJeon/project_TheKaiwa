import { ok, requireSession, withApi } from '@/modules/infra'
import { findEvaluationLevelProposal } from '@/modules/conversation'
import { getEvaluation } from '@/modules/learning'
import { voicedEvaluationItems } from '@/modules/speech'
import { withVoiced } from '../../_lib/evaluationVoiced'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #66 평가 상세 — 소유자만(타인·없음 404). READY·IN_PROGRESS·GRADING 에서는 문항별 정답(`expected`)·`score`·`feedback`·`dims` 를 싣지 않고,
 * 듣고 답하기는 들려줄 문장 없이 `{instructionKo, textHidden:true}`(소리는 #67a). DONE 이면 전부 공개 + `result`
 * `{totalScore, grade, rubric, comment, nextFocus, studyLogId, completedAt, overtime, durationSec, levelProposal}` — `levelProposal` 은
 * 이 평가가 만든 SET_LEVEL 제안(conversation 소유라 라우트가 붙인다, 없으면 null). GENERATING·GRADING 이면 `jobId`(#55 폴링).
 * `items[].voiced`(task-012b-2 D-2): 답이 녹음에서 왔는가 — 음성 출처면 true, 글자(TEXT) 답은 speech 가 연결된 녹음과 답 글을 대조해 정한다
 * (#21a 로 직접 고친 글이 채점에 쓰이면 TEXT 로 남기 때문 — D-B7). learning → speech import 가 없도록 여기서 조합한다(판정 `_lib/evaluationVoiced`).
 * 대조가 실패하면 `voiced` 칸 없이(옛 응답 모양) 응답한다 — 부가 정보 때문에 평가 결과가 500 이 되지 않게(REV-132 L-2).
 */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const dto = await getEvaluation(s.user.id, id)
  const result = dto.result ? { ...dto.result, levelProposal: await findEvaluationLevelProposal(s.user.id, dto.id) } : null
  const items = await withVoiced(s.user.id, dto.items, voicedEvaluationItems)
  return ok({ ...dto, items, result }, null, { headers: { 'Cache-Control': 'private, no-store' } })
})
