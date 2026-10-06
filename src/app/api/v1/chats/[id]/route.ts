import { ok, parseLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { deleteChat, parseTitle, updateChatTitle } from '@/modules/conversation'
import { chatDetailResponse } from '../_lib/chatDetail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #29 채팅 + 메시지(`after` 폴링 / `cursor` 이전 / 기본 최근 50건 오름차순). 남의 채팅은 404.
 * task-007: USER 메시지에 `utteranceId`·`audioAvailable`(발화는 speech 테이블 — 이 라우트가 조합, conversation 은 Utterance 를 읽지 않는다).
 * TALK 방 첫 조회(폴링 `after` 아님)는 LLM 을 예열한다(응답을 기다리지 않는다 — K2-1, 명시적 warm 라우트 없음). 마친 역할극은 예열하지 않는다(A3b-2).
 * task-010d: 상황 역할극 대화면 `chat.scenario`(S6 — 진행 값·마친 결과는 폴링에도 싣는다, 다음 상황·수업 제목은 첫 조회에만). 조합은 `_lib/chatDetail.ts`.
 */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const q = req.nextUrl.searchParams
  return ok(await chatDetailResponse(s.user.id, id, { after: q.get('after'), cursor: q.get('cursor'), limit: parseLimit(q.get('limit'), 50, 100) }))
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
