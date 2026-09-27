import { ok, requireSession, withApi } from '@/modules/infra'
import { finishVocabSession } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #51 끝내기 — 단일 트랜잭션, 이미 끝났으면 같은 응답(멱등), 답 0장이면 ABANDONED(기록 없음). */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await finishVocabSession(s.user.id, id))
})
