'use client'

/**
 * 카드 덱 화면(screens.md §5-2 B). 앱 셸 `main` 을 정확히 채우고(채팅방과 같은 방식) 412×780·390×800 에서 스크롤이 없다.
 * `min-h-[600px]` 는 가로 모드·아주 낮은 화면에서만 `main` 스크롤을 허용하는 바닥값이다.
 *
 * 제스처 영역(가운데 80%, 3장 스택)에는 카드 면만 두고, 보기·버튼·도구 줄은 **영역 밖**에 둔다(§5-0 4).
 * 덱에서는 하단 Toast 를 쓰지 않는다 — 보기·도구 줄을 가린다. 알림은 힌트 줄과 DeckNotice 로만 한다.
 *
 * 카드 우선 세트(task-059 §23-3): 탭·아래 버튼 영역·키는 세트 방식 하나가 아니라 **카드마다** `cardFirst` 로 가른다.
 * 새 버튼([객관식]·듣기 줄)도 모두 제스처 영역 밖이다 — 터치 기기는 `SwipeCardStack` 의 `touchend preventDefault` 때문에 영역 안 버튼의 click 이 생기지 않는다.
 *
 * 덱 조작 정리(task-060): 위로 밀기 = 뜻 보기(`cardFirst.upAction`), 표시(★)는 [표시]·F. 앞면 히라가나 = [읽기], 한글 줄 = [한글](서로 독립).
 * 좌우 스와이프(task-070 개정): 왼쪽 = 이전 카드(`deck.prev`), 오른쪽 = 푼 카드는 다음 카드·마지막이면 결과(`deck.next`), 안 푼 카드는 건너뛰기 확인
 * 시트(`SkipConfirmSheet`) — 갈림은 `cardFirst.rightAction` 이 한다. 키 ←/→ 와 [이전]·[다음 카드] 는 그대로다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { OFF, useAnnotations, useWordLayersList } from '@/components/common/japanese/annotations'
import { useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import BackBar from '@/components/shell/BackBar'
import { alignWordRuby } from '@/modules/speech/reading/client'
import {
  answeredBy,
  canAskSkip,
  canSwipeRight,
  CARD_FIRST,
  choicesState,
  deckSoundMessage,
  fixedHint,
  hangulBlock,
  hasChoices,
  isSoundStopTap,
  listenTexts,
  modeTag,
  rightAction,
  skipSheetOpen,
  tapAction,
  upAction,
} from './cardFirst'
import ChoiceList from './ChoiceList'
import DeckListenRow from './DeckListenRow'
import DeckNotice from './DeckNotice'
import DeckProgress from './DeckProgress'
import DeckToolbar from './DeckToolbar'
import { canPrev, isAnswered, keyAction, tallyCards } from './deck'
import FinishConfirmSheet from './FinishConfirmSheet'
import FlipControls from './FlipControls'
import GestureHint from './GestureHint'
import { useMediaQuery } from './hooks'
import SkipConfirmSheet from './SkipConfirmSheet'
import SwipeCardStack from './SwipeCardStack'
import { q } from './topicCopy'
import TopicDeckLines from './TopicDeckLines'
import { deckChallengeLine, finishChallengeNote, topicSourceParts } from './topicLogic'
import type { VocabDeckState } from './useVocabDeck'
import { useWordSound } from './useWordSound'
import VocabCardFace from './VocabCardFace'
import type { SoundTarget } from './wordSound'

export default function VocabDeck({ deck }: { deck: VocabDeckState }) {
  const [endOpen, setEndOpen] = useState(false)
  /** 건너뛰기 확인 시트를 연 카드(`order`). 그 카드가 지금 보이고 아직 안 답했을 때만 열려 있다 — 카드가 바뀌거나 답이 들어오면 저절로 닫힌다. */
  const [skipFor, setSkipFor] = useState<number | null>(null)
  const coarse = useMediaQuery('(pointer: coarse)')
  const prefs = useDisplayPrefs()
  // 360 폭·낮은 화면은 출처 줄을 1줄로 줄인다(가이드 §3-6 높이 예산 — 덱 스크롤 0 유지).
  const tight = useMediaQuery('(max-width: 370px), (max-height: 760px)')
  const nextRef = useRef<HTMLButtonElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const sound = useWordSound()
  const { session, cards, view, frontier, card, mode, isCurrent, answered, peekable, side } = deck
  const n = cards.length
  const finishing = deck.phase === 'finishing'
  const locked = deck.exiting || finishing || !!card?.pending
  // 카드 면 층(task-026 §15-4-6 · task-033 §15-11-3): 덱 표제어 전부의 한글·예문 분석을 처음 한 번에 받고, 루비는 저장 읽기로 여기서 만든다 —
  // 카드 면 안에서 훅을 부르지 않아 드래그 중 memo 가 유지된다. 앞면 루비는 카드 [읽기], 앞면 한글 줄은 카드 [한글] 켰을 때만 그리고(task-060),
  // 뒷면은 앱 한글 설정만 따른다(한글 끔이면 요청 없음). 앱 히라가나 설정은 표제어 루비에 영향이 없다(뒷면 C1-A: 늘 보임).
  const layers = useWordLayersList(cards.map((c) => ({ surface: c.surface, reading: c.reading })))
  const exampleAnns = useAnnotations(cards.map((c) => c.example ?? ''))
  const surface = card?.surface ?? ''
  const reading = card?.reading ?? null
  const ruby = useMemo(() => (reading ? alignWordRuby(surface, reading) : null), [surface, reading])
  const layerHangul = layers[view]?.hangul
  const faceHangul = (deck.showHangul && layerHangul) || OFF
  const backHangul = layerHangul ?? OFF
  const exampleAnn = exampleAnns[view] ?? OFF
  const hangulBlocked = hangulBlock({ prefsLoaded: prefs.loaded, appHangul: prefs.showHangul, layer: layerHangul?.s })

  // 건너뛰기(task-060 D): 오른쪽 밀기·S·화면 읽기 전용 [건너뛰기]는 확인 시트만 연다. 기록(#50 skipped)은 시트의 [건너뛰기]에서만.
  const skipCtx = { isCurrent, answered, busy: locked }
  const skipOpen = skipSheetOpen({ skipFor, order: card?.order ?? null, answered, phase: deck.phase })
  // 열림 조건이 풀리면(카드가 바뀜·답이 들어옴·끝내는 중) 연 카드 기록도 비운다 — 끝내기 실패로 phase 가 playing 으로 돌아와도 같은 카드의 시트가 되살아나지 않게(REV-060-1 L-3).
  if (skipFor !== null && !skipOpen) setSkipFor(null)
  // 끝내기 확인 시트가 열려 있으면 열지 않는다 — 키는 `sheetOpen` 이 막지만 화면 읽기가 모달 뒤 [건너뛰기]에 닿을 수 있다(L-2).
  const askSkip = () => {
    if (!card || endOpen || deck.phase !== 'playing' || !canAskSkip(skipCtx)) return
    setSkipFor(card.order)
  }

  // 답 응답 뒤에는 [다음 카드]로, 새 카드가 되면 첫 보기·[알았어요]로 초점을 옮긴다(스크롤은 건드리지 않는다).
  // 앞면 안내 자리(뜻 보기 전)에는 보이는 컨트롤이 없어 firstRef 가 비어 있고 초점을 옮기지 않는다 — 눈에 안 보이는 버튼에는 초점을 보내지 않는다(WCAG 2.4.7).
  useEffect(() => {
    if (deck.focus.seq === 0) return
    const id = requestAnimationFrame(() => {
      const el = deck.focus.kind === 'next' ? nextRef.current : firstRef.current
      el?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [deck.focus])

  // 소리는 그 카드에서만 — 다음·이전·자동 다음으로 카드가 바뀌거나 넘기는 중·끝내는 중이면 멈춘다(화면 가림·떠남은 훅이 멈춘다).
  const stopSound = sound.stop
  useEffect(() => {
    stopSound()
  }, [view, stopSound])
  useEffect(() => {
    if (deck.exiting || deck.phase !== 'playing') stopSound()
  }, [deck.exiting, deck.phase, stopSound])

  // 키보드(§5-2 C 표 + §23-6 A). 매 렌더 최신 상태로 다시 건다 — 핸들러가 옛 카드를 보지 않게.
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
          sheetOpen: endOpen || skipOpen || !!document.querySelector('[role="dialog"][aria-modal="true"]'),
          mode,
          isCurrent,
          answered,
          side,
          peekable,
          focusOnControl: !!t && (t.tagName === 'BUTTON' || t.tagName === 'A'),
          choices: choicesState(mode, card, side),
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
        case 'choices':
          deck.toggleChoices('key')
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
        case 'hangul':
          deck.toggleHangul(hangulBlocked)
          break
        case 'skipAsk':
          askSkip()
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  if (!session || !card) return null

  const t = tallyCards(cards)
  const readingAvailable = !!card.reading && card.reading !== card.surface
  const topic = session.topic ?? null
  const here = t.correct + t.wrong
  const sourceLine = topic ? topicSourceParts(topic, session.cardCount || n, deck.generation) : null
  const challengeLine = topic ? deckChallengeLine(deck.challengeCtx, session, here) : null
  const challengeNote = topic ? finishChallengeNote(deck.challengeCtx, session, here) : null

  const cardHasChoices = hasChoices(card)
  const open = !!card.open && !answered

  const onTap = () => {
    switch (tapAction({ mode, side, isCurrent, answered, pending: !!card.pending, hasChoices: cardHasChoices, peekable })) {
      case 'choices':
        deck.toggleChoices('tap')
        break
      case 'flip':
        deck.flip()
        break
      case 'reading':
        deck.toggleReading()
        break
      case 'none':
        break
    }
  }

  /** 위로 밀기 = 뜻 보기(task-060 A). 실제로 뜻이 열릴 때만 true — 그때만 카드가 튄다. */
  const onUp = (): boolean => {
    const r = upAction({ mode, side, isCurrent, answered, busy: locked, peekable })
    if (r.kind === 'flip') deck.flip()
    else if (r.kind === 'hint') deck.showHint(r.text)
    return r.kind === 'flip'
  }

  /** 오른쪽 밀기(task-070): 푼 카드는 다음 카드(마지막이면 결과, 소리 멈춤·날아가기는 `deck.next`), 안 푼 카드는 건너뛰기 확인(task-060). */
  const onRight = () => {
    const r = rightAction(skipCtx)
    if (r.kind === 'next') deck.next()
    else if (r.kind === 'ask') askSkip()
  }

  const listen = listenTexts(card)
  // onClick 안에서 동기로 tap — 첫 await 앞에서 오디오를 깨운다(useWordSound 규칙).
  const onListen = (target: SoundTarget, text: string) => {
    const stopping = isSoundStopTap(sound.state, target)
    sound.tap(target, text)
    if (stopping) deck.say(CARD_FIRST.sr.soundStopped)
  }
  const hintMessage = deck.hint ?? deckSoundMessage(sound.state, side)
  const hintFixed = fixedHint({ coarse, mode, side, isCurrent, answered, open, hasChoices: cardHasChoices, peekable })

  return (
    <div className="mx-auto flex h-full min-h-[600px] w-full min-w-0 max-w-[520px] flex-col bg-ground">
      <BackBar
        backHref="/study/today"
        backLabel="공부로"
        title="오늘의 단어"
        subtitle={`${topic ? `${q(topic.title)} · ` : ''}${modeTag(mode)}${session.cardCount || n}장`}
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
      <DeckProgress cards={cards} view={view} frontier={frontier} topicTitle={topic?.title ?? null} />
      {sourceLine ? <TopicDeckLines source={sourceLine} challenge={challengeLine} compact={tight} /> : null}
      {deck.notice ? <DeckNotice notice={deck.notice} onClose={deck.closeNotice} topic={!!topic} /> : null}
      {/* 무대 하한 224 = 카드 하한 200 + py-3 위아래 — 알림·듣기 줄·보기가 겹쳐 무대가 그보다 작아지면 카드가 이웃을 덮지 않고 `main` 이 스크롤한다(task-059 결함 #1).
          `overflow-x-clip`: 다음 카드로 넘어가는 카드가 오른쪽으로 날아가면(task-070 `FLY_OUT_TRANSFORM`) `main`(overflow-y-auto → x 도 auto)의 가로 스크롤 범위가 잠깐 생긴다 — 무대에서 가로만 잘라 막는다(세로 튀기 `bump` 는 그대로 보인다). */}
      <div className="flex min-h-[224px] flex-1 items-center justify-center overflow-x-clip px-4 py-3">
        <SwipeCardStack
          count={n}
          view={view}
          canLeft={canPrev(view)}
          canRight={canSwipeRight(skipCtx)}
          locked={locked}
          exiting={deck.exiting}
          reducedMotion={deck.reducedMotion}
          onTap={onTap}
          onUp={onUp}
          onLeft={deck.prev}
          onRight={onRight}
          renderTop={() => (
            <VocabCardFace
              card={card}
              side={side}
              mode={mode}
              showReading={deck.showReading}
              peekable={peekable}
              ruby={ruby}
              hangul={faceHangul}
              backHangul={backHangul}
              exampleAnn={exampleAnn}
            />
          )}
        />
      </div>
      {side === 'back' && (listen.word || listen.ex) ? <DeckListenRow state={sound.state} word={listen.word} ex={listen.ex} onPress={onListen} /> : null}
      <GestureHint fixed={hintFixed} message={hintMessage} />
      <div className="flex-none px-4 pt-2">
        {mode === 'CHOICE' || open || (answered && answeredBy(card, mode) === 'choice') ? (
          // 이전 4지선다 · 카드 우선 세트의 보기 열림(F1·P) · 객관식으로 답한 카드(Ac·지난 카드 — 답했으니 잠김)
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
            onChoices={cardHasChoices && !answered ? () => deck.toggleChoices('btn') : undefined}
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
          showHangul={deck.showHangul}
          hangulAvailable={!hangulBlocked}
          locked={locked}
          onPrev={deck.prev}
          onReading={deck.toggleReading}
          onFlag={deck.toggleFlag}
          onHangul={() => deck.toggleHangul(hangulBlocked)}
          onSkipAsk={askSkip}
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
        challengeNote={challengeNote}
      />
      <SkipConfirmSheet
        open={skipOpen}
        onConfirm={() => {
          setSkipFor(null)
          deck.skip()
        }}
        onClose={() => setSkipFor(null)}
      />
    </div>
  )
}
