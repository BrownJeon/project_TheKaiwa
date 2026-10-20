'use client'

/**
 * 성장 탭 «AI 평가 점수»(screens.md §36-3·36-6 D·36-11 — 데모 `evalBlock()`): 평가 0건 빈 상태 · 기간 안 0건 · 종류 칩 · 레이더 · 범례 · 문장 · 표.
 * 기간 안 종류는 회화 → 단어 순, 고른 종류가 새 기간에 없으면 첫째. 레이더는 읽지 않는다 — 숨김 글 + [표로 보기] 가 같은 점수를 준다.
 */
import Link from 'next/link'
import { useState } from 'react'
import { DIM_NAME, DIM_ORDER, GRADE_LABEL, KIND_NAME } from '@/components/eval/evalCopy'
import type { EvalGrade, EvalKind } from '@/types/evaluation'
import type { GrowthEvaluation } from '@/types/plan'
import { GROWTH } from './growthCopy'
import { evalPick, evalSrOf, rubricValues, showEvalNoneBody, slOf } from './growthLogic'
import { RadarChart, useMeasuredWidth } from './GrowthCharts'
import { GrowthCard, NUM, RichText, TableToggle, TD, TH } from './parts'
import { CHIP_BASE, CHIP_OFF, CHIP_ON } from './WeeklyBars'

export const EVAL_START_HREF = '/study/today/eval/new'

const gradeLabel = (g: string) => GRADE_LABEL[g as EvalGrade] ?? ''

export default function EvalRadarSection({
  evaluations,
  hasEvaluations,
  weeksCount,
}: {
  evaluations: GrowthEvaluation[]
  hasEvaluations: boolean
  weeksCount: number
}) {
  const [chosen, setChosen] = useState<EvalKind | null>(null)
  const [boxRef, W] = useMeasuredWidth()
  const { kinds, kind, list, last, first } = evalPick(evaluations, chosen)
  const side = evaluations.length ? GROWTH.evalSide(weeksCount, evaluations.length) : null

  if (!hasEvaluations)
    return (
      <GrowthCard title={GROWTH.evalTitle}>
        <p className="text-[14px] break-keep [overflow-wrap:anywhere]">{GROWTH.evalEmpty}</p>
        <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{GROWTH.evalEmptyBody}</p>
        <Link
          href={EVAL_START_HREF}
          className="mt-2.5 inline-flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-[15px] font-semibold whitespace-nowrap"
        >
          {GROWTH.evalGo}
        </Link>
      </GrowthCard>
    )

  if (!kind || !last)
    return (
      <GrowthCard title={GROWTH.evalTitle}>
        <p className="text-[14px] break-keep [overflow-wrap:anywhere]">{GROWTH.evalNone}</p>
        {showEvalNoneBody(weeksCount) ? <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{GROWTH.evalNoneBody}</p> : null}
      </GrowthCard>
    )

  const series = [{ values: rubricValues(last), main: true }, ...(first ? [{ values: rubricValues(first), main: false }] : [])]
  return (
    <GrowthCard title={GROWTH.evalTitle} side={side}>
      {kinds.length > 1 ? (
        <div role="radiogroup" aria-label={GROWTH.evalKindAria} className="no-scrollbar -mt-1 flex gap-2 overflow-x-auto py-1">
          {kinds.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={k === kind} onClick={() => setChosen(k)} className={`${CHIP_BASE} ${k === kind ? CHIP_ON : CHIP_OFF}`}>
              {GROWTH.evalChip(KIND_NAME[k], evaluations.filter((e) => e.kind === k).length)}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={boxRef} className="mt-2.5 min-w-0">
        {W ? <RadarChart size={Math.min(W, 320)} series={series} /> : null}
      </div>
      <p className="sr-only">{evalSrOf(kind, last, first)}</p>
      <div aria-hidden="true" className="mt-2.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[12px] text-ink2">
        <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
          <i className="inline-block h-3 w-3 rounded-full bg-protein" />
          {GROWTH.evalLegendLast(slOf(last.date), last.totalScore)}
        </span>
        {first ? (
          <span className="inline-flex items-center gap-[5px] whitespace-nowrap">
            <i className="inline-block h-3 w-3 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-ink2)]" />
            {GROWTH.evalLegendFirst(slOf(first.date), first.totalScore)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[14px] break-keep [overflow-wrap:anywhere]">
        <RichText
          parts={
            first
              ? GROWTH.evalMany(KIND_NAME[kind], last.level, first.totalScore, last.totalScore, gradeLabel(last.grade))
              : GROWTH.evalOne(KIND_NAME[kind], last.level, last.totalScore, gradeLabel(last.grade))
          }
        />
      </p>
      {first ? null : <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{GROWTH.evalOneNext(KIND_NAME[kind])}</p>}
      <TableToggle label={GROWTH.barsTable}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <caption className="sr-only">{GROWTH.evalTableCaption(KIND_NAME[kind])}</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>
                  {GROWTH.evalCols[0]}
                </th>
                <th scope="col" className={TH}>
                  {GROWTH.evalCols[1]}
                </th>
                <th scope="col" className={`${TH} text-right!`}>
                  {GROWTH.evalCols[2]}
                </th>
                {DIM_ORDER.map((d) => (
                  <th key={d} scope="col" className={`${TH} text-right!`}>
                    {DIM_NAME[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...list].reverse().map((e) => (
                <tr key={e.id}>
                  <td className={TD}>{slOf(e.date)}</td>
                  <td className={TD}>{e.level}</td>
                  <td className={`${TD} ${NUM}`}>{e.totalScore}</td>
                  {DIM_ORDER.map((d) => (
                    <td key={d} className={`${TD} ${NUM}`}>
                      {e.rubric[d]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableToggle>
    </GrowthCard>
  )
}
