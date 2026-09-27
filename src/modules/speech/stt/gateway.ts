/**
 * 서버 경로 실시간 인식(gateway) 사용 가능 판정 — 티켓 발급(#20)·설정(#19)이 쓴다.
 *
 * 근거는 connection 상태(Health 가 기록)다. 상태가 UNKNOWN 이거나 사용할 수 없음(UNAVAILABLE·MISCONFIGURED)으로 기록된 지 30초가 지났으면
 * 공개 `/health` 를 한 번 다시 본다(시크릿 없음, `detail:false`) — gateway 가 다시 떴을 때 관리자가 Health 를 누르지 않아도
 * 다음 누름에서 바로 쓸 수 있게. 확인은 `probeBudgetMs` 까지만 기다리고, 넘으면 지금 아는 값으로 답한다.
 * 결과에는 엔진명·주소가 없다(connection id 는 서버 안에서만 쓴다).
 */
import { currentEnvironment, runHealthCheck, stt, type SttTarget } from '@/modules/engine'

export const GATEWAY_REPROBE_MS = 30_000
export const GATEWAY_UNKNOWN_REPROBE_MS = 3_000

export type GatewayUnavailableReason = 'NO_CONNECTION' | 'MISCONFIGURED' | 'UNAVAILABLE'

export interface GatewayAvailability {
  target: SttTarget | null
  available: boolean
  reason: GatewayUnavailableReason | null
}

let lastProbeAt = 0

/** 테스트 전용. */
export function resetGatewayProbeForTest(): void {
  lastProbeAt = 0
}

/** 순수 판정 — 다시 볼 때가 됐는가. */
export function gatewayNeedsProbe(status: SttTarget['status'], lastCheckAt: number, now: number): boolean {
  const since = now - lastCheckAt
  if (status === 'UNKNOWN') return since >= GATEWAY_UNKNOWN_REPROBE_MS
  // MISCONFIGURED 도 다시 본다 — gateway 쪽 설정이 고쳐지면 관리자가 Health 를 누르지 않아도 돌아오게(재확인은 공개 /health 1회뿐).
  if (status === 'UNAVAILABLE' || status === 'MISCONFIGURED') return since >= GATEWAY_REPROBE_MS
  return false
}

function judge(target: SttTarget, status: SttTarget['status']): GatewayAvailability {
  if (status === 'HEALTHY' || status === 'DEGRADED') return { target, available: true, reason: null }
  if (status === 'MISCONFIGURED') return { target, available: false, reason: 'MISCONFIGURED' }
  return { target, available: false, reason: 'UNAVAILABLE' }
}

export async function gatewayTarget(): Promise<SttTarget | null> {
  return (await stt.realtimeTargets()).find((t) => t.connectionType === 'HTTP') ?? null
}

export async function assessGateway(opts: { allowProbe: boolean; probeBudgetMs?: number }): Promise<GatewayAvailability> {
  const target = await gatewayTarget()
  if (!target) return { target: null, available: false, reason: 'NO_CONNECTION' }
  const lastCheckAt = Math.max(lastProbeAt, target.lastHealthAt?.getTime() ?? 0)
  if (!opts.allowProbe || !gatewayNeedsProbe(target.status, lastCheckAt, Date.now())) return judge(target, target.status)

  lastProbeAt = Date.now()
  const running = runHealthCheck(currentEnvironment(), target.id, { detail: false })
    .then((r) => {
      stt.clearSttTargetCache()
      return r.connection.status
    })
    .catch(() => null)
  let timer: ReturnType<typeof setTimeout> | undefined
  const status = await Promise.race([running, new Promise<null>((res) => (timer = setTimeout(() => res(null), opts.probeBudgetMs ?? 2_500)))])
  clearTimeout(timer)
  return judge(target, status ?? target.status)
}
