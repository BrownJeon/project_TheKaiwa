'use client'

/**
 * 단어 상세의 소리 버튼과 버튼 아래 한 줄(task-023 데모 v1 `detail-*`). 표시만 한다(상태는 useWordSound, 규칙은 wordSound).
 * 버튼은 44px 원형 — 대기 ▶ → 불러오는 중(돌기) → 재생 중 ■(채움 + 바깥 고리). 안내 줄은 누른 버튼 바로 아래에 둔다.
 */
import { SOUND_MSG, SOUND_RETRYING, soundButtonView, soundLine, type SoundTarget, type WordSoundState } from './wordSound'

function PlayIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

const LOOK = {
  idle: 'border-line bg-surface text-ink',
  on: 'border-ink bg-ink text-surface',
  mute: 'border-transparent bg-surface2 text-ink2',
  blocked: 'border-accent bg-surface text-ink ring-2 ring-accent',
} as const

export function WordSoundButton({ state, target, onPress }: { state: WordSoundState; target: SoundTarget; onPress: () => void }) {
  const v = soundButtonView(state, target)
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={v.label}
      aria-busy={v.busy || undefined}
      className={`relative grid h-11 w-11 flex-none place-items-center rounded-full border p-0 ${LOOK[v.look]}`}
    >
      {v.phase === 'loading' ? (
        <span
          aria-hidden="true"
          className="h-[18px] w-[18px] rounded-full border-[2.5px] border-current border-r-transparent motion-safe:animate-spin motion-reduce:border-r-current motion-reduce:opacity-50"
        />
      ) : v.phase === 'playing' ? (
        <StopIcon />
      ) : (
        <PlayIcon />
      )}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-[5px] rounded-full shadow-[0_0_0_3px_var(--accent-soft)] ${v.phase === 'playing' ? 'opacity-100 motion-safe:animate-pulse' : 'opacity-0'}`}
      />
    </button>
  )
}

/** 버튼 아래 한 줄. `inCard` = 예문 카드(bg-surface2) 안 — 중립 안내 바탕을 surface 로 바꿔 카드와 구분한다. */
export function WordSoundLine({ state, target, onRetry, inCard = false }: { state: WordSoundState; target: SoundTarget; onRetry: () => void; inCard?: boolean }) {
  const line = soundLine(state, target)
  const neutralBg = inCard ? 'bg-surface' : 'bg-surface2'
  const box = 'mt-2.5 flex min-h-[44px] flex-wrap items-center gap-x-2.5 rounded-xl px-3 py-1 text-[13px]'
  if (line.kind === 'live') {
    return (
      <p role="status" className="sr-only">
        {line.text}
      </p>
    )
  }
  if (line.kind === 'retrying') {
    return (
      <p role="status" className={`${box} ${neutralBg} text-ink`}>
        <span className="min-w-0 py-2">{SOUND_RETRYING}</span>
      </p>
    )
  }
  const m = SOUND_MSG[line.msg]
  return (
    <p role={m.role} className={`${box} ${m.tone === 'bad' ? 'bg-bad-soft text-bad' : `${neutralBg} text-ink`}`}>
      <span className="min-w-0 py-2 break-keep">{m.text}</span>
      {m.retry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] items-center whitespace-nowrap px-0.5 text-[13px] font-bold underline underline-offset-[3px]"
        >
          {m.retry}
        </button>
      ) : null}
    </p>
  )
}
