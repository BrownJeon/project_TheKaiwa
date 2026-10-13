'use client'

/**
 * 지난 질문 읽기·「답 만드는 중」 폴링·「새 답」 도착 판정(task-066 §26-4 A — task-064 `AskHome` 의 코드를 옮김, 숫자·조건은 §25-4 D 그대로).
 * - 읽기: #27 `kind=ASK` 첫 쪽. 탭 화면 마운트 · 화면이 다시 보일 때 · 지금 대화가 바뀔 때 · 시트를 열 때(`refresh`).
 * - `running` 행이 있으면 `askListPollDelay` 간격으로 다시 읽고, 없거나 화면이 가려지면 멈춘다.
 * - 끝난 방은 성공한 답인지 #29 로 확인한 뒤에만 「새 답」(L-8). 폴링 중 `running → false` 를 본 경우에만 토스트 한 번.
 * - 알약 값(`running`·`newCount`)과 도착 판정(토스트·「새 답」 기록)은 **지금 대화를 빼고** 한다(`askActivityOf`·`planArrivals` — 같은 기준).
 * 「새 답」·기다리던 방은 이 기기 sessionStorage 에만 있다. 저장소 값은 수화 뒤에만 읽는다(서버 렌더와 첫 화면을 같게).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { apiGet } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { actionErrorText } from '@/components/chat/labels'
import { retryFailHoldMs } from '@/components/topic/logic'
import type { ChatDetail, ChatSummary, Paged } from '@/types/chat'
import { ASK_COPY } from './askCopy'
import { ASK_KEYS, addId, readIds, removeId } from './logic'
import { ASK_LIST_LIMIT, appendRooms, askActivityOf, askListPollDelay, lastAnswerOk, mergeFirstPage, planArrivals, settleArrivals } from './homeLogic'

type RoomList = { items: ChatSummary[]; cursor: string | null }

export interface AskActivity {
  items: ChatSummary[]
  cursor: string | null
  state: 'loading' | 'ready' | 'error'
  /** 지금 대화를 뺀 값(알약) */
  running: boolean
  newCount: number
  newIds: ReadonlySet<string>
  /** 목록 시각("오늘/어제") 기준 — 렌더 중에 시계를 읽지 않게 읽을 때 같이 정한다 */
  now: Date | null
  moreBusy: boolean
  moreError: string | null
  refresh: () => void
  more: () => void
}

const noopSubscribe = () => () => {}

export function useAskActivity(currentChatId: string | null, onToast: (msg: string) => void): AskActivity {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const [list, setList] = useState<RoomList | null>(null)
  const [firstFailed, setFirstFailed] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [moreBusy, setMoreBusy] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // 저장소(「새 답」 집합)를 고친 뒤 다시 그리게 하는 신호.
  const [, setStoreTick] = useState(0)
  const retryAt = useRef<number | null>(null)
  const gotRows = useRef(false)
  const prevRunning = useRef<Set<string> | null>(null)
  const pollStart = useRef<number | null>(null)
  const toastRef = useRef(onToast)
  useEffect(() => {
    toastRef.current = onToast
  }, [onToast])

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
      const t = planArrivals(prevRunning.current, items, new Set(readIds(ASK_KEYS.waiting)), currentChatId)
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
            /* 확인하지 못한 방에는 「새 답」을 붙이지 않는다 — 열면 결과가 보인다 */
          }
        }),
      )
      if (cancelled) return
      const r = settleArrivals(t, okIds)
      for (const id of r.leftWaiting) removeId(ASK_KEYS.waiting, id)
      for (const id of r.newIds) addId(ASK_KEYS.newAnswer, id)
      setStoreTick((n) => n + 1)
      if (r.toast) toastRef.current(ASK_COPY.arrivedToast)
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
  }, [reloadKey, currentChatId])

  const refresh = useCallback(() => {
    if (!gotRows.current) {
      retryAt.current = Date.now()
      setFirstFailed(false)
    }
    setReloadKey((k) => k + 1)
  }, [])

  const cursor = list?.cursor ?? null
  const more = useCallback(() => {
    if (!cursor || moreBusy) return
    setMoreBusy(true)
    setMoreError(null)
    apiGet<Paged<ChatSummary>>(`/api/v1/chats?kind=ASK&limit=${ASK_LIST_LIMIT}&cursor=${encodeURIComponent(cursor)}`)
      .then((r) => setList((prev) => ({ items: appendRooms(prev?.items ?? null, r.items), cursor: r.nextCursor })))
      .catch((e) => setMoreError(actionErrorText(toErr(e))))
      .finally(() => setMoreBusy(false))
  }, [cursor, moreBusy])

  const items = list?.items ?? []
  const newIds = new Set(hydrated ? readIds(ASK_KEYS.newAnswer) : [])
  const a = askActivityOf(items, currentChatId, newIds)
  return {
    items,
    cursor,
    state: list ? 'ready' : firstFailed ? 'error' : 'loading',
    running: a.running,
    newCount: a.newCount,
    newIds,
    now,
    moreBusy,
    moreError,
    refresh,
    more,
  }
}
