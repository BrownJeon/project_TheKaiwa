import jwt from 'jsonwebtoken'
import type { NextResponse } from 'next/server'
import {
  JWT_EXPIRES,
  SESSION_COOKIE_NAME,
  getClearCookieOptions,
  getSessionCookieOptions,
  type TokenPayload,
} from '@/modules/infra/jwt'

/**
 * 세션 발급/폐기 — Node.js 런타임 전용(Route Handler에서만 import). VoiceVault
 * `src/lib/session.ts` 이식. `jsonwebtoken`은 여기서만 쓴다 — `middleware.ts`에서
 * import하면 Edge Runtime에서 크래시한다(`src/lib/jwt.ts` 상단 주석 참고).
 */

function getJwtSecretString(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return secret
}

export function signJwt(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecretString(), { expiresIn: JWT_EXPIRES } as jwt.SignOptions)
}

/** 로그인 성공 응답에 Set-Cookie로 세션을 실어 보낸다. */
export function setSessionCookie(res: NextResponse, payload: TokenPayload): void {
  const token = signJwt(payload)
  res.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions())
}

/** 로그아웃 — 만료시간을 과거로 설정한 Set-Cookie로 쿠키를 제거한다. */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, '', getClearCookieOptions())
}
