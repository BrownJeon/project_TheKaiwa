'use client'

/**
 * 회화방 일본어 도우미 상태(task-056, screens §22-10) — #180 `POST /api/v1/chats/:id/phrase-help {queryKo}`, 저장 없음.
 *  - 모든 값은 **메모리만**(방을 나가면 사라짐) — 질의 초안·결과를 localStorage·sessionStorage 에 두지 않는다.
 *  - 요청은 동시에 하나, 화면 총 상한 12초(5초부터 「조금만 기다려 주세요」). 판을 닫아도 요청은 끝까지 받아 결과를 기억한다
 *    (다시 열면 보임). 취소는 둘뿐: 언마운트, 그리고 **말하기·회화 턴을 시작할 때 아직 답이 오지 않은 요청**(`cancelPending` — 도우미가 먼저 돌면
 *    회화 턴 첫 소리가 늦어져 5초 예산을 넘긴다, 사용자 결정 2026-10-11). 취소하면 `idle` · 질의 유지 · 안내 줄에 멈춤 안내(오류 아님).
 *  - 결과 낭독(늘 마운트된 sr 줄)은 녹음 중이면 끝난 뒤로 미룬다(§9-0 ⑨).
 *  - 소리는 `useKeyedSound` 키 `helper:{index}` — 한 번에 하나. 판이 닫히거나 방 소리가 나면 멈춘다.
 * 요청 수명주기(동시에 하나·타이머·취소·늦은 응답 버림)는 `phraseHelperLogic.createHelperRequester`, 결말 판단은 `settleHelper`.
 * 엔진·모델 이름은 다루지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { useKeyedSound } from '@/components/scenario/useKeyedSound'
import type { PhraseHelpItem } from '@/types/phraseHelp'
import { askBlockOf, cancelNoteOnCancel, cancelNoteOnOpen, createHelperRequester, helperAnnounceOf, helperPanelShown, type CancelNote, type HelperSettle } from './phraseHelperLogic'

export type HelperPhase = 'idle' | 'loading' | 'slow' | 'result' | 'none' | 'error' | 'timeout' | 'rate' | 'busy'

export interface PhraseHelperDeps {
  chatId: string
  /** 도우미가 잠긴 상태(`helperLocked` — 녹음·인식 + 선생님이 답하는 중) — 입력·[물어보기]·카드 버튼이 잠기고 결과 낭독은 풀린 뒤로 미룬다. */
  recording: boolean
  /** 마친 역할극 — 판·버튼을 그리지 않는다(열려 있던 판은 사라지고 `open` 만 남는다). */
  ended: boolean
  /** 방 재생(선생님 말)이 소리를 내는 중 — 도우미 소리를 멈춘다. */
  roomSounding: boolean
  /** ▶ 를 누르면 먼저 방 소리(선생님 말·대답 연습)를 멈춘다. */
  stopOthers: () => void
  /** 409 ENDED — 마친 역할극으로 다시 읽는다. */
  onEnded: () => void
}

export function usePhraseHelper(d: PhraseHelperDeps) {
  const { chatId } = d
  const [open, setOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [phase, setPhase] = useState<HelperPhase>('idle')
  const [items, setItems] = useState<PhraseHelpItem[]>([])
  const [more, setMore] = useState(false)
  const [rateUntil, setRateUntil] = useState<number | null>(null)
  const [emptyHint, setEmptyHint] = useState(false)
  const [serverMsg, setServerMsg] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [cancelNote, setCancelNote] = useState<CancelNote>(null)

  const [req] = useState(createHelperRequester)
  const lastSentRef = useRef<string | null>(null)
  const pendingAnnounce = useRef<string | null>(null)
  const recordingRef = useRef(d.recording)
  const depsRef = useRef(d)
  useEffect(() => {
    depsRef.current = d
  })
  const openRef = useRef(false)
  useEffect(() => {
    openRef.current = open
  }, [open])

  const sound = useKeyedSound()
  const { stop: stopSound, tap: tapSound } = sound

  const say = useCallback((msg: string) => {
    if (!msg) return
    if (recordingRef.current) pendingAnnounce.current = msg
    else setAnnounce(msg)
  }, [])

  useEffect(() => {
    recordingRef.current = d.recording
    if (!d.recording && pendingAnnounce.current !== null) {
      const m = pendingAnnounce.current
      pendingAnnounce.current = null
      setAnnounce(m)
    }
  }, [d.recording])

  /**
   * 아직 답이 오지 않은 요청(로딩·slow)을 멈춘다 — 결과가 이미 있거나 끝난 상태에는 손대지 않는다. 멈췄으면 `idle` · 질의 유지 · 안내 표시.
   * 판이 닫혀 있어도 요청은 살아 있을 수 있으므로(닫아도 끝까지 받는다) 열림 여부와 무관하게 부른다.
   * 부르는 곳(방): 마이크를 누를 때(`onPress`) · 모든 턴 시작(`sendOutgoing`). 훅 안 효과에서 상태를 바꾸지 않으려고 방의 사건 처리기에서만 부른다.
   */
  const cancelPending = useCallback(() => {
    if (!req.cancelPending()) return false
    setPhase('idle')
    setCancelNote(cancelNoteOnCancel(helperPanelShown({ open: openRef.current, ended: depsRef.current.ended })))
    return true
  }, [req])

  useEffect(() => {
    if (!open || d.roomSounding) stopSound()
  }, [open, d.roomSounding, stopSound])

  // 언마운트 — 받는 중인 요청을 버린다(방을 나가면 결과도 사라진다).
  useEffect(() => () => req.dispose(), [req])

  const setQuery = (q: string) => {
    setQueryState(q)
    setServerMsg(null)
    if (q.trim() !== '') setEmptyHint(false)
  }

  const rateWaiting = () => rateUntil !== null && Date.now() < rateUntil

  const settle = (r: HelperSettle) => {
    if (r.kind === 'items') {
      setItems(r.items)
      setPhase(r.items.length ? 'result' : 'none')
      say(helperAnnounceOf(r))
      return
    }
    const f = r.failure
    switch (f.kind) {
      case 'invalid':
        setServerMsg(f.message)
        setPhase('idle')
        return
      case 'ended':
        setPhase('idle')
        setOpen(false)
        setTyping(false)
        depsRef.current.onEnded()
        return
      case 'rate':
        setRateUntil(Date.now() + f.sec * 1000)
        setPhase('rate')
        say(helperAnnounceOf(r))
        return
      default:
        setPhase(f.kind)
    }
  }

  /** 물어보기 — 칩·[다시 시도]는 그 말을 넘긴다(입력칸도 그 말로). 막혀 있으면 이유만 남기고 보내지 않는다. */
  const ask = (override?: string) => {
    const q = override ?? query
    const block = askBlockOf({ query: q, pending: req.pending(), recording: recordingRef.current, rateWaiting: rateWaiting() })
    if (override !== undefined && override !== query) setQuery(override)
    if (block === 'empty') setEmptyHint(true)
    if (block) return
    lastSentRef.current = q
    stopSound()
    setPhase('loading')
    setMore(false)
    setServerMsg(null)
    setEmptyHint(false)
    setRateUntil(null)
    setCancelNote(null)
    setAnnounce('')
    pendingAnnounce.current = null
    void req.start((signal) => apiPost<unknown>(`/api/v1/chats/${encodeURIComponent(chatId)}/phrase-help`, { queryKo: q.trim() }, { signal }), {
      onSlow: () => setPhase((p) => (p === 'loading' ? 'slow' : p)),
      settle,
    })
  }

  /** [다시 시도] — 마지막으로 보낸 말을 다시 묻는다. */
  const retry = () => ask(lastSentRef.current ?? query)

  const close = useCallback(() => {
    setOpen(false)
    setTyping(false)
  }, [])

  /** 열기는 안내 표시를 정리한다(이미 본 안내는 지우고, 닫혀 있는 동안 생긴 안내는 이번에 보인다). 닫기는 `close`. */
  const openPanel = (v: boolean) => {
    setOpen(v)
    if (v) setCancelNote(cancelNoteOnOpen)
  }

  const play = (index: number, text: string) => {
    depsRef.current.stopOthers()
    tapSound(`helper:${index}`, text)
  }

  return {
    open,
    /** 판을 그리는가 — 열려 있고 마친 역할극이 아닐 때. 말하는 중(녹음·인식)·결과 유무와 무관하다(⑤A, `helperPanelShown`). */
    shown: helperPanelShown({ open, ended: d.ended }),
    setOpen: openPanel,
    close,
    query,
    setQuery,
    phase,
    items,
    more,
    setMore,
    rateUntil,
    emptyHint,
    serverMsg,
    /** 말하느라 멈춘 요청의 안내를 안내 줄에 보일지(`cancelNote !== null`). */
    cancelled: cancelNote !== null,
    cancelPending,
    typing,
    setTyping,
    announce,
    ask,
    retry,
    sound,
    play,
    stopSound,
    /** 다시 열 때 입력칸에 초점을 줄지 — 이전 답(결과·실패·요청 중)이 없을 때만. */
    fresh: phase === 'idle',
  }
}

export type PhraseHelper = ReturnType<typeof usePhraseHelper>
