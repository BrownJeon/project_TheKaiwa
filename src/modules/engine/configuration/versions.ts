/**
 * ConfigurationVersion 기록·조회(engine 소유 테이블, configuration-resolution §6-2·§6-3, task-012c D-C2·D-C5·D-C6).
 *
 * - 쓰기는 호출자(admin)가 연 트랜잭션(`tx`) 안에서만 — 대상 행 `SELECT … FOR UPDATE` 뒤에 부른다. 마지막 방어는
 *   `@@unique(environment, scope, targetId, version)`(P2002 → 호출자가 409).
 * - 기준선(D-C5): 대상에 버전 행이 하나도 없으면 첫 적용 때 v1 = 지금 저장값(`_meta.origin=BASELINE`, actor 없음)을 먼저 쓴다.
 * - ACTIVE 는 (환경, scope, 대상)당 1개 — 새 버전을 쓰면 직전 ACTIVE 는 SUPERSEDED(일반 적용) 또는 ROLLED_BACK(되돌림 — 밀려난 직전 ACTIVE).
 */
import { maskText, prisma, type Tx } from '@/modules/infra'
import { Prisma, type ConfigScope, type ConfigurationVersion, type ConfigVersionStatus, type Environment } from '@prisma/client'

type Db = Tx | typeof prisma

export interface VersionTarget {
  environment: Environment
  scope: ConfigScope
  targetId: string
}

export async function activeVersion(t: VersionTarget, db: Db = prisma): Promise<ConfigurationVersion | null> {
  return db.configurationVersion.findFirst({ where: { ...t, status: 'ACTIVE' }, orderBy: { version: 'desc' } })
}

/** 대상의 지금 번호(ACTIVE 가 없으면 0 — seed 상태). */
export async function currentVersionNumber(t: VersionTarget, db: Db = prisma): Promise<number> {
  return (await activeVersion(t, db))?.version ?? 0
}

async function nextNumber(tx: Tx, t: VersionTarget): Promise<number> {
  const agg = await tx.configurationVersion.aggregate({ where: t, _max: { version: true } })
  return (agg._max.version ?? 0) + 1
}

const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue
const jsonOrNull = (v: unknown) => (v === undefined || v === null ? Prisma.DbNull : json(v))

/** 버전 행이 하나도 없으면 v1 기준선(ACTIVE)을 쓴다. 이미 있으면 null. */
export async function ensureBaseline(tx: Tx, t: VersionTarget, snapshot: Record<string, unknown>): Promise<ConfigurationVersion | null> {
  const any = await tx.configurationVersion.findFirst({ where: t, select: { id: true } })
  if (any) return null
  return tx.configurationVersion.create({ data: { ...t, version: 1, snapshot: json(snapshot), status: 'ACTIVE', actorUserId: null, reason: '첫 적용 전 기준선(자동)' } })
}

export interface NewVersionInput {
  snapshot: Record<string, unknown>
  diff: unknown
  actorUserId: string
  reason: string
  testResult: unknown
  restoredFromVersion: number | null
  /** 밀려나는 직전 ACTIVE 의 상태. */
  replacedStatus: Extract<ConfigVersionStatus, 'SUPERSEDED' | 'ROLLED_BACK'>
}

export async function writeVersion(tx: Tx, t: VersionTarget, input: NewVersionInput): Promise<{ row: ConfigurationVersion; previous: ConfigurationVersion | null }> {
  const previous = await activeVersion(t, tx)
  const now = new Date()
  if (previous) await tx.configurationVersion.updateMany({ where: { ...t, status: 'ACTIVE' }, data: { status: input.replacedStatus, supersededAt: now } })
  const row = await tx.configurationVersion.create({
    data: {
      ...t,
      version: await nextNumber(tx, t),
      snapshot: json(input.snapshot),
      diff: jsonOrNull(input.diff),
      status: 'ACTIVE',
      actorUserId: input.actorUserId,
      // CX-3 가 쓰기 전에 거부하지만 탐지 규칙이 다른 조각은 여기서 가린다(AuditLog.reason 과 같은 규칙).
      reason: maskText(input.reason).slice(0, 500),
      testResult: jsonOrNull(input.testResult),
      restoredFromVersion: input.restoredFromVersion,
    },
  })
  return { row, previous }
}

export async function findVersion(id: string): Promise<(ConfigurationVersion & { actor: { id: string; email: string } | null }) | null> {
  if (!id || id.length > 40) return null
  return prisma.configurationVersion.findUnique({ where: { id }, include: { actor: { select: { id: true, email: true } } } })
}

/** 같은 대상에서 이 버전 바로 앞 번호. */
export async function previousOf(v: Pick<ConfigurationVersion, 'environment' | 'scope' | 'targetId' | 'version'>): Promise<ConfigurationVersion | null> {
  return prisma.configurationVersion.findFirst({ where: { environment: v.environment, scope: v.scope, targetId: v.targetId, version: { lt: v.version } }, orderBy: { version: 'desc' } })
}

export interface VersionListFilter {
  environment: Environment
  scopes: readonly ConfigScope[]
  targetId?: string
  status?: ConfigVersionStatus
}

/** 최신순(createdAt desc, id desc) 커서 목록. */
export async function listVersionRows(f: VersionListFilter, page: { limit: number; cursor: { t: string; id: string } | null }): Promise<{ rows: (ConfigurationVersion & { actor: { id: string; email: string } | null })[]; hasMore: boolean }> {
  const where: Prisma.ConfigurationVersionWhereInput = {
    environment: f.environment,
    scope: { in: [...f.scopes] },
    ...(f.targetId ? { targetId: f.targetId } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(page.cursor
      ? { OR: [{ createdAt: { lt: new Date(page.cursor.t) } }, { createdAt: new Date(page.cursor.t), id: { lt: page.cursor.id } }] }
      : {}),
  }
  const rows = await prisma.configurationVersion.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: page.limit + 1,
    include: { actor: { select: { id: true, email: true } } },
  })
  return { rows: rows.slice(0, page.limit), hasMore: rows.length > page.limit }
}

/** 대상들의 ACTIVE 번호(목록 화면·대상 DTO). */
export async function activeVersionNumbers(environment: Environment, scope: ConfigScope, targetIds: readonly string[]): Promise<Map<string, number>> {
  if (targetIds.length === 0) return new Map()
  const rows = await prisma.configurationVersion.findMany({ where: { environment, scope, targetId: { in: [...targetIds] }, status: 'ACTIVE' }, select: { targetId: true, version: true } })
  return new Map(rows.map((r) => [r.targetId, r.version]))
}
