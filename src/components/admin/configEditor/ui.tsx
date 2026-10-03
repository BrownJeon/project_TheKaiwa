/**
 * 설정 편집 공용 조각(task-012c, 데모 v2): 입력칸 모양·뱃지(엄격·바뀜·잠금·버전 상태·기록 손상)·안내 상자.
 * 색은 `globals.css` 토큰만. 경고 글자는 `text-bad` on `bg-surface`(명암비), `warn` 글자는 쓰지 않는다(screens.md §1-1).
 */
import type { ConfigIntegrity, ConfigVersionStatusName } from '@/types/admin'
import { type FieldLock, LOCK_BADGE, VERSION_STATUS_KO } from './configCopy'

export const INPUT =
  'h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 aria-[invalid=true]:border-bad disabled:opacity-60'
export const TEXTAREA =
  'block w-full min-w-0 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-[1.5] text-ink placeholder:text-ink3 aria-[invalid=true]:border-bad disabled:opacity-60'
export const FIELD_ERROR = 'mt-1 text-[12px] text-bad break-keep'
export const FIELD_HELP = 'mt-1 text-[12px] text-ink2 break-keep'
export const LABEL = 'text-[12.5px] font-medium text-ink2'
export const LINK_SM = 'inline-flex min-h-11 items-center px-1 text-[12.5px] font-medium text-accent'
export const LINK = 'inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-accent'

const BASE = 'inline-flex h-[22px] flex-none items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold'

export function StrictBadge() {
  return (
    <span aria-label="엄격 키 — 운영에서는 최고관리자가 직접 적용" className={`${BASE} border border-bad bg-surface text-bad`}>
      엄격
    </span>
  )
}

export function ChangedBadge() {
  return <span className={`${BASE} border border-ink bg-surface text-ink`}>바뀜</span>
}

export function LockBadge({ lock }: { lock: FieldLock }) {
  return <span className={`${BASE} bg-surface2 text-ink2`}>{LOCK_BADGE[lock]}</span>
}

export function NeutralTag({ children }: { children: React.ReactNode }) {
  return <span className={`${BASE} bg-surface2 text-ink2`}>{children}</span>
}

const VERSION_TONE: Record<ConfigVersionStatusName, string> = {
  ACTIVE: 'bg-good-soft text-good',
  SUPERSEDED: 'bg-surface2 text-ink2',
  ROLLED_BACK: 'border border-bad bg-surface text-bad',
}

export function VersionStatusBadge({ status }: { status: ConfigVersionStatusName }) {
  const label = VERSION_STATUS_KO[status] ?? status
  return (
    <span aria-label={`상태: ${label}`} className={`${BASE} ${VERSION_TONE[status] ?? 'bg-surface2 text-ink2'}`}>
      {status === 'ACTIVE' ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-good" /> : null}
      {label}
    </span>
  )
}

export function DamagedBadge({ integrity }: { integrity: ConfigIntegrity | null | undefined }) {
  if (!integrity || integrity === 'OK') return null
  return (
    <span aria-label={`기록 손상: ${integrity === 'MALFORMED' ? '기록 형식이 깨졌어요' : '지금 규칙에 맞지 않는 값이 있어요'}`} className={`${BASE} border border-bad bg-surface text-bad`}>
      기록 손상
    </span>
  )
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

/** 안내 상자 4종 — neu(회색) · good(적용 완료) · warn(주의) · bad(빨간 테두리 — 오류·운영). */
export function Note({ tone, role, children, className = '' }: { tone: 'neu' | 'good' | 'warn' | 'bad'; role?: 'alert' | 'status' | 'note'; children: React.ReactNode; className?: string }) {
  const t = tone === 'neu' ? 'bg-surface2' : tone === 'good' ? 'bg-good-soft' : tone === 'warn' ? 'bg-warn-soft' : 'border border-bad bg-surface'
  return (
    <div role={role} className={`min-w-0 rounded-xl px-3 py-2.5 text-[13px] text-ink break-keep ${t} ${className}`}>
      {children}
    </div>
  )
}

export function Switch({ checked, onChange, label, labelledBy, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label?: string; labelledBy?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 items-center gap-2.5 text-[14px] text-ink disabled:opacity-60"
    >
      <span aria-hidden="true" className={`relative h-[26px] w-11 flex-none rounded-full ${checked ? 'bg-good' : 'bg-surface2 ring-1 ring-inset ring-ink2'}`}>
        <span className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full transition-transform motion-reduce:transition-none ${checked ? 'translate-x-[18px] bg-surface' : 'bg-ink2'}`} />
      </span>
      {checked ? '켜짐' : '꺼짐'}
    </button>
  )
}
