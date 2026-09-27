'use client'

/**
 * 범위 고르기(라디오 카드 5개, screens.md §10-2 D) · 가져오기 방식(2개)도 같은 모양(`RadioCards`).
 * 선택 표시는 테두리·링 — 글자는 늘 `ink`. 화살표 키로 옮기며 고른다(roving tabindex).
 */
import { useRef } from 'react'
import { LEXICON_SCOPES, type LexiconScopeName } from '@/types/lexicon'
import { SCOPE_KO } from './lexiconCopy'

export interface RadioCardOption<T extends string> {
  value: T
  code: string
  text: string
  warn?: string
}

export function RadioCards<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  id,
  invalid,
  describedBy,
}: {
  options: readonly RadioCardOption<T>[]
  value: T | null
  onChange: (v: T) => void
  ariaLabel: string
  id?: string
  invalid?: boolean
  describedBy?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(0, options.findIndex((o) => o.value === value))
  const move = (i: number) => {
    const n = (i + options.length) % options.length
    onChange(options[n].value)
    refs.current[n]?.focus()
  }
  return (
    <div id={id} role="radiogroup" aria-label={ariaLabel} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="grid gap-2">
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault()
                move(i + 1)
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault()
                move(i - 1)
              }
            }}
            className={`flex min-h-[56px] min-w-0 flex-col justify-center rounded-xl border px-3 py-2 text-left ${
              on ? 'border-accent bg-accent-soft ring-1 ring-accent' : 'border-line bg-surface'
            }`}
          >
            <span className="font-mono text-[13px] font-semibold text-ink">{o.code}</span>
            <span className="text-[13px] text-ink break-keep">{o.text}</span>
            {o.warn ? <span className="block text-[13px] font-semibold text-bad break-keep">{o.warn}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

const SCOPE_OPTIONS: RadioCardOption<LexiconScopeName>[] = LEXICON_SCOPES.map((s) => ({ value: s, code: s, text: SCOPE_KO[s] }))

export default function ScopePicker({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: LexiconScopeName | null
  onChange: (v: LexiconScopeName) => void
  invalid?: boolean
  describedBy?: string
}) {
  return <RadioCards id="lexScope" options={SCOPE_OPTIONS} value={value} onChange={onChange} ariaLabel="범위" invalid={invalid} describedBy={describedBy} />
}
