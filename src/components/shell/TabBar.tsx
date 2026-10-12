'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isFocusRoute } from './routes'
import { isPlainClick, nextPressed, PRESS_TIMEOUT_MS, tabIsOn } from './tabPress'

/**
 * 하단 탭 5개(설계안 §11) — 기획서 메뉴 1·2·3·4·6 에 대응하고, 5(프로필)는 상단 아바타(→ /settings)로 간다.
 * 아이콘은 단색 stroke SVG(TheMeal 데모 v12 원칙). `match` 는 탭이 활성으로 보일 경로 접두사다 —
 * 단어장 탭은 `/drawer/words` 로 들어가지만 `/drawer/*` 전체에서 활성이어야 한다(URL·모듈 이름은 서랍장 개념 그대로 `drawer`).
 */
const TABS = [
  { href: '/study/ai', match: '/study/ai', label: '회화', path: 'M4 5h16v10H9l-5 4zM8 9h8M8 12h5' },
  { href: '/study/today', match: '/study/today', label: '공부', path: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8' },
  { href: '/plan', match: '/plan', label: '계획표', path: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4M7 14h3M7 17h6' },
  { href: '/drawer/words', match: '/drawer', label: '단어장', path: 'M4 4h16v7H4zM4 11h16v9H4zM10 7h4M10 15h4' },
  { href: '/ask', match: '/ask', label: '질문', path: 'M12 21a9 9 0 1 0-9-9c0 1.6.4 3 1.1 4.3L3 21l4.7-1.1A9 9 0 0 0 12 21zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 17h.01' },
] as const

/**
 * 하단 탭을 숨기는 하위 화면(screens.md §2). 채팅방은 키보드가 올라오면 남는 높이가 ≈560px 인데
 * 탭 바(66px)까지 두면 대화가 보이는 칸이 더 줄어든다 — 이 화면들은 `BackBar` 의 `←` 로 돌아간다.
 * 오늘의 단어 덱·결과(task-008 F10)는 덱 높이 예산(≈640px)이 탭 바만큼 줄면 412×780 에서 스크롤이 생긴다.
 */
export default function TabBar() {
  const pathname = usePathname()
  // 누른 탭(href) — 서버 응답이 오기 전에도 눌린 탭이 바로 켜진다. 경로가 바뀌면 풀린다(렌더 중 조정: 효과로 풀면 한 프레임 늦는다).
  // `prefetch` 는 건드리지 않는다 — 오늘 탭의 API 는 복습 판단 잡을 만든다.
  const [pressed, setPressed] = useState<string | null>(null)
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    setSeenPath(pathname)
    setPressed(null)
  }
  useEffect(() => {
    if (pressed === null) return
    const id = setTimeout(() => setPressed(null), PRESS_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [pressed])

  // 목록은 `routes.ts` 한 곳 — 권장 업데이트 띠도 같은 화면에서 숨는다(screens §11-3 E).
  if (isFocusRoute(pathname)) return null

  return (
    <nav
      aria-label="주 메뉴"
      // 키보드가 열려 있는 동안 숨는다(task-021 D1 A) — globals.css `:root[data-kb] [data-tabbar]`.
      data-tabbar
      className="flex flex-none border-t border-line bg-surface pt-1.5"
      // 제스처 바가 있는 기기에서 탭이 가려지지 않게 safe-area 를 패딩으로 흡수한다.
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      {TABS.map((t) => {
        const active = pathname === t.match || pathname.startsWith(t.match + '/')
        const on = tabIsOn(active, pressed, t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            // 읽기 도구가 읽는 현재 위치는 경로가 실제로 바뀐 뒤에만 옮긴다 — 눌림 중에는 모양(data-pending)만 바뀐다.
            aria-current={active ? 'page' : undefined}
            data-pending={pressed === t.href ? 'true' : undefined}
            onClick={(e) => setPressed((prev) => nextPressed(prev, t.href, active, isPlainClick(e)))}
            // 터치 타겟 44px 이상(모바일 UI 원칙)
            className={`flex min-h-[56px] min-w-0 flex-1 flex-col items-center gap-[3px] rounded-xl pt-1 text-[11px] ${
              on ? 'font-semibold text-accent' : 'text-ink3'
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
