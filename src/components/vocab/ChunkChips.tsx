'use client'

/**
 * 조각 줄(task-023, 데모 v1 `list-chunk`) — 분류 칩 바로 아래 한 줄. 왼쪽 고정 라벨 "조각" + 가로로 밀리는 칩
 * (전체·이름·액션·느낌·꾸밈·없음). 하나만 고른다(결정 b). 분류 칩과 같은 모양·선택색이고 개수는 달지 않는다
 * (분류와 겹친 개수는 새 집계가 필요 — 결과 수는 목록 머리 한 줄이 #40 `total` 로 보인다).
 *
 * 줄은 오른쪽 끝까지만 넓힌다(`-mr-4` + 스크롤 `pr-4`) — 왼쪽은 라벨이 고정이라 페이지 여백을 그대로 둔다.
 * 히트영역·`py-1` 이유는 CategoryChips 와 같다(세로로만 44px, `overflow-x:auto` 가 세로도 자른다).
 */
import { useEffect, useId, useRef } from 'react'
import type { WordChunkFilter } from '@/types/vocab'
import { CHUNK_FILTER_ALL, CHUNK_FILTER_CHIPS } from './labels'

const CHIP =
  "relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"

export default function ChunkChips({ value, onChange }: { value: WordChunkFilter | null; onChange: (v: WordChunkFilter | null) => void }) {
  const labelId = useId()
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    selectedRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [value])

  const chip = (key: string, label: string, sr: string, v: WordChunkFilter | null) => {
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
        {label}
        <span className="sr-only">{sr}</span>
      </button>
    )
  }

  return (
    <div className="-mr-4 flex min-w-0 items-center gap-2">
      <span id={labelId} className="w-[30px] flex-none text-[12px] font-semibold text-ink2">
        조각
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4">
        {chip('__all', CHUNK_FILTER_ALL.label, CHUNK_FILTER_ALL.sr, null)}
        {CHUNK_FILTER_CHIPS.map((c) => chip(c.value, c.label, c.sr, c.value))}
      </div>
    </div>
  )
}
