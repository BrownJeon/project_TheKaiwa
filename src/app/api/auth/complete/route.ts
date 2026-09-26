/**
 * POST /api/auth/complete — 초대코드 확인 후 처음으로 계정을 만든다.
 *
 * body: `{ inviteCode?: string }`
 *
 * ★ 이 라우트가 "코드가 틀리면 계정이 만들어지지 않는다"의 유일한 보증 지점이다.
 *   OAuth 콜백은 계정을 만들지 않고 검증된 신원을 서명 쿠키로만 넘긴다. 여기서
 *   `evaluateOAuthCompletion`이 ok를 주기 전에는 `createOAuthUser`를 호출하는 코드
 *   자체가 실행되지 않는다 — 게이트를 우회하는 다른 생성 경로가 없다.
 *
 * ★ 초대코드 검증의 유일한 경로이므로 IP 기준 시도 횟수 제한을 **초대코드 로직보다 먼저**
 *   건다(무차별대입이 게이트 자체에 도달하지 못하게).
 *
 * ★ 앱(`platform=app`, 대기 토큰에 서명돼 있음)이면 세션 쿠키를 심지 않고 60초·1회용
 *   딥링크(`data.appRedirect`)를 돌려준다 — 이 응답을 받는 브라우저는 Custom Tabs이지
 *   앱 WebView가 아니라서, 여기서 쿠키를 심어봐야 앱은 여전히 로그아웃 상태다(설계안 §5-2).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { setSessionCookie } from '@/modules/infra/session'
import { getClearPendingCookieOptions, OAUTH_PENDING_COOKIE } from '@/modules/infra/auth/oauth/pending'
import { evaluateOAuthCompletion } from '@/modules/infra/auth/oauth/complete-gate'
import { createOAuthUser, findUserByOAuth, maskEmail } from '@/modules/infra/auth/oauth/users'
import { issueAppAuthCode } from '@/modules/infra/auth/oauth/app-code'
import { buildAppCallbackDeepLink } from '@/modules/infra/auth/oauth/config'
import { checkAndRecordCompleteAttempt, clientIpKey } from '@/modules/infra/auth/completeRateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clearPending(res: NextResponse): NextResponse {
  res.cookies.set({ name: OAUTH_PENDING_COOKIE, value: '', ...getClearPendingCookieOptions() })
  return res
}

function fail(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, data: null, message }, { status })
}

export async function POST(req: NextRequest) {
  try {
    const rate = checkAndRecordCompleteAttempt(clientIpKey(req.headers))
    if (!rate.allowed) {
      return fail('시도 횟수가 많습니다. 잠시 후 다시 시도해 주세요', 429)
    }

    const body = (await req.json().catch(() => ({}))) as { inviteCode?: unknown }
    const pendingToken = req.cookies.get(OAUTH_PENDING_COOKIE)?.value ?? null

    const gated = evaluateOAuthCompletion({ pendingToken, inviteCode: body.inviteCode })
    if (!gated.ok) {
      if (gated.reason === 'invite') console.warn('[oauth] 초대코드 불일치 — 계정 생성 안 됨')
      return fail(gated.error, gated.status)
    }

    const pending = gated.pending

    // 대기 중 다른 탭/기기에서 같은 신원으로 이미 가입됐을 수 있다.
    const already = await findUserByOAuth(pending.providerId)
    let user: { id: string; email: string }
    if (already) {
      user = already
    } else {
      try {
        user = await createOAuthUser({
          providerId: pending.providerId,
          email: pending.email,
          name: pending.name,
          avatar: pending.avatar,
          emailVerified: pending.emailVerified,
        })
      } catch (e) {
        // 대기 중에 같은 이메일로 이미 가입이 완료된 경우 — 조용히 붙이지 않는다.
        // 다시 Google 로그인하면 정상적인 연결 경로(byEmail)를 탄다.
        if (isUniqueConstraintError(e)) {
          return clearPending(fail('이미 가입된 이메일입니다. Google 로그인을 다시 시도해 주세요', 409))
        }
        throw e
      }
    }

    console.log(`[oauth] 신규 회원 가입 id=${user.id} (${maskEmail(pending.email)}) invite=${gated.inviteGate}`)

    if (pending.platform === 'app') {
      const code = await issueAppAuthCode(user.id)
      return clearPending(
        NextResponse.json({
          success: true,
          data: { next: pending.nextPath, appRedirect: buildAppCallbackDeepLink({ code }) },
          message: null,
        }),
      )
    }

    const res = NextResponse.json({
      success: true,
      data: { next: pending.nextPath, appRedirect: null },
      message: null,
    })
    setSessionCookie(res, { userId: user.id, email: user.email })
    return clearPending(res)
  } catch (e) {
    console.error('[api/auth/complete]', e instanceof Error ? e.message : String(e))
    return fail('가입 처리 중 오류가 발생했습니다', 500)
  }
}

/** Prisma 고유 제약 위반(P2002) 판별 — `@prisma/client`의 에러 클래스를 import하지 않고
 * 에러 형태(런타임에 항상 존재하는 `code` 필드)만 본다. */
function isUniqueConstraintError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
}
