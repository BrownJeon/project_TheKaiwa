/**
 * 카드 우선 덱(task-059, screens.md §23)의 순수 규칙·문구 단일 출처. 덱·오늘 홈·결과 화면은 카드의 상태(보기가 있는지, 어떻게 답했는지)를
 * 직접 판정하지 않고 이 함수들만 부른다 — 세트 하나에 객관식(서버 채점)과 스스로 표시가 섞여(Q9) `session.mode` 하나로는 가를 수 없기 때문이다.
 *
 * - 카드 우선 세트 = `mode==='FLIP'` + 카드마다 `choices`. 이전 4지선다 세트 = `mode==='CHOICE'`. 보기 없는 `FLIP` 세트는 이전 뒤집기 세트와 구분하지 않는다(Leader 결정 1).
 * - **정답은 여기서 계산하지 않는다.** 보기의 ✓/✗ 는 #50 응답 `correctText` 로만 그린다(`deck.markChoice`).
 * - 문구는 승인 데모 v1 원문 그대로다(§23-8). 엔진·서버 이름은 넣지 않는다.
 */
import type { VocabCard, VocabMode, VocabSessionInfo } from '@/types/vocab'
import { isAnswered, type CardSide } from './deck'
import { HINT, MODE_LABEL } from './labels'
import { soundText, type SoundMsgKind, type SoundTarget, type WordSoundState } from './wordSound'

// ── 판별 ────────────────────────────────────────────────────────────────────────────────────

/** 카드에 객관식 보기가 있는가. `undefined`(이전 뒤집기 세트)·`null`(보기 없는 새 세트)·`[]` 모두 없음. */
export function hasChoices(card: Pick<VocabCard, 'choices'> | null | undefined): boolean {
  return !!card && Array.isArray(card.choices) && card.choices.length > 0
}

export type AnswerMethod = 'choice' | 'self' | 'skip'

/** 이 카드를 어떻게 답했는가(안 답함 = null). `FLIP` 세트에서는 `chosenText` 가 있으면 객관식으로 답한 카드다. */
export function answeredBy(card: Pick<VocabCard, 'answered' | 'answer' | 'chosenText'> | null | undefined, mode: VocabMode): AnswerMethod | null {
  if (!card || !isAnswered(card)) return null
  if (card.answer === 'SKIPPED') return 'skip'
  if (mode === 'CHOICE') return 'choice'
  return card.chosenText != null ? 'choice' : 'self'
}

/**
 * 보기를 하나도 만들지 못한 `FLIP` 세트인가(#47·#53 응답 그대로 넘긴다 — 빈 세트 응답은 false).
 * 세트를 만든 화면이 이 값으로 덱 알림 `noChoice` 를 남긴다(§23-4 D).
 */
export function isNoChoiceSet(r: {
  session?: Pick<VocabSessionInfo, 'mode'> | null
  cards?: readonly Pick<VocabCard, 'choices'>[] | null
}): boolean {
  const cards = r.cards ?? []
  return r.session?.mode === 'FLIP' && cards.length > 0 && cards.every((c) => !hasChoices(c))
}

/** 키 문맥의 보기 상태 — 카드 우선 세트의 지금 카드·안 답함·앞면일 때만 닫힘/열림, 그 밖은 'none'(지금 동작). */
export function choicesState(
  mode: VocabMode,
  card: (Pick<VocabCard, 'choices' | 'answered' | 'answer'> & { open?: boolean }) | null | undefined,
  side: CardSide,
): 'none' | 'closed' | 'open' {
  if (mode !== 'FLIP' || !card || isAnswered(card) || side !== 'front' || !hasChoices(card)) return 'none'
  return card.open ? 'open' : 'closed'
}

/**
 * 보기를 골라 #50 `chosenText` 를 보낼 수 있는 카드인가 — 이전 4지선다 세트, 또는 카드 우선 세트에서 보기를 연 카드(뜻을 보기 전).
 * 뜻 보기 면(`flipped`)에서는 보기를 열 수 없으므로 한 카드에 `chosenText`·`selfResult` 가 함께 가는 길이 없다.
 */
export function canChoose(mode: VocabMode, card: (Pick<VocabCard, 'choices'> & { open?: boolean; flipped?: boolean }) | null | undefined): boolean {
  if (mode === 'CHOICE') return true
  return mode === 'FLIP' && hasChoices(card) && !!card?.open && !card.flipped
}

/** 객관식 보기를 열고 닫을 수 있는 카드인가(카드 우선 세트·보기 있음·뜻을 보기 전). 지금 카드·안 답함·대기 아님은 덱이 따로 본다. */
export function canToggleChoices(mode: VocabMode, card: (Pick<VocabCard, 'choices'> & { flipped?: boolean }) | null | undefined): boolean {
  return mode === 'FLIP' && hasChoices(card) && !card?.flipped
}

// ── 방식 이름(이전 4지선다 세트에만 — Leader 결정 1) ─────────────────────────────────────────

/** 부제 앞자리 — 「4지선다 · 」 또는 빈 글. 덱·결과 부제, 풀던 세트 줄. */
export function modeTag(mode: VocabMode): string {
  return mode === 'CHOICE' ? `${MODE_LABEL.CHOICE} · ` : ''
}

/** 뒤에 붙는 자리 — 「 · 4지선다」 또는 빈 글. 보관 세트 줄. */
export function modeTagAfter(mode: VocabMode): string {
  return mode === 'CHOICE' ? ` · ${MODE_LABEL.CHOICE}` : ''
}

// ── 결과(D5) ────────────────────────────────────────────────────────────────────────────────

export interface MethodTally {
  /** 객관식으로 답한 카드(맞힘·틀림) */
  choice: number
  choiceCorrect: number
  /** 스스로 표시한 카드(알았어요·몰랐어요) */
  self: number
  selfCorrect: number
}

/** 방식별 장수. 건너뜀은 어느 쪽에도 세지 않는다. */
export function methodTally(cards: readonly Pick<VocabCard, 'answered' | 'answer' | 'chosenText'>[], mode: VocabMode): MethodTally {
  const t: MethodTally = { choice: 0, choiceCorrect: 0, self: 0, selfCorrect: 0 }
  for (const c of cards) {
    const by = answeredBy(c, mode)
    if (by === 'choice' && (c.answer === 'CORRECT' || c.answer === 'WRONG')) {
      t.choice++
      if (c.answer === 'CORRECT') t.choiceCorrect++
    } else if (by === 'self' && (c.answer === 'CORRECT' || c.answer === 'WRONG')) {
      t.self++
      if (c.answer === 'CORRECT') t.selfCorrect++
    }
  }
  return t
}

/** 객관식 답과 스스로 답이 한 세트에 섞였는가 — 결과 구분 한 줄·방식 뱃지는 이때만. */
export function isMixed(t: MethodTally): boolean {
  return t.choice >= 1 && t.self >= 1
}

/** 결과 구분 한 줄(섞였을 때만, 아니면 null). */
export function splitLine(t: MethodTally): string | null {
  return isMixed(t) ? CARD_FIRST.splitLine(t.choice, t.choiceCorrect, t.self, t.selfCorrect) : null
}

/** 결과 제목 동사 — 이전 4지선다 세트이거나 객관식 답이 하나라도 있으면 「맞혔어요」, 아니면 「알았어요」. */
export function resultVerb(cards: readonly Pick<VocabCard, 'answered' | 'answer' | 'chosenText'>[], mode: VocabMode): '맞혔어요' | '알았어요' {
  if (mode === 'CHOICE') return '맞혔어요'
  return cards.some((c) => answeredBy(c, mode) === 'choice') ? '맞혔어요' : '알았어요'
}

export type BadgeTone = 'good' | 'bad' | 'neutral'

/** 섞인 세트 결과 목록의 방식 뱃지(안 답함 = null). 객관식 오답의 「내 답」은 행 둘째 줄에 이미 있어 넣지 않는다. */
export function methodBadge(card: Pick<VocabCard, 'answered' | 'answer' | 'chosenText'>, mode: VocabMode): { text: string; tone: BadgeTone } | null {
  const by = answeredBy(card, mode)
  if (by === null) return null
  if (by === 'skip') return { text: CARD_FIRST.methodBadge.skipped, tone: 'neutral' }
  const ok = card.answer === 'CORRECT'
  if (by === 'choice') return ok ? { text: CARD_FIRST.methodBadge.choiceCorrect, tone: 'good' } : { text: CARD_FIRST.methodBadge.choiceWrong, tone: 'bad' }
  return ok ? { text: CARD_FIRST.methodBadge.selfCorrect, tone: 'good' } : { text: CARD_FIRST.methodBadge.selfWrong, tone: 'bad' }
}

// ── 덱: 탭·안내 ─────────────────────────────────────────────────────────────────────────────

export type TapAction = 'none' | 'reading' | 'choices' | 'flip'

/**
 * 카드 면 탭(10px 미만, 판정은 `SwipeCardStack` 그대로)이 할 일(§23-3 C). 뜻 보기 면·답한 카드·응답 대기 카드는 아무것도 하지 않는다 —
 * 뜻을 본 카드를 객관식으로 「맞히는」 길을 막는다.
 */
export function tapAction(s: {
  mode: VocabMode
  side: CardSide
  isCurrent: boolean
  answered: boolean
  pending: boolean
  hasChoices: boolean
  peekable: boolean
}): TapAction {
  if (s.side === 'back') return 'none'
  if (!s.isCurrent || s.answered || s.pending) return 'none'
  if (s.mode === 'CHOICE') return 'reading'
  if (s.hasChoices) return 'choices'
  if (s.peekable) return 'flip'
  return 'reading'
}

/** 앞면 아래 안내 한 줄(없으면 null). 이전 4지선다 세트·답한 카드에는 없다. */
export function frontHint(mode: VocabMode, card: Pick<VocabCard, 'choices' | 'answered' | 'answer'> & { open?: boolean }, peekable: boolean): string | null {
  if (mode !== 'FLIP' || isAnswered(card)) return null
  if (hasChoices(card)) return card.open ? CARD_FIRST.frontHintOpen : CARD_FIRST.frontHint
  return peekable ? CARD_FIRST.tapToPeek : CARD_FIRST.selfToPeek
}

/** 고정 힌트 한 줄(§23-8 ⑩⑪). 터치 기기는 제스처만, 정밀 포인터는 지금 카드 상태의 키. */
export function fixedHint(s: {
  coarse: boolean
  mode: VocabMode
  side: CardSide
  isCurrent: boolean
  answered: boolean
  open: boolean
  hasChoices: boolean
  peekable: boolean
}): string {
  if (s.coarse) return KEY_HINT.touch
  if (s.mode === 'CHOICE') return KEY_HINT.choice
  if (s.answered || !s.isCurrent) return KEY_HINT.done
  // 뜻 없는 카드(대체 흐름)는 앞면에서 바로 1·2 로 답한다 — 뜻 보기 면과 같은 키
  if (s.side === 'back' || !s.peekable) return KEY_HINT.self
  if (s.open) return KEY_HINT.open
  return s.hasChoices ? KEY_HINT.front : KEY_HINT.frontNoChoice
}

/** 안 답한 카드에서 다음으로 가려 할 때의 막힘 안내 — 카드마다 다르다(§23-3 B). */
export function blockedNextHint(
  mode: VocabMode,
  card: (Pick<VocabCard, 'choices'> & { open?: boolean; flipped?: boolean }) | null | undefined,
): string {
  if (mode === 'CHOICE' || !card) return HINT.answerFirst
  if (card.open) return HINT.answerFirst
  if (card.flipped) return HINT.selfFirst
  return hasChoices(card) ? CARD_FIRST.answerFirst : HINT.selfFirst
}

/** 힌트 줄 한 줄 — 빨강(`alert`)은 저장 실패·소리 실패만. */
export interface DeckHint {
  text: string
  tone: 'bad' | 'neutral'
}

const BAD_HINTS: ReadonlySet<string> = new Set([HINT.saveFailed, HINT.flagFailed, HINT.finishFailed])

/** 덱 힌트 문구 → 줄 모양(`HINT` 문구는 그대로 두고 저장 실패류만 빨강, §23-12 ⑩). */
export function deckHint(text: string): DeckHint {
  return { text, tone: BAD_HINTS.has(text) ? 'bad' : 'neutral' }
}

// ── 덱: 듣기 줄(D3, §23-5) ──────────────────────────────────────────────────────────────────

/** 듣기 버튼이 읽을 글(없거나 100자 초과면 그 버튼 없음). 표시 설정과 무관하게 같은 일본어를 읽는다(Leader 결정 6). */
export function listenTexts(card: Pick<VocabCard, 'surface' | 'example'>): { word: string | null; ex: string | null } {
  return { word: soundText(card.surface), ex: soundText(card.example) }
}

export type DeckSoundLook = 'idle' | 'loading' | 'on' | 'mute' | 'blocked' | 'fail'

export interface DeckSoundView {
  look: DeckSoundLook
  /** 보이는 글자 */
  text: string
  /** 보이는 글자와 다를 때만(불러오는 중·재생 중) — 그 밖은 보이는 글자가 접근 이름 */
  ariaLabel: string | undefined
  busy: boolean
  icon: 'play' | 'stop' | 'spin'
}

const WHAT: Record<SoundTarget, string> = { word: '단어', ex: '예문' }
const FAIL_KINDS: ReadonlySet<SoundMsgKind> = new Set(['fail', 'slow', 'offline'])

/** 듣기 버튼 하나의 모양(§23-5 A 6종). 소리는 한 번에 하나 — 다른 버튼이 소리 나는 중이면 이 버튼은 대기 모양이다. */
export function deckSoundView(s: WordSoundState, target: SoundTarget): DeckSoundView {
  const what = WHAT[target]
  const idleText = target === 'word' ? CARD_FIRST.listen.word : CARD_FIRST.listen.ex
  const phase = s.target === target ? s.phase : 'idle'
  if (phase === 'loading') return { look: 'loading', text: CARD_FIRST.listen.loading, ariaLabel: CARD_FIRST.listen.loadingLabel(what), busy: true, icon: 'spin' }
  if (phase === 'playing') return { look: 'on', text: CARD_FIRST.listen.stop, ariaLabel: CARD_FIRST.listen.stopLabel(what), busy: false, icon: 'stop' }
  if (phase === 'blocked') return { look: 'blocked', text: idleText, ariaLabel: undefined, busy: false, icon: 'play' }
  const msg = s.msg && s.msg.target === target ? s.msg.kind : null
  const look: DeckSoundLook = msg === 'textonly' ? 'mute' : msg && FAIL_KINDS.has(msg) ? 'fail' : 'idle'
  return { look, text: idleText, ariaLabel: undefined, busy: false, icon: 'play' }
}

/** 소리 안내 → 힌트 줄(뜻 보기 면일 때만). 덱 막힘 힌트가 있으면 화면이 그쪽을 먼저 쓴다. */
export function deckSoundMessage(s: WordSoundState, side: CardSide): DeckHint | null {
  if (side !== 'back' || !s.msg) return null
  return DECK_SOUND_MSG[s.msg.kind]
}

/** 듣기 줄의 화면 읽기 한 줄 — 재생 중일 때만. */
export function deckSoundLive(s: WordSoundState): string {
  return s.target && s.phase === 'playing' ? CARD_FIRST.sr.playing(WHAT[s.target]) : ''
}

/** 같은 버튼을 받는 중·재생 중에 다시 누름 = 취소·멈춤(이때 덱이 「소리를 멈췄어요」를 알린다). */
export function isSoundStopTap(s: WordSoundState, target: SoundTarget): boolean {
  return s.target === target && (s.phase === 'loading' || s.phase === 'playing')
}

// ── 문구(승인 데모 v1 원문 — 한 글자도 바꾸지 않는다) ───────────────────────────────────────────

export const CARD_FIRST = {
  frontHint: '카드를 누르면 객관식으로 골라요',
  frontHintOpen: '카드를 다시 누르면 객관식을 닫아요',
  /** 보기 없는 세트·이전 뒤집기 세트(지금 문구 그대로) */
  tapToPeek: '탭하면 뜻이 보여요',
  /** 뜻 없는 카드(대체 흐름, 지금 문구 그대로) */
  selfToPeek: '알았어요·몰랐어요를 누르면 뜻이 보여요',
  choicesBtn: '객관식',
  answerFirst: '뜻 보기나 객관식으로 먼저 답해 주세요',
  listen: {
    word: '단어 듣기',
    ex: '예문 듣기',
    loading: '불러오는 중',
    stop: '멈추기',
    loadingLabel: (what: string) => `${what} 불러오는 중, 누르면 취소`,
    stopLabel: (what: string) => `${what} 소리 멈추기`,
  },
  sr: {
    opened: '객관식 보기 4개가 나왔어요',
    closed: '객관식을 닫았어요',
    flipped: '뜻이 보여요',
    soundStopped: '소리를 멈췄어요',
    playing: (what: string) => `${what} 소리 재생 중`,
  },
  splitLine: (n: number, c: number, m: number, k: number) => `객관식 ${n}장 중 ${c}장 맞힘 · 스스로 ${m}장 중 ${k}장 알았어요`,
  methodBadge: {
    choiceCorrect: '객관식 맞힘',
    choiceWrong: '객관식 틀림',
    selfCorrect: '스스로 알았어요',
    selfWrong: '스스로 몰랐어요',
    skipped: '건너뜀',
  },
} as const

export const KEY_HINT = {
  touch: '← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시',
  choice: '1~4 고르기 · → 다음 · ← 이전 · F 표시',
  front: 'Space 뜻 보기 · C 객관식 · → 다음 · F 표시',
  frontNoChoice: 'Space 뜻 보기 · → 다음 · F 표시',
  open: '1~4 고르기 · C 닫기 · → 다음 · F 표시',
  self: '1 알았어요 · 2 몰랐어요 · → 다음 · F 표시',
  done: 'Enter 다음 카드 · ← 이전 · F 표시',
} as const

/** 소리 안내(힌트 줄 한 줄). 키는 `wordSound.SoundMsgKind` 그대로 — 실패 셋은 빨강·alert. */
export const DECK_SOUND_MSG: Record<SoundMsgKind, DeckHint> = {
  fail: { text: '목소리를 불러오지 못했어요 · 다시 눌러 주세요', tone: 'bad' },
  slow: { text: '목소리 응답이 늦어요 · 잠시 후 다시 눌러 주세요', tone: 'bad' },
  offline: { text: '연결하지 못했어요 · 네트워크를 확인해 주세요', tone: 'bad' },
  textonly: { text: '지금은 선생님 목소리를 들을 수 없어요(자막만)', tone: 'neutral' },
  rate: { text: '너무 자주 눌렀어요 · 잠시 후 다시 들어 주세요', tone: 'neutral' },
  blocked: { text: '소리를 켜려면 ▶ 를 한 번 더 눌러 주세요', tone: 'neutral' },
}
