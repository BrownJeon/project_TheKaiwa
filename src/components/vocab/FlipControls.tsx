'use client'

/**
 * 뒤집기 카드 버튼(screens.md §5-2 B FlipControls). 앞면 [뜻 보기] → 뒷면 [알았어요]·[몰랐어요](자기 채점, F1 로 뜻이 처음부터 온다).
 * 뜻이 없는 카드(대체 흐름)는 앞면에서 바로 채점하고 응답으로 뒷면을 그린다. 답한 카드는 버튼 대신 기록 한 줄.
 * 정밀 포인터(키보드가 있는 기기)에는 라벨 뒤에 "1"·"2" 키를 작게 보인다.
 */
import type { Ref } from 'react'
import { isAnswered, type CardSide } from './deck'
import { flipRecordedText } from './labels'
import type { DeckCard } from './useVocabDeck'

/** `Btn` 과 같은 모양 — 초점 이동용 ref 를 받으려고 버튼을 직접 그린다. */
const BTN = 'inline-flex h-[52px] items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold'
const PRIMARY = `${BTN} bg-accent text-on-accent`
const GHOST = `${BTN} border border-line bg-surface`

export default function FlipControls({
  card,
  side,
  peekable,
  locked,
  finePointer,
  onFlip,
  onSelf,
  firstRef,
}: {
  card: DeckCard
  side: CardSide
  peekable: boolean
  locked: boolean
  finePointer: boolean
  onFlip: () => void
  onSelf: (r: 'CORRECT' | 'WRONG') => void
  firstRef?: Ref<HTMLButtonElement>
}) {
  if (isAnswered(card) && card.answer) {
    return (
      <p role="status" className="grid min-h-[52px] place-items-center text-[13px] text-ink2">
        {flipRecordedText(card.answer)}
      </p>
    )
  }
  if (side === 'front' && peekable) {
    return (
      <button
        type="button"
        ref={firstRef}
        className={`${PRIMARY} w-full`}
        aria-disabled={locked || undefined}
        onClick={() => {
          if (!locked) onFlip()
        }}
      >
        뜻 보기
        {finePointer ? <kbd className="text-[11px] font-normal opacity-80">Space</kbd> : null}
      </button>
    )
  }
  const busy = !!card.pending
  const disabled = locked || busy
  const btn = (r: 'CORRECT' | 'WRONG', label: string, key: string) => (
    <button
      type="button"
      ref={r === 'CORRECT' ? firstRef : undefined}
      className={r === 'CORRECT' ? PRIMARY : GHOST}
      aria-disabled={disabled || undefined}
      aria-busy={(busy && card.chosen === r) || undefined}
      onClick={() => {
        if (!disabled) onSelf(r)
      }}
    >
      {busy && card.chosen === r ? '기록 중…' : label}
      {finePointer && !busy ? <kbd className="text-[11px] font-normal opacity-80">{key}</kbd> : null}
    </button>
  )
  return (
    <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
      {btn('CORRECT', '알았어요', '1')}
      {btn('WRONG', '몰랐어요', '2')}
    </div>
  )
}
