/**
 * 설정 Diff(api-contract #106 정본, admin-console/08 은 #106 에 맞춘다 — task-012c 03:50 ⑤) — 저장하지 않는다.
 *
 * - 행 = 바뀐 키만: `before`/`after`(Effective 값·출처 — env·Override 가 이기면 after 출처가 그대로 남는다) + `storedBefore`/`storedAfter`(저장값) ·
 *   editability·strict·restartTarget · `verifiable`(YES|NO|NOT_NEEDED — 실행 검증 필요 여부, CX-2) · `blocked`.
 * - `blocked`: SHADOWED_BY_ENVIRONMENT(경고 — 저장은 되나 효력 없음) · READ_ONLY·SERVICE_MANAGED·RESTART_REQUIRED·SECRET_VALUE_IN_PAYLOAD(적용 400).
 * - **무상태 `summaryHash`(D-C1)**: sha256(scope·targetId·environment·baseVersion·candidateHash·변경 행[key, 저장 전, 저장 후, blocked]) —
 *   apply·rollback 이 같은 후보로 다시 계산해 대조한다(유효 기간 없음, 다른 변경이 끼면 baseVersion 이 바뀌어 불일치).
 * - `candidateHash` = sha256(scope·targetId·environment·후보 저장값 전체) — `config/test` 결과(EngineHealth.detail.config)와 짝을 맞춘다.
 */
import { createHash } from 'node:crypto'
import { isCredentialRef } from '@/modules/infra'
import { lockBlockedCode, lockMessage, verifiabilityOf, type EditKeyDef, type LockReason, type Verifiable } from './keys'
import type { ConfigSourceName } from './resolver'
import { stableStringify } from './validate'

export interface KeySource {
  value: unknown
  source: ConfigSourceName
}

export type DiffBlockedCode = 'SHADOWED_BY_ENVIRONMENT' | 'READ_ONLY' | 'SERVICE_MANAGED' | 'RESTART_REQUIRED' | 'SECRET_VALUE_IN_PAYLOAD'

export interface DiffBlocked {
  code: DiffBlockedCode
  lock: LockReason | null
  message: string
}

export interface DiffChange {
  key: string
  changeType: 'CHANGED' | 'ADDED'
  before: unknown
  after: unknown
  beforeSource: ConfigSourceName
  afterSource: ConfigSourceName
  storedBefore: unknown
  storedAfter: unknown
  editability: EditKeyDef['editability']
  strict: boolean
  restartTarget: string | null
  verifiable: Verifiable
  blocked: DiffBlocked | null
}

export interface ConfigDiff {
  scope: string
  targetId: string
  environment: string
  baseVersion: number
  summaryHash: string
  candidateHash: string
  changes: DiffChange[]
  unchanged: number
  summary: { changed: number; strict: number; blocked: number; shadowed: number; secretTouched: boolean; notNeeded: number; unverifiable: number }
  productionProtected: boolean
  requiredConfirm: 'SUPER_ADMIN' | null
  /** PRODUCTION 적용에 기능 테스트(testResultId)가 필요한가 — 바뀐 키 중 NOT_NEEDED 가 아닌 것이 있으면. */
  testRequired: boolean
  changedKeys: string[]
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export function hashCandidate(scope: string, targetId: string, environment: string, candidate: Readonly<Record<string, unknown>>): string {
  return `sha256:${sha256(stableStringify({ scope, targetId, environment, candidate }))}`
}

const APPLY_BLOCKING = new Set<DiffBlockedCode>(['READ_ONLY', 'SERVICE_MANAGED', 'RESTART_REQUIRED', 'SECRET_VALUE_IN_PAYLOAD'])
export function isApplyBlocking(b: DiffBlocked | null): boolean {
  return Boolean(b && APPLY_BLOCKING.has(b.code))
}

const defaultEnvSet = (name: string) => Boolean(process.env[name]?.trim())
const SHADOW_SOURCES = new Set<ConfigSourceName>(['RUNTIME_OVERRIDE', 'USER_SETTING'])

export interface BuildDiffInput {
  scope: string
  targetId: string
  environment: string
  baseVersion: number
  defs: readonly EditKeyDef[]
  stored: Readonly<Record<string, unknown>>
  candidate: Readonly<Record<string, unknown>>
  changedKeys: readonly string[]
  /** 키별 Effective(지금 / 후보 적용 후). 없으면 저장값·DATABASE 로 본다. */
  before?: Readonly<Record<string, KeySource>>
  after?: Readonly<Record<string, KeySource>>
  allowLocks?: readonly LockReason[]
  envSet?: (name: string) => boolean
}

export function buildDiff(input: BuildDiffInput): ConfigDiff {
  const byKey = new Map(input.defs.map((d) => [d.key, d]))
  const allow = new Set(input.allowLocks ?? [])
  const envSet = input.envSet ?? defaultEnvSet
  const changes: DiffChange[] = []
  for (const key of input.changedKeys) {
    const def = byKey.get(key)
    if (!def) continue
    const storedBefore = input.stored[key]
    const storedAfter = input.candidate[key]
    const inStored = Object.prototype.hasOwnProperty.call(input.stored, key)
    const b = input.before?.[key]
    const a = input.after?.[key]
    let afterSource: ConfigSourceName = a?.source ?? 'DATABASE'
    let blocked: DiffBlocked | null = null
    if (def.lock && !allow.has(def.lock)) blocked = { code: lockBlockedCode(def.lock), lock: def.lock, message: lockMessage(def.lock) }
    else if (def.type === 'SECRET_REF' && storedAfter !== null && !(typeof storedAfter === 'string' && isCredentialRef(storedAfter))) {
      blocked = { code: 'SECRET_VALUE_IN_PAYLOAD', lock: null, message: '비밀 값 대신 참조 이름만 넣을 수 있습니다.' }
    } else if (def.runtimeEnvWins?.some(envSet)) {
      afterSource = 'ENVIRONMENT'
      blocked = { code: 'SHADOWED_BY_ENVIRONMENT', lock: null, message: '서버 설정(env)이 우선합니다 — 저장은 되지만 효력이 없습니다.' }
    } else if (SHADOW_SOURCES.has(afterSource)) {
      blocked = { code: 'SHADOWED_BY_ENVIRONMENT', lock: null, message: '더 높은 설정 층(임시 Override)이 우선합니다 — 저장은 되지만 지금은 효력이 없습니다.' }
    }
    changes.push({
      key,
      changeType: inStored ? 'CHANGED' : 'ADDED',
      before: b ? b.value : storedBefore,
      after: a && !blocked ? a.value : blocked?.code === 'SHADOWED_BY_ENVIRONMENT' && b ? b.value : storedAfter,
      beforeSource: b?.source ?? (inStored ? 'DATABASE' : 'DEFAULT'),
      afterSource,
      storedBefore: storedBefore ?? null,
      storedAfter: storedAfter ?? null,
      editability: def.editability,
      strict: def.strict,
      restartTarget: def.restartTarget ?? null,
      verifiable: verifiabilityOf(def, storedBefore, storedAfter),
      blocked,
    })
  }
  const candidateHash = hashCandidate(input.scope, input.targetId, input.environment, input.candidate)
  const summaryHash = `sha256:${sha256(
    stableStringify({
      scope: input.scope,
      targetId: input.targetId,
      environment: input.environment,
      baseVersion: input.baseVersion,
      candidateHash,
      changes: changes.map((c) => [c.key, c.storedBefore, c.storedAfter, c.blocked?.code ?? null]),
    }),
  )}`
  const production = input.environment === 'PRODUCTION'
  return {
    scope: input.scope,
    targetId: input.targetId,
    environment: input.environment,
    baseVersion: input.baseVersion,
    summaryHash,
    candidateHash,
    changes,
    unchanged: input.defs.filter((d) => !input.changedKeys.includes(d.key)).length,
    summary: {
      changed: changes.length,
      strict: changes.filter((c) => c.strict).length,
      blocked: changes.filter((c) => isApplyBlocking(c.blocked)).length,
      shadowed: changes.filter((c) => c.blocked?.code === 'SHADOWED_BY_ENVIRONMENT').length,
      secretTouched: changes.some((c) => byKey.get(c.key)?.type === 'SECRET_REF'),
      notNeeded: changes.filter((c) => c.verifiable === 'NOT_NEEDED').length,
      unverifiable: changes.filter((c) => c.verifiable === 'NO').length,
    },
    productionProtected: production,
    requiredConfirm: production ? 'SUPER_ADMIN' : null,
    testRequired: production && changes.some((c) => c.verifiable !== 'NOT_NEEDED'),
    changedKeys: changes.map((c) => c.key),
  }
}
