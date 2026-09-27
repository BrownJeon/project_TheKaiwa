'use client'

/**
 * 콘솔 안 상태 카드(screens.md §6-2 B·§6-3): 403(권한 부족 — 메뉴·띠 유지) · 찾을 수 없어요(없는 id) · 불러오는 중 · 불러오기 실패.
 * USER 의 404 는 여기서 만들지 않는다 — 앱의 아무 없는 주소와 같은 404(layout·page 가드의 `notFound()`)다.
 * 공용 `LoadingBlock`·`EmptyBlock` 은 `ink3` 글자라 쓰지 않는다(§1-1).
 */
import Link from 'next/link'
import { Card, ErrorBlock } from '@/components/common/ui'
import type { Err } from '@/components/common/errors'
import { useConsoleEnv } from './ConsoleProvider'

const GHOST_LINK = 'mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold text-ink'

export function ConsoleForbidden({ missing, role }: { missing: string[]; role?: string }) {
  return (
    <Card className="mt-6 text-center">
      <svg className="mx-auto text-ink2" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <h2 className="mt-2 text-[17px] font-semibold">이 화면을 볼 권한이 없어요</h2>
      <p className="mt-1 text-[14px] text-ink2 [overflow-wrap:anywhere]">
        필요한 권한 <code className="font-mono text-ink">{missing.length ? missing.join(', ') : '—'}</code>
        {role ? ` · 내 역할 ${role}` : ''}
      </p>
      <p className="mt-1 text-[13px] text-ink2">역할은 소유자(SUPER_ADMIN)가 바꿀 수 있어요.</p>
      <Link href="/admin/dashboard" className={GHOST_LINK}>
        대시보드로
      </Link>
    </Card>
  )
}

export function ConsoleNotFound({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  const env = useConsoleEnv()
  return (
    <Card className="mt-6 text-center">
      <h2 className="text-[17px] font-semibold">찾을 수 없어요</h2>
      <p className="mt-1 text-[14px] text-ink2 break-keep">지웠거나 다른 환경의 항목일 수 있어요. 지금 환경은 {env} 이에요.</p>
      <Link href={backHref} className={GHOST_LINK}>
        {backLabel}
      </Link>
    </Card>
  )
}

export function ConsoleLoading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-[13px] text-ink2">
      {label}
    </p>
  )
}

/** 403 본문 `details.missing`(없으면 `details.requiredCapability`). */
export function missingOf(err: Err): string[] {
  const m = err.details.missing
  if (Array.isArray(m)) return m.filter((x): x is string => typeof x === 'string')
  const r = err.details.requiredCapability
  return typeof r === 'string' ? [r] : []
}

export function loadErrorText(err: Err, name: string): string {
  if (err.status === 0) return '연결하지 못했어요. 네트워크를 확인해 주세요.'
  return `${name} 정보를 불러오지 못했어요.`
}

/**
 * 목록·상세 불러오기 실패 공통 분기(§6-3): 403 → 콘솔 403 카드 · 404 → 상세는 `notFound` 카드, 목록은 권한 변경 안내 ·
 * 그 외 → ErrorBlock + 다시 시도.
 */
export function LoadError({
  err,
  name,
  onRetry,
  notFound,
}: {
  err: Err
  name: string
  onRetry: () => void
  notFound?: { backHref: string; backLabel: string }
}) {
  if (err.status === 403) return <ConsoleForbidden missing={missingOf(err)} />
  if (err.status === 404) {
    if (notFound) return <ConsoleNotFound backHref={notFound.backHref} backLabel={notFound.backLabel} />
    return (
      <div className="mt-3">
        <ErrorBlock message="콘솔에 들어갈 권한이 바뀌었을 수 있어요." />
        <Link href="/settings" className="mt-2 inline-flex h-11 items-center text-[14px] font-medium text-accent">
          설정으로
        </Link>
      </div>
    )
  }
  return (
    <div className="mt-3">
      <ErrorBlock message={loadErrorText(err, name)} onRetry={onRetry} />
    </div>
  )
}

/** 빈 목록 점선 안내(`EmptyBlock` 대신 — ink2 글자). */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink2 break-keep">{children}</p>
}

/** 상세 화면 머리의 "← 목록" 링크(44px). */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-ml-1 inline-flex h-11 items-center px-1 text-[14px] text-ink2">
      ← {children}
    </Link>
  )
}
