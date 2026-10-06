'use client'

/**
 * 선생님 근거 상자(screens §14-2 A "TeacherWhy" · 데모 `#rv-due`·`#rv-due-more`·`#rv-due-fb`) — 홈 복습 카드·복습 종료 카드 공용.
 *  - TUTOR: 아바타 + 근거 2줄 말줄임 → [자세히] 전체 + 항목 칩(최대 7 + "외 k개") → [접기]
 *  - FALLBACK: ⓘ + 고정 문구 두 줄. [자세히]·칩 없음, 서버 근거 문장은 쓰지 않는다.
 * 근거 문장은 텍스트로만 그린다(`dangerouslySetInnerHTML` 금지) — 「…」 조각만 `lang="ja"`.
 */
import { useId, useState } from 'react'
import { useAnnotations } from '@/components/common/japanese/annotations'
import { JaQuoted } from '@/components/common/japanese/JaQuoted'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import { FocusDot } from './FocusBadge'
import { RV_HOME } from './reviewCopy'

export interface ReviewChip {
  textJa: string
  focus: boolean
}

export function ReviewChips({ chips, more = 0, onSurface = false }: { chips: readonly ReviewChip[]; more?: number; onSurface?: boolean }) {
  const bg = onSurface ? 'bg-surface2' : 'bg-surface'
  const anns = useAnnotations(chips.map((c) => c.textJa))
  return (
    <ul aria-label={RV_HOME.chipsAria} className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
      {chips.map((c, i) => (
        // 수업 표현 칩과 같은 규칙(task-033 R1-A) — 두 층을 꺼도 말줄임 없이 칩 안에서 줄바꿈한다.
        <li key={i} className={`inline-flex min-h-8 max-w-full min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-[10px] px-2.5 py-1 text-[15px] ${bg}`}>
          {c.focus ? (
            <span className="flex self-center">
              <FocusDot srLabel={RV_HOME.focusSr} />
            </span>
          ) : null}
          <JaText as="span" text={c.textJa} state={anns[i]} leading={2.1} className="min-w-0 [overflow-wrap:anywhere]" />
          <HangulLine state={anns[i]} size={12} inline />
        </li>
      ))}
      {more > 0 ? <li className={`inline-flex h-8 items-center rounded-[10px] px-2.5 text-[12.5px] text-ink2 ${bg}`}>{RV_HOME.chipsMore(more)}</li> : null}
    </ul>
  )
}

export default function TeacherWhy({
  mode,
  text,
  who,
  at,
  chips,
  more = 0,
  surface = false,
}: {
  mode: 'TUTOR' | 'FALLBACK'
  text: string | null
  /** 선생님 이름(프로필, 기본 "선생님"). */
  who: string
  /** 판단 시각 라벨(`decidedAtLabel`) — 없으면 메타줄에서 뺀다. */
  at: string | null
  chips?: readonly ReviewChip[]
  more?: number
  /** 다음 복습 상자(`accent-soft`) 안이면 바탕을 `surface` 로. */
  surface?: boolean
}) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const box = `mt-2.5 grid grid-cols-[28px_minmax(0,1fr)] items-start gap-2 rounded-xl px-3 py-2.5 ${surface ? 'bg-surface' : 'bg-surface2'}`
  const body = mode === 'TUTOR' ? text?.trim() ?? '' : ''

  if (mode === 'FALLBACK' || !body) {
    return (
      <div className={box}>
        <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-full text-[14px] font-bold text-ink2 italic ${surface ? 'bg-surface2' : 'bg-surface'}`}>
          i
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] leading-[1.5] text-ink break-keep">{RV_HOME.fallbackWhy}</p>
          <p className="mt-1 text-[12px] text-ink2 break-keep">{RV_HOME.fallbackNote}</p>
        </div>
      </div>
    )
  }

  const meta = at ? `${RV_HOME.judgedBy(who)} · ${at}` : RV_HOME.judgedBy(who)
  const list = chips ?? []
  return (
    <div className={box}>
      <span className="mt-px">
        <TeacherAvatar name={who} />
      </span>
      <div className="min-w-0">
        <p id={bodyId} className={`text-[13.5px] leading-[1.5] text-ink break-keep [overflow-wrap:anywhere] ${open ? '' : 'line-clamp-2'}`}>
          <span className="sr-only">{RV_HOME.whySr}</span>
          <JaQuoted text={body} />
        </p>
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="min-w-0 text-[12px] text-ink2">{meta}</span>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
            className="relative inline-flex min-h-8 items-center text-[12.5px] font-semibold text-ink underline underline-offset-[3px] before:absolute before:-inset-x-2 before:-inset-y-1.5 before:content-['']"
          >
            {open ? RV_HOME.less : RV_HOME.more}
          </button>
        </div>
        {open && list.length > 0 ? (
          <>
            <p className="mt-2 text-[12px] text-ink2">{RV_HOME.chipsTitle(list.length + Math.max(0, more))}</p>
            <ReviewChips chips={list} more={more} />
          </>
        ) : null}
      </div>
    </div>
  )
}
