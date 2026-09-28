'use client'

/**
 * "Google로 계속하기" 버튼 — 설계안 §5·§12 에서 앱/웹 분기가 허용된 세 지점(로그인·실시간 인식 경로·APK 배너) 중 로그인.
 *
 * 웹: 그냥 `<a href="/api/auth/google?...">`. 앱: Google 이 WebView 안 OAuth 를 거부하므로 `AppLoginArea` 가 PKCE 를 준비해
 * **Custom Tabs**(`@capacitor/browser`)로 연다 — 이 버튼은 누름만 올리고 상태(여는 중)를 그린다.
 * ★ `window.Capacitor` 를 직접 보지 않는다 — 판정은 bridge(`useNativeEnv`)만(module-dependency §6, task-003f).
 */
import { buildGoogleAuthHref } from '@/modules/infra/auth/oauth/next-path'

export default function GoogleLoginButton({
  callbackUrl,
  native,
  opening,
  onAppLogin,
}: {
  callbackUrl: string | null
  /** 마운트 뒤 판정한 앱 여부(서버 렌더·첫 렌더는 false — 웹 링크 그대로). */
  native: boolean
  opening: boolean
  onAppLogin: () => void
}) {
  const href = buildGoogleAuthHref(callbackUrl, 'web')

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!native) return
    e.preventDefault()
    if (!opening) onAppLogin()
  }

  return (
    <a
      href={href}
      onClick={onClick}
      aria-disabled={opening || undefined}
      aria-busy={opening || undefined}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-line bg-surface px-4 text-[15px] font-semibold text-ink ${opening ? 'opacity-60' : ''}`}
    >
      {opening ? (
        <>
          <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none" />
          Chrome 창을 여는 중…
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden focusable="false">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
            <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14z" />
          </svg>
          Google로 계속하기
        </>
      )}
    </a>
  )
}
