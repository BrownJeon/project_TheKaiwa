'use client'

/**
 * 달력(#70)·하루 상세(#71) 불러오기. 상태는 **요청한 키(달·날짜)와 함께** 보관한다 — 키가 바뀌면 이전 응답을 쓰지 않고
 * 곧바로 "불러오는 중"으로 읽힌다(effect 안에서 로딩 상태를 따로 세우지 않는다). 늦게 온 이전 응답은 순번으로 버린다.
 * `refresh()` 는 지금 보이는 값을 둔 채 조용히 다시 읽는다(기록을 지운 뒤 — 실패해도 화면을 오류로 바꾸지 않는다).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import type { CalendarResponse, DayResponse } from '@/types/plan'

export type LoadStatus = 'loading' | 'ready' | 'error'

interface Keyed<T> {
  key: string | null
  status: LoadStatus
  data: T | null
  /** 실패한 응답의 HTTP status(0 = 네트워크) — 404 화면을 가를 때만 쓴다(챌린지 상세, task-043). */
  errStatus: number | null
}

/** 챌린지 화면(task-043)도 같은 규칙으로 읽는다 — `path` 는 렌더마다 바뀌지 않는 함수(모듈 상수)를 넘긴다. */
export function useKeyedResource<T>(key: string | null, path: (key: string) => string) {
  const [state, setState] = useState<Keyed<T>>({ key: null, status: 'loading', data: null, errStatus: null })
  const seq = useRef(0)

  /** 응답은 콜백에서만 반영한다. `silent` 면 실패해도 지금 값을 둔다. */
  const request = useCallback(
    (k: string, silent: boolean) => {
      const id = ++seq.current
      apiGet<T>(path(k)).then(
        (data) => {
          if (id === seq.current) setState({ key: k, status: 'ready', data, errStatus: null })
        },
        (e: unknown) => {
          // 조용한 새로 읽기는 이미 보이는 값이 있을 때만 그 값을 지킨다(앞선 첫 읽기를 대신했다면 오류로 드러낸다).
          const errStatus = toErr(e).status
          if (id === seq.current) setState((s) => (silent && s.key === k && s.data ? s : { key: k, status: 'error', data: null, errStatus }))
        },
      )
    },
    [path],
  )

  useEffect(() => {
    if (key) request(key, false)
  }, [key, request])

  const current = key !== null && state.key === key
  const reload = useCallback(() => {
    if (!key) return
    setState({ key: null, status: 'loading', data: null, errStatus: null })
    request(key, false)
  }, [key, request])
  const refresh = useCallback(() => {
    if (key) request(key, true)
  }, [key, request])
  const patch = useCallback((fn: (d: T) => T) => {
    setState((s) => (s.data ? { ...s, data: fn(s.data) } : s))
  }, [])

  return {
    status: current ? state.status : ('loading' as LoadStatus),
    data: current ? state.data : null,
    errStatus: current ? state.errStatus : null,
    reload,
    refresh,
    patch,
  }
}

const calendarPath = (month: string) => `/api/v1/plan/calendar?month=${encodeURIComponent(month)}`
const dayPath = (date: string) => `/api/v1/plan/day?date=${encodeURIComponent(date)}`

export function useCalendar(month: string) {
  return useKeyedResource<CalendarResponse>(month, calendarPath)
}

export function useDay(date: string | null) {
  return useKeyedResource<DayResponse>(date, dayPath)
}
