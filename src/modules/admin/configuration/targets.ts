/**
 * 설정 편집 대상(L0 조합, task-012c) — scope 마다 "지금 저장값(평면)·편집 키·잠금·물화·스냅샷·출처" 를 소유 층 함수로 묶는다.
 *   ENGINE_CONNECTION → engine(connections) · FALLBACK_POLICY → engine(fallbackPolicy) · APP_SETTING → preferences(AppSetting)
 * engine 은 preferences·speech 를 모르므로(module-dependency 규칙 6) AppSetting·목소리 확인은 여기서 조합한다.
 * VOICE_PROFILE 은 환경 칸 없는 전역 행이라 012c-2 로 이관(D-C14).
 */
import {
  APP_SETTING_SCHEMA,
  appSettingKeyDefs,
  applyConnectionPatch,
  applyFallbackPatch,
  connectionFlat,
  connectionFromSnapshot,
  connectionKeyDefs,
  connectionManaged,
  connectionSnapshot,
  connectionsByIds,
  DEFAULT_VOICE_KEY,
  enabledPoliciesUsingAsPrimary,
  fallbackFlat,
  fallbackFromSnapshot,
  fallbackManaged,
  fallbackSnapshot,
  FALLBACK_KEY_DEFS,
  getConfigurationSchema,
  getConnection,
  getFallbackPolicy,
  getFallbackPolicyById,
  getProvider,
  isPlainObject,
  lockConnectionForUpdate,
  lockFallbackPolicyForUpdate,
  resolveConnectionCandidate,
  resolveEffective,
  snapshotMeta,
  writeConnectionConfig,
  writeFallbackPolicy,
  type ConnectionManaged,
  type EditKeyDef,
  type EffectiveConfiguration,
  type FallbackManaged,
  type KeySource,
  type SnapshotParse,
  type ValidationIssue,
  type VersionMeta,
} from '@/modules/engine'
import { lockAppSettingForUpdate, readAppSettingRow, writeAppSetting, type AppSettingRow } from '@/modules/preferences'
import { loadTtsVoice } from '@/modules/speech'
import type { Tx } from '@/modules/infra'
import type { EngineConnection, EngineFallbackPolicy, EngineRole, Environment } from '@prisma/client'
import type { ConfigEditScopeName } from '@/types/admin'

export const EDIT_SCOPES: readonly ConfigEditScopeName[] = ['ENGINE_CONNECTION', 'FALLBACK_POLICY', 'APP_SETTING']
const ROLES: readonly EngineRole[] = ['REALTIME_STT', 'ANALYSIS_STT', 'TTS', 'LLM']

interface Base {
  environment: Environment
  targetId: string
  targetKey: string
  targetName: string
  defs: EditKeyDef[]
  /** 지금 저장값(평면, 관리 층). */
  stored: Record<string, unknown>
  schemaVersion: number | null
}

export type EditTarget =
  | (Base & { scope: 'ENGINE_CONNECTION'; row: EngineConnection; managed: ConnectionManaged })
  | (Base & { scope: 'FALLBACK_POLICY'; row: EngineFallbackPolicy; managed: FallbackManaged })
  | (Base & { scope: 'APP_SETTING'; row: AppSettingRow | null })

function fromConnection(environment: Environment, row: EngineConnection): EditTarget | null {
  const schema = getConfigurationSchema(row.engineId)
  if (!schema) return null
  const managed = connectionManaged(row)
  return {
    scope: 'ENGINE_CONNECTION',
    environment,
    targetId: row.id,
    targetKey: row.key,
    targetName: row.name,
    defs: connectionKeyDefs(schema, row.connectionType),
    stored: connectionFlat(managed),
    schemaVersion: schema.schemaVersion,
    row,
    managed,
  }
}

function fromPolicy(environment: Environment, p: EngineFallbackPolicy): EditTarget {
  const managed = fallbackManaged(p)
  return { scope: 'FALLBACK_POLICY', environment, targetId: p.id, targetKey: p.role, targetName: p.role, defs: [...FALLBACK_KEY_DEFS], stored: fallbackFlat(managed), schemaVersion: 1, row: p, managed }
}

function fromSetting(environment: Environment, key: string, row: AppSettingRow | null): EditTarget | null {
  const defs = appSettingKeyDefs(key)
  if (!defs) return null
  return { scope: 'APP_SETTING', environment, targetId: key, targetKey: key, targetName: key, defs, stored: { value: row ? row.value : defs[0].default }, schemaVersion: 1, row }
}

/** 대상 읽기(잠금 없음). 없거나 다른 환경이면 null(호출자가 404). ENGINE_CONNECTION 은 id·key, FALLBACK_POLICY 는 id·역할 이름을 받는다. */
export async function loadEditTarget(scope: ConfigEditScopeName, environment: Environment, targetId: string): Promise<EditTarget | null> {
  if (!targetId || targetId.length > 120) return null
  if (scope === 'ENGINE_CONNECTION') {
    const row = await getConnection(environment, targetId)
    return row ? fromConnection(environment, row) : null
  }
  if (scope === 'FALLBACK_POLICY') {
    const p = (ROLES as readonly string[]).includes(targetId) ? (await getFallbackPolicy(environment, targetId as EngineRole))?.policy : await getFallbackPolicyById(environment, targetId)
    return p ? fromPolicy(environment, p) : null
  }
  if (!APP_SETTING_SCHEMA[targetId]) return null
  return fromSetting(environment, targetId, await readAppSettingRow(environment, targetId))
}

/** 같은 트랜잭션에서 대상 행을 잠그고 다시 읽는다(행 없는 AppSetting 은 잠글 행이 없다 — 생성 경합은 PK·버전 유니크가 막는다). */
export async function lockEditTarget(tx: Tx, t: EditTarget): Promise<EditTarget | null> {
  if (t.scope === 'ENGINE_CONNECTION') {
    const row = await lockConnectionForUpdate(tx, t.targetId)
    return row && row.environment === t.environment ? fromConnection(t.environment, row) : null
  }
  if (t.scope === 'FALLBACK_POLICY') {
    const p = await lockFallbackPolicyForUpdate(tx, t.targetId)
    return p && p.environment === t.environment ? fromPolicy(t.environment, p) : null
  }
  return fromSetting(t.environment, t.targetId, await lockAppSettingForUpdate(tx, t.environment, t.targetId))
}

/** AppSetting 대상을 트랜잭션 안에서 잠가 읽는다(파생 적용 — 미리듣기 문장 → textVersion). */
export async function lockSettingTarget(tx: Tx, environment: Environment, key: string): Promise<EditTarget | null> {
  return fromSetting(environment, key, await lockAppSettingForUpdate(tx, environment, key))
}

/** 평면 후보 → 스냅샷(관리 층 전체 + `_meta`). APP_SETTING 은 `{value, exists}`. */
export function snapshotOf(t: EditTarget, flat: Readonly<Record<string, unknown>>, meta: VersionMeta, opts: { exists?: boolean } = {}): Record<string, unknown> {
  if (t.scope === 'ENGINE_CONNECTION') return connectionSnapshot(applyConnectionPatch(t.managed, diffFlat(t.stored, flat)), meta)
  if (t.scope === 'FALLBACK_POLICY') return fallbackSnapshot(applyFallbackPatch(t.managed, flat), meta)
  return { value: flat.value ?? null, exists: opts.exists ?? true, _meta: meta }
}

/** 기준선(지금 저장값 그대로). */
export function baselineSnapshot(t: EditTarget): Record<string, unknown> {
  const meta: VersionMeta = { schemaVersion: t.schemaVersion, origin: 'BASELINE' }
  if (t.scope === 'ENGINE_CONNECTION') return connectionSnapshot(t.managed, meta)
  if (t.scope === 'FALLBACK_POLICY') return fallbackSnapshot(t.managed, meta)
  return { value: t.stored.value ?? null, exists: t.row !== null, _meta: meta }
}

function diffFlat(stored: Readonly<Record<string, unknown>>, flat: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(flat)) if (JSON.stringify(stored[k]) !== JSON.stringify(v)) out[k] = v
  return out
}

/** 스냅샷 → 평면 값(모양 엄격 검사). APP_SETTING 은 `exists` 도 돌려준다. */
export function flatFromSnapshot(t: EditTarget, snapshot: unknown): SnapshotParse<{ flat: Record<string, unknown>; exists: boolean }> {
  if (t.scope === 'ENGINE_CONNECTION') {
    const p = connectionFromSnapshot(snapshot)
    return p.ok ? { ok: true, value: { flat: connectionFlat(p.value), exists: true }, meta: p.meta } : p
  }
  if (t.scope === 'FALLBACK_POLICY') {
    const p = fallbackFromSnapshot(snapshot)
    return p.ok ? { ok: true, value: { flat: fallbackFlat(p.value), exists: true }, meta: p.meta } : p
  }
  if (!isPlainObject(snapshot) || !('value' in snapshot)) return { ok: false, problem: '스냅샷에 value 가 없습니다' }
  const exists = snapshot.exists !== false
  const def = t.defs[0]
  return { ok: true, value: { flat: { value: exists ? snapshot.value : def.default }, exists }, meta: snapshotMeta(snapshot) }
}

/** 물화 — 소유 층 tx 쓰기. `exists:false`(APP_SETTING 되돌리기의 "행 없음" 기준선)면 행을 지운다. */
export async function materialize(tx: Tx, t: EditTarget, candidate: Readonly<Record<string, unknown>>, opts: { exists?: boolean } = {}): Promise<void> {
  if (t.scope === 'ENGINE_CONNECTION') {
    const next = applyConnectionPatch(t.managed, diffFlat(t.stored, candidate))
    await writeConnectionConfig(tx, t.targetId, t.row, next)
    return
  }
  if (t.scope === 'FALLBACK_POLICY') {
    await writeFallbackPolicy(tx, t.targetId, applyFallbackPatch(t.managed, candidate))
    return
  }
  const def = APP_SETTING_SCHEMA[t.targetId]
  if (opts.exists === false) await writeAppSetting(tx, t.environment, t.targetId, { exists: false })
  else await writeAppSetting(tx, t.environment, t.targetId, { exists: true, value: candidate.value ?? null, description: def?.description ?? null, editability: def?.editability ?? 'RUNTIME_EDITABLE' })
}

/** 후보 연결 관리 값(config/test·Diff after 용). */
export function candidateConnection(t: Extract<EditTarget, { scope: 'ENGINE_CONNECTION' }>, candidate: Readonly<Record<string, unknown>>): ConnectionManaged {
  return applyConnectionPatch(t.managed, diffFlat(t.stored, candidate))
}

function sources(eff: EffectiveConfiguration): Record<string, KeySource> {
  return Object.fromEntries(eff.keys.map((k) => [k.key, { value: k.value, source: k.source }]))
}

/** Diff 의 before/after Effective(키 → 값·출처). */
export async function effectiveSources(t: EditTarget, candidate: Readonly<Record<string, unknown>>): Promise<{ before: Record<string, KeySource>; after: Record<string, KeySource> }> {
  if (t.scope === 'ENGINE_CONNECTION') {
    const [before, after] = await Promise.all([
      resolveEffective({ environment: t.environment, scope: 'ENGINE_CONNECTION', targetId: t.targetId }),
      resolveConnectionCandidate(t.environment, t.row, candidateConnection(t, candidate)),
    ])
    const b = sources(before)
    const a = sources(after)
    // 행 칸 `enabled` 은 스키마 키가 아니라 Effective 에 없다 — 저장값이 곧 실효값.
    b.enabled = { value: t.stored.enabled, source: 'CONNECTION_PROFILE' }
    a.enabled = { value: candidate.enabled, source: 'CONNECTION_PROFILE' }
    return { before: b, after: a }
  }
  if (t.scope === 'FALLBACK_POLICY') {
    const before = sources(await resolveEffective({ environment: t.environment, scope: 'FALLBACK_POLICY', targetId: t.targetId }))
    const after: Record<string, KeySource> = {}
    for (const [k, v] of Object.entries(candidate)) after[k] = before[k]?.source === 'RUNTIME_OVERRIDE' ? before[k] : { value: v, source: 'DATABASE' }
    return { before, after }
  }
  return {
    before: { value: { value: t.stored.value, source: t.row ? 'DATABASE' : 'DEFAULT' } },
    after: { value: { value: candidate.value, source: 'DATABASE' } },
  }
}

/** Fallback 후보가 참조하는 연결 id(주 연결 + 예비, 문자열만). 트랜잭션에서 이 id 들을 먼저 잠근다. */
export function fallbackReferencedIds(candidate: Readonly<Record<string, unknown>>): string[] {
  const fallbacks = Array.isArray(candidate.fallbackConnectionIds) ? candidate.fallbackConnectionIds : []
  return [candidate.primaryConnectionId, ...fallbacks].filter((x): x is string => typeof x === 'string')
}

/**
 * Fallback 후보의 참조 규칙 — 같은 환경에 있는가·같은 역할인가·켜져 있는가·중복·4개 상한. Validate(트랜잭션 밖)와
 * `commitEdit` 트랜잭션 안(연결 행을 잠근 뒤 `tx` 로 다시)에서 같은 함수를 쓴다(task-012c Codex C2 ②).
 */
export async function fallbackDependencyIssues(
  t: Extract<EditTarget, { scope: 'FALLBACK_POLICY' }>,
  candidate: Readonly<Record<string, unknown>>,
  db?: Tx,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const primary = candidate.primaryConnectionId
  const fallbacks = candidate.fallbackConnectionIds
  if (!Array.isArray(fallbacks) || !fallbacks.every((x) => typeof x === 'string')) return [{ key: 'fallbackConnectionIds', rule: 'type', message: '예비 연결은 연결 id 목록이어야 합니다.' }]
  if (fallbacks.length > 4) issues.push({ key: 'fallbackConnectionIds', rule: 'max', message: '예비 연결은 4개까지입니다.', expected: 4, actual: fallbacks.length })
  const all = [primary as string, ...(fallbacks as string[])]
  if (new Set(all).size !== all.length) issues.push({ key: 'fallbackConnectionIds', rule: 'dependency', message: '같은 연결을 두 번 넣을 수 없습니다(주 연결 포함).' })
  const rows = await connectionsByIds(t.environment, all.filter((x): x is string => typeof x === 'string'), db)
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const [i, id] of all.entries()) {
    const key = i === 0 ? 'primaryConnectionId' : 'fallbackConnectionIds'
    const r = byId.get(id)
    if (!r) issues.push({ key, rule: 'reference', message: '같은 환경에 없는 연결입니다.', related: [id] })
    else if (r.role !== t.row.role) issues.push({ key, rule: 'dependency', message: `다른 역할(${r.role})의 연결입니다.`, related: [r.key] })
    else if (!r.enabled) issues.push({ key, rule: 'dependency', message: '꺼진 연결은 넣을 수 없습니다(연결 상세에서 먼저 켜기).', related: [r.key] })
  }
  return issues
}

/** 대상 종류별 교차 규칙(Validate DEPENDENCY). */
export function dependencyHook(t: EditTarget): (candidate: Readonly<Record<string, unknown>>, changed: readonly string[]) => Promise<ValidationIssue[]> {
  return async (candidate, changed) => {
    const issues: ValidationIssue[] = []
    if (t.scope === 'FALLBACK_POLICY') return fallbackDependencyIssues(t, candidate)
    if (t.scope === 'ENGINE_CONNECTION') {
      if (changed.includes('enabled') && candidate.enabled === false) {
        const roles = await enabledPoliciesUsingAsPrimary(t.environment, t.targetId)
        if (roles.length) issues.push({ key: 'enabled', rule: 'dependency', message: `켜진 대체 정책(${roles.join(', ')})의 주 연결이라 끌 수 없습니다.`, related: ['PRIMARY_IN_USE', ...roles] })
      }
      return issues
    }
    if (t.targetId === DEFAULT_VOICE_KEY && changed.includes('value') && typeof candidate.value === 'string') {
      if (!(await loadTtsVoice(candidate.value))) issues.push({ key: 'value', rule: 'reference', message: '쓸 수 있는(활성) 목소리가 아닙니다.' })
    }
    return issues
  }
}

/** 대상이 LLM·TTS 등 어떤 역할의 연결인지(표시·검증 계획용). */
export function providerTypeOf(t: EditTarget): 'LLM' | 'TTS' | 'STT' | null {
  if (t.scope !== 'ENGINE_CONNECTION') return null
  return getProvider(t.row.engineId)?.descriptor.type ?? null
}
