/**
 * engine 층 오류 → API 오류(api-contract §0-5). engine 은 HTTP 를 모르므로 이름으로 받아 여기서 바꾼다.
 * 다른 환경 행: 조회 권한(SUPER_ADMIN, environment.policy)이 있으면 403 으로 이유를 알리고, 없으면 404 로 존재를 숨긴다.
 */
import { ApiError } from '@/modules/infra'
import type { AdminActor } from './permissions/guard'
import { hasCapability, hiddenNotFound } from './permissions/guard'

export function mapEngineError(e: unknown, actor: AdminActor): never {
  const name = (e as { name?: string })?.name
  if (name === 'ConfigTargetNotFoundError' || name === 'ConnectionNotFoundError') throw hiddenNotFound()
  if (name === 'CrossEnvironmentError') {
    if (!hasCapability(actor, 'environment.policy')) throw hiddenNotFound()
    throw new ApiError('FORBIDDEN', '다른 환경의 연결은 그 환경의 서버에서 실행해야 합니다.', { reason: 'CROSS_ENVIRONMENT' })
  }
  if (name === 'UnsupportedScopeError') throw new ApiError('VALIDATION', '이 scope 는 아직 지원하지 않습니다(Phase 2).', { field: 'scope' })
  if (name === 'FunctionalTestRateLimitedError') {
    const retryAfterSec = (e as { retryAfterSec?: number }).retryAfterSec ?? 30
    throw new ApiError('RATE_LIMITED', '기능 테스트는 연결마다 30초에 한 번만 실행할 수 있어요.', { retryAfterSec })
  }
  throw e
}
