import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { readLessonTranslationBody, translateLessonSpeech } from '@/modules/conversation'
import { assertOwnedLesson } from '@/modules/learning'
import type { LessonSpeakingTranslation } from '@/types/lesson'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Ctx = { params: Promise<{ id: string }> }

/** 분당 상한(프로세스 메모리 고정 창) — #32t 와 같은 값이지만 **키는 따로**다: 레슨 번역·회화방 번역·도우미(#180·#181·#184)가 서로의 한도를 쓰지 않는다. */
const LESSON_TRANSLATION_PER_MINUTE = 20

/**
 * #185 오늘의 회화 ⑤ 「내가 한 말」 번역(task-077 IMP-0053, `userTranslation@v1` 재사용) — **저장 없음**. 본문 `{text}`(정리 뒤 1~1,000자, ≤8KB) → `{ko}`.
 * 순서(#180 과 같은 모양): 세션 401 → 본문 400(한도·DB·엔진 미접촉) → 한도 429 → 레슨 소유 404(남의·없는·형식이 잘못된 id, 상태는 묻지 않음 — learning 이 판정)
 * → 사용자당 동시 1건 409 `TRANSLATION_BUSY` → 엔진(502 `ENGINE_ERROR`·`TRANSLATION_REJECTED` · 504 · 422, 모두 다시 시도 가능).
 * `req.signal`: 화면이 12초 시간 초과·다음 과제·새 녹음으로 끊으면 엔진 호출을 멈추고 잠금을 푼다(409 `CANCELLED`, 손님이 읽지 않는 응답).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  const body = readLessonTranslationBody(await readJsonObject(req, 8 * 1024))
  rateLimit(`lesson-speaking-translation:${userId}`, LESSON_TRANSLATION_PER_MINUTE)
  await assertOwnedLesson(userId, id)
  const data: LessonSpeakingTranslation = await translateLessonSpeech(userId, id, body, undefined, req.signal)
  return ok(data, null, { headers: { 'Cache-Control': 'private, no-store' } })
})
