'use client'

/**
 * 챌린지 상세 조각(가이드 §3-4a·§3-4b) — 날짜 띠(roving tabindex, 달력과 같은 방향키) · 문제 점수 추이 표 · 주제 표현 진행.
 * 점수는 "문제 n/5" 하나로만 쓴다(점수 0~100·평균 표기 없음).
 */
import { useRef, useState } from 'react'
import { arrowDelta } from '@/components/plan/logic'
import type { ChallengeDailyGoal, ChallengeDay, ChallengeTopicProgress, ChallengeTotals } from '@/types/challenge'
import { COPY, DAY_VIEW, STRIP_LEGEND } from './challengeCopy'
import { scoreRows, stripCellAria, stripCellIsToday, stripDateText, stripFocusDate, stripLegend } from './logic'
import { DayGlyph, InfoBox, PartialMark } from './parts'

/** `todayIndex` = 오늘의 일 번호(진행 중만, 끝난 챌린지는 null) — 초점 시작점·오늘 테두리. */
export function DayStrip({
  days,
  lengthDays,
  todayIndex = null,
  onOpen,
}: {
  days: ChallengeDay[]
  lengthDays: number
  todayIndex?: number | null
  onOpen: (date: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [roving, setRoving] = useState(() => stripFocusDate(days, todayIndex))
  const index = new Map(days.map((d, i) => [d.date, i]))
  const move = (from: string, key: string): boolean => {
    const delta = arrowDelta(key)
    if (delta === null) return false
    const i = (index.get(from) ?? 0) + delta
    const target = days[i]
    if (target) ref.current?.querySelector<HTMLElement>(`[data-strip="${target.date}"]`)?.focus()
    return true
  }
  return (
    <>
      <div ref={ref} role="group" aria-label="날짜별 결과" className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const v = DAY_VIEW[d.state]
          return (
            <button
              key={d.date}
              type="button"
              data-strip={d.date}
              tabIndex={d.date === roving ? 0 : -1}
              aria-label={stripCellAria(d, todayIndex)}
              aria-haspopup="dialog"
              onFocus={() => setRoving(d.date)}
              onKeyDown={(e) => {
                if (move(d.date, e.key)) e.preventDefault()
              }}
              onClick={() => onOpen(d.date)}
              className={`relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-[3px] rounded-[10px] border before:absolute before:inset-y-0 before:-inset-x-[2px] before:content-[''] ${
                stripCellIsToday(d, todayIndex) ? 'border-accent' : 'border-line'
              } ${d.state === 'UPCOMING' || d.state === 'STOPPED' ? 'bg-surface2' : 'bg-surface'}`}
            >
              <span aria-hidden="true" className="text-[12px] leading-4 text-ink2 tabular-nums">
                {stripDateText(d.date, lengthDays)}
              </span>
              <DayGlyph state={d.state} />
              <span aria-hidden="true" className="text-[12px] leading-4">
                {v.word}
              </span>
            </button>
          )
        })}
      </div>
      <ul aria-label="날짜 표시 설명" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink2">
        {stripLegend(days).map((s) => (
          <li key={s} className="whitespace-nowrap">
            {DAY_VIEW[s].half ? <PartialMark className="mr-[0.3em] align-[-0.125em]" /> : null}
            {STRIP_LEGEND[s]}
          </li>
        ))}
      </ul>
    </>
  )
}

function Dots({ correct, total }: { correct: number; total: number }) {
  return (
    <span aria-hidden="true" className="mt-1 flex gap-[3px]">
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <span key={i} className={`block h-1.5 w-1.5 rounded-full ${i < correct ? 'bg-good' : 'bg-surface2'}`} />
      ))}
    </span>
  )
}

export function ScoreTable({ days, goal, todayIndex = null }: { days: ChallengeDay[]; goal: ChallengeDailyGoal; todayIndex?: number | null }) {
  const rows = scoreRows(days, goal, todayIndex)
  if (!rows.length) return null
  const recent = rows.slice(-7)
  const older = rows.slice(0, Math.max(0, rows.length - 7))
  const render = (list: typeof rows) =>
    list.map((r) => (
      <tr key={r.date} className="border-t border-line align-top">
        <th scope="row" className="py-2 pr-2 text-left font-semibold">
          <span className="block text-[13px]">{r.label}</span>
          <span className="block text-[12px] font-normal text-ink2 tabular-nums">{r.dateText}</span>
        </th>
        {r.lesson ? (
          <td className="py-2 pr-2 text-[13px] tabular-nums">
            {r.lesson.text}
            {r.lesson.dots ? <Dots correct={r.lesson.dots.correct} total={r.lesson.dots.total} /> : null}
          </td>
        ) : null}
        {r.words !== null ? <td className="py-2 text-[13px] tabular-nums break-keep">{r.words}</td> : null}
      </tr>
    ))
  const head = (
    <thead>
      <tr className="text-left text-[12px] text-ink2">
        <th scope="col" className="pb-1 font-normal">
          날
        </th>
        {goal.lesson ? (
          <th scope="col" className="pb-1 font-normal">
            수업 문제
          </th>
        ) : null}
        {goal.words ? (
          <th scope="col" className="pb-1 font-normal">
            단어
          </th>
        ) : null}
      </tr>
    </thead>
  )
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-0 border-collapse">
        <caption className="sr-only">날짜별 수업 문제와 단어 맞힘</caption>
        {head}
        <tbody>{render(recent)}</tbody>
      </table>
      {older.length ? (
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-semibold">지난 날 모두 보기({older.length}일)</summary>
          <table className="w-full border-collapse">
            <caption className="sr-only">지난 날 수업 문제와 단어 맞힘</caption>
            {head}
            <tbody>{render(older)}</tbody>
          </table>
        </details>
      ) : null}
    </div>
  )
}

function Bar({ name, value, total, tone }: { name: string; value: number; total: number; tone: 'good' | 'ink2' }) {
  const w = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between text-[13px]">
        <span>{name}</span>
        <span className="tabular-nums">
          {value} / {total}
        </span>
      </div>
      <span aria-hidden="true" className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface2">
        <span className={`block h-full rounded-full ${tone === 'good' ? 'bg-good' : 'bg-ink2'}`} style={{ width: `${w}%` }} />
      </span>
    </div>
  )
}

export function TopicProgressBlock({ p, totals }: { p: ChallengeTopicProgress; totals: ChallengeTotals }) {
  const fresh = p.chunkStudied === 0 && p.aiWordTotal === 0
  const before = p.lessonsDone - totals.lessonsDone
  return (
    <div>
      <p className="text-[12px] text-ink2 break-keep">{COPY.topicNote}</p>
      {fresh ? (
        <InfoBox className="mt-2">기본 표현 {p.chunkTotal}개 · 오늘부터 푼 만큼 여기 쌓여요. 챌린지 전에 이 주제로 공부한 것도 함께 세요.</InfoBox>
      ) : (
        <>
          <Bar name="익힘" value={p.chunkMastered} total={p.chunkTotal} tone="good" />
          <Bar name="공부" value={p.chunkStudied} total={p.chunkTotal} tone="ink2" />
        </>
      )}
      <p className="mt-2 text-[12.5px] text-ink2 break-keep">
        수업에서 더 만난 표현 +{p.lessonExprCount} · 이 주제로 끝낸 수업 {p.lessonsDone}개{before > 0 ? `(챌린지 전 ${before}개 포함)` : ''}
      </p>
      {p.aiWordTotal > 0 ? (
        <div className="mt-2">
          <p className="text-[14px] tabular-nums">
            새 단어 {p.aiWordTotal}개 — 공부 {p.aiWordStudied} · 익힘 {p.aiWordMastered}
          </p>
          <p className="text-[12px] text-ink2 break-keep">{COPY.aiWordHelp}</p>
        </div>
      ) : null}
    </div>
  )
}
