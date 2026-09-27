/**
 * #102 Effective Configuration 조합 — engine resolver(8층, 읽기 전용) 결과를 역할별 상세도로 자른다.
 * ADMIN = 값 + Source 이름 + shadowed(요약) · DEVELOPER 이상(config.raw.read) = sourceRef·layers·경고 상세(configuration-resolution §3-1, api-contract #102).
 * SECRET 키는 값이 아니라 ref 이름 + 존재 여부(boolean)만.
 * PRODUCTION 대상의 FULL 상세 조회는 민감 읽기라 AuditLog 1행(role-permission §7 `config.raw.read`(PRODUCTION 대상만)) — 메타만, 값 없음(REV-009·Codex C2).
 */
import { ApiError, describeCredentialRef, recordAudit, type AuditEntry } from '@/modules/infra'
import { resolveEffective, type EffectiveConfiguration } from '@/modules/engine'
import type { ConfigScope, Environment } from '@prisma/client'
import type { EffectiveConfigDto } from '@/types/admin'
import { mapEngineError } from '../errors'
import { hasCapability, type AdminActor } from '../permissions/guard'
import { effectiveDto } from '../present'

const SCOPES: readonly ConfigScope[] = ['ENGINE_CONNECTION', 'FALLBACK_POLICY', 'PROMPT', 'APP_SETTING', 'VOICE_PROFILE', 'PRESET']

export interface EffectiveDeps {
  resolve: (input: { environment: Environment; scope: ConfigScope; targetId: string }) => Promise<EffectiveConfiguration>
  audit: (entry: AuditEntry) => Promise<unknown>
}

const DEFAULT_DEPS: EffectiveDeps = { resolve: resolveEffective, audit: recordAudit }

/** PRODUCTION 대상 + FULL(sourceRef·layers) 일 때만 감사 항목. 그 외 null. */
export function rawReadAuditEntry(actor: AdminActor, environment: Environment, eff: Pick<EffectiveConfiguration, 'scope' | 'targetId'>, full: boolean): AuditEntry | null {
  if (!full || environment !== 'PRODUCTION') return null
  return {
    environment,
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: 'config.raw.read',
    scope: eff.scope,
    targetId: eff.targetId,
    after: { detail: 'FULL', ...(actor.environment !== environment ? { crossEnvironment: true } : {}) },
    ip: actor.ip,
  }
}

export async function getEffectiveConfig(
  actor: AdminActor,
  environment: Environment,
  q: { scope: string | null; targetId: string | null; context: string | null },
  deps: EffectiveDeps = DEFAULT_DEPS,
): Promise<EffectiveConfigDto> {
  const scope = q.scope?.toUpperCase() ?? ''
  if (!(SCOPES as readonly string[]).includes(scope)) throw new ApiError('VALIDATION', 'scope 값이 올바르지 않습니다.', { field: 'scope' })
  if (!q.targetId || q.targetId.length > 80 || !/^[\w.-]+$/.test(q.targetId)) throw new ApiError('VALIDATION', 'targetId 가 필요합니다.', { field: 'targetId' })
  // USER_SETTING 층을 붙이는 context=user:<id> 는 Phase 2(SUPER_ADMIN 전용) — 지금은 받지 않는다(무시하지 않고 명시 거부).
  if (q.context) throw new ApiError('VALIDATION', 'context 는 아직 지원하지 않습니다(Phase 2).', { field: 'context' })
  const eff = await deps.resolve({ environment, scope: scope as ConfigScope, targetId: q.targetId }).catch((e) => mapEngineError(e, actor))
  const full = hasCapability(actor, 'config.raw.read')
  // 응답을 만들기 전에 기록한다 — 감사가 실패하면 상세도 나가지 않는다.
  const entry = rawReadAuditEntry(actor, environment, eff, full)
  if (entry) await deps.audit(entry)
  return effectiveDto(eff, { full, secretExists: (ref) => describeCredentialRef(ref)?.exists ?? false })
}
