'use client'

/**
 * 동작 결과 알림(데모의 `.toast`). 저장·토글처럼 **화면이 조금만 바뀌는 동작**이
 * 실제로 일어났는지 알려 준다.
 *
 * 하단 탭 위로 띄우되 safe-area 를 더해 제스처 바에 가리지 않게 한다. 키보드가 열려 있으면 키보드 위에 뜬다(task-021 R7 —
 * 화면이 줄어드는 환경은 저절로, 덮기만 하는 환경은 `--kb-inset` 만큼 더 올린다).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** `ms` 는 선택(기본 2.6초) — 상태 전환 안내처럼 조금 더 읽어야 하는 문구만 늘린다(≤4초, screens §7-3). */
  const show = useCallback((msg: string, ms = 2600) => {
    setMessage(msg)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), ms)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { message, show }
}

/** `bottomPx` = 하단에서 띄울 거리(기본 84 — 하단 탭·채팅 입력창 위). 회화방 음성 입력 바(≈116px)는 더 띄운다. */
export default function Toast({ message, bottomPx = 84 }: { message: string | null; bottomPx?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-4 right-4 z-50 rounded-xl bg-ink px-3.5 py-3 text-[13px] text-surface shadow-lg transition-opacity ${
        message ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ bottom: `calc(${bottomPx}px + var(--safe-bottom) + var(--kb-inset, 0px))` }}
    >
      {message}
    </div>
  )
}
