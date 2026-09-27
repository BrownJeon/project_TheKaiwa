/**
 * 발음 사전 뱃지(screens.md §10-2 B·G·I). 점은 장식(`aria-hidden`), 뜻은 글자가 진다.
 * 되돌려짐·끄기 경고는 `text-bad` on `bg-surface`(§1-1 — `bad-soft` 보다 명암비가 높다).
 */
import type { LexiconSnapshotIntegrity, LexiconVersionStatus } from '@/types/lexicon'
import { DAMAGED_LABEL, INTEGRITY_KO, isDamaged, VERSION_STATUS_KO } from './lexiconCopy'

const BASE = 'inline-flex h-[22px] flex-none items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold'

export function EntryStatusBadge({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span aria-label="상태: 사용 중" className={`${BASE} bg-good-soft text-good`}>
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-good" />
        사용 중
      </span>
    )
  }
  return (
    <span aria-label="상태: 꺼짐" className={`${BASE} bg-surface2 text-ink2`}>
      꺼짐
    </span>
  )
}

const VERSION_TONE: Record<LexiconVersionStatus, string> = {
  ACTIVE: 'bg-good-soft text-good',
  SUPERSEDED: 'bg-surface2 text-ink2',
  ROLLED_BACK: 'border border-bad bg-surface text-bad',
}

export function VersionStatusBadge({ status }: { status: LexiconVersionStatus }) {
  const label = VERSION_STATUS_KO[status] ?? status
  return (
    <span aria-label={`상태: ${label}`} className={`${BASE} ${VERSION_TONE[status] ?? 'bg-surface2 text-ink2'}`}>
      {status === 'ACTIVE' ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-good" /> : null}
      {label}
    </span>
  )
}

/** "기록 손상" — OK(또는 값 없음)면 그리지 않는다. 뜻(형식·규칙·해시)은 aria-label 과 상세 시트 한 줄이 전한다. */
export function IntegrityBadge({ integrity }: { integrity: LexiconSnapshotIntegrity | null | undefined }) {
  if (!integrity || !isDamaged(integrity)) return null
  const why = INTEGRITY_KO[integrity as Exclude<LexiconSnapshotIntegrity, 'OK'>] ?? integrity
  return (
    <span aria-label={`${DAMAGED_LABEL}: ${why}`} className={`${BASE} border border-bad bg-surface text-bad`}>
      {DAMAGED_LABEL}
    </span>
  )
}

const CHIP_TONE = {
  plain: 'bg-surface text-ink',
  muted: 'bg-surface2 text-ink',
  warn: 'border border-bad bg-surface text-bad',
  error: 'bg-bad-soft text-bad',
} as const

/** 개수 칩 — 0 도 보인다. 끄기 >0 은 warn, 오류 >0 은 error. */
export function CountChip({ label, n, tone = 'plain' }: { label: string; n: number; tone?: keyof typeof CHIP_TONE }) {
  return (
    <li className={`inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium ${CHIP_TONE[tone]}`}>
      {label} <span className="tabular-nums">{n}</span>
    </li>
  )
}
