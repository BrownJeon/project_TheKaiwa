/**
 * 단어 추가 시트의 말로 입력 규칙(task-069, IMP-0043) — 순수 모듈. 훅(`useWordMic`)·화면(`WordMicField`)은 이 규칙을 부르기만 한다.
 *
 * 인식기는 일본어 고정이라 마이크를 붙이는 칸은 **표현·예문** 둘뿐이다(뜻·예문 뜻·메모·분류는 한국어, 읽기는 히라가나 칸이라 제외).
 * 인식 결과는 칸에 채울 뿐 자동 저장·자동 [뜻 채우기]를 하지 않는다 — 사용자가 확인하고 고친 뒤 기존 버튼을 누른다.
 */
import { recordingStatus, STT_HINT_COPY, STT_STATUS_COPY } from '@/components/speech/sttCopy'
import { elapsedSec, showAskPermission, type SttPhase, type SttUiError, type SttUiState } from '@/components/speech/sttUiState'
import type { SttErrorCode } from '@/modules/speech/stt/client'
import { validateWord, type WordFormValues } from './validate'

export type WordMicTarget = 'surface' | 'example'

/** 표현은 바꿔 넣고(한 번 더 말하면 다시 말하기), 예문은 끝에 이어 붙인다. */
const MERGE: Record<WordMicTarget, 'replace' | 'append'> = { surface: 'replace', example: 'append' }

/**
 * 인식 결과를 칸 값으로. 비었으면 null(칸을 건드리지 않는다). **자르지 않는다** — 한도(표현 80자·예문 2,000자)를 넘으면
 * 값 그대로 두어 기존 검증 문구(`validateWord`)가 보이게 한다. 표현은 한 줄 칸이라 줄바꿈을 없앤다(`<input>` 이 값을 조용히 다듬어 상태와 어긋나는 것을 막는다).
 */
export function applyMicResult(target: WordMicTarget, current: string, spoken: string): string | null {
  const said = spoken.trim()
  if (!said) return null
  if (MERGE[target] === 'replace') return said.replace(/[\r\n]+/g, '')
  return current.trim() ? current + said : said
}

/**
 * 인식 결과를 폼 값으로 — 칸의 지금 값에 합치고(`applyMicResult`) 한도를 넘으면 기존 검증 문구(`validateWord`)를 함께 돌려준다. 비었으면 null.
 * 시트는 `value` 를 칸에 넣고 `error` 가 있으면 바로 보인다(자르지 않는다).
 */
export function applyMicToForm(form: WordFormValues, target: WordMicTarget, spoken: string): { value: string; error?: string } | null {
  const value = applyMicResult(target, form[target], spoken)
  if (value === null) return null
  return { value, error: validateWord({ ...form, [target]: value })[target] }
}

/** 손을 뗀 뒤 결과가 왔을 때 무엇을 할지 — 누른 칸을 사용자가 떠났으면 무시(다른 칸에 잘못 들어가지 않게), 빈 결과는 안내. */
export type MicFinalAction = { kind: 'ignore' } | { kind: 'empty' } | { kind: 'apply'; target: WordMicTarget; text: string }

export function micFinalAction(pressed: WordMicTarget | null, current: WordMicTarget | null, spoken: string): MicFinalAction {
  if (!pressed || pressed !== current) return { kind: 'ignore' }
  const text = spoken.trim()
  return text ? { kind: 'apply', target: pressed, text } : { kind: 'empty' }
}

/**
 * 훅이 ref 로 들고 있는 두 값 — 지금 열린 칸(`target`)과 마지막으로 「누르고 말하기」를 누른 칸(`pressed`).
 * 손을 뗀 뒤 결과는 늦게 오므로(인식기는 `finishing` 중에는 취소되지 않는다) 결과가 도착한 시점에 두 값을 비교한다.
 */
export interface MicRefs {
  target: WordMicTarget | null
  pressed: WordMicTarget | null
}

export const MIC_REFS_INIT: MicRefs = { target: null, pressed: null }

/** 누름 — 그 순간 열려 있는 칸을 「누른 칸」으로 기록한다. */
export function micPress(r: MicRefs): MicRefs {
  return { target: r.target, pressed: r.target }
}

/** 결과 도착 — 반영(`apply`)하면 칸이 닫히며 두 값이 모두 비워지고(글자 모드로 복귀), 무시·빈 결과면 그대로 둔다. */
export function micFinalStep(r: MicRefs, spoken: string): { action: MicFinalAction; refs: MicRefs } {
  const action = micFinalAction(r.pressed, r.target, spoken)
  return { action, refs: action.kind === 'apply' ? MIC_REFS_INIT : r }
}

/**
 * 열린 칸이 바뀌면(열기·옮기기·닫기) 그때 보이던 오류는 사용자가 넘긴 것으로 친다 — 이전 칸에서 난 오류 띠가 다음 칸에 먼저 보이지 않게.
 * 칸이 그대로거나 오류가 없으면 이전 값을 유지한다.
 */
export function dismissedAfterRetarget(prev: WordMicTarget | null, next: WordMicTarget | null, error: SttUiError | null, dismissed: SttUiError | null): SttUiError | null {
  return prev !== next && error ? error : dismissed
}

/** 열린 칸 안에 보일 오류 — 사용자가 넘긴(닫은) 오류는 제외. */
export function visibleMicError(error: SttUiError | null, dismissed: SttUiError | null): SttUiError | null {
  return error && error !== dismissed ? error : null
}

/** 결과를 칸에 넣은 직후 포커스를 전환 버튼으로 옮길지 — 이 칸에 새 결과(`n` 이 처음 보는 값)가 들어왔을 때만(마운트 때는 아님). */
export function micResultFocus(seenN: number | null, announce: { n: number } | null): boolean {
  return announce !== null && announce.n !== seenN
}

export interface MicTargetStep {
  target: WordMicTarget | null
  /** 진행 중이던 녹음을 멈춘다. */
  abort: boolean
}

/** 「말로」 버튼 — 같은 칸을 다시 누르면 글자로, 다른 칸이 열려 있으면 그 칸을 닫고 옮긴다. 쓸 수 없으면(`blocked`) 열지 않는다. */
export function micToggle(current: WordMicTarget | null, next: WordMicTarget, blocked: boolean): MicTargetStep {
  if (current === next) return { target: null, abort: true }
  if (blocked) return { target: current, abort: false }
  return { target: next, abort: current !== null }
}

/** 단계가 바뀌거나 칸이 사라질 때 닫는다. `only` 를 주면 그 칸이 열려 있을 때만 닫는다. */
export function micClose(current: WordMicTarget | null, only?: WordMicTarget): MicTargetStep {
  if (current === null || (only !== undefined && only !== current)) return { target: current, abort: false }
  return { target: null, abort: true }
}

/**
 * 말로 쓰기를 막는 이유 코드(없으면 null). 사전 점검이 막은 환경(비보안 주소·지원 안 함·서버 인식 꺼짐·오프라인·휴대폰 인식 파일 없음)과
 * 마이크 권한 거부. 마이크 사용 중 난 일시 오류(연결 실패 등)는 막지 않는다 — 열린 칸 안의 오류 띠가 보인다.
 */
export function micBlockedCode(ui: { phase: SttPhase; error: SttUiError | null }): SttErrorCode | null {
  if (ui.error && (ui.phase === 'unavailable' || ui.error.code === 'MIC_DENIED')) return ui.error.code
  return ui.phase === 'unavailable' ? 'UNSUPPORTED' : null
}

/** 칸 안 상태 줄 — 수업 「말로 쓰기」(`useLessonVoice`)와 같은 우선순위(재생 큐 없는 단어 시트용). */
export function wordMicStatusText(ui: SttUiState, hint: string | null): string {
  if (ui.phase === 'starting' || ui.phase === 'recording') {
    if (showAskPermission(ui)) return STT_STATUS_COPY.askPermission
    if (ui.slow) return STT_STATUS_COPY.slowConnect
    if (ui.hint === 'TOO_QUIET') return STT_HINT_COPY.TOO_QUIET
    return recordingStatus(elapsedSec(ui))
  }
  if (ui.phase === 'finishing') return STT_STATUS_COPY.finishing
  if (ui.phase === 'unavailable') return STT_STATUS_COPY.unavailable
  if (hint) return hint
  if (ui.hint && ui.hint !== 'TOO_QUIET') return STT_HINT_COPY[ui.hint]
  if (ui.rationale && !ui.error) return STT_STATUS_COPY.rationale
  return STT_STATUS_COPY.idle
}

export interface WordMicVoice {
  phase: SttPhase
  recording: boolean
  db: number | null
  /** 확정된 말 + 진행 중 구간 */
  partial: string
  statusText: string
  pttLabel: string
  /** 열린 칸 안에 보일 오류(사용자가 닫은 것 제외) */
  error: SttUiError | null
  press: () => void
  release: () => void
  abort: () => void
}

export interface WordMic {
  /** 지금 말로 쓰는 칸(없으면 모두 글자) */
  target: WordMicTarget | null
  /** 말로 쓰기를 막는 이유(null = 쓸 수 있음) */
  blocked: SttErrorCode | null
  voice: WordMicVoice
  /** 마지막으로 칸에 넣은 말 — 화면 읽기용(n 이 바뀌어야 같은 말도 다시 읽힌다) */
  announce: { target: WordMicTarget; text: string; n: number } | null
  toggle: (t: WordMicTarget) => void
  close: (only?: WordMicTarget) => void
  dismissError: () => void
}
