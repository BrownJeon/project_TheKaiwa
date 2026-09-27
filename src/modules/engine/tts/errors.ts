/**
 * TTS 엔진 호출 실패 — 엔진 독립 분류(kind)만 싣는다. 메시지·code 에 요청 문장·URL·시크릿을 넣지 않는다.
 *   UNAVAILABLE   : 연결 거부·호스트 불가·서비스 준비 전(503)·게이트웨이 오류 → 상태등 판정·폴백 대상
 *   TIMEOUT       : 시간 초과(문장 8s) → 504
 *   MISCONFIGURED : 주소·시크릿·어댑터 설정 문제(401 포함) → 422, 관리자 조치 필요
 *   TEXT_TOO_LONG : 세그먼트가 엔진 상한 초과 → 400
 *   REJECTED      : 엔진이 요청을 거부(모델·화자 없음 등 4xx) → 502
 *   BAD_AUDIO     : 응답이 오디오가 아니거나 상한 초과 → 502
 *   ENGINE_ERROR  : 그 밖의 5xx → 502
 */
export type TtsFailureKind = 'UNAVAILABLE' | 'TIMEOUT' | 'MISCONFIGURED' | 'TEXT_TOO_LONG' | 'REJECTED' | 'BAD_AUDIO' | 'ENGINE_ERROR'

export class TtsEngineError extends Error {
  constructor(
    readonly kind: TtsFailureKind,
    /** 짧은 식별 코드(ECONNREFUSED·HTTP_503·SECRET_MISSING…) — 로그·Trace 용, 본문 없음. */
    readonly code: string,
    readonly retryAfterSec?: number,
  ) {
    super(`TTS ${kind} (${code})`)
    this.name = 'TtsEngineError'
  }
}

export function isTtsEngineError(e: unknown): e is TtsEngineError {
  return e instanceof TtsEngineError || (e as { name?: string })?.name === 'TtsEngineError'
}
