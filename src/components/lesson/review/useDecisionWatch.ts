'use client'

/**
 * 강사 판단 대기 재확인(screens §14-3 A) — 판단 잡 id 를 화면이 지켜보지 않고 #58 을 다시 읽는다(Leader ②, 새 요청 경로 없음).
 * 켜진 뒤 10·20·30초, 그 뒤 30초마다, **3분**에서 멈춘다(그 뒤는 기존 화면 복귀 tick). 화면이 가려져 있으면 그 회차는 건너뛴다.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'

/** 켜진 때부터의 재확인 시점(초). */
export const DECISION_WATCH_AT_SEC = [10, 20, 30, 60, 90, 120, 150, 180] as const

export function useDecisionWatch(active: boolean, reload: () => void): void {
  const reloadRef = useRef(reload)
  useLayoutEffect(() => {
    reloadRef.current = reload
  })

  useEffect(() => {
    if (!active) return
    const timers = DECISION_WATCH_AT_SEC.map((sec) =>
      setTimeout(() => {
        if (document.visibilityState === 'visible') reloadRef.current()
      }, sec * 1000),
    )
    return () => timers.forEach(clearTimeout)
  }, [active])
}
