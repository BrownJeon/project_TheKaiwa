/**
 * 설정 이력(task-012c D-C8 — api-contract #108·#108a·#109·#137): 버전 목록·상세(compare)·Rollback·감사 조회.
 *
 * - 목록 항목: origin(`snapshot._meta.origin`)·대상 이름·**integrity**(지금 스키마로 엄격 재검증 — OK 가 아니면 화면은 "기록 손상" + 되돌리기 숨김)·diffSummary.
 * - 상세 `compare=previous`(바로 앞 버전 → 이 버전) | `active`(지금 저장값 → 이 버전 = 되돌리면 생길 변화). 손상이면 422 E_SNAPSHOT_INTEGRITY.
 * - Rollback = 새 버전(`restoredFromVersion`), 밀려난 직전 ACTIVE 는 ROLLED_BACK, 복원 대상 상태 불변(D-C6). 이미 ACTIVE 409 · 변화 없음 409 NO_CHANGE ·
 *   재검증 위반 422(쓰기 0) · PRODUCTION 은 §2-19 흐름(summaryHash 는 "대상 스냅샷을 후보로 한 Diff" — #106 에 versionId 로 요청).
 * - ADMIN 은 스냅샷 원문(snapshot) 대신 요약만 — DEVELOPER 이상(config.raw.read)만 원문(#102 요약 규칙과 같게).
 * - 감사(#137, audit.read): 필터 환경(기본 현재, 다른 환경 SUPER_ADMIN)·scope(LEXICON 은 옛 `scope=null` `lexicon.*` 포함)·대상·작업자·action(`.` 로 끝나면 접두)·기간.
 *   before/after 는 저장 때 이미 마스킹된 값을 한 번 더 마스킹해 싣는다. ip 는 /24(IPv6 /48).
 */
import { ApiError, decodeCursor, encodeCursor, isTimeIdCursor, listAuditRows, maskText, parseLimit, recordAudit, type AuditEntry } from '@/modules/infra'
import { fillAbsentDefaults, findVersion, listVersionRows, previousOf, snapshotIntegrity, type Integrity } from '@/modules/engine'
import type { AuditLog, ConfigScope, ConfigurationVersion, Environment } from '@prisma/client'
import type {
  AdminEnvironment,
  AuditItemDto,
  AuditListDto,
  ConfigEditScopeName,
  ConfigRollbackResultDto,
  ConfigScopeName,
  ConfigVersionDetailDto,
  ConfigVersionItemDto,
  ConfigVersionListDto,
} from '@/types/admin'
import { assertCapability, hasCapability, hiddenNotFound, viewEnvironment, type AdminActor } from '../permissions/guard'
import { displayAny } from '../present'
import { absentAsDefault, commitEdit, parseScope, restorePlan } from './editor'
import { EDIT_SCOPES, flatFromSnapshot, loadEditTarget, type EditTarget } from './targets'

const ENTRIES_MAX = 200
const AUDIT_SCOPES: readonly ConfigScopeName[] = ['ENGINE_CONNECTION', 'FALLBACK_POLICY', 'PROMPT', 'APP_SETTING', 'VOICE_PROFILE', 'PRESET', 'LEXICON']
const invalid = (field: string, message: string) => new ApiError('VALIDATION', message, { field })

async function targetFor(v: ConfigurationVersion): Promise<EditTarget | null> {
  if (!(EDIT_SCOPES as readonly string[]).includes(v.scope)) return null
  return loadEditTarget(v.scope as ConfigEditScopeName, v.environment, v.targetId)
}

function integrityOf(t: EditTarget | null, v: ConfigurationVersion): { integrity: Integrity; flat: Record<string, unknown> | null; issues: ConfigVersionDetailDto['issues'] } {
  if (!t) return { integrity: 'MALFORMED', flat: null, issues: [] }
  const parsed = flatFromSnapshot(t, v.snapshot)
  const flat = parsed.ok ? parsed.value.flat : null
  const r = snapshotIntegrity(parsed, t.defs, flat)
  return { integrity: r.integrity, flat, issues: r.issues.map((i) => ({ key: i.key, rule: i.rule, message: i.message })) }
}

function originOf(v: ConfigurationVersion): ConfigVersionItemDto['origin'] {
  const meta = v.snapshot && typeof v.snapshot === 'object' && !Array.isArray(v.snapshot) ? (v.snapshot as Record<string, unknown>)._meta : null
  const o = meta && typeof meta === 'object' ? (meta as Record<string, unknown>).origin : null
  return o === 'BASELINE' || o === 'APPLY' || o === 'RAW_JSON' || o === 'ROLLBACK' ? o : null
}

function diffSummaryOf(v: ConfigurationVersion): string | null {
  const d = v.diff && typeof v.diff === 'object' && !Array.isArray(v.diff) ? (v.diff as Record<string, unknown>) : null
  return typeof d?.summary === 'string' && d.summary ? (displayAny(d.summary) as string).slice(0, 200) : null
}

/** 저장 때 이미 가린 값이지만 012c 2단계 이전 행을 위해 응답에서 한 번 더 가린다(Codex C2 ①). */
const shownReason = (r: string | null): string | null => (r ? maskText(r) : null)

export function itemDto(v: ConfigurationVersion & { actor?: { id: string; email: string } | null }, t: EditTarget | null, integrity: Integrity): ConfigVersionItemDto {
  const tr = v.testResult && typeof v.testResult === 'object' && !Array.isArray(v.testResult) ? (v.testResult as Record<string, unknown>) : null
  return {
    id: v.id,
    scope: v.scope as ConfigEditScopeName,
    targetId: v.targetId,
    targetKey: t?.targetKey ?? null,
    targetName: t?.targetName ?? null,
    environment: v.environment,
    version: v.version,
    status: v.status,
    origin: originOf(v),
    actor: v.actor ? { id: v.actor.id, email: v.actor.email } : null,
    reason: shownReason(v.reason),
    diffSummary: diffSummaryOf(v),
    restoredFromVersion: v.restoredFromVersion,
    testResult: tr ? { ok: tr.ok === true } : null,
    integrity,
    createdAt: v.createdAt.toISOString(),
    supersededAt: v.supersededAt?.toISOString() ?? null,
  }
}

// ── #108 목록 ─────────────────────────────────────────────────────────────

export async function listConfigVersions(actor: AdminActor, sp: URLSearchParams): Promise<ConfigVersionListDto> {
  const environment = viewEnvironment(actor, sp.get('environment'))
  const scopeRaw = sp.get('scope')
  const scopes = scopeRaw ? [parseScope(scopeRaw)] : EDIT_SCOPES
  const statusRaw = sp.get('status')?.toUpperCase() ?? null
  if (statusRaw && !['ACTIVE', 'SUPERSEDED', 'ROLLED_BACK'].includes(statusRaw)) throw invalid('status', 'status 값이 올바르지 않습니다.')
  const targetId = sp.get('targetId') ?? undefined
  if (targetId && !/^[\w.-]{1,120}$/.test(targetId)) throw invalid('targetId', 'targetId 가 올바르지 않습니다.')
  const limit = parseLimit(sp.get('limit'), 20, 100)
  const cursor = decodeCursor(sp.get('cursor'), isTimeIdCursor)
  // key 로 들어온 ENGINE_CONNECTION·역할 이름 FALLBACK_POLICY 는 id 로 바꾼다.
  let resolvedTarget = targetId
  if (targetId && scopes.length === 1) resolvedTarget = (await loadEditTarget(scopes[0], environment, targetId))?.targetId ?? targetId
  const { rows, hasMore } = await listVersionRows({ environment, scopes: scopes as ConfigScope[], targetId: resolvedTarget, status: (statusRaw as ConfigurationVersion['status']) ?? undefined }, { limit, cursor })
  const targets = new Map<string, EditTarget | null>()
  const items: ConfigVersionItemDto[] = []
  for (const r of rows) {
    const tk = `${r.scope}:${r.targetId}`
    if (!targets.has(tk)) targets.set(tk, await targetFor(r))
    const t = targets.get(tk) ?? null
    items.push(itemDto(r, t, integrityOf(t, r).integrity))
  }
  const last = rows.at(-1)
  return { items, nextCursor: hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null }
}

// ── #108a 상세 ───────────────────────────────────────────────────────────

type VersionWithActor = ConfigurationVersion & { actor: { id: string; email: string } | null }

async function loadVersion(actor: AdminActor, id: string): Promise<VersionWithActor> {
  const v = await findVersion(id)
  if (!v) throw hiddenNotFound()
  if (v.environment !== actor.environment && !hasCapability(actor, 'environment.policy')) throw hiddenNotFound()
  return v
}

/**
 * PRODUCTION 버전 스냅샷 원문(`config.raw.read`) 조회 감사 — `getRawConfig`(지금 저장값 원문)와 같은 규칙(REV-036 L1). 값은 싣지 않는다.
 * 원문을 보여주지 않는 조회(ADMIN — 요약만)·비 PRODUCTION 은 null.
 */
export function versionRawReadAuditEntry(actor: AdminActor, v: Pick<ConfigurationVersion, 'id' | 'environment' | 'scope' | 'targetId' | 'version'>, full: boolean): AuditEntry | null {
  if (!full || v.environment !== 'PRODUCTION') return null
  return {
    environment: v.environment,
    actor: { id: actor.id, email: actor.email, role: actor.role },
    action: 'config.raw.read',
    scope: v.scope,
    targetId: v.targetId,
    after: { detail: 'VERSION', versionId: v.id, version: v.version, ...(actor.environment !== v.environment ? { crossEnvironment: true } : {}) },
    ip: actor.ip,
  }
}

export async function getConfigVersion(actor: AdminActor, id: string, sp: URLSearchParams): Promise<ConfigVersionDetailDto> {
  const compare = (sp.get('compare') ?? 'previous').trim()
  if (compare !== 'previous' && compare !== 'active') throw invalid('compare', 'compare 는 previous·active 중 하나입니다.')
  const v = await loadVersion(actor, id)
  const t = await targetFor(v)
  const { integrity, flat, issues } = integrityOf(t, v)
  if (integrity !== 'OK' || !t || !flat) throw new ApiError('UNPROCESSABLE', '이 버전 기록이 손상돼 비교할 수 없습니다.', { reason: 'E_SNAPSHOT_INTEGRITY', version: v.version, integrity, issues })
  let against: ConfigVersionDetailDto['against'] = null
  let base: Record<string, unknown> = {}
  let shown = flat
  if (compare === 'active') {
    against = { kind: 'STORED' }
    base = t.stored
    const p = flatFromSnapshot(t, v.snapshot)
    // 되돌리면 생길 변화 — 되돌리기와 같은 규칙으로(스냅샷에 없던 키는 기본값).
    if (p.ok && absentAsDefault(t, p.meta)) shown = fillAbsentDefaults(t.defs, t.stored, flat)
  } else {
    const prev = await previousOf(v)
    if (prev) {
      against = { id: prev.id, version: prev.version, status: prev.status }
      const p = flatFromSnapshot(t, prev.snapshot)
      base = p.ok ? p.value.flat : {}
    }
  }
  const keys = [...new Set([...Object.keys(base), ...Object.keys(shown)])].sort()
  const entries = keys.filter((k) => JSON.stringify(base[k]) !== JSON.stringify(shown[k])).map((k) => ({ key: k, before: displayAny(base[k] ?? null), after: displayAny(shown[k] ?? null) }))
  const defKeys = new Set(t.defs.map((d) => d.key))
  const full = hasCapability(actor, 'config.raw.read')
  // 응답을 만들기 전에 기록한다 — 감사가 실패하면 원문도 나가지 않는다(#102 FULL 조회와 같은 순서).
  const audit = versionRawReadAuditEntry(actor, v, full)
  if (audit) await recordAudit(audit)
  return {
    ...itemDto(v, t, integrity),
    snapshot: full ? (displayAny(v.snapshot) as Record<string, unknown>) : {},
    compare,
    against,
    entries: entries.slice(0, ENTRIES_MAX),
    truncated: Math.max(0, entries.length - ENTRIES_MAX),
    droppedKeys: Object.keys(flat).filter((k) => !defKeys.has(k) && JSON.stringify(flat[k]) !== JSON.stringify(t.stored[k])),
    issues,
  }
}

// ── #109 Rollback ────────────────────────────────────────────────────────

export async function rollbackConfigVersion(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<ConfigRollbackResultDto> {
  const v = await loadVersion(actor, id)
  if (v.environment !== actor.environment) assertCapability(actor, 'environment.policy')
  if (!(EDIT_SCOPES as readonly string[]).includes(v.scope)) throw invalid('scope', '이 설정은 이 화면에서 되돌릴 수 없습니다.')
  const t = await targetFor(v)
  if (!t) throw hiddenNotFound()
  if (v.status === 'ACTIVE') throw new ApiError('CONFLICT', '이미 사용 중인 버전입니다.', { reason: 'ALREADY_ACTIVE' })
  const plan = await restorePlan(t, v, actor)
  const existsChange = t.scope === 'APP_SETTING' && plan.exists === false && t.row !== null
  if (Object.keys(plan.patch).length === 0 && !existsChange) throw new ApiError('CONFLICT', '지금 설정과 내용이 같아 되돌릴 것이 없어요.', { reason: 'NO_CHANGE' })
  const r = await commitEdit(actor, t, plan.patch, {
    capability: 'config.rollback',
    origin: 'ROLLBACK',
    auditAction: 'config.rollback',
    body,
    restore: { version: v, droppedKeys: plan.droppedKeys },
    exists: plan.exists,
    allowCredential: Object.prototype.hasOwnProperty.call(plan.patch, 'connection.credentialRef') && hasCapability(actor, 'credentials.manage'),
  })
  return { ...r, restoredFromVersion: v.version, rolledBack: r.previousVersion ? { ...r.previousVersion, status: 'ROLLED_BACK' } : null, droppedKeys: plan.droppedKeys }
}

// ── #137 감사 ────────────────────────────────────────────────────────────

function maskIp(ip: string | null): string | null {
  if (!ip) return null
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip)
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}::/48`
  return null
}

function auditSummary(a: AuditLog): string | null {
  const after = a.after && typeof a.after === 'object' && !Array.isArray(a.after) ? (a.after as Record<string, unknown>) : null
  if (!after) return null
  const values = after.values && typeof after.values === 'object' ? Object.keys(after.values as Record<string, unknown>) : []
  const version = typeof after.version === 'number' ? `v${after.version}` : null
  const parts = [version, values.length ? values.slice(0, 3).join(', ') + (values.length > 3 ? ` 외 ${values.length - 3}` : '') : null].filter(Boolean)
  return parts.length ? parts.join(' · ').slice(0, 200) : null
}

export function auditDto(a: AuditLog): AuditItemDto {
  const after = a.after && typeof a.after === 'object' && !Array.isArray(a.after) ? (a.after as Record<string, unknown>) : null
  return {
    id: a.id,
    environment: a.environment,
    actor: { id: a.actorUserId, email: a.actorEmailSnap, roleSnap: a.actorRoleSnap },
    action: a.action,
    scope: a.scope as ConfigScopeName | null,
    targetId: a.targetId,
    before: displayAny(a.before),
    after: displayAny(a.after),
    reason: shownReason(a.reason),
    ip: maskIp(a.ip),
    traceId: a.traceId,
    createdAt: a.createdAt.toISOString(),
    summary: auditSummary(a),
    versionId: typeof after?.versionId === 'string' ? after.versionId : null,
  }
}

function parseDate(raw: string | null, field: string): Date | undefined {
  if (!raw) return undefined
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) throw invalid(field, `${field} 날짜 형식이 올바르지 않습니다.`)
  return d
}

export async function listAuditLogs(actor: AdminActor, sp: URLSearchParams): Promise<AuditListDto> {
  const environment: Environment = viewEnvironment(actor, sp.get('environment')) as AdminEnvironment
  const scopeRaw = sp.get('scope')?.toUpperCase() ?? null
  if (scopeRaw && !(AUDIT_SCOPES as readonly string[]).includes(scopeRaw)) throw invalid('scope', 'scope 값이 올바르지 않습니다.')
  const targetId = sp.get('targetId') ?? undefined
  if (targetId && !/^[\w.:-]{1,120}$/.test(targetId)) throw invalid('targetId', 'targetId 가 올바르지 않습니다.')
  const actorUserId = sp.get('actorUserId') ?? undefined
  if (actorUserId && !/^[\w-]{1,40}$/.test(actorUserId)) throw invalid('actorUserId', 'actorUserId 가 올바르지 않습니다.')
  const action = sp.get('action') ?? undefined
  if (action && !/^[a-z_]+(\.[a-z_]+)*\.?$/.test(action)) throw invalid('action', 'action 값이 올바르지 않습니다.')
  const from = parseDate(sp.get('from'), 'from')
  const to = parseDate(sp.get('to'), 'to')
  const limit = parseLimit(sp.get('limit'), 50, 100)
  const cursor = decodeCursor(sp.get('cursor'), isTimeIdCursor)
  const { rows, hasMore } = await listAuditRows({ environment, scope: (scopeRaw as ConfigScope | null) ?? undefined, targetId, actorUserId, action, from, to }, { limit, cursor })
  const last = rows.at(-1)
  return { items: rows.map(auditDto), nextCursor: hasMore && last ? encodeCursor({ t: last.createdAt.toISOString(), id: last.id }) : null }
}
