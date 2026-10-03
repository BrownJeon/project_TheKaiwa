/**
 * 맨 아래 "곧 열려요" + 가드 카드(screens §14-2 B · 데모 `#rv-guard`, d=B). 011 이 "곧 열려요" 칸을 지웠으므로 **가드일 때만** 같은 모양의
 * 칸을 되살린다(§14-11 ②). `studyDays`·`items` 가 없는 옛 응답이면 막대 두 줄을 빼고 문장만 둔다.
 */
import { Badge, Card } from '@/components/common/ui'
import type { ReviewGuard } from '@/types/review'
import { RV_SOON } from './reviewCopy'

function MeterRow({ label, have, need, unit }: { label: string; have: number; need: number; unit: string }) {
  const ok = need > 0 && have >= need
  const pct = need > 0 ? Math.min(100, Math.max(0, Math.round((have / need) * 100))) : 0
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(64px,96px)_52px] items-center gap-2.5 text-[13px]">
      <span className="min-w-0">{label}</span>
      <span role="img" aria-label={RV_SOON.meterAria(label, have, need, unit, ok)} className="block h-1.5 overflow-hidden rounded-full bg-surface">
        <span className="block h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
      </span>
      <span aria-hidden="true" className={`text-right text-[12.5px] whitespace-nowrap tabular-nums ${ok ? 'font-bold text-good' : 'text-ink2'}`}>
        {RV_SOON.meterNum(have, need, unit, ok)}
      </span>
    </div>
  )
}

export default function ReviewSoonSection({ guard }: { guard: ReviewGuard }) {
  const { studyDays, items } = guard
  return (
    <section aria-labelledby="review-soon-title" className="mt-[18px] min-w-0">
      <h3 id="review-soon-title" className="mb-2 text-[15px] font-semibold">
        {RV_SOON.section}
      </h3>
      <Card flat>
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[15px] font-semibold">{RV_SOON.title}</p>
          <span className="[&>span]:bg-surface">
            <Badge tone="neutral">{RV_SOON.badge}</Badge>
          </span>
        </div>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{RV_SOON.body}</p>
        {studyDays && items ? (
          <div className="mt-2.5 flex flex-col gap-2">
            <MeterRow label={RV_SOON.studyDays} have={studyDays.have} need={studyDays.need} unit={RV_SOON.dayUnit} />
            <MeterRow label={RV_SOON.items} have={items.have} need={items.need} unit={RV_SOON.itemUnit} />
          </div>
        ) : null}
        <p className="mt-2 text-[12px] text-ink2 break-keep">{RV_SOON.hint}</p>
      </Card>
    </section>
  )
}
