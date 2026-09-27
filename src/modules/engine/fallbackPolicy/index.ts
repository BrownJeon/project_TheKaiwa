/**
 * EngineFallbackPolicy 읽기(api-contract #99·#99a). `effectiveOrder` 는 Router 와 같은 규칙으로 계산한다:
 * primary → fallbacks 순, `enabled` 이고 `status ∉ {UNAVAILABLE, DISABLED, MISCONFIGURED}` 인 것만. 편집(#100)은 Phase 2.
 */
import { prisma } from '@/modules/infra'
import type { EngineConnection, EngineFallbackPolicy, EngineRole, Environment } from '@prisma/client'

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
