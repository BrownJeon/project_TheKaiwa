'use client'

/**
 * 덱 도구 줄(screens.md §5-2 B DeckToolbar).
 * 안 답한 지금 카드: [이전][읽기][표시][한글] · 답한 카드·지난 카드: [이전][표시][다음 카드 ›](마지막이면 [결과 보기 ›]).
 * task-060 C: [읽기] = 앞면 히라가나만, [한글] = 앞면 한글 표기 줄만(서로 독립) — [한글]은 옛 [건너뛰기] 자리다.
 * 건너뛰기는 안 푼 카드의 오른쪽 밀기·S 가 확인 시트를 연다(task-070). 그 단일 포인터 대체 수단으로 **화면 읽기 전용** [건너뛰기] 버튼을 4칸 격자 밖에 둔다 —
 * 평소엔 보이지 않고, Tab 키로 닿았을 때(`:focus-visible`)만 도구 줄 가운데에 작은 칩으로 나타난다(`SR_CHIP`, WCAG 2.4.7). 절대 위치라 칸 높이(52px)·다른 칸을 밀지 않고,
 * 칩이 뜨는 동안 [읽기]·[표시] 칸 가운데 일부를 덮는다. 자동 초점 ref 는 달지 않는다(새 카드로 넘어갈 때 초점이 이 버튼으로 가지 않는다).
 * 소리 버튼 자리는 [읽기]와 [표시] 사이지만 지금은 그리지 않는다(E9).
 * 막힌 버튼은 `aria-disabled` 로 두고 누르면 이유를 알린다(눌러도 반응 없는 버튼 금지).
 */
import type { Ref } from 'react'
import { CARD_FIRST } from './cardFirst'
import { SR_CHIP } from './srChip'

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
  showHangul,
  hangulAvailable,
  locked,
  onPrev,
  onReading,
  onFlag,
  onHangul,
  onSkipAsk,
  onNext,
  nextRef,
}: {
  answered: boolean
  isFirst: boolean
  isLast: boolean
  flagged: boolean
  showReading: boolean
  readingAvailable: boolean
  showHangul: boolean
  /** 이 카드에 앞면 한글 줄을 그릴 수 있는가(아니면 `aria-disabled` — 누르면 덱이 이유를 알린다) */
  hangulAvailable: boolean
  locked: boolean
  onPrev: () => void
  onReading: () => void
  onFlag: () => void
  onHangul: () => void
  /** 건너뛰기 확인 시트 열기(화면 읽기 전용 버튼) */
  onSkipAsk: () => void
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
    <div className="relative">
      <div className="grid grid-cols-4 gap-2">
        {prev}
        <button type="button" className={TOOL} aria-pressed={readingAvailable ? showReading : undefined} aria-disabled={!readingAvailable || undefined} onClick={onReading}>
          <span aria-hidden="true" lang="ja" className="grid h-5 place-items-center text-[16px] font-semibold leading-none">
            あ
          </span>
          읽기
        </button>
        {flag}
        <button type="button" className={TOOL} aria-pressed={hangulAvailable ? showHangul : undefined} aria-disabled={!hangulAvailable || undefined} onClick={onHangul}>
          <span aria-hidden="true" className="grid h-5 place-items-center text-[16px] font-semibold leading-none">
            가
          </span>
          {CARD_FIRST.hangul.label}
        </button>
      </div>
      <button type="button" className={SR_CHIP} aria-disabled={locked || undefined} onClick={onSkipAsk}>
        {CARD_FIRST.skipBtn}
      </button>
    </div>
  )
}
