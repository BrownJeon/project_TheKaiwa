'use client'

/**
 * 분류 칩(screens.md §4-2 A). 단어장 목록과 오늘의 단어 카드가 함께 쓴다. #46 순서 그대로, 기준 개수 > 0 인 분류만.
 * "분류 없음" 칩은 두지 않는다(F6) — 분류 없는 단어는 "전체"에 나오므로 "전체" 숫자에는 그 개수까지 더한다.
 *
 * 히트영역은 **세로로만** 44px(`::before`) — 칩이 가로로 붙어 있어 좌우로 넓히면 옆 칩 클릭을 가로챈다(Segmented 와 같은 이유).
 * 스크롤 줄에 `py-1` 을 두는 이유: `overflow-x:auto` 는 세로도 잘라서, 여백이 없으면 44px `::before` 가 36px 로 잘린다.
 */
import { useEffect, useRef } from 'react'
import type { CategoryCount } from '@/types/vocab'
import { visibleCategories } from './validate'

const CHIP =
  "relative h-9 min-w-[44px] flex-none rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"

export default function CategoryChips({
  items,
  value,
  onChange,
  basis,
  bleed = '-mx-4 px-4',
}: {
  items: readonly CategoryCount[] | null
  value: string | null
  onChange: (v: string | null) => void
  basis: 'active' | 'archived'
  /** 부모 좌우 패딩만큼 줄을 넓혀 끝까지 밀리게 한다(페이지 16px · 카드 14px). */
  bleed?: string
}) {
  const chips = visibleCategories(items, basis)
  const total = (items ?? []).reduce((n, c) => n + (basis === 'active' ? c.count : (c.archivedCount ?? 0)), 0)
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

  const chip = (key: string, label: string, n: number, v: string | null) => {
    const on = v === value
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={on}
        ref={on ? selectedRef : undefined}
        onClick={() => onChange(v)}
        className={`${CHIP} ${on ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line bg-surface text-ink'}`}
      >
        <span className="flex items-center gap-1">
          <span className="block max-w-[200px] truncate">{label}</span>
          <span className="tabular-nums">{n}</span>
        </span>
      </button>
    )
  }

  return (
    <div role="radiogroup" aria-label="분류" className={`no-scrollbar flex gap-2 overflow-x-auto py-1 ${bleed}`}>
      {chip('__all', '전체', total, null)}
      {chips.map((c) => chip(c.category, c.category, c.n, c.category))}
    </div>
  )
}
