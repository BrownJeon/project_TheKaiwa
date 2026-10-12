'use client'

/**
 * `parseAnswerMd` 결과를 React 요소로 그린다(task-064 §25-6). 받는 값은 화이트리스트 노드(문단·굵게·기울임·목록·인용·줄바꿈·예문)뿐이고
 * 글은 언제나 텍스트 노드다 — 링크·HTML 을 만드는 길이 없다. 한국어 글 속 일본어 구간에만 `lang="ja"`(층 없음, `JaRuns`).
 */
import { Fragment } from 'react'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import type { AskBlock, Inline } from './answerMd'
import ExampleBlock, { EXAMPLE_BOX } from './ExampleBlock'

const TEXT = 'text-[15px] leading-[1.65] break-keep [overflow-wrap:anywhere]'

function Inlines({ nodes }: { nodes: readonly Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'text':
            return <JaRuns key={i} text={n.s} />
          case 'br':
            return <br key={i} />
          case 'strong':
            return (
              <strong key={i} className="font-bold">
                <Inlines nodes={n.c} />
              </strong>
            )
          case 'em':
            return (
              <em key={i}>
                <Inlines nodes={n.c} />
              </em>
            )
          default:
            return null
        }
      })}
    </>
  )
}

export default function AnswerMarkdown({ blocks, annOf }: { blocks: readonly AskBlock[]; annOf: (ja: string) => AnnotationState }) {
  if (blocks.length === 0) return null
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {blocks.map((b, i) => {
        switch (b.k) {
          case 'p':
            return (
              <p key={i} className={TEXT}>
                <Inlines nodes={b.c} />
              </p>
            )
          case 'ul':
            return (
              <ul key={i} className={`flex list-disc flex-col gap-1 pl-5 ${TEXT}`}>
                {b.items.map((it, k) => (
                  <li key={k}>
                    <Inlines nodes={it} />
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} start={b.start} className={`flex list-decimal flex-col gap-1 pl-5 ${TEXT}`}>
                {b.items.map((it, k) => (
                  <li key={k}>
                    <Inlines nodes={it} />
                  </li>
                ))}
              </ol>
            )
          case 'ex':
            return <ExampleBlock key={i} ja={b.ja} meaning={b.meaning} ann={annOf(b.ja)} />
          case 'quote':
            return (
              <div key={i} className={EXAMPLE_BOX}>
                <p className={TEXT}>
                  <Inlines nodes={b.c} />
                </p>
              </div>
            )
          default:
            return <Fragment key={i} />
        }
      })}
    </div>
  )
}
