'use client'

/**
 * 발음 사전 목록 화면(screens.md §10-2 A·§10-3 A) — `/admin/speech/tts/lexicon`.
 * 필터·쪽은 URL 쿼리(서버 page 가 검증해 `initialParams`, 여기서는 `router.replace`). 쓰기 버튼은 권한 4갈래로 숨긴다(서버가 진실).
 * `baseVersion` = 목록의 사용 중 번호와 마지막 쓰기·충돌 응답 번호 중 큰 값 — 버전은 늘 커지므로 목록 재조회를 기다리지 않고
 * 곧바로 다음 저장에 쓸 수 있다(기다리면 연속 저장이 헛 409 가 된다).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet } from '@/components/common/api'
import type { AdminVoiceDto } from '@/types/admin'
import type { LexiconEntryDto, LexiconImportResultDto, LexiconListDto, LexiconWriteResultDto } from '@/types/lexicon'
import { useConsoleToast } from '../console/ConsoleProvider'
import { ConsoleError, ConsoleLoading, EmptyNote, LoadError, loadErrorText } from '../console/ConsoleStates'
import RefreshLine from '../console/RefreshLine'
import { useAdminResource } from '../console/useAdminResource'
import { useNow } from '@/components/common/useNow'
import { EMPTY_ALL_READ, EMPTY_ALL_WRITE, EMPTY_FILTERED, importToast, INTRO, LIST_FOOT, NO_CHANGE_TOAST, NOTE, RULES, savedToast } from './lexiconCopy'
import LexiconEntrySheet from './LexiconEntrySheet'
import LexiconExportSheet from './LexiconExportSheet'
import LexiconFilters from './LexiconFilters'
import LexiconImportSheet from './LexiconImportSheet'
import LexiconActions from './LexiconActions'
import LexiconList, { Pager } from './LexiconList'
import { isFiltered, LEXICON_PAGE_SIZE, type LexiconParams, patchParams, toQuery } from './lexiconParams'
import { listPath } from './lexiconApi'
import LexiconSentenceCheck from './LexiconSentenceCheck'
import LexiconSummaryCard from './LexiconSummaryCard'
import { useLexiconAccess } from './useLexiconAccess'
import type { EntryWriteKind } from './useLexiconForm'

const PATH = '/admin/speech/tts/lexicon'

export function RulesNote() {
  return (
    <details className="mt-1">
      <summary className="flex h-11 cursor-pointer items-center text-[13px] font-medium">적용 규칙</summary>
      <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-ink2 break-keep">
        <li>{RULES[0]}</li>
        <li>
          한 문장 안에서는 긴 표기가 먼저예요(<span lang="ja">日本橋駅</span> 이 <span lang="ja">日本橋</span> 보다 먼저). 길이가 같으면 우선순위가 큰 쪽이에요.
        </li>
        <li>{RULES[2]}</li>
        <li>{RULES[3]}</li>
      </ul>
    </details>
  )
}

interface SheetState {
  key: number
  mode: 'add' | 'edit' | 'view'
  entry: LexiconEntryDto | null
}

export default function LexiconScreen({ initialParams }: { initialParams: LexiconParams }) {
  const router = useRouter()
  const toast = useConsoleToast()
  const access = useLexiconAccess()
  const now = useNow(true, 30_000)
  const [params, setParamsState] = useState<LexiconParams>(initialParams)
  const list = useAdminResource<LexiconListDto>(listPath(params))
  const voicesRes = useAdminResource<AdminVoiceDto[]>('/api/admin/v1/voices')
  const voices = voicesRes.data ?? []
  const [knownVersion, setKnownVersion] = useState<number | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const listVersion = list.data?.dictionaryVersion ?? null
  const baseVersion = listVersion === null && knownVersion === null ? null : Math.max(listVersion ?? 0, knownVersion ?? 0)

  const setParams = useCallback((patch: Partial<LexiconParams>) => setParamsState((p) => patchParams(p, patch)), [])

  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / LEXICON_PAGE_SIZE))
  // 항목을 끄고 "꺼진 항목 포함"을 해제하면 지금 쪽이 비어 버릴 수 있다 → 마지막 쪽으로(렌더 중 조정 — 새 쪽을 읽으면 조건이 풀린다).
  if (list.data && params.page > pages) setParamsState((p) => ({ ...p, page: pages }))

  // 주소창은 params 를 따라간다(새로 고침·뒤로 가기 보존). 같은 주소면 바꾸지 않는다(서버 컴포넌트를 다시 부르지 않게).
  useEffect(() => {
    const q = toQuery(params)
    if (window.location.search !== q) router.replace(`${PATH}${q}`, { scroll: false })
  }, [params, router])

  const voiceName = (id: string) => voices.find((v) => v.id === id)?.displayName ?? null

  const openEntry = (e: LexiconEntryDto) => setSheet({ key: Date.now(), mode: access.canWrite ? 'edit' : 'view', entry: e })
  const closeSheet = () => setSheet(null)

  const onSaved = (res: LexiconWriteResultDto, kind: EntryWriteKind) => {
    setKnownVersion(res.version.version)
    setSheet(null)
    list.reload()
    toast(savedToast(kind, res.version.version, res.revived === true))
  }

  /** 409 [새로 불러오기]: 목록을 다시 읽고 시트의 항목을 최신 값으로(입력은 그대로). */
  const reloadForSheet = () => {
    list.reload()
    const id = sheet?.entry?.id
    if (!id) return
    void apiGet<LexiconEntryDto>(`/api/admin/v1/lexicon/${encodeURIComponent(id)}`)
      .then((fresh) => setSheet((s) => (s && s.entry?.id === fresh.id ? { ...s, entry: fresh } : s)))
      .catch(() => undefined)
  }

  const onApplied = (res: LexiconImportResultDto) => {
    setImportOpen(false)
    if (res.version) setKnownVersion(res.version.version)
    list.reload()
    if (res.applied && res.version) toast(importToast(res.version.version, res.counts))
    else toast(NO_CHANGE_TOAST)
  }

  const filtered = isFiltered(params)
  const items = list.data?.items ?? []

  return (
    <>
      <p className="text-[13px] text-ink2 break-keep">{INTRO}</p>
      <RulesNote />
      <LexiconSummaryCard list={list.data} env={access.env} now={now} />
      {access.note ? <p role="note" className="mt-2 rounded-xl bg-surface2 px-3 py-2 text-[13px] text-ink break-keep">{NOTE[access.note]}</p> : null}
      <LexiconActions
        access={access}
        onAdd={() => setSheet({ key: Date.now(), mode: 'add', entry: null })}
        onImport={() => setImportOpen(true)}
        onExport={() => setExportOpen(true)}
      />
      {access.canPreview ? <LexiconSentenceCheck voices={voices} /> : null}
      <LexiconFilters params={params} voices={voices} onChange={setParams} />
      <div className="mt-1">
        <RefreshLine loadedAt={list.loadedAt} reloading={list.reloading} onReload={list.reload} />
      </div>
      {list.status === 'loading' && !list.data ? (
        <ConsoleLoading />
      ) : list.err && !list.data ? (
        <LoadError err={list.err} name="발음 사전" onRetry={list.reload} />
      ) : (
        <>
          {list.err ? <ConsoleError message={loadErrorText(list.err, '발음 사전')} onRetry={list.reload} /> : null}
          <p aria-live="polite" className="mb-1.5 mt-1 text-[12px] text-ink2">
            {total}개{filtered ? ' · 조건에 맞는 항목' : ''}
          </p>
          {items.length === 0 ? (
            <EmptyNote>{filtered ? EMPTY_FILTERED : access.canWrite ? EMPTY_ALL_WRITE : EMPTY_ALL_READ}</EmptyNote>
          ) : (
            <LexiconList items={items} total={total} page={params.page} pageSize={LEXICON_PAGE_SIZE} canWrite={access.canWrite} voiceName={voiceName} now={now} onOpen={openEntry} />
          )}
          <Pager
            page={params.page}
            pageSize={LEXICON_PAGE_SIZE}
            total={total}
            onPage={(n) => {
              setParams({ page: n })
              document.querySelector('[data-app-shell] main')?.scrollTo({ top: 0 })
            }}
          />
          <p className="mt-3 text-[12px] text-ink2 break-keep">{LIST_FOOT}</p>
        </>
      )}

      {sheet ? (
        <LexiconEntrySheet
          key={sheet.key}
          initialMode={sheet.mode}
          entry={sheet.entry}
          baseVersion={baseVersion}
          voices={voices}
          access={access}
          onClose={closeSheet}
          onSaved={onSaved}
          onNoChange={() => {
            setSheet(null)
            toast(NO_CHANGE_TOAST)
          }}
          onReload={reloadForSheet}
          onConflictVersion={(v) => setKnownVersion((k) => Math.max(k ?? 0, v))}
          onOpenExisting={(existing, fallback) => {
            if (existing) setSheet({ key: Date.now(), mode: access.canWrite ? 'edit' : 'view', entry: existing })
            else {
              setSheet(null)
              setParams({ q: fallback.surface, scope: fallback.scope ?? 'ALL', inactive: true })
            }
          }}
          onRefreshList={() => {
            setSheet(null)
            list.reload()
          }}
          toast={toast}
        />
      ) : null}
      {importOpen ? (
        <LexiconImportSheet
          needsConfirm={access.needsConfirm}
          onClose={() => setImportOpen(false)}
          onApplied={onApplied}
          onRefreshList={() => {
            setImportOpen(false)
            list.reload()
          }}
        />
      ) : null}
      {exportOpen ? (
        <LexiconExportSheet
          env={access.env}
          dictionaryVersion={baseVersion}
          total={list.data ? list.data.counts.enabled + list.data.counts.disabled : null}
          onClose={() => setExportOpen(false)}
          toast={toast}
        />
      ) : null}
    </>
  )
}
