'use client'

/**
 * #50·#51 세션당 한 줄 큐(screens.md §5-3 A). 표시 토글과 답이 섞여도 서버 도착 순서가 누른 순서와 같고,
 * finish 는 큐 맨 뒤에 붙는다(앞선 답이 모두 저장된 뒤 끝냄 — 순서가 뒤집히면 마지막 답이 SKIPPED 로 굳는다).
 * 언마운트해도 남은 요청은 끝까지 보낸다(abort 하지 않음 — 답 저장이 목적). 화면 갱신은 호출부가 막는다.
 */
import { useCallback, useState } from 'react'
import { apiPost } from '@/components/common/api'
import type { AttemptBody, AttemptResult, FinishResult, FlagResult } from '@/types/vocab'
import { createSerialQueue } from './deck'

export function useAttemptQueue(sessionId: string) {
  const [queue] = useState(createSerialQueue)
  const base = `/api/v1/vocab/sessions/${encodeURIComponent(sessionId)}`

  const send = useCallback(
    <T extends AttemptResult | FlagResult>(body: AttemptBody) => queue.run(() => apiPost<T>(`${base}/attempts`, body)),
    [base, queue],
  )
  const finish = useCallback(() => queue.run(() => apiPost<FinishResult>(`${base}/finish`)), [base, queue])
  return { send, finish }
}
