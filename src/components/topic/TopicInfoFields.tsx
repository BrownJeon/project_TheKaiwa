'use client'

/**
 * 「주제 정보」 칸(screens.md §16-2 S4 — 이름 /20 · 일본어 이름 /20 · 수준 · 설명 /120). S4 검토와 S7 주제 고치기(T5-4)가 함께 쓴다.
 * 글자 수를 넘겨도 칸이 자르지 않는다(붙여 넣은 글이 몰래 잘리지 않게) — 숫자가 빨개지고 저장 검사가 짚는다. 칸 id 는 `topicProblemDomId` 와 같다(첫 문제 초점).
 */
import Segmented from '@/components/common/Segmented'
import { Field } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import { levelOptions } from '@/components/scenario/DraftEditor'
import { oneLine } from '@/components/scenario/logic'
import type { JlptLevel } from '@/types/lesson'
import { TOPIC_SAVE_LIMITS as L } from '@/types/topicWrite'
import { topicProblemDomId, type EditableTopicDraft } from './logic'
import { REVIEW } from './topicCopy'

type Info = Pick<EditableTopicDraft, 'title' | 'titleJa' | 'level' | 'description'>

export default function TopicInfoFields({
  value,
  onChange,
  errors,
  disabled = false,
  levelSlot,
}: {
  value: Info
  onChange: (patch: Partial<Info>) => void
  errors: Record<string, string>
  disabled?: boolean
  /** S7 수준 바꿈 상자(D4-A) 자리 — 수준 칸 바로 아래. */
  levelSlot?: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5" aria-labelledby="tp-info-h">
      <h2 id="tp-info-h" className="text-[15px] font-semibold">
        {REVIEW.info}
      </h2>
      <TextField fkey="title" label={REVIEW.fTitle} value={value.title} max={L.titleMax} error={errors.title} disabled={disabled} onChange={(v) => onChange({ title: v })} />
      <TextField fkey="titleJa" lang="ja" label={REVIEW.fTitleJa} value={value.titleJa} max={L.titleJaMax} error={errors.titleJa} disabled={disabled} onChange={(v) => onChange({ titleJa: v })} />
      <div id={topicProblemDomId('level')} tabIndex={-1} className="flex min-w-0 flex-col gap-1.5 outline-none">
        <span className="text-[12.5px] font-medium text-ink2">{REVIEW.fLevel}</span>
        <Segmented<JlptLevel> ariaLabel={REVIEW.fLevel} options={levelOptions(value.level)} value={value.level} onChange={(v) => !disabled && onChange({ level: v })} />
        {errors.level ? <p className="text-[12px] text-bad break-keep">{errors.level}</p> : null}
      </div>
      {levelSlot ?? null}
      <TextField fkey="description" multiline label={REVIEW.fDesc} value={value.description} max={L.descriptionMax} error={errors.description} disabled={disabled} onChange={(v) => onChange({ description: v })} />
    </section>
  )
}

function TextField({
  fkey,
  label,
  value,
  max,
  error,
  disabled,
  onChange,
  lang,
  multiline = false,
}: {
  fkey: 'title' | 'titleJa' | 'description'
  label: string
  value: string
  max: number
  error: string | undefined
  disabled: boolean
  onChange: (v: string) => void
  lang?: string
  multiline?: boolean
}) {
  const id = topicProblemDomId(fkey)
  const n = cpLength(oneLine(value))
  const over = n > max
  const bad = !!error || over
  const describedBy = `${id}-count${error ? ` ${id}-err` : ''}`
  const cls = `w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 ${bad ? 'border-bad' : 'border-line'}`
  return (
    <Field label={label} htmlFor={id}>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          readOnly={disabled}
          aria-invalid={bad || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} resize-none py-2.5 leading-snug`}
        />
      ) : (
        <input
          id={id}
          type="text"
          lang={lang}
          value={value}
          readOnly={disabled}
          aria-invalid={bad || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} h-12`}
        />
      )}
      <p id={`${id}-count`} className={`text-right text-[12px] tabular-nums ${over ? 'text-bad' : 'text-ink2'}`}>
        {n}/{max}
      </p>
      {error ? (
        <p id={`${id}-err`} className="text-[12px] text-bad break-keep">
          {error}
        </p>
      ) : null}
    </Field>
  )
}
