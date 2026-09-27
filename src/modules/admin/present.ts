/**
 * 콘솔 응답 DTO 변환(`@/types/admin`) — **여기를 지나야만 응답이 된다**. 모든 저장값은 마스킹을 거친다:
 * 시크릿 형태 문자열 → `***`(infra.maskSensitive), credentialRef 는 이름만, 서버 절대 경로 → `…/<basename>`, Trace 단계는 원시값·짧은 문자열만.
 */
import { isCredentialRef, maskSensitive, maskString } from '@/modules/infra'
import type { EffectiveConfiguration, EngineConnectionRow, FallbackPolicyView, FallbackRoles } from '@/modules/engine'
import type { EngineConnection, EngineHealth, RequestTrace } from '@prisma/client'
import type {
  AdminEnvironment,
  ConnectionRefDto,
  EffectiveConfigDto,
  EffectiveKeyDto,
  EngineConnectionDto,
  FallbackPolicyDto,
  HealthDetailDto,
  HealthDto,
  TraceDetailDto,
  TraceListItemDto,
  TraceStepDto,
} from '@/types/admin'

const PATH_KEY = /^(binPath|bin|cwd|agentsFile)$|Dir$/
const SERVER_PATH = /(^|[\s"'=:(,])(~\/|\/(home|Users|root|opt|var|etc|tmp|mnt|srv|usr|private|Volumes|data|apps)\/)/
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

/** 서버 절대 경로(`/…`·`~/…`)는 파일 이름만 남긴다(task-005b G6·H1: 서버 경로 비노출). */
export function maskPath(v: string): string {
  if (!/^(\/|~\/)/.test(v)) return v
  const base = v.split('/').filter(Boolean).at(-1) ?? ''
  return `…/${base}`
}

/** 어떤 문자열이든 서버 경로처럼 보이는 부분이 있으면 가린다 — 통째로 경로면 파일 이름만, 섞여 있으면 `***`. */
export function scrubServerPath(v: string): string {
  if (!SERVER_PATH.test(v)) return v
  return /^(\/|~\/)\S*$/.test(v) ? maskPath(v) : '***'
}

function deep(value: unknown, fn: (s: string, key: string | null) => string, key: string | null = null, depth = 0): unknown {
  if (typeof value === 'string') return fn(value, key)
  if (depth > 8 || !value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => deep(v, fn, key, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deep(v, fn, k, depth + 1)
  return out
}

/** 응답 값 공통 처리: 시크릿 마스킹 → 경로 성격 키의 절대 경로 → 그 밖의 서버 경로. */
export function displayAny(v: unknown, opts: { pathTyped?: boolean } = {}): unknown {
  return deep(maskSensitive(v), (s, key) => (opts.pathTyped || (key && PATH_KEY.test(key)) ? maskPath(scrubServerPath(s)) : scrubServerPath(s)))
}

/** 저장 JSON(connection·runtime)을 콘솔에 보일 모양으로. */
export function displayJson(v: unknown): Record<string, unknown> {
  const obj = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  return displayAny(obj) as Record<string, unknown>
}

/** Effective 값 한 개(타입이 PATH 면 절대 경로를 파일 이름만). */
export function displayValue(v: unknown, type?: string): unknown {
  return displayAny(v, { pathTyped: type === 'PATH' })
}

const safeText = (s: string) => scrubServerPath(maskString(s))

export function connectionRef(c: EngineConnection | null | undefined): ConnectionRefDto | null {
  return c ? { id: c.id, key: c.key, name: c.name, status: c.status, enabled: c.enabled } : null
}

export function connectionDto(c: EngineConnectionRow, extra: { engineName: string; version: number | null; roles: FallbackRoles | undefined }): EngineConnectionDto {
  return {
    id: c.id,
    key: c.key,
    environment: c.environment,
    engineId: c.engineId,
    engineName: extra.engineName,
    name: c.name,
    role: c.role,
    connectionType: c.connectionType,
    enabled: c.enabled,
    connection: displayJson(c.connection),
    runtime: displayJson(c.runtime),
    // ref 형식이 아니면(평문 의심) 무엇이든 가린다.
    credentialRef: c.credentialRef ? (isCredentialRef(c.credentialRef) ? c.credentialRef : '***') : null,
    logLevel: c.logLevel,
    status: c.status,
    statusReason: c.statusReason ? safeText(c.statusReason) : null,
    lastHealthAt: iso(c.lastHealthAt),
    lastFunctionalAt: iso(c.lastFunctionalAt),
    version: extra.version,
    fallbackRole: extra.roles ?? { primaryOf: [], fallbackOf: [] },
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

const DETAIL_STR = ['errorCode', 'message', 'version', 'device', 'serviceEnv', 'reason', 'model'] as const
const DETAIL_NUM = ['httpStatus', 'models', 'memoryMb', 'outputChars', 'attempts'] as const
const DETAIL_BOOL = ['skipped', 'schemaValid'] as const

/** DB detail JSON 을 화이트리스트 필드로만(저장 당시 어긋난 키가 있어도 응답에 안 나간다). */
export function healthDetail(raw: unknown): HealthDetailDto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of DETAIL_STR) if (typeof r[k] === 'string') out[k] = safeText((r[k] as string).slice(0, 200))
  for (const k of DETAIL_NUM) if (typeof r[k] === 'number' && Number.isFinite(r[k])) out[k] = r[k]
  for (const k of DETAIL_BOOL) if (typeof r[k] === 'boolean') out[k] = r[k]
  return out as HealthDetailDto
}

export function healthDto(h: EngineHealth, connectionKey: string): HealthDto {
  return {
    id: h.id,
    connectionId: h.connectionId,
    connectionKey,
    kind: h.kind,
    ok: h.ok,
    status: h.status,
    latencyMs: h.latencyMs,
    detail: healthDetail(h.detail),
    traceId: h.traceId,
    checkedAt: h.checkedAt.toISOString(),
  }
}

export function fallbackDto(v: FallbackPolicyView, version: number | null): FallbackPolicyDto {
  return {
    id: v.policy.id,
    environment: v.policy.environment,
    role: v.policy.role,
    primary: connectionRef(v.primary),
    fallbacks: v.fallbacks.map((f) => connectionRef(f)!),
    retryOnce: v.policy.retryOnce,
    enabled: v.policy.enabled,
    version,
    effectiveOrder: v.effectiveOrder.map((c) => c.key),
  }
}

// ── Effective ────────────────────────────────────────────────────────────────

/** 경고에서 괄호 안(환경 변수 이름·키 이름)을 뺀 코드만 — ADMIN 요약용. */
const codeOnly = (w: string) => w.replace(/\(.*\)$/, '')

export function effectiveDto(
  eff: EffectiveConfiguration,
  opts: { full: boolean; secretExists: (ref: string) => boolean },
): EffectiveConfigDto {
  const keys: EffectiveKeyDto[] = eff.keys.map((k) => {
    const base: EffectiveKeyDto = {
      key: k.key,
      value: displayValue(k.value, k.type),
      source: k.source,
      editability: k.editability,
      restartRequired: k.restartRequired,
      secret: k.secret,
      shadowed: k.shadowed,
      ...(k.secret ? { exists: typeof k.value === 'string' ? opts.secretExists(k.value) : false } : {}),
    }
    if (opts.full) {
      base.sourceRef = k.sourceRef
      base.layers = k.layers.map((l) => ({ source: l.source, value: displayValue(l.value, k.type), sourceRef: l.sourceRef }))
      if (k.warnings.length) base.warnings = k.warnings
    } else if (k.warnings.length) {
      base.warnings = [...new Set(k.warnings.map(codeOnly))]
    }
    return base
  })
  return {
    environment: eff.environment as AdminEnvironment,
    scope: eff.scope,
    targetId: eff.targetId,
    targetKey: eff.targetKey,
    engineId: eff.engineId,
    schemaVersion: eff.schemaVersion,
    resolvedAt: eff.resolvedAt,
    cacheHit: eff.cacheHit,
    detail: opts.full ? 'FULL' : 'SUMMARY',
    keys,
    emptyLayers: eff.emptyLayers,
    warnings: opts.full ? eff.warnings : [...new Set(eff.warnings.map(codeOnly))],
  }
}

// ── Trace ────────────────────────────────────────────────────────────────────

/** 단계 한 개 — 원시값만, 문자열은 120자 이하·마스킹(본문 유사 문자열 차단). 중첩 객체는 버린다. */
export function traceStep(raw: unknown): TraceStepDto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: TraceStepDto = { name: '' }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Za-z][\w[\]]{0,40}$/.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean' || v === null) out[k] = v
    else if (typeof v === 'string' && v.length <= 120) out[k] = safeText(v)
  }
  return typeof out.name === 'string' && out.name ? out : null
}

function steps(raw: unknown): TraceStepDto[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 50).map(traceStep).filter((s): s is TraceStepDto => s !== null)
}

const maskUser = (id: string | null) => (id ? `${id.slice(0, 4)}…` : null)

export function traceListItem(t: RequestTrace): TraceListItemDto {
  return {
    traceId: t.traceId,
    kind: t.kind,
    status: t.status,
    totalMs: t.totalMs,
    errorCode: t.errorCode,
    refType: t.refType,
    refId: t.refId,
    userId: maskUser(t.userId),
    stepNames: steps(t.steps).map((s) => s.name),
    createdAt: t.createdAt.toISOString(),
  }
}

export function traceDetail(t: RequestTrace): TraceDetailDto {
  return {
    traceId: t.traceId,
    environment: t.environment,
    kind: t.kind,
    status: t.status,
    totalMs: t.totalMs,
    errorCode: t.errorCode,
    refType: t.refType,
    refId: t.refId,
    userId: maskUser(t.userId),
    debugSessionId: t.debugSessionId,
    createdAt: t.createdAt.toISOString(),
    steps: steps(t.steps),
    captured: null,
  }
}
