/**
 * 설정 대상의 "관리 층 값" 모양(engine 소유 행 — EngineConnection·EngineFallbackPolicy). 평면 키(점 표기) ↔ 행 칸·JSON 을 오간다.
 * `ConfigurationVersion.snapshot` = 관리 층 값 전체 + 예약 키 `_meta{schemaVersion, origin}`(D-C2 — 물화·Diff 에서 제외).
 *
 * EngineConnection 평면 키: `connection.*`(connection JSON) · `runtime.*`(runtime JSON) · `connection.credentialRef`(칸) · `logging.level`(칸 logLevel) · `enabled`(칸).
 * 스냅샷 모양은 Resolver DATABASE 층이 읽는 모양과 같다(`{connection, runtime, credentialRef, logLevel, …}`).
 */
import type { EngineConnection, EngineFallbackPolicy } from '@prisma/client'

export type VersionOrigin = 'BASELINE' | 'APPLY' | 'RAW_JSON' | 'ROLLBACK'
export interface VersionMeta {
  schemaVersion: number | null
  origin: VersionOrigin
}

const SEG = /^[\w-]{1,60}$/
const MAX_DEPTH = 6

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v)
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

/** 중첩 객체 → 점 표기(배열은 값 그대로, 깊이 6). 이상한 세그먼트는 버린다. */
export function flattenObject(prefix: string, obj: unknown, out: Record<string, unknown> = {}, depth = 0): Record<string, unknown> {
  if (!isPlainObject(obj)) return out
  for (const [seg, v] of Object.entries(obj)) {
    if (!SEG.test(seg)) continue
    const k = prefix ? `${prefix}.${seg}` : seg
    if (isPlainObject(v) && depth < MAX_DEPTH) flattenObject(k, v, out, depth + 1)
    else out[k] = v
  }
  return out
}

function setPath(obj: Record<string, unknown>, segs: string[], value: unknown): void {
  let cur = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const next = cur[segs[i]]
    if (!isPlainObject(next)) cur[segs[i]] = {}
    cur = cur[segs[i]] as Record<string, unknown>
  }
  cur[segs[segs.length - 1]] = value
}

// ── EngineConnection ────────────────────────────────────────────────────

export interface ConnectionManaged {
  connection: Record<string, unknown>
  runtime: Record<string, unknown>
  credentialRef: string | null
  logLevel: string
  enabled: boolean
}

export function connectionManaged(row: Pick<EngineConnection, 'connection' | 'runtime' | 'credentialRef' | 'logLevel' | 'enabled'>): ConnectionManaged {
  return {
    connection: isPlainObject(row.connection) ? clone(row.connection) : {},
    runtime: isPlainObject(row.runtime) ? clone(row.runtime) : {},
    credentialRef: row.credentialRef ?? null,
    logLevel: row.logLevel,
    enabled: row.enabled,
  }
}

export function connectionFlat(m: ConnectionManaged): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const conn = { ...m.connection }
  delete conn.credentialRef
  flattenObject('connection', conn, out)
  flattenObject('runtime', m.runtime, out)
  out['connection.credentialRef'] = m.credentialRef
  out['logging.level'] = m.logLevel
  out.enabled = m.enabled
  return out
}

/** 평면 patch 를 관리 값에 겹친다(원본 불변). 알 수 없는 접두 키는 무시(검증이 먼저 막는다). */
export function applyConnectionPatch(m: ConnectionManaged, patch: Readonly<Record<string, unknown>>): ConnectionManaged {
  const next: ConnectionManaged = { ...m, connection: clone(m.connection), runtime: clone(m.runtime) }
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'connection.credentialRef') next.credentialRef = (value as string | null) ?? null
    else if (key === 'logging.level') next.logLevel = String(value)
    else if (key === 'enabled') next.enabled = value === true
    else if (key.startsWith('connection.')) setPath(next.connection, key.slice(11).split('.'), clone(value))
    else if (key.startsWith('runtime.')) setPath(next.runtime, key.slice(8).split('.'), clone(value))
  }
  return next
}

export function connectionSnapshot(m: ConnectionManaged, meta: VersionMeta): Record<string, unknown> {
  return { connection: clone(m.connection), runtime: clone(m.runtime), credentialRef: m.credentialRef, logLevel: m.logLevel, enabled: m.enabled, _meta: meta }
}

export type SnapshotParse<T> = { ok: true; value: T; meta: VersionMeta | null } | { ok: false; problem: string }

function parseMeta(raw: unknown): VersionMeta | null {
  if (!isPlainObject(raw)) return null
  const origin = raw.origin
  if (origin !== 'BASELINE' && origin !== 'APPLY' && origin !== 'RAW_JSON' && origin !== 'ROLLBACK') return null
  return { schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : null, origin }
}

/** 스냅샷 → 관리 값(모양만 엄격 검사 — 값 규칙은 rollback 재검증). */
export function connectionFromSnapshot(raw: unknown): SnapshotParse<ConnectionManaged> {
  if (!isPlainObject(raw)) return { ok: false, problem: '스냅샷이 객체가 아닙니다' }
  if (!isPlainObject(raw.connection) || !isPlainObject(raw.runtime)) return { ok: false, problem: 'connection·runtime 객체가 없습니다' }
  if (raw.credentialRef !== null && typeof raw.credentialRef !== 'string') return { ok: false, problem: 'credentialRef 형식' }
  if (typeof raw.logLevel !== 'string' || typeof raw.enabled !== 'boolean') return { ok: false, problem: 'logLevel·enabled 형식' }
  return {
    ok: true,
    value: { connection: clone(raw.connection), runtime: clone(raw.runtime), credentialRef: (raw.credentialRef as string | null) ?? null, logLevel: raw.logLevel, enabled: raw.enabled },
    meta: parseMeta(raw._meta),
  }
}

// ── EngineFallbackPolicy ─────────────────────────────────────────────────

export interface FallbackManaged {
  primaryConnectionId: string
  fallbackConnectionIds: string[]
  retryOnce: boolean
  enabled: boolean
}

export function fallbackManaged(p: Pick<EngineFallbackPolicy, 'primaryConnectionId' | 'fallbackConnectionIds' | 'retryOnce' | 'enabled'>): FallbackManaged {
  return {
    primaryConnectionId: p.primaryConnectionId,
    fallbackConnectionIds: Array.isArray(p.fallbackConnectionIds) ? (p.fallbackConnectionIds as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    retryOnce: p.retryOnce,
    enabled: p.enabled,
  }
}

export function fallbackFlat(m: FallbackManaged): Record<string, unknown> {
  return { primaryConnectionId: m.primaryConnectionId, fallbackConnectionIds: [...m.fallbackConnectionIds], retryOnce: m.retryOnce, enabled: m.enabled }
}

export function applyFallbackPatch(m: FallbackManaged, patch: Readonly<Record<string, unknown>>): FallbackManaged {
  const next: FallbackManaged = { ...m, fallbackConnectionIds: [...m.fallbackConnectionIds] }
  if (typeof patch.primaryConnectionId === 'string') next.primaryConnectionId = patch.primaryConnectionId
  if (Array.isArray(patch.fallbackConnectionIds)) next.fallbackConnectionIds = patch.fallbackConnectionIds.filter((x): x is string => typeof x === 'string')
  if (typeof patch.retryOnce === 'boolean') next.retryOnce = patch.retryOnce
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
  return next
}

export function fallbackSnapshot(m: FallbackManaged, meta: VersionMeta): Record<string, unknown> {
  return { ...fallbackFlat(m), _meta: meta }
}

export function fallbackFromSnapshot(raw: unknown): SnapshotParse<FallbackManaged> {
  if (!isPlainObject(raw)) return { ok: false, problem: '스냅샷이 객체가 아닙니다' }
  const ids = raw.fallbackConnectionIds
  if (typeof raw.primaryConnectionId !== 'string' || !Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) return { ok: false, problem: 'primary·fallback 형식' }
  if (typeof raw.retryOnce !== 'boolean' || typeof raw.enabled !== 'boolean') return { ok: false, problem: 'retryOnce·enabled 형식' }
  return { ok: true, value: { primaryConnectionId: raw.primaryConnectionId, fallbackConnectionIds: [...(ids as string[])], retryOnce: raw.retryOnce, enabled: raw.enabled }, meta: parseMeta(raw._meta) }
}

/** 스냅샷의 `_meta`(없거나 형식이 틀리면 null). */
export function snapshotMeta(raw: unknown): VersionMeta | null {
  return isPlainObject(raw) ? parseMeta(raw._meta) : null
}
