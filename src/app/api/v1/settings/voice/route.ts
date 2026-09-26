import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getAppSetting, getVoiceSetting, parseVoiceDraft, updateVoiceSetting } from '@/modules/preferences'
import { checkVoice } from '../../_lib/voice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #13 AI 선생님 음성 설정 — 응답에 `voice:{id,name}` 만 붙인다(엔진·model·speaker 미노출). */
export const GET = withApi(async () => {
  const s = await requireSession()
  const def = await getAppSetting<string | null>('voice.default.profileId', null)
  const setting = await getVoiceSetting(s.user.id, def)
  // 저장된 목소리가 비활성·보관됐으면 voice=null — 화면이 기본 목소리를 다시 고르게 한다(speech-platform/03 재배정 규칙).
  const voice = setting.voiceProfileId ? await checkVoice(setting.voiceProfileId, 'AUTO').catch(() => null) : null
  return ok({ ...setting, voice })
})

/** #14 음성 설정 저장 — Voice 가용성·스타일은 speech 층이 검증(라우트가 조합). */
export const PUT = withApi(async (req) => {
  const s = await requireSession()
  const draft = parseVoiceDraft(await readJsonObject(req), { requireSpeechProfile: true })
  const voice = await checkVoice(draft.voiceProfileId, draft.style)
  const saved = await updateVoiceSetting(s.user.id, draft)
  return ok({ ...saved, voice })
})
