/**
 * 초대코드 대기 상태 — VoiceVault `src/lib/auth/oauth/pending.ts` 이식(`platform` 추가).
 *
 * **핵심 보증: 초대코드가 틀리면 계정이 만들어지지 않는다.** 그러려면 OAuth 인증 성공
 * 시점에 계정을 만들면 안 된다. 대신 검증된 신원을 짧은 수명 서명 토큰에 담아 httpOnly
 * 쿠키로 들려 보내고, 초대코드가 통과한 `POST /api/auth/complete`에서 처음 INSERT한다.
 *
 * 임시 DB 행 대신 서명 쿠키를 쓰는 이유: 가입 미완료 상태가 User 테이블에 남으면 중복
 * 이메일·통계가 오염되고, 이탈 시 정리 배치가 또 필요해진다. 서명 토큰은 만료되면
 * 그냥 사라진다.
 *
 * 유효기간 15분 — 초대코드를 찾아 입력하기엔 넉넉하고, 탈취된 쿠키의 수명은 짧게.
 */
import jwt from 'jsonwebtoken'
import { sanitizeNextPath, parsePlatform, type AuthPlatform } from '@/modules/infra/auth/oauth/next-path'
import type { OAuthProfile } from '@/modules/infra/auth/oauth/providers'

export const OAUTH_PENDING_COOKIE = 'tm_oauth_pending'
export const OAUTH_PENDING_MAX_AGE_SEC = 15 * 60

function getPendingSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return secret
}

interface PendingPayload {
  /** providerId */
  i: string
  /** email (정규화 완료) */
  e: string
  /** 표시용 이름 */
  nm: string
  /** avatar URL — User 모델에는 저장하지 않지만 대기 화면 표시용으로 들고 있는다 */
  av: string | null
  /** emailVerified — 토큰에도 실어 완료 시점에 다시 강제한다 */
  v: boolean
  /** 가입 후 돌아갈 내부 경로 */
  r: string
  /** 'app'이면 가입 완료 후 세션 쿠키 대신 AppAuthCode 딥링크를 돌려준다(설계안 §5-2) */
  pf: AuthPlatform
}

export interface PendingSignup {
  providerId: string
  email: string
  name: string
  avatar: string | null
  emailVerified: boolean
  nextPath: string
  platform: AuthPlatform
}

export function signPendingSignup(profile: OAuthProfile, nextPath: string, platform: AuthPlatform): string {
  const payload: PendingPayload = {
    i: profile.providerId,
    e: profile.email,
    nm: profile.name,
    av: profile.avatar,
    v: profile.emailVerified === true,
    r: sanitizeNextPath(nextPath),
    pf: platform,
  }
  return jwt.sign(payload, getPendingSecret(), {
    expiresIn: OAUTH_PENDING_MAX_AGE_SEC,
    algorithm: 'HS256',
  })
}

export function getPendingCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: OAUTH_PENDING_MAX_AGE_SEC,
  }
}

export function getClearPendingCookieOptions() {
  return { ...getPendingCookieOptions(), maxAge: 0 }
}

export type PendingFailReason = 'missing' | 'malformed' | 'bad_signature' | 'expired'
export type PendingVerifyResult = { ok: true; pending: PendingSignup } | { ok: false; reason: PendingFailReason }

export function verifyPendingSignup(token: string | null | undefined): PendingVerifyResult {
  if (!token) return { ok: false, reason: 'missing' }

  let payload: PendingPayload
  try {
    payload = jwt.verify(token, getPendingSecret(), { algorithms: ['HS256'] }) as PendingPayload
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) return { ok: false, reason: 'expired' }
    return { ok: false, reason: 'bad_signature' }
  }

  if (typeof payload?.i !== 'string' || payload.i.length === 0) return { ok: false, reason: 'malformed' }
  if (typeof payload?.e !== 'string' || payload.e.length === 0) return { ok: false, reason: 'malformed' }

  return {
    ok: true,
    pending: {
      providerId: payload.i,
      email: payload.e,
      name: typeof payload.nm === 'string' && payload.nm.length > 0 ? payload.nm : payload.e,
      avatar: typeof payload.av === 'string' ? payload.av : null,
      // 서명 토큰이라 위조는 불가능하지만, 타입이 어긋난 값이 true로 통과하지 않게 `=== true`.
      emailVerified: payload.v === true,
      nextPath: sanitizeNextPath(payload.r),
      platform: parsePlatform(payload.pf),
    },
  }
}
