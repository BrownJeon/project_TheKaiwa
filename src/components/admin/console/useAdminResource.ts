'use client'

/**
 * 콘솔 GET 한 건(screens.md §6-3). 다시 불러오는 동안 이전 data 를 유지한다(깜박임 없음) — `reloading` 만 켜진다.
 * path 가 바뀌면 이전 요청을 끊고 새로 읽는다(늦게 온 옛 응답은 버린다). path=null 이면 아무것도 하지 않는다.
 * 폴링(`pollMs`)은 탭이 보일 때만 돈다. 다시 보이면 마지막 갱신이 pollMs 보다 오래됐을 때 바로 읽는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, isAbort } from '@/components/common/api'
import { type Err, toErr } from '@/components/common/errors'

export interface AdminResource<T> {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: T | null
  /** 마지막 요청의 오류. `ready` 인데 err 가 있으면 "다시 불러오기 실패"(이전 data 는 그대로). */
  err: Err | null
  loadedAt: number | null
  reloading: boolean
  reload: () => void
}

interface State<T> {
  path: string | null
  data: T | null
  err: Err | null
  loadedAt: number | null
  inFlight: boolean
}

export function useAdminResource<T>(path: string | null, opts: { pollMs?: number; paused?: boolean } = {}): AdminResource<T> {
  const { pollMs, paused = false } = opts
  const [state, setState] = useState<State<T>>({ path: null, data: null, err: null, loadedAt: null, inFlight: false })
  const ctrlRef = useRef<AbortController | null>(null)
  const pathRef = useRef(path)
  const loadedAtRef = useRef<number | null>(null)
  const pausedRef = useRef(paused)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const load = useCallback(async (p: string) => {
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setState((s) => (s.path === p ? { ...s, inFlight: true } : { path: p, data: null, err: null, loadedAt: null, inFlight: true }))
    try {
      const data = await apiGet<T>(p, { signal: ctrl.signal })
      if (ctrl.signal.aborted || pathRef.current !== p) return
      const at = Date.now()
      loadedAtRef.current = at
      setState({ path: p, data, err: null, loadedAt: at, inFlight: false })
    } catch (e) {
      if (isAbort(e) || ctrl.signal.aborted || pathRef.current !== p) return
      setState((s) => ({ ...s, path: p, err: toErr(e), inFlight: false }))
    }
  }, [])

  useEffect(() => {
    pathRef.current = path
    loadedAtRef.current = null
    if (!path) return
    void load(path)
    return () => ctrlRef.current?.abort()
  }, [path, load])

  const reload = useCallback(() => {
    const p = pathRef.current
    if (p) void load(p)
  }, [load])

  useEffect(() => {
    if (!pollMs || !path) return
    const tick = () => {
      if (document.visibilityState === 'visible' && !pausedRef.current) reload()
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || pausedRef.current) return
      const at = loadedAtRef.current
      if (!at || Date.now() - at >= pollMs) reload()
    }
    const id = setInterval(tick, pollMs)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pollMs, path, reload])

  // path 가 바뀐 직후(아직 이 path 의 상태가 없을 때)는 이전 path 의 data 를 보이지 않는다.
  const current = state.path === path
  const data = current ? state.data : null
  const err = current ? state.err : null
  const inFlight = current ? state.inFlight : Boolean(path)
  let status: AdminResource<T>['status']
  if (!path) status = 'idle'
  else if (data !== null) status = 'ready'
  else if (err && !inFlight) status = 'error'
  else status = 'loading'

  return { status, data, err: inFlight ? null : err, loadedAt: current ? state.loadedAt : null, reloading: inFlight && data !== null, reload }
}
