/**
 * TTS 플랫폼(L4) 공용 타입 — 엔진 독립 표현만(speech-platform/16 §4.1). 엔진 고유 파라미터명은 여기에 없다.
 */

/** 세그먼트 라벨(§4.1) — 의미 스타일. 실제 voice 스타일명으로의 매핑은 renderingPlan 이 한다. */
export const SEGMENT_STYLES = ['FRIENDLY', 'CALM', 'ENCOURAGING', 'EXPLANATION', 'EMPHASIS'] as const
export type SegmentStyle = (typeof SEGMENT_STYLES)[number]

export const SEGMENT_SPEEDS = ['NORMAL', 'SLOW', 'VERY_SLOW'] as const
export type SegmentSpeed = (typeof SEGMENT_SPEEDS)[number]

/** LLM §67 `speech.style` — Resolver 5순위 입력이자 세그먼트 라벨 원천(§4.2). */
export const LLM_SPEECH_STYLES = ['NEUTRAL', 'ENCOURAGING', 'CALM', 'CHEERFUL'] as const
export type LlmSpeechStyle = (typeof LLM_SPEECH_STYLES)[number]

/** 엔진 독립 음성 수치(범위 정본: preferences `VOICE_PARAM_RANGES` — 여기서 숫자를 되풀이하지 않는다). style 은 voice 스타일 이름. */
export interface VoiceParams {
  style: string
  styleWeight: number
  speed: number
  pitch: number
  intonation: number
}

export type ParamSource = 'USER_SETTING' | 'VOICE_PROFILE' | 'PERSONA' | 'CONTEXT' | 'LLM' | 'DEFAULT'

export interface ResolvedBase extends VoiceParams {
  sourceByKey: Record<keyof VoiceParams, ParamSource>
}

export interface PlanSegment {
  index: number
  /** 원문 조각(자막·timing 기준). */
  text: string
  normalizedText: string
  style?: SegmentStyle
  speed?: SegmentSpeed
  pauseBeforeMs: number
  /** 라벨·프로필 배율을 적용하고 범위로 자른 세그먼트 유효값 — 캐시 키·어댑터 입력. */
  effective: VoiceParams
}

export interface SpeechRenderingPlan {
  planVersion: 1
  voiceId: string
  speechProfile: string
  base: ResolvedBase
  segments: PlanSegment[]
}
