import { ApiError, ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getChatDetail } from '@/modules/conversation'
import { issueSpeechTicket, parseTicketRequest, SttUnavailableError } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #20 WS 60초 티켓 `{ticket, expiresAt, wsPath, sampleRate, frameMs}` — 본문 `{chatId?, purpose?: TURN|MIC_TEST}`(M1).
 * chatId 는 소유자만(타인 404). 서버 경로 인식을 쓸 수 없으면 422 ENGINE_UNAVAILABLE(`details.reason:"STT_UNAVAILABLE"`). 사용자당 20/분.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`speech-ticket:${s.user.id}`, 20)
  const body = parseTicketRequest(await readJsonObject(req, 1024))
  if (body.chatId) await getChatDetail(s.user.id, body.chatId, { limit: 1 })
  try {
    return ok(await issueSpeechTicket(s.user.id, body), null, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof SttUnavailableError) throw new ApiError('ENGINE_UNAVAILABLE', e.userMessage, { reason: 'STT_UNAVAILABLE' })
    throw e
  }
})
