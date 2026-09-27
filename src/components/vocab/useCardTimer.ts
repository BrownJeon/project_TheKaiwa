'use client'

/**
 * 카드 응답 시간(`responseMs`, screens.md §5-2 D). 그 카드가 **지금 카드로 보이는 동안만** 쌓는다 —
 * 탭이 숨겨진 동안(`document.hidden`)·지난 카드를 보는 동안·응답을 기다리는 동안은 멈춘다. `key` 가 바뀌면(새 카드) 0 부터.
 * 카드마다 타이머·재촉 문구는 보이지 않는다(§5-10 12초 리듬).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createStopwatch } from './deck'

export function useCardTimer(key: number, running: boolean): () => number {
  const [w] = useState(() => createStopwatch(() => performance.now()))
  const keyRef = useRef(key)

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key
      w.reset()
    }
    if (running && document.visibilityState === 'visible') w.start()
    const onVis = () => {
      if (document.visibilityState !== 'visible') w.stop()
      else if (running) w.start()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      w.stop()
    }
  }, [key, running, w])

  return useCallback(() => w.elapsed(), [w])
}
