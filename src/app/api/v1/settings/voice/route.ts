import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getAppSetting, getVoiceSetting, parseVoiceDraft, reassignVoice, updateVoiceSetting } from '@/modules/preferences'
import { describeVoice } from '@/modules/speech'
import { checkVoice } from '../../_lib/voice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #13 AI 선생님 음성 설정 — 응답에 `voice:{id,name}` 만 붙인다(엔진·model·speaker 미노출).
 * 저장된 목소리가 비활성·보관됐으면 기본 목소리로 **재배정**하고 `notice:{code:'VOICE_REASSIGNED',from,to}` 를 1회 싣는다
 * (speech-platform/13 §3.6·03 재배정 규칙, REV-006 M4). 재배정 후에는 DB 가 바뀌므로 다음 조회에는 notice 가 없다.
 */
export const GET = withApi(async () => {
  const s = await requireSession()
  const def = await getAppSetting<string | null>('voice.default.profileId', null)
  let setting = await getVoiceSetting(s.user.id, def)
  let voice = setting.voiceProfileId ? await checkVoice(setting.voiceProfileId, 'AUTO').catch(() => null) : null
  let notice: { code: 'VOICE_REASSIGNED'; from: string | null; to: string } | null = null
  if (!voice && def && def !== setting.voiceProfileId) {
    const to = await checkVoice(def, 'AUTO').catch(() => null)
    if (to) {
      const from = setting.voiceProfileId ? await describeVoice(setting.voiceProfileId) : null
      setting = await reassignVoice(s.user.id, to.id)
      voice = to
      notice = { code: 'VOICE_REASSIGNED', from: from?.name ?? null, to: to.name }
    }
  }
  return ok({ ...setting, voice, ...(notice ? { notice } : {}) }, notice ? `선택했던 목소리를 쓸 수 없어 ${notice.to} 로 바꿨어요.` : null)
})

/** #14 음성 설정 저장 — Voice 가용성·스타일은 speech 층이 검증(라우트가 조합). */
export const PUT = withApi(async (req) => {
  const s = await requireSession()
  const draft = parseVoiceDraft(await readJsonObject(req), { requireSpeechProfile: true })
  const voice = await checkVoice(draft.voiceProfileId, draft.style)
  const saved = await updateVoiceSetting(s.user.id, draft)
  return ok({ ...saved, voice })
})
