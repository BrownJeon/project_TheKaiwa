'use client'

/**
 * 계획표 맨 위 챌린지 현황 카드(S1·S2, 가이드 §3-1) — 불러오는 중·오류·진행 중·내일 시작·최근 끝남·없음 6변형.
 * #158 실패는 카드 안에서만 알린다(달력·하루 시트는 영향 없음). 할 일 줄은 오늘 탭으로 가는 줄이고 [오늘 수업 만들기] 는 여기 없다.
 * 하루 시트의 "챌린지 n일째" 줄(`ChallengeDayLine`, 가이드 §3-2)도 여기 둔다.
 */
import Link from 'next/link'
import { useId } from 'react'
import { Badge } from '@/components/common/ui'
import type { ChallengeTodayResponse, DayChallenge } from '@/types/challenge'
import { COPY } from './challengeCopy'
import {
  cardHead,
  dayLineView,
  dayWord,
  endedCardLine,
  goalTasks,
  isLastDay,
  md,
  nearestCount,
  planCardKind,
  planStatTiles,
  taskCounts,
  taskRowView,
  type LoadStatus,
} from './logic'
import { BtnLink, DayGlyph, ErrorBox, StatTiles, TaskRows, ULink } from './parts'

const CARD = 'min-w-0 rounded-[14px] border bg-surface p-3.5'

export default function ChallengePlanCard({
  status,
  data,
  dailyWordCount,
  onRetry,
}: {
  status: LoadStatus
  data: ChallengeTodayResponse | null
  dailyWordCount: number
  onRetry: () => void
}) {
  const titleId = useId()
  const kind = planCardKind(status, data)

  if (kind === 'loading')
    return (
      <div className="mt-3">
        <p role="status" className="sr-only">
          {COPY.cardLoading}
        </p>
        <span aria-hidden="true" className="block h-[172px] rounded-[14px] bg-surface2" />
      </div>
    )

  if (kind === 'error')
    return (
      <section aria-label="챌린지" className={`mt-3 ${CARD} border-line`}>
        <ErrorBox title={COPY.cardErrorTitle} body={COPY.cardErrorBody} onRetry={onRetry} />
      </section>
    )

  if (kind === 'none') {
    const n = nearestCount(dailyWordCount) ?? 10
    return (
      <section aria-labelledby={titleId} className={`mt-3 ${CARD} border-line`}>
        <p className="text-[12.5px] text-ink2">{COPY.startHead}</p>
        <h2 id={titleId} className="mt-0.5 text-[17px] font-bold">
          {COPY.startTitle}
        </h2>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{COPY.startBody}</p>
        <ul aria-label="하루 목표" className="mt-2 flex flex-wrap gap-1.5">
          <li>
            <Badge tone="neutral">하루 목표</Badge>
          </li>
          <li>
            <Badge tone="neutral">오늘의 단어 {n}장</Badge>
          </li>
          <li>
            <Badge tone="neutral">오늘의 회화 1개</Badge>
          </li>
        </ul>
        <div className="mt-3 flex">
          <BtnLink href="/plan/challenge/new">{COPY.startCta}</BtnLink>
        </div>
        <ULink href="/plan/challenges" className="mt-1">
          {COPY.historyLink}
        </ULink>
      </section>
    )
  }

  if (kind === 'ended' && data?.recentlyEnded) {
    const e = data.recentlyEnded
    return (
      <section aria-labelledby={titleId} className={`mt-3 ${CARD} border-line`}>
        <p className="text-[12.5px] text-ink2">챌린지 · {e.status === 'ENDED' ? '그만둠' : '끝남'}</p>
        <h2 id={titleId} className="mt-0.5 text-[17px] font-bold [overflow-wrap:anywhere]">
          {e.title}
        </h2>
        <p className="mt-1 text-[13px] text-ink break-keep">{endedCardLine(e)}</p>
        <p className="mt-0.5 text-[12px] text-ink2">{COPY.endedKeep}</p>
        <div className="mt-3 flex gap-2">
          <BtnLink href={`/plan/challenge/new?again=${encodeURIComponent(e.id)}`}>{COPY.retryChallenge}</BtnLink>
          <BtnLink href={`/plan/challenge/${encodeURIComponent(e.id)}`} variant="ghost">
            {COPY.seeResult}
          </BtnLink>
        </div>
        <ULink href="/plan/challenge/new" className="mt-1">
          {COPY.otherTopic}
        </ULink>
      </section>
    )
  }

  const c = data?.challenge
  if (!c) return null
  const tomorrow = kind === 'tomorrow'
  const tasks = tomorrow ? goalTasks(c.dailyGoal) : (data?.today?.tasks ?? [])
  const rows = tasks.map((t) => taskRowView(t, { later: tomorrow }))
  const { done, total } = taskCounts(tasks)
  const met = !tomorrow && c.stats.todayMet
  const last = isLastDay(c)
  const short = tasks.some((t) => t.kind === 'WORDS' && t.state === 'SHORT')
  return (
    <section aria-labelledby={titleId} className={`mt-3 ${CARD} border-accent`}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 pt-1 text-[12.5px] text-ink2 break-keep">{tomorrow ? COPY.tomorrowHead : cardHead(c)}</p>
        <Link
          href={`/plan/challenge/${encodeURIComponent(c.id)}`}
          aria-label={`${c.title} 자세히`}
          className="-mr-1 -mt-1.5 inline-flex min-h-11 min-w-11 flex-none items-center justify-center px-1 text-[13px] font-semibold text-ink underline underline-offset-[3px]"
        >
          {COPY.detailLink}
        </Link>
      </div>
      <h2 id={titleId} className="text-[17px] font-bold [overflow-wrap:anywhere]">
        {c.title}
      </h2>
      <p className="text-[12.5px] text-ink2">
        {c.level} · {md(c.startDate)} ~ {md(c.endDate)}
      </p>
      {met ? (
        <div className="mt-2.5 flex items-start gap-2.5 rounded-xl bg-surface2 px-3 py-2.5">
          <DayGlyph state="MET" size="lg" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">{COPY.metTitle}</p>
            <p className="text-[12.5px] text-ink2 break-keep">{last ? COPY.metBodyLast : COPY.metBody(c.stats.streak ?? 0)}</p>
          </div>
        </div>
      ) : null}
      <div className="mt-2.5 flex min-w-0 items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{tomorrow ? COPY.firstDayTasks : COPY.todayTasks}</h3>
        {tomorrow ? null : (
          <span className="min-w-0 text-right text-[13px] text-ink2 break-keep">
            {done} / {total} · {dayWord(tasks, met)}
          </span>
        )}
      </div>
      <TaskRows rows={rows} label={tomorrow ? COPY.firstDayTasks : COPY.todayTasks} />
      {short && !met ? <p className="mt-1 text-[12.5px] text-ink2 break-keep">{COPY.shortMemo}</p> : null}
      {last && !met ? <p className="mt-1 text-[12.5px] text-ink2 break-keep">{COPY.lastDayMemo}</p> : null}
      <div className="mt-2.5">
        <StatTiles tiles={planStatTiles(c.stats)} label="챌린지 수행" />
      </div>
    </section>
  )
}

/** 달력 하루 시트의 챌린지 한 줄(가이드 §3-2) — 챌린지 상세의 그날 시트로 간다. */
export function ChallengeDayLine({ challenge, date, need, onOpen }: { challenge: DayChallenge; date: string; need: number | null; onOpen: () => void }) {
  const v = dayLineView(challenge, need)
  return (
    <Link
      href={`/plan/challenge/${encodeURIComponent(challenge.challengeId)}?day=${encodeURIComponent(date)}`}
      aria-label={v.aria}
      onClick={onOpen}
      className="mt-2 flex min-h-14 min-w-0 items-center gap-2.5 rounded-xl bg-surface2 px-3 py-2.5"
    >
      <DayGlyph state={challenge.state} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-semibold break-keep">{v.title}</span>
        <span className="text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{v.desc}</span>
      </span>
      <span aria-hidden="true" className="flex-none text-[13px] font-semibold">
        {COPY.dayLineGo}
      </span>
    </Link>
  )
}
