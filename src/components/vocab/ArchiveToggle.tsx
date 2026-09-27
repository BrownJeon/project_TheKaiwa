'use client'

/** [보관함] 토글(screens.md §4-2 A) — 라벨은 늘 "보관함", 상태는 `aria-pressed` 와 모양으로 알린다. 히트는 세로 44px. */
export default function ArchiveToggle({ pressed, onToggle }: { pressed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`relative h-8 flex-none rounded-[9px] px-3 text-[13px] font-medium before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] ${
        pressed ? 'bg-accent-soft text-ink ring-1 ring-accent' : 'bg-surface2 text-ink2'
      }`}
    >
      보관함
    </button>
  )
}
