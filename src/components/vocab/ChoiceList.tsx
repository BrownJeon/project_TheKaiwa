'use client'

/**
 * 4지선다 보기(screens.md §5-2 B ChoiceList). 제스처 영역 **밖**에 둔다. 누르는 순간 "확인 중…" 이 되고 #50 응답이 오면
 * `correctText` 와 같은 보기를 정답으로, 내가 고른 오답을 "내 답"으로 표시한다. 화면은 정답을 계산하지 않는다(§5-10).
 * 답한 뒤 나머지 보기는 `opacity` 가 아니라 `ink2` 로 가라앉힌다(명암비 유지).
 */
import type { Ref } from 'react'
import { isAnswered, markChoice, type ChoiceMark } from './deck'
import type { DeckCard } from './useVocabDeck'

const MARK_CLASS: Record<ChoiceMark, string> = {
  idle: 'border-line bg-surface text-ink',
  pending: 'border-accent bg-surface text-ink',
  dim: 'border-line bg-surface text-ink',
  correct: 'border-good bg-good-soft text-good',
  mine: 'border-bad bg-bad-soft text-bad',
  other: 'border-line bg-surface text-ink2',
}

const MARK_TEXT: Partial<Record<ChoiceMark, string>> = { correct: '✓ 정답', mine: '✗ 내 답', pending: '확인 중…' }
const MARK_ARIA: Partial<Record<ChoiceMark, string>> = { correct: ', 정답', mine: ', 내 답 틀림', pending: ', 확인 중' }

export default function ChoiceList({
  card,
  locked,
  onChoose,
  firstRef,
}: {
  card: DeckCard
  /** 지난 카드·넘기는 중 — 누를 수 없음 */
  locked: boolean
  onChoose: (text: string) => void
  firstRef?: Ref<HTMLButtonElement>
}) {
  const choices = card.choices ?? []
  const done = isAnswered(card)
  const pendingChosen = card.pending ? (card.chosen ?? null) : null
  const disabled = locked || done || !!card.pending
  return (
    <ol className="grid gap-2" aria-label="보기">
      {choices.map((choice, i) => {
        const mark = markChoice(choice, card, pendingChosen)
        return (
          <li key={`${i}-${choice}`} className="min-w-0">
            <button
              type="button"
              ref={i === 0 ? firstRef : undefined}
              data-choice={i}
              aria-disabled={disabled || undefined}
              aria-label={`${i + 1}번, ${choice}${MARK_ARIA[mark] ?? ''}`}
              onClick={() => {
                if (!disabled) onChoose(choice)
              }}
              className={`flex min-h-[52px] w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-[16px] leading-snug ${MARK_CLASS[mark]}`}
            >
              <span aria-hidden="true" className="grid h-6 w-6 flex-none place-items-center rounded-full bg-surface2 text-[12px] text-ink2">
                {i + 1}
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 break-keep [overflow-wrap:anywhere]">{choice}</span>
              {MARK_TEXT[mark] ? (
                <span aria-hidden="true" className={`flex-none text-[13px] font-semibold ${mark === 'pending' ? 'font-normal text-ink2' : ''}`}>
                  {MARK_TEXT[mark]}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
