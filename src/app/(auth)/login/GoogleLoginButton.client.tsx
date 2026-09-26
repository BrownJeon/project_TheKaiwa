'use client'

/**
 * "Google로 계속하기" 버튼 — 설계안 §5·§12에서 `Capacitor.isNativePlatform()` 분기가
 * 허용된 세 지점(로그인·카메라·공유) 중 하나.
 *
 * 웹: 그냥 `<a href="/api/auth/google?...">`. 앱: Google이 WebView 내 OAuth를 거부하므로
 * `platform=app`을 붙여 **Custom Tabs**(`@capacitor/browser`)에서 연다.
 *
 * ★ `@capacitor/*` 패키지를 import하지 않는다 — Phase 7 전까지 의존성이 없고, 웹 빌드에
 *   네이티브 전용 모듈을 끌어들이지 않기 위해서다. Capacitor 런타임은 WebView에
 *   `window.Capacitor` 전역을 주입하므로 그 존재만 feature-detect한다. Phase 7에서
 *   `src/lib/native/*` 래퍼가 생기면 이 감지 로직을 그쪽으로 옮긴다.
 * ★ 어느 경로에서도 폴백이 남는다 — 플러그인이 없으면 같은 URL로 일반 네비게이션한다.
 */
import { useEffect, useState } from 'react'
import { buildGoogleAuthHref } from '@/modules/infra/auth/oauth/next-path'

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  Plugins?: { Browser?: { open?: (options: { url: string }) => Promise<void> } }
}

function getBridge(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor ?? null
}

export default function GoogleLoginButton({ callbackUrl }: { callbackUrl: string | null }) {
  const [isNative, setIsNative] = useState(false)

  // 서버 렌더 결과와 어긋나지 않도록 마운트 후에만 네이티브 여부를 반영한다.
  useEffect(() => {
    setIsNative(getBridge()?.isNativePlatform?.() === true)
  }, [])

  const href = buildGoogleAuthHref(callbackUrl, isNative ? 'app' : 'web')

  async function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!isNative) return
    const open = getBridge()?.Plugins?.Browser?.open
    if (typeof open !== 'function') return // 플러그인 미탑재 — 기본 네비게이션으로 폴백
    e.preventDefault()
    const absolute = new URL(href, window.location.origin).toString()
    try {
      await open({ url: absolute })
    } catch {
      window.location.href = absolute
    }
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-line bg-surface px-4 text-[15px] font-semibold text-ink"
    >
      <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden focusable="false">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
        <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14z" />
      </svg>
      Google로 계속하기
    </a>
  )
}
