/**
 * GET /api/auth/app-exchange?code= — 앱 딥링크 코드 → 세션 쿠키 (설계안 §5-2).
 *
 * 앱이 `thekaiwa://auth/callback?code=`를 받으면 WebView를 이 주소로 이동시킨다. 여기서
 * 코드를 **소각**하고 진짜 세션 쿠키를 심은 뒤 `/home`으로 302한다.
 *
 * ★ 실패는 만료·재사용·미존재를 구분하지 않는다 — 전부 같은 응답으로 수렴시켜 "그 코드는
 *   존재하지만 이미 썼다" 같은 정보가 새지 않게 한다(`consumeAppAuthCode` 계약).
 * ★ 이 라우트는 인증 **이전** 단계라 `auth()`를 걸 수 없다. 대신 코드 자체가 자격증명이며,
 *   64자 hex 형식 검사 → 조건부 UPDATE 1건 → 사용자 조회 순으로만 권한이 생긴다.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { setSessionCookie } from '@/modules/infra/session'
import { consumeAppAuthCode } from '@/modules/infra/auth/oauth/app-code'
import { getCallbackBase } from '@/modules/infra/auth/oauth/config'
import { DEFAULT_NEXT_PATH, sanitizeNextPath } from '@/modules/infra/auth/oauth/next-path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function internalUrl(req: NextRequest, path: string): URL {
  const base = getCallbackBase()
  return new URL(path, base ?? req.nextUrl.origin)
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  try {
    const user = await consumeAppAuthCode(sp.get('code'))
    if (user === null) {
      const url = internalUrl(req, '/login')
      url.searchParams.set('oauth_error', 'app_code_invalid')
      return NextResponse.redirect(url)
    }

    // 딥링크가 돌아올 목적지는 앱이 정할 수 있지만, 항상 동일 출처 절대경로로 수렴시킨다.
    const nextPath = sanitizeNextPath(sp.get('next') ?? DEFAULT_NEXT_PATH)
    const res = NextResponse.redirect(internalUrl(req, nextPath))
    setSessionCookie(res, { userId: user.id, email: user.email })
    return res
  } catch (e) {
    console.error('[auth] app-exchange 실패:', e instanceof Error ? e.message : String(e))
    const url = internalUrl(req, '/login')
    url.searchParams.set('oauth_error', 'app_code_invalid')
    return NextResponse.redirect(url)
  }
}
