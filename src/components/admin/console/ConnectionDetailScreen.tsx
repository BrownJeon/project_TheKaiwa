'use client'

/**
 * 연결 상세(#91a + #95a, screens.md §6-2 H). 연결 정보·runtime 은 점 표기 키·값(서버 경로·시크릿 의심 값은 화면에서도 가림).
 * `credentialRef` 는 이름만(🔒) — 존재 여부는 [있는지 확인] → 시크릿 시트(감사 기록)에서만.
 * task-012c(데모 v2, 결정 d4 = A): 머리 카드에 "사용 여부"(엄격 — 스위치는 engine.connections.manage + 운영은 최고관리자만, 아니면 글자) ·
 * [설정 편집] → 같은 화면 편집 모드(`ConnectionEditPanel`) · 비밀 참조 줄의 [비밀 참조 연결](credentials.manage). 권한 없는 버튼은 그리지 않는다.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Section, SectionHeader } from '@/components/common/ui'
import type { EngineConnectionDetailDto } from '@/types/admin'
import { StatusBadge } from './Badges'
import { policyPlaceLong } from './connectionText'
import { useCan, useConsoleEnv, useConsoleToast } from './ConsoleProvider'
import { configAccess } from '../configEditor/configAccess'
import ConnectionEditPanel from '../configEditor/ConnectionEditPanel'
import { CredentialSheet, EnabledSheet } from '../configEditor/ConnectionSheets'
import { StrictBadge, Switch } from '../configEditor/ui'
import { BackLink, ConsoleLoading, LoadError } from './ConsoleStates'
import EffectiveSummaryCard from './EffectiveSummaryCard'
import EngineTestPanel from './EngineTestPanel'
import { flattenDot, refName } from './format'
import HealthHistoryList from './HealthHistoryList'
import KeyValueList, { type KvItem } from './KeyValueList'
import { CONN_TYPE_KO, ROLE_LABEL, ROLE_PATH } from './labels'
import MonoId from './MonoId'
import RefreshLine from './RefreshLine'
import SecretsSheet from './SecretsSheet'
import { useAdminResource } from './useAdminResource'

const NOT_FOUND = { backHref: '/admin/connections', backLabel: '연결 목록으로' }

export default function ConnectionDetailScreen({ id }: { id: string }) {
  const can = useCan()
  const env = useConsoleEnv()
  const toast = useConsoleToast()
  const router = useRouter()
  const access = configAccess(can, env)
  const conn = useAdminResource<EngineConnectionDetailDto>(`/api/admin/v1/engine-connections/${encodeURIComponent(id)}`)
  const [historyKey, setHistoryKey] = useState(0)
  const [secrets, setSecrets] = useState<{ open: boolean; highlightRef: string | null }>({ open: false, highlightRef: null })
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<null | 'enabled' | 'credential'>(null)

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
    node: (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
        {credentialRef ? (
          <>
            <span className="font-mono [overflow-wrap:anywhere]">{refName(credentialRef)}</span>
            <span role="img" aria-label="시크릿 참조">
              🔒
            </span>
          </>
        ) : (
          <span className="text-ink2">없음</span>
        )}
        {credentialRef && can('secrets.read_ref') ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setSecrets({ open: true, highlightRef: credentialRef })}
            className="ml-1 h-11 px-2 font-sans text-[13px] font-medium text-accent"
          >
            있는지 확인
          </button>
        ) : null}
        {access.canCredential ? (
          <button type="button" aria-haspopup="dialog" onClick={() => setSheet('credential')} className="ml-1 h-11 px-2 font-sans text-[13px] font-medium text-accent">
            비밀 참조 연결
          </button>
        ) : null}
      </span>
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
        <hr className="my-3 border-line" />
        <div className="flex min-w-0 items-center gap-2">
          <span id="conn-enabled-label" className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px]">
            사용 여부 <StrictBadge />
          </span>
          {access.canApplyConn && !editing ? (
            <Switch checked={c.enabled} labelledBy="conn-enabled-label" onChange={() => setSheet('enabled')} />
          ) : (
            <span className="text-[14px] font-semibold">{c.enabled ? '켜짐' : '꺼짐'}</span>
          )}
        </div>
        {access.canManageConn && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink">
            설정 편집
          </button>
        ) : null}
      </Card>
      {editing ? (
        <ConnectionEditPanel
          conn={c}
          access={access}
          reloadConn={conn.reload}
          onEnd={() => setEditing(false)}
          onSecrets={(ref) => setSecrets({ open: true, highlightRef: ref })}
          onCredential={() => setSheet('credential')}
        />
      ) : (
        <>
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
        </>
      )}
      <EffectiveSummaryCard summary={c.effectiveSummary} targetKey={c.key} />
      <HealthHistoryList connectionId={c.id} limit={20} reloadKey={historyKey} />
      {can('secrets.read_ref') ? (
        <SecretsSheet open={secrets.open} highlightRef={secrets.highlightRef} onClose={() => setSecrets({ open: false, highlightRef: null })} />
      ) : null}
      {access.canApplyConn ? (
        <EnabledSheet
          key={`en-${c.enabled}-${sheet === 'enabled'}`}
          open={sheet === 'enabled'}
          conn={{ id: c.id, key: c.key, name: c.name, enabled: c.enabled, credentialRef }}
          baseVersion={c.version ?? 0}
          access={access}
          onClose={() => setSheet(null)}
          onRoleLink={() => {
            setSheet(null)
            router.push(ROLE_PATH[c.role])
          }}
          onDone={(r, on) => {
            setSheet(null)
            toast(`${on ? '연결을 켰어요' : '연결을 껐어요'}${r.version ? ` · 설정 v${r.version.version}` : ''}`)
            conn.reload()
            setHistoryKey((k) => k + 1)
          }}
        />
      ) : null}
      {access.canCredential ? (
        <CredentialSheet
          key={`cr-${sheet === 'credential'}`}
          open={sheet === 'credential'}
          conn={{ id: c.id, key: c.key, name: c.name, enabled: c.enabled, credentialRef }}
          baseVersion={c.version ?? 0}
          access={access}
          onClose={() => setSheet(null)}
          onDone={(r, ref) => {
            setSheet(null)
            toast(`${ref ? '비밀 참조를 바꿨어요' : '비밀 참조를 해제했어요'}${r.version ? ` · 설정 v${r.version.version}` : ''} — 상태는 다음 상태 확인 때 갱신돼요`)
            conn.reload()
          }}
        />
      ) : null}
    </>
  )
}
