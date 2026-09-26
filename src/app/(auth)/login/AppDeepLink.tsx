'use client'

/**
 * 앱 로그인의 **마지막 한 칸** — 딥링크를 받아 세션으로 바꾼다(설계안 §5-2).
 *
 * ── 이 파일이 없어서 났던 증상 (2026-09-13 실기기) ─────────────────────────
 * APK 로 구글 로그인을 하면 인증은 끝나는데 **로그인 화면으로 되돌아왔다.**
 * nginx 로그가 정확히 말해 줬다:
 *
 *   17:03:34  /api/auth/google?platform=app   307   ← 앱이 올바르게 시작
 *   17:03:38  /api/auth/google/callback       302   ← 구글 인증 성공, `thekaiwa://` 로 302
 *   17:03:47  /api/auth/google?platform=app   307   ← 처음부터 다시 (= 로그인 화면)
 *
 * **`/api/auth/app-exchange` 가 한 번도 호출되지 않았다.** 서버는 제 몫을 다 했고
 * (`thekaiwa://auth/callback?code=` 로 302), APK 에도 intent-filter 가 들어가 앱이 떠올랐지만,
 * **그 딥링크를 듣는 코드가 웹 쪽에 없었다.** `config.ts` 주석이 *"앱의 `appUrlOpen` 핸들러
 * 하나가 처리한다"* 고 적어 둔 그 핸들러가 실제로는 존재하지 않았다 —
 * Phase 0 이 `@capacitor/*` 의존성 없이 만들 수 있는 데까지만 만들고(버튼 쪽 전역 감지),
 * 받는 쪽은 Phase 7 로 미뤄 둔 자리였다.
 *
 * ── 왜 fetch 가 아니라 **네비게이션**인가 ──────────────────────────────────
 * `/api/auth/app-exchange` 는 세션 쿠키를 심고 `/study/today` 로 302 한다. `fetch` 로 부르면
 * 쿠키는 심어져도 **화면이 그대로 로그인에 남는다** — 리다이렉트를 따라가는 것은 문서
 * 네비게이션이지 fetch 가 아니다. 그래서 `location.replace` 로 보낸다(`replace` 인 이유:
 * 뒤로가기가 로그인 화면으로 돌아오면 안 된다).
 */
import { useEffect, useRef } from 'react'
import {
  authCodeFromDeepLink,
  authErrorFromDeepLink,
  closeExternal,
  onAuthDeepLink,
} from '@/modules/infra/native/bridge'

export default function AppDeepLink({ callbackUrl }: { callbackUrl: string | null }) {
  // **코드는 1회용이다.** 따뜻한 리스너와 콜드 스타트 보정(`getLaunchUrl`)이 같은 주소를
  // 둘 다 줄 수 있는데, 두 번째 교환은 반드시 실패해 `app_code_invalid` 배너가 뜬다.
  // 이미 처리를 시작했으면 그 뒤는 무시한다.
  const handled = useRef(false)

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
      // Custom Tab 이 위에 떠 있는 채로 교환하면 사용자는 **브라우저 화면만 보게 된다.**
      // 닫는 것을 기다리지 않는다 — 실패해도 교환은 진행돼야 한다.
      void closeExternal()

      const target = new URL('/api/auth/app-exchange', window.location.origin)
      target.searchParams.set('code', code)
      // middleware 가 붙여 준 원래 목적지를 보존한다(서버가 `sanitizeNextPath` 로 다시 검증한다).
      if (callbackUrl !== null && callbackUrl !== '') target.searchParams.set('next', callbackUrl)
      window.location.replace(target.toString())
    })
  }, [callbackUrl])

  // 그리는 것이 없다 — 이 컴포넌트는 **듣기만** 한다.
  return null
}
