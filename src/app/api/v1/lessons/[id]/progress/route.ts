import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseProgressBody, updateLessonProgress } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #61 단계 진행 저장 — `{stageDone?, progress?}`. stageDone 0~5 단조 증가(줄이면 400), progress 는 클라이언트 칸(listen.segmentsDone·played·memo,
 * quiz.answers(첫 답 고정), application.answers)만 ≤8KB. DONE 409·열리지 않은 레슨 409. READY → IN_PROGRESS. 응답 = #60 Lesson.
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const body = parseProgressBody(await readJsonObject(req, 16 * 1024))
  return ok(await updateLessonProgress(s.user.id, id, body))
})
