'use client'

/**
 * 성장 탭 자리표시(task-080, screens.md §36-4 ①·36-13 · §17-1 규칙).
 * - `GrowthSkeleton` = 서버 `loading.tsx` 몫: 앱바 + 분절(placeholder) + 본문. 기간은 주소 `?weeks=` 에서 읽는다(Suspense 안 부품 하나에서만).
 * - `GrowthSkeletonBody` = 화면 첫 요청 중 몫: 본문만(분절은 화면의 진짜 분절).
 * 정적으로 아는 것은 실제 요소(기간 분절 — 눌리지 않게 `inert`), 데이터가 정하는 것만 회색 블록(기간 줄·숫자 카드 3칸·체크내역·주마다 공부량 — 그 아래는 첫 화면 밖이라 생략).
 * 알림은 숨김 `role=status` 한 줄(`aria-busy` 감싸개 밖). 「불러오는 중」 글자·가짜 버튼·데이터 요청 없음.
 */
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Segmented from '@/components/common/Segmented'
import AppBar from '@/components/shell/AppBar'
import type { GrowthWeeks } from '@/types/plan'
import { GROWTH_WEEKS } from '@/types/plan'
import { GROWTH } from './growthCopy'
import { DEFAULT_WEEKS, parseGrowthWeeks } from './growthLogic'
import { GROWTH_SKELETON as S } from './growthSkeletonSizes'
import PlanSwitch from './PlanSwitch'

const noop = () => {}

export const PERIOD_OPTIONS = GROWTH_WEEKS.map((w) => ({ value: w, label: GROWTH.period(w) }))

/**
 * `useSearchParams()` 는 빌드의 정적 생성 단계에서 Suspense 경계를 요구한다 — `loading.tsx` 자신은 경계의 fallback 자리라 그 밖이므로 여기서 따로 감싼다
 * (계획표 `PlanSkeleton` 과 같은 이유).
 */
export default function GrowthSkeleton() {
  return (
    <>
      <AppBar title="계획표" />
      <div className="min-w-0 px-4 pb-8">
        <PlanSwitch current="growth" placeholder />
        <Suspense fallback={<GrowthSkeletonBody weeks={DEFAULT_WEEKS} />}>
          <GrowthSkeletonFromUrl />
        </Suspense>
      </div>
    </>
  )
}

function GrowthSkeletonFromUrl() {
  const sp = useSearchParams()
  return <GrowthSkeletonBody weeks={parseGrowthWeeks(sp.get('weeks'))} />
}

const BLOCK = 'block bg-surface2'

export function GrowthSkeletonBody({ weeks }: { weeks: GrowthWeeks }) {
  return (
    <>
      <p className="sr-only" role="status">
        {GROWTH.loadingSr}
      </p>
      <div aria-busy="true">
        <section className="mt-3 min-w-0">
          <div inert>
            <Segmented ariaLabel={GROWTH.periodAria} options={PERIOD_OPTIONS} value={weeks} onChange={noop} />
          </div>
          <span aria-hidden="true" className={`mt-1.5 rounded-md ${BLOCK}`} style={{ height: S.rangeLineH }} />
        </section>
        <div aria-hidden="true" className="mt-[18px] grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`rounded-xl ${BLOCK}`} style={{ height: S.tileH }} />
          ))}
        </div>
        <span aria-hidden="true" className={`mt-[18px] rounded-[14px] ${BLOCK}`} style={{ height: S.stripCardH }} />
        <span aria-hidden="true" className={`mt-[18px] rounded-[14px] ${BLOCK}`} style={{ height: S.barsCardH }} />
      </div>
    </>
  )
}
