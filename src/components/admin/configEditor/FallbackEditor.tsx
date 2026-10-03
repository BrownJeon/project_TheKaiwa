'use client'

/**
 * 역할 페이지 예비 순서 편집(#100, 데모 v2 `role-edit`) — 맨 위가 기본 연결, 드래그 대신 ↑ ↓ 빼기(44px), 아래에 넣을 수 있는 연결.
 * 마지막 한 개는 [빼기]가 없고(기능이 멈춘다), 꺼진 연결은 [넣기] 대신 "연결 상세에서 켜기". 예비는 4개까지.
 * 순서는 초안(`primaryConnectionId`·`fallbackConnectionIds`)에서 읽는다 — 설정 화면과 같은 검증·테스트·요약·적용 막대. 모두 엄격 키(운영은 최고관리자 직접,
 * 새로 들어간 기본·예비 연결은 기능 테스트 필수). "실패하면 다음 연결로 한 번 다시 시도" 는 라우터가 읽지 않아 여기서 바꾸지 않는다.
 */
import Link from 'next/link'
import { useCallback, useState } from 'react'
import type { EffectiveConfigDto, EngineConnectionDto, EngineRoleName, FallbackPolicyDto } from '@/types/admin'
import { StatusBadge } from '../console/Badges'
import { useConsoleEnv, useConsoleToast } from '../console/ConsoleProvider'
import { ConsoleLoading, LoadError } from '../console/ConsoleStates'
import { useAdminResource } from '../console/useAdminResource'
import AppliedNote from './AppliedNote'
import { ConfirmDropSheet } from './ApplySheet'
import * as api from './configApi'
import type { ConfigAccess } from './configAccess'
import ConfigTestCard from './ConfigTestCard'
import { DiffList, summaryOf, SummaryChips, type ValueNamer } from './DiffView'
import { draftValue, fieldsFromEffective } from './draft'
import EditorChrome from './EditorChrome'
import { useConfigEditor, type EditorTarget, type Writer } from './useConfigEditor'
import { Note } from './ui'

export const MAX_FALLBACKS = 4

/** 순서 조작(순수) — 위로·아래로·빼기·넣기. 범위 밖이면 그대로. */
export function moveItem(order: readonly string[], i: number, dir: -1 | 1): string[] {
  const j = i + dir
  if (i < 0 || i >= order.length || j < 0 || j >= order.length) return [...order]
  const next = [...order]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function removeItem(order: readonly string[], i: number): string[] {
  if (order.length <= 1) return [...order]
  return order.filter((_, k) => k !== i)
}

export function addItem(order: readonly string[], id: string): string[] {
  if (order.includes(id) || order.length >= MAX_FALLBACKS + 1) return [...order]
  return [...order, id]
}

const ICON = {
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  minus: 'M6 12h12',
}

function IconBtn({ d, label, disabled, onClick }: { d: string; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="grid h-11 w-11 flex-none place-items-center rounded-xl text-ink disabled:opacity-30">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </button>
  )
}

function Editor({
  role,
  policy,
  eff,
  conns,
  access,
  reload,
  onEnd,
}: {
  role: EngineRoleName
  policy: FallbackPolicyDto
  eff: EffectiveConfigDto
  conns: EngineConnectionDto[]
  access: ConfigAccess
  reload: () => void
  onEnd: () => void
}) {
  const env = useConsoleEnv()
  const toast = useConsoleToast()
  const target: EditorTarget = { ref: { scope: 'FALLBACK_POLICY', targetId: policy.id }, name: `${role} 예비 순서`, baseVersion: eff.edit?.version ?? policy.version ?? 0, fields: fieldsFromEffective(eff, access.production) }
  const primaryF = target.fields.find((f) => f.key === 'primaryConnectionId')
  const fallbackF = target.fields.find((f) => f.key === 'fallbackConnectionIds')
  const writer = useCallback<Writer>(
    ({ patch, meta }) => {
      const body: { primaryConnectionId?: string; fallbackConnectionIds?: string[] } = {}
      if (typeof patch.primaryConnectionId === 'string') body.primaryConnectionId = patch.primaryConnectionId
      if (Array.isArray(patch.fallbackConnectionIds)) body.fallbackConnectionIds = patch.fallbackConnectionIds.filter((x): x is string => typeof x === 'string')
      return api.updateFallback(role, body, meta)
    },
    [role],
  )
  const e = useConfigEditor({
    target,
    access: { ...access, canApply: access.canApplyConn, needsConfirm: access.canApplyConn && access.production },
    writer,
    onApplied: (r) => {
      toast(r.changed ? `예비 순서를 적용했어요 · v${r.version?.version}${r.baselineVersion ? ' (기준선 v1 함께)' : ''}` : '바뀐 값이 없어 적용하지 않았어요')
      reload()
    },
    onReload: reload,
  })
  const [endAsk, setEndAsk] = useState(false)
  if (!primaryF || !fallbackF) return <Note tone="bad">편집 정책을 불러오지 못했어요.</Note>
  const primary = draftValue(e.draft, primaryF)
  const fallbacks = draftValue(e.draft, fallbackF)
  const order = [typeof primary === 'string' ? primary : '', ...(Array.isArray(fallbacks) ? fallbacks.filter((x): x is string => typeof x === 'string') : [])].filter(Boolean)
  const setOrder = (next: string[]) => {
    e.setField(primaryF, next[0] ?? null)
    e.setField(fallbackF, next.slice(1))
  }
  const byId = new Map(conns.map((c) => [c.id, c]))
  const nameOf = (id: string) => byId.get(id)?.name ?? id
  const namer: ValueNamer = (key, v) => {
    if (key === 'primaryConnectionId' && typeof v === 'string') return nameOf(v)
    if (key === 'fallbackConnectionIds' && Array.isArray(v)) return v.length ? v.map((x) => nameOf(String(x))).join(' → ') : '없음'
    return null
  }
  const addable = conns.filter((c) => c.role === role && !order.includes(c.id))
  const n = order.length
  const end = () => (e.count ? setEndAsk(true) : onEnd())
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-[15px] font-semibold">예비 연결 순서 · 편집 중</h3>
        <button type="button" onClick={end} className="-my-2 inline-flex min-h-11 flex-none items-center px-1 text-[13px] font-medium text-accent">
          편집 끝내기
        </button>
      </div>
      <AppliedNote r={e.applied} />
      {e.flow.d && e.diff ? (
        <div className="mb-2.5 rounded-[14px] bg-surface2 p-3.5">
          <h3 className="text-[15px] font-semibold">변경 요약</h3>
          <SummaryChips s={summaryOf(e.diff)} testRequired={access.production ? e.diff.testRequired : null} />
          <DiffList changes={e.diff.changes} namer={namer} />
        </div>
      ) : null}
      {e.test ? <ConfigTestCard test={e.test} at={e.testAt} production={access.production} canTrace={access.canTrace} /> : null}
      {Object.keys(e.errors).length ? (
        <Note tone="bad" role="alert" className="mb-2.5 mt-2.5">
          {Object.values(e.errors).map((x) => (
            <p key={x.key}>{x.message}</p>
          ))}
        </Note>
      ) : null}
      <ol aria-label="예비 연결 순서(편집)" className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {order.map((id, i) => {
          const c = byId.get(id)
          const name = nameOf(id)
          return (
            <li key={id} className="flex min-h-[60px] min-w-0 items-center gap-1.5 py-1.5 pl-3 pr-1.5">
              <span className="w-10 flex-none text-[12px] font-semibold text-ink2">
                {i === 0 ? '기본' : '예비'}
                <b className="block font-mono text-[14px] text-ink">{i + 1}</b>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-tight [overflow-wrap:anywhere]">{name}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-mono text-[12px] text-ink2">{c?.key ?? id}</span>
                  {c ? <StatusBadge value={c.enabled ? c.status : 'DISABLED'} /> : null}
                </span>
              </span>
              <IconBtn d={ICON.up} label={`${name} 위로`} disabled={i === 0} onClick={() => setOrder(moveItem(order, i, -1))} />
              <IconBtn d={ICON.down} label={`${name} 아래로`} disabled={i === n - 1} onClick={() => setOrder(moveItem(order, i, 1))} />
              {n > 1 ? <IconBtn d={ICON.minus} label={`${name} 빼기`} disabled={false} onClick={() => setOrder(removeItem(order, i))} /> : null}
            </li>
          )
        })}
      </ol>
      {n === 1 ? <p className="mt-1.5 text-[12px] text-ink2 break-keep">마지막 연결은 뺄 수 없어요 — 빼면 이 기능이 멈춰요.</p> : null}
      <p className="mt-1.5 text-[12px] text-ink2 break-keep">맨 위가 기본 연결이에요. 예비는 {MAX_FALLBACKS}개까지. 순서를 바꾸면 엄격 키라 운영에서는 최고관리자가 직접 적용해요.</p>
      {addable.length ? (
        <section className="mt-[18px] min-w-0">
          <h3 className="mb-2 text-[15px] font-semibold">넣을 수 있는 연결</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
            {addable.map((c) => (
              <li key={c.id} className="flex min-h-[56px] min-w-0 items-center gap-3 px-3.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{c.name}</span>
                  <span className="block truncate font-mono text-[12px] text-ink2">{c.key}</span>
                  {!c.enabled ? (
                    <span className="block text-[12px] text-ink2">
                      꺼진 연결은 넣을 수 없어요 ·{' '}
                      <Link href={`/admin/connections/${encodeURIComponent(c.id)}`} className="inline-flex min-h-11 items-center font-medium text-accent">
                        연결 상세에서 켜기 ›
                      </Link>
                    </span>
                  ) : null}
                </span>
                <StatusBadge value={c.enabled ? c.status : 'DISABLED'} />
                {c.enabled && n < MAX_FALLBACKS + 1 ? (
                  <button type="button" onClick={() => setOrder(addItem(order, c.id))} className="inline-flex h-11 flex-none items-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink">
                    넣기
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-2 text-[12px] text-ink2">{policy.retryOnce ? '실패하면 다음 연결로 한 번 다시 시도해요' : '실패해도 다른 연결로 넘기지 않아요'} (이 설정은 라우터가 읽지 않아 여기서 바꾸지 않아요)</p>
      <EditorChrome editor={e} access={{ ...access, canApply: access.canApplyConn, needsConfirm: access.canApplyConn && access.production }} env={env} targetName={target.name} scopeLabel="예비 순서" baseVersion={target.baseVersion} showBar namer={namer} />
      <ConfirmDropSheet
        open={endAsk}
        title="편집을 끝낼까요?"
        text={`바꾼 순서가 사라져요. 저장된 설정은 그대로예요.`}
        go="버리고 끝내기"
        onGo={() => {
          setEndAsk(false)
          e.discard()
          onEnd()
        }}
        onClose={() => setEndAsk(false)}
      />
    </>
  )
}

export default function FallbackEditor(p: { role: EngineRoleName; policy: FallbackPolicyDto; conns: EngineConnectionDto[]; access: ConfigAccess; reloadPolicy: () => void; onEnd: () => void }) {
  const eff = useAdminResource<EffectiveConfigDto>(api.effectivePath('FALLBACK_POLICY', p.policy.id))
  if (eff.status === 'loading' || eff.status === 'idle') return <ConsoleLoading />
  if (eff.status === 'error' && eff.err) return <LoadError err={eff.err} name="편집 정책" onRetry={eff.reload} />
  return (
    <Editor
      role={p.role}
      policy={p.policy}
      eff={eff.data!}
      conns={p.conns}
      access={p.access}
      reload={() => {
        eff.reload()
        p.reloadPolicy()
      }}
      onEnd={p.onEnd}
    />
  )
}
