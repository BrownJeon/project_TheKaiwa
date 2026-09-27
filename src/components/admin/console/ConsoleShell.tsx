'use client'

/**
 * 콘솔 셸(screens.md §6-2 A): 환경 띠 32px(숨김 불가) → 콘솔 바 52px → 본문. 세로 스크롤은 `main` 한 곳.
 * ≥1024px 는 왼쪽 사이드바 232px + 본문(최대 960px). 모바일 메뉴는 공용 `Sheet`.
 *
 * `data-app-shell` + `main` 구조를 앱 셸과 같게 두는 이유: 공용 `Sheet` 가 `[data-app-shell] main` 스크롤을 잠그고,
 * `globals.css` 의 앱 상태바 안전장치(`[data-native] [data-app-shell]`)가 그대로 걸린다.
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import NativeFlag from '@/components/shell/NativeFlag'
import { ConsoleProvider, type ClientConsoleAccess } from './ConsoleProvider'
import ConsoleBar from './ConsoleBar'
import EnvStrip from './EnvStrip'
import { ConsoleMenuSheet, ConsoleSidebar } from './ConsoleNav'

export default function ConsoleShell({ access, children }: { access: ClientConsoleAccess; children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  // 메뉴를 연 주소를 기억한다 — 다른 주소로 이동하면 저절로 닫힌다(effect 없이).
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null)
  const menuOpen = menuOpenAt !== null && menuOpenAt === pathname

  return (
    <ConsoleProvider access={access}>
      <div
        data-app-shell
        className="grid h-[100dvh] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden bg-surface"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <NativeFlag />
        <EnvStrip environment={access.environment} appVersion={access.appVersion} />
        <ConsoleBar menu={access.menu} pathname={pathname} onOpenMenu={() => setMenuOpenAt(pathname)} />
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
          <ConsoleSidebar menu={access.menu} role={access.role} pathname={pathname} />
          <main className="min-h-0 min-w-0 overflow-y-auto bg-ground">
            <div
              className="mx-auto w-full max-w-[960px] px-4 pt-3 lg:px-6"
              style={{ paddingBottom: 'max(40px, calc(16px + env(safe-area-inset-bottom)))' }}
            >
              {children}
            </div>
          </main>
        </div>
        <ConsoleMenuSheet
          open={menuOpen}
          onClose={() => setMenuOpenAt(null)}
          menu={access.menu}
          role={access.role}
          environment={access.environment}
          pathname={pathname}
        />
      </div>
    </ConsoleProvider>
  )
}
