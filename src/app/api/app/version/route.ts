import { getAppVersionInfo, ok, rateLimit, withApi } from '@/modules/infra'
import { clientIpKey } from '@/modules/infra/auth/completeRateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #8 APK 최신 버전·배너 판단(공개). 앱은 `X-App-Build`(versionCode)·`X-App-Version`(versionName)을 보낸다 — 웹은 보내지 않아 배너 없음.
 * `AppRelease` 행이 없으면 `latest:null` 등 전부 null·false. 응답은 요청 헤더마다 달라 캐시하지 않는다. IP 당 60/분.
 */
export const GET = withApi(async (req) => {
  rateLimit(`app-version:${clientIpKey(req.headers)}`, 60)
  return ok(await getAppVersionInfo(req.headers), null, { headers: { 'Cache-Control': 'no-store', Vary: 'X-App-Build, X-App-Version' } })
})
