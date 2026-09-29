/**
 * 설정 편집 L0 조합(task-012c — api-contract §2-19·§2-21·§2-23·#123b, configuration-resolution §6·§8). 라우트는 얇게, 여기서:
 *   capability(대상 행 환경 기준 PRODUCTION 추가) · 교차 환경 · 입력(scope·targetId·patch·baseVersion·reason) · Validate/Diff/Test ·
 *   PRODUCTION 게이트(confirm "PRODUCTION" · 무상태 summaryHash · testResultId(EngineHealth, 30분·같은 대상·같은 후보·testedKeys ⊇ 변경 키) ·
 *   reason 10~200 · SUPER_ADMIN) · `infra.withTransaction` 하나에서 대상 행 잠금 → baseVersion → (첫 적용) 기준선 v1 → 물화(소유 층) → 버전 → 감사 ·
 *   커밋 뒤 이 프로세스 캐시 무효화(D-C7).
 *
 * 규칙 요약
 * - 변경 0 이면 버전·감사 없음(`changed:false`). 편집 불가 키(잠금)는 400(rule readOnly·restartRequired·serviceManaged).
 * - credentialRef 는 #93b 전용(CREDENTIAL_ONLY) — `credentials.manage`(SUPER_ADMIN) 호출에서만 잠금을 푼다(Validate·Diff·Test 도 같은 규칙).
 * - 교차 환경 쓰기(대상 환경 ≠ 프로세스 환경)는 SUPER_ADMIN(`environment.policy`)만, 대상이 PRODUCTION 이면 바뀐 키가 **전부 NOT_NEEDED** 일 때만
 *   (기능 테스트는 자기 환경 연결로만 돌아 교차 PRODUCTION 적용은 검증할 수 없다 — Leader 결정) + 감사 `crossEnvironment:true`.
 * - reason 은 공용 검사(CX-3) — 응답·로그에 원문 없음.
 */
import { ApiError, recordAudit, requireReason, withTransaction, type Tx } from '@/modules/infra'
import {
  buildDiff,
  checkCredentialRef,
  claimFunctionalSlot,
  clearConfigCaches,
  currentVersionNumber,
  DEFAULT_VOICE_KEY,
  enabledPoliciesUsingAsPrimary,
  ensureBaseline,
  findVersion,
  hashCandidate,
  isApplyBlocking,
  isPolicyAppSetting,
  lockConnectionsForUpdate,
  lockFallbackPoliciesForUpdate,
  lockMessage,
  newFallbackIds,
  planRestore,
  PREVIEW_TEXT_KEY,
  PREVIEW_TEXT_VERSION_KEY,
  recordConfigTestResult,
  runConfigConnectionTest,
  sameValue,
  stableStringify,
  validatePatch,
  verifiabilityOf,
  writeVersion,
  type ConfigConnectionTestResult,
  type ConfigDiff,
  type ConfigTestMark,
  type EditKeyDef,
  type LlmTier,
  type LockReason,
  type ValidateHooks,
  type ValidationResult,
  type VersionOrigin,
  type VersionTarget,
} from '@/modules/engine'
import { getAppSetting } from '@/modules/preferences'
import { clearTtsSettingCache, currentTtsConnection, probeTtsSynthesis } from '@/modules/speech'
import type { ConfigScope, ConfigurationVersion, Environment } from '@prisma/client'
import type {
  AdminEnvironment,
  AppSettingDto,
  Capability,
  ConfigApplyResultDto,
  ConfigDiffDto,
  ConfigEditScopeName,
  ConfigIssueDto,
  ConfigKeyPolicyDto,
  ConfigRawDto,
  ConfigTestDto,
  ConfigTestRunDto,
  ConfigValidateDto,
  ConfigVerifiable,
  ConfigVersionRefDto,
} from '@/types/admin'
import { mapEngineError } from '../errors'
import { assertCapability, hasCapability, hiddenNotFound, type AdminActor } from '../permissions/guard'
import { displayAny } from '../present'
import { assertCrossEnvironment, productionGate, TEST_RESULT_TTL_MS } from './gate'
import {
  baselineSnapshot,
  candidateConnection,
  dependencyHook,
  EDIT_SCOPES,
  effectiveSources,
  fallbackDependencyIssues,
  fallbackReferencedIds,
  flatFromSnapshot,
  loadEditTarget,
  lockEditTarget,
  lockSettingTarget,
  materialize,
  providerTypeOf,
  snapshotOf,
  type EditTarget,
} from './targets'

const ENVIRONMENTS: readonly AdminEnvironment[] = ['LOCAL', 'DEVELOPMENT', 'STAGING', 'PRODUCTION']
export { PRODUCTION_CONFIRM, TEST_RESULT_TTL_MS } from './gate'
const MAX_PATCH_KEYS = 200
const PREVIEW_TEXT_FALLBACK = 'こんにちは。今日も一緒に楽しく日本語を勉強しましょう。'

// ── 입력 ───────────────────────────────────────────────────────────────

const invalid = (field: string, message: string, extra: Record<string, unknown> = {}) => new ApiError('VALIDATION', message, { field, ...extra })

export function parseScope(raw: unknown): ConfigEditScopeName {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  if ((EDIT_SCOPES as readonly string[]).includes(s)) return s as ConfigEditScopeName
  if (s === 'VOICE_PROFILE') throw invalid('scope', '목소리 기본값 편집은 다음 단계(012c-2)에서 열립니다.', { reason: 'SCOPE_DEFERRED' })
  throw invalid('scope', 'scope 는 ENGINE_CONNECTION·FALLBACK_POLICY·APP_SETTING 중 하나입니다.')
}

export function parseTargetId(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[\w.-]{1,120}$/.test(raw)) throw invalid('targetId', 'targetId 가 필요합니다.')
  return raw
}

export function parsePatch(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid('patch', 'patch 는 키 → 값 객체여야 합니다.')
  if (Object.keys(raw).length > MAX_PATCH_KEYS) throw invalid('patch', `patch 는 키 ${MAX_PATCH_KEYS}개까지입니다.`)
  return raw as Record<string, unknown>
}

export function parseBaseVersion(raw: unknown): number {
  const n = typeof raw === 'string' && /^\d{1,7}$/.test(raw.trim()) ? Number(raw.trim()) : raw
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 1_000_000) throw invalid('baseVersion', '기준 버전(baseVersion)이 필요합니다 — 다시 불러와 주세요.')
  return n
}

/** 쓰기 대상 환경: 생략 = 프로세스 환경. 다른 환경은 SUPER_ADMIN(`environment.policy`)만. */
export function editEnvironment(actor: AdminActor, raw: unknown): Environment {
  if (raw == null || raw === '') return actor.environment
  const v = typeof raw === 'string' ? (raw.toUpperCase() as AdminEnvironment) : null
  if (!v || !ENVIRONMENTS.includes(v)) throw invalid('environment', 'environment 값이 올바르지 않습니다.')
  if (v !== actor.environment) assertCapability(actor, 'environment.policy')
  return v
}

export async function resolveEditTarget(actor: AdminActor, scope: ConfigEditScopeName, targetId: string, envRaw: unknown): Promise<EditTarget> {
  const t = await loadEditTarget(scope, editEnvironment(actor, envRaw), targetId)
  if (!t) throw hiddenNotFound()
  return t
}

const versionTarget = (t: EditTarget, targetId = t.targetId): VersionTarget => ({ environment: t.environment, scope: t.scope as ConfigScope, targetId })

// ── 공통 계산 ─────────────────────────────────────────────────────────────

function hooksFor(t: EditTarget, opts: { allowCredential: boolean }): ValidateHooks {
  return { allowLocks: opts.allowCredential ? (['CREDENTIAL_ONLY'] as LockReason[]) : [], checkRefExists: opts.allowCredential, dependency: dependencyHook(t) }
}

/** credentialRef 가 patch 에 있고 호출자가 credentials.manage 를 가졌으면 잠금을 푼다(Validate·Diff·Test — #93b 의 PRODUCTION 사전 단계). */
function allowCredentialFor(actor: AdminActor, patch: Readonly<Record<string, unknown>>): boolean {
  return Object.prototype.hasOwnProperty.call(patch, 'connection.credentialRef') && hasCapability(actor, 'credentials.manage')
}

function candidateOf(t: EditTarget, patch: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const keys = new Set(t.defs.map((d) => d.key))
  const out: Record<string, unknown> = { ...t.stored }
  for (const [k, v] of Object.entries(patch)) if (keys.has(k)) out[k] = v
  return out
}

type Issue = { key: string; rule: string; message: string; expected?: unknown; actual?: unknown; suggestion?: string; related?: string[]; lock?: LockReason }

function issueDto(i: Issue, def?: EditKeyDef): ConfigIssueDto {
  const secret = def?.type === 'SECRET_REF'
  return {
    key: i.key,
    rule: i.rule as ConfigIssueDto['rule'],
    message: i.message,
    ...(i.expected !== undefined ? { expected: displayAny(i.expected) } : {}),
    ...(i.actual !== undefined && !secret ? { actual: displayAny(i.actual) } : {}),
    ...(i.suggestion ? { suggestion: i.suggestion } : {}),
    ...(i.related ? { related: i.related } : {}),
    ...(i.lock ? { lock: i.lock } : {}),
  }
}

export function validateDto(t: EditTarget, v: ValidationResult): ConfigValidateDto {
  const byKey = new Map(t.defs.map((d) => [d.key, d]))
  return { valid: v.valid, stage: v.stage, errors: v.errors.map((e) => issueDto(e, byKey.get(e.key))), warnings: v.warnings, changedKeys: v.changedKeys, impact: v.impact }
}

/** 검증 실패 → 봉투. 대체 정책 주 연결 끄기는 409 PRIMARY_IN_USE. */
function throwValidation(t: EditTarget, v: ValidationResult): never {
  const primary = v.errors.find((e) => e.related?.[0] === 'PRIMARY_IN_USE')
  if (primary) throw new ApiError('CONFLICT', primary.message, { reason: 'PRIMARY_IN_USE', roles: primary.related?.slice(1) ?? [] })
  const dto = validateDto(t, v)
  throw new ApiError('VALIDATION', `설정 검증 실패(${dto.errors.length}건)`, { stage: dto.stage, errors: dto.errors, warnings: dto.warnings })
}

async function diffFor(t: EditTarget, candidate: Record<string, unknown>, changedKeys: readonly string[], baseVersion: number, allowCredential: boolean): Promise<ConfigDiff> {
  const { before, after } = await effectiveSources(t, candidate)
  return buildDiff({
    scope: t.scope,
    targetId: t.targetId,
    environment: t.environment,
    baseVersion,
    defs: t.defs,
    stored: t.stored,
    candidate,
    changedKeys,
    before,
    after,
    allowLocks: allowCredential ? ['CREDENTIAL_ONLY'] : [],
  })
}

export function diffDto(t: EditTarget, d: ConfigDiff, actor: AdminActor): ConfigDiffDto {
  return {
    scope: t.scope,
    targetId: t.targetId,
    targetKey: t.targetKey,
    environment: t.environment,
    baseVersion: d.baseVersion,
    summaryHash: d.summaryHash,
    candidateHash: d.candidateHash,
    changes: d.changes.map((c) => ({ ...c, before: displayAny(c.before), after: displayAny(c.after), storedBefore: displayAny(c.storedBefore), storedAfter: displayAny(c.storedAfter) })),
    unchanged: d.unchanged,
    summary: d.summary,
    productionProtected: d.productionProtected,
    requiredConfirm: d.requiredConfirm,
    testRequired: d.testRequired,
    crossEnvironment: t.environment !== actor.environment,
  }
}

const verifiableOf = (def: EditKeyDef): ConfigVerifiable =>
  def.verify === 'NONE' ? 'NO' : def.verify === 'NOT_NEEDED' ? 'NOT_NEEDED' : def.verify === 'SWITCH' || def.verify === 'FALLBACK_NEW' ? 'DYNAMIC' : 'YES'

export function keyPolicyDto(t: EditTarget, def: EditKeyDef): ConfigKeyPolicyDto {
  return {
    key: def.key,
    type: def.type,
    description: def.description,
    editability: def.editability,
    strict: def.strict,
    editable: def.lock === null,
    lock: def.lock,
    lockMessage: def.lock ? lockMessage(def.lock) : null,
    verifiable: verifiableOf(def),
    consumer: def.consumer,
    restartTarget: def.restartTarget ?? null,
    ...(def.min != null ? { min: def.min } : {}),
    ...(def.max != null ? { max: def.max } : {}),
    ...(def.enum ? { enum: def.enum } : {}),
    ...(def.pattern ? { pattern: def.pattern } : {}),
    ...(def.maxLength != null ? { maxLength: def.maxLength } : {}),
    ...(def.nullable ? { nullable: true } : {}),
    ...(def.allowedRefs ? { allowedRefs: def.allowedRefs } : {}),
    stored: displayAny(t.stored[def.key]),
    shadowedByEnv: Boolean(def.runtimeEnvWins?.some((n) => Boolean(process.env[n]?.trim()))),
  }
}

interface Candidate {
  patch: Record<string, unknown>
  /** APP_SETTING 되돌리기가 "행 없음" 기준선으로 갈 때 false. */
  exists?: boolean
  restore?: { version: ConfigurationVersion; droppedKeys: string[] }
}

/** 스냅샷에 없는 키 = 그때의 기본값인가(연결 행 JSON 은 기본값 키를 생략한다 — 같은 스키마 버전 스냅샷일 때만). */
export function absentAsDefault(t: EditTarget, meta: { schemaVersion: number | null } | null): boolean {
  return t.scope === 'ENGINE_CONNECTION' && meta != null && meta.schemaVersion === t.schemaVersion
}

/** 되돌리기 계획(엄격 재검증 — 손상·규칙 위반이면 422 E_SNAPSHOT_INTEGRITY, 쓰기 0). */
export async function restorePlan(t: EditTarget, v: ConfigurationVersion, actor: AdminActor): Promise<Required<Pick<Candidate, 'patch' | 'exists'>> & { droppedKeys: string[] }> {
  const parsed = flatFromSnapshot(t, v.snapshot)
  if (!parsed.ok) throw new ApiError('UNPROCESSABLE', '이 버전 기록이 손상돼 되돌릴 수 없습니다.', { reason: 'E_SNAPSHOT_INTEGRITY', version: v.version, integrity: 'MALFORMED', issues: [] })
  // 비밀 참조가 달라지는 되돌리기는 권한 문제다(기록 손상이 아니다) — credentials.manage 가 없으면 403.
  if (t.scope === 'ENGINE_CONNECTION' && !sameValue(parsed.value.flat['connection.credentialRef'], t.stored['connection.credentialRef'])) {
    assertCapability(actor, 'credentials.manage', { targetEnvironment: t.environment })
  }
  const allowCredential = hasCapability(actor, 'credentials.manage')
  const plan = await planRestore(t.defs, t.stored, parsed.value.flat, hooksFor(t, { allowCredential }), { absentAsDefault: absentAsDefault(t, parsed.meta) })
  if (plan.integrity !== 'OK') {
    const byKey = new Map(t.defs.map((d) => [d.key, d]))
    throw new ApiError('UNPROCESSABLE', '이 버전은 지금 규칙으로 되돌릴 수 없습니다.', { reason: 'E_SNAPSHOT_INTEGRITY', version: v.version, integrity: plan.integrity, issues: plan.issues.map((i) => issueDto(i, byKey.get(i.key))) })
  }
  const patch: Record<string, unknown> = {}
  for (const k of plan.changedKeys) patch[k] = plan.candidate[k]
  return { patch, exists: parsed.value.exists, droppedKeys: plan.droppedKeys }
}

/** 요청 본문 → 후보: `patch` 또는 `versionId`(되돌릴 스냅샷 — 03:50 ⑥ 운영 Rollback 사전 테스트·Diff). */
async function candidateFromBody(t: EditTarget, body: Record<string, unknown>, actor: AdminActor): Promise<Candidate> {
  if (body.versionId == null) return { patch: parsePatch(body.patch) }
  if (body.patch != null) throw invalid('patch', 'patch 와 versionId 는 함께 보낼 수 없습니다.')
  const v = typeof body.versionId === 'string' ? await findVersion(body.versionId) : null
  if (!v || v.environment !== t.environment || v.scope !== t.scope || v.targetId !== t.targetId) throw hiddenNotFound()
  if (v.status === 'ACTIVE') throw new ApiError('CONFLICT', '이미 사용 중인 버전입니다.', { reason: 'ALREADY_ACTIVE' })
  const plan = await restorePlan(t, v, actor)
  return { patch: plan.patch, exists: plan.exists, restore: { version: v, droppedKeys: plan.droppedKeys } }
}

// ── #104 Validate · #106 Diff ─────────────────────────────────────────────

export async function validateConfig(actor: AdminActor, body: Record<string, unknown>): Promise<ConfigValidateDto> {
  const t = await resolveEditTarget(actor, parseScope(body.scope), parseTargetId(body.targetId), body.environment)
  const patch = parsePatch(body.patch)
  return validateDto(t, await validatePatch(t.defs, t.stored, patch, hooksFor(t, { allowCredential: allowCredentialFor(actor, patch) })))
}

export async function diffConfig(actor: AdminActor, body: Record<string, unknown>): Promise<ConfigDiffDto> {
  const t = await resolveEditTarget(actor, parseScope(body.scope), parseTargetId(body.targetId), body.environment)
  const c = await candidateFromBody(t, body, actor)
  const allowCredential = allowCredentialFor(actor, c.patch)
  const v = await validatePatch(t.defs, t.stored, c.patch, hooksFor(t, { allowCredential }))
  if (!v.valid) throwValidation(t, v)
  const base = await currentVersionNumber(versionTarget(t))
  return diffDto(t, await diffFor(t, candidateOf(t, c.patch), v.changedKeys, base, allowCredential), actor)
}

// ── #105 Test ─────────────────────────────────────────────────────────────

const LLM_TIER: Partial<Record<string, LlmTier>> = { LLM_PROBE_FAST: 'fast', LLM_PROBE_BALANCED: 'balanced', LLM_PROBE_DEEP: 'deep', LLM_PROBE_STREAM: 'fast' }

function runDto(r: ConfigConnectionTestResult): ConfigTestRunDto {
  return { connectionKey: r.connection.key, ok: r.ok, status: r.health.status, errorCode: r.errorCode, latencyMs: r.health.latencyMs, healthId: r.health.id, traceId: r.traceId }
}

/**
 * 후보를 메모리에서만 합성해 실행 검증한다(CX-2): 바뀐 키 중 실행 검증이 필요한(YES) 키 전부를 실제로 검증했을 때만 `status:"ok"` + `testResultId`.
 * 검증 불가(NO) 키가 섞이면 `partial`(id 없음), 실행 실패는 `failed`. 전부 NOT_NEEDED 면 실행 없이 ok(id null — 적용에 테스트 불요).
 * 대상은 이 프로세스 환경의 행만(교차 환경은 403 — 기능 테스트는 자기 환경 연결로만 돈다).
 */
export async function testConfig(actor: AdminActor, body: Record<string, unknown>): Promise<ConfigTestDto> {
  const t = await resolveEditTarget(actor, parseScope(body.scope), parseTargetId(body.targetId), body.environment)
  if (t.environment !== actor.environment) throw new ApiError('FORBIDDEN', '기능 테스트는 그 환경의 서버에서만 실행할 수 있어요.', { reason: 'CROSS_ENVIRONMENT_TEST_UNAVAILABLE' })
  const c = await candidateFromBody(t, body, actor)
  const allowCredential = allowCredentialFor(actor, c.patch)
  const v = await validatePatch(t.defs, t.stored, c.patch, hooksFor(t, { allowCredential }))
  if (!v.valid) throwValidation(t, v)
  if (v.changedKeys.length === 0) throw invalid('patch', '지금 저장값과 달라지는 값이 없습니다.', { reason: 'NO_CHANGE' })
  const candidate = candidateOf(t, c.patch)
  const byKey = new Map(t.defs.map((d) => [d.key, d]))
  const yes: string[] = []
  const no: string[] = []
  const notNeeded: string[] = []
  for (const k of v.changedKeys) {
    const def = byKey.get(k)!
    const r = verifiabilityOf(def, t.stored[k], candidate[k])
    ;(r === 'YES' ? yes : r === 'NO' ? no : notNeeded).push(k)
  }
  const candidateHash = hashCandidate(t.scope, t.targetId, t.environment, candidate)
  const empty = { traceId: null, latencyMs: null, candidateHash, expiresAt: null, runs: [] as ConfigTestRunDto[] }
  if (yes.length === 0) return { ...empty, status: no.length ? 'partial' : 'ok', testResultId: null, testedKeys: [], untestedKeys: no, notNeededKeys: notNeeded }
  const statusIfOk: ConfigTestMark['status'] = no.length ? 'partial' : 'ok'
  const markBase = { scope: t.scope, targetId: t.targetId, environment: t.environment, candidateHash, testedKeys: yes }

  const runs: ConfigConnectionTestResult[] = []
  const runDtos: ConfigTestRunDto[] = []
  let main: { healthId: string; traceId: string; ok: boolean; status: ConfigTestMark['status']; checkedAt: Date; latencyMs: number | null } | null = null
  try {
    if (t.scope === 'ENGINE_CONNECTION') {
      const methods = yes.map((k) => byKey.get(k)!.verify)
      const tiers = [...new Set(methods.map((m) => LLM_TIER[m]).filter((x): x is LlmTier => Boolean(x)))]
      const r = await runConfigConnectionTest({
        environment: t.environment,
        connectionId: t.targetId,
        actorUserId: actor.id,
        candidate: candidateConnection(t, candidate),
        llm: providerTypeOf(t) === 'LLM' ? { tiers: tiers.length ? tiers : ['fast'], stream: methods.includes('LLM_PROBE_STREAM') } : undefined,
        mark: { ...markBase, statusIfOk },
      })
      runs.push(r)
      runDtos.push(runDto(r))
      main = { healthId: r.health.id, traceId: r.traceId, ok: r.ok, status: r.ok ? statusIfOk : r.skipped ? 'partial' : 'failed', checkedAt: r.health.checkedAt, latencyMs: r.health.latencyMs }
    } else if (t.scope === 'FALLBACK_POLICY') {
      const primary = String(candidate.primaryConnectionId)
      const others = yes.includes('fallbackConnectionIds') ? newFallbackIds(t.stored.fallbackConnectionIds, candidate.fallbackConnectionIds) : []
      const needPrimary = yes.includes('primaryConnectionId') || yes.includes('enabled')
      const order = needPrimary ? [...others.filter((id) => id !== primary), primary] : others
      for (const [i, id] of order.entries()) {
        const last = i === order.length - 1
        const prevOk = runs.every((x) => x.ok)
        const r = await runConfigConnectionTest({
          environment: t.environment,
          connectionId: id,
          actorUserId: actor.id,
          mark: last
            ? { ...markBase, related: runs.map((x) => x.health.id), statusIfOk: prevOk ? statusIfOk : runs.some((x) => !x.ok && !x.skipped) ? 'failed' : 'partial' }
            : { ...markBase, testedKeys: [], statusIfOk: 'partial' },
        })
        runs.push(r)
        runDtos.push(runDto(r))
        if (last) {
          const allOk = runs.every((x) => x.ok)
          main = { healthId: r.health.id, traceId: r.traceId, ok: allOk, status: allOk ? statusIfOk : runs.some((x) => !x.ok && !x.skipped) ? 'failed' : 'partial', checkedAt: r.health.checkedAt, latencyMs: r.health.latencyMs }
        }
      }
    } else {
      const conn = await currentTtsConnection()
      if (!conn) throw new ApiError('ENGINE_UNAVAILABLE', '합성에 쓸 목소리 연결이 없어요.', { reason: 'TTS_UNAVAILABLE' })
      await claimFunctionalSlot(conn.id)
      const startedAt = Date.now()
      const isText = t.targetId === PREVIEW_TEXT_KEY
      const voice = isText ? await getAppSetting<unknown>(DEFAULT_VOICE_KEY, null) : candidate.value
      const text = isText ? candidate.value : await getAppSetting<unknown>(PREVIEW_TEXT_KEY, PREVIEW_TEXT_FALLBACK)
      const p = await probeTtsSynthesis({ actorUserId: actor.id, text: typeof text === 'string' ? text : PREVIEW_TEXT_FALLBACK, voiceId: typeof voice === 'string' ? voice : '' })
      const status: ConfigTestMark['status'] = p.ok ? statusIfOk : 'failed'
      const rec = await recordConfigTestResult({
        environment: t.environment,
        connectionId: p.connectionId ?? conn.id,
        actorUserId: actor.id,
        startedAt,
        outcome: p.ok
          ? { ok: true, status: 'HEALTHY', latencyMs: p.latencyMs, detail: { audioBytes: p.audioBytes, ...(p.durationMs != null ? { durationMs: p.durationMs } : {}) } }
          : { ok: false, status: 'DEGRADED', latencyMs: p.latencyMs, detail: { errorCode: p.errorCode ?? 'SYNTH_FAILED', message: '설정 후보로 합성하지 못했습니다' } },
        steps: p.steps,
        mark: { ...markBase, testedKeys: p.ok ? yes : [], status },
      })
      main = { healthId: rec.health.id, traceId: rec.traceId, ok: p.ok, status, checkedAt: rec.health.checkedAt, latencyMs: p.latencyMs }
      runDtos.push({ connectionKey: p.connectionKey ?? conn.key, ok: p.ok, status: rec.health.status, errorCode: p.errorCode, latencyMs: p.latencyMs, healthId: rec.health.id, traceId: rec.traceId })
    }
  } catch (e) {
    mapEngineError(e, actor)
  }
  const m = main!
  const issued = m.status === 'ok'
  const tested = m.ok ? yes : []
  return {
    status: m.status,
    testResultId: issued ? m.healthId : null,
    traceId: m.traceId,
    latencyMs: m.latencyMs,
    testedKeys: tested,
    untestedKeys: [...no, ...yes.filter((k) => !tested.includes(k))],
    notNeededKeys: notNeeded,
    candidateHash,
    expiresAt: issued ? new Date(m.checkedAt.getTime() + TEST_RESULT_TTL_MS).toISOString() : null,
    runs: runDtos,
  }
}

// ── 적용 코어(#107·#111·#109·#93·#93a·#93b·#100·#123b 공용) ─────────────────

export interface CommitOptions {
  /** 대상 행 환경 기준으로 검사할 capability(PRODUCTION 이면 config.apply.production 추가 — can.ts). */
  capability: Capability
  origin: VersionOrigin
  auditAction: string
  body: Record<string, unknown>
  allowCredential?: boolean
  restore?: { version: ConfigurationVersion; droppedKeys: string[] }
  exists?: boolean
}

const ref = (v: ConfigurationVersion | null): ConfigVersionRefDto | null => (v ? { id: v.id, version: v.version, status: v.status } : null)

function pick(values: Readonly<Record<string, unknown>>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.map((k) => [k, values[k] ?? null]))
}

function short(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v) ?? 'null'
  return s.length > 24 ? `${s.slice(0, 23)}…` : s
}

function diffEnvelope(d: ConfigDiff): Record<string, unknown> {
  const first = d.changes[0]
  return {
    entries: d.changes.map((c) => ({ key: c.key, before: c.storedBefore, after: c.storedAfter, beforeSource: c.beforeSource, afterSource: c.afterSource, editability: c.editability, strict: c.strict, blocked: c.blocked?.code ?? null })),
    summary: first ? `${first.key} ${short(first.storedBefore)}→${short(first.storedAfter)}${d.changes.length > 1 ? ` (+${d.changes.length - 1})` : ''}` : '',
    candidateHash: d.candidateHash,
  }
}

function conflict(baseVersion: number, currentVersion: number): ApiError {
  return new ApiError('CONFLICT', '그 사이 다른 곳에서 설정이 바뀌었어요. 새로 불러온 뒤 다시 시도해 주세요.', { reason: 'VERSION_CONFLICT', baseVersion, currentVersion })
}

/**
 * 적용 코어. 순서: capability(대상 환경) → 교차 환경 → baseVersion → reason → Validate → Diff → (교차 PRODUCTION NOT_NEEDED 한정) →
 * PRODUCTION 게이트 → 트랜잭션(잠금 → 저장값·버전 재확인 → 주 연결 끄기 409 → 기준선 → 물화 → 버전 → 감사 → 파생 적용) → 캐시 무효화.
 */
export async function commitEdit(actor: AdminActor, t: EditTarget, patch: Readonly<Record<string, unknown>>, o: CommitOptions): Promise<ConfigApplyResultDto> {
  assertCapability(actor, o.capability, { targetEnvironment: t.environment })
  if (o.allowCredential) assertCapability(actor, 'credentials.manage', { targetEnvironment: t.environment })
  const cross = t.environment !== actor.environment
  if (cross) assertCapability(actor, 'environment.policy')
  const production = t.environment === 'PRODUCTION'
  const baseVersion = parseBaseVersion(o.body.baseVersion)
  const reason = requireReason(o.body.reason, { production })
  const v = await validatePatch(t.defs, t.stored, patch, hooksFor(t, { allowCredential: o.allowCredential === true }))
  if (!v.valid) throwValidation(t, v)
  const noChange: ConfigApplyResultDto = {
    changed: false,
    scope: t.scope,
    targetId: t.targetId,
    environment: t.environment,
    version: null,
    previousVersion: null,
    baselineVersion: null,
    derived: [],
    applied: { runtimeEditable: [], pushedToService: false, restartRequired: [], restartTarget: null, redeployRequired: [] },
    auditIds: [],
    warnings: v.warnings.map((w) => w.code),
  }
  const existsChange = t.scope === 'APP_SETTING' && o.exists === false && t.row !== null
  if (v.changedKeys.length === 0 && !existsChange) return noChange
  const vt = versionTarget(t)
  const current = await currentVersionNumber(vt)
  if (current !== baseVersion) throw conflict(baseVersion, current)
  const candidate = candidateOf(t, patch)
  const d = await diffFor(t, candidate, v.changedKeys, current, o.allowCredential === true)
  const blocking = d.changes.find((c) => isApplyBlocking(c.blocked))
  if (blocking) throw new ApiError('VALIDATION', blocking.blocked!.message, { stage: 'SCHEMA', errors: [{ key: blocking.key, rule: 'readOnly', message: blocking.blocked!.message }] })
  assertCrossEnvironment(cross, t.environment, d)
  const test = await productionGate(o.body, { scope: t.scope, targetId: t.targetId, environment: t.environment }, d)

  const auditActor = { id: actor.id, email: actor.email, role: actor.role }
  const result = await withTransaction(async (tx: Tx) => {
    // 전역 잠금 순서 = 연결(id 오름차순) → Fallback 정책(id 오름차순)(Codex C2 ②·REV-036 L2): 정책 편집은 참조 연결을 먼저, 연결 끄기는
    // 자기 연결 다음에 정책을 잠근다 — 서로 기다릴 뿐 교착하지 않고, 커밋 직전 재검증이 상대의 최신 커밋을 본다(READ COMMITTED).
    if (t.scope === 'FALLBACK_POLICY') await lockConnectionsForUpdate(tx, fallbackReferencedIds(candidate))
    const locked = await lockEditTarget(tx, t)
    if (!locked) throw hiddenNotFound()
    const now = await currentVersionNumber(vt, tx)
    if (now !== baseVersion || stableStringify(locked.stored) !== stableStringify(t.stored)) throw conflict(baseVersion, now)
    if (locked.scope === 'ENGINE_CONNECTION' && v.changedKeys.includes('enabled') && candidate.enabled === false) {
      await lockFallbackPoliciesForUpdate(tx, locked.environment)
      const roles = await enabledPoliciesUsingAsPrimary(locked.environment, locked.targetId, tx)
      if (roles.length) throw new ApiError('CONFLICT', `켜진 대체 정책(${roles.join(', ')})의 주 연결이라 끌 수 없습니다.`, { reason: 'PRIMARY_IN_USE', roles })
    }
    if (locked.scope === 'FALLBACK_POLICY') {
      // 참조 연결(잠금 뒤 최신 값)의 환경·역할·켜짐을 커밋 직전에 다시 — Validate 뒤 끼어든 연결 끄기를 여기서 잡는다.
      const issues = await fallbackDependencyIssues(locked, candidate, tx)
      if (issues.length) throwValidation(locked, { valid: false, stage: 'DEPENDENCY', errors: issues, warnings: [], changedKeys: v.changedKeys, impact: v.impact })
    }
    const auditIds: string[] = []
    const baseline = await ensureBaseline(tx, vt, baselineSnapshot(locked))
    if (baseline) {
      auditIds.push(await recordAudit({ environment: t.environment, actor: null, action: 'config.baseline', scope: vt.scope, targetId: t.targetId, after: { versionId: baseline.id, version: 1 } }, tx))
    }
    await materialize(tx, locked, candidate, { exists: o.exists })
    const { row, previous } = await writeVersion(tx, vt, {
      snapshot: snapshotOf(locked, candidate, { schemaVersion: locked.schemaVersion, origin: o.origin }, { exists: o.exists }),
      diff: diffEnvelope(d),
      actorUserId: actor.id,
      reason,
      testResult: test ? { ok: true, testResultId: test.testResultId, traceId: test.traceId, checkedAt: test.checkedAt } : null,
      restoredFromVersion: o.restore?.version.version ?? null,
      replacedStatus: o.origin === 'ROLLBACK' ? 'ROLLED_BACK' : 'SUPERSEDED',
    })
    auditIds.push(
      await recordAudit(
        {
          environment: t.environment,
          actor: auditActor,
          action: o.auditAction,
          scope: vt.scope,
          targetId: t.targetId,
          before: { version: previous?.version ?? 0, values: pick(t.stored, v.changedKeys) },
          after: {
            versionId: row.id,
            version: row.version,
            values: pick(candidate, v.changedKeys),
            ...(o.restore ? { restoredFromVersion: o.restore.version.version, droppedKeys: o.restore.droppedKeys } : {}),
            ...(existsChange ? { exists: false } : {}),
            ...(cross ? { crossEnvironment: true } : {}),
          },
          reason,
          ip: actor.ip,
          traceId: test?.traceId ?? null,
        },
        tx,
      ),
    )
    // D-C7: 미리듣기 문장이 바뀌면 같은 트랜잭션에서 textVersion +1(미리듣기 캐시 키 무효화) — 그 키도 버전·감사 1:1.
    const derived: { targetId: string; version: ConfigVersionRefDto }[] = []
    if (locked.scope === 'APP_SETTING' && locked.targetId === PREVIEW_TEXT_KEY) {
      const dt = await lockSettingTarget(tx, locked.environment, PREVIEW_TEXT_VERSION_KEY)
      if (dt) {
        const dvt = versionTarget(dt)
        const cur = typeof dt.stored.value === 'number' && Number.isInteger(dt.stored.value) ? (dt.stored.value as number) : 1
        const dCandidate = { value: cur + 1 }
        const dBaseline = await ensureBaseline(tx, dvt, baselineSnapshot(dt))
        if (dBaseline) auditIds.push(await recordAudit({ environment: dt.environment, actor: null, action: 'config.baseline', scope: dvt.scope, targetId: dt.targetId, after: { versionId: dBaseline.id, version: 1 } }, tx))
        await materialize(tx, dt, dCandidate)
        const dv = await writeVersion(tx, dvt, {
          snapshot: snapshotOf(dt, dCandidate, { schemaVersion: dt.schemaVersion, origin: o.origin }),
          diff: { entries: [{ key: 'value', before: cur, after: cur + 1, beforeSource: 'DATABASE', afterSource: 'DATABASE', editability: 'RUNTIME_EDITABLE', strict: false, blocked: null }], summary: `value ${cur}→${cur + 1}`, candidateHash: null, derivedFrom: { targetId: PREVIEW_TEXT_KEY, versionId: row.id } },
          actorUserId: actor.id,
          reason,
          testResult: null,
          restoredFromVersion: null,
          replacedStatus: 'SUPERSEDED',
        })
        auditIds.push(
          await recordAudit(
            { environment: dt.environment, actor: auditActor, action: o.auditAction, scope: dvt.scope, targetId: dt.targetId, before: { version: dv.previous?.version ?? 0, values: { value: cur } }, after: { versionId: dv.row.id, version: dv.row.version, values: { value: cur + 1 }, derivedFrom: { targetId: PREVIEW_TEXT_KEY, versionId: row.id } }, reason, ip: actor.ip },
            tx,
          ),
        )
        derived.push({ targetId: dt.targetId, version: ref(dv.row)! })
      }
    }
    return { row, previous, baseline, auditIds, derived }
  }).catch(async (e: unknown) => {
    // 같은 대상·같은 번호를 두 요청이 동시에 쓰면 @@unique(environment, scope, targetId, version) 가 막는다(행이 없는 AppSetting 은 잠글 행이 없어 이것이 직렬화 지점).
    if ((e as { code?: string })?.code === 'P2002') throw conflict(baseVersion, await currentVersionNumber(vt))
    throw e
  })
  clearConfigCaches()
  clearTtsSettingCache()
  const byKey = new Map(t.defs.map((k) => [k.key, k]))
  return {
    changed: true,
    scope: t.scope,
    targetId: t.targetId,
    environment: t.environment,
    version: ref(result.row),
    previousVersion: result.previous ? { id: result.previous.id, version: result.previous.version, status: o.origin === 'ROLLBACK' ? 'ROLLED_BACK' : 'SUPERSEDED' } : null,
    baselineVersion: result.baseline ? { id: result.baseline.id, version: 1, status: 'SUPERSEDED' } : null,
    derived: result.derived,
    applied: {
      runtimeEditable: v.changedKeys.filter((k) => byKey.get(k)?.editability === 'RUNTIME_EDITABLE'),
      pushedToService: false,
      restartRequired: [],
      restartTarget: null,
      redeployRequired: [],
    },
    auditIds: result.auditIds,
    warnings: [...v.warnings.map((w) => w.code), ...(d.summary.shadowed ? ['W_SHADOWED_BY_ENVIRONMENT'] : [])],
  }
}

// ── #107 Apply ────────────────────────────────────────────────────────────

export async function applyConfig(actor: AdminActor, body: Record<string, unknown>): Promise<ConfigApplyResultDto> {
  const t = await resolveEditTarget(actor, parseScope(body.scope), parseTargetId(body.targetId), body.environment)
  return commitEdit(actor, t, parsePatch(body.patch), { capability: 'config.edit', origin: 'APPLY', auditAction: 'config.apply', body })
}

// ── #110·#111 Raw JSON ────────────────────────────────────────────────────

/** 저장값(관리 층) 문서 — `_meta` 없음. */
function rawJsonOf(t: EditTarget): Record<string, unknown> {
  if (t.scope === 'ENGINE_CONNECTION') {
    const connection = { ...t.managed.connection }
    delete connection.credentialRef
    return { connection, runtime: t.managed.runtime, credentialRef: t.managed.credentialRef, logLevel: t.managed.logLevel, enabled: t.managed.enabled }
  }
  if (t.scope === 'FALLBACK_POLICY') return { ...t.stored }
  return { value: t.stored.value ?? null }
}

const RAW_TOP_KEYS: Record<ConfigEditScopeName, readonly string[]> = {
  ENGINE_CONNECTION: ['connection', 'runtime', 'credentialRef', 'logLevel', 'enabled'],
  FALLBACK_POLICY: ['primaryConnectionId', 'fallbackConnectionIds', 'retryOnce', 'enabled'],
  APP_SETTING: ['value'],
}

function syntaxError(message: string, text: string, pos: number | null): ApiError {
  let line = 1
  let column = 1
  if (pos != null) {
    for (let i = 0; i < pos && i < text.length; i++) {
      if (text[i] === '\n') {
        line++
        column = 1
      } else column++
    }
  }
  return new ApiError('VALIDATION', message, { stage: 'JSON_SYNTAX', ...(pos != null ? { line, column } : {}) })
}

/** 본문 `json`(객체 또는 JSON 문자열) → 객체. 문자열 문법 오류는 줄·칸을 알려 준다. */
export function parseRawJson(raw: unknown): Record<string, unknown> {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    if (raw.length > 64 * 1024) throw invalid('json', 'JSON 문서가 너무 큽니다.')
    try {
      obj = JSON.parse(raw)
    } catch (e) {
      const m = /position (\d+)/.exec((e as Error).message)
      throw syntaxError('JSON 문법 오류가 있습니다.', raw, m ? Number(m[1]) : null)
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new ApiError('VALIDATION', 'json 은 객체여야 합니다.', { stage: 'JSON_SYNTAX' })
  return obj as Record<string, unknown>
}

/** Raw 문서 → 평면 patch. 문서 밖 키·지운 키는 SCHEMA 오류(행 저장소라 키를 지우는 적용은 없다). */
function patchFromRaw(t: EditTarget, doc: Record<string, unknown>): Record<string, unknown> {
  const errors: ConfigIssueDto[] = []
  const top = RAW_TOP_KEYS[t.scope]
  for (const k of Object.keys(doc)) if (!top.includes(k) && !k.startsWith('x-')) errors.push({ key: k, rule: 'unknownKey', message: '문서에 둘 수 없는 키입니다.' })
  let flat: Record<string, unknown> = {}
  if (t.scope === 'ENGINE_CONNECTION') {
    const conn = doc.connection
    const run = doc.runtime
    if (!conn || typeof conn !== 'object' || Array.isArray(conn) || !run || typeof run !== 'object' || Array.isArray(run)) {
      errors.push({ key: 'connection', rule: 'type', message: 'connection·runtime 은 객체여야 합니다.' })
    } else {
      const f: Record<string, unknown> = {}
      const walk = (prefix: string, o: Record<string, unknown>, depth: number) => {
        for (const [seg, v] of Object.entries(o)) {
          const k = `${prefix}.${seg}`
          if (v && typeof v === 'object' && !Array.isArray(v) && depth < 6) walk(k, v as Record<string, unknown>, depth + 1)
          else f[k] = v
        }
      }
      const c = { ...(conn as Record<string, unknown>) }
      delete c.credentialRef
      walk('connection', c, 0)
      walk('runtime', run as Record<string, unknown>, 0)
      if ('credentialRef' in doc) f['connection.credentialRef'] = doc.credentialRef
      if ('logLevel' in doc) f['logging.level'] = doc.logLevel
      if ('enabled' in doc) f.enabled = doc.enabled
      flat = f
    }
  } else {
    for (const k of top) if (k in doc) flat[k] = doc[k]
  }
  for (const k of Object.keys(t.stored)) {
    if (!(k in flat)) errors.push({ key: k, rule: 'required', message: '저장값의 키를 지울 수 없습니다 — 값을 바꿔 주세요.' })
  }
  if (errors.length) throw new ApiError('VALIDATION', `설정 검증 실패(${errors.length}건)`, { stage: 'SCHEMA', errors: errors.slice(0, 50), warnings: [] })
  return flat
}

export async function getRawConfig(actor: AdminActor, scopeRaw: string, targetId: string, envRaw: string | null): Promise<ConfigRawDto> {
  const t = await resolveEditTarget(actor, parseScope(scopeRaw), parseTargetId(targetId), envRaw)
  if (t.environment === 'PRODUCTION') {
    await recordAudit({ environment: t.environment, actor: { id: actor.id, email: actor.email, role: actor.role }, action: 'config.raw.read', scope: t.scope as ConfigScope, targetId: t.targetId, after: { detail: 'RAW', ...(t.environment !== actor.environment ? { crossEnvironment: true } : {}) }, ip: actor.ip })
  }
  let effectiveDiffers: string[] = []
  if (t.scope !== 'APP_SETTING') {
    const { before } = await effectiveSources(t, t.stored)
    effectiveDiffers = Object.keys(t.stored).filter((k) => before[k] && JSON.stringify(before[k].value) !== JSON.stringify(t.stored[k]))
  }
  const version = await currentVersionNumber(versionTarget(t))
  return {
    scope: t.scope,
    targetId: t.targetId,
    targetKey: t.targetKey,
    environment: t.environment,
    version,
    schemaRef: t.scope === 'ENGINE_CONNECTION' ? `${t.row.engineId}@${t.schemaVersion}` : t.scope === 'FALLBACK_POLICY' ? 'fallback-policy@1' : 'app-setting@1',
    json: displayAny(rawJsonOf(t)) as Record<string, unknown>,
    keys: t.defs.map((d) => keyPolicyDto(t, d)),
    editability: Object.fromEntries(t.defs.map((d) => [d.key, d.editability])),
    effectiveDiffers,
  }
}

export async function putRawConfig(actor: AdminActor, scopeRaw: string, targetId: string, body: Record<string, unknown>): Promise<{ validation: ConfigValidateDto; diff: ConfigDiffDto } | ConfigApplyResultDto> {
  assertCapability(actor, 'config.raw.read')
  const t = await resolveEditTarget(actor, parseScope(scopeRaw), parseTargetId(targetId), body.environment)
  const patch = patchFromRaw(t, parseRawJson(body.json))
  const dryRun = body.dryRun === true || body.dryRun === 'true' || body.dryRun === 1
  if (!dryRun) return commitEdit(actor, t, patch, { capability: 'config.edit', origin: 'RAW_JSON', auditAction: 'config.raw_apply', body })
  const v = await validatePatch(t.defs, t.stored, patch, hooksFor(t, { allowCredential: false }))
  if (!v.valid) throwValidation(t, v)
  const base = await currentVersionNumber(versionTarget(t))
  return { validation: validateDto(t, v), diff: diffDto(t, await diffFor(t, candidateOf(t, patch), v.changedKeys, base, false), actor) }
}

// ── #93·#93a·#93b 연결 · #100 Fallback · #123b AppSetting ───────────────────

function flattenForm(prefix: string, raw: unknown, out: Record<string, unknown>, field: string): void {
  if (raw === undefined) return
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw invalid(field, `${field} 는 객체여야 합니다.`)
  const walk = (p: string, o: Record<string, unknown>, depth: number) => {
    for (const [seg, v] of Object.entries(o)) {
      const k = `${p}.${seg}`
      if (v && typeof v === 'object' && !Array.isArray(v) && depth < 6) walk(k, v as Record<string, unknown>, depth + 1)
      else out[k] = v
    }
  }
  walk(prefix, raw as Record<string, unknown>, 0)
}

/** #93 Form 편집 — `connection`·`runtime`(부분 객체)·`enabled` → 평면 patch. 이름은 012c 편집 대상이 아니다. */
export async function updateConnectionForm(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<ConfigApplyResultDto> {
  if (body.name !== undefined) throw invalid('name', '연결 이름은 이 단계에서 바꿀 수 없습니다.', { reason: 'NOT_EDITABLE' })
  const t = await resolveEditTarget(actor, 'ENGINE_CONNECTION', parseTargetId(id), body.environment)
  const patch: Record<string, unknown> = {}
  flattenForm('connection', body.connection, patch, 'connection')
  flattenForm('runtime', body.runtime, patch, 'runtime')
  if (body.enabled !== undefined) patch.enabled = body.enabled
  if (Object.keys(patch).length === 0) throw invalid('connection', '바꿀 값이 없습니다.')
  return commitEdit(actor, t, patch, { capability: 'engine.connections.manage', origin: 'APPLY', auditAction: 'config.apply', body })
}

/** #93a 켜기·끄기 — 켜진 대체 정책의 주 연결은 끌 수 없다(409 PRIMARY_IN_USE). 감사 `engine.connections.enable|disable`. */
export async function setConnectionEnabled(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<ConfigApplyResultDto> {
  if (typeof body.enabled !== 'boolean') throw invalid('enabled', 'enabled 는 true/false 여야 합니다.')
  const t = await resolveEditTarget(actor, 'ENGINE_CONNECTION', parseTargetId(id), body.environment)
  return commitEdit(actor, t, { enabled: body.enabled }, { capability: 'engine.connections.manage', origin: 'APPLY', auditAction: body.enabled ? 'engine.connections.enable' : 'engine.connections.disable', body })
}

const VALUE_FIELDS = ['value', 'secret', 'apiKey', 'api_key', 'key', 'token', 'password', 'credential']

/**
 * #93b credentialRef 연결·해제(`credentials.manage` = SUPER_ADMIN). 검사 순서(정본): 값 필드 400 → (평문 의심 400 E_CONN_SECRET_VALUE) →
 * 전역 거부 분류 → 어댑터 허용 목록(422 E_REF_NOT_ALLOWED) → 형식(400) → 존재(400 reference) → reason → PRODUCTION 흐름.
 * 감사 `credentials.set|credentials.clear`(before/after 는 ref 이름만).
 */
export async function setConnectionCredential(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<ConfigApplyResultDto> {
  assertCapability(actor, 'credentials.manage')
  if (VALUE_FIELDS.some((f) => Object.prototype.hasOwnProperty.call(body, f))) throw new ApiError('VALIDATION', '비밀 값은 보낼 수 없어요 — 서버에 둔 참조 이름(credentialRef)만 연결합니다.', { reason: 'E_CONN_SECRET_VALUE' })
  if (!Object.prototype.hasOwnProperty.call(body, 'credentialRef') || (body.credentialRef !== null && typeof body.credentialRef !== 'string')) throw invalid('credentialRef', 'credentialRef(참조 이름 또는 null)가 필요합니다.')
  const ref = body.credentialRef as string | null
  const t = await resolveEditTarget(actor, 'ENGINE_CONNECTION', parseTargetId(id), body.environment)
  const def = t.defs.find((d) => d.key === 'connection.credentialRef')
  if (!def) throw invalid('credentialRef', '이 연결에는 비밀 참조가 없습니다.', { reason: 'NO_CREDENTIAL_KEY' })
  if (def.consumer === 'NONE' || def.consumer === 'PYTHON') throw new ApiError('VALIDATION', lockMessage(def.consumer === 'NONE' ? 'NOT_CONSUMED' : 'SERVICE_MANAGED'), { stage: 'SCHEMA', errors: [{ key: def.key, rule: def.consumer === 'NONE' ? 'readOnly' : 'serviceManaged', message: lockMessage(def.consumer === 'NONE' ? 'NOT_CONSUMED' : 'SERVICE_MANAGED') }] })
  if (ref !== null) {
    const r = checkCredentialRef(def.allowedRefs ?? [], ref, { checkExists: true })
    if (!r.ok) {
      if (r.problem === 'PLAINTEXT') throw new ApiError('VALIDATION', '비밀 값 대신 env:/file: 참조 이름만 넣을 수 있어요.', { reason: 'E_CONN_SECRET_VALUE' })
      if (r.problem === 'REF_NOT_ALLOWED') throw new ApiError('UNPROCESSABLE', '이 연결에 허용되지 않은 비밀 참조예요.', { reason: 'E_REF_NOT_ALLOWED', allowedRefs: def.allowedRefs ?? [] })
      if (r.problem === 'BAD_FORMAT') throw new ApiError('VALIDATION', '참조 이름 형식이 올바르지 않아요(env:NAME | file:name).', { stage: 'SCHEMA', errors: [{ key: def.key, rule: 'pattern', message: '참조 이름 형식' }] })
      throw new ApiError('VALIDATION', '서버에 그 참조 값이 없어요.', { stage: 'DEPENDENCY', errors: [{ key: def.key, rule: 'reference', message: '서버에 그 참조 값이 없습니다.' }] })
    }
  }
  return commitEdit(actor, t, { 'connection.credentialRef': ref }, { capability: 'credentials.manage', origin: 'APPLY', auditAction: ref === null ? 'credentials.clear' : 'credentials.set', body, allowCredential: true })
}

/** #100 Fallback 편집 — 보낸 칸만 patch. `retryOnce` 는 Router 가 읽지 않아 바꿀 수 없다(NOT_CONSUMED). */
export async function updateFallbackPolicy(actor: AdminActor, role: string, body: Record<string, unknown>): Promise<ConfigApplyResultDto> {
  const t = await resolveEditTarget(actor, 'FALLBACK_POLICY', parseTargetId(role), body.environment)
  const patch: Record<string, unknown> = {}
  for (const k of ['primaryConnectionId', 'fallbackConnectionIds', 'retryOnce', 'enabled']) if (body[k] !== undefined) patch[k] = body[k]
  if (Object.keys(patch).length === 0) throw invalid('primaryConnectionId', '바꿀 값이 없습니다.')
  return commitEdit(actor, t, patch, { capability: 'engine.connections.manage', origin: 'APPLY', auditAction: 'config.apply', body })
}

export async function getAppSettingDto(actor: AdminActor, key: string, envRaw: string | null): Promise<AppSettingDto> {
  const t = await resolveEditTarget(actor, 'APP_SETTING', parseTargetId(key), envRaw)
  const def = t.defs[0]
  return {
    key: t.targetId,
    environment: t.environment,
    value: displayAny(t.stored.value),
    exists: t.scope === 'APP_SETTING' && t.row !== null,
    description: def.description,
    type: def.type,
    editability: def.editability,
    policy: isPolicyAppSetting(t.targetId),
    lock: def.lock,
    lockMessage: def.lock ? lockMessage(def.lock) : null,
    verifiable: verifiableOf(def),
    version: await currentVersionNumber(versionTarget(t)),
  }
}

/** #123b PUT — `{value, baseVersion, reason, confirm?, summaryHash?, testResultId?}`. 모르는 키 404, 정책·자동 키 400(readOnly). */
export async function putAppSetting(actor: AdminActor, key: string, body: Record<string, unknown>): Promise<ConfigApplyResultDto> {
  if (!Object.prototype.hasOwnProperty.call(body, 'value')) throw invalid('value', 'value 가 필요합니다.')
  const t = await resolveEditTarget(actor, 'APP_SETTING', parseTargetId(key), body.environment)
  return commitEdit(actor, t, { value: body.value }, { capability: 'config.edit', origin: 'APPLY', auditAction: 'config.apply', body })
}
