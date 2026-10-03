'use client'

/**
 * 단어장 `/drawer/words`(screens.md §4-2 A·§4-3). 경로는 하나 — 상세·수정·추가는 바텀시트로 열고 페이지를 옮기지 않는다.
 * 다른 화면에서는 `?word=<id>`·`?add=1` 로 들어오고, 시트를 연 뒤 `router.replace` 로 쿼리를 지운다(§4-2 D).
 *
 * 조회 조건(검색·분류·조각·정렬·보관함)이 바뀌면 커서를 지우고 첫 쪽을 읽는다. 분류와 조각은 AND 로 겹친다(task-023 Q1).
 * 보관함을 켜고 끄면 분류는 전체로 돌아가고 조각 선택은 그대로 둔다(조각 값은 보관 여부와 상관없다). 이전 요청은 abort, 늦게 온 옛 응답은
 * 요청 번호로 버린다(§4-10 동시 조회). 추가·수정·보관·삭제는 **서버 응답을 받은 뒤** 반영하고, 정렬·필터 규칙은
 * 화면이 흉내 내지 않고 첫 쪽을 다시 읽는다. 자동 폴링은 없다(마운트·화면 복귀 때만).
 * 머리 줄·빈 화면 안내는 지금 깔린 행을 받아 온 응답의 조건(`list.shown`)으로 그린다 — 개수와 조건이 늘 같은 응답에서 나온다(logic.ts).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import Segmented from '@/components/common/Segmented'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, ErrorBlock, LoadingBlock } from '@/components/common/ui'
import AppBar from '@/components/shell/AppBar'
import type { CategoryCount, WordEntry, WordListPage, WordSort } from '@/types/vocab'
import ArchiveToggle from './ArchiveToggle'
import CategoryChips from './CategoryChips'
import ChunkChips from './ChunkChips'
import { useHydrated, useSeedPack, useStoredPref, VOCAB_KEYS } from './hooks'
import { actionErrorText, listErrorText, seedResultText, WORD_NOT_FOUND } from './labels'
import { listFromPage, listHeader, listWithoutRow, WORD_LIST_INITIAL, type WordListFilter, type WordListState } from './logic'
import { categoryTotals, emptyVariant, normalizeCategories, visibleCategories, WORD_LIMITS } from './validate'
import WordAddSheet from './WordAddSheet'
import WordDetailSheet from './WordDetailSheet'
import WordRow from './WordRow'
import WordSearchBar from './WordSearchBar'
import WordsEmpty from './WordsEmpty'

const SORTS = ['recent', 'wrong', 'surface'] as const satisfies readonly WordSort[]
const SORT_OPTIONS = [
  { value: 'recent', label: '최근 추가' },
  { value: 'wrong', label: '많이 틀린' },
  { value: 'surface', label: '가나다순' },
] as const
const PAGE = 30

type SheetState = { kind: 'add'; key: number; preset?: string } | { kind: 'detail'; id: string; preview?: WordEntry } | null

function listUrl(f: WordListFilter, sort: WordSort, cursor?: string | null): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.category !== null) p.set('category', f.category)
  if (f.chunk) p.set('chunkType', f.chunk)
  p.set('archived', f.archived ? '1' : '0')
  p.set('sort', sort)
  p.set('limit', String(PAGE))
  if (cursor) p.set('cursor', cursor)
  return `/api/v1/words?${p.toString()}`
}

export default function WordsScreen({ initialWordId, initialAdd }: { initialWordId?: string; initialAdd?: boolean }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const toast = useToast()
  const { seed, seeding } = useSeedPack()
  const [sort, setSort] = useStoredPref<WordSort>(VOCAB_KEYS.wordsSort, 'recent', SORTS)
  const [filter, setFilter] = useState<WordListFilter>({ q: '', category: null, chunk: null, archived: false })
  const [qInput, setQInput] = useState('')
  const [qTooLong, setQTooLong] = useState(false)
  const [list, setList] = useState<WordListState>(WORD_LIST_INITIAL)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [categories, setCategories] = useState<CategoryCount[] | null>(null)
  const [catTick, setCatTick] = useState(0)
  const [sheet, setSheet] = useState<SheetState>(() =>
    initialWordId ? { kind: 'detail', id: initialWordId } : initialAdd ? { kind: 'add', key: 0 } : null,
  )
  const reqRef = useRef(0)
  const addKey = useRef(1)

  const openDetail = useCallback((word: WordEntry) => setSheet({ kind: 'detail', id: word.id, preview: word }), [])

  const reloadAll = useCallback(() => {
    setReloadTick((t) => t + 1)
    setCatTick((t) => t + 1)
  }, [])

  // 들어온 쿼리는 시트를 연 것으로 쓰고 지운다(새로고침해도 다시 열리지 않게).
  useEffect(() => {
    if (initialWordId || initialAdd) router.replace('/drawer/words', { scroll: false })
  }, [initialWordId, initialAdd, router])

  useEffect(() => {
    const ctrl = new AbortController()
    const id = ++reqRef.current
    apiGet<WordListPage>(listUrl(filter, sort), { signal: ctrl.signal })
      .then((r) => {
        if (id !== reqRef.current) return
        setList(listFromPage(filter, r))
        setMoreError(null)
      })
      .catch((e: unknown) => {
        if (isAbort(e) || id !== reqRef.current) return
        setList((l) => ({ ...l, status: 'error', error: listErrorText(toErr(e)) }))
      })
    return () => ctrl.abort()
  }, [filter, sort, reloadTick])

  useEffect(() => {
    let cancelled = false
    apiGet<unknown>('/api/v1/words/categories')
      .then((raw) => {
        if (cancelled) return
        const cats = normalizeCategories(raw)
        setCategories(cats)
        // 선택한 칩이 사라졌으면(마지막 단어 삭제·보관) 전체로 돌아간다.
        setFilter((f) =>
          f.category !== null && !visibleCategories(cats, f.archived ? 'archived' : 'active').some((c) => c.category === f.category)
            ? { ...f, category: null }
            : f,
        )
      })
      .catch(() => {
        if (!cancelled) setCategories(null)
      })
    return () => {
      cancelled = true
    }
  }, [catTick])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') reloadAll()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [reloadAll])

  const more = async () => {
    if (!list.nextCursor || loadingMore) return
    const id = reqRef.current
    setLoadingMore(true)
    setMoreError(null)
    try {
      const r = await apiGet<WordListPage>(listUrl(filter, sort, list.nextCursor))
      if (id !== reqRef.current) return
      setList((l) => {
        const have = new Set(l.items.map((w) => w.id))
        return { ...l, items: [...l.items, ...(r.items ?? []).filter((w) => !have.has(w.id))], nextCursor: r.nextCursor ?? null }
      })
    } catch (e) {
      if (id === reqRef.current) setMoreError(listErrorText(toErr(e)))
    } finally {
      setLoadingMore(false)
    }
  }

  const commitSearch = (v: string) => {
    const t = v.trim()
    if (cpLength(t) > WORD_LIMITS.search) {
      setQTooLong(true)
      return
    }
    setQTooLong(false)
    setFilter((f) => (f.q === t ? f : { ...f, q: t }))
  }

  const runSeed = async () => {
    if (seeding) return
    try {
      const r = await seed()
      toast.show(seedResultText(r))
      reloadAll()
    } catch (e) {
      toast.show(actionErrorText(toErr(e)))
    }
  }

  const openAdd = (preset?: string) => {
    setSheet({ kind: 'add', key: addKey.current++, preset })
  }

  const removeRow = (id: string) => setList((l) => listWithoutRow(l, id))

  const catNames = (categories ?? []).flatMap((c) => (c.category ? [c.category] : []))
  const totals = categoryTotals(categories)
  const head = listHeader(list)
  // 빈 화면 안내도 그 응답의 조건으로 — 응답 전에 새 조건의 안내가 먼저 뜨지 않게.
  const shown = list.shown ?? filter
  const showCategoryRow = visibleCategories(categories, filter.archived ? 'archived' : 'active').length > 0
  // 단어가 하나도 없는 단어장(#46 합 0)에서는 거를 것이 없어 조각 줄을 그리지 않는다. 고른 조각이 있으면 풀 수 있게 남긴다.
  const showChunkRow = filter.chunk !== null || !(totals && totals.active + totals.archived === 0)

  let body: React.ReactNode
  if (list.status === 'loading') body = <LoadingBlock />
  else if (list.status === 'error' && list.items.length === 0)
    body = <ErrorBlock message={list.error ?? listErrorText({ status: -1 })} onRetry={() => setReloadTick((t) => t + 1)} />
  else if (list.items.length === 0)
    body = (
      <WordsEmpty
        variant={emptyVariant(shown, totals)}
        q={shown.q}
        category={shown.category}
        chunk={shown.chunk}
        archived={shown.archived}
        seeding={seeding}
        onSeed={() => void runSeed()}
        onAdd={openAdd}
        onShowArchive={() => setFilter((f) => ({ ...f, archived: true, category: null }))}
        onShowAll={() => setFilter((f) => ({ ...f, category: null }))}
        onClearChunk={() => setFilter((f) => ({ ...f, chunk: null }))}
      />
    )
  else
    body = (
      <>
        {list.status === 'error' ? <ErrorBlock message={list.error ?? ''} onRetry={() => setReloadTick((t) => t + 1)} /> : null}
        <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
          {list.items.map((w) => (
            <WordRow key={w.id} word={w} sort={sort} onOpen={openDetail} />
          ))}
        </ul>
        {moreError ? (
          <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
            {moreError}
          </p>
        ) : null}
        {list.nextCursor ? (
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => void more()} aria-busy={loadingMore || undefined}>
            {loadingMore ? '불러오는 중…' : '단어 더 보기'}
          </Btn>
        ) : null}
      </>
    )

  return (
    <>
      <AppBar
        title="단어장"
        right={
          <button type="button" aria-label="단어 추가" onClick={() => openAdd()} className="h-11 flex-none rounded-xl bg-surface2 px-3 text-[14px] font-semibold">
            ＋ 추가
          </button>
        }
      />
      <div className="px-4 pb-8">
        <WordSearchBar
          value={qInput}
          onInput={setQInput}
          onCommit={commitSearch}
          onClear={() => {
            setQInput('')
            setQTooLong(false)
            setFilter((f) => (f.q ? { ...f, q: '' } : f))
          }}
          error={qTooLong ? '검색어는 40자까지예요' : null}
        />
        {showCategoryRow ? (
          <div className="mt-1.5">
            <CategoryChips
              items={categories}
              value={filter.category}
              basis={filter.archived ? 'archived' : 'active'}
              onChange={(c) => setFilter((f) => ({ ...f, category: c }))}
            />
          </div>
        ) : null}
        {showChunkRow ? (
          <div className={showCategoryRow ? undefined : 'mt-1.5'}>
            <ChunkChips value={filter.chunk} onChange={(c) => setFilter((f) => ({ ...f, chunk: c }))} />
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Segmented<WordSort> size="sm" ariaLabel="정렬" options={SORT_OPTIONS} value={sort} onChange={(v) => setSort(v)} />
          </div>
          <ArchiveToggle pressed={filter.archived} onToggle={() => setFilter((f) => ({ ...f, archived: !f.archived, category: null }))} />
        </div>
        {filter.archived ? (
          <p className="mt-2.5 rounded-xl bg-surface2 p-2.5 text-[13px] text-ink2 break-keep">보관한 단어는 오늘의 단어에 나오지 않아요.</p>
        ) : null}
        <p aria-live="polite" className="mb-1.5 mt-3 min-h-[18px] text-[12px] text-ink2 [overflow-wrap:anywhere]">
          {head ? (
            <>
              {head.lead === 'search' ? (
                <>
                  ‘<span lang="ja">{head.q}</span>’ 검색 결과 {head.n}개
                </>
              ) : head.lead === 'archived' ? (
                `보관한 단어 ${head.n}개`
              ) : (
                `단어 ${head.n}개`
              )}
              {head.condition ? (
                <>
                  {' · '}
                  <span className="font-semibold text-ink">{head.condition}</span>
                </>
              ) : null}
            </>
          ) : null}
        </p>
        {body}
      </div>

      {hydrated && sheet?.kind === 'add' ? (
        <WordAddSheet
          key={sheet.key}
          presetSurface={sheet.preset}
          defaultCategory={filter.archived ? null : filter.category}
          categories={catNames}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null)
            toast.show('단어장에 넣었어요')
            reloadAll()
          }}
          onOpenWord={(id) => setSheet({ kind: 'detail', id })}
          onSeed={() => void runSeed()}
          seeding={seeding}
        />
      ) : null}
      {hydrated && sheet?.kind === 'detail' ? (
        <WordDetailSheet
          key={sheet.id}
          wordId={sheet.id}
          preview={sheet.preview}
          categories={catNames}
          onClose={() => setSheet(null)}
          onChanged={(w) => {
            setList((l) => ({ ...l, items: l.items.map((x) => (x.id === w.id ? w : x)) }))
            reloadAll()
          }}
          onArchivedChange={(w) => {
            removeRow(w.id)
            reloadAll()
          }}
          onRemoved={(id) => {
            setSheet(null)
            removeRow(id)
            toast.show('삭제했어요 · 지난 기록은 그대로 남아요')
            reloadAll()
          }}
          onOpenWord={(id) => setSheet({ kind: 'detail', id })}
          onNotFound={() => {
            setSheet(null)
            toast.show(WORD_NOT_FOUND)
            setReloadTick((t) => t + 1)
          }}
          onToast={toast.show}
        />
      ) : null}
      <Toast message={toast.message} />
    </>
  )
}
