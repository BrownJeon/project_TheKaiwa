'use client'

/**
 * 챌린지 만들기 조각(가이드 §3-3, D7·D8) — 단계 표시 · 주제 라디오 카드 · 기간 라디오 카드 · 목표 체크 카드 · 장수 칩 · 난이도 알약(task-076).
 * 고르기는 native radio/checkbox(`fieldset`/`legend` 안). 장수 칩은 막힌 칸이 있어 공용 `Segmented` 대신 따로 둔다(공용 부품은 고치지 않는다).
 */
import { Fragment } from 'react'
import { JaText, HangulLine } from '@/components/common/japanese/JapaneseText'
import { OFF, useWordLayersList } from '@/components/common/japanese/annotations'
import { kstDateKey } from '@/components/common/format'
import { Badge } from '@/components/common/ui'
import { formatMonthDay } from '@/components/vocab/format'
import { JLPT_LEVELS, levelLabel, levelName } from '@/components/vocab/labels'
import type { ChallengeWordCount } from '@/types/challenge'
import type { JlptLevel, Topic } from '@/types/lesson'
import { CREATE } from './challengeCopy'
import { confirmLevelNote, levelPillSr, type LevelCompareGroup, type LevelContext } from './logic'
import { BLOCKED_FACE } from './parts'

/** 난이도 「이름 (코드)」 한 덩어리(screens.md §33-1a) — 이름과 코드 사이에서 줄이 바뀌지 않는다. 뒤에 조사를 붙이지 않는다. */
export function LevelText({ level }: { level: JlptLevel }) {
  return <span className="whitespace-nowrap">{levelLabel(level)}</span>
}

/** ① 설명(질문 5 a) — 「…보여 드려요: 초보자 (N5) · 초급 (N4) · 중급 (N3). 챌린지 동안 …」. 목록을 아직 모르면 「—」. */
export function TopicLevelsBody({ levels }: { levels: readonly JlptLevel[] }) {
  const { before, after } = CREATE.q1BodyParts
  return (
    <p className="mt-1 text-[13px] text-ink2 break-keep">
      {before}
      {levels.length
        ? levels.map((l, i) => (
            <Fragment key={l}>
              {i > 0 ? ' · ' : null}
              <LevelText level={l} />
            </Fragment>
          ))
        : '—'}
      {after}
    </p>
  )
}

/**
 * 난이도 알약 5칸(D2 B · D11 A) — native radio(←/→ 이동). 보이는 두 줄(위 이름 13px · 아래 코드 11px)은 낭독에서 숨기고
 * 시각 숨김 글 「초급 (N4), 내 수준, 이 주제 기본」 한 번만 읽힌다. 크기는 설정 「지금 수준」 두 줄 분절과 같다(칸 높이 48).
 * 선택 모양은 장수 칩과 같다(바탕 surface + 안쪽 2px accent + 굵게).
 */
export function LevelPills({ name, value, ctx, onChange }: { name: string; value: JlptLevel; ctx: LevelContext; onChange: (l: JlptLevel) => void }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-2">
      {JLPT_LEVELS.map((l) => (
        <label key={l} className="relative block min-w-0 cursor-pointer">
          <input type="radio" name={name} value={l} checked={l === value} onChange={() => onChange(l)} className="peer sr-only" />
          <span className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-px rounded-xl border border-line bg-surface px-0.5 py-[3px] font-medium text-ink peer-checked:border-transparent peer-checked:font-bold peer-checked:shadow-[inset_0_0_0_2px_var(--color-accent)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
            <span aria-hidden="true" className="block max-w-full truncate text-[13px] leading-[1.2]">
              {levelName(l)}
            </span>
            <span aria-hidden="true" className="block max-w-full truncate text-[11px] font-medium leading-[1.2] text-ink2">
              {l}
            </span>
            <span className="sr-only">{levelPillSr(l, ctx)}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

/** ④ 확인 「난이도」 줄 dd — 「중급 (N3)」 + 작은 글 「이 주제 기본」 / 「이 주제 기본은 초급 (N4)」. */
export function ConfirmLevelValue({ level, topicLevel }: { level: JlptLevel; topicLevel: JlptLevel }) {
  const note = confirmLevelNote(level, topicLevel)
  return (
    <>
      <LevelText level={level} />
      <small className="block text-[12.5px] text-ink2 break-keep">
        {note.head}
        {note.topicLabel ? <span className="whitespace-nowrap">{note.topicLabel}</span> : null}
      </small>
    </>
  )
}

/** 비교 줄(D3 A) — 「내 수준 초급 (N4) ·」 묶음마다 줄바꿈 없음, 묶음 사이에서만 줄이 바뀐다. */
export function LevelCompareLine({ id, groups }: { id: string; groups: readonly LevelCompareGroup[] }) {
  return (
    <p id={id} className="mt-2 text-[12.5px] text-ink2 tabular-nums break-keep [overflow-wrap:anywhere]">
      {groups.map((g, i) => (
        <Fragment key={g.head}>
          {i > 0 ? ' ' : null}
          <span className="whitespace-nowrap">
            {g.head} <b className="font-semibold text-ink">{g.label}</b>
            {i < groups.length - 1 ? ' ·' : null}
          </span>
        </Fragment>
      ))}
    </p>
  )
}

export function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <ol aria-label={CREATE.stepsLabel} className="flex flex-none gap-1 border-b border-line bg-surface px-4 py-2">
      {CREATE.stepNames.map((name, i) => {
        const n = i + 1
        const done = n < step
        const now = n === step
        return (
          <li key={name} aria-current={now ? 'step' : undefined} className="flex min-w-0 flex-1 items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[12px] font-bold ${
                now ? 'bg-surface text-ink shadow-[inset_0_0_0_2px_var(--color-accent)]' : done ? 'bg-good-soft text-good' : 'bg-surface2 text-ink2'
              }`}
            >
              {done ? '✓' : n}
            </span>
            <span className={`truncate text-[12px] ${now ? 'font-semibold text-ink' : 'text-ink2'}`}>
              <span className="sr-only">{done ? '끝낸 단계 ' : ''}</span>
              {name}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ChunkPreview({ topic }: { topic: Topic }) {
  const shown = topic.chunks.slice(0, 3)
  const layers = useWordLayersList(shown.map((c) => ({ surface: c.textJa, reading: c.reading })))
  const rest = topic.chunks.length - shown.length
  return (
    <div className="mt-2">
      <ul className="flex flex-wrap gap-1.5">
        {shown.map((c, i) => (
          <li key={c.id} className="inline-flex min-w-0 max-w-full flex-col rounded-[10px] bg-surface2 px-2.5 py-1.5">
            <JaText as="span" text={c.textJa} state={OFF} ruby={layers[i]?.ruby ?? null} className="text-[16px] [overflow-wrap:anywhere]" />
            <HangulLine state={layers[i]?.hangul ?? OFF} size={12} as="span" />
            <span className="text-[12px] text-ink2">{c.meaningKo}</span>
          </li>
        ))}
      </ul>
      {rest > 0 ? <p className="mt-1 text-[12px] text-ink2">{CREATE.previewMore(rest)}</p> : null}
    </div>
  )
}

export function TopicRadioCard({ topic, name, checked, onSelect }: { topic: Topic; name: string; checked: boolean; onSelect: () => void }) {
  return (
    <li className="min-w-0">
      <label className="block min-w-0 cursor-pointer">
        <input type="radio" name={name} value={topic.id} checked={checked} onChange={onSelect} className="peer sr-only" />
        <span className="flex min-h-[72px] min-w-0 items-start gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-3 peer-checked:ring-2 peer-checked:ring-inset peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="min-w-0 text-[15px] font-semibold [overflow-wrap:anywhere]">
              {topic.title}
              {topic.titleJa ? (
                <span lang="ja" className="ml-1.5 text-[13px] font-normal text-ink2">
                  {topic.titleJa}
                </span>
              ) : null}
            </span>
            {topic.description ? <span className="mt-0.5 line-clamp-2 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{topic.description}</span> : null}
            <span className="mt-0.5 text-[12px] text-ink2">
              {topic.lessonCount > 0 ? (
                `끝낸 수업 ${topic.lessonCount}개${topic.lastLessonAt ? ` · ${formatMonthDay(kstDateKey(topic.lastLessonAt))}` : ''}`
              ) : (
                <span className="font-semibold text-good">{CREATE.never}</span>
              )}
              {` · 기본 표현 ${topic.chunks.length}개`}
            </span>
            {checked && topic.chunks.length ? <ChunkPreview topic={topic} /> : null}
          </span>
          <Badge tone="neutral">
            <LevelText level={topic.level} />
          </Badge>
        </span>
      </label>
    </li>
  )
}

export function RadioCard({ name, checked, onSelect, title, sub, extra }: { name: string; checked: boolean; onSelect: () => void; title: string; sub: string; extra?: string }) {
  return (
    <label className="block min-w-0 cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="peer sr-only" />
      <span className="flex min-h-14 min-w-0 flex-col rounded-[14px] border border-line bg-surface px-3.5 py-2.5 peer-checked:ring-2 peer-checked:ring-inset peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
        <span className="text-[15px] font-semibold">
          {title} <span className="text-[13px] font-normal text-ink2">{sub}</span>
        </span>
        {extra ? <span className="text-[12.5px] text-ink2 tabular-nums break-keep">{extra}</span> : null}
      </span>
    </label>
  )
}

export function CheckCard({
  checked,
  disabled,
  onToggle,
  title,
  body,
  rule,
  reasonId,
}: {
  checked: boolean
  disabled?: boolean
  onToggle: () => void
  title: string
  body: string
  rule: string
  reasonId?: string
}) {
  return (
    <label className={`block min-w-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} aria-describedby={disabled ? reasonId : undefined} className="peer sr-only" />
      <span
        className={`flex min-h-14 min-w-0 items-start gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3 peer-checked:ring-2 peer-checked:ring-inset peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          disabled ? 'bg-surface2' : ''
        }`}
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 grid h-[22px] w-[22px] flex-none place-items-center rounded-md text-[13px] font-bold ${checked ? 'bg-accent text-on-accent' : 'shadow-[inset_0_0_0_1.5px_var(--color-ink3)]'}`}
        >
          {checked ? '✓' : ''}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`text-[15px] font-semibold ${disabled ? 'text-ink2' : ''}`}>{title}</span>
          <span className="text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{body}</span>
          <span className="text-[12.5px] text-ink2 break-keep">{rule}</span>
        </span>
      </span>
    </label>
  )
}

export function ChoicePills({
  label,
  options,
  value,
  onChange,
  reasonId,
}: {
  label: string
  options: { value: ChallengeWordCount; disabled: boolean }[]
  value: ChallengeWordCount | null
  onChange: (v: ChallengeWordCount) => void
  reasonId: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const on = o.value === value && !o.disabled
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={o.disabled || undefined}
            aria-describedby={o.disabled ? reasonId : undefined}
            onClick={() => !o.disabled && onChange(o.value)}
            className={`relative h-9 min-w-0 rounded-full border text-[14px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] ${BLOCKED_FACE} ${
              on ? 'border-transparent bg-surface font-semibold text-ink shadow-[inset_0_0_0_2px_var(--color-accent)]' : o.disabled ? 'border-line bg-surface2 text-ink2' : 'border-line bg-surface text-ink'
            }`}
          >
            {o.value}장
          </button>
        )
      })}
    </div>
  )
}
