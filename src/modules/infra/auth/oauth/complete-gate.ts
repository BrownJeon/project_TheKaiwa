/**
 * OAuth 가입 완료 게이트 — 순수 함수(VoiceVault `oauth/complete-gate.ts` 이식).
 *
 * `POST /api/auth/complete`가 계정을 만들기 **전에** 통과해야 하는 관문 전부를 한 곳에
 * 모았다. 라우트는 이 함수가 `ok: true`를 줄 때만 INSERT를 호출한다 — "초대코드가
 * 틀리면 계정이 만들어지지 않는다"가 코드 구조로 보장된다.
 *
 * 검사 순서:
 *   1) 대기 토큰(서명·만료) — 없으면 애초에 OAuth 인증을 거치지 않은 요청이다
 *   2) 이메일 검증 재확인 — 콜백에서 이미 걸렀지만 완료 시점에도 강제한다(이중 방어)
 *   3) 초대코드
 */
import { checkSignupInvite } from '@/modules/infra/auth/signup-gate'
import { verifyPendingSignup, type PendingSignup } from '@/modules/infra/auth/oauth/pending'

export type CompletionFailure = 'expired' | 'unverified' | 'invite'

export type CompletionResult =
  | { ok: true; pending: PendingSignup; inviteGate: 'invite_required' | 'open' }
  | { ok: false; reason: CompletionFailure; status: number; error: string }

const EXPIRED = {
  reason: 'expired' as const,
  status: 400,
  error: '인증 정보가 만료되었습니다. Google 로그인을 다시 시도해 주세요',
}

export function verifyPendingForCompletion(
  pendingToken: string | null | undefined,
): { ok: true; pending: PendingSignup } | { ok: false; reason: CompletionFailure; status: number; error: string } {
  const verified = verifyPendingSignup(pendingToken)
  if (!verified.ok) return { ok: false, ...EXPIRED }

  // 콜백이 이미 막았지만 여기서도 막는다 — 콜백 분기가 하나만 바뀌어도 미검증 이메일
  // 계정이 조용히 생성되는 것을 막는 이중 방어선.
  if (verified.pending.emailVerified !== true) {
    return {
      ok: false,
      reason: 'unverified',
      status: 403,
      error: '이 Google 계정의 이메일이 확인되지 않았습니다',
    }
  }
  return { ok: true, pending: verified.pending }
}

/**
 * 전체 관문(1~3 단계). 계정 생성 직전에 이 함수 하나만 통과하면 된다 — 라우트가 개별
 * 검사를 조합하다 하나를 빠뜨리는 실수를 구조적으로 막는다.
 */
export function evaluateOAuthCompletion(args: {
  pendingToken: string | null | undefined
  inviteCode: unknown
}): CompletionResult {
  const pre = verifyPendingForCompletion(args.pendingToken)
  if (!pre.ok) return pre

  const invite = checkSignupInvite(args.inviteCode)
  if (!invite.ok) return { ok: false, reason: 'invite', status: 403, error: invite.error }

  return { ok: true, pending: pre.pending, inviteGate: invite.gate }
}
