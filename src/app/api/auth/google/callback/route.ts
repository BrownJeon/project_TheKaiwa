/**
 * GET /api/auth/google/callback — Google OAuth 콜백 (설계안 §5-1·§5-2).
 *
 * ★ 공유 패키지 어댑터(`adapters/nextjs.js`)의 `?token=` 리다이렉트를 쓰지 않는다 —
 *   localStorage 토큰은 XSS로 읽히고, URL 쿼리에 실리면 브라우저 히스토리·Referer·
 *   nginx 액세스 로그에 30일짜리 로그인 자격증명이 평문으로 남는다.
 *
 * ★ 판정 순서(계정 탈취 방지 핵심):
 *   1) (provider, oauthId) 일치 → 로그인
 *   2) 미검증 이메일 → 연결도 생성도 거부(fail-closed)
 *   3) 검증된 이메일이 기존 계정과 일치 → 연결 후 로그인(seed된 OWNER가 이 경로로 매칭)
 *   4) 그 외(신규) → 계정을 여기서 만들지 않는다. 초대코드 대기 쿠키를 발급하고
 *      `/invite` 화면으로 보낸다 — `POST /api/auth/complete`가 초대코드를 통과시켜야만
 *      비로소 계정이 생성된다.
 *
 * ★ `platform=app`(state에 서명돼 있음)이면 성공 시 세션 쿠키 대신 60초·1회용
 *   `AppAuthCode`를 발급하고 `thekaiwa://auth/callback?code=`로 302한다. Custom Tabs에서
 *   발급한 쿠키는 앱 WebView로 오지 않기 때문이다(설계안 §5-2).
 *   신규 가입은 앱에서도 `/invite`(Custom Tabs 안)를 거치고, 딥링크 전환은
 *   `POST /api/auth/complete`가 담당한다.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { setSessionCookie } from '@/modules/infra/session'
import {
  buildAppCallbackDeepLink,
  buildGoogleRedirectUri,
  getCallbackBase,
  getGoogleCredentials,
} from '@/modules/infra/auth/oauth/config'
import { fetchGoogleProfile } from '@/modules/infra/auth/oauth/providers'
import { getClearOAuthStateCookieOptions, OAUTH_STATE_COOKIE, verifyOAuthState } from '@/modules/infra/auth/oauth/state'
import { getPendingCookieOptions, OAUTH_PENDING_COOKIE, signPendingSignup } from '@/modules/infra/auth/oauth/pending'
import { findUserByEmail, findUserByOAuth, linkOAuthToUser, maskEmail } from '@/modules/infra/auth/oauth/users'
import { issueAppAuthCode } from '@/modules/infra/auth/oauth/app-code'
import type { AuthPlatform } from '@/modules/infra/auth/oauth/next-path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 공개 canonical 주소(OAUTH_CALLBACK_BASE)를 우선 쓴다 — nginx 리버스 프록시 뒤에서
 * `req.nextUrl.origin`이 내부 바인딩 주소로 잡힐 가능성을 배제하기 위함. */
function internalUrl(req: NextRequest, path: string): URL {
  const base = getCallbackBase()
  return new URL(path, base ?? req.nextUrl.origin)
}

function clearState(res: NextResponse): NextResponse {
  res.cookies.set({ name: OAUTH_STATE_COOKIE, value: '', ...getClearOAuthStateCookieOptions() })
  return res
}

/**
 * 커스텀 스킴 302. `NextResponse.redirect()`를 쓰지 않는다 — 그 헬퍼는 인자를 `new URL()`로
 * 재파싱해 검증하는데, http(s)가 아닌 스킴에 대한 동작이 Next 버전에 묶인 계약이다.
 * Location 헤더를 직접 세팅하면 그 의존이 사라진다(값은 `buildAppCallbackDeepLink`가
 * 스킴 문법까지 검증해 조립한 문자열뿐이다).
 */
function deepLinkRedirect(url: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { Location: url } })
}

/**
 * 실패는 고정 코드로만 알린다. provider 원문 오류 메시지는 URL에 절대 싣지 않는다(서버 로그에만).
 * 앱 흐름이면 웹 로그인 화면 대신 딥링크로 오류를 돌려준다 — Custom Tabs에 웹 로그인 화면을
 * 남기면 사용자가 앱과 분리된 세션을 만들게 된다.
 */
function failRedirect(req: NextRequest, code: string, platform: AuthPlatform): NextResponse {
  if (platform === 'app') {
    return clearState(deepLinkRedirect(buildAppCallbackDeepLink({ error: code })))
  }
  const url = internalUrl(req, '/login')
  url.searchParams.set('oauth_error', code)
  return clearState(NextResponse.redirect(url))
}

/**
 * 로그인 성공 — 웹은 세션 쿠키, 앱은 1회용 코드 딥링크.
 * 앱 경로에서 세션 쿠키를 심지 않는 것이 핵심이다: 이 응답을 받는 것은 Custom Tabs이지
 * 앱 WebView가 아니라서, 쿠키를 심어도 앱은 로그아웃 상태인 채 브라우저에만 세션이 남는다.
 */
async function loginRedirect(
  req: NextRequest,
  user: { id: string; email: string },
  nextPath: string,
  platform: AuthPlatform,
): Promise<NextResponse> {
  if (platform === 'app') {
    const code = await issueAppAuthCode(user.id)
    return clearState(deepLinkRedirect(buildAppCallbackDeepLink({ code })))
  }
  const res = clearState(NextResponse.redirect(internalUrl(req, nextPath)))
  setSessionCookie(res, { userId: user.id, email: user.email })
  return res
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  // state 검증 전에는 platform을 알 수 없다 — 그 전 단계의 실패는 웹 흐름으로 수렴시킨다.
  const stateCheck = verifyOAuthState(sp.get('state'), req.cookies.get(OAUTH_STATE_COOKIE)?.value ?? null)
  const platform: AuthPlatform = stateCheck.ok ? stateCheck.platform : 'web'

  const base = getCallbackBase()
  const creds = getGoogleCredentials()
  if (base === null || creds === null) return failRedirect(req, 'not_configured', platform)

  // 사용자가 동의 화면에서 취소한 경우도 여기로 온다 — 오류가 아니라 취소로 안내한다.
  const providerError = sp.get('error')
  if (providerError) {
    console.warn(`[oauth] google 제공자 오류/취소: ${providerError}`)
    return failRedirect(req, providerError === 'access_denied' ? 'cancelled' : 'failed', platform)
  }

  const code = sp.get('code')
  if (!code) return failRedirect(req, 'failed', platform)

  if (!stateCheck.ok) {
    console.warn(`[oauth] google state 검증 실패: ${stateCheck.reason}`)
    return failRedirect(req, 'invalid_state', platform)
  }

  try {
    const profile = await fetchGoogleProfile({
      code,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      redirectUri: buildGoogleRedirectUri(base),
    })

    // 1) 이미 이 Google 신원으로 가입된 회원
    const byOAuth = await findUserByOAuth(profile.providerId)
    if (byOAuth) {
      return await loginRedirect(req, byOAuth, stateCheck.nextPath, platform)
    }

    // 2) 미검증 이메일 — 연결·생성 모두 거부(fail-closed, 계정 탈취 방지 핵심)
    if (!profile.emailVerified) {
      console.warn(`[oauth] google 미검증 이메일 거부 (${maskEmail(profile.email)}) — 연결·생성 모두 차단`)
      return failRedirect(req, 'email_unverified', platform)
    }

    // 3) 검증된 이메일이 기존 계정과 일치 → 연결.
    //    이미 **다른** Google 신원에 묶인 계정이면 연결하지 않고 실패로 끝낸다 — 이메일이
    //    재발급·이관됐을 때 남의 데이터에 올라타는 경로가 되기 때문(`linkOAuthToUser` 주석).
    const byEmail = await findUserByEmail(profile.email)
    if (byEmail) {
      const linked = await linkOAuthToUser(byEmail.id, profile)
      if (linked === null) {
        console.warn(`[oauth] google 연결 거부 — 이미 다른 신원에 묶인 계정 (${maskEmail(profile.email)})`)
        return failRedirect(req, 'account_conflict', platform)
      }
      console.log(`[oauth] google 계정 연결 user=${linked.id} role=${linked.role} (${maskEmail(profile.email)})`)
      return await loginRedirect(req, linked, stateCheck.nextPath, platform)
    }

    // 4) 신규 — 계정을 여기서 만들지 않는다(초대코드 게이트).
    const res = clearState(NextResponse.redirect(internalUrl(req, '/invite')))
    res.cookies.set({
      name: OAUTH_PENDING_COOKIE,
      value: signPendingSignup(profile, stateCheck.nextPath, platform),
      ...getPendingCookieOptions(),
    })
    console.log(`[oauth] google 신규 — 초대코드 대기 (${maskEmail(profile.email)}) platform=${platform}`)

    // 관리자에게 "누가 초대코드를 기다리고 있다 + 현재 코드" 를 통보한다(task-008).
    // 🔒 코드는 관리자 주소로만 간다 — 이 함수는 수신자 인자를 아예 받지 않는다.
    // ⚠️ await 하지 않는다: 이 응답은 초대코드 화면으로 가는 302 다. SMTP 왕복(최악 20초)을
    //    묶으면 곁다리 통보가 로그인 흐름을 인질로 잡는다. 함수는 던지지 않고 배경에서
    //    끝나며, 빈도 제한(이메일당 시간당 1통) 예약만 동기로 처리한다.
    // TheKaiwa 는 1인 앱이라 SMTP 통보(TheMeal task-008)를 이식하지 않는다 — 초대코드는 OWNER 가 .env 로 관리.

    return res
  } catch (e) {
    // 제공자 원문 오류는 서버 로그에만. 사용자에겐 고정 코드만 준다.
    console.error('[oauth] google 콜백 실패:', e instanceof Error ? e.message : String(e))
    return failRedirect(req, 'failed', platform)
  }
}
