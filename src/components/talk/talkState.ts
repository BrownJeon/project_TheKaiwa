/**
 * 회화방 화면 상태(screens §9-3 A) — STT·턴·재생 세 상태에서 **순수하게 유도**한다. 따로 저장하지 않으므로 셋이 어긋나 버튼이
 * 잠기는 일이 없다. 판정 순서(위가 이긴다): 녹음 → 인식 중 → 보내기 대기 → 말하는 중 → 생각 중 → 대기.
 */
import type { SttPhase } from '@/components/speech/sttUiState'
import type { TurnPhase } from '@/components/chat/useChatTurn'
import { PTT_LABEL, TALK_STATUS } from './talkCopy'

export type TalkState = 'IDLE' | 'RECORDING' | 'RECOGNIZING' | 'QUEUED' | 'THINKING' | 'SPEAKING'
export type PlaybackPhase = 'idle' | 'waiting' | 'playing' | 'blocked'
export type PlaybackSource = 'turn' | 'replay' | 'mine'

export interface TalkStateInput {
  sttPhase: SttPhase
  turnPhase: TurnPhase
  playbackPhase: PlaybackPhase
  playbackSource: PlaybackSource | null
  /** 보내기 대기 발화가 있다 */
  queued: boolean
  /** 429 로 막힌 남은 초(0·null = 안 막힘) */
  rateLimitedSec: number | null
  /** 녹음 경과 초 */
  recordingSec: number
  /** 권한 프롬프트를 기다리는 중(§8 showAskPermission) */
  askPermission: boolean
  /** 연결이 느리다(1.5초↑) */
  slowConnect: boolean
  /** 녹음 중 소리 작음 힌트 문구(있으면) */
  quietHint: string | null
  /** 대기 상태 줄에 띄울 힌트(짧게 누름·빈 결과·너무 짧음 …) */
  idleHint: string | null
}

export interface TalkView {
  state: TalkState
  sub: 'rateLimited' | 'unavailable' | 'detached' | null
  ptt: { phase: SttPhase; disabled: boolean; label: string }
  statusText: string
  /** 입력 바 ■(선생님 말 멈추기) */
  showStop: boolean
  /** ⌨(글자로 입력하기) — 누르면 이유 토스트 */
  keyboardDisabled: boolean
}

export function deriveTalkState(i: TalkStateInput): TalkView {
  const ptt = (disabled: boolean, label: string = PTT_LABEL.normal) => ({ phase: i.sttPhase, disabled, label })

  if (i.sttPhase === 'starting' || i.sttPhase === 'recording') {
    const statusText = i.askPermission
      ? TALK_STATUS.askPermission
      : i.slowConnect
        ? TALK_STATUS.slowConnect
        : i.quietHint
          ? i.quietHint
          : TALK_STATUS.recording(i.recordingSec)
    return { state: 'RECORDING', sub: null, ptt: ptt(false), statusText, showStop: false, keyboardDisabled: true }
  }
  if (i.sttPhase === 'finishing') {
    return { state: 'RECOGNIZING', sub: null, ptt: ptt(true), statusText: TALK_STATUS.recognizing, showStop: false, keyboardDisabled: true }
  }
  if (i.queued) {
    return { state: 'QUEUED', sub: null, ptt: ptt(true), statusText: TALK_STATUS.queued, showStop: false, keyboardDisabled: true }
  }
  if (i.playbackPhase === 'playing') {
    const statusText =
      i.playbackSource === 'replay' ? TALK_STATUS.speakingReplay : i.playbackSource === 'mine' ? TALK_STATUS.speakingMine : TALK_STATUS.speakingTurn
    // 말하는 중엔 누를 수 있다 — 누르면 소리를 멈추고 녹음(barge-in, §9-11 ①).
    return { state: 'SPEAKING', sub: null, ptt: ptt(i.sttPhase === 'unavailable', PTT_LABEL.bargeIn), statusText, showStop: true, keyboardDisabled: false }
  }
  if (i.turnPhase === 'sending' || i.turnPhase === 'streaming' || i.turnPhase === 'detached') {
    const detached = i.turnPhase === 'detached'
    // 서버는 사용자당 턴 1개(409) — 지금 말해도 보낼 수 없다. 이유는 상태 줄(aria-describedby)이 늘 보여 준다.
    return {
      state: 'THINKING',
      sub: detached ? 'detached' : null,
      ptt: ptt(true),
      statusText: detached ? TALK_STATUS.thinkingDetached : TALK_STATUS.thinking,
      showStop: false,
      keyboardDisabled: false,
    }
  }
  if (i.sttPhase === 'unavailable') {
    return { state: 'IDLE', sub: 'unavailable', ptt: ptt(true), statusText: TALK_STATUS.unavailable, showStop: false, keyboardDisabled: false }
  }
  if (i.rateLimitedSec && i.rateLimitedSec > 0) {
    return { state: 'IDLE', sub: 'rateLimited', ptt: ptt(true), statusText: TALK_STATUS.rateLimited(i.rateLimitedSec), showStop: false, keyboardDisabled: false }
  }
  return { state: 'IDLE', sub: null, ptt: ptt(false), statusText: i.idleHint ?? TALK_STATUS.idle, showStop: false, keyboardDisabled: false }
}
