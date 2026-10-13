'use client'

/**
 * 지난 질문 시트 5개씩 쪽(task-067 §27-4 C) — `AskHistorySheet` 안에 둔다(시트는 `AskChatTab` 이 살아 있는 동안 늘 마운트돼 보던 쪽을 기억, J2).
 * 상태 전이는 전부 `historyPaging.ts` 의 순수 함수. 기다리는 요청(`req`)을 상태에 싣고 효과가 그것을 읽는다 — 응답은 순서표로 거른다.
 * 열 때마다 지금 쪽을 다시 읽고(행이 있으면 그대로 보여 둔 채), `resetKey` 가 바뀌면 1쪽으로(새 대화가 생겼을 때).
 * 알약 값(`running`·`newCount`)은 여기서 계산하지 않는다 — 6번째 이후 대화를 놓치므로 `useAskActivity`(최근 20개)만 쓴다(T12).
 */
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import type { ChatSummary } from '@/types/chat'
import {
  INITIAL_PAGER,
  beginPage,
  canNext,
  canPrev,
  historyListUrl,
  historyPages,
  isPaged,
  patchRow,
  reloadAfterDelete,
  resetPager,
  settlePage,
  type AskListPage,
  type HistoryStatus,
  type PagerState,
} from './historyPaging'

export interface AskHistoryPages {
  /** 0부터 */
  page: number
  pages: number
  /** 첫 응답 전 null */
  total: number | null
  /** 이 쪽 ≤ 5 */
  items: ChatSummary[]
  status: HistoryStatus
  /** 행 시각(오늘/어제) 기준 — 읽을 때 같이 정한다 */
  now: Date | null
  paged: boolean
  hasNext: boolean
  canPrev: boolean
  canNext: boolean
  next(): void
  prev(): void
  retry(): void
  /** 삭제 뒤 — 그 행을 빼고 같은 커서로 지금 쪽을 다시(쪽이 비면 앞 쪽) */
  reload(removedId: string): void
  /** 제자리 고침(제목) */
  patch(id: string, p: Partial<ChatSummary>): void
}

export function useAskHistoryPages({ open, resetKey }: { open: boolean; resetKey: number }): AskHistoryPages {
  const [s, setS] = useState<PagerState>(INITIAL_PAGER)
  const [seenOpen, setSeenOpen] = useState(false)
  const [seenReset, setSeenReset] = useState(resetKey)

  // 렌더 중 조정(열림·1쪽으로) — 효과 안에서 상태를 바꾸지 않는다. 요청은 아래 효과가 `req` 를 보고 보낸다.
  if (open !== seenOpen || resetKey !== seenReset) {
    let n = s
    if (resetKey !== seenReset) n = resetPager(n)
    if (open && (!seenOpen || n !== s)) n = beginPage(n, 'open')
    setSeenOpen(open)
    setSeenReset(resetKey)
    if (n !== s) setS(n)
  }

  const req = s.req
  useEffect(() => {
    if (!req) return
    let live = true
    apiGet<AskListPage>(historyListUrl(req.cursor))
      .then((page) => {
        if (live) setS((cur) => settlePage(cur, req, { ok: true, page, now: new Date() }))
      })
      .catch(() => {
        if (live) setS((cur) => settlePage(cur, req, { ok: false }))
      })
    return () => {
      live = false
    }
  }, [req])

  const next = useCallback(() => setS((cur) => beginPage(cur, 'next')), [])
  const prev = useCallback(() => setS((cur) => beginPage(cur, 'prev')), [])
  const retry = useCallback(() => setS((cur) => beginPage(cur, 'retry')), [])
  const reload = useCallback((id: string) => setS((cur) => reloadAfterDelete(cur, id)), [])
  const patch = useCallback((id: string, p: Partial<ChatSummary>) => setS((cur) => patchRow(cur, id, p)), [])

  return {
    page: s.page,
    pages: historyPages(s.total),
    total: s.total,
    items: s.items,
    status: s.status,
    now: s.now,
    paged: isPaged(s.total, s.page),
    hasNext: s.hasNext,
    canPrev: canPrev(s),
    canNext: canNext(s),
    next,
    prev,
    retry,
    reload,
    patch,
  }
}
