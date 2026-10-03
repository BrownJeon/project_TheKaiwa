import { ok, requireSession, withApi } from '@/modules/infra'
import { afterStudyCompleted, finishVocabSessionDetailed } from '@/modules/learning'
import { reviewDecisionDriver } from '../../../../_lib/review'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #51 끝내기 — 단일 트랜잭션(반복 항목 WORD·카드별 관측 포함, task-010b), 이미 끝났으면 같은 응답(멱등), 답 0장이면 ABANDONED(기록 없음).
 * 이번 호출이 세트를 끝냈을 때만 트랜잭션 **뒤** 강사 복습 판단(A11) 잡을 건다(응답은 기다리지 않고 형태도 그대로).
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  const r = await finishVocabSessionDetailed(userId, id)
  if (r.finishedNow && r.repetitionItems > 0) await afterStudyCompleted(userId, { trigger: 'WORDS' }, reviewDecisionDriver(userId))
  return ok(r.result)
})
