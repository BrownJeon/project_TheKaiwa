import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { helpLessonPhrase, readPhraseHelpBody } from '@/modules/conversation'
import { assertOwnedLesson } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 분당·하루 상한(프로세스 메모리 고정 창) — #180·#181 과 **같은 키·같은 값**이라 세 도우미가 합산된다(task-077 B3 A). 키를 바꾸면 합산이 깨진다(시험이 세 라우트를 대조). */
const PHRASE_HELP_PER_MINUTE = 10
const PHRASE_HELP_PER_DAY = 300

/**
 * #184 오늘의 회화 ⑤ 말하기의 일본어 도우미(task-077 IMP-0054, 회화방 일반 모드와 같은 `phraseHelp@v1`) — **저장 없음**. 본문 `{queryKo}`(#180 과 같은 검증, ≤1KB).
 * 응답 200 `{items:[{ja, ko, labelKo?, whyKo?}]}`(#180 과 같은 모양, 1~3개, 거절·못 찾음도 `items:[]`).
 * 오류: 401 · 400 본문(한도 미소모) · 남의·없는 레슨 404 · 409 `PHRASE_BUSY`(#180·#181 과 사용자당 동시 1건 공유)·`CANCELLED` · 429 · 502/504(엔진 실패·12초).
 *
 * #180 과의 차이: 대화 대신 레슨 소유만 본다(learning `assertOwnedLesson` — 레슨 상태는 묻지 않으므로 409 `ENDED` 가 없다) · 수준은 프로필 · 레슨 맥락(과제·목표 표현)은 프롬프트에 싣지 않는다.
 * 순서는 #180 과 같다: 세션(401) → 본문(400, DB 미접촉이라 한도 미소모) → 한도(429) → 소유(404, DB 를 읽는 거절이라 한도 안) → 잠금(409) → 엔진.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const body = readPhraseHelpBody(await readJsonObject(req, 1024))
  rateLimit(`phrase-help:${s.user.id}`, PHRASE_HELP_PER_MINUTE)
  rateLimit(`phrase-help-day:${s.user.id}`, PHRASE_HELP_PER_DAY, 86_400_000)
  await assertOwnedLesson(s.user.id, id)
  // `req.signal`: 화면이 12초 시간 초과·마이크 누름·다음 과제로 끊으면 엔진 호출(큐 대기 포함)을 멈춘다(#180 과 같다).
  return ok(await helpLessonPhrase(s.user.id, id, body, undefined, req.signal), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
