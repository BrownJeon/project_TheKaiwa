'use client'

/**
 * 세트 결과의 단어 목록(screens.md §5-2 E). 지운 단어(`wordId:null`, Snap 으로 남은 카드)는 링크 없이 "지운 단어" 뱃지를 단다.
 * 전체 목록에서만 결과 뱃지(맞힘·틀림·건너뜀)를 보인다.
 * 표제어 위 히라가나는 저장 읽기로 정렬한 루비(앱 히라가나 설정을 따름), 아래 `[한글]` 은 표제어 분석 — 목록이 한 번에 받아 넘긴다
 * (task-033 §15-11-3 C, 단어장 `WordRow` 와 같은 방식). 옆 읽기 칸은 루비로 바뀌어 없앴다.
 * 주제 세트(task-044 `topicSet`)는 카드에 원래 단어가 없어 링크·"지운 단어" 배지 없이 행 오른쪽에 [단어장에 넣기](`onAdd`)를 둔다 — 뜻이 비면 버튼 없음.
 */
import Link from 'next/link'
import { OFF, useWordLayersList, type AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Badge } from '@/components/common/ui'
import type { RubyPiece } from '@/modules/speech/reading/client'
import type { VocabCard } from '@/types/vocab'
import AddToWordbookButton, { type AddState } from './AddToWordbookButton'
import { RESULT_LABEL, RESULT_TONE } from './labels'
import { addBody } from './topicLogic'

interface AddProps {
  addState: Record<number, AddState>
  onAdd: (card: VocabCard) => void
}

function Row({ card, showResult, ruby, hangul, add }: { card: VocabCard; showResult: boolean; ruby: RubyPiece[] | null; hangul: AnnotationState; add: AddProps | null }) {
  const correct = card.correctText ?? card.meaning ?? ''
  const mine = card.answer === 'WRONG' && card.chosenText ? ` · 내 답 ${card.chosenText}` : ''
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <JaText as="span" text={card.surface} state={hangul} ruby={ruby} leading={1.95} className="block min-w-0 truncate text-[17px] font-semibold" />
        <HangulLine as="span" state={hangul} size={12.5} />
        <span className="mt-0.5 block text-[14px] break-keep [overflow-wrap:anywhere]">
          정답 {correct}
          {mine}
        </span>
      </span>
      <span className="flex flex-none items-center gap-1.5">
        {card.wordId || add ? null : <Badge tone="neutral">지운 단어</Badge>}
        {showResult && card.answer ? <Badge tone={RESULT_TONE[card.answer]}>{RESULT_LABEL[card.answer]}</Badge> : null}
        {card.flagged ? (
          <span className="text-accent">
            <span aria-hidden="true">★</span>
            <span className="sr-only">다시 볼 카드</span>
          </span>
        ) : null}
        {card.wordId && !add ? (
          <span aria-hidden="true" className="text-ink2">
            ›
          </span>
        ) : null}
        {add && addBody(card) ? <AddToWordbookButton surface={card.surface} state={add.addState[card.order] ?? 'idle'} onAdd={() => add.onAdd(card)} /> : null}
      </span>
    </>
  )
  const cls = 'flex min-h-[56px] w-full min-w-0 items-center gap-2 px-3.5 py-2 text-left'
  return (
    <li>
      {card.wordId && !add ? (
        <Link href={`/drawer/words?word=${encodeURIComponent(card.wordId)}`} className={cls}>
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  )
}

export default function WordResultList({
  title,
  note,
  cards,
  showResult,
  add = null,
}: {
  title?: string
  /** 제목 옆 작은 안내(주제 세트 "틀린 카드" — task-044). */
  note?: string
  cards: VocabCard[]
  showResult: boolean
  /** 주제 세트 결과면 [단어장에 넣기] 상태·동작(카드 `order` 기준 한 곳 — 같은 카드가 두 목록에 있어도 같은 상태). */
  add?: AddProps | null
}) {
  // 같은 화면의 세 목록이 각자 불러도 같은 표기는 분석 캐시로 한 번만 요청된다.
  const layers = useWordLayersList(cards.map((c) => ({ surface: c.surface, reading: c.reading })))
  if (cards.length === 0) return null
  return (
    <section className="mt-[18px] min-w-0">
      {title ? (
        <div className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {note ? <span className="text-[12px] text-ink2 break-keep">{note}</span> : null}
        </div>
      ) : null}
      <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {cards.map((c, i) => (
          <Row key={c.order} card={c} showResult={showResult} ruby={layers[i]?.ruby ?? null} hangul={layers[i]?.hangul ?? OFF} add={add} />
        ))}
      </ul>
    </section>
  )
}
