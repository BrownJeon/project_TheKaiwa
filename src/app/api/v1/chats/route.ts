import { ok, parseLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { createChat, createRolePlayChat, listChats, parseCreateChat, parseKind, parseRolePlayIds } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #27 대화 목록 — `lastMessageAt desc`, `running` = 진행 중 턴 여부. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  const kind = q.get('kind') ? parseKind(q.get('kind')) : undefined
  return ok(await listChats(s.user.id, { kind, limit: parseLimit(q.get('limit'), 20, 100), cursor: q.get('cursor') }))
})

/**
 * #28 대화 만들기 — ASK(task-064)는 `kind`·`title` 만(그 밖 키 400, 제목 생략 = 「새 질문」). `scenarioId`·`lessonId` 가 있으면 상황 역할극(task-010d):
 * TALK 만(CHAT 400), 남의 상황·레슨 404, 숨긴 상황 409 `ARCHIVED`, 첫마디가 있으면 선생님 첫 메시지를 함께 저장한다(LLM 0회).
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const body = await readJsonObject(req)
  const input = parseCreateChat(body)
  const rolePlay = parseRolePlayIds(body)
  if (rolePlay.scenarioId !== null || rolePlay.lessonId !== null) return ok(await createRolePlayChat(s.user.id, { ...input, ...rolePlay }))
  return ok(await createChat(s.user.id, input))
})
