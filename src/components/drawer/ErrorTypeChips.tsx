'use client'

/**
 * 「유형」 칩 줄(task-055 D3 A, screens.md §21-3 D) — 조각 줄(`ChunkChips`)과 같은 줄 모양·칩 클래스, 칩마다 개수.
 * 개수는 첫 쪽 응답의 `facets`(유형 조건만 뺀 집계)이고, 고른 유형이 0개가 되면 그 칩만 `0` 으로 끝에 남는다(`typeChips`).
 * 칩의 켜짐은 지금 고른 값(`value`)을 따른다 — 조건을 바꾸는 중에도 누른 칩이 바로 켜진다(숫자는 직전 응답 값).
 */
import { useEffect, useId, useRef } from 'react'
import { ERROR_TYPE_LABEL } from '@/components/chat/labels'
import type { DrawerCorrectionFacets, ErrorType } from '@/types/chat'
import { CORRECTIONS_COPY as C } from './correctionsCopy'
import { facetTotal, typeChips } from './logic'

// vocab/ChunkChips 의 CHIP 과 같은 문자열(시험이 묶는다) — 보이는 36, 세로로만 44px 히트영역.
export const TYPE_CHIP =
  "relative h-9 min-w-[44px] flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"

const num = (n: number) => n.toLocaleString('ko-KR')

export default function ErrorTypeChips({
  facets,
  value,
  onChange,
}: {
  facets: DrawerCorrectionFacets | null
  value: ErrorType | null
  onChange: (v: ErrorType | null) => void
}) {
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

  const chip = (key: string, label: string, n: number, sr: string, v: ErrorType | null) => {
    const on = v === value
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={on}
        ref={on ? selectedRef : undefined}
        onClick={() => onChange(v)}
        className={`${TYPE_CHIP} ${on ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-line bg-surface text-ink'}`}
      >
        {label}
        <span className="ml-1 font-normal tabular-nums">{num(n)}</span>
        <span className="sr-only">{sr}</span>
      </button>
    )
  }

  return (
    <div className="-mr-4 flex min-w-0 items-center gap-2">
      <span id={labelId} className="w-[30px] flex-none text-[12px] font-semibold text-ink2">
        {C.typeLabel}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 pr-4">
        {chip('__all', '전체', facetTotal(facets), C.typeAllSr, null)}
        {typeChips(facets, value).map((t) => chip(t.value, ERROR_TYPE_LABEL[t.value] ?? '기타', t.count, C.typeCountSr, t.value))}
      </div>
    </div>
  )
}
