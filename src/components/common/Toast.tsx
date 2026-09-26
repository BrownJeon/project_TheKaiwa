'use client'

/**
 * 동작 결과 알림(데모의 `.toast`). 저장·토글처럼 **화면이 조금만 바뀌는 동작**이
 * 실제로 일어났는지 알려 준다.
 *
 * 하단 탭 위로 띄우되 safe-area 를 더해 제스처 바에 가리지 않게 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useToast() {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((msg: string) => {
    setMessage(msg)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), 2600)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { message, show }
}

export default function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed left-4 right-4 z-50 rounded-xl bg-ink px-3.5 py-3 text-[13px] text-surface shadow-lg transition-opacity ${
        message ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}
    >
      {message}
    </div>
  )
}
