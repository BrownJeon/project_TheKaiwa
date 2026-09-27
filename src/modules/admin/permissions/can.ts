/**
 * `can(user, capability, ctx?)` — 순수 함수(role-permission.md §5). DB·세션을 모른다: 역할은 호출자가 **DB 에서 읽은 값**을 넘긴다.
 *
 * PRODUCTION 보호(§6): 대상 행의 환경(`ctx.targetEnvironment`)이 PRODUCTION 이면 매트릭스의 "P" 칸 capability 에
 * SUPER_ADMIN 확인 capability 를 추가로 요구한다. 요청 body 의 environment 가 아니라 **대상 행의 environment** 를 넘겨야 한다.
 */
import type { AdminEnvironment, AdminRole, Capability } from '@/types/admin'
import { CAPABILITIES, NON_CONSOLE_CAPABILITIES, ROLE_CAPABILITIES, isRole } from './matrix'

export interface CanContext {
  /** 요청을 처리하는 프로세스의 APP_ENV. */
  environment?: AdminEnvironment
  /** 변경 대상 행의 environment(새로 만들 때는 body 값). */
  targetEnvironment?: AdminEnvironment
  /** voices.manage 의 disable/delete 처럼 매트릭스가 "(disable/delete P)" 로 적은 동작만 true. */
  productionSensitive?: boolean
}

export interface CanResult {
  allowed: boolean
  missing: Capability[]
}

type RoleLike = AdminRole | { role: string } | null | undefined

function roleOf(user: RoleLike): AdminRole | null {
  const r = typeof user === 'string' ? user : user?.role
  return isRole(r) ? r : null
}

/** PRODUCTION 대상이면 추가로 요구하는 capability(§3 "P" 칸 · §6-2~§6-7). */
const PRODUCTION_EXTRA: Partial<Record<Capability, Capability>> = {
  'engine.connections.manage': 'config.apply.production',
  'config.edit': 'config.apply.production',
  'config.rollback': 'config.apply.production',
  'prompts.activate': 'config.apply.production',
  'debug_session.create': 'config.apply.production',
  'override.create': 'override.production',
  'config.import': 'config.import.production',
}

/** 역할이 가진 capability(정본 §2 순서). 알 수 없는 역할은 빈 목록. */
export function capabilitiesOf(user: RoleLike): Capability[] {
  const role = roleOf(user)
  if (!role) return []
  const set = ROLE_CAPABILITIES[role]
  return CAPABILITIES.filter((c) => set.has(c))
}

/** 파생 capability — 매트릭스 상수와 별개로 규칙(§2)만으로 계산한다(테스트가 상수와 대조). */
export function derivesConsoleAccess(caps: Iterable<Capability>): boolean {
  for (const c of caps) if (!NON_CONSOLE_CAPABILITIES.has(c)) return true
  return false
}

export function can(user: RoleLike, capability: Capability, ctx: CanContext = {}): CanResult {
  const role = roleOf(user)
  if (!role) return { allowed: false, missing: [capability] }
  const set = ROLE_CAPABILITIES[role]
  const required: Capability[] = [capability]
  if (ctx.targetEnvironment === 'PRODUCTION') {
    const extra = capability === 'voices.manage' ? (ctx.productionSensitive ? 'config.apply.production' : undefined) : PRODUCTION_EXTRA[capability]
    if (extra) required.push(extra)
  }
  const missing = required.filter((c) => !set.has(c))
  return { allowed: missing.length === 0, missing }
}
