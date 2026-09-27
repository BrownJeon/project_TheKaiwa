/**
 * TTS 실행 상태(speech-platform/16 §12, 서버 관점) — `GET /api/v1/speech/tts/status` 와 합성 전 차단(서킷)의 근거.
 *
 * 판단 근거는 네트워크가 아니라 **TTS 연결의 실제 상태**다:
 *   - connection 상태(Health 가 기록한 EngineConnection.status) + 이 프로세스의 합성 결과(연속 실패 수).
 *   - 히스테리시스: 합성 **연속 2회 실패** 또는 Health 실패 → 사용할 수 없음(TEXT_ONLY), 복귀는 Health **1회 성공**.
 *   - 확인(Health 실행)은 조회·합성 경로가 필요할 때만 한다: 확인 전(UNKNOWN)이면 곧바로, 저하·불가면 30초에 1회, 정상이면 5분에 1회.
 *     Health 는 connection 상태를 갱신하므로 Router·다른 프로세스도 같은 판정을 본다.
 * 캐시 HIT 재생은 상태를 바꾸지 않는다(상태 = "새 문장을 합성할 수 있는가").
 * 응답에는 엔진명·connection 키·호스트가 없다.
 */
import type { EngineStatus } from '@prisma/client'
import { currentEnvironment, runHealthCheck, tts, type TtsFailureKind, type TtsTarget } from '@/modules/engine'
import type { TtsFallbackReason, TtsServerHealth, TtsStatusResponse } from '@/types/tts'

export const FAILURE_THRESHOLD = 2
export const PROBE_INTERVAL_DEGRADED_MS = 30_000
export const PROBE_INTERVAL_HEALTHY_MS = 5 * 60_000

interface BreakerState {
  consecutiveFailures: number
  lastReason: TtsFallbackReason | null
  lastProbeAt: number
  lastSignalAt: number
}

const state: BreakerState = { consecutiveFailures: 0, lastReason: null, lastProbeAt: 0, lastSignalAt: 0 }

/** 테스트 전용 — 프로세스 상태 초기화. */
export function resetTtsStatusForTest(): void {
  Object.assign(state, { consecutiveFailures: 0, lastReason: null, lastProbeAt: 0, lastSignalAt: 0 })
}

export function reasonOf(kind: TtsFailureKind, code?: string): TtsFallbackReason {
  if (kind === 'TIMEOUT' || code === 'ETIMEDOUT') return 'SERVER_TIMEOUT'
  if (kind === 'UNAVAILABLE' && code && /^E[A-Z]+$/.test(code) && code !== 'ETIMEDOUT') return 'NO_CONNECTION'
  return 'SERVER_ERROR'
}

export function recordSynthSuccess(): void {
  state.consecutiveFailures = 0
  state.lastReason = null
  state.lastSignalAt = Date.now()
}

/** 상태와 무관한 실패(문장 길이 초과)는 세지 않는다. */
export function recordSynthFailure(kind: TtsFailureKind, code?: string): void {
  if (kind === 'TEXT_TOO_LONG') return
  state.consecutiveFailures++
  state.lastReason = reasonOf(kind, code)
  state.lastSignalAt = Date.now()
}

export function breakerOpen(): boolean {
  return state.consecutiveFailures >= FAILURE_THRESHOLD
}

export function healthOf(s: EngineStatus): TtsServerHealth {
  if (s === 'HEALTHY' || s === 'DEGRADED' || s === 'UNKNOWN') return s
  return 'UNAVAILABLE'
}

/** Health 한 번(같은 connection 동시 실행은 engine 이 하나로 합친다). 성공이면 연속 실패를 지운다. */
async function probe(target: TtsTarget): Promise<{ health: TtsServerHealth; reason: TtsFallbackReason | null }> {
  state.lastProbeAt = Date.now()
  try {
    // 표시등 확인은 공개 liveness 만(인증 상세 조회 없음, Codex C2 Finding 3).
    const r = await runHealthCheck(currentEnvironment(), target.id, { detail: false })
    tts.clearTargetCache()
    const health = healthOf(r.connection.status)
    if (r.health.ok) {
      state.consecutiveFailures = 0
      state.lastReason = null
      return { health, reason: null }
    }
    const code = (r.health.detail as { errorCode?: unknown } | null)?.errorCode
    const reason: TtsFallbackReason = code === 'ETIMEDOUT' ? 'SERVER_TIMEOUT' : typeof code === 'string' && /^E[A-Z]+$/.test(code) ? 'NO_CONNECTION' : 'SERVER_ERROR'
    state.lastReason = reason
    return { health: health === 'HEALTHY' ? 'DEGRADED' : health, reason }
  } catch {
    return { health: 'UNAVAILABLE', reason: 'SERVER_ERROR' }
  }
}

export function needsProbe(health: TtsServerHealth, open: boolean, lastCheckAt: number, now: number): boolean {
  const since = now - lastCheckAt
  if (health === 'UNKNOWN') return since >= 3_000
  if (open || health === 'UNAVAILABLE' || health === 'DEGRADED') return since >= PROBE_INTERVAL_DEGRADED_MS
  return since >= PROBE_INTERVAL_HEALTHY_MS
}

export interface TtsAvailability {
  target: TtsTarget | null
  health: TtsServerHealth
  reason: TtsFallbackReason | null
}

/**
 * 지금 1순위 TTS 연결을 쓸 수 있는가. `allowProbe` 면 필요할 때 Health 를 한 번 돌려 판정을 새로 한다.
 * (P0 는 폴백 connection 이 없다 — 여러 개가 되면 다음 후보 판정은 합성 경로가 이어서 한다.)
 */
/**
 * `probeBudgetMs`: 확인을 기다리는 상한 — 넘으면 지금 아는 값으로 답하고 확인은 뒤에서 끝난다(connection 상태가 갱신돼 다음 조회에 반영).
 * 화면은 상태 조회를 3초에 끊으므로(screens §7-3) 응답이 그보다 늦지 않게 한다.
 */
export async function assessAvailability(opts: { allowProbe: boolean; probeBudgetMs?: number }): Promise<TtsAvailability> {
  const list = await tts.targets()
  const target = list[0] ?? null
  if (!target) return { target: null, health: 'UNAVAILABLE', reason: 'NO_CONNECTION' }
  let health = healthOf(target.status)
  let reason: TtsFallbackReason | null = health === 'UNAVAILABLE' ? (state.lastReason ?? 'SERVER_ERROR') : null
  const lastCheckAt = Math.max(state.lastProbeAt, target.lastHealthAt?.getTime() ?? 0)
  if (opts.allowProbe && needsProbe(health, breakerOpen(), lastCheckAt, Date.now())) {
    const running = probe(target)
    const budget = opts.probeBudgetMs ?? 2_500
    let timer: ReturnType<typeof setTimeout> | undefined
    const r = await Promise.race([running, new Promise<null>((res) => (timer = setTimeout(() => res(null), budget)))])
    clearTimeout(timer)
    if (r) {
      health = r.health
      reason = r.reason
    }
  }
  if (breakerOpen()) {
    health = 'UNAVAILABLE'
    reason = state.lastReason ?? 'SERVER_ERROR'
  }
  return { target, health, reason: health === 'UNAVAILABLE' ? (reason ?? 'SERVER_ERROR') : null }
}

export async function getTtsStatus(): Promise<TtsStatusResponse> {
  const a = await assessAvailability({ allowProbe: true, probeBudgetMs: 2_000 })
  const last = Math.max(state.lastProbeAt, state.lastSignalAt, a.target?.lastHealthAt?.getTime() ?? 0)
  return {
    executionMode: a.health === 'UNAVAILABLE' ? 'TEXT_ONLY' : 'SERVER',
    networkStatus: 'ONLINE',
    serverHealth: a.health,
    fallbackReason: a.reason,
    lastUpdatedAt: last > 0 ? new Date(last).toISOString() : null,
  }
}
