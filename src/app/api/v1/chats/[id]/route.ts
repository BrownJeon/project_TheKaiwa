import { ok, parseLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { chatRolePlayView, deleteChat, getChatDetail, parseTitle, prewarmTalkTurn, updateChatTitle } from '@/modules/conversation'
import type { RolePlayChatView } from '@/types/chat'
import { lessonRefFor, nextScenarioFor } from '../_lib/rolePlay'
import { utterancesForMessages } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #29 채팅 + 메시지(`after` 폴링 / `cursor` 이전 / 기본 최근 50건 오름차순). 남의 채팅은 404.
 * task-007: USER 메시지에 `utteranceId`·`audioAvailable`(발화는 speech 테이블 — 이 라우트가 조합, conversation 은 Utterance 를 읽지 않는다).
 * TALK 방 첫 조회(폴링 `after` 아님)는 LLM 을 예열한다(응답을 기다리지 않는다 — K2-1, 명시적 warm 라우트 없음).
 * task-010d: 상황 역할극 대화면 `chat.scenario`(S6 — 진행 값·마친 결과는 폴링에도 싣는다, 다음 상황·수업 제목은 첫 조회에만).
 */
export const GET = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const q = req.nextUrl.searchParams
  const after = q.get('after')
  const detail = await getChatDetail(s.user.id, id, { after, cursor: q.get('cursor'), limit: parseLimit(q.get('limit'), 50, 100) })
  if (!after && detail.chat.kind === 'TALK') void prewarmTalkTurn(s.user.id, detail.chat)
  const userIds = detail.messages.filter((m) => m.role === 'USER').map((m) => m.id)
  const [utt, rp] = await Promise.all([utterancesForMessages(s.user.id, userIds), detail.chat.kind === 'TALK' ? chatRolePlayView(s.user.id, id) : Promise.resolve(null)])
  let scenario: RolePlayChatView | null = null
  if (rp) {
    const { lessonId, ...view } = rp
    const [lesson, next] = after ? [undefined, undefined] : await Promise.all([lessonRefFor(s.user.id, lessonId), view.ended ? nextScenarioFor(s.user.id, view.id) : Promise.resolve(undefined)])
    scenario = { ...view, ...(lesson !== undefined ? { lesson } : {}), ended: view.ended && next ? { ...view.ended, next } : view.ended }
  }
  const messages = detail.messages.map((m) => {
    if (m.role !== 'USER') return m
    const u = utt.get(m.id)
    return { ...m, utteranceId: u?.utteranceId ?? null, audioAvailable: u?.audioAvailable ?? false }
  })
  return ok({ ...detail, chat: { ...detail.chat, ...(scenario ? { scenario } : {}) }, messages })
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
