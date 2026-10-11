'use client'

/**
 * 단어장 탭 앱바 아래 분절 `[단어 | 채택한 교정]`(task-055 D1 A, screens.md §21-3 A) — 두 주소로 가는 링크 두 개.
 * 모양은 `Segmented` md 와 같은 클래스지만 `role=radiogroup` 버튼이 아니라 `nav` + `aria-current="page"` 링크다(주소 이동).
 *
 * - `replace`: 두 목록 사이 오가기는 기록을 쌓지 않는다(회화 탭 `[회화|채팅|역할극]` 의 `router.replace` 선례). 지금 화면 항목은 눌러도 아무 일 없음.
 * - 초점: 앱 라우터 이동 뒤엔 초점이 문서 처음으로 빠진다 — 누를 때 대상을 모듈 변수에 적고, 새 화면의 분절이 마운트되면 현재 항목에 초점을 둔다.
 *   `placeholder`(서버 loading 자리표시)는 inert 라 초점이 안 가므로 이 처리를 하지 않는다 — 먼저 비워 버리면 진짜 화면이 초점을 못 받는다.
 *   이동이 끝나지 않은 채 남은 기록이 나중에 다른 길로 들어온 화면의 초점을 가로채지 않게 짧은 유효 시간을 둔다.
 * - 이 파일은 자리표시(`WordsSkeleton`·`CorrectionsSkeleton`)도 그리므로 화면 모듈을 import 하지 않는다.
 */
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { CORRECTIONS_COPY } from './correctionsCopy'

export type DrawerView = 'words' | 'corrections'

const ITEMS: readonly { view: DrawerView; href: string; label: string }[] = [
  { view: 'words', href: '/drawer/words', label: CORRECTIONS_COPY.switchWords },
  { view: 'corrections', href: '/drawer/corrections', label: CORRECTIONS_COPY.switchCorrections },
]

// 히트영역은 세로로만 44px(가로로 넓히면 맞붙은 옆 칸을 가로챈다), 글자 truncate 는 안쪽 span 에(링크에 달면 overflow:hidden 이 ::before 를 자른다) — Segmented 주석.
const ITEM =
  "relative grid h-9 min-w-0 flex-1 place-items-center rounded-[9px] px-1 text-[13.5px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
const ON = 'bg-surface font-semibold text-ink shadow-sm'
const OFF = 'font-medium text-ink2'

/** 이동 뒤 초점 기록의 유효 시간 — 느린 망에서 자리표시가 길게 떠도 받을 만큼, 취소된 이동이 한참 뒤 화면에 끼어들지 않을 만큼. */
export const DRAWER_FOCUS_TTL_MS = 20_000

let pendingFocus: { view: DrawerView; at: number } | null = null

/** 분절을 눌러 이동할 때 — 새 화면 분절이 초점을 받을 대상(시험용으로 내보냄). */
export function markDrawerFocus(view: DrawerView, now: number = Date.now()): void {
  pendingFocus = { view, at: now }
}

/** 마운트된 분절이 `view` 라면 초점을 받을지 — 받으면 기록을 비운다(한 번만). */
export function takeDrawerFocus(view: DrawerView, now: number = Date.now()): boolean {
  const p = pendingFocus
  if (!p) return false
  if (now - p.at > DRAWER_FOCUS_TTL_MS || p.at - now > DRAWER_FOCUS_TTL_MS) {
    pendingFocus = null
    return false
  }
  if (p.view !== view) return false
  pendingFocus = null
  return true
}

export default function DrawerSwitch({ current, placeholder = false }: { current: DrawerView; placeholder?: boolean }) {
  const currentRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    if (placeholder) return
    if (takeDrawerFocus(current)) currentRef.current?.focus({ preventScroll: true })
  }, [current, placeholder])

  return (
    <nav aria-label={CORRECTIONS_COPY.switchNav} inert={placeholder || undefined} className="mb-2.5 flex gap-[3px] rounded-xl bg-surface2 p-[3px]">
      {ITEMS.map((it) => {
        const on = it.view === current
        return (
          <Link
            key={it.view}
            href={it.href}
            replace
            aria-current={on ? 'page' : undefined}
            ref={on && !placeholder ? currentRef : undefined}
            onClick={
              placeholder
                ? undefined
                : (e) => {
                    if (on) {
                      e.preventDefault()
                      return
                    }
                    markDrawerFocus(it.view)
                  }
            }
            className={`${ITEM} ${on ? ON : OFF}`}
          >
            <span className="block truncate">{it.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
