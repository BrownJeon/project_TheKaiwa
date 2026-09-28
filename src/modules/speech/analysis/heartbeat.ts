/**
 * 워커 생존 하트비트(task-012b D-B3·D-B4) — 워커는 포트를 열지 않으므로 이 앱 프로세스가 #139 claim 을 마지막으로 받은 시각이 생존 신호다.
 * 프로세스 메모리(globalThis — 라우트 번들이 달라도 한 프로세스에 하나). 재기동·blue/green 전환 직후엔 비어 있다가 다음 claim(≤10초)에 채워진다.
 * 쓰는 곳: #21·gateway 콜백의 적재 게이트, `/api/health` `checks.stt_analysis_worker`.
 */
import { WORKER_ALIVE_WINDOW_MS } from './policy'

declare global {
  var __kaiwaAnalysisWorkerSeenAt: number | undefined
}

export function recordWorkerHeartbeat(now = Date.now()): void {
  globalThis.__kaiwaAnalysisWorkerSeenAt = now
}

export function isAnalysisWorkerAlive(now = Date.now()): boolean {
  const seen = globalThis.__kaiwaAnalysisWorkerSeenAt
  return seen !== undefined && now - seen <= WORKER_ALIVE_WINDOW_MS && now >= seen - 5_000
}

/** 테스트 전용 — 하트비트를 지운다. */
export function resetWorkerHeartbeat(): void {
  globalThis.__kaiwaAnalysisWorkerSeenAt = undefined
}
