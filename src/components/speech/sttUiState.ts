/**
 * 푸시투토크 음성 인식 화면 상태기계(docs/screens.md §8-3 B) — 순수 함수. 훅(useRealtimeStt)이 사건을 넣고, 돌려받은
 * `effects` 를 **같은 호출 안에서 동기로** 실행한다(BEGIN 은 누름 제스처 안에서 불려야 한다).
 *
 * 핵심 규칙: 첫 누름이 권한 프롬프트를 띄우면 그 누름은 권한만(뗀 뒤 begin 이 끝나면 취소) · 300ms 미만 누름은 취소 ·
 * 녹음 30초 상한(자동 end) · 손 뗀 뒤 8초 안에 결과가 없으면 TIMEOUT · 최근 3초가 −50dBFS 미만이면 "소리 작음" 힌트.
 */
import type { SttErrorCode } from '@/modules/speech/stt/client'
import type { SttHint } from './sttCopy'

export type SttPhase = 'idle' | 'starting' | 'recording' | 'finishing' | 'unavailable'
export type PermState = 'prompt' | 'granted' | 'denied' | 'unknown'

export const SHORT_PRESS_MS = 300
export const PERMISSION_GUESS_MS = 600
export const ASK_PERMISSION_SHOW_MS = 400
export const DEFAULT_MAX_SEC = 30
export const FINISH_TIMEOUT_MS = 8_000
export const QUIET_DB = -50
export const QUIET_MS = 3_000

export interface SttUiError {
  code: SttErrorCode
  retryAfterSec?: number
  /** 마운트 사전 점검에서 난 오류(서버 준비 중이면 버튼을 막는다). */
  mountCheck?: boolean
}

export interface SttUiState {
  phase: SttPhase
  now: number
  pressed: boolean
  pressedAt: number | null
  permBefore: PermState
  recordingAt: number | null
  finishingAt: number | null
  loudAt: number | null
  maxSec: number
  committed: string[]
  segs: Record<number, string>
  db: number | null
  slow: boolean
  hint: SttHint | null
  error: SttUiError | null
  hadResult: boolean
  /** final 낭독(aria-live). n 이 바뀌어야 같은 문장도 다시 읽힌다. */
  announce: { text: string; n: number } | null
}

export type SttUiEvent =
  | { type: 'PRESS'; now: number; perm: PermState }
  | { type: 'BEGIN_OK'; now: number }
  | { type: 'BEGIN_FAIL'; now: number; code: SttErrorCode; retryAfterSec?: number }
  | { type: 'RELEASE'; now: number }
  | { type: 'ABORT'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'LEVEL'; now: number; db: number }
  | { type: 'CONNECTING'; slow: boolean }
  | { type: 'PARTIAL'; segIdx: number; text: string }
  | { type: 'FINAL'; now: number; text: string }
  | { type: 'ERROR'; now: number; code: SttErrorCode; retryAfterSec?: number }
  | { type: 'OFFLINE'; now: number }
  | { type: 'ONLINE'; now: number }
  | { type: 'PREFLIGHT'; error: SttUiError | null; blocking: boolean }
  | { type: 'PERMISSION'; state: PermState }

export type SttUiEffect = 'STOP_TTS' | 'BEGIN' | 'END' | 'CANCEL'

export interface SttStep {
  state: SttUiState
  effects: SttUiEffect[]
}

export function initialSttUi(now = 0, maxSec = DEFAULT_MAX_SEC): SttUiState {
  return {
    phase: 'idle',
    now,
    pressed: false,
    pressedAt: null,
    permBefore: 'unknown',
    recordingAt: null,
    finishingAt: null,
    loudAt: null,
    maxSec,
    committed: [],
    segs: {},
    db: null,
    slow: false,
    hint: null,
    error: null,
    hadResult: false,
    announce: null,
  }
}

/** 버튼을 막는 오류(누를 수 없음). 서버 준비 중은 마운트 판정일 때만. */
export function isBlockingError(e: SttUiError): boolean {
  return e.code === 'INSECURE' || e.code === 'UNSUPPORTED' || e.code === 'OFFLINE' || (e.code === 'SERVER_UNAVAILABLE' && !!e.mountCheck)
}

function toIdle(s: SttUiState, patch: Partial<SttUiState> = {}): SttUiState {
  return { ...s, phase: 'idle', pressed: false, recordingAt: null, finishingAt: null, loudAt: null, db: null, slow: false, ...patch }
}

function withFinal(s: SttUiState, text: string): SttUiState {
  const t = text.trim()
  return { ...s, committed: t ? [...s.committed, t] : s.committed, segs: {}, announce: t ? { text: t, n: (s.announce?.n ?? 0) + 1 } : s.announce }
}

export function sttUiReducer(s: SttUiState, e: SttUiEvent): SttStep {
  const none: SttUiEffect[] = []
  switch (e.type) {
    case 'PRESS': {
      if (s.phase !== 'idle') return { state: s, effects: none }
      return {
        state: { ...s, phase: 'starting', now: e.now, pressed: true, pressedAt: e.now, permBefore: e.perm, committed: [], segs: {}, hint: null, error: null, slow: false, db: null },
        effects: ['STOP_TTS', 'BEGIN'],
      }
    }
    case 'BEGIN_OK': {
      if (s.phase !== 'starting') return { state: s, effects: none }
      if (s.pressed) return { state: { ...s, phase: 'recording', now: e.now, recordingAt: e.now, loudAt: e.now }, effects: none }
      const waited = e.now - (s.pressedAt ?? e.now)
      const permissionOnly = s.permBefore === 'prompt' || (s.permBefore === 'unknown' && waited >= PERMISSION_GUESS_MS)
      return { state: toIdle(s, { now: e.now, hint: permissionOnly ? 'PERMISSION_GRANTED' : 'SHORT_PRESS' }), effects: ['CANCEL'] }
    }
    case 'BEGIN_FAIL': {
      if (s.phase !== 'starting') return { state: s, effects: none }
      const error: SttUiError = { code: e.code, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) }
      return { state: toIdle(s, { now: e.now, phase: isBlockingError(error) ? 'unavailable' : 'idle', error }), effects: ['CANCEL'] }
    }
    case 'RELEASE':
    case 'ABORT': {
      if (s.phase === 'starting') return { state: { ...s, now: e.now, pressed: false }, effects: none }
      if (s.phase !== 'recording') return { state: { ...s, pressed: false }, effects: none }
      if (e.type === 'ABORT') return { state: toIdle(s, { now: e.now, hint: 'INTERRUPTED', segs: {} }), effects: ['CANCEL'] }
      if (e.now - (s.pressedAt ?? e.now) < SHORT_PRESS_MS) return { state: toIdle(s, { now: e.now, hint: 'SHORT_PRESS', segs: {} }), effects: ['CANCEL'] }
      return { state: { ...s, phase: 'finishing', now: e.now, pressed: false, finishingAt: e.now, db: null, hint: s.hint === 'TOO_QUIET' ? null : s.hint }, effects: ['END'] }
    }
    case 'TICK': {
      const t = { ...s, now: e.now }
      if (s.phase === 'recording' && s.recordingAt !== null) {
        if (e.now - s.recordingAt >= s.maxSec * 1000) return { state: { ...t, phase: 'finishing', pressed: false, finishingAt: e.now, db: null, hint: 'AUTO_STOPPED' }, effects: ['END'] }
        const quiet = e.now - Math.max(s.loudAt ?? s.recordingAt, s.recordingAt) >= QUIET_MS
        return { state: { ...t, hint: quiet ? 'TOO_QUIET' : s.hint === 'TOO_QUIET' ? null : s.hint }, effects: none }
      }
      if (s.phase === 'finishing' && s.finishingAt !== null && e.now - s.finishingAt >= FINISH_TIMEOUT_MS) {
        return { state: toIdle(t, { error: { code: 'TIMEOUT' }, segs: {} }), effects: ['CANCEL'] }
      }
      return { state: t, effects: none }
    }
    case 'LEVEL': {
      if (s.phase !== 'recording') return { state: s, effects: none }
      const loud = e.db >= QUIET_DB
      return { state: { ...s, db: e.db, loudAt: loud ? e.now : s.loudAt, hint: loud && s.hint === 'TOO_QUIET' ? null : s.hint }, effects: none }
    }
    case 'CONNECTING':
      return { state: { ...s, slow: s.phase === 'recording' || s.phase === 'starting' ? e.slow : false }, effects: none }
    case 'PARTIAL':
      if (s.phase !== 'recording' && s.phase !== 'finishing') return { state: s, effects: none }
      return { state: { ...s, segs: { ...s.segs, [e.segIdx]: e.text } }, effects: none }
    case 'FINAL': {
      if (s.phase === 'recording') return { state: withFinal(s, e.text), effects: none }
      if (s.phase !== 'finishing') return { state: s, effects: none }
      const next = withFinal(s, e.text)
      const empty = !e.text.trim() && s.committed.length === 0
      return { state: toIdle(next, { now: e.now, hadResult: true, hint: empty ? 'EMPTY_RESULT' : s.hint === 'AUTO_STOPPED' ? 'AUTO_STOPPED' : null }), effects: none }
    }
    case 'ERROR': {
      const error: SttUiError = { code: e.code, ...(e.retryAfterSec ? { retryAfterSec: e.retryAfterSec } : {}) }
      const busy = s.phase === 'starting' || s.phase === 'recording' || s.phase === 'finishing'
      return { state: toIdle(s, { now: e.now, phase: isBlockingError(error) ? 'unavailable' : 'idle', error, segs: {} }), effects: busy ? ['CANCEL'] : none }
    }
    case 'OFFLINE': {
      const busy = s.phase === 'starting' || s.phase === 'recording' || s.phase === 'finishing'
      return { state: toIdle(s, { now: e.now, phase: 'unavailable', error: { code: 'OFFLINE' }, segs: {} }), effects: busy ? ['CANCEL'] : none }
    }
    case 'ONLINE':
      if (s.error?.code !== 'OFFLINE') return { state: s, effects: none }
      return { state: toIdle(s, { now: e.now, error: null }), effects: none }
    case 'PREFLIGHT': {
      if (s.phase !== 'idle' && s.phase !== 'unavailable') return { state: s, effects: none }
      if (!e.error) return { state: s.phase === 'unavailable' ? toIdle(s, { error: null }) : s, effects: none }
      return { state: { ...s, phase: e.blocking ? 'unavailable' : 'idle', error: e.error }, effects: none }
    }
    case 'PERMISSION':
      if (e.state === 'granted' && s.error?.code === 'MIC_DENIED') return { state: { ...s, error: null }, effects: none }
      if (e.state === 'denied' && s.phase === 'idle' && !s.error) return { state: { ...s, error: { code: 'MIC_DENIED' } }, effects: none }
      return { state: s, effects: none }
  }
}

/** 확정된 줄 + 진행 중 구간(segIdx 순). 화면은 partial 부분만 회색으로 그린다. */
export function transcriptParts(s: Pick<SttUiState, 'committed' | 'segs'>): { committed: string; partial: string } {
  const partial = Object.keys(s.segs)
    .map(Number)
    .sort((a, b) => a - b)
    .map((k) => s.segs[k])
    .join('')
  return { committed: s.committed.join('\n'), partial }
}

/** 상태 줄에 "마이크 사용을 허용해 주세요" 를 띄울 때(허용된 기기에서 깜빡이지 않게). */
export function showAskPermission(s: SttUiState): boolean {
  return s.phase === 'starting' && (s.permBefore === 'prompt' || (s.pressedAt !== null && s.now - s.pressedAt >= ASK_PERMISSION_SHOW_MS))
}

export function elapsedSec(s: SttUiState): number {
  return s.recordingAt === null ? 0 : Math.max(0, Math.floor((s.now - s.recordingAt) / 1000))
}
