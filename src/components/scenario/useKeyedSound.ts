'use client'

/**
 * 표현 줄 ▶(상황 시트) — `vocab/useWordSound` 를 감싼 얇은 훅. 줄마다 열쇠를 두고 소리는 한 번에 하나:
 * 다른 줄을 누르면 앞 소리를 멈춘 뒤 새로 튼다. `tap` 은 onClick 안에서 동기로 부른다(오디오 깨우기 — useWordSound 규칙).
 * 실패 안내는 `wordSound.SOUND_MSG` 그대로, 누른 줄 아래에만.
 */
import { useCallback, useRef, useState } from 'react'
import { useWordSound } from '@/components/vocab/useWordSound'
import { SOUND_IDLE, soundButtonView, soundLine, type SoundButtonView, type SoundLine } from '@/components/vocab/wordSound'

const IDLE_LINE: SoundLine = { kind: 'live', text: '' }

export function useKeyedSound() {
  const { state, tap: tapEx, retry: retryEx, stop } = useWordSound()
  const [active, setActive] = useState<string | null>(null)
  const activeRef = useRef<string | null>(null)

  const take = useCallback(
    (key: string) => {
      if (activeRef.current === key) return
      stop()
      activeRef.current = key
      setActive(key)
    },
    [stop],
  )

  const tap = useCallback(
    (key: string, text: string) => {
      take(key)
      tapEx('ex', text)
    },
    [take, tapEx],
  )

  const retry = useCallback(
    (key: string, text: string) => {
      take(key)
      retryEx('ex', text)
    },
    [take, retryEx],
  )

  const view = useCallback((key: string): SoundButtonView => soundButtonView(active === key ? state : SOUND_IDLE, 'ex'), [active, state])
  const line = useCallback((key: string): SoundLine => (active === key ? soundLine(state, 'ex') : IDLE_LINE), [active, state])

  return { tap, retry, stop, view, line }
}
