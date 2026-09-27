import { rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseVoiceDraft } from '@/modules/preferences'
import { previewVoice } from '@/modules/speech'
import { checkVoice } from '../../_lib/voice'
import { ttsAudioResponse, ttsError } from '../../speech/_lib/tts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #18 통합 미리듣기(draft) — 사용자당 10/분. 문장은 서버 고정(사용자가 보낼 수 없음), 저장하지 않은 draft·들려주는 방식(U1)으로 합성해
 * `audio/wav` 본문을 준다(+ `X-Tts-Cache: HIT|MISS`). 캐시 URL(#24)은 서명 URL 과 함께 task-007.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`preview:${s.user.id}`, 10)
  const draft = parseVoiceDraft(await readJsonObject(req), { requireSpeechProfile: false })
  await checkVoice(draft.voiceProfileId, draft.style)
  try {
    return ttsAudioResponse(await previewVoice(s.user.id, draft))
  } catch (e) {
    throw ttsError(e)
  }
})
