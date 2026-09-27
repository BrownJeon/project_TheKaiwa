/**
 * 용도 한정 단기 토큰(api-contract §0-3 WS 티켓 등) — 세션 JWT 와 같은 `JWT_SECRET`·HS256 이지만 **`aud` 로 용도를 묶는다**.
 *
 * 세션으로 오인되지 않게 하는 장치: 세션 검증(`jwt.ts verifyJwt`)은 `userId`·`email` 클레임이 있어야 통과하므로
 * 이 토큰에는 그 두 이름(과 `qa`)을 싣지 못하게 막는다. 주체는 표준 `sub` 로만 싣는다.
 * 1회 사용(jti 소각)은 검증하는 쪽(gateway)의 몫이다 — 여기서는 매번 새 `jti` 를 만든다.
 */
import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

const RESERVED = new Set(['userId', 'email', 'qa', 'sub', 'aud', 'jti', 'exp', 'iat', 'nbf', 'iss'])
const AUDIENCE = /^[a-z][a-z0-9-]{2,31}$/

export interface ScopedToken {
  token: string
  jti: string
  expiresAt: Date
}

export interface ScopedTokenPayload {
  sub: string
  aud: string
  jti: string
  exp: number
  iat: number
  claims: Record<string, string>
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function signScopedToken(input: { sub: string; aud: string; ttlSec: number; claims?: Record<string, string>; now?: Date }): Promise<ScopedToken> {
  if (!input.sub) throw new Error('scoped token: sub 가 비었습니다')
  if (!AUDIENCE.test(input.aud)) throw new Error('scoped token: aud 형식')
  if (!Number.isInteger(input.ttlSec) || input.ttlSec < 1 || input.ttlSec > 600) throw new Error('scoped token: ttl 은 1~600초')
  const claims = input.claims ?? {}
  for (const k of Object.keys(claims)) if (RESERVED.has(k)) throw new Error(`scoped token: 예약 클레임 ${k}`)
  const iat = Math.floor((input.now ?? new Date()).getTime() / 1000)
  const exp = iat + input.ttlSec
  const jti = randomUUID()
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.sub)
    .setAudience(input.aud)
    .setJti(jti)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(secretKey())
  return { token, jti, expiresAt: new Date(exp * 1000) }
}

/** 서명·만료·aud 를 모두 확인한다. 어느 하나라도 틀리면 null(예외 없음). 문자열 클레임만 돌려준다. */
export async function verifyScopedToken(token: string, aud: string, now?: Date): Promise<ScopedTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: aud, algorithms: ['HS256'], ...(now ? { currentDate: now } : {}) })
    if (typeof payload.sub !== 'string' || typeof payload.jti !== 'string' || typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null
    const claims: Record<string, string> = {}
    for (const [k, v] of Object.entries(payload)) if (!RESERVED.has(k) && typeof v === 'string') claims[k] = v
    return { sub: payload.sub, aud, jti: payload.jti, exp: payload.exp, iat: payload.iat, claims }
  } catch {
    return null
  }
}
