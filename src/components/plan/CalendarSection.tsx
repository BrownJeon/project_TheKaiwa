'use client'

/**
 * 계획표 탭 위쪽 — 월 이동 · 이 달 요약 3칸 · 월요일 시작 7열 달력 · 표시 설명(데모 `calSection`).
 *
 * 날짜 칸은 한 번의 Tab 으로 들어가고 방향키로 옮겨 다닌다(roving tabindex). 칸은 360 폭에서 약 43px 이라 버튼 좌우에
 * 2px 씩(칸 사이 4px 의 절반) 누를 자리를 넓혀 44px 을 넘긴다 — 이웃 칸과 겹치지 않는다.
 */
import Link from 'next/link'
import { useRef, useState } from 'react'
import { addDays } from '@/modules/infra/dates'
import type { CalendarDay, CalendarSummary } from '@/types/plan'
import { COPY } from '@/components/challenge/challengeCopy'
import { AttendDot, Chip, IconLeft, IconRight } from './parts'
import {
  arrowDelta,
  cellView,
  focusDate,
  LEGEND_TYPES,
  monthGrid,
  monthLabel,
  monthNote,
  monthWord,
  summaryTiles,
  TYPE_META,
  WEEK_HEADERS,
} from './logic'
import type { LoadStatus } from './usePlanData'

export function MonthNav({
  month,
  isCurrent,
  titleId,
  onPrev,
  onNext,
  onToday,
  onBlocked,
}: {
  month: string
  isCurrent: boolean
  titleId: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onBlocked: (why: string) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <h2 id={titleId} aria-live="polite" className="min-w-0 flex-1 truncate text-[18px] font-bold tabular-nums">
        {monthLabel(month)}
      </h2>
      <button
        type="button"
        aria-disabled={isCurrent || undefined}
        onClick={() => (isCurrent ? onBlocked('지금 이번 달을 보고 있어요') : onToday())}
        className="relative mr-0.5 h-8 flex-none rounded-full border border-line bg-surface px-3 text-[13px] font-semibold before:absolute before:-inset-x-0.5 before:-inset-y-1.5 before:content-[''] aria-disabled:text-ink3"
      >
        오늘
      </button>
      <button type="button" aria-label="이전 달" onClick={onPrev} className="grid h-11 w-11 flex-none place-items-center rounded-xl text-ink">
        <IconLeft />
      </button>
      <button
        type="button"
        aria-label="다음 달"
        aria-disabled={isCurrent || undefined}
        onClick={() => (isCurrent ? onBlocked('다음 달은 아직 오지 않았어요') : onNext())}
        className="grid h-11 w-11 flex-none place-items-center rounded-xl text-ink aria-disabled:text-ink3"
      >
        <IconRight />
      </button>
    </div>
  )
}

/** `attendHint` = 진행 중 챌린지가 있고 이번 달 — 셋째 칸 아래 "앱을 연 날"(챌린지 "수행 연속"과 이름으로 구분, task-043). */
export function SummaryRow({
  status,
  summary,
  month,
  today,
  attendHint = false,
}: {
  status: LoadStatus
  summary: CalendarSummary | null
  month: string
  today: string
  attendHint?: boolean
}) {
  const ml = monthWord(month, today)
  if (status === 'loading') {
    return (
      <div aria-hidden="true" className="mt-1.5 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="min-w-0 rounded-xl border border-line bg-surface px-1.5 py-2 text-center">
            <span className="mx-auto mb-0.5 mt-0.5 block h-[22px] w-11 rounded-md bg-surface2" />
            <span className="block text-[12px]">&nbsp;</span>
          </div>
        ))}
      </div>
    )
  }
  const tiles = summaryTiles(status === 'ready' ? summary : null, month, today)
  return (
    <div role="group" aria-label={`${ml} 요약`} className="mt-1.5 grid grid-cols-3 gap-2">
      {tiles.map((t, i) => (
        <div key={t.label} className="min-w-0 rounded-xl border border-line bg-surface px-1.5 py-2 text-center">
          <b className="block text-[20px] font-bold leading-[1.3] tabular-nums">{t.value}</b>
          <span className="block truncate text-[12px] text-ink2">{t.label}</span>
          {attendHint && i === 2 ? <span className="block truncate text-[12px] text-ink2">{COPY.attendHint}</span> : null}
        </div>
      ))}
    </div>
  )
}

const CELL_BASE =
  "relative flex h-[66px] min-w-0 flex-col items-center gap-[3px] rounded-[10px] border pt-1.5 before:absolute before:inset-y-0 before:-inset-x-[2px] before:content-['']"

export function CalendarGrid({
  month,
  today,
  days,
  loading,
  openDay,
  onOpen,
}: {
  month: string
  today: string
  days: CalendarDay[]
  loading: boolean
  openDay: string | null
  onOpen: (date: string) => void
}) {
  const grid = monthGrid(month)
  const byDate = new Map(days.map((d) => [d.date, d]))
  const gridRef = useRef<HTMLDivElement>(null)
  // 달이 바뀌면 부모가 `key` 로 새로 만든다 — 초점 시작점은 그때 한 번 정한다.
  const [roving, setRoving] = useState(() => focusDate(month, today, openDay))

  const move = (from: string, key: string): boolean => {
    const delta = arrowDelta(key)
    if (delta === null) return false
    const target = addDays(from, delta)
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${target}"]`)
    if (el) el.focus()
    return true
  }

  return (
    <>
      <div aria-hidden="true" className="mt-3.5 grid grid-cols-7 gap-1">
        {WEEK_HEADERS.map((w) => (
          <span key={w} className="h-6 text-center text-[12px] leading-6 text-ink2">
            {w}
          </span>
        ))}
      </div>
      <div ref={gridRef} role="group" aria-label={`${monthLabel(month)} 달력`} aria-busy={loading || undefined} className="grid grid-cols-7 gap-1">
        {Array.from({ length: grid.leading }, (_, i) => (
          <span key={`b${i}`} aria-hidden="true" className="invisible h-[66px]" />
        ))}
        {grid.dates.map((date) => {
          const day = byDate.get(date)
          if (loading || !day) return <span key={date} aria-hidden="true" className="h-[66px] rounded-[10px] bg-surface2" />
          const v = cellView(day, today)
          // 오늘 = 주황 테두리 2px(테두리 1px + 안쪽 그림자 1px) — 공부한 날의 흰 바탕은 그대로 둔다.
          const border = v.isToday ? 'border-accent shadow-[inset_0_0_0_1px_var(--color-accent)]' : v.kind === 'study' ? 'border-line' : 'border-transparent'
          const tone = `${border} ${v.kind === 'study' ? 'bg-surface' : ''}`
          const num = v.kind === 'future' ? 'font-medium text-ink3' : v.kind === 'none' ? 'font-medium text-ink2' : 'font-semibold'
          const marks = v.marks.length ? (
            <span aria-hidden="true" className="flex w-[37px] flex-wrap justify-center gap-[3px]">
              {v.marks.map((m, i) => (
                <Chip key={i} mark={m} />
              ))}
            </span>
          ) : v.attendedDot ? (
            <AttendDot className="mt-[7px]" />
          ) : null
          const n = <span aria-hidden="true" className={`text-[13px] leading-4 tabular-nums ${num}`}>{Number(date.slice(8))}</span>
          const band = v.band ? <span aria-hidden="true" className="absolute inset-x-[5px] bottom-px h-[3px] rounded-[2px] bg-accent" /> : null
          if (!v.interactive) {
            return (
              <span key={date} className={`${CELL_BASE} ${tone}`}>
                {n}
                {band}
                <span className="sr-only">{v.label}</span>
              </span>
            )
          }
          return (
            <button
              key={date}
              type="button"
              data-cell={date}
              tabIndex={date === roving ? 0 : -1}
              aria-label={v.label}
              aria-haspopup="dialog"
              aria-current={v.isToday ? 'date' : undefined}
              onFocus={() => setRoving(date)}
              onKeyDown={(e) => {
                if (move(date, e.key)) e.preventDefault()
              }}
              onClick={() => onOpen(date)}
              className={`${CELL_BASE} ${tone} cursor-pointer`}
            >
              {n}
              {marks}
              {band}
            </button>
          )
        })}
      </div>
      {loading ? (
        <p role="status" className="sr-only">
          {monthLabel(month)} 달력을 불러오는 중…
        </p>
      ) : null}
    </>
  )
}

export function MonthNoteBlock({ days, month, today, dailyWordCount }: { days: CalendarDay[]; month: string; today: string; dailyWordCount: number }) {
  const note = monthNote(days, month, today)
  if (!note) return null
  if (note.kind === 'empty') return <p className="mt-3 rounded-xl bg-surface2 px-3.5 py-3 text-[13px] break-keep">{note.text}</p>
  return (
    <div className="mt-3 rounded-xl bg-surface2 px-3.5 py-3 text-[13px]">
      <p className="text-[15px] font-semibold break-keep">아직 이번 달 공부 기록이 없어요</p>
      <p className="mt-1 text-ink2 break-keep">공부 탭에서 단어 {dailyWordCount}장부터 시작해 보세요. 끝내면 여기 달력에 바로 표시돼요.</p>
      <Link href="/study/today" className="mt-2 inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold">
        공부 탭으로
      </Link>
    </div>
  )
}

export function CalendarError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mt-3 rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
      <p className="break-keep">
        <b className="font-bold">달력을 불러오지 못했어요.</b> 잠시 뒤 다시 시도해 주세요. 다른 달로는 그대로 옮겨 갈 수 있어요.
      </p>
      <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]">
        다시 시도
      </button>
    </div>
  )
}

/** `showChallenge` = 그 달에 챌린지 날이 있을 때만 챌린지 4항목을 끝에 더한다(없으면 지금 달력과 같다). */
export function CalendarLegend({ showChallenge = false }: { showChallenge?: boolean }) {
  return (
    <ul aria-label="달력 표시 설명" className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] text-ink2">
      {LEGEND_TYPES.map((t) => (
        <li key={t} className="inline-flex items-center gap-[5px] whitespace-nowrap">
          <Chip mark={{ kind: 'type', type: t }} />
          <span>{TYPE_META[t].label}</span>
        </li>
      ))}
      <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
        <Chip mark={{ kind: 'eval' }} />
        <span>AI 평가</span>
      </li>
      <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
        <Chip mark={{ kind: 'due' }} />
        <span>복습할 날</span>
      </li>
      <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
        <AttendDot />
        <span>출석만 한 날</span>
      </li>
      <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
        <span aria-hidden="true" className="block h-[17px] w-[17px] flex-none rounded-[5px] shadow-[inset_0_0_0_2px_var(--color-accent)]" />
        <span>오늘</span>
      </li>
      {showChallenge ? (
        <>
          <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <span aria-hidden="true" className="block h-[3px] w-[17px] flex-none rounded-[2px] bg-accent" />
            <span>{COPY.legendBand}</span>
          </li>
          <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <Chip mark={{ kind: 'ch', state: 'MET' }} />
            <span>{COPY.legendMet}</span>
          </li>
          <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <Chip mark={{ kind: 'ch', state: 'PARTIAL' }} />
            <span>{COPY.legendPartial}</span>
          </li>
          <li className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <Chip mark={{ kind: 'ch', state: 'MISSED' }} />
            <span>{COPY.legendMissed}</span>
          </li>
        </>
      ) : null}
    </ul>
  )
}
