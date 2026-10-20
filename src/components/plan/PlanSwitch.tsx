'use client'

/**
 * 계획표 앱바 아래 분절 `[달력 | 성장]`(task-080, screens.md §36-2) — 단어장 `DrawerSwitch` 의 구조를 그대로 옮겼다: `nav` + `aria-current="page"` 링크 두 개.
 *
 * - `replace`: 두 화면 사이 오가기는 기록을 쌓지 않는다. 지금 화면 항목은 눌러도 아무 일 없음.
 * - 초점: 앱 라우터 이동 뒤엔 초점이 문서 처음으로 빠진다 — 누를 때 대상을 모듈 변수에 적고, 새 화면의 분절이 마운트되면 현재 항목에 초점을 둔다.
 *   `placeholder`(서버 loading 자리표시)는 inert 라 이 처리를 하지 않는다 — 먼저 비워 버리면 진짜 화면이 초점을 못 받는다.
 * - 아래 간격은 0 — 아래 첫 블록이 `mt-3` 을 가진다(달력 = 챌린지 카드, 성장 = 기간 묶음, 데모 `.psw` 아래 12px).
 * - 이 파일은 자리표시(`PlanSkeleton`·`GrowthSkeleton`)도 그리므로 화면 모듈을 import 하지 않는다.
 * - 두 분절의 공용화는 `DrawerSwitch` 회귀 위험이 있어 이번 범위 밖(36-18).
 */
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { GROWTH } from './growthCopy'

export type PlanView = 'calendar' | 'growth'

const ITEMS: readonly { view: PlanView; href: string; label: string }[] = [
  { view: 'calendar', href: '/plan', label: GROWTH.switchCalendar },
  { view: 'growth', href: '/plan/growth', label: GROWTH.switchGrowth },
]

// 히트영역은 세로로만 44px(가로로 넓히면 맞붙은 옆 칸을 가로챈다), 글자 truncate 는 안쪽 span 에(링크에 달면 overflow:hidden 이 ::before 를 자른다).
const ITEM =
  "relative grid h-9 min-w-0 flex-1 place-items-center rounded-[9px] px-1 text-[13.5px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
const ON = 'bg-surface font-semibold text-ink shadow-sm'
const OFF = 'font-medium text-ink2'

/** 이동 뒤 초점 기록의 유효 시간 — 느린 망에서 자리표시가 길게 떠도 받을 만큼, 취소된 이동이 한참 뒤 화면에 끼어들지 않을 만큼. */
export const PLAN_FOCUS_TTL_MS = 20_000

let pendingFocus: { view: PlanView; at: number } | null = null

/** 분절을 눌러 이동할 때 — 새 화면 분절이 초점을 받을 대상(시험용으로 내보냄). */
export function markPlanFocus(view: PlanView, now: number = Date.now()): void {
  pendingFocus = { view, at: now }
}

/** 마운트된 분절이 `view` 라면 초점을 받을지 — 받으면 기록을 비운다(한 번만). */
export function takePlanFocus(view: PlanView, now: number = Date.now()): boolean {
  const p = pendingFocus
  if (!p) return false
  if (now - p.at > PLAN_FOCUS_TTL_MS || p.at - now > PLAN_FOCUS_TTL_MS) {
    pendingFocus = null
    return false
  }
  if (p.view !== view) return false
  pendingFocus = null
  return true
}

export default function PlanSwitch({ current, placeholder = false }: { current: PlanView; placeholder?: boolean }) {
  const currentRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    if (placeholder) return
    if (takePlanFocus(current)) currentRef.current?.focus({ preventScroll: true })
  }, [current, placeholder])

  return (
    <nav aria-label={GROWTH.switchNav} inert={placeholder || undefined} className="mb-0 flex gap-[3px] rounded-xl bg-surface2 p-[3px]">
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
                    markPlanFocus(it.view)
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
