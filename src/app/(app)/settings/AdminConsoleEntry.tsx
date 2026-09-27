import Link from 'next/link'

/**
 * 설정 허브 맨 아래 "관리자 › AI Engine Console" 한 줄(screens.md §6-2 K, task-005b).
 * **서버 컴포넌트**다('use client' 금지) — 페이지가 `userCan('engine.read')` 로 보유자에게만 렌더하므로
 * USER 의 DOM·RSC 응답·JS 번들에 이 문자열이 들어가지 않는다. 콘솔 컴포넌트를 import 하지 않는다(번들 분리).
 */
export default function AdminConsoleEntry() {
  return (
    <section className="mt-[18px] min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-[15px] font-semibold">관리자</h3>
      </div>
      <Link
        href="/admin/dashboard"
        className="flex min-h-[56px] min-w-0 items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-2.5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">AI Engine Console</span>
          <span className="block truncate text-[13px] text-ink2">엔진·연결 상태를 보고 테스트해요</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-ink2" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </section>
  )
}
