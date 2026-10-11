'use client'

/**
 * 다른 앱(카카오톡 등)의 「공유」로 앱이 열리면 붙여넣기 화면으로 옮긴다(screens §20-2·20-3, task-052). 아무것도 그리지 않는다.
 *
 * 루트 레이아웃에 둔다 — 로그인 전 콜드 스타트는 `(app)` 셸이 그려지지 않아 로그인 화면 안내(D4-A)를 못 낸다.
 * 루트 레이아웃은 클라이언트 이동에서 다시 마운트되지 않으므로 「마운트」 = 문서를 새로 불러온 때다.
 * 여기서는 보관 여부(`peek`)만 본다. 본문은 붙여넣기 화면만 꺼낸다(`consume` 은 한 번만 주는 값 — 두 곳이 다투지 않게).
 * 앱이 아니면(브라우저·SSR) 첫 줄에서 끝난다 — 리스너도 달지 않는다.
 */
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isNativeApp, onAppResume, onSharedText, peekSharedText } from '@/modules/infra/native'
import { decideShareAction, SHARE_EVENT, SHARE_LOGIN_HREF, SHARE_PASTE_HREF } from './shareTarget'

/** 같은 경로로 replace 하면(로그인 → 로그인) 경로가 안 바뀌어 아래 해제가 오지 않는다 — 그때를 위한 안전 해제. */
const PENDING_RELEASE_MS = 3000

export default function ShareReceiver() {
  const router = useRouter()
  const pathname = usePathname()
  /** 이동을 부른 뒤 경로가 바뀔 때까지 다시 확인하지 않는다 — 앱이 켜진 채 공유가 오면 신호와 resume 이 둘 다 온다. */
  const pending = useRef(false)
  /** 해제 타이머는 effect 정리에서 지우지 않는다 — 개발 모드 이중 실행에서 첫 확인이 붙잡은 `pending` 이 풀리지 않는 일을 막는다. */
  const release = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    pending.current = false
  }, [pathname])

  useEffect(() => {
    if (!isNativeApp()) return
    const check = async (how: 'mount' | 'warm') => {
      if (pending.current) return
      pending.current = true
      if (release.current) clearTimeout(release.current)
      release.current = setTimeout(() => {
        pending.current = false
      }, PENDING_RELEASE_MS)
      const has = await peekSharedText().catch(() => false)
      if (!has) {
        pending.current = false
        return
      }
      const action = decideShareAction(window.location.pathname, window.location.search)
      if (action === 'signal') window.dispatchEvent(new Event(SHARE_EVENT))
      if (action === 'signal' || action === 'stay') {
        pending.current = false
        return
      }
      if (action === 'login') router.replace(SHARE_LOGIN_HREF)
      else if (how === 'mount') router.replace(SHARE_PASTE_HREF)
      else router.push(SHARE_PASTE_HREF)
    }
    void check('mount')
    const offResume = onAppResume(() => void check('warm'))
    const offShared = onSharedText(() => void check('warm'))
    return () => {
      offResume()
      offShared()
    }
  }, [router])

  return null
}
