'use client'

/**
 * 단어장 `/drawer/words`(screens.md §4-2 A·§4-3 · task-068 §28-1·28-2). 경로는 하나 — 상세·수정·추가·쪽 이동은 바텀시트로 열고 페이지를 옮기지 않는다.
 * 다른 화면에서는 `?word=<id>`·`?add=1` 로 들어오고, 시트를 연 뒤 `router.replace` 로 쿼리를 지운다(§4-2 D).
 *
 * 목록은 **한 쪽 7개**(task-068 D1 A) — 쪽 줄은 목록 바로 아래, 쪽 규칙·요청 시작/끝은 `wordsPaging.ts`. 내 단어 + 공용 기본 단어가 한 목록이고
 * 출처 분절(전체·내 단어·기본 단어)로 좁힌다(D10 A). 조건(검색·출처·분류·조각·정렬·보관함)이 바뀌면 1쪽, 상세·추가·쪽 이동 시트를 닫으면 보던 쪽,
 * 다른 탭에 갔다 오면(마운트) 1쪽 — 쪽은 저장소에 두지 않는다(D2 A). 쪽을 넘길 때만 회색 자리, 조건 변경·다시 읽기는 지금 행을 둔 채 기다린다.
 * 이전 요청은 abort, 늦게 온 옛 응답은 요청 번호로 버린다(§4-10). 추가·수정·보관·삭제는 서버 응답을 받은 뒤 **같은 쪽을 다시 읽는다**
 * (로컬로 행을 빼면 쪽의 행 수·개수가 응답과 어긋난다 — J4). 자동 폴링은 없다(마운트·화면 복귀 때만).
 * 머리 줄·빈 화면 안내는 지금 깔린 행을 받아 온 응답의 조건(`list.shown`)으로 그린다(logic.ts).
 * task-074(§32): 출처 4번째 칸 「즐겨찾기」, 행·상세 시트의 별은 화면 하나의 기록(`useWordFavorites`)을 함께 본다 — 서버 값은 그 값을 읽기 시작한
 * 시각(`listReadAt`)과 함께 `fav.view` 를 거쳐 그린다. 즐겨찾기 칸에서 별을 끄면 응답 뒤 같은 쪽을 다시 읽는다(D3).
 */
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { apiGet, isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import Segmented from '@/components/common/Segmented'
import Toast, { useToast } from '@/components/common/Toast'
import { ErrorBlock } from '@/components/common/ui'
import { LOADING, OFF, useWordLayersList, type WordLayers } from '@/components/common/japanese/annotations'
import { DISPLAY_COPY, useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { DisplayToggles, HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import DrawerSwitch from '@/components/drawer/DrawerSwitch'
import AppBar from '@/components/shell/AppBar'
import { WordRowsSkeleton } from '@/components/shell/TabSkeleton'
import { WORD_SKELETON } from '@/components/shell/tabSkeletonSizes'
import type { CategoryCount, WordChunkType, WordEntry, WordListPage, WordSort } from '@/types/vocab'
import ArchiveToggle from './ArchiveToggle'
import BaseWordBand from './BaseWordBand'
import CategoryChips from './CategoryChips'
import ChunkChips from './ChunkChips'
import type { FavView } from './favorite'
import { useHydrated, useStoredPref, VOCAB_KEYS } from './hooks'
import {
  ARCHIVE_NOTE,
  fmtCount,
  listErrorText,
  listLeadText,
  WORD_NOT_FOUND,
  WORD_SAVED_TOAST,
  WORD_SORT_OPTIONS,
  WORD_SOURCE_ARIA,
  WORD_SOURCE_OPTIONS,
  WORDS_PAGE_COPY as P,
} from './labels'
import { listHeader, WORD_FILTER_INITIAL, type WordListFilter, type WordListHeader } from './logic'
import { categoryTotals, emptyVariant, normalizeCategories, visibleCategories, WORD_LIMITS } from './validate'
import WordAddSheet from './WordAddSheet'
import WordDetailSheet from './WordDetailSheet'
import WordRow from './WordRow'
import WordSearchBar from './WordSearchBar'
import WordsEmpty from './WordsEmpty'
import WordsJumpSheet from './WordsJumpSheet'
import WordsPager from './WordsPager'
import { useWordFavorites } from './useWordFavorites'
import { finishWordsArrival, runWordsFavoriteEffect, wordsInFavoriteView, wordsStarHandler } from './wordsFavoriteEffect'
import {
  beginWords,
  fillerCount,
  focusHeadLine,
  isWordsPaged,
  navForKey,
  navTo,
  pageAfterAdd,
  settleWords,
  wordsCondKey,
  wordsListUrl,
  wordsPagerView,
  WORDS_INITIAL,
  WORDS_PAGE,
  type WordsListState,
  type WordsNav,
  type WordsPagerView,
  type WordsReqKind,
  type WordsResult,
  type WordsStatus,
} from './wordsPaging'

const SORTS = ['recent', 'wrong', 'surface'] as const satisfies readonly WordSort[]

type SheetState =
  | { kind: 'add'; key: number; preset?: string; presetChunk?: WordChunkType }
  | { kind: 'detail'; id: string; preview?: WordEntry }
  | { kind: 'jump' }
  | null

const FILLER_RUBY = [{ text: '亜', reading: 'あ' }]

/**
 * 마지막 쪽 빈 자리(J1) — 실제 행과 같은 구조의 숨은 행이라 글자 크게 보기·히라가나/한글 켜고 끄기에서도 같이 커진다(§28-1 D).
 * 누름·읽기 0(`aria-hidden` + `invisible`, 안에 단추 없음).
 */
function FillerRow() {
  const prefs = useDisplayPrefs()
  const ruby = prefs.loaded && prefs.showFurigana ? FILLER_RUBY : null
  return (
    <li aria-hidden="true" className="invisible">
      <span className="flex min-h-[64px] w-full min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2.5">
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <JaText as="span" text="亜" state={OFF} ruby={ruby} leading={1.95} className="min-w-0 truncate text-[18px] font-semibold" />
        </span>
        <HangulLine as="span" state={LOADING} size={12.5} waitAsLine className="w-full" />
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] text-ink2">가</span>
        </span>
      </span>
    </li>
  )
}

/** 쪽 넘기는 중 회색 자리 한 줄 — 높이는 단어장 자리표시와 같은 값(읽기 알림은 쪽 줄 status 한 줄만). */
function PagingRow() {
  return (
    <li aria-hidden="true" className="flex flex-col justify-center gap-2 px-3.5" style={{ height: WORD_SKELETON.rowHeight }}>
      <span className="block h-[18px] w-2/5 rounded-md bg-surface2" />
      <span className="block h-3.5 w-3/5 rounded-md bg-surface2" />
    </li>
  )
}

function PageErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mb-2 rounded-xl bg-bad-soft px-3.5 py-3 text-[13.5px] text-bad">
      <span className="block text-[14.5px] font-semibold">{P.pageError}</span>
      <span className="block break-keep">{P.pageErrorBody}</span>
      <button type="button" onClick={onRetry} className="mt-0.5 inline-flex min-h-11 items-center font-semibold underline">
        {P.retry}
      </button>
    </div>
  )
}

/**
 * 머리 줄(§28-2 F) — 「단어 7,758개 · 표현 조각 · 3쪽」. `aria-live` 라 쪽 접미사는 `aria-hidden`(쪽 위치는 쪽 줄 status 가 한 번 읽는다).
 * `tabIndex=-1` — 쪽을 넘겨 받은 뒤·삭제 뒤·안내 띠를 닫은 뒤 프로그램 초점만 받는다(Tab 순서에 없음). 응답 전에는 비운다.
 */
export function WordsHeadLine({ head, pRef }: { head: WordListHeader | null; pRef?: Ref<HTMLParagraphElement> }) {
  return (
    <p ref={pRef} tabIndex={-1} aria-live="polite" className="min-w-0 flex-1 scroll-mt-16 text-[12px] text-ink2 [overflow-wrap:anywhere] outline-none">
      {head ? (
        <>
          {head.lead === 'search' ? (
            <>
              ‘<span lang="ja">{head.q}</span>’ 검색 결과 {fmtCount(head.n)}개
            </>
          ) : (
            listLeadText(head.lead, head.n)
          )}
          {head.condition ? (
            <>
              {' · '}
              <span className="font-semibold text-ink">{head.condition}</span>
            </>
          ) : null}
          {head.pageNo !== null ? (
            <span aria-hidden="true" className="whitespace-nowrap">
              {` · ${P.pageSuffix(head.pageNo)}`}
            </span>
          ) : null}
        </>
      ) : null}
    </p>
  )
}

/**
 * 목록 칸 + 쪽 줄(§28-1 D) — 상태 없는 부품이라 서버 렌더로 시험한다(T1·T3·T5). 행 수는 늘 7 이하(서버 `limit=7`)이고,
 * 넘겨받은 행이 더 있어도 7개까지만 그린다.
 */
export function WordsPageList({
  items,
  layers,
  sort,
  status,
  paged,
  view,
  favView,
  onStar,
  onOpen,
  onPrev,
  onNext,
  onJump,
  onRetry,
}: {
  items: readonly WordEntry[]
  layers: readonly WordLayers[]
  sort: WordSort
  status: WordsStatus
  paged: boolean
  view: WordsPagerView
  /** 행 별(task-074 §32-9) — 서버 값은 이 함수를 거쳐 그린다. */
  favView: (w: WordEntry) => FavView
  onStar: (w: WordEntry, shownOn: boolean) => void
  onOpen: (w: WordEntry) => void
  onPrev: () => void
  onNext: () => void
  onJump: () => void
  onRetry: () => void
}) {
  const rows = items.slice(0, WORDS_PAGE)
  const busy = status === 'paging'
  const failed = status === 'pageError'
  const shownRows = busy || failed ? 0 : rows.length
  const fillers = busy ? 0 : fillerCount(paged, shownRows, status)
  return (
    <>
      {failed ? <PageErrorBox onRetry={onRetry} /> : null}
      {busy || shownRows > 0 || fillers > 0 ? (
        <ul aria-busy={busy || undefined} className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
          {busy
            ? Array.from({ length: WORDS_PAGE }, (_, i) => <PagingRow key={`p${i}`} />)
            : rows.slice(0, shownRows).map((w, i) => {
                const fv = favView(w)
                return (
                  <WordRow
                    key={w.id}
                    word={w}
                    sort={sort}
                    onOpen={onOpen}
                    ruby={layers[i]?.ruby ?? null}
                    hangul={layers[i]?.hangul ?? OFF}
                    favOn={fv.on}
                    favLocked={fv.locked}
                    onStar={onStar}
                  />
                )
              })}
          {Array.from({ length: fillers }, (_, i) => (
            <FillerRow key={`f${i}`} />
          ))}
        </ul>
      ) : null}
      {paged ? <WordsPager view={view} onPrev={onPrev} onNext={onNext} onJump={onJump} /> : null}
    </>
  )
}

export default function WordsScreen({ initialWordId, initialAdd }: { initialWordId?: string; initialAdd?: boolean }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const toast = useToast()
  const showToast = toast.show
  const [sort, setSortPref] = useStoredPref<WordSort>(VOCAB_KEYS.wordsSort, 'recent', SORTS)
  const [filter, setFilter] = useState<WordListFilter>(WORD_FILTER_INITIAL)
  const key = wordsCondKey(filter, sort)
  const [navState, setNav] = useState<WordsNav>(() => ({ key, page: 0, kind: 'first', seq: 0 }))
  // 손잡이를 거치지 않고 바뀐 조건(다른 창에서 바꾼 정렬 등)도 1쪽으로 읽는다.
  const nav = navForKey(navState, key)
  const [qInput, setQInput] = useState('')
  const [qTooLong, setQTooLong] = useState(false)
  const [list, setListState] = useState<WordsListState>(WORDS_INITIAL)
  const listRef = useRef<WordsListState>(WORDS_INITIAL)
  const [categories, setCategories] = useState<CategoryCount[] | null>(null)
  const [catTick, setCatTick] = useState(0)
  // 머리 줄 초점 요청 — 매번 새 객체라 같은 값이어도 효과가 다시 돈다. `scroll` 은 쪽 도착·삭제만 true(안내 띠 ✕ 는 초점만).
  const [focusReq, setFocusReq] = useState({ tick: 0, scroll: true })
  const askHeadFocus = (scroll: boolean) => setFocusReq((r) => ({ tick: r.tick + 1, scroll }))
  const [sheet, setSheet] = useState<SheetState>(() =>
    initialWordId ? { kind: 'detail', id: initialWordId } : initialAdd ? { kind: 'add', key: 0 } : null,
  )
  const reqRef = useRef(0)
  const addKey = useRef(1)
  const headRef = useRef<HTMLParagraphElement | null>(null)
  // 즐겨찾기(task-074 §32-9): 지금 깔린 목록 값을 읽기 시작한 시각 — 별 기록이 이보다 나중에 확정됐으면 기록이 이긴다.
  const [listReadAt, setListReadAt] = useState(0)
  // 즐겨찾기 칸에서 별을 꺼 행이 빠지는 다시 읽기 — 응답을 깐 뒤 초점을 잃었으면 머리 줄로(D3).
  const focusCheckRef = useRef(false)

  // 목록 상태는 요청 끝에서 「지금 값」으로 계산하므로 ref 사본을 함께 둔다(렌더 중에는 읽지 않는다).
  const commit = (s: WordsListState) => {
    listRef.current = s
    setListState(s)
  }

  const openDetail = (word: WordEntry) => setSheet({ kind: 'detail', id: word.id, preview: word })

  /** 같은 조건에서 쪽을 옮기거나 다시 읽는다 — 회색 자리는 쪽 넘김·다시 시도만(`beginWords`). */
  const request = (kind: WordsReqKind, page?: number) => {
    commit(beginWords(listRef.current, kind))
    setNav((n) => {
      const cur = navForKey(n, key)
      return navTo(cur, key, page ?? cur.page, kind)
    })
  }

  const reloadAll = () => {
    request('reload')
    setCatTick((t) => t + 1)
  }
  const reloadAllRef = useRef(reloadAll)
  useEffect(() => {
    reloadAllRef.current = reloadAll
  })

  // 효과 처리 규칙은 `wordsFavoriteEffect.ts`(토스트 1번 · 404 면 그 단어 시트 닫기+전체 다시 읽기 · 즐겨찾기 칸에서 끈 응답이면 같은 쪽 다시 읽기+초점 확인).
  const fav = useWordFavorites({
    inFavoriteView: () => wordsInFavoriteView(listRef.current),
    onEffect: (x) => runWordsFavoriteEffect(x, { showToast, setSheet, reloadAll, request, focusCheck: focusCheckRef }),
  })
  const favPress = fav.press
  const favStamp = fav.stamp
  const onStar = useMemo(() => wordsStarHandler(favPress), [favPress])

  // 들어온 쿼리는 시트를 연 것으로 쓰고 지운다(새로고침해도 다시 열리지 않게).
  useEffect(() => {
    if (initialWordId || initialAdd) router.replace('/drawer/words', { scroll: false })
  }, [initialWordId, initialAdd, router])

  const navPage = nav.page
  const navKind = nav.kind
  const navSeq = nav.seq
  useEffect(() => {
    const ctrl = new AbortController()
    const id = ++reqRef.current
    const req = { kind: navKind, page: navPage, shown: { ...filter, sort } }
    const reqKey = wordsCondKey(filter, sort)
    const readAt = favStamp()
    apiGet<WordListPage>(wordsListUrl(filter, sort, navPage), { signal: ctrl.signal })
      .then(
        (page): WordsResult => ({ ok: true, page }),
        (e: unknown): WordsResult | null => (isAbort(e) ? null : { ok: false, error: listErrorText(toErr(e)) }),
      )
      .then((res) => {
        if (!res || id !== reqRef.current) return
        const out = settleWords(listRef.current, req, res)
        const next = out.clampTo !== null ? beginWords(listRef.current, 'clamp') : out.state
        listRef.current = next
        setListState(next)
        if (out.clampTo !== null) {
          const to = out.clampTo
          setNav((n) => navTo(n, reqKey, to, 'clamp'))
          return
        }
        finishWordsArrival(
          { ok: res.ok, readAt, toast: out.toast, focusHead: out.focusHead },
          {
            setListReadAt,
            showToast,
            focusHead: (scroll) => setFocusReq((r) => ({ tick: r.tick + 1, scroll })),
            focusCheck: focusCheckRef,
            nextFrame: (cb) => requestAnimationFrame(cb),
            activeElement: () => document.activeElement,
            body: () => document.body,
          },
        )
      })
    return () => ctrl.abort()
  }, [filter, sort, navPage, navKind, navSeq, showToast, favStamp])

  // 쪽을 넘겨 받았거나(J2) 초점이 있던 요소가 사라질 때(삭제·안내 띠 닫기) — 초점을 머리 줄로(행이 그려진 뒤). 화면을 위로 끌어오는 건 쪽 도착·삭제만.
  useEffect(() => {
    if (focusReq.tick === 0) return
    const id = requestAnimationFrame(() => focusHeadLine(headRef.current, focusReq.scroll))
    return () => cancelAnimationFrame(id)
  }, [focusReq])

  useEffect(() => {
    let cancelled = false
    apiGet<unknown>('/api/v1/words/categories')
      .then((raw) => {
        if (cancelled) return
        const cats = normalizeCategories(raw)
        setCategories(cats)
        // 선택한 칩이 사라졌으면(마지막 단어 삭제·보관) 전체로 돌아간다(조건이 바뀌므로 1쪽).
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
      if (document.visibilityState === 'visible') reloadAllRef.current()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  /** 조건을 바꾼다 — 열쇠가 달라지면 1쪽(D2). 지금 행은 둔 채 새 응답을 기다린다. */
  const changeFilter = (patch: Partial<WordListFilter>) => {
    const next = { ...filter, ...patch }
    const nextKey = wordsCondKey(next, sort)
    if (nextKey === key) return
    commit(beginWords(listRef.current, 'filter'))
    setFilter(next)
    setNav((n) => navForKey(n, nextKey))
  }

  const changeSort = (v: WordSort) => {
    const nextKey = wordsCondKey(filter, v)
    setSortPref(v)
    if (nextKey === key) return
    commit(beginWords(listRef.current, 'filter'))
    setNav((n) => navForKey(n, nextKey))
  }

  const commitSearch = (v: string) => {
    const t = v.trim()
    if (cpLength(t) > WORD_LIMITS.search) {
      setQTooLong(true)
      return
    }
    setQTooLong(false)
    changeFilter({ q: t })
  }

  const openAdd = (preset?: string, presetChunk?: WordChunkType) => {
    setSheet({ kind: 'add', key: addKey.current++, preset, presetChunk })
  }

  const catNames = (categories ?? []).flatMap((c) => (c.category ? [c.category] : []))
  const totals = categoryTotals(categories)
  const head = listHeader(list, nav.page)
  // 빈 화면 안내도 그 응답의 조건으로 — 응답 전에 새 조건의 안내가 먼저 뜨지 않게.
  const shown = list.shown ?? { ...filter, sort }
  const showCategoryRow = visibleCategories(categories, filter.archived ? 'archived' : 'active').length > 0
  // 단어가 하나도 없는 단어장(#46 합 0)에서는 거를 것이 없어 조각 줄을 그리지 않는다. 고른 조각이 있으면 풀 수 있게 남긴다.
  const showChunkRow = filter.chunk !== null || !(totals && totals.active + totals.archived === 0)
  // 그린 행 표제어를 한 번에(한 쪽 = 1요청). 루비는 저장 읽기로, 한글은 한글 켬일 때만 요청한다.
  const layers = useWordLayersList(list.items)
  const emptyKind = emptyVariant(shown, totals)
  const paged = isWordsPaged(list.total, nav.page)
  const view = wordsPagerView({ page: nav.page, pages: list.pages, total: list.total, status: list.status })

  let body: React.ReactNode
  // 「불러오는 중…」 글자 대신 목록 모양의 자리표시 — 빈 상태 안내는 응답이 와서 0건일 때만 그린다(가짜 빈 상태 금지, task-046).
  if (list.status === 'first') body = <WordRowsSkeleton label={P.firstSr} />
  else if (list.status === 'firstError') body = <ErrorBlock message={list.error ?? listErrorText({ status: -1 })} onRetry={() => request('first')} />
  else if (list.status === 'ready' && list.items.length === 0)
    body = (
      <WordsEmpty
        variant={emptyKind}
        q={shown.q}
        category={shown.category}
        chunk={shown.chunk}
        archived={shown.archived}
        onAdd={openAdd}
        onShowArchive={() => changeFilter({ archived: true, category: null })}
        onShowAll={() => changeFilter({ category: null })}
        onClearChunk={() => changeFilter({ chunk: null })}
        onClearFavorite={() => changeFilter({ source: 'all' })}
      />
    )
  else
    body = (
      <WordsPageList
        items={list.items}
        layers={layers}
        sort={sort}
        status={list.status}
        paged={paged}
        view={view}
        favView={(w) => fav.view(w.id, w.favorite, listReadAt)}
        onStar={onStar}
        onOpen={openDetail}
        onPrev={() => request('page', nav.page - 1)}
        onNext={() => request('page', nav.page + 1)}
        onJump={() => setSheet({ kind: 'jump' })}
        onRetry={() => request('retry')}
      />
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
        <DrawerSwitch current="words" />
        <WordSearchBar
          value={qInput}
          onInput={setQInput}
          onCommit={commitSearch}
          onClear={() => {
            setQInput('')
            setQTooLong(false)
            changeFilter({ q: '' })
          }}
          error={qTooLong ? '검색어는 40자까지예요' : null}
        />
        <div className="mt-2">
          <Segmented size="sm" ariaLabel={WORD_SOURCE_ARIA} options={WORD_SOURCE_OPTIONS} value={filter.source} onChange={(v) => changeFilter({ source: v })} />
        </div>
        {showCategoryRow ? (
          <div className="mt-1.5">
            <CategoryChips
              items={categories}
              value={filter.category}
              basis={filter.archived ? 'archived' : 'active'}
              onChange={(c) => changeFilter({ category: c })}
            />
          </div>
        ) : null}
        {showChunkRow ? (
          <div className={showCategoryRow ? undefined : 'mt-1.5'}>
            <ChunkChips value={filter.chunk} onChange={(c) => changeFilter({ chunk: c })} />
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Segmented<WordSort> size="sm" ariaLabel="정렬" options={WORD_SORT_OPTIONS} value={sort} onChange={changeSort} />
          </div>
          <ArchiveToggle pressed={filter.archived} onToggle={() => changeFilter({ archived: !filter.archived, category: null })} />
        </div>
        {filter.archived ? <p className="mt-2.5 rounded-xl bg-surface2 p-2.5 text-[13px] text-ink2 break-keep">{ARCHIVE_NOTE}</p> : null}
        <div className="mb-1.5 mt-2 flex min-h-8 items-center justify-between gap-2">
          <WordsHeadLine head={head} pRef={headRef} />
          <div role="group" aria-label={DISPLAY_COPY.toolGroup} className="flex flex-none items-center gap-1.5">
            <DisplayToggles keys={['fu', 'hg']} onToast={showToast} />
          </div>
        </div>
        <BaseWordBand baseTotal={list.baseTotal} onClosed={() => askHeadFocus(false)} />
        {body}
      </div>

      {hydrated && sheet?.kind === 'add' ? (
        <WordAddSheet
          key={sheet.key}
          presetSurface={sheet.preset}
          presetChunk={sheet.presetChunk ?? null}
          defaultCategory={filter.archived ? null : filter.category}
          categories={catNames}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null)
            showToast(WORD_SAVED_TOAST)
            request('reload', pageAfterAdd(sort, nav.page))
            setCatTick((t) => t + 1)
          }}
          onOpenWord={(id) => setSheet({ kind: 'detail', id })}
        />
      ) : null}
      {hydrated && sheet?.kind === 'detail' ? (
        <WordDetailSheet
          key={sheet.id}
          wordId={sheet.id}
          preview={sheet.preview}
          categories={catNames}
          fav={fav}
          onClose={() => setSheet(null)}
          onChanged={(w) => {
            commit({ ...listRef.current, items: listRef.current.items.map((x) => (x.id === w.id ? w : x)) })
            reloadAll()
          }}
          onArchivedChange={() => reloadAll()}
          onRemoved={() => {
            setSheet(null)
            showToast('삭제했어요 · 지난 기록은 그대로 남아요')
            reloadAll()
            askHeadFocus(true)
          }}
          onOpenWord={(id) => setSheet({ kind: 'detail', id })}
          onNotFound={() => {
            setSheet(null)
            showToast(WORD_NOT_FOUND)
            reloadAll()
          }}
          onToast={showToast}
        />
      ) : null}
      {hydrated && sheet?.kind === 'jump' ? (
        <WordsJumpSheet page={nav.page} pages={list.pages} onClose={() => setSheet(null)} onGo={(p) => request('page', p)} />
      ) : null}
      <Toast message={toast.message} />
    </>
  )
}
