'use client'

/**
 * 이력 `/admin/history`(task-012c D-C8, 승인 데모 v2 — 새 화면): [설정 버전 | 감사 기록] + 발음 사전 버전 기록(기존 화면) 링크.
 * 설정 버전(#108): 대상 칩(전체 + 불러온 버전의 대상) · 행 → 상세 시트(#108a 비교 · #109 되돌리기). 되돌리기는 새 버전을 만든다(기록은 지우지 않는다).
 * 주소: `?tab=audit` · `?scope=&target=`(대상 고정 — 설정 화면 "버전 기록 ›") · `?v=<버전 id>`(상세 시트가 열린 채로).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { useNow } from '@/components/common/useNow'
import type { ConfigEditScopeName, ConfigVersionItemDto, ConfigVersionDetailDto } from '@/types/admin'
import { ChipRadio, type ChipOption } from '../console/ChipRadio'
import { useCan, useConsoleEnv, useConsoleToast } from '../console/ConsoleProvider'
import ConsoleSegmented from '../console/ConsoleSegmented'
import { ConsoleError, EmptyNote, loadErrorText } from '../console/ConsoleStates'
import { useAdminResource } from '../console/useAdminResource'
import * as api from '../configEditor/configApi'
import { configAccess } from '../configEditor/configAccess'
import { DamagedBadge, NeutralTag, VersionStatusBadge } from '../configEditor/ui'
import AuditTab from './AuditTab'
import ConfigVersionRow from './ConfigVersionRow'
import ConfigVersionSheet from './ConfigVersionSheet'
import { type HistoryTab, historyHref, versionTargetOptions, type VersionTargetOption } from './historyQuery'
import { usePaged } from './usePaged'

function StatusLegend() {
  return (
    <details className="group mt-1">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block text-ink2 group-open:rotate-90">
          ▸
        </span>
        상태 뜻
      </summary>
      <ul className="grid gap-1.5 text-[12.5px] text-ink2">
        <li className="flex items-center gap-2">
          <VersionStatusBadge status="ACTIVE" />
          지금 적용 중
        </li>
        <li className="flex items-center gap-2">
          <VersionStatusBadge status="SUPERSEDED" />
          새 버전에 밀려났어요
        </li>
        <li className="flex items-center gap-2">
          <VersionStatusBadge status="ROLLED_BACK" />
          되돌리기로 밀려난 버전이에요
        </li>
        <li className="flex items-center gap-2">
          <NeutralTag>기준선</NeutralTag>첫 적용 직전 값 — 처음 상태로 되돌릴 때 써요
        </li>
        <li className="flex items-center gap-2">
          <DamagedBadge integrity="MALFORMED" />
          기록이 깨져 비교·되돌리기를 할 수 없어요
        </li>
      </ul>
    </details>
  )
}

function VersionsTab({ pinned, onOpen }: { pinned: VersionTargetOption | null; onOpen: (v: ConfigVersionItemDto) => void }) {
  const now = useNow(true, 30_000)
  const [picked, setPicked] = useState<string>(pinned?.value ?? 'all')
  const [known, setKnown] = useState<VersionTargetOption[]>(() => (pinned ? [pinned] : []))
  const sel = known.find((k) => k.value === picked) ?? null
  const pathFor = useCallback((cursor: string | null) => api.versionsPath({ scope: sel?.scope ?? null, targetId: sel?.targetId ?? null, cursor }), [sel?.scope, sel?.targetId])
  const list = usePaged<ConfigVersionItemDto>(pathFor)
  // 전체 목록에서 본 대상은 칩으로 남긴다(좁힌 뒤에도 다른 대상으로 옮길 수 있게).
  const options = useMemo(() => versionTargetOptions(list.items, null), [list.items])
  const merged = useMemo(() => {
    const m = new Map(known.map((k) => [k.value, k]))
    // 같은 대상이면 서버가 준 이름이 이긴다(주소로 들어온 대상은 처음에 id 로만 안다).
    for (const o of options) m.set(o.value, o)
    return Array.from(m.values())
  }, [known, options])
  const chips: ChipOption<string>[] = [{ value: 'all', label: '전체' }, ...merged.map((o) => ({ value: o.value, label: o.label }))]
  return (
    <>
      <p className="mt-3 text-[13px] text-ink2 break-keep">
        설정을 적용할 때마다 버전이 남아요. 되돌리기는 과거 버전 내용으로 <b className="text-ink">새 버전</b>을 만들어요(기록은 지우지 않아요).
      </p>
      <StatusLegend />
      <div className="mt-1">
        <ChipRadio
          ariaLabel="대상"
          options={chips}
          value={picked}
          onChange={(v) => {
            setKnown(merged)
            setPicked(v)
          }}
        />
      </div>
      {list.err && list.items.length === 0 ? (
        <div className="mt-2.5">
          <ConsoleError message={loadErrorText(list.err, '버전 기록')} onRetry={list.reload} />
        </div>
      ) : list.loading ? (
        <p role="status" className="py-8 text-center text-[13px] text-ink2">
          불러오는 중…
        </p>
      ) : list.items.length === 0 ? (
        <div className="mt-2.5">
          <EmptyNote>
            아직 설정 버전이 없어요.
            <br />
            처음 적용하면 그 전 값이 기준선 v1 로, 적용한 값이 v2 로 남아요.
          </EmptyNote>
        </div>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
            {list.items.map((v) => (
              <ConfigVersionRow key={v.id} v={v} now={now} showTarget={picked === 'all'} onOpen={(x) => onOpen(x)} />
            ))}
          </ul>
          {list.err ? (
            <div className="mt-2">
              <ConsoleError message={loadErrorText(list.err, '버전 기록')} onRetry={list.loadMore} />
            </div>
          ) : null}
          {list.nextCursor ? (
            <button type="button" aria-busy={list.loadingMore || undefined} disabled={list.loadingMore} onClick={list.loadMore} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface text-[14px] font-semibold text-ink disabled:opacity-60">
              {list.loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          ) : null}
        </>
      )}
    </>
  )
}

/** 버전 id 로 연 상세(감사 기록의 [버전 보기] · 주소 `?v=`) — 상세를 읽어 시트 머리 정보를 만든다. 못 읽으면 같은 시트 자리에 안내. */
function VersionById({ id, onClose, render }: { id: string; onClose: () => void; render: (v: ConfigVersionItemDto) => React.ReactNode }) {
  const res = useAdminResource<ConfigVersionDetailDto>(api.versionPath(id, 'previous'))
  if (res.status === 'loading' || res.status === 'idle') return null
  if (res.status === 'error' && res.err) {
    const text = res.err.status === 404 ? '그 버전을 찾을 수 없어요.' : res.err.status === 422 ? '기록이 손상돼 이 버전을 열 수 없어요.' : '버전 정보를 불러오지 못했어요.'
    return (
      <Sheet open title="설정 버전" onClose={onClose}>
        <p className="text-[14px] break-keep">{text}</p>
        <div className="mt-3 flex">
          <button type="button" onClick={onClose} className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink">
            닫기
          </button>
        </div>
      </Sheet>
    )
  }
  return res.data ? <>{render(res.data)}</> : null
}

export default function HistoryScreen({ initialTab, initialScope, initialTarget, initialV }: { initialTab: HistoryTab; initialScope: ConfigEditScopeName | null; initialTarget: string | null; initialV: string | null }) {
  const router = useRouter()
  const can = useCan()
  const env = useConsoleEnv()
  const toast = useConsoleToast()
  const access = configAccess(can, env)
  const [tab, setTab] = useState<HistoryTab>(initialTab)
  const [openV, setOpenV] = useState<ConfigVersionItemDto | null>(null)
  const [byId, setById] = useState<string | null>(initialV)
  const [listKey, setListKey] = useState(0)
  const pinned: VersionTargetOption | null = initialScope && initialTarget ? { value: `${initialScope}:${initialTarget}`, label: initialTarget, scope: initialScope, targetId: initialTarget } : null
  const changeTab = (t: HistoryTab) => {
    setTab(t)
    router.replace(historyHref({ tab: t, scope: initialScope, target: initialTarget }), { scroll: false })
  }
  const close = () => {
    setOpenV(null)
    setById(null)
  }
  const sheet = (v: ConfigVersionItemDto) => (
    <ConfigVersionSheet
      key={v.id}
      v={v}
      access={access}
      onClose={close}
      onRolledBack={(r) => {
        close()
        toast(`되돌렸어요 · v${r.restoredFromVersion} 내용으로 v${r.version?.version}`)
        setListKey((k) => k + 1)
      }}
    />
  )
  return (
    <>
      <ConsoleSegmented
        ariaLabel="이력 보기"
        options={[
          { value: 'versions' as const, label: '설정 버전' },
          { value: 'audit' as const, label: '감사 기록' },
        ]}
        value={tab}
        onChange={changeTab}
      />
      {can('voices.read') ? (
        <Link href="/admin/speech/tts/lexicon/versions" className="mt-2.5 flex min-h-[52px] min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px]">발음 사전 버전 기록 ›</span>
            <span className="block truncate text-[12px] text-ink2">사전은 자체 버전으로 따로 남아요(기존 화면)</span>
          </span>
        </Link>
      ) : null}
      {tab === 'versions' ? (
        <VersionsTab key={listKey} pinned={pinned} onOpen={(v) => setOpenV(v)} />
      ) : (
        <AuditTab
          access={access}
          env={env}
          onVersion={(id) => {
            setOpenV(null)
            setById(id)
          }}
        />
      )}
      {openV ? sheet(openV) : null}
      {byId ? <VersionById key={byId} id={byId} onClose={close} render={sheet} /> : null}
    </>
  )
}
