'use client'

/** 입력창 위 한 줄 안내(409·429·보내기 전 네트워크 실패). 429 는 남은 초를 줄이다 0 이 되면 스스로 닫힌다. */
import Link from 'next/link'
import { useEffect } from 'react'
import { turnNoticeText } from './labels'
import type { TurnNoticeState } from './useChatTurn'
import { useCountdown } from '@/components/common/useNow'

export default function TurnNotice({
  notice,
  blockedUntil,
  onClose,
  textOf,
  notFoundLink = { href: '/study/ai?tab=chat', label: '채팅 목록으로' },
}: {
  notice: TurnNoticeState
  blockedUntil: number | null
  onClose: () => void
  /** 문구를 화면이 고른다(질문 방 `askNoticeText`, task-064). `remaining` = 429 남은 초(첫 틱 전 null). 없으면 채팅 문구. */
  textOf?: (notice: TurnNoticeState, remaining: number | null) => string
  /** 404 안내 끝 링크(기본 채팅 목록) */
  notFoundLink?: { href: string; label: string }
}) {
  const rate = notice.kind === 'rate'
  const remaining = useCountdown(rate ? blockedUntil : null)

  useEffect(() => {
    if (rate && remaining === 0) onClose()
  }, [rate, remaining, onClose])

  const text = textOf ? textOf(notice, rate ? remaining : null) : rate ? turnNoticeText({ status: 429 }, remaining ?? notice.retryAfterSec ?? null) : notice.text
  return (
    <div role="alert" className="flex min-w-0 flex-none items-center gap-1 border-t border-line bg-bad-soft pl-4 text-[13px] text-bad">
      <p className="min-w-0 flex-1 py-2 break-keep">
        {text}
        {notice.kind === 'notFound' ? (
          <>
            {' '}
            <Link href={notFoundLink.href} className="font-semibold underline underline-offset-4">
              {notFoundLink.label}
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
