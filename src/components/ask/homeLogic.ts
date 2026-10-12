/**
 * 질문 목록 `/ask` 의 순수 계산(task-064 dev-U3, screens.md §25-4) — 화면(`AskHome`·`AskComposerCard`·`AskListItem`)이 고르는 값을 여기서 정하고 시험이 잠근다.
 * 질문 방 쪽 계산(`logic.ts`)과 파일을 나눈 이유: 목록·방을 서로 다른 developer 가 동시에 고치므로 같은 파일을 건드리지 않게.
 */
import type { ChatSummary, MessageRole, MessageStatus } from '@/types/chat'
import { cpLength, formatListTime } from '@/components/common/format'
import { POLL_FAST_MS, POLL_FAST_WINDOW_MS, POLL_MAX_MS, POLL_SLOW_MS } from '@/components/chat/useChatTurn'
import { ASK_COPY } from './askCopy'
import { askTitleOf } from './logic'

/** #27 한 쪽 크기(§25-4 D). */
export const ASK_LIST_LIMIT = 20
/** 서버와 같은 상한(코드포인트) — `maxLength` 는 UTF-16 단위라 쓰지 않는다. */
export const ASK_TEXT_MAX = 1000
const ASK_TEXT_WARN = 900

/**
 * 목록 행 바깥 클래스 — `ChatListItem` 의 링크 클래스와 **같아야** 한다(자리표시 `CHAT_SKELETON` 높이 67.5 가 그대로 맞는다, §25-7 B·25-11 ⑰).
 * 바꾸려면 두 곳과 자리표시 상수를 함께 고친다.
 */
export const ASK_ROW_CLASS = 'flex min-h-16 min-w-0 flex-col justify-center gap-0.5 rounded-[14px] border border-line bg-surface px-3.5 py-2.5'

// ── 입력 카드 ─────────────────────────────────────────────────────────────────

export function askDraftCheck(text: string): 'empty' | 'tooLong' | null {
  if (text.trim() === '') return 'empty'
  return cpLength(text) > ASK_TEXT_MAX ? 'tooLong' : null
}

/** 글자 수 줄 — 900자부터, 1,000 초과면 경고 머리를 붙인다(`Composer` 와 같은 규칙). */
export function askCountLine(count: number): { text: string; over: boolean } | null {
  if (count < ASK_TEXT_WARN) return null
  const over = count > ASK_TEXT_MAX
  return { text: `${over ? `${ASK_COPY.tooLong} · ` : ''}${count.toLocaleString('ko-KR')}/${ASK_TEXT_MAX.toLocaleString('ko-KR')}`, over }
}

/** Enter 보내기는 정밀 포인터(데스크톱)에서만 — 모바일 Enter 는 줄바꿈, IME 조합 중(isComposing·229)은 무시. */
export function isEnterSubmit(e: { key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }, finePointer: boolean): boolean {
  if (e.key !== 'Enter' || e.shiftKey) return false
  if (e.isComposing || e.keyCode === 229) return false
  return finePointer
}

// ── 목록 ─────────────────────────────────────────────────────────────────────

export type AskHomeView = 'loading' | 'error' | 'empty' | 'list'

/** `rooms` = 받은 행(첫 응답 전 null). 첫 쪽이 실패했어도 받은 행이 있으면 행을 그린다. */
export function askHomeView(rooms: readonly ChatSummary[] | null, firstFailed: boolean): AskHomeView {
  if (rooms === null) return firstFailed ? 'error' : 'loading'
  return rooms.length === 0 ? 'empty' : 'list'
}

export function askExamplesMode(view: AskHomeView): 'wrap' | 'row' {
  return view === 'empty' ? 'wrap' : 'row'
}

/** 더 보기 — 이미 받은 id 는 빼고 뒤에 붙인다(`ChatList.more` 와 같음). */
export function appendRooms(prev: readonly ChatSummary[] | null, next: readonly ChatSummary[]): ChatSummary[] {
  const have = new Set((prev ?? []).map((c) => c.id))
  return [...(prev ?? []), ...next.filter((c) => !have.has(c.id))]
}

/**
 * 첫 쪽을 다시 읽었을 때(복귀·폴링). 더 보기로 받은 행이 없으면 바꿔 끼우고, 있으면 첫 쪽 뒤에 나머지를 지키고 커서도 지킨다
 * (폴링이 2.5초마다 첫 쪽만 읽어도 펼친 목록이 접히지 않게). 위로 올라온 행은 첫 쪽에만 남는다.
 */
export function mergeFirstPage(
  prev: { items: readonly ChatSummary[]; cursor: string | null } | null,
  page: { items: readonly ChatSummary[]; nextCursor: string | null },
): { items: ChatSummary[]; cursor: string | null } {
  if (!prev || prev.items.length <= page.items.length) return { items: [...page.items], cursor: page.nextCursor }
  const first = new Set(page.items.map((c) => c.id))
  return { items: [...page.items, ...prev.items.filter((c) => !first.has(c.id))], cursor: prev.cursor }
}

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

// ── 첫 질문 → 방 만들기 ─────────────────────────────────────────────────────────

/** 방 만들기 동안의 바깥 일(저장소·이동·화면 상태) — 시험이 가짜를 끼운다. */
export interface CreateRoomDeps {
  /** 이동이 끝날 때까지 잠겨 있는 잠금(`useRef`) — 연타해도 방이 하나만 생긴다. */
  lock: { current: boolean }
  createChat(title: string): Promise<{ id: string }>
  /** 질문을 방에 넘기고(`pending.<id>`) 목록 초안을 지운다. */
  handOff(id: string, text: string): void
  go(id: string): void
  setBusy(busy: boolean): void
  onError(e: unknown): void
}

/**
 * 첫 질문으로 방을 만든다(§25-4 E). 잠금이 잡혀 있으면 아무것도 하지 않고, 성공하면 이동이 끝날 때까지 잠금을 풀지 않는다(돌아오면 화면이 새로 올라온다).
 * 실패하면 잠금·바쁨을 풀고 오류를 알린다 — 같은 글로 다시 보낼 수 있다. 목록에서는 턴을 시작하지 않는다(방이 넘겨받아 보낸다).
 */
export async function createAskRoom(deps: CreateRoomDeps, text: string): Promise<void> {
  if (deps.lock.current) return
  deps.lock.current = true
  deps.setBusy(true)
  try {
    const c = await deps.createChat(askTitleOf(text))
    deps.handOff(c.id, text)
    deps.go(c.id)
  } catch (e) {
    deps.lock.current = false
    deps.setBusy(false)
    deps.onError(e)
  }
}
