'use client'

/**
 * 회화방 재확인 카드 상태(task-012b-2 가이드 §4) — #21c `?chatId=&reviewable=1` 로 확인할 발화를 받아 메시지 id 로 묶는다.
 * conversation 의 메시지 DTO(#29)를 건드리지 않고 화면이 메시지 id ↔ 발화 `chatMessageId` 로 맞춘다(6층: conversation↔speech 는 화면·라우트가 조합).
 *
 *  - 언제 부르나: 방 첫 로드(메시지와 병렬, 기다리지 않음) · 화면이 다시 보일 때 · 회화가 쉬는 상태로 돌아올 때 1번 ·
 *    30초 주기는 화면이 보이고 + 쉬는 중이고 + 6분 안에 만든 내 음성 메시지가 있을 때만(D-4 — 분석은 대화가 멈춘 뒤 나온다).
 *  - 턴 보호(완료 기준 7): `paused`(녹음·인식·보내기 대기·생각 중·말하는 중) 동안은 요청하지 않는다. 기록(#21a)은 사용자 행동이라 막지 않는다.
 *  - 실패는 조용히(카드는 부가 정보 — 다음 주기에). 남의 방 404 도 카드 0.
 *  - 펼친 카드는 방에서 한 번에 하나. 펼쳤거나 기록 중인 카드는 갱신이 지우지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import type { UtteranceFinalSource, UtteranceListDto } from '@/types/speech'
import { hasRecentVoice, refreshRoomReviews, REVIEW_POLL_MS, shouldPoll, type ReviewEntry, type VoiceMessageLike } from './utteranceReview'

export interface UtteranceReviews {
  entryFor: (messageId: string) => ReviewEntry | null
  openId: string | null
  setOpen: (utteranceId: string | null) => void
  /** 카드가 기록 중이면 갱신이 그 카드를 지우지 않게 붙잡는다. */
  pin: (utteranceId: string, on: boolean) => void
  markResolved: (messageId: string, source: UtteranceFinalSource) => void
  /** 409·404 — 다음 갱신 때 빠지도록 붙잡기만 푼다. */
  release: (utteranceId: string) => void
}

export function useUtteranceReviews({ chatId, messages, paused }: { chatId: string; messages: readonly VoiceMessageLike[]; paused: boolean }): UtteranceReviews {
  const [entries, setEntries] = useState<Map<string, ReviewEntry>>(() => new Map())
  const [openId, setOpenId] = useState<string | null>(null)
  const [room, setRoom] = useState(chatId)
  if (room !== chatId) {
    setRoom(chatId)
    setEntries(new Map())
    setOpenId(null)
  }
  const pinned = useRef(new Set<string>())
  const inflight = useRef<string | null>(null)
  const roomRef = useRef(chatId)
  const messagesRef = useRef(messages)
  const pausedRef = useRef(paused)
  const openRef = useRef(openId)

  useEffect(() => {
    roomRef.current = chatId
    messagesRef.current = messages
    pausedRef.current = paused
    openRef.current = openId
  })

  // 본문(턴 중·진행 중 건너뜀 · 방 바뀌면 응답 버림 · 실패 조용히)은 `refreshRoomReviews` — 단위 테스트가 그대로 부른다(REV-132 L-3).
  const refresh = useCallback(async () => {
    await refreshRoomReviews(chatId, {
      currentRoom: () => roomRef.current,
      paused: () => pausedRef.current,
      inflight,
      fetchList: (id) => apiGet<UtteranceListDto>(`/api/v1/speech/utterances?${new URLSearchParams({ chatId: id, reviewable: '1', limit: '50' })}`),
      keep: () => {
        const keep = new Set(pinned.current)
        if (openRef.current) keep.add(openRef.current)
        return keep
      },
      apply: setEntries,
    })
  }, [chatId])

  // 방 첫 로드 · 방이 바뀌면 처음부터(상태 초기화는 위 렌더 중 비교가 한다)
  useEffect(() => {
    pinned.current = new Set()
    void refresh()
  }, [refresh])

  // 쉬는 상태로 돌아오면 한 번
  const wasPaused = useRef(paused)
  useEffect(() => {
    if (wasPaused.current && !paused) void refresh()
    wasPaused.current = paused
  }, [paused, refresh])

  // 화면이 다시 보일 때 · 주기
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    const timer = setInterval(() => {
      const go = shouldPoll({
        visible: document.visibilityState === 'visible',
        paused: pausedRef.current,
        recentVoice: hasRecentVoice(messagesRef.current, Date.now()),
      })
      if (go) void refresh()
    }, REVIEW_POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(timer)
    }
  }, [refresh])

  const entryFor = useCallback((messageId: string) => entries.get(messageId) ?? null, [entries])
  const pin = useCallback((id: string, on: boolean) => {
    if (on) pinned.current.add(id)
    else pinned.current.delete(id)
  }, [])
  const markResolved = useCallback((messageId: string, source: UtteranceFinalSource) => {
    setEntries((prev) => {
      const e = prev.get(messageId)
      if (!e) return prev
      const next = new Map(prev)
      next.set(messageId, { ...e, resolved: source })
      return next
    })
  }, [])
  const release = useCallback((id: string) => {
    pinned.current.delete(id)
  }, [])

  return { entryFor, openId, setOpen: setOpenId, pin, markResolved, release }
}
