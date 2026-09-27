'use client'

/**
 * 악센트 = 모라 칩(screens.md §10-2 D). 칩 i = "i 번째 모라 다음에서 내려감", 0 = 평판. 아래에 높낮이 표기(↑↓).
 * 읽기를 바꿔 값이 모라 수를 넘으면 **값을 몰래 바꾸지 않고** 오류를 보인다. ←/→ 로 옮기며 고른다(roving tabindex).
 */
import { useEffect, useRef } from 'react'
import { accentNotation, isReading, spokenAccent, splitMoras, toKatakana } from './kana'
import { FIELD_ERROR } from './lexiconStyles'

export const ACCENT_ID = 'lexAccent'

const ON = 'border-accent bg-accent text-on-accent font-semibold'
const OFF = 'border-line bg-surface text-ink'

export default function AccentPicker({
  reading,
  value,
  error,
  onChange,
}: {
  reading: string
  value: number
  error?: string
  onChange: (n: number) => void
}) {
  const kata = toKatakana(reading)
  const moras = isReading(kata) ? splitMoras(kata) : []
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const mounted = useRef(false)
  const count = moras.length + 1
  const current = value >= 0 && value < count ? value : 0

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    refs.current[current]?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [current])

  const move = (i: number) => {
    const n = Math.max(0, Math.min(count - 1, i))
    onChange(n)
    refs.current[n]?.focus()
  }
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      move(i + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      move(i - 1)
    }
  }
  const notation = accentNotation(moras, value)
  const errId = `${ACCENT_ID}-err`

  return (
    <div className="min-w-0">
      <p id="lexAccentLabel" className="text-[12.5px] font-medium text-ink2">
        악센트 <span className="font-normal">(내려가는 자리)</span>
      </p>
      {moras.length === 0 ? (
        <p className="mt-1 text-[12px] text-ink2">읽기를 먼저 입력해 주세요.</p>
      ) : (
        <div
          id={ACCENT_ID}
          role="radiogroup"
          aria-labelledby="lexAccentLabel"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className="no-scrollbar -mx-4 mt-1 flex gap-1.5 overflow-x-auto px-4 py-1"
        >
          <button
            ref={(el) => {
              refs.current[0] = el
            }}
            type="button"
            role="radio"
            aria-checked={value === 0}
            aria-label="0, 평판 — 내려가지 않음"
            tabIndex={current === 0 ? 0 : -1}
            onClick={() => onChange(0)}
            onKeyDown={(e) => onKey(e, 0)}
            className={`h-11 min-w-[64px] flex-none rounded-full border px-3 text-[13px] ${value === 0 ? ON : OFF}`}
          >
            0 평판
          </button>
          {moras.map((m, i) => {
            const n = i + 1
            return (
              <button
                key={`${n}-${m}`}
                ref={(el) => {
                  refs.current[n] = el
                }}
                type="button"
                role="radio"
                aria-checked={value === n}
                aria-label={`${n}, ${m} 다음에서 내려감`}
                tabIndex={current === n ? 0 : -1}
                onClick={() => onChange(n)}
                onKeyDown={(e) => onKey(e, n)}
                className={`h-11 min-w-[52px] flex-none rounded-full border px-2.5 ${value === n ? ON : OFF}`}
              >
                <span className="mr-1 text-[11px] tabular-nums">{n}</span>
                <span lang="ja" className="text-[16px]">
                  {m}
                </span>
              </button>
            )
          })}
        </div>
      )}
      {notation ? (
        <p lang="ja" aria-label={spokenAccent(notation)} className="mt-1 text-[16px] tracking-wide [overflow-wrap:anywhere]">
          {notation}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className={FIELD_ERROR}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
