'use client'

/**
 * 질문 목록 `/ask` 본체(task-064, screens.md §25-4). 맨 위 입력 카드 → 예시 칩 → 지난 질문.
 *
 * - 첫 질문: 검사 → (처음이면) 보내는 범위 시트 → #28 `{kind:'ASK', title}` → 질문을 `pending.<id>` 에 두고 방으로 이동.
 *   **목록에서는 턴을 시작하지 않는다**(§25-4 E — 화면을 떠나며 스트림이 끊기는 시점과 `accepted` 가 겹치는 경합을 피한다). 방이 넘겨받아 보낸다.
 * - 「답 만드는 중」 행이 있으면 첫 쪽(#27)을 `useChatTurn` 과 같은 간격으로 다시 읽고, 끝난 방은 성공한 답인지 #29 로 확인한 뒤에만 「새 답」을 붙인다(L-8).
 * - 「새 답」·기다리던 방은 이 기기의 sessionStorage 에만 있다(서버 칸 없음). 저장소 값은 수화 뒤에만 읽는다(서버 렌더와 첫 화면을 같게).
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn } from '@/components/common/ui'
import { actionErrorText } from '@/components/chat/labels'
import { ChatRowsSkeleton } from '@/components/shell/TabSkeleton'
import { retryFailHoldMs } from '@/components/topic/logic'
import type { ChatDetail, ChatSummary, CreatedChat, Paged } from '@/types/chat'
import { ASK_COPY } from './askCopy'
import { ASK_KEYS, addId, arrivedTransitions, readIds, removeId } from './logic'
import { ASK_LIST_LIMIT, appendRooms, askDraftCheck, askExamplesMode, askHomeView, askListPollDelay, createAskRoom, lastAnswerOk, mergeFirstPage, settleArrivals } from './homeLogic'
import AskComposerCard from './AskComposerCard'
import AskExamples from './AskExamples'
import AskListItem from './AskListItem'
import ScopeNoticeSheet, { type ScopeNoticeMode } from './ScopeNoticeSheet'
import { useScopeNoticeGate } from './useScopeNoticeGate'

type RoomList = { items: ChatSummary[]; cursor: string | null }

const noopSubscribe = () => () => {}

export default function AskHome() {
  const router = useRouter()
  const { message: toastMessage, show } = useToast()
  const gate = useScopeNoticeGate()
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const headingId = useId()

  // 입력 글: 손대기 전(null)에는 이 탭에 남은 초안을 보여 준다.
  const [edited, setEdited] = useState<string | null>(null)
  const draft = edited ?? (hydrated ? (readStore('session', ASK_KEYS.draft) ?? '') : '')
  const [busy, setBusy] = useState(false)
  const creatingRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<ScopeNoticeMode>('first')
  // 보내는 범위 시트 뒤에 이을 질문 하나(시트가 열린 동안 다시 누르면 덮어쓴다).
  const heldRef = useRef<string | null>(null)

  const [list, setList] = useState<RoomList | null>(null)
  const [firstFailed, setFirstFailed] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  // 목록 시각("오늘/어제")의 기준 — 렌더 중에 시계를 읽지 않게 읽을 때 같이 정한다.
  const [now, setNow] = useState<Date | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // 저장소(「새 답」 집합)를 고친 뒤 다시 그리게 하는 신호.
  const [, setStoreTick] = useState(0)
  const retryAt = useRef<number | null>(null)
  const gotRows = useRef(false)
  const prevRunning = useRef<Set<string> | null>(null)
  const pollStart = useRef<number | null>(null)

  const newIds = new Set(hydrated ? readIds(ASK_KEYS.newAnswer) : [])

  useEffect(() => {
    if (edited === null) return
    const t = setTimeout(() => writeStore('session', ASK_KEYS.draft, edited === '' ? null : edited), 300)
    return () => clearTimeout(t)
  }, [edited])

  useEffect(() => {
    if (readStore('session', ASK_KEYS.flash) !== 'deleted') return
    writeStore('session', ASK_KEYS.flash, null)
    show(ASK_COPY.deletedToast)
  }, [show])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    let seq = 0
    let lastItems: readonly ChatSummary[] = []

    const stop = () => {
      if (timer) clearTimeout(timer)
      timer = undefined
    }
    const schedule = (items: readonly ChatSummary[]) => {
      stop()
      if (!items.some((c) => c.running)) {
        pollStart.current = null
        return
      }
      if (document.visibilityState !== 'visible') return
      if (pollStart.current === null) pollStart.current = Date.now()
      const d = askListPollDelay(pollStart.current, Date.now())
      if (d !== null) timer = setTimeout(() => void read(), d)
    }
    const settle = async (items: readonly ChatSummary[]) => {
      const t = arrivedTransitions(prevRunning.current, items, new Set(readIds(ASK_KEYS.waiting)))
      prevRunning.current = new Set(t.running)
      const candidates = [...new Set([...t.fromWaiting, ...t.fromPolling])]
      if (candidates.length === 0) return
      const okIds = new Set<string>()
      await Promise.all(
        candidates.map(async (id) => {
          try {
            const d = await apiGet<ChatDetail>(`/api/v1/chats/${encodeURIComponent(id)}?limit=2`)
            if (lastAnswerOk(d.messages)) okIds.add(id)
          } catch {
            /* 확인하지 못한 방에는 「새 답」을 붙이지 않는다 — 방을 열면 결과가 보인다 */
          }
        }),
      )
      if (cancelled) return
      const r = settleArrivals(t, okIds)
      for (const id of r.leftWaiting) removeId(ASK_KEYS.waiting, id)
      for (const id of r.newIds) addId(ASK_KEYS.newAnswer, id)
      setStoreTick((n) => n + 1)
      if (r.toast) show(ASK_COPY.arrivedToast)
    }
    const read = async () => {
      stop()
      const my = ++seq
      try {
        const r = await apiGet<Paged<ChatSummary>>(`/api/v1/chats?kind=ASK&limit=${ASK_LIST_LIMIT}`)
        if (cancelled || my !== seq) return
        gotRows.current = true
        lastItems = r.items
        setList((prev) => mergeFirstPage(prev, r))
        setNow(new Date())
        setFirstFailed(false)
        void settle(r.items)
        schedule(r.items)
      } catch {
        if (cancelled || my !== seq) return
        if (gotRows.current) {
          // 폴링 중 한 번 실패 — 받은 행은 그대로 두고 다음 간격에 다시 읽는다.
          schedule(lastItems)
          return
        }
        const holdMs = retryAt.current === null ? 0 : retryFailHoldMs(true, retryAt.current, Date.now())
        retryAt.current = null
        holdTimer = setTimeout(() => {
          if (!cancelled) setFirstFailed(true)
        }, holdMs)
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') void read()
      else stop()
    }

    void read()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      stop()
      if (holdTimer) clearTimeout(holdTimer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [reloadKey, show])

  const more = async () => {
    if (!list?.cursor || loadingMore) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const r = await apiGet<Paged<ChatSummary>>(`/api/v1/chats?kind=ASK&limit=${ASK_LIST_LIMIT}&cursor=${encodeURIComponent(list.cursor)}`)
      setList((prev) => ({ items: appendRooms(prev?.items ?? null, r.items), cursor: r.nextCursor }))
    } catch (e) {
      setMoreError(actionErrorText(toErr(e)))
    } finally {
      setLoadingMore(false)
    }
  }

  const create = (text: string) =>
    createAskRoom(
      {
        lock: creatingRef,
        createChat: (title) => apiPost<CreatedChat>('/api/v1/chats', { kind: 'ASK', title }),
        handOff: (id, q) => {
          writeStore('session', ASK_KEYS.pending(id), q)
          writeStore('session', ASK_KEYS.draft, null)
          setEdited('')
        },
        // 이동이 끝날 때까지 잠금을 풀지 않는다(연타 → 방 두 개 방지). 돌아오면 화면이 새로 올라온다.
        go: (id) => router.push(`/ask/${encodeURIComponent(id)}`),
        setBusy,
        onError: (e) => show(actionErrorText(toErr(e))),
      },
      text,
    )

  const submit = () => {
    const bad = askDraftCheck(draft)
    if (bad) {
      show(bad === 'empty' ? ASK_COPY.emptyAsk : ASK_COPY.tooLong)
      return
    }
    if (creatingRef.current) return
    if (gate.acknowledged !== true) {
      heldRef.current = draft
      setSheetMode('first')
      setSheetOpen(true)
      return
    }
    void create(draft)
  }

  const closeSheet = () => {
    heldRef.current = null
    setSheetOpen(false)
  }

  const confirmSheet = () => {
    const text = heldRef.current
    heldRef.current = null
    setSheetOpen(false)
    gate.ack()
    if (text !== null) void create(text)
  }

  const focusInputEnd = () => {
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  const rooms = list?.items ?? null
  const view = askHomeView(rooms, firstFailed)

  let section: React.ReactNode = null
  if (view === 'loading') {
    section = (
      <section className="min-w-0">
        <h3 className="mb-2.5 text-[15px] font-bold">{ASK_COPY.roomsTitle}</h3>
        <ChatRowsSkeleton />
      </section>
    )
  } else if (view === 'error') {
    section = (
      <div role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13.5px] text-bad">
        <span className="block text-[14.5px] font-semibold">{ASK_COPY.listError}</span>
        <span className="block break-keep">{ASK_COPY.listErrorBody}</span>
        <button
          type="button"
          onClick={() => {
            retryAt.current = Date.now()
            setFirstFailed(false)
            setReloadKey((k) => k + 1)
          }}
          className="mt-0.5 inline-flex min-h-11 items-center font-semibold underline"
        >
          {ASK_COPY.retry}
        </button>
      </div>
    )
  } else if (view === 'list' && rooms) {
    section = (
      <section aria-labelledby={headingId} className="min-w-0">
        <h3 id={headingId} className="mb-2.5 text-[15px] font-bold">
          {ASK_COPY.roomsTitle}
        </h3>
        <ul className="flex min-w-0 flex-col gap-2">
          {rooms.map((c) => (
            <AskListItem key={c.id} chat={c} isNew={newIds.has(c.id)} now={now} />
          ))}
        </ul>
        {moreError ? (
          <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
            {moreError}
          </p>
        ) : null}
        {list?.cursor ? (
          <Btn variant="ghost" className="mt-2 w-full" onClick={() => void more()} aria-busy={loadingMore || undefined}>
            {loadingMore ? ASK_COPY.moreBusy : ASK_COPY.more}
          </Btn>
        ) : null}
      </section>
    )
  }

  return (
    <>
      <div className="flex min-w-0 flex-col gap-[18px] px-4 pb-8">
        <AskComposerCard
          value={draft}
          busy={busy}
          onChange={setEdited}
          onSubmit={submit}
          onScopeInfo={() => {
            heldRef.current = null
            setSheetMode('again')
            setSheetOpen(true)
          }}
          inputRef={inputRef}
        />
        <AskExamples mode={askExamplesMode(view)} onPick={(q) => { setEdited(q); focusInputEnd() }} />
        {section}
      </div>
      <Toast message={toastMessage} />
      <ScopeNoticeSheet open={sheetOpen} mode={sheetMode} onConfirm={confirmSheet} onClose={closeSheet} />
    </>
  )
}
