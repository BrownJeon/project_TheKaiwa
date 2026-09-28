import { ok, rateLimit, readJsonObject, requireSession, withApi, withTransaction } from '@/modules/infra'
import { checkLessonSpeaking, lockLessonForWrite, parseSpeakingBody, saveSpeakingAttempt, speakingModel } from '@/modules/learning'
import { linkUtteranceToLesson } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #62b 말하기 확인(task-010 L1 — **LLM 없음**) — `{itemId, text, utteranceId?}`. 코드가 목표 표현 포함만 느슨하게 본다(표기·읽기, 가타카나→히라가나,
 * 공백·구두점 무시, 정중형·사전형 어미 조금 허용). **한 트랜잭션**: 레슨 잠금(사용자 → 레슨) → 과제 확인(없으면 400) →
 * `utteranceId` 가 오면 speech 가 소유·미사용·같은 레슨을 확인하고 `Utterance.lessonId` 연결 → `progress.speaking[]` 기록(같은 과제는 교체).
 * 응답 `{itemId, used, matchedIds, missedIds, unknownIds, modelAnswer:{ja,reading,ko}, utteranceId, hasAudio}` — 원음 재생은 기존 #21b.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  rateLimit(`lesson-speaking:${userId}`, 30)
  const body = parseSpeakingBody(await readJsonObject(req, 8 * 1024))
  return ok(
    await withTransaction(async (tx) => {
      const h = await lockLessonForWrite(tx, userId, id)
      const check = checkLessonSpeaking(h, body.itemId, body.text)
      const link = body.utteranceId ? await linkUtteranceToLesson(userId, body.utteranceId, h.row.id, tx) : null
      await saveSpeakingAttempt(tx, h, { check, text: body.text, utteranceId: link?.id ?? null })
      return { ...check, modelAnswer: speakingModel(h, body.itemId), utteranceId: link?.id ?? null, hasAudio: link?.hasAudio ?? false }
    }),
  )
})
