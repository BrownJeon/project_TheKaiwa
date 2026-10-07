import Link from 'next/link'
import { ENTRY } from '@/components/topic/topicCopy'

/**
 * 설정 허브 "회화 연습 › 내 상황·주제 관리" 한 줄(task-045 S1, 위치=A — 로그인 계정 바로 아래). **서버 컴포넌트**, 추가 질의 0.
 * 모양은 관리자 행(`AdminConsoleEntry`)과 같은 56px 목록 행.
 */
export default function ManageEntryRow() {
  return (
    <section className="mt-[18px] min-w-0" aria-labelledby="settings-practice">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 id="settings-practice" className="min-w-0 truncate text-[15px] font-semibold">
          {ENTRY.section}
        </h3>
      </div>
      <Link href="/settings/scenarios" className="flex min-h-[56px] min-w-0 items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{ENTRY.row}</span>
          <span className="block text-[13px] text-ink2 break-keep">{ENTRY.rowSub}</span>
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-ink2" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </section>
  )
}
