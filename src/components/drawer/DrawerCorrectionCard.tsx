'use client'

/**
 * 채택 교정 모음의 요약 카드(task-055 D2 C, screens.md §21-3 C). 카드 윗부분 전체가 펼침 버튼이고, ✕ 내 문장 / ✓ 고친 문장은 늘 보인다.
 *
 * - **`original` 은 저장 글자 그대로** — trim·정규화·자르기 없이 그리고, 지운·넣은 글자 강조는 `diffCodepoints` + `changedRanges` 로 `<span>` 을
 *   나누기만 한다(조각을 이으면 원문과 같음 — chat/diff 시험). `corrected`·`explanation` 도 고치지 않는다.
 * - 버튼 안에는 구문 내용만 둘 수 있어 줄마다 **블록 `span`** 이다(`JaText as="span"`·`HangulLine as="span"`). 한글 줄은 반드시 `HangulLine`
 *   (끔이면 null) — 손으로 만든 span 을 CSS 로 숨기지 않는다(데모에서 고친 결함 ①②, §21-11 ⑧).
 * - 시험 문법 줄·[원래 대화 보기 ›]·[단어 ○○ 보기 ›] 는 요약 버튼 **밖**(중첩 인터랙티브 금지).
 * - 펼침 상태는 화면이 들고 있다(`open`) — 조건이 바뀌면 화면이 비운다.
 */
import Link from 'next/link'
import { diffCodepoints } from '@/components/chat/diff'
import ExtraNoteLine from '@/components/chat/ExtraNoteLine'
import { CHUNK_LABEL, ERROR_TYPE_LABEL } from '@/components/chat/labels'
import { kstDateKey } from '@/components/common/format'
import { changedRanges, useAnnotations } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Badge } from '@/components/common/ui'
import { formatMonthDay } from '@/components/vocab/format'
import type { DrawerCorrectionItem } from '@/types/chat'
import { CORRECTIONS_COPY as C, kindLabel } from './correctionsCopy'
import { sourceHrefOf } from './logic'

// chat/CorrectionCard 의 강조와 같은 문자열(그 파일은 내보내지 않는다 — drawer/__tests__/correctionCard.test.ts 가 두 소스를 묶어 둔다).
export const REMOVED = 'rounded-sm bg-bad-soft text-bad line-through decoration-1'
export const ADDED = 'rounded-sm bg-good-soft text-good underline decoration-2 underline-offset-4'
export const LINK_BTN =
  'inline-flex min-h-11 min-w-0 max-w-full items-center rounded-xl border border-line bg-surface px-3 text-left text-[14px] font-semibold text-accent'

/** 화면이 초점을 옮길 때 쓰는 id — 요약 버튼·[원래 대화 보기 ›]. */
export const cardDomId = (id: string) => `dcr_${id}`
export const cardButtonId = (id: string) => `dcr_${id}_btn`
export const cardGoId = (id: string) => `dcr_${id}_go`

/** 채택한 날 「M월 D일」(KST) — 값이 없거나 읽을 수 없으면 ''(칸을 그리지 않는다). */
export function acceptedDay(resolvedAt: string | null | undefined): string {
  if (!resolvedAt) return ''
  const key = kstDateKey(resolvedAt)
  return key ? formatMonthDay(key) : ''
}

export default function DrawerCorrectionCard({
  item: c,
  open,
  onToggle,
  onLeave,
  onOpenWord,
}: {
  item: DrawerCorrectionItem
  open: boolean
  onToggle: (id: string) => void
  /** [원래 대화 보기 ›] 를 누른 직전(이동은 Link 가 한다) — 돌아오기 기록(§21-6 B). */
  onLeave: (item: DrawerCorrectionItem) => void
  onOpenWord: (wordId: string, fromId: string) => void
}) {
  const diff = diffCodepoints(c.original, c.corrected)
  const [annOriginal, annCorrected] = useAnnotations([c.original, c.corrected])
  const chunk = c.chunkType ? CHUNK_LABEL[c.chunkType] : null
  const day = acceptedDay(c.resolvedAt)
  const kind = kindLabel(c.chat.kind)
  const sourceHref = sourceHrefOf(c)
  const word = c.savedWord
  const boxId = `${cardDomId(c.id)}_x`
  const headId = `${cardDomId(c.id)}_head`

  return (
    <li id={cardDomId(c.id)} className="min-w-0 scroll-mt-16 rounded-[14px] border border-line bg-surface p-3.5">
      <button
        type="button"
        id={cardButtonId(c.id)}
        aria-expanded={open}
        aria-controls={boxId}
        onClick={() => onToggle(c.id)}
        className="block w-full min-w-0 text-left"
      >
        <span id={headId} className="flex min-w-0 items-center gap-1.5">
          <Badge>{ERROR_TYPE_LABEL[c.errorType] ?? '기타'}</Badge>
          {c.severity === 'MAJOR' ? <Badge tone="bad">{C.major}</Badge> : null}
          {chunk ? <span className="min-w-0 truncate text-[12px] text-ink2">{chunk}</span> : null}
          {day ? (
            <span className="ml-auto flex-none text-[12px] tabular-nums text-ink2">
              <span className="sr-only">{C.acceptedOnSr}</span>
              {day}
            </span>
          ) : null}
          <span aria-hidden="true" className={`${day ? 'ml-0.5' : 'ml-auto'} w-4 flex-none text-center text-[12px] text-ink2`}>
            {open ? '▴' : '▾'}
          </span>
        </span>
        <span className="mt-2 grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-baseline gap-x-1.5">
          <span aria-hidden="true" className="text-center text-[14px] font-bold text-bad">
            ✕
          </span>
          <span className="min-w-0">
            <span className="sr-only">{C.mineSr}</span>
            <JaText
              as="span"
              text={c.original}
              state={annOriginal}
              ranges={diff ? changedRanges(diff.a, REMOVED) : undefined}
              className="block whitespace-pre-wrap text-[16px] leading-[1.7] text-ink2 [overflow-wrap:anywhere]"
            />
            <HangulLine as="span" state={annOriginal} />
          </span>
        </span>
        <span className="mt-2 grid min-w-0 grid-cols-[16px_minmax(0,1fr)] items-baseline gap-x-1.5">
          <span aria-hidden="true" className="text-center text-[14px] font-bold text-good">
            ✓
          </span>
          <span className="min-w-0">
            <span className="sr-only">{C.fixSr}</span>
            <JaText
              as="span"
              text={c.corrected}
              state={annCorrected}
              ranges={diff ? changedRanges(diff.b, ADDED) : undefined}
              className="block whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]"
            />
            <HangulLine as="span" state={annCorrected} />
          </span>
        </span>
        {c.explanation ? (
          <span className={`mt-2.5 block text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere] ${open ? '' : 'line-clamp-2'}`}>
            {c.explanation}
          </span>
        ) : null}
        <span className="mt-1.5 block min-w-0 truncate text-[12.5px] text-ink2">
          <b className="font-semibold text-ink">{kind}</b> · {c.chat.title}
        </span>
      </button>
      <div id={boxId} hidden={!open} className="mt-0.5">
        <ExtraNoteLine correctionId={c.id} text={c.extraNoteKo} describedBy={headId} />
        {sourceHref || word ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {sourceHref ? (
              <Link id={cardGoId(c.id)} href={sourceHref} onClick={() => onLeave(c)} aria-label={C.goChatAria(kind, c.chat.title)} className={LINK_BTN}>
                {C.goChat}
              </Link>
            ) : null}
            {word ? (
              <button type="button" onClick={() => onOpenWord(word.id, c.id)} className={LINK_BTN}>
                {C.goWordLead}
                <span lang="ja" className="mx-1 min-w-0 truncate">
                  {word.surface}
                </span>
                {C.goWordTail}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}
