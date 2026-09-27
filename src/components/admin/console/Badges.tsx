/**
 * 콘솔 뱃지(screens.md §6-2 C·F·G·J). 점은 장식(`aria-hidden`), 뜻은 글자가 진다.
 * `warn` 글자·`accent` 뱃지 글자·`ink3` 글자는 쓰지 않는다(§1-1) — DEGRADED 는 `text-ink`, MISCONFIGURED 는 빨강 윤곽(보라 대신).
 */
import type { TraceStatusName, VoiceStatusName } from '@/types/admin'
import { type BadgeValue, STATUS_KO, STEP_STATUS_KO, TRACE_STATUS_KO, voiceBadge } from './labels'

const BASE = 'inline-flex h-[22px] flex-none items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold'

const STATUS_TONE: Record<BadgeValue, { tone: string; dot?: string }> = {
  HEALTHY: { tone: 'bg-good-soft text-good', dot: 'bg-good' },
  DEGRADED: { tone: 'bg-warn-soft text-ink', dot: 'bg-warn' },
  UNAVAILABLE: { tone: 'bg-bad-soft text-bad', dot: 'bg-bad' },
  MISCONFIGURED: { tone: 'border border-bad bg-surface text-bad' },
  DISABLED: { tone: 'bg-surface2 text-ink2' },
  UNKNOWN: { tone: 'border border-dashed border-ink2 bg-surface text-ink2' },
  PASSED: { tone: 'bg-good-soft text-good' },
  FAILED: { tone: 'bg-bad-soft text-bad' },
  TIMEOUT: { tone: 'bg-bad-soft text-bad' },
  SKIPPED: { tone: 'bg-surface2 text-ink2' },
}

export function StatusBadge({ value }: { value: BadgeValue | null | undefined }) {
  const v: BadgeValue = value ?? 'UNKNOWN'
  const t = STATUS_TONE[v] ?? STATUS_TONE.UNKNOWN
  const label = STATUS_KO[v] ?? v
  return (
    <span aria-label={`상태: ${label}(${v})`} className={`${BASE} ${t.tone}`}>
      {t.dot ? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${t.dot}`} /> : null}
      {label}
    </span>
  )
}

const VOICE_TONE = {
  good: 'bg-good-soft text-good',
  neutral: 'bg-surface2 text-ink2',
  bad: 'bg-bad-soft text-bad',
  dashed: 'border border-dashed border-ink2 bg-surface text-ink2',
} as const

export function VoiceStatusBadge({ status, enabled }: { status: VoiceStatusName; enabled: boolean }) {
  const v = voiceBadge(status, enabled)
  return (
    <span aria-label={`상태: ${v.label}(${status})`} className={`${BASE} ${VOICE_TONE[v.tone]}`}>
      {v.label}
    </span>
  )
}

const TRACE_TONE: Record<TraceStatusName, string> = {
  OK: 'bg-good-soft text-good',
  PARTIAL: 'border border-bad bg-surface text-bad',
  ERROR: 'bg-bad-soft text-bad',
}

export function TraceStatusBadge({ status }: { status: TraceStatusName }) {
  return (
    <span aria-label={`결과: ${TRACE_STATUS_KO[status] ?? status}`} className={`${BASE} ${TRACE_TONE[status] ?? 'bg-surface2 text-ink2'}`}>
      {TRACE_STATUS_KO[status] ?? status}
    </span>
  )
}

const STEP_TONE: Record<string, string> = {
  OK: 'bg-good-soft text-good',
  FAILED: 'bg-bad-soft text-bad',
  TIMEOUT: 'bg-bad-soft text-bad',
  SKIPPED: 'bg-surface2 text-ink2',
  FALLBACK: 'bg-warn-soft text-ink',
}

export function StepStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  return (
    <span aria-label={`단계 결과: ${STEP_STATUS_KO[status] ?? status}`} className={`${BASE} ${STEP_TONE[status] ?? 'bg-surface2 text-ink2'}`}>
      {STEP_STATUS_KO[status] ?? status}
    </span>
  )
}

export function LoadedBadge({ loaded }: { loaded: boolean }) {
  return <span className={`${BASE} ${loaded ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>{loaded ? '로드됨' : '로드 실패'}</span>
}

/** 회색 보조 뱃지(종류·등록 불일치·capability 이름). */
export function NeutralBadge({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return <span className={`${BASE} max-w-full bg-surface2 text-ink2 ${mono ? 'font-mono font-medium' : ''}`}>{children}</span>
}
