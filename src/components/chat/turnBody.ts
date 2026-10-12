/**
 * 턴 요청 본문(`POST /chats/:id/turns`) 만들기 — 순수 함수라 따로 둔다. 키가 있을 때만 싣는다: 서버는 TALK·CHAT 의 `scope` 를 400 으로 거절하므로
 * (질문 방 전용 칸, api-contract §2-18-A) 옵션이 없는 회화·채팅 전송에는 `scope` 키 자체가 없어야 한다(task-064 §25-11 ⑯).
 */
import type { AskScopeKey } from '@/types/ask'
import type { ClientTimings, InputSource } from '@/types/chat'

export const DEFAULT_INPUT_SOURCE: InputSource = 'TEXT'

export interface TurnBodyOptions {
  inputSource?: InputSource
  utteranceId?: string | null
  clientTimings?: ClientTimings
  coachRevealed?: boolean
  scope?: { key: AskScopeKey }
}

export function buildTurnBody(text: string, opts: TurnBodyOptions = {}): Record<string, unknown> {
  const body: Record<string, unknown> = { text, inputSource: opts.inputSource ?? DEFAULT_INPUT_SOURCE }
  if (opts.utteranceId) body.utteranceId = opts.utteranceId
  if (opts.clientTimings) body.clientTimings = opts.clientTimings
  if (opts.coachRevealed) body.coachRevealed = true
  if (opts.scope) body.scope = { key: opts.scope.key }
  return body
}
