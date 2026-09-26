/** 라우트 조합 헬퍼 — Voice 검증 오류(speech 층)를 api-contract #14 의 400 VALIDATION 으로 바꾼다. */
import { ApiError } from '@/modules/infra'
import { assertSelectableVoice } from '@/modules/speech'

export async function checkVoice(voiceProfileId: string, style: string): Promise<{ id: string; name: string }> {
  try {
    return await assertSelectableVoice(voiceProfileId, style)
  } catch (e) {
    const name = (e as { name?: string }).name
    if (name === 'VoiceNotAvailableError') throw new ApiError('VALIDATION', '선택할 수 없는 목소리예요.', { field: 'voiceProfileId', reason: 'VOICE_NOT_AVAILABLE' })
    if (name === 'VoiceStyleInvalidError') throw new ApiError('VALIDATION', '이 목소리에 없는 스타일이에요.', { field: 'style', reason: 'STYLE_NOT_AVAILABLE' })
    throw e
  }
}
