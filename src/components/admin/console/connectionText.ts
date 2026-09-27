/** 연결의 정책 속 자리 문구(순수). */
import type { EngineConnectionDto } from '@/types/admin'
import { ROLE_LABEL, ROLE_ORDER } from './labels'

export function policyPlaceLong(c: Pick<EngineConnectionDto, 'fallbackRole'>): string {
  const primary = c.fallbackRole.primaryOf[0]
  if (primary) return `${ROLE_LABEL[primary]}의 기본 연결`
  const fb = c.fallbackRole.fallbackOf[0]
  if (fb) return `${ROLE_LABEL[fb]}의 예비 연결`
  return '정책 밖 연결'
}

export function policyPlace(c: Pick<EngineConnectionDto, 'fallbackRole'>): string {
  const primary = c.fallbackRole.primaryOf[0]
  if (primary) return `${ROLE_LABEL[primary]} 기본`
  const fb = c.fallbackRole.fallbackOf[0]
  if (fb) return `${ROLE_LABEL[fb]} 예비`
  return '정책 밖'
}

/** 역할 순 → key 순. */
export function sortConnections<T extends Pick<EngineConnectionDto, 'role' | 'key'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.key.localeCompare(b.key))
}
