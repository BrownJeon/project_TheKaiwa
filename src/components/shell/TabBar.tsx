'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 하단 탭 5개(설계안 §11) — 기획서 메뉴 1·2·3·4·6 에 대응하고, 5(프로필)는 상단 아바타(→ /settings)로 간다.
 * 아이콘은 단색 stroke SVG(TheMeal 데모 v12 원칙). `match` 는 탭이 활성으로 보일 경로 접두사다 —
 * 서랍장은 `/drawer/words` 로 들어가지만 `/drawer/*` 전체에서 활성이어야 한다.
 */
const TABS = [
  { href: '/study/ai', match: '/study/ai', label: '회화', path: 'M4 5h16v10H9l-5 4zM8 9h8M8 12h5' },
  { href: '/study/today', match: '/study/today', label: '오늘', path: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8' },
  { href: '/plan', match: '/plan', label: '계획표', path: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M7 14h3M7 17h6' },
  { href: '/drawer/words', match: '/drawer', label: '서랍장', path: 'M4 4h16v7H4zM4 11h16v9H4zM10 7h4M10 15h4' },
  { href: '/ask', match: '/ask', label: '질문', path: 'M12 21a9 9 0 1 0-9-9c0 1.6.4 3 1.1 4.3L3 21l4.7-1.1A9 9 0 0 0 12 21zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01' },
] as const

/**
 * 하단 탭을 숨기는 하위 화면(screens.md §2). 채팅방은 키보드가 올라오면 남는 높이가 ≈560px 인데
 * 탭 바(66px)까지 두면 대화가 보이는 칸이 더 줄어든다 — 이 화면들은 `BackBar` 의 `←` 로 돌아간다.
 */
const HIDDEN_PREFIXES = ['/study/ai/chat/'] as const

export default function TabBar() {
  const pathname = usePathname()

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null

  return (
    <nav
      aria-label="주 메뉴"
      className="flex flex-none border-t border-line bg-surface pt-1.5"
      // 제스처 바가 있는 기기에서 탭이 가려지지 않게 safe-area 를 패딩으로 흡수한다.
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      {TABS.map((t) => {
        const active = pathname === t.match || pathname.startsWith(t.match + '/')
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            // 터치 타겟 44px 이상(모바일 UI 원칙)
            className={`flex min-h-[56px] min-w-0 flex-1 flex-col items-center gap-[3px] rounded-xl pt-1 text-[11px] ${
              active ? 'font-semibold text-accent' : 'text-ink3'
            }`}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={t.path} />
            </svg>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
