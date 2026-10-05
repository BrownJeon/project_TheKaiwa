'use client'

/**
 * ① 이해 맨 위 "이번 복습 항목"(screens §14-2 F · 데모 `#rl1`·`#rl1-closed`) — 접기 카드. 읽기 줄 대신 히라가나·한글 층(task-033, screens §15-11-4)을 앱 표시 설정대로 단다.
 * 출처는 3종 라벨만(Leader ④), 원값(`refType`)·항목별 판단 이유는 싣지 않는다. 접힘 상태는 sessionStorage(기본 펼침).
 */
import { useId, useState } from 'react'
import { useAnnotations, type AnnotationState } from '@/components/common/japanese/annotations'
import { useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { readStore, writeStore } from '@/components/common/storage'
import { Card } from '@/components/common/ui'
import { hasKanji } from '@/modules/speech/reading/client'
import type { ReviewItem } from '@/types/review'
import { FocusBadge } from './FocusBadge'
import { RV_LESSON } from './reviewCopy'
import { countLabel, itemTypeLabel, sortReviewItems, sourceLabel, studiedLabel } from './reviewLogic'
import { REVIEW_KEYS } from './useReviewSkip'

function ReviewItemRow({ it, ann }: { it: ReviewItem; ann: AnnotationState }) {
  const prefs = useDisplayPrefs()
  const type = itemTypeLabel(it.itemType)
  const count = countLabel(it)
  const src = sourceLabel(it.refType)
  const focus = it.priority === 'FOCUS'
  // 종류 뱃지를 첫 줄 글자에 맞춘다 — 루비 줄간격이 예약되는 때(한자 + 히라가나 켬 + 분석 중·완료)만 8px.
  const reserve = prefs.loaded && prefs.showFurigana && hasKanji(it.textJa) && (ann.s === 'loading' || ann.s === 'ready')
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 border-t border-line py-2.5 first:border-t-0 first:pt-0.5">
      <div className="min-w-0">
        <p className="flex min-w-0 items-start gap-1.5">
          {type ? <span className={`${reserve ? 'mt-2' : 'mt-[5px]'} inline-flex h-5 flex-none items-center rounded-md bg-surface2 px-1.5 text-[11.5px] font-semibold text-ink2`}>{type}</span> : null}
          <span className="min-w-0">
            <JaText as="span" text={it.textJa} state={ann} leading={2.1} className="block text-[17px] leading-[1.5] [overflow-wrap:anywhere]" />
            <HangulLine as="span" state={ann} size={13} />
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
  // 접힘이어도 요청한다 — 목록이 `hidden` 으로 DOM 에 있어 펼칠 때 막대가 다시 뜨지 않게.
  const anns = useAnnotations(sorted.map((x) => x.textJa))
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
          {sorted.map((it, i) => (
            <ReviewItemRow key={it.id} it={it} ann={anns[i]} />
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
