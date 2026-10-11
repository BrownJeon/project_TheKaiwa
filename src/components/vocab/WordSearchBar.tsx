'use client'

/**
 * 단어 검색(screens.md §4-2 A). 디바운스 300ms 뒤 `onCommit`, **IME 조합 중에는 보내지 않는다**(조합이 끝나면 다시 예약).
 * Enter(검색 키)는 디바운스 없이 바로 보내고 키보드를 내린다. 40자 검사·조회는 부모가 한다.
 * 한국어 뜻·일본어 표현을 섞어 쓰므로 `lang` 을 두지 않는다.
 *
 * 채택 교정 모음(task-055 §21-5 A)은 `label`·`placeholder` 를 바꾸고 `commitWhileTyping={false}` 로 쓴다 — 입력 중에는 보내지 않고
 * Enter(검색 키)·폼 제출로만 확정한다(디바운스·IME 조합 끝 예약 없음). 단 입력칸이 **빈 칸이 되면 바로 `onCommit('')`**(빈 칸인데 옛 검색
 * 결과가 남지 않게). 기본값은 지금 단어장 그대로이고 그리는 DOM 이 한 글자도 바뀌지 않는다.
 */
import { useEffect, useRef } from 'react'

const DEBOUNCE_MS = 300

/** 입력이 바뀌었을 때(조합 중이 아닐 때) 할 일 — 디바운스 예약 / 바로 확정(빈 칸) / 아무것도 안 함. */
export function typingCommit(v: string, commitWhileTyping: boolean): 'debounce' | 'now' | 'none' {
  if (commitWhileTyping) return 'debounce'
  return v === '' ? 'now' : 'none'
}

export default function WordSearchBar({
  value,
  onInput,
  onCommit,
  onClear,
  error,
  label = '단어 검색',
  placeholder = '표현·읽기·뜻으로 검색',
  commitWhileTyping = true,
}: {
  value: string
  onInput: (v: string) => void
  onCommit: (v: string) => void
  onClear: () => void
  error: string | null
  /** 입력칸 접근성 이름. */
  label?: string
  placeholder?: string
  /** `false` 면 Enter·제출로만 확정(빈 칸이 되면 바로 `onCommit('')`). 기본 `true` = 300ms 디바운스. */
  commitWhileTyping?: boolean
}) {
  const composing = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const schedule = (v: string) => {
    if (timer.current) clearTimeout(timer.current)
    const act = typingCommit(v, commitWhileTyping)
    if (act === 'now') onCommit(v)
    else if (act === 'debounce') timer.current = setTimeout(() => onCommit(v), DEBOUNCE_MS)
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
          aria-label={label}
          placeholder={placeholder}
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
