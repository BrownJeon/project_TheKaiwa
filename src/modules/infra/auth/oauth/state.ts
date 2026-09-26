/**
 * OAuth CSRF state — double-submit 쿠키 (VoiceVault `src/lib/auth/oauth/state.ts` 이식,
 * `platform` 필드만 TheMeal용으로 추가).
 *
 * 공유 패키지의 `core/state.js`는 state 파라미터가 유효하게 서명된 JWT인지만 검증하고,
 * 어느 브라우저가 발급받았는지는 검증하지 않는다 — 로그인 CSRF(공격자가 자기 브라우저로
 * 받은 유효한 (code, state)를 피해자에게 그대로 열게 함)를 막지 못한다. 그래서 리다이렉트
 * 단계에서 nonce를 만들어 state 파라미터와 httpOnly 쿠키 양쪽에 넣고, 콜백에서 두 값이
 * 일치할 때만 통과시킨다(double-submit).
 *
 * `platform`을 쿼리가 아니라 **서명된 state 안에** 싣는 이유: 콜백 URL은 Google이 그대로
 * 돌려주는 값이라 사용자가 조작할 수 있다. 앱 분기(딥링크로 AppAuthCode 발급)는
 * "이 브라우저가 앱 로그인으로 시작했다"는 사실에 의존하므로 위조 불가능한 곳에 둔다.
 */
import jwt from 'jsonwebtoken'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { sanitizeNextPath, parsePlatform, type AuthPlatform } from '@/modules/infra/auth/oauth/next-path'

export const OAUTH_STATE_COOKIE = 'thekaiwa_oauth_state'

/** state 유효기간(초) — 제공자 동의 화면에 머무는 시간을 감안, 그 이상은 불필요. */
export const OAUTH_STATE_MAX_AGE_SEC = 10 * 60

function getStateSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return secret
}

export function getOAuthStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: OAUTH_STATE_MAX_AGE_SEC,
  }
}

export function getClearOAuthStateCookieOptions() {
  return { ...getOAuthStateCookieOptions(), maxAge: 0 }
}

interface StatePayload {
  nonce: string
  nextPath: string
  platform: AuthPlatform
}

export interface CreatedState {
  state: string
  nonce: string
}

export function createOAuthState(nextPath: string, platform: AuthPlatform): CreatedState {
  const nonce = randomBytes(16).toString('hex')
  const payload: StatePayload = { nonce, nextPath: sanitizeNextPath(nextPath), platform }
  const state = jwt.sign(payload, getStateSecret(), {
    expiresIn: OAUTH_STATE_MAX_AGE_SEC,
    algorithm: 'HS256',
  })
  return { state, nonce }
}

export type StateCheckFail = 'missing' | 'malformed' | 'bad_signature' | 'expired' | 'nonce_mismatch'
export type StateCheckResult =
  | { ok: true; nextPath: string; platform: AuthPlatform }
  | { ok: false; reason: StateCheckFail }

/** 상수시간 문자열 비교 — 길이가 다른 입력도 SHA-256으로 고정 길이화한 뒤 비교한다. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

export function verifyOAuthState(
  state: string | null | undefined,
  nonceFromCookie: string | null | undefined,
): StateCheckResult {
  if (!state) return { ok: false, reason: 'missing' }

  let payload: StatePayload
  try {
    // algorithms를 HS256으로 고정 — algorithm confusion 방어(defense in depth).
    payload = jwt.verify(state, getStateSecret(), { algorithms: ['HS256'] }) as StatePayload
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) return { ok: false, reason: 'expired' }
    return { ok: false, reason: 'bad_signature' }
  }

  if (typeof payload?.nonce !== 'string' || payload.nonce.length === 0) {
    return { ok: false, reason: 'malformed' }
  }
  if (typeof nonceFromCookie !== 'string' || nonceFromCookie.length === 0) {
    return { ok: false, reason: 'missing' }
  }
  if (!timingSafeEqualStr(nonceFromCookie, payload.nonce)) {
    return { ok: false, reason: 'nonce_mismatch' }
  }

  return {
    ok: true,
    nextPath: sanitizeNextPath(payload.nextPath),
    platform: parsePlatform(payload.platform),
  }
}
