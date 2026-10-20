/**
 * 성장 탭 «체크내역»(screens.md §36-3·36-11 — 데모 `strip()`): 주 = 열, 요일 = 행(일요일 시작, 일~토 일곱 줄).
 * 그림은 읽지 않는다(`aria-hidden`) — 숨김 요약 한 문장 + [주별로 보기] 표가 같은 내용을 글로 준다.
 * 칸 너비는 카드 안 너비에 맞춰 12~56px(4주 = 넓은 직사각형, 높이는 22px 까지). 띠 위 라벨: 4주 날짜 · 12주 달 · 8주는 카드 안 너비 324px 이상이면 날짜.
 */
import { Fragment, type CSSProperties } from 'react'
import type { GrowthResponse } from '@/types/plan'
import { GROWTH } from './growthCopy'
import { GROWTH_TONE, stripColumnsOf, stripCounts, stripRowsOf, type CellState } from './growthLogic'
import { GrowthCard, TableToggle, TD, TH } from './parts'

const WD = ['일', '월', '화', '수', '목', '금', '토'] as const

const CELL_STYLE: Record<CellState, CSSProperties> = {
  k1: { background: GROWTH_TONE.c1 },
  k2: { background: GROWTH_TONE.c2 },
  k3: { background: GROWTH_TONE.c3 },
  att: { background: 'var(--color-surface)', boxShadow: 'inset 0 0 0 1.5px var(--color-ink2)' },
  none: { background: GROWTH_TONE.empty },
  pre: { background: 'transparent' },
  future: { background: 'transparent' },
}

const LEGEND: readonly CSSProperties[] = [CELL_STYLE.k1, CELL_STYLE.k2, CELL_STYLE.k3, CELL_STYLE.att, CELL_STYLE.none]

export default function CheckHistoryStrip({ data }: { data: Pick<GrowthResponse, 'range' | 'since' | 'days' | 'weeks'> }) {
  const cols = stripColumnsOf(data)
  const n = cols.length
  const weeksCount = data.range.weeks
  const { studied, attendOnly } = stripCounts(cols)
  const rows = stripRowsOf(cols, data.weeks)
  return (
    <GrowthCard title={GROWTH.stripTitle} side={GROWTH.stripSide}>
      <div className="@container min-w-0">
        <div
          aria-hidden="true"
          data-growth-strip=""
          className="grid min-w-0 grid-flow-col justify-start gap-[3px]"
          style={{ gridTemplateColumns: `16px repeat(${n}, minmax(12px, 56px))`, gridTemplateRows: '14px repeat(7, auto)' }}
        >
          <span />
          {WD.map((d) => (
            <span key={d} className="grid items-center text-[11px] leading-none text-ink2">
              {d}
            </span>
          ))}
          {cols.map((c) => (
            <Fragment key={c.weekStart}>
              <span className="h-[14px] overflow-visible whitespace-nowrap text-[11px] leading-[1.2] text-ink2">
                {weeksCount <= 4 ? c.sl : weeksCount >= 12 ? c.month : <StripLabel8 sl={c.sl} month={c.month} />}
              </span>
              {c.cells.map((cell) => (
                <i key={cell.date} data-cell={cell.state} className="block aspect-square max-h-[22px] w-full rounded" style={CELL_STYLE[cell.state]} />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink2">
        {GROWTH.stripLegend.map((label, i) => (
          <span key={label} className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <i className="inline-block h-3 w-3 rounded-[3px]" style={LEGEND[i]} />
            {label}
          </span>
        ))}
      </div>
      <p className="sr-only">{GROWTH.stripSr(weeksCount, studied, attendOnly)}</p>
      <TableToggle label={GROWTH.stripTable}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">{GROWTH.stripCaption}</caption>
            <thead>
              <tr>
                {GROWTH.stripCols.map((h) => (
                  <th key={h} scope="col" className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.week}>
                  <td className={TD}>{r.week}</td>
                  <td className={TD}>{r.studied}</td>
                  <td className={TD}>{r.attendOnly}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[12px] text-ink2 break-keep [overflow-wrap:anywhere]">{GROWTH.stripFoot}</p>
        </div>
      </TableToggle>
    </GrowthCard>
  )
}

/** 8주 — 카드 안 너비 324px 이상(390·412)이면 주 시작일, 아니면(360) 첫 열·달 바뀌는 열에 달(데모 «칸 ≥ 36px 이면 날짜» 를 너비로 옮김). */
function StripLabel8({ sl, month }: { sl: string; month: string | null }) {
  return (
    <>
      <span className="hidden @min-[324px]:inline">{sl}</span>
      <span className="@min-[324px]:hidden">{month}</span>
    </>
  )
}
