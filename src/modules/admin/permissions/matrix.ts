/**
 * Role × Capability 매트릭스 — role-permission.md §3 표를 그대로 옮긴 상수(문서가 정본, 단위 테스트가 표 전체를 대조한다).
 * 누적 구조(SUPER_ADMIN ⊇ DEVELOPER ⊇ ADMIN ⊇ USER)를 **전개해서** 적는다 — 역할 비교(`role === 'ADMIN'`)로 판단하지 않기 위해서다.
 * `console.access` 는 파생 capability(§2 마지막 행): `settings.*`·`voices.read` 를 뺀 것이 하나라도 있으면 true.
 */
import type { AdminRole, Capability } from '@/types/admin'

/** §2 표의 행 순서 그대로(33행). */
export const CAPABILITIES = [
  'settings.read',
  'settings.write',
  'voices.read',
  'voices.manage',
  'engine.read',
  'engine.connections.manage',
  'config.effective.read',
  'config.raw.read',
  'config.edit',
  'config.apply.production',
  'config.rollback',
  'credentials.manage',
  'secrets.read_ref',
  'plugins.read',
  'health.run',
  'functional_test.run',
  'playground.use',
  'e2e.run',
  'trace.read',
  'debug_session.create',
  'override.create',
  'override.production',
  'prompts.read',
  'prompts.edit',
  'prompts.activate',
  'presets.manage',
  'config.export',
  'config.import',
  'config.import.production',
  'audit.read',
  'environment.policy',
  'users.role.manage',
  'console.access',
] as const satisfies readonly Capability[]

// 유니온에 있는데 배열에 빠진 capability 가 있으면 여기서 타입 오류가 난다.
type MissingFromList = Exclude<Capability, (typeof CAPABILITIES)[number]>
const _exhaustive: MissingFromList extends never ? true : never = true
void _exhaustive

export const ROLES = ['USER', 'ADMIN', 'DEVELOPER', 'SUPER_ADMIN'] as const satisfies readonly AdminRole[]

const USER: readonly Capability[] = ['settings.read', 'settings.write', 'voices.read']

const ADMIN: readonly Capability[] = [
  ...USER,
  'voices.manage',
  'engine.read',
  'engine.connections.manage',
  'config.effective.read',
  'config.edit',
  'config.rollback',
  'secrets.read_ref',
  'health.run',
  'functional_test.run',
  'audit.read',
  'console.access',
]

const DEVELOPER: readonly Capability[] = [
  ...ADMIN,
  'config.raw.read',
  'plugins.read',
  'playground.use',
  'e2e.run',
  'trace.read',
  'debug_session.create',
  'override.create',
  'prompts.read',
  'prompts.edit',
  'prompts.activate',
  'presets.manage',
  'config.export',
  'config.import',
]

const SUPER_ADMIN: readonly Capability[] = [
  ...DEVELOPER,
  'config.apply.production',
  'credentials.manage',
  'override.production',
  'config.import.production',
  'environment.policy',
  'users.role.manage',
]

export const ROLE_CAPABILITIES: Readonly<Record<AdminRole, ReadonlySet<Capability>>> = Object.freeze({
  USER: new Set(USER),
  ADMIN: new Set(ADMIN),
  DEVELOPER: new Set(DEVELOPER),
  SUPER_ADMIN: new Set(SUPER_ADMIN),
})

/** `console.access` 파생 규칙에서 빼는 capability(§2). */
export const NON_CONSOLE_CAPABILITIES: ReadonlySet<Capability> = new Set(['settings.read', 'settings.write', 'voices.read', 'console.access'])

export function isRole(v: unknown): v is AdminRole {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

export function isCapability(v: unknown): v is Capability {
  return typeof v === 'string' && (CAPABILITIES as readonly string[]).includes(v)
}
