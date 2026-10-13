'use client'

/**
 * 누르고 있는 동안 말하기(docs/screens.md §8-2 C) — 72px 원형. 판정은 훅(useRealtimeStt)이 하고 여기는 표시·제스처만.
 * 포인터 캡처로 손가락이 버튼 밖으로 미끄러져도 녹음이 이어지고 어디서 떼든 끝난다. 두 번째 손가락·오른쪽 버튼은 무시.
 * 키보드: Space/Enter 를 누르고 있는 동안 녹음, 떼면 끝, 포커스가 빠지면 취소.
 *
 * 선택 `cancelOutside`(질문 탭만, task-066 §26-7 D): 손가락을 버튼 밖으로 빼서 떼면 보내지 않고 취소, 녹음 중 Esc 도 취소.
 * 넘기지 않으면 핸들러 순서·DOM 이 지금 그대로다(회화·수업·마이크 테스트 불변 — §26-13 ②).
 */
import { useState } from 'react'
import type { SttPhase } from './sttUiState'

/** 밖 판정 거리 — 버튼 가장자리에서 60px 밖으로 나가면 밖, 밖에서 48px 안으로 돌아오면 안(12px 이력: 경계에서 깜빡이지 않게). */
export const PTT_OUT_PX = 60
export const PTT_BACK_IN_PX = 48

/** 중심에서의 거리로 밖 여부(포인터 캡처 중엔 pointerleave 가 오지 않는다). 이력 구간에서는 이전 값을 유지한다. */
export function pttOutside(prevOut: boolean, dist: number, r: number): boolean {
  return prevOut ? dist >= r + PTT_BACK_IN_PX : dist > r + PTT_OUT_PX
}

export function pttReleaseAction(out: boolean): 'cancel' | 'release' {
  return out ? 'cancel' : 'release'
}

export interface PttCancelOutside {
  onCancel: () => void
  onOutChange?: (out: boolean) => void
}

interface PttPointer {
  button: number
  isPrimary: boolean
  pointerId: number
  clientX: number
  clientY: number
  currentTarget: { setPointerCapture: (id: number) => void; getBoundingClientRect: () => { left: number; top: number; width: number; height: number } }
}
interface PttKey {
  key: string
  repeat: boolean
  preventDefault: () => void
}

/** 버튼 한 번 누름 동안의 기록(컴포넌트마다 한 번 만든 그릇). */
export interface PttGesture {
  geom: { cx: number; cy: number; r: number } | null
  out: boolean
}

/**
 * 제스처 핸들러(순수 — 시험이 가짜 이벤트로 순서를 고정한다). `co` 가 없으면 지금 버튼 그대로: 누름 → 캡처 → onPress, 뗌 → onRelease,
 * pointercancel·녹음 중 포커스 빠짐 → onAbort, Esc 무시, pointermove 핸들러 없음.
 */
export function pttHandlers(
  p: { phase: SttPhase; onPress: () => void; onRelease: () => void; onAbort: () => void; co?: PttCancelOutside },
  g: PttGesture,
  setOut: (out: boolean) => void,
) {
  const { phase, onPress, onRelease, onAbort, co } = p
  const recording = phase === 'recording'
  // 취소가 의미 있는 때 — 아직 보내기 전(시작·녹음·알아듣는 중). 이미 보낸 뒤(대기)에 밖에서 떼면 취소할 것이 없다(거짓 「보내지 않았어요」 방지).
  const cancellable = recording || phase === 'starting' || phase === 'finishing'
  const resetOut = () => {
    g.geom = null
    if (!g.out) return
    g.out = false
    setOut(false)
    co?.onOutChange?.(false)
  }
  return {
    onPointerDown: (e: PttPointer) => {
      if (e.button !== 0 || !e.isPrimary) return
      e.currentTarget.setPointerCapture(e.pointerId)
      if (co) {
        // 밖에서 누른 채 버튼이 비활성이 되어(30초 자동 멈춤 등) 뗌이 오지 않았다면 지난 누름의 「밖」이 남아 있다 — 새 누름은 안에서 시작한다.
        if (g.out) {
          g.out = false
          setOut(false)
          co.onOutChange?.(false)
        }
        const b = e.currentTarget.getBoundingClientRect()
        g.geom = { cx: b.left + b.width / 2, cy: b.top + b.height / 2, r: b.width / 2 }
      }
      onPress()
    },
    onPointerMove: co
      ? (e: PttPointer) => {
          if (!e.isPrimary || !g.geom) return
          const next = pttOutside(g.out, Math.hypot(e.clientX - g.geom.cx, e.clientY - g.geom.cy), g.geom.r)
          if (next === g.out) return
          g.out = next
          setOut(next)
          co.onOutChange?.(next)
        }
      : undefined,
    onPointerUp: (e: PttPointer) => {
      if (!e.isPrimary) return
      if (co && pttReleaseAction(g.out) === 'cancel' && cancellable) {
        resetOut()
        co.onCancel()
        return
      }
      if (co) resetOut()
      onRelease()
    },
    onPointerCancel: () => {
      if (co) resetOut()
      onAbort()
    },
    onKeyDown: (e: PttKey) => {
      if (co && e.key === 'Escape' && (recording || phase === 'starting')) {
        e.preventDefault()
        resetOut()
        co.onCancel()
        return
      }
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault()
        onPress()
      }
    },
    onKeyUp: (e: PttKey) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        onRelease()
      }
    },
    onBlur: () => {
      if (recording) onAbort()
    },
  }
}

function MicIcon() {
  return (
    <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function CancelIcon() {
  return (
    <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function Spinner() {
  return <span aria-hidden className="inline-block h-6 w-6 rounded-full border-2 border-on-accent border-t-transparent motion-safe:animate-spin" />
}

const BUTTON_CLASS =
  'group relative grid h-[72px] w-[72px] flex-none touch-none select-none place-items-center rounded-full bg-accent text-on-accent transition-transform [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-40 data-[rec=true]:scale-105 motion-reduce:transition-none motion-reduce:data-[rec=true]:scale-100'
const RING_CLASS = 'absolute -inset-1.5 rounded-full opacity-0 ring-[6px] ring-accent-soft group-data-[rec=true]:opacity-100 motion-safe:group-data-[rec=true]:animate-pulse'
/** 밖 모양(데모 D·out) — 바탕 surface2·글자 ink·확대 없음·고리 bad-soft. `cancelOutside` 가 있을 때만 붙는다. */
const OUT_BUTTON_CLASS = ' data-[out=true]:bg-surface2 data-[out=true]:text-ink data-[out=true]:scale-100'
const OUT_RING_CLASS = ' group-data-[out=true]:ring-bad-soft'

export default function PushToTalkButton({
  phase,
  disabled,
  label,
  describedBy,
  onPress,
  onRelease,
  onAbort,
  cancelOutside,
}: {
  phase: SttPhase
  disabled?: boolean
  label: string
  describedBy?: string
  onPress: () => void
  onRelease: () => void
  onAbort: () => void
  /** 질문 탭만(§26-7 D) — 밖에서 떼기·Esc = 취소. 없으면 지금 동작·DOM 그대로. */
  cancelOutside?: PttCancelOutside
}) {
  // 누름 한 번의 기록 — 렌더에 쓰지 않는 값이라 상태가 아니라 한 번 만든 그릇(핸들러 안에서만 읽고 쓴다).
  const [gesture] = useState<PttGesture>(() => ({ geom: null, out: false }))
  const [out, setOut] = useState(false)
  const recording = phase === 'recording'
  const busy = phase === 'starting' || phase === 'finishing'
  const off = !!disabled || phase === 'finishing' || phase === 'unavailable'
  const showOut = !!cancelOutside && out && recording
  const hd = pttHandlers({ phase, onPress, onRelease, onAbort, co: cancelOutside }, gesture, setOut)
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={recording}
      aria-busy={busy || undefined}
      aria-describedby={describedBy}
      disabled={off}
      data-rec={recording}
      data-out={showOut ? 'true' : undefined}
      onPointerDown={hd.onPointerDown}
      onPointerMove={hd.onPointerMove}
      onPointerUp={hd.onPointerUp}
      onPointerCancel={hd.onPointerCancel}
      onKeyDown={hd.onKeyDown}
      onKeyUp={hd.onKeyUp}
      onBlur={hd.onBlur}
      onContextMenu={(e) => e.preventDefault()}
      className={cancelOutside ? BUTTON_CLASS + OUT_BUTTON_CLASS : BUTTON_CLASS}
    >
      <span aria-hidden className={cancelOutside ? RING_CLASS + OUT_RING_CLASS : RING_CLASS} />
      {showOut ? <CancelIcon /> : busy ? <Spinner /> : <MicIcon />}
    </button>
  )
}
