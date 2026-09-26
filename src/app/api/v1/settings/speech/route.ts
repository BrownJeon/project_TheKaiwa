import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getProfile, getSpeechSetting, parseSpeechPatch, updateProfile, updateSpeechSetting } from '@/modules/preferences'
import { platformFrom, resolveRecognitionMode } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #15 음성 인식 설정 + Speech Mode Resolver 해석 결과(엔진명 없음). explainLang 은 Profile 소유. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const [speech, profile] = await Promise.all([getSpeechSetting(s.user.id), getProfile(s.user.id)])
  return ok({ recognitionMode: speech.recognitionMode, explainLang: profile.explainLang, resolved: resolveRecognitionMode(speech.recognitionMode, platformFrom(req.headers)) })
})

/** #16 인식 모드 저장 — 웹에서 OFFLINE 은 400. */
export const PUT = withApi(async (req) => {
  const s = await requireSession()
  const platform = platformFrom(req.headers)
  const patch = parseSpeechPatch(await readJsonObject(req), platform)
  const speech = patch.recognitionMode ? await updateSpeechSetting(s.user.id, { recognitionMode: patch.recognitionMode }) : await getSpeechSetting(s.user.id)
  const profile = patch.explainLang ? await updateProfile(s.user.id, { explainLang: patch.explainLang }) : await getProfile(s.user.id)
  return ok({ recognitionMode: speech.recognitionMode, explainLang: profile.explainLang, resolved: resolveRecognitionMode(speech.recognitionMode, platform) })
})
