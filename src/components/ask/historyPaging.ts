/**
 * 지난 질문 시트 5개씩 쪽 넘기기 — 순수 계산(task-067 §27-4 C·D·27-5 D). `useAskHistoryPages` 가 이 함수들로만 상태를 바꾸고 시험이 잠근다.
 *
 * - 커서 스택: `cursors[k]` = k 쪽을 읽을 커서(`cursors[0] = null`). k 쪽을 읽어 성공하면 `cursors[k + 1] = nextCursor`.
 *   [이전] 도 그 쪽 커서로 **다시 읽는다**(행을 쪽 사이에 저장하지 않는다 — 「답 만드는 중」·「새 답」이 늘 새 값).
 * - 요청마다 순서표(`seq`)를 붙이고, 지금 순서표가 아닌 응답은 버린다(늦게 온 옛 응답).
 * - 쪽 수·「모두 n개」는 가장 최근 응답의 `total`.
 */
import type { ChatSummary, Paged } from '@/types/chat'
import { ASK_COPY } from './askCopy'

/** 시트 한 쪽의 행 수(D3 A). */
export const ASK_HISTORY_PAGE = 5

/** #27 응답 — 서버가 `total` 을 더했다(api-contract #27 additive). 다른 목록은 `total` 을 내지 않아 공용 `Paged` 는 그대로 둔다. */
export type AskListPage = Paged<ChatSummary> & { total: number }

export type HistoryStatus = 'first' | 'ready' | 'paging' | 'pageError' | 'firstError'

export interface PageRequest {
  seq: number
  page: number
  cursor: string | null
  /** 행을 그대로 보여 둔 채 다시 읽기(시트를 다시 열 때·삭제 뒤) — 실패해도 지금 행을 지킨다 */
  silent: boolean
}

export interface PagerState {
  page: number
  cursors: ReadonlyArray<string | null>
  total: number | null
  items: ChatSummary[]
  hasNext: boolean
  status: HistoryStatus
  now: Date | null
  seq: number
  /** 지금 기다리는 요청(없으면 null) — 훅의 효과가 이것을 보고 읽는다 */
  req: PageRequest | null
}

export const INITIAL_PAGER: PagerState = { page: 0, cursors: [null], total: null, items: [], hasNext: false, status: 'first', now: null, seq: 0, req: null }

export function historyListUrl(cursor: string | null): string {
  return `/api/v1/chats?kind=ASK&limit=${ASK_HISTORY_PAGE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
}

/** 쪽 수 = max(1, ⌈total / 5⌉). 첫 응답 전(null)은 1. */
export function historyPages(total: number | null): number {
  return Math.max(1, Math.ceil((total ?? 0) / ASK_HISTORY_PAGE))
}

/** 쪽 줄을 보일지 — 5개 이하이고 1쪽이면 없다(B·few). */
export function isPaged(total: number | null, page: number): boolean {
  return (total ?? 0) > ASK_HISTORY_PAGE || page > 0
}

/** k 쪽을 읽어 받은 다음 커서를 적는다. 그 뒤 쪽의 옛 커서는 버린다(순서가 바뀌었을 수 있다 — 앞으로 가며 다시 쌓는다). */
export function pushCursor(stack: ReadonlyArray<string | null>, page: number, next: string | null): Array<string | null> {
  const head = stack.slice(0, page + 1)
  while (head.length < page + 1) head.push(null)
  return [...head, next]
}

/** 삭제 뒤 지금 쪽이 비고 1쪽이 아니면 앞 쪽으로. */
export function pageAfterDelete(page: number, itemsLeft: number): number {
  return itemsLeft === 0 && page > 0 ? page - 1 : page
}

/** 마지막 쪽도 5행 높이(J1) — 쪽 줄이 있을 때만 `5 − 채운 줄` 만큼 숨은 행을 둔다(쪽 오류 상자는 한 줄로 센다). */
export function fillerCount(paged: boolean, rows: number): number {
  return paged ? Math.max(0, ASK_HISTORY_PAGE - rows) : 0
}

export function canPrev(s: Pick<PagerState, 'page' | 'status'>): boolean {
  return s.page > 0 && (s.status === 'ready' || s.status === 'pageError')
}

export function canNext(s: Pick<PagerState, 'page' | 'status' | 'hasNext' | 'total'>): boolean {
  return s.status === 'ready' && s.hasNext && s.page < historyPages(s.total) - 1
}

export interface PagerView {
  prevDisabled: boolean
  nextDisabled: boolean
  label: string
  sub: string
  sr: string
}

/** 쪽 줄 표시(27-4 B·D). 넘기는 중엔 두 단추 모두 흐림, 라벨은 이미 목표 쪽. 쪽 오류면 [다음] 흐림(그 쪽의 다음 커서를 모른다). */
export function pagerView(v: { page: number; pages: number; total: number | null; status: HistoryStatus; hasNext: boolean }): PagerView {
  const H = ASK_COPY.history
  const total = v.total ?? 0
  const busy = v.status === 'paging'
  return {
    prevDisabled: !canPrev(v),
    nextDisabled: !(v.status === 'ready' && v.hasNext && v.page < v.pages - 1),
    label: H.pageLabel(v.page + 1, v.pages),
    sub: busy ? H.busyLabel : H.totalLabel(total),
    sr: busy ? H.pagingSr(v.page + 1) : H.pageSr(v.page + 1, v.pages, total),
  }
}

/** 행의 「답 만드는 중」 — 알약용 최근 목록(`useAskActivity`)에 같은 id 가 있으면 그 값(더 새 값), 없으면 쪽을 읽은 순간 값. 순서는 바꾸지 않는다. */
export function rowRunning(row: Pick<ChatSummary, 'id' | 'running'>, live: ReadonlyMap<string, boolean>): boolean {
  return live.get(row.id) ?? row.running
}

export function liveRunningMap(items: ReadonlyArray<Pick<ChatSummary, 'id' | 'running'>>): Map<string, boolean> {
  return new Map(items.map((c) => [c.id, c.running]))
}

// ── 상태 전이 ───────────────────────────────────────────────────────────────────

export type PagerMode = 'open' | 'next' | 'prev' | 'retry'

function request(s: PagerState, page: number, silent: boolean, status: HistoryStatus): PagerState {
  const seq = s.seq + 1
  const req: PageRequest = { seq, page, cursor: s.cursors[page] ?? null, silent }
  return silent ? { ...s, seq, req } : { ...s, page, status, items: [], hasNext: false, seq, req }
}

/**
 * 읽기를 시작한다 — 새 상태(목표 쪽·상태·`req`). 할 수 없는 동작(흐린 단추)은 같은 상태를 돌려준다.
 * 열 때(J2): 받은 행이 있으면 그대로 보여 둔 채 조용히, 없으면 처음 불러오기, 쪽 오류였으면 그 쪽을 다시.
 */
export function beginPage(s: PagerState, mode: PagerMode): PagerState {
  switch (mode) {
    case 'open':
      if (s.status === 'ready') return request(s, s.page, true, s.status)
      return request(s, s.page, false, s.total === null ? 'first' : 'paging')
    case 'next':
      return canNext(s) ? request(s, s.page + 1, false, 'paging') : s
    case 'prev':
      return canPrev(s) ? request(s, s.page - 1, false, 'paging') : s
    case 'retry':
      if (s.status === 'firstError') return request(s, s.page, false, 'first')
      if (s.status === 'pageError') return request(s, s.page, false, 'paging')
      return s
  }
}

export type PageResult = { ok: true; page: AskListPage; now: Date } | { ok: false }

/** 응답을 반영한다. 지금 기다리는 요청이 아니면(늦게 온 옛 응답) 그대로. 다시 읽은 쪽이 비었고 1쪽이 아니면 앞 쪽을 읽는다. */
export function settlePage(s: PagerState, req: PageRequest, res: PageResult): PagerState {
  if (!s.req || s.req.seq !== req.seq) return s
  if (!res.ok) {
    if (req.silent) return { ...s, req: null }
    return { ...s, req: null, items: [], hasNext: false, status: s.total === null ? 'firstError' : 'pageError' }
  }
  const { items, nextCursor, total } = res.page
  if (items.length === 0 && req.page > 0) {
    return request({ ...s, total, page: req.page }, req.page - 1, false, 'paging')
  }
  return {
    ...s,
    req: null,
    page: req.page,
    items: [...items],
    total,
    hasNext: nextCursor !== null,
    cursors: pushCursor(s.cursors, req.page, nextCursor),
    status: 'ready',
    now: res.now,
  }
}

/** 1쪽으로(새 대화가 생겼을 때 — J2·L6). 이미 1쪽이면 그대로. 열려 있으면 이어서 `beginPage(…, 'open')`. */
export function resetPager(s: PagerState): PagerState {
  if (s.page === 0) return s
  return { ...INITIAL_PAGER, seq: s.seq }
}

/** 삭제 뒤: 그 행을 지금 쪽에서 빼고 `total` 을 줄인 뒤 같은 커서로 지금 쪽을 다시(뒤 행이 올라옴). 쪽이 비면 앞 쪽(`pageAfterDelete`). */
export function reloadAfterDelete(s: PagerState, removedId: string): PagerState {
  const had = s.items.some((c) => c.id === removedId)
  const items = had ? s.items.filter((c) => c.id !== removedId) : s.items
  const total = had && s.total !== null ? Math.max(0, s.total - 1) : s.total
  const next = { ...s, items, total }
  if (next.status !== 'ready') return next
  const target = pageAfterDelete(next.page, items.length)
  return target !== next.page ? request(next, target, false, 'paging') : request(next, next.page, true, 'ready')
}

/** 제자리 고침(제목 — J6: 제목만 바꿔서는 순서가 바뀌지 않는다). */
export function patchRow(s: PagerState, id: string, p: Partial<ChatSummary>): PagerState {
  if (!s.items.some((c) => c.id === id)) return s
  return { ...s, items: s.items.map((c) => (c.id === id ? { ...c, ...p } : c)) }
}

// ── 시트에서 삭제(27-5 C·D) ────────────────────────────────────────────────────────

export interface HistoryDeleteDeps {
  del(id: string): Promise<unknown>
  /** 지운 대화를 이 기기 「기다리는 방」·「새 답」 집합에서 뺀다 */
  forget(id: string): void
  toast(msg: string): void
  refreshActivity(): void
  reload(id: string): void
  onDeleted(id: string, wasCurrent: boolean): void
}

/**
 * 답을 만드는 중인 대화는 화면이 막는다 — 서버 #31 은 진행 중 여부를 검사하지 않는다(27-5 B). 잠겼으면 요청 0 + 토스트.
 * 성공: 저장소에서 빼기 · 토스트 한 번 · 알약 다시 읽기 · 쪽 다시 읽기 · 부모에 알림(지금 대화였는지).
 */
export async function deleteHistoryRow(
  deps: HistoryDeleteDeps,
  id: string,
  opts: { locked: boolean; currentChatId: string | null },
): Promise<'locked' | 'ok' | 'failed'> {
  if (opts.locked) {
    deps.toast(ASK_COPY.menu.deleteBusy)
    return 'locked'
  }
  try {
    await deps.del(id)
  } catch {
    return 'failed'
  }
  deps.forget(id)
  deps.toast(ASK_COPY.deletedToast)
  deps.refreshActivity()
  deps.reload(id)
  deps.onDeleted(id, id === opts.currentChatId)
  return 'ok'
}
