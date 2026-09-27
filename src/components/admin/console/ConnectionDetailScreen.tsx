'use client'

/**
 * 연결 상세(#91a + #95a, screens.md §6-2 H). 연결 정보·runtime 은 점 표기 키·값(서버 경로·시크릿 의심 값은 화면에서도 가림).
 * `credentialRef` 는 이름만(🔒) — 존재 여부는 [있는지 확인] → 시크릿 시트(감사 기록)에서만.
 */
import { useState } from 'react'
import { Card, Section, SectionHeader } from '@/components/common/ui'
import type { EngineConnectionDetailDto } from '@/types/admin'
import { StatusBadge } from './Badges'
import { policyPlaceLong } from './connectionText'
import { useCan } from './ConsoleProvider'
import { BackLink, ConsoleLoading, LoadError } from './ConsoleStates'
import EffectiveSummaryCard from './EffectiveSummaryCard'
import EngineTestPanel from './EngineTestPanel'
import { flattenDot, refName } from './format'
import HealthHistoryList from './HealthHistoryList'
import KeyValueList, { type KvItem } from './KeyValueList'
import { CONN_TYPE_KO, ROLE_LABEL } from './labels'
import MonoId from './MonoId'
import RefreshLine from './RefreshLine'
import SecretsSheet from './SecretsSheet'
import { useAdminResource } from './useAdminResource'

const NOT_FOUND = { backHref: '/admin/connections', backLabel: '연결 목록으로' }

export default function ConnectionDetailScreen({ id }: { id: string }) {
  const can = useCan()
  const conn = useAdminResource<EngineConnectionDetailDto>(`/api/admin/v1/engine-connections/${encodeURIComponent(id)}`)
  const [historyKey, setHistoryKey] = useState(0)
  const [secrets, setSecrets] = useState<{ open: boolean; highlightRef: string | null }>({ open: false, highlightRef: null })

  if (conn.status === 'loading' || conn.status === 'idle') {
    return (
      <>
        <BackLink href="/admin/connections">연결 목록</BackLink>
        <ConsoleLoading />
      </>
    )
  }
  if (conn.status === 'error' && conn.err) {
    return (
      <>
        <BackLink href="/admin/connections">연결 목록</BackLink>
        <LoadError err={conn.err} name="연결" onRetry={conn.reload} notFound={NOT_FOUND} />
      </>
    )
  }
  const c = conn.data
  if (!c) return null

  const credentialRef = c.credentialRef ?? (typeof c.connection.credentialRef === 'string' ? c.connection.credentialRef : null)
  const connectionItems: KvItem[] = flattenDot(c.connection)
    .filter(([k]) => k !== 'credentialRef')
    .map(([k, v]) => ({ key: k, value: v }))
  connectionItems.push({
    key: 'credentialRef',
    node: credentialRef ? (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
        <span className="font-mono [overflow-wrap:anywhere]">{refName(credentialRef)}</span>
        <span role="img" aria-label="시크릿 참조">
          🔒
        </span>
        {can('secrets.read_ref') ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSecrets({ open: true, highlightRef: credentialRef })}
            className="ml-1 h-11 px-2 font-sans text-[13px] font-medium text-accent"
          >
            있는지 확인
          </button>
        ) : null}
      </span>
    ) : (
      <span className="text-ink2">없음</span>
    ),
  })
  const runtimeItems: KvItem[] = [...flattenDot(c.runtime).map(([k, v]) => ({ key: k, value: v })), { key: 'logLevel', label: '로그 레벨', value: c.logLevel }]

  return (
    <>
      <BackLink href="/admin/connections">연결 목록</BackLink>
      <RefreshLine loadedAt={conn.loadedAt} reloading={conn.reloading} onReload={conn.reload} />
      <Card>
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 flex-1 text-[17px] font-semibold [overflow-wrap:anywhere]">{c.name}</h2>
          <StatusBadge value={c.enabled ? c.status : 'DISABLED'} />
        </div>
        <MonoId value={c.key} copy label="연결 키" />
        <p className="mt-1 text-[12px] text-ink2 [overflow-wrap:anywhere]">
          {ROLE_LABEL[c.role]} · {c.engineName || c.engineId} · {CONN_TYPE_KO[c.connectionType] ?? c.connectionType} · {c.environment} · 설정 v{c.version ?? '—'}
        </p>
        <p className="text-[12px] text-ink2">{policyPlaceLong(c)}</p>
        {c.statusReason ? <p className="mt-1 text-[13px] text-ink [overflow-wrap:anywhere]">{c.statusReason}</p> : null}
        {!c.enabled ? <p className="mt-1 text-[12px] text-ink2">꺼진 연결 — 라우터가 고르지 않아요</p> : null}
      </Card>
      <EngineTestPanel
        connection={{ id: c.id, key: c.key, role: c.role, connectionType: c.connectionType, enabled: c.enabled, status: c.status }}
        onDone={() => {
          conn.reload()
          setHistoryKey((k) => k + 1)
        }}
      />
      <Section>
        <SectionHeader title="연결 정보" />
        <Card>
          <KeyValueList mono items={connectionItems} />
        </Card>
      </Section>
      <Section>
        <SectionHeader title="실행 설정 (runtime)" />
        <Card>
          <KeyValueList mono items={runtimeItems} />
        </Card>
      </Section>
      <EffectiveSummaryCard summary={c.effectiveSummary} targetKey={c.key} />
      <HealthHistoryList connectionId={c.id} limit={20} reloadKey={historyKey} />
      {can('secrets.read_ref') ? (
        <SecretsSheet open={secrets.open} highlightRef={secrets.highlightRef} onClose={() => setSecrets({ open: false, highlightRef: null })} />
      ) : null}
    </>
  )
}
