'use client'

/**
 * 채팅 입력창(screens.md §3-2 C Composer).
 * - 글자 수는 **코드포인트**(서버와 같은 1~1,000). `maxLength` 는 쓰지 않는다 — IME 조합 중 잘림·이모지 2칸 계산 때문.
 * - 보내기 버튼 `onPointerDown preventDefault` — 눌러도 입력창 포커스가 유지돼 **키보드가 내려가지 않는다**.
 * - Enter 전송은 포인터가 정밀한 기기(데스크톱)에서만, 그리고 **IME 조합 중(isComposing·229)이면 무시**한다
 *   (일본어 변환 확정 Enter 로 보내지는 사고). 모바일은 Enter=줄바꿈, 보내기는 버튼만.
 * - 초안은 sessionStorage 에 입력창 내용 그대로 둔다(300ms 디바운스) — 보내면 비워지고, 못 보내면 원문이 돌아온다.
 */
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { cpLength } from './format'
import { KEYS, readStore, writeStore } from './storage'
import { useCountdown } from './useNow'

export interface ComposerHandle {
  /** 입력창이 비어 있을 때만 원문을 되돌린다(그새 다음 말을 쓰기 시작했으면 덮지 않는다). */
  restore: (text: string) => void
  /** 예문 칩 — 입력창을 채우고 포커스(자동 전송 없음). */
  fill: (text: string) => void
}

const MAX_CP = 1000
const WARN_CP = 900
const MAX_HEIGHT_PX = 136

export default function Composer({
  chatId,
  busy,
  blockedUntil,
  placeholder,
  onSend,
  onBlocked,
  handleRef,
}: {
  chatId: string
  busy: boolean
  blockedUntil: number | null
  placeholder: string
  onSend: (text: string) => void
  /** 보낼 수 없는 이유 안내(토스트) */
  onBlocked: (reason: string) => void
  handleRef: RefObject<ComposerHandle | null>
}) {
  const [text, setText] = useState(() => readStore('session', KEYS.draft(chatId)) ?? '')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const remaining = useCountdown(blockedUntil)
  const rateBlocked = blockedUntil !== null && (remaining === null || remaining > 0)

  useImperativeHandle(handleRef, () => ({
    restore: (t: string) => setText((cur) => (cur.trim() === '' ? t : cur)),
    fill: (t: string) => {
      setText(t)
      taRef.current?.focus()
    },
  }))

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [text])

  useEffect(() => {
    const t = setTimeout(() => writeStore('session', KEYS.draft(chatId), text === '' ? null : text), 300)
    return () => clearTimeout(t)
  }, [chatId, text])

  const count = cpLength(text)
  const empty = text.trim() === ''
  const tooLong = count > MAX_CP
  const reason = tooLong
    ? '1,000자까지 보낼 수 있어요'
    : busy
      ? '선생님 답을 기다리는 중이에요'
      : rateBlocked
        ? `${remaining ?? ''}초 뒤에 보낼 수 있어요`.trim()
        : null
  const canSend = !empty && reason === null

  const submit = () => {
    if (empty) return
    if (reason) {
      onBlocked(reason)
      return
    }
    const t = text
    setText('')
    onSend(t)
  }

  return (
    <div
      className="flex-none border-t border-line bg-surface"
      style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', marginBottom: 'var(--kb-inset, 0px)' }}
    >
      {count >= WARN_CP ? (
        <p className={`px-4 pt-1.5 text-right text-[12px] ${tooLong ? 'text-bad' : 'text-ink2'}`} aria-live="polite">
          {tooLong ? '1,000자까지 보낼 수 있어요 · ' : ''}
          {count.toLocaleString('ko-KR')}/1,000
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex min-w-0 items-end gap-2 px-3 pt-2"
      >
        <textarea
          ref={taRef}
          lang="ja"
          rows={1}
          enterKeyHint="send"
          spellCheck={false}
          autoComplete="off"
          aria-label="메시지 입력"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (e.nativeEvent.isComposing || e.keyCode === 229) return
            if (e.shiftKey || !window.matchMedia('(pointer: fine)').matches) return
            e.preventDefault()
            submit()
          }}
          className="block min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-6 text-ink placeholder:text-ink3"
        />
        <button
          type="submit"
          aria-label={reason ?? '보내기'}
          aria-disabled={!canSend || undefined}
          onPointerDown={(e) => e.preventDefault()}
          className={`grid h-11 w-11 flex-none place-items-center rounded-full bg-accent text-on-accent ${canSend ? '' : 'opacity-40'}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </div>
  )
}
