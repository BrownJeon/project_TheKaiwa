/**
 * 공유 패키지(`@workspace/auth-oauth`) Google 프로바이더 어댑터.
 *
 * 공유 패키지에서 가져오는 것은 `providers/google`과 `core/exchange`뿐이다.
 * `adapters/nextjs`는 쓰지 않는다 — 그 콜백은 JWT를 서명해 `?token=` 쿼리로 리다이렉트하고
 * 프론트가 localStorage에 저장하는데, localStorage 토큰은 XSS로 읽히고 URL 쿼리는 로그에
 * 남는다. 이 앱은 httpOnly 쿠키 세션을 쓰므로 그 경로를 아예 타지 않는다.
 */
import googleProvider from '@workspace/auth-oauth/providers/google'
import { getJson, postForm } from '@workspace/auth-oauth/core/exchange'

/** 이 앱이 실제로 쓰는 형태 — `emailVerified`가 필수 boolean으로 확정된 프로필. */
export interface OAuthProfile {
  providerId: string
  email: string
  name: string
  avatar: string | null
  emailVerified: boolean
}

interface RawNormalizedProfile {
  providerId: string
  email: string
  name: string
  avatar: string | null
  emailVerified?: boolean
}

/**
 * 공유 패키지의 정규화 결과 → 이 앱이 쓰는 확정 형태.
 * `emailVerified`는 `=== true`일 때만 true — 필드가 없거나 boolean이 아니면 미검증으로
 * 수렴한다(fail-closed). 이 값 하나로 "기존 계정에 연결할지"가 갈리므로 모르는 상태를
 * 검증됨으로 취급하면 안 된다.
 */
function normalizeProfile(raw: unknown): OAuthProfile {
  const p = googleProvider.normalizeProfile(raw) as RawNormalizedProfile
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : ''
  if (email.length === 0) throw new Error('google: 프로필에 이메일이 없습니다')
  const providerId = typeof p.providerId === 'string' ? p.providerId : String(p.providerId ?? '')
  if (providerId.length === 0) throw new Error('google: 프로필에 providerId가 없습니다')

  return {
    providerId,
    email,
    name: typeof p.name === 'string' && p.name.length > 0 ? p.name : email,
    avatar: typeof p.avatar === 'string' && p.avatar.length > 0 ? p.avatar : null,
    emailVerified: p.emailVerified === true,
  }
}

/** 인가 코드 → 프로필. 실패는 그대로 throw하고 호출부(콜백 라우트)가 일반 오류로 수렴시킨다. */
export async function fetchGoogleProfile(args: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<OAuthProfile> {
  const tokenData = await postForm(googleProvider.tokenUrl, {
    client_id: args.clientId,
    client_secret: args.clientSecret,
    code: args.code,
    redirect_uri: args.redirectUri,
    grant_type: 'authorization_code',
  })
  const accessToken = (tokenData as Record<string, unknown> | null)?.access_token
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new Error('토큰 응답에 access_token이 없습니다')
  }
  const rawProfile = await googleProvider.getProfile(accessToken, tokenData, { getJson })
  return normalizeProfile(rawProfile)
}

/** Google 인가 화면 URL. */
export function buildGoogleAuthorizeUrl(args: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(googleProvider.authUrl)
  url.searchParams.set('client_id', args.clientId)
  url.searchParams.set('redirect_uri', args.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', googleProvider.scope)
  url.searchParams.set('state', args.state)
  for (const [k, v] of Object.entries(googleProvider.extraAuthParams ?? {})) {
    url.searchParams.set(k, v as string)
  }
  return url.toString()
}
