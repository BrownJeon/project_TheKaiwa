/** 사전 요약 카드(screens.md §10-2 A): "{env} 사전 v{n}" · 사용 중/꺼짐 수 · 마지막 변경 · 버전 기록 링크. */
import Link from 'next/link'
import { Card } from '@/components/common/ui'
import type { AdminEnvironment } from '@/types/admin'
import type { LexiconListDto } from '@/types/lexicon'
import { formatAgo } from '../console/format'
import { actorLabel } from './lexiconCopy'

export default function LexiconSummaryCard({ list, env, now }: { list: LexiconListDto | null; env: AdminEnvironment; now: number }) {
  const active = list?.active ?? null
  return (
    <Card className="mt-2">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold">
          {env} 사전{list ? ` v${list.dictionaryVersion}` : ''}
        </h2>
        <Link href="/admin/speech/tts/lexicon/versions" className="-my-2 inline-flex h-11 flex-none items-center text-[13px] font-medium text-accent">
          버전 기록 ›
        </Link>
      </div>
      {list ? (
        <p className="text-[13px] text-ink2">
          사용 중 {list.counts.enabled} · 꺼짐 {list.counts.disabled}
        </p>
      ) : null}
      {active ? (
        <p className="mt-0.5 truncate text-[12px] text-ink2">
          마지막 변경 {formatAgo(active.createdAt, now)} · {actorLabel(active.actor)}
          {active.changeSummary ? ` · ${active.changeSummary}` : ''}
        </p>
      ) : null}
      {list && list.dictionaryVersion === 0 ? <p className="text-[13px] text-ink2 break-keep">아직 사전 버전이 없어요 — 첫 항목을 추가하면 v1 이 만들어져요.</p> : null}
    </Card>
  )
}
