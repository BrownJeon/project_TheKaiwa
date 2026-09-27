import Link from 'next/link'
import { Badge } from '@/components/common/ui'
import type { ChatSummary } from '@/types/chat'
import { formatListTime } from '@/components/common/format'

/** 채팅 목록 한 줄(행 전체가 링크, ≥64px). 뱃지는 둘 다면 "답하는 중"만. */
export default function ChatListItem({ chat, href, now }: { chat: ChatSummary; href: string; now: Date | null }) {
  const time = now ? formatListTime(chat.lastMessageAt, now) : ''
  const status = chat.running ? '답하는 중' : chat.reviewedAt ? '점검 완료' : ''
  const label = [chat.title, time, status].filter(Boolean).join(', ')
  return (
    <li>
      <Link href={href} aria-label={label} className="flex min-h-16 min-w-0 flex-col justify-center gap-0.5 rounded-[14px] border border-line bg-surface px-3.5 py-2.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{chat.title}</span>
          {time ? <span className="flex-none text-[12px] text-ink2">{time}</span> : null}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {chat.preview ? (
            <span lang="ja" className="min-w-0 flex-1 truncate text-[14px] text-ink2">
              {chat.preview}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-[14px] text-ink2">아직 메시지가 없어요</span>
          )}
          {chat.running ? (
            <span className="flex flex-none items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
              <Badge>답하는 중</Badge>
            </span>
          ) : chat.reviewedAt ? (
            <Badge tone="good">점검 완료</Badge>
          ) : null}
        </span>
      </Link>
    </li>
  )
}
