'use client'

/**
 * 오늘 복습 건너뛰기 — 5초 되돌리기(screens §14-2 C, 결정 b=B). 상태는 `TodayHome` 에 하나만 둔다(카드가 위·아래로 옮겨도 끊기지 않게).
 *  - [오늘은 건너뛰기] → `pending`(요청 없음) → 5초 뒤 #64 1회. 5초 안 [되돌리기] → `idle`, 요청 0회.
 *  - **5초 안에 화면을 떠나면**(`visibilitychange → hidden`·`pagehide`·언마운트) 그 자리에서 `keepalive` 로 바로 보낸다 — 사용자는 이미
 *    "건너뛰었어요"를 보고 떠났고, 백그라운드 타이머는 늦거나 멈춰서 믿을 수 없다(§14-2 C 이유 ①~④).
 *  - 떠나면서 보낸 요청이 실패하면 `sessionStorage` 에 일정 id 를 남기고, 다음에 홈을 열었을 때 그 일정이 아직 DUE 면 실패 줄을 한 번 보인다.
 *  - 타이머·숨김·언마운트가 겹쳐도 #64 는 한 번(`skipController` 의 `committed`). 응답의 `review.id` 가 바뀌면(날짜가 바뀜) 로컬 상태를 버린다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import type { SkipReviewResult, TodayReview } from '@/types/review'
import { RV_HOME } from './reviewCopy'
import { SKIP_IDLE, skipFailureKind, type SkipState } from './reviewLogic'
import { createSkipController, type SkipController, type SkipFocusTarget } from './skipController'

export { SKIP_UNDO_MS } from './skipController'
export const REVIEW_KEYS = {
  skipFailed: 'kaiwa.review.skipFailed',
  itemsOpen: (lessonId: string) => `kaiwa.review.itemsOpen.${lessonId}`,
} as const

export interface ReviewSkip {
  skip: SkipState
  /** 카드 안 실패 줄(`role=alert`)을 보일까 — 이번 화면의 실패 또는 지난번 떠나며 실패한 기록. */
  skipFailed: boolean
  undoOpen: boolean
  start: () => void
  undo: () => void
  undoRef: React.RefObject<HTMLButtonElement | null>
  skipBtnRef: React.RefObject<HTMLButtonElement | null>
  titleRef: React.RefObject<HTMLHeadingElement | null>
}

export function useReviewSkip(review: TodayReview | null, o: { onCommitted: () => void; onToast: (msg: string) => void }): ReviewSkip {
  const [skip, setSkip] = useState<SkipState>(SKIP_IDLE)
  // 지난번 떠나며 실패한 일정 id — 마운트 때 한 번 읽는다(서버 렌더에선 null, 복습 칸은 #58 을 읽은 뒤에야 그려져 hydration 차이가 없다).
  const [flaggedId, setFlaggedId] = useState<string | null>(() => readStore('session', REVIEW_KEYS.skipFailed))
  const [focusReq, setFocusReq] = useState<{ target: SkipFocusTarget; n: number } | null>(null)
  const mountedRef = useRef(true)
  const cbRef = useRef(o)
  const undoRef = useRef<HTMLButtonElement | null>(null)
  const skipBtnRef = useRef<HTMLButtonElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)

  useLayoutEffect(() => {
    cbRef.current = o
  })

  // 상태 전이는 `skipController`(단위 테스트 대상)에 있다. 여기서는 React 상태·초점·저장소·요청만 잇는다.
  // 렌더 중에 ref 를 넘기지 않도록 처음 쓰는 순간(이벤트·effect) 만든다.
  const ctlRef = useRef<SkipController | null>(null)
  const ctl = useCallback((): SkipController => {
    ctlRef.current ??= createSkipController({
      post: (id, leaving) => apiPost<SkipReviewResult>(`/api/v1/reviews/${encodeURIComponent(id)}/skip`, {}, leaving ? { keepalive: true } : undefined),
      failureKind: (e) => skipFailureKind(toErr(e)),
      render: (s) => {
        if (mountedRef.current) setSkip(s)
      },
      isMounted: () => mountedRef.current,
      onCommitted: () => cbRef.current.onCommitted(),
      onUndone: () => cbRef.current.onToast(RV_HOME.undone),
      focus: (target) => {
        if (mountedRef.current) setFocusReq((p) => ({ target, n: (p?.n ?? 0) + 1 }))
      },
      undoHasFocus: () => typeof document !== 'undefined' && !!undoRef.current && document.activeElement === undoRef.current,
      flagLeaveFailure: (id) => writeStore('session', REVIEW_KEYS.skipFailed, id),
      clearLeaveFailure: () => {
        setFlaggedId(null)
        writeStore('session', REVIEW_KEYS.skipFailed, null)
      },
    })
    return ctlRef.current
  }, [])

  const start = useCallback(() => ctl().start(review), [ctl, review])
  const undo = useCallback(() => ctl().undo(), [ctl])

  // 떠남 = 즉시 보냄(취소 아님). 언마운트(다른 탭·수업 경로)도 같다.
  useEffect(() => {
    mountedRef.current = true
    const leave = () => void ctl().commit(true)
    const onVis = () => {
      if (document.visibilityState === 'hidden') leave()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', leave)
      mountedRef.current = false
      leave()
      ctl().clearTimer()
    }
  }, [ctl])

  // 날짜가 바뀌어 다른 일정이 오면 로컬 건너뛰기를 버린다(보내지 않음). 지난번 실패 기록은 일정을 읽은 뒤 저장소에서 지운다(한 번만 보인다).
  const reviewId = review?.id ?? null
  useEffect(() => {
    ctl().reviewChanged(reviewId)
    if (reviewId && flaggedId) writeStore('session', REVIEW_KEYS.skipFailed, null)
  }, [ctl, reviewId, flaggedId])

  useEffect(() => {
    if (!focusReq) return
    const el = focusReq.target === 'undo' ? undoRef.current : focusReq.target === 'skip' ? skipBtnRef.current : titleRef.current
    el?.focus()
  }, [focusReq])

  const skipFailed = !!review && review.status === 'DUE' && ((skip.phase === 'failed' && skip.reviewId === review.id) || flaggedId === review.id)
  return { skip, skipFailed, undoOpen: skip.phase === 'pending', start, undo, undoRef, skipBtnRef, titleRef }
}
