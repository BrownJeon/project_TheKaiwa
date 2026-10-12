'use client'

/**
 * 「근거로 본 내 기록 n」 + 카드 3장 + [n개 더 보기]/[접기](task-064 §25-5 D, D3 A). 순서는 서버 순서 그대로, 펼침은 답마다 화면 상태.
 * 이동 주소는 `askSourceHref` 한 곳 — null 이면 누를 수 없는 카드(div, 초점 안 감). ← 머리가 있는 집중 화면(수업·평가·역할극)으로 갈 때만
 * 「질문으로」 돌아오기 기록을 남긴다(§25-8 B).
 */
import Link from 'next/link'
import { useId, useState } from 'react'
import type { AskSource } from '@/types/ask'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { rememberAskReturn } from '@/components/shell/askReturn'
import { formatMonthDay } from '@/components/vocab/format'
import { ASK_COPY } from './askCopy'
import { askSourceHref, isAskFocusTarget } from './logic'

const FIRST = 3
const CARD = 'grid min-h-14 min-w-0 grid-cols-[32px_minmax(0,1fr)_14px] items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-ink'

/** 근거 카드를 눌러 집중 화면으로 갈 때 「질문으로」 돌아오기 기록(주소의 경로 부분이 원본 경로). */
function rememberIfFocusTarget(chatId: string, s: AskSource, href: string) {
  if (!isAskFocusTarget(s.type)) return
  rememberAskReturn(`/ask/${encodeURIComponent(chatId)}`, href.split('?')[0])
}

/** 카드 머리 줄 「{유형} · {날짜}」 — 모르는 유형(`type:null`)은 머리 줄 없이 라벨만(Leader 2026-10-12). */
export function sourceMetaLine(s: Pick<AskSource, 'type' | 'date'>): string | null {
  if (s.type === null) return null
  const day = formatMonthDay(s.date)
  return day ? `${ASK_COPY.sourceType[s.type]} · ${day}` : ASK_COPY.sourceType[s.type]
}

/**
 * 근거 카드. 이동할 곳이 있으면 링크(이름 = 카드 글 「교정 · 10월 10일 …」), 없으면(집계 항목 `id:null` 의 기본 화면 없는 유형·모르는 유형·
 * 형식 이상) 같은 칸·같은 글의 정적 `div` — 링크·버튼 역할도 초점도 › 도 없다(§25-9).
 */
function SourceCard({ chatId, s }: { chatId: string; s: AskSource }) {
  const href = askSourceHref(s)
  const meta = sourceMetaLine(s)
  const body = (
    <>
      <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-[13px] font-bold text-ink2">
        {s.type ? ASK_COPY.sourceGlyph[s.type] : null}
      </span>
      <span className="flex min-w-0 flex-col">
        {meta ? <span className="text-[12px] text-ink2">{meta}</span> : null}
        <span className="line-clamp-2 text-[14px] leading-[1.45] [overflow-wrap:anywhere]">
          <JaRuns text={s.label} />
        </span>
      </span>
      {href ? (
        <span aria-hidden="true" className="text-center text-[16px] text-ink2">
          ›
        </span>
      ) : (
        <span aria-hidden="true" />
      )}
    </>
  )
  return (
    <li>
      {href ? (
        <Link href={href} onClick={() => rememberIfFocusTarget(chatId, s, href)} className={CARD}>
          {body}
        </Link>
      ) : (
        <div className={CARD}>{body}</div>
      )}
    </li>
  )
}

export default function SourceList({ chatId, sources }: { chatId: string; sources: readonly AskSource[] }) {
  const [open, setOpen] = useState(false)
  const hid = useId()
  const n = sources.length
  if (n === 0) return null
  const shown = open ? sources : sources.slice(0, FIRST)
  return (
    <section aria-labelledby={hid} className="flex min-w-0 flex-col gap-1.5">
      <h4 id={hid} className="text-[12.5px] font-semibold text-ink2">
        {ASK_COPY.sourcesHead} <b className="text-ink">{n.toLocaleString('ko-KR')}</b>
      </h4>
      <ul className="flex flex-col gap-1.5">
        {shown.map((s, i) => (
          <SourceCard key={`${s.type}_${s.id}_${i}`} chatId={chatId} s={s} />
        ))}
      </ul>
      {n > FIRST ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-11 items-center gap-1 self-start pr-1 text-[13.5px] font-semibold text-ink"
        >
          {open ? ASK_COPY.sourcesLess : ASK_COPY.sourcesMore(n - FIRST)}
          <span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
        </button>
      ) : null}
    </section>
  )
}
