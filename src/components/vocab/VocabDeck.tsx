'use client'

/**
 * 카드 덱 화면(screens.md §5-2 B). 앱 셸 `main` 을 정확히 채우고(채팅방과 같은 방식) 412×780·390×800 에서 스크롤이 없다.
 * `min-h-[600px]` 는 가로 모드·아주 낮은 화면에서만 `main` 스크롤을 허용하는 바닥값이다.
 *
 * 제스처 영역(가운데 80%, 3장 스택)에는 카드 면만 두고, 보기·버튼·도구 줄은 **영역 밖**에 둔다(§5-0 4).
 * 덱에서는 하단 Toast 를 쓰지 않는다 — 보기·도구 줄을 가린다. 알림은 힌트 줄과 DeckNotice 로만 한다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { OFF, useWordLayersList } from '@/components/common/japanese/annotations'
import BackBar from '@/components/shell/BackBar'
import { alignWordRuby } from '@/modules/speech/reading/client'
import ChoiceList from './ChoiceList'
import DeckNotice from './DeckNotice'
import DeckProgress from './DeckProgress'
import DeckToolbar from './DeckToolbar'
import { isAnswered, keyAction, tallyCards } from './deck'
import FinishConfirmSheet from './FinishConfirmSheet'
import FlipControls from './FlipControls'
import GestureHint from './GestureHint'
import { useMediaQuery } from './hooks'
import { MODE_LABEL } from './labels'
import SwipeCardStack from './SwipeCardStack'
import type { VocabDeckState } from './useVocabDeck'
import VocabCardFace from './VocabCardFace'

export default function VocabDeck({ deck }: { deck: VocabDeckState }) {
  const [endOpen, setEndOpen] = useState(false)
  const coarse = useMediaQuery('(pointer: coarse)')
  const nextRef = useRef<HTMLButtonElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const { session, cards, view, frontier, card, mode, isCurrent, answered, peekable, side } = deck
  const n = cards.length
  const finishing = deck.phase === 'finishing'
  const locked = deck.exiting || finishing || !!card?.pending
  // 카드 앞면 층(task-026 §15-4-6): 덱 표제어 전부의 한글을 처음 한 번에 받고, 루비는 저장 읽기로 여기서 만든다 — 카드 면 안에서 훅을 부르지 않아
  // 드래그 중 memo 가 유지된다. 카드 [읽기] 끔이면 요청도 하지 않는다. 앱 히라가나 설정은 카드에 영향이 없다.
  const layers = useWordLayersList(deck.showReading ? cards.map((c) => ({ surface: c.surface, reading: c.reading })) : [])
  const surface = card?.surface ?? ''
  const reading = card?.reading ?? null
  const ruby = useMemo(() => (reading ? alignWordRuby(surface, reading) : null), [surface, reading])
  const faceHangul = (deck.showReading && layers[view]?.hangul) || OFF

  // 답 응답 뒤에는 [다음 카드]로, 새 카드가 되면 첫 보기·[뜻 보기]로 초점을 옮긴다(스크롤은 건드리지 않는다).
  useEffect(() => {
    if (deck.focus.seq === 0) return
    const id = requestAnimationFrame(() => {
      const el = deck.focus.kind === 'next' ? nextRef.current : firstRef.current
      el?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [deck.focus])

  // 키보드(§5-2 C 표). 매 렌더 최신 상태로 다시 건다 — 핸들러가 옛 카드를 보지 않게.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null
      const intent = keyAction(
        {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          repeat: e.repeat,
          isComposing: e.isComposing,
          targetTag: t?.tagName.toLowerCase(),
          targetEditable: !!t?.isContentEditable,
        },
        {
          sheetOpen: endOpen || !!document.querySelector('[role="dialog"][aria-modal="true"]'),
          mode,
          isCurrent,
          answered,
          side,
          peekable,
          focusOnControl: !!t && (t.tagName === 'BUTTON' || t.tagName === 'A'),
        },
      )
      if (!intent) return
      e.preventDefault()
      switch (intent.type) {
        case 'choose': {
          const choice = card?.choices?.[intent.index]
          if (choice !== undefined) deck.choose(choice)
          break
        }
        case 'self':
          deck.selfGrade(intent.result)
          break
        case 'flip':
          deck.flip()
          break
        case 'advance':
        case 'next':
          deck.next()
          break
        case 'prev':
          deck.prev()
          break
        case 'flag':
          deck.toggleFlag()
          break
        case 'reading':
          deck.toggleReading()
          break
        case 'skip':
          deck.skip()
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!session || !card) return null

  const t = tallyCards(cards)
  const readingAvailable = !!card.reading && card.reading !== card.surface
  const canGoNext = isAnswered(card)

  const onTap = () => {
    if (side === 'back') return
    if (mode === 'FLIP' && peekable && isCurrent) deck.flip()
    else deck.toggleReading()
  }

  return (
    <div className="mx-auto flex h-full min-h-[600px] w-full min-w-0 max-w-[520px] flex-col bg-ground">
      <BackBar
        backHref="/study/today"
        backLabel="오늘로"
        title="오늘의 단어"
        subtitle={`${MODE_LABEL[mode]} · ${session.cardCount || n}장`}
        right={
          <button
            type="button"
            onClick={() => setEndOpen(true)}
            aria-disabled={finishing || undefined}
            className="h-11 flex-none rounded-xl px-3 text-[14px] font-medium text-ink2"
          >
            끝내기
          </button>
        }
      />
      <DeckProgress cards={cards} view={view} frontier={frontier} />
      {deck.notice ? <DeckNotice notice={deck.notice} onClose={deck.closeNotice} /> : null}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        <SwipeCardStack
          count={n}
          view={view}
          canGoNext={canGoNext}
          canGoPrev={view > 0}
          locked={locked}
          exiting={deck.exiting}
          reducedMotion={deck.reducedMotion}
          onTap={onTap}
          onUp={deck.toggleFlag}
          onLeft={deck.next}
          onRight={deck.prev}
          renderTop={() => (
            <VocabCardFace card={card} side={side} mode={mode} showReading={deck.showReading} peekable={peekable} ruby={ruby} hangul={faceHangul} />
          )}
        />
      </div>
      <GestureHint mode={mode} hint={deck.hint} coarse={coarse} />
      <div className="flex-none px-4 pt-2">
        {mode === 'CHOICE' ? (
          <ChoiceList card={card} locked={locked || !isCurrent} onChoose={deck.choose} firstRef={firstRef} />
        ) : (
          <FlipControls
            card={card}
            side={side}
            peekable={peekable}
            locked={locked || !isCurrent}
            finePointer={!coarse}
            onFlip={deck.flip}
            onSelf={deck.selfGrade}
            firstRef={firstRef}
          />
        )}
      </div>
      <div className="flex-none px-4 pt-2" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <DeckToolbar
          answered={isAnswered(card)}
          isFirst={view === 0}
          isLast={view === n - 1}
          flagged={card.flagged}
          showReading={deck.showReading}
          readingAvailable={readingAvailable}
          locked={locked}
          onPrev={deck.prev}
          onReading={deck.toggleReading}
          onFlag={deck.toggleFlag}
          onSkip={deck.skip}
          onNext={deck.next}
          nextRef={nextRef}
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {deck.announce.before}
        {deck.announce.ja ? <span lang="ja">{deck.announce.ja}</span> : null}
        {deck.announce.after ?? ''}
      </p>
      <FinishConfirmSheet
        open={endOpen}
        answered={t.answered}
        unanswered={n - t.answered}
        busy={finishing}
        error={endOpen ? deck.finishError : null}
        onConfirm={() => void deck.finish()}
        onClose={() => setEndOpen(false)}
      />
    </div>
  )
}
