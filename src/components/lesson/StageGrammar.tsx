'use client'

/**
 * ② 문법(screens §12-2 G · 데모 v2 `#l2`) — 오늘의 표현(조각) + 문형 카드(예문 듣기 #62c `grammar`, 보통 속도).
 */
import { Card } from '@/components/common/ui'
import type { LessonContent } from '@/types/lesson'
import { U2 } from './lessonCopy'
import { ExprChip, PlayButton } from './parts'
import type { LessonPlayback } from './useLessonPlayback'

export default function StageGrammar({ content, pb, reading, footer }: { content: LessonContent; pb: LessonPlayback; reading: boolean; footer: React.ReactNode }) {
  return (
    <div>
      <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
        {U2.title}
      </h2>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{U2.desc(content.grammar.length)}</p>
      {pb.textOnly ? (
        <p role="status" className="mt-2.5 rounded-xl bg-surface2 px-3.5 py-2.5 text-[13px] break-keep">
          {U2.textOnly}
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-col gap-2.5">
        <Card>
          <h3 className="text-[15px] font-semibold">{U2.exprTitle(content.chunks.length)}</h3>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{U2.exprDesc}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {content.chunks.map((c) => (
              <ExprChip
                key={c.id}
                ja={c.textJa}
                ko={c.meaningKo}
                badge={c.isNew ? <span className="inline-flex h-5 items-center rounded-md bg-surface px-1.5 text-[11px] font-semibold text-ink2">{U2.newExpr}</span> : undefined}
              />
            ))}
          </ul>
        </Card>
        {content.grammar.map((g, i) => {
          const key = `g:${i}`
          const playing = pb.active(key)
          return (
            <Card key={g.id}>
              <p className="text-[12px] text-ink2">{U2.pattern(i + 1)}</p>
              <h3 lang="ja" className="mt-0.5 text-[20px] font-bold [overflow-wrap:anywhere]">
                {g.pattern}
              </h3>
              <p className="mt-1 text-[14px] break-keep">{g.explanationKo}</p>
              <div className="mt-2.5 border-t border-line pt-1">
                <div className={`-mx-2 flex items-center gap-2 rounded-[10px] px-2 py-2.5 ${playing ? 'bg-accent-soft' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-ink2">{U2.example}</p>
                    <p lang="ja" className="text-[17px] [overflow-wrap:anywhere]">
                      {g.exampleJa}
                    </p>
                    {reading ? (
                      <p lang="ja" className="text-[14px] text-ink2 [overflow-wrap:anywhere]">
                        {g.exampleReading}
                      </p>
                    ) : null}
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
