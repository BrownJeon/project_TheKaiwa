/**
 * #102 Effective Configuration 조합 — engine resolver(8층, 읽기 전용) 결과를 역할별 상세도로 자른다.
 * ADMIN = 값 + Source 이름 + shadowed(요약) · DEVELOPER 이상(config.raw.read) = sourceRef·layers·경고 상세(configuration-resolution §3-1, api-contract #102).
 * SECRET 키는 값이 아니라 ref 이름 + 존재 여부(boolean)만.
 */
import { ApiError, describeCredentialRef } from '@/modules/infra'
import { resolveEffective } from '@/modules/engine'
import type { ConfigScope, Environment } from '@prisma/client'
import type { EffectiveConfigDto } from '@/types/admin'
import { mapEngineError } from '../errors'
import { hasCapability, type AdminActor } from '../permissions/guard'
import { effectiveDto } from '../present'

const SCOPES: readonly ConfigScope[] = ['ENGINE_CONNECTION', 'FALLBACK_POLICY', 'PROMPT', 'APP_SETTING', 'VOICE_PROFILE', 'PRESET']

export async function getEffectiveConfig(actor: AdminActor, environment: Environment, q: { scope: string | null; targetId: string | null; context: string | null }): Promise<EffectiveConfigDto> {
  const scope = q.scope?.toUpperCase() ?? ''
  if (!(SCOPES as readonly string[]).includes(scope)) throw new ApiError('VALIDATION', 'scope 값이 올바르지 않습니다.', { field: 'scope' })
  if (!q.targetId || q.targetId.length > 80 || !/^[\w.-]+$/.test(q.targetId)) throw new ApiError('VALIDATION', 'targetId 가 필요합니다.', { field: 'targetId' })
  // USER_SETTING 층을 붙이는 context=user:<id> 는 Phase 2(SUPER_ADMIN 전용) — 지금은 받지 않는다(무시하지 않고 명시 거부).
  if (q.context) throw new ApiError('VALIDATION', 'context 는 아직 지원하지 않습니다(Phase 2).', { field: 'context' })
  const eff = await resolveEffective({ environment, scope: scope as ConfigScope, targetId: q.targetId }).catch((e) => mapEngineError(e, actor))
  return effectiveDto(eff, { full: hasCapability(actor, 'config.raw.read'), secretExists: (ref) => describeCredentialRef(ref)?.exists ?? false })
}
