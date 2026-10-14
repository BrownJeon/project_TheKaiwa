/**
 * 단어장 목록 조건·머리 줄의 순수 규칙(task-023 REV-050 M-1 · task-068 §28-2 F). 순수 모듈.
 *
 * 머리 줄("단어 9개 · 여행 · 느낌 조각 · 3쪽")과 빈 화면 안내는 **지금 깔린 행을 받아 온 응답**의 조건으로 그린다 — 화면의 현재 필터가 아니다.
 * 필터를 바꾼 뒤 응답이 오기 전까지는 이전 응답의 행이 그대로 보이므로, 개수·조건도 그 응답 것을 유지하다가 새 응답이 올 때 함께 바뀐다.
 * 그래야 개수와 조건이 서로 다른 응답에서 섞이지 않고, aria-live 가 어긋난 문장을 읽지 않는다.
 * 쪽 상태·요청 규칙은 `wordsPaging.ts`(task-068 — 로컬에서 행을 빼던 `listWithoutRow` 는 쪽 방식에서 개수가 어긋나 지웠다, J4).
 */
import type { WordChunkFilter, WordListSource } from '@/types/vocab'
import { listConditionText } from './labels'
import { isWordsPaged, type WordsListState } from './wordsPaging'

export interface WordListFilter {
  q: string
  category: string | null
  chunk: WordChunkFilter | null
  archived: boolean
  /** 출처 분절(D10 A) — 저장하지 않는다(D2). */
  source: WordListSource
}

export const WORD_FILTER_INITIAL: WordListFilter = { q: '', category: null, chunk: null, archived: false, source: 'all' }

export type WordListHeader =
  | { lead: 'all' | 'mine' | 'base' | 'archived'; n: number; condition: string | null; pageNo: number | null }
  | { lead: 'search'; q: string; n: number; condition: string | null; pageNo: number | null }

/**
 * 목록 머리 줄. 응답이 없거나(첫 로딩) 첫 읽기 오류 중이면 null — 개수를 모르는 문장을 만들지 않는다.
 * `page` 는 0부터. `pageNo`(1부터) = 쪽 접미사 「· 3쪽」 — 7개 이하 1쪽이면 null(접미사 없음). 화면은 접미사를 `aria-hidden` 으로 그린다.
 */
export function listHeader(list: WordsListState, page: number): WordListHeader | null {
  if (!list.shown || list.status === 'first' || list.status === 'firstError') return null
  const f = list.shown
  const n = list.total ?? list.items.length
  const condition = listConditionText(f)
  const pageNo = isWordsPaged(list.total, page) ? page + 1 : null
  if (f.archived) return { lead: 'archived', n, condition, pageNo }
  if (f.q) return { lead: 'search', q: f.q, n, condition, pageNo }
  return { lead: f.source, n, condition, pageNo }
}
