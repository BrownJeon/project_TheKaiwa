/**
 * L4 Speech Platform — 공개 API(module-dependency L4). task-005: Voice 목록·검증, 인식 모드 해석.
 * task-003d: TTS 플랫폼 층(정규화·발음 사전·Rendering Plan·SpeechProfile·캐시·상태) + 미리듣기 실제 합성.
 * task-003e: 실시간 인식 서버 쪽(#19 설정·#20 티켓·gateway 판정) + 발화 기록(#21 업로드·internal 콜백·30일 정리).
 *   클라이언트(브라우저) 코드는 이 index 가 아니라 `@/modules/speech/stt/client` 에서만 export 한다(서버 코드 비포함).
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
export { getSpeechConfig, ONDEVICE_FAILURE_THRESHOLD } from './stt/config'
export type { SpeechConfig } from './stt/config'
export { issueSpeechTicket, parseTicketRequest, SttUnavailableError, WS_TICKET_AUDIENCE, WS_TICKET_TTL_SEC, TICKET_PURPOSES } from './stt/ticket'
export type { SpeechTicket, TicketRequest, TicketPurpose } from './stt/ticket'
export { assessGateway } from './stt/gateway'
export type { GatewayAvailability, GatewayUnavailableReason } from './stt/gateway'
export {
  recordUploadedUtterance,
  registerGatewayUtterance,
  purgeExpiredAudio,
  parseUploadForm,
  parseGatewayBody,
  UTTERANCE_MAX_BYTES,
  UTTERANCE_MAX_DURATION_MS,
  UTTERANCE_RETENTION_DAYS,
} from './utterances'
export type { RecordedUtterance, RegisteredGatewayUtterance } from './utterances'
