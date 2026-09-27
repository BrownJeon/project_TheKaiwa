'use client'

/**
 * 진단(screens.md §6-2 J): Health 기록(#95a, 연결 칩) · 요청 Trace(#128, `trace.read` 만).
 * `trace.read` 가 없으면 탭 없이 Health 기록만 — `?tab=traces` 는 무시한다. 탭·연결은 URL, 필터는 URL 에 넣지 않는다.
 * Trace 필터를 빨리 바꾸면 요청이 겹친다 — abort + 요청 번호 비교로 늦게 온 옛 응답을 버린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, isAbort } from '@/components/common/api'
import { type Err, toErr } from '@/components/common/errors'
import { Btn } from '@/components/common/ui'
import { useNow } from '@/components/common/useNow'
import type { AdminPage, EngineConnectionDto, TraceKindName, TraceListItemDto, TraceStatusName } from '@/types/admin'
import { ChipRadio, type ChipOption } from '../console/ChipRadio'
import { sortConnections } from '../console/connectionText'
import { useCan } from '../console/ConsoleProvider'
import ConsoleSegmented from '../console/ConsoleSegmented'
import { ConsoleLoading, EmptyNote, LoadError } from '../console/ConsoleStates'
import HealthHistoryList from '../console/HealthHistoryList'
import { useAdminResource } from '../console/useAdminResource'
import TraceRow from './TraceRow'

type Tab = 'health' | 'traces'
type Period = '24h' | '7d' | '30d'
type KindFilter = 'ALL' | TraceKindName
type StatusFilter = 'ALL' | TraceStatusName

const PERIOD_MS: Record<Period, number> = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 }
const PERIOD_OPTIONS = [
  { value: '24h' as const, label: '24시간' },
  { value: '7d' as const, label: '7일' },
  { value: '30d' as const, label: '30일' },
]
const KIND_OPTIONS: ChipOption<KindFilter>[] = [
  { value: 'ALL', label: '전체' },
  { value: 'TURN', label: '회화 턴' },
  { value: 'FUNCTIONAL_TEST', label: '기능 테스트' },
  { value: 'PREVIEW', label: '미리듣기' },
  { value: 'PLAYGROUND', label: '플레이그라운드' },
  { value: 'E2E', label: 'E2E' },
]
const STATUS_OPTIONS = [
  { value: 'ALL' as const, label: '전체' },
  { value: 'OK' as const, label: '정상' },
  { value: 'PARTIAL' as const, label: '일부 실패' },
  { value: 'ERROR' as const, label: '실패' },
]
const TAB_OPTIONS = [
  { value: 'health' as const, label: 'Health 기록' },
  { value: 'traces' as const, label: '요청 Trace' },
]

function HealthTab({ initialConnection, onConnection }: { initialConnection: string | null; onConnection: (id: string) => void }) {
  const conns = useAdminResource<EngineConnectionDto[]>('/api/admin/v1/engine-connections')
  const [picked, setPicked] = useState<string | null>(initialConnection)
  if (conns.status === 'loading' || conns.status === 'idle') return <ConsoleLoading />
  if (conns.status === 'error' && conns.err) return <LoadError err={conns.err} name="연결" onRetry={conns.reload} />
  const list = sortConnections(conns.data ?? [])
  if (list.length === 0) return <EmptyNote>연결이 없어요.</EmptyNote>
  const fallback = list.find((c) => c.enabled && c.status !== 'HEALTHY') ?? list[0]
  const current = list.find((c) => c.id === picked || c.key === picked) ?? fallback
  const options: ChipOption<string>[] = list.map((c) => ({ value: c.id, label: c.key, mono: true }))
  return (
    <>
      <div className="mt-2.5">
        <ChipRadio
          ariaLabel="연결"
          options={options}
          value={current.id}
          onChange={(id) => {
            setPicked(id)
            onConnection(id)
          }}
        />
      </div>
      <HealthHistoryList key={current.id} connectionId={current.id} limit={50} title={`${current.name} 기록`} />
    </>
  )
}

interface TraceState {
  /** 이 상태가 어느 필터 조합의 결과인가 — 지금 필터와 다르면 "불러오는 중"(effect 안에서 상태를 비우지 않기 위해). */
  key: string | null
  items: TraceListItemDto[]
  nextCursor: string | null
  err: Err | null
  loadingMore: boolean
  retrying: boolean
}

function TracesTab() {
  const [period, setPeriod] = useState<Period>('24h')
  const [kind, setKind] = useState<KindFilter>('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const filterKey = `${period}|${kind}|${status}`
  const [st, setSt] = useState<TraceState>({ key: null, items: [], nextCursor: null, err: null, loadingMore: false, retrying: false })
  const reqNo = useRef(0)
  const ctrlRef = useRef<AbortController | null>(null)
  const now = useNow(true, 30_000)

  const fetchPage = useCallback(
    async (cursor: string | null, key: string) => {
      ctrlRef.current?.abort()
      const ctrl = new AbortController()
      ctrlRef.current = ctrl
      const my = ++reqNo.current
      const q = new URLSearchParams({ limit: '50', from: new Date(Date.now() - PERIOD_MS[period]).toISOString() })
      if (kind !== 'ALL') q.set('kind', kind)
      if (status !== 'ALL') q.set('status', status)
      if (cursor) q.set('cursor', cursor)
      try {
        const page = await apiGet<AdminPage<TraceListItemDto>>(`/api/admin/v1/traces?${q.toString()}`, { signal: ctrl.signal })
        if (my !== reqNo.current) return
        setSt((s) => ({
          key,
          items: cursor && s.key === key ? [...s.items, ...page.items] : page.items,
          nextCursor: page.nextCursor,
          err: null,
          loadingMore: false,
          retrying: false,
        }))
      } catch (e) {
        if (isAbort(e) || my !== reqNo.current) return
        const err = toErr(e)
        setSt((s) =>
          cursor && s.key === key
            ? { ...s, loadingMore: false, err }
            : { key, items: [], nextCursor: null, err, loadingMore: false, retrying: false },
        )
      }
    },
    [period, kind, status],
  )

  useEffect(() => {
    void fetchPage(null, filterKey)
    return () => ctrlRef.current?.abort()
  }, [fetchPage, filterKey])

  const current = st.key === filterKey
  const loading = !current || st.retrying
  const failed = current && !st.retrying && st.err !== null && st.items.length === 0 && st.nextCursor === null
  const moreFailed = current && st.err !== null && !failed

  const retry = () => {
    setSt((s) => ({ ...s, retrying: true, err: null }))
    void fetchPage(null, filterKey)
  }
  const more = () => {
    if (!st.nextCursor) return
    setSt((s) => ({ ...s, loadingMore: true, err: null }))
    void fetchPage(st.nextCursor, filterKey)
  }

  return (
    <>
      <div className="mt-2.5">
        <ConsoleSegmented ariaLabel="기간" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>
      <div className="mt-2">
        <ChipRadio ariaLabel="종류" options={KIND_OPTIONS} value={kind} onChange={setKind} />
      </div>
      <div className="mt-2">
        <ConsoleSegmented ariaLabel="결과" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      </div>
      {loading ? <ConsoleLoading /> : null}
      {failed && st.err ? <LoadError err={st.err} name="Trace" onRetry={retry} /> : null}
      {!loading && !failed ? (
        <>
          <p className="mb-1.5 mt-3 text-[12px] text-ink2" aria-live="polite">
            {st.items.length}건{st.nextCursor ? ' 이상' : ''} · 보관 90일
          </p>
          {st.items.length === 0 ? (
            <EmptyNote>이 조건의 기록이 없어요.</EmptyNote>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
              {st.items.map((it) => (
                <TraceRow key={it.traceId} item={it} now={now} />
              ))}
            </ul>
          )}
          {moreFailed ? <p className="mt-2 text-[13px] text-bad">더 불러오지 못했어요. 다시 눌러 주세요.</p> : null}
          {st.nextCursor ? (
            <Btn variant="ghost" className="mt-3 w-full" aria-busy={st.loadingMore} disabled={st.loadingMore} onClick={more}>
              {st.loadingMore ? '불러오는 중…' : '더 보기'}
            </Btn>
          ) : null}
        </>
      ) : null}
    </>
  )
}

export default function DiagnosticsScreen({ initialTab, initialConnection }: { initialTab: string | null; initialConnection: string | null }) {
  const can = useCan()
  const router = useRouter()
  const canTrace = can('trace.read')
  const [tab, setTab] = useState<Tab>(canTrace && initialTab === 'traces' ? 'traces' : 'health')
  const [connection, setConnection] = useState<string | null>(initialConnection)

  const syncUrl = (t: Tab, conn: string | null) => {
    const q = new URLSearchParams()
    if (t === 'traces') q.set('tab', 'traces')
    else if (conn) q.set('connection', conn)
    const qs = q.toString()
    router.replace(`/admin/diagnostics${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <>
      {canTrace ? (
        <ConsoleSegmented
          size="md"
          ariaLabel="진단 보기"
          options={TAB_OPTIONS}
          value={tab}
          onChange={(t) => {
            setTab(t)
            syncUrl(t, connection)
          }}
        />
      ) : null}
      {tab === 'traces' && canTrace ? (
        <TracesTab />
      ) : (
        <HealthTab
          initialConnection={connection}
          onConnection={(id) => {
            setConnection(id)
            syncUrl('health', id)
          }}
        />
      )}
    </>
  )
}
