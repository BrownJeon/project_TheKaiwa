'use client'

/** traceId·connection key·ref 이름(screens.md §6-2 C): 모노 글꼴 + 44×44 복사 버튼. 카드 전체가 링크인 곳에서는 `copy` 를 끈다. */
import { useConsoleToast } from './ConsoleProvider'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useConsoleToast()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toast('복사했어요')
    } catch {
      toast('복사하지 못했어요')
    }
  }
  return (
    <button type="button" aria-label={`${label} 복사`} onClick={copy} className="grid h-11 w-11 flex-none place-items-center rounded-xl text-ink2">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h8" />
      </svg>
    </button>
  )
}

export default function MonoId({ value, copy = false, label = 'ID', className = '' }: { value: string; copy?: boolean; label?: string; className?: string }) {
  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      <span className="min-w-0 flex-1 font-mono text-[13px] text-ink2 [overflow-wrap:anywhere]">{value}</span>
      {copy ? <CopyButton value={value} label={label} /> : null}
    </div>
  )
}
