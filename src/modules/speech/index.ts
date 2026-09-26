/**
 * L4 Speech Platform — 공개 API(module-dependency L4). task-005 범위: Voice 목록·검증, 인식 모드 해석, 미리듣기 진입점.
 * conversation·learning 을 import 하지 않는다(라우트가 조합). 실제 합성(TTS 플랫폼 층)은 task-003.
 */
export { listSelectableVoices, assertSelectableVoice, describeVoice } from './voices/registry'
export type { SelectableVoice } from './voices/registry'
export { resolveRecognitionMode, platformFrom } from './stt/modeResolver'
export type { RecognitionMode, ResolvedRecognition } from './stt/modeResolver'
export { previewVoice } from './voices/preview'
