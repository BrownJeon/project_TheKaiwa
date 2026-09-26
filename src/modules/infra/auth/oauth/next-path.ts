/**
 * OAuth `nextPath` 검증 — 서버 리다이렉트용. VoiceVault `src/lib/auth/oauth/next-path.ts`를
 * 그대로 이식(기본 착지 경로만 TheMeal의 홈 `/home`으로 교체).
 *
 * URL 파서 기반(sentinel origin 비교) 방식을 쓰는 이유: 리터럴 문자열 블랙리스트
 * (`startsWith('//')` 등)는 제어문자·인코딩 우회에 취약하다.
 */

export const DEFAULT_NEXT_PATH = '/study/today'

/** OAuth 시작 라우트(로그인 화면 링크의 target). */
export const GOOGLE_AUTH_PATH = '/api/auth/google'

const SENTINEL_ORIGIN = 'http://sentinel.local'

/**
 * 계약: 반환값은 **단 1회 적용만으로** 안전하다 — 항상 "동일 출처 절대경로"(`/`로 시작하되
 * `//`로는 시작하지 않는 문자열)이거나 `DEFAULT_NEXT_PATH`다. 따라서 어떤 base에 붙여도
 * `new URL(반환값, base).origin === new URL(base).origin`이 성립한다.
 *
 * ★ VoiceVault REV-015 H1 — 경로 traversal(`/..//evil.com`, `/a/../..//evil.com`,
 *   `/../\evil.com`)은 sentinel origin **안에서** 해석되므로 origin 검사를 통과하는데,
 *   WHATWG URL이 pathname을 `//evil.com`으로 *정규화*한다. `startsWith('/')`만 보면 그 값이
 *   실제 base에 다시 붙는 순간 프로토콜 상대 URL로 해석돼 `https://evil.com/`이 된다.
 *   아래 `//` 가드가 그 클래스를 1회차에 거부한다 — 안전성이 "중복 호출(멱등)"에 의존하지
 *   않는다는 점이 핵심이다. 소비 지점의 중복 sanitize는 defense in depth로 남겨 둔다.
 */
export function sanitizeNextPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_NEXT_PATH

  // Defense in depth: 제어문자(C0 + DEL)는 파싱 시도 전에 명시적으로 거부(strip이 아니라 reject).
  if (/[\x00-\x1f\x7f]/.test(raw)) return DEFAULT_NEXT_PATH

  let parsed: URL
  try {
    parsed = new URL(raw, SENTINEL_ORIGIN)
  } catch {
    return DEFAULT_NEXT_PATH
  }

  if (parsed.origin !== SENTINEL_ORIGIN) return DEFAULT_NEXT_PATH

  const safePath = `${parsed.pathname}${parsed.search}${parsed.hash}`
  // 반환값 자체에 거는 가드다(중간 변수 pathname이 아니라) — 향후 safePath 조립 방식이
  // 바뀌어도 "밖으로 나가는 문자열"이 항상 검사된다. 백슬래시 변형(`/../\evil.com`)은
  // WHATWG URL이 special scheme에서 `\`를 `/`로 정규화하므로 같은 가드에 함께 걸린다.
  if (!safePath.startsWith('/') || safePath.startsWith('//')) return DEFAULT_NEXT_PATH

  return safePath
}

/**
 * 인증 플로우 자체의 경로 — 로그인 후 돌아갈 대상이 될 수 없다. `/login?callbackUrl=/login`
 * 같은 조작된 링크로 "로그인했는데 다시 로그인 화면"이 되는 루프를 막는다(UX 가드).
 */
function isAuthFlowPath(path: string): boolean {
  return path === '/login' || path === '/invite' || path.startsWith('/api/auth/') || path === '/api/auth'
}

export type AuthPlatform = 'web' | 'app'

/**
 * `?platform=` 파싱. 아는 값이 아니면 전부 `web`으로 수렴한다 — 앱 분기(딥링크 리다이렉트)는
 * 명시적으로 `app`이라고 말한 요청에만 적용한다.
 */
export function parsePlatform(raw: unknown): AuthPlatform {
  return raw === 'app' ? 'app' : 'web'
}

/**
 * 로그인 화면의 "Google로 계속하기" href를 만든다.
 *
 * ★ 오픈 리다이렉트 방어의 최종 권한은 여전히 **서버**(`/api/auth/google`의
 *   `sanitizeNextPath` → `createOAuthState`)에 있다. 이 함수는 그 검증을 대체하거나
 *   우회하지 않고, 같은 `sanitizeNextPath`를 화면 단에서 한 번 더 적용해 애초에 위험한
 *   값이 링크에 실려 나가지 않게 하는 defense in depth일 뿐이다.
 */
export function buildGoogleAuthHref(rawCallbackUrl: unknown, platform: AuthPlatform = 'web'): string {
  const params = new URLSearchParams()

  if (typeof rawCallbackUrl === 'string' && rawCallbackUrl.length > 0) {
    const safeNext = sanitizeNextPath(rawCallbackUrl)
    if (safeNext !== DEFAULT_NEXT_PATH && !isAuthFlowPath(safeNext)) {
      params.set('callbackUrl', safeNext)
    }
  }
  if (platform === 'app') params.set('platform', 'app')

  const qs = params.toString()
  return qs.length > 0 ? `${GOOGLE_AUTH_PATH}?${qs}` : GOOGLE_AUTH_PATH
}
