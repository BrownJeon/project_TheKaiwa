'use client'

/**
 * 최근 상태 확인·기능 테스트 기록(#95a, screens.md §6-2 C). 행에 traceId 가 있고 `trace.read` 가 있을 때만 Trace 상세로 링크.
 * `reloadKey` 가 바뀌면(테스트 직후) 다시 읽는다.
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Segmented from '@/components/common/Segmented'
import { useNow } from '@/components/common/useNow'
import type { HealthDto, HealthKindName } from '@/types/admin'
import { StatusBadge } from './Badges'
import { useCan } from './ConsoleProvider'
import { ConsoleLoading, EmptyNote, LoadError } from './ConsoleStates'
import { formatAgo, formatMs } from './format'
import { HEALTH_KIND_KO } from './labels'
import { resultView } from './resultView'
import { useAdminResource } from './useAdminResource'

type KindFilter = 'ALL' | HealthKindName

const KIND_OPTIONS = [
  { value: 'ALL' as const, label: '전체' },
  { value: 'HEALTH' as const, label: '상태 확인' },
  { value: 'FUNCTIONAL' as const, label: '기능 테스트' },
]

export default function HealthHistoryList({
  connectionId,
  limit = 20,
  reloadKey = 0,
  title = '최근 결과',
}: {
  connectionId: string
  limit?: number
  reloadKey?: number
  title?: string
}) {
  const can = useCan()
  const [kind, setKind] = useState<KindFilter>('ALL')
  const q = new URLSearchParams({ limit: String(limit) })
  if (kind !== 'ALL') q.set('kind', kind)
  const res = useAdminResource<HealthDto[]>(`/api/admin/v1/engine-connections/${encodeURIComponent(connectionId)}/health?${q.toString()}`)
  const now = useNow(true, 30_000)

  const { reload } = res
  const firstKey = useRef(reloadKey)
  useEffect(() => {
    if (reloadKey !== firstKey.current) reload()
  }, [reloadKey, reload])

  const rows = res.data ?? []
  const canTrace = can('trace.read')

  return (
    <section className="mt-[18px] min-w-0">
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[15px] font-semibold">{title}</h3>
        <div className="w-[220px] min-w-0 max-w-full">
          <Segmented size="sm" ariaLabel="결과 종류" options={KIND_OPTIONS} value={kind} onChange={setKind} />
        </div>
      </div>
      {res.status === 'loading' ? <ConsoleLoading /> : null}
      {res.status === 'error' && res.err ? <LoadError err={res.err} name="기록" onRetry={res.reload} /> : null}
      {res.status === 'ready' && rows.length === 0 ? <EmptyNote>아직 실행한 기록이 없어요. [상태 확인]을 눌러 보세요.</EmptyNote> : null}
      {rows.length > 0 ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
          {rows.map((row) => {
            const view = resultView(row.kind, { ...row, detail: (row.detail ?? null) as Record<string, unknown> | null })
            const inner = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <StatusBadge value={view.badge} />
                  <span className="min-w-0 truncate text-[13px]">{HEALTH_KIND_KO[row.kind]}</span>
                  <span className="ml-auto flex-none text-[12px] tabular-nums text-ink2">{formatAgo(row.checkedAt, now)}</span>
                </span>
                <span className="block truncate text-[12px] text-ink2">
                  {formatMs(row.latencyMs)} · {view.reason ?? (view.skipped ? '건너뜀' : '문제 없음')}
                  {row.traceId ? ' · trace' : ''}
                </span>
              </>
            )
            const cls = 'flex min-h-[56px] min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2'
            return (
              <li key={row.id}>
                {row.traceId && canTrace ? (
                  <Link href={`/admin/diagnostics/traces/${encodeURIComponent(row.traceId)}`} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <div className={cls}>{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
