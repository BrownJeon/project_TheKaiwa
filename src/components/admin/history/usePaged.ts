'use client'

/**
 * 커서 목록 GET(#108·#137 `{items, nextCursor}`) — [더 보기]로 이어 붙인다. 경로(필터)가 바뀌면 처음부터 다시 읽고, 늦게 온 옛 응답은 버린다.
 * `pathFor(cursor)` 는 필터가 같으면 같은 함수여야 한다(호출자가 useCallback).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, isAbort } from '@/components/common/api'
import { type Err, toErr } from '@/components/common/errors'

interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export function usePaged<T>(pathFor: ((cursor: string | null) => string) | null) {
  const [state, setState] = useState<{ key: string | null; items: T[]; next: string | null; err: Err | null; loading: boolean; more: boolean }>({ key: null, items: [], next: null, err: null, loading: false, more: false })
  const ctrl = useRef<AbortController | null>(null)
  const first = pathFor ? pathFor(null) : null
  const keyRef = useRef<string | null>(first)

  const load = useCallback(
    async (cursor: string | null) => {
      if (!pathFor) return
      const key = pathFor(null)
      ctrl.current?.abort()
      const c = new AbortController()
      ctrl.current = c
      setState((s) => (cursor && s.key === key ? { ...s, more: true, err: null } : { key, items: s.key === key ? s.items : [], next: null, err: null, loading: true, more: false }))
      try {
        const page = await apiGet<Page<T>>(pathFor(cursor), { signal: c.signal })
        if (c.signal.aborted || keyRef.current !== key) return
        setState((s) => ({ key, items: cursor && s.key === key ? [...s.items, ...page.items] : page.items, next: page.nextCursor, err: null, loading: false, more: false }))
      } catch (e) {
        if (isAbort(e) || keyRef.current !== key) return
        setState((s) => ({ ...s, key, err: toErr(e), loading: false, more: false }))
      }
    },
    [pathFor],
  )

  useEffect(() => {
    keyRef.current = first
    if (!first) return
    void load(null)
    return () => ctrl.current?.abort()
  }, [first, load])

  const current = state.key === first
  return {
    items: current ? state.items : [],
    nextCursor: current ? state.next : null,
    err: current ? state.err : null,
    loading: !current || state.loading,
    loadingMore: current && state.more,
    loadMore: () => {
      if (state.next) void load(state.next)
    },
    reload: () => void load(null),
  }
}
