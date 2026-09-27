'use client'

/**
 * 경과·남은 초 표시용 시계. **렌더 중에 `Date.now()` 를 부르지 않는다**(렌더는 순수해야 한다) —
 * 타이머 콜백이 상태로 넣어 준다. 첫 틱 전에는 0 이므로 호출부는 0 을 "아직 모름"으로 다룬다.
 */
import { useEffect, useState } from 'react'

export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [active, intervalMs])
  return now
}

/** `until`(ms)까지 남은 초. 모르면(첫 틱 전) null, 끝났으면 0 — 0 이 되면 시계를 멈춘다. */
export function useCountdown(until: number | null): number | null {
  const [now, setNow] = useState(0)
  const running = until !== null && (now === 0 || now < until)
  useEffect(() => {
    if (!running) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [running])
  if (until === null) return 0
  if (now === 0) return null
  return Math.max(0, Math.ceil((until - now) / 1000))
}

/** 경과 초(시작 시각을 모르면 0). */
export function elapsedSec(now: number, startedAt: number | null): number {
  if (!now || !startedAt) return 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}
