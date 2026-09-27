import { ok, parseLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { createChat, listChats, parseCreateChat, parseKind } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #27 대화 목록 — `lastMessageAt desc`, `running` = 진행 중 턴 여부. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  const kind = q.get('kind') ? parseKind(q.get('kind')) : undefined
  return ok(await listChats(s.user.id, { kind, limit: parseLimit(q.get('limit'), 20, 100), cursor: q.get('cursor') }))
})

/** #28 대화 만들기 — ASK·레슨·시나리오는 400 FEATURE_NOT_READY. */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  return ok(await createChat(s.user.id, parseCreateChat(await readJsonObject(req))))
})
