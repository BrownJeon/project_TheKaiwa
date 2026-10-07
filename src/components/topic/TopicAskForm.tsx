'use client'

/**
 * S3 주제 한 줄 묻기(screens.md §16-2 S3 — 데모 v2 `scrCreate`). 만드는 중(`locked`)에는 칸을 읽기 전용·버튼 `aria-busy` 로 두어 더블 탭이 요청을 하나 더 만들지 않는다.
 * 짧거나 긴 글에서도 버튼을 누를 수 있다(눌렀을 때 칸 아래 이유) — 겉모양만 흐리게. 하루 한도(`blockedBy`)면 이유 상자와 연결해 막는다.
 */
import Segmented from '@/components/common/Segmented'
import { Btn, Field } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import { levelOptions } from '@/components/scenario/DraftEditor'
import { DRAFT_LEVELS, oneLine, type DraftLevel } from '@/components/scenario/logic'
import { DRAFT } from '@/components/scenario/scenarioCopy'
import { TOPIC_ASK_TITLE_MAX, TOPIC_ASK_TITLE_MIN } from './failure'
import type { TopicAsk } from './logic'
import { CREATE } from './topicCopy'

export const ASK_INPUT_ID = 'tp-ask'

export default function TopicAskForm({
  ask,
  onAsk,
  error,
  profileLevel,
  locked,
  blockedBy,
  onSubmit,
  inputRef,
}: {
  ask: TopicAsk
  onAsk: (patch: Partial<TopicAsk>) => void
  error: string | null
  profileLevel: DraftLevel
  locked: boolean
  /** 막는 이유 상자 id(하루 한도). */
  blockedBy: string | null
  onSubmit: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const n = cpLength(oneLine(ask.title))
  const short = n < TOPIC_ASK_TITLE_MIN
  const over = n > TOPIC_ASK_TITLE_MAX
  const dim = short || over || !!blockedBy
  const bad = !!error || over
  return (
    <section className="flex min-w-0 flex-col gap-[18px]" aria-busy={locked || undefined}>
      <div>
        <h2 className="text-[16px] font-semibold">{CREATE.ask}</h2>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{CREATE.askSub}</p>
      </div>
      <Field label={CREATE.field} htmlFor={ASK_INPUT_ID}>
        <input
          id={ASK_INPUT_ID}
          ref={inputRef}
          type="text"
          value={ask.title}
          readOnly={locked}
          placeholder={CREATE.placeholder}
          aria-invalid={bad || undefined}
          aria-describedby={`${ASK_INPUT_ID}-count${error ? ` ${ASK_INPUT_ID}-err` : ''}`}
          onChange={(e) => onAsk({ title: e.target.value })}
          className={`h-12 w-full min-w-0 rounded-xl border bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 ${bad ? 'border-bad' : 'border-line'}`}
        />
        <p id={`${ASK_INPUT_ID}-count`} className={`text-right text-[12px] tabular-nums ${over ? 'text-bad' : 'text-ink2'}`}>
          {n}/{TOPIC_ASK_TITLE_MAX}
        </p>
        {error ? (
          <p id={`${ASK_INPUT_ID}-err`} className="text-[12px] text-bad break-keep">
            {error}
          </p>
        ) : null}
      </Field>
      <div>
        <p className="text-[12px] text-ink2">{DRAFT.examplesLabel}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {CREATE.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              aria-disabled={locked || undefined}
              onClick={() => !locked && onAsk({ title: ex })}
              className="relative h-9 rounded-full border border-line bg-surface px-3.5 text-[13.5px] text-ink before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink2">{CREATE.level}</span>
        <Segmented<DraftLevel>
          ariaLabel={CREATE.level}
          options={levelOptions(ask.level).filter((o): o is { value: DraftLevel; label: string } => (DRAFT_LEVELS as readonly string[]).includes(o.value))}
          value={ask.level}
          onChange={(v) => !locked && onAsk({ level: v })}
        />
        <p className="text-[12px] text-ink2">{CREATE.levelNote(profileLevel)}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Btn
          className={`w-full ${dim && !locked ? 'opacity-40' : ''}`}
          aria-busy={locked || undefined}
          aria-disabled={dim || locked || undefined}
          aria-describedby={blockedBy ?? undefined}
          onClick={() => !locked && !blockedBy && onSubmit()}
        >
          {CREATE.submit}
        </Btn>
        <p className="text-center text-[12px] text-ink2 break-keep">{CREATE.privacy}</p>
      </div>
    </section>
  )
}
