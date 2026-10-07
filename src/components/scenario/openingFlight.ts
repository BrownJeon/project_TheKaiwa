/**
 * 첫마디 일본어 제안(#178) 요청 한 건의 흐름 — React 를 모르는 순수 제어기(시험 가능). `useOpeningDraft` 가 상태만 이어 준다.
 *  - **요청은 한 번에 하나**: 409 `DRAFT_BUSY` 도 분·하루 한도를 쓰므로 만드는 중에는 다시 보내지 않는다(더블 탭 방지).
 *  - **시작 직후 `OPENING_CANCEL_LOCK_MS` 동안은 취소할 수 없다**: [일본어로 만들기] 와 [그만두기] 는 같은 버튼(R6)이라, 더블 탭의
 *    둘째 탭이 방금 시작한 요청을 바로 끊으면 서버는 계속 돌아 한도만 쓰고 곧바로 다시 누르면 409 가 된다(REV-160 M-3).
 *  - 벽시계 상한 `OPENING_TIMEOUT_MS`(서버 예산 25초 + 여유). [그만두기] = abort.
 */
import { isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { scenarioFailure, type ScenarioFailure } from './failure'
import { openingDraftResult, openingRequestBody, type EditableDraft } from './logic'

export const OPENING_TIMEOUT_MS = 30_000
/** 요청을 시작한 뒤 이 시간이 지나야 버튼이 [그만두기] 가 된다. */
export const OPENING_CANCEL_LOCK_MS = 800

export type OpeningPhase = 'idle' | 'busy' | 'failed'

export interface OpeningFlightState {
  phase: OpeningPhase
  failure: ScenarioFailure | null
  /** 마지막으로 받은 일본어를 서버가 줄였는지(`JA_TRUNCATED`). */
  truncated: boolean
  /** 만드는 중이고 취소 잠금 시간이 지났을 때만 true. */
  cancelable: boolean
}

export const OPENING_IDLE: OpeningFlightState = { phase: 'idle', failure: null, truncated: false, cancelable: false }

export type OpeningRequestBody = ReturnType<typeof openingRequestBody>

export interface OpeningFlightDeps {
  post: (body: OpeningRequestBody, signal: AbortSignal) => Promise<unknown>
  onState: (s: OpeningFlightState) => void
  /** 시험에서 가짜 시계를 넣는다. */
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void }
}

export interface OpeningFlight {
  /** 지금 편집 값으로 요청 — 성공하면 `onResult(보낸 한국어, 결과)`. 요청 중이면 아무것도 하지 않는다. */
  make: (draft: EditableDraft, placeTitle: string | null, onResult: (sentKo: string, r: { ja: string; reading: string | null }) => void) => void
  /** 취소 잠금이 지난 요청만 끊는다. */
  cancel: () => void
  /** 한국어를 고치면 지난 실패·줄임 안내를 지운다(요청 중에는 아무것도 안 한다). */
  clear: () => void
  /** 화면이 사라질 때 — 요청·타이머를 정리한다(상태는 알리지 않는다). */
  dispose: () => void
}

interface Run {
  ac: AbortController
  timeout: unknown
  lock: unknown
  timedOut: boolean
}

export function createOpeningFlight(deps: OpeningFlightDeps): OpeningFlight {
  const timers = deps.timers ?? { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>) }
  let cur: Run | null = null
  let state = OPENING_IDLE

  const emit = (next: Partial<OpeningFlightState>) => {
    state = { ...state, ...next }
    deps.onState(state)
  }
  const release = () => {
    if (!cur) return
    timers.clear(cur.timeout)
    if (cur.lock !== null) timers.clear(cur.lock)
    cur = null
  }

  const make: OpeningFlight['make'] = (draft, placeTitle, onResult) => {
    if (cur) return
    const body = openingRequestBody(draft, placeTitle)
    if (!body.ko) return
    const run: Run = { ac: new AbortController(), timeout: null, lock: null, timedOut: false }
    cur = run
    run.timeout = timers.set(() => {
      run.timedOut = true
      run.ac.abort()
    }, OPENING_TIMEOUT_MS)
    run.lock = timers.set(() => {
      run.lock = null
      if (cur === run) emit({ cancelable: true })
    }, OPENING_CANCEL_LOCK_MS)
    emit({ phase: 'busy', failure: null, truncated: false, cancelable: false })
    deps.post(body, run.ac.signal).then(
      (raw) => {
        if (cur !== run) return
        release()
        const r = openingDraftResult(raw)
        if (!r) {
          emit({ phase: 'failed', failure: scenarioFailure('openingDraft', { status: 502, message: '', code: null, details: {}, retryAfterSec: null }), cancelable: false })
          return
        }
        emit({ phase: 'idle', truncated: r.truncated, cancelable: false })
        onResult(body.ko, r)
      },
      (e: unknown) => {
        if (cur !== run) return
        const timedOut = run.timedOut
        release()
        if (isAbort(e) && !timedOut) {
          emit({ phase: 'idle', cancelable: false })
          return
        }
        const err = toErr(e)
        emit({ phase: 'failed', failure: scenarioFailure('openingDraft', timedOut ? { ...err, status: 504 } : err), cancelable: false })
      },
    )
  }

  const cancel: OpeningFlight['cancel'] = () => {
    const run = cur
    if (!run || !state.cancelable) return
    release()
    run.ac.abort()
    emit({ phase: 'idle', cancelable: false })
  }

  const clear: OpeningFlight['clear'] = () => {
    if (cur) return
    emit({ phase: 'idle', failure: null, truncated: false, cancelable: false })
  }

  const dispose: OpeningFlight['dispose'] = () => {
    const run = cur
    if (!run) return
    release()
    run.ac.abort()
  }

  return { make, cancel, clear, dispose }
}
