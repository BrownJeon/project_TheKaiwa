/**
 * 성장 탭 숫자 카드 3(연속 출석·공부한 날·이번 주, screens.md §36-3). 숨김 제목 «한눈에».
 * 적음 안내는 여기 없다 — «공부결과» 카드 소개 줄 아래로 옮겼다(L12, `ResultRows` 의 `fewNote`).
 * 라벨은 한 줄 말줄임, 값은 줄바꿈 없음, 보조 글은 줄바꿈 허용(글꼴 130%, 36-13).
 */
import type { GrowthResponse } from '@/types/plan'
import { GROWTH } from './growthCopy'
import { summaryTilesOf } from './growthLogic'

export default function GrowthSummaryTiles({ data }: { data: Pick<GrowthResponse, 'range' | 'since' | 'summary'> }) {
  const tiles = summaryTilesOf(data)
  return (
    <section className="mt-[18px] min-w-0">
      <h2 className="sr-only">{GROWTH.tilesHeading}</h2>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="min-w-0 rounded-xl border border-line bg-surface p-2.5">
            <p className="truncate text-[12px] text-ink2">{t.label}</p>
            <p className="mt-0.5 whitespace-nowrap text-[22px] font-[650] leading-[1.2]">
              {t.value}
              <small className="ml-px text-[13px] font-semibold">{GROWTH.tileUnit}</small>
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink2 break-keep [overflow-wrap:anywhere]">{t.sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
