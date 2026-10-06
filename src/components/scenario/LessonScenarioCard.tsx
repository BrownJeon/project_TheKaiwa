'use client'

/**
 * 수업 종료 카드의 "이 상황으로 역할극"(가이드 §3-I · 승인 v1 `#lesson-end` 제안 쪽). 주제가 있는 새 수업에서만 `LessonEnd` 가 놓는다.
 * 이 주제의 코드 추천 1개(#161 `topicId&recommended=1&limit=1`)와 그 상세(#162 — 겹치는 표현 안내용)를 읽는다. 상황 수업(`lesson.scenarioId`,
 * `le-scenario-lesson`)이면 추천 대신 그 상황의 상세만 읽는다. 받는 동안·실패·0개면 카드 없음(부가 기능이라 오류 문구 없음).
 * [역할극 해 보기] → 같은 상황 시트(`lessonId` 를 싣고 시작). 읽기만 한다 — 시작(#28)은 시트의 버튼.
 */
import { useId, useState } from 'react'
import { Btn } from '@/components/common/ui'
import { useKeyedResource } from '@/components/plan/usePlanData'
import type { LessonContent, LessonDto } from '@/types/lesson'
import type { ScenarioListResponse } from '@/types/scenario'
import { josa } from './logic'
import { lessonCardSourceOf, lessonOverlap, lessonPickOf, overlapTail } from './resultLogic'
import ScenarioSheet from './ScenarioSheet'
import { LESSON } from './scenarioCopyResult'
import { useScenarioDetail } from './useScenarioDetail'

const recoPath = (topicId: string) => `/api/v1/scenarios?topicId=${encodeURIComponent(topicId)}&recommended=1&limit=1`

export default function LessonScenarioCard({ lesson }: { lesson: LessonDto & { content: LessonContent } }) {
  const source = lessonCardSourceOf(lesson)
  const reco = useKeyedResource<ScenarioListResponse>(source?.kind === 'topic' ? source.topicId : null, recoPath)
  const pickId = source?.kind === 'scenario' ? source.id : reco.status === 'ready' ? lessonPickOf(reco.data) : null
  const detail = useScenarioDetail(pickId)
  const [open, setOpen] = useState(false)
  const headId = useId()
  const item = source?.kind === 'scenario' ? (detail.status === 'ready' ? (detail.data ?? undefined) : undefined) : pickId ? reco.data?.items.find((i) => i.id === pickId) : undefined
  if (!item || detail.status === 'loading') return null
  const overlaps = detail.status === 'ready' && detail.data ? lessonOverlap(lesson.content.chunks, detail.data.keyExpressions) : []
  const tail = overlapTail(overlaps)
  return (
    <>
      <section aria-labelledby={headId} className="rounded-[14px] border border-line bg-surface p-3.5">
        <p className="text-[12px] text-ink2">{LESSON.kicker}</p>
        <h3 id={headId} className="mt-0.5 text-[15px] font-semibold break-keep">
          {LESSON.title(item.title)}
        </h3>
        {item.titleJa ? (
          <p lang="ja" className="text-[13px] text-ink2 [overflow-wrap:anywhere]">
            {item.titleJa}
          </p>
        ) : null}
        <p className="mt-1 text-[13px] break-keep">
          {LESSON.roles(item.roles.tutor, josa(item.roles.learner, '이', '가'))}
          {tail ? (
            <>
              {LESSON.overlapBefore}
              {overlaps.map((ja, i) => (
                <span key={ja}>
                  {i > 0 ? LESSON.overlapSep : null}「<span lang="ja">{ja}</span>」
                </span>
              ))}
              {tail}
            </>
          ) : null}
        </p>
        <Btn variant="ghost" className="mt-3 w-full" onClick={() => setOpen(true)}>
          {LESSON.start}
        </Btn>
      </section>
      <ScenarioSheet id={open ? item.id : null} onClose={() => setOpen(false)} fromLesson={{ lessonId: lesson.id, title: lesson.content.title }} onPickOther={() => setOpen(false)} />
    </>
  )
}
