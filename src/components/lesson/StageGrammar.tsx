'use client'

/**
 * ② 문법(screens §12-2 G · 데모 v2 `#l2` · task-025 데모 v1 `#l2`·`#l2-playing`·`#l2-fail`·`#l2-textonly`) — 오늘의 표현(조각, 칩을 누르면
 * #62c `chunk` 소리 — 보통 속도 한 번, 기록 없음) + 문형 카드(예문 듣기 #62c `grammar`, 보통 속도). 자막만이면 표현은 글자 칩으로 돌아간다.
 */
import { useMemo } from 'react'
import { useAnnotations } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Card } from '@/components/common/ui'
import type { LessonContent } from '@/types/lesson'
import { U2 } from './lessonCopy'
import { exprKey, playExpr } from './logic'
import { ExprChip, ExprPlayChip, LessonDisplayTools, PlayButton } from './parts'
import { FocusBadge } from './review/FocusBadge'
import { RV_LESSON } from './review/reviewCopy'
import type { LessonPlayback } from './useLessonPlayback'

export default function StageGrammar({
  content,
  pb,
  onToast,
  footer,
  variant = 'NEW',
  focusIds,
}: {
  content: LessonContent
  pb: LessonPlayback
  onToast: (m: string) => void
  footer: React.ReactNode
  /** 복습 수업(task-010b) — 설명·표현 카드 문구만 바뀐다. 기본 NEW 면 지금과 같다. */
  variant?: 'NEW' | 'REVIEW'
  /** 복습의 FOCUS 항목 id — 표현 칩에 집중 뱃지(문형 카드에는 없다, §14-11 ⑤). */
  focusIds?: ReadonlySet<string>
}) {
  const review = variant === 'REVIEW'
  // 표현 칩·문형·예문을 단계 마운트 때 한 묶음으로(task-026 §15-4-7). 칩 n개 → 문형 n개 → 예문 n개 순서.
  const nC = content.chunks.length
  const nG = content.grammar.length
  const anns = useAnnotations(
    useMemo(() => [...content.chunks.map((c) => c.textJa), ...content.grammar.map((g) => g.pattern), ...content.grammar.map((g) => g.exampleJa)], [content]),
  )
  return (
    <div>
      <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
        {U2.title}
      </h2>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{review ? RV_LESSON.grammarIntro(content.grammar.length) : U2.desc(content.grammar.length)}</p>
      {/* 예문 번역이 늘 보여 [번역] 은 두지 않는다(MOV ④). */}
      <LessonDisplayTools keys={['fu', 'hg']} onToast={onToast} />
      {pb.textOnly ? (
        <p role="status" className="mt-2.5 rounded-xl bg-surface2 px-3.5 py-2.5 text-[13px] break-keep">
          {U2.textOnly}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-col gap-2.5">
        <Card>
          <h3 className="text-[15px] font-semibold">{review ? RV_LESSON.exprTitle(content.chunks.length) : U2.exprTitle(content.chunks.length)}</h3>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{review ? (pb.textOnly ? RV_LESSON.exprNoteNoAudio : RV_LESSON.exprNote) : pb.textOnly ? U2.exprDesc : U2.exprDescPlay}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {content.chunks.map((c, i) => {
              const badge = focusIds?.has(c.id) ? (
                <FocusBadge small>{RV_LESSON.focus}</FocusBadge>
              ) : c.isNew ? <span className="inline-flex h-5 items-center rounded-md bg-surface px-1.5 text-[11px] font-semibold text-ink2">{U2.newExpr}</span> : undefined
              if (pb.textOnly) return <ExprChip key={c.id} ja={c.textJa} ko={c.meaningKo} badge={badge} ann={anns[i]} />
              const key = exprKey(i)
              const on = pb.active(key)
              return (
                <ExprPlayChip
                  key={c.id}
                  ann={anns[i]}
                  ja={c.textJa}
                  ko={c.meaningKo}
                  badge={badge}
                  state={!on ? 'idle' : pb.loading(key) ? 'loading' : 'playing'}
                  onClick={() => (on ? pb.stop() : playExpr(pb, i))}
                />
              )
            })}
          </ul>
        </Card>
        {content.grammar.map((g, i) => {
          const key = `g:${i}`
          const playing = pb.active(key)
          return (
            <Card key={g.id}>
              <p className="text-[12px] text-ink2">{U2.pattern(i + 1)}</p>
              <h3 className="mt-0.5 text-[20px] font-bold [overflow-wrap:anywhere]">
                <JaText as="span" text={g.pattern} state={anns[nC + i]} />
              </h3>
              <HangulLine state={anns[nC + i]} size={13} />
              <p className="mt-1 text-[14px] break-keep">{g.explanationKo}</p>
              <div className="mt-2.5 border-t border-line pt-1">
                <div className={`-mx-2 flex items-center gap-2 rounded-[10px] px-2 py-2.5 ${playing ? 'bg-accent-soft' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-ink2">{U2.example}</p>
                    <JaText text={g.exampleJa} state={anns[nC + nG + i]} className="text-[17px] [overflow-wrap:anywhere]" />
                    <HangulLine state={anns[nC + nG + i]} size={13} />
                    <p className="text-[13px] text-ink2 break-keep">{g.exampleKo}</p>
                  </div>
                  {!pb.textOnly ? (
                    <PlayButton playing={playing} onClick={() => (playing ? pb.stop() : pb.playLines(key, [{ kind: 'grammar', idx: i, pace: 'normal' }]))} />
                  ) : null}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      <div className="mt-[18px]">{footer}</div>
    </div>
  )
}
