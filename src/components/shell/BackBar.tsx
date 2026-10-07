'use client'

import Link from 'next/link'
import { usePlanReturn } from './usePlanReturn'

/**
 * 하위 화면(채팅방·점검 결과, task-008 하위 화면) 헤더 — 하단 탭을 숨긴 화면에서 `←` 로 돌아간다(screens.md §2).
 * 흐름 배치가 기본이다. 결과 화면처럼 `main` 이 스크롤되는 화면은 `sticky` 로 붙인다.
 * 계획표 하루 시트에서 연 원본 화면이면 `←` 는 "계획표로"(같은 달·날 시트, 그 기록에 초점) — `backHref`·`backLabel` 은 그 밖의 경우다(task-012).
 */
export default function BackBar({
  backHref,
  backLabel,
  title,
  subtitle,
  right,
  sticky = false,
  onBack,
}: {
  backHref: string
  backLabel: string
  title: string
  subtitle?: string
  right?: React.ReactNode
  sticky?: boolean
  /** 있으면 `←` 가 링크 대신 버튼이 되어 이것을 부른다(고치던 초안이 있을 때 나가기 확인 — task-045 S4). */
  onBack?: () => void
}) {
  const back = usePlanReturn(backHref, backLabel)
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-10' : ''} flex h-[52px] min-w-0 flex-none items-center gap-1 border-b border-line bg-surface pl-1 pr-1`}
    >
      {onBack ? (
        <button type="button" onClick={onBack} aria-label={back.label} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink">
          <BackIcon />
        </button>
      ) : (
        <Link href={back.href} aria-label={back.label} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink">
          <BackIcon />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
        {subtitle ? <p className="truncate text-[12px] leading-tight text-ink2">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  )
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
