'use client'

/**
 * 「오늘의 조각 모아 보기」 접힘 상자(screens §37-4-3 · 데모 v1 `c-collect`, Q3 A) — 종류 순서(`PIECE_TYPE_ORDER`)대로 묶고 같은 조각은 한 번.
 * 소리 있음이면 칩 = 그 조각이 처음 나온 자리의 piece 재생, 소리 없음이면 버튼 없이 같은 모양 글. 펼침 상태는 화면 메모리만(저장 안 함).
 * 데모의 «데모 표시 — 나중» 상자(단어장 넣기·바꿔 말하기)는 넣지 않는다(L3).
 */
import { useState } from 'react'
import type { LessonContent, PieceType } from '@/types/lesson'
import { collectPieces, pieceKey, type CollectedPiece } from './chunkLogic'
import { PIECE_TONE } from './ChunkSentence'
import { PIECE_TYPE_LABEL, PIECE_TYPE_ORDER, U3 } from './lessonCopy'
import { PlayIcon, Spinner, StopIcon } from './parts'
import type { LessonPlayback } from './useLessonPlayback'

const BODY_ID = 'piece-collect-body'

/** 펼친 상자 안 — 있는 종류만, 종류 순서대로(시험 대상). */
export function PieceCollectList({ items, pb, textOnly }: { items: readonly CollectedPiece[]; pb: LessonPlayback; textOnly: boolean }) {
  const groups = PIECE_TYPE_ORDER.map((t) => ({ t, list: items.filter((x) => x.type === t) })).filter((g) => g.list.length > 0)
  const toggle = (c: CollectedPiece) => {
    const key = pieceKey(c.line, c.j)
    if (pb.active(key)) return pb.stop()
    pb.playLines(key, [{ kind: 'piece', idx: c.line, sub: c.j, pace: 'normal' }])
  }
  return (
    <>
      {groups.map(({ t, list }) => (
        <div key={t} data-piece-group={t}>
          <h3 className="mt-3 flex items-center gap-1.5 text-[13px] font-bold">
            <i aria-hidden="true" className={`h-1 w-4 rounded-sm ${PIECE_TONE[t as PieceType].band}`} />
            {U3.group(PIECE_TYPE_LABEL[t].full, list.length)}
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {list.map((c) => {
              const key = pieceKey(c.line, c.j)
              const on = !textOnly && pb.active(key)
              const loading = on && pb.loading(key)
              const body = (
                <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span lang="ja" className="text-[16px] [overflow-wrap:anywhere]">
                    {c.ja}
                  </span>
                  <span className="text-[12px] text-ink2">{c.ko}</span>
                </span>
              )
              if (textOnly)
                return (
                  <li key={key} className="inline-flex min-h-11 max-w-full min-w-0 items-center rounded-[10px] bg-surface2 px-3 py-1">
                    {body}
                  </li>
                )
              return (
                <li key={key} className="max-w-full min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className={`inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-[10px] py-1 pl-1.5 pr-3 text-left text-ink ${on ? 'bg-accent-soft ring-[1.5px] ring-accent ring-inset' : 'bg-surface2'}`}
                  >
                    <span aria-hidden="true" className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full ${on ? 'bg-ink text-surface' : 'bg-surface'}`}>
                      {loading ? <Spinner /> : on ? <StopIcon /> : <PlayIcon size={12} />}
                    </span>
                    {body}
                    <span className="sr-only">{U3.collectPlaySr}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}

export default function PieceCollect({ content, pb, textOnly }: { content: LessonContent; pb: LessonPlayback; textOnly: boolean }) {
  const [open, setOpen] = useState(false)
  const items = collectPieces(content)
  if (items.length === 0) return null
  return (
    <section className="mt-3.5 min-w-0 rounded-[14px] border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={BODY_ID}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[52px] w-full items-center gap-2 px-3.5 text-left text-[15px] font-semibold"
      >
        <span className="min-w-0 flex-1">
          {U3.collect}
          <small className="text-[12px] font-normal text-ink2">{U3.collectCount(items.length)}</small>
        </span>
        <i aria-hidden="true" className={`text-[18px] not-italic text-ink3 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </i>
      </button>
      {open ? (
        <div id={BODY_ID} className="px-3.5 pb-3.5 [&>div:first-child>h3]:mt-0.5">
          <PieceCollectList items={items} pb={pb} textOnly={textOnly} />
        </div>
      ) : null}
    </section>
  )
}
