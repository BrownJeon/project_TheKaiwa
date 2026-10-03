'use client'

/**
 * 오늘 홈 "오늘의 복습" 카드(screens §14-2 A 5~15번 · 데모 `#rv-*`) — **상태를 갖지 않는 표시 컴포넌트**다. 상태(건너뛰기 타이머·되돌리기·
 * 요청 중)는 `TodayHome` 의 훅에 있어 카드가 오늘의 회화 위·아래로 자리를 옮겨도 끊기지 않는다([자세히] 펼침만 `TeacherWhy` 안).
 * 로딩·오류·가드·숨김은 그리지 않는다(로딩·오류는 오늘의 회화 카드 한 곳, 가드는 `ReviewSoonSection`).
 * 일정·잡·레슨 id, 판단 주체 원값은 DOM 에 싣지 않는다(§14-0 ⑧).
 */
import { useId, type RefObject } from 'react'
import { Btn, Card } from '@/components/common/ui'
import { stageLabel } from '../lessonCopy'
import { Spinner } from '../parts'
import { MiniSteps } from '../TodayLessonCard'
import { FocusBadge } from './FocusBadge'
import { RV_HOME } from './reviewCopy'
import { decidedAtLabel, formatDue, isTutorReview, nextReviewLine, type ReviewCard } from './reviewLogic'
import TeacherWhy from './TeacherWhy'

export interface TodayReviewCardProps {
  card: ReviewCard
  teacherName: string
  /** 오늘 KST 날짜 키(#58 `date`) — 근거 시각 "오늘 HH:mm" 판정. */
  todayKey: string
  /** [복습 시작]·[다시 만들기] 요청 중. */
  busy: boolean
  skipFailed: boolean
  onStart: () => void
  onRetry: () => void
  onOpen: (lessonId: string) => void
  onSkip: () => void
  titleRef?: RefObject<HTMLHeadingElement | null>
  skipBtnRef?: RefObject<HTMLButtonElement | null>
}

const strong = 'mt-1 text-[15px] font-semibold break-keep'
const sub = 'mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]'

export default function TodayReviewCard({ card, teacherName, todayKey, busy, skipFailed, onStart, onRetry, onOpen, onSkip, titleRef, skipBtnRef }: TodayReviewCardProps) {
  const titleId = useId()
  if (card.kind === 'loading' || card.kind === 'error' || card.kind === 'guard' || card.kind === 'hidden') return null

  const head = (minutes = false) => (
    <div className="flex items-baseline justify-between gap-2">
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-[15px] font-semibold outline-none">
        {RV_HOME.title}
      </h2>
      {minutes ? <span className="text-[12px] text-ink2">{RV_HOME.minutes}</span> : null}
    </div>
  )
  const skipLink = (
    <button
      ref={skipBtnRef}
      type="button"
      onClick={onSkip}
      className="flex h-11 w-full items-center justify-center text-[13px] font-semibold text-ink underline underline-offset-[3px]"
    >
      {RV_HOME.skip}
    </button>
  )
  const failLine = skipFailed ? (
    <p role="alert" className="mt-2 rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad break-keep">
      {RV_HOME.skipFailed}
    </p>
  ) : null

  let body: React.ReactNode
  let accent = false
  switch (card.kind) {
    case 'due':
    case 'dueFallback': {
      const r = card.review
      accent = true
      const tutor = card.kind === 'due' && isTutorReview(r)
      body = (
        <>
          {head(true)}
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
            <span>{RV_HOME.items(r.itemCount)}</span>
            {r.focusCount > 0 ? <FocusBadge>{RV_HOME.focus(r.focusCount)}</FocusBadge> : null}
          </p>
          <TeacherWhy
            mode={tutor ? 'TUTOR' : 'FALLBACK'}
            text={tutor ? r.tutorRationale : null}
            who={teacherName}
            at={decidedAtLabel(r.decidedAt, todayKey)}
            chips={r.preview.map((x) => ({ textJa: x.textJa, focus: x.priority === 'FOCUS' }))}
            more={Math.max(0, r.itemCount - r.preview.length)}
          />
          {failLine}
          <Btn className="mt-3 w-full" aria-busy={busy || undefined} onClick={onStart}>
            {busy ? RV_HOME.starting : RV_HOME.start}
          </Btn>
          {skipLink}
        </>
      )
      break
    }
    case 'gen':
      body = (
        <>
          {head()}
          <p className={strong}>{RV_HOME.genTitle}</p>
          <p className={sub}>{RV_HOME.genBody(card.review.itemCount)}</p>
          <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-surface2">
            <div className="h-full w-2/5 rounded-full bg-accent motion-safe:animate-[lesson-indet_1.6s_ease-in-out_infinite]" />
          </div>
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => card.review.lessonId && onOpen(card.review.lessonId)}>
            {RV_HOME.genOpen}
          </Btn>
        </>
      )
      break
    case 'genfail':
      body = (
        <>
          {head()}
          <p className={strong}>{RV_HOME.failTitle}</p>
          <p className={sub}>{RV_HOME.failBody(card.review.itemCount)}</p>
          {failLine}
          <Btn className="mt-3 w-full" aria-busy={busy || undefined} onClick={onRetry}>
            {busy ? RV_HOME.starting : RV_HOME.retry}
          </Btn>
          {skipLink}
        </>
      )
      break
    case 'progress':
      body = (
        <>
          {head()}
          <p className={strong}>{RV_HOME.progressTitle}</p>
          <p className={sub}>{RV_HOME.progressBody(card.review.itemCount, card.stageDone)}</p>
          <MiniSteps done={card.stageDone} />
          {card.stageDone < 5 ? <p className="mt-2 text-[12px] text-ink2">{RV_HOME.nextStage(stageLabel(card.stageDone + 1))}</p> : null}
          <Btn className="mt-3 w-full" onClick={() => onOpen(card.lessonId)}>
            {RV_HOME.resume}
          </Btn>
        </>
      )
      break
    case 'ready':
      body = (
        <>
          {head()}
          <p className={strong}>{RV_HOME.readyTitle}</p>
          <p className={sub}>{RV_HOME.readyBody(card.review.itemCount)}</p>
          <MiniSteps done={0} />
          <Btn className="mt-3 w-full" onClick={() => onOpen(card.lessonId)}>
            {RV_HOME.readyStart}
          </Btn>
        </>
      )
      break
    case 'done':
    case 'donePending': {
      const r = card.review
      const line = card.kind === 'done' && card.next ? nextReviewLine(card.next) : null
      body = (
        <>
          {head()}
          <p className={strong}>
            <span aria-hidden="true" className="text-good">
              ✓{' '}
            </span>
            {RV_HOME.doneTitle}
          </p>
          <p className={sub}>{RV_HOME.doneBody(r.itemCount, card.correct)}</p>
          {card.kind === 'donePending' || line ? (
            <div className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2.5">
              <p className="text-[12px] text-ink2">{RV_HOME.nextTitle}</p>
              {card.kind === 'donePending' ? (
                <p role="status" className="mt-0.5 flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <span className="text-accent">
                    <Spinner />
                  </span>
                  {RV_HOME.nextPending}
                </p>
              ) : line ? (
                <>
                  <p className="mt-0.5 text-[14px] font-semibold text-ink break-keep">{line.text}</p>
                  {line.note ? <p className="mt-1 text-[12px] text-ink2 break-keep">{line.note}</p> : null}
                </>
              ) : null}
            </div>
          ) : null}
          {r.lessonId ? (
            <button
              type="button"
              onClick={() => r.lessonId && onOpen(r.lessonId)}
              className="mt-1 flex h-11 w-full items-center justify-center text-[13px] font-semibold text-ink underline underline-offset-[3px]"
            >
              {RV_HOME.doneResult}
            </button>
          ) : null}
        </>
      )
      break
    }
    case 'skipped':
    case 'skippedServer':
      body = (
        <>
          {head()}
          <p className={strong}>{RV_HOME.skippedTitle}</p>
          <p className={sub}>{RV_HOME.skippedBody(card.review.itemCount)}</p>
        </>
      )
      break
    case 'pending':
      body = (
        <>
          {head()}
          <p role="status" className="mt-2 flex items-center gap-2 text-[15px] font-semibold break-keep">
            <span className="text-accent">
              <Spinner />
            </span>
            {RV_HOME.pendingTitle}
          </p>
          <p className={sub}>{RV_HOME.pendingBody}</p>
        </>
      )
      break
    case 'rest':
      body = (
        <>
          {head()}
          <p className={strong}>{RV_HOME.restTitle}</p>
          <p className={sub}>{RV_HOME.restBody(formatDue(card.next.date), card.next.days, card.next.itemCount)}</p>
        </>
      )
      break
  }

  return (
    <section aria-labelledby={titleId} className="mt-[18px] min-w-0">
      <Card className={accent ? 'border-accent!' : ''}>{body}</Card>
    </section>
  )
}
