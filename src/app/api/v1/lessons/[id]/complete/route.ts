import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { completeLesson, parseCompleteBody } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #62 레슨 완료 — **한 트랜잭션**: 서버 재채점(body score 무시) + RepetitionItem 등록/갱신 + Lesson DONE + StudyLog(LESSON, DIRECT) +
 * StatsSnapshot(LESSON) + DAILY(lessons+1). 두 번째 완료 409(행 변화 0), stageDone < 4 는 409 STAGES_LEFT.
 * `reviewDecisionJobId`·`nextReview` 는 task-010b 전까지 null.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  parseCompleteBody(await readJsonObject(req, 4 * 1024))
  return ok(await completeLesson(s.user.id, id))
})
