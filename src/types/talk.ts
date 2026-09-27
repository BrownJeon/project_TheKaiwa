/**
 * AI 회화(음성) 턴 계약 타입(task-007, api-contract #32·#24·#21b·#29) — 서버 라우트 ↔ 화면 공용. 엔진명·connection 키·모델명 없음.
 * 정본은 api-contract.md 이고 이 파일은 그 모양을 코드로 옮긴 것이다(어긋나면 문서가 이긴다).
 */

/** #32 요청 `clientTimings` — 기준점은 손 뗌(글자 턴은 보내기 누름). `sttMs` 만 이번 턴, 나머지는 `prevMessageId` 턴 값. 각 0~120000. */
export interface TurnClientTimings {
  prevMessageId?: string | null
  sttMs?: number | null
  releaseToFirstAudioEventMs?: number | null
  firstAudioAtMs?: number | null
  playbackStartDelayMs?: number | null
}

/** #32 요청 본문(음성 턴). `utteranceId` 가 있으면 `inputSource` 는 `REALTIME_STT`(생략 시 그 값). */
export interface TurnRequestBody {
  text: string
  inputSource?: 'REALTIME_STT' | 'SERVER_STT' | 'TEXT'
  utteranceId?: string | null
  clientTimings?: TurnClientTimings | null
}

/**
 * SSE `audio` — TALK 턴 문장 1개. `chunkIndex` 순으로만 재생한다(캐시 HIT 청크가 먼저 도착할 수 있다).
 * `status:'FAILED'` 면 url·cacheKey·durationMs 가 null 이고 그 문장만 소리 없이 넘어간다. `last` 는 서버가 마지막임을 **알 때만** true
 * (조기 합성 청크는 항상 false) — 끝의 기준은 `done`(모든 audio 뒤 1회)이다.
 */
export interface TurnAudioEvent {
  chunkIndex: number
  text: string
  /** `/api/v1/speech/tts/<token>` — 세션 사용자 결속·10분 만료. 보관·재사용하지 않는다(다시 듣기는 #23). */
  url: string | null
  cacheKey: string | null
  durationMs: number | null
  cached: boolean
  /** 이 청크 앞 재생 간격(ms) — SpeechProfile 간격 정책 + Rendering Plan 쉼. 첫 청크 0. */
  pauseBeforeMs: number
  last: boolean
  /** chunkIndex 0 에만: 턴 요청 수신 → 첫 청크 오디오 준비(서버 ms). 실패 청크면 null. */
  ttfaMs?: number | null
  runtime: { executionMode: 'SERVER' }
  status: 'OK' | 'FAILED'
}

/** SSE `status` — `stage` 진입마다. `warning` 이 있는 경우는 아래 셋. */
export interface TurnStatusEvent {
  stage: 'PROMPT' | 'LLM' | 'PARSE' | 'TTS'
  elapsedMs: number
  /**
   * PARSE `CORRECTION_ORIGINAL_MISMATCH`(교정 버림) ·
   * TTS `AUDIO_TEXT_MISMATCH`(조기 재생 문장이 최종 답과 다름 — 재생을 끊고 done 의 최종 텍스트만 보인다) ·
   * TTS `TTS_UNAVAILABLE`(이 턴은 자막만 — 이후 audio 없음, `runtime.executionMode:'TEXT_ONLY'`).
   */
  warning?: 'CORRECTION_ORIGINAL_MISMATCH' | 'AUDIO_TEXT_MISMATCH' | 'TTS_UNAVAILABLE'
  runtime?: { executionMode: 'TEXT_ONLY' }
}

/** #29 확장 — USER 메시지(발화에서 온 것만 값이 있다). `audioAvailable` = 원음이 보존 기간 안이고 지워지지 않음(#21b 재생 가능). */
export interface MessageUtteranceFields {
  utteranceId: string | null
  audioAvailable: boolean
}
