/**
 * TTS 플랫폼(L4) 요청 오류 — 라우트가 이름·kind 로 봉투 코드를 정한다(infra/http 는 speech 를 모른다).
 *   TtsRequestError     → 400 VALIDATION (목소리 선택 불가·읽을 내용 없음·세그먼트 상한 초과)
 *   TtsUnavailableError → 422 ENGINE_UNAVAILABLE + details.reason 'TTS_UNAVAILABLE'(자막만)
 * 엔진 호출 실패(TIMEOUT → 504, 그 밖 → 502)는 engine 의 TtsEngineError 가 그대로 올라온다.
 */
import type { TtsFallbackReason } from '@/types/tts'

export type TtsRequestProblem = 'VOICE_NOT_AVAILABLE' | 'TEXT_EMPTY' | 'TEXT_TOO_LONG'

export class TtsRequestError extends Error {
  constructor(readonly problem: TtsRequestProblem) {
    super(`TTS 요청 오류: ${problem}`)
    this.name = 'TtsRequestError'
  }
}

export class TtsUnavailableError extends Error {
  readonly userMessage = '선생님 목소리 서버가 준비 중이에요. 잠시 후 다시 들어 보세요.'
  constructor(
    readonly reason: TtsFallbackReason,
    readonly traceId?: string,
  ) {
    super(`TTS 사용 불가(${reason})`)
    this.name = 'TtsUnavailableError'
  }
}
