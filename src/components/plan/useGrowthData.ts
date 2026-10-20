'use client'

/**
 * 성장 기록(#78) 불러오기 훅 — 상태 기계는 `growthLoader.ts`(React 없이 시험, screens.md §36-4). 이 훅은 화면 한 번에 컨트롤러 하나를 만들고 구독만 한다.
 * 기간은 컨트롤러가 갖는다(`weeks`·`setWeeks`) — 바꾸는 순간 같은 렌더에서 `busy`·오류 잊기가 함께 반영된다(렌더 중 외부 상태를 바꾸지 않는다).
 * `initialWeeks` 는 첫 값으로만 쓴다(주소 `?weeks=`).
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { apiGet } from '@/components/common/api'
import type { GrowthResponse, GrowthWeeks } from '@/types/plan'
import { GrowthLoader } from './growthLoader'

export type { GrowthStatus } from './growthLoader'

export const growthPath = (weeks: GrowthWeeks) => `/api/v1/plan/growth?weeks=${weeks}`

export function useGrowthData(initialWeeks: GrowthWeeks) {
  const [loader] = useState(
    () =>
      new GrowthLoader(initialWeeks, {
        load: (w) => apiGet<GrowthResponse>(growthPath(w)),
        now: () => Date.now(),
        setTimer: (fn, ms) => setTimeout(fn, ms),
        clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
      }),
  )
  const view = useSyncExternalStore(loader.subscribe, loader.getView, loader.getView)
  useEffect(() => {
    loader.start()
    return loader.stop
  }, [loader])
  return { ...view, setWeeks: loader.setWeeks, reload: loader.reload }
}
