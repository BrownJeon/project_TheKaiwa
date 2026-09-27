/**
 * L4 `speech/tts` — TTS 플랫폼 층 공개면(speech-platform/16 §1.1). 라우트는 `@/modules/speech` 를 통해서만 쓴다.
 */
export { synthesizeSentence, previewSettings, TTS_SEGMENT_MAX_CHARS, TTS_SENTENCE_TIMEOUT_MS } from './synthesize'
export type { SynthesizeInput, SynthesizeResult } from './synthesize'
export { getTtsStatus } from './status'
export { TtsRequestError, TtsUnavailableError } from './errors'
export type { TtsRequestProblem } from './errors'
export { SPEECH_PROFILES, isSpeechProfile } from './profiles'
export type { SpeechProfileName } from './profiles'
export { SEGMENT_STYLES, SEGMENT_SPEEDS, LLM_SPEECH_STYLES } from './types'
export type { SegmentStyle, SegmentSpeed, LlmSpeechStyle } from './types'
export { parseTtsRequest, TTS_TEXT_MAX } from './request'
export type { TtsRequest } from './request'
