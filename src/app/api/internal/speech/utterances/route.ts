import { checkInternalSecret, fail, ok, rateLimit, readJsonObject, withApi } from '@/modules/infra'
import { parseGatewayBody, registerGatewayUtterance } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const notFound = () => fail('NOT_FOUND', '요청한 항목을 찾을 수 없습니다.')

/**
 * gateway → 앱 발화 등록(api-contract §0-3 내부 콜백, gateway README §4). 사용자 세션 없음.
 * `X-Internal-Secret` 없으면 404(경로 존재 숨김), 틀리면 401 — `SPEECH_INTERNAL_SECRET`(TTS 시크릿과 별개), 상수 시간 비교.
 * 앱이 id·저장 경로를 정해 `Utterance(RECORDED)` 를 만들고 `{utteranceId, audioPath(DATA_ROOT 상대), status, expiresAt}` 를 돌려준다.
 * 폭주 방지 600/분(전체). 본문에 원음 없음(경로도 받지 않는다).
 */
export const POST = withApi(async (req) => {
  const auth = checkInternalSecret(req.headers)
  if (auth === 'MISSING') return notFound()
  if (auth === 'INVALID') return fail('UNAUTHENTICATED', '인증에 실패했습니다.')
  rateLimit('internal:speech-utterances', 600)
  const input = parseGatewayBody(await readJsonObject(req, 64 * 1024))
  return ok(await registerGatewayUtterance(input))
})

// 다른 메서드도 405 대신 404 — 경로가 있다는 힌트를 주지 않는다.
export const GET = async () => notFound()
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
