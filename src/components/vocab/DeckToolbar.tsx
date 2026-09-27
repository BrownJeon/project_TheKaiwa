'use client'

/**
 * 덱 도구 줄(screens.md §5-2 B DeckToolbar) — 제스처로 하는 일을 모두 버튼으로도 한다(이전·읽기·표시·건너뛰기·다음).
 * 안 답한 지금 카드: [이전][읽기][표시][건너뛰기] · 답한 카드·지난 카드: [이전][표시][다음 카드 ›](마지막이면 [결과 보기 ›]).
 * 소리 버튼 자리는 [읽기]와 [표시] 사이지만 지금은 그리지 않는다(E9).
 * 막힌 버튼은 `aria-disabled` 로 두고 누르면 이유를 알린다(눌러도 반응 없는 버튼 금지).
 */
import type { Ref } from 'react'

const TOOL = 'flex h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-surface text-[12px] text-ink'

function Icon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'

export default function DeckToolbar({
  answered,
  isFirst,
  isLast,
  flagged,
  showReading,
  readingAvailable,
  locked,
  onPrev,
  onReading,
  onFlag,
  onSkip,
  onNext,
  nextRef,
}: {
  answered: boolean
  isFirst: boolean
  isLast: boolean
  flagged: boolean
  showReading: boolean
  readingAvailable: boolean
  locked: boolean
  onPrev: () => void
  onReading: () => void
  onFlag: () => void
  onSkip: () => void
  onNext: () => void
  nextRef?: Ref<HTMLButtonElement>
}) {
  const prev = (
    <button type="button" className={TOOL} aria-disabled={isFirst || undefined} onClick={onPrev}>
      <Icon d="M15 5l-7 7 7 7" />
      이전
    </button>
  )
  const flag = (
    <button type="button" className={TOOL} aria-pressed={flagged} onClick={onFlag}>
      <span className={flagged ? 'text-accent' : ''}>
        <Icon d={STAR} fill={flagged} />
      </span>
      {flagged ? '표시됨' : '표시'}
    </button>
  )

  if (answered) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {prev}
        {flag}
        <button
          type="button"
          ref={nextRef}
          aria-disabled={locked || undefined}
          onClick={onNext}
          className="col-span-2 flex h-[52px] min-w-0 items-center justify-center gap-1 rounded-xl bg-accent px-3 text-[15px] font-semibold text-on-accent"
        >
          <span className="truncate">{isLast ? '결과 보기' : '다음 카드'}</span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {prev}
      <button type="button" className={TOOL} aria-pressed={readingAvailable ? showReading : undefined} aria-disabled={!readingAvailable || undefined} onClick={onReading}>
        <span aria-hidden="true" lang="ja" className="grid h-5 place-items-center text-[16px] font-semibold leading-none">
          あ
        </span>
        읽기
      </button>
      {flag}
      <button type="button" className={TOOL} aria-disabled={locked || undefined} onClick={onSkip}>
        <Icon d="M5 5l7 7-7 7M13 5l7 7-7 7" />
        건너뛰기
      </button>
    </div>
  )
}
