/**
 * Effective Configuration Resolver(configuration-resolution.md §2·§3, 읽기 전용) — 8층을 키 단위로 겹쳐 `{value, source, sourceRef, editability, layers}` 를 낸다.
 *
 * Phase 1(task-005b) 층 구현 현황:
 *   1 DEFAULT             ✅ 어댑터 configurationSchema().default
 *   2 SOURCE_CODE         ✅ 어댑터가 코드로 고정한 값(sourceCodeLayer — 예: claude-cli permissionMode·tools)
 *   3 APPLICATION_CONFIG  ⬜ 빈 층 — speech.config.yml 을 **런타임이 아직 읽지 않는다**(로더·yaml 의존성 없음). 읽지 않는 값을 Effective 로 보이면 거짓이 된다
 *   4 ENVIRONMENT         ✅ KAIWA_CONN_<KEY>_<PATH> > KAIWA_<ROLE>_<PATH>(역할 primary 에만) > 스키마 envAlias > envSecretAlias(→ env:NAME ref)
 *   5 DATABASE            ✅ ConfigurationVersion(ACTIVE).snapshot · FALLBACK_POLICY 는 EngineFallbackPolicy 행 (현재 버전 행 0 → 대개 빈 층)
 *   6 CONNECTION_PROFILE  ✅ EngineConnection.connection·runtime·credentialRef·logLevel
 *   7 USER_SETTING        ⬜ 빈 층 — 엔진 스키마에 userSettable 키가 없고 `context=user:` 는 Phase 2
 *   8 RUNTIME_OVERRIDE    ✅ 만료·revoke 안 된 TEMPORARY(SESSION 은 sessionId 컨텍스트가 생기는 Phase 4)
 *
 * 규칙: 키 단위 덮어쓰기(deep merge 없음, 배열 통째 교체) · READ_ONLY 는 1~4 층만 · RUNTIME_OVERRIDE 는 RUNTIME_EDITABLE 만 ·
 * SECRET_REF 는 ref 형식(`env:`/`file:`)이나 null 만 — 아니면 **값을 버리고** `E_CONN_SECRET_VALUE`(값을 경고에도 싣지 않는다) ·
 * 스키마 밖 키는 무시 + `W_UNKNOWN_KEY` · 검증 위반은 값을 고치지 않고 경고만. 시크릿 값 자체는 어느 층에서도 읽지 않는다.
 * 저장값 `"$NAME"`(NAME 이 그 키의 envAlias)은 "env 가 준다" 는 자리표시자다 — 그 층 값으로 쓰지 않아 ENVIRONMENT 가 드러난다
 * (seed `claude-cli-local.connection.binPath = "$CLAUDE_CLI_PATH"`, 런타임도 env 를 spawn). 스키마에 없는 이름은 절대 해석하지 않는다(임의 env 노출 차단).
 */
import { isCredentialRef, prisma } from '@/modules/infra'
import type { ConfigScope, EngineConnection, EngineFallbackPolicy, Environment } from '@prisma/client'
import { checkValue, getProvider } from '../registry'
import type { SchemaKey } from '../registry/types'

export type ConfigSourceName = 'DEFAULT' | 'SOURCE_CODE' | 'APPLICATION_CONFIG' | 'ENVIRONMENT' | 'DATABASE' | 'CONNECTION_PROFILE' | 'USER_SETTING' | 'RUNTIME_OVERRIDE'
export const SOURCE_ORDER: readonly ConfigSourceName[] = ['DEFAULT', 'SOURCE_CODE', 'APPLICATION_CONFIG', 'ENVIRONMENT', 'DATABASE', 'CONNECTION_PROFILE', 'USER_SETTING', 'RUNTIME_OVERRIDE']

export interface LayerEntry {
  value: unknown
  sourceRef: string
}
export type Layer = Map<string, LayerEntry>
export type Layers = Record<ConfigSourceName, Layer>

export interface EffectiveKey {
  key: string
  type: SchemaKey['type']
  value: unknown
  source: ConfigSourceName
  sourceRef: string
  editability: SchemaKey['editability']
  restartRequired: boolean
  secret: boolean
  shadowed: boolean
  layers: { source: ConfigSourceName; value: unknown; sourceRef: string }[]
  warnings: string[]
}

export interface EffectiveConfiguration {
  environment: Environment
  scope: ConfigScope
  targetId: string
  targetKey: string | null
  engineId: string | null
  schemaVersion: number | null
  resolvedAt: string
  cacheHit: false
  keys: EffectiveKey[]
  emptyLayers: ConfigSourceName[]
  warnings: string[]
}

export class ConfigTargetNotFoundError extends Error {
  constructor() {
    super('설정 대상을 찾을 수 없습니다')
    this.name = 'ConfigTargetNotFoundError'
  }
}

export class UnsupportedScopeError extends Error {
  constructor(scope: string) {
    super(`scope ${scope} 는 Phase 2 이후 지원`)
    this.name = 'UnsupportedScopeError'
  }
}

const PLACEHOLDER = /^\$([A-Z][A-Z0-9_]{0,63})$/
const SAFE_KEY = /^[\w.-]{1,120}$/

export function emptyLayers(): Layers {
  return Object.fromEntries(SOURCE_ORDER.map((s) => [s, new Map()])) as Layers
}

/** 중첩 객체를 점 표기 평면 키로(배열은 값 그대로). 깊이 6 상한, 이상한 세그먼트는 버리고 경고. */
export function flatten(prefix: string, obj: unknown, sourceRefBase: string, out: Layer, warnings: string[], depth = 0): void {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
  for (const [seg, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!/^[\w-]{1,60}$/.test(seg)) {
      warnings.push('W_BAD_KEY_SEGMENT')
      continue
    }
    const k = prefix ? `${prefix}.${seg}` : seg
    if (v && typeof v === 'object' && !Array.isArray(v) && depth < 6) flatten(k, v, sourceRefBase, out, warnings, depth + 1)
    else out.set(k, { value: v, sourceRef: `${sourceRefBase}.${k}` })
  }
}

/**
 * EngineConnection 행 → CONNECTION_PROFILE 층. credentialRef 컬럼의 null 은 "이 연결은 자격증명 없음" 이라는 **명시값**이다
 * (스키마 default ref 로 떨어지면 없는 자격증명을 있는 것처럼 보이게 된다) — 단 스키마에 그 키가 없으면 넣지 않는다.
 */
export function profileLayer(row: Pick<EngineConnection, 'id' | 'connection' | 'runtime' | 'credentialRef' | 'logLevel'>, warnings: string[], schemaHasCredential = true): Layer {
  const layer: Layer = new Map()
  const base = `db:EngineConnection[${row.id}]`
  flatten('connection', row.connection, base, layer, warnings)
  flatten('runtime', row.runtime, base, layer, warnings)
  if (row.credentialRef != null || schemaHasCredential) layer.set('connection.credentialRef', { value: row.credentialRef ?? null, sourceRef: `${base}.credentialRef` })
  layer.set('logging.level', { value: row.logLevel, sourceRef: `${base}.logLevel` })
  return layer
}

function envToken(s: string): string {
  return s.replace(/[.-]/g, '_').toUpperCase()
}

export function envNamesFor(k: SchemaKey, ctx: { connectionKey: string; role: string; isRolePrimary: boolean }): string[] {
  const path = envToken(k.key)
  return [`KAIWA_CONN_${envToken(ctx.connectionKey)}_${path}`, ...(ctx.isRolePrimary ? [`KAIWA_${ctx.role}_${path}`] : []), ...(k.envAlias ?? [])]
}

type Parsed = { ok: true; value: unknown } | { ok: false; code: string }

export function parseEnvValue(k: SchemaKey, raw: string): Parsed {
  const s = raw.trim()
  switch (k.type) {
    case 'INTEGER':
      return /^-?\d{1,12}$/.test(s) ? { ok: true, value: Number(s) } : { ok: false, code: 'E_ENV_PARSE' }
    case 'NUMBER':
      return s !== '' && Number.isFinite(Number(s)) ? { ok: true, value: Number(s) } : { ok: false, code: 'E_ENV_PARSE' }
    case 'BOOLEAN':
      if (/^(true|1)$/i.test(s)) return { ok: true, value: true }
      if (/^(false|0)$/i.test(s)) return { ok: true, value: false }
      return { ok: false, code: 'E_ENV_PARSE' }
    case 'ENUM':
      return k.enum?.includes(s) ? { ok: true, value: s } : { ok: false, code: 'E_ENV_PARSE' }
    case 'SECRET_REF':
      return isCredentialRef(s) ? { ok: true, value: s } : { ok: false, code: 'E_CONN_SECRET_VALUE' }
    case 'JSON':
      try {
        return { ok: true, value: JSON.parse(s) }
      } catch {
        return { ok: false, code: 'E_ENV_PARSE' }
      }
    default:
      return s.length > 0 && s.length <= 500 ? { ok: true, value: s } : { ok: false, code: 'E_ENV_PARSE' }
  }
}

/** ENVIRONMENT 층 — 스키마가 선언한 이름만 읽는다(임의 env 를 훑지 않는다). 시크릿 별칭은 값 대신 ref. */
export function environmentLayer(keys: SchemaKey[], ctx: { connectionKey: string; role: string; isRolePrimary: boolean }, env: NodeJS.ProcessEnv, warnings: Map<string, string[]>): Layer {
  const layer: Layer = new Map()
  const warn = (key: string, w: string) => warnings.set(key, [...(warnings.get(key) ?? []), w])
  for (const k of keys) {
    let found = false
    for (const name of envNamesFor(k, ctx)) {
      const raw = env[name]
      if (raw == null || raw.trim() === '') continue
      const p = parseEnvValue(k, raw)
      if (!p.ok) {
        warn(k.key, `${p.code}(${name})`)
        continue
      }
      layer.set(k.key, { value: p.value, sourceRef: `env:${name}` })
      found = true
      break
    }
    if (found || k.type !== 'SECRET_REF') continue
    for (const name of k.envSecretAlias ?? []) {
      const raw = env[name]
      if (raw != null && raw.trim() !== '') {
        layer.set(k.key, { value: `env:${name}`, sourceRef: `env:${name}` })
        break
      }
    }
  }
  return layer
}

function allowedIn(k: SchemaKey, src: ConfigSourceName): boolean {
  if (k.editability === 'READ_ONLY') return src === 'DEFAULT' || src === 'SOURCE_CODE' || src === 'APPLICATION_CONFIG' || src === 'ENVIRONMENT'
  if (src === 'RUNTIME_OVERRIDE') return k.editability === 'RUNTIME_EDITABLE'
  if (src === 'USER_SETTING') return k.userSettable === true
  return true
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * 순수 병합(단위 테스트 대상) — 스키마 키마다 낮은 층부터 쌓아 맨 위 값을 고른다.
 * `connectionType` 이 있으면 `appliesTo` 밖 키는 결과에서 빠지고, editability 는 `editabilityBy` 로 바뀐다.
 */
export function mergeLayers(keys: SchemaKey[], connectionType: string | null, layers: Layers, preWarnings: Map<string, string[]> = new Map()): { keys: EffectiveKey[]; warnings: string[] } {
  const applicable = keys.filter((k) => !k.appliesTo || !connectionType || k.appliesTo.includes(connectionType as never))
  const known = new Set(applicable.map((k) => k.key))
  const notApplicable = new Set(keys.filter((k) => !known.has(k.key)).map((k) => k.key))
  const top: string[] = []
  for (const src of SOURCE_ORDER) {
    for (const key of layers[src].keys()) {
      if (known.has(key)) continue
      if (!SAFE_KEY.test(key)) top.push(`W_UNKNOWN_KEY(<invalid>@${src})`)
      else top.push(`${notApplicable.has(key) ? 'W_NOT_APPLICABLE' : 'W_UNKNOWN_KEY'}(${key}@${src})`)
    }
  }

  const out: EffectiveKey[] = applicable.map((k) => {
    const warnings = [...(preWarnings.get(k.key) ?? [])]
    const stack: EffectiveKey['layers'] = []
    for (const src of SOURCE_ORDER) {
      const e = layers[src].get(k.key)
      if (!e) continue
      if (typeof e.value === 'string' && src !== 'ENVIRONMENT' && src !== 'DEFAULT') {
        const m = PLACEHOLDER.exec(e.value)
        if (m) {
          if (k.envAlias?.includes(m[1])) {
            warnings.push(`I_ENV_PLACEHOLDER(${m[1]}@${src})`)
            continue
          }
          warnings.push(`W_UNRESOLVED_PLACEHOLDER(@${src})`)
        }
      }
      if (!allowedIn(k, src)) {
        warnings.push(`W_IGNORED_${src}`)
        continue
      }
      if (k.type === 'SECRET_REF' && e.value !== null && !isCredentialRef(e.value)) {
        warnings.push(`E_CONN_SECRET_VALUE(@${src})`)
        continue
      }
      stack.push({ source: src, value: e.value, sourceRef: e.sourceRef })
    }
    const db = layers.DATABASE.get(k.key)
    const prof = layers.CONNECTION_PROFILE.get(k.key)
    if (db && prof && !same(db.value, prof.value)) warnings.push('W_DRIFT')
    // DEFAULT 는 모든 키가 갖는다(스키마 규칙). 층이 전부 거부되면 default 로.
    const winner = stack.at(-1) ?? { source: 'DEFAULT' as const, value: k.default, sourceRef: '' }
    for (const code of checkValue(k, winner.value)) warnings.push(code)
    const editability = (connectionType && k.editabilityBy?.[connectionType as never]) || k.editability
    return {
      key: k.key,
      type: k.type,
      value: winner.value,
      source: winner.source,
      sourceRef: winner.sourceRef,
      editability,
      restartRequired: k.restartRequired,
      secret: k.type === 'SECRET_REF',
      shadowed: stack.some((s) => !same(s.value, winner.value)),
      layers: stack,
      warnings,
    }
  })
  return { keys: out, warnings: top }
}

async function overrideLayer(environment: Environment, scope: ConfigScope, targetId: string, now: Date): Promise<Layer> {
  const rows = await prisma.runtimeOverride.findMany({
    where: { environment, scope, targetId, kind: 'TEMPORARY', revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  const layer: Layer = new Map()
  for (const r of rows) {
    const patch = r.patch && typeof r.patch === 'object' && !Array.isArray(r.patch) ? (r.patch as Record<string, unknown>) : {}
    for (const [k, v] of Object.entries(patch)) if (SAFE_KEY.test(k)) layer.set(k, { value: v, sourceRef: `db:RuntimeOverride[${r.id}] expires ${r.expiresAt.toISOString()}` })
  }
  return layer
}

async function versionLayer(environment: Environment, scope: ConfigScope, targetId: string, warnings: string[]): Promise<Layer> {
  const v = await prisma.configurationVersion.findFirst({ where: { environment, scope, targetId, status: 'ACTIVE' }, orderBy: { version: 'desc' } })
  const layer: Layer = new Map()
  if (!v || !v.snapshot || typeof v.snapshot !== 'object' || Array.isArray(v.snapshot)) return layer
  const snap = v.snapshot as Record<string, unknown>
  const ref = `db:ConfigurationVersion[${v.id}]`
  if ('connection' in snap || 'runtime' in snap) {
    flatten('connection', snap.connection, ref, layer, warnings)
    flatten('runtime', snap.runtime, ref, layer, warnings)
    if ('credentialRef' in snap) layer.set('connection.credentialRef', { value: snap.credentialRef ?? null, sourceRef: `${ref}.credentialRef` })
    if ('logLevel' in snap) layer.set('logging.level', { value: snap.logLevel, sourceRef: `${ref}.logLevel` })
  } else {
    for (const [k, val] of Object.entries(snap)) if (SAFE_KEY.test(k)) layer.set(k, { value: val, sourceRef: `${ref}.${k}` })
  }
  return layer
}

function finish(
  base: Omit<EffectiveConfiguration, 'keys' | 'emptyLayers' | 'warnings' | 'resolvedAt' | 'cacheHit'>,
  layers: Layers,
  merged: { keys: EffectiveKey[]; warnings: string[] },
  extraWarnings: string[],
): EffectiveConfiguration {
  return {
    ...base,
    resolvedAt: new Date().toISOString(),
    cacheHit: false,
    keys: merged.keys,
    emptyLayers: SOURCE_ORDER.filter((s) => layers[s].size === 0),
    warnings: [...new Set([...extraWarnings, ...merged.warnings])].slice(0, 100),
  }
}

async function resolveConnection(environment: Environment, row: EngineConnection): Promise<EffectiveConfiguration> {
  const provider = getProvider(row.engineId)
  if (!provider) throw new ConfigTargetNotFoundError()
  const schema = provider.configurationSchema()
  const warnings: string[] = []
  const pre = new Map<string, string[]>()
  const policy = await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment, role: row.role } }, select: { primaryConnectionId: true } })
  const layers = emptyLayers()
  for (const k of schema.keys) layers.DEFAULT.set(k.key, { value: k.default, sourceRef: `schema:${schema.engineId}@${schema.schemaVersion}#${k.key}` })
  for (const [k, e] of Object.entries(provider.sourceCodeLayer?.() ?? {})) layers.SOURCE_CODE.set(k, e)
  layers.ENVIRONMENT = environmentLayer(schema.keys, { connectionKey: row.key, role: row.role, isRolePrimary: policy?.primaryConnectionId === row.id }, process.env, pre)
  layers.DATABASE = await versionLayer(environment, 'ENGINE_CONNECTION', row.id, warnings)
  layers.CONNECTION_PROFILE = profileLayer(row, warnings, schema.keys.some((k) => k.key === 'connection.credentialRef'))
  layers.RUNTIME_OVERRIDE = await overrideLayer(environment, 'ENGINE_CONNECTION', row.id, new Date())
  const merged = mergeLayers(schema.keys, row.connectionType, layers, pre)
  return finish(
    { environment, scope: 'ENGINE_CONNECTION', targetId: row.id, targetKey: row.key, engineId: row.engineId, schemaVersion: schema.schemaVersion },
    layers,
    merged,
    warnings,
  )
}

const FALLBACK_SCHEMA: SchemaKey[] = [
  { key: 'primaryConnectionId', group: 'runtime', type: 'STRING', default: null, description: '1순위 connection', editability: 'RUNTIME_EDITABLE', restartRequired: false, strict: true },
  { key: 'fallbackConnectionIds', group: 'runtime', type: 'JSON', default: [], description: '폴백 connection 순서(≤4)', editability: 'RUNTIME_EDITABLE', restartRequired: false, strict: true },
  { key: 'retryOnce', group: 'runtime', type: 'BOOLEAN', default: true, description: '실패 시 다음 connection 으로 1회 재시도', editability: 'RUNTIME_EDITABLE', restartRequired: false, strict: true },
  { key: 'enabled', group: 'runtime', type: 'BOOLEAN', default: true, description: '정책 사용', editability: 'RUNTIME_EDITABLE', restartRequired: false, strict: true },
]

async function resolveFallback(environment: Environment, p: EngineFallbackPolicy): Promise<EffectiveConfiguration> {
  const layers = emptyLayers()
  for (const k of FALLBACK_SCHEMA) layers.DEFAULT.set(k.key, { value: k.default, sourceRef: `code:src/modules/engine/configuration/resolver.ts#FALLBACK_SCHEMA.${k.key}` })
  const ref = `db:EngineFallbackPolicy[${p.id}]`
  layers.DATABASE.set('primaryConnectionId', { value: p.primaryConnectionId, sourceRef: `${ref}.primaryConnectionId` })
  layers.DATABASE.set('fallbackConnectionIds', { value: p.fallbackConnectionIds, sourceRef: `${ref}.fallbackConnectionIds` })
  layers.DATABASE.set('retryOnce', { value: p.retryOnce, sourceRef: `${ref}.retryOnce` })
  layers.DATABASE.set('enabled', { value: p.enabled, sourceRef: `${ref}.enabled` })
  layers.RUNTIME_OVERRIDE = await overrideLayer(environment, 'FALLBACK_POLICY', p.id, new Date())
  const merged = mergeLayers(FALLBACK_SCHEMA, null, layers)
  return finish({ environment, scope: 'FALLBACK_POLICY', targetId: p.id, targetKey: p.role, engineId: null, schemaVersion: null }, layers, merged, [])
}

/**
 * `resolve(env, scope, targetId)` — ENGINE_CONNECTION(targetId = id 또는 key)·FALLBACK_POLICY(targetId = id 또는 역할 이름).
 * 다른 scope 는 Phase 2(PROMPT·APP_SETTING·VOICE_PROFILE — 각 층 소유 모듈의 공개 함수가 생긴 뒤). 캐시 없음(매 요청 해석, cacheHit=false).
 */
export async function resolveEffective(input: { environment: Environment; scope: ConfigScope; targetId: string }): Promise<EffectiveConfiguration> {
  const { environment, scope, targetId } = input
  if (!targetId || targetId.length > 80) throw new ConfigTargetNotFoundError()
  if (scope === 'ENGINE_CONNECTION') {
    const byId = await prisma.engineConnection.findUnique({ where: { id: targetId } })
    const row = byId && byId.environment === environment ? byId : await prisma.engineConnection.findUnique({ where: { environment_key: { environment, key: targetId } } })
    if (!row) throw new ConfigTargetNotFoundError()
    return resolveConnection(environment, row)
  }
  if (scope === 'FALLBACK_POLICY') {
    const byId = await prisma.engineFallbackPolicy.findUnique({ where: { id: targetId } })
    const roles = ['REALTIME_STT', 'ANALYSIS_STT', 'TTS', 'LLM'] as const
    const p =
      byId && byId.environment === environment
        ? byId
        : (roles as readonly string[]).includes(targetId)
          ? await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment, role: targetId as (typeof roles)[number] } } })
          : null
    if (!p) throw new ConfigTargetNotFoundError()
    return resolveFallback(environment, p)
  }
  throw new UnsupportedScopeError(scope)
}

/** Health·Functional 이 쓰는 평면 값(키 → Effective 값). */
export function effectiveValues(eff: EffectiveConfiguration): Record<string, unknown> {
  return Object.fromEntries(eff.keys.map((k) => [k.key, k.value]))
}
