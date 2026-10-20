/**
 * 성장 기록(#78) 불러오기 상태 기계(screens.md §36-4 ①~④) — React 없이 시험하려고 훅(`useGrowthData`)에서 떼어 낸 컨트롤러.
 * 요청·시계·타이머는 주입한다(시험은 가짜 요청·가짜 시계).
 *
 * - 기간(4·8·12주)별 메모리 캐시. 처음 고른 기간(캐시 없음)을 부르는 동안은 **앞 기간 내용을 그대로** 두고 `busy`(③). 다시 고른 기간은 캐시로 즉시.
 * - 실패(오프라인 포함)는 지금 기간에만 오류로 드러낸다(④). 기간을 바꾸면 그 오류는 잊는다(돌아오면 다시 부른다).
 * - `reload()`([다시 불러오기]): 자리표시를 보이고, 바로 다시 실패해도 자리표시가 `RETRY_MIN_BUSY_MS`(500ms)는 보이게 실패 반영을 미룬다(`retryFailHoldMs`).
 *   성공은 기다리지 않는다.
 * - 캐시는 이 컨트롤러(= 화면 한 번)에만 있다 — 모듈 전역에 두지 않아 다른 사용자·다음 방문으로 새지 않는다.
 * - `stop()`(언마운트) 뒤에는 늦게 온 응답·타이머가 상태를 바꾸지 않고 알리지도 않는다. `start()` 로 다시 켜면(개발 StrictMode 재마운트) 이어서 쓴다.
 */
import { retryFailHoldMs } from '@/components/topic/logic'
import type { GrowthResponse, GrowthWeeks } from '@/types/plan'

export type GrowthStatus = 'loading' | 'ready' | 'error'

export interface GrowthView {
  status: GrowthStatus
  /** 고른 기간. 바꾸는 중이면 `data` 는 앞 기간 내용이다. */
  weeks: GrowthWeeks
  data: GrowthResponse | null
  busy: boolean
}

export interface GrowthLoaderDeps {
  load: (weeks: GrowthWeeks) => Promise<GrowthResponse>
  now: () => number
  setTimer: (fn: () => void, ms: number) => unknown
  clearTimer: (t: unknown) => void
}

export class GrowthLoader {
  private weeks: GrowthWeeks
  private readonly cache: Partial<Record<GrowthWeeks, GrowthResponse>> = {}
  /** 마지막으로 보인 기간 — 새 기간을 부르는 동안 이 내용을 둔다. */
  private shown: GrowthWeeks | null = null
  private failed: GrowthWeeks | null = null
  /** [다시 불러오기] 중인 기간과 누른 시각 — 그 기간의 응답이 올 때까지 자리표시. */
  private retry: { weeks: GrowthWeeks; from: number } | null = null
  private readonly inflight = new Set<GrowthWeeks>()
  private readonly timers = new Set<unknown>()
  private readonly listeners = new Set<() => void>()
  private active = false
  private view: GrowthView

  constructor(
    weeks: GrowthWeeks,
    private readonly deps: GrowthLoaderDeps,
  ) {
    this.weeks = weeks
    this.view = this.compute()
  }

  readonly subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  /** 바뀌지 않았으면 같은 객체(`useSyncExternalStore` 규칙). */
  readonly getView = (): GrowthView => this.view

  readonly start = (): void => {
    this.active = true
    this.ensure()
    this.emit()
  }

  readonly stop = (): void => {
    this.active = false
    for (const t of this.timers) this.deps.clearTimer(t)
    if (this.timers.size > 0) this.retry = null
    this.timers.clear()
  }

  readonly setWeeks = (w: GrowthWeeks): void => {
    if (w === this.weeks) return
    this.weeks = w
    this.failed = null
    this.ensure()
    this.emit()
  }

  readonly reload = (): void => {
    this.failed = null
    this.retry = { weeks: this.weeks, from: this.deps.now() }
    this.request(this.weeks)
    this.emit()
  }

  private ensure(): void {
    if (this.active && !this.cache[this.weeks] && this.failed !== this.weeks) this.request(this.weeks)
  }

  private request(w: GrowthWeeks): void {
    if (this.inflight.has(w)) return
    this.inflight.add(w)
    this.deps.load(w).then(
      (d) => {
        this.inflight.delete(w)
        if (!this.active) return
        this.cache[w] = d
        if (this.failed === w) this.failed = null
        if (this.retry?.weeks === w) this.retry = null
        this.emit()
      },
      () => {
        this.inflight.delete(w)
        if (!this.active) return
        const settle = () => {
          this.failed = w
          if (this.retry?.weeks === w) this.retry = null
          this.emit()
        }
        const hold = this.retry?.weeks === w ? retryFailHoldMs(true, this.retry.from, this.deps.now()) : 0
        if (hold <= 0) {
          settle()
          return
        }
        const t = this.deps.setTimer(() => {
          this.timers.delete(t)
          if (this.active) settle()
        }, hold)
        this.timers.add(t)
      },
    )
  }

  private compute(): GrowthView {
    const hit = this.cache[this.weeks]
    if (hit) this.shown = this.weeks
    const data = hit ?? (this.shown !== null ? (this.cache[this.shown] ?? null) : null)
    const status: GrowthStatus = this.retry ? 'loading' : this.failed === this.weeks && !hit ? 'error' : data ? 'ready' : 'loading'
    return { status, weeks: this.weeks, data: status === 'ready' ? data : null, busy: status === 'ready' && !hit }
  }

  private emit(): void {
    const next = this.compute()
    const v = this.view
    if (next.status === v.status && next.weeks === v.weeks && next.data === v.data && next.busy === v.busy) return
    this.view = next
    if (!this.active) return
    for (const fn of this.listeners) fn()
  }
}
