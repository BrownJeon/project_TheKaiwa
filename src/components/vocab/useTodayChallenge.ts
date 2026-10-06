'use client'

/**
 * 오늘 탭·덱이 읽는 #158(`GET /api/v1/challenges/today`, DB 만 — LLM 0). 실패하면 지난 값을 유지하지 않는다(가이드 §5) —
 * 오늘 탭은 실패 시 지금 카드 그대로 + 맨 위 한 줄 오류(E8).
 */
import { useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import type { ChallengeTodayResponse } from '@/types/challenge'

export type ChallengeLoad = { state: 'loading' | 'error' | 'ready'; data: ChallengeTodayResponse | null }

export const fetchChallengeToday = () => apiGet<ChallengeTodayResponse>('/api/v1/challenges/today')

export function useTodayChallenge(...deps: number[]): [ChallengeLoad, () => void] {
  const [load, setLoad] = useState<ChallengeLoad>({ state: 'loading', data: null })
  const [retryTick, setRetryTick] = useState(0)
  const key = deps.join(',')
  useEffect(() => {
    let cancelled = false
    fetchChallengeToday().then(
      (d) => !cancelled && setLoad({ state: 'ready', data: d }),
      () => !cancelled && setLoad({ state: 'error', data: null }),
    )
    return () => {
      cancelled = true
    }
  }, [key, retryTick])
  return [load, () => setRetryTick((t) => t + 1)]
}
