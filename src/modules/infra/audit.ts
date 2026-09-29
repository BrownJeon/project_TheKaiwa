/**
 * `AuditLog` 기록의 **유일한 진입점**(admin-console/00 §4 `common.audit`, role-permission.md §7).
 * 관리자 쓰기는 같은 트랜잭션(`tx`)에서, 민감 읽기(`secrets.read_ref` 목록 조회 등)는 단독으로 1행을 남긴다.
 * before/after 는 저장 전에 마스킹한다(시크릿 형태 문자열 → `***`, credentialRef 이름은 유지). `reason` 도 저장 전에 문장 단위 마스킹(`maskText`) —
 * 쓰기 시점 거부(CX-3 `checkReason`)와 탐지 규칙이 달라, 그 밖으로 새는 조각을 한 번 더 막는다(Codex C2 012c 2단계 ①). UPDATE/DELETE 경로는 없다.
 */
import type { AuditLog, ConfigScope, Environment, Prisma, Role } from '@prisma/client'
import { prisma } from './db'
import { maskSensitive, maskText } from './mask'
import type { Tx } from './tx'

export interface AuditEntry {
  environment: Environment
  /** null = 시스템 기록(설정 첫 적용 기준선 `config.baseline` — actor 없음, role-permission §7). */
  actor: { id: string; email: string; role: Role } | null
  /** capability 이름 규약: `secrets.read_ref` · `config.apply` · `engine.connections.update` … */
  action: string
  scope?: ConfigScope | null
  targetId?: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
  ip?: string | null
  traceId?: string | null
}

function json(v: unknown): Prisma.InputJsonValue | undefined {
  return v === undefined || v === null ? undefined : (maskSensitive(v) as Prisma.InputJsonValue)
}

export async function recordAudit(entry: AuditEntry, tx?: Tx): Promise<string> {
  const db = tx ?? prisma
  const row = await db.auditLog.create({
    data: {
      environment: entry.environment,
      actorUserId: entry.actor?.id ?? null,
      actorEmailSnap: entry.actor ? entry.actor.email.slice(0, 120) : 'system',
      actorRoleSnap: entry.actor?.role ?? null,
      action: entry.action.slice(0, 80),
      scope: entry.scope ?? null,
      targetId: entry.targetId ? entry.targetId.slice(0, 120) : null,
      before: json(entry.before),
      after: json(entry.after),
      reason: entry.reason ? maskText(entry.reason).slice(0, 500) : null,
      ip: entry.ip ? entry.ip.slice(0, 64) : null,
      traceId: entry.traceId ? entry.traceId.slice(0, 40) : null,
    },
    select: { id: true },
  })
  return row.id
}

export interface AuditBrief {
  targetId: string
  action: string
  actorEmailSnap: string | null
  actorRoleSnap: Role | null
  reason: string | null
  after: unknown
  createdAt: Date
}

/**
 * 대상 id 목록의 감사 행(읽기 전용 — 버전 목록에 작업자·이유를 붙일 때, task-003g). `actionPrefix` 로 자원 종류를 좁힌다.
 * 한 대상에 여러 행이면 최신 것만.
 */
export async function findAuditsByTargets(environment: Environment, targetIds: readonly string[], actionPrefix: string): Promise<Map<string, AuditBrief>> {
  const out = new Map<string, AuditBrief>()
  if (targetIds.length === 0) return out
  const rows = await prisma.auditLog.findMany({
    where: { environment, targetId: { in: [...targetIds] }, action: { startsWith: actionPrefix } },
    orderBy: { createdAt: 'desc' },
    select: { targetId: true, action: true, actorEmailSnap: true, actorRoleSnap: true, reason: true, after: true, createdAt: true },
  })
  for (const r of rows) if (r.targetId && !out.has(r.targetId)) out.set(r.targetId, { ...r, targetId: r.targetId })
  return out
}

// ── 조회(#137, task-012c D-C8) ─────────────────────────────────────────

export interface AuditListFilter {
  environment: Environment
  /** LEXICON 은 task-018 이전의 `scope=null` + `lexicon.*` 행도 함께(감사 행은 고쳐 쓰지 않는다). */
  scope?: ConfigScope | null
  targetId?: string
  actorUserId?: string
  /** 정확히 일치, 또는 `.` 로 끝나면 접두 일치(`config.`·`lexicon.`). */
  action?: string
  from?: Date
  to?: Date
}

export async function listAuditRows(f: AuditListFilter, page: { limit: number; cursor: { t: string; id: string } | null }): Promise<{ rows: AuditLog[]; hasMore: boolean }> {
  const and: Prisma.AuditLogWhereInput[] = [{ environment: f.environment }]
  if (f.scope === 'LEXICON') and.push({ OR: [{ scope: 'LEXICON' }, { scope: null, action: { startsWith: 'lexicon.' } }] })
  else if (f.scope) and.push({ scope: f.scope })
  if (f.targetId) and.push({ targetId: f.targetId })
  if (f.actorUserId) and.push({ actorUserId: f.actorUserId })
  if (f.action) and.push(f.action.endsWith('.') ? { action: { startsWith: f.action } } : { action: f.action })
  if (f.from || f.to) and.push({ createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } })
  if (page.cursor) {
    const t = new Date(page.cursor.t)
    and.push({ OR: [{ createdAt: { lt: t } }, { createdAt: t, id: { lt: page.cursor.id } }] })
  }
  const rows = await prisma.auditLog.findMany({ where: { AND: and }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: page.limit + 1 })
  return { rows: rows.slice(0, page.limit), hasMore: rows.length > page.limit }
}
