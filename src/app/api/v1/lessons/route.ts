import { ApiError, dates, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { buildLearnerHeader, buildLessonRequest, LESSON_PROMPT_VERSION, LessonInputError, recentAcceptedCorrections } from '@/modules/conversation'
import { createLesson, loadLessonMaterials, parseCreateLessonBody } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #59 레슨 생성(A4 잡) — `{topicId}` 또는 `{sourceText}`. 라우트가 조합한다(module-dependency §4-4):
 *   learning 재료(주제·조각·이전 제목 ≤5·직전 예고) + conversation 읽기(학습자 헤더·최근 채택 교정 ≤5)
 *   → conversation `buildLessonRequest`(프롬프트·스키마·후검증) → learning `createLesson`(점유 트랜잭션 + 백그라운드 잡).
 * 오늘 같은 주제 레슨이 있으면 그것(`reused:true`, 새 잡 없음). 다른 생성이 진행 중이면 409 `{jobId, lessonId}`. 사용자당 분당 10.
 * 응답 `{lessonId, jobId, status, reused}` — jobId 로 #55 폴링, DONE 이면 #60.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const userId = s.user.id
  rateLimit(`lesson-create:${userId}`, 10)
  const input = parseCreateLessonBody(await readJsonObject(req, 16 * 1024))
  const m = await loadLessonMaterials(userId, input)
  const [learner, corrections] = await Promise.all([buildLearnerHeader(userId, null), recentAcceptedCorrections(userId, 5)])
  let request: ReturnType<typeof buildLessonRequest>
  try {
    request = buildLessonRequest({
      todayKst: dates.todayKst(),
      learner,
      topic: m.topic ? { title: m.topic.title, titleJa: m.topic.titleJa, level: m.topic.level, chunks: m.topic.chunks.map((c) => ({ id: c.id, chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo })) } : null,
      sourceText: input.kind === 'text' ? input.sourceText : null,
      acceptedCorrections: corrections,
      previousTitles: m.previousTitles,
      previousNextPreview: m.previousNextPreview,
    })
  } catch (e) {
    if (e instanceof LessonInputError) throw new ApiError('VALIDATION', e.userMessage, { field: input.kind === 'text' ? 'sourceText' : 'topicId', reason: 'LESSON_INPUT' })
    throw e
  }
  const inputMeta = {
    source: input.kind,
    chunks: request.allowedChunkIds.length,
    skippedChunks: request.skippedChunks,
    sourceChars: input.kind === 'text' ? input.sourceText.length : null,
    corrections: corrections.length,
    previousTitles: m.previousTitles.length,
    previousPreview: m.previousNextPreview !== null,
  }
  return ok(await createLesson(userId, m, { request, promptVersion: LESSON_PROMPT_VERSION, inputMeta }))
})
