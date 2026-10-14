'use client'

/**
 * 채택 교정 모음 `/drawer/corrections`(task-055, screens.md §21) — 회화·채팅에서 [채택]한 교정만 다시 읽는 단어장 탭 안 두 번째 목록.
 * 데이터는 #79(GET) 하나. 교정 편집·삭제·채택·무시 UI 는 없다(서버가 ACCEPTED 만 준다 — 화면이 다시 거르지 않는다).
 *
 * - 조건(유형·조각·검색어)이 바뀌면 커서·펼침·더 보기 오류를 버리고 첫 쪽부터. 첫 쪽 요청마다 abort + 요청 번호 — 늦게 온 옛 응답은 버린다(§21-5 E).
 * - 칩 숫자·머리 줄은 **첫 쪽 응답의 facets** 로만, 머리 줄·빈 상태 문구는 그 목록을 받은 요청의 조건(`shown`)으로 그린다. 칩 켜짐만 지금 고른 값.
 * - 검색은 Enter(검색 키)로만 확정, 빈 칸이 되면 바로 해제. 40자 초과는 안내만(조회 0).
 * - 돌아오기: [원래 대화 보기 ›] 직전에 주소를 지금 조건+그 카드+받은 개수로 바꾸고(`replaceState`) 한 건 기록. 돌아오면 그 조건·개수로 한 번에 읽고
 *   그 카드를 펼쳐 [원래 대화 보기 ›]에 초점, 그 뒤 주소 쿼리를 지운다(§21-6 B·C). 복원 값은 **지금 주소**(`useSearchParams`)에서 읽는다 —
 *   휴대폰 뒤로가기는 라우터 캐시의 옛 서버 props 를 다시 쓸 수 있어서다(계획표 `PlanScreen` 과 같은 이유). 서버 `initial` 은 주소를 못 읽을 때만.
 * - 자동 폴링·화면 복귀 다시 읽기는 없다(마운트·사용자 조작·단어 시트 결과 때만).
 */
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { DISPLAY_COPY } from '@/components/common/japanese/displayPrefs'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { DisplayToggles } from '@/components/common/japanese/JapaneseText'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn } from '@/components/common/ui'
import AppBar from '@/components/shell/AppBar'
import { forgetCorrectionsReturn, rememberCorrectionsReturn } from '@/components/shell/correctionsReturn'
import { CorrectionCardsSkeleton, ErrorTypeRowSkeleton } from '@/components/shell/TabSkeleton'
import { retryFailHoldMs } from '@/components/topic/logic'
import ChunkChips from '@/components/vocab/ChunkChips'
import { useHydrated } from '@/components/vocab/hooks'
import { WORD_NOT_FOUND } from '@/components/vocab/labels'
import WordDetailSheet from '@/components/vocab/WordDetailSheet'
import WordSearchBar from '@/components/vocab/WordSearchBar'
import type { DrawerCorrectionItem, DrawerCorrectionPage } from '@/types/chat'
import { CORRECTIONS_COPY as C, conditionText } from './correctionsCopy'
import DrawerCorrectionCard, { ADDED, cardButtonId, cardGoId, REMOVED } from './DrawerCorrectionCard'
import DrawerSwitch from './DrawerSwitch'
import ErrorTypeChips from './ErrorTypeChips'
import {
  correctionsReturnUrl,
  DRAWER_CORRECTIONS_PATH,
  DRAWER_FILTER_NONE,
  DRAWER_LIST_INITIAL,
  DRAWER_PAGE_SIZE,
  DRAWER_Q_MAX,
  drawerCorrectionsUrl,
  drawerQuery,
  drawerView,
  focusWishStep,
  headCount,
  keepSearchTooLong,
  listFromFirstError,
  listFromFirstPage,
  listWithMore,
  listWithWordSurface,
  loadErrorText,
  parseCorrectionsReturnQuery,
  reloadLimit,
  sameFilter,
  searchHasOtherCondition,
  showEnd,
  sourcePathOf,
  type CorrectionsInitial,
  type DrawerCorrectionFilter,
  type DrawerFocusWish,
  type DrawerListState,
  type DrawerQuery,
} from './logic'

const PRIMARY_LINK = 'inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent'
const SECONDARY_LINK = 'inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold'
const PILL = 'inline-flex h-7 items-center rounded-lg px-3 text-[12.5px] font-semibold'

type WordSheet = { wordId: string; fromId: string } | null

export default function CorrectionsScreen({ initial }: { initial: CorrectionsInitial }) {
  const sp = useSearchParams()
  const hydrated = useHydrated()
  const toast = useToast()
  const [init] = useState<CorrectionsInitial>(() => (sp ? parseCorrectionsReturnQuery(sp) : initial))
  const [query, setQuery] = useState<DrawerQuery>(() => drawerQuery(init.filter, 0, init.n ?? DRAWER_PAGE_SIZE))
  const [list, setList] = useState<DrawerListState>(DRAWER_LIST_INITIAL)
  const [qInput, setQInput] = useState(init.filter.q)
  const [qTooLong, setQTooLong] = useState(false)
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [wordSheet, setWordSheet] = useState<WordSheet>(null)
  const reqRef = useRef(0)
  const moreCtrl = useRef<AbortController | null>(null)
  /** 돌아오기 복원 — 첫 성공 응답에서 한 번 쓰고 비운다(null = 끝남). 사용자가 조건을 바꾸면 버린다. */
  const restore = useRef<{ focus: string | null } | null>({ focus: init.focus })
  /** 목록을 다시 그린 뒤 옮길 초점 — 소비 규칙은 `focusWishStep`. */
  const focusNext = useRef<DrawerFocusWish | null>(null)
  const searchWrap = useRef<HTMLDivElement | null>(null)

  // 원래 대화 ← 용 한 건 기록은 교정 모음에 돌아오면 쓸모가 끝난다(계획표의 forgetPlanReturn 과 같은 이유).
  useEffect(() => {
    forgetCorrectionsReturn()
  }, [])

  const clearRestoreQuery = useCallback(() => {
    restore.current = null
    if (window.location.pathname === DRAWER_CORRECTIONS_PATH && window.location.search) window.history.replaceState(null, '', DRAWER_CORRECTIONS_PATH)
  }, [])

  useEffect(() => {
    moreCtrl.current?.abort()
    const q = query
    const ctrl = new AbortController()
    const id = ++reqRef.current
    const startedAt = Date.now()
    let hold: ReturnType<typeof setTimeout> | null = null
    apiGet<DrawerCorrectionPage>(drawerCorrectionsUrl(q.filter, { limit: q.limit }), { signal: ctrl.signal })
      .then((page) => {
        if (id !== reqRef.current) return
        const next = listFromFirstPage(q, page)
        const r = restore.current
        if (r) {
          const f = r.focus
          if (f !== null && next.items.some((c) => c.id === f)) {
            setOpen(new Set([f]))
            focusNext.current = { ids: [cardGoId(f), cardButtonId(f)], scroll: true, after: q }
          }
          clearRestoreQuery()
        }
        setList(next)
        setMoreError(null)
      })
      .catch((e: unknown) => {
        if (isAbort(e) || id !== reqRef.current) return
        const apply = () => {
          if (id === reqRef.current) setList((l) => listFromFirstError(l, q, loadErrorText(toErr(e))))
        }
        const wait = q.retry ? retryFailHoldMs(true, startedAt, Date.now()) : 0
        if (wait > 0) hold = setTimeout(apply, wait)
        else apply()
      })
    return () => {
      ctrl.abort()
      if (hold) clearTimeout(hold)
    }
  }, [query, clearRestoreQuery])

  // 돌아오기 복원·단어 삭제 뒤 초점 — 기다리던 요청의 답이 목록에 반영된 다음 한 번만.
  useEffect(() => {
    const want = focusNext.current
    if (!want) return
    const step = focusWishStep(want, list.query, (id) => document.getElementById(id))
    if (step.kind === 'wait') return
    focusNext.current = null
    if (step.kind === 'drop') return
    step.target.focus({ preventScroll: true })
    if (want.scroll) step.target.scrollIntoView({ block: 'nearest' })
  }, [list, open])

  /** 사용자가 조건을 바꿈 — 같은 값이면 아무것도 하지 않는다. */
  const changeFilter = (fn: (f: DrawerCorrectionFilter) => DrawerCorrectionFilter) => {
    const next = fn(query.filter)
    if (sameFilter(next, query.filter)) return
    clearRestoreQuery()
    focusNext.current = null
    setQuery(drawerQuery(next, query.tick + 1))
    setOpen(new Set())
    setMoreError(null)
  }

  /** 단어 시트 뒤 다시 읽기 — 지금 조건, 받은 개수만큼 한 번에(위치·펼침 유지, 지금 목록을 보인 채). 초점 기록이 기다릴 요청을 돌려준다. */
  const reloadKeep = (): DrawerQuery => {
    const next = drawerQuery(query.filter, query.tick + 1, reloadLimit(list.items.length), { silent: true })
    setQuery(next)
    return next
  }

  const retry = () => setQuery((q) => drawerQuery(q.filter, q.tick + 1, q.limit, { retry: true }))

  const commitSearch = (v: string) => {
    const t = v.trim()
    if (cpLength(t) > DRAWER_Q_MAX) {
      setQTooLong(true)
      return
    }
    setQTooLong(false)
    changeFilter((f) => ({ ...f, q: t }))
  }

  const clearSearch = (focusInput: boolean) => {
    setQInput('')
    setQTooLong(false)
    changeFilter((f) => ({ ...f, q: '' }))
    if (focusInput) searchWrap.current?.querySelector('input')?.focus()
  }

  const more = async () => {
    if (!list.nextCursor || loadingMore || list.query !== query) return
    const id = reqRef.current
    const ctrl = new AbortController()
    moreCtrl.current = ctrl
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await apiGet<DrawerCorrectionPage>(drawerCorrectionsUrl(list.shown ?? query.filter, { cursor: list.nextCursor }), { signal: ctrl.signal })
      if (id !== reqRef.current) return
      setList((l) => listWithMore(l, page))
    } catch (e) {
      if (!isAbort(e) && id === reqRef.current) setMoreError(C.moreError)
    } finally {
      if (moreCtrl.current === ctrl) moreCtrl.current = null
      setLoadingMore(false)
    }
  }

  const toggle = useCallback((id: string) => {
    // 사용자가 직접 펼침·접음 — 다시 읽기 뒤 초점 이동은 하지 않는다(그 사이 누른 카드에서 초점이 끌려가지 않게).
    focusNext.current = null
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const leave = (c: DrawerCorrectionItem) => {
    // 원래 대화에서 ← 「교정 모음으로」·휴대폰 뒤로가기로 오면 같은 조건·같은 카드로(이동은 Link 가 한다 — 계획표와 같은 순서).
    const back = correctionsReturnUrl(list.shown ?? DRAWER_FILTER_NONE, { focus: c.id, n: reloadLimit(list.items.length) })
    window.history.replaceState(null, '', back)
    const src = sourcePathOf(c)
    if (src) rememberCorrectionsReturn(back, src)
  }

  const afterWordGone = (fromId: string, message: string) => {
    setWordSheet(null)
    toast.show(message)
    // 누른 [단어 보기 ›]는 다시 읽은 뒤 사라진다 — 초점은 그 카드의 요약 버튼으로.
    focusNext.current = { ids: [cardButtonId(fromId)], scroll: false, after: reloadKeep() }
  }

  const onSearchInput = (v: string) => {
    setQInput(v)
    setQTooLong((was) => keepSearchTooLong(was, v))
  }

  const view = drawerView(list, query)
  const shown = list.shown ?? query.filter
  const cond = conditionText(shown.errorType, shown.chunkType)
  const n = headCount(list.facets, shown.errorType)

  const appBar = <AppBar title="단어장" />

  if (view.body === 'emptyFirst') {
    return (
      <>
        {appBar}
        <div className="px-4 pb-8">
          <DrawerSwitch current="corrections" />
          <EmptyFirst />
        </div>
        <Toast message={toast.message} />
      </>
    )
  }

  let body: React.ReactNode
  if (view.body === 'skeleton') body = <CorrectionCardsSkeleton />
  else if (view.body === 'error')
    body = (
      <div role="alert" className="rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
        <div className="break-keep">{list.error ?? C.loadError}</div>
        <button type="button" onClick={retry} className="mt-0.5 inline-flex min-h-11 items-center font-semibold underline">
          {C.retry}
        </button>
      </div>
    )
  else if (view.body === 'emptyFilter')
    body = (
      <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-4">
        <p className="text-[16px] font-semibold">{C.emptyFilterTitle}</p>
        <p className="text-[14px] text-ink2 break-keep">
          <b className="font-semibold text-ink">{cond}</b>
          {C.emptyFilterBodyTail}
        </p>
        <Btn variant="ghost" size="sm" className="min-h-11 self-start" onClick={() => changeFilter((f) => ({ ...f, errorType: null, chunkType: null }))}>
          {C.clearFilter}
        </Btn>
      </div>
    )
  else if (view.body === 'emptySearch')
    body = (
      <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-4">
        <p className="text-[16px] font-semibold [overflow-wrap:anywhere]">
          {C.quoteOpen}
          <JaRuns text={shown.q} />
          {C.quoteClose}
          {C.emptySearchTitleTail}
        </p>
        <p className="text-[14px] text-ink2 break-keep">
          {C.emptySearchBody}
          {searchHasOtherCondition(shown) ? C.emptySearchWithCond : null}
        </p>
        <Btn variant="ghost" size="sm" className="min-h-11 self-start" onClick={() => clearSearch(true)}>
          {C.clearSearch}
        </Btn>
      </div>
    )
  else
    body = (
      <>
        <ul aria-label={C.listLabel} className="flex flex-col gap-2.5">
          {list.items.map((c) => (
            <DrawerCorrectionCard
              key={c.id}
              item={c}
              open={open.has(c.id)}
              onToggle={toggle}
              onLeave={leave}
              onOpenWord={(wordId, fromId) => setWordSheet({ wordId, fromId })}
            />
          ))}
        </ul>
        {moreError ? (
          <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
            {moreError}
          </p>
        ) : null}
        {list.nextCursor ? (
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => void more()} aria-busy={loadingMore || undefined}>
            {loadingMore ? C.moreBusy : C.more}
          </Btn>
        ) : showEnd(list) ? (
          <p role="status" className="mt-3.5 text-center text-[12px] text-ink2">
            {C.end(list.items.length)}
          </p>
        ) : null}
      </>
    )

  return (
    <>
      {appBar}
      <div className="px-4 pb-8">
        <DrawerSwitch current="corrections" />
        <div ref={searchWrap} inert={view.firstLoading || undefined}>
          <WordSearchBar
            label={C.search}
            placeholder={C.search}
            commitWhileTyping={false}
            value={qInput}
            onInput={onSearchInput}
            onCommit={commitSearch}
            onClear={() => clearSearch(false)}
            error={qTooLong ? C.searchTooLong : null}
          />
        </div>
        {view.typeRow === 'skeleton' ? (
          <ErrorTypeRowSkeleton />
        ) : view.typeRow === 'chips' ? (
          <div className="mt-1.5">
            <ErrorTypeChips facets={list.facets} value={query.filter.errorType} onChange={(v) => changeFilter((f) => ({ ...f, errorType: v }))} />
          </div>
        ) : null}
        <div inert={view.firstLoading || undefined} className={view.typeRow === 'none' ? 'mt-1.5' : undefined}>
          <ChunkChips value={query.filter.chunkType} variant="corrections" onChange={(v) => changeFilter((f) => ({ ...f, chunkType: v }))} />
        </div>
        <div className="mb-1.5 mt-2 flex min-h-8 items-center justify-between gap-2">
          <p aria-live="polite" className="min-w-0 flex-1 text-[12px] text-ink2 [overflow-wrap:anywhere]">
            {view.head ? (
              <>
                {shown.q ? (
                  <>
                    {C.quoteOpen}
                    <JaRuns text={shown.q} />
                    {C.quoteClose}
                    {C.headSearchTail(n)}
                  </>
                ) : (
                  C.head(n)
                )}
                {cond ? (
                  <>
                    {C.condSep}
                    <b className="font-semibold text-ink">{cond}</b>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          <div role="group" aria-label={DISPLAY_COPY.toolGroup} className="flex flex-none items-center gap-1.5">
            <DisplayToggles keys={['fu', 'hg']} onToast={toast.show} />
          </div>
        </div>
        {body}
      </div>

      {hydrated && wordSheet ? (
        <WordDetailSheet
          key={wordSheet.wordId}
          wordId={wordSheet.wordId}
          categories={[]}
          onClose={() => setWordSheet(null)}
          onChanged={(w) => setList((l) => listWithWordSurface(l, w.id, w.surface))}
          onArchivedChange={() => {}}
          onRemoved={() => afterWordGone(wordSheet.fromId, C.wordRemoved)}
          onOpenWord={(id) => setWordSheet((s) => ({ wordId: id, fromId: s?.fromId ?? '' }))}
          onNotFound={() => afterWordGone(wordSheet.fromId, WORD_NOT_FOUND)}
          onToast={toast.show}
        />
      ) : null}
      <Toast message={toast.message} />
    </>
  )
}

/** E1 처음 비어 있음(§21-4) — 분절 아래 상자만. 그림은 장식(안의 「채택」「무시」는 버튼이 아닌 span). */
function EmptyFirst() {
  const pic = C.emptyFirstPic
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface px-4 py-5">
      <p className="text-[16px] font-semibold">{C.emptyFirstTitle}</p>
      <p className="text-[14px] text-ink2 break-keep">
        {C.emptyFirstBody[0]}
        <b className="font-semibold text-ink">{C.emptyFirstBody[1]}</b>
        {C.emptyFirstBody[2]}
      </p>
      <div aria-hidden="true" className="mb-0.5 mt-1 flex flex-col gap-1 rounded-xl border border-dashed border-line px-3 py-2.5 text-[13px]">
        <span className="text-[12px] text-ink2">{pic.mine}</span>
        <span lang="ja">
          {pic.head}
          <span className={REMOVED}>{pic.removed}</span>
          {pic.tail}
        </span>
        <span className="text-[12px] text-good">{pic.fix}</span>
        <span lang="ja">
          {pic.head}
          <span className={ADDED}>{pic.added}</span>
          {pic.tail}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`${PILL} bg-accent text-on-accent ring-[3px] ring-accent-soft`}>{pic.accept}</span>
          <span className={`${PILL} border border-line text-ink2`}>{pic.reject}</span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2 [&>*]:min-w-0 [&>*]:flex-[1_1_130px]">
        <Link href="/study/ai?tab=talk" className={PRIMARY_LINK}>
          {C.goTalk}
        </Link>
        <Link href="/study/ai?tab=chat" className={SECONDARY_LINK}>
          {C.goChatList}
        </Link>
      </div>
    </div>
  )
}
