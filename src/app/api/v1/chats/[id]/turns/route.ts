import { rateLimit, readJsonObject, requireSession, sseResponse, withApi } from '@/modules/infra'
import { parseTurnBody, startTurn, type TurnHooks } from '@/modules/conversation'
import { checkUtteranceForTurn, createTurnSpeaker, linkUtteranceToMessage, type TurnUtterance } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #32 턴(SSE). 수락 전 실패(401·404·400·409·429)는 봉투 JSON, 수락 뒤에는 `accepted → status… → audio…(TALK) → done|error` 스트림.
 * 스트림이 끊겨도 턴은 서버에서 끝까지 처리·저장된다(`startTurn` 이 연결과 무관한 promise 로 돈다 — §0-9).
 *
 * conversation 과 speech 는 서로 import 하지 않는다 — 이 라우트가 훅으로 잇는다(module-dependency §4-1):
 *  - `utteranceId`: 수락 전 speech 가 소유자·미연결·10분을 검사(404·409), 수락 직후 조건부 연결 + 고친 글자면 finalText=text(USER).
 *  - TALK 문장 음성: speech 의 턴 합성기(서명 URL·캐시·8초)를 conversation 의 speaker 자리에 넣는다.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  rateLimit(`turn:${userId}`, 12)
  const request = parseTurnBody(await readJsonObject(req, 16 * 1024))
  const hooks: TurnHooks = { speaker: (a) => createTurnSpeaker({ userId, messageId: a.assistantMessageId }) }
  if (!request.resume && request.utteranceId) {
    const utteranceId = request.utteranceId
    const text = request.text
    let utterance: TurnUtterance | null = null
    hooks.gate = async () => {
      utterance = await checkUtteranceForTurn(userId, utteranceId)
    }
    hooks.onAccepted = async (a) => {
      if (!utterance) return null
      const t = Date.now()
      const r = await linkUtteranceToMessage({ userId, utterance, messageId: a.userMessageId, text })
      return { name: 'UTTERANCE_LINK', ms: Date.now() - t, linked: r.linked, finalSourceUser: r.finalSourceUser, ...(r.linked ? {} : { warning: 'UTTERANCE_LINK_SKIPPED' }) }
    }
  }
  const turn = await startTurn({ userId, chatId: id, request, hooks })
  return sseResponse((ch) => turn.subscribe((e) => ch.send(e.event, e.data)))
})
