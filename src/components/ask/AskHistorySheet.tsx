'use client'

/**
 * 「지난 질문」 시트(task-066 §26-4 C, 데모 G·history) — 공용 `Sheet`, 시트 안만 스크롤. 열 때 다시 읽는다.
 * 행 = `AskListItem`(지금 대화는 버튼 + 「지금 대화」, 그 밖은 지난 대화 링크). 정렬은 서버 `lastMessageAt desc`.
 * 삭제·길게 누르기 없음 — 그 대화를 열고 ⋯ 에서 지운다.
 */
import { useEffect } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { ChatRowsSkeleton } from '@/components/shell/TabSkeleton'
import { ASK_COPY } from './askCopy'
import AskListItem from './AskListItem'
import type { AskActivity } from './useAskActivity'

export default function AskHistorySheet({
  open,
  activity,
  currentChatId,
  onClose,
}: {
  open: boolean
  activity: AskActivity
  currentChatId: string | null
  onClose: () => void
}) {
  const { refresh } = activity
  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const a = activity
  let body: React.ReactNode
  if (a.state === 'loading') body = <ChatRowsSkeleton />
  else if (a.state === 'error')
    body = (
      <div role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13.5px] text-bad">
        <span className="block text-[14.5px] font-semibold">{ASK_COPY.listError}</span>
        <span className="block break-keep">{ASK_COPY.listErrorBody}</span>
        <button type="button" onClick={refresh} className="mt-0.5 inline-flex min-h-11 items-center font-semibold underline">
          {ASK_COPY.retry}
        </button>
      </div>
    )
  else if (a.items.length === 0) body = <p className="text-[14px] text-ink2">{ASK_COPY.history.empty}</p>
  else
    body = (
      <>
        <ul className="flex min-w-0 flex-col gap-2">
          {a.items.map((c) => (
            <AskListItem key={c.id} chat={c} isNew={a.newIds.has(c.id)} now={a.now} current={c.id === currentChatId} onCurrent={onClose} />
          ))}
        </ul>
        {a.moreError ? (
          <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
            {a.moreError}
          </p>
        ) : null}
        {a.cursor ? (
          <Btn variant="ghost" className="mt-2 w-full" onClick={a.more} aria-busy={a.moreBusy || undefined}>
            {a.moreBusy ? ASK_COPY.moreBusy : ASK_COPY.more}
          </Btn>
        ) : null}
      </>
    )

  return (
    <Sheet open={open} title={ASK_COPY.history.title} onClose={onClose}>
      <div className="min-w-0">{body}</div>
    </Sheet>
  )
}
