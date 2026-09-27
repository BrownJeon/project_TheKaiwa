/**
 * L4 Speech Platform — 공개 API(module-dependency L4). task-005: Voice 목록·검증, 인식 모드 해석.
 * task-003d: TTS 플랫폼 층(정규화·발음 사전·Rendering Plan·SpeechProfile·캐시·상태) + 미리듣기 실제 합성.
 * conversation·learning 을 import 하지 않는다(라우트가 조합).
 */
export { listSelectableVoices, assertSelectableVoice, describeVoice } from './voices/registry'
export type { SelectableVoice } from './voices/registry'
export { resolveRecognitionMode, platformFrom } from './stt/modeResolver'
export type { RecognitionMode, ResolvedRecognition } from './stt/modeResolver'
export { previewVoice } from './voices/preview'
export type { PreviewDraft } from './voices/preview'
export * from './tts'
export { listVoicesForAdmin, getVoiceForAdmin, countVoicesByStatus } from './voices/admin'
export type { AdminVoiceRow } from './voices/admin'
