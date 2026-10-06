/**
 * 상황 목록·상세·만들기·고치기·지우기(task-010d A3a — #161~#165). 소유 표 = `Scenario`·`ScenarioTopic`(쓰기는 이 둘만).
 * 읽기만 하는 표: `ConversationTopic`·`TopicChunk`(표기)·`LearningObservation`(지난 결과·끝낸 대화)·`RepetitionItem`(다음 학습일)·`Lesson`(오늘 끝낸 수업 주제).
 *
 * - 가시성: 시드(`userId null` + `isSeed`) 또는 내 상황만(start.ts `scenarioAccessWhere` 와 같은 조건). 남의 상황은 **404**(있는지 드러내지 않는다).
 *   목록·상세는 ACTIVE 만 — 지운(ARCHIVED) 상황 상세는 404 `details.reason='ARCHIVED'`(볼 수 있는 행일 때만 이유를 싣는다).
 * - 고치기·지우기: 내 상황(`userId = 나`, `isSeed=false`)만. 시드는 404 `reason='SEED'`, 지운 상황 고치기는 409 `ARCHIVED`, 지우기는 멱등(이미 지웠으면 200 `alreadyArchived`).
 * - 만들기 = 학습자가 [저장]한 순간(제안→채택의 채택, IMP-0021). 초안(S3)은 행을 만들지 않는다(A3b). 한도: ACTIVE ≤50(409 `SCENARIO_LIMIT`)·하루 30(429 `DAILY_LIMIT`).
 * - 진행 중 대화(`inProgressChatId`)는 Chat 이 L2 소유라 여기서 읽지 않는다 — 라우트가 conversation 의 후보 목록을 `openChats` 로 넘기면
 *   여기서 끝낸 대화(관측 `SCENARIO_COMPLETED`, refType Chat)를 빼고 붙인다(A3b 연결 전에는 칸이 없다).
 * - DB·트랜잭션·시계·잠금·학습자 수준을 `ScenarioDeps` 로 받는다(챌린지 store.ts 와 같은 방식 — 단위 테스트는 메모리 가짜).
 */
import type { JlptLevel, Prisma } from '@prisma/client'
import { ApiError, dates, decodeCursor, encodeCursor, isOffsetCursor, lockUserRow, parseLimit, prisma, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import {
  SCENARIO_LIMITS as L,
  type ScenarioArchiveResult,
  type ScenarioDetail,
  type ScenarioFieldProblem,
  type ScenarioLastAttempt,
  type ScenarioListItem,
  type ScenarioListResponse,
  type ScenarioOutcome,
  type ScenarioTopicRef,
} from '@/types/scenario'
import { readScenarioExpressions, scenarioChunkIds, scenarioRequiredExpressions, type ScenarioChunkRef, type ScenarioExpression } from './expressions'
import { SCENARIO_REPETITION_REF_TYPE, scenarioEndLookupSince } from './end'
import { recommendScenarios, type RecommendCandidate } from './recommend'
import {
  assignExpressionIds,
  completionRuleJson,
  constraintsJson,
  defaultRequiredExpressions,
  expressionsJson,
  goalJson,
  isScenarioId,
  maxExpressionSeq,
  normalizeScenarioInput,
  SCENARIO_LEVELS,
  storedExpressionSeq,
  type ScenarioFields,
} from './shape'
import { scenarioAccessWhere, scenarioNotFound } from './start'
import { expressionView, readScenarioGoal, readScenarioOpening, readScenarioRoles, readScenarioSteps } from './view'

/** 한 번에 읽는 후보 상한(시드 ≤ 수십 + 내 상황 ≤50). */
export const SCENARIO_CATALOG_MAX = 300
/**
 * 지난 결과(`last`)·추천 재료로 읽는 관측의 시간 창(일, REV-134 M-2). `LearningObservation` 인덱스가 `(userId, occurredAt)` 뿐이라(상황·종류 칸
 * 인덱스는 스키마 변경 — 사용자 DB 승인 필요, 보류) 창이 없으면 목록·상세마다 그 사용자 관측 전체를 훑는다. 180일 = 반복 간격 상한(7일)의 약 25배라
 * 다시 해 볼·복습할 상황 판단에는 충분하다. 창 밖의 지난 시도는 `last` 가 없지만, 종료 때 같은 tx 로 쓰는 `RepetitionItem(SCENARIO)` 가 남아
 * 추천은 "안 해 본 상황"이 아니라 복습 기준으로 본다(recommend.ts `recommendReasonOf`).
 */
export const SCENARIO_HISTORY_WINDOW_DAYS = 180

export interface ScenarioDeps {
  db: Tx
  transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>
  lockUser: (tx: Tx, userId: string) => Promise<boolean>
  now: () => Date
  learnerLevel: (userId: string) => Promise<JlptLevel>
}

export const defaultScenarioDeps: ScenarioDeps = {
  db: prisma,
  transaction: (fn) => withTransaction(fn),
  lockUser: lockUserRow,
  now: () => new Date(),
  learnerLevel: async (userId) => (await getProfile(userId)).level as JlptLevel,
}

const withDeps = (over?: Partial<ScenarioDeps>): ScenarioDeps => (over ? { ...defaultScenarioDeps, ...over } : defaultScenarioDeps)

/**
 * 진행 중 역할극 후보(라우트가 conversation 에서 읽어 넘긴다 — 상황마다 끝내지 않았을 수 있는 최근 대화). `at` = 정렬 시각(`lastMessageAt`),
 * `createdAt` = `Chat.createdAt`(끝낸 표식 조회의 시간 하한 — end.ts `scenarioEndLookupSince`, REV-134 M-2).
 */
export type OpenRolePlayChats = (userId: string, scenarioIds: string[]) => Promise<{ scenarioId: string; chatId: string; at: Date; createdAt: Date }[]>

export interface ScenarioReadOptions {
  openChats?: OpenRolePlayChats
}

// ── 쿼리 ──────────────────────────────────────────────────────────────

export interface ScenarioListQuery {
  topicId: string | null
  level: JlptLevel | null
  recommended: boolean
  mine: boolean
  limit: number
  offset: number
}

function bad(field: string, message: string, reason = 'invalid'): never {
  throw new ApiError('VALIDATION', message, { field, reason })
}

/** #161 `?topicId=&level=&recommended=1&mine=1&limit=&cursor=`. */
export function parseScenarioListQuery(q: URLSearchParams): ScenarioListQuery {
  for (const k of q.keys()) if (!['topicId', 'level', 'recommended', 'mine', 'limit', 'cursor'].includes(k)) bad(k, `지원하지 않는 조건입니다: ${k}`, 'unknown_key')
  const topicId = q.get('topicId') || null
  if (topicId !== null && !isScenarioId(topicId)) bad('topicId', 'topicId 가 올바르지 않습니다.', 'format')
  const level = q.get('level') || null
  if (level !== null && !(SCENARIO_LEVELS as readonly string[]).includes(level)) bad('level', 'level 은 N5~N1 입니다.', SCENARIO_LEVELS.join('|'))
  const flag = (k: string) => {
    const v = q.get(k)
    if (v !== null && v !== '' && v !== '0' && v !== '1') bad(k, `${k} 는 0 또는 1 입니다.`, '0|1')
    return v === '1'
  }
  return {
    topicId,
    level: level as JlptLevel | null,
    recommended: flag('recommended'),
    mine: flag('mine'),
    limit: parseLimit(q.get('limit'), L.listDefault, L.listMax),
    offset: decodeCursor(q.get('cursor'), isOffsetCursor)?.o ?? 0,
  }
}

// ── 카탈로그(목록·상세 공용) ───────────────────────────────────────────

const ROW_SELECT = {
  id: true, userId: true, isSeed: true, status: true, title: true, titleJa: true, description: true, level: true, difficulty: true,
  roles: true, goal: true, constraints: true, keyExpressions: true, completionRule: true, createdAt: true,
} as const

interface ScenarioRow {
  id: string
  userId: string | null
  isSeed: boolean
  status: string
  title: string
  titleJa: string | null
  description: string | null
  level: JlptLevel
  difficulty: number
  roles: Prisma.JsonValue
  goal: Prisma.JsonValue
  constraints: Prisma.JsonValue | null
  keyExpressions: Prisma.JsonValue
  completionRule: Prisma.JsonValue
  createdAt: Date
}

interface CatalogEntry {
  row: ScenarioRow
  expressions: ScenarioExpression[]
  item: ScenarioListItem
  /** 대표 주제의 만든 시각(시드 정렬 — 시드 주제 순서). */
  primaryTopicAt: Date | null
}

interface CatalogFilter {
  topicId?: string | null
  level?: JlptLevel | null
  mine?: boolean
  ids?: string[]
}

const OUTCOME_BY_OBS: Record<string, ScenarioOutcome> = { SUCCESS: 'ACHIEVED', PARTIAL: 'ALMOST', FAIL: 'NOT_YET', SKIPPED: 'NOT_YET' }
const OUTCOMES = new Set<string>(['ACHIEVED', 'ALMOST', 'NOT_YET'])
const LEVEL_RANK: Record<JlptLevel, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 }
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const nonNeg = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const cmpId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

async function buildCatalog(userId: string, f: CatalogFilter, d: ScenarioDeps, opts: ScenarioReadOptions): Promise<{ entries: CatalogEntry[]; recommendedIds: string[] }> {
  const db = d.db
  let idFilter: string[] | null = f.ids ?? null
  if (f.topicId) {
    const linked = (await db.scenarioTopic.findMany({ where: { topicId: f.topicId }, select: { scenarioId: true }, take: SCENARIO_CATALOG_MAX })).map((r) => r.scenarioId)
    idFilter = idFilter ? idFilter.filter((id) => linked.includes(id)) : linked
  }
  if (idFilter && !idFilter.length) return { entries: [], recommendedIds: [] }
  const rows: ScenarioRow[] = await db.scenario.findMany({
    where: {
      status: 'ACTIVE',
      ...(f.level ? { level: f.level } : {}),
      ...(idFilter ? { id: { in: idFilter } } : {}),
      ...(f.mine ? { userId, isSeed: false } : { OR: [{ userId: null, isSeed: true }, { userId }] }),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: SCENARIO_CATALOG_MAX,
    select: ROW_SELECT,
  })
  if (!rows.length) return { entries: [], recommendedIds: [] }
  const ids = rows.map((r) => r.id)
  const now = d.now()
  const today = dates.todayKst(now)

  const links = await db.scenarioTopic.findMany({ where: { scenarioId: { in: ids } }, select: { scenarioId: true, topicId: true, weight: true } })
  const topicRows = links.length
    ? await db.conversationTopic.findMany({ where: { id: { in: [...new Set(links.map((l) => l.topicId))] }, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true, titleJa: true, createdAt: true } })
    : []
  const topicById = new Map(topicRows.map((t) => [t.id, t]))
  if (f.topicId && !topicById.has(f.topicId)) return { entries: [], recommendedIds: [] }
  const chunkIds = [...new Set(rows.flatMap((r) => scenarioChunkIds(r.keyExpressions)))]
  const chunkRows = chunkIds.length ? await db.topicChunk.findMany({ where: { id: { in: chunkIds } }, select: { id: true, textJa: true, reading: true, meaningKo: true, chunkType: true } }) : []
  const chunks = new Map<string, ScenarioChunkRef>(chunkRows.map((c) => [c.id, c]))

  const obs = await db.learningObservation.findMany({
    where: { userId, occurredAt: { gte: new Date(now.getTime() - SCENARIO_HISTORY_WINDOW_DAYS * 86_400_000) }, kind: 'SCENARIO_COMPLETED', scenarioId: { in: ids } },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    take: 2000,
    select: { scenarioId: true, occurredAt: true, outcome: true, meta: true },
  })
  const last = new Map<string, { at: Date; day: string; outcome: ScenarioOutcome; usedCount: number; totalCount: number }>()
  for (const o of obs) {
    if (!o.scenarioId || last.has(o.scenarioId)) continue
    const m = rec(o.meta)
    const outcome = typeof m.outcome === 'string' && OUTCOMES.has(m.outcome) ? (m.outcome as ScenarioOutcome) : (OUTCOME_BY_OBS[o.outcome] ?? 'NOT_YET')
    last.set(o.scenarioId, { at: o.occurredAt, day: dates.todayKst(o.occurredAt), outcome, usedCount: nonNeg(m.used), totalCount: nonNeg(m.total) })
  }
  const reps = await db.repetitionItem.findMany({ where: { userId, refType: SCENARIO_REPETITION_REF_TYPE, refId: { in: ids } }, select: { refId: true, nextDueAt: true, priority: true } })
  const repetition = new Map(reps.map((r) => [r.refId, { nextDue: r.nextDueAt ? dates.fromDbDate(r.nextDueAt) : null, priority: r.priority }]))
  const focusTopicId =
    f.topicId ??
    (await db.lesson.findFirst({ where: { userId, status: 'DONE', date: dates.toDbDate(today), topicId: { not: null } }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], select: { topicId: true } }))?.topicId ??
    null

  const inProgress = new Map<string, string>()
  if (opts.openChats) {
    // 생성 시각을 모르는 후보는 끝냈는지 범위로 확인할 수 없어 뺀다(진행 중으로 잘못 보이는 것보다 새로 시작하게 하는 쪽이 안전).
    const open = (await opts.openChats(userId, ids)).filter((c) => ids.includes(c.scenarioId) && isScenarioId(c.chatId) && scenarioEndLookupSince(c.createdAt) !== null)
    const since = open.length ? scenarioEndLookupSince(new Date(Math.min(...open.map((c) => c.createdAt.getTime())))) : null
    const ended =
      open.length && since
        ? new Set(
            (await db.learningObservation.findMany({ where: { userId, occurredAt: { gte: since }, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: { in: open.map((c) => c.chatId) } }, select: { refId: true } })).map(
              (o) => o.refId,
            ),
          )
        : new Set<string>()
    const latest = new Map<string, { chatId: string; at: Date }>()
    for (const c of open) {
      if (ended.has(c.chatId)) continue
      const prev = latest.get(c.scenarioId)
      if (!prev || c.at.getTime() > prev.at.getTime()) latest.set(c.scenarioId, { chatId: c.chatId, at: c.at })
    }
    for (const [sid, v] of latest) inProgress.set(sid, v.chatId)
  }

  const linksBy = new Map<string, { topicId: string; weight: number }[]>()
  for (const l of links) if (topicById.has(l.topicId)) linksBy.set(l.scenarioId, [...(linksBy.get(l.scenarioId) ?? []), l])
  const candidates: RecommendCandidate[] = []
  const entries: CatalogEntry[] = rows.map((row) => {
    const own = (linksBy.get(row.id) ?? []).sort((a, b) => b.weight - a.weight || cmpId(a.topicId, b.topicId))
    const topics: ScenarioTopicRef[] = own.map((l) => {
      const t = topicById.get(l.topicId)!
      return { id: t.id, title: t.title, titleJa: t.titleJa }
    })
    candidates.push({ id: row.id, level: row.level, difficulty: row.difficulty, createdAt: row.createdAt, topicWeights: new Map(own.map((l) => [l.topicId, l.weight])) })
    const expressions = readScenarioExpressions(row.keyExpressions, chunks)
    const l = last.get(row.id)
    const lastView: ScenarioLastAttempt | undefined = l ? { at: l.at.toISOString(), outcome: l.outcome, usedCount: l.usedCount, totalCount: l.totalCount } : undefined
    const chatId = inProgress.get(row.id)
    const item: ScenarioListItem = {
      id: row.id,
      title: row.title,
      titleJa: row.titleJa,
      level: row.level,
      difficulty: row.difficulty,
      isMine: row.userId === userId && !row.isSeed,
      roles: readScenarioRoles(row.roles),
      goalKo: readScenarioGoal(row.goal).communicativeGoalKo,
      stepCount: readScenarioSteps(row.constraints, row.goal).length,
      expressionCount: expressions.length,
      topics,
      recommended: false,
      ...(lastView ? { last: lastView } : {}),
      ...(chatId ? { inProgressChatId: chatId } : {}),
    }
    return { row, expressions, item, primaryTopicAt: own.length ? topicById.get(own[0].topicId)!.createdAt : null }
  })
  const recos = recommendScenarios(candidates, { today, learnerLevel: await d.learnerLevel(userId), last, repetition, focusTopicId })
  const byId = new Map(entries.map((e) => [e.row.id, e]))
  for (const r of recos) {
    const e = byId.get(r.id)!
    e.item.recommended = true
    e.item.recommendReason = r.reason
  }
  return { entries, recommendedIds: recos.map((r) => r.id) }
}

/** 목록 순서: 내 상황(최근 만든 것 먼저) → 시드(대표 주제 순서 → 난이도 → 수준 → 만든 순). */
function catalogOrder(a: CatalogEntry, b: CatalogEntry): number {
  if (a.item.isMine !== b.item.isMine) return a.item.isMine ? -1 : 1
  if (a.item.isMine) return b.row.createdAt.getTime() - a.row.createdAt.getTime() || cmpId(b.row.id, a.row.id)
  const ta = a.primaryTopicAt?.getTime() ?? Number.MAX_SAFE_INTEGER
  const tb = b.primaryTopicAt?.getTime() ?? Number.MAX_SAFE_INTEGER
  return ta - tb || a.row.difficulty - b.row.difficulty || LEVEL_RANK[a.row.level] - LEVEL_RANK[b.row.level] || a.row.createdAt.getTime() - b.row.createdAt.getTime() || cmpId(a.row.id, b.row.id)
}

/** #161 목록 — `recommended=1` 이면 추천만(추천 순서), 아니면 전체(위 순서)에 추천 표시. 커서 = 오프셋. */
export async function listScenarios(userId: string, q: ScenarioListQuery, over?: Partial<ScenarioDeps>, opts: ScenarioReadOptions = {}): Promise<ScenarioListResponse> {
  const d = withDeps(over)
  const { entries, recommendedIds } = await buildCatalog(userId, { topicId: q.topicId, level: q.level, mine: q.mine }, d, opts)
  const ordered = q.recommended
    ? recommendedIds.map((id) => entries.find((e) => e.row.id === id)!)
    : [...entries].sort(catalogOrder)
  const page = ordered.slice(q.offset, q.offset + q.limit)
  const more = q.offset + q.limit < ordered.length
  return { items: page.map((e) => e.item), nextCursor: more ? encodeCursor({ o: q.offset + q.limit }) : null, recommendedIds }
}

function detailOf(e: CatalogEntry): ScenarioDetail {
  const opening = readScenarioOpening(e.row.constraints, e.row.goal)
  return {
    ...e.item,
    description: e.row.description,
    goal: readScenarioGoal(e.row.goal),
    steps: readScenarioSteps(e.row.constraints, e.row.goal),
    keyExpressions: e.expressions.map(expressionView),
    requiredExpressions: scenarioRequiredExpressions(e.row.completionRule, e.expressions.length),
    ...(opening ? { opening } : {}),
  }
}

/** #162 상세 — 시드·내 상황, ACTIVE 만. 추천 표시는 전체 목록 기준(카드와 같은 값). */
export async function getScenarioDetail(userId: string, id: string, over?: Partial<ScenarioDeps>, opts: ScenarioReadOptions = {}): Promise<ScenarioDetail> {
  const d = withDeps(over)
  if (!isScenarioId(id)) throw scenarioNotFound()
  const row = await d.db.scenario.findFirst({ where: scenarioAccessWhere(userId, id), select: { id: true, status: true } })
  if (!row) throw scenarioNotFound()
  if (row.status !== 'ACTIVE') throw new ApiError('NOT_FOUND', '상황을 찾을 수 없어요.', { reason: 'ARCHIVED' })
  const all = await buildCatalog(userId, {}, d, opts)
  const hit = all.entries.find((e) => e.row.id === id) ?? (await buildCatalog(userId, { ids: [id] }, d, opts)).entries[0]
  if (!hit) throw scenarioNotFound()
  return detailOf(hit)
}

// ── 만들기·고치기·지우기 ──────────────────────────────────────────────

function invalid(problems: ScenarioFieldProblem[]): never {
  const first = problems[0]
  throw new ApiError('VALIDATION', first.message, { field: first.field, reason: first.reason, problems })
}

/** 장소(주제) — 시드 또는 내 주제만. 없으면 400(칸 문구). */
async function visibleTopicIds(tx: Tx, userId: string, ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return []
  const found = new Set((await tx.conversationTopic.findMany({ where: { id: { in: [...ids] }, OR: [{ userId: null }, { userId }] }, select: { id: true } })).map((t) => t.id))
  const problems = ids.flatMap((t, i) => (found.has(t) ? [] : [{ field: `topicIds[${i}]`, reason: 'not_found', message: '고를 수 없는 장소예요. 다시 골라 주세요.' }]))
  if (problems.length) invalid(problems)
  return [...ids]
}

/** KST 하루 시작 시각. */
const kstDayStart = (now: Date) => new Date(`${dates.todayKst(now)}T00:00:00+09:00`)

async function replaceTopicLinks(tx: Tx, scenarioId: string, topicIds: readonly string[]): Promise<void> {
  await tx.scenarioTopic.deleteMany({ where: { scenarioId } })
  if (topicIds.length) await tx.scenarioTopic.createMany({ data: topicIds.map((topicId, i) => ({ scenarioId, topicId, weight: topicIds.length - i })) })
}

/** #163 만들기 — 학습자가 [저장]할 때만(제안→채택). 응답 = 상세. */
export async function createScenario(userId: string, body: Record<string, unknown>, over?: Partial<ScenarioDeps>, opts: ScenarioReadOptions = {}): Promise<ScenarioDetail> {
  const d = withDeps(over)
  const { value: v, problems } = normalizeScenarioInput(body, 'create')
  if (problems.length) invalid(problems)
  const exprs = v.keyExpressions!
  const ids = assignExpressionIds(exprs, new Set())
  const required = v.requiredExpressions ?? defaultRequiredExpressions(exprs.length)
  const id = await d.transaction(async (tx) => {
    await d.lockUser(tx, userId)
    const active = await tx.scenario.count({ where: { userId, isSeed: false, status: 'ACTIVE' } })
    if (active >= L.activePerUser) throw new ApiError('CONFLICT', `내 상황은 ${L.activePerUser}개까지 둘 수 있어요. 안 쓰는 상황을 지운 뒤 다시 저장해 주세요.`, { reason: 'SCENARIO_LIMIT', limit: L.activePerUser })
    const now = d.now()
    const start = kstDayStart(now)
    const made = await tx.scenario.count({ where: { userId, isSeed: false, createdAt: { gte: start } } })
    if (made >= L.createPerDay) {
      const retryAfterSec = Math.max(1, Math.ceil((start.getTime() + 86_400_000 - now.getTime()) / 1000))
      throw new ApiError('RATE_LIMITED', '오늘은 상황을 더 만들 수 없어요. 내일 다시 만들어 주세요.', { reason: 'DAILY_LIMIT', limit: L.createPerDay, retryAfterSec })
    }
    const topicIds = await visibleTopicIds(tx, userId, v.topicIds ?? [])
    const row = await tx.scenario.create({
      data: {
        userId,
        isSeed: false,
        status: 'ACTIVE',
        title: v.title!,
        titleJa: v.titleJa ?? null,
        description: v.description ?? null,
        level: v.level!,
        difficulty: v.difficulty ?? 2,
        roles: { learner: v.roles!.learner, tutor: v.roles!.tutor },
        goal: goalJson(v.goal!),
        constraints: constraintsJson(null, v.steps!, v.opening ?? null, maxExpressionSeq(ids)) as Prisma.InputJsonValue,
        keyExpressions: expressionsJson(exprs, ids) as Prisma.InputJsonValue,
        completionRule: completionRuleJson(null, required) as Prisma.InputJsonValue,
      },
      select: { id: true },
    })
    await replaceTopicLinks(tx, row.id, topicIds)
    return row.id
  })
  return getScenarioDetail(userId, id, d, opts)
}

/** 저장된 행 + 고친 칸 → 쓸 칸. 필수 표현 수는 (보낸 값 | 저장 값)을 새 표현 수로 다시 본다. */
export function mergeScenarioFields(row: Pick<ScenarioRow, 'constraints' | 'keyExpressions' | 'completionRule'>, v: ScenarioFields): { data: Prisma.ScenarioUpdateManyMutationInput; problems: ScenarioFieldProblem[] } {
  const problems: ScenarioFieldProblem[] = []
  const data: Prisma.ScenarioUpdateManyMutationInput = {}
  if (v.title !== undefined) data.title = v.title
  if (v.titleJa !== undefined) data.titleJa = v.titleJa
  if (v.description !== undefined) data.description = v.description
  if (v.level !== undefined) data.level = v.level
  if (v.difficulty !== undefined) data.difficulty = v.difficulty
  if (v.roles !== undefined) data.roles = { learner: v.roles.learner, tutor: v.roles.tutor }
  if (v.goal !== undefined) data.goal = goalJson(v.goal)
  const stored = readScenarioExpressions(row.keyExpressions)
  const count = v.keyExpressions?.length ?? stored.length
  let exprSeq: number | undefined
  if (v.keyExpressions !== undefined) {
    const floor = storedExpressionSeq(row.constraints, stored.map((e) => e.id))
    const ids = assignExpressionIds(v.keyExpressions, new Set(stored.map((e) => e.id)), false, floor)
    data.keyExpressions = expressionsJson(v.keyExpressions, ids) as Prisma.InputJsonValue
    exprSeq = Math.max(floor, maxExpressionSeq(ids))
  }
  if (v.steps !== undefined || v.opening !== undefined || exprSeq !== undefined) data.constraints = constraintsJson(row.constraints, v.steps, v.opening, exprSeq) as Prisma.InputJsonValue
  if (v.requiredExpressions !== undefined || v.keyExpressions !== undefined) {
    const storedRequired = rec(row.completionRule).requiredExpressions
    // 보낸 값은 그대로 검사하고, 저장 값은 새 표현 수에 맞춰 줄인다(표현을 지워 필수 수가 넘쳐도 400 이 아니라 자동으로 맞춤).
    const want = v.requiredExpressions ?? Math.max(1, Math.min(count, typeof storedRequired === 'number' ? Math.floor(storedRequired) : defaultRequiredExpressions(count)))
    if (want < 1 || want > count) problems.push({ field: 'requiredExpressions', reason: `range 1-${count}`, message: `필수 표현 수는 1~${count} 사이예요.` })
    else data.completionRule = completionRuleJson(row.completionRule, want) as Prisma.InputJsonValue
  }
  return { data, problems }
}

/**
 * #164 고치기 — 내 상황(시드 아님·ACTIVE)만. 보낸 칸만 바꾼다. 표현 id 는 기존 것을 유지하고 새 표현은 고수위(`constraints.exprSeq`) 다음 번호 —
 * 여러 번 고쳐도 지운 번호를 다시 주지 않는다(지난 기록의 쓴 표현 id 가 그대로 뜻을 갖게).
 */
export async function updateScenario(userId: string, id: string, body: Record<string, unknown>, over?: Partial<ScenarioDeps>, opts: ScenarioReadOptions = {}): Promise<ScenarioDetail> {
  const d = withDeps(over)
  if (!isScenarioId(id)) throw scenarioNotFound()
  const { value: v, problems } = normalizeScenarioInput(body, 'patch')
  if (problems.length) invalid(problems)
  await d.transaction(async (tx) => {
    await d.lockUser(tx, userId)
    const row = await tx.scenario.findFirst({ where: scenarioAccessWhere(userId, id), select: { id: true, userId: true, isSeed: true, status: true, constraints: true, keyExpressions: true, completionRule: true } })
    if (!row) throw scenarioNotFound()
    if (row.userId !== userId || row.isSeed) throw new ApiError('NOT_FOUND', '이 상황은 고칠 수 없어요.', { reason: 'SEED' })
    if (row.status !== 'ACTIVE') throw new ApiError('CONFLICT', '지운 상황은 고칠 수 없어요.', { reason: 'ARCHIVED' })
    const merged = mergeScenarioFields(row, v)
    if (merged.problems.length) invalid(merged.problems)
    const topicIds = v.topicIds !== undefined ? await visibleTopicIds(tx, userId, v.topicIds) : null
    // 2차 방벽(REV-134 후속): 쓰기는 소유 조건(userId·시드 아님·ACTIVE)이 걸린 updateMany 가 정확히 1행을 바꾼 **뒤에만** 연결을 바꾼다 —
    // 위 소유자 조회가 빠지거나 틀려도 남의 상황·시드의 ScenarioTopic 을 지우지 못한다. 장소만 고칠 때도 updatedAt 으로 같은 조건을 거친다.
    if (Object.keys(merged.data).length || topicIds !== null) {
      const res = await tx.scenario.updateMany({ where: { id, userId, isSeed: false, status: 'ACTIVE' }, data: Object.keys(merged.data).length ? merged.data : { updatedAt: d.now() } })
      if (res.count !== 1) throw scenarioNotFound()
      if (topicIds !== null) await replaceTopicLinks(tx, id, topicIds)
    }
  })
  return getScenarioDetail(userId, id, d, opts)
}

/** #165 지우기 = ARCHIVED(목록·새 역할극에서 빠짐, 지난 역할극·기록·진행 중 대화는 그대로). 멱등. */
export async function archiveScenario(userId: string, id: string, over?: Partial<ScenarioDeps>): Promise<ScenarioArchiveResult> {
  const d = withDeps(over)
  if (!isScenarioId(id)) throw scenarioNotFound()
  const row = await d.db.scenario.findFirst({ where: scenarioAccessWhere(userId, id), select: { id: true, userId: true, isSeed: true, status: true } })
  if (!row) throw scenarioNotFound()
  if (row.userId !== userId || row.isSeed) throw new ApiError('NOT_FOUND', '이 상황은 지울 수 없어요.', { reason: 'SEED' })
  if (row.status === 'ARCHIVED') return { id, status: 'ARCHIVED', alreadyArchived: true }
  await d.db.scenario.updateMany({ where: { id, userId, isSeed: false }, data: { status: 'ARCHIVED' } })
  return { id, status: 'ARCHIVED', alreadyArchived: false }
}
