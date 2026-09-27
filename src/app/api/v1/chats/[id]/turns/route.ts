import { rateLimit, readJsonObject, requireSession, sseResponse, withApi } from '@/modules/infra'
import { parseTurnBody, startTurn } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #32 턴(SSE). 수락 전 실패(401·404·400·409·429)는 봉투 JSON, 수락 뒤에는 `accepted → status… → done|error` 스트림.
 * 스트림이 끊겨도 턴은 서버에서 끝까지 처리·저장된다(`startTurn` 이 연결과 무관한 promise 로 돈다 — §0-9).
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  rateLimit(`turn:${s.user.id}`, 12)
  const request = parseTurnBody(await readJsonObject(req, 16 * 1024))
  const turn = await startTurn({ userId: s.user.id, chatId: id, request })
  return sseResponse((ch) => turn.subscribe((e) => ch.send(e.event, e.data)))
})
