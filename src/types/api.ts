/**
 * 응답 봉투(api-contract §0-2) — 화면과 서버가 공유한다. 실패에는 클라이언트가 분기할 `data.code` 가 실린다(§0-5).
 * §0-5 공통 코드 + 계약 항목별 코드: `FEATURE_NOT_READY`(400, #28·#32·#38 — 아직 열리지 않은 기능), `ALREADY_REVIEWED`(409, #33),
 * `UNPROCESSABLE`(422, task-003g 발음 사전 — 형식은 맞지만 도메인 규칙 위반. 갈래는 `details.reason`: E_LEXICON_ENTRY_INVALID·E_IMPORT_* 등).
 */
export type ApiErrorCode =
  | 'VALIDATION'
  | 'FEATURE_NOT_READY'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ALREADY_REVIEWED'
  | 'UNPROCESSABLE'
  | 'ENGINE_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'ENGINE_ERROR'
  | 'ENGINE_TIMEOUT'
  | 'INTERNAL'

export type ApiEnvelope<T> =
  | { success: true; data: T; message: string | null }
  | { success: false; data: { code: ApiErrorCode; details?: Record<string, unknown> } | null; message: string }
