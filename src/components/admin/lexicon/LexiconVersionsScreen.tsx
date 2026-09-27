'use client'

/**
 * 버전 기록(screens.md §10-2 I·§10-3 E) — `/admin/speech/tts/lexicon/versions`. 첫 쪽은 `useAdminResource`, [더 보기]는 이어 붙이고
 * 요청 번호로 늦은 응답을 버린다. 상세 시트는 URL `?v=` 로 열려 새로 고침해도 다시 열린다.
 */
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { Btn } from '@/components/common/ui'
import { useNow } from '@/components/common/useNow'
import type { LexiconRollbackResultDto, LexiconVersionDto, LexiconVersionListDto } from '@/types/lexicon'
import { useConsoleToast } from '../console/ConsoleProvider'
import { BackLink, ConsoleError, ConsoleLoading, EmptyNote, LoadError, loadErrorText } from '../console/ConsoleStates'
import { formatAgo } from '../console/format'
import RefreshLine from '../console/RefreshLine'
import { useAdminResource } from '../console/useAdminResource'
import { VersionStatusBadge } from './Badges'
import { versionsPath } from './lexiconApi'
import { actorLabel, rollbackToast, VERSION_STATUS_DESC } from './lexiconCopy'
import { useLexiconAccess } from './useLexiconAccess'
import VersionDetailSheet from './VersionDetailSheet'

const PATH = '/admin/speech/tts/lexicon/versions'

const noopSubscribe = () => () => undefined

/**
 * 하이드레이션이 끝났는가(서버·첫 하이드레이션 렌더 = false). 공용 `Sheet` 는 서버에서 아무것도 그리지 않으므로(`document` 없음)
 * `?v=` 로 열린 채 시작하는 시트는 하이드레이션 뒤에만 그린다 — 그러지 않으면 서버 HTML 과 어긋난다.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

interface More {
  base: number | null
  items: LexiconVersionDto[]
  page: number
}

export default function LexiconVersionsScreen({ initialV }: { initialV: number | null }) {
  const router = useRouter()
  const toast = useConsoleToast()
  const access = useLexiconAccess()
  const now = useNow(true, 30_000)
  const first = useAdminResource<LexiconVersionListDto>(versionsPath(1))
  const [more, setMore] = useState<More>({ base: null, items: [], page: 1 })
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const reqNo = useRef(0)
  const [openV, setOpenV] = useState<number | null>(initialV)
  const hydrated = useHydrated()

  // 첫 쪽이 다시 오면(새로 고침·되돌리기 뒤) 이어 붙인 쪽은 버린다.
  const extra = more.base !== null && more.base === first.loadedAt ? more : { base: null, items: [], page: 1 }
  const items = [...(first.data?.items ?? []), ...extra.items.filter((x) => !(first.data?.items ?? []).some((y) => y.version === x.version))]
  const total = first.data?.total ?? 0
  const hasMore = first.data !== null && items.length < total
  const activeVersion = first.data?.activeVersion ?? items.find((v) => v.status === 'ACTIVE')?.version ?? null

  const open = useCallback(
    (v: number | null) => {
      setOpenV(v)
      router.replace(v ? `${PATH}?v=${v}` : PATH, { scroll: false })
    },
    [router],
  )

  const loadMore = async () => {
    if (loadingMore || !first.data) return
    const n = ++reqNo.current
    const base = first.loadedAt
    const page = extra.page + 1
    setLoadingMore(true)
    setMoreError(null)
    try {
      const res = await apiGet<LexiconVersionListDto>(versionsPath(page))
      if (n !== reqNo.current || base !== first.loadedAt) return
      setMore({ base, items: [...extra.items, ...res.items], page })
    } catch (e) {
      if (isAbort(e) || n !== reqNo.current) return
      setMoreError(loadErrorText(toErr(e), '버전 기록'))
    } finally {
      if (n === reqNo.current) setLoadingMore(false)
    }
  }

  const onRolledBack = (res: LexiconRollbackResultDto, target: number) => {
    open(null)
    reqNo.current++
    setMore({ base: null, items: [], page: 1 })
    first.reload()
    toast(rollbackToast(target, res.version.version))
  }

  return (
    <>
      <BackLink href="/admin/speech/tts/lexicon">발음 사전</BackLink>
      <h2 className="text-[17px] font-semibold">버전 기록</h2>
      <p className="text-[13px] text-ink2 break-keep">
        {access.env} 사전의 모든 변경이 버전으로 남아요. 되돌리기는 과거 버전 내용으로 새 버전을 만들어요(기록은 지우지 않아요).
      </p>
      <details>
        <summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">상태 뜻</summary>
        <ul className="grid gap-1 text-[12.5px] text-ink2">
          {(['ACTIVE', 'SUPERSEDED', 'ROLLED_BACK'] as const).map((s) => (
            <li key={s} className="flex min-w-0 items-center gap-2">
              <VersionStatusBadge status={s} />
              <span className="break-keep">{VERSION_STATUS_DESC[s]}</span>
            </li>
          ))}
        </ul>
      </details>
      <RefreshLine loadedAt={first.loadedAt} reloading={first.reloading} onReload={first.reload} />
      {first.status === 'loading' && !first.data ? (
        <ConsoleLoading />
      ) : first.err && !first.data ? (
        <LoadError err={first.err} name="버전 기록" onRetry={first.reload} />
      ) : items.length === 0 ? (
        <EmptyNote>아직 버전이 없어요.</EmptyNote>
      ) : (
        <>
          {first.err ? <ConsoleError message={loadErrorText(first.err, '버전 기록')} onRetry={first.reload} /> : null}
          <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
            {items.map((v) => (
              <li key={v.version}>
                <button type="button" onClick={() => open(v.version)} className="flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 px-3.5 py-2.5 text-left">
                  <span className="flex w-full min-w-0 items-center gap-2">
                    <span className="font-mono text-[15px] font-semibold">v{v.version}</span>
                    <VersionStatusBadge status={v.status} />
                    <span className="ml-auto text-[12px] tabular-nums text-ink2">{formatAgo(v.createdAt, now)}</span>
                  </span>
                  <span className="w-full min-w-0 truncate text-[14px]">{v.changeSummary ?? '요약 없음'}</span>
                  <span className="flex w-full min-w-0 gap-2 text-[12px] text-ink2">
                    <span className="min-w-0 flex-1 truncate">
                      {actorLabel(v.actor)} · 항목 {v.entryCount}개(사용 중 {v.enabledCount})
                    </span>
                    <span aria-hidden="true">›</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {moreError ? (
            <div className="mt-2">
              <ConsoleError message={moreError} onRetry={() => void loadMore()} />
            </div>
          ) : null}
          {hasMore ? (
            <Btn variant="ghost" className="mt-3 w-full" aria-busy={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? '불러오는 중…' : '더 보기'}
            </Btn>
          ) : null}
        </>
      )}
      {hydrated && openV !== null ? (
        <VersionDetailSheet
          key={openV}
          version={openV}
          activeVersion={activeVersion}
          access={access}
          onClose={() => open(null)}
          onRolledBack={onRolledBack}
          onReloadList={first.reload}
        />
      ) : null}
    </>
  )
}
