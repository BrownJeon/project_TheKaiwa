'use client'

import type { CSSProperties, ReactNode, Ref } from 'react'
import { baseLabel, directionWord, parseSliderValue, trackPositions, valueText, VOICE_STEP, type VoiceAxis } from './voiceSliderLogic'

/** 손잡이 26px 의 반 — 손잡이 중심이 움직이는 폭은 막대 양 끝에서 13px 씩 안쪽이다. */
const at = (p: number) => `calc(13px + (100% - 26px) * ${p})`

/**
 * 음성 수치 슬라이더(task-022 데모 v2 "슬라이더 규격"): 이름 · 값(고정폭 숫자 + 방향 말) → 막대 → 눈금 3개(최저 · 기본 1.0 · 최고) → 안내.
 * 입력 높이 44px · 막대 6px · 손잡이 26px. 채움은 기본에서 손잡이까지만(기본값이면 채움 없음).
 * `base` = 그 축의 기본(목소리 기본값, 대개 1.0) — 눈금 "기본" 자리·방향 말·채움 시작점이 모두 이 값을 쓴다.
 */
export default function VoiceSlider({
  id,
  axis,
  label,
  value,
  range,
  base,
  note,
  inputRef,
  onChange,
}: {
  id: string
  axis: VoiceAxis
  label: string
  value: number
  range: readonly [number, number]
  base: number
  note: string | null
  inputRef?: Ref<HTMLInputElement>
  onChange: (v: number) => void
}) {
  const [min, max] = range
  const pos = trackPositions(value, range, base)
  const noteId = `${id}-note`
  const track = `linear-gradient(to right, var(--line) 0 ${at(pos.from)}, var(--accent) ${at(pos.from)} ${at(pos.to)}, var(--line) ${at(pos.to)} 100%)`
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-medium text-ink2">
          {label}
        </label>
        <span className="flex-none text-[12.5px] text-ink2">
          <b className="text-[15px] font-semibold text-ink tabular-nums">{value.toFixed(2)}×</b> {directionWord(axis, value, base)}
        </span>
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="range"
          min={min}
          max={max}
          step={VOICE_STEP}
          value={value}
          onChange={(e) => onChange(parseSliderValue(e.target.value))}
          aria-valuetext={valueText(axis, value, base)}
          aria-describedby={note ? noteId : undefined}
          style={{ '--track': track } as CSSProperties}
          className="block h-11 w-full cursor-pointer appearance-none rounded-lg bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:shadow-[0_1px_3px_rgba(0,0,0,.28)] [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-[3px] [&::-moz-range-track]:[background:var(--track)] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-[3px] [&::-webkit-slider-runnable-track]:[background:var(--track)] [&::-webkit-slider-thumb]:-mt-2.5 [&::-webkit-slider-thumb]:size-[26px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,.28)]"
        />
        <span aria-hidden="true" className="pointer-events-none absolute top-[29px] -ml-px h-[7px] w-0.5 rounded-[1px] bg-ink2" style={{ left: at(pos.def) }} />
      </div>
      <div aria-hidden="true" className="relative h-[18px] text-[12px] text-ink2 tabular-nums">
        <span className="absolute left-0 top-0 whitespace-nowrap">{min}</span>
        <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap" style={{ left: at(pos.def) }}>
          기본 {baseLabel(base)}
        </span>
        <span className="absolute right-0 top-0 whitespace-nowrap">{max}</span>
      </div>
      {note ? <VoiceNote id={noteId}>{note}</VoiceNote> : null}
    </div>
  )
}

/** 안내 한 줄(데모 `.sl-n.w`). `boxed` 는 슬라이더 묶음 아래 조합 안내(`.sl-n.combo`). */
export function VoiceNote({ id, boxed = false, children }: { id?: string; boxed?: boolean; children: ReactNode }) {
  return (
    <p id={id} className={`text-[12.5px] leading-[1.45] text-ink break-keep ${boxed ? '-mt-1.5 rounded-[10px] bg-surface2 px-2.5 py-2' : 'mt-1'}`}>
      <span aria-hidden="true" className="text-ink2">
        ⓘ{' '}
      </span>
      {children}
    </p>
  )
}
