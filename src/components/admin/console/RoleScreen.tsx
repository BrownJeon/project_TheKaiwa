'use client'

/**
 * 역할 페이지(screens.md §6-2 E) — `/admin/speech/{realtime,analysis,tts}` · `/admin/llm`.
 * 정책(#99a) → 지금 쓰는 연결(#91a, 정책의 primary) · 예비 순서 · 정책 밖 연결(#91?role=) · 설정값 요약 · (TTS) 목소리 · (LLM) 모델 단계.
 * Engine 선택·Fallback 편집·연결 설정 폼은 Phase 2 — 그리지 않는다.
 */
import Link from 'next/link'
import { Card, Section, SectionHeader } from '@/components/common/ui'
import { useNow } from '@/components/common/useNow'
import type { AdminVoiceDto, ConnectionRefDto, EngineConnectionDetailDto, EngineConnectionDto, EngineRoleName, FallbackPolicyDto } from '@/types/admin'
import { StatusBadge } from './Badges'
import { useCan } from './ConsoleProvider'
import { ConsoleError, ConsoleLoading, LoadError, loadErrorText } from './ConsoleStates'
import EffectiveSummaryCard from './EffectiveSummaryCard'
import EngineTestPanel from './EngineTestPanel'
import { displayValue, formatAgo, modelLabel } from './format'
import KeyValueList, { type KvItem } from './KeyValueList'
import { CONN_TYPE_KO, ROLE_DESC, voiceFilterOf } from './labels'
import MonoId from './MonoId'
import RefreshLine from './RefreshLine'
import { useAdminResource } from './useAdminResource'

const ROW_LINK = 'flex min-h-[56px] min-w-0 items-center gap-3 px-3.5 py-2'

function ConnRow({ index, conn, note, sub }: { index?: number; conn: ConnectionRefDto; note?: string; sub?: string | null }) {
  return (
    <li>
      <Link href={`/admin/connections/${encodeURIComponent(conn.id)}`} className={ROW_LINK}>
        {index !== undefined ? <span className="w-5 flex-none text-center font-mono text-[13px] text-ink2">{index}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px]">
            {conn.name}
            {note ?? ''}
          </span>
          <span className="block truncate font-mono text-[12px] text-ink2">{conn.key}</span>
          {sub ? <span className="block text-[12px] text-ink2 [overflow-wrap:anywhere]">{sub}</span> : null}
        </span>
        <StatusBadge value={conn.enabled ? conn.status : 'DISABLED'} />
        <span aria-hidden="true" className="text-ink2">
          ›
        </span>
      </Link>
    </li>
  )
}

function allowedTasksText(c: EngineConnectionDto): string {
  const t = c.runtime?.allowedTasks
  if (Array.isArray(t) && t.length > 0) return `특정 작업에만 쓰여요: ${t.map((x) => displayValue('allowedTasks', x)).join(', ')}`
  return '라우터가 고르지 않아요'
}

export default function RoleScreen({ role }: { role: EngineRoleName }) {
  const can = useCan()
  const now = useNow(true, 30_000)
  const policy = useAdminResource<FallbackPolicyDto>(`/api/admin/v1/fallback-policies/${role}`)
  const primaryId = policy.data?.primary?.id ?? null
  const primary = useAdminResource<EngineConnectionDetailDto>(primaryId ? `/api/admin/v1/engine-connections/${encodeURIComponent(primaryId)}` : null)
  const conns = useAdminResource<EngineConnectionDto[]>(`/api/admin/v1/engine-connections?role=${role}`)
  const voices = useAdminResource<AdminVoiceDto[]>(role === 'TTS' && can('voices.read') ? '/api/admin/v1/voices' : null)

  const reloadAll = () => {
    policy.reload()
    primary.reload()
    conns.reload()
  }

  const noPolicy = policy.status === 'error' && policy.err?.status === 404
  if (policy.status === 'loading' || policy.status === 'idle') return <ConsoleLoading />
  if (policy.status === 'error' && policy.err && !noPolicy) return <LoadError err={policy.err} name="역할" onRetry={policy.reload} />

  const p = policy.data
  const inPolicy = new Set<string>(p ? [p.primary?.id, ...p.fallbacks.map((f) => f.id)].filter((x): x is string => Boolean(x)) : [])
  const others = (conns.data ?? []).filter((c) => !inPolicy.has(c.id))
  const d = primary.data
  const loadedAt = Math.min(...[policy.loadedAt, primary.loadedAt, conns.loadedAt].filter((x): x is number => typeof x === 'number'))

  const primaryItems: KvItem[] = d
    ? [
        { key: 'engine', label: '엔진', value: d.engineName || d.engineId },
        { key: 'connectionType', label: '방식', value: CONN_TYPE_KO[d.connectionType] ?? d.connectionType },
        { key: 'model', label: '모델', value: modelLabel(d.runtime), mono: true },
        {
          key: 'address',
          label: '주소',
          value: d.connection.baseUrl ?? d.connection.binPath ?? d.connection.manifestUrl ?? null,
          mono: true,
        },
        { key: 'lastHealthAt', label: '마지막 확인', value: d.lastHealthAt ? formatAgo(d.lastHealthAt, now) : null },
        { key: 'lastFunctionalAt', label: '마지막 기능 테스트', value: d.lastFunctionalAt ? formatAgo(d.lastFunctionalAt, now) : null },
        ...(d.statusReason ? [{ key: 'statusReason', label: '상태 사유', value: d.statusReason }] : []),
      ]
    : []

  const runningKey = p?.effectiveOrder?.[0]
  const tiers = d?.runtime?.modelByTier
  const voiceCounts = (voices.data ?? []).reduce(
    (acc, v) => {
      const f = voiceFilterOf(v.status, v.enabled)
      if (f === 'AVAILABLE') acc.available += 1
      else if (f === 'OFF') acc.off += 1
      else if (f === 'ERROR') acc.error += 1
      else acc.importing += 1
      return acc
    },
    { available: 0, off: 0, error: 0, importing: 0 },
  )

  return (
    <>
      <p className="text-[13px] text-ink2 break-keep">{ROLE_DESC[role]}</p>
      <RefreshLine loadedAt={Number.isFinite(loadedAt) ? loadedAt : null} reloading={policy.reloading || primary.reloading || conns.reloading} onReload={reloadAll} />

      {noPolicy ? (
        <Section>
          <SectionHeader title="지금 쓰는 연결" />
          <Card flat>
            <p className="text-[14px] text-ink2">이 역할에 정책이 없어요</p>
          </Card>
        </Section>
      ) : null}

      {p && p.primary ? (
        <Section>
          <SectionHeader
            title="지금 쓰는 연결"
            right={
              <Link href={`/admin/connections/${encodeURIComponent(p.primary.id)}`} className="-my-2 inline-flex h-11 flex-none items-center text-[13px] font-medium text-accent">
                연결 상세 ›
              </Link>
            }
          />
          {primary.status === 'loading' ? <ConsoleLoading /> : null}
          {primary.status === 'error' && primary.err ? (
            <LoadError err={primary.err} name="연결" onRetry={primary.reload} notFound={{ backHref: '/admin/connections', backLabel: '연결 목록으로' }} />
          ) : null}
          {d ? (
            <>
              <Card>
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{d.name}</h2>
                  <StatusBadge value={d.enabled ? d.status : 'DISABLED'} />
                </div>
                <MonoId value={d.key} copy label="연결 키" />
                {runningKey && runningKey !== d.key ? (
                  <p className="mt-1 text-[12px] text-ink [overflow-wrap:anywhere]">
                    지금은 예비 연결 <span className="font-mono">{runningKey}</span> 로 돌고 있어요
                  </p>
                ) : null}
                <KeyValueList className="mt-2" items={primaryItems} />
              </Card>
              <EngineTestPanel
                connection={{ id: d.id, key: d.key, role: d.role, connectionType: d.connectionType, enabled: d.enabled, status: d.status }}
                onDone={reloadAll}
              />
            </>
          ) : null}
        </Section>
      ) : null}

      {p ? (
        <Section>
          <SectionHeader title="예비 연결 순서" />
          <ol className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
            {p.primary ? <ConnRow index={1} conn={p.primary} note=" (기본)" /> : null}
            {p.fallbacks.map((f, i) => (
              <ConnRow key={f.id} index={i + 2} conn={f} />
            ))}
          </ol>
          {p.fallbacks.length === 0 ? <p className="mt-2 text-[12px] text-ink2 break-keep">예비 연결 없음 — 이 연결이 안 되면 이 기능을 쓸 수 없어요</p> : null}
          <p className="mt-1 text-[12px] text-ink2">
            {p.retryOnce ? '실패하면 다음 연결로 한 번 다시 시도해요' : '실패해도 다른 연결로 넘기지 않아요'}
            {!p.enabled ? ' · 정책 꺼짐' : ''}
          </p>
        </Section>
      ) : null}

      {others.length > 0 ? (
        <Section>
          <SectionHeader title="정책 밖 연결" />
          <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
            {others.map((c) => (
              <ConnRow key={c.id} conn={c} sub={allowedTasksText(c)} />
            ))}
          </ul>
        </Section>
      ) : null}
      {conns.status === 'error' && conns.err ? (
        <div className="mt-3">
          <ConsoleError message={loadErrorText(conns.err, '연결 목록')} onRetry={conns.reload} />
        </div>
      ) : null}

      {d ? <EffectiveSummaryCard summary={d.effectiveSummary} targetKey={d.key} /> : null}

      {role === 'TTS' && can('voices.read') ? (
        <Section>
          <SectionHeader title="목소리" />
          {voices.status === 'error' && voices.err ? (
            <ConsoleError message={loadErrorText(voices.err, '목소리')} onRetry={voices.reload} />
          ) : (
            <Link href="/admin/voices" className="flex min-h-[56px] min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-[14px]">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {voices.data
                  ? `사용 가능 ${voiceCounts.available} · 꺼짐 ${voiceCounts.off} · 가져오는 중 ${voiceCounts.importing}${voiceCounts.error ? ` · 오류 ${voiceCounts.error}` : ''}`
                  : '불러오는 중…'}
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          )}
        </Section>
      ) : null}

      {role === 'TTS' && can('voices.read') ? (
        <Section>
          <SectionHeader title="발음 사전" />
          <Link href="/admin/speech/tts/lexicon" className="flex min-h-[56px] min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px]">읽기가 틀린 단어 고치기</span>
              <span className="block truncate text-[12px] text-ink2">항목·미리듣기·가져오기·버전 기록</span>
            </span>
            <span aria-hidden="true">›</span>
          </Link>
        </Section>
      ) : null}

      {role === 'LLM' && tiers && typeof tiers === 'object' && !Array.isArray(tiers) ? (
        <Section>
          <SectionHeader title="모델 단계" />
          <Card>
            <KeyValueList mono items={Object.entries(tiers as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }))} />
          </Card>
        </Section>
      ) : null}
    </>
  )
}
