/**
 * `AuditLog` 기록의 **유일한 진입점**(admin-console/00 §4 `common.audit`, role-permission.md §7).
 * 관리자 쓰기는 같은 트랜잭션(`tx`)에서, 민감 읽기(`secrets.read_ref` 목록 조회 등)는 단독으로 1행을 남긴다.
 * before/after 는 저장 전에 마스킹한다(시크릿 형태 문자열 → `***`, credentialRef 이름은 유지). UPDATE/DELETE 경로는 없다.
 */
import type { ConfigScope, Environment, Prisma, Role } from '@prisma/client'
import { prisma } from './db'
import { maskSensitive } from './mask'
import type { Tx } from './tx'

export interface AuditEntry {
  environment: Environment
  actor: { id: string; email: string; role: Role }
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
      actorUserId: entry.actor.id,
      actorEmailSnap: entry.actor.email.slice(0, 120),
      actorRoleSnap: entry.actor.role,
      action: entry.action.slice(0, 80),
      scope: entry.scope ?? null,
      targetId: entry.targetId ? entry.targetId.slice(0, 120) : null,
      before: json(entry.before),
      after: json(entry.after),
      reason: entry.reason ? entry.reason.slice(0, 500) : null,
      ip: entry.ip ? entry.ip.slice(0, 64) : null,
      traceId: entry.traceId ? entry.traceId.slice(0, 40) : null,
    },
    select: { id: true },
  })
  return row.id
}
