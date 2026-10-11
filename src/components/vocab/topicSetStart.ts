/**
 * 새 단어 대기 화면의 상태 기계(task-044 가이드 §3-5·E3·E4) — 순수 모듈(타이머·요청은 주입, 단위 테스트 대상).
 *
 * - `start()` = #47 `{topicId, count, generate:true}`(task-059: `mode` 는 싣지 않는다 — 서버 기본 카드 우선). 0.6초 전에는 아무것도 그리지 않고(`quiet`), 그 뒤 `gen`, 20초부터 `gen` long.
 * - `skip()` = [주제 표현으로 바로 풀기] — **먼저 진행 중 요청을 취소**하고 새 컨트롤러로 `generate:false` 한 번.
 * - 409 `{reason:'GENERATING'}` 만 3초 간격 최대 5번 같은 요청을 다시 보낸다(같은 signal — 떠나면 멈춤). 시간 초과·실패는 서버가 폴백 세트를 주므로
 *   화면이 `generate:true` 를 다시 보내지 않는다(회화 첫 대답을 늦추는 A12 를 화면이 더 만들지 않게 — 설계서 §5-2).
 * - `dispose()` = 화면을 떠남 — 요청 취소·타이머 정리. 그 뒤 도착한 응답은 버리고 상태를 알리지 않는다.
 */
import type { CreateSessionResult, EmptyReason, TopicGeneration, VocabMode, VocabSessionInfo } from '@/types/vocab'
import { isNoChoiceSet } from './cardFirst'

export interface TopicStartBody {
  topicId: string
  count: number
  /** 화면은 보내지 않는다(task-059 — 본문은 `topicStartBody`). 이 상태 기계는 받은 본문을 그대로 보내므로 선택 필드로만 남긴다. */
  mode?: VocabMode
  generate: boolean
}

export type StarterState =
  | { kind: 'quiet' }
  | { kind: 'gen'; long: boolean }
  | { kind: 'skipping' }
  | { kind: 'busy409'; attempt: number; gaveUp: boolean }
  | { kind: 'error'; rate: boolean }
  | { kind: 'empty'; reason: EmptyReason }
  | { kind: 'inProgress'; sessionId: string | null }
  /** 이 화면이 취소한 앞 요청이 서버에서 이미 세트를 만들었다(409 `{sessionId}`) — 그 세트 덱으로 바로 간다. */
  | { kind: 'resume'; sessionId: string }
  /** `noChoice` = 보기를 하나도 못 만든 카드 우선 세트(§23-4 D) — 참일 때만 키가 있다. */
  | { kind: 'done'; session: VocabSessionInfo; generation: TopicGeneration | null; noChoice?: true }

/** 요청 실패를 화면 분기용으로 줄인 값 — `ApiError` 를 모르는 순수 모듈이라 호출부가 바꿔 넘긴다. */
export interface StartFailure {
  abort: boolean
  status: number
  reason: string | null
  sessionId: string | null
}

export interface StarterDeps {
  body: Omit<TopicStartBody, 'generate'>
  post: (body: TopicStartBody, signal: AbortSignal) => Promise<CreateSessionResult>
  toFailure: (e: unknown) => StartFailure
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (id: unknown) => void
  onState: (s: StarterState) => void
}

export const QUIET_MS = 600
export const LONG_MS = 20_000
export const BUSY_RETRY_MS = 3_000
export const BUSY_RETRY_MAX = 5

/**
 * 멱등 규칙(REV-125 M-2): 일이 진행 중(요청이 나가 있거나 409 재시도를 기다림)이면 `retry()`·두 번째 `skip()` 은 무시하고 `false` 를 돌려준다
 * — 다시 보내면 앞 요청을 끊게 되는데, 서버가 그 요청으로 이미 세트를 만들었으면 둘째가 409 `{sessionId}` 가 되어 덱 대신 오늘 탭으로 간다.
 * 세트가 정해지면(`done`·`inProgress`·`resume`) 화면이 떠나므로 그 뒤 호출도 무시한다.
 * 앞 요청을 취소한 뒤 받은 409 `{sessionId}` 는 그 요청이 만든 세트일 수 있어 덱으로 바로 간다(`resume`). 취소한 적이 없으면 원래대로 풀던 세트 안내(`inProgress`).
 */
export function createTopicSetStarter(d: StarterDeps) {
  let controller: AbortController | null = null
  let timers: unknown[] = []
  let disposed = false
  let closed = false
  let working = false
  let requestOpen = false
  let abortedOpen = false
  let generate = true
  let busyRetries = 0

  const clearAll = () => {
    for (const t of timers) d.clearTimer(t)
    timers = []
  }
  const later = (fn: () => void, ms: number) => {
    timers.push(d.setTimer(fn, ms))
  }
  const emit = (s: StarterState) => {
    if (!disposed) d.onState(s)
  }
  const finish = (s: StarterState, close = false) => {
    working = false
    if (close) closed = true
    emit(s)
  }
  const abortCurrent = () => {
    if (controller && requestOpen) abortedOpen = true
    controller?.abort()
    controller = null
    requestOpen = false
  }

  const send = (c: AbortController) => {
    requestOpen = true
    d.post({ ...d.body, generate }, c.signal).then(
      (r) => {
        if (disposed || c !== controller || c.signal.aborted) return
        requestOpen = false
        clearAll()
        if (r.session) finish({ kind: 'done', session: r.session, generation: r.generation ?? null, ...(isNoChoiceSet(r) ? { noChoice: true as const } : {}) }, true)
        else finish({ kind: 'empty', reason: r.empty.reason })
      },
      (e: unknown) => {
        if (disposed || c !== controller || c.signal.aborted) return
        const f = d.toFailure(e)
        if (f.abort) return
        requestOpen = false
        clearAll()
        if (f.status === 409 && f.reason === 'GENERATING') {
          if (busyRetries >= BUSY_RETRY_MAX) {
            finish({ kind: 'busy409', attempt: busyRetries, gaveUp: true })
            return
          }
          busyRetries += 1
          emit({ kind: 'busy409', attempt: busyRetries, gaveUp: false })
          later(() => {
            if (disposed || c !== controller) return
            send(c)
          }, BUSY_RETRY_MS)
          return
        }
        if (f.status === 409) {
          if (abortedOpen && f.sessionId) finish({ kind: 'resume', sessionId: f.sessionId }, true)
          else finish({ kind: 'inProgress', sessionId: f.sessionId }, true)
          return
        }
        finish({ kind: 'error', rate: f.status === 429 })
      },
    )
  }

  const run = (gen: boolean, initial: StarterState) => {
    abortCurrent()
    clearAll()
    generate = gen
    busyRetries = 0
    working = true
    const c = new AbortController()
    controller = c
    emit(initial)
    if (gen) {
      later(() => {
        if (c === controller) emit({ kind: 'gen', long: false })
      }, QUIET_MS)
      later(() => {
        if (c === controller) emit({ kind: 'gen', long: true })
      }, LONG_MS)
    }
    send(c)
  }

  return {
    /** 처음 한 번 — 이미 진행 중이거나 끝났으면 무시. */
    start(): boolean {
      if (disposed || closed || working) return false
      run(true, { kind: 'quiet' })
      return true
    },
    /** [주제 표현으로 바로 풀기] — 새 단어 요청 중이면 그것을 먼저 취소한다. 바로 풀기 요청이 이미 나가 있으면(두 번 누름) 무시. */
    skip(): boolean {
      if (disposed || closed || (working && !generate)) return false
      run(false, { kind: 'skipping' })
      return true
    },
    /** [다시 시도] — 마지막과 같은 방식(새 단어/바로 풀기)으로 한 번 더. 진행 중이면 무시. */
    retry(): boolean {
      if (disposed || closed || working) return false
      run(generate, generate ? { kind: 'quiet' } : { kind: 'skipping' })
      return true
    },
    dispose() {
      if (disposed) return
      disposed = true
      abortCurrent()
      clearAll()
    },
    get disposed() {
      return disposed
    },
  }
}

export type TopicSetStarter = ReturnType<typeof createTopicSetStarter>
