'use client'

/**
 * 계획표 성장 탭 `/plan/growth`(task-080, 승인 데모 `docs/demo/task-080-plan-growth-analysis-v4.html`, screens.md §36).
 * 읽기 전용 화면 — 위험 동작·확인 상자 없음. 데이터는 #78(자기 기록만, 스냅샷 + 출석 — 기록을 지워도 숫자 불변).
 *
 * - 기간 `?weeks=4|8|12`(기본 4 — 주소에 쓰지 않음): 첫 값은 지금 주소에서 읽고, 바꿀 때 `history.replaceState`(서버를 다시 부르지 않는다, 달력 `?month=` 과 같은 방식).
 * - 상태(36-4): 첫 로딩 = 자리표시 · 정상 · 기간 바꾸는 중 = 앞 기간 내용 + `aria-busy` · 오류 = 카드 + [다시 불러오기]
 *   ([다시 불러오기] 뒤 성공 → 고른 기간 라디오로 초점, 또 실패 → 오류 제목으로 초점).
 * - 오늘은 응답 `range.today`(자정 넘김 대비).
 */
import { useEffect, useRef, type RefObject } from 'react'
import { useSearchParams } from 'next/navigation'
import Segmented from '@/components/common/Segmented'
import type { GrowthResponse, GrowthWeeks } from '@/types/plan'
import CheckHistoryStrip from './CheckHistoryStrip'
import EvalRadarSection from './EvalRadarSection'
import { GROWTH } from './growthCopy'
import { fewNoteOf, growthUrl, parseGrowthWeeks, rangeText } from './growthLogic'
import { GrowthSkeletonBody, PERIOD_OPTIONS } from './GrowthSkeleton'
import GrowthSummaryTiles from './GrowthSummaryTiles'
import { AnalysisSoonCard } from './parts'
import PlanSwitch from './PlanSwitch'
import ResultRows from './ResultRows'
import { useGrowthData } from './useGrowthData'
import WeeklyBars from './WeeklyBars'

export default function GrowthScreen({ today: serverToday }: { today: string }) {
  const sp = useSearchParams()
  const g = useGrowthData(parseGrowthWeeks(sp.get('weeks')))
  const weeks = g.weeks
  const periodRef = useRef<HTMLDivElement | null>(null)
  const errRef = useRef<HTMLHeadingElement | null>(null)
  /** [다시 불러오기] 를 누른 뒤 한 번만 초점을 옮긴다. */
  const retryFocus = useRef(false)

  useEffect(() => {
    const url = growthUrl(weeks)
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, '', url)
  }, [weeks])

  useEffect(() => {
    if (!retryFocus.current || g.status === 'loading') return
    retryFocus.current = false
    if (g.status === 'ready') periodRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus()
    else errRef.current?.focus()
  }, [g.status])

  return (
    <div className="min-w-0 px-4 pb-8">
      <PlanSwitch current="growth" />
      {g.status === 'error' ? (
        <GrowthError
          titleRef={errRef}
          onRetry={() => {
            retryFocus.current = true
            g.reload()
          }}
        />
      ) : g.status === 'ready' && g.data ? (
        <GrowthBody data={g.data} weeks={weeks} onWeeks={g.setWeeks} busy={g.busy} periodRef={periodRef} today={g.data.range.today || serverToday} />
      ) : (
        <GrowthSkeletonBody weeks={weeks} />
      )}
    </div>
  )
}

/** 정상 화면 본문 — 시험에서 응답 고정값으로 정적 렌더한다. `weeks` = 고른 기간(분절), 내용은 `data` 의 기간(바꾸는 중이면 앞 기간). */
export function GrowthBody({
  data,
  weeks,
  onWeeks,
  busy,
  periodRef,
  today,
}: {
  data: GrowthResponse
  weeks: GrowthWeeks
  onWeeks: (w: GrowthWeeks) => void
  busy: boolean
  periodRef?: RefObject<HTMLDivElement | null>
  today: string
}) {
  const shownWeeks = data.range.weeks
  return (
    <div aria-busy={busy || undefined}>
      <section className="mt-3 min-w-0">
        <div ref={periodRef}>
          <Segmented ariaLabel={GROWTH.periodAria} options={PERIOD_OPTIONS} value={weeks} onChange={onWeeks} />
        </div>
        <p className="mt-1.5 text-[12px] text-ink2 break-keep">{rangeText(data.range, data.since)}</p>
      </section>
      <GrowthSummaryTiles data={data} />
      <CheckHistoryStrip data={data} />
      <WeeklyBars weeks={data.weeks} today={today} />
      <ResultRows skills={data.skills} weeksCount={shownWeeks} fewNote={fewNoteOf(data)} />
      <EvalRadarSection evaluations={data.evaluations} hasEvaluations={data.hasEvaluations} weeksCount={shownWeeks} />
      <AnalysisSoonCard />
      <p className="mt-[18px] text-[12px] text-ink2 break-keep">{GROWTH.footer}</p>
    </div>
  )
}

export function GrowthError({ titleRef, onRetry }: { titleRef?: RefObject<HTMLHeadingElement | null>; onRetry: () => void }) {
  return (
    <div className="mt-3 min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
      <h2 ref={titleRef} tabIndex={-1} className="text-[15px] font-semibold break-keep">
        {GROWTH.errTitle}
      </h2>
      <p role="alert" className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">
        {GROWTH.errBody}
      </p>
      <button type="button" onClick={onRetry} className="mt-3 h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] font-semibold">
        {GROWTH.errRetry}
      </button>
    </div>
  )
}
