/**
 * UserSeedOverride 행 읽기·쓰기(task-045 T1). 소유 표 = `UserSeedOverride` 하나. 사본 판정을 위해 `ConversationTopic`·`Scenario` 를 읽기만 한다.
 * 모든 함수는 호출자가 넘긴 `db`(트랜잭션 클라이언트 또는 prisma)를 쓰는 순수 DB 함수다 — 잠금·트랜잭션은 ops.ts 가 연다.
 *
 * 불변식(계약 §4): 사용자·종류·시드 한 쌍마다 override 행이 없거나 / `copyId` 가 존재하는 그 사용자 소유 행을 가리키거나 / `copyId=null`(숨김).
 * 사본이 사라진 고아 행(FK 없음 — 주제 사본 하드 삭제, 상황 사본 ARCHIVED)은 **숨김으로 읽고** 되돌리기가 정리한다.
 */
import type { Tx } from '@/modules/infra'
import type { SeedKind, SeedOverrideDto } from '@/types/seedOverride'

export interface OverrideRow {
  id: string
  userId: string
  kind: string
  seedId: string
  copyId: string | null
  createdAt: Date
  updatedAt: Date
}

/** 한 사용자의 override 를 한 번에 읽는 상한(시드는 주제·상황 합쳐 수십~수백 개). */
export const SEED_OVERRIDE_LIST_MAX = 1000

export const isSeedKind = (v: unknown): v is SeedKind => v === 'TOPIC' || v === 'SCENARIO'

export async function findOverride(db: Tx, userId: string, kind: SeedKind, seedId: string): Promise<OverrideRow | null> {
  return db.userSeedOverride.findFirst({ where: { userId, kind, seedId } })
}

export async function listOverrideRows(db: Tx, userId: string, kind?: SeedKind): Promise<OverrideRow[]> {
  return db.userSeedOverride.findMany({
    where: { userId, ...(kind ? { kind } : {}) },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    take: SEED_OVERRIDE_LIST_MAX,
  })
}

/** 새 override 행. 같은 (사용자·종류·시드)가 이미 있으면 DB 유니크가 P2002 를 낸다 — 호출자(ops)가 잠금 아래에서 먼저 확인한다. */
export async function createOverride(db: Tx, userId: string, kind: SeedKind, seedId: string, copyId: string | null): Promise<OverrideRow> {
  return db.userSeedOverride.create({ data: { userId, kind, seedId, copyId } })
}

/** 소유 조건(userId)을 건 삭제 — 남의 행 id 를 받아도 지우지 못한다. */
export async function deleteOverride(db: Tx, userId: string, id: string): Promise<number> {
  return (await db.userSeedOverride.deleteMany({ where: { id, userId } })).count
}

/**
 * 사본을 지우는 경로(T3 #173 내 주제 삭제·#165 상황 지우기가 사본 id 에 대해 호출)가 같은 트랜잭션에서 부르는 정리 —
 * 그 사본을 가리키던 override 를 숨김(`copyId=null`)으로 바꿔 고아를 남기지 않는다. 바꾼 행 수.
 */
export async function detachCopy(db: Tx, userId: string, kind: SeedKind, copyId: string): Promise<number> {
  return (await db.userSeedOverride.updateMany({ where: { userId, kind, copyId }, data: { copyId: null } })).count
}

/** `detachCopy` 여러 개 한 번에(주제 삭제가 상황 사본 여러 개를 보관할 때, T3). */
export async function detachCopies(db: Tx, userId: string, kind: SeedKind, copyIds: readonly string[]): Promise<number> {
  if (!copyIds.length) return 0
  return (await db.userSeedOverride.updateMany({ where: { userId, kind, copyId: { in: [...copyIds] } }, data: { copyId: null } })).count
}

/** 이 행이 어떤 시드의 내 버전(사본)인가 — 그 override 또는 null(T3 주제 삭제·사전 조회). */
export async function findOverrideByCopy(db: Tx, userId: string, kind: SeedKind, copyId: string): Promise<OverrideRow | null> {
  return db.userSeedOverride.findFirst({ where: { userId, kind, copyId } })
}

/** 살아 있는 사본 id — 주제: 그 사용자 소유 행이 있음 · 상황: 그 사용자 소유 ACTIVE 행이 있음(ARCHIVED 사본은 지운 것으로 본다). */
export async function liveCopyIds(db: Tx, userId: string, kind: SeedKind, copyIds: readonly string[]): Promise<Set<string>> {
  const ids = [...new Set(copyIds)]
  if (!ids.length) return new Set()
  const rows: { id: string }[] =
    kind === 'TOPIC'
      ? await db.conversationTopic.findMany({ where: { id: { in: ids }, userId, isSeed: false }, select: { id: true } })
      : await db.scenario.findMany({ where: { id: { in: ids }, userId, isSeed: false, status: 'ACTIVE' }, select: { id: true } })
  return new Set(rows.map((r) => r.id))
}

export interface OverrideReading {
  state: 'HIDDEN' | 'COPIED'
  copyId: string | null
  orphan: boolean
}

/** override 한 행 → 상태. 사본이 살아 있지 않으면 숨김(고아)으로 읽는다. */
export function readOverride(row: Pick<OverrideRow, 'copyId'>, live: ReadonlySet<string>): OverrideReading {
  if (row.copyId === null) return { state: 'HIDDEN', copyId: null, orphan: false }
  if (live.has(row.copyId)) return { state: 'COPIED', copyId: row.copyId, orphan: false }
  return { state: 'HIDDEN', copyId: null, orphan: true }
}

/** 관리 화면용 — 이 사용자가 숨겼거나 고친 시드 목록(종류별 또는 전부). */
export async function listSeedOverrides(db: Tx, userId: string, kind?: SeedKind): Promise<SeedOverrideDto[]> {
  const rows = await listOverrideRows(db, userId, kind)
  const copies = (k: SeedKind) => rows.filter((r) => r.kind === k && r.copyId !== null).map((r) => r.copyId as string)
  // 트랜잭션 클라이언트에서도 부를 수 있게 차례로 읽는다(한 tx 연결에 쿼리를 겹쳐 보내지 않는다).
  const liveTopics = await liveCopyIds(db, userId, 'TOPIC', copies('TOPIC'))
  const liveScenarios = await liveCopyIds(db, userId, 'SCENARIO', copies('SCENARIO'))
  return rows.flatMap((r) => {
    if (!isSeedKind(r.kind)) return []
    const reading = readOverride(r, r.kind === 'TOPIC' ? liveTopics : liveScenarios)
    return [{ kind: r.kind, seedId: r.seedId, state: reading.state, copyId: reading.copyId, orphan: reading.orphan, updatedAt: r.updatedAt.toISOString() }]
  })
}
