'use client'

/**
 * 대답 연습 제안(S10 = #169 `POST /api/v1/chats/:id/reply-practice {messageId}`, 저장 없음) — 펼칠 때만, 선생님 말마다 한 번.
 * 받은 제안은 메시지 id 별로 메모리에 두고(접었다 펼쳐도 다시 부르지 않는다) 다른 말이 오면 버린다.
 * 판 닫음·새 말·언마운트에서 요청을 취소하고, 12초가 지나면 끊고 다시 시도로 보인다(5초부터 "조금만 기다려 주세요").
 * 이 API 가 아직 없는 서버(404·405)·네트워크 실패도 판 안 오류(`pr-error`)로 처리한다. 결말 판단(늦은 응답 버림 등)은 `practiceLogic.settlePractice`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { settlePractice, type PracticeFailure, type PracticeView } from './practiceLogic'

export const PRACTICE_TIMEOUT_MS = 12_000
export const PRACTICE_SLOW_MS = 5_000

export type PracticeState =
  | { phase: 'idle' }
  | { phase: 'loading'; slow: boolean }
  | { phase: 'ready'; view: PracticeView }
  | { phase: 'failed'; failure: PracticeFailure; until: number | null }

interface Live {
  ac: AbortController | null
  timeout: ReturnType<typeof setTimeout> | null
  slow: ReturnType<typeof setTimeout> | null
  timedOut: boolean
}

export function usePractice(chatId: string, messageId: string | null, onFailure: (f: PracticeFailure) => void) {
  const [entry, setEntry] = useState<{ id: string; state: PracticeState } | null>(null)
  const cache = useRef(new Map<string, PracticeView>())
  const live = useRef<Live>({ ac: null, timeout: null, slow: null, timedOut: false })
  const failRef = useRef(onFailure)
  useEffect(() => {
    failRef.current = onFailure
  }, [onFailure])

  const cancel = useCallback(() => {
    const l = live.current
    l.ac?.abort()
    if (l.timeout) clearTimeout(l.timeout)
    if (l.slow) clearTimeout(l.slow)
    live.current = { ac: null, timeout: null, slow: null, timedOut: false }
  }, [])

  // 다른 말이 오면 앞 말의 요청·제안을 버린다.
  useEffect(() => {
    cancel()
    for (const k of cache.current.keys()) if (k !== messageId) cache.current.delete(k)
  }, [messageId, cancel])
  useEffect(() => cancel, [cancel])

  const load = useCallback(
    (id: string) => {
      const hit = cache.current.get(id)
      if (hit) {
        setEntry({ id, state: { phase: 'ready', view: hit } })
        return
      }
      cancel()
      const ac = new AbortController()
      const l: Live = { ac, timeout: null, slow: null, timedOut: false }
      l.timeout = setTimeout(() => {
        l.timedOut = true
        ac.abort()
      }, PRACTICE_TIMEOUT_MS)
      l.slow = setTimeout(() => setEntry((e) => (e?.id === id && e.state.phase === 'loading' ? { id, state: { phase: 'loading', slow: true } } : e)), PRACTICE_SLOW_MS)
      live.current = l
      setEntry({ id, state: { phase: 'loading', slow: false } })
      void (async () => {
        try {
          await settlePractice({
            request: () => apiPost<unknown>(`/api/v1/chats/${encodeURIComponent(chatId)}/reply-practice`, { messageId: id }, { signal: ac.signal }),
            messageId: id,
            live: () => live.current === l,
            timedOut: () => l.timedOut,
            settle: (r) => {
              if (r.kind === 'ready') {
                cache.current.set(id, r.view)
                setEntry({ id, state: { phase: 'ready', view: r.view } })
                return
              }
              const { failure } = r
              setEntry({ id, state: { phase: 'failed', failure, until: failure.kind === 'rate' ? Date.now() + failure.sec * 1000 : null } })
              if (r.report) failRef.current(failure)
            },
          })
        } finally {
          if (live.current === l) {
            if (l.timeout) clearTimeout(l.timeout)
            if (l.slow) clearTimeout(l.slow)
            live.current = { ac: null, timeout: null, slow: null, timedOut: false }
          }
        }
      })()
    },
    [chatId, cancel],
  )

  const state: PracticeState = entry && entry.id === messageId ? entry.state : { phase: 'idle' }
  return { state, load, cancel }
}
