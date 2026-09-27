/** Trace 목록 한 줄(#128, screens.md §6-2 J) — 행 전체가 상세 링크(≥56px). */
import Link from 'next/link'
import type { TraceListItemDto } from '@/types/admin'
import { NeutralBadge, TraceStatusBadge } from '../console/Badges'
import { formatAgo, formatMs } from '../console/format'
import { TRACE_KIND_KO } from '../console/labels'

export default function TraceRow({ item, now }: { item: TraceListItemDto; now: number }) {
  return (
    <li>
      <Link
        href={`/admin/diagnostics/traces/${encodeURIComponent(item.traceId)}`}
        className="flex min-h-[56px] min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <NeutralBadge>{TRACE_KIND_KO[item.kind] ?? item.kind}</NeutralBadge>
          <TraceStatusBadge status={item.status} />
          <span className="ml-auto flex-none text-[12px] tabular-nums text-ink2">
            {formatMs(item.totalMs)} · {formatAgo(item.createdAt, now)}
          </span>
        </span>
        <span className="block truncate font-mono text-[12px] text-ink2">
          {item.stepNames.length ? item.stepNames.join(' › ') : '단계 없음'}
          {item.errorCode ? ` · ${item.errorCode}` : ''}
        </span>
      </Link>
    </li>
  )
}
