'use client'

/**
 * 세트 결과의 단어 목록(screens.md §5-2 E). 지운 단어(`wordId:null`, Snap 으로 남은 카드)는 링크 없이 "지운 단어" 뱃지를 단다.
 * 전체 목록에서만 결과 뱃지(맞힘·틀림·건너뜀)를 보인다.
 */
import Link from 'next/link'
import { Badge } from '@/components/common/ui'
import type { VocabCard } from '@/types/vocab'
import { RESULT_LABEL, RESULT_TONE } from './labels'

function Row({ card, showResult }: { card: VocabCard; showResult: boolean }) {
  const correct = card.correctText ?? card.meaning ?? ''
  const mine = card.answer === 'WRONG' && card.chosenText ? ` · 내 답 ${card.chosenText}` : ''
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span lang="ja" className="min-w-0 truncate text-[17px] font-semibold">
            {card.surface}
          </span>
          {card.reading && card.reading !== card.surface ? (
            <span lang="ja" className="min-w-0 truncate text-[13px] text-ink2">
              {card.reading}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[14px] break-keep [overflow-wrap:anywhere]">
          정답 {correct}
          {mine}
        </span>
      </span>
      <span className="flex flex-none items-center gap-1.5">
        {card.wordId ? null : <Badge tone="neutral">지운 단어</Badge>}
        {showResult && card.answer ? <Badge tone={RESULT_TONE[card.answer]}>{RESULT_LABEL[card.answer]}</Badge> : null}
        {card.flagged ? (
          <span className="text-accent">
            <span aria-hidden="true">★</span>
            <span className="sr-only">다시 볼 카드</span>
          </span>
        ) : null}
        {card.wordId ? (
          <span aria-hidden="true" className="text-ink2">
            ›
          </span>
        ) : null}
      </span>
    </>
  )
  const cls = 'flex min-h-[56px] w-full min-w-0 items-center gap-2 px-3.5 py-2 text-left'
  return (
    <li>
      {card.wordId ? (
        <Link href={`/drawer/words?word=${encodeURIComponent(card.wordId)}`} className={cls}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  )
}

export default function WordResultList({ title, cards, showResult }: { title?: string; cards: VocabCard[]; showResult: boolean }) {
  if (cards.length === 0) return null
  return (
    <section className="mt-[18px] min-w-0">
      {title ? <h3 className="mb-2 text-[15px] font-semibold">{title}</h3> : null}
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {cards.map((c) => (
          <Row key={c.order} card={c} showResult={showResult} />
        ))}
      </ul>
    </section>
  )
}
