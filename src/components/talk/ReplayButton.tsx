'use client'

/** 말풍선 아래 다시 듣기 버튼(screens §9-3 E) — idle "▶ …" → loading "불러오는 중…" → playing "■ 멈춤". 히트 44px, 글자 13px ink2. */
import { TALK_ROOM } from './talkCopy'

export type ReplayState = 'idle' | 'loading' | 'playing'

export default function ReplayButton({
  state,
  idleLabel,
  ariaLabel,
  disabled,
  onClick,
}: {
  state: ReplayState
  idleLabel: string
  ariaLabel: string
  disabled?: boolean
  onClick: () => void
}) {
  const text = state === 'playing' ? TALK_ROOM.stop : state === 'loading' ? TALK_ROOM.loading : idleLabel
  return (
    <button
      type="button"
      aria-label={state === 'playing' ? TALK_ROOM.stopAria : ariaLabel}
      aria-busy={state === 'loading' || undefined}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      className={`inline-flex h-11 flex-none items-center px-1.5 text-[13px] font-medium text-ink2 ${disabled ? 'opacity-50' : ''}`}
    >
      {text}
    </button>
  )
}
