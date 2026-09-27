import { ok, rateLimit, requireSession, withApi } from '@/modules/infra'
import { getSpeechSetting } from '@/modules/preferences'
import { getSpeechConfig, platformFrom } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #19 실시간 인식 런타임 설정 — 시크릿·서버 주소·엔진명 없음(`connectionKey` 는 불투명 id). `ETag`=`configVersion`,
 * `If-None-Match` 가 같으면 304. 앱/웹은 `X-Client-Platform` 으로 가른다(웹은 onDevice 세부 없음). 사용자당 30/분.
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`speech-config:${s.user.id}`, 30)
  const setting = await getSpeechSetting(s.user.id)
  const cfg = await getSpeechConfig({ recognitionMode: setting.recognitionMode, platform: platformFrom(req.headers) })
  const etag = `"${cfg.configVersion}"`
  const headers = { ETag: etag, 'Cache-Control': 'private, no-cache', Vary: 'X-Client-Platform, Cookie' }
  const inm = req.headers.get('if-none-match')
  if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) return new Response(null, { status: 304, headers })
  return ok(cfg, null, { headers })
})
