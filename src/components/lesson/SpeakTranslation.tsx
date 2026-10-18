'use client'

/**
 * 「내가 한 말」·「내가 쓴 답」 말풍선 안 맨 아래 한국어 뜻 칸(task-077 §34-4, A4 ★) — 회화방 내 말 번역 칸(`chat/MessageBubble` `UserTranslation`)과
 * 같은 값(구분선 · 15px 뜻 · 라벨 없음 · 준비/실패 줄)이고 문구는 `DISPLAY_COPY.userTr` 를 다시 쓴다. 번역 표시 스위치와 무관하게 늘 보인다(A3).
 * 칸 상자는 늘 마운트된 `aria-live` 라 뜻이 오면 읽힌다. [다시 가져오기]를 누르면 단추가 사라지므로 초점을 칸으로 옮긴다.
 */
import { useRef } from 'react'
import { DISPLAY_COPY } from '@/components/common/japanese/displayPrefs'
import { HangulPlaceholder } from '@/components/common/japanese/JapaneseText'
import { U5 } from './lessonCopy'
import { speakTrHint, speakTrRetryable, type SpeakTrState } from './speakTranslation'

const TR_LINE = 'mt-2 border-t border-ink/18'

export function speakTrLineText(state: SpeakTrState): string | null {
  switch (state.s) {
    case 'fail':
      return DISPLAY_COPY.userTr.failed
    case 'rate':
      return DISPLAY_COPY.userTr.rate
    case 'busy':
      return DISPLAY_COPY.userTr.busy
    case 'blocked':
      return DISPLAY_COPY.userTr.blocked
    default:
      return null
  }
}

export default function SpeakTranslation({ state, via, onRetry }: { state: SpeakTrState; via: 'voice' | 'text'; onRetry: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const row = (children: React.ReactNode) => <div className={`${TR_LINE} flex min-h-[30px] flex-wrap items-center gap-x-2 pt-1.5 text-[13px] text-ink2`}>{children}</div>
  let body: React.ReactNode = null
  if (state.s === 'ok') {
    body = (
      <>
        <p className={`${TR_LINE} pt-2 text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere]`}>
          <span className="sr-only">{U5.trSr}</span>
          {state.ko}
        </p>
        {speakTrHint(via, state) ? <p className="mt-0.5 text-[12px] text-ink2 break-keep">{U5.trHeard}</p> : null}
      </>
    )
  } else if (state.s === 'idle' || state.s === 'loading') {
    body = row(
      <>
        <HangulPlaceholder onTint className="!m-0 !w-[72px] flex-none" />
        <span>{DISPLAY_COPY.userTr.pending}</span>
      </>,
    )
  } else {
    const text = speakTrLineText(state)
    if (text)
      body = row(
        <>
          <span className="break-keep">{text}</span>
          {speakTrRetryable(state) ? (
            <button
              type="button"
              onClick={() => {
                boxRef.current?.focus()
                onRetry()
              }}
              className="-my-[7px] -ml-1.5 inline-flex h-11 flex-none items-center px-1.5 text-[13px] text-ink underline underline-offset-[3px]"
            >
              {DISPLAY_COPY.userTr.retry}
            </button>
          ) : null}
        </>,
      )
  }
  return (
    <div ref={boxRef} tabIndex={-1} aria-live="polite" aria-atomic="true" className="outline-none">
      {body}
    </div>
  )
}
