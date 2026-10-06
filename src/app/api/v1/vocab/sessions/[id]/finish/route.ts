import { ok, requireSession, withApi } from '@/modules/infra'
import { afterStudyCompleted, challengeProgressAfter, finishVocabSessionDetailed } from '@/modules/learning'
import { reviewDecisionDriver } from '../../../../_lib/review'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #51 끝내기 — 단일 트랜잭션(반복 항목 WORD·주제 카드 CHUNK|EXPRESSION·카드별 관측 포함, task-010b·042), 이미 끝났으면 같은 응답(멱등), 답 0장이면 ABANDONED(기록 없음).
 * 이번 호출이 세트를 끝냈을 때만 트랜잭션 **뒤** 강사 복습 판단(A11) 잡을 건다(응답은 기다리지 않고 형태도 그대로).
 * 응답 `challenge`(task-042, additive): 커밋 **뒤** 진행 중 챌린지에서 이 세트가 세어졌는지 읽는다 — 내 단어장 세트·다른 주제·기간 밖·
 * ABANDONED 와 계산 실패는 null(끝내기는 그대로). 같은 스냅샷을 읽으므로 멱등 재호출도 같은 값이다(`goalMetNow` 는 완료 순서 기준).
 * 트랜잭션에는 챌린지 쓰기가 없다(설계서 §5-4).
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  const r = await finishVocabSessionDetailed(userId, id)
  if (r.finishedNow && r.repetitionItems > 0) await afterStudyCompleted(userId, { trigger: 'WORDS' }, reviewDecisionDriver(userId))
  const challenge = r.result.session.status === 'DONE' && r.result.session.topic ? await challengeProgressAfter(userId, { kind: 'VOCAB_SESSION', refId: id }) : null
  return ok({ ...r.result, challenge })
})
