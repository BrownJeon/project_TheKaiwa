/**
 * TTS 라우트 공용 — 합성 결과를 `audio/wav` 본문으로, speech 층 오류를 봉투 코드로 바꾼다.
 * 응답·헤더에는 엔진명·connection 키·호스트·캐시 키가 없다(완료 기준 10, U3·U5, Codex C1 S3).
 */
import { ApiError } from '@/modules/infra'
import type { SynthesizeResult } from '@/modules/speech'
import { TTS_HEADERS } from '@/types/tts'

export function ttsAudioResponse(r: SynthesizeResult): Response {
  const headers = new Headers({
    'Content-Type': 'audio/wav',
    'Content-Length': String(r.audio.length),
    'Cache-Control': 'private, no-store',
    [TTS_HEADERS.cache]: r.cached ? 'HIT' : 'MISS',
    [TTS_HEADERS.ttfaMs]: String(r.ttfaMs),
    [TTS_HEADERS.executionMode]: 'SERVER',
    [TTS_HEADERS.traceId]: r.traceId,
  })
  if (r.durationMs !== null) headers.set(TTS_HEADERS.durationMs, String(r.durationMs))
  return new Response(new Uint8Array(r.audio), { status: 200, headers })
}

const REQUEST_MESSAGE: Record<string, { field: string; message: string }> = {
  VOICE_NOT_AVAILABLE: { field: 'voiceId', message: '선택할 수 없는 목소리예요.' },
  TEXT_EMPTY: { field: 'text', message: '읽을 내용이 없어요.' },
  TEXT_TOO_LONG: { field: 'text', message: '문장이 너무 길어요. 조금 짧게 나눠 주세요.' },
}

/** speech/engine TTS 오류 → ApiError. 모르는 오류는 그대로 돌려준다(withApi 가 500 으로 처리). */
export function ttsError(e: unknown): unknown {
  const err = e as { name?: string; problem?: string; reason?: string; kind?: string; traceId?: unknown }
  const trace = typeof err?.traceId === 'string' ? { traceId: err.traceId } : {}
  if (err?.name === 'TtsRequestError' && err.problem) {
    const m = REQUEST_MESSAGE[err.problem] ?? { field: 'text', message: '요청을 처리할 수 없어요.' }
    return new ApiError('VALIDATION', m.message, { field: m.field, reason: err.problem })
  }
  if (err?.name === 'TtsUnavailableError') {
    return new ApiError('ENGINE_UNAVAILABLE', '선생님 목소리 서버가 준비 중이에요. 잠시 후 다시 들어 보세요.', {
      reason: 'TTS_UNAVAILABLE',
      fallbackReason: err.reason ?? 'SERVER_ERROR',
      runtime: { executionMode: 'TEXT_ONLY' },
      ...trace,
    })
  }
  if (err?.name === 'TtsEngineError') {
    if (err.kind === 'TIMEOUT') return new ApiError('ENGINE_TIMEOUT', '목소리 서버 응답이 늦어요. 잠시 후 다시 눌러 주세요.', trace)
    return new ApiError('ENGINE_ERROR', '목소리를 만들다가 문제가 생겼어요. 다시 눌러 주세요.', trace)
  }
  return e
}
