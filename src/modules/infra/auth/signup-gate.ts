/**
 * 가입 게이트 — 초대 코드. VoiceVault `src/lib/auth/signup-gate.ts` 이식.
 *
 * 동작:
 *   - `SIGNUP_INVITE_CODE` 설정됨  → 가입 시 코드 필수. 불일치면 거부.
 *   - `SIGNUP_INVITE_CODE` 미설정 → 가입 개방. 대신 부팅/시도마다 경고를 크게 남긴다.
 *
 * 비교는 `crypto.timingSafeEqual`. 길이 정보까지 감추려고 양쪽을 SHA-256으로 고정
 * 길이화한 뒤 비교한다(원문을 그대로 비교하면 길이가 다를 때 즉시 false라 길이가 샌다).
 */
import { createHash, timingSafeEqual } from 'node:crypto'

/** 초대 코드 설정 여부 (값은 노출하지 않는다). */
export function isInviteRequired(): boolean {
  const v = process.env.SIGNUP_INVITE_CODE
  return typeof v === 'string' && v.trim().length > 0
}

/** 길이 정보까지 감춘 상수시간 문자열 비교. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

export type InviteCheck = { ok: true; gate: 'invite_required' | 'open' } | { ok: false; error: string }

let openWarningLogged = false

/** 초대 코드 미설정 상태를 한 번은 크게 알린다(프로세스당 1회). */
export function warnIfSignupOpen(): void {
  if (openWarningLogged || isInviteRequired()) return
  openWarningLogged = true
  console.warn(
    '\n' +
      '████████████████████████████████████████████████████████████████\n' +
      '█ [auth] 경고 — SIGNUP_INVITE_CODE 미설정: 회원가입이 개방돼 있습니다. █\n' +
      '████████████████████████████████████████████████████████████████\n' +
      '누구나 Google 계정으로 가입할 수 있는 상태입니다. 서버 .env에 SIGNUP_INVITE_CODE를\n' +
      '설정하고 재시작하면 초대 코드를 아는 사람만 가입할 수 있습니다.\n',
  )
}

/** 테스트 전용 — 1회성 경고 플래그 초기화. */
export function resetSignupGateWarning(): void {
  openWarningLogged = false
}

/** TheKaiwa Role 4단계 중 가입 시점에 정해지는 것은 두 값뿐 — OWNER_EMAIL 은 SUPER_ADMIN, 그 외는 USER(ADMIN·DEVELOPER 는 콘솔에서 승격). */
export type AppRole = 'SUPER_ADMIN' | 'USER'

/**
 * 신규 계정의 역할 판정. `OWNER_EMAIL`과 일치하면 OWNER.
 *
 * 비교 대상은 Google이 **검증했다고 단언한** 이메일뿐이다(콜백이 미검증 이메일을 그 전에
 * 차단한다) — 그래서 이메일 일치만으로 소유자를 신뢰할 수 있다. 초대코드 게이트는
 * OWNER에게도 동일하게 적용된다: 여기는 "누가 들어올 수 있나"가 아니라 "들어온 사람의
 * 역할이 무엇인가"만 정한다.
 *
 * DB를 모르는 순수 정책이라 Prisma를 import하는 `oauth/users.ts`가 아니라 이 모듈에 둔다
 * (`src/lib/jwt.ts` ↔ `session.ts` 분리와 같은 이유 — 순수 판정이 무거운 런타임 의존을
 * 끌고 다니지 않게).
 */
export function resolveRoleForEmail(email: string): AppRole {
  const owner = process.env.OWNER_EMAIL
  if (typeof owner !== 'string') return 'USER'
  const normalized = owner.trim().toLowerCase()
  if (normalized.length === 0) return 'USER'
  return normalized === email.trim().toLowerCase() ? 'SUPER_ADMIN' : 'USER'
}

/** 가입 시도의 초대 코드 검사. 미설정 상태면 통과시키되 시도마다 경고 로그를 남긴다(입력값은 로그하지 않는다). */
export function checkSignupInvite(given: unknown): InviteCheck {
  const expected = process.env.SIGNUP_INVITE_CODE
  if (typeof expected !== 'string' || expected.trim().length === 0) {
    console.warn('[auth] 회원가입 개방 상태에서 가입 시도 — SIGNUP_INVITE_CODE 미설정')
    return { ok: true, gate: 'open' }
  }
  const code = typeof given === 'string' ? given.trim() : ''
  if (code.length === 0) return { ok: false, error: '초대 코드를 입력하세요' }
  if (!timingSafeEqualStr(code, expected.trim())) {
    return { ok: false, error: '초대 코드가 올바르지 않습니다' }
  }
  return { ok: true, gate: 'invite_required' }
}

// 모듈이 처음 로드되는 시점(= 가입 경로가 처음 사용되는 서버 부팅 직후)에 1회 경고한다.
if (process.env.NODE_ENV !== 'test') warnIfSignupOpen()
