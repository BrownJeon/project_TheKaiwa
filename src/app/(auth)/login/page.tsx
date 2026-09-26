/**
 * S0 로그인 (데모 `docs/demo/themeal-demo.html` #login과 동일 구성).
 *
 * `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`OAUTH_CALLBACK_BASE`가 비어 있어도 화면
 * 자체는 뜬다 — 버튼을 눌렀을 때 서버가 503을 돌려줄 뿐이다(미설정 안내는 아래 배너).
 *
 * `callbackUrl`은 middleware가 붙인 원래 목적지다. 여기서 `buildGoogleAuthHref`로
 * `/api/auth/google`까지 이어주지 않으면 딥링크 보존이 죽은 코드가 된다.
 */
import { isGoogleLoginEnabled } from '@/modules/infra/auth/oauth/config'
import AppDeepLink from './AppDeepLink.client'
import GoogleLoginButton from './GoogleLoginButton.client'

export const dynamic = 'force-dynamic'

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Google 로그인을 취소했습니다.',
  email_unverified: '이 Google 계정의 이메일이 확인되지 않았습니다.',
  invalid_state: '로그인 요청이 만료되었거나 유효하지 않습니다. 다시 시도해 주세요.',
  not_configured: '서버에 Google 로그인이 아직 설정되지 않았습니다.',
  app_code_invalid: '앱 로그인 코드가 만료되었습니다. 다시 시도해 주세요.',
  account_conflict: '이 이메일로 이미 다른 계정이 등록돼 있습니다. 관리자에게 문의하세요.',
  failed: '로그인에 실패했습니다. 다시 시도해 주세요.',
}

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return value[0]
  return null
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const errorCode = firstParam(sp.oauth_error)
  const message = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.failed) : null
  const configured = isGoogleLoginEnabled()

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-[520px] min-w-0 flex-col justify-center gap-2.5 px-7 pt-8"
      style={{ paddingBottom: 'max(60px, env(safe-area-inset-bottom))' }}
    >
      <h1 className="text-[44px] leading-none font-bold tracking-[-0.02em]">
        The<span className="text-accent">Kaiwa</span>
      </h1>
      <p className="mt-1 mb-6 text-ink2">
        AI 선생님과 회화 · 교정 · 단어 · 평가
        <br />
        매일 조금씩 일본어 회화
      </p>

      {message && (
        <div
          role="alert"
          className="mb-2 rounded-[10px] border border-bad bg-bad-soft px-3.5 py-2.5 text-[13px] text-bad"
        >
          {message}
        </div>
      )}

      {!configured && (
        <div
          role="status"
          className="mb-2 rounded-[10px] border border-warn bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn"
        >
          서버에 Google 로그인이 아직 설정되지 않았습니다. 관리자에게 문의하세요.
        </div>
      )}

      {/* 앱에서 구글 인증을 마치고 `thekaiwa://` 로 돌아오는 것을 **여기서 받는다**.
          로그인 화면이 곧 사용자가 기다리는 자리라 리스너도 여기 산다. 웹에서는
          Capacitor 전역이 없어 아무 일도 하지 않는다(그리는 것도 없다). */}
      <AppDeepLink callbackUrl={firstParam(sp.callbackUrl)} />
      <GoogleLoginButton callbackUrl={firstParam(sp.callbackUrl)} />

      <p className="mt-3.5 text-center text-[12.5px] text-ink3">
        처음이라면 초대코드가 필요합니다.
        <br />
        앱에서는 Chrome 창이 열려 로그인 후 자동으로 돌아옵니다.
      </p>
    </main>
  )
}
