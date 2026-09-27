/**
 * 발음 사전 URL 쿼리(screens.md §10-1 표). 서버 page 가 검증해 `initialParams` 로 넘기고, 클라이언트는 같은 함수로 쿼리를 만든다.
 * 순수 모듈 — 서버 page 도 import 하므로 `'use client'`·브라우저 API·`common/api` 를 쓰지 않는다. 틀린 값은 조용히 버린다.
 */
import { LEXICON_LIMITS, LEXICON_SCOPES, type LexiconScopeName } from '@/types/lexicon'

export type LexiconScopeFilter = 'ALL' | LexiconScopeName

export interface LexiconParams {
  q: string
  scope: LexiconScopeFilter
  ref: string
  inactive: boolean
  page: number
}

export const DEFAULT_LEXICON_PARAMS: LexiconParams = { q: '', scope: 'ALL', ref: '', inactive: false, page: 1 }

export const LEXICON_PAGE_SIZE = LEXICON_LIMITS.pageSizeDefault
export const VERSIONS_PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

function one(sp: SearchParams, key: string): string | null {
  const v = sp[key]
  return typeof v === 'string' ? v : null
}

const REF_RE = /^[\w-]{1,40}$/

export function parseLexiconParams(sp: SearchParams): LexiconParams {
  const out: LexiconParams = { ...DEFAULT_LEXICON_PARAMS }
  const q = one(sp, 'q')
  if (q !== null && Array.from(q).length <= LEXICON_LIMITS.surfaceMax) out.q = q
  const scope = one(sp, 'scope')
  if (scope && (LEXICON_SCOPES as readonly string[]).includes(scope)) out.scope = scope as LexiconScopeName
  const ref = one(sp, 'ref')
  if (ref && REF_RE.test(ref) && out.scope !== 'ALL' && out.scope !== 'GLOBAL') out.ref = ref
  if (one(sp, 'inactive') === '1') out.inactive = true
  const page = one(sp, 'page')
  if (page && /^\d{1,4}$/.test(page)) {
    const n = Number(page)
    if (n >= 1 && n <= 1000) out.page = n
  }
  return out
}

export function parseVersionParam(sp: SearchParams): number | null {
  const v = one(sp, 'v')
  if (!v || !/^\d{1,7}$/.test(v)) return null
  const n = Number(v)
  return n >= 1 ? n : null
}

/** 화면 URL 쿼리(`?q=&scope=&ref=&inactive=1&page=`) — 기본값은 뺀다. */
export function toQuery(p: LexiconParams): string {
  const u = new URLSearchParams()
  if (p.q) u.set('q', p.q)
  if (p.scope !== 'ALL') u.set('scope', p.scope)
  if (p.ref && p.scope !== 'ALL' && p.scope !== 'GLOBAL') u.set('ref', p.ref)
  if (p.inactive) u.set('inactive', '1')
  if (p.page > 1) u.set('page', String(p.page))
  const s = u.toString()
  return s ? `?${s}` : ''
}

/** 필터가 하나라도 걸렸는지(빈 목록 문구 갈래). 쪽 번호는 필터가 아니다. */
export function isFiltered(p: LexiconParams): boolean {
  return Boolean(p.q) || p.scope !== 'ALL' || Boolean(p.ref)
}

/** 필터를 바꾸면 쪽을 1로. 범위를 ALL·GLOBAL 로 바꾸면 대상도 뺀다. */
export function patchParams(p: LexiconParams, patch: Partial<LexiconParams>): LexiconParams {
  const next: LexiconParams = { ...p, ...patch }
  const filterChanged = (['q', 'scope', 'ref', 'inactive'] as const).some((k) => k in patch && patch[k] !== p[k])
  if (filterChanged && !('page' in patch)) next.page = 1
  if ('scope' in patch && patch.scope !== p.scope && !('ref' in patch)) next.ref = ''
  if (next.scope === 'ALL' || next.scope === 'GLOBAL') next.ref = ''
  return next
}
