'use client'

/**
 * 챌린지 읽기(#155·#157·#158·#56) — 계획표 달력과 같은 `useKeyedResource`(요청 키와 함께 상태 보관·늦게 온 응답은 순번으로 버림·
 * `refresh` 는 지금 값을 둔 채 조용히). 기록 목록(#155)만 커서를 이어 붙이므로 자체 상태를 둔다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { useKeyedResource } from '@/components/plan/usePlanData'
import type { ChallengeDetail, ChallengeListResponse, ChallengeSummary, ChallengeTodayResponse } from '@/types/challenge'
import type { TopicList } from '@/types/lesson'
import { readListPages } from './logic'

const todayPath = () => '/api/v1/challenges/today'
const detailPath = (id: string) => `/api/v1/challenges/${encodeURIComponent(id)}`
const topicsPath = () => '/api/v1/topics'
const listPage = (cursor: string | null) =>
  apiGet<ChallengeListResponse>(`/api/v1/challenges?status=ALL&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)

export function useChallengeToday() {
  return useKeyedResource<ChallengeTodayResponse>('today', todayPath)
}

export function useChallengeDetail(id: string | null) {
  return useKeyedResource<ChallengeDetail>(id, detailPath)
}

export function useTopics() {
  return useKeyedResource<TopicList>('topics', topicsPath)
}

type ListState = { status: 'loading' | 'ready' | 'error'; items: ChallengeSummary[]; cursor: string | null; more: 'idle' | 'busy' }

export function useChallengeList(onMoreFail: () => void) {
  const [state, setState] = useState<ListState>({ status: 'loading', items: [], cursor: null, more: 'idle' })
  const [tick, setTick] = useState(0)
  const busy = useRef(false)

  useEffect(() => {
    let cancelled = false
    readListPages(listPage, null).then(
      (d) => !cancelled && setState({ status: 'ready', items: d.items, cursor: d.nextCursor, more: 'idle' }),
      () => !cancelled && setState({ status: 'error', items: [], cursor: null, more: 'idle' }),
    )
    return () => {
      cancelled = true
    }
  }, [tick])

  const reload = useCallback(() => {
    setState({ status: 'loading', items: [], cursor: null, more: 'idle' })
    setTick((n) => n + 1)
  }, [])

  const loadMore = useCallback(() => {
    if (busy.current || !state.cursor) return
    busy.current = true
    const cursor = state.cursor
    setState((s) => ({ ...s, more: 'busy' }))
    readListPages(listPage, cursor).then(
      (d) => {
        busy.current = false
        setState((s) => {
          const seen = new Set(s.items.map((x) => x.id))
          return { ...s, items: [...s.items, ...d.items.filter((x) => !seen.has(x.id))], cursor: d.nextCursor, more: 'idle' }
        })
      },
      () => {
        busy.current = false
        setState((s) => ({ ...s, more: 'idle' }))
        onMoreFail()
      },
    )
  }, [state.cursor, onMoreFail])

  return { ...state, reload, loadMore }
}
