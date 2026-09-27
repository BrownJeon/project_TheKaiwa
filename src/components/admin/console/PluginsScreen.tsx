'use client'

/** 엔진 플러그인 로드 상태(#121, DEVELOPER+, screens.md §6-2 G). */
import Link from 'next/link'
import type { PluginDto } from '@/types/admin'
import { LoadedBadge, NeutralBadge } from './Badges'
import { ConsoleLoading, EmptyNote, LoadError } from './ConsoleStates'
import { displayValue } from './format'
import { CONN_TYPE_KO } from './labels'
import RefreshLine from './RefreshLine'
import { useAdminResource } from './useAdminResource'

export default function PluginsScreen() {
  const res = useAdminResource<PluginDto[]>('/api/admin/v1/plugins')
  if (res.status === 'loading' || res.status === 'idle') return <ConsoleLoading />
  if (res.status === 'error' && res.err) return <LoadError err={res.err} name="플러그인" onRetry={res.reload} />
  const list = res.data ?? []
  return (
    <>
      <RefreshLine loadedAt={res.loadedAt} reloading={res.reloading} onReload={res.reload} />
      <div className="@container mt-1">
        {list.length === 0 ? (
          <EmptyNote>등록된 플러그인이 없어요.</EmptyNote>
        ) : (
          <ul className="grid gap-2.5 @min-[640px]:grid-cols-2">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/plugins/${encodeURIComponent(p.id)}`} className="block min-h-[56px] min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold">{p.id}</span>
                    <LoadedBadge loaded={p.loaded} />
                    {p.orphan ? <NeutralBadge>등록 불일치</NeutralBadge> : null}
                  </span>
                  <span className="block truncate text-[13px] text-ink2">
                    {p.type} · v{p.version} · 역할 {p.roles.join(', ') || '—'} · 연결 {p.connections}개
                  </span>
                  <span className="block truncate text-[13px] text-ink2">방식 {p.connectionTypes.map((t) => CONN_TYPE_KO[t] ?? t).join(', ') || '—'}</span>
                  {p.initError ? (
                    <span className="mt-1 line-clamp-2 block text-[13px] text-bad [overflow-wrap:anywhere]">{displayValue('initError', p.initError)}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
