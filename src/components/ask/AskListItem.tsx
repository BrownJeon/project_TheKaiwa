import { Badge } from '@/components/common/ui'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import type { ChatSummary } from '@/types/chat'
import { ASK_COPY } from './askCopy'
import { ASK_ROW_CLASS, askRowView } from './homeLogic'

/**
 * 지난 질문 한 줄(§25-4 D → task-066 §26-4 C → task-067 §27-5 A). 행 = 큰 단추(그 대화 열기 `onOpen`) + 오른쪽 ⋯ 단추를 **나란히**(J3 — 단추 안에 단추 없음).
 * 링크를 쓰지 않는다(`/ask/<id>` 0 — 열기는 탭 화면이 같은 자리에서). 「지금 대화」 행도 같은 단추이고 부모가 같은 id 면 시트만 닫는다.
 * 바깥 클래스·높이는 `ChatListItem` 과 같다(`ASK_ROW_CLASS`). 오른쪽 52px 를 비워 제목·시각·뱃지가 ⋯ 와 겹치지 않는다.
 * `running` = 알약용 최근 목록으로 덮어쓴 값(`rowRunning`, 27-4 E) — 없으면 쪽을 읽은 순간 값.
 * 제목·미리보기는 한국어 글이라 `lang="ja"` 를 통째로 달지 않고 일본어 구간만 `JaRuns` 로 나눈다.
 */
export default function AskListItem({
  chat,
  isNew,
  now,
  current = false,
  running,
  onOpen,
  onMore,
}: {
  chat: ChatSummary
  isNew: boolean
  now: Date | null
  current?: boolean
  running?: boolean
  onOpen: () => void
  onMore: () => void
}) {
  const row = running === undefined || running === chat.running ? chat : { ...chat, running }
  const v = askRowView(row, { isNew, now })
  const body = (
    <>
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
        {current ? (
          <span className="inline-flex h-[22px] flex-none items-center rounded-md bg-surface2 px-2 text-[11.5px] font-semibold text-ink2">{ASK_COPY.history.current}</span>
        ) : null}
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
    </>
  )
  return (
    <li className="relative min-w-0">
      <button type="button" onClick={onOpen} aria-label={current ? `${v.label}, ${ASK_COPY.history.current}` : v.label} className={`${ASK_ROW_CLASS} w-full pr-[52px] text-left active:bg-surface2`}>
        {body}
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-label={ASK_COPY.history.rowMore(chat.title)}
        data-ask-row-more={chat.id}
        className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-ink2 active:bg-surface2"
      >
        <span aria-hidden="true" className="text-[20px] leading-none">
          ⋯
        </span>
      </button>
    </li>
  )
}
