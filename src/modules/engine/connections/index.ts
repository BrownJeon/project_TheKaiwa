/**
 * Connection Profile 읽기(module-dependency L5 `connections/`) — 목록·단건·fallback 역할·최신 버전 번호.
 * 쓰기(task-012c)는 관리 값(connection·runtime JSON·credentialRef·logLevel·enabled) 물화뿐이고 **호출자(admin)가 연 트랜잭션 안에서만** —
 * 버전 기록·감사와 한 트랜잭션(module-dependency 규칙 6). 생성·삭제는 Phase 4(D-C10).
 * 다른 환경 행은 호출자(admin)가 `environment` 를 명시해야 보인다(SUPER_ADMIN 만, admin 가드가 판단).
 */
import { prisma, type Tx } from '@/modules/infra'
import { Prisma, type EngineConnection, type EngineRole, type EngineStatus, type Environment } from '@prisma/client'

export type EngineConnectionRow = EngineConnection

export interface ConnectionFilter {
  environment: Environment
  role?: EngineRole
  engineId?: string
  status?: EngineStatus
}

export async function listConnections(f: ConnectionFilter): Promise<EngineConnectionRow[]> {
  return prisma.engineConnection.findMany({
    where: { environment: f.environment, ...(f.role ? { role: f.role } : {}), ...(f.engineId ? { engineId: f.engineId } : {}), ...(f.status ? { status: f.status } : {}) },
    orderBy: [{ role: 'asc' }, { key: 'asc' }],
  })
}

/** id(cuid) 또는 key 로. 환경이 다르면 null — 존재를 노출하지 않는다. */
export async function getConnection(environment: Environment, idOrKey: string): Promise<EngineConnectionRow | null> {
  if (!idOrKey || idOrKey.length > 80) return null
  const byId = await prisma.engineConnection.findUnique({ where: { id: idOrKey } })
  if (byId) return byId.environment === environment ? byId : null
  return prisma.engineConnection.findUnique({ where: { environment_key: { environment, key: idOrKey } } })
}

export interface FallbackRoles {
  primaryOf: EngineRole[]
  fallbackOf: EngineRole[]
}

/** 환경의 fallback 정책으로 connection id → {primaryOf, fallbackOf}. */
export async function fallbackRolesByConnection(environment: Environment): Promise<Map<string, FallbackRoles>> {
  const policies = await prisma.engineFallbackPolicy.findMany({ where: { environment } })
  const map = new Map<string, FallbackRoles>()
  const entry = (id: string) => {
    let e = map.get(id)
    if (!e) {
      e = { primaryOf: [], fallbackOf: [] }
      map.set(id, e)
    }
    return e
  }
  for (const p of policies) {
    entry(p.primaryConnectionId).primaryOf.push(p.role)
    for (const id of Array.isArray(p.fallbackConnectionIds) ? (p.fallbackConnectionIds as unknown[]) : []) if (typeof id === 'string') entry(id).fallbackOf.push(p.role)
  }
  return map
}

/** 대상들의 최신 ConfigurationVersion.version(없으면 키 없음). */
export async function latestVersions(environment: Environment, scope: 'ENGINE_CONNECTION' | 'FALLBACK_POLICY', targetIds: string[]): Promise<Map<string, number>> {
  if (targetIds.length === 0) return new Map()
  const rows = await prisma.configurationVersion.groupBy({ by: ['targetId'], where: { environment, scope, targetId: { in: targetIds } }, _max: { version: true } })
  return new Map(rows.filter((r) => r._max.version != null).map((r) => [r.targetId, r._max.version as number]))
}

/** 최근 ConfigurationVersion 생성 시각·활성 Override 수(대시보드). */
export async function configActivity(environment: Environment): Promise<{ latestVersionAt: Date | null; activeOverrides: number }> {
  const [latest, activeOverrides] = await Promise.all([
    prisma.configurationVersion.findFirst({ where: { environment }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.runtimeOverride.count({ where: { environment, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ])
  return { latestVersionAt: latest?.createdAt ?? null, activeOverrides }
}

// ── 쓰기(task-012c) ─────────────────────────────────────────────────────

/** 대상 행 잠금(`SELECT … FOR UPDATE`) 뒤 같은 트랜잭션에서 다시 읽은 행. 없으면 null. */
export async function lockConnectionForUpdate(tx: Tx, id: string): Promise<EngineConnection | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM EngineConnection WHERE id = ${id} FOR UPDATE`
  if (rows.length === 0) return null
  return tx.engineConnection.findUnique({ where: { id } })
}

/**
 * 연결 여러 행 잠금 — **전역 잠금 순서 = 연결(id 오름차순) → Fallback 정책(id 오름차순)**(task-012c Codex C2 ②·REV-036 L2).
 * 한 행씩 id 순서로 잠가 순서를 문장 실행 계획에 맡기지 않는다. 없는 id 는 건너뛴다(참조 재검증이 잡는다).
 */
export async function lockConnectionsForUpdate(tx: Tx, ids: readonly string[]): Promise<void> {
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM EngineConnection WHERE id = ${id} FOR UPDATE`
}

export interface ConnectionConfigWrite {
  connection: Record<string, unknown>
  runtime: Record<string, unknown>
  credentialRef: string | null
  logLevel: string
  enabled: boolean
}

/** 관리 값 물화. 끄면 status 를 DISABLED 로, 켜면 UNKNOWN(다음 Health 가 판정)으로 — Router·음성 경로가 즉시 따른다. */
export async function writeConnectionConfig(tx: Tx, id: string, before: Pick<EngineConnection, 'enabled'>, v: ConnectionConfigWrite): Promise<EngineConnection> {
  const statusChange: Prisma.EngineConnectionUpdateInput =
    before.enabled !== v.enabled ? (v.enabled ? { status: 'UNKNOWN', statusReason: null } : { status: 'DISABLED', statusReason: '관리자가 끔' }) : {}
  return tx.engineConnection.update({
    where: { id },
    data: {
      connection: JSON.parse(JSON.stringify(v.connection)) as Prisma.InputJsonValue,
      runtime: JSON.parse(JSON.stringify(v.runtime)) as Prisma.InputJsonValue,
      credentialRef: v.credentialRef,
      logLevel: v.logLevel.slice(0, 10),
      enabled: v.enabled,
      ...statusChange,
    },
  })
}

/** 이 연결을 1순위로 쓰는 켜진 정책 역할들(끄기 409 PRIMARY_IN_USE 판정). */
export async function enabledPoliciesUsingAsPrimary(environment: Environment, connectionId: string, db: Tx | typeof prisma = prisma): Promise<EngineRole[]> {
  const rows = await db.engineFallbackPolicy.findMany({ where: { environment, primaryConnectionId: connectionId, enabled: true }, select: { role: true } })
  return rows.map((r) => r.role)
}
