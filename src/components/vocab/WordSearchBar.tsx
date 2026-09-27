'use client'

/**
 * 단어 검색(screens.md §4-2 A). 디바운스 300ms 뒤 `onCommit`, **IME 조합 중에는 보내지 않는다**(조합이 끝나면 다시 예약).
 * Enter(검색 키)는 디바운스 없이 바로 보내고 키보드를 내린다. 40자 검사·조회는 부모가 한다.
 * 한국어 뜻·일본어 표현을 섞어 쓰므로 `lang` 을 두지 않는다.
 */
import { useEffect, useRef } from 'react'

const DEBOUNCE_MS = 300

export default function WordSearchBar({
  value,
  onInput,
  onCommit,
  onClear,
  error,
}: {
  value: string
  onInput: (v: string) => void
  onCommit: (v: string) => void
  onClear: () => void
  error: string | null
}) {
  const composing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const schedule = (v: string) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onCommit(v), DEBOUNCE_MS)
  }

  return (
    <div>
      <form
        role="search"
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          if (timer.current) clearTimeout(timer.current)
          onCommit(value)
          inputRef.current?.blur()
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          aria-label="단어 검색"
          placeholder="표현·읽기·뜻으로 검색"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'wordSearchErr' : undefined}
          onCompositionStart={() => {
            composing.current = true
            if (timer.current) clearTimeout(timer.current)
          }}
          onCompositionEnd={(e) => {
            composing.current = false
            schedule(e.currentTarget.value)
          }}
          onChange={(e) => {
            onInput(e.target.value)
            if (!composing.current) schedule(e.target.value)
          }}
          className={`h-11 w-full min-w-0 rounded-xl border bg-surface pl-10 pr-11 text-[16px] text-ink placeholder:text-ink3 [&::-webkit-search-cancel-button]:hidden ${
            error ? 'border-bad' : 'border-line'
          }`}
        />
        {value ? (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current)
              onClear()
              inputRef.current?.focus()
            }}
            className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-full text-ink2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : null}
      </form>
      {error ? (
        <p id="wordSearchErr" role="alert" className="mt-1 text-[12px] text-bad break-keep">
          {error}
        </p>
      ) : null}
    </div>
  )
}
