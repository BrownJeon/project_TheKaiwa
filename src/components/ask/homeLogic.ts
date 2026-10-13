/**
 * 질문 탭의 지난 질문·첫 질문 순수 계산(task-064 §25-4 → task-066 §26-3 C·26-4) — `useAskActivity`·`AskHistoryButton`·`AskListItem`·
 * `AskNewConversation` 이 고르는 값을 여기서 정하고 시험이 잠근다. 대화 화면 쪽 계산은 `logic.ts`.
 */
import type { ChatSummary, CreatedChat, MessageRole, MessageStatus } from '@/types/chat'
import { cpLength, formatListTime } from '@/components/common/format'
import { POLL_FAST_MS, POLL_FAST_WINDOW_MS, POLL_MAX_MS, POLL_SLOW_MS } from '@/components/chat/useChatTurn'
import { ASK_COPY } from './askCopy'
import { arrivedTransitions, askTitleOf, type AskVia } from './logic'

/** 알약용 #27 최근 목록 크기(§25-4 D) — 지난 질문 시트는 5개씩 따로(`historyPaging.ASK_HISTORY_PAGE`). */
export const ASK_LIST_LIMIT = 20
/** 서버와 같은 상한(코드포인트) — `maxLength` 는 UTF-16 단위라 쓰지 않는다. */
export const ASK_TEXT_MAX = 1000

/**
 * 목록 행 바깥 클래스 — `ChatListItem` 의 링크 클래스와 **같아야** 한다(자리표시 `CHAT_SKELETON` 높이 67.5 가 그대로 맞는다, §25-7 B·25-11 ⑰).
 * 바꾸려면 두 곳과 자리표시 상수를 함께 고친다.
 */
export const ASK_ROW_CLASS = 'flex min-h-16 min-w-0 flex-col justify-center gap-0.5 rounded-[14px] border border-line bg-surface px-3.5 py-2.5'

// ── 보내기 전 검사 ───────────────────────────────────────────────────────────────

export function askDraftCheck(text: string): 'empty' | 'tooLong' | null {
  if (text.trim() === '') return 'empty'
  return cpLength(text) > ASK_TEXT_MAX ? 'tooLong' : null
}

// ── 목록 ─────────────────────────────────────────────────────────────────────

/** 「답 만드는 중」 행이 있을 때 다음 읽기까지 기다릴 시간 — `useChatTurn` 폴링과 같은 숫자, 200초가 넘으면 null(멈춤). */
export function askListPollDelay(startedAt: number, now: number): number | null {
  const elapsed = Math.max(0, now - startedAt)
  if (elapsed > POLL_MAX_MS) return null
  return elapsed < POLL_FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS
}

// ── 「새 답」 ─────────────────────────────────────────────────────────────────

/**
 * `arrivedTransitions` 결과 + 성공한 답으로 확인된 id → 새 답 목록·토스트 여부.
 * 실패한 답에는 「새 답」을 붙이지 않는다(Leader L-8). 방을 떠날 때 기다리던 방(`waiting`)은 결과와 상관없이 집합에서 뺀다.
 */
export function settleArrivals(
  t: { fromWaiting: readonly string[]; fromPolling: readonly string[] },
  okIds: ReadonlySet<string>,
): { newIds: string[]; toast: boolean; leftWaiting: string[] } {
  const candidates = [...new Set([...t.fromWaiting, ...t.fromPolling])]
  const newIds = candidates.filter((id) => okIds.has(id))
  return { newIds, toast: t.fromPolling.some((id) => okIds.has(id)), leftWaiting: [...t.fromWaiting] }
}

/**
 * 도착 판정 입력(`useAskActivity.settle`) — 알약 개수(`askActivityOf`)와 **같은 기준**으로 지금 대화를 뺀다.
 * 지금 보고 있는 대화는 답이 화면에 바로 나오므로 「답이 도착했어요」 토스트도, 나중에 알약에 뜰 「새 답」 표지도 거짓이다
 * (`kaiwa.ask.newAnswer` 에 지금 대화가 남으면 새 질문으로 나간 뒤 알약이 거짓으로 「새 답」을 말한다).
 */
export function planArrivals(
  prevRunning: ReadonlySet<string> | null,
  items: ReadonlyArray<{ id: string; running: boolean }>,
  waiting: ReadonlySet<string>,
  currentId: string | null,
): ReturnType<typeof arrivedTransitions> {
  return arrivedTransitions(prevRunning, items.filter((c) => c.id !== currentId), waiting)
}

/** #29 최근 메시지(오름차순)의 마지막이 DONE 인 선생님 답이면 성공. */
export function lastAnswerOk(messages: ReadonlyArray<{ role: MessageRole; status: MessageStatus }>): boolean {
  const last = messages[messages.length - 1]
  return !!last && last.role === 'ASSISTANT' && last.status === 'DONE'
}

// ── 목록 행 ───────────────────────────────────────────────────────────────────

export interface AskRowView {
  title: string
  time: string
  second: string
  status: 'running' | 'new' | null
  label: string
}

export function askRowView(chat: Pick<ChatSummary, 'title' | 'lastMessageAt' | 'preview' | 'running'>, opts: { isNew: boolean; now: Date | null }): AskRowView {
  const time = opts.now ? formatListTime(chat.lastMessageAt, opts.now) : ''
  const status = chat.running ? 'running' : opts.isNew ? 'new' : null
  const second = chat.running ? ASK_COPY.runningLine : chat.preview ? chat.preview : ASK_COPY.noMessages
  const tail = status === 'running' ? ASK_COPY.running : status === 'new' ? ASK_COPY.newAnswerSr : ''
  return { title: chat.title, time, second, status, label: [chat.title, time, tail].filter(Boolean).join(', ') }
}

// ── 「지난 질문」 알약(§26-4) ─────────────────────────────────────────────────────

export type AskHistoryState = 'idle' | 'running' | 'new'

/**
 * 알약·시트가 세는 값 — **지금 대화는 빼고** 센다(§26-4 A). 세면 대화 중인 화면에서 늘 「답 만드는 중」이 된다.
 * `newIds` = 이 기기 「새 답」 집합(`kaiwa.ask.newAnswer`).
 */
export function askActivityOf(
  items: ReadonlyArray<Pick<ChatSummary, 'id' | 'running'>>,
  currentId: string | null,
  newIds: ReadonlySet<string>,
): { running: boolean; newCount: number } {
  const others = items.filter((c) => c.id !== currentId)
  return { running: others.some((c) => c.running), newCount: others.filter((c) => newIds.has(c.id)).length }
}

/** 알약 상태 우선순위 — 답 만드는 중 > 새 답 > 기본(로딩·오류 포함). */
export function askHistoryState(a: { running: boolean; newCount: number }): AskHistoryState {
  if (a.running) return 'running'
  return a.newCount > 0 ? 'new' : 'idle'
}

// ── 첫 질문 → 대화 만들기(§26-3 C) ──────────────────────────────────────────────

/** 대화 만들기 동안의 바깥 일 — 시험이 가짜를 끼운다. */
export interface CreateConversationDeps {
  /** 만드는 동안 잡는 잠금(`useRef`) — 연타해도 방이 하나만 생긴다. 성공하면 풀지 않는다(화면이 `AskRoom` 으로 바뀐다). */
  lock: { current: boolean }
  createChat(title: string): Promise<CreatedChat>
  setBusy(busy: boolean): void
  onCreated(chat: CreatedChat, text: string, via: AskVia): void
  onError(e: unknown, text: string, via: AskVia): void
}

/**
 * 첫 질문을 보낼 때만 방을 만든다(§26-3 C·26-14 A 7 — `/ask` 를 여는 것만으로는 만들지 않는다).
 * 잠금이 잡혀 있으면 아무것도 하지 않는다. 실패하면 잠금·바쁨을 풀고 글·경로를 돌려준다(글자는 입력창, 말은 「보내지 못한 말」 띠).
 */
export async function createAskConversation(deps: CreateConversationDeps, text: string, via: AskVia): Promise<void> {
  if (deps.lock.current) return
  deps.lock.current = true
  deps.setBusy(true)
  let created: CreatedChat
  try {
    created = await deps.createChat(askTitleOf(text))
  } catch (e) {
    deps.lock.current = false
    deps.setBusy(false)
    deps.onError(e, text, via)
    return
  }
  deps.onCreated(created, text, via)
}
