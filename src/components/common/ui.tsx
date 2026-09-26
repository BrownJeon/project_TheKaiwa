'use client'

/**
 * 데모(`docs/demo/themeal-demo.html`)의 공용 조각을 Tailwind 로 옮긴 것.
 * 색은 전부 `globals.css` 토큰(`--color-*`)만 쓴다 — 새 색을 하드코딩하면 다크모드가 깨진다.
 */
import Link from 'next/link'

export function Card({
  children,
  flat = false,
  className = '',
}: {
  children: React.ReactNode
  flat?: boolean
  className?: string
}) {
  return (
    <div
      className={`min-w-0 rounded-[14px] border p-3.5 ${
        flat ? 'border-transparent bg-surface2' : 'border-line bg-surface'
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionHeader({
  title,
  right,
  href,
  hrefLabel,
}: {
  /** 제목 뒤에 작은 글씨를 붙이는 자리(달력 일 합계)가 있어 문자열이 아니라 노드를 받는다. */
  title: React.ReactNode
  right?: React.ReactNode
  href?: string
  hrefLabel?: string
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="min-w-0 truncate text-[15px] font-semibold">{title}</h3>
      {href ? (
        <Link href={href} className="flex-none text-[13px] font-medium text-accent">
          {hrefLabel ?? '전체'}
        </Link>
      ) : (
        right
      )}
    </div>
  )
}

export function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`mt-[18px] min-w-0 ${className}`}>{children}</section>
}

type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral' | 'accent'
const BADGE_TONE: Record<BadgeTone, string> = {
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  neutral: 'bg-surface2 text-ink2',
  accent: 'bg-accent-soft text-accent',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-[22px] flex-none items-center rounded-md px-2 text-[11.5px] font-semibold ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  )
}

type BtnVariant = 'primary' | 'ghost' | 'soft' | 'danger'
const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: 'bg-accent text-on-accent disabled:opacity-40',
  ghost: 'border border-line bg-surface disabled:opacity-40',
  soft: 'bg-surface2 disabled:opacity-40',
  danger: 'border border-line bg-surface text-bad disabled:opacity-40',
}

/**
 * 하단 버튼 줄의 **순서는 전 화면 확정 → 취소**다(설계안 §11). 문구는 화면마다 달라도
 * 순서가 같아야 손이 기억한다. 그래서 `BtnRow` 는 children 순서를 그대로 쓴다.
 */
export function BtnRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">{children}</div>
}

export function Btn({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'md' | 'sm' }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold ${
        size === 'sm' ? 'h-[38px] px-3.5 text-[13px]' : 'h-12 px-4 text-[15px]'
      } ${BTN_VARIANT[variant]} ${className}`}
    />
  )
}

export function Field({
  label,
  children,
  className = '',
  htmlFor,
}: {
  label: string
  children: React.ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-ink2">
        {label}
      </label>
      {children}
    </div>
  )
}

export function LoadingBlock({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div role="status" className="py-8 text-center text-[13px] text-ink3">
      {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-3 text-[13px] text-bad"
    >
      <div className="break-keep">{message}</div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
          다시 시도
        </button>
      ) : null}
    </div>
  )
}

export function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center text-[13px] text-ink3">
      {children}
    </div>
  )
}

/** Phase 로 미뤄 둔 자리 — 무엇이 언제 들어오는지 화면에 적어 둔다(빈 칸은 버그로 읽힌다). */
export function PhasePlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-line px-4 py-5 text-center text-xs leading-relaxed text-ink3">
      {children}
    </div>
  )
}
