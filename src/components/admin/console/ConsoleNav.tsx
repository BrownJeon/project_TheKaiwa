'use client'

/**
 * 콘솔 메뉴(screens.md §6-2 A): 모바일 = 공용 `Sheet`(아래에서 올라옴), ≥1024 = 사이드바. 둘 다 서버가 capability·Phase 로
 * 거른 같은 목록을 그린다 — 권한 없는 메뉴는 목록에 아예 없다. 활성 판정은 바 제목과 같은 "가장 긴 접두사".
 */
import Link from 'next/link'
import Sheet from '@/components/common/Sheet'
import type { AdminEnvironment, AdminMenuItem, AdminRole } from '@/types/admin'
import { activeMenu, envMessage, groupMenu, menuSub } from './labels'

export function ConsoleNavList({
  menu,
  role,
  pathname,
  environment,
  onNavigate,
}: {
  menu: AdminMenuItem[]
  role: AdminRole
  pathname: string
  /** 시트에서만 — 머리에 환경 문구를 한 번 더 보인다(띠는 360px 에서 말줄임되므로). */
  environment?: AdminEnvironment
  onNavigate?: () => void
}) {
  const active = activeMenu(menu, pathname)
  return (
    <nav aria-label="콘솔 메뉴" className="min-w-0">
      {environment ? (
        <p className="mb-2 rounded-xl bg-surface2 px-3 py-2 text-[12px] text-ink2 [overflow-wrap:anywhere]">
          {environment} · {envMessage(environment)}
        </p>
      ) : null}
      {groupMenu(menu).map((g) => (
        <div key={g.label}>
          <p className="mt-3 px-3 text-[12px] font-medium text-ink2">{g.label}</p>
          {g.items.map((m) => {
            const on = active?.id === m.id
            const sub = menuSub(m.id)
            return (
              <Link
                key={m.id}
                href={m.path}
                aria-current={on ? 'page' : undefined}
                onClick={onNavigate}
                className={`flex min-h-[52px] min-w-0 flex-col justify-center rounded-xl px-3 ${on ? 'bg-accent-soft font-semibold ring-1 ring-accent' : ''}`}
              >
                <span className="truncate text-[15px] text-ink">{m.label}</span>
                {sub ? <span className="truncate text-[12px] font-normal text-ink2">{sub}</span> : null}
              </Link>
            )
          })}
        </div>
      ))}
      <hr className="my-3 border-line" />
      <Link href="/settings" onClick={onNavigate} className="flex min-h-[52px] items-center rounded-xl px-3 text-[15px] text-ink">
        ↩ 학습 앱으로 돌아가기
      </Link>
      <p className="px-3 pb-2 text-[12px] text-ink2">내 역할 {role}</p>
    </nav>
  )
}

/** ≥1024px 만. 자체 세로 스크롤(데스크톱 예외). */
export function ConsoleSidebar({ menu, role, pathname }: { menu: AdminMenuItem[]; role: AdminRole; pathname: string }) {
  return (
    <aside className="hidden min-h-0 min-w-0 overflow-y-auto border-r border-line bg-surface px-2 pb-6 lg:block">
      <ConsoleNavList menu={menu} role={role} pathname={pathname} />
    </aside>
  )
}

export function ConsoleMenuSheet({
  open,
  onClose,
  menu,
  role,
  environment,
  pathname,
}: {
  open: boolean
  onClose: () => void
  menu: AdminMenuItem[]
  role: AdminRole
  environment: AdminEnvironment
  pathname: string
}) {
  return (
    <Sheet open={open} title="콘솔 메뉴" onClose={onClose}>
      <ConsoleNavList menu={menu} role={role} pathname={pathname} environment={environment} onNavigate={onClose} />
    </Sheet>
  )
}
