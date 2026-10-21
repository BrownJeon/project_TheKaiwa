'use client'

/**
 * ③ 조각 · 문장 끊어 보기(screens §37-3 · 데모 v1 `chunkBody('prop')`, 상태 `c-new`·`c-tap`·`c-last`·`c-review`·`c-old`) — 한 문장씩 조각 칸으로
 * 보고, 칸을 누르면 그 조각 소리·뜻(Q8 A). 마지막 문장까지 보거나(Q1 A) 모든 문장을 봤으면 [다음 단계]. 옛 수업(어느 줄에도 조각 없음)은 빈 상태(Q5 A).
 *  - 본 문장은 `progress.pieces.seen`(#61, 800ms 모아 보내기 — ① 들은 구간과 같은 큐). 다시 보기(끝낸 단계)에서는 쓰지 않는다(① 과 같음).
 *  - 문장을 옮기면 고른 조각·재생을 푼다. 사라지는 버튼에 초점이 남지 않게 마지막 문장 도착 땐 [다음 단계], 첫 문장 도착 땐 [다음 문장] 으로 옮긴다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAnnotations } from '@/components/common/japanese/annotations'
import { Btn } from '@/components/common/ui'
import type { LessonContent, LessonDto } from '@/types/lesson'
import { chunkMode } from './chunkLogic'
import { ChunkEmpty, ChunkSentenceCard, usablePieces } from './ChunkSentence'
import { U3 } from './lessonCopy'
import { LessonDisplayTools } from './parts'
import PieceCollect from './PieceCollect'
import type { UseLesson } from './useLesson'
import type { LessonPlayback } from './useLessonPlayback'

/** 처음 열 문장 — 안 본 첫 문장(없으면 0), 다시 보기면 0. */
export function firstChunkLine(n: number, seen: readonly number[], reviewing: boolean): number {
  if (reviewing || n <= 0) return 0
  for (let i = 0; i < n; i++) if (!seen.includes(i)) return i
  return 0
}

function SeenBar({ n, line, seen }: { n: number; line: number; seen: ReadonlySet<number> }) {
  return (
    <div aria-hidden="true" className="mt-1.5 grid grid-flow-col auto-cols-[minmax(0,1fr)] gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-[3px] ${i === line ? 'bg-accent' : seen.has(i) ? 'bg-good' : 'bg-surface2'}`} />
      ))}
    </div>
  )
}

export default function StageChunk({
  lesson,
  st,
  pb,
  reviewing,
  onToast,
  footer,
}: {
  lesson: LessonDto & { content: LessonContent }
  st: UseLesson
  pb: LessonPlayback
  reviewing: boolean
  onToast: (m: string) => void
  footer: React.ReactNode
}) {
  const c = lesson.content
  const n = c.dialogue.length
  // 옛 수업 = 어느 줄에도 `pieces` 키가 없음. 키가 null 인 줄이 있으면 새 수업(모든 줄 분해 실패 포함) — 줄마다 «나누지 못했어요»(§37-3-1).
  // `chunkMode`·`pieceCount` 는 둘 다 'none'·null 로 보므로(서버와 같은 규칙) 빈 상태 판정만 여기서 가른다.
  const oldLesson = chunkMode(c) === 'none' && !c.dialogue.some((d) => d.pieces === null)
  const [line, setLine] = useState(() => firstChunkLine(n, lesson.progress.pieces?.seen ?? [], reviewing))
  const [seen, setSeen] = useState<Set<number>>(() => new Set([...(lesson.progress.pieces?.seen ?? []).filter((x) => Number.isInteger(x) && x >= 0 && x < n), line]))
  const [sel, setSel] = useState<number | null>(null)
  const anns = useAnnotations(useMemo(() => c.dialogue.map((d) => d.ja), [c]))
  const footerRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const focusTo = useRef<'footer' | 'next' | null>(null)

  useEffect(() => {
    const to = focusTo.current
    focusTo.current = null
    if (to === 'footer') footerRef.current?.querySelector<HTMLElement>('button')?.focus()
    else if (to === 'next') navRef.current?.querySelector<HTMLElement>('[data-chunk-next]')?.focus()
  }, [line])

  if (oldLesson || n === 0) {
    return (
      <div>
        <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
          {U3.title}
        </h2>
        <ChunkEmpty />
        <div className="mt-3.5">{footer}</div>
      </div>
    )
  }

  const last = line >= n - 1
  const canNext = reviewing || last || seen.size >= n
  const d = c.dialogue[line]
  const lineIsNull = usablePieces(d) === null
  const textOnly = pb.textOnly

  const move = (to: number) => {
    if (to < 0 || to >= n || to === line) return
    pb.stop('HIDDEN')
    setSel(null)
    if (to === n - 1) focusTo.current = 'footer'
    else if (to === 0) focusTo.current = 'next'
    if (to > line && !seen.has(to)) {
      const next = new Set(seen).add(to)
      setSeen(next)
      if (!reviewing) {
        const arr = [...next].sort((a, b) => a - b)
        st.update((p) => ({ ...p, pieces: { seen: arr } }), ['pieces'])
      }
    }
    setLine(to)
  }

  return (
    <div>
      <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
        {U3.title}
      </h2>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{textOnly ? U3.descTextOnly : U3.desc}</p>
      <LessonDisplayTools keys={['fu', 'hg', 'tr']} onToast={onToast} />
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <b className="text-[14px] font-bold">{U3.counter(line + 1, n)}</b>
        <span className="text-[12px] text-ink2">{U3.seen(seen.size)}</span>
      </div>
      <SeenBar n={n} line={line} seen={seen} />
      <ChunkSentenceCard lineIdx={line} line={d} roleKo={c.rolesKo[d.speaker]} ann={anns[line]} sel={sel} onPick={setSel} pb={pb} textOnly={textOnly} />
      {n > 1 ? (
        <div ref={navRef} className="mt-2.5 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          {line > 0 ? (
            <Btn variant="ghost" onClick={() => move(line - 1)}>
              {U3.prev}
            </Btn>
          ) : (
            <span aria-hidden="true" />
          )}
          {!last ? (
            <Btn data-chunk-next onClick={() => move(line + 1)}>
              {U3.next}
            </Btn>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>
      ) : null}
      {!lineIsNull ? <p className="mt-2.5 text-[12px] text-ink2 break-keep">{U3.aiNote}</p> : null}
      {canNext ? (
        <div ref={footerRef} className="mt-3.5">
          {footer}
        </div>
      ) : (
        <p className="mt-2.5 text-center text-[12.5px] text-ink2 break-keep">{U3.gate(seen.size, n)}</p>
      )}
      <PieceCollect content={c} pb={pb} textOnly={textOnly} />
    </div>
  )
}
