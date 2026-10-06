'use client'

/**
 * 덱 머리 둘째·셋째 줄(task-044 가이드 §3-6) — 주제 세트일 때만. B 출처 줄(지속, 최대 2줄) · C 챌린지 줄(챌린지 주제 세트일 때만, 1줄).
 * live 영역이 아니다(답할 때마다 읽히면 소란) — 같은 값을 끝내기 시트·결과에서 문장으로 알린다.
 * `compact`(좁은 폭·낮은 높이)면 B 를 한 줄로 줄이는데, AI 주의(안전 고지)는 자르지 않고 설명부터 줄인다(REV-125 L-4, Leader 결정).
 * 주의가 한 줄보다 길면 주의만 두 줄로 내려간다(잘리는 것보다 낫다).
 */
import { SOURCE } from './topicCopy'
import type { SourceParts } from './topicLogic'

export default function TopicDeckLines({ source, challenge, compact = false }: { source: SourceParts; challenge: string | null; compact?: boolean }) {
  return (
    <div className="flex-none px-4 pt-1.5">
      {compact && source.note ? (
        <p className="flex min-w-0 items-baseline text-[12.5px] leading-snug text-ink2">
          <span className="min-w-0 truncate">{source.desc}</span>
          <span className="max-w-full flex-none break-keep pl-[0.3em]">{`· ${source.note}`}</span>
        </p>
      ) : (
        <p className={`text-[12.5px] leading-snug text-ink2 break-keep [overflow-wrap:anywhere] ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
          {source.note ? `${source.desc}${SOURCE.sep}${source.note}` : source.desc}
        </p>
      )}
      {challenge ? <p className="mt-0.5 truncate text-[12.5px] font-medium text-ink tabular-nums">{challenge}</p> : null}
    </div>
  )
}
