/**
 * GET /api/auth/google — Google 인가 화면으로 리다이렉트 (설계안 §5-1·§5-2).
 *
 * 쿼리: `callbackUrl`(로그인 후 돌아갈 내부 경로), `platform=web|app`.
 * 두 값 모두 **서명된 state 안에** 실어 보낸다 — 콜백 URL은 Google이 그대로 되돌려주는
 * 값이라 사용자가 조작할 수 있으므로, 앱 분기 판단을 위조 불가능한 곳에 둔다.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { buildGoogleRedirectUri, getCallbackBase, getGoogleCredentials } from '@/modules/infra/auth/oauth/config'
import { buildGoogleAuthorizeUrl } from '@/modules/infra/auth/oauth/providers'
import { createOAuthState, getOAuthStateCookieOptions, OAUTH_STATE_COOKIE } from '@/modules/infra/auth/oauth/state'
import { parsePlatform, sanitizeNextPath } from '@/modules/infra/auth/oauth/next-path'

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
  const { state, nonce } = createOAuthState(nextPath, platform)

  const authorizeUrl = buildGoogleAuthorizeUrl({
    clientId: creds.clientId,
    redirectUri: buildGoogleRedirectUri(base),
    state,
  })

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set({ name: OAUTH_STATE_COOKIE, value: nonce, ...getOAuthStateCookieOptions() })
  return res
}
