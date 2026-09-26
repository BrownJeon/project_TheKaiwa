/**
 * 응답 봉투(api-contract §0-2) — 화면과 서버가 공유한다. 실패에는 클라이언트가 분기할 `data.code` 가 실린다(§0-5).
 */
export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ENGINE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'ENGINE_ERROR'
  | 'ENGINE_TIMEOUT'
  | 'INTERNAL'

export type ApiEnvelope<T> =
  | { success: true; data: T; message: string | null }
  | { success: false; data: { code: ApiErrorCode; details?: Record<string, unknown> } | null; message: string }
