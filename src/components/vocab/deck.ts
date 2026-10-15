/**
 * 오늘의 단어 덱의 순수 규칙(screens.md §5-2 B·C·D·§5-3 A). 화면·훅은 이 함수들만 부르고 판정을 직접 하지 않는다 —
 * 제스처 임계·키 매핑·요청 순서처럼 실기기에서만 드러나는 규칙을 단위 테스트로 묶어 두기 위해서다.
 *
 * **정답은 여기서 계산하지 않는다.** 보기의 정답 표시는 #50 응답의 `correctText` 로만 한다(§5-10).
 */
import { cpLength } from '@/components/common/format'
import type { VocabCard, VocabMode, VocabSessionInfo } from '@/types/vocab'

// ── 제스처(bjj SwipeCardDeck 이식, §5-2 C) ───────────────────────────────────────────────────

/** 탭: 이동 합이 이 값 **미만**. 위: dy 가 −UP 보다 **작을 때**. 좌우: |dx| 가 SIDE 보다 **클 때** — bjj 와 같은 부등호. */
export const TAP_MAX = 10
export const UP_MIN = 80
export const SIDE_MIN = 60
/** 움직일 수 없는 방향으로 끌 때 따라오는 비율 */
export const RESIST = 0.25
export const FLY_MS = 180
/**
 * 다음 카드로 넘어갈 때 카드가 날아가는 곳 — **오른쪽**(task-070: 다음 카드로 가는 제스처가 오른쪽 밀기라 손가락 방향과 일치).
 * 버튼·키로 넘어가도 같은 방향으로 통일한다. reduced-motion 은 `SwipeCardStack` 이 이 값을 쓰지 않고 투명도만 바꾼다.
 */
export const FLY_OUT_TRANSFORM = 'translateX(120%) rotate(8deg)'

export type Gesture = 'tap' | 'up' | 'left' | 'right' | 'none'

/** bjj 판정 순서 그대로: 탭 → 위 → 좌우. 대각선 위(dy −100, dx −100)는 위가 이긴다. */
export function classifyGesture(dx: number, dy: number): Gesture {
  if (Math.abs(dx) + Math.abs(dy) < TAP_MAX) return 'tap'
  if (dy < -UP_MIN) return 'up'
  if (Math.abs(dx) > SIDE_MIN) return dx < 0 ? 'left' : 'right'
  return 'none'
}

/**
 * 드래그 표시 x(task-070). 왼쪽 = 이전 카드(첫 카드면 저항), 오른쪽 = 다음 카드·결과 또는 건너뛰기 확인 — 그쪽으로 갈 수 없는 상태면
 * ×0.25 만 따라온다. `canLeft`/`canRight` 는 `canPrev`·`cardFirst.canSwipeRight` 가 정한다(여기서 상태를 직접 보지 않는다).
 */
export function resistX(x: number, canLeft: boolean, canRight: boolean): number {
  if (x < 0 && !canLeft) return x * RESIST
  if (x > 0 && !canRight) return x * RESIST
  return x
}

/** 이전 카드가 있는가(왼쪽 밀기·← ·[이전]). 첫 카드면 없다. */
export function canPrev(view: number): boolean {
  return view > 0
}

// ── 카드 상태 ───────────────────────────────────────────────────────────────────────────────

export function isAnswered(c: Pick<VocabCard, 'answered' | 'answer'> | undefined): boolean {
  return !!c && (c.answered || c.answer != null)
}

/** 첫 안 답한 카드(모두 답했으면 cardCount). 답은 늘 이 카드에서만 받는다. */
export function frontierOf(cards: readonly Pick<VocabCard, 'answered' | 'answer'>[]): number {
  const i = cards.findIndex((c) => !isAnswered(c))
  return i === -1 ? cards.length : i
}

export function canNext(cards: readonly Pick<VocabCard, 'answered' | 'answer'>[], view: number): boolean {
  return view >= 0 && view + 1 < cards.length && isAnswered(cards[view])
}

/** FLIP 에서 답하기 전에 뒤집어 볼 수 있는가(F1 — FLIP 카드는 뜻을 처음부터 싣는다). 없으면 대체 흐름(§5-2 D). */
export function canPeek(mode: VocabMode, card: Pick<VocabCard, 'meaning'> | undefined): boolean {
  return mode === 'FLIP' && !!card?.meaning
}

export type CardSide = 'front' | 'back'

export function cardSide(mode: VocabMode, card: Pick<VocabCard, 'answered' | 'answer'> | undefined, flipped: boolean): CardSide {
  if (isAnswered(card)) return 'back'
  return mode === 'FLIP' && flipped ? 'back' : 'front'
}

export interface Tally {
  answered: number
  correct: number
  wrong: number
  skipped: number
  flagged: number
}

export function tallyCards(cards: readonly Pick<VocabCard, 'answered' | 'answer' | 'flagged'>[]): Tally {
  const t: Tally = { answered: 0, correct: 0, wrong: 0, skipped: 0, flagged: 0 }
  for (const c of cards) {
    if (c.flagged) t.flagged++
    if (!isAnswered(c)) continue
    t.answered++
    if (c.answer === 'CORRECT') t.correct++
    else if (c.answer === 'WRONG') t.wrong++
    else if (c.answer === 'SKIPPED') t.skipped++
  }
  return t
}

// ── 보기 표시(§5-2 B ChoiceList) ─────────────────────────────────────────────────────────────

export type ChoiceMark = 'idle' | 'pending' | 'correct' | 'mine' | 'other' | 'dim'

/**
 * 보기 한 칸의 모양. 정답은 **응답의 `correctText` 와 같은 보기**다(E6 로 보기 4개의 뜻은 서로 다르다).
 * 답하기 전·응답 대기 중에는 정답을 표시하지 않는다.
 */
export function markChoice(
  choice: string,
  card: Pick<VocabCard, 'answered' | 'answer' | 'correctText' | 'chosenText'>,
  pendingChosen: string | null,
): ChoiceMark {
  if (!isAnswered(card)) {
    if (pendingChosen === null) return 'idle'
    return choice === pendingChosen ? 'pending' : 'dim'
  }
  if (card.correctText != null && choice === card.correctText) return 'correct'
  if (card.answer === 'WRONG' && card.chosenText != null && choice === card.chosenText) return 'mine'
  return 'other'
}

// ── 크기·시간 ────────────────────────────────────────────────────────────────────────────────

/** 앞면 표현 글자 크기(코드포인트 기준). 최소 22px. */
export function surfaceSize(s: string): string {
  const n = cpLength(s)
  if (n <= 3) return 'text-[40px]'
  if (n <= 6) return 'text-[34px]'
  if (n <= 10) return 'text-[28px]'
  return 'text-[22px]'
}

export const RESPONSE_MS_MAX = 60_000

/** 서버 범위 0~60,000 밖은 400 이라 반드시 자른다(§5-2 D). */
export function clampResponseMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.min(RESPONSE_MS_MAX, Math.round(ms))
}

/** 카드 12초 + 결과 30초(§7-2) */
export function estimateMinutes(n: number): number {
  return Math.round((n * 12 + 30) / 60)
}

export const COUNT_PRESETS = [5, 10, 15, 20, 30] as const

/** `[5,10,15,20,30] ∪ {dailyWordCount}` 오름차순(5~30 밖은 버린다). */
export function countOptions(daily: number): number[] {
  const set = new Set<number>(COUNT_PRESETS)
  if (Number.isInteger(daily) && daily >= 5 && daily <= 30) set.add(daily)
  return Array.from(set).sort((a, b) => a - b)
}

// ── 키보드(§5-2 C 표) ────────────────────────────────────────────────────────────────────────

export interface KeyLike {
  key: string
  code?: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  repeat?: boolean
  isComposing?: boolean
  /** 이벤트 대상 태그(소문자) */
  targetTag?: string
  targetEditable?: boolean
}

export interface KeyContext {
  sheetOpen: boolean
  mode: VocabMode
  /** 지금 보는 카드가 답할 차례인 카드인가(`view === frontier`) */
  isCurrent: boolean
  answered: boolean
  side: CardSide
  peekable: boolean
  /** 초점이 버튼·링크에 있음 — Space/Enter 는 그 요소의 클릭에 맡긴다(이중 실행 방지) */
  focusOnControl: boolean
  /**
   * 카드 우선 세트(task-059)의 보기 상태 — `cardFirst.choicesState`. 생략·'none' 이면 지금 동작 그대로.
   * 'closed' 면 C 로 열고, 'open' 이면 1~4 가 보기를 고르고 C 로 닫으며 Space·Enter 는 무시한다.
   */
  choices?: 'none' | 'closed' | 'open'
}

export type KeyIntent =
  | { type: 'choose'; index: number }
  | { type: 'self'; result: 'CORRECT' | 'WRONG' }
  | { type: 'flip' }
  | { type: 'advance' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'flag' }
  /** R — 앞면 히라가나(루비)만 */
  | { type: 'reading' }
  /** H — 앞면 한글 표기 줄만(task-060) */
  | { type: 'hangul' }
  /** S — 건너뛰기 **확인 시트 열기**(바로 건너뛰지 않는다, task-060) */
  | { type: 'skipAsk' }
  | { type: 'choices' }

const EDITABLE_TAGS = new Set(['input', 'textarea', 'select'])

function digitOf(e: KeyLike): number | null {
  const m = /^Digit([1-4])$/.exec(e.code ?? '') ?? /^Numpad([1-4])$/.exec(e.code ?? '')
  if (m) return Number(m[1])
  if (/^[1-4]$/.test(e.key)) return Number(e.key)
  return null
}

/** 한글 자판에서도 같은 자리(F=ㄹ, R=ㄱ, S=ㄴ, C=ㅊ, H=ㅗ)가 먹게 `code` 를 먼저 본다. */
function letterIs(e: KeyLike, letter: 'F' | 'R' | 'S' | 'C' | 'H'): boolean {
  return e.code === `Key${letter}` || e.key.toUpperCase() === letter
}

export function keyAction(e: KeyLike, ctx: KeyContext): KeyIntent | null {
  if (ctx.sheetOpen || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null
  if (e.targetEditable || (e.targetTag && EDITABLE_TAGS.has(e.targetTag))) return null

  const choices = ctx.choices ?? 'none'
  const digit = digitOf(e)
  if (digit !== null) {
    if (!ctx.isCurrent || ctx.answered) return null
    if (ctx.mode === 'CHOICE') return { type: 'choose', index: digit - 1 }
    if (choices === 'open') return { type: 'choose', index: digit - 1 }
    // FLIP: 뒷면(또는 대체 흐름의 앞면)에서만 1=알았어요 · 2=몰랐어요
    if (ctx.side === 'back' || !ctx.peekable) {
      if (digit === 1) return { type: 'self', result: 'CORRECT' }
      if (digit === 2) return { type: 'self', result: 'WRONG' }
    }
    return null
  }

  if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
    if (ctx.focusOnControl) return null
    if (ctx.answered) return { type: 'advance' }
    if (choices === 'open') return null
    if (ctx.mode === 'FLIP' && ctx.isCurrent && ctx.side === 'front' && ctx.peekable) return { type: 'flip' }
    return null
  }
  if (letterIs(e, 'C')) {
    if (choices === 'none' || ctx.mode !== 'FLIP') return null
    return ctx.isCurrent && !ctx.answered && ctx.side === 'front' ? { type: 'choices' } : null
  }
  if (e.key === 'ArrowRight') return { type: 'next' }
  if (e.key === 'ArrowLeft') return { type: 'prev' }
  // 표시(★)는 [표시]·F 로만(task-060 — 위로 밀기를 뜻 보기에 넘겨 ↑ 짝도 뗐다).
  if (letterIs(e, 'F')) return { type: 'flag' }
  if (letterIs(e, 'R')) return { type: 'reading' }
  if (letterIs(e, 'H')) return { type: 'hangul' }
  if (letterIs(e, 'S')) return ctx.isCurrent && !ctx.answered ? { type: 'skipAsk' } : null
  return null
}

// ── 앞면 [읽기]·[한글] 선택값(task-060) ─────────────────────────────────────────────────────

export type OnOff = 'on' | 'off'

const asOnOff = (v: string | null | undefined): OnOff | null => (v === 'on' || v === 'off' ? v : null)

/**
 * [한글] 선택값 — 자기 저장값이 있으면 그 값, 없으면(새 키 도입 전 사용자) [읽기] 저장값을 이어받고, 그것도 없으면 켬.
 * 옛 [읽기]는 히라가나와 한글을 함께 켰으므로 [읽기]를 꺼 둔 사용자의 앞면이 갑자기 바뀌지 않게 한다.
 */
export function hangulPrefOf(own: string | null, reading: string | null): OnOff {
  return asOnOff(own) ?? asOnOff(reading) ?? 'on'
}

/**
 * [읽기]·[한글]을 누를 때 저장할 값. 둘은 독립이다 — 단 한글 키가 비어 있어 [읽기] 값을 이어받는 중이면, [읽기]를 누르기 전에
 * 지금 보이는 한글 값을 먼저 굳힌다(안 그러면 [읽기]를 누르는 순간 한글도 같이 바뀐다).
 */
export function displayToggleWrites(
  which: 'reading' | 'hangul',
  s: { hangulStored: boolean; showReading: boolean; showHangul: boolean },
): { reading?: OnOff; hangul?: OnOff } {
  if (which === 'hangul') return { hangul: s.showHangul ? 'off' : 'on' }
  const reading: OnOff = s.showReading ? 'off' : 'on'
  return s.hangulStored ? { reading } : { reading, hangul: s.showHangul ? 'on' : 'off' }
}

// ── 요청 큐·타이머 ───────────────────────────────────────────────────────────────────────────

/**
 * 세션당 한 줄 큐(§5-3 A). #50·#51 을 누른 순서대로 하나씩 보낸다 — finish 가 마지막 답보다 먼저 도착하면
 * 그 답이 SKIPPED 로 굳는다. 앞 요청이 실패해도 뒤 요청은 보낸다(실패 처리는 각 호출부).
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const p = tail.then(task)
      tail = p.catch(() => undefined)
      return p
    },
    idle(): Promise<void> {
      return tail.then(() => undefined)
    },
  }
}

/** 보이는 동안만 쌓는 스톱워치(`responseMs`). `now` 는 테스트가 주입한다. */
export function createStopwatch(now: () => number) {
  let acc = 0
  let since: number | null = null
  return {
    start() {
      if (since === null) since = now()
    },
    stop() {
      if (since !== null) {
        acc += now() - since
        since = null
      }
    },
    reset() {
      acc = 0
      since = null
    },
    elapsed(): number {
      return acc + (since !== null ? now() - since : 0)
    },
    get running() {
      return since !== null
    },
  }
}

// ── 알림 줄(§5-2 B DeckNotice) ──────────────────────────────────────────────────────────────

export type DeckNotice =
  | { kind: 'few' }
  | { kind: 'deleted' }
  | { kind: 'fewer'; cardCount: number }
  | { kind: 'resume'; answered: number }
  | { kind: 'pastDate'; date: string }
  /** 주제 세트 폴백 사유(task-044 — #47 직후 첫 열기만, 문구는 `topicLogic.topicReasonNotice`). */
  | { kind: 'topicReason'; text: string }
  /** 보기를 하나도 만들지 못한 카드 우선 세트(task-059 — 세트를 만든 화면이 남긴 값으로만, `cardFirst.isNoChoiceSet`). */
  | { kind: 'noChoice' }

/**
 * 우선순위대로 하나만(few/deleted/noChoice > topicReason > fewer > resume > pastDate). `stored` 는 세트를 만든 화면이 sessionStorage 에 남긴 강등·보기 없음 사유
 * (없으면 서버 `downgraded` 로 대신 판단). `topicReason` 은 주제 세트의 폴백 사유 문구(없으면 null).
 */
export function pickNotice(
  session: Pick<VocabSessionInfo, 'cardCount' | 'requestedCount' | 'downgraded' | 'replayOfId' | 'date'>,
  answered: number,
  stored: 'few' | 'deleted' | 'noChoice' | null,
  today: string,
  topicReason: string | null = null,
): DeckNotice | null {
  const fresh = answered === 0
  if (stored === 'few' || stored === 'deleted' || stored === 'noChoice') return { kind: stored }
  if (fresh && session.downgraded) return { kind: session.replayOfId ? 'deleted' : 'few' }
  if (fresh && topicReason) return { kind: 'topicReason', text: topicReason }
  if (fresh && session.cardCount < session.requestedCount) return { kind: 'fewer', cardCount: session.cardCount }
  if (answered > 0) return { kind: 'resume', answered }
  if (today && session.date && session.date !== today) return { kind: 'pastDate', date: session.date }
  return null
}
