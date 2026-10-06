import { ok, requireSession, withApi } from '@/modules/infra'
import { replayVocabSession } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #53 다시 풀기 — 보관한 DONE 세트만(F7), 같은 단어 목록으로 새 세트(삭제 단어 포함 시 FLIP). 진행 중 세트 있으면 409.
 * 주제 세트는 주제 세트로(task-042 — 카드 출처·새 단어를 그대로 복사, LLM 호출 없음).
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await replayVocabSession(s.user.id, id))
})
