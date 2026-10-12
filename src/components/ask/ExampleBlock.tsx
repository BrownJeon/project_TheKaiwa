'use client'

/**
 * 답 안 예문 블록(task-064 §25-6 B, D9 A) — 일본어 17px + 히라가나·[한글](앱 표시 스위치) + 뜻 줄(늘 보임, 번역 스위치를 따르지 않음).
 * 소리 듣기 버튼은 없다(D12 A). 분석 상태는 방이 예문 줄만 모아 한 번에 요청해 넘긴다(§25-6 E).
 */
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { ASK_COPY } from './askCopy'

export const EXAMPLE_BOX = 'min-w-0 rounded-xl bg-surface2 px-3 py-2.5'

export default function ExampleBlock({ ja, meaning, ann }: { ja: string; meaning: string | null; ann: AnnotationState }) {
  return (
    <div className={EXAMPLE_BOX}>
      <JaText text={ja} state={ann} leading={2.1} className="whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]" />
      <HangulLine state={ann} size={13} />
      {meaning ? (
        <p className="mt-1 text-[14px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere]">
          <span aria-hidden="true">→ </span>
          <span className="sr-only">{ASK_COPY.meaningSr}</span>
          <JaRuns text={meaning} />
        </p>
      ) : null}
    </div>
  )
}
