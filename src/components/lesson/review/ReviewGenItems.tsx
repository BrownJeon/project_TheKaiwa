/**
 * 복습 수업 대기 화면 가운데 카드(screens §14-2 D · 데모 `#rl-gen`) — "이번 복습 항목 {n}개로 만들어요" + 항목 칩 전부(7개 제한 없음, 집중 먼저).
 */
import { Card } from '@/components/common/ui'
import type { ReviewItem } from '@/types/review'
import { RV_GEN } from './reviewCopy'
import { sortReviewItems } from './reviewLogic'
import { ReviewChips } from './TeacherWhy'

export default function ReviewGenItems({ items }: { items: readonly ReviewItem[] }) {
  const chips = sortReviewItems(items).map((x) => ({ textJa: x.textJa, focus: x.priority === 'FOCUS' }))
  return (
    <Card flat>
      <h3 className="text-[15px] font-semibold break-keep">{RV_GEN.itemsTitle(items.length)}</h3>
      <ReviewChips chips={chips} />
      <p className="mt-2 text-[13px] text-ink2 break-keep">{RV_GEN.itemsNote}</p>
    </Card>
  )
}
