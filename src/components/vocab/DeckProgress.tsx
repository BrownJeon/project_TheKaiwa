'use client'

/**
 * 덱 진행 표시(screens.md §5-2 B DeckProgress). 세그먼트 색은 비텍스트(3:1) 기준이고, 숫자·`aria-valuetext` 로 같은 정보를 준다.
 * 맞힘 good · 틀림 bad · 건너뜀 ink3 · 지금 카드 accent · 남은 카드 surface2. 지난 카드를 보는 중이면 그 칸에 링.
 */
import { isAnswered, tallyCards } from './deck'
import { DECK_CH } from './topicCopy'
import type { DeckCard } from './useVocabDeck'

function segClass(c: DeckCard, i: number, frontier: number): string {
  if (isAnswered(c)) return c.answer === 'CORRECT' ? 'bg-good' : c.answer === 'WRONG' ? 'bg-bad' : 'bg-ink3'
  return i === frontier ? 'bg-accent' : 'bg-surface2'
}

export default function DeckProgress({ cards, view, frontier, topicTitle = null }: { cards: DeckCard[]; view: number; frontier: number; topicTitle?: string | null }) {
  const n = cards.length
  const t = tallyCards(cards)
  const remaining = n - t.answered
  const past = view < frontier
  return (
    <div className="flex-none px-4 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex-none text-[15px] font-semibold tabular-nums">
          {Math.min(view + 1, n)} / {n}
        </p>
        {topicTitle ? (
          <span className="inline-flex h-6 min-w-0 max-w-[40%] items-center self-center rounded-full bg-surface2 px-2 text-[12px] font-semibold text-ink2">
            <span className="sr-only">{DECK_CH.chipSr}</span>
            <span className="truncate">{topicTitle}</span>
          </span>
        ) : null}
        <p className="min-w-0 truncate text-[12px] text-ink2 tabular-nums">
          {past ? '지난 카드 보는 중 · ' : ''}남은 {remaining}장{t.flagged > 0 ? ` · ★ ${t.flagged}` : ''}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={n}
        aria-valuenow={t.answered}
        aria-valuetext={`${n}장 중 ${t.answered}장 답함, 맞힘 ${t.correct} 틀림 ${t.wrong}`}
        className="mt-1.5 flex gap-[2px]"
      >
        {cards.map((c, i) => (
          <span
            key={c.order}
            className={`h-1.5 min-w-0 flex-1 rounded-full ${segClass(c, i, frontier)} ${past && i === view ? 'ring-2 ring-accent ring-offset-1 ring-offset-ground' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
