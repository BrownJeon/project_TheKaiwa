'use client'

/**
 * 네이티브(앱) 여부를 **CSS 가 알 수 있게** `<html data-native>` 로 표시한다.
 *
 * 왜 필요한가: 상태바 인셋 보정을 **앱에서만** 걸어야 하기 때문이다. 같은 번들이 폰 앱과
 * PC 브라우저에 함께 나가는데(`server.url` 구조), 브라우저에는 상태바가 없어 같은 패딩을
 * 주면 그냥 빈 줄이 생긴다.
 *
 * 그리고 이 표시가 **안전장치**를 가능하게 한다 — 아래 `globals.css` 참고:
 * `env(safe-area-inset-top)` 이 0 으로 오는 WebView 에서도 앱에서는 최소값이 걸린다.
 */
import { useEffect } from 'react'
import { isNativeApp } from '@/modules/infra/native'

export default function NativeFlag() {
  useEffect(() => {
    // 서버 렌더 결과와 어긋나지 않게 **마운트 후에** 표시한다(`suppressHydrationWarning` 불필요).
    if (isNativeApp()) document.documentElement.dataset.native = '1'
  }, [])
  return null
}
