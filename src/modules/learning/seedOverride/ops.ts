/**
 * 시드 사용자별 관리 쓰기 연산(task-045 T1 — 계약 §4 "시드 override 알고리즘과 종료 불변식").
 * 모든 쓰기는 **한 트랜잭션 · 사용자 행 잠금(`lockUserRow`) 뒤**에 판정과 쓰기를 한다 — 같은 사용자의 fork·hide·restore 는 잠금에서 직렬화된다.
 *
 * - hide    : override 있음 → 무변경(이미 숨김/사본) · 없음 → `copyId=null` 행.
 * - fork    : override 있음 → 409 `ALREADY_COPIED` · 없음 → 사본(사용자 소유 행) 생성 + override 를 한 번에. **시드 행은 읽기만 한다.**
 * - restore : override 없음 → 404 · `copyId=null` → 행 삭제 · 사본 있음 → 사본에 삭제 규칙(주제 = 주입된 `TopicRemovalPort`, 상황 = #165 ARCHIVED)
 *             + override 삭제 · 고아(사본 행 없음/상황 ARCHIVED) → override 만 정리.
 * 쓰는 표: `UserSeedOverride` · 사본 `Scenario`·`ScenarioTopic`·`ConversationTopic`·`TopicChunk`(전부 그 사용자 소유 행만).
 * DB·트랜잭션·잠금·시계·주제 삭제 포트를 `SeedOverrideDeps` 로 받는다(단위 테스트는 메모리 가짜 — scenarios 의 ScenarioDeps 와 같은 방식).
 */
import type { Prisma } from '@prisma/client'
import { ApiError, dates, lockUserRow, prisma, withTransaction, type Tx } from '@/modules/infra'
import { SCENARIO_LIMITS } from '@/types/scenario'
import type { ForkSeedResult, HideSeedResult, RestoreSeedResult, SeedKind } from '@/types/seedOverride'
import { TOPIC_LIMITS, type TopicChunkInput, type TopicRemovalMode } from '@/types/topic'
import { archiveScenario, mergeScenarioFields } from '../scenarios/catalog'
import { isScenarioId as isRowId, normalizeScenarioInput } from '../scenarios/shape'
import { createOverride, deleteOverride, findOverride, isSeedKind, liveCopyIds, readOverride } from './store'
import { normalizeTopicInput, type TopicFieldProblem } from './topicInput'
import { resolvePlaceTopicIds } from './visibility'

/**
 * 주제 사본 삭제(계약 §4 주제 삭제 트랜잭션) — T3-1 이 `removeUserTopicTx` 로 구현해 주입한다. 호출자가 연 tx·사용자 잠금 안에서 불린다
 * (같은 tx 에서 다시 잠가도 InnoDB 는 막히지 않지만 필요 없다). `ack` 가 서버 판단과 다르면 409 `IMPACT_CHANGED` 를 던져 tx 전체를 되돌린다.
 * restoreSeed 는 `mode: 'RESTORE'` 로 부른다 — 사본에 붙은 내 상황을 시드 주제로 되돌려 붙이는 것도 포트 몫이다(영향 계산·`ack` 확인보다 먼저 쓰지 않게,
 * T3-1b). `mode` 를 빼면 `DELETE`(#173 지우기 규칙).
 */
export type TopicRemovalPort = (tx: Tx, userId: string, topicId: string, opts: { ack: string | null; mode?: TopicRemovalMode }) => Promise<Record<string, unknown>>

/** 포트 미연결 기본값 — 아무것도 쓰기 전에 던진다(트랜잭션 안 쓰기 0). */
export const topicRemovalUnavailable: TopicRemovalPort = async () => {
  throw new ApiError('FEATURE_NOT_READY', '지금은 내 버전 주제를 되돌릴 수 없어요. 잠시 뒤 다시 해 주세요.', { reason: 'TOPIC_REMOVAL_UNAVAILABLE' })
}

export interface SeedOverrideDeps {
  db: Tx
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>
  lockUser: (tx: Tx, userId: string) => Promise<boolean>
  now: () => Date
  removeTopic: TopicRemovalPort
}

export const defaultSeedOverrideDeps: SeedOverrideDeps = {
  db: prisma,
  transaction: (fn) => withTransaction(fn),
  lockUser: lockUserRow,
  now: () => new Date(),
  removeTopic: topicRemovalUnavailable,
}

const withDeps = (over?: Partial<SeedOverrideDeps>): SeedOverrideDeps => (over ? { ...defaultSeedOverrideDeps, ...over } : defaultSeedOverrideDeps)

/** KST 하루 시작 시각(상황 만들기 하루 한도 catalog.ts 와 같은 계산). */
const kstDayStart = (now: Date) => new Date(`${dates.todayKst(now)}T00:00:00+09:00`)

const optJson = (v: Prisma.JsonValue | null | undefined): Prisma.InputJsonValue | undefined => (v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue))

// ── 오류 ──────────────────────────────────────────────────────────────

function seedNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '찾을 수 없는 기본 항목이에요.', { reason: 'SEED_NOT_FOUND' })
}

function invalid(problems: readonly TopicFieldProblem[]): never {
  const first = problems[0]
  throw new ApiError('VALIDATION', first.message, { field: first.field, reason: first.reason, problems })
}

function alreadyCopied(state: 'HIDDEN' | 'COPIED' | null): ApiError {
  return new ApiError('CONFLICT', '이미 내 버전이 있거나 숨긴 항목이에요. 목록을 새로 고친 뒤 다시 해 주세요.', { reason: 'ALREADY_COPIED', ...(state ? { state } : {}) })
}

function dailyLimit(now: Date, start: Date, limit: number, message: string): ApiError {
  const retryAfterSec = Math.max(1, Math.ceil((start.getTime() + 86_400_000 - now.getTime()) / 1000))
  return new ApiError('RATE_LIMITED', message, { reason: 'DAILY_LIMIT', limit, retryAfterSec })
}

function checkKind(kind: unknown): SeedKind {
  if (!isSeedKind(kind)) throw new ApiError('VALIDATION', '종류가 올바르지 않아요.', { field: 'kind', reason: 'enum' })
  return kind
}

// ── 공용 단계 ─────────────────────────────────────────────────────────

/** 사용자 행 잠금 — 행이 없으면(계정이 사라진 세션) override INSERT 가 FK 위반 500 이 되기 전에 404 로 끝낸다(REV-150 L5). */
async function lockOrGone(d: Pick<SeedOverrideDeps, 'lockUser'>, tx: Tx, userId: string): Promise<void> {
  if (!(await d.lockUser(tx, userId))) throw new ApiError('NOT_FOUND', '사용자를 찾을 수 없어요.', { reason: 'USER_GONE' })
}

/** 공유 시드 행인가(주제 = `userId null`, 상황 = `userId null`·`isSeed`·ACTIVE). 시드가 아니거나 없으면 false. */
async function seedExists(tx: Tx, kind: SeedKind, seedId: string): Promise<boolean> {
  const row =
    kind === 'TOPIC'
      ? await tx.conversationTopic.findFirst({ where: { id: seedId, userId: null }, select: { id: true } })
      : await tx.scenario.findFirst({ where: { id: seedId, userId: null, isSeed: true, status: 'ACTIVE' }, select: { id: true } })
  return row !== null
}

/** fork 앞 확인 — override 가 있으면(숨김·사본·고아 모두) 409. */
async function assertNoOverride(tx: Tx, userId: string, kind: SeedKind, seedId: string): Promise<void> {
  const row = await findOverride(tx, userId, kind, seedId)
  if (!row) return
  throw alreadyCopied(readOverride(row, await liveCopyIds(tx, userId, kind, row.copyId ? [row.copyId] : [])).state)
}

/** override 기록. 잠금 아래라 겹칠 수 없지만, 유니크 위반(P2002)이 나면 덮어쓰지 않고 409 로 바꿔 tx 를 되돌린다. */
async function claimOverride(tx: Tx, userId: string, kind: SeedKind, seedId: string, copyId: string | null): Promise<void> {
  try {
    await createOverride(tx, userId, kind, seedId, copyId)
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === 'P2002') throw alreadyCopied(null)
    throw e
  }
}

/** 장소로 고른 주제 — 시드 또는 내 주제만(없으면 400, catalog.ts 와 같은 문구). */
async function checkedTopicIds(tx: Tx, userId: string, ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return []
  const found = new Set((await tx.conversationTopic.findMany({ where: { id: { in: [...ids] }, OR: [{ userId: null }, { userId }] }, select: { id: true } })).map((t) => t.id))
  const problems = ids.flatMap((t, i) => (found.has(t) ? [] : [{ field: `topicIds[${i}]`, reason: 'not_found', message: '고를 수 없는 장소예요. 다시 골라 주세요.' }]))
  if (problems.length) invalid(problems)
  return [...ids]
}

// ── hide ──────────────────────────────────────────────────────────────

/** 시드를 이 사용자 목록에서 숨긴다(#165·#173 의 시드 id 경로). 멱등 — 이미 숨김·사본이 있으면 무변경. */
export async function hideSeed(userId: string, kind: SeedKind, seedId: string, over?: Partial<SeedOverrideDeps>): Promise<HideSeedResult> {
  const d = withDeps(over)
  const k = checkKind(kind)
  if (!isRowId(seedId)) throw seedNotFound()
  return d.transaction(async (tx) => {
    await lockOrGone(d, tx, userId)
    if (!(await seedExists(tx, k, seedId))) throw seedNotFound()
    const row = await findOverride(tx, userId, k, seedId)
    if (row) return { kind: k, seedId, state: readOverride(row, await liveCopyIds(tx, userId, k, row.copyId ? [row.copyId] : [])).state, changed: false }
    await claimOverride(tx, userId, k, seedId, null)
    return { kind: k, seedId, state: 'HIDDEN', changed: true }
  })
}

// ── fork ──────────────────────────────────────────────────────────────

/**
 * #175 시드 상황 사본(저장 시점에 복사). 본문은 #164 와 같은 칸(빠진 칸은 시드 값). 사본은 시드의 `keyExpressions` id·`constraints.exprSeq`
 * 를 그대로 가진 채 시작하고 그 위에 `mergeScenarioFields` 를 적용한다 — 지난 역할극 기록의 표현 id 뜻이 사본에서도 같다.
 * 장소는 보낸 `topicIds`(없으면 시드 연결)를 이 사용자의 주제 사본으로 바꿔 잇는다. 한도는 내 상황과 공유(ACTIVE 50·하루 30).
 */
export async function forkSeedScenario(userId: string, seedScenarioId: string, body: Record<string, unknown>, over?: Partial<SeedOverrideDeps>): Promise<ForkSeedResult> {
  const d = withDeps(over)
  if (!isRowId(seedScenarioId)) throw seedNotFound()
  // 빈 본문 = 시드를 그대로 복사(고치기 #164 와 달리 "고칠 항목 없음"이 오류가 아니다).
  const { value: v, problems } = Object.keys(body).length ? normalizeScenarioInput(body, 'patch') : { value: {}, problems: [] }
  if (problems.length) invalid(problems)
  const copyId = await d.transaction(async (tx) => {
    await lockOrGone(d, tx, userId)
    const seed = await tx.scenario.findFirst({
      where: { id: seedScenarioId, userId: null, isSeed: true, status: 'ACTIVE' },
      select: {
        id: true, title: true, titleJa: true, description: true, level: true, difficulty: true, roles: true, goal: true,
        constraints: true, keyExpressions: true, grammarPoints: true, completionRule: true,
      },
    })
    if (!seed) throw seedNotFound()
    await assertNoOverride(tx, userId, 'SCENARIO', seedScenarioId)
    const active = await tx.scenario.count({ where: { userId, isSeed: false, status: 'ACTIVE' } })
    if (active >= SCENARIO_LIMITS.activePerUser) {
      throw new ApiError('CONFLICT', `내 상황은 ${SCENARIO_LIMITS.activePerUser}개까지 둘 수 있어요. 안 쓰는 상황을 지운 뒤 다시 저장해 주세요.`, { reason: 'SCENARIO_LIMIT', limit: SCENARIO_LIMITS.activePerUser })
    }
    const now = d.now()
    const start = kstDayStart(now)
    const made = await tx.scenario.count({ where: { userId, isSeed: false, createdAt: { gte: start } } })
    if (made >= SCENARIO_LIMITS.createPerDay) throw dailyLimit(now, start, SCENARIO_LIMITS.createPerDay, '오늘은 상황을 더 만들 수 없어요. 내일 다시 만들어 주세요.')
    const merged = mergeScenarioFields(seed, v)
    if (merged.problems.length) invalid(merged.problems)

    let links: { topicId: string; weight: number }[]
    if (v.topicIds !== undefined) {
      const ids = await checkedTopicIds(tx, userId, v.topicIds)
      links = ids.map((topicId, i) => ({ topicId, weight: ids.length - i }))
    } else {
      links = (await tx.scenarioTopic.findMany({ where: { scenarioId: seedScenarioId }, orderBy: [{ weight: 'desc' }, { topicId: 'asc' }] })).map((l) => ({ topicId: l.topicId, weight: l.weight }))
    }
    const place = await resolvePlaceTopicIds(tx, userId, links.map((l) => l.topicId))
    const seen = new Set<string>()
    const placed = links.map((l) => ({ topicId: place.get(l.topicId) ?? l.topicId, weight: l.weight })).filter((l) => !seen.has(l.topicId) && (seen.add(l.topicId), true))

    const copy = await tx.scenario.create({
      data: {
        userId,
        isSeed: false,
        status: 'ACTIVE',
        title: seed.title,
        titleJa: seed.titleJa,
        description: seed.description,
        level: seed.level,
        difficulty: seed.difficulty,
        roles: seed.roles as Prisma.InputJsonValue,
        goal: seed.goal as Prisma.InputJsonValue,
        constraints: optJson(seed.constraints),
        keyExpressions: seed.keyExpressions as Prisma.InputJsonValue,
        grammarPoints: optJson(seed.grammarPoints),
        completionRule: seed.completionRule as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    // 고친 칸은 사본에만 — 소유 조건(내 행·시드 아님)을 건 updateMany 라 시드 행에 닿을 수 없다.
    if (Object.keys(merged.data).length) await tx.scenario.updateMany({ where: { id: copy.id, userId, isSeed: false }, data: merged.data })
    if (placed.length) await tx.scenarioTopic.createMany({ data: placed.map((l) => ({ scenarioId: copy.id, topicId: l.topicId, weight: l.weight })) })
    await claimOverride(tx, userId, 'SCENARIO', seedScenarioId, copy.id)
    return copy.id
  })
  return { kind: 'SCENARIO', seedId: seedScenarioId, copyId, relinkedScenarioIds: [] }
}

/**
 * #174 시드 주제 사본(저장 시점에 복사). 본문은 #57 과 같은 칸(빠진 칸은 시드 값, `chunks` 를 빼면 시드 조각을 새 id 로 복사).
 * 조각은 언제나 새 `TopicChunk` 행이다(사본의 "주제 표현 진행"은 0부터 — 계약 §0 #9). 내 상황이 시드 주제에 붙어 있으면 연결을 사본으로 옮긴다
 * (시드 상황의 연결은 건드리지 않는다 — 읽을 때 `resolvePlaceTopicIds` 로 사본을 보인다). 한도 = 내 주제 30·하루 10.
 */
export async function forkSeedTopic(userId: string, seedTopicId: string, body: Record<string, unknown>, over?: Partial<SeedOverrideDeps>): Promise<ForkSeedResult> {
  const d = withDeps(over)
  if (!isRowId(seedTopicId)) throw seedNotFound()
  const { value: v, problems } = normalizeTopicInput(body)
  if (problems.length) invalid(problems)
  return d.transaction(async (tx) => {
    await lockOrGone(d, tx, userId)
    const seed = await tx.conversationTopic.findFirst({ where: { id: seedTopicId, userId: null }, select: { id: true, title: true, titleJa: true, level: true, description: true, tags: true } })
    if (!seed) throw seedNotFound()
    await assertNoOverride(tx, userId, 'TOPIC', seedTopicId)
    const mine = await tx.conversationTopic.count({ where: { userId, isSeed: false } })
    if (mine >= TOPIC_LIMITS.minePerUser) {
      throw new ApiError('CONFLICT', `내 주제는 ${TOPIC_LIMITS.minePerUser}개까지 둘 수 있어요. 안 쓰는 주제를 지운 뒤 다시 저장해 주세요.`, { reason: 'TOPIC_LIMIT', limit: TOPIC_LIMITS.minePerUser })
    }
    const now = d.now()
    const start = kstDayStart(now)
    const made = await tx.conversationTopic.count({ where: { userId, isSeed: false, createdAt: { gte: start } } })
    if (made >= TOPIC_LIMITS.createPerDay) throw dailyLimit(now, start, TOPIC_LIMITS.createPerDay, '오늘은 주제를 더 저장할 수 없어요. 내일 다시 저장해 주세요.')

    const chunks: TopicChunkInput[] =
      v.chunks ??
      (await tx.topicChunk.findMany({ where: { topicId: seedTopicId }, orderBy: [{ order: 'asc' }, { id: 'asc' }] })).map((c) => ({
        chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo, note: c.note,
      }))
    const copy = await tx.conversationTopic.create({
      data: {
        userId,
        isSeed: false,
        title: v.title ?? seed.title,
        titleJa: v.titleJa !== undefined ? v.titleJa : seed.titleJa,
        level: v.level ?? seed.level,
        description: v.description !== undefined ? v.description : seed.description,
        tags: optJson(seed.tags),
      },
      select: { id: true },
    })
    if (chunks.length) {
      await tx.topicChunk.createMany({
        data: chunks.map((c, i) => ({ topicId: copy.id, chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo, note: c.note ?? null, order: i })),
      })
    }
    // 내 상황(시드 아님)의 연결만 옮긴다 — where 에 내 상황 id 와 시드 주제 id 를 함께 걸어 시드 상황의 연결은 지울 수 없다.
    const myScenarioIds = (await tx.scenario.findMany({ where: { userId, isSeed: false }, select: { id: true } })).map((s) => s.id)
    const moved = myScenarioIds.length ? await tx.scenarioTopic.findMany({ where: { topicId: seedTopicId, scenarioId: { in: myScenarioIds } } }) : []
    if (moved.length) {
      await tx.scenarioTopic.deleteMany({ where: { topicId: seedTopicId, scenarioId: { in: moved.map((l) => l.scenarioId) } } })
      await tx.scenarioTopic.createMany({ data: moved.map((l) => ({ scenarioId: l.scenarioId, topicId: copy.id, weight: l.weight })) })
    }
    await claimOverride(tx, userId, 'TOPIC', seedTopicId, copy.id)
    return { kind: 'TOPIC', seedId: seedTopicId, copyId: copy.id, relinkedScenarioIds: moved.map((l) => l.scenarioId) }
  })
}

// ── restore ───────────────────────────────────────────────────────────

/**
 * #176 "기본으로 되돌리기"·숨긴 시드 다시 보기. 사본이 있으면 삭제 규칙을 같은 트랜잭션에서 적용한 뒤 override 를 지운다
 * (주제 사본 = 주입된 포트 — 포트가 던지면 override 도 남는다 · 상황 사본 = #165 ARCHIVED). 고아는 override 만 정리한다.
 * 주제 사본은 포트를 `mode: 'RESTORE'` 로 부른다 — 포트가 영향 계산·`ack` 확인 뒤 내 상황 연결을 사본 → 시드 주제로 돌려 옮기고(relink.ts, Leader 결정)
 * 사본을 지운다. 되돌리기로 내 상황이 보관되지 않고, 409 `IMPACT_CHANGED` 의 새 사전 조회도 옮기기 전 상태로 계산된다(T3-1b).
 * 포트가 던지면 tx 전체가 되돌려진다.
 */
export async function restoreSeed(
  userId: string,
  kind: SeedKind,
  seedId: string,
  opts: { ack?: string | null } = {},
  over?: Partial<SeedOverrideDeps>,
): Promise<RestoreSeedResult> {
  const d = withDeps(over)
  const k = checkKind(kind)
  if (!isRowId(seedId)) throw new ApiError('NOT_FOUND', '되돌릴 내용이 없어요.', { reason: 'NOT_OVERRIDDEN' })
  return d.transaction(async (tx) => {
    await lockOrGone(d, tx, userId)
    const row = await findOverride(tx, userId, k, seedId)
    if (!row) throw new ApiError('NOT_FOUND', '되돌릴 내용이 없어요.', { reason: 'NOT_OVERRIDDEN' })
    const base = { kind: k, seedId }
    if (row.copyId === null) {
      await deleteOverride(tx, userId, row.id)
      return { ...base, path: 'HIDDEN', copyId: null, removal: null }
    }
    const live = await liveCopyIds(tx, userId, k, [row.copyId])
    if (!live.has(row.copyId)) {
      await deleteOverride(tx, userId, row.id)
      return { ...base, path: 'ORPHAN', copyId: row.copyId, removal: null }
    }
    let removal: Record<string, unknown> | null = null
    if (k === 'TOPIC') removal = await d.removeTopic(tx, userId, row.copyId, { ack: opts.ack ?? null, mode: 'RESTORE' })
    else await archiveScenario(userId, row.copyId, { db: tx })
    await deleteOverride(tx, userId, row.id)
    return { ...base, path: 'COPY', copyId: row.copyId, removal }
  })
}

/** #176 본문 `{kind, seedId, ack?}` 해석(라우트용). */
export function parseSeedRefBody(body: Record<string, unknown>): { kind: SeedKind; seedId: string; ack: string | null } {
  const kind = checkKind(body.kind)
  if (!isRowId(body.seedId)) throw new ApiError('VALIDATION', '대상이 올바르지 않아요.', { field: 'seedId', reason: 'invalid' })
  const ack = body.ack === undefined || body.ack === null ? null : body.ack
  if (ack !== null && !(ack === 'none' || isRowId(ack))) throw new ApiError('VALIDATION', '확인 값이 올바르지 않아요.', { field: 'ack', reason: 'invalid' })
  return { kind, seedId: body.seedId, ack }
}
