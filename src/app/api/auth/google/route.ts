/**
 * GET /api/auth/google — Google 인가 화면으로 리다이렉트 (설계안 §5-1·§5-2).
 *
 * 쿼리: `callbackUrl`(로그인 후 돌아갈 내부 경로), `platform=web|app`, 앱이면 `challenge`(PKCE S256, 43자 — task-003f C1-1).
 * 셋 다 **서명된 state 안에** 실어 보낸다 — 콜백 URL은 Google이 그대로 되돌려주는
 * 값이라 사용자가 조작할 수 있으므로, 앱 분기 판단을 위조 불가능한 곳에 둔다.
 * challenge 없는 앱 요청은 받지 않는다(첫 APK 부터 PKCE 필수 — 구버전 호환 없음): 앱 딥링크로 `app_login_invalid` 를 돌려준다.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildAppCallbackDeepLink, buildGoogleRedirectUri, getCallbackBase, getGoogleCredentials } from '@/modules/infra/auth/oauth/config'
import { buildGoogleAuthorizeUrl } from '@/modules/infra/auth/oauth/providers'
import { createOAuthState, getOAuthStateCookieOptions, OAUTH_STATE_COOKIE } from '@/modules/infra/auth/oauth/state'
import { parsePlatform, sanitizeNextPath } from '@/modules/infra/auth/oauth/next-path'
import { isPkceChallenge } from '@/modules/infra/auth/oauth/pkce'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const base = getCallbackBase()
  const creds = getGoogleCredentials()
  if (base === null || creds === null) {
    return NextResponse.json(
      { success: false, data: null, message: 'Google OAuth가 설정되지 않았습니다' },
      { status: 503 },
    )
  }

  const nextPath = sanitizeNextPath(req.nextUrl.searchParams.get('callbackUrl'))
  const platform = parsePlatform(req.nextUrl.searchParams.get('platform'))
  const challenge = req.nextUrl.searchParams.get('challenge')
  if (platform === 'app' && !isPkceChallenge(challenge)) {
    // 커스텀 스킴 302 — callback 의 deepLinkRedirect 와 같은 이유로 Location 을 직접 세팅한다.
    return new NextResponse(null, { status: 302, headers: { Location: buildAppCallbackDeepLink({ error: 'app_login_invalid' }) } })
  }
  const { state, nonce } = createOAuthState(nextPath, platform, platform === 'app' ? challenge : null)

  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId: creds.clientId,
    redirectUri: buildGoogleRedirectUri(base),
    state,
  })

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set({ name: OAUTH_STATE_COOKIE, value: nonce, ...getOAuthStateCookieOptions() })
  return res
}
