'use client'

/**
 * 채팅방 키보드 2차 보정(screens.md §3-9). 1차는 루트 viewport `interactive-widget=resizes-content` —
 * 그게 먹는 브라우저에선 `innerHeight` 가 같이 줄어 여기 값은 0 이고 이중 보정이 없다.
 * 지원하지 않는 WebView·브라우저에서만 visualViewport 로 가려진 높이를 재어 **방 루트에만** `--kb-inset` 을 쓴다
 * (VoiceVault `KeyboardInset` 의 body 여백 방식은 폼 화면용이라 채팅엔 쓰지 않는다).
 */
import { useEffect, type RefObject } from 'react'

export function useKeyboardInset(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!el || !vv) return
    let raf = 0
    const apply = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // 핀치 확대 중에도 vv.height 가 줄어든다 — 그건 키보드가 아니다.
        const inset = vv.scale > 1.01 ? 0 : window.innerHeight - vv.height - vv.offsetTop
        el.style.setProperty('--kb-inset', inset > 1 ? `${Math.round(inset)}px` : '0px')
      })
    }
    apply()
    vv.addEventListener('resize', apply)
    vv.addEventListener('scroll', apply)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', apply)
      vv.removeEventListener('scroll', apply)
      el.style.removeProperty('--kb-inset')
    }
  }, [ref, enabled])
}
