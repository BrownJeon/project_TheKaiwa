/**
 * Engine·Connection·Fallback·Secret·Plugin 조합(api-contract #90~#101·#103·#121·#122) — engine 층 공개 API 를 부르고 DTO 로 바꾼다.
 * 쓰기는 Health/Functional 결과(engine 이 기록)와 `secrets.read_ref` 민감 읽기 감사 1행뿐(task-005b G2).
 */
import { ApiError, describeCredentialRef, recordAudit } from '@/modules/infra'
import {
  defaultConfiguration,
  fallbackRolesByConnection,
  getConfigurationSchema,
  getConnection,
  getFallbackPolicy,
  getProvider,
  latestVersions,
  listConnections,
  listEngines,
  listFallbackPolicies,
  listHealth,
  resolveEffective,
  runFunctionalTest,
  runHealthCheck,
  type ConfigurationSchema,
  type EngineListItem,
} from '@/modules/engine'
import type { EngineRole, EngineStatus, Environment, HealthKind } from '@prisma/client'
import type {
  ConfigurationSchemaDto,
  EngineConnectionDetailDto,
  EngineConnectionDto,
  EngineDto,
  FallbackPolicyDto,
  HealthDto,
  HealthRunDto,
  PluginDetailDto,
  PluginDto,
  SecretRefDto,
} from '@/types/admin'
import { mapEngineError } from '../errors'
import type { AdminActor } from '../permissions/guard'
import { hiddenNotFound } from '../permissions/guard'
import { connectionDto, fallbackDto, healthDto } from '../present'

export function schemaDto(s: ConfigurationSchema): ConfigurationSchemaDto {
  return {
    engineId: s.engineId,
    schemaVersion: s.schemaVersion,
    groups: s.groups,
    // envSecretAlias 는 내부 규칙(값이 시크릿인 env 이름) — 콘솔에는 envAlias 만.
    keys: s.keys.map((k) => {
      const { envSecretAlias, ...rest } = k
      void envSecretAlias
      return { ...rest, secret: k.type === 'SECRET_REF' }
    }),
  }
}

function engineName(engineId: string): string {
  return getProvider(engineId)?.descriptor.displayName ?? engineId
}

export async function listEngineConnections(environment: Environment, f: { role?: EngineRole; engineId?: string; status?: EngineStatus }): Promise<EngineConnectionDto[]> {
  const rows = await listConnections({ environment, ...f })
  const [roles, versions] = await Promise.all([fallbackRolesByConnection(environment), latestVersions(environment, 'ENGINE_CONNECTION', rows.map((r) => r.id))])
  return rows.map((r) => connectionDto(r, { engineName: engineName(r.engineId), version: versions.get(r.id) ?? null, roles: roles.get(r.id) }))
}

export async function getEngineConnectionDetail(actor: AdminActor, environment: Environment, idOrKey: string): Promise<EngineConnectionDetailDto> {
  const row = await getConnection(environment, idOrKey)
  if (!row) throw hiddenNotFound()
  const [roles, versions, health] = await Promise.all([fallbackRolesByConnection(environment), latestVersions(environment, 'ENGINE_CONNECTION', [row.id]), listHealth(row.id, { limit: 5 })])
  const eff = await resolveEffective({ environment, scope: 'ENGINE_CONNECTION', targetId: row.id }).catch((e) => mapEngineError(e, actor))
  const bySource: Record<string, number> = {}
  for (const k of eff.keys) bySource[k.source] = (bySource[k.source] ?? 0) + 1
  return {
    ...connectionDto(row, { engineName: engineName(row.engineId), version: versions.get(row.id) ?? null, roles: roles.get(row.id) }),
    effectiveSummary: { keys: eff.keys.length, bySource, warnings: eff.warnings.length + eff.keys.reduce((n, k) => n + k.warnings.length, 0) },
    recentHealth: health.map((h) => healthDto(h, row.key)),
  }
}

export async function runConnectionHealth(actor: AdminActor, connectionId: string): Promise<HealthRunDto> {
  const r = await runHealthCheck(actor.environment, connectionId).catch((e) => mapEngineError(e, actor))
  return { ...healthDto(r.health, r.connection.key), connectionStatus: r.connection.status }
}

export async function runConnectionFunctionalTest(actor: AdminActor, connectionId: string): Promise<HealthRunDto> {
  const r = await runFunctionalTest(actor.environment, connectionId, actor.id).catch((e) => mapEngineError(e, actor))
  return { ...healthDto(r.health, r.connection.key), connectionStatus: r.connection.status }
}

export async function listConnectionHealth(environment: Environment, idOrKey: string, opts: { kind?: HealthKind; limit: number }): Promise<HealthDto[]> {
  const row = await getConnection(environment, idOrKey)
  if (!row) throw hiddenNotFound()
  return (await listHealth(row.id, opts)).map((h) => healthDto(h, row.key))
}

export async function listFallbackPolicyDtos(environment: Environment): Promise<FallbackPolicyDto[]> {
  const views = await listFallbackPolicies(environment)
  const versions = await latestVersions(environment, 'FALLBACK_POLICY', views.map((v) => v.policy.id))
  return views.map((v) => fallbackDto(v, versions.get(v.policy.id) ?? null))
}

export async function getFallbackPolicyDto(environment: Environment, role: EngineRole): Promise<FallbackPolicyDto> {
  const v = await getFallbackPolicy(environment, role)
  if (!v) throw hiddenNotFound()
  const versions = await latestVersions(environment, 'FALLBACK_POLICY', [v.policy.id])
  return fallbackDto(v, versions.get(v.policy.id) ?? null)
}

/**
 * #101 — 환경의 connection 이 쓰는 credentialRef 이름·존재 여부만(값은 읽지 않는다). 조회 자체를 AuditLog 1행으로 남긴다(role-permission §7 민감 읽기).
 * ref 형식이 아닌 저장값(평문 의심)은 목록에 싣지 않고 개수만 감사 after 에 남긴다.
 */
export async function listSecretRefs(actor: AdminActor, environment: Environment): Promise<SecretRefDto[]> {
  const rows = await listConnections({ environment })
  const byRef = new Map<string, { id: string; key: string }[]>()
  let invalid = 0
  for (const r of rows) {
    if (!r.credentialRef) continue
    if (!describeCredentialRef(r.credentialRef)) {
      invalid++
      continue
    }
    byRef.set(r.credentialRef, [...(byRef.get(r.credentialRef) ?? []), { id: r.id, key: r.key }])
  }
  const items: SecretRefDto[] = [...byRef.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, usedBy]) => {
      const st = describeCredentialRef(ref)!
      return { ref, source: st.source, exists: st.exists, mtime: st.mtime, usedBy, lastUsedAt: null }
    })
  await recordAudit({
    environment: actor.environment,
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: 'secrets.read_ref',
    targetId: environment,
    after: { refs: items.length, invalidRefs: invalid, viewedEnvironment: environment, ...(environment !== actor.environment ? { crossEnvironment: true } : {}) },
    ip: actor.ip,
  })
  return items
}

function engineDto(i: EngineListItem, includeSchema: boolean): EngineDto {
  const d = i.provider?.descriptor
  return {
    engine: {
      id: i.engineId,
      displayName: d?.displayName ?? i.engineId,
      type: d?.type ?? 'LLM',
      roles: d?.roles ?? [],
      connectionTypes: d?.connectionTypes ?? [],
      capabilities: d?.capabilities ?? [],
      schemaVersion: d?.schemaVersion ?? 0,
      pluginVersion: d?.pluginVersion ?? '',
      providerClass: d?.providerClass ?? '',
      enabled: i.enabled,
      loaded: i.loaded,
      initError: i.initError,
    },
    schema: includeSchema && i.provider && i.loaded ? schemaDto(i.provider.configurationSchema()) : null,
    connections: i.connections,
  }
}

export async function listEngineDtos(environment: Environment, includeSchema: boolean): Promise<EngineDto[]> {
  return (await listEngines(environment)).map((i) => engineDto(i, includeSchema))
}

function pluginDto(i: EngineListItem): PluginDto {
  const d = i.provider?.descriptor
  return {
    id: i.engineId,
    displayName: d?.displayName ?? i.engineId,
    providerClass: d?.providerClass ?? '',
    version: d?.pluginVersion ?? '',
    type: d?.type ?? 'LLM',
    roles: d?.roles ?? [],
    connectionTypes: d?.connectionTypes ?? [],
    loaded: i.loaded,
    initError: i.initError,
    connections: i.connections,
    orphan: i.orphan,
  }
}

export async function listPluginDtos(environment: Environment): Promise<PluginDto[]> {
  return (await listEngines(environment)).map(pluginDto)
}

export async function getPluginDto(environment: Environment, id: string): Promise<PluginDetailDto> {
  const i = (await listEngines(environment)).find((e) => e.engineId === id)
  if (!i) throw hiddenNotFound()
  const schema = i.provider ? i.provider.configurationSchema() : null
  return {
    ...pluginDto(i),
    capabilities: i.provider?.descriptor.capabilities ?? [],
    schemaVersion: i.provider?.descriptor.schemaVersion ?? 0,
    defaultConfiguration: schema ? defaultConfiguration(schema) : {},
    schema: schema ? schemaDto(schema) : null,
    sourcePath: i.provider?.descriptor.sourcePath ?? '',
  }
}

export function getSchemaDto(engineId: string): ConfigurationSchemaDto {
  const s = /^[a-z0-9-]{1,60}$/.test(engineId) ? getConfigurationSchema(engineId) : null
  if (!s) throw hiddenNotFound()
  return schemaDto(s)
}


// ── 쿼리 검증(라우트가 얇게 유지되도록 여기서) ────────────────────────────────

const ENGINE_ROLES: readonly EngineRole[] = ['REALTIME_STT', 'ANALYSIS_STT', 'TTS', 'LLM']
const ENGINE_STATUSES: readonly EngineStatus[] = ['UNKNOWN', 'HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'MISCONFIGURED', 'DISABLED']
const HEALTH_KINDS: readonly HealthKind[] = ['HEALTH', 'FUNCTIONAL']

function oneOf<T extends string>(list: readonly T[], raw: string | null | undefined, field: string): T | undefined {
  if (raw == null || raw === '') return undefined
  if (!(list as readonly string[]).includes(raw)) throw new ApiError('VALIDATION', `${field} 값이 올바르지 않습니다.`, { field })
  return raw as T
}

export const parseEngineRole = (raw: string | null | undefined) => oneOf(ENGINE_ROLES, raw, 'role')
export const parseEngineStatus = (raw: string | null | undefined) => oneOf(ENGINE_STATUSES, raw, 'status')
export const parseHealthKind = (raw: string | null | undefined) => oneOf(HEALTH_KINDS, raw, 'kind')

export function parseEngineId(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === '') return undefined
  if (!/^[a-z0-9-]{1,60}$/.test(raw)) throw new ApiError('VALIDATION', 'engineId 형식이 올바르지 않습니다.', { field: 'engineId' })
  return raw
}

/** 역할 경로 파라미터(#99a) — 모르는 역할은 404(존재 비노출과 같은 모양). */
export function roleParam(raw: string): EngineRole {
  const r = raw.toUpperCase()
  if (!(ENGINE_ROLES as readonly string[]).includes(r)) throw hiddenNotFound()
  return r as EngineRole
}
