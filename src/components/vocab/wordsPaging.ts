/**
 * 단어장 7개씩 쪽(task-068 §28-1, D1 A · D2 A · J1~J4 · J11) — 순수 모듈. 화면(`WordsScreen`)은 이 규칙을 그대로 부른다.
 *
 * - 화면의 쪽 번호는 **0부터**, 요청(#40 `page`)은 1부터. 요청 주소는 `wordsListUrl` 한 곳에서만 만든다(`cursor` 없음 — 서버가 400).
 * - 쪽은 저장소에 두지 않는다(D2 — 단어장 화면에 있는 동안만). 조건(검색·출처·분류·조각·정렬·보관함)이 바뀌면 1쪽.
 * - 요청 하나의 시작·끝(`beginWords`·`settleWords`)은 종류(`WordsReqKind`)로 갈린다: 쪽을 넘길 때만 회색 자리(`paging`),
 *   조건 변경·다시 읽기는 지금 행을 둔 채 응답을 기다린다(§28-1 D·F).
 */
import type { WordEntry, WordListPage, WordSort } from '@/types/vocab'
import { WORDS_PAGE_COPY as P } from './labels'
import type { WordListFilter } from './logic'

export const WORDS_PAGE = 7

export type WordsStatus = 'first' | 'ready' | 'paging' | 'pageError' | 'firstError'

/** 지금 깔린 행을 받아 온 요청의 조건 — 머리 줄·빈 화면은 이 값으로 그린다(logic.ts 규칙). */
export type WordsShown = WordListFilter & { sort: WordSort }

export interface WordsListState {
  items: WordEntry[]
  /** 첫 응답 전 null */
  total: number | null
  baseTotal: number | null
  /** 서버 `pages`(응답 전에는 1) */
  pages: number
  status: WordsStatus
  /** firstError 문구(listErrorText) */
  error: string | null
  shown: WordsShown | null
}

export const WORDS_INITIAL: WordsListState = { items: [], total: null, baseTotal: null, pages: 1, status: 'first', error: null, shown: null }

/**
 * 요청 종류 — `first` 마운트·첫 읽기 다시 시도 / `filter` 조건 변경(1쪽) / `page` [이전]·[다음]·쪽 이동 / `retry` 쪽 오류 [다시 시도] /
 * `reload` 수정·보관·삭제·추가·화면 복귀(같은 쪽, 회색 자리 없음) / `clamp` 쪽 수가 줄어 앞 쪽으로 한 번 더(J4).
 */
export type WordsReqKind = 'first' | 'filter' | 'page' | 'retry' | 'reload' | 'clamp'

/** 0부터 쪽 + 조건 → #40 주소. 빈 `q`·`category`·`chunkType` 은 키를 넣지 않고 `source` 는 `all` 이어도 넣는다. */
export function wordsListUrl(f: WordListFilter, sort: WordSort, page: number): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.category !== null) p.set('category', f.category)
  if (f.chunk) p.set('chunkType', f.chunk)
  p.set('source', f.source)
  p.set('archived', f.archived ? '1' : '0')
  p.set('sort', sort)
  p.set('page', String(page + 1))
  p.set('limit', String(WORDS_PAGE))
  return `/api/v1/words?${p.toString()}`
}

/** 쪽 수 = max(1, ⌈total / 7⌉) — 서버 `pages` 와 같은 식(7,755 → 1,108 · 7,758 → 1,109). */
export function wordPages(total: number | null | undefined): number {
  return Math.max(1, Math.ceil((total ?? 0) / WORDS_PAGE))
}

/** 쪽 줄을 그리는가 — 8개 이상이거나 1쪽이 아닐 때(다른 기기에서 줄었어도 길을 잃지 않게). 7개 이하 1쪽이면 쪽 줄·빈 자리·status 모두 없다(J1). */
export function isWordsPaged(total: number | null | undefined, page: number): boolean {
  return (total ?? 0) > WORDS_PAGE || page > 0
}

export interface WordsPagerView {
  prevDisabled: boolean
  nextDisabled: boolean
  centerDisabled: boolean
  /** 「3 / 1,109」 */
  label: string
  /** 「모두 7,758개」 · 「불러오는 중…」 */
  sub: string
  /** status 한 줄 — 「1,109쪽 중 3쪽 · 모두 7,758개」 · 「4쪽을 불러오고 있어요」 */
  sr: string
  /** 가운데 단추 이름 — 「3 / 1,109 — 쪽으로 이동」(보이는 글을 앞에) */
  centerAria: string
}

/** 쪽 줄 보기값. `page` 는 0부터(`paging` 동안은 목표 쪽). 쪽 오류면 그 쪽을 못 읽었으니 [다음]도 막는다(데모 B·err). */
export function wordsPagerView(v: { page: number; pages: number; total: number | null; status: WordsStatus }): WordsPagerView {
  const busy = v.status === 'paging'
  const notLoaded = v.status === 'first' || v.status === 'firstError'
  const p = v.page + 1
  const total = v.total ?? 0
  return {
    prevDisabled: v.page === 0 || busy || notLoaded,
    nextDisabled: v.page >= v.pages - 1 || busy || v.status === 'pageError' || notLoaded,
    centerDisabled: busy,
    label: P.label(p, v.pages),
    sub: busy ? P.busy : P.total(total),
    sr: busy ? P.pagingSr(p) : P.sr(p, v.pages, total),
    centerAria: P.centerAria(p, v.pages),
  }
}

/** 보이지 않는 빈 자리 수(J1) — 쪽 줄이 없으면 0 · 쪽 오류면 5(오류 상자 + 5 = 쪽 줄 위치 유지) · 그 밖은 7 − 행 수. */
export function fillerCount(paged: boolean, rows: number, status: WordsStatus): number {
  if (!paged) return 0
  if (status === 'pageError') return 5
  return Math.max(0, WORDS_PAGE - rows)
}

/**
 * 쪽 이동 칸 값 → 0부터 쪽 | null. 전각 숫자(「１２」)는 NFKC 로 받고 쉼표·공백만 지운다. 그 밖의 글자가 섞이면 null —
 * 「숫자 아닌 글자 지우기」보다 엄격하게(`1.5` 가 15쪽으로 가지 않게, §28-10 ⑪).
 */
export function parseJumpPage(raw: string, pages: number): number | null {
  const t = raw.normalize('NFKC').replace(/[,\s]/g, '')
  if (!/^\d{1,6}$/.test(t)) return null
  const n = Number(t)
  if (n < 1 || n > pages) return null
  return n - 1
}

/** 응답 뒤 쪽 보정 — 요청 쪽이 응답의 쪽 수를 넘으면 마지막 쪽(0부터). */
export function clampAfterResponse(reqPage: number, total: number): number {
  return Math.min(reqPage, wordPages(total) - 1)
}

/** 단어를 넣은 뒤 쪽(J3) — 「최근 추가」면 1쪽(내 단어가 맨 위), 다른 정렬이면 보던 쪽. */
export function pageAfterAdd(sort: WordSort, page: number): number {
  return sort === 'recent' ? 0 : page
}

// ── 쪽 상태(D2) ────────────────────────────────────────────────────────────────────────────────

/** 조건 열쇠 — 하나라도 다르면 다른 열쇠(쪽은 1쪽으로). */
export function wordsCondKey(f: WordListFilter, sort: WordSort): string {
  return JSON.stringify([f.q, f.source, f.category, f.chunk, f.archived, sort])
}

/** 화면이 지금 읽을 쪽·요청 종류. `seq` 는 같은 쪽을 다시 읽을 때 올린다. */
export interface WordsNav {
  key: string
  page: number
  kind: WordsReqKind
  seq: number
}

/**
 * 조건 열쇠가 바뀌었으면 1쪽·`filter`, 같으면 그대로(같은 객체). 조건을 바꾸는 손잡이가 이 함수로 상태를 바꾸고,
 * 렌더 때도 한 번 더 지나가 저장소에서 바뀐 정렬(다른 창)처럼 손잡이를 거치지 않은 변경도 1쪽으로 읽는다.
 */
export function navForKey(nav: WordsNav, key: string): WordsNav {
  return nav.key === key ? nav : { key, page: 0, kind: 'filter', seq: nav.seq + 1 }
}

/** 같은 조건에서 쪽을 옮기거나 다시 읽는다. */
export function navTo(nav: WordsNav, key: string, page: number, kind: WordsReqKind): WordsNav {
  return { key, page, kind, seq: nav.seq + 1 }
}

// ── 요청 하나 ──────────────────────────────────────────────────────────────────────────────────

/** 요청 시작. 쪽 넘김·쪽 오류 다시 시도·쪽 보정만 회색 자리(`paging`), 첫 읽기는 `first`, 그 밖은 상태를 그대로 둔다. */
export function beginWords(s: WordsListState, kind: WordsReqKind): WordsListState {
  if (s.status === 'first' || s.status === 'firstError' || kind === 'first') return { ...s, status: 'first', error: null }
  if (kind === 'page' || kind === 'retry' || kind === 'clamp') return { ...s, status: 'paging', error: null }
  return s
}

export type WordsResult = { ok: true; page: Partial<WordListPage> | null | undefined } | { ok: false; error: string }

export interface WordsSettle {
  state: WordsListState
  /** 비었고 쪽 수가 줄었다 → 이 쪽(0부터)으로 **한 번만** 다시 읽는다(`clamp` 응답은 다시 보정하지 않는다). */
  clampTo: number | null
  /** 다시 읽기 실패 — 지금 행을 둔 채 토스트 한 번 */
  toast: string | null
  /** 쪽을 넘겨 받았다 → 머리 줄로 스크롤·초점(J2) */
  focusHead: boolean
}

/** 요청 끝. `req.page` 는 0부터, `req.shown` 은 그 요청을 보낸 때의 조건. */
export function settleWords(s: WordsListState, req: { kind: WordsReqKind; page: number; shown: WordsShown }, res: WordsResult): WordsSettle {
  if (!res.ok) {
    if (s.status === 'first') return { state: { ...s, status: 'firstError', error: res.error }, clampTo: null, toast: null, focusHead: false }
    if (req.kind === 'reload') {
      // 쪽을 넘기는 중(paging)에 끼어든 다시 읽기: 앞 쪽 요청은 이미 취소됐고 화면의 쪽은 목표 쪽이다. 상태를 그대로 두면 paging 에 갇히므로
      // 그 쪽을 못 읽은 것으로 — 오류 상자가 role=alert 로 알리니 토스트는 겹치지 않고, [다시 시도]가 같은 쪽을 다시 읽는다.
      if (s.status === 'paging') return { state: { ...s, status: 'pageError', error: null }, clampTo: null, toast: null, focusHead: false }
      return { state: s, clampTo: null, toast: res.error, focusHead: false }
    }
    return { state: { ...s, status: 'pageError', error: null }, clampTo: null, toast: null, focusHead: false }
  }
  const items = res.page?.items ?? []
  const total = typeof res.page?.total === 'number' ? res.page.total : items.length
  if (items.length === 0 && req.kind !== 'clamp') {
    const to = clampAfterResponse(req.page, total)
    if (to < req.page) return { state: s, clampTo: to, toast: null, focusHead: false }
  }
  const pages = typeof res.page?.pages === 'number' && res.page.pages >= 1 ? res.page.pages : wordPages(total)
  const baseTotal = typeof res.page?.baseTotal === 'number' ? res.page.baseTotal : s.baseTotal
  return {
    state: { items, total, baseTotal, pages, status: 'ready', error: null, shown: req.shown },
    clampTo: null,
    toast: null,
    focusHead: req.kind === 'page' || req.kind === 'retry',
  }
}

/**
 * 머리 줄로 초점을 옮긴다. `scroll` 이면 먼저 머리 줄을 화면 위로 끌어온다(쪽 도착·삭제 — J2),
 * 아니면 초점만 옮긴다(안내 띠 ✕ — 사용자가 스크롤을 시킨 게 아니라서 검색·출처·조각 줄이 위로 밀려 올라가면 안 된다).
 */
export function focusHeadLine(
  h: { scrollIntoView(o: ScrollIntoViewOptions): void; focus(o: FocusOptions): void } | null,
  scroll: boolean,
): void {
  if (!h) return
  if (scroll) h.scrollIntoView({ block: 'start', behavior: 'auto' })
  h.focus({ preventScroll: true })
}

// ── 쪽으로 이동 시트(J11 · §28-1 E) ────────────────────────────────────────────────────────────────

export type JumpDecision = { kind: 'invalid' } | { kind: 'stay' } | { kind: 'go'; page: number }

/** 시트에서 고른 쪽(0부터, 잘못된 번호면 null) → 오류 · 같은 쪽(닫기만 — 읽지 않음) · 그 쪽으로. 시트는 포털이라 이 결정을 순수 함수로 시험한다. */
export function jumpDecision(target: number | null, page: number): JumpDecision {
  if (target === null) return { kind: 'invalid' }
  return target === page ? { kind: 'stay' } : { kind: 'go', page: target }
}
