/**
 * 챌린지 공용 조각 — 하루 모양 원(D9)·과제 모양·안내/오류 상자·오늘 할 일 줄·지표 칸. 색은 토큰만, 상태는 글자 + 모양.
 */
import Link from 'next/link'
import type { ChallengeDayState } from '@/types/challenge'
import { DAY_VIEW } from './challengeCopy'
import type { StatTile, TaskGlyph, TaskRowView } from './logic'

/**
 * `aria-disabled` 로 막은 버튼의 면 — 공용 `Btn` 은 native `disabled:` 만 꾸미고, 막힌 버튼도 눌러서 이유를 알려야 해서
 * native disabled 를 쓰지 않는다(선례 `eval/EvalStartScreen.tsx`).
 * `opacity` 는 글자까지 함께 옅어져 라벨 대비가 1.8:1 까지 떨어졌다(qa-p2a #3) — 면·테두리만 바꾸고 글자는 토큰(`ink2`)을 지킨다.
 * `aria-disabled:` 꾸밈은 속성 선택자가 붙어 `Btn` 변형(`bg-accent`·`bg-surface`)보다 우선한다.
 */
export const BLOCKED_FACE = 'aria-disabled:border aria-disabled:border-dashed aria-disabled:border-ink3 aria-disabled:bg-surface2 aria-disabled:text-ink2'

/** 보내는 중(이때도 `aria-disabled`) — 같은 동작이 진행 중이라 막힘(회색 면)과 달리 옅은 강조 면 + 강조 테두리 + 기본 글자색. */
export const BUSY_FACE = 'aria-disabled:border aria-disabled:border-accent aria-disabled:bg-accent-soft aria-disabled:text-ink'

/** 만들기 [다음]·[챌린지 시작] — 막힘은 회색 면, 보내는 중은 강조 옅은 면(두 면이 겹치지 않게 한쪽만 싣는다). */
export function ctaClass(busy: boolean): string {
  return `w-full ${busy ? BUSY_FACE : BLOCKED_FACE}`
}

const GLYPH_SIZE = {
  sm: 'h-[17px] w-[17px] text-[11px]',
  md: 'h-[22px] w-[22px] text-[12px]',
  lg: 'h-[30px] w-[30px] text-[14px]',
} as const

/**
 * "일부" 모양 — 원 테두리 + 왼쪽 절반 채움(`currentColor`). 반원 글자(U+25D0)는 기기 글꼴에 따라 작은 점이나 빈 네모로 보여서
 * 글꼴과 상관없는 그림으로 그린다. 크기는 둘레 글자 크기(1em)를 따르고, 뜻은 옆 글자·바탕색·범례가 전하므로 읽기에서 숨긴다.
 */
export function PartialMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" focusable="false" data-mark="partial" className={`inline-block flex-none ${className}`}>
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.5a6.5 6.5 0 0 0 0 13z" fill="currentColor" />
    </svg>
  )
}

/** 하루 모양 원 안의 표시 — 일부는 그림, 나머지는 글자. */
export function DayMarkInner({ state }: { state: ChallengeDayState }) {
  const v = DAY_VIEW[state]
  return v.half ? <PartialMark /> : <>{v.glyph}</>
}

export function DayGlyph({ state, size = 'md' }: { state: ChallengeDayState; size?: keyof typeof GLYPH_SIZE }) {
  const v = DAY_VIEW[state]
  return (
    <span aria-hidden="true" className={`grid flex-none place-items-center rounded-full font-bold leading-none ${GLYPH_SIZE[size]} ${v.cls}`}>
      <DayMarkInner state={state} />
    </span>
  )
}

export function TaskGlyphIcon({ glyph }: { glyph: TaskGlyph }) {
  const base = 'grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[12px] font-bold leading-none'
  if (glyph === 'done') return <span aria-hidden="true" className={`${base} bg-good-soft text-good`}>✓</span>
  if (glyph === 'half')
    return (
      <span aria-hidden="true" className={`${base} bg-warn-soft text-ink`}>
        <PartialMark />
      </span>
    )
  if (glyph === 'fail') return <span aria-hidden="true" className={`${base} bg-bad-soft text-bad`}>!</span>
  if (glyph === 'spin')
    return <span aria-hidden="true" className="block h-[22px] w-[22px] flex-none animate-spin rounded-full border-2 border-ink3 border-r-transparent motion-reduce:animate-none" />
  return <span aria-hidden="true" className="block h-[22px] w-[22px] flex-none rounded-full shadow-[inset_0_0_0_1.5px_var(--color-ink3)]" />
}

export function InfoBox({ title, children, className = '' }: { title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-surface2 px-3.5 py-3 text-[13px] text-ink ${className}`}>
      {title ? <p className="font-bold break-keep [overflow-wrap:anywhere]">{title}</p> : null}
      {children ? <div className={`${title ? 'mt-1 ' : ''}break-keep [overflow-wrap:anywhere]`}>{children}</div> : null}
    </div>
  )
}

export function ErrorBox({ title, body, onRetry, retryLabel = '다시 시도', className = '' }: { title: string; body?: string; onRetry?: () => void; retryLabel?: string; className?: string }) {
  return (
    <div role="alert" className={`rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad ${className}`}>
      <p className="break-keep [overflow-wrap:anywhere]">
        <b className="font-bold">{title}</b>
        {body ? ` ${body}` : null}
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-[3px]">
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

export function Skeleton({ heights, label }: { heights: number[]; label: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {heights.map((h, i) => (
          <span key={i} className="block rounded-[14px] bg-surface2" style={{ height: h }} />
        ))}
      </div>
    </div>
  )
}

/** 오늘 할 일 — 버튼이 아니라 오늘 탭으로 가는 줄(N3 = A). 가는 곳이 없는 줄은 링크가 아니다. */
export function TaskRows({ rows, label = '오늘 할 일' }: { rows: TaskRowView[]; label?: string }) {
  return (
    <ul aria-label={label} className="mt-1.5 flex flex-col">
      {rows.map((r) => {
        const body = (
          <>
            <TaskGlyphIcon glyph={r.glyph} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] font-semibold">{r.title}</span>
              <span className="text-[12.5px] text-ink2 break-keep [overflow-wrap:anywhere]">{r.desc}</span>
            </span>
            {r.go ? <span className="flex-none text-[13px] font-semibold text-ink">{r.go} ›</span> : null}
          </>
        )
        const cls = 'flex min-h-14 min-w-0 items-center gap-2.5 border-t border-line py-2 first:border-t-0'
        return (
          <li key={r.key} className="min-w-0">
            {r.href ? (
              <Link href={r.href} aria-label={r.aria} className={cls}>
                {body}
              </Link>
            ) : (
              <div className={cls}>
                <span className="sr-only">{r.prefix}</span>
                {body}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function StatTiles({ tiles, cols = 2, label }: { tiles: StatTile[]; cols?: 2 | 3; label?: string }) {
  return (
    <div role="group" aria-label={label} className={`grid gap-2 ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {tiles.map((t) => (
        <div key={t.key} className="min-w-0 rounded-xl border border-line bg-surface px-3 py-2.5">
          <b className="block text-[20px] font-bold leading-[1.3] tabular-nums">{t.value}</b>
          <span className="block text-[12px] text-ink">{t.label}</span>
          {t.sub.map((s) => (
            <span key={s} className="block text-[12px] text-ink2 break-keep">
              {s}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ULink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px] ${className}`}>
      {children}
    </Link>
  )
}

export function BtnLink({ href, children, variant = 'primary', replace }: { href: string; children: React.ReactNode; variant?: 'primary' | 'ghost'; replace?: boolean }) {
  return (
    <Link
      href={href}
      replace={replace}
      className={`inline-flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl px-4 text-center text-[15px] font-semibold ${
        variant === 'primary' ? 'bg-accent text-on-accent' : 'border border-line bg-surface'
      }`}
    >
      {children}
    </Link>
  )
}
