/**
 * EngineFallbackPolicy 읽기(api-contract #99·#99a). `effectiveOrder` 는 Router 와 같은 규칙으로 계산한다:
 * primary → fallbacks 순, `enabled` 이고 `status ∉ {UNAVAILABLE, DISABLED, MISCONFIGURED}` 인 것만.
 * 편집(#100, task-012c)은 호출자(admin)가 연 트랜잭션 안에서 잠금 → 물화만 한다(버전·감사는 같은 트랜잭션에서 admin 이 조합).
 */
import { prisma, type Tx } from '@/modules/infra'
import type { EngineConnection, EngineFallbackPolicy, EngineRole, Environment, Prisma } from '@prisma/client'

const SKIP_STATUS = new Set(['UNAVAILABLE', 'DISABLED', 'MISCONFIGURED'])

export interface FallbackPolicyView {
  policy: EngineFallbackPolicy
  primary: EngineConnection | null
  fallbacks: EngineConnection[]
  effectiveOrder: EngineConnection[]
}

async function view(policy: EngineFallbackPolicy): Promise<FallbackPolicyView> {
  const fallbackIds = (Array.isArray(policy.fallbackConnectionIds) ? (policy.fallbackConnectionIds as unknown[]) : []).filter((x): x is string => typeof x === 'string')
  const rows = await prisma.engineConnection.findMany({ where: { id: { in: [policy.primaryConnectionId, ...fallbackIds] }, environment: policy.environment } })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const primary = byId.get(policy.primaryConnectionId) ?? null
  const fallbacks = fallbackIds.map((id) => byId.get(id)).filter((r): r is EngineConnection => Boolean(r))
  const chain = policy.enabled ? [primary, ...fallbacks].filter((r): r is EngineConnection => Boolean(r)) : []
  return { policy, primary, fallbacks, effectiveOrder: chain.filter((r) => r.enabled && !SKIP_STATUS.has(r.status)) }
}

export async function listFallbackPolicies(environment: Environment): Promise<FallbackPolicyView[]> {
  const policies = await prisma.engineFallbackPolicy.findMany({ where: { environment }, orderBy: { role: 'asc' } })
  return Promise.all(policies.map(view))
}

export async function getFallbackPolicy(environment: Environment, role: EngineRole): Promise<FallbackPolicyView | null> {
  const policy = await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment, role } } })
  return policy ? view(policy) : null
}

/** id 로(Effective FALLBACK_POLICY 대상). 환경이 다르면 null. */
export async function getFallbackPolicyById(environment: Environment, id: string): Promise<EngineFallbackPolicy | null> {
  if (!id || id.length > 80) return null
  const p = await prisma.engineFallbackPolicy.findUnique({ where: { id } })
  return p && p.environment === environment ? p : null
}

// ── 쓰기(task-012c #100) ────────────────────────────────────────────────

export async function lockFallbackPolicyForUpdate(tx: Tx, id: string): Promise<EngineFallbackPolicy | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM EngineFallbackPolicy WHERE id = ${id} FOR UPDATE`
  if (rows.length === 0) return null
  return tx.engineFallbackPolicy.findUnique({ where: { id } })
}

/**
 * 한 환경의 Fallback 정책 전부 잠금(id 오름차순, 전역 순서의 두 번째 단계 — 연결을 먼저 잠근 뒤에만 부른다). 연결 끄기가
 * "켜진 정책의 주 연결" 재확인을 정책 편집과 직렬화하는 데 쓴다. 정책은 환경당 역할 수(4)뿐이다.
 */
export async function lockFallbackPoliciesForUpdate(tx: Tx, environment: Environment): Promise<void> {
  const rows = await tx.engineFallbackPolicy.findMany({ where: { environment }, select: { id: true }, orderBy: { id: 'asc' } })
  for (const r of rows) await tx.$queryRaw`SELECT id FROM EngineFallbackPolicy WHERE id = ${r.id} FOR UPDATE`
}

export async function writeFallbackPolicy(
  tx: Tx,
  id: string,
  v: { primaryConnectionId: string; fallbackConnectionIds: string[]; retryOnce: boolean; enabled: boolean },
): Promise<EngineFallbackPolicy> {
  return tx.engineFallbackPolicy.update({
    where: { id },
    data: { primaryConnectionId: v.primaryConnectionId, fallbackConnectionIds: [...v.fallbackConnectionIds] as Prisma.InputJsonValue, retryOnce: v.retryOnce, enabled: v.enabled },
  })
}

/** 정책 후보가 가리키는 연결들(같은 환경) — Validate 의존성 검사용. */
export async function connectionsByIds(environment: Environment, ids: readonly string[], db: Tx | typeof prisma = prisma): Promise<EngineConnection[]> {
  if (ids.length === 0) return []
  return db.engineConnection.findMany({ where: { environment, id: { in: [...ids] } } })
}
