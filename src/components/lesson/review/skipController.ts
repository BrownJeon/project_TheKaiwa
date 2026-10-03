/**
 * 오늘 복습 건너뛰기의 상태 전이(`useReviewSkip` 에서 React 밖으로 뺀 부분 — 동작은 훅에 있던 그대로).
 * 화면·저장소·요청은 `deps` 로 받아서 가짜 타이머·가짜 요청으로 단위 테스트할 수 있다.
 *  - start → `pending`(요청 없음) → `SKIP_UNDO_MS` 뒤 commit(false) 1회. 그 안에 undo → `idle`, 요청 0회.
 *  - leave(떠남·언마운트) = commit(true) — 즉시 keepalive. 타이머·떠남이 겹쳐도 요청은 한 번(`committed`).
 *  - 409·404 는 `stale`(조용히 idle + 재조회), 그 밖 실패는 `failed`(떠나며 실패면 다음 방문 표시용 플래그).
 */
import { SKIP_IDLE, type SkipState } from './reviewLogic'

export const SKIP_UNDO_MS = 5000

export type SkipFocusTarget = 'undo' | 'skip' | 'title'

export interface SkipControllerDeps {
  /** #64. `leaving` 이면 keepalive 로 보낸다. 실패는 throw. */
  post: (reviewId: string, leaving: boolean) => Promise<unknown>
  failureKind: (e: unknown) => 'stale' | 'failed'
  /** 화면 상태 반영(언마운트 뒤 호출돼도 안전해야 한다). */
  render: (s: SkipState) => void
  isMounted: () => boolean
  onCommitted: () => void
  onUndone: () => void
  focus: (t: SkipFocusTarget) => void
  /** 되돌리기 버튼에 초점이 있었나(보낸 뒤 제목으로 초점을 옮길지). */
  undoHasFocus: () => boolean
  /** 떠나며 실패한 일정 id 를 남긴다. */
  flagLeaveFailure: (reviewId: string) => void
  /** 새로 건너뛰기를 누르면 지난 실패 기록을 지운다. */
  clearLeaveFailure: () => void
}

export interface SkipController {
  readonly state: SkipState
  start: (review: { id: string; status: string } | null) => void
  undo: () => void
  commit: (leaving: boolean) => Promise<void>
  /** 다른 일정이 오면(날짜가 바뀜) 보내지 않고 버린다. */
  reviewChanged: (reviewId: string | null) => void
  clearTimer: () => void
}

export function createSkipController(deps: SkipControllerDeps): SkipController {
  let cur: SkipState = SKIP_IDLE
  let committed = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const set = (s: SkipState) => {
    cur = s
    deps.render(s)
  }
  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const commit = async (leaving: boolean) => {
    if (committed || cur.phase !== 'pending' || !cur.reviewId) return
    committed = true
    clearTimer()
    const id = cur.reviewId
    const toastHadFocus = deps.undoHasFocus()
    set({ phase: 'sending', reviewId: id })
    try {
      await deps.post(id, leaving)
      set({ phase: 'sent', reviewId: id })
      if (deps.isMounted()) {
        deps.onCommitted()
        if (toastHadFocus) deps.focus('title')
      }
    } catch (e) {
      if (deps.failureKind(e) === 'stale') {
        set(SKIP_IDLE)
        if (deps.isMounted()) deps.onCommitted()
        return
      }
      if (leaving) deps.flagLeaveFailure(id)
      set({ phase: 'failed', reviewId: id })
      deps.focus('skip')
    }
  }

  return {
    get state() {
      return cur
    },
    commit,
    clearTimer,
    start(review) {
      if (!review || review.status !== 'DUE') return
      if (cur.phase === 'pending' || cur.phase === 'sending') return
      committed = false
      deps.clearLeaveFailure()
      set({ phase: 'pending', reviewId: review.id })
      clearTimer()
      timer = setTimeout(() => void commit(false), SKIP_UNDO_MS)
      deps.focus('undo')
    },
    undo() {
      if (cur.phase !== 'pending') return
      clearTimer()
      set(SKIP_IDLE)
      deps.onUndone()
      deps.focus('skip')
    },
    reviewChanged(reviewId) {
      if (reviewId && cur.reviewId && cur.reviewId !== reviewId && cur.phase !== 'sending') {
        clearTimer()
        committed = true
        set(SKIP_IDLE)
      }
    },
  }
}
