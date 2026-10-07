'use client'

/**
 * 챌린지 시트 둘(공용 `Sheet`) — S5 하루 시트(가이드 §3-5, 상세 값으로 그림·따로 읽지 않음)와 그만두기 확인(§3-7, 되돌릴 수 없음).
 */
import Link from 'next/link'
import Sheet from '@/components/common/Sheet'
import { Badge, Btn, BtnRow } from '@/components/common/ui'
import { Chip, IconLeft, IconRight, Spinner } from '@/components/plan/parts'
import type { ChallengeDay, ChallengeDetail } from '@/types/challenge'
import { COPY, TODAY_HREF } from './challengeCopy'
import { daySheetView, endSheetView, taskCounts } from './logic'
import { BLOCKED_FACE, DayGlyph, PartialMark } from './parts'

export function ChallengeDaySheet({
  detail,
  date,
  onClose,
  onStep,
  onBlocked,
}: {
  detail: ChallengeDetail
  date: string | null
  onClose: () => void
  onStep: (date: string) => void
  onBlocked: (why: string) => void
}) {
  const i = date ? detail.days.findIndex((d) => d.date === date) : -1
  const day: ChallengeDay | null = i >= 0 ? detail.days[i] : null
  const finished = detail.status !== 'ACTIVE'
  const v = day
    ? daySheetView(day, {
        goal: detail.dailyGoal,
        topicTitle: detail.topic.title,
        finished,
        stopDay: detail.status === 'ENDED' ? detail.stats.dayIndex : null,
        todayCounts: detail.today ? taskCounts(detail.today.tasks) : null,
      })
    : null
  const prev = i > 0 ? detail.days[i - 1] : null
  const next = i >= 0 && i < detail.days.length - 1 ? detail.days[i + 1] : null
  return (
    <Sheet open={!!day} title={v?.title ?? ''} onClose={onClose}>
      {day && v ? (
        <div className="pb-2">
          <div className="flex items-start gap-2.5 rounded-xl bg-surface2 px-3 py-2.5">
            <DayGlyph state={day.state} size="lg" />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{v.status}</p>
              <p className="text-[13px] text-ink2 break-keep">{v.reason}</p>
            </div>
          </div>
          <p className="mt-2.5 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{v.goalLine}</p>
          <ul className="mt-2 border-t border-line">
            {v.rows.map((r) => (
              <li key={r.kind} className="flex min-w-0 items-start gap-3 border-b border-line py-2.5">
                <Chip mark={{ kind: 'type', type: r.kind === 'words' ? 'WORDS' : 'LESSON' }} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-[14px] leading-[1.45] break-keep [overflow-wrap:anywhere]">{r.main}</p>
                  {r.sub ? <p className="text-[12.5px] text-ink2 tabular-nums">{r.sub}</p> : null}
                  {r.badge || r.gone ? (
                    <span className="flex flex-wrap gap-1.5">
                      {r.badge ? (
                        <Badge tone={r.badge.tone}>
                          {r.badge.half ? <PartialMark className="mr-1" /> : null}
                          {r.badge.text}
                        </Badge>
                      ) : null}
                      {r.gone ? <Badge tone="neutral">{COPY.sheetGone}</Badge> : null}
                    </span>
                  ) : null}
                  {r.link ? (
                    <Link href={r.link.href} className="inline-flex min-h-11 items-center self-start text-[13px] font-semibold underline underline-offset-[3px]">
                      {r.link.label}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {v.goneNote ? <p className="mt-2 text-[12px] text-ink2 break-keep">{COPY.sheetGoneNote}</p> : null}
          {v.frozenNote ? <p className="mt-2 text-[12px] text-ink2 break-keep">{COPY.sheetFrozen}</p> : null}
          {v.missedNote ? <p className="mt-2.5 text-[13px] text-ink2 break-keep">{COPY.sheetMissedNote}</p> : null}
          {v.todayCta ? (
            <Link href={TODAY_HREF} className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-on-accent">
              {COPY.goToday}
            </Link>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[13px] tabular-nums">
              {day.dayIndex}일째 / {detail.lengthDays}일
            </p>
            <div className="flex flex-none items-center">
              <button
                type="button"
                aria-label="전날"
                aria-disabled={!prev || undefined}
                onClick={() => (prev ? onStep(prev.date) : onBlocked(COPY.firstDay))}
                className="grid h-11 w-11 place-items-center rounded-xl text-ink aria-disabled:text-ink3"
              >
                <IconLeft />
              </button>
              <button
                type="button"
                aria-label="다음 날"
                aria-disabled={!next || undefined}
                onClick={() => (next ? onStep(next.date) : onBlocked(COPY.lastDay))}
                className="grid h-11 w-11 place-items-center rounded-xl text-ink aria-disabled:text-ink3"
              >
                <IconRight />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}

export type EndState = 'idle' | 'busy' | 'fail'

export function EndChallengeSheet({
  detail,
  open,
  state,
  onConfirm,
  onCancel,
}: {
  detail: ChallengeDetail
  open: boolean
  state: EndState
  onConfirm: () => void
  onCancel: () => void
}) {
  const v = endSheetView(detail)
  const busy = state === 'busy'
  return (
    <Sheet open={open} title={COPY.endTitle} onClose={onCancel} dismissible={!busy}>
      <div className="pb-2">
        <p className="text-[15px] break-keep [overflow-wrap:anywhere]">{v.intro}</p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[13px] break-keep">
          {v.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {state === 'fail' ? (
          <p role="alert" className="mt-2.5 text-[12.5px] text-bad break-keep">
            {COPY.endFail}
          </p>
        ) : null}
        <BtnRow>
          <Btn variant="danger" aria-busy={busy || undefined} onClick={() => !busy && onConfirm()}>
            {busy ? (
              <>
                <Spinner />
                {COPY.endBusy}
              </>
            ) : (
              COPY.endBtn
            )}
          </Btn>
          <Btn variant="ghost" className={BLOCKED_FACE} aria-disabled={busy || undefined} onClick={() => !busy && onCancel()}>
            {COPY.keepGoing}
          </Btn>
        </BtnRow>
      </div>
    </Sheet>
  )
}
