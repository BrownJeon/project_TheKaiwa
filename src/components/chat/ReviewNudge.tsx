'use client'

import Link from 'next/link'

/** 입력창 바로 위 점검 권유(screens.md §3-2 C). 조건 판단은 방이 하고, 여기선 보이기·닫기만. */
export default function ReviewNudge({ chatId, onDismiss }: { chatId: string; onDismiss: () => void }) {
  return (
    <div className="flex min-w-0 flex-none items-center gap-1 border-t border-line bg-surface2 pl-4 text-[13px]">
      <p className="min-w-0 flex-1 py-2 text-ink break-keep">대화를 꽤 나눴어요. 표현 점검을 받아 볼까요?</p>
      <Link
        href={`/study/ai/chat/${encodeURIComponent(chatId)}/review`}
        className="inline-flex h-11 flex-none items-center px-2 font-semibold text-accent"
      >
        점검 받기
      </Link>
      <button type="button" aria-label="닫기" onClick={onDismiss} className="grid h-11 w-11 flex-none place-items-center text-ink2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
