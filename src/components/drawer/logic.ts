/**
 * 채택 교정 모음(`/drawer/corrections`, task-055)의 순수 함수(screens.md §21-5·21-6) — 요청 주소·유형 칩·머리 줄 개수·빈 상태 종류·
 * 원래 대화 주소·돌아오기 주소 만들기/읽기. 응답 모양은 api-contract §2-17(#79, `DrawerCorrectionPage`)만 안다.
 *
 * - API 요청 주소(`drawerCorrectionsUrl`)와 돌아오기 주소(`correctionsReturnUrl`)는 규칙이 다르다: 돌아오기 주소는 sessionStorage 기록의
 *   허용 문자(`shell/correctionsReturn` 의 `isCorrectionsHref`)만 쓰도록 값마다 엄격히 인코딩한다(`URLSearchParams` 는 공백을 `+` 로 바꿔 거절된다).
 * - `Correction.original`·`corrected`·`explanation` 은 여기서 다루지 않는다(화면이 저장 글자 그대로 그린다).
 */
import { cpLength } from '@/components/common/format'
import type { ChunkType, DrawerCorrectionFacets, DrawerCorrectionItem, DrawerCorrectionPage, ErrorType } from '@/types/chat'
import { CORRECTIONS_COPY } from './correctionsCopy'

/** 오류 유형 9종 — `ErrorType` 선언 순(facets 같은 수 정렬 기준과 같다). */
export const DRAWER_ERROR_TYPES: readonly ErrorType[] = [
  'GRAMMAR',
  'PARTICLE',
  'CONJUGATION',
  'VOCABULARY',
  'POLITENESS',
  'NATURALNESS',
  'WORD_ORDER',
  'PRONUNCIATION',
  'OTHER',
]
/** 조각 4종 — 교정 목록에는 「조각 없음」 필터가 없다(계약 §2-17). */
export const DRAWER_CHUNK_TYPES: readonly ChunkType[] = ['NAME', 'ACTION', 'FEELING', 'MODIFIER']
/** 쪽 크기(D4 A). */
export const DRAWER_PAGE_SIZE = 20
/** `limit` 상한(계약) — 돌아오기·단어 시트 뒤 다시 읽기에서 한 번에 받는 최대 개수. */
export const DRAWER_LIMIT_MAX = 50
/** 검색어 상한(코드포인트). */
export const DRAWER_Q_MAX = 40
export const DRAWER_CORRECTIONS_PATH = '/drawer/corrections'
const API_PATH = '/api/v1/drawer/corrections'
const FOCUS_RE = /^[A-Za-z0-9_-]{1,64}$/

/** 조건 — 칩·검색이 고른 값(`filter`)과 지금 깔린 목록을 받아 온 요청의 조건(`shown`)이 같은 모양이다. `q` 는 확정된(trim) 검색어, 없으면 ''. */
export interface DrawerCorrectionFilter {
  errorType: ErrorType | null
  chunkType: ChunkType | null
  q: string
}

export const DRAWER_FILTER_NONE: DrawerCorrectionFilter = { errorType: null, chunkType: null, q: '' }

export function isDrawerErrorType(v: unknown): v is ErrorType {
  return typeof v === 'string' && (DRAWER_ERROR_TYPES as readonly string[]).includes(v)
}

export function isDrawerChunkType(v: unknown): v is ChunkType {
  return typeof v === 'string' && (DRAWER_CHUNK_TYPES as readonly string[]).includes(v)
}

/** 검색어로 쓸 값 — 앞뒤 공백을 뺀 1~40 코드포인트, 아니면 null(빈 칸·초과). */
export function validQ(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t && cpLength(t) <= DRAWER_Q_MAX ? t : null
}

export function hasCondition(f: DrawerCorrectionFilter): boolean {
  return f.errorType !== null || f.chunkType !== null || f.q !== ''
}

/** 단어 시트 뒤 다시 읽기·돌아오기 `n` 의 개수 — 지금 받은 개수를 20~50 으로(위치를 잃지 않게, 계약 상한 안). */
export function reloadLimit(itemCount: number): number {
  const n = Number.isFinite(itemCount) ? Math.trunc(itemCount) : 0
  return Math.min(DRAWER_LIMIT_MAX, Math.max(DRAWER_PAGE_SIZE, n))
}

// ── (a) 요청 주소 ──────────────────────────────────────────────────────────────

/** #79 요청 주소 — 값이 있는 조건만, `limit` 은 늘(기본 20, 1~50 로 자름), `cursor` 는 다음 쪽만. */
export function drawerCorrectionsUrl(f: DrawerCorrectionFilter, opts: { limit?: number; cursor?: string | null } = {}): string {
  const p = new URLSearchParams()
  if (isDrawerErrorType(f.errorType)) p.set('errorType', f.errorType)
  if (isDrawerChunkType(f.chunkType)) p.set('chunkType', f.chunkType)
  const q = validQ(f.q)
  if (q) p.set('q', q)
  const raw = opts.limit ?? DRAWER_PAGE_SIZE
  const limit = Number.isFinite(raw) ? Math.min(DRAWER_LIMIT_MAX, Math.max(1, Math.trunc(raw))) : DRAWER_PAGE_SIZE
  p.set('limit', String(limit))
  if (opts.cursor) p.set('cursor', opts.cursor)
  return `${API_PATH}?${p.toString()}`
}

// ── (b)(c) 유형 칩·머리 줄 개수(§21-5 C) ─────────────────────────────────────────

export interface TypeChip {
  value: ErrorType
  count: number
}

function facetRows(facets: DrawerCorrectionFacets | null | undefined): TypeChip[] {
  const rows = facets?.errorType
  if (!Array.isArray(rows)) return []
  return rows.filter((r): r is TypeChip => !!r && isDrawerErrorType(r.value) && Number.isFinite(r.count) && r.count > 0)
}

/** 「전체」 칩 숫자 = facets 합. */
export function facetTotal(facets: DrawerCorrectionFacets | null | undefined): number {
  return facetRows(facets).reduce((s, r) => s + r.count, 0)
}

/** 유형 칩 = 서버 순서 그대로(0개 생략). 고른 유형이 facets 에 없으면(0개) 그 칩만 `count 0` 으로 끝에 붙인다(사용자가 보고 풀 수 있게). */
export function typeChips(facets: DrawerCorrectionFacets | null | undefined, selected: ErrorType | null): TypeChip[] {
  const rows = facetRows(facets)
  if (selected && !rows.some((r) => r.value === selected)) return [...rows, { value: selected, count: 0 }]
  return rows
}

/**
 * 머리 줄 n — 유형을 고르지 않았으면 facets 합, 골랐으면 **그 유형의 count**(없으면 0).
 * facets 는 유형 조건을 뺀 집계라, 유형을 골랐을 때 합을 쓰면 틀린다.
 */
export function headCount(facets: DrawerCorrectionFacets | null | undefined, selected: ErrorType | null): number {
  const rows = facetRows(facets)
  if (!selected) return rows.reduce((s, r) => s + r.count, 0)
  return rows.find((r) => r.value === selected)?.count ?? 0
}

// ── (d) 빈 상태 종류(§21-4 E1~E3) ───────────────────────────────────────────────

export type DrawerEmptyKind = 'first' | 'filter' | 'search'

/**
 * 받은 항목이 0일 때 그릴 빈 상태 — 지금 목록을 받은 요청의 조건(`shown`)으로 정한다. 항목이 있으면 null.
 * 검색어가 있으면 E3(유형·조각이 함께 걸려 있어도), 유형·조각만 있으면 E2, 조건이 하나도 없으면 E1(처음 비어 있음).
 * 조건 없는 첫 쪽이 0개라는 것은 계약상 facets 합 0 과 같다 — 조건이 하나라도 있으면 E1 이 아니다.
 */
export function emptyKindOf(shown: DrawerCorrectionFilter, itemCount: number): DrawerEmptyKind | null {
  if (itemCount > 0) return null
  if (shown.q) return 'search'
  if (shown.errorType || shown.chunkType) return 'filter'
  return 'first'
}

/** E3 끝에 「유형·조각 조건도 함께 걸려 있어요」를 더할지. */
export function searchHasOtherCondition(shown: DrawerCorrectionFilter): boolean {
  return shown.errorType !== null || shown.chunkType !== null
}

// ── 더 보기·오류 ─────────────────────────────────────────────────────────────────

/** 더 보기로 받은 항목을 id 로 중복을 걸러 뒤에 붙인다. */
export function appendUnique(items: readonly DrawerCorrectionItem[], more: readonly DrawerCorrectionItem[]): DrawerCorrectionItem[] {
  const have = new Set(items.map((c) => c.id))
  return [...items, ...more.filter((c) => !have.has(c.id) && have.add(c.id))]
}

/** 첫 쪽 실패 문구 — 네트워크(status 0)면 「…네트워크를 확인해 주세요.」, 그 밖(서버 오류·400 포함)은 「교정을 불러오지 못했어요.」(서버 문구는 띄우지 않는다). */
export function loadErrorText(e: { status: number }): string {
  return e.status === 0 ? CORRECTIONS_COPY.loadErrorNetwork : CORRECTIONS_COPY.loadError
}

// ── (e) 원래 대화 주소(§21-6 A) ──────────────────────────────────────────────────

/** 원래 대화의 경로(해시 없음) — 돌아오기 기록의 원본 경로. 회화(역할극 포함) → 회화방, 채팅 → 표현 점검, 그 밖(ASK) → null. */
export function sourcePathOf(item: Pick<DrawerCorrectionItem, 'chat'>): string | null {
  const id = encodeURIComponent(item.chat.id)
  if (item.chat.kind === 'TALK') return `/study/ai/talk/${id}`
  if (item.chat.kind === 'CHAT') return `/study/ai/chat/${id}/review`
  return null
}

/** [원래 대화 보기 ›] 주소 — 원래 화면이 `#cr_{id}` 로 그 카드를 강조한다(홈 `PendingCorrectionsCard` 와 같은 모양). */
export function sourceHrefOf(item: Pick<DrawerCorrectionItem, 'id' | 'chat'>): string | null {
  const path = sourcePathOf(item)
  return path ? `${path}#cr_${item.id}` : null
}

// ── (f) 돌아오기 주소(§21-6 B·C) ─────────────────────────────────────────────────

/** `encodeURIComponent` 에 `!'()*` 까지 — 결과는 `[A-Za-z0-9._~%-]` 만(돌아오기 기록의 허용 문자). */
function strictEncode(v: string): string {
  return encodeURIComponent(v).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * 원래 대화로 가기 직전 `history.replaceState`·`rememberCorrectionsReturn` 에 쓰는 교정 모음 주소 — 지금 목록의 조건(`shown`) + 그 카드(`focus`)
 * + 받은 개수(`n`, 호출하는 쪽이 `reloadLimit(items.length)`). 형식이 틀린 값은 붙이지 않는다. 조건·focus·n 이 없으면 `/drawer/corrections`.
 */
export function correctionsReturnUrl(shown: DrawerCorrectionFilter, opts: { focus?: string | null; n?: number | null } = {}): string {
  const parts: string[] = []
  if (isDrawerErrorType(shown.errorType)) parts.push(`errorType=${shown.errorType}`)
  if (isDrawerChunkType(shown.chunkType)) parts.push(`chunkType=${shown.chunkType}`)
  const q = validQ(shown.q)
  if (q) parts.push(`q=${strictEncode(q)}`)
  if (opts.focus && FOCUS_RE.test(opts.focus)) parts.push(`focus=${opts.focus}`)
  const n = opts.n
  if (typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= DRAWER_LIMIT_MAX) parts.push(`n=${n}`)
  return parts.length ? `${DRAWER_CORRECTIONS_PATH}?${parts.join('&')}` : DRAWER_CORRECTIONS_PATH
}

// ── 화면 상태 전이(Developer C — `CorrectionsScreen`, §21-4·21-5) ──────────────────────

/**
 * 첫 쪽 요청 한 번 — 조건·다시 읽기 번호·개수. 화면은 이 객체가 바뀔 때마다 첫 쪽을 읽고, 목록 상태가 **같은 객체**에 대한 응답이 아니면
 * 「읽는 중」이다(요청 경합: 늦게 온 옛 응답은 요청 번호로 버린다).
 * - `retry`: 오류 상자 [다시 시도] — 다시 실패해도 자리표시를 최소 500ms 보인다(`retryFailHoldMs`).
 * - `silent`: 단어 시트 뒤 다시 읽기 — 지금 목록을 그대로 둔 채 읽는다(자리표시로 바꾸면 스크롤 위치를 잃는다).
 */
export interface DrawerQuery {
  filter: DrawerCorrectionFilter
  tick: number
  limit: number
  retry: boolean
  silent: boolean
}

export interface DrawerListState {
  /** 지금 상태가 답한 요청(첫 응답 전 null). */
  query: DrawerQuery | null
  status: 'ready' | 'error'
  items: DrawerCorrectionItem[]
  nextCursor: string | null
  /** 지금 목록을 받아 온 요청의 조건 — 머리 줄·빈 상태 문구는 이것으로 그린다. */
  shown: DrawerCorrectionFilter | null
  /** 마지막으로 성공한 **첫 쪽**의 facets(더 보기 응답 것은 쓰지 않는다). 한 번도 성공 못 했으면 null. */
  facets: DrawerCorrectionFacets | null
  error: string | null
  /** 더 보기를 한 번 이상 성공했는가 — 끝 표시 조건(한 쪽으로 끝나면 끝 표시 없음). */
  moreOk: boolean
}

export const DRAWER_LIST_INITIAL: DrawerListState = {
  query: null,
  status: 'ready',
  items: [],
  nextCursor: null,
  shown: null,
  facets: null,
  error: null,
  moreOk: false,
}

export function drawerQuery(filter: DrawerCorrectionFilter, tick: number, limit: number = DRAWER_PAGE_SIZE, flags: { retry?: boolean; silent?: boolean } = {}): DrawerQuery {
  return { filter, tick, limit, retry: !!flags.retry, silent: !!flags.silent }
}

export function sameFilter(a: DrawerCorrectionFilter, b: DrawerCorrectionFilter): boolean {
  return a.errorType === b.errorType && a.chunkType === b.chunkType && a.q === b.q
}

const NO_FACETS: DrawerCorrectionFacets = { errorType: [] }

/** 첫 쪽 응답 → 목록 상태. 더 보기 표시·오류는 새로 시작한다. */
export function listFromFirstPage(query: DrawerQuery, page: Partial<DrawerCorrectionPage> | null | undefined): DrawerListState {
  return {
    query,
    status: 'ready',
    items: Array.isArray(page?.items) ? page.items : [],
    nextCursor: typeof page?.nextCursor === 'string' && page.nextCursor ? page.nextCursor : null,
    shown: query.filter,
    facets: page?.facets && Array.isArray(page.facets.errorType) ? page.facets : NO_FACETS,
    error: null,
    moreOk: false,
  }
}

/**
 * 첫 쪽 실패 → 옛 조건의 항목은 지우고 오류 상자. facets 는 직전 값을 남긴다 — 조건을 바꾼 첫 쪽이 실패해도 유형 줄로 조건을 다시 바꿀 수 있게
 * (§21-13 ⑧). 한 번도 성공 못 했으면 null 이라 유형 줄이 없다(첫 로딩 실패 — 데모 F).
 * 조용한 다시 읽기(단어 시트 뒤)가 실패하면 받은 목록을 그대로 둔다 — 읽는 중만 끝낸다(단어 버튼이 남아도 누르면 시트가 「찾을 수 없어요」로 다시 읽는다).
 */
export function listFromFirstError(prev: DrawerListState, query: DrawerQuery, message: string): DrawerListState {
  if (query.silent && prev.query !== null && prev.status === 'ready') return { ...prev, query }
  return { query, status: 'error', items: [], nextCursor: null, shown: query.filter, facets: prev.facets, error: message, moreOk: false }
}

/** 더 보기 응답 → 이어 붙임(id 중복 제거). facets 는 바꾸지 않는다(§21-5 C 5). */
export function listWithMore(prev: DrawerListState, page: Partial<DrawerCorrectionPage> | null | undefined): DrawerListState {
  const more = Array.isArray(page?.items) ? page.items : []
  const next = typeof page?.nextCursor === 'string' && page.nextCursor ? page.nextCursor : null
  return { ...prev, items: appendUnique(prev.items, more), nextCursor: next, moreOk: true }
}

/** 단어 시트에서 표현을 고쳤을 때 — 그 단어를 가리키는 카드의 버튼 글자만 바꾼다(요청 없음, §21-6 D). */
export function listWithWordSurface(prev: DrawerListState, wordId: string, surface: string): DrawerListState {
  if (!prev.items.some((c) => c.savedWord?.id === wordId)) return prev
  return { ...prev, items: prev.items.map((c) => (c.savedWord?.id === wordId ? { ...c, savedWord: { id: wordId, surface } } : c)) }
}

export type DrawerBody = 'skeleton' | 'error' | 'emptyFirst' | 'emptyFilter' | 'emptySearch' | 'list'

export interface DrawerView {
  body: DrawerBody
  /** 한 번도 첫 쪽을 받지 못한 채 읽는 중 — 검색·조각 줄 `inert`, 유형 줄 자리표시(데모 F 첫 로딩). */
  firstLoading: boolean
  typeRow: 'skeleton' | 'chips' | 'none'
  /** 머리 줄 글자를 그리는가(읽는 중·오류에는 비움). */
  head: boolean
}

/** 지금 그릴 모양 — 목록 상태가 지금 요청(`query`)의 답이 아니면 읽는 중이다(조용한 다시 읽기는 받은 목록을 그대로 보인다). */
export function drawerView(list: DrawerListState, query: DrawerQuery): DrawerView {
  const pending = list.query !== query
  const firstLoading = pending && list.facets === null
  const typeRow = firstLoading ? 'skeleton' : list.facets === null ? 'none' : 'chips'
  const keepShowing = pending && query.silent && list.query !== null && list.status === 'ready'
  if (pending && !keepShowing) return { body: 'skeleton', firstLoading, typeRow, head: false }
  if (list.status === 'error') return { body: 'error', firstLoading, typeRow, head: false }
  const empty = emptyKindOf(list.shown ?? query.filter, list.items.length)
  const body: DrawerBody = empty === 'first' ? 'emptyFirst' : empty === 'filter' ? 'emptyFilter' : empty === 'search' ? 'emptySearch' : 'list'
  return { body, firstLoading, typeRow, head: true }
}

/** 끝 표시 「채택한 교정을 모두 봤어요 · n개」 — 다음 쪽이 없고 더 보기를 한 번 이상 성공했을 때만. */
export function showEnd(list: DrawerListState): boolean {
  return list.nextCursor === null && list.moreOk && list.items.length > 0
}

/**
 * 목록을 다시 그린 뒤 옮길 초점(돌아오기 복원·단어 삭제/없음 뒤) — `after` 요청의 응답(성공·실패)이 목록에 반영된 다음 **한 번만** 쓴다.
 * `ids` 는 앞에서부터 있는 요소에. 사용자가 그 사이 카드를 펼치거나 접거나 조건을 바꾸면 화면이 이 기록을 버린다.
 */
export interface DrawerFocusWish {
  ids: readonly string[]
  scroll: boolean
  after: DrawerQuery
}

export type DrawerFocusStep<T> = { kind: 'wait' } | { kind: 'drop' } | { kind: 'apply'; target: T }

/**
 * 초점 기록 소비 규칙(REV-184 R2) — 목록이 `after` 의 답이 아니면 기다린다(다시 읽는 중에 다른 카드를 펼쳐도 끌려가지 않게).
 * 더 새 요청(`tick` 이 큰)의 답이 이미 깔렸으면 버린다. `after` 의 답이면 `ids` 중 처음 찾은 요소로 옮기고, 하나도 없으면 버린다(남아서 나중에 끌려가지 않게).
 * `lookup` 은 답이 반영된 뒤에만 부른다.
 */
export function focusWishStep<T>(wish: DrawerFocusWish, listQuery: DrawerQuery | null, lookup: (id: string) => T | null): DrawerFocusStep<T> {
  if (listQuery !== wish.after) return listQuery !== null && listQuery.tick > wish.after.tick ? { kind: 'drop' } : { kind: 'wait' }
  for (const id of wish.ids) {
    const target = lookup(id)
    if (target) return { kind: 'apply', target }
  }
  return { kind: 'drop' }
}

/**
 * 입력이 바뀔 때 40자 초과 안내를 계속 둘지(REV-184 R4) — 이미 떠 있고, 지금 입력(앞뒤 공백 뺀 것 — 확정 때와 같은 기준)이 아직 40 코드포인트를 넘을 때만.
 * 입력 중에는 새로 띄우지 않는다(안내·조회는 Enter 확정 때만).
 */
export function keepSearchTooLong(shown: boolean, input: string): boolean {
  return shown && cpLength(input.trim()) > DRAWER_Q_MAX
}

/** `page.tsx` 가 읽어 `CorrectionsScreen initial` 로 넘기는 복원 값. 형식이 틀린 값은 그 값만 버린다(null·''). */
export interface CorrectionsInitial {
  filter: DrawerCorrectionFilter
  focus: string | null
  n: number | null
}

type QueryLike = URLSearchParams | Record<string, string | string[] | undefined>

function one(src: QueryLike, key: string): string | null {
  if (src instanceof URLSearchParams) {
    const all = src.getAll(key)
    return all.length === 1 ? all[0] : null
  }
  const v = src[key]
  return typeof v === 'string' ? v : null
}

/** 돌아오기 쿼리 읽기 — `errorType`(9종)·`chunkType`(4종)·`q`(trim 1~40)·`focus`(`[A-Za-z0-9_-]{1,64}`)·`n`(정수 1~50). 같은 키가 둘 이상이면 버린다. */
export function parseCorrectionsReturnQuery(src: QueryLike): CorrectionsInitial {
  const et = one(src, 'errorType')
  const ck = one(src, 'chunkType')
  const focus = one(src, 'focus')
  const nRaw = one(src, 'n')
  const n = nRaw !== null && /^[1-9][0-9]?$/.test(nRaw) ? Number(nRaw) : null
  return {
    filter: {
      errorType: isDrawerErrorType(et) ? et : null,
      chunkType: isDrawerChunkType(ck) ? ck : null,
      q: validQ(one(src, 'q')) ?? '',
    },
    focus: focus !== null && FOCUS_RE.test(focus) ? focus : null,
    n: n !== null && n <= DRAWER_LIMIT_MAX ? n : null,
  }
}
