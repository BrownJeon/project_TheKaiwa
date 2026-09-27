/**
 * TTS 실행 상태 스토어(screens §7-3 A, speech-platform/16 §12) — **앱 전체 1개**. 표시등이 몇 개 붙어도 조회·토스트는 하나다.
 *
 * 판정(클라): `navigator.onLine` + `GET /api/v1/speech/tts/status` + 합성 결과 신호(reportSynthesis).
 *   오프라인 → 자막만(OFFLINE) · 기억한 상태 없이 첫 조회 중 → 확인 중 · executionMode SERVER → 온라인 · TEXT_ONLY → 자막만(fallbackReason)
 *   조회 실패는 1회째 직전 상태 유지(확인 중이면 3초 뒤 1회), 연속 2회째 자막만(NO_CONNECTION).
 * 폴링: 온라인·정상 5분, 느림(DEGRADED)·자막만 30초. 가려지면 멈추고, 보이면 주기가 지났을 때만 바로 조회.
 * 토스트: 설정된 상태가 {온라인, 자막만, 온디바이스} 사이에서 바뀔 때만 전환 1건당 1회(첫 확인 결과는 조용히).
 * 테스트 가능하게 시간·타이머·조회·네트워크를 deps 로 받는다(서버 모듈을 import 하지 않는다).
 */
import type { TtsFallbackReason, TtsServerHealth, TtsStatusResponse } from '@/types/tts'
import { apiGet } from '@/components/common/api'
import { TOAST_TEXT, type TtsUiState } from './ttsStatusCopy'

export const POLL_HEALTHY_MS = 5 * 60_000
export const POLL_DEGRADED_MS = 30_000
export const FETCH_TIMEOUT_MS = 3_000
export const CHECKING_RETRY_MS = 3_000
export const SWITCHING_MIN_MS = 600

type Settled = 'ONLINE' | 'TEXT_ONLY' | 'ON_DEVICE'

export interface TtsStatusSnapshot {
  state: TtsUiState
  reason: TtsFallbackReason | null
  serverHealth: TtsServerHealth | null
  networkOnline: boolean
  lastUpdatedAt: string | null
  checking: boolean
  pollMs: number
  transitionSeq: number
}

export interface TtsStatusDeps {
  fetchStatus(signal: AbortSignal): Promise<TtsStatusResponse>
  isOnline(): boolean
  now(): number
  setTimer(fn: () => void, ms: number): unknown
  clearTimer(handle: unknown): void
}

/** 합성 결과 신호 — 미리듣기·회화(task-007 SSE audio)가 넣는다. status 는 HTTP(네트워크 실패 0). */
export interface SynthesisSignal {
  ok: boolean
  cacheHit?: boolean
  status?: number
}

/** 서버 응답 → 설정 상태(판정표 §7-3 A). */
export function deriveFromResponse(r: TtsStatusResponse): { state: Settled; reason: TtsFallbackReason | null } {
  if (r.executionMode === 'SERVER') return { state: 'ONLINE', reason: null }
  if (r.executionMode === 'ON_DEVICE') return { state: 'ON_DEVICE', reason: r.fallbackReason }
  return { state: 'TEXT_ONLY', reason: r.fallbackReason ?? 'NO_CONNECTION' }
}

export function pollIntervalFor(state: Settled, health: TtsServerHealth | null): number {
  return state === 'ONLINE' && health === 'HEALTHY' ? POLL_HEALTHY_MS : POLL_DEGRADED_MS
}

export interface TtsStatusStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): TtsStatusSnapshot
  recheck(): void
  reportSynthesis(s: SynthesisSignal): void
  pause(paused: boolean): void
  handleOnline(): void
  handleOffline(): void
  handleVisibility(visible: boolean): void
  /** 전환 안내 문구를 한 번만 꺼낸다(같은 seq 를 두 번 달라면 null). */
  consumeAnnouncement(seq: number): string | null
}

export function createTtsStatusStore(deps: TtsStatusDeps): TtsStatusStore {
  const listeners = new Set<() => void>()
  let settled: { state: Settled; reason: TtsFallbackReason | null } | null = null
  let display: TtsUiState = 'CHECKING'
  let serverHealth: TtsServerHealth | null = null
  let lastUpdatedAt: string | null = null
  let lastCheckAt = 0
  let pollMs = POLL_DEGRADED_MS
  let statusFailures = 0
  let synthFailures = 0
  let inflight: AbortController | null = null
  let timer: unknown = null
  let paused = false
  let visible = true
  let switchingSince = 0
  let transitionSeq = 0
  let announcedSeq = 0
  let announcement: string | null = null
  let snapshot: TtsStatusSnapshot = build()

  function build(): TtsStatusSnapshot {
    return { state: display, reason: settled?.reason ?? null, serverHealth, networkOnline: deps.isOnline(), lastUpdatedAt, checking: inflight !== null, pollMs, transitionSeq }
  }
  function emit() {
    snapshot = build()
    for (const l of listeners) l()
  }
  function clearTimer() {
    if (timer !== null) deps.clearTimer(timer)
    timer = null
  }
  function schedule(ms: number) {
    clearTimer()
    if (listeners.size === 0 || paused || !visible || !deps.isOnline()) return
    timer = deps.setTimer(() => {
      timer = null
      void query('silent')
    }, Math.max(0, ms))
  }
  function settle(state: Settled, reason: TtsFallbackReason | null) {
    const prev = settled?.state ?? null
    settled = { state, reason }
    display = state
    if (prev !== null && prev !== state) {
      transitionSeq++
      announcement = TOAST_TEXT[state] ?? null
    }
    emit()
  }
  function goOffline() {
    inflight?.abort()
    inflight = null
    clearTimer()
    settle('TEXT_ONLY', 'OFFLINE')
  }
  function wait(ms: number) {
    return new Promise<void>((res) => (ms > 0 ? deps.setTimer(res, ms) : res()))
  }

  async function query(kind: 'initial' | 'silent' | 'switching'): Promise<void> {
    if (listeners.size === 0) return
    if (!deps.isOnline()) return goOffline()
    if (kind === 'switching' && display !== 'SWITCHING') {
      display = 'SWITCHING'
      switchingSince = deps.now()
      emit()
    }
    if (inflight) return
    clearTimer()
    if (kind === 'initial' && !settled) display = 'CHECKING'
    const ac = new AbortController()
    inflight = ac
    emit()
    const to = deps.setTimer(() => ac.abort(), FETCH_TIMEOUT_MS)
    let resp: TtsStatusResponse | null = null
    try {
      resp = await deps.fetchStatus(ac.signal)
    } catch {
      resp = null
    } finally {
      deps.clearTimer(to)
    }
    if (inflight !== ac) return
    if (display === 'SWITCHING') await wait(SWITCHING_MIN_MS - (deps.now() - switchingSince))
    if (inflight !== ac) return
    inflight = null
    lastCheckAt = deps.now()
    synthFailures = 0
    if (!deps.isOnline()) return goOffline()
    if (resp) {
      statusFailures = 0
      serverHealth = resp.serverHealth
      lastUpdatedAt = resp.lastUpdatedAt ?? lastUpdatedAt
      const d = deriveFromResponse(resp)
      pollMs = pollIntervalFor(d.state, resp.serverHealth)
      settle(d.state, d.reason)
      schedule(pollMs)
      return
    }
    statusFailures++
    if (statusFailures >= 2) {
      pollMs = POLL_DEGRADED_MS
      settle('TEXT_ONLY', 'NO_CONNECTION')
      schedule(pollMs)
      return
    }
    // 1회째 실패 — 직전 상태 유지(전환 중 표시는 거둔다). 기억한 상태가 없으면 3초 뒤 한 번 더.
    if (settled) display = settled.state
    emit()
    schedule(settled ? POLL_DEGRADED_MS : CHECKING_RETRY_MS)
  }

  function resumeTiming() {
    if (listeners.size === 0 || paused || !visible) return
    if (!deps.isOnline()) return goOffline()
    if (!settled) return void query('initial')
    const due = lastCheckAt + pollMs - deps.now()
    if (due <= 0) void query('silent')
    else schedule(due)
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (listeners.size === 1) resumeTiming()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          clearTimer()
          inflight?.abort()
          inflight = null
          if (display === 'SWITCHING' || display === 'CHECKING') display = settled?.state ?? 'CHECKING'
        }
      }
    },
    getSnapshot: () => snapshot,
    recheck: () => void query('switching'),
    reportSynthesis(s) {
      if (s.ok) {
        if (s.cacheHit) return
        synthFailures = 0
        if (settled?.state === 'TEXT_ONLY') void query('switching')
        return
      }
      if (s.status === 422) return void query('switching')
      if (s.status === 502 || s.status === 504 || s.status === 0) {
        synthFailures++
        if (synthFailures >= 2) {
          synthFailures = 0
          void query('switching')
        }
      }
    },
    pause(p) {
      paused = p
      if (p) clearTimer()
      else resumeTiming()
    },
    handleOnline: () => {
      if (listeners.size > 0) void query('switching')
    },
    handleOffline: () => {
      if (listeners.size > 0) goOffline()
    },
    handleVisibility(v) {
      visible = v
      if (!v) clearTimer()
      else resumeTiming()
    },
    consumeAnnouncement(seq) {
      if (seq <= announcedSeq || seq !== transitionSeq || !announcement) return null
      announcedSeq = seq
      return announcement
    },
  }
}

// ── 브라우저 싱글턴 ────────────────────────────────────────────────────────

let singleton: TtsStatusStore | null = null

export function getTtsStatusStore(): TtsStatusStore {
  if (singleton) return singleton
  const store = createTtsStatusStore({
    // 401 로그인 이동·봉투 해석은 api.ts 규칙 그대로.
    fetchStatus: (signal) => apiGet<TtsStatusResponse>('/api/v1/speech/tts/status', { signal }),
    isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('online', store.handleOnline)
    window.addEventListener('offline', store.handleOffline)
    document.addEventListener('visibilitychange', () => store.handleVisibility(document.visibilityState !== 'hidden'))
  }
  singleton = store
  return store
}

/** 서버 렌더·하이드레이션 첫 값 — 확인 중. */
export const SERVER_SNAPSHOT: TtsStatusSnapshot = { state: 'CHECKING', reason: null, serverHealth: null, networkOnline: true, lastUpdatedAt: null, checking: false, pollMs: POLL_DEGRADED_MS, transitionSeq: 0 }
