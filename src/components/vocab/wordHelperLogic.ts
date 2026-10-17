/**
 * 단어 추가 시트 일본어 도우미(task-072, screens §30)의 순수 규칙 — 한글 질의 판정 · [물어보기] 막힘 · 안내 줄 · #181 실패 분류 · 결말 → 판 상태 ·
 * 질의 칸 Enter · 판 안 Esc · 말로 쓰기와의 서로 닫기 · 처음 안내 표시 · 넣기 순서. React·DOM 을 쓰지 않는다(단위 시험 `__tests__/wordHelper*.test.ts`).
 * 요청 수명주기·IME Enter·글자 수 안내는 회화방 도우미의 시험된 규칙(`talk/phraseHelperLogic`)을 **import 해서** 쓴다(그 파일은 고치지 않는다).
 * 질의·답 원문은 어디에도 저장하지 않는다.
 */
import { retryAfterOf, type Err } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { HELPER_COUNT_FROM, HELPER_MAX } from '@/components/talk/helperCopy'
import { askBlockOf, isImeEnter, type AskBlock, type HelperMsg, type HelperSettle } from '@/components/talk/phraseHelperLogic'
import type { WordPhraseHelpItem } from '@/types/phraseHelp'
import { WORD_HELPER } from './wordHelperCopy'

/** 단어 도우미가 쓰는 DOM id 모음 — 패널 id 는 `PhraseHelperButton` 의 `aria-controls`(`HELPER_PANEL_ID`)를 그대로 쓴다. */
export const WORD_HELPER_IDS = {
  title: 'wadd_helper_title',
  q: 'wadd_helper_q',
  msg: 'wadd_helper_msg',
  alts: 'wadd_helper_alts',
  tip: 'wadd_helper_tip',
  announce: 'wadd_helper_announce',
} as const

/** 서버 `HANGUL_SYLLABLE` 과 같은 기준 — 자모만(ㅋㅋ)·영문·일본어는 한글이 아니다. */
export function hasHangul(q: string): boolean {
  return /[가-힣]/.test(q)
}

export type WordAskBlock = AskBlock | 'noHangul'

/** [물어보기]를 지금 누를 수 없는 이유 — 순서: 요청 중 > 대기 > 빈 말 > 100자 초과 > 한글 없음. 단어 시트엔 녹음 잠금이 없다(`recording: false`). */
export function wordAskBlockOf(i: { query: string; pending: boolean; rateWaiting: boolean }): WordAskBlock | null {
  const base = askBlockOf({ query: i.query, pending: i.pending, recording: false, rateWaiting: i.rateWaiting })
  if (base !== null) return base
  return hasHangul(i.query) ? null : 'noHangul'
}

/** 버튼을 흐리게 할 이유 — `noHangul` 은 흐리지 않는다(눌러야 이유 문구가 보인다). */
export function wordAskDisabled(block: WordAskBlock | null): boolean {
  return block === 'pending' || block === 'rate' || block === 'empty' || block === 'over'
}

/** 질의 칸 아래 안내 줄에 남는 사유. 질의를 고치면 지워진다. */
export type WordHint = null | 'empty' | 'noHangul' | 'over' | 'stopped' | { server: string }

/**
 * 안내 줄 — 서버 문구(bad) > 한글 없음(bad) > 빈 제출(bad) > 100자 초과(bad·오른쪽) > 찾기를 멈춤(사정 설명이라 bad 아님) > 90자부터 글자 수(오른쪽).
 */
export function wordHelperMsgOf(i: { query: string; hint: WordHint }): HelperMsg | null {
  const { hint } = i
  if (hint !== null && typeof hint === 'object') return { text: hint.server, bad: true, count: false }
  if (hint === 'noHangul') return { text: WORD_HELPER.noHangul, bad: true, count: false }
  if (hint === 'empty' && i.query.trim() === '') return { text: WORD_HELPER.empty, bad: true, count: false }
  const n = cpLength(i.query)
  if (n > HELPER_MAX || hint === 'over') return { text: WORD_HELPER.over(n), bad: true, count: true }
  if (hint === 'stopped') return { text: WORD_HELPER.stopped, bad: false, count: false }
  if (n >= HELPER_COUNT_FROM) return { text: WORD_HELPER.count(n), bad: false, count: true }
  return null
}

export type WordHelperFailure =
  | { kind: 'error' }
  | { kind: 'timeout' }
  | { kind: 'offline' }
  | { kind: 'busy' }
  | { kind: 'rate'; sec: number }
  | { kind: 'hint'; hint: Exclude<WordHint, null | 'stopped'> }

const reasonOf = (e: Err): string | null => (typeof e.details.reason === 'string' ? e.details.reason : null)

/**
 * #181 실패 → 판 상태(§30-8). 회화방 `helperFailureOf` 는 409 `PHRASE_BUSY`·상태 0 을 일반 오류로 보므로 쓰지 않는다.
 * 서버 문구를 그대로 보이는 것은 400 의 `forbidden_char`·`secret_like` 둘뿐이다(맥락 중립 문구) — 502·504 등 다른 오류의 서버 `message` 는 쓰지 않는다.
 */
export function wordHelperFailureOf(err: Err, timedOut: boolean): WordHelperFailure {
  if (timedOut || err.status === 504) return { kind: 'timeout' }
  if (err.status === 0) return { kind: 'offline' }
  if (err.status === 429) return { kind: 'rate', sec: retryAfterOf(err) }
  if (err.status === 409) return (reasonOf(err) ?? err.code) === 'PHRASE_BUSY' ? { kind: 'busy' } : { kind: 'error' }
  if (err.status === 400 && err.code === 'VALIDATION') {
    switch (reasonOf(err)) {
      case 'required':
      case 'no_text':
        return { kind: 'hint', hint: 'empty' }
      case 'max_length':
        return { kind: 'hint', hint: 'over' }
      case 'no_hangul':
        return { kind: 'hint', hint: 'noHangul' }
      case 'forbidden_char':
      case 'secret_like':
        return err.message ? { kind: 'hint', hint: { server: err.message } } : { kind: 'error' }
      default:
        return { kind: 'error' }
    }
  }
  return { kind: 'error' }
}

export type WordHelperPhase = 'idle' | 'loading' | 'slow' | 'result' | 'none' | 'rate' | 'busy' | 'offline' | 'error' | 'timeout'

export type WordHelperOutcome = { kind: 'items'; items: readonly { ja: string; ko: string }[] } | WordHelperFailure

/**
 * 요청 수명주기(`createHelperRequester`)가 알려 준 결말 + 요청 래퍼가 **단어 규칙으로 먼저 분류해 둔 실패** → 판 결말.
 * 수명주기는 실패를 회화방 규칙(`helperFailureOf`)으로만 분류하므로, 시간 초과(화면 12초·504 — 취소로 끊겨 래퍼가 분류하지 않는다)만 그쪽 결말을 믿고
 * 나머지는 래퍼의 분류를 쓴다. 응답 모양 오류는 던져진 예외가 없어 분류가 없다 → 오류.
 */
export function wordHelperOutcomeOf(r: HelperSettle, failure: WordHelperFailure | null): WordHelperOutcome {
  if (r.kind === 'items') return { kind: 'items', items: r.items }
  if (r.failure.kind === 'timeout') return { kind: 'timeout' }
  return failure ?? { kind: 'error' }
}

/** 카드 ▶ 소리의 열쇠 — 훅 안 `useKeyedSound` 인스턴스 전용이라 자체 접두를 쓴다. */
export const wordHelperSoundKey = (index: number): string => `whelper:${index}`

export interface WordHelperApplied {
  phase: WordHelperPhase
  /** 있으면 목록을 이것으로 바꾼다(빈 결과도 `[]`). */
  items?: WordPhraseHelpItem[]
  /** 429 대기 초. */
  rateSec?: number
  hint?: WordHint
  /** 패널 낭독 줄 — 결과·빈 결과·429 만(나머지 실패는 `role=alert` 상자가 읽힌다). */
  announce: string
}

/** 결말 하나 → 판 상태. 꼬리표·이유가 와도 `ja`·`ko` 만 남긴다(단어 모드엔 두 칸이 없다). */
export function wordHelperApply(o: WordHelperOutcome): WordHelperApplied {
  switch (o.kind) {
    case 'items': {
      const items = o.items.map(({ ja, ko }) => ({ ja, ko }))
      return items.length ? { phase: 'result', items, announce: WORD_HELPER.found(items.length) } : { phase: 'none', items: [], announce: WORD_HELPER.none }
    }
    case 'rate':
      return { phase: 'rate', rateSec: o.sec, announce: WORD_HELPER.rate(o.sec) }
    case 'hint':
      return { phase: 'idle', hint: o.hint, announce: '' }
    default:
      return { phase: o.kind, announce: '' }
  }
}

interface EnterEvent {
  key: string
  keyCode: number
  preventDefault: () => void
  nativeEvent: { isComposing: boolean }
}

/**
 * 질의 칸 키 입력. 패널은 1단계 `<form onSubmit={뜻 채우기}>` 안이라 Enter 를 **늘** 막아야 한다 — 안 막으면 암묵 제출로 [뜻 채우기]가 눌린다(§30-11 ①).
 * 한국어 IME 조합 중 Enter 는 글자 확정이므로 막기만 하고 보내지 않는다.
 */
export function helperQueryKeyDown(ask: () => void): (e: EnterEvent) => void {
  return (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (isImeEnter(e)) return
    ask()
  }
}

/**
 * 판 안 Esc → 판만 닫는다. `preventDefault` 는 공용 `Sheet` 의 Esc 닫기가 `defaultPrevented` 를 보고 건너뛰게 하는 신호다(§30-11 ②) —
 * 조합 중 Esc 는 판도 시트도 닫지 않는다(IME 취소).
 */
export function panelEscapeKeyDown(close: () => void): (e: { key: string; preventDefault: () => void; nativeEvent: { isComposing: boolean } }) => void {
  return (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    if (e.nativeEvent.isComposing) return
    close()
  }
}

/** 말로 쓰기가 표현 칸에 **새로 열렸는가** — 렌더 중 이전 값 비교에 쓴다(마이크가 막혀 열리지 않은 토글은 해당 없다). */
export function micOpenedNow(prev: string | null, next: string | null): boolean {
  return prev !== 'surface' && next === 'surface'
}

/** 처음 한 번 안내를 보일지 — 1단계에서 판·말로 쓰기가 닫혀 있는 동안만(열리면 잠깐 숨는다). */
export function wordHelperTipShown(i: { tipOpen: boolean; step: string; helperOpen: boolean; micTarget: string | null }): boolean {
  return i.tipOpen && i.step === 'surface' && !i.helperOpen && i.micTarget !== 'surface'
}

/**
 * [표현 칸에 넣기] — 순서가 뜻이다: 073 확인 안내를 거두고(값이 바뀜) → 표현 칸을 바꿔 넣고(기존 규칙으로 중복·판정 실패·오류 안내가 지워짐) → 판을 닫고 낭독 →
 * 표현 칸 초점. 여기서 [뜻 채우기]·저장·요청을 부르지 않는다(AI 는 제안만 — D5).
 */
export function fillSurfaceFromHelper(d: {
  ja: string
  edited: (target: 'surface') => void
  setSurface: (v: string) => void
  fill: (ja: string) => void
  focusSurface: () => void
}): void {
  d.edited('surface')
  d.setSurface(d.ja)
  d.fill(d.ja)
  d.focusSurface()
}
