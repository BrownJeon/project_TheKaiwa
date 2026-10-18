'use client'

/**
 * 채팅 입력창(screens.md §3-2 C Composer).
 * - 글자 수는 **코드포인트**(서버와 같은 1~1,000). `maxLength` 는 쓰지 않는다 — IME 조합 중 잘림·이모지 2칸 계산 때문.
 * - 보내기 버튼 `onPointerDown preventDefault` — 눌러도 입력창 포커스가 유지돼 **키보드가 내려가지 않는다**.
 * - Enter 전송은 포인터가 정밀한 기기(데스크톱)에서만, 그리고 **IME 조합 중(isComposing·229)이면 무시**한다
 *   (일본어 변환 확정 Enter 로 보내지는 사고). 모바일은 Enter=줄바꿈, 보내기는 버튼만.
 * - 초안은 sessionStorage 에 입력창 내용 그대로 둔다(300ms 디바운스) — 보내면 비워지고, 못 보내면 원문이 돌아온다.
 * - 오늘의 회화 ⑤(task-077 §34-3)는 `chatId` 대신 초안 키 전체(`draftKey`)·Enter 방식(`enterSends='always'`)·보내기 이름(`sendLabel`)을 넘긴다.
 *   과제가 바뀌면 `key` 로 새로 그린다(초안은 마운트 때 한 번 읽는다). 넘기지 않으면 지금 동작 그대로.
 */
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { cpLength } from '@/components/common/format'
import { readStore, writeStore } from '@/components/common/storage'
import { KEYS } from './storageKeys'
import { useCountdown } from '@/components/common/useNow'

export interface ComposerHandle {
  /** 입력창이 비어 있을 때만 원문을 되돌린다(그새 다음 말을 쓰기 시작했으면 덮지 않는다). */
  restore: (text: string) => void
  /** 예문 칩 — 입력창을 채우고 포커스(자동 전송 없음). */
  fill: (text: string) => void
  /** 회화방 음성→글자 전환 — 키보드가 뜨는 것은 사용자가 고른 동작이다. */
  focus: () => void
}

/** Enter 로 보내는 기기 — `finePointer` = 포인터가 정밀한 기기만(모바일 Enter = 줄바꿈, 지금 회화·채팅·질문) · `always` = 모든 기기(오늘의 회화 ⑤, B6-Q A). */
export type ComposerEnter = 'finePointer' | 'always'

/**
 * 이 키 입력으로 보낼지. IME 조합 중(isComposing·229)·Shift+Enter 는 어느 방식에서도 보내지 않는다.
 * `finePointer` 는 Enter·조합 아님·Shift 아님일 때만 부른다(매체 질의는 그때만).
 */
export function enterSubmits(e: { key: string; shiftKey: boolean; isComposing: boolean; keyCode: number }, mode: ComposerEnter, finePointer: () => boolean): boolean {
  if (e.key !== 'Enter') return false
  if (e.isComposing || e.keyCode === 229) return false
  if (e.shiftKey) return false
  return mode === 'always' || finePointer()
}

/** 초안 저장 키 — 넘긴 키 전체가 먼저, 없으면 대화 키(`KEYS.draft(chatId)`, 지금). */
export function composerDraftKey(src: { chatId?: string; draftKey?: string }): string {
  return src.draftKey ?? KEYS.draft(src.chatId ?? '')
}

const MAX_CP = 1000
const WARN_CP = 900
const MAX_HEIGHT_PX = 136

/** 입력 바 아래 여백 — 기본은 제스처 바 여백 포함(회화·채팅·질문 방 불변). */
export function composerPaddingBottom(safeBottom: boolean): string {
  return safeBottom ? 'max(8px, var(--safe-bottom))' : '8px'
}

interface ComposerBase {
  busy: boolean
  blockedUntil: number | null
  placeholder: string
  onSend: (text: string) => void
  /** 보낼 수 없는 이유 안내(토스트) */
  onBlocked: (reason: string) => void
  handleRef: RefObject<ComposerHandle | null>
  /** 입력창 왼쪽(회화: 🎤 말로 입력하기 44px) */
  leading?: React.ReactNode
  /** 입력 내용이 바뀔 때(회화: 비우면 고쳐 보내려던 발화 연결을 버린다) */
  onTextChange?: (text: string) => void
  /** 입력 언어 — 'ko' 면 `lang` 속성을 달지 않는다(질문 방: 한글을 일본어 글꼴로 그리지 않게, task-064). 기본 'ja'. */
  lang?: 'ja' | 'ko'
  /** 입력창 이름(기본 「메시지 입력」) */
  inputLabel?: string
  /** 답을 기다리는 동안 보내기를 누를 때 안내(기본 「선생님 답을 기다리는 중이에요」) */
  busyReason?: string
  /** 아래 여백에 제스처 바 여백을 더할지(기본 true = 지금 동작). 질문 탭처럼 아래에 하단 탭·범위 줄이 따로 있으면 false = 8px 고정(task-066 §26-8 A). */
  safeBottom?: boolean
  /** Enter 로 보내는 기기(기본 `finePointer` = 지금). */
  enterSends?: ComposerEnter
  /** 보내기 버튼 이름 — 막힌 이유가 없을 때(기본 「보내기」, 오늘의 회화 「확인하기」). */
  sendLabel?: string
}

/** 초안 키 — 대화 id(`chatId` → `KEYS.draft`, 지금) 또는 저장 키 전체(`draftKey`). 둘 중 하나만 넘긴다. */
export type ComposerProps = ComposerBase & ({ chatId: string; draftKey?: undefined } | { draftKey: string; chatId?: undefined })

export default function Composer({
  chatId,
  draftKey,
  busy,
  blockedUntil,
  placeholder,
  onSend,
  onBlocked,
  handleRef,
  leading,
  onTextChange,
  lang = 'ja',
  inputLabel = '메시지 입력',
  busyReason = '선생님 답을 기다리는 중이에요',
  safeBottom = true,
  enterSends = 'finePointer',
  sendLabel = '보내기',
}: ComposerProps) {
  const storeKey = composerDraftKey({ chatId, draftKey })
  const [text, setText] = useState(() => readStore('session', storeKey) ?? '')
  const taRef = useRef<HTMLTextAreaElement>(null)
  const remaining = useCountdown(blockedUntil)
  const rateBlocked = blockedUntil !== null && (remaining === null || remaining > 0)

  useImperativeHandle(handleRef, () => ({
    restore: (t: string) => setText((cur) => (cur.trim() === '' ? t : cur)),
    fill: (t: string) => {
      setText(t)
      taRef.current?.focus()
    },
    focus: () => taRef.current?.focus(),
  }))

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [text])

  useEffect(() => {
    const t = setTimeout(() => writeStore('session', storeKey, text === '' ? null : text), 300)
    return () => clearTimeout(t)
  }, [storeKey, text])

  const count = cpLength(text)
  const empty = text.trim() === ''
  const tooLong = count > MAX_CP
  const reason = tooLong
    ? '1,000자까지 보낼 수 있어요'
    : busy
      ? busyReason
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
      // 키보드 위에 붙는 것은 앱 셸이 맡는다(task-021 `KeyboardInset` R2) — `data-kb-docked` 라 입력 칸 여유 스크롤 대상이 아니다.
      // 키보드가 열리면 `--safe-bottom` 이 0 이 돼 제스처 바 여백이 빠진다.
      data-kb-docked
      className="flex-none border-t border-line bg-surface"
      style={{ paddingBottom: composerPaddingBottom(safeBottom) }}
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
        {leading}
        <textarea
          ref={taRef}
          lang={lang === 'ja' ? 'ja' : undefined}
          rows={1}
          enterKeyHint="send"
          spellCheck={false}
          autoComplete="off"
          aria-label={inputLabel}
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onTextChange?.(e.target.value)
          }}
          onKeyDown={(e) => {
            if (!enterSubmits({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing, keyCode: e.keyCode }, enterSends, () => window.matchMedia('(pointer: fine)').matches)) return
            e.preventDefault()
            submit()
          }}
          className="block min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-6 text-ink placeholder:text-ink3"
        />
        <button
          type="submit"
          aria-label={reason ?? sendLabel}
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
