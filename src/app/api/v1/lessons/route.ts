import { ApiError, dates, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { buildLearnerHeader, buildLessonRequest, LessonInputError, lessonPromptVersion, recentAcceptedCorrections } from '@/modules/conversation'
import { createLesson, loadLessonMaterials, parseCreateLessonBody } from '@/modules/learning'
import { lessonInputErrorField, lessonInputFor, lessonInputMeta } from './_lib/lessonInput'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #59 레슨 생성(A4 잡) — `{topicId}` 또는 `{sourceText}`, 또는 상황 수업 `{scenarioId, topicId?}`(task-010d A2). 라우트가 조합한다(module-dependency §4-4):
 *   learning 재료(주제·조각·이전 제목 ≤5·직전 예고 / 상황 행·대표 주제) + conversation 읽기(학습자 헤더·최근 채택 교정 ≤5)
 *   → conversation `buildLessonRequest`(프롬프트·스키마·후검증, 상황 수업은 `[상황]` 블록) → learning `createLesson`(점유 트랜잭션 + 백그라운드 잡).
 * 오늘 같은 수업(주제·상황 둘 다 같은)이 있으면 그것(`reused:true`, 새 잡 없음). 다른 생성이 진행 중이면 409 `{jobId, lessonId}`. 사용자당 분당 10.
 * 상황: 남의·없는 상황 404, 숨긴 상황 409 `ARCHIVED`, 이어지지 않은 `topicId` 400 `not_linked`, `sourceText` 와 함께 400 `not_with_scenario`.
 * 응답 `{lessonId, jobId, status, reused}` — jobId 로 #55 폴링, DONE 이면 #60.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const userId = s.user.id
  rateLimit(`lesson-create:${userId}`, 10)
  const input = parseCreateLessonBody(await readJsonObject(req, 16 * 1024))
  const m = await loadLessonMaterials(userId, input)
  const [learner, corrections] = await Promise.all([buildLearnerHeader(userId, null), recentAcceptedCorrections(userId, 5)])
  const lessonInput = lessonInputFor(m, { todayKst: dates.todayKst(), learner, corrections })
  let request: ReturnType<typeof buildLessonRequest>
  try {
    request = buildLessonRequest(lessonInput)
  } catch (e) {
    if (e instanceof LessonInputError) throw new ApiError('VALIDATION', e.userMessage, { field: lessonInputErrorField(input), reason: 'LESSON_INPUT' })
    throw e
  }
  const inputMeta = lessonInputMeta(m, lessonInput, request)
  return ok(await createLesson(userId, m, { request, promptVersion: lessonPromptVersion(lessonInput), inputMeta }))
})
