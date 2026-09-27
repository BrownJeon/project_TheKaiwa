/**
 * #102 Effective Configuration 조합 — engine resolver(8층, 읽기 전용) 결과를 역할별 상세도로 자른다.
 * ADMIN = 값 + Source 이름 + shadowed(요약) · DEVELOPER 이상(config.raw.read) = sourceRef·layers·경고 상세(configuration-resolution §3-1, api-contract #102).
 * SECRET 키는 값이 아니라 ref 이름 + 존재 여부(boolean)만.
 */
import { describeCredentialRef } from '@/modules/infra'
import { resolveEffective } from '@/modules/engine'
import type { ConfigScope, Environment } from '@prisma/client'
import type { EffectiveConfigDto } from '@/types/admin'
import { mapEngineError } from '../errors'
import { hasCapability, type AdminActor } from '../permissions/guard'
import { effectiveDto } from '../present'

export async function getEffectiveConfig(actor: AdminActor, environment: Environment, scope: ConfigScope, targetId: string): Promise<EffectiveConfigDto> {
  const eff = await resolveEffective({ environment, scope, targetId }).catch((e) => mapEngineError(e, actor))
  return effectiveDto(eff, { full: hasCapability(actor, 'config.raw.read'), secretExists: (ref) => describeCredentialRef(ref)?.exists ?? false })
}
