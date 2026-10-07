'use client'

/**
 * 주제 행(S2 — 데모 v2 `topicRow`) — 행 전체가 주제 보기(S6) 링크, 높이 ≥76. 1줄 제목(말줄임)+수준+출처 뱃지 · 2줄 일본어 이름(없으면 생략) ·
 * 3줄 「상황 n개 · 기본 표현 n개」(+ 진행 중 챌린지). 출처·진행은 색이 아니라 뱃지 글자로 구분한다.
 */
import Link from 'next/link'
import { Badge } from '@/components/common/ui'
import { topicHref, type Origin, type TopicRowView } from './logic'
import { MANAGE } from './topicCopy'

const ORIGIN_BADGE: Record<Origin, string> = { MINE: MANAGE.badgeMine, SEED: MANAGE.badgeSeed, COPY: MANAGE.badgeCopy }

export default function TopicRow({ row }: { row: TopicRowView }) {
  return (
    <Link
      href={topicHref(row.id, row.origin)}
      data-topic-id={row.id}
      className="flex min-h-[76px] w-full min-w-0 items-start gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-left"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{row.title}</span>
          <Badge>{row.level}</Badge>
          <Badge>{ORIGIN_BADGE[row.origin]}</Badge>
        </span>
        {row.titleJa ? (
          <span lang="ja" className="block min-w-0 truncate text-[13px] text-ink2">
            {row.titleJa}
          </span>
        ) : null}
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink2">
          <span>{row.scenarioCount === null ? MANAGE.rowMetaNoScenario(row.chunkCount) : MANAGE.rowMeta(row.scenarioCount, row.chunkCount)}</span>
          {row.challengeDay !== null ? <Badge tone="good">{MANAGE.challengeBadge(row.challengeDay)}</Badge> : null}
        </span>
      </span>
      <span aria-hidden="true" className="flex-none text-[15px] leading-[22px] text-ink2">
        ›
      </span>
    </Link>
  )
}
