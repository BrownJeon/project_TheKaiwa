'use client'

/**
 * 하루 상세 바텀 시트(결정 b=A, 데모 `daySheet`). 공용 `Sheet` 를 그대로 쓴다 — 머리 줄에는 제목·닫기만 들어가므로
 * 전날·다음 날(‹ ›)은 본문 맨 위 줄(출석·기록 수 옆)에 두고 스크롤해도 붙어 있게 한다.
 *
 * 기록 한 줄 = 원본으로 가는 링크(원본이 지워졌으면 "원본이 삭제됐어요" 배지·이동 안 함) + ⋯ 메뉴.
 */
import Link from 'next/link'
import Sheet from '@/components/common/Sheet'
import { Badge } from '@/components/common/ui'
import type { DayResponse, StudyLogItem } from '@/types/plan'
import { Chip, IconDots, IconLeft, IconRight } from './parts'
import {
  dayLabel,
  dayNav,
  daySpoken,
  dayStatusLine,
  displaySummary,
  emptyDayKind,
  linkState,
  logMeta,
  needsUntimedNote,
  reviewLine,
  sourceHref,
  timeLabel,
  TYPE_META,
} from './logic'
import type { LoadStatus } from './usePlanData'

export default function DaySheet({
  date,
  today,
  status,
  data,
  dismissible,
  onClose,
  onStep,
  onBlocked,
  onRetry,
  onOpenSource,
  onGone,
  onMenu,
}: {
  date: string | null
  today: string
  status: LoadStatus
  data: DayResponse | null
  /** 위에 메뉴·확인 시트가 떠 있으면 false — Esc 가 두 시트를 한꺼번에 닫지 않게. */
  dismissible: boolean
  onClose: () => void
  onStep: (date: string) => void
  onBlocked: (why: string) => void
  onRetry: () => void
  /** 원본 화면으로 가기 직전(주소에 돌아올 자리를 적는다). */
  onOpenSource: (log: StudyLogItem) => void
  onGone: () => void
  onMenu: (log: StudyLogItem) => void
}) {
  return (
    <Sheet open={date !== null} title={date ? dayLabel(date) : ''} onClose={onClose} dismissible={dismissible}>
      {date ? (
        <div data-plan-daybody className="pb-2">
          <DayBody date={date} today={today} status={status} data={data} onStep={onStep} onBlocked={onBlocked} onRetry={onRetry} onOpenSource={onOpenSource} onGone={onGone} onMenu={onMenu} />
        </div>
      ) : null}
    </Sheet>
  )
}

function DayBody({
  date,
  today,
  status,
  data,
  onStep,
  onBlocked,
  onRetry,
  onOpenSource,
  onGone,
  onMenu,
}: {
  date: string
  today: string
  status: LoadStatus
  data: DayResponse | null
  onStep: (date: string) => void
  onBlocked: (why: string) => void
  onRetry: () => void
  onOpenSource: (log: StudyLogItem) => void
  onGone: () => void
  onMenu: (log: StudyLogItem) => void
}) {
  const nav = dayNav(date, today)
  const future = date > today
  const ready = status === 'ready' && data !== null
  const logs = ready ? data.logs : []
  const line = dayStatusLine(logs)
  const review = ready ? reviewLine(data.review, date, today, logs) : null

  const stepper = (
    <div className="flex flex-none items-center">
      <button
        type="button"
        aria-label="전날"
        aria-disabled={!nav.canPrev || undefined}
        onClick={() => (nav.canPrev ? onStep(nav.prev) : onBlocked(nav.whyPrev))}
        className="grid h-11 w-11 place-items-center rounded-xl text-ink aria-disabled:text-ink3"
      >
        <IconLeft />
      </button>
      <button
        type="button"
        aria-label="다음 날"
        aria-disabled={!nav.canNext || undefined}
        onClick={() => (nav.canNext ? onStep(nav.next) : onBlocked(nav.whyNext))}
        className="grid h-11 w-11 place-items-center rounded-xl text-ink aria-disabled:text-ink3"
      >
        <IconRight />
      </button>
    </div>
  )

  let status0: React.ReactNode = null
  if (status === 'loading') status0 = <span aria-hidden="true" className="inline-block h-[22px] w-[150px] rounded-md bg-surface2" />
  else if (ready && !future)
    status0 = (
      <>
        {data.attended ? <Badge tone="good">✓ 출석</Badge> : <Badge tone="neutral">출석 안 함</Badge>}
        {line ? <span className="text-[13px] text-ink2">{line}</span> : null}
      </>
    )

  return (
    <>
      <div className="sticky top-0 z-[1] -mt-1 flex min-h-11 items-center gap-2 bg-surface">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">{status0}</div>
        {stepper}
      </div>

      {status === 'loading' ? (
        <>
          <p role="status" className="sr-only">
            {daySpoken(date)} 기록을 불러오는 중…
          </p>
          <div aria-hidden="true" className="mt-3 border-t border-line pt-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="my-2.5 block h-11 w-full rounded-[10px] bg-surface2" />
            ))}
          </div>
        </>
      ) : status === 'error' || !data ? (
        <div role="alert" className="mt-2 rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
          <p className="break-keep">
            <b className="font-bold">이날 기록을 불러오지 못했어요.</b> 잠시 뒤 다시 시도해 주세요.
          </p>
          <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]">
            다시 시도
          </button>
        </div>
      ) : (
        <>
          {review ? (
            <div className={`mt-2 flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${review.tone === 'due' ? 'bg-accent-soft' : 'bg-surface2'}`}>
              <Chip mark={review.tone === 'due' ? { kind: 'due' } : { kind: 'type', type: 'REVIEW' }} size="lg" soft />
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <p className="text-[14px] font-semibold break-keep">{review.title}</p>
                {review.sub ? <p className="text-[13px] text-ink2 break-keep">{review.sub}</p> : null}
                {review.action ? (
                  <Link
                    href="/study/today"
                    className={`mt-2 inline-flex h-11 items-center justify-center self-start rounded-xl px-3.5 text-[14px] font-semibold ${
                      review.action === 'primary' ? 'bg-accent text-on-accent' : 'border border-line bg-surface'
                    }`}
                  >
                    복습하러 가기
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
          {future ? (
            <p className="mt-3 text-[14px]">아직 오지 않은 날이에요.</p>
          ) : logs.length === 0 ? (
            <EmptyDay kind={emptyDayKind(date, today, data.attended)} />
          ) : (
            <>
              <ul aria-label={`${daySpoken(date)} 공부 기록`} className="mt-3 border-t border-line">
                {logs.map((l) => (
                  <LogRow key={l.id} log={l} onOpenSource={onOpenSource} onGone={onGone} onMenu={onMenu} />
                ))}
              </ul>
              {needsUntimedNote(logs) ? (
                <p className="mt-2.5 text-[12px] text-ink2 break-keep">회화·채팅은 공부 시간을 따로 재지 않아서 공부 시간에 들어가지 않아요.</p>
              ) : null}
            </>
          )}
        </>
      )}
    </>
  )
}

function EmptyDay({ kind }: { kind: ReturnType<typeof emptyDayKind> }) {
  if (kind === 'today')
    return (
      <div className="mt-3">
        <p className="text-[14px]">오늘은 아직 공부 기록이 없어요.</p>
        <Link href="/study/today" className="mt-2 inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold">
          오늘 탭으로
        </Link>
      </div>
    )
  if (kind === 'attended') return <p className="mt-3 text-[14px] break-keep">출석만 했어요. 이날은 공부 기록이 없어요.</p>
  if (kind === 'future') return <p className="mt-3 text-[14px]">아직 오지 않은 날이에요.</p>
  return <p className="mt-3 text-[14px]">이날은 기록이 없어요.</p>
}

function LogRow({
  log,
  onOpenSource,
  onGone,
  onMenu,
}: {
  log: StudyLogItem
  onOpenSource: (log: StudyLogItem) => void
  onGone: () => void
  onMenu: (log: StudyLogItem) => void
}) {
  const meta = TYPE_META[log.type]
  const time = timeLabel(log.createdAt)
  const extra = logMeta(log)
  const summary = displaySummary(log)
  const state = linkState(log)
  const href = sourceHref(log)
  const body = (
    <>
      <Chip mark={{ kind: 'type', type: log.type }} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-[12px] text-ink2">
          {meta.label} · {time}
        </span>
        <span className={`text-[14.5px] leading-[1.45] break-keep [overflow-wrap:anywhere] ${state === 'gone' ? 'text-ink2' : ''}`}>{summary}</span>
        {extra.length ? <span className="text-[12px] text-ink2 tabular-nums">{extra.join(' · ')}</span> : null}
        {state === 'gone' ? (
          <span className="mt-[3px] self-start">
            <Badge tone="neutral">원본이 삭제됐어요</Badge>
          </span>
        ) : null}
      </span>
      {state === 'open' ? (
        <span aria-hidden="true" className="flex-none text-[18px] text-ink2">
          ›
        </span>
      ) : null}
    </>
  )
  const aria = `${meta.label}, ${time}, ${summary}${extra.length ? `, ${extra.join(', ')}` : ''}`
  const rowCls = 'flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2.5 pr-0.5 text-left'
  return (
    <li className="flex min-w-0 items-stretch border-b border-line">
      {state === 'open' && href ? (
        <Link href={href} data-plan-row={log.id} aria-label={`${aria}, ${meta.dest} 열기`} onClick={() => onOpenSource(log)} className={rowCls}>
          {body}
        </Link>
      ) : state === 'gone' ? (
        <button type="button" data-plan-row={log.id} aria-label={`${aria}, 원본이 삭제됐어요`} onClick={onGone} className={`${rowCls} cursor-default`}>
          {body}
        </button>
      ) : (
        <div className={rowCls}>{body}</div>
      )}
      <button
        type="button"
        data-plan-more={log.id}
        aria-haspopup="dialog"
        aria-label={`${meta.label} ${time} 기록 메뉴`}
        onClick={() => onMenu(log)}
        className="grid h-11 w-11 flex-none place-items-center self-center rounded-xl text-ink2"
      >
        <IconDots />
      </button>
    </li>
  )
}
