'use client'

/**
 * 세트 결과 위 챌린지 상자(task-044 가이드 §3-8) — #51 `challenge` 가 있을 때만(방금 끝낸 세트). 다시 열기(#49 DONE)·새로 고침에는 없다.
 * 모양은 글자 + 기호(✓ · 일부 반원 그림 `PartialMark`)로 함께 보인다. 목표 달성 알림은 `goalMetNow` 일 때 한 번(`role=status`).
 */
import Link from 'next/link'
import { PartialMark } from '@/components/challenge/parts'
import { Btn } from '@/components/common/ui'
import { RESULT_CH } from './topicCopy'
import type { ResultChallengeView } from './topicLogic'

function Dot({ tone }: { tone: 'good' | 'warn' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[15px] font-bold ${tone === 'good' ? 'bg-good-soft text-good' : 'bg-warn-soft text-ink'}`}
    >
      {tone === 'good' ? '✓' : <PartialMark />}
    </span>
  )
}

const LINK = 'inline-flex min-h-11 flex-none items-center text-[13px] font-semibold text-ink underline underline-offset-4'

export default function ChallengeResultBox({ view, title, onOneMore, oneMoreBusy }: { view: ResultChallengeView; title: string; onOneMore: () => void; oneMoreBusy: boolean }) {
  switch (view.kind) {
    case 'metNow':
    case 'retro':
      return (
        <div role="status" className="mb-3 flex min-w-0 items-start gap-3 rounded-[14px] border border-line bg-surface p-3.5">
          <Dot tone="good" />
          <div className="min-w-0 flex-1">
            <b className="block text-[15px]">{view.kind === 'metNow' ? RESULT_CH.metNowTitle : RESULT_CH.retroTitle}</b>
            <p className="mt-0.5 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">
              {view.kind === 'metNow' ? RESULT_CH.metNowBody(title, view.dayIndex, view.ans, view.need) : RESULT_CH.retroBody(view.date, view.dayIndex)}
            </p>
            <Link href={view.kind === 'metNow' ? `/plan/challenge/${encodeURIComponent(view.challengeId)}` : '/plan'} className={LINK}>
              {view.kind === 'metNow' ? RESULT_CH.toChallenge : RESULT_CH.toPlan}
            </Link>
          </div>
        </div>
      )
    case 'wordsDone':
      return (
        <div className="mb-3 flex min-w-0 items-start gap-3 rounded-[14px] bg-warn-soft p-3.5">
          <Dot tone="warn" />
          <div className="min-w-0 flex-1 text-ink">
            <b className="block text-[14px] break-keep">{RESULT_CH.wordsDoneTitle}</b>
            <p className="mt-0.5 text-[13px] break-keep">{RESULT_CH.wordsDoneBody(view.ans, view.need)}</p>
            <Link href="/study/today" className={LINK}>
              {RESULT_CH.toTalk}
            </Link>
          </div>
        </div>
      )
    case 'short':
      return (
        <div role="note" className="mb-3 min-w-0 rounded-[14px] bg-warn-soft p-3.5 text-ink">
          <b className="block text-[14px] tabular-nums break-keep">{RESULT_CH.shortTitle(view.ans, view.need)}</b>
          <p className="mt-0.5 text-[13px] break-keep">{RESULT_CH.shortBody}</p>
          <Btn className="mt-2.5 !h-11 w-full" onClick={onOneMore} aria-disabled={oneMoreBusy || undefined} aria-busy={oneMoreBusy || undefined}>
            {RESULT_CH.oneMore}
          </Btn>
        </div>
      )
    case 'already':
    case 'wordsAlready':
    case 'pastDay':
      return (
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-2 rounded-[14px] bg-surface2 px-3.5 py-2.5 text-[13px] text-ink">
          <p className="min-w-0 flex-1 break-keep py-1 tabular-nums">
            {view.kind === 'already'
              ? RESULT_CH.already(view.ans)
              : view.kind === 'wordsAlready'
                ? RESULT_CH.wordsAlready(view.ans)
                : RESULT_CH.pastDay(view.date, view.dayIndex, view.ans, view.need)}
          </p>
          {view.kind === 'wordsAlready' ? (
            <Link href="/study/today" className={LINK}>
              {RESULT_CH.toTalk}
            </Link>
          ) : null}
        </div>
      )
  }
}
