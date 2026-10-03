import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { afterStudyCompleted, completeLessonDetailed, parseCompleteBody } from '@/modules/learning'
import { utteranceConfidences } from '@/modules/speech'
import { reviewDecisionDriver } from '../../../_lib/review'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #62 레슨 완료 — **한 트랜잭션**: 서버 재채점(body score 무시) + RepetitionItem 등록/갱신(복습 레슨은 mixSpec 항목 studiedCount+1·세션 DONE) +
 * Lesson DONE + StudyLog(LESSON|REVIEW, DIRECT) + StatsSnapshot(LESSON) + DAILY(lessons|reviews +1) + 학습 관측(말하기 발화 신뢰도는 speech 에서).
 * 두 번째 완료 409(행 변화 0), stageDone < 4 는 409 STAGES_LEFT.
 * 트랜잭션 **뒤** 강사 복습 판단(A11) 잡을 건다 — `reviewDecisionJobId`(#55 폴링 → 끝나면 #60 `nextReview`), 걸리지 않으면 `nextReview` 폴백 묶음 또는 null.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  parseCompleteBody(await readJsonObject(req, 4 * 1024))
  const done = await completeLessonDetailed(userId, id, { utteranceConfidence: (ids) => utteranceConfidences(userId, ids) })
  const review = await afterStudyCompleted(userId, { trigger: done.kind === 'REVIEW' ? 'REVIEW' : 'LESSON', lesson: { id, itemIds: done.itemIds } }, reviewDecisionDriver(userId))
  return ok({ ...done.result, ...review })
})
