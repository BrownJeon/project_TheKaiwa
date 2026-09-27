/**
 * 통합 미리듣기(api-contract #18, module-dependency §4-2) — **저장 전 draft** 로 고정 문장을 합성한다. LLM 호출 없음.
 * 문장은 AppSetting `voice.preview.defaultText`(사용자가 보낼 수 없음), 캐시 키 textVersion 은 `voice.preview.textVersion`.
 * draft 는 사용자 설정 층(Resolver 1순위)을 대신하고, `speechProfile`(들려주는 방식)도 반영한다(U1).
 * 파이프라인·캐시·상태 판정은 `/api/v1/speech/tts` 와 같다(`tts/synthesize`). Trace refType = voicePreview.
 */
import { isSpeechProfile, type SpeechProfileName } from '../tts/profiles'
import { previewSettings, synthesizeSentence, type SynthesizeResult } from '../tts/synthesize'

export interface PreviewDraft {
  voiceProfileId: string
  style: string
  styleWeight: number | null
  speed: number
  pitch: number
  intonation: number
  speechProfile?: SpeechProfileName | null
}

export async function previewVoice(userId: string, draft: PreviewDraft): Promise<SynthesizeResult> {
  const { text, textVersion } = await previewSettings()
  return synthesizeSentence({
    userId,
    text,
    voiceId: draft.voiceProfileId,
    speechProfile: isSpeechProfile(draft.speechProfile) ? draft.speechProfile : 'NATIVE',
    draft: { style: draft.style, styleWeight: draft.styleWeight, speed: draft.speed, pitch: draft.pitch, intonation: draft.intonation },
    textVersion,
    trace: { refType: 'voicePreview', refId: draft.voiceProfileId },
  })
}
