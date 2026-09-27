'use client'

/**
 * 최근 30일 단어 기록(screens.md §5-2 A VocabStatsCard·WeekStrip). #54 는 `StatsSnapshot` 만 읽으므로 단어를 지워도 값이 그대로다.
 * 차트가 아니라 요약 숫자다(그래프는 성장기록에서). 색만으로 구분하지 않고 ✓·· 글자를 함께 쓴다.
 */
import { Card, Section, SectionHeader } from '@/components/common/ui'
import type { VocabStats } from '@/types/vocab'
import { accuracy, formatMonthDay, weekDays } from './format'

function WeekStrip({ daily, today }: { daily: VocabStats['daily']; today: string }) {
  const byDate = new Map(daily.map((d) => [d.date, d]))
  const days = weekDays(today)
  if (days.length === 0) return null
  return (
    <ol className="flex flex-none gap-1" aria-label="최근 7일">
      {days.map((d) => {
        const hit = byDate.get(d.date)
        const label = `${formatMonthDay(d.date)} ${d.weekday}요일, ${hit ? `맞힘 ${hit.correct} 틀림 ${hit.wrong}` : '안 풀었어요'}`
        return (
          <li key={d.date} aria-label={label} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className="text-[12px] text-ink2">
              {d.weekday}
            </span>
            <span
              aria-hidden="true"
              className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold ${hit ? 'bg-good-soft text-good' : 'bg-surface2 text-ink2'} ${
                d.isToday ? 'ring-1 ring-accent' : ''
              }`}
            >
              {hit ? '✓' : '·'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function VocabStatsCard({ stats, today }: { stats: VocabStats; today: string }) {
  const top = [...stats.byCount].sort((a, b) => b.sessions - a.sessions).slice(0, 3)
  return (
    <Section>
      <SectionHeader title="최근 30일" />
      <Card flat>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {stats.streakDays > 0 ? (
              <>
                <p className="text-[22px] font-semibold tabular-nums">{stats.streakDays}일 연속</p>
                <p className="text-[12px] text-ink2 break-keep">단어 세트를 끝낸 날이 이어졌어요</p>
              </>
            ) : (
              <p className="text-[15px] break-keep">오늘 한 세트 풀면 연속 기록이 시작돼요</p>
            )}
          </div>
          <WeekStrip daily={stats.daily} today={today} />
        </div>
        {top.length > 0 ? (
          <ul className="mt-2.5 flex flex-col gap-0.5">
            {top.map((b) => {
              const p = accuracy(b.correct, b.wrong)
              return (
                <li key={b.cardCount} className="text-[13px] text-ink2 tabular-nums break-keep">
                  {b.cardCount}장 세트 {b.sessions}번 · 맞힘 {b.correct} · 틀림 {b.wrong} · {p === null ? '—' : `${p}%`}
                </li>
              )
            })}
          </ul>
        ) : null}
      </Card>
    </Section>
  )
}
