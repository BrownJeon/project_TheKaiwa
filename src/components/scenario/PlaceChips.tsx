'use client'

/**
 * 장소 칩(가이드 §3-B·§3-H) — 가로 스크롤 한 줄(스크롤바 숨김), 하나만 고른다(`radiogroup`). 시나리오 탭의 장소 거르기와
 * 초안 편집의 장소 고르기가 같이 쓴다. 칩은 36px, 누르는 자리는 `::before` 로 세로 44px — 가로로 넓히면 옆 칩을 가로챈다(Segmented 와 같은 이유).
 * `overflow-x-auto` 가 세로도 잘라서 위아래 4px 여백(`py-1`)으로 히트 자리를 남긴다.
 */
export interface PlaceChipOption<T extends string> {
  value: T
  label: string
}

export default function PlaceChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  id,
  describedBy,
}: {
  options: readonly PlaceChipOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  /** 검사 실패 때 초점을 받는 자리(초안 편집). */
  id?: string
  describedBy?: string
}) {
  return (
    <div
      id={id}
      tabIndex={id ? -1 : undefined}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className="no-scrollbar -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 py-1 outline-none"
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative h-9 flex-none whitespace-nowrap rounded-full border px-3.5 text-[13.5px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] ${
              on ? 'border-transparent bg-surface font-semibold text-ink shadow-[inset_0_0_0_2px_var(--color-accent)]' : 'border-line bg-surface font-medium text-ink2'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
