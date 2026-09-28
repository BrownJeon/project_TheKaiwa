'use client'

/**
 * 앱 로그인의 **마지막 한 칸** — 딥링크를 받아 세션으로 바꾼다(설계안 §5-2, task-003f C1-1 PKCE).
 *
 * ── 이 파일이 없어서 났던 증상 (2026-09-13 실기기) ─────────────────────────
 * APK 로 구글 로그인을 하면 인증은 끝나는데 **로그인 화면으로 되돌아왔다.** 서버는 `thekaiwa://auth/callback?code=` 로 302 했고
 * 앱도 떠올랐지만 **그 딥링크를 듣는 코드가 웹 쪽에 없었다** — `/api/auth/app-exchange` 가 한 번도 호출되지 않았다.
 *
 * ── 왜 fetch 가 아니라 **네비게이션**인가 ──────────────────────────────────
 * `/api/auth/app-exchange` 는 세션 쿠키를 심고 착지 경로로 302 한다. `fetch` 로 부르면 쿠키는 심어져도 화면이 로그인에 남는다.
 * 그래서 `location.replace` 로 보낸다(뒤로가기가 로그인 화면으로 돌아오면 안 된다).
 *
 * ── PKCE ──────────────────────────────────────────────────────────────
 * 로그인 시작 때 WebView 가 만든 verifier 를 **꺼내면서 지우고**(1회용) 코드와 함께 보낸다. verifier 가 없으면(10분 지남·앱 프로세스가
 * 죽어 sessionStorage 유실) 교환할 수 없으므로 서버에 가지 않고 `app_code_invalid` 로 로그인 화면을 다시 띄운다(서버의 실패 문구와 같은 하나).
 * verifier·코드는 화면·console 에 그리지 않는다.
 */
import { useEffect, useRef } from 'react'
import { appExchangeUrl, authCodeFromDeepLink, authErrorFromDeepLink, closeExternal, onAuthDeepLink, takeAppLoginVerifier } from '@/modules/infra/native'

export default function AppDeepLink({ callbackUrl, onExchanging }: { callbackUrl: string | null; onExchanging?: () => void }) {
  // **코드는 1회용이다.** 따뜻한 리스너와 콜드 스타트 보정(`getLaunchUrl`)이 같은 주소를 둘 다 줄 수 있다 — 처음 것만 처리한다.
  const handled = useRef(false)
  const exchangingRef = useRef(onExchanging)
  useEffect(() => {
    exchangingRef.current = onExchanging
  }, [onExchanging])

  useEffect(() => {
    return onAuthDeepLink((url) => {
      if (handled.current) return

      const error = authErrorFromDeepLink(url)
      if (error !== null) {
        handled.current = true
        // 사용자가 구글에서 취소한 경우 등 — 로그인 화면이 이미 아는 코드로 넘긴다.
        void closeExternal()
        const next = new URL(window.location.href)
        next.searchParams.set('oauth_error', error)
        window.location.replace(next.toString())
        return
      }

      const code = authCodeFromDeepLink(url)
      if (code === null) return // 로그인과 무관한 딥링크 — 앞으로 생길 공유·알림 등

      handled.current = true
      exchangingRef.current?.()
      // Custom Tab 이 위에 떠 있는 채로 교환하면 사용자는 브라우저 화면만 보게 된다. 닫는 것을 기다리지 않는다.
      void closeExternal()

      const verifier = takeAppLoginVerifier()
      if (verifier === null) {
        const back = new URL('/login', window.location.origin)
        back.searchParams.set('oauth_error', 'app_code_invalid')
        if (callbackUrl) back.searchParams.set('callbackUrl', callbackUrl)
        window.location.replace(back.toString())
        return
      }
      // middleware 가 붙여 준 원래 목적지를 보존한다(서버가 `sanitizeNextPath` 로 다시 검증한다).
      window.location.replace(appExchangeUrl(window.location.origin, code, verifier, callbackUrl !== '' ? callbackUrl : null))
    })
  }, [callbackUrl])

  // 그리는 것이 없다 — 이 컴포넌트는 **듣기만** 한다.
  return null
}
