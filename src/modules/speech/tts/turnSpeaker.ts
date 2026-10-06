/**
 * 회화 턴 문장 합성(task-007 K3) — #32 라우트가 conversation 의 `TurnSpeaker` 자리에 넘기는 speech 쪽 구현.
 * conversation 과 speech 는 서로 import 하지 않는다: 이 함수는 같은 **모양**의 객체를 돌려주고 라우트가 이어 붙인다.
 *
 *  - 문장 1개 = #23 과 같은 파이프라인(정규화·발음 사전·Rendering Plan·Parameter Resolver·12요소 캐시·single-flight·8초).
 *    SpeechProfile 은 사용자 설정(기본 NATIVE), 문맥은 TALK, LLM 은 `styleHint`(speech.style)만 준다.
 *  - 결과 URL 은 #24 서명 URL(10분, 사용자 결속). 응답에 엔진명·connection 키 없음(`steps` 는 관리자 Trace 전용).
 *  - 서버 TTS 를 쓸 수 없으면(연결 없음·서킷) `executionMode:'TEXT_ONLY'` — 턴 실패가 아니다. 그 밖의 실패는 그 문장만 FAILED.
 *  - Trace 를 따로 남기지 않는다(`record:false`) — 턴 Trace 가 `steps` 를 합친다.
 */
import type { TraceStep } from '@/modules/engine'
import { signTtsAudioToken } from './audioUrl'
import { synthesizeSentence } from './synthesize'
import type { LlmSpeechStyle } from './types'

export interface TurnChunkRequest {
  chunkIndex: number
  text: string
  styleHint: LlmSpeechStyle | null
  previousDurationMs: number | null
}

export interface TurnChunkAudio {
  status: 'OK' | 'FAILED'
  executionMode: 'SERVER' | 'TEXT_ONLY'
  url: string | null
  cacheKey: string | null
  durationMs: number | null
  cached: boolean
  pauseBeforeMs: number
  errorCode: string | null
  steps?: TraceStep[]
}

function failed(executionMode: 'SERVER' | 'TEXT_ONLY', errorCode: string, steps?: TraceStep[]): TurnChunkAudio {
  return { status: 'FAILED', executionMode, url: null, cacheKey: null, durationMs: null, cached: false, pauseBeforeMs: 0, errorCode, ...(steps ? { steps } : {}) }
}

export function createTurnSpeaker(ctx: { userId: string; messageId: string }): (req: TurnChunkRequest) => Promise<TurnChunkAudio> {
  return async (req) => {
    try {
      const r = await synthesizeSentence({
        userId: ctx.userId,
        text: req.text,
        styleHint: req.styleHint,
        contextMode: 'TALK',
        chunk: { index: req.chunkIndex, previousDurationMs: req.previousDurationMs },
        trace: { refType: 'chatMessage', refId: ctx.messageId, record: false },
      })
      // 청크 문장 기준 timing 을 토큰에 묶는다 — 재생 큐가 받는 #24 응답 헤더로 나간다(task-012b-4 D-T1·D-T4, SSE·#32 무변경).
      const signed = signTtsAudioToken(ctx.userId, r.cacheKey, { timing: r.timing })
      return { status: 'OK', executionMode: 'SERVER', url: signed.url, cacheKey: r.cacheKey, durationMs: r.durationMs, cached: r.cached, pauseBeforeMs: r.pauseBeforeMs, errorCode: null, steps: r.steps }
    } catch (e) {
      const err = e as { name?: string; problem?: string; kind?: string; steps?: unknown }
      const steps = Array.isArray(err?.steps) ? (err.steps as TraceStep[]) : undefined
      if (err?.name === 'TtsUnavailableError') return failed('TEXT_ONLY', 'TTS_UNAVAILABLE', steps)
      if (err?.name === 'TtsRequestError') return failed('SERVER', `TTS_${String(err.problem ?? 'REQUEST')}`.slice(0, 40), steps)
      if (err?.name === 'TtsEngineError') return failed('SERVER', `TTS_${String(err.kind ?? 'ERROR')}`.slice(0, 40), steps)
      console.warn('[tts] 턴 문장 합성 실패:', e instanceof Error ? e.name : 'unknown')
      return failed('SERVER', 'TTS_ERROR', steps)
    }
  }
}
