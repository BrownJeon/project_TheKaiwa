import Link from 'next/link'

/**
 * 하위 화면(채팅방·점검 결과, task-008 하위 화면) 헤더 — 하단 탭을 숨긴 화면에서 `←` 로 돌아간다(screens.md §2).
 * 흐름 배치가 기본이다. 결과 화면처럼 `main` 이 스크롤되는 화면은 `sticky` 로 붙인다.
 */
export default function BackBar({
  backHref,
  backLabel,
  title,
  subtitle,
  right,
  sticky = false,
}: {
  backHref: string
  backLabel: string
  title: string
  subtitle?: string
  right?: React.ReactNode
  sticky?: boolean
}) {
  return (
    <header
      className={`${sticky ? 'sticky top-0 z-10' : ''} flex h-[52px] min-w-0 flex-none items-center gap-1 border-b border-line bg-surface pl-1 pr-1`}
    >
      <Link href={backHref} aria-label={backLabel} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[17px] font-semibold leading-tight">{title}</h1>
        {subtitle ? <p className="truncate text-[12px] leading-tight text-ink2">{subtitle}</p> : null}
      </div>
      {right}
    </header>
  )
}
