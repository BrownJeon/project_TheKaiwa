'use client'

/**
 * 오늘의 단어 덱 상태(screens.md §5-3 A). 덱은 #47 응답을 넘겨받지 않고 **늘 #49 로 읽는다**(새로고침·이어 풀기·다른 기기와 같은 경로).
 *
 * - 답은 늘 `frontier`(첫 안 답한 카드)에서만 받는다 → 답한 카드는 언제나 앞쪽에 모인다. 지난 카드는 읽기 전용.
 * - **채점은 #50 응답으로만** 그린다(낙관적 채점 금지). 먼저 그리는 것은 표시(★)·읽기 토글뿐이고 실패하면 되돌린다(§5-10).
 * - #50·#51 은 `useAttemptQueue` 한 줄 큐로 보낸다. 언마운트해도 큐는 끝까지 보내고 화면 갱신만 막는다(`alive`).
 * - 답 0장 끝내기는 서버가 `ABANDONED`(기록 없음, F2)로 닫는다 → 오늘 홈으로 돌아가 안내한다.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import type { AttemptResult, FinishResult, FlagResult, SessionDetail, VocabCard, VocabSessionInfo } from '@/types/vocab'
import {
  canPeek,
  cardSide,
  clampResponseMs,
  FLY_MS,
  frontierOf,
  isAnswered,
  pickNotice,
  type DeckNotice,
} from './deck'
import { todayKey } from './format'
import { putSession, takeSession, useMediaQuery, useStoredPref, VOCAB_KEYS } from './hooks'
import { FLASH, HINT } from './labels'
import { useAttemptQueue } from './useAttemptQueue'
import { useCardTimer } from './useCardTimer'

export type DeckPhase = 'loading' | 'playing' | 'finishing' | 'result' | 'closed' | 'notFound' | 'error'

export interface DeckCard extends VocabCard {
  /** 이 카드의 답 요청이 큐에 있다 */
  pending?: boolean
  /** 누른 것: CHOICE 보기 글 · FLIP 'CORRECT'|'WRONG' · 건너뛰기 SKIP */
  chosen?: string | null
  /** FLIP 앞면을 뒤집어 봤다(로컬) */
  flipped?: boolean
}

export const SKIP = '__skip'
const HINT_MS = 2000
const FLIP_AUTO_NEXT_MS = 400

/** 스크린리더 알림(표현은 `lang=ja` 로 따로 감싼다) */
export interface Announce {
  seq: number
  before: string
  ja?: string
  after?: string
}

export type FocusTarget = { seq: number; kind: 'next' | 'first' }

function toDeckCards(cards: VocabCard[]): DeckCard[] {
  return (cards ?? []).map((c) => ({ ...c, pending: false, chosen: null, flipped: false }))
}

export function useVocabDeck(sessionId: string) {
  const router = useRouter()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [readingPref, setReadingPref] = useStoredPref<'on' | 'off'>(VOCAB_KEYS.readingDefault, 'on', ['on', 'off'])
  const showReading = readingPref !== 'off'

  const [phase, setPhase] = useState<DeckPhase>('loading')
  const [session, setSession] = useState<VocabSessionInfo | null>(null)
  const [cards, setCards] = useState<DeckCard[]>([])
  const [view, setView] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [notice, setNotice] = useState<DeckNotice | null>(null)
  const [today, setToday] = useState('')
  const [finishResult, setFinishResult] = useState<FinishResult | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [announce, setAnnounce] = useState<Announce>({ seq: 0, before: '' })
  const [focus, setFocus] = useState<FocusTarget>({ seq: 0, kind: 'first' })

  const { send, finish } = useAttemptQueue(sessionId)
  const alive = useRef(true)
  const phaseRef = useRef(phase)
  const cardsRef = useRef(cards)
  const viewRef = useRef(view)
  const exitingRef = useRef(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const base = `/api/v1/vocab/sessions/${encodeURIComponent(sessionId)}`

  useEffect(() => {
    phaseRef.current = phase
    cardsRef.current = cards
    viewRef.current = view
  }, [phase, cards, view])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (hintTimer.current) clearTimeout(hintTimer.current)
      // 답은 누를 때마다 저장돼 있다. 오늘 홈이 "풀던 세트는 저장했어요"로 이어 풀기를 안내한다(뒤로가기를 막지 않는다).
      if (phaseRef.current === 'playing') putSession(VOCAB_KEYS.flash, FLASH.left)
    }
  }, [])

  const showHint = useCallback((msg: string) => {
    setHint(msg)
    if (hintTimer.current) clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(null), HINT_MS)
  }, [])

  const say = useCallback((before: string, ja?: string, after?: string) => {
    setAnnounce((a) => ({ seq: a.seq + 1, before, ja, after }))
  }, [])

  const patchCard = useCallback((i: number, patch: Partial<DeckCard>) => {
    setCards((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }, [])

  const apply = useCallback(
    (d: SessionDetail, kind: 'initial' | 'refresh', flashOnDone?: string) => {
      if (!alive.current) return
      // 다시 맞출 때도 뒤집어 본 카드는 뒤집힌 채로 둔다(로컬 상태)
      const flippedBefore = new Set(kind === 'refresh' ? cardsRef.current.filter((c) => c.flipped).map((c) => c.order) : [])
      const next = toDeckCards(d.cards).map((c) => (flippedBefore.has(c.order) ? { ...c, flipped: true } : c))
      const t = todayKey()
      setToday(t)
      setSession(d.session)
      setCards(next)
      if (d.session.status === 'DONE') {
        if (flashOnDone) setFlash(flashOnDone)
        setPhase('result')
        return
      }
      if (d.session.status === 'ABANDONED') {
        setPhase('closed')
        return
      }
      const f = frontierOf(next)
      const last = Math.max(0, next.length - 1)
      if (kind === 'initial') {
        const v = Math.min(f, last)
        setView(v)
        const stored = takeSession(VOCAB_KEYS.notice(d.session.id))
        const answered = next.filter((c) => isAnswered(c)).length
        setNotice(pickNotice(d.session, answered, stored === 'few' || stored === 'deleted' ? stored : null, t))
        if (next[v]) say(`${v + 1}번째 카드, `, next[v].surface)
        setFocus((x) => ({ seq: x.seq + 1, kind: 'first' }))
      } else {
        setView((v) => Math.min(v, f, last))
      }
      setPhase('playing')
    },
    [say],
  )

  const fail = useCallback(
    (e: unknown, kind: 'initial' | 'refresh') => {
      if (!alive.current) return
      const err = toErr(e)
      if (err.status === 404) setPhase('notFound')
      else if (kind === 'initial') setPhase('error')
      else showHint(HINT.saveFailed)
    },
    [showHint],
  )

  /** #49 를 읽어 화면을 맞춘다. `initial` 이면 볼 카드·알림을 새로 정하고, 아니면 보던 자리를 지킨다. */
  const load = useCallback(
    (kind: 'initial' | 'refresh', flashOnDone?: string) =>
      apiGet<SessionDetail>(base).then(
        (d) => apply(d, kind, flashOnDone),
        (e: unknown) => fail(e, kind),
      ),
    [apply, base, fail],
  )

  useEffect(() => {
    apiGet<SessionDetail>(base).then(
      (d) => apply(d, 'initial'),
      (e: unknown) => fail(e, 'initial'),
    )
  }, [apply, base, fail])

  // 다른 기기에서 풀었거나 끝냈을 수 있다 — 돌아오면 조용히 맞춘다(보내는 중인 요청이 있으면 건너뜀).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (phaseRef.current !== 'playing' || cardsRef.current.some((c) => c.pending)) return
      void load('refresh')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  // 이어 풀기 알림은 4초 뒤 스스로 닫힌다
  useEffect(() => {
    if (notice?.kind !== 'resume') return
    const id = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(id)
  }, [notice])

  const mode = session?.mode ?? 'CHOICE'
  const n = cards.length
  const frontier = frontierOf(cards)
  const card = cards[view]
  const isCurrent = view === frontier
  const answered = isAnswered(card)
  const peekable = canPeek(mode, card)
  const side = cardSide(mode, card, !!card?.flipped)
  const timerRunning = phase === 'playing' && isCurrent && frontier < n && !cards[frontier]?.pending && !exiting
  const elapsed = useCardTimer(frontier, timerRunning)

  const goTo = useCallback(
    (target: number) => {
      setView(target)
      const c = cardsRef.current[target]
      if (c) say(`${target + 1}번째 카드, `, c.surface)
      setFocus((x) => ({ seq: x.seq + 1, kind: isAnswered(c) ? 'next' : 'first' }))
    },
    [say],
  )

  const doFinish = useCallback(async () => {
    if (phaseRef.current !== 'playing') return
    setPhase('finishing')
    phaseRef.current = 'finishing'
    setFinishError(null)
    try {
      const r = await finish()
      if (!alive.current) return
      if (r.session.status === 'ABANDONED') {
        phaseRef.current = 'closed'
        setPhase('closed')
        putSession(VOCAB_KEYS.flash, FLASH.closed)
        router.replace('/study/today')
        return
      }
      setFinishResult(r)
      setSession((s) => (s ? { ...s, ...r.session } : s))
      try {
        const d = await apiGet<SessionDetail>(base)
        if (!alive.current) return
        setSession({ ...d.session, durationSec: d.session.durationSec ?? r.session.durationSec })
        setCards(toDeckCards(d.cards))
      } catch {
        /* 카드 목록은 지금 가진 값으로 그린다(개수·시간은 #51 응답) */
      }
      setPhase('result')
    } catch (e) {
      if (!alive.current) return
      const err = toErr(e)
      if (err.status === 404) {
        setPhase('notFound')
        return
      }
      phaseRef.current = 'playing'
      setPhase('playing')
      setFinishError(HINT.finishFailed)
      showHint(HINT.finishFailed)
    }
  }, [base, finish, router, showHint])

  /** 다음 카드(왼쪽 밀기·→·[다음 카드]). 답하기 전이면 막고 안내, 마지막 카드를 답했으면 결과. */
  const next = useCallback(() => {
    if (phaseRef.current !== 'playing' || exitingRef.current) return
    const cs = cardsRef.current
    const v = viewRef.current
    if (!isAnswered(cs[v])) {
      showHint(mode === 'FLIP' ? HINT.selfFirst : HINT.answerFirst)
      return
    }
    if (v + 1 >= cs.length) {
      void doFinish()
      return
    }
    exitingRef.current = true
    setExiting(true)
    setTimeout(
      () => {
        exitingRef.current = false
        if (!alive.current) return
        setExiting(false)
        goTo(v + 1)
      },
      reducedMotion ? 120 : FLY_MS,
    )
  }, [doFinish, goTo, mode, reducedMotion, showHint])

  const prev = useCallback(() => {
    if (phaseRef.current !== 'playing' || exitingRef.current) return
    const v = viewRef.current
    if (v <= 0) {
      showHint(HINT.firstCard)
      return
    }
    goTo(v - 1)
  }, [goTo, showHint])

  const onAnswered = useCallback(
    (i: number, r: AttemptResult, kind: 'choice' | 'self' | 'skip') => {
      if (!alive.current) return
      const before = cardsRef.current[i]
      patchCard(i, {
        answered: true,
        answer: r.answer,
        correctText: r.correctText ?? before?.correctText ?? before?.meaning ?? null,
        chosenText: r.chosenText ?? null,
        example: r.example ?? before?.example ?? null,
        exampleKo: r.exampleKo ?? before?.exampleKo ?? null,
        answeredAt: r.answeredAt ?? null,
        pending: false,
        chosen: null,
        flipped: true,
      })
      const correct = r.correctText ?? before?.meaning ?? ''
      if (r.answer === 'SKIPPED') say(`건너뛴 카드. 정답 ${correct}`)
      else if (kind === 'self') say(r.answer === 'CORRECT' ? '알았어요로 기록했어요' : '몰랐어요로 기록했어요')
      else say(`${r.answer === 'CORRECT' ? '맞았어요' : '틀렸어요'}. 정답 ${correct}`)
      setFocus((x) => ({ seq: x.seq + 1, kind: 'next' }))
      // FLIP 자기 채점은 뒷면을 이미 봤으므로 결과 띠를 잠깐 보이고 다음 카드로 넘어간다(§5-0 6).
      if (kind === 'self' && i + 1 < cardsRef.current.length) {
        setTimeout(() => {
          if (alive.current && viewRef.current === i) next()
        }, FLIP_AUTO_NEXT_MS)
      }
    },
    [next, patchCard, say],
  )

  const onAttemptFailed = useCallback(
    (i: number, e: unknown) => {
      if (!alive.current) return
      const err = toErr(e)
      patchCard(i, { pending: false, chosen: null })
      if (err.status === 404) {
        setPhase('notFound')
        return
      }
      // 409 = 이미 끝난 세트(다른 기기) · 400 = 보기 스냅샷 불일치 방어 → 서버 상태로 다시 맞춘다
      if (err.status === 409 || err.status === 400) {
        void load('refresh', err.status === 409 ? FLASH.alreadyDone : undefined)
        return
      }
      showHint(HINT.saveFailed)
    },
    [load, patchCard, showHint],
  )

  const answerGuard = (): { i: number; c: DeckCard } | null => {
    if (phase !== 'playing' || exiting) return null
    const i = frontier
    if (view !== i) return null
    const c = cards[i]
    if (!c || isAnswered(c) || c.pending) return null
    return { i, c }
  }

  const choose = (text: string) => {
    if (mode !== 'CHOICE') return
    const g = answerGuard()
    if (!g) return
    const responseMs = clampResponseMs(elapsed())
    patchCard(g.i, { pending: true, chosen: text })
    send<AttemptResult>({ order: g.c.order, chosenText: text, responseMs, flagged: g.c.flagged })
      .then((r) => onAnswered(g.i, r, 'choice'))
      .catch((e: unknown) => onAttemptFailed(g.i, e))
  }

  const selfGrade = (result: 'CORRECT' | 'WRONG') => {
    if (mode !== 'FLIP') return
    const g = answerGuard()
    if (!g) return
    // 뜻을 볼 수 있는 카드는 뒤집은 뒤에만 채점한다(버튼도 뒷면에만 있다 — 키보드 1·2 방어).
    if (canPeek(mode, g.c) && !g.c.flipped) return
    const responseMs = clampResponseMs(elapsed())
    patchCard(g.i, { pending: true, chosen: result })
    send<AttemptResult>({ order: g.c.order, selfResult: result, responseMs })
      .then((r) => onAnswered(g.i, r, 'self'))
      .catch((e: unknown) => onAttemptFailed(g.i, e))
  }

  const skip = () => {
    const g = answerGuard()
    if (!g) return
    patchCard(g.i, { pending: true, chosen: SKIP })
    send<AttemptResult>({ order: g.c.order, skipped: true })
      .then((r) => onAnswered(g.i, r, 'skip'))
      .catch((e: unknown) => onAttemptFailed(g.i, e))
  }

  const flip = () => {
    if (phase !== 'playing' || !card || answered || !peekable || card.flipped) return
    patchCard(view, { flipped: true })
    setFocus((x) => ({ seq: x.seq + 1, kind: 'first' }))
  }

  /** 표시(★) — 사용자 직접 행위라 먼저 그리고, 실패하면 되돌린다. 어느 카드든(E2 표시 전용 요청). */
  const toggleFlag = () => {
    if (phase !== 'playing' || !card) return
    const i = view
    const nextFlag = !card.flagged
    patchCard(i, { flagged: nextFlag })
    showHint(nextFlag ? HINT.flagged : HINT.unflagged)
    send<FlagResult>({ order: card.order, flagged: nextFlag }).catch((e: unknown) => {
      if (!alive.current) return
      const err = toErr(e)
      if (err.status === 409) {
        void load('refresh', FLASH.alreadyDone)
        return
      }
      setCards((cs) => cs.map((c, j) => (j === i && c.flagged === nextFlag ? { ...c, flagged: !nextFlag } : c)))
      showHint(HINT.flagFailed)
    })
  }

  const closeNotice = useCallback(() => setNotice(null), [])
  const clearFlash = useCallback(() => setFlash(null), [])
  const reload = useCallback(() => {
    setPhase('loading')
    void load('initial')
  }, [load])

  const toggleReading = () => {
    if (!card?.reading || card.reading === card.surface) {
      showHint(HINT.noReading)
      return
    }
    setReadingPref(showReading ? 'off' : 'on')
  }

  return {
    sessionId,
    phase,
    session,
    setSession,
    cards,
    view,
    frontier,
    card,
    mode,
    isCurrent,
    answered,
    peekable,
    side,
    exiting,
    reducedMotion,
    showReading,
    hint,
    showHint,
    notice,
    closeNotice,
    today,
    finishResult,
    finishError,
    flash,
    clearFlash,
    announce,
    focus,
    reload,
    choose,
    selfGrade,
    skip,
    flip,
    toggleFlag,
    toggleReading,
    next,
    prev,
    finish: doFinish,
  }
}

export type VocabDeckState = ReturnType<typeof useVocabDeck>
