import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TheKaiwa',
  description: 'AI 일본어 선생님과 매일 회화·교정·단어·평가로 익히는 개인 일본어 회화 훈련',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'TheKaiwa', statusBarStyle: 'default' },
}

// `viewportFit: 'cover'` + globals.css 의 safe-area 처리로 노치·제스처 바 영역을 다룬다.
// `maximumScale`을 막지 않는다 — 확대를 금지하면 접근성이 깨진다.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
