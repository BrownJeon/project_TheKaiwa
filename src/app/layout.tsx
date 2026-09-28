import type { Metadata, Viewport } from 'next'
import './globals.css'
import { APP_NAME, APP_TAGLINE } from '@/components/common/brand'

export const metadata: Metadata = {
  title: APP_NAME,
  description: `${APP_TAGLINE} — AI 일본어 선생님과 매일 회화·교정·단어·평가`,
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
}

// `viewportFit: 'cover'` + globals.css 의 safe-area 처리로 노치·제스처 바 영역을 다룬다.
// `maximumScale`을 막지 않는다 — 확대를 금지하면 접근성이 깨진다.
// `interactiveWidget: 'resizes-content'`(task-006 D7): 모바일 Chrome 에서 키보드가 열리면 `100dvh` 자체가 줄어
// 채팅 입력창이 키보드 바로 위에 붙는다. 기본값(resizes-visual)은 키보드가 화면을 덮기만 해서 입력창이 가려진다.
// 지원하지 않는 브라우저·WebView 는 채팅방의 `useKeyboardInset`(visualViewport) 보정이 받는다. 전 화면에 걸리므로 설정 화면 키보드도 QA 확인 대상.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#141816' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
