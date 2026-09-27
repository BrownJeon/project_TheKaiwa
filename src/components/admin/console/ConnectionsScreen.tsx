'use client'

/**
 * 연결 목록(#91 전체 1회, screens.md §6-2 H). 역할 칩은 화면에서 거른다. "모두 상태 확인"은 enabled 인 연결마다 #95 를 순서대로.
 * [시크릿 참조]는 `secrets.read_ref` 가 있을 때만 — 시트를 열 때만 #101 이 나간다.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Btn } from '@/components/common/ui'
import { useNow } from '@/components/common/useNow'
import type { EngineConnectionDto, EngineRoleName } from '@/types/admin'
import { StatusBadge } from './Badges'
import { ChipRadio, type ChipOption } from './ChipRadio'
import { useCan } from './ConsoleProvider'
import { ConsoleError, ConsoleLoading, EmptyNote, LoadError, loadErrorText } from './ConsoleStates'
import { formatAgo } from './format'
import { policyPlace, sortConnections } from './connectionText'
import { CONN_TYPE_KO, ROLE_LABEL, ROLE_ORDER } from './labels'
import RefreshLine from './RefreshLine'
import SecretsSheet from './SecretsSheet'
import { useAdminResource } from './useAdminResource'
import { useBulkHealth } from './useBulkHealth'

type RoleFilter = 'ALL' | EngineRoleName

function ConnectionCard({ conn, now }: { conn: EngineConnectionDto; now: number }) {
  return (
    <li>
      <Link href={`/admin/connections/${encodeURIComponent(conn.id)}`} className="block min-h-[56px] min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{conn.name}</span>
          <StatusBadge value={conn.enabled ? conn.status : 'DISABLED'} />
        </span>
        <span className="block truncate font-mono text-[13px] text-ink2">{conn.key}</span>
        <span className="block truncate text-[13px] text-ink2">
          {ROLE_LABEL[conn.role]} · {conn.engineName || conn.engineId} · {CONN_TYPE_KO[conn.connectionType] ?? conn.connectionType}
        </span>
        <span className="mt-0.5 flex min-w-0 gap-2 text-[12px] text-ink2">
          <span className="min-w-0 flex-1 truncate">
            {policyPlace(conn)} · {conn.lastHealthAt ? `확인 ${formatAgo(conn.lastHealthAt, now)}` : '확인 안 함'}
          </span>
          <span aria-hidden="true">›</span>
        </span>
      </Link>
    </li>
  )
}

export default function ConnectionsScreen() {
  const can = useCan()
  const now = useNow(true, 30_000)
  const { bulk: b, run } = useBulkHealth()
  const list = useAdminResource<EngineConnectionDto[]>('/api/admin/v1/engine-connections')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [secretsOpen, setSecretsOpen] = useState(false)

  if (list.status === 'loading' || list.status === 'idle') return <ConsoleLoading />
  if (list.status === 'error' && list.err) return <LoadError err={list.err} name="연결" onRetry={list.reload} />
  const all = sortConnections(list.data ?? [])
  const count = (r: EngineRoleName) => all.filter((c) => c.role === r).length
  const options: ChipOption<RoleFilter>[] = [
    { value: 'ALL', label: '전체', count: all.length },
    ...ROLE_ORDER.filter((r) => count(r) > 0).map((r) => ({ value: r, label: ROLE_LABEL[r], count: count(r) })),
  ]
  const shown = roleFilter === 'ALL' ? all : all.filter((c) => c.role === roleFilter)
  const enabledIds = all.filter((c) => c.enabled).map((c) => c.id)
  const canHealth = can('health.run') && enabledIds.length > 0
  const canSecrets = can('secrets.read_ref')

  return (
    <>
      <RefreshLine loadedAt={list.loadedAt} reloading={list.reloading} onReload={list.reload} />
      {list.err ? <ConsoleError message={loadErrorText(list.err, '연결')} onRetry={list.reload} /> : null}
      {canHealth || canSecrets ? (
        <div className="mt-1 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          {canHealth ? (
            <Btn variant="ghost" size="sm" className="min-h-11" disabled={b !== null} aria-busy={b !== null} onClick={() => void run(enabledIds).then(list.reload)}>
              {b ? `확인 중 ${b.done}/${b.total}…` : '모두 상태 확인'}
            </Btn>
          ) : null}
          {canSecrets ? (
            <Btn variant="ghost" size="sm" className="min-h-11" aria-haspopup="dialog" onClick={() => setSecretsOpen(true)}>
              시크릿 참조
            </Btn>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2.5">
        <ChipRadio ariaLabel="역할" options={options} value={roleFilter} onChange={setRoleFilter} />
      </div>
      <div className="@container mt-3">
        {shown.length === 0 ? (
          <EmptyNote>연결이 없어요.</EmptyNote>
        ) : (
          <ul className="grid gap-2.5 @min-[640px]:grid-cols-2">
            {shown.map((c) => (
              <ConnectionCard key={c.id} conn={c} now={now} />
            ))}
          </ul>
        )}
      </div>
      {canSecrets ? <SecretsSheet open={secretsOpen} onClose={() => setSecretsOpen(false)} /> : null}
    </>
  )
}
