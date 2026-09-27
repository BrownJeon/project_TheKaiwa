'use client'

/**
 * 설정값 Effective(#102, Effective 탭만, screens.md §6-2 I). 대상 연결 칩(#91) → `?target=<key>` 로 시작, 바꾸면 URL 을 바꾼다.
 * 검색·출처 필터는 화면 안에서 거른다(요청 없음). Form·Raw JSON·Diff·Presets·Export·Overrides 탭은 없다(Phase 2~4).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, SectionHeader } from '@/components/common/ui'
import type { ConfigSourceName, EffectiveConfigDto, EngineConnectionDto } from '@/types/admin'
import { ChipRadio, type ChipOption } from '../console/ChipRadio'
import { sortConnections } from '../console/connectionText'
import { ConsoleError, ConsoleLoading, EmptyNote, LoadError, loadErrorText } from '../console/ConsoleStates'
import { formatClockSec, groupByPrefix } from '../console/format'
import { ROLE_LABEL, sourceLayer } from '../console/labels'
import { useAdminResource } from '../console/useAdminResource'
import EffectiveRow from './EffectiveRow'
import { SourceLegend } from './SourceBadge'

type SourceFilter = 'ALL' | ConfigSourceName

function EffectiveBody({ eff, q }: { eff: EffectiveConfigDto; q: string }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const needle = q.trim().toLowerCase()
  const searched = needle ? eff.keys.filter((k) => k.key.toLowerCase().includes(needle)) : eff.keys
  const counts = new Map<ConfigSourceName, number>()
  for (const k of searched) counts.set(k.source, (counts.get(k.source) ?? 0) + 1)
  const options: ChipOption<SourceFilter>[] = [
    { value: 'ALL', label: '전체', count: searched.length },
    ...Array.from(counts.entries())
      .sort((a, b) => sourceLayer(a[0]) - sourceLayer(b[0]))
      .map(([s, n]) => ({ value: s, label: `${sourceLayer(s)} ${s}`, count: n, mono: true })),
  ]
  const filtered = sourceFilter === 'ALL' ? searched : searched.filter((k) => k.source === sourceFilter)
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <>
      <div className="mt-2.5">
        <ChipRadio ariaLabel="출처" options={options} value={sourceFilter} onChange={setSourceFilter} />
      </div>
      {filtered.length === 0 ? (
        <div className="mt-3">
          <EmptyNote>조건에 맞는 키가 없어요.</EmptyNote>
        </div>
      ) : (
        groupByPrefix(filtered).map(([prefix, rows]) => (
          <div key={prefix}>
            <p className="mb-1.5 mt-4 font-mono text-[12px] text-ink2">{prefix}.*</p>
            <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
              {rows.map((row) => (
                <EffectiveRow key={row.key} row={row} expanded={expanded.has(row.key)} onToggle={() => toggle(row.key)} />
              ))}
            </ul>
          </div>
        ))
      )}
      {eff.warnings.length > 0 ? (
        <p className="mt-3 text-[12px] text-ink2 [overflow-wrap:anywhere]">경고: {eff.warnings.join(' · ')}</p>
      ) : null}
    </>
  )
}

export default function EffectiveScreen({ initialTarget }: { initialTarget: string | null }) {
  const router = useRouter()
  const targets = useAdminResource<EngineConnectionDto[]>('/api/admin/v1/engine-connections')
  const [picked, setPicked] = useState<string | null>(initialTarget)
  const [q, setQ] = useState('')
  const list = sortConnections(targets.data ?? [])
  const target = picked ?? list[0]?.key ?? null
  const eff = useAdminResource<EffectiveConfigDto>(
    target ? `/api/admin/v1/config/effective?scope=ENGINE_CONNECTION&targetId=${encodeURIComponent(target)}` : null,
  )

  if (targets.status === 'loading' || targets.status === 'idle') return <ConsoleLoading />
  if (targets.status === 'error' && targets.err) return <LoadError err={targets.err} name="연결" onRetry={targets.reload} />

  const selected = list.find((c) => c.key === target || c.id === target) ?? null
  const options: ChipOption<string>[] = list.map((c) => ({ value: c.key, label: c.key, mono: true }))
  const choose = (key: string) => {
    setPicked(key)
    router.replace(`/admin/configuration?target=${encodeURIComponent(key)}`, { scroll: false })
  }
  const d = eff.data

  return (
    <>
      <SectionHeader title="대상 연결" />
      {options.length === 0 ? (
        <EmptyNote>연결이 없어요.</EmptyNote>
      ) : (
        <ChipRadio ariaLabel="대상 연결" options={options} value={selected?.key ?? target} onChange={choose} />
      )}
      {target ? (
        <>
          {eff.status === 'loading' ? <ConsoleLoading /> : null}
          {eff.status === 'error' && eff.err ? (
            eff.err.status === 404 ? (
              <div className="mt-3">
                <EmptyNote>대상을 찾을 수 없어요.</EmptyNote>
              </div>
            ) : (
              <LoadError err={eff.err} name="설정값" onRetry={eff.reload} />
            )
          ) : null}
          {d ? (
            <>
              <Card flat className="mt-2.5">
                <p className="text-[13px] [overflow-wrap:anywhere]">
                  {selected ? `${selected.name} · ${ROLE_LABEL[selected.role]} · ` : ''}
                  <span className="font-mono">{d.engineId ?? '—'}</span> 스키마 v{d.schemaVersion ?? '—'}
                </p>
                <p className="text-[12px] text-ink2">
                  해석 {formatClockSec(d.resolvedAt)}
                  {d.cacheHit ? ' (캐시)' : ''} · {d.environment}
                  {d.emptyLayers.length ? ` · 빈 층 ${d.emptyLayers.map((s) => sourceLayer(s)).join('·')}` : ''}
                </p>
              </Card>
              {eff.err ? (
                <div className="mt-2">
                  <ConsoleError message={loadErrorText(eff.err, '설정값')} onRetry={eff.reload} />
                </div>
              ) : null}
              <details className="mt-2">
                <summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">출처 8층이란?</summary>
                <SourceLegend />
              </details>
              <input
                type="search"
                aria-label="설정 키 검색"
                placeholder="키 검색 (예: timeout)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="mt-1 h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink placeholder:text-ink3"
              />
              <EffectiveBody key={d.targetId} eff={d} q={q} />
            </>
          ) : null}
        </>
      ) : null}
    </>
  )
}
