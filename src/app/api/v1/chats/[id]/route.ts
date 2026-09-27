import { ok, parseLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { deleteChat, getChatDetail, parseTitle, updateChatTitle } from '@/modules/conversation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #29 채팅 + 메시지(`after` 폴링 / `cursor` 이전 / 기본 최근 50건 오름차순). 남의 채팅은 404. */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const q = req.nextUrl.searchParams
  return ok(await getChatDetail(s.user.id, id, { after: q.get('after'), cursor: q.get('cursor'), limit: parseLimit(q.get('limit'), 50, 100) }))
})

/** #30 제목 바꾸기(1~100 코드포인트). */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const title = parseTitle((await readJsonObject(req)).title, { required: true }) as string
  return ok(await updateChatTitle(s.user.id, id, title))
})

/** #31 삭제(메시지·교정 cascade, StudyLog·StatsSnapshot 은 남는다). */
export const DELETE = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await deleteChat(s.user.id, id))
})
