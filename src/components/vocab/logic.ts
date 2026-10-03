/**
 * 단어장 목록 상태의 순수 규칙(task-023 REV-050 M-1). 순수 모듈.
 *
 * 머리 줄("단어 9개 · N5 기초 · 느낌 조각")과 빈 화면 안내는 **지금 깔린 행을 받아 온 응답**의 조건으로 그린다 — 화면의 현재 필터가 아니다.
 * 필터를 바꾼 뒤 응답이 오기 전까지는 이전 응답의 행이 그대로 보이므로, 개수·조건도 그 응답 것을 유지하다가 새 응답이 올 때 함께 바뀐다.
 * 그래야 개수와 조건이 서로 다른 응답에서 섞이지 않고, aria-live 가 어긋난 문장을 읽지 않는다.
 */
import type { WordChunkFilter, WordEntry, WordListPage } from '@/types/vocab'
import { listConditionText } from './labels'

export interface WordListFilter {
  q: string
  category: string | null
  chunk: WordChunkFilter | null
  archived: boolean
}

export interface WordListState {
  items: WordEntry[]
  nextCursor: string | null
  total: number | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
  /** 지금 깔린 행·total 을 받아 온 요청의 조건(첫 응답 전에는 null). */
  shown: WordListFilter | null
}

export const WORD_LIST_INITIAL: WordListState = { items: [], nextCursor: null, total: null, status: 'loading', error: null, shown: null }

/** 첫 쪽 응답 → 목록 상태. `filter` 는 화면의 지금 값이 아니라 **그 요청을 보낸 때의 조건**을 넘긴다. */
export function listFromPage(filter: WordListFilter, page: Partial<WordListPage> | null | undefined): WordListState {
  return {
    items: page?.items ?? [],
    nextCursor: page?.nextCursor ?? null,
    total: typeof page?.total === 'number' ? page.total : null,
    status: 'ready',
    error: null,
    shown: filter,
  }
}

/** 한 행을 목록에서 뺀다(보관·삭제). 그 행이 목록에 있었을 때만 total 을 1 줄이고, 조건은 그대로 둔다. */
export function listWithoutRow(list: WordListState, id: string): WordListState {
  const had = list.items.some((w) => w.id === id)
  return { ...list, items: list.items.filter((w) => w.id !== id), total: had && list.total !== null ? Math.max(0, list.total - 1) : list.total }
}

export type WordListHeader =
  | { lead: 'all' | 'archived'; n: number; condition: string | null }
  | { lead: 'search'; q: string; n: number; condition: string | null }

/** 목록 머리 줄. 응답이 없거나(첫 로딩) 오류 중이면 null — 개수를 모르는 문장을 만들지 않는다. */
export function listHeader(list: WordListState): WordListHeader | null {
  if (list.status !== 'ready' || !list.shown) return null
  const f = list.shown
  const n = list.total ?? list.items.length
  const condition = listConditionText(f)
  if (f.archived) return { lead: 'archived', n, condition }
  if (f.q) return { lead: 'search', q: f.q, n, condition }
  return { lead: 'all', n, condition }
}
