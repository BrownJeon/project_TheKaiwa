'use client'

/**
 * 콘솔용 분절 선택 — 공용 `Segmented` 를 그대로 쓰되 각 칸을 **44px 이상**으로 늘린다(QA-013).
 * 공용 컴포넌트는 학습 화면(task-008 QA PASS)이 함께 쓰므로 고치지 않고, 감싸는 쪽에서 `min-height` 만 준다
 * (`min-height` 가 `height` 보다 크면 min 이 이긴다 — 클래스 순서와 무관하게 결정적). 공용의 `::before` 44px 히트영역은 그대로 남는다.
 */
import Segmented, { type SegOption } from '@/components/common/Segmented'

export default function ConsoleSegmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'sm',
  className = '',
}: {
  options: readonly SegOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'md' | 'sm'
  className?: string
}) {
  return (
    <div className={`min-w-0 [&_button]:min-h-11 ${className}`}>
      <Segmented size={size} options={options} value={value} onChange={onChange} ariaLabel={ariaLabel} />
    </div>
  )
}
