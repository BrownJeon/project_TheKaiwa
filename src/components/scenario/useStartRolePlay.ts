'use client'

/**
 * 역할극 시작(S5 = #28 `POST /api/v1/chats {kind:'TALK', scenarioId, lessonId?}`) + 회화방으로 이동 + 실패 분류.
 * 시트·결과·마친 바(B2·B3)가 함께 쓴다. 성공하면 이동이 끝날 때까지 "시작하는 중"을 유지한다(두 번 눌러 대화가 둘 생기지 않게).
 * 서버가 아직 상황 대화를 열지 않았으면 400 `FEATURE_NOT_READY` — 시작 실패(`sh-start-fail`)로 보인다.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import type { CreatedChat } from '@/types/chat'
import { startFailureOf, type StartFailure } from './logic'
import { talkRoomHref } from './scenarioCopy'

export type StartState = { phase: 'idle' } | { phase: 'starting' } | { phase: 'failed'; failure: StartFailure }

export function useStartRolePlay() {
  const router = useRouter()
  const [state, setState] = useState<StartState>({ phase: 'idle' })
  const busy = useRef(false)

  const start = useCallback(
    async (scenarioId: string, opts?: { lessonId?: string | null }) => {
      if (busy.current) return
      busy.current = true
      setState({ phase: 'starting' })
      try {
        const body = { kind: 'TALK', scenarioId, ...(opts?.lessonId ? { lessonId: opts.lessonId } : {}) }
        const chat = await apiPost<CreatedChat>('/api/v1/chats', body)
        router.push(talkRoomHref(chat.id))
      } catch (e) {
        busy.current = false
        setState({ phase: 'failed', failure: startFailureOf(toErr(e)) })
      }
    },
    [router],
  )

  const resume = useCallback((chatId: string) => router.push(talkRoomHref(chatId)), [router])

  const reset = useCallback(() => {
    if (!busy.current) setState({ phase: 'idle' })
  }, [])

  return { state, start, resume, reset }
}
