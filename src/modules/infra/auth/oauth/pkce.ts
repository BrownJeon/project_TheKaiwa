/**
 * 앱 로그인 PKCE(RFC 7636 S256) 서버 쪽 — task-003f C1-1.
 *
 * 커스텀 스킴(`thekaiwa://`)은 기기의 다른 앱도 등록할 수 있어 딥링크 코드가 가로채질 수 있다. 앱(WebView)이 로그인 시작 때
 * 만든 `verifier` 를 끝까지 WebView 밖으로 내보내지 않고 `challenge = S256(verifier)` 만 서명된 state 로 운반하면,
 * 코드를 가로챈 쪽은 verifier 가 없어 교환하지 못한다. 클라이언트 쪽 생성은 `infra/native/appLogin.ts`.
 */
import { createHash } from 'node:crypto'

/** base64url(sha256) = 43자. */
export const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/
/** RFC 7636 §4.1 — unreserved 43~128자. */
export const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/

export function isPkceChallenge(v: unknown): v is string {
  return typeof v === 'string' && PKCE_CHALLENGE_PATTERN.test(v)
}

export function isPkceVerifier(v: unknown): v is string {
  return typeof v === 'string' && PKCE_VERIFIER_PATTERN.test(v)
}

/** `S256(verifier)` = base64url(sha256(ascii(verifier))), 패딩 없음. */
export function pkceChallengeOf(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url')
}
