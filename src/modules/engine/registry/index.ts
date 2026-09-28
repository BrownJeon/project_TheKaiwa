/**
 * Engine Registry(module-dependency L5 `registry/`) — 코드 Provider 목록 + 스키마 자체 검증(admin-console/03 §8) + DB `Engine` 스냅샷 대조.
 * Phase 1 은 **읽기만** 한다(`Engine` 행 upsert·syncDescriptorsToDb 는 Phase 2 — task-005b G2 쓰기 0).
 */
import { isCredentialRef, isDeniedCredentialRef, prisma } from '@/modules/infra'
import type { Environment } from '@prisma/client'
import { PROVIDERS } from '../adapters/providers'
import type { ConfigurationSchema, EngineProvider, SchemaKey } from './types'

export type { ConfigurationSchema, EngineDescriptor, EngineProvider, SchemaKey, ConnectionProfile, HealthOutcome, HealthDetail } from './types'

const TYPE_CHECK: Record<SchemaKey['type'], (v: unknown) => boolean> = {
  STRING: (v) => typeof v === 'string',
  PATH: (v) => typeof v === 'string',
  URL: (v) => typeof v === 'string',
  INTEGER: (v) => typeof v === 'number' && Number.isInteger(v),
  NUMBER: (v) => typeof v === 'number' && Number.isFinite(v),
  BOOLEAN: (v) => typeof v === 'boolean',
  ENUM: () => true,
  SECRET_REF: (v) => v === null || typeof v === 'string',
  JSON: () => true,
}

/** 값이 스키마 키 제약을 만족하는지 — 위반 코드 목록(빈 배열 = 통과). resolver 의 validate 와 공용. */
export function checkValue(k: SchemaKey, v: unknown): string[] {
  if (v === null && (k.type === 'SECRET_REF' || k.default === null)) return []
  if (!TYPE_CHECK[k.type](v)) return ['E_TYPE']
  const errs: string[] = []
  if (k.type === 'ENUM' && k.enum && !k.enum.includes(v as string | number)) errs.push('E_ENUM')
  if (typeof v === 'number') {
    if (k.min != null && v < k.min) errs.push('E_RANGE')
    if (k.max != null && v > k.max) errs.push('E_RANGE')
  }
  if (k.type === 'URL' && typeof v === 'string') {
    try {
      const u = new URL(v)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') errs.push('E_URL')
    } catch {
      errs.push('E_URL')
    }
  }
  if (k.pattern && typeof v === 'string' && !new RegExp(k.pattern).test(v)) errs.push('E_PATTERN')
  return errs
}

/** 스키마 자체 검증(03 §8): 키 유일·그룹 접두·default 가 자기 제약 만족·restartRequired↔editability·enum 비어 있지 않음. */
export function selfCheckSchema(schema: ConfigurationSchema, engineId: string): string[] {
  const errs: string[] = []
  if (schema.engineId !== engineId) errs.push(`engineId 불일치(${schema.engineId})`)
  const seen = new Set<string>()
  for (const k of schema.keys) {
    if (seen.has(k.key)) errs.push(`중복 키 ${k.key}`)
    seen.add(k.key)
    if (!k.key.startsWith(`${k.group}.`)) errs.push(`그룹 접두 불일치 ${k.key}`)
    if (k.type === 'ENUM' && (!k.enum || k.enum.length === 0)) errs.push(`빈 enum ${k.key}`)
    if (k.restartRequired !== (k.editability === 'RESTART_REQUIRED' || k.editability === 'REDEPLOY_REQUIRED')) errs.push(`restartRequired 불일치 ${k.key}`)
    if ((k.type === 'SECRET_REF') !== (k.editability === 'SECRET')) errs.push(`SECRET 표기 불일치 ${k.key}`)
    if (checkValue(k, k.default).length > 0) errs.push(`default 가 제약 위반 ${k.key}`)
    if (k.type === 'SECRET_REF') {
      if (!Array.isArray(k.allowedRefs)) errs.push(`allowedRefs 없음 ${k.key}`)
      else if (k.allowedRefs.some((r) => !isCredentialRef(r) || isDeniedCredentialRef(r))) errs.push(`allowedRefs 에 형식 오류·거부 분류 ref ${k.key}`)
    } else if (k.allowedRefs !== undefined) errs.push(`SECRET_REF 가 아닌 키의 allowedRefs ${k.key}`)
  }
  return errs
}

interface PluginState {
  provider: EngineProvider
  loaded: boolean
  initError: string | null
}

let states: PluginState[] | null = null

/** 기동 후 첫 호출에 한 번 스키마를 검증해 loaded/initError 를 정한다(코드가 바뀌면 프로세스가 새로 뜬다). */
export function pluginStates(): PluginState[] {
  if (states) return states
  states = PROVIDERS.map((provider) => {
    try {
      const errs = selfCheckSchema(provider.configurationSchema(), provider.descriptor.id)
      return { provider, loaded: errs.length === 0, initError: errs.length ? errs.slice(0, 3).join('; ').slice(0, 300) : null }
    } catch (e) {
      return { provider, loaded: false, initError: e instanceof Error ? e.message.slice(0, 300) : '스키마 로드 실패' }
    }
  })
  return states
}

/** 로드된(스키마 검증 통과) Provider 만. 초기화 오류가 있는 엔진은 Router·Health 에서 제외(03 §8). */
export function getProvider(engineId: string): EngineProvider | null {
  const s = pluginStates().find((p) => p.provider.descriptor.id === engineId)
  return s && s.loaded ? s.provider : null
}

export function getConfigurationSchema(engineId: string): ConfigurationSchema | null {
  return getProvider(engineId)?.configurationSchema() ?? null
}

export interface EngineListItem {
  provider: EngineProvider | null
  engineId: string
  loaded: boolean
  initError: string | null
  /** DB `Engine` 행 enabled(없으면 true). */
  enabled: boolean
  /** DB 에는 있는데 코드 레지스트리에 없다. */
  orphan: boolean
  /** 해당 환경의 connection 수. */
  connections: number
}

export async function listEngines(environment: Environment): Promise<EngineListItem[]> {
  const [rows, counts] = await Promise.all([
    prisma.engine.findMany({ select: { id: true, enabled: true } }),
    prisma.engineConnection.groupBy({ by: ['engineId'], where: { environment }, _count: { _all: true } }),
  ])
  const countOf = new Map(counts.map((c) => [c.engineId, c._count._all]))
  const dbEnabled = new Map(rows.map((r) => [r.id, r.enabled]))
  const items: EngineListItem[] = pluginStates().map((s) => ({
    provider: s.provider,
    engineId: s.provider.descriptor.id,
    loaded: s.loaded,
    initError: s.initError,
    enabled: dbEnabled.get(s.provider.descriptor.id) ?? true,
    orphan: false,
    connections: countOf.get(s.provider.descriptor.id) ?? 0,
  }))
  for (const r of rows) {
    if (!items.some((i) => i.engineId === r.id)) {
      items.push({ provider: null, engineId: r.id, loaded: false, initError: '코드 레지스트리에 없는 엔진', enabled: r.enabled, orphan: true, connections: countOf.get(r.id) ?? 0 })
    }
  }
  return items
}

/** 스키마 default 만 모은 문서(#122 defaultConfiguration). */
export function defaultConfiguration(schema: ConfigurationSchema): Record<string, unknown> {
  return Object.fromEntries(schema.keys.map((k) => [k.key, k.default]))
}
