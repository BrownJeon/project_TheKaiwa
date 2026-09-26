import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseVoiceDraft } from '@/modules/preferences'
import { previewVoice } from '@/modules/speech'
import { checkVoice } from '../../_lib/voice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #18 통합 미리듣기(draft) — 사용자당 10/분. 텍스트는 서버 고정(사용자가 보낼 수 없음).
 * TTS 연결(task-003) 전에는 `422 ENGINE_UNAVAILABLE` 로 끝난다.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`preview:${s.user.id}`, 10)
  const draft = parseVoiceDraft(await readJsonObject(req), { requireSpeechProfile: false })
  await checkVoice(draft.voiceProfileId, draft.style)
  // 미리듣기는 고정 문장이라 speechProfile 은 쓰지 않는다(문맥 프로필은 대화 TTS 에서).
  return ok(await previewVoice({ voiceProfileId: draft.voiceProfileId, style: draft.style, styleWeight: draft.styleWeight, speed: draft.speed, pitch: draft.pitch, intonation: draft.intonation }))
})
