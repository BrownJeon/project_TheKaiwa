'use client'

/**
 * 카드 한 장의 면(screens.md §5-2 B VocabCardFace). 앞면 = 표현(+카드 [읽기] 켬이면 히라가나 루비·`[한글]` — task-026 §15-4-6), 뒷면 = 표현·읽기 + 결과 띠 + 뜻 + 예문(+번역).
 * 카드 영역은 스크롤할 수 없어(`touch-action:none`) 예문은 2줄·번역 1줄에서 자르고 전체는 결과 화면·단어 상세에서 본다.
 * **안에 버튼을 두지 않는다**(제스처 영역). `memo` — 드래그 중에는 transform 만 바뀌고 이 면은 다시 그리지 않는다.
 */
import { memo } from 'react'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import type { RubyPiece } from '@/modules/speech/reading/client'
import type { VocabMode } from '@/types/vocab'
import { isAnswered, surfaceSize, type CardSide } from './deck'
import { resultBand } from './labels'
import type { DeckCard } from './useVocabDeck'

const BAND_TONE = {
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
  neutral: 'bg-surface2 text-ink2',
} as const

function Star({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <span className="flex-none text-accent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
      <span className="sr-only">다시 볼 카드</span>
    </span>
  )
}

function VocabCardFace({
  card,
  side,
  mode,
  showReading,
  peekable,
  ruby,
  hangul,
}: {
  card: DeckCard
  side: CardSide
  mode: VocabMode
  showReading: boolean
  peekable: boolean
  /** 앞면 표제어 루비(저장 읽기 정렬) — 카드 [읽기] 켰을 때만 그린다. 덱이 한 번에 만들어 넘긴다(memo 유지). */
  ruby: RubyPiece[] | null
  /** 앞면 `[한글]`(표제어 분석, 앱 한글 설정) — 카드 [읽기] 켰을 때만. */
  hangul: AnnotationState
}) {
  const hasReading = !!card.reading && card.reading !== card.surface
  const shell = 'flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-line bg-surface p-4 shadow-sm'

  if (side === 'front') {
    return (
      <div className={shell}>
        <div className="flex h-6 flex-none justify-end">
          <Star on={card.flagged} />
        </div>
        <div className="grid min-h-0 flex-1 place-items-center text-center">
          <div className="min-w-0">
            <JaText
              text={card.surface}
              state={hangul}
              ruby={showReading ? ruby : null}
              rubyAlways
              leading={1.7}
              rt={16}
              className={`${surfaceSize(card.surface)} line-clamp-3 font-semibold leading-tight [overflow-wrap:anywhere]`}
            />
            {showReading ? <HangulLine state={hangul} size={15} /> : null}
          </div>
        </div>
        {mode === 'FLIP' && !isAnswered(card) ? (
          <p className="flex-none text-center text-[12px] text-ink2 break-keep">
            {peekable ? '탭하면 뜻이 보여요' : '알았어요·몰랐어요를 누르면 뜻이 보여요'}
          </p>
        ) : null}
      </div>
    )
  }

  const band = card.answer ? resultBand(card.answer, mode) : null
  const meaning = card.correctText ?? card.meaning ?? ''
  return (
    <div className={shell}>
      <div className="flex min-w-0 flex-none items-baseline gap-2">
        <span lang="ja" className="min-w-0 truncate text-[22px] font-semibold">
          {card.surface}
        </span>
        {hasReading ? (
          <span lang="ja" className="min-w-0 flex-1 truncate text-[14px] text-ink2">
            {card.reading}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <Star on={card.flagged} />
      </div>
      {band ? <p className={`mt-2 self-start rounded-lg px-2.5 py-1 text-[13px] font-semibold ${BAND_TONE[band.tone]}`}>{band.text}</p> : null}
      <div className="mt-2 min-h-0 flex-1">
        <p className="line-clamp-3 text-[19px] font-semibold break-keep [overflow-wrap:anywhere]">{meaning}</p>
        {card.example ? (
          <p lang="ja" className="mt-2 line-clamp-2 text-[16px] leading-[1.6] [overflow-wrap:anywhere]">
            {card.example}
          </p>
        ) : null}
        {card.exampleKo ? <p className="line-clamp-1 text-[14px] text-ink2 break-keep [overflow-wrap:anywhere]">{card.exampleKo}</p> : null}
      </div>
    </div>
  )
}

export default memo(VocabCardFace)
