'use client'

/**
 * 뒤집기 카드 첫 줄(screens.md §5-2 B FlipControls). 뒷면 [알았어요]·[몰랐어요](자기 채점, F1 로 뜻이 처음부터 온다).
 * 뜻이 없는 카드(대체 흐름)는 앞면에서 바로 채점하고 응답으로 뒷면을 그린다. 답한 카드는 버튼 대신 기록 한 줄 —
 * 직접 답한 카드와 객관식으로 답한 카드(task-084, 보기는 답하면 사라진다)가 같은 줄을 쓴다.
 * 정밀 포인터(키보드가 있는 기기)에는 라벨 뒤에 "1"·"2" 키를 작게 보인다.
 *
 * 앞면(뜻이 있는 카드, task-060 B): 옛 [뜻 보기]·[객관식]을 그리지 않는다 — 뜻 보기는 카드를 위로 밀기·Space, 객관식은 카드 탭·C.
 * 자리 52px 는 비우지 않고 안내 한 줄로 채운다 — 뒤집을 때 [알았어요][몰랐어요] 줄과 높이가 같아 카드 무대가 튀지 않는다(task-059 결함 #1).
 * 제스처의 단일 포인터 대체 수단(WCAG 2.5.1)으로 **화면 읽기 전용** [뜻 보기]·[객관식] 버튼을 둔다(평소엔 보이지 않음, 제스처 영역 밖).
 * 이 버튼에는 **자동 초점 ref 를 달지 않는다** — 새 카드·보기 닫기 뒤의 초점이 눈에 안 보이는 버튼으로 가면 위치를 볼 수 없다(WCAG 2.4.7).
 * Tab 키로 직접 닿았을 때(`:focus-visible`)만 52px 자리 가운데에 작은 칩으로 나타난다(`SR_CHIP`, 안내 글은 그동안 감춘다 — 이름 있는 group 이라 위쪽 다른 group 의 초점에 반응하지 않는다).
 */
import type { Ref } from 'react'
import { CARD_FIRST } from './cardFirst'
import { isAnswered, type CardSide } from './deck'
import { flipRecordedText } from './labels'
import { SR_CHIP } from './srChip'
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
  onChoices,
}: {
  card: DeckCard
  side: CardSide
  peekable: boolean
  locked: boolean
  finePointer: boolean
  onFlip: () => void
  onSelf: (r: 'CORRECT' | 'WRONG') => void
  firstRef?: Ref<HTMLButtonElement>
  /** 카드 우선 세트의 객관식 보기 열기(보기가 있는 카드). 있으면 앞면 안내·대체 버튼에 객관식이 함께 든다. */
  onChoices?: () => void
}) {
  if (isAnswered(card) && card.answer) {
    return (
      <p role="status" className="grid min-h-[52px] place-items-center text-[13px] text-ink2">
        {flipRecordedText(card.answer, card.chosenText)}
      </p>
    )
  }
  if (side === 'front' && peekable) {
    return (
      <div className="group/slot relative grid h-[52px] min-w-0 place-items-center px-2">
        <p aria-hidden="true" className="line-clamp-2 text-center text-[13px] leading-[1.4] text-ink2 break-keep group-has-[:focus-visible]/slot:invisible">
          {onChoices ? CARD_FIRST.slotHint : CARD_FIRST.slotHintNoChoice}
        </p>
        <button
          type="button"
          className={SR_CHIP}
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked) onFlip()
          }}
        >
          {CARD_FIRST.flipBtn}
        </button>
        {onChoices ? (
          <button
            type="button"
            className={SR_CHIP}
            aria-expanded="false"
            aria-disabled={locked || undefined}
            onClick={() => {
              if (!locked) onChoices()
            }}
          >
            {CARD_FIRST.choicesBtn}
          </button>
        ) : null}
      </div>
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
