'use client'

/**
 * 가로 칩 줄(대상 연결·필터)과 `aria-pressed` 토글(screens.md §6-2 C). 단어장 `CategoryChips`·`ArchiveToggle` 과 모양은 같지만
 * admin 은 `(app)` 컴포넌트를 import 하지 않으므로 따로 둔다.
 * 콘솔은 칩·토글 **자체를 44px** 로 둔다(QA-013 — `::before` 히트영역은 요소 크기로 측정되지 않는다). 좌우 간격(gap-2)은 그대로라
 * 옆 칩 클릭을 가로채지 않는다. 줄의 `py-1` 은 `overflow-x:auto` 가 세로도 잘라 포커스 링이 잘리는 것을 막는다.
 */
import { useEffect, useRef } from 'react'

const CHIP = 'h-11 min-w-[44px] flex-none rounded-full border px-3.5 text-[13px]'

export interface ChipOption<T extends string> {
  value: T
  label: string
  count?: number
  mono?: boolean
}

export function ChipRadio<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  bleed = '-mx-4 px-4',
}: {
  options: readonly ChipOption<T>[]
  value: T | null
  onChange: (v: T) => void
  ariaLabel: string
  bleed?: string
}) {
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  const mounted = useRef(false)

  // 고른 칩이 화면 밖이면 가로로 데려온다. 첫 그리기에서는 하지 않는다(페이지가 저절로 움직이지 않게).
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    selectedRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [value])

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`no-scrollbar flex gap-2 overflow-x-auto py-1 ${bleed}`}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            ref={on ? selectedRef : undefined}
            onClick={() => onChange(o.value)}
            className={`${CHIP} ${on ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line bg-surface text-ink'}`}
          >
            <span className="flex items-center gap-1">
              <span className={`block max-w-[240px] truncate ${o.mono ? 'font-mono text-[12.5px]' : ''}`}>{o.label}</span>
              {o.count !== undefined ? <span className="tabular-nums">{o.count}</span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ToggleButton({ pressed, onToggle, children }: { pressed: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`h-11 flex-none rounded-xl px-3 text-[13px] font-medium ${
        pressed ? 'bg-accent-soft text-ink ring-1 ring-accent' : 'bg-surface2 text-ink2'
      }`}
    >
      {children}
    </button>
  )
}
