/**
 * 계획표 공용 조각 — 종류 글자 칩·아이콘. 색만으로 구분하지 않는다: 종류는 글자, 평가는 반전 칩, 복습할 날은 점선 칩(데모 `.tc`).
 * 아래쪽은 성장 탭(task-080) 카드·문구 조각.
 */
import { Fragment, useId, type ReactNode } from 'react'
import { DAY_VIEW } from '@/components/challenge/challengeCopy'
import { DayMarkInner } from '@/components/challenge/parts'
import { GROWTH, type Rich } from './growthCopy'
import type { CellMark } from './logic'
import { TYPE_META } from './logic'

const CHIP_SIZE = {
  sm: 'h-[17px] w-[17px] rounded-[5px] text-[11px]',
  lg: 'h-[30px] w-[30px] rounded-[9px] text-[14px]',
} as const

/**
 * `soft` 는 칩이 놓인 배경이 `surface2`(복습 줄·확인 상자)일 때 칩 바탕을 `surface` 로 뒤집는다 — 같은 색이면 칩 윤곽이 사라진다.
 */
export function Chip({ mark, size = 'sm', soft = false }: { mark: CellMark; size?: 'sm' | 'lg'; soft?: boolean }) {
  const base = `grid flex-none place-items-center font-bold leading-none ${CHIP_SIZE[size]}`
  // 챌린지 하루 모양은 원형(종류 글자 칩과 모양으로도 구분된다). 일부는 반원 그림(글꼴 비의존).
  if (mark.kind === 'ch')
    return (
      <span aria-hidden="true" className={`${base} rounded-full! ${DAY_VIEW[mark.state].cls}`}>
        <DayMarkInner state={mark.state} />
      </span>
    )
  if (mark.kind === 'eval') return <span aria-hidden="true" className={`${base} bg-ink text-surface`}>{TYPE_META.EVALUATION.ch}</span>
  if (mark.kind === 'due') return <span aria-hidden="true" className={`${base} border-[1.5px] border-dashed border-ink2 text-ink`}>{TYPE_META.REVIEW.ch}</span>
  if (mark.kind === 'more') return <span aria-hidden="true" className={`${base} font-semibold tracking-[-0.02em] text-ink2`}>+{mark.n}</span>
  if (mark.type === 'EVALUATION') return <span aria-hidden="true" className={`${base} bg-ink text-surface`}>{TYPE_META.EVALUATION.ch}</span>
  return (
    <span aria-hidden="true" className={`${base} ${soft ? 'bg-surface' : 'bg-surface2'} text-ink`}>
      {TYPE_META[mark.type].ch}
    </span>
  )
}

/** 출석만 한 날 — 작은 빈 동그라미. */
export function AttendDot({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block h-[9px] w-[9px] flex-none rounded-full border-[1.5px] border-ink2 ${className}`} />
}

const SVG = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export function IconLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2" {...SVG}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function IconRight() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2" {...SVG}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function IconDots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

export function IconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.8" {...SVG}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  )
}

export function IconOpen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.8" {...SVG}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

export function Spinner() {
  return <span aria-hidden="true" className="inline-block h-4 w-4 flex-none animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
}

// ── 성장 탭 공용 조각(task-080, screens.md §36-3·36-11) ──────────────────────────

/** 성장 탭 맨 아래 «선생님 분석 · 곧 열려요» — 달력 아래 옛 카드(task-012)와 같은 모양, 분석 탭(후속)이 열리기 전 안내. */
export function AnalysisSoonCard() {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="mt-[18px] flex min-w-0 items-start justify-between gap-2 rounded-[14px] border border-transparent bg-surface2 p-3.5">
      <div className="min-w-0">
        <h2 id={titleId} className="text-[15px] font-semibold break-keep">
          {GROWTH.soonTitle}
        </h2>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{GROWTH.soonBody}</p>
      </div>
      <span className="inline-flex h-[22px] flex-none items-center whitespace-nowrap rounded-md bg-surface px-2 text-[11.5px] font-semibold text-ink2">{GROWTH.soonBadge}</span>
    </section>
  )
}

/** 카드 섹션 — 제목 `h2`(15px) + 오른쪽 작은 글. `aria-labelledby` 로 제목을 이름으로 쓴다. */
export function GrowthCard({ title, side, children }: { title: string; side?: string | null; children: ReactNode }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="mt-[18px] min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
      <div className="mb-2 flex min-w-0 items-baseline justify-between gap-2">
        <h2 id={titleId} className="min-w-0 text-[15px] font-semibold break-keep">
          {title}
        </h2>
        {side ? <span className="flex-none whitespace-nowrap text-[12px] text-ink2">{side}</span> : null}
      </div>
      {children}
    </section>
  )
}

/** 문구 조각 배열(`growthCopy` 의 `Rich`)을 그린다 — 굵은 조각은 `<b>`(문자열 HTML 을 쓰지 않는다). */
export function RichText({ parts, boldClass = 'font-[650]' }: { parts: Rich; boldClass?: string }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <b key={i} className={boldClass}>
            {p.b}
          </b>
        ),
      )}
    </>
  )
}

/** [표로 보기]·[주별로 보기] 펼침 — `details` 기본 동작 그대로, ▾/▴ 는 읽지 않는다. */
export function TableToggle({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        {label}
        <span aria-hidden="true" className="text-[12px] text-ink2 group-open:hidden">
          ▾
        </span>
        <span aria-hidden="true" className="hidden text-[12px] text-ink2 group-open:inline">
          ▴
        </span>
      </summary>
      {children}
    </details>
  )
}

export const TH = 'whitespace-nowrap border-t border-line px-1 py-1.5 text-left text-[12px] font-semibold text-ink2'
export const TD = 'whitespace-nowrap border-t border-line px-1 py-1.5 text-left'
export const NUM = 'text-right tabular-nums'
