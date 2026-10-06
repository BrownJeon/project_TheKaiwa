/**
 * #29 대화 조회 조합(라우트 본문을 시험할 수 있게 꺼낸 것 — task-010d A3b-2). 메시지(conversation) + 발화(speech, USER 메시지의 `utteranceId`) +
 * 역할극 칸(`chat.scenario` — conversation 진행 값·결과 + 수업 제목·다음 상황은 learning, 첫 조회만)을 라우트 층에서 합친다(conversation ↔ speech 직접 import 없음).
 *
 * 예열(K2-1): TALK 방 **첫 조회**(`after` 없음)만 LLM 을 예열한다. **마친 역할극은 예열하지 않는다** — 결과 화면(S9)이 이 조회를 쓰고 더 말할 수 없는 방이라
 * 예열 프로세스가 쓸모없다(B3 서버 요청 ②). 그래서 예열은 역할극 칸을 읽은 뒤에 건다(응답은 예열을 기다리지 않는다).
 */
import { chatRolePlayView, getChatDetail, prewarmTalkTurn } from '@/modules/conversation'
import { utterancesForMessages } from '@/modules/speech'
import type { RolePlayChatView, RolePlayNext } from '@/types/chat'
import { lessonRefFor, nextScenarioFor } from './rolePlay'

type Detail = Awaited<ReturnType<typeof getChatDetail>>
type RolePlayRaw = Awaited<ReturnType<typeof chatRolePlayView>>

export interface ChatDetailDeps {
  detail(userId: string, chatId: string, q: { after: string | null; cursor: string | null; limit: number }): Promise<Detail>
  prewarm(userId: string, chat: Detail['chat']): Promise<unknown>
  utterances(userId: string, messageIds: string[]): Promise<Map<string, { utteranceId: string | null; audioAvailable: boolean }>>
  rolePlay(userId: string, chatId: string): Promise<RolePlayRaw>
  lessonRef(userId: string, lessonId: string | null): Promise<{ id: string; title: string } | null>
  next(userId: string, scenarioId: string): Promise<RolePlayNext | undefined>
}

export const chatDetailDeps: ChatDetailDeps = {
  detail: (userId, chatId, q) => getChatDetail(userId, chatId, q),
  prewarm: (userId, chat) => prewarmTalkTurn(userId, chat),
  utterances: (userId, ids) => utterancesForMessages(userId, ids),
  rolePlay: (userId, chatId) => chatRolePlayView(userId, chatId),
  lessonRef: (userId, lessonId) => lessonRefFor(userId, lessonId),
  next: (userId, scenarioId) => nextScenarioFor(userId, scenarioId),
}

/** 예열할 조회인가 — TALK 첫 조회이고 마친 역할극이 아닐 때만. */
export function shouldPrewarmTalk(after: string | null, kind: string, rolePlay: { ended: unknown } | null): boolean {
  return !after && kind === 'TALK' && !rolePlay?.ended
}

export async function chatDetailResponse(userId: string, chatId: string, q: { after: string | null; cursor: string | null; limit: number }, deps: ChatDetailDeps = chatDetailDeps) {
  const detail = await deps.detail(userId, chatId, q)
  const talk = detail.chat.kind === 'TALK'
  const userIds = detail.messages.filter((m) => m.role === 'USER').map((m) => m.id)
  const [utt, rp] = await Promise.all([deps.utterances(userId, userIds), talk ? deps.rolePlay(userId, chatId) : Promise.resolve(null)])
  if (shouldPrewarmTalk(q.after, detail.chat.kind, rp)) void deps.prewarm(userId, detail.chat).catch(() => undefined)
  let scenario: RolePlayChatView | null = null
  if (rp) {
    const { lessonId, ...view } = rp
    const [lesson, next] = q.after ? [undefined, undefined] : await Promise.all([deps.lessonRef(userId, lessonId), view.ended ? deps.next(userId, view.id) : Promise.resolve(undefined)])
    scenario = { ...view, ...(lesson !== undefined ? { lesson } : {}), ended: view.ended && next ? { ...view.ended, next } : view.ended }
  }
  const messages = detail.messages.map((m) => {
    if (m.role !== 'USER') return m
    const u = utt.get(m.id)
    return { ...m, utteranceId: u?.utteranceId ?? null, audioAvailable: u?.audioAvailable ?? false }
  })
  return { ...detail, chat: { ...detail.chat, ...(scenario ? { scenario } : {}) }, messages }
}
