import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseReplyPracticeBody, suggestReply } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** 분당·하루 상한(프로세스 메모리 고정 창) — 단일 LLM 슬롯을 연습 호출이 독차지하지 않게. */
const REPLY_PRACTICE_PER_MINUTE = 10
const REPLY_PRACTICE_PER_DAY = 300

/**
 * #169 역할극 대답 연습(task-010d A3b-2, 가이드 S10) — **저장 없음**. 본문 `{messageId}`(그 대화의 마지막 DONE 선생님 말).
 * 응답 `{messageId, ja, ko, blank?{start,end}(코드포인트), choices?[3], answerIndex?, hintKo?}` — 고르기 세트(blank·choices·answerIndex)는 통째로 있거나 없다.
 * 오류: 401 · 남의·없는·역할극 아닌 대화 404 · 400 본문 · 409 `ENDED`·`TURN_RUNNING`·`NOT_LATEST`·`PRACTICE_BUSY`·`CANCELLED`(손님이 끊음 — 읽을 쪽이 없다) · 429 · 502/504(엔진 실패·12초).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const { messageId } = parseReplyPracticeBody(await readJsonObject(req, 1024))
  // 본문 형태 400 은 DB 를 읽지 않으니 한도를 쓰지 않는다. 404·409 는 DB 를 읽는 거절이라 한도 안에 둔다(REV-142 L-4).
  rateLimit(`reply-practice:${s.user.id}`, REPLY_PRACTICE_PER_MINUTE)
  rateLimit(`reply-practice-day:${s.user.id}`, REPLY_PRACTICE_PER_DAY, 86_400_000)
  // `req.signal`: 화면이 12초 시간 초과·방 이탈로 끊으면 엔진 호출(큐 대기 포함)을 멈춘다 — 안 그러면 취소된 호출이 단일 CLI 슬롯과 사용자 동시 1건 잠금을 쥐고 있다.
  // 잠금은 실행 중이면 abort 즉시, 큐 대기 중이면 차례가 올 때 풀린다(재시도도 같은 큐 뒤에 서므로 수용).
  return ok(await suggestReply(s.user.id, id, messageId, undefined, req.signal), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
