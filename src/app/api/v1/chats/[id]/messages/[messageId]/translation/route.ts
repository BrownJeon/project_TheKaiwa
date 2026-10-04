import { ok, rateLimit, requireSession, withApi } from '@/modules/infra'
import { retryUserTranslation } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Ctx = { params: Promise<{ id: string; messageId: string }> }

/**
 * #32t 내 말 번역 다시 가져오기(task-026 S2) → `{ messageId, translation, cached }`. USER 메시지만(`400`), 남의 것·없음 `404`,
 * 이미 번역이 있으면 LLM 없이 그대로, 그 방 턴 진행 중·같은 사용자 동시 요청 `409`, 사용자당 분당 20회(`429`).
 * 번역을 못 가져오면 `502 ENGINE_ERROR`·`504 ENGINE_TIMEOUT`·`422 ENGINE_UNAVAILABLE`(모두 재시도 가능, 저장 없음).
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id, messageId } = await ctx.params
  rateLimit(`user-translation:${s.user.id}`, 20)
  return ok(await retryUserTranslation(s.user.id, id, messageId), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
