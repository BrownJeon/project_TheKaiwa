/**
 * 통합 미리듣기(api-contract #18) — draft 설정으로 고정 문장을 합성한다. LLM 호출 없음.
 * TTS 플랫폼 층(정규화·사전·Rendering Plan·캐시)과 M4 tts-service 어댑터는 **task-003** 에서 들어온다.
 * 그 전까지는 TTS 역할 connection 을 쓸 어댑터가 없으므로 `ENGINE_UNAVAILABLE(422)` 로 명확히 알린다
 * — 화면은 "음성 서버 준비 중" 안내를 띄우고, 가짜 오디오를 만들지 않는다.
 */
export interface PreviewDraft {
  voiceProfileId: string
  style: string
  styleWeight: number | null
  speed: number
  pitch: number
  intonation: number
}

export class TtsNotReadyError extends Error {
  readonly userMessage = '선생님 목소리 서버를 준비하고 있어요. 준비되면 미리듣기를 쓸 수 있어요.'
  constructor(voiceProfileId: string) {
    super(`TTS 어댑터 미설치(task-003 전) — voice=${voiceProfileId}`)
    this.name = 'NoEngineAvailableError'
  }
}

export async function previewVoice(draft: PreviewDraft): Promise<never> {
  throw new TtsNotReadyError(draft.voiceProfileId)
}
