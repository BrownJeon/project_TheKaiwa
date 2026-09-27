'use client'

/**
 * 누르고 있는 동안 말하기(docs/screens.md §8-2 C) — 72px 원형. 판정은 훅(useRealtimeStt)이 하고 여기는 표시·제스처만.
 * 포인터 캡처로 손가락이 버튼 밖으로 미끄러져도 녹음이 이어지고 어디서 떼든 끝난다. 두 번째 손가락·오른쪽 버튼은 무시.
 * 키보드: Space/Enter 를 누르고 있는 동안 녹음, 떼면 끝, 포커스가 빠지면 취소.
 */
import type { SttPhase } from './sttUiState'

function MicIcon() {
  return (
    <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function Spinner() {
  return <span aria-hidden className="inline-block h-6 w-6 rounded-full border-2 border-on-accent border-t-transparent motion-safe:animate-spin" />
}

export default function PushToTalkButton({
  phase,
  disabled,
  label,
  describedBy,
  onPress,
  onRelease,
  onAbort,
}: {
  phase: SttPhase
  disabled?: boolean
  label: string
  describedBy?: string
  onPress: () => void
  onRelease: () => void
  onAbort: () => void
}) {
  const recording = phase === 'recording'
  const busy = phase === 'starting' || phase === 'finishing'
  const off = !!disabled || phase === 'finishing' || phase === 'unavailable'
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={recording}
      aria-busy={busy || undefined}
      aria-describedby={describedBy}
      disabled={off}
      data-rec={recording}
      onPointerDown={(e) => {
        if (e.button !== 0 || !e.isPrimary) return
        e.currentTarget.setPointerCapture(e.pointerId)
        onPress()
      }}
      onPointerUp={(e) => {
        if (e.isPrimary) onRelease()
      }}
      onPointerCancel={onAbort}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          onPress()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onRelease()
        }
      }}
      onBlur={() => {
        if (recording) onAbort()
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="group relative grid h-[72px] w-[72px] flex-none touch-none select-none place-items-center rounded-full bg-accent text-on-accent transition-transform [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-40 data-[rec=true]:scale-105 motion-reduce:transition-none motion-reduce:data-[rec=true]:scale-100"
    >
      <span aria-hidden className="absolute -inset-1.5 rounded-full opacity-0 ring-[6px] ring-accent-soft group-data-[rec=true]:opacity-100 motion-safe:group-data-[rec=true]:animate-pulse" />
      {busy ? <Spinner /> : <MicIcon />}
    </button>
  )
}
