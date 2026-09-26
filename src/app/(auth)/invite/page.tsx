/**
 * /invite — 첫 Google 로그인의 초대코드 확인.
 *
 * 이 화면을 통과하기 전에는 계정이 없다. Google 인증에 성공해도 코드가 틀리면 아무것도
 * 만들어지지 않는다(`POST /api/auth/complete`가 유일한 생성 지점). 기존 계정에 소셜을
 * 연결하는 경우에는 이 화면이 나오지 않는다 — 이미 가입된 사람이다.
 *
 * ★ 대기 정보를 별도 API(`/api/auth/pending`)로 노출하지 않고 **서버 컴포넌트에서 httpOnly
 *   쿠키를 직접 읽는다.** 표시용 요약만 넘기면 되는 데이터를 위해 인증 전 단계의 공개
 *   엔드포인트를 하나 더 늘릴 이유가 없다.
 */
import { cookies } from 'next/headers'
import { OAUTH_PENDING_COOKIE, verifyPendingSignup } from '@/modules/infra/auth/oauth/pending'
import { isInviteRequired } from '@/modules/infra/auth/signup-gate'
import InviteForm from './InviteForm'

export const dynamic = 'force-dynamic'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-[520px] min-w-0 flex-col justify-center gap-5 px-7 pt-8"
      style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom))' }}
    >
      {children}
    </main>
  )
}

export default async function InvitePage() {
  const cookieStore = await cookies()
  const verified = verifyPendingSignup(cookieStore.get(OAUTH_PENDING_COOKIE)?.value ?? null)

  if (!verified.ok) {
    return (
      <Shell>
        <div
          role="alert"
          className="rounded-[10px] border border-bad bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad"
        >
          인증 정보가 없거나 만료되었습니다. Google 로그인을 다시 시도해 주세요.
        </div>
        <a
          href="/login"
          className="flex min-h-[48px] items-center justify-center rounded-[12px] border border-line bg-surface text-[15px] font-semibold text-ink"
        >
          로그인으로 돌아가기
        </a>
      </Shell>
    )
  }

  const inviteRequired = isInviteRequired()

  return (
    <Shell>
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em]">초대코드 입력</h1>
        <p className="mt-1 text-[13px] text-ink2">
          {inviteRequired ? '가입을 마치려면 초대코드가 필요합니다' : '가입을 마치려면 아래 버튼을 눌러주세요'}
        </p>
      </div>

      <div className="min-w-0 rounded-[12px] bg-surface2 px-3.5 py-3">
        <div className="text-[12px] text-ink3">Google 인증 완료</div>
        <div className="mt-0.5 truncate text-[14px] text-ink">{verified.pending.email}</div>
      </div>

      <InviteForm inviteRequired={inviteRequired} />

      <a href="/login" className="flex min-h-[44px] items-center justify-center text-[12.5px] text-ink3 underline">
        취소하고 로그인으로 돌아가기
      </a>
    </Shell>
  )
}
