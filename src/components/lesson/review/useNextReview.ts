'use client'

/**
 * 복습 종료 카드의 "다음 복습" 값 흐름(screens §14-2 I · Leader ⑤).
 *  - 방금 끝냄: #62 `nextReview` 가 있으면 그대로. `reviewDecisionJobId` 가 있으면 대기 → #55(2·3·5초) → DONE·FAILED 어느 쪽이든 #60 을 다시 읽는다
 *    (실패면 서버가 FALLBACK 으로 채운다). 잡도 값도 없으면(가드 등) 모름.
 *  - 다시 들어옴(#60 DONE): 값이 없으면 지켜볼 잡 id 가 없으므로 화면이 보이는 동안 #60 을 5·10·20·30초에 다시 읽고 멈춘다. 그 뒤는 화면 복귀 때 한 번.
 * #60 은 이 훅이 직접 읽는다(`useLesson.reload` 는 수업 화면 전체 상태를 바꾸므로 쓰지 않는다). 초점은 옮기지 않는다.
 */
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import type { LessonDto } from '@/types/lesson'
import type { NextReviewDetail } from '@/types/review'
import { useJobWatch } from '../useJobWatch'

export type NextReviewState = 'pending' | 'ready' | 'unknown'

/** 다시 들어왔을 때 #60 을 다시 읽는 시점(마운트에서 ms). */
export const NEXT_REVIEW_REREAD_AT_MS = [5000, 10000, 20000, 30000] as const

/** 방금 끝낸 #62 의 복습 칸 — 다시 들어왔으면 null. */
export interface FreshReviewEnd {
  jobId: string | null
  nextReview: NextReviewDetail | null
}

export function initialNextReviewPhase(initial: NextReviewDetail | null, fresh: FreshReviewEnd | null): 'pending' | 'settled' {
  if (initial) return 'settled'
  if (fresh && !fresh.jobId) return 'settled'
  return 'pending'
}

export function nextReviewState(next: NextReviewDetail | null, phase: 'pending' | 'settled'): NextReviewState {
  if (next) return 'ready'
  return phase === 'pending' ? 'pending' : 'unknown'
}

export function useNextReview(lessonId: string, stored: NextReviewDetail | null, fresh: FreshReviewEnd | null): { state: NextReviewState; next: NextReviewDetail | null } {
  const initial = fresh?.nextReview ?? stored ?? null
  const [next, setNext] = useState<NextReviewDetail | null>(initial)
  const [phase, setPhase] = useState<'pending' | 'settled'>(() => initialNextReviewPhase(initial, fresh))

  const read = useCallback(async (): Promise<NextReviewDetail | null> => {
    try {
      const l = await apiGet<LessonDto>(`/api/v1/lessons/${encodeURIComponent(lessonId)}`)
      return l.nextReview ?? null
    } catch {
      return null
    }
  }, [lessonId])

  const watchJob = !next && phase === 'pending' && fresh?.jobId ? fresh.jobId : null
  useJobWatch(watchJob, {
    delays: [2000, 3000, 5000],
    onSettled: () => {
      void read().then((n) => {
        if (n) setNext(n)
        setPhase('settled')
      })
    },
  })

  const rereading = !fresh && !next
  useEffect(() => {
    if (!rereading) return
    let stopped = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const tryOnce = async (last: boolean) => {
      if (stopped) return
      const n = document.visibilityState === 'hidden' ? null : await read()
      if (stopped) return
      if (n) setNext(n)
      if (n || last) setPhase('settled')
    }
    NEXT_REVIEW_REREAD_AT_MS.forEach((ms, i) => timers.push(setTimeout(() => void tryOnce(i === NEXT_REVIEW_REREAD_AT_MS.length - 1), ms)))
    const onVis = () => {
      if (document.visibilityState === 'visible') void tryOnce(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopped = true
      timers.forEach(clearTimeout)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [rereading, read])

  return { state: nextReviewState(next, phase), next }
}
