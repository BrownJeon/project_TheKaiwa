/**
 * 질문 탭 말 바 상태(task-066 §26-7 C) — STT·답 기다림·429 에서 **순수하게 유도**한다(회화 `deriveTalkState` 와 같은 방식, `VoiceBar` 가 받는 `TalkView`).
 * 회화와 다른 점: 질문은 줄 세우지 않는다(답을 기다리는 동안 누르고 말하기 잠금 — J7) · 하루 한도 줄 · 밀어서 취소 줄 · 일본어 전용 문구.
 * 손을 뗀 뒤 판정(`askFinalAction`)도 여기 둔다. 보내기 옵션은 `logic.askSendOptions`(U1 — 발화 id 없음, 목소리 저장 없음).
 */
import type { SttPhase } from '@/components/speech/sttUiState'
import { STT_HINT_COPY, STT_STATUS_COPY, type SttHint } from '@/components/speech/sttCopy'
import { TALK_STATUS } from '@/components/talk/talkCopy'
import type { TalkView } from '@/components/talk/talkState'
import { ASK_VOICE_COPY } from './askVoiceCopy'

export interface AskVoiceViewInput {
  sttPhase: SttPhase
  /** 답을 기다리는 중·방 만드는 중·불러오는 중 */
  busy: boolean
  /** 손가락이 버튼 밖(밀어서 취소 준비) */
  out: boolean
  askPermission: boolean
  slowConnect: boolean
  quiet: boolean
  recordingSec: number
  /** 429 로 막힌 남은 초(0·null = 안 막힘) */
  rateLimitedSec: number | null
  /** 429 `details.reason`(ASK_DAILY 면 하루 한도) */
  rateReason: string | null
  /** 대기 상태 줄 힌트(`askIdleHint`) */
  hint: string | null
  /** busy 일 때 상태 줄(없으면 「답을 받은 뒤 말할 수 있어요」 — `?chat=` 불러오는 중은 「대화를 불러오고 있어요」, §26-5 B) */
  busyText?: string | null
}

/** 하루 한도로 막혔나 — 서버 이유 ASK_DAILY 또는 남은 초 > 3,600. */
export function askDailyBlocked(rateLimitedSec: number | null, rateReason: string | null): boolean {
  return !!rateLimitedSec && rateLimitedSec > 0 && (rateReason === 'ASK_DAILY' || rateLimitedSec > 3600)
}

export function askVoiceView(i: AskVoiceViewInput): TalkView {
  const ptt = (disabled: boolean) => ({ phase: i.sttPhase, disabled, label: ASK_VOICE_COPY.pttLabel })
  if (i.sttPhase === 'starting' || i.sttPhase === 'recording') {
    const statusText = i.askPermission
      ? TALK_STATUS.askPermission
      : i.out
        ? ASK_VOICE_COPY.out
        : i.slowConnect
          ? TALK_STATUS.slowConnect
          : i.quiet
            ? STT_HINT_COPY.TOO_QUIET
            : TALK_STATUS.recording(i.recordingSec)
    return { state: 'RECORDING', sub: null, ptt: ptt(false), statusText, showStop: false, keyboardDisabled: true }
  }
  if (i.sttPhase === 'finishing') {
    return { state: 'RECOGNIZING', sub: null, ptt: ptt(true), statusText: TALK_STATUS.recognizing, showStop: false, keyboardDisabled: true }
  }
  if (i.busy) {
    return { state: 'THINKING', sub: null, ptt: ptt(true), statusText: i.busyText ?? ASK_VOICE_COPY.waiting, showStop: false, keyboardDisabled: false }
  }
  if (i.sttPhase === 'unavailable') {
    return { state: 'IDLE', sub: 'unavailable', ptt: ptt(true), statusText: ASK_VOICE_COPY.unavailable, showStop: false, keyboardDisabled: false }
  }
  if (askDailyBlocked(i.rateLimitedSec, i.rateReason)) {
    return { state: 'IDLE', sub: 'rateLimited', ptt: ptt(true), statusText: ASK_VOICE_COPY.daily, showStop: false, keyboardDisabled: false }
  }
  if (i.rateLimitedSec && i.rateLimitedSec > 0) {
    return { state: 'IDLE', sub: 'rateLimited', ptt: ptt(true), statusText: TALK_STATUS.rateLimited(i.rateLimitedSec), showStop: false, keyboardDisabled: false }
  }
  return { state: 'IDLE', sub: null, ptt: ptt(false), statusText: i.hint ?? ASK_VOICE_COPY.idle, showStop: false, keyboardDisabled: false }
}

/**
 * 대기 상태 줄 힌트(§26-7 C 7 행 아래) — 이 화면 힌트(1자 이하) → STT 힌트(짧은 누름·권한 허용·못 알아들음·중간에 멈춤) → 권한 이유 → 없음.
 * 사용자가 밀어서/Esc 로 취소한 직후의 「중간에 멈춤」·「짧은 누름」은 숨긴다(토스트 「보내지 않았어요」가 이미 말함). 30초 자동 멈춤은 토스트, 소리 작음은 녹음 중 줄.
 */
export function askIdleHint(i: { localHint: string | null; sttHint: SttHint | null; cancelled: boolean; rationale: boolean; hasError: boolean }): string | null {
  if (i.localHint) return i.localHint
  const h = i.sttHint
  if (h && h !== 'TOO_QUIET' && h !== 'AUTO_STOPPED' && !(i.cancelled && (h === 'INTERRUPTED' || h === 'SHORT_PRESS'))) return STT_HINT_COPY[h]
  if (i.rationale && !i.hasError) return STT_STATUS_COPY.rationale
  return null
}

export type AskFinalAction =
  | { kind: 'ignore' }
  | { kind: 'tooShort' }
  | { kind: 'unsentSelf'; text: string }
  | { kind: 'unsent429'; text: string }
  | { kind: 'send'; text: string }

/**
 * 손을 뗀 뒤 받은 글 판정(§26-7 G, L2·J7) — 빈 글은 무시(빈 결과 힌트는 STT 상태기계), 1자 이하는 보내지 않음,
 * 이 대화가 답하는 중이면 줄 세우지 않고 띠, 429 로 막혔으면 띠, 그 밖은 앞뒤 공백을 뺀 글을 **확인 없이 바로** 보낸다(D4 A).
 */
export function askFinalAction(text: string, s: { busy: boolean; blockedUntil: number | null; now: number }): AskFinalAction {
  const t = text.trim()
  if (t === '') return { kind: 'ignore' }
  if (Array.from(t).length <= 1) return { kind: 'tooShort' }
  if (s.busy) return { kind: 'unsentSelf', text: t }
  if (s.blockedUntil !== null && s.blockedUntil > s.now) return { kind: 'unsent429', text: t }
  return { kind: 'send', text: t }
}

// ── 입력 모드 · 띠 ──────────────────────────────────────────────────────────────

export type AskInputMode = 'text' | 'voice'

/**
 * 서버 렌더·첫 수화가 그리는 모드 — **늘 글자 모드**. 저장된 모드는 수화 뒤에 읽어 다시 그린다
 * (서버 그림이 `'voice'` 면 글자 모드로 저장된 기기에서 수화 불일치 경고가 난다).
 */
export const ASK_INPUT_MODE_SERVER: AskInputMode = 'text'

/** 세션 저장소 값 → 모드. 알 수 없는 값은 글자. */
export function askModeOf(raw: string | null): AskInputMode {
  return raw === 'voice' ? 'voice' : 'text'
}

/**
 * 인식 오류 띠(`SttAlert`)를 보일까 — **말 모드에서만**. 글자로 묻는 사람에게 마이크 오류를 먼저 보이지 않는다(Q-U2-1).
 * 닫은 오류(`dismissed`)는 같은 것이 다시 와도 숨긴다.
 */
export function askShowSttAlert<E>(mode: AskInputMode, error: E | null, dismissed: E | null): boolean {
  return mode === 'voice' && !!error && error !== dismissed
}
