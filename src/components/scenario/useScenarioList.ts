'use client'

/**
 * 상황 목록(S1 = #161) — 추천·전체를 한 응답에서(`recommendedIds` 뿌리 칸). 한 쪽 상한(100)을 넘으면 커서로 이어 받는다(최대 5쪽).
 * `refresh()` 는 지금 목록을 둔 채 조용히(지우기·저장 뒤), `reload()` 는 불러오는 중으로 바꿔 다시. 늦게 온 응답은 순번으로 버린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { SCENARIO_LIMITS, type ScenarioListItem, type ScenarioListResponse } from '@/types/scenario'

const PAGE_MAX = 5

const pagePath = (cursor: string | null) => `/api/v1/scenarios?limit=${SCENARIO_LIMITS.listMax}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`

export interface ScenarioListData {
  items: ScenarioListItem[]
  recommendedIds: string[]
}

export async function readScenarioPages(get: (path: string) => Promise<ScenarioListResponse> = (p) => apiGet<ScenarioListResponse>(p)): Promise<ScenarioListData> {
  const first = await get(pagePath(null))
  const items = [...first.items]
  let cursor = first.nextCursor
  for (let i = 1; cursor && i < PAGE_MAX; i++) {
    const next = await get(pagePath(cursor))
    const seen = new Set(items.map((x) => x.id))
    items.push(...next.items.filter((x) => !seen.has(x.id)))
    cursor = next.nextCursor
  }
  return { items, recommendedIds: Array.isArray(first.recommendedIds) ? first.recommendedIds : [] }
}

type State = { status: 'loading' | 'ready' | 'error'; data: ScenarioListData | null }

export function useScenarioList() {
  const [state, setState] = useState<State>({ status: 'loading', data: null })
  const seq = useRef(0)

  const request = useCallback((silent: boolean) => {
    const id = ++seq.current
    readScenarioPages().then(
      (data) => {
        if (id === seq.current) setState({ status: 'ready', data })
      },
      () => {
        if (id === seq.current) setState((s) => (silent && s.data ? s : { status: 'error', data: null }))
      },
    )
  }, [])

  useEffect(() => {
    request(false)
  }, [request])

  const reload = useCallback(() => {
    setState({ status: 'loading', data: null })
    request(false)
  }, [request])
  const refresh = useCallback(() => request(true), [request])

  return { ...state, reload, refresh }
}
