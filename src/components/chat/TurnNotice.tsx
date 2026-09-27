'use client'

/** 입력창 위 한 줄 안내(409·429·보내기 전 네트워크 실패). 429 는 남은 초를 줄이다 0 이 되면 스스로 닫힌다. */
import Link from 'next/link'
import { useEffect } from 'react'
import { turnNoticeText } from './labels'
import type { TurnNoticeState } from './useChatTurn'
import { useCountdown } from './useNow'

export default function TurnNotice({
  notice,
  blockedUntil,
  onClose,
}: {
  notice: TurnNoticeState
  blockedUntil: number | null
  onClose: () => void
}) {
  const rate = notice.kind === 'rate'
  const remaining = useCountdown(rate ? blockedUntil : null)

  useEffect(() => {
    if (rate && remaining === 0) onClose()
  }, [rate, remaining, onClose])

  const text = rate ? turnNoticeText({ status: 429 }, remaining ?? notice.retryAfterSec ?? null) : notice.text
  return (
    <div role="alert" className="flex min-w-0 flex-none items-center gap-1 border-t border-line bg-bad-soft pl-4 text-[13px] text-bad">
      <p className="min-w-0 flex-1 py-2 break-keep">
        {text}
        {notice.kind === 'notFound' ? (
          <>
            {' '}
            <Link href="/study/ai?tab=chat" className="font-semibold underline underline-offset-4">
              채팅 목록으로
            </Link>
          </>
        ) : null}
      </p>
      <button type="button" aria-label="닫기" onClick={onClose} className="grid h-11 w-11 flex-none place-items-center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
