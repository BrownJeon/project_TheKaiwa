'use client'

/**
 * 계획표 탭 서버 `loading.tsx` 의 내용(task-046 IMP-0027, T3). 클라이언트 로딩 구간(`PlanScreen` 의 챌린지 카드·달력이 응답 전)과 **같은 부품·같은 순서**라
 * 「서버 자리표시 → 클라이언트 자리표시 → 데이터」 사이에 모양이 바뀌지 않는다: 챌린지 카드 자리(실측 높이) · 월 이동 줄(실제 부품, 눌리지 않게 `inert`) ·
 * 요약·날짜 칸 자리표시(`status=loading`) · 표시 설명 · 「분석 · 성장 기록」 카드(정적). 달·날짜는 `PlanScreen` 과 같은 규칙으로 주소 `?month=` 에서 읽는다
 * (원본 화면에서 돌아올 때 지난달이어도 같은 달 격자가 그려진다). 여기엔 데이터 요청이 없다 — 진짜 화면이 올라오면 그쪽이 불러온다.
 * 이번 달 기록이 없을 때만 생기는 안내 상자(`MonthNoteBlock`)는 있을 때만 생기는 조건부라 자리표시에 넣지 않는다.
 */
import { Suspense, useId } from 'react'
import { useSearchParams } from 'next/navigation'
import ChallengePlanCard from '@/components/challenge/ChallengePlanCard'
import AppBar from '@/components/shell/AppBar'
import { CalendarGrid, CalendarLegend, MonthNav, SummaryRow } from './CalendarSection'
import { monthOf, parsePlanParams } from './logic'
import { GrowthSoonCard } from './parts'

const noop = () => {}

/**
 * `useSearchParams()` 는 빌드의 정적 생성 단계에서 Suspense 경계를 요구한다 — `loading.tsx` 자신은 경계의 fallback 자리라 그 밖이므로 여기서 따로 감싼다
 * (개발 서버는 이 검사를 하지 않아 `next build` 에서만 드러났다). 실제 요청에서는 주소의 `?month=` 를 바로 읽어 fallback(= 이번 달 격자)은 쓰이지 않는다.
 */
export default function PlanSkeleton({ today }: { today: string }) {
  return (
    <Suspense fallback={<PlanSkeletonView today={today} month={monthOf(today)} />}>
      <PlanSkeletonFromUrl today={today} />
    </Suspense>
  )
}

function PlanSkeletonFromUrl({ today }: { today: string }) {
  const sp = useSearchParams()
  const { month } = parsePlanParams(sp.get('month'), sp.get('day'), sp.get('log'), today)
  return <PlanSkeletonView today={today} month={month} />
}

function PlanSkeletonView({ today, month }: { today: string; month: string }) {
  const titleId = useId()
  return (
    <>
      <AppBar title="계획표" />
      <div className="min-w-0 px-4 pb-8">
        <ChallengePlanCard status="loading" data={null} dailyWordCount={10} onRetry={noop} />
        <section aria-labelledby={titleId} className="mt-[18px] min-w-0">
          <div inert>
            <MonthNav month={month} isCurrent={month === monthOf(today)} titleId={titleId} onPrev={noop} onNext={noop} onToday={noop} onBlocked={noop} />
          </div>
          <SummaryRow status="loading" summary={null} month={month} today={today} />
          <CalendarGrid key={month} month={month} today={today} days={[]} loading openDay={null} onOpen={noop} />
          <CalendarLegend />
        </section>
        <GrowthSoonCard />
      </div>
    </>
  )
}
