import { jwtVerify } from 'jose'

/**
 * Edge Runtime에서도 안전하게 import 가능한 세션 JWT 검증 모듈.
 * VoiceVault `src/lib/jwt.ts` 이식 — 이유 그대로: `middleware.ts`(Edge Runtime)에서
 * `jsonwebtoken`을 쓰면 빌드는 통과해도 실제 요청 시점에 "The edge runtime does not
 * support Node.js 'crypto' module"을 던진다(TheThinker·VoiceVault에서 실측된 실패 모드).
 * `jose`는 WebCrypto 기반이라 Edge에서 동작하고, `jsonwebtoken`으로 서명한 HS256
 * 토큰을 그대로 검증할 수 있다.
 *
 * 이 파일은 검증(verify)만 담당한다. 서명(sign)은 Node.js 런타임 Route Handler에서만
 * `jsonwebtoken`을 쓴다(`src/lib/session.ts`) — 이 파일이 `jsonwebtoken`/`@prisma/client`를
 * import하면 Edge 번들에 함께 딸려 들어가 동일한 문제를 재현한다.
 */

export const SESSION_COOKIE_NAME = 'thekaiwa_session'

function getJwtSecretString(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    // 하드코딩 폴백 비밀키를 두지 않는다 — 없으면 즉시 실패시켜 "비밀키가 조용히 약한
    // 기본값으로 새는" 상황을 원천 차단한다.
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return secret
}

let cachedSecretKey: Uint8Array | null = null
function getSecretKey(): Uint8Array {
  if (!cachedSecretKey) {
    cachedSecretKey = new TextEncoder().encode(getJwtSecretString())
  }
  return cachedSecretKey
}

export const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d'

const UNIT_SECONDS: Record<'s' | 'm' | 'h' | 'd', number> = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60 }

function parseExpiresToSeconds(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim())
  if (!match) return 30 * 24 * 60 * 60
  const amount = Number(match[1])
  const unit = match[2] as 's' | 'm' | 'h' | 'd'
  return amount * UNIT_SECONDS[unit]
}

export const SESSION_MAX_AGE_SECONDS = parseExpiresToSeconds(JWT_EXPIRES)

/**
 * `qa: true` 는 QA 테스트 계정 전용 토큰(`tests/live/qa-session.ts`, 1시간). 이 토큰은 **nginx 를 거치지 않은 localhost 직접 요청**에서만
 * 인정한다(`isQaTokenAllowed`) — 쿠키가 새어도 운영 도메인에서는 세션이 되지 않는다(reviewer REV-006 High).
 */
export type TokenPayload = { userId: string; email: string; qa?: true }

/**
 * QA 토큰 허용 조건: Host 가 127.0.0.1/localhost 이고 nginx 의 `X-Real-IP` 가 없다.
 *  - nginx 의 kaiwa vhost 는 모든 location 에서 `Host $host`(= kaiwa 도메인)를 붙이고, 외부에서 Host 를 127.0.0.1 로 보내면
 *    kaiwa vhost 가 아니라 기본 서버로 가서 3010 에 닿지 않는다 → 외부 요청은 Host 조건을 만족할 수 없다.
 *  - 더 확실한 근거는 두 번째 조건이다: kaiwa vhost 의 `location /`·`/ws/speech` 는 `X-Real-IP $remote_addr` 를 **무조건 덮어써** 보내고,
 *    앱은 `127.0.0.1:3010` 에만 바인딩돼(ecosystem.config.js) nginx 를 거치지 않는 외부 경로가 없다 → 이중 방어(reviewer REV-006 재검증 메모).
 *  - `X-Forwarded-For` 는 보지 않는다 — Next.js 서버가 직접 요청에도 스스로 붙인다(2026-09-27 실측).
 */
export function isQaTokenAllowed(headers: Headers): boolean {
  const host = headers.get('host') ?? ''
  const local = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)
  return local && !headers.has('x-real-ip')
}

/** `secure`는 production에서만 true — 로컬 http 개발 서버에서 secure 쿠키가 저장되지 않는 문제 방지. */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  }
}

export function getClearCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
}

/**
 * JWT 검증(Edge/Node 양쪽에서 동작). 서명 검증 실패·만료·payload 형식 불일치 등 모든
 * 실패 경로에서 예외를 던지지 않고 null을 반환한다 — 호출부가 매번 try/catch를
 * 반복하지 않도록.
 */
export async function verifyJwt(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey())
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') return null
    return payload.qa === true ? { userId: payload.userId, email: payload.email, qa: true } : { userId: payload.userId, email: payload.email }
  } catch {
    return null
  }
}
