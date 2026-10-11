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
import { APP_TAGLINE } from '@/components/common/brand'
import AppUpdateBanner from '@/components/shell/AppUpdateBanner'
import { isShareCallback, SHARE_LOGIN_NOTE } from '@/components/shell/shareTarget'
import AppLoginArea, { AppOnlyLoginNote } from './AppLoginArea.client'

export const dynamic = 'force-dynamic'

/**
 * 오류 문구(웹·앱 공통, 해요체 — screens §11-8 ⓘ). `app_code_invalid` 는 만료·재사용·PKCE 확인값 불일치를 서버가 구분하지 않으므로
 * 문구도 하나. `app_login_invalid`(challenge 없는 앱 요청 — 구버전 셸)는 같은 뜻으로 수렴한다.
 */
const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Google 로그인을 취소했어요.',
  email_unverified: '이 Google 계정은 이메일 확인이 끝나지 않았어요.',
  invalid_state: '로그인 요청 시간이 지났어요. 다시 눌러 주세요.',
  not_configured: '서버에 Google 로그인이 아직 준비되지 않았어요. 관리자에게 알려 주세요.',
  app_code_invalid: '로그인을 마무리하지 못했어요. 다시 눌러 주세요.',
  app_login_invalid: '로그인을 마무리하지 못했어요. 다시 눌러 주세요.',
  account_conflict: '이 이메일로 이미 다른 계정이 있어요. 관리자에게 알려 주세요.',
  failed: '로그인하지 못했어요. 다시 눌러 주세요.',
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
  const callbackUrl = firstParam(sp.callbackUrl)

  return (
    <>
    {/* 강제 업데이트 띠(앱에서만, 닫기 없음 — §11-2 G). 권장 띠는 로그인 뒤 셸에서만. 셸 밖이라 상태바 여백을 스스로 가진다. */}
    <div className="fixed inset-x-0 top-0 z-30">
      <AppUpdateBanner forcedOnly insetTop />
    </div>
    <main
      className="mx-auto flex h-dvh w-full max-w-[520px] min-w-0 flex-col justify-center gap-2.5 px-7 pt-8"
      style={{ paddingBottom: 'max(60px, env(safe-area-inset-bottom))' }}
    >
      {/* "Lingofy Japanese"(brand.ts APP_NAME). 360~412 폭에서는 한 줄에 안 들어가 "Japanese" 가 둘째 줄로 내려간다 —
          단어 사이에서만 줄바꿈되고 가로 넘침은 없다(task-003h). */}
      <h1 className="text-[44px] leading-[1.05] font-bold tracking-[-0.02em] break-keep">
        Lingofy <span className="text-accent">Japanese</span>
      </h1>
      <p className="mt-1 mb-6 text-ink2">
        <span className="font-semibold text-ink">{APP_TAGLINE}</span>
        <br />
        AI 선생님과 회화 · 교정 · 단어 · 평가
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

      {/* 공유하기로 받은 글을 들고 로그인하러 온 경우(task-052 D4-A). `from=share` 는 앱 셸만 만든다 — 앱 여부는 보지 않는다. */}
      {isShareCallback(callbackUrl) && (
        <p role="status" className="mb-2 flex items-start gap-2.5 rounded-[10px] bg-surface2 px-3.5 py-2.5 text-[13px] text-ink break-keep">
          <span aria-hidden className="mt-px flex-none text-ink2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3" />
              <path d="M7 8l5-5 5 5" />
              <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
          </span>
          <span>{SHARE_LOGIN_NOTE}</span>
        </p>
      )}

      {/* 버튼·앱 로그인 대기·딥링크 수신(`thekaiwa://` 로 돌아오는 것을 **여기서 받는다**)을 한 상태로 — 웹은 링크 그대로. */}
      <AppLoginArea callbackUrl={callbackUrl} />

      <p className="mt-3.5 text-center text-[12.5px] text-ink2">
        처음이라면 초대코드가 필요합니다.
        <AppOnlyLoginNote />
      </p>
    </main>
    </>
  )
}
