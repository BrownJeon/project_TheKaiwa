'use client'

/**
 * 평가 화면 공용 조각(데모 v1 의 `.svst`·`.alert`·`.note`·`.gen-hero`·`.dl`·`.grade`·`.alink` 를 Tailwind 로). 색은 globals.css 토큰만.
 */
import type { EvalGrade, EvalKind } from '@/types/evaluation'
import type { JlptLevel } from '@/types/lesson'
import { GRADE_LABEL, KIND_NAME, RUN, SUMMARY } from './evalCopy'

export function ClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 21V5" />
    </svg>
  )
}

export function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

export function KeyboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </svg>
  )
}

export function PlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  )
}

export function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

const GRADE_ICON: Record<EvalGrade, React.ReactNode> = {
  EXCELLENT: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  ),
  GOOD: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  ),
  FAIR: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </svg>
  ),
  NEEDS_WORK: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4h4" />
    </svg>
  ),
}

const GRADE_TONE: Record<EvalGrade, string> = {
  EXCELLENT: 'bg-good-soft text-good',
  GOOD: 'bg-good-soft text-good',
  FAIR: 'bg-warn-soft text-ink',
  NEEDS_WORK: 'bg-surface2 text-ink',
}

/** 등급 — 색 + 모양 + 글자(색만으로 뜻을 전하지 않는다). */
export function GradeChip({ grade, className = '' }: { grade: EvalGrade; className?: string }) {
  return (
    <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold ${GRADE_TONE[grade]} ${className}`}>
      {GRADE_ICON[grade]}
      {GRADE_LABEL[grade]}
    </span>
  )
}

export function SaveLine({ state, emptyText }: { state: 'saved' | 'empty' | 'busy'; emptyText?: string }) {
  const dot = state === 'saved' ? 'border-ink2 bg-ink2' : state === 'busy' ? 'border-ink2 border-r-transparent motion-safe:animate-spin' : 'border-ink3'
  return (
    <p role="status" className="mt-2.5 flex min-h-6 items-center gap-1.5 text-[12.5px] text-ink2 break-keep">
      <span aria-hidden="true" className={`h-2 w-2 flex-none rounded-full border-[1.5px] ${dot}`} />
      {state === 'saved' ? RUN.saved : (emptyText ?? RUN.notYet)}
    </p>
  )
}

export function AlertBox({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="alert" className={`rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep ${className}`}>
      {children}
    </div>
  )
}

export function TextLink({ onClick, children, className = '', tone = 'inherit', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'inherit' | 'ink' | 'accent' }) {
  const color = tone === 'accent' ? 'text-accent no-underline' : tone === 'ink' ? 'text-ink underline' : 'underline'
  return (
    <button type="button" onClick={onClick} {...rest} className={`relative inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold underline-offset-[3px] ${color} ${className}`}>
      {children}
    </button>
  )
}

export function Hero({ tone, title, children, titleRef }: { tone: 'spin' | 'bad' | 'good'; title: string; children?: React.ReactNode; titleRef?: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-2 pb-2 pt-6 text-center">
      {tone === 'spin' ? (
        <span aria-hidden="true" className="h-10 w-10 rounded-full border-4 border-accent border-r-transparent motion-safe:animate-spin" />
      ) : (
        <span aria-hidden="true" className={`grid h-[52px] w-[52px] place-items-center rounded-full text-[24px] font-bold ${tone === 'bad' ? 'bg-bad-soft text-bad' : 'bg-good-soft text-good'}`}>
          {tone === 'bad' ? '!' : '✓'}
        </span>
      )}
      <h2 ref={titleRef} tabIndex={-1} className="mt-2 text-[19px] font-bold outline-none break-keep">
        {title}
      </h2>
      {children}
    </div>
  )
}

export function EvalSummary({ kind, level, topic, itemCount }: { kind: EvalKind; level: JlptLevel; topic: string | null; itemCount: number }) {
  const rows: [string, string][] = [
    [SUMMARY.kind, KIND_NAME[kind]],
    [SUMMARY.level, level],
    ...(topic ? ([[SUMMARY.topic, topic]] as [string, string][]) : []),
    [SUMMARY.items, SUMMARY.count(itemCount)],
    [SUMMARY.limit, SUMMARY.limitVal],
  ]
  return (
    <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[13px] text-ink2">{k}</dt>
          <dd className="min-w-0 text-[15px] break-keep [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 3칸 요약(답함 · 안 푼 문항 · 쓴 시간/시간 초과) — 제출 확인·채점 대기. */
export function SumGrid({ cells }: { cells: { value: string; label: string; warn?: boolean }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.label} className={`rounded-xl px-1.5 py-2.5 text-center ${c.warn ? 'bg-bad-soft text-bad' : 'bg-surface2'}`}>
          <b className="block text-[20px] tabular-nums">{c.value}</b>
          <span className={`text-[12px] ${c.warn ? 'text-bad' : 'text-ink2'}`}>{c.label}</span>
        </div>
      ))}
    </div>
  )
}

/** 진행을 모르는 대기 띠(4px, 움직임 줄이기면 멈춤). */
export function IndetBar() {
  return (
    <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-surface2">
      <div className="h-full w-2/5 rounded-full bg-accent motion-safe:animate-[lesson-indet_1.6s_ease-in-out_infinite]" />
    </div>
  )
}
