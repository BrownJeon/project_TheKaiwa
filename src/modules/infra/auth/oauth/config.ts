/**
 * OAuth 설정 — Google 전용 (설계안 §5).
 *
 * 값은 매 호출 시점에 `process.env`에서 읽는다 — 모듈 top-level 캡처는 pm2
 * `--update-env`로 값을 넣어도 이미 뜬 프로세스가 옛 값을 계속 들고 있게 만든다
 * (VoiceVault `oauth/config.ts`와 동일 이유).
 */

function readEnv(name: string): string | null {
  const v = process.env[name]
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

/** 콜백 베이스 URL. 끝의 `/`는 제거 — `${base}/api/auth/google/callback`이 `//api/...`가 되면
 * Google Cloud Console에 등록한 redirect_uri와 문자열이 어긋나 인증이 통째로 실패한다. */
export function getCallbackBase(): string | null {
  const raw = readEnv('OAUTH_CALLBACK_BASE')
  return raw === null ? null : raw.replace(/\/+$/, '')
}

export interface OAuthCredentials {
  clientId: string
  clientSecret: string
}

/** Google 자격증명. 하나라도 비면 null(=미설정). 값 자체는 어디에도 로그하지 않는다. */
export function getGoogleCredentials(): OAuthCredentials | null {
  const clientId = readEnv('GOOGLE_CLIENT_ID')
  const clientSecret = readEnv('GOOGLE_CLIENT_SECRET')
  if (clientId === null || clientSecret === null) return null
  return { clientId, clientSecret }
}

/** 로그인 화면에 Google 버튼을 노출할지 판단(콜백 베이스+자격증명 모두 있어야 함). */
export function isGoogleLoginEnabled(): boolean {
  return getCallbackBase() !== null && getGoogleCredentials() !== null
}

/** Google 콘솔에 등록해야 하는 redirect_uri. 리다이렉트·토큰교환 양쪽이 같은 값을 써야 한다. */
export function buildGoogleRedirectUri(base: string): string {
  return `${base}/api/auth/google/callback`
}

// ── 앱(Capacitor) 딥링크 ────────────────────────────────────────────────────
// 설계안 §5-2. 커스텀 스킴이라 assetlinks 검증이 필요 없다.

export const DEFAULT_APP_DEEP_LINK_SCHEME = 'thekaiwa'

/**
 * 딥링크 스킴. RFC 3986 scheme 문법(`ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )`)을 강제한다 —
 * `.env` 오타(`thekaiwa://`처럼 구분자까지 넣는 실수 포함)가 그대로 Location 헤더에 실려
 * 엉뚱한 URL로 리다이렉트되는 것을 막는다. 형식이 어긋나면 기본값으로 수렴한다.
 */
export function getAppDeepLinkScheme(): string {
  const raw = readEnv('APP_DEEP_LINK_SCHEME')
  if (raw === null) return DEFAULT_APP_DEEP_LINK_SCHEME
  const scheme = raw.replace(/:\/\/$/, '').replace(/:$/, '').toLowerCase()
  if (!/^[a-z][a-z0-9+.-]*$/.test(scheme)) {
    console.warn('[oauth] APP_DEEP_LINK_SCHEME 형식이 올바르지 않아 기본값을 사용합니다')
    return DEFAULT_APP_DEEP_LINK_SCHEME
  }
  return scheme
}

/**
 * 앱이 받는 딥링크 URL. `code`(성공) 또는 `error`(실패) 중 하나만 실린다 —
 * 두 경우 모두 앱의 `appUrlOpen` 핸들러 하나가 처리한다.
 */
export function buildAppCallbackDeepLink(params: { code?: string; error?: string }): string {
  const url = new URL(`${getAppDeepLinkScheme()}://auth/callback`)
  if (params.code) url.searchParams.set('code', params.code)
  if (params.error) url.searchParams.set('error', params.error)
  return url.toString()
}
