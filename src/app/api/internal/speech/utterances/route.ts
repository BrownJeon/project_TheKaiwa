import { checkInternalSecret, fail, ok, rateLimit, readJsonObject, withApi } from '@/modules/infra'
import { getOwnedChat } from '@/modules/conversation'
import { parseGatewayBody, registerGatewayUtterance } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const notFound = () => fail('NOT_FOUND', '요청한 항목을 찾을 수 없습니다.')

/**
 * gateway → 앱 발화 등록(api-contract §0-3 내부 콜백, gateway README §4). 사용자 세션 없음.
 * `X-Internal-Secret` 없으면 404(경로 존재 숨김), 틀리면 401 — `SPEECH_INTERNAL_SECRET`(TTS 시크릿과 별개), 상수 시간 비교.
 * 앱이 id·저장 경로를 정해 `Utterance(RECORDED)` 를 만들고 `{utteranceId, audioPath(DATA_ROOT 상대), status, expiresAt}` 를 돌려준다.
 * 본문 `chatId`(TURN 티켓 클레임 — 발급 때 소유 확인됨)는 여기서 한 번 더 티켓 사용자의 방인지 확인하고 `Utterance.chatId` 로 남긴다(task-018 ①).
 * 아니면 404 — gateway 는 4xx 를 재시도하지 않고 wav 를 `_orphan` 으로, 클라는 `utteranceId:null` 로 글자 턴을 이어간다(gateway README §4).
 * 분석 잡 적재(task-012b)는 `registerGatewayUtterance` 가 #21 과 같은 게이트로 같은 쓰기에서 한다(응답 `analysisQueued` 는 gateway 가 읽지 않는 추가 필드).
 * 폭주 방지 600/분(전체). 본문에 원음 없음(경로도 받지 않는다).
 */
export const POST = withApi(async (req) => {
  const auth = checkInternalSecret(req.headers)
  if (auth === 'MISSING') return notFound()
  if (auth === 'INVALID') return fail('UNAUTHENTICATED', '인증에 실패했습니다.')
  rateLimit('internal:speech-utterances', 600)
  const input = parseGatewayBody(await readJsonObject(req, 64 * 1024))
  if (input.chatId) await getOwnedChat(input.userId, input.chatId)
  return ok(await registerGatewayUtterance(input))
})

// 다른 메서드도 405 대신 404 — 경로가 있다는 힌트를 주지 않는다.
export const GET = async () => notFound()
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
