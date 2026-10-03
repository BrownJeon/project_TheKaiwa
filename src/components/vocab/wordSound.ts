/**
 * 단어 상세 소리 듣기의 순수 규칙(task-023 데모 v1 `detail-*`) — 무엇을 읽을지, 실패를 어떤 안내로 보일지, 버튼이 어떤 모양인지.
 * 화면·훅(useWordSound)은 이 표만 따른다. 문구에 엔진·서버 이름은 없다("선생님 목소리"로만).
 */
import { cpLength } from '@/components/common/format'

export type SoundTarget = 'word' | 'ex'
export type SoundPhase = 'idle' | 'loading' | 'playing' | 'blocked'
export type SoundMsgKind = 'fail' | 'slow' | 'offline' | 'textonly' | 'rate' | 'blocked'

export interface WordSoundState {
  /** 지금 받는 중·소리 나는 중·막힌 버튼(없으면 null). */
  target: SoundTarget | null
  phase: SoundPhase
  /** 누른 버튼 바로 아래 한 줄 안내. */
  msg: { target: SoundTarget; kind: SoundMsgKind } | null
  /** [다시 듣기]·[다시 확인]으로 불러오는 중이면 true("다시 불러오는 중…" 한 줄). */
  retry: boolean
}

export const SOUND_IDLE: WordSoundState = { target: null, phase: 'idle', msg: null, retry: false }

/** 문장 음성(#23) 한 번 요청의 글자 한도 — 서버 `TTS_TEXT_MAX` 와 같다. 넘는 예문은 버튼을 숨긴다(결정 d). */
export const SOUND_TEXT_MAX = 100

/** 이 시간 안에 소리를 받지 못하면 끊고 "응답이 늦어요"를 보인다(서버는 문장 8초에서 504). */
export const SOUND_TIMEOUT_MS = 12_000

/**
 * #23 에 보낼 글(없거나 한도를 넘으면 null). 서버는 한 줄 입력으로 다뤄 줄바꿈을 지우므로, 여기서 먼저 공백 한 칸으로 접어
 * 줄 사이가 붙지 않게 하고 남은 제어문자를 지운다. 길이는 서버와 같은 코드포인트로 센다.
 */
export function soundText(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim()
  const n = cpLength(t)
  return n >= 1 && n <= SOUND_TEXT_MAX ? t : null
}

/** 실패 → 안내 종류. status 는 HTTP(네트워크 실패 0, 모름 null). */
export function soundFailureKind(f: { status: number | null; timedOut?: boolean; notAllowed?: boolean }): SoundMsgKind {
  if (f.notAllowed) return 'blocked'
  if (f.timedOut) return 'slow'
  switch (f.status) {
    case 422:
      return 'textonly'
    case 429:
      return 'rate'
    case 504:
      return 'slow'
    case 0:
      return 'offline'
    default:
      return 'fail'
  }
}

export interface SoundMsgView {
  tone: 'bad' | 'neutral'
  text: string
  /** 다시 시도 링크 문구(없으면 링크 없음). */
  retry: string | null
  role: 'alert' | 'status'
}

export const SOUND_MSG: Record<SoundMsgKind, SoundMsgView> = {
  fail: { tone: 'bad', text: '목소리를 불러오지 못했어요.', retry: '다시 듣기', role: 'alert' },
  slow: { tone: 'bad', text: '목소리 응답이 늦어요. 잠시 후 다시 눌러 주세요.', retry: '다시 듣기', role: 'alert' },
  offline: { tone: 'bad', text: '연결하지 못했어요. 네트워크를 확인해 주세요.', retry: '다시 듣기', role: 'alert' },
  textonly: { tone: 'neutral', text: '지금은 선생님 목소리를 들을 수 없어요(자막만). 목소리가 돌아오면 다시 들을 수 있어요.', retry: '다시 확인', role: 'status' },
  rate: { tone: 'neutral', text: '너무 자주 눌렀어요. 잠시 후 다시 들어 주세요.', retry: null, role: 'status' },
  blocked: { tone: 'neutral', text: '소리를 켜려면 ▶ 를 한 번 더 눌러 주세요.', retry: null, role: 'status' },
}

export const SOUND_RETRYING = '다시 불러오는 중…'

const WHAT: Record<SoundTarget, string> = { word: '단어', ex: '예문' }

export type SoundTapAction = 'load' | 'stop' | 'resume' | 'ignore'

/**
 * 버튼을 눌렀을 때 할 일. `held` = 브라우저가 막아 쥐고 있는 소리의 버튼, `resuming` = 쥐고 있던 소리를 막 틀기 시작한 버튼.
 * 쥐고 있던 소리를 트는 동안(디코딩 수십 ms, 불러오는 중으로 보임)의 두 번째 탭은 무시한다 — 같은 소리를 한 번 더 틀어 겹치거나,
 * 취소로 읽혀 아무 소리도 안 나는 일이 없게(REV-050 L-1).
 */
export function soundTapAction(s: WordSoundState, target: SoundTarget, held: SoundTarget | null, resuming: SoundTarget | null): SoundTapAction {
  if (s.target !== target) return 'load'
  if (s.phase === 'loading' && resuming === target) return 'ignore'
  if (s.phase === 'loading' || s.phase === 'playing') return 'stop'
  if (s.phase === 'blocked' && held === target) return 'resume'
  return 'load'
}

export interface SoundButtonView {
  phase: SoundPhase
  /** idle = 테두리 / on = 재생 중(채움) / mute = 자막만 안내 중 / blocked = 한 번 더 눌러야 함. */
  look: 'idle' | 'on' | 'mute' | 'blocked'
  label: string
  busy: boolean
}

/** 버튼 하나의 모양·이름. 다른 버튼이 소리 나는 중이면 이 버튼은 대기다(소리는 한 번에 하나). */
export function soundButtonView(s: WordSoundState, target: SoundTarget): SoundButtonView {
  const phase: SoundPhase = s.target === target ? s.phase : 'idle'
  const what = WHAT[target]
  const muted = s.msg?.target === target && s.msg.kind === 'textonly'
  if (phase === 'loading') return { phase, look: 'idle', label: `${what} 소리를 불러오는 중, 누르면 취소`, busy: true }
  if (phase === 'playing') return { phase, look: 'on', label: `${what} 소리 멈추기`, busy: false }
  return { phase, look: phase === 'blocked' ? 'blocked' : muted ? 'mute' : 'idle', label: `${what} 소리 듣기`, busy: false }
}

/** 버튼 아래 한 줄: 다시 불러오는 중 / 안내 / (화면 읽기 전용) 재생 중. */
export type SoundLine = { kind: 'retrying' } | { kind: 'msg'; msg: SoundMsgKind } | { kind: 'live'; text: string }

export function soundLine(s: WordSoundState, target: SoundTarget): SoundLine {
  if (s.target === target && s.phase === 'loading' && s.retry) return { kind: 'retrying' }
  if (s.msg && s.msg.target === target) return { kind: 'msg', msg: s.msg.kind }
  return { kind: 'live', text: s.target === target && s.phase === 'playing' ? `${WHAT[target]} 소리 재생 중` : '' }
}
