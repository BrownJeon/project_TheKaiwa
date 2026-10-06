/**
 * 채팅 화면의 한국어 라벨·문구 표(screens.md §3-8). 순수 모듈.
 *
 * **오류 문구는 서버 `message` 가 아니라 이 표에서 고른다**(400 VALIDATION 만 예외). 서버 기본 문구에는
 * 구현 용어가 섞일 수 있어(task-006 D8) 사용자 화면에 그대로 띄우지 않는다. 엔진·모델명·traceId 는 어디에도 없다.
 */
import type { ChunkType, ErrorType, ProposalStatus, TurnStage } from '@/types/chat'

export const ERROR_TYPE_LABEL: Record<ErrorType, string> = {
  GRAMMAR: '문법',
  PARTICLE: '조사',
  CONJUGATION: '활용',
  VOCABULARY: '어휘',
  POLITENESS: '존댓말',
  NATURALNESS: '자연스러움',
  WORD_ORDER: '어순',
  PRONUNCIATION: '발음',
  OTHER: '기타',
}

export const CHUNK_LABEL: Record<ChunkType, string> = {
  NAME: '이름 조각',
  ACTION: '액션 조각',
  FEELING: '느낌 조각',
  MODIFIER: '꾸밈 조각',
}

export const STATUS_LABEL: Record<Exclude<ProposalStatus, 'PROPOSED'>, string> = {
  ACCEPTED: '채택함',
  REJECTED: '무시함',
  EXPIRED: '기한 지남',
}

/** 교정 카드의 접이식 추가 설명 줄(task-039 데모 v1 D3-A) — 접힘/펼침 이름. 화살표는 컴포넌트가 따로(aria-hidden) 붙인다. */
export const EXTRA_NOTE_LABEL = { more: '시험 문법 더 보기', less: '시험 문법 접기' } as const

/** PendingBubble 단계 문구(ⓑ). */
export function stageText(stage: TurnStage | null): string {
  switch (stage) {
    case 'PROMPT':
      return '선생님이 대화를 읽고 있어요'
    case 'LLM':
      return '선생님이 답을 쓰는 중이에요'
    case 'PARSE':
      return '답을 정리하고 있어요'
    case 'TTS':
      return '목소리를 준비하고 있어요'
    default:
      return '선생님이 읽고 있어요'
  }
}

export const DETACHED_TEXT = '연결이 잠시 끊겼어요. 선생님 답을 확인하는 중이에요…'
export const SLOW_TEXT = '조금 오래 걸리고 있어요'
export const GENERIC_ERROR = '처리하지 못했어요. 다시 시도해 주세요.'
export const NETWORK_SEND_ERROR = '보내지 못했어요. 네트워크를 확인해 주세요.'
export const NOT_FOUND_CHAT = '이 채팅을 찾을 수 없어요. 삭제되었을 수 있어요.'

export interface ErrorLike {
  status: number
  message?: string
}

/** 보내기·턴 봉투 오류(ⓐ). 429 의 초는 화면이 카운트다운으로 따로 그린다. */
export function turnNoticeText(e: ErrorLike, retryAfterSec?: number | null): string {
  switch (e.status) {
    case 0:
      return NETWORK_SEND_ERROR
    case 400:
      return e.message || GENERIC_ERROR
    case 404:
      return NOT_FOUND_CHAT
    case 409:
      return '선생님이 다른 메시지에 답하는 중이에요. 답이 끝나면 다시 보내 주세요.'
    case 429:
      return `메시지를 너무 빨리 보냈어요. ${Math.max(1, retryAfterSec ?? 1)}초 뒤에 다시 보내 주세요.`
    case 422:
      return '지금은 선생님이 답할 수 없어요. 잠시 후 다시 시도해 주세요.'
    case 502:
      return '선생님 답을 받지 못했어요. 다시 시도해 주세요.'
    case 504:
      return '답이 너무 오래 걸려 멈췄어요. 다시 시도해 주세요.'
    default:
      return GENERIC_ERROR
  }
}

/** 버튼 동작(목록·메뉴·채택 등)의 봉투 오류. 400 만 서버 문구, 나머지는 공통 문구. */
export function actionErrorText(e: ErrorLike): string {
  if (e.status === 400 && e.message) return e.message
  if (e.status === 0) return '연결하지 못했어요. 네트워크를 확인해 주세요.'
  if (e.status === 404) return '찾을 수 없어요. 삭제되었을 수 있어요.'
  return GENERIC_ERROR
}

export interface FailureView {
  text: string
  retryable: boolean
}

/** SSE `error` 이벤트 → 실패 말풍선(ⓒ). */
export function turnFailure(code: string | undefined, retryable: boolean | undefined): FailureView {
  if (code === 'ENGINE_UNAVAILABLE' || retryable === false) {
    return { text: '지금은 선생님이 답할 수 없어요. 잠시 후 다시 시도해 주세요.', retryable: false }
  }
  if (code === 'ENGINE_TIMEOUT') return { text: '답이 너무 오래 걸려 멈췄어요.', retryable: true }
  return { text: '선생님 답을 받지 못했어요.', retryable: true }
}

/** 폴링 상한 초과·방 진입 시 실패 상태. */
export const LOST_FAILURE: FailureView = { text: '답을 받지 못했어요.', retryable: true }
