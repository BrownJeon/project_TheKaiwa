import Link from 'next/link'
import { Badge } from '@/components/common/ui'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import type { ChatSummary } from '@/types/chat'
import { ASK_COPY } from './askCopy'
import { ASK_ROW_CLASS, askRowView } from './homeLogic'

/**
 * 지난 질문 한 줄(screens.md §25-4 D) — 행 전체가 링크(≥64px), 바깥 클래스·높이는 `ChatListItem` 과 같다(`ASK_ROW_CLASS`).
 * 제목·미리보기는 한국어 글이라 `lang="ja"` 를 통째로 달지 않고 일본어 구간만 `JaRuns` 로 나눈다.
 */
export default function AskListItem({ chat, isNew, now }: { chat: ChatSummary; isNew: boolean; now: Date | null }) {
  const v = askRowView(chat, { isNew, now })
  return (
    <li>
      <Link href={`/ask/${encodeURIComponent(chat.id)}`} aria-label={v.label} className={ASK_ROW_CLASS}>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            <JaRuns text={v.title} />
          </span>
          {v.time ? <span className="flex-none text-[12px] text-ink2">{v.time}</span> : null}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] text-ink2">
            <JaRuns text={v.second} />
          </span>
          {v.status === 'running' ? (
            <Badge>
              <span aria-hidden="true" className="mr-1.5 inline-flex gap-[3px]">
                <span className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse" />
                <span className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse [animation-delay:200ms]" />
                <span className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse [animation-delay:400ms]" />
              </span>
              {ASK_COPY.running}
            </Badge>
          ) : v.status === 'new' ? (
            <>
              <span aria-hidden="true" className="h-2 w-2 flex-none rounded-full bg-accent" />
              <span className="inline-flex h-[22px] flex-none items-center rounded-md bg-accent-soft px-2 text-[11.5px] font-semibold text-ink">{ASK_COPY.newAnswer}</span>
            </>
          ) : null}
        </span>
      </Link>
    </li>
  )
}
