/**
 * TTS 사용자 API 공유 타입(서버 라우트 ↔ 화면). 엔진명·connection 키·호스트는 어떤 필드에도 없다(speech-platform/16 §12, U5).
 */

/** `GET /api/v1/speech/tts/status` — 서버 관점. 클라가 자기 네트워크 상태를 합쳐 5상태로 바꾼다(screens §7-3). */
export type TtsExecutionMode = 'SERVER' | 'ON_DEVICE' | 'TEXT_ONLY'
export type TtsServerHealth = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN'
export type TtsFallbackReason = 'SERVER_ERROR' | 'SERVER_TIMEOUT' | 'NO_CONNECTION' | 'OFFLINE'

export interface TtsStatusResponse {
  executionMode: TtsExecutionMode
  /** 서버는 폰의 네트워크를 모른다 — 요청이 닿았으므로 항상 ONLINE. 화면은 쓰지 않는다. */
  networkStatus: 'ONLINE' | 'OFFLINE'
  serverHealth: TtsServerHealth
  fallbackReason: TtsFallbackReason | null
  lastUpdatedAt: string | null
}

/**
 * `POST /api/v1/speech/tts`·`/voices/preview` 응답 헤더(본문은 audio/wav). 캐시 키는 싣지 않는다 — 키로 오디오를 여는 경로는
 * task-007 의 서명 URL 로만 열린다(Codex C1 S3).
 */
export const TTS_HEADERS = {
  cache: 'X-Tts-Cache',
  durationMs: 'X-Tts-Duration-Ms',
  ttfaMs: 'X-Tts-Ttfa-Ms',
  executionMode: 'X-Tts-Execution-Mode',
  traceId: 'X-Trace-Id',
  /** #24(task-007) — 캐시 오디오의 모델·사전 버전(엔진명 아님). */
  modelVersion: 'X-Tts-Model-Version',
  dictionaryVersion: 'X-Tts-Dictionary-Version',
} as const
