import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getOwnedChat, prewarmTalkTurn } from '@/modules/conversation'
import { issueSpeechTicket, parseTicketRequest, SttUnavailableError } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #20 WS 60초 티켓 `{ticket, expiresAt, wsPath, sampleRate, frameMs}` — 본문 `{chatId?, purpose?: TURN|MIC_TEST}`(M1).
 * chatId 는 소유자만(타인 404). 서버 경로 인식을 쓸 수 없으면 422 ENGINE_UNAVAILABLE(`details.reason:"STT_UNAVAILABLE"`). 사용자당 20/분.
 * task-007: TALK 방의 TURN 티켓이면 LLM 예열을 건다(말하는 동안 CLI 가 뜬다).
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`speech-ticket:${s.user.id}`, 20)
  const body = parseTicketRequest(await readJsonObject(req, 1024))
  if (body.chatId) {
    // 소유자 확인은 읽기 1회(getOwnedChat) — 누름 → 녹음 시작 경로라 메시지·stale 정리까지 하는 #29 조회를 쓰지 않는다(task-007 실측: 커밋이 겹치면 1.5s).
    const chat = await getOwnedChat(s.user.id, body.chatId)
    // 푸시투토크를 누른 순간 — 말하는 동안 LLM 을 예열한다(K2-1, 응답을 기다리지 않는다). TALK 방·TURN 티켓만.
    if (body.purpose === 'TURN' && chat.kind === 'TALK') void prewarmTalkTurn(s.user.id, chat)
  }
  try {
    return ok(await issueSpeechTicket(s.user.id, body), null, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof SttUnavailableError) throw new ApiError('ENGINE_UNAVAILABLE', e.userMessage, { reason: 'STT_UNAVAILABLE' })
    throw e
  }
})
