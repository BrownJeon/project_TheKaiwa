'use client'

/**
 * 대시보드(#80, screens.md §6-2 D). 30초 폴링(보이는 동안만, G5). 역할 카드 4장(REALTIME_STT → ANALYSIS_STT → TTS → LLM)은
 * 카드 전체가 역할 페이지 링크이고 안에 버튼을 두지 않는다(실행은 역할 페이지에서). UNAVAILABLE 카드도 바탕은 그대로.
 */
import Link from 'next/link'
import { Btn, Section, SectionHeader } from '@/components/common/ui'
import { useNow } from '@/components/common/useNow'
import type { EngineRoleName, OverviewDto, OverviewRoleDto } from '@/types/admin'
import { StatusBadge } from './Badges'
import { useCan } from './ConsoleProvider'
import { ConsoleError, ConsoleLoading, LoadError, loadErrorText } from './ConsoleStates'
import { formatAgo, formatMs } from './format'
import { ROLE_KO, ROLE_LABEL, ROLE_ORDER, ROLE_PATH } from './labels'
import RefreshLine from './RefreshLine'
import { useAdminResource } from './useAdminResource'
import { useBulkHealth } from './useBulkHealth'

const CARD_LINK = 'flex min-h-[56px] min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-[14px]'

function RoleCard({ role, item, llm, now }: { role: EngineRoleName; item: OverviewRoleDto | null; llm: OverviewDto['llm']; now: number }) {
  const head = (
    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
      {ROLE_LABEL[role]} <span className="font-normal text-ink2">· {ROLE_KO[role]}</span>
    </span>
  )
  if (!item || !item.connection) {
    return (
      <Link href={ROLE_PATH[role]} className="block min-h-[56px] min-w-0 rounded-[14px] border border-line bg-surface2 p-3.5">
        <div className="flex min-w-0 items-center gap-2">{head}</div>
        <p className="mt-1 flex min-w-0 gap-2 text-[13px] text-ink2">
          <span className="min-w-0 flex-1">이 역할에 연결이 없어요</span>
          <span aria-hidden="true">›</span>
        </p>
      </Link>
    )
  }
  const tiers = role === 'LLM' && llm?.tiers ? Object.entries(llm.tiers) : []
  return (
    <Link href={ROLE_PATH[role]} className="block min-h-[56px] min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
      <div className="flex min-w-0 items-center gap-2">
        {head}
        <StatusBadge value={item.status} />
      </div>
      <p className="mt-1 truncate text-[14px]">{item.engine?.displayName ?? item.engine?.id ?? '—'}</p>
      <p className="truncate text-[13px] text-ink2">
        {item.connection.name} · <span className="font-mono">{item.connection.key}</span>
        {item.fallbacks > 0 ? ` · 예비 ${item.fallbacks}` : ''}
      </p>
      {item.model ? (
        <p className="truncate text-[13px] text-ink2">
          모델 <span className="font-mono">{item.model}</span>
        </p>
      ) : null}
      {tiers.length > 0 ? (
        <p className="font-mono text-[12.5px] text-ink2 [overflow-wrap:anywhere]">{tiers.map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
      ) : null}
      <p className="mt-1 flex min-w-0 gap-2 text-[12px] text-ink2">
        <span className="min-w-0 flex-1 truncate">
          {item.lastHealthAt ? `상태 확인 ${formatAgo(item.lastHealthAt, now)}` : '아직 상태 확인 안 함'}
          {item.statusReason ? ` · ${item.statusReason}` : ''}
        </span>
        <span aria-hidden="true">›</span>
      </p>
    </Link>
  )
}

export default function DashboardScreen() {
  const can = useCan()
  const { bulk: b, run } = useBulkHealth()
  // 일괄 확인이 도는 동안은 폴링 reload 를 건너뛴다(끝나면 한 번 다시 읽는다).
  const overview = useAdminResource<OverviewDto>('/api/admin/v1/overview', { pollMs: 30_000, paused: b !== null })
  const now = useNow(true, 30_000)

  if (overview.status === 'loading' || overview.status === 'idle') return <ConsoleLoading />
  if (overview.status === 'error' && overview.err) return <LoadError err={overview.err} name="대시보드" onRetry={overview.reload} />
  const data = overview.data
  if (!data) return null

  const byRole = new Map(data.roles.map((r) => [r.role, r]))
  const primaryIds = data.roles.map((r) => r.connection?.id).filter((id): id is string => Boolean(id))

  return (
    <>
      <RefreshLine loadedAt={overview.loadedAt} reloading={overview.reloading} polling onReload={overview.reload} />
      {overview.err ? (
        <div className="mb-2">
          <ConsoleError message={loadErrorText(overview.err, '대시보드')} onRetry={overview.reload} />
        </div>
      ) : null}
      {can('health.run') && primaryIds.length > 0 ? (
        <Btn variant="ghost" size="sm" className="mt-1 min-h-11 w-full" disabled={b !== null} aria-busy={b !== null} onClick={() => void run(primaryIds).then(overview.reload)}>
          {b ? `상태 확인 중 ${b.done}/${b.total}…` : '주 연결 상태 확인'}
        </Btn>
      ) : null}
      <Section>
        <SectionHeader title="엔진 역할" />
        <div className="@container">
          <div className="grid gap-2.5 @min-[640px]:grid-cols-2">
            {ROLE_ORDER.map((role) => (
              <RoleCard key={role} role={role} item={byRole.get(role) ?? null} llm={data.llm} now={now} />
            ))}
          </div>
        </div>
      </Section>
      {can('voices.read') ? (
        <Section>
          <SectionHeader title="목소리" />
          <Link href="/admin/voices" className={CARD_LINK}>
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              사용 가능 {data.voices.available} · 꺼짐 {data.voices.disabled} · 가져오는 중 {data.voices.importing}
              {data.voices.error > 0 ? ` · 오류 ${data.voices.error}` : ''}
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        </Section>
      ) : null}
      {can('trace.read') && data.traces24h ? (
        <Section>
          <SectionHeader title="요청 기록 (24시간)" />
          <Link href="/admin/diagnostics?tab=traces" className={CARD_LINK}>
            <span className="min-w-0 flex-1 tabular-nums [overflow-wrap:anywhere]">
              회화 턴 {data.traces24h.turns} · 오류 {data.traces24h.errors} · p50 {formatMs(data.traces24h.p50Ms)} · p95 {formatMs(data.traces24h.p95Ms)}
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        </Section>
      ) : null}
    </>
  )
}
