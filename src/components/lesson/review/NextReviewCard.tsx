'use client'

/**
 * 복습 종료 카드의 "다음 복습"(screens §14-2 I · 데모 `#rend`·`#rend-more`·`#rend-pending`·`#rend-fb`) — 표시 전용.
 * 대기(스피너) · 선생님 판단(묶음 + 근거 상자) · 판단 실패(지난 간격, 묶음·근거 없음) · 모름(오늘 탭 안내).
 * 판단 주체 원값은 화면에 싣지 않고 문구 분기에만 쓴다. 근거 문장은 `TeacherWhy` 가 텍스트로만 그린다.
 */
import { useId } from 'react'
import type { NextReviewDetail, ReviewItem } from '@/types/review'
import { Spinner } from '../parts'
import { FocusBadge } from './FocusBadge'
import { RV_END, RV_HOME, RV_LESSON } from './reviewCopy'
import { formatDue, groupsSorted } from './reviewLogic'
import TeacherWhy from './TeacherWhy'
import type { NextReviewState } from './useNextReview'

export default function NextReviewCard({ state, next, items, teacherName }: { state: NextReviewState; next: NextReviewDetail | null; items: readonly ReviewItem[]; teacherName: string }) {
  const titleId = useId()
  const groups = next ? groupsSorted(next.groups) : []
  const first = groups[0] ?? null
  const shown: NextReviewState = state === 'ready' && !first ? 'unknown' : state

  let body: React.ReactNode
  if (shown === 'pending') {
    body = (
      <>
        <h3 id={titleId} className="mt-0.5 flex items-center gap-2 text-[17px] font-bold text-ink break-keep">
          <span className="text-accent">
            <Spinner />
          </span>
          {RV_END.pendingTitle}
        </h3>
        <p role="status" className="mt-0.5 text-[14px] text-ink break-keep">
          {RV_END.pendingBody}
        </p>
      </>
    )
  } else if (shown === 'ready' && next && first) {
    const due = formatDue(first.date)
    if (next.decidedBy === 'FALLBACK') {
      body = (
        <>
          <h3 id={titleId} className="mt-0.5 text-[17px] font-bold text-ink break-keep">
            {RV_END.fallbackTitle(first.days)}
          </h3>
          <p className="mt-0.5 text-[14px] text-ink">{due}</p>
          <p className="mt-1 text-[12px] text-ink2 break-keep">{RV_END.fallbackNote}</p>
        </>
      )
    } else {
      const byId = new Map(items.map((x) => [x.id, x]))
      body = (
        <>
          <h3 id={titleId} className="mt-0.5 text-[17px] font-bold text-ink break-keep">
            {RV_END.tutorTitle(first.days)}
          </h3>
          <p className="mt-0.5 text-[14px] text-ink break-keep">{groups.length > 1 ? RV_END.tutorManyBody(due) : RV_END.tutorOneBody(due)}</p>
          <div className="mt-2.5 flex flex-col gap-2">
            {groups.map((g) => {
              const found = g.itemIds.map((id) => byId.get(id)).filter((x): x is ReviewItem => !!x)
              // 개수는 서버 값(`itemIds`)이고 칩은 이번 항목에서 찾은 것만이라, 어긋나면 홈 카드처럼 "외 N개"로 맞춘다.
              const missing = g.itemIds.length - found.length
              return (
                <div key={`${g.days}:${g.date}`} className="min-w-0 rounded-xl bg-surface px-3 py-2.5">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-[13px]">
                    <b className="text-[15px]">{RV_END.groupDays(g.days)}</b>
                    <span className="text-[12px] text-ink2">{RV_END.groupMeta(formatDue(g.date), g.itemIds.length)}</span>
                  </p>
                  {found.length ? (
                    <ul aria-label={RV_HOME.chipsAria} className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                      {found.map((x) => (
                        <li key={x.id} className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-[10px] bg-surface2 px-2.5 py-1.5">
                          <span lang="ja" className="min-w-0 text-[15px] [overflow-wrap:anywhere]">
                            {x.textJa}
                          </span>
                          {x.priority === 'FOCUS' ? <FocusBadge small>{RV_LESSON.focus}</FocusBadge> : null}
                        </li>
                      ))}
                      {missing > 0 ? <li className="inline-flex items-center rounded-[10px] bg-surface2 px-2.5 text-[12.5px] text-ink2">{RV_HOME.chipsMore(missing)}</li> : null}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
          <TeacherWhy mode="TUTOR" text={next.rationaleKo} who={teacherName} at={null} surface />
        </>
      )
    }
  } else {
    body = (
      <p id={titleId} className="mt-0.5 text-[14px] text-ink break-keep">
        {RV_END.unknown}
      </p>
    )
  }

  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-[14px] bg-accent-soft p-3.5">
      <p className="text-[13px] text-ink2">{RV_END.nextTitle}</p>
      <div aria-live="polite">{body}</div>
    </section>
  )
}
