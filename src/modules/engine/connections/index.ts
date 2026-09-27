/**
 * Connection Profile 읽기(module-dependency L5 `connections/`) — 목록·단건·fallback 역할·최신 버전 번호. 쓰기(CRUD)는 Phase 2.
 * 다른 환경 행은 호출자(admin)가 `environment` 를 명시해야 보인다(SUPER_ADMIN 만, admin 가드가 판단).
 */
import { prisma } from '@/modules/infra'
import type { EngineConnection, EngineRole, EngineStatus, Environment } from '@prisma/client'

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
