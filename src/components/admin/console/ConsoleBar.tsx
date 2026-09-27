'use client'

/** 콘솔 바(screens.md §6-2 A) 52px: ☰(모바일만) · "AI Engine Console · {묶음}" / {메뉴 이름} · ↩ 앱으로. `h1` 은 이것 하나다. */
import Link from 'next/link'
import type { AdminMenuItem } from '@/types/admin'
import { activeMenu, menuGroupLabel } from './labels'

export default function ConsoleBar({ menu, pathname, onOpenMenu }: { menu: AdminMenuItem[]; pathname: string; onOpenMenu: () => void }) {
  const active = activeMenu(menu, pathname)
  return (
    <header className="flex h-[52px] min-w-0 items-center gap-1 border-b border-line bg-surface pl-1 pr-1 lg:pl-4">
      <button
        type="button"
        aria-label="콘솔 메뉴 열기"
        aria-haspopup="dialog"
        onClick={onOpenMenu}
        className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink lg:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] leading-tight text-ink2">
          AI Engine Console{active ? ` · ${menuGroupLabel(active.group)}` : ''}
        </p>
        <h1 className="truncate text-[17px] font-semibold leading-tight">{active?.label ?? '콘솔'}</h1>
      </div>
      <Link
        href="/settings"
        aria-label="학습 앱으로 돌아가기"
        className="flex h-11 flex-none items-center gap-1 rounded-xl px-3 text-[13px] font-medium text-ink2"
      >
        <span aria-hidden="true">↩</span> 앱으로
      </Link>
    </header>
  )
}
