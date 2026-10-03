'use client'

/**
 * 수업 화면 공용 조각(screens §12-5) — 표현 칩·재생 버튼·보기 토글·역할 칩·수업 머리·단계 표시.
 */
import Link from 'next/link'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import TtsRuntimeStatusIndicator from '@/components/speech/TtsRuntimeStatusIndicator'
import type { LessonContent } from '@/types/lesson'
import { LESSON, STAGE_NAMES, U2, U4 } from './lessonCopy'

export function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  )
}

export function StopIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

/** 표현 칩 — 조각이면 표기·뜻, 문형이면 문형·"문형". `tone` 으로 결과(썼어요/아직)를 칠한다. */
export function ExprChip({
  ja,
  ko,
  tone = 'plain',
  tail,
  badge,
}: {
  ja: string
  ko: string
  tone?: 'plain' | 'good'
  tail?: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <li className={`inline-flex max-w-full min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-[10px] px-2.5 py-1.5 ${tone === 'good' ? 'bg-good-soft' : 'bg-surface2'}`}>
      <span lang="ja" className="text-[16px] [overflow-wrap:anywhere]">
        {ja}
      </span>
      <span className="text-[12px] text-ink2">{ko}</span>
      {badge}
      {tail}
    </li>
  )
}

/** 소리를 받는 중 — 14px 도는 원(글자 색을 따른다). 움직임 줄이기 설정이면 멈춘다. */
export function Spinner() {
  return <span aria-hidden="true" className="inline-block h-3.5 w-3.5 flex-none rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
}

export function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

/**
 * ② 오늘의 표현 — 칩 전체가 듣기 버튼(task-025 결정 b=A, 데모 v1 `#l2`·`#l2-playing`). 칩 앞 ▶ 원 30px, 높이 44px.
 * 재생 중 ■ + 테두리 + `accent-soft`, 받는 중 스피너. ④⑤ 의 같은 모양 칩(`ExprChip`)은 소리가 없다(▶ 표시로 구분).
 */
export function ExprPlayChip({ ja, ko, badge, state, onClick }: { ja: string; ko: string; badge?: React.ReactNode; state: 'idle' | 'loading' | 'playing'; onClick: () => void }) {
  const on = state !== 'idle'
  return (
    <li className="max-w-full min-w-0">
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-[10px] py-1 pl-1.5 pr-3 text-left text-ink ${on ? 'bg-accent-soft ring-[1.5px] ring-accent ring-inset' : 'bg-surface2'}`}
      >
        <span aria-hidden="true" className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full ${on ? 'bg-ink text-surface' : 'bg-surface'}`}>
          {state === 'loading' ? <Spinner /> : on ? <StopIcon /> : <PlayIcon size={12} />}
        </span>
        <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span lang="ja" className="text-[16px] [overflow-wrap:anywhere]">
            {ja}
          </span>
          <span className="text-[12px] text-ink2">{ko}</span>
          {badge}
        </span>
        <span className="sr-only">{on ? U2.exprStopSr : U2.exprListenSr}</span>
      </button>
    </li>
  )
}

/** targetIds → 칩 재료(content.chunks 는 표기·뜻, content.grammar 는 문형·"문형"). 모르는 id 는 뺀다. */
export function targetsOf(content: Pick<LessonContent, 'chunks' | 'grammar'>, ids: readonly string[]): { id: string; ja: string; ko: string }[] {
  const out: { id: string; ja: string; ko: string }[] = []
  for (const id of ids) {
    const c = content.chunks.find((x) => x.id === id)
    if (c) {
      out.push({ id, ja: c.textJa, ko: c.meaningKo })
      continue
    }
    const g = content.grammar.find((x) => x.id === id)
    if (g) out.push({ id, ja: g.pattern, ko: U4.grammarTag })
  }
  return out
}

/** 44px 원형 재생 버튼(예문 듣기). */
export function PlayButton({ playing, onClick, label = U2.play }: { playing: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? U2.stopAria : label}
      className={`grid h-11 w-11 flex-none place-items-center rounded-full border ${playing ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'}`}
    >
      {playing ? <StopIcon /> : <PlayIcon />}
    </button>
  )
}

/** 넓은 테두리 재생 버튼(모범 답안 듣기·내 목소리 대신 쓰는 곳). */
export function PlayWide({ playing, onClick, label, stopLabel = '■ 멈춤' }: { playing: boolean; onClick: () => void; label: string; stopLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-2 inline-flex h-11 items-center gap-1.5 rounded-xl border px-3.5 text-[14px] font-semibold ${playing ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface text-ink'}`}
    >
      {playing ? stopLabel : label}
    </button>
  )
}

/** 보기 토글(읽기·번역) — 32px 알약 + 세로 히트 44px. */
export function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`relative h-8 rounded-full border px-3 text-[13px] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] ${on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink'}`}
    >
      {children}
    </button>
  )
}

/** 역할 칩(A·B) — A 옅게, B 진하게(글자로도 구분). */
export function RoleChip({ who, small = false }: { who: 'A' | 'B'; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid flex-none place-items-center rounded-md font-bold ${small ? 'h-5 w-5 text-[11px]' : 'h-6 w-6 text-[12px]'} ${who === 'A' ? 'bg-surface2 text-ink' : 'bg-ink text-surface'}`}
    >
      {who}
    </span>
  )
}

export function LessonHeader({ teacherName, topic, title, onAnnounce }: { teacherName: string; topic: string; title: string; onAnnounce: (m: string) => void }) {
  return (
    <header className="flex h-14 min-w-0 flex-none items-center gap-1 border-b border-line bg-surface px-1">
      <Link href="/study/today" aria-label={LESSON.back} className="grid h-11 w-11 flex-none place-items-center text-ink">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <TeacherAvatar name={teacherName} size="md" />
      <div className="flex min-w-0 flex-1 flex-col items-start pl-1.5">
        <h1 className="max-w-full truncate text-[16px] font-semibold leading-5">
          <span className="sr-only">{LESSON.srPrefix(topic)}</span>
          <span lang="ja">{title}</span>
        </h1>
        <TtsRuntimeStatusIndicator onAnnounce={onAnnounce} />
      </div>
    </header>
  )
}

export function StageSteps({ stageDone, current, onPick }: { stageDone: number; current: number; onPick: (n: number) => void }) {
  return (
    <nav aria-label={LESSON.stepsAria(stageDone)} className="grid flex-none grid-cols-5 border-b border-line bg-surface px-1.5 py-1">
      {STAGE_NAMES.map((name, i) => {
        const n = i + 1
        const done = n <= stageDone
        const cur = n === current
        const locked = n > stageDone + 1
        const circle = cur ? 'bg-accent text-on-accent' : done ? 'bg-good-soft text-good' : locked ? 'text-ink2 ring-[1.5px] ring-line ring-inset' : 'bg-surface2 text-ink'
        return (
          <button
            key={name}
            type="button"
            aria-current={cur ? 'step' : undefined}
            aria-disabled={locked || undefined}
            aria-label={LESSON.stepAria(n, name, { done, current: cur, locked })}
            onClick={() => onPick(n)}
            className={`relative flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 text-[11.5px] ${cur ? 'font-bold text-ink' : 'text-ink2'} ${
              i < 4 ? `after:absolute after:left-[calc(50%+16px)] after:right-[calc(-50%+16px)] after:top-[19px] after:h-0.5 after:content-[''] ${n <= stageDone ? 'after:bg-good' : 'after:bg-line'}` : ''
            }`}
          >
            <span aria-hidden="true" className={`grid h-[26px] w-[26px] place-items-center rounded-full text-[12px] font-semibold ${circle}`}>
              {done && !cur ? '✓' : n}
            </span>
            <span aria-hidden="true" className="max-w-full truncate">
              {name}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
