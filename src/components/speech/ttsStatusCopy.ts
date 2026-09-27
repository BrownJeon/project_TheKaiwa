/**
 * TTS 상태 표시등·사유 시트·토스트·미리듣기 문구(screens §7-8) — 회화 화면(task-007)도 같은 문구를 쓴다.
 * 엔진명·호스트·포트·연결 키는 어느 문구에도 없다.
 */
import type { TtsFallbackReason, TtsServerHealth } from '@/types/tts'

export type TtsUiState = 'ONLINE' | 'ON_DEVICE' | 'TEXT_ONLY' | 'SWITCHING' | 'CHECKING'

export const STATE_LABEL: Record<TtsUiState, string> = {
  ONLINE: '온라인',
  TEXT_ONLY: '자막만',
  ON_DEVICE: '온디바이스 모드',
  SWITCHING: '전환 중',
  CHECKING: '상태 확인 중',
}

export const STATE_DESCRIPTION: Record<TtsUiState, string> = {
  ONLINE: '선생님 목소리를 서버에서 만들어 들려드리고 있어요.',
  TEXT_ONLY: '지금은 목소리를 만들 수 없어 자막만 보여 드려요. 복구되면 자동으로 다시 들려드려요.',
  ON_DEVICE: '서버 대신 이 기기에서 목소리를 만들고 있어요. 서버 음성과 조금 다르게 들릴 수 있어요.',
  SWITCHING: '연결 상태가 바뀌어 확인하고 있어요. 잠시만 기다려 주세요.',
  CHECKING: '선생님 목소리를 쓸 수 있는지 확인하고 있어요.',
}

export const REASON_TEXT: Record<TtsFallbackReason | 'NONE', { why: string; tip: string }> = {
  SERVER_ERROR: { why: '목소리 서버에서 오류가 났어요.', tip: '자동으로 다시 확인하고 있어요. 대화는 자막으로 계속할 수 있어요.' },
  SERVER_TIMEOUT: { why: '목소리 서버의 응답이 너무 늦어요.', tip: '잠시 뒤 자동으로 다시 확인해요.' },
  NO_CONNECTION: { why: '목소리 서버에 연결할 수 없어요.', tip: '서버가 점검 중일 수 있어요. 자동으로 다시 확인해요.' },
  OFFLINE: { why: '인터넷에 연결되어 있지 않아요.', tip: 'Wi-Fi 나 모바일 데이터를 확인해 주세요. 연결되면 바로 다시 확인해요.' },
  NONE: { why: '지금은 목소리를 만들 수 없어요.', tip: '자동으로 다시 확인해요.' },
}

export const HEALTH_TEXT: Record<TtsServerHealth, string> = {
  HEALTHY: '정상',
  DEGRADED: '느림',
  UNAVAILABLE: '사용할 수 없음',
  UNKNOWN: '확인 전',
}

export const ROW_LABEL = { why: '이유', tip: '이렇게 해 보세요', network: '인터넷', server: '목소리 서버', last: '마지막 확인', poll: '자동 확인' } as const

export const TOAST_TEXT: Partial<Record<TtsUiState, string>> = {
  TEXT_ONLY: '서버 연결이 원활하지 않아 지금은 자막만 표시합니다. 음성은 복구되면 다시 재생돼요.',
  ONLINE: '서버 음성으로 다시 연결되었습니다.',
  ON_DEVICE: '서버 연결이 원활하지 않아 온디바이스 모드로 전환했습니다.',
}

export const SHEET_TITLE = '선생님 목소리 상태'

export function ariaLabelFor(state: TtsUiState): string {
  return `선생님 목소리 상태: ${STATE_LABEL[state]}. 눌러서 자세히 보기`
}

/** 미리듣기 오류(HTTP status 로만 분기, screens §7-8 ⓔ). 400 은 서버 문구를 쓴다. */
export function previewErrorText(status: number, retryAfterSec?: number | null): string {
  switch (status) {
    case 422:
      return '선생님 목소리 서버가 준비 중이에요. 잠시 후 다시 들어 보세요.'
    case 429:
      return `미리듣기는 1분에 10번까지예요. ${retryAfterSec ?? 60}초 뒤에 다시 들어 보세요.`
    case 502:
      return '목소리를 만들다가 문제가 생겼어요. 다시 눌러 주세요.'
    case 504:
      return '목소리 서버 응답이 늦어요. 잠시 후 다시 눌러 주세요.'
    case 0:
      return '연결하지 못했어요. 네트워크를 확인해 주세요.'
    default:
      return '목소리를 만들다가 문제가 생겼어요. 다시 눌러 주세요.'
  }
}

export const PLAYBACK_FAILED_TEXT = '소리를 재생하지 못했어요. 다시 눌러 주세요.'
