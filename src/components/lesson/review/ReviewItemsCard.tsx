'use client'

/**
 * ① 이해 맨 위 "이번 복습 항목"(screens §14-2 F · 데모 `#rl1`·`#rl1-closed`) — 접기 카드. 읽기 줄은 없다(Leader ③ — [읽기] 토글과 무관).
 * 출처는 3종 라벨만(Leader ④), 원값(`refType`)·항목별 판단 이유는 싣지 않는다. 접힘 상태는 sessionStorage(기본 펼침).
 */
import { useId, useState } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import { Card } from '@/components/common/ui'
import type { ReviewItem } from '@/types/review'
import { FocusBadge } from './FocusBadge'
import { RV_LESSON } from './reviewCopy'
import { countLabel, itemTypeLabel, sortReviewItems, sourceLabel, studiedLabel } from './reviewLogic'
import { REVIEW_KEYS } from './useReviewSkip'

function ReviewItemRow({ it }: { it: ReviewItem }) {
  const type = itemTypeLabel(it.itemType)
  const count = countLabel(it)
  const src = sourceLabel(it.refType)
  const focus = it.priority === 'FOCUS'
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 border-t border-line py-2.5 first:border-t-0 first:pt-0.5">
      <div className="min-w-0">
        <p className="flex min-w-0 items-start gap-1.5">
          {type ? <span className="mt-[5px] inline-flex h-5 flex-none items-center rounded-md bg-surface2 px-1.5 text-[11.5px] font-semibold text-ink2">{type}</span> : null}
          <span lang="ja" className="min-w-0 text-[17px] leading-[1.5] [overflow-wrap:anywhere]">
            {it.textJa}
          </span>
        </p>
        {it.meaningKo ? <p className="text-[14px] break-keep">{it.meaningKo}</p> : null}
        <p className="mt-0.5 text-[12px] text-ink2 break-keep">
          <span className={count.bad ? 'font-semibold text-bad' : undefined}>{count.text}</span>
          {` · ${studiedLabel(it.studiedCount)}`}
          {src ? ` · ${RV_LESSON.fromSource(src)}` : null}
        </p>
      </div>
      <div className="pt-1">{focus ? <FocusBadge>{RV_LESSON.focus}</FocusBadge> : null}</div>
    </li>
  )
}

export default function ReviewItemsCard({ lessonId, items }: { lessonId: string; items: readonly ReviewItem[] }) {
  const key = REVIEW_KEYS.itemsOpen(lessonId)
  const [open, setOpen] = useState(() => readStore('session', key) !== '0')
  const listId = useId()
  const sorted = sortReviewItems(items)
  const f = items.filter((x) => x.priority === 'FOCUS').length

  const toggle = () => {
    const v = !open
    setOpen(v)
    writeStore('session', key, v ? '1' : '0')
  }

  return (
    <Card className="mb-2.5">
      <button type="button" aria-expanded={open} aria-controls={listId} onClick={toggle} className="flex min-h-12 w-full items-center gap-2 text-left">
        <span className="min-w-0 flex-1 text-[15px] font-semibold break-keep">
          {RV_LESSON.itemsTitle(items.length)}
          {f > 0 ? <span className="text-[12px] font-normal text-ink2">{RV_LESSON.itemsFocus(f)}</span> : null}
        </span>
        <span aria-hidden="true" className={`flex-none text-[20px] leading-none text-ink2 transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>
      <div id={listId} hidden={!open}>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{RV_LESSON.itemsNote}</p>
        <ul className="mt-2">
          {sorted.map((it) => (
            <ReviewItemRow key={it.id} it={it} />
          ))}
        </ul>
        {f > 0 ? (
          <p className="mt-2 text-[12px] text-ink2 break-keep">
            <FocusBadge>{RV_LESSON.focus}</FocusBadge>
            {RV_LESSON.focusNote}
          </p>
        ) : null}
      </div>
    </Card>
  )
}
