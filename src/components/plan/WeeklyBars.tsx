'use client'

/**
 * 성장 탭 «주마다 공부량»(screens.md §36-3·36-11·36-12 — 데모 `bars()`): 지표 칩 · 막대 그림(읽지 않음) · 읽기 줄 · ‹ › · [표로 보기].
 *
 * - 읽기 줄 `role=status` 는 이 부품이 마운트된 동안 **같은 요소 하나**다 — 지표·주·기간이 바뀌어도 글만 바꾼다(데모의 «다시 그릴 때 알림 영역도 새로 생김» 한계를 고침).
 *   보이는 글은 짧은 꼴(«(일)~(토)»), 낭독은 «일요일부터 … 토요일까지».
 * - 고른 주: 기본 = 이번 주(마지막). 기간이 바뀌면 다시 이번 주(4→8→4 처럼 돌아와도 — 36-6 D). 지표 칩은 그대로 둔다.
 *   ‹ › 는 기간 안에서만(끝이면 `aria-disabled` — 초점은 받고 눌러도 아무 일 없음).
 * - 막대 그림 너비는 카드 안 너비를 재서 그린다(재기 전엔 같은 높이 빈 상자). 그림을 누르면 그 주를 고른다(키보드는 ‹ ›).
 */
import { useState } from 'react'
import type { GrowthWeek } from '@/types/plan'
import { GROWTH, METRICS, type MetricKey, type Rich } from './growthCopy'
import {
  barLabelShown,
  barPick,
  barScale,
  GROWTH_TONE,
  leadingBefore,
  metricOf,
  metricValue,
  readLineOf,
  selectedWeekOf,
  slOf,
  stepWeek,
  syncWeekPick,
  weekKeyOf,
  type WeekPick,
} from './growthLogic'
import { useMeasuredWidth } from './GrowthCharts'
import { GrowthCard, IconLeft, IconRight, NUM, RichText, TableToggle, TD, TH } from './parts'

export const BARS = { H: 132, padL: 26, padB: 20, padT: 18 } as const

export const CHIP_BASE =
  "relative h-9 flex-none whitespace-nowrap rounded-full border px-3 text-[13.5px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
export const CHIP_ON = 'border-transparent bg-surface font-semibold text-ink shadow-[inset_0_0_0_2px_var(--color-accent)]'
export const CHIP_OFF = 'border-line bg-surface text-ink'

export default function WeeklyBars({ weeks, today }: { weeks: GrowthWeek[]; today: string }) {
  const [metric, setMetric] = useState<MetricKey>('days')
  const key = weekKeyOf(weeks)
  const [picked, setPicked] = useState<WeekPick>({ key, j: null })
  const [boxRef, W] = useMeasuredWidth()
  // 렌더 중 상태 맞추기 — 보이는 기간이 바뀐 그 렌더부터 이번 주(effect 로 한 번 더 그리지 않는다).
  const synced = syncWeekPick(picked, key)
  if (synced !== picked) setPicked(synced)
  const n = weeks.length
  const sel = selectedWeekOf(synced, n)
  const m = metricOf(metric)
  const vals = weeks.map((w) => metricValue(w, metric))
  const note = GROWTH.metricNote[metric]
  const read = n > 0 ? readLineOf(weeks[sel].weekStart, sel === n - 1, today, metric, vals[sel]) : null
  const pick = (j: number) => setPicked({ key, j })

  return (
    <GrowthCard title={GROWTH.barsTitle}>
      <div role="radiogroup" aria-label={GROWTH.metricAria} className="no-scrollbar -mt-1 flex gap-2 overflow-x-auto py-1">
        {METRICS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="radio"
            aria-checked={x.key === metric}
            onClick={() => setMetric(x.key)}
            className={`${CHIP_BASE} ${x.key === metric ? CHIP_ON : CHIP_OFF}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div ref={boxRef} className="mt-2.5 min-w-0" style={{ height: BARS.H }}>
        {W && n > 0 ? <BarsSvg W={W} vals={vals} sel={sel} weeks={weeks} onPick={pick} /> : null}
      </div>
      <WeekNav sel={sel} n={n} read={read} onPick={pick} />
      {note ? <p className="mt-1 text-[12px] text-ink2 break-keep [overflow-wrap:anywhere]">{note}</p> : null}
      <TableToggle label={GROWTH.barsTable}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">{GROWTH.barsCaption(m.label)}</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  {GROWTH.barsColWeek}
                </th>
                <th scope="col" className={`${TH} text-right!`}>
                  {m.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {weeks
                .map((w, j) => ({ w, j }))
                .reverse()
                .map(({ w, j }) => (
                  <tr key={w.weekStart}>
                    <td className={TD}>{GROWTH.weekCell(slOf(w.weekStart), j === n - 1)}</td>
                    <td className={`${TD} ${NUM}`}>{vals[j] === null ? GROWTH.barBefore : `${vals[j]}${m.unit}`}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </TableToggle>
    </GrowthCard>
  )
}

/**
 * ‹ 읽기 줄 › — 읽기 줄 `role=status` 는 늘 같은 요소. 끝 칸 단추는 `aria-disabled`(초점은 받음)이고 눌러도 `onPick` 을 부르지 않는다.
 * 훅이 없는 부품이라 시험에서 함수로 불러 단추의 `onClick` 을 직접 누른다.
 */
export function WeekNav({ sel, n, read, onPick }: { sel: number; n: number; read: { visible: Rich; sr: string } | null; onPick: (j: number) => void }) {
  const prev = stepWeek(sel, -1, n)
  const next = stepWeek(sel, 1, n)
  return (
    <div className="mt-2 flex min-w-0 items-center gap-1">
      <button
        type="button"
        aria-label={GROWTH.prevWeek}
        aria-disabled={prev === null || undefined}
        onClick={() => {
          if (prev !== null) onPick(prev)
        }}
        className={`grid h-11 w-11 flex-none place-items-center rounded-full ${prev === null ? 'cursor-default text-ink3' : 'text-ink'}`}
      >
        <IconLeft />
      </button>
      <p role="status" aria-live="polite" className="min-w-0 flex-1 text-center text-[13px] break-keep [overflow-wrap:anywhere]">
        {read ? (
          <>
            <span aria-hidden="true">
              <RichText parts={read.visible} boldClass="font-[650] whitespace-nowrap" />
            </span>
            <span className="sr-only">{read.sr}</span>
          </>
        ) : null}
      </p>
      <button
        type="button"
        aria-label={GROWTH.nextWeek}
        aria-disabled={next === null || undefined}
        onClick={() => {
          if (next !== null) onPick(next)
        }}
        className={`grid h-11 w-11 flex-none place-items-center rounded-full ${next === null ? 'cursor-default text-ink3' : 'text-ink'}`}
      >
        <IconRight />
      </button>
    </div>
  )
}

/** 막대 그림(읽지 않음) — 시험에서 너비를 직접 줘서 그린다. */
export function BarsSvg({
  W,
  vals,
  sel,
  weeks,
  onPick,
}: {
  W: number
  vals: readonly (number | null)[]
  sel: number
  weeks: readonly GrowthWeek[]
  onPick?: (j: number) => void
}) {
  const { H, padL, padB, padT } = BARS
  const n = vals.length
  const slot = (W - padL) / n
  const bw = Math.min(24, slot * 0.62)
  const { step, max } = barScale(vals)
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max)
  const pre = leadingBefore(vals)
  const ticks: number[] = []
  for (let t = 0; t <= max; t += step) ticks.push(t)
  const inner = H - padT - padB
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="block"
      style={{ touchAction: 'manipulation' }}
      onClick={(e) => {
        if (!onPick) return
        const r = e.currentTarget.getBoundingClientRect()
        const j = barPick(((e.clientX - r.left) * W) / (r.width || W), padL, slot, n)
        if (j !== null) onPick(j)
      }}
    >
      {pre > 0 ? (
        <>
          <rect x={padL} y={padT} width={slot * pre} height={inner} rx={6} fill="var(--color-surface2)" />
          {slot * pre > 46 ? (
            <text x={padL + (slot * pre) / 2} y={padT + inner / 2 + 4} textAnchor="middle" fill="var(--color-ink2)" style={{ fontSize: 11 }}>
              {GROWTH.barBefore}
            </text>
          ) : null}
        </>
      ) : null}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end" fill="var(--color-ink2)" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
            {t}
          </text>
        </g>
      ))}
      {vals.map((v, j) => {
        const cx = padL + slot * j + slot / 2
        const on = j === sel
        const last = j === n - 1
        const endAlign = last && cx + 24 > W
        let bar = null
        if (v !== null && v > 0) {
          const top = y(v)
          const base = y(0)
          const x0 = cx - bw / 2
          const r = Math.min(4, base - top, bw / 2)
          bar = (
            <path
              d={`M${x0} ${base}V${top + r}Q${x0} ${top} ${x0 + r} ${top}H${x0 + bw - r}Q${x0 + bw} ${top} ${x0 + bw} ${top + r}V${base}Z`}
              fill={on ? GROWTH_TONE.c3 : GROWTH_TONE.c2}
            />
          )
        }
        return (
          <g key={weeks[j]?.weekStart ?? j}>
            {bar}
            {on && v !== null ? (
              <text x={cx} y={y(v) - 5} textAnchor="middle" fontWeight={700} fill="var(--color-ink)" style={{ fontSize: 12 }}>
                {v}
              </text>
            ) : null}
            {barLabelShown(j, n) ? (
              <text
                x={endAlign ? W - 1 : cx}
                y={H - 5}
                textAnchor={endAlign ? 'end' : 'middle'}
                fill={on ? 'var(--color-ink)' : 'var(--color-ink2)'}
                fontWeight={on ? 700 : undefined}
                style={{ fontSize: 11 }}
              >
                {last ? GROWTH.barThisWeek : slOf(weeks[j]?.weekStart ?? '')}
              </text>
            ) : null}
          </g>
        )
      })}
      <line x1={padL} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-ink2)" strokeWidth={1} />
    </svg>
  )
}
