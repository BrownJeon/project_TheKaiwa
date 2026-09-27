/**
 * Health Check 실행·조회(api-contract #95·#95a, module-dependency L5 `health/`).
 *
 * - 대상은 **현재 APP_ENV 의 connection 행**뿐이고 주소는 Effective 설정(DB·서버 env)에서만 온다 — 요청 본문 URL 없음(SSRF 차단).
 * - 서비스가 없으면 throw 하지 않고 `UNAVAILABLE`+사유를 기록한다(500 금지). 검사 불가(ONDEVICE 등)는 `UNKNOWN` 으로 기록하고 상태는 그대로.
 * - 결과로 `EngineConnection.status/statusReason/lastHealthAt` 을 갱신하고 **Router 선택 캐시만** 비운다(configuration-resolution §3-5 ④).
 *   관리자가 끈 연결(`status=DISABLED`)의 상태는 Health 가 덮지 않는다.
 * - 같은 connection 의 동시 실행은 하나로 합친다. `EngineHealth` 는 connection 당 최근 200건만 남긴다.
 */
import { prisma } from '@/modules/infra'
import type { EngineConnection, EngineHealth, Environment, HealthKind, Prisma } from '@prisma/client'
import { effectiveValues, resolveEffective } from '../configuration/resolver'
import { getProvider } from '../registry'
import type { ConnectionProfile, HealthOutcome } from '../registry/types'
import { clearRouterCache } from '../router'

export class ConnectionNotFoundError extends Error {
  constructor() {
    super('connection 을 찾을 수 없습니다')
    this.name = 'ConnectionNotFoundError'
  }
}

/** 다른 환경의 행 — 조회 권한이 있는 사람(SUPER_ADMIN)에게는 403, 그 외에는 404 로 숨긴다(admin 이 판단). */
export class CrossEnvironmentError extends Error {
  constructor() {
    super('다른 환경의 connection 은 이 프로세스에서 실행할 수 없습니다')
    this.name = 'CrossEnvironmentError'
  }
}

const KEEP_ROWS = 200
const inflight = new Map<string, Promise<HealthRunResult>>()

export interface HealthRunResult {
  health: EngineHealth
  connection: EngineConnection
}

/** 요청 대상 확인: 없으면 NotFound, 환경이 다르면 CrossEnvironment. */
export async function loadTarget(environment: Environment, connectionId: string): Promise<EngineConnection> {
  if (!connectionId || connectionId.length > 80) throw new ConnectionNotFoundError()
  const row = await prisma.engineConnection.findUnique({ where: { id: connectionId } })
  if (!row) throw new ConnectionNotFoundError()
  if (row.environment !== environment) throw new CrossEnvironmentError()
  return row
}

/** Effective 값으로 만든 프로필(Health·Functional 공용). */
export async function profileOf(row: EngineConnection): Promise<ConnectionProfile> {
  const eff = await resolveEffective({ environment: row.environment, scope: 'ENGINE_CONNECTION', targetId: row.id })
  return { id: row.id, key: row.key, connectionType: row.connectionType, values: effectiveValues(eff) }
}

function detailJson(o: HealthOutcome): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(o.detail ?? {})) as Prisma.InputJsonValue
}

async function prune(connectionId: string): Promise<void> {
  const cutoff = await prisma.engineHealth.findMany({ where: { connectionId }, orderBy: { checkedAt: 'desc' }, skip: KEEP_ROWS, take: 1, select: { checkedAt: true } })
  if (cutoff[0]) await prisma.engineHealth.deleteMany({ where: { connectionId, checkedAt: { lte: cutoff[0].checkedAt } } })
}

/** 결과 1행 기록 + (필요 시) connection 상태 갱신 — 한 트랜잭션. */
export async function recordHealth(
  row: EngineConnection,
  kind: HealthKind,
  o: HealthOutcome,
  opts: { traceId?: string | null; updateStatus: boolean },
): Promise<HealthRunResult> {
  const now = new Date()
  const touchStatus = opts.updateStatus && o.status !== 'UNKNOWN' && row.status !== 'DISABLED'
  const data: Prisma.EngineConnectionUpdateInput = {
    ...(kind === 'HEALTH' && o.status !== 'UNKNOWN' ? { lastHealthAt: now } : {}),
    ...(kind === 'FUNCTIONAL' ? { lastFunctionalAt: now } : {}),
    ...(touchStatus ? { status: o.status, statusReason: o.ok ? null : (o.detail.message ?? o.detail.errorCode ?? null)?.slice(0, 300) ?? null } : {}),
  }
  const [health, connection] = await prisma.$transaction([
    prisma.engineHealth.create({
      data: { connectionId: row.id, kind, ok: o.ok, status: o.status, latencyMs: o.latencyMs, detail: detailJson(o), traceId: opts.traceId ?? null, checkedAt: now },
    }),
    Object.keys(data).length ? prisma.engineConnection.update({ where: { id: row.id }, data }) : prisma.engineConnection.findUniqueOrThrow({ where: { id: row.id } }),
  ])
  if (touchStatus && connection.status !== row.status) clearRouterCache()
  await prune(row.id).catch(() => undefined)
  return { health, connection }
}

async function execute(row: EngineConnection): Promise<HealthRunResult> {
  const provider = getProvider(row.engineId)
  let outcome: HealthOutcome
  if (!provider) {
    outcome = { ok: false, status: 'MISCONFIGURED', latencyMs: null, detail: { errorCode: 'PLUGIN_NOT_LOADED', message: '엔진 플러그인이 로드되지 않았습니다' } }
  } else {
    try {
      outcome = await provider.healthCheck(await profileOf(row))
    } catch {
      outcome = { ok: false, status: 'UNAVAILABLE', latencyMs: null, detail: { errorCode: 'CHECK_FAILED', message: '헬스 체크를 실행하지 못했습니다' } }
    }
  }
  return recordHealth(row, 'HEALTH', outcome, { updateStatus: true })
}

export async function runHealthCheck(environment: Environment, connectionId: string): Promise<HealthRunResult> {
  const row = await loadTarget(environment, connectionId)
  const running = inflight.get(row.id)
  if (running) return running
  const p = execute(row).finally(() => inflight.delete(row.id))
  inflight.set(row.id, p)
  return p
}

export async function listHealth(connectionId: string, opts: { kind?: HealthKind; limit: number }): Promise<EngineHealth[]> {
  return prisma.engineHealth.findMany({ where: { connectionId, ...(opts.kind ? { kind: opts.kind } : {}) }, orderBy: { checkedAt: 'desc' }, take: opts.limit })
}

/** 환경 전체 최근 결과(대시보드) — connection key 포함. */
export async function recentHealth(environment: Environment, limit: number): Promise<(EngineHealth & { connection: { key: string } })[]> {
  return prisma.engineHealth.findMany({
    where: { connection: { environment } },
    orderBy: { checkedAt: 'desc' },
    take: limit,
    include: { connection: { select: { key: true } } },
  })
}
