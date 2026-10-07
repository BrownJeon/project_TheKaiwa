/**
 * task-041 단위 테스트용 메모리 DB — 챌린지 모듈이 쓰는 Prisma 부분집합(findMany·findFirst·findUnique·count·create·updateMany)만 흉내 낸다.
 * 공유 DB(개발·운영 같은 NAS)를 건드리지 않고 동시성·지연 전이·소유자 검사를 확인한다. 실제 DB 경합은 QA 라이브(`tests/live/challenge-*`).
 *
 * - `activeKey @unique` 를 지켜 위반이면 `{code:'P2002'}` 를 던진다(실제 Prisma 와 같은 코드).
 * - 트랜잭션은 롤백하지 않는다(테스트 경로의 실패 지점은 쓰기 전이다). 사용자 잠금은 사용자별 직렬화 — 트랜잭션이 끝날 때 푼다.
 * - 모든 호출을 `log` 에 남긴다 — "챌린지 경로가 쓰는 표는 `Challenge` 뿐 · AiJob·RequestTrace 행 0" 단언용.
 */
import { Prisma } from '@prisma/client'
import type { Tx } from '@/modules/infra'
import type { ChallengeDeps } from '../challenges'

type Row = Record<string, unknown>
type Where = Record<string, unknown> | undefined

const OPS = new Set(['in', 'notIn', 'not', 'lt', 'lte', 'gt', 'gte', 'equals'])
const isDate = (v: unknown): v is Date => v instanceof Date
const isOp = (c: unknown): c is Record<string, unknown> => !!c && typeof c === 'object' && !isDate(c) && !Array.isArray(c) && Object.keys(c).some((k) => OPS.has(k))

function eq(a: unknown, b: unknown): boolean {
  if (isDate(a) && isDate(b)) return a.getTime() === b.getTime()
  return a === b
}
function cmp(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null
  if (isDate(a) && isDate(b)) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  return null
}
function matchOp(v: unknown, op: Record<string, unknown>): boolean {
  for (const [k, x] of Object.entries(op)) {
    if (x === undefined) continue
    if (k === 'in' && !(x as unknown[]).some((y) => eq(v, y))) return false
    if (k === 'notIn' && (x as unknown[]).some((y) => eq(v, y))) return false
    if (k === 'equals' && !eq(v, x)) return false
    if (k === 'not' && (isOp(x) ? matchOp(v, x) : eq(v, x))) return false
    const c = cmp(v, x)
    if (k === 'lt' && !(c !== null && c < 0)) return false
    if (k === 'lte' && !(c !== null && c <= 0)) return false
    if (k === 'gt' && !(c !== null && c > 0)) return false
    if (k === 'gte' && !(c !== null && c >= 0)) return false
  }
  return true
}
export function matches(row: Row, where: Where, rel: Record<string, (row: Row) => Row | null> = {}): boolean {
  for (const [k, c] of Object.entries(where ?? {})) {
    if (c === undefined) continue
    if (k === 'OR') {
      if (!(c as Where[]).some((w) => matches(row, w, rel))) return false
      continue
    }
    if (k === 'AND') {
      if (!(c as Where[]).every((w) => matches(row, w, rel))) return false
      continue
    }
    if (rel[k]) {
      const target = rel[k](row)
      if (!target || !matches(target, c as Where)) return false
      continue
    }
    const v = row[k]
    if (isOp(c)) {
      if (!matchOp(v, c)) return false
    } else if (!eq(v ?? null, c)) return false
  }
  return true
}

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []
  const keys = list.flatMap((o) => Object.entries(o as Record<string, unknown>).filter(([, d]) => d === 'asc' || d === 'desc') as [string, 'asc' | 'desc'][])
  return [...rows].sort((a, b) => {
    for (const [k, d] of keys) {
      const c = cmp(a[k], b[k])
      if (c === null) {
        if (a[k] == null && b[k] != null) return d === 'asc' ? -1 : 1
        if (a[k] != null && b[k] == null) return d === 'asc' ? 1 : -1
        continue
      }
      if (c !== 0) return d === 'asc' ? c : -c
    }
    return 0
  })
}

export class P2002 extends Error {
  readonly code = 'P2002'
  constructor(readonly target: string) {
    super(`Unique constraint failed on ${target}`)
  }
}

export interface FakeTables {
  challenge: Row[]
  statsSnapshot: Row[]
  lesson: Row[]
  vocabSession: Row[]
  vocabAttempt: Row[]
  conversationTopic: Row[]
  topicChunk: Row[]
  repetitionItem: Row[]
  aiJob: Row[]
  requestTrace: Row[]
  /** task-045 T1-2 — 챌린지 만들기의 시드 가시성 확인(가려진 시드 주제 404). */
  userSeedOverride: Row[]
  /** task-045 T3 — 주제 삭제가 보관·연결 끊기를 하는 상황. */
  scenario: Row[]
  scenarioTopic: Row[]
  /** task-045 Codex C2 — 역할극 대화 만들기(conversation `createChatWithOpening`)가 상황 지우기와 같은 잠금을 타는지 보는 경합 시험. */
  chat: Row[]
  chatMessage: Row[]
}

/**
 * task-045 T3 선택 기능(기본 꺼짐 — 기존 시험의 동작은 그대로):
 * - `fk`: `Challenge`·`Lesson`·`VocabSession` 을 없는 주제로 만들면 Prisma 처럼 P2003(`<Model>_topicId_fkey (index)`).
 * - `rollback`: 트랜잭션이 던지면 시작 때의 표로 되돌린다(한 트랜잭션 원자성 확인용 — 동시에 도는 트랜잭션과 섞어 쓰지 않는다).
 * - `tick`: 모든 호출 앞에서 한 번 양보(setImmediate) — 동시에 돌린 트랜잭션이 실제로 끼어든다(잠금을 빼면 드러난다).
 * 주제 삭제(`conversationTopic.deleteMany`)는 늘 DB 와 같이 흉내 낸다: 기본 표현·상황 연결 Cascade, 챌린지·수업·세트 `topicId` SetNull.
 */
export interface FakeDbOptions {
  fk?: boolean
  rollback?: boolean
  tick?: boolean
}

const FK_MODELS: Partial<Record<string, string>> = { challenge: 'Challenge', lesson: 'Lesson', vocabSession: 'VocabSession' }

export interface FakeDb {
  tables: FakeTables
  log: string[]
  clock: { now: Date }
  db: Tx
  deps: (over?: Partial<ChallengeDeps>) => Partial<ChallengeDeps>
  /** 진행 중 확인(`challenge.findFirst` where status ACTIVE) 직전에 끼어드는 훅 — 동시성 재현용. */
  beforeActiveCheck: { fn: (() => Promise<void>) | null }
  /** `create` 직전 훅(T3 — 잠금 밖 주제 삭제 흉내 등). */
  beforeCreate: { fn: ((name: keyof FakeTables, data: Row) => Promise<void>) | null }
  /** 이 호출(`표.연산`)에서 오류를 던진다(T3 — 트랜잭션 중간 실패 주입). */
  fault: { at: string | null }
}

export function fakeDb(opts: FakeDbOptions = {}): FakeDb {
  const tables: FakeTables = {
    challenge: [], statsSnapshot: [], lesson: [], vocabSession: [], vocabAttempt: [], conversationTopic: [], topicChunk: [], repetitionItem: [], aiJob: [], requestTrace: [], userSeedOverride: [],
    scenario: [], scenarioTopic: [], chat: [], chatMessage: [],
  }
  const log: string[] = []
  const clock = { now: new Date('2026-10-06T00:00:00.000Z') }
  const beforeActiveCheck: FakeDb['beforeActiveCheck'] = { fn: null }
  const beforeCreate: FakeDb['beforeCreate'] = { fn: null }
  const fault: FakeDb['fault'] = { at: null }
  // 선택 기능이 꺼져 있으면 추가 await 가 없다 — 기존 동시성 시험의 마이크로태스크 순서를 바꾸지 않는다.
  const pause = () => new Promise<void>((r) => setImmediate(r))
  const enter = (call: string) => {
    log.push(call)
    if (fault.at === call) throw new Error(`injected fault at ${call}`)
  }
  let seq = 0
  const rels: Partial<Record<keyof FakeTables, Record<string, (row: Row) => Row | null>>> = {
    vocabAttempt: { session: (r) => tables.vocabSession.find((s) => s.id === r.sessionId) ?? null },
  }
  const delegate = (name: keyof FakeTables) => {
    const rows = () => tables[name]
    const find = (args: { where?: Where; orderBy?: unknown; take?: number } = {}) => {
      let out = rows().filter((r) => matches(r, args.where, rels[name]))
      out = sortRows(out, args.orderBy)
      if (typeof args.take === 'number') out = out.slice(0, args.take)
      return out.map((r) => ({ ...r }))
    }
    return {
      findMany: async (args?: { where?: Where; orderBy?: unknown; take?: number }) => {
        if (opts.tick) await pause()
        enter(`${name}.findMany`)
        return find(args)
      },
      findFirst: async (args?: { where?: Where; orderBy?: unknown }) => {
        if (opts.tick) await pause()
        enter(`${name}.findFirst`)
        if (name === 'challenge' && args?.where?.status === 'ACTIVE' && beforeActiveCheck.fn) await beforeActiveCheck.fn()
        return find({ ...args, take: 1 })[0] ?? null
      },
      findUnique: async (args: { where: Where }) => {
        if (opts.tick) await pause()
        enter(`${name}.findUnique`)
        return find({ where: args.where, take: 1 })[0] ?? null
      },
      count: async (args?: { where?: Where }) => {
        if (opts.tick) await pause()
        enter(`${name}.count`)
        return find(args).length
      },
      create: async (args: { data: Row }) => {
        if (opts.tick) await pause()
        enter(`${name}.create`)
        const now = new Date(clock.now.getTime())
        if (beforeCreate.fn) await beforeCreate.fn(name, args.data)
        const model = FK_MODELS[name]
        if (opts.fk && model && args.data.topicId != null && !tables.conversationTopic.some((t) => t.id === args.data.topicId)) {
          throw Object.assign(new Error(`Foreign key constraint violated on the constraint: \`${model}_topicId_fkey\``), { code: 'P2003', meta: { field_name: `${model}_topicId_fkey (index)` } })
        }
        const row: Row = { id: `${name.slice(0, 2)}${String(++seq).padStart(6, '0')}`, createdAt: now, updatedAt: now, ...args.data }
        if (name === 'challenge') {
          row.status ??= 'ACTIVE'
          row.result ??= null
          row.endedAt ??= null
          if (row.activeKey != null && tables.challenge.some((c) => c.activeKey === row.activeKey)) throw new P2002('Challenge_activeKey_key')
        }
        rows().push(row)
        return { ...row }
      },
      updateMany: async (args: { where: Where; data: Row }) => {
        if (opts.tick) await pause()
        enter(`${name}.updateMany`)
        let count = 0
        for (const r of rows()) {
          if (!matches(r, args.where)) continue
          for (const [k, v] of Object.entries(args.data)) r[k] = v === Prisma.DbNull || v === Prisma.JsonNull ? null : v
          r.updatedAt = new Date(clock.now.getTime())
          count++
        }
        return { count }
      },
      createMany: async (args: { data: Row[] }) => {
        if (opts.tick) await pause()
        enter(`${name}.createMany`)
        const now = new Date(clock.now.getTime())
        for (const d of args.data) rows().push({ id: `${name.slice(0, 2)}${String(++seq).padStart(6, '0')}`, createdAt: now, updatedAt: now, ...d })
        return { count: args.data.length }
      },
      deleteMany: async (args: { where: Where }) => {
        if (opts.tick) await pause()
        enter(`${name}.deleteMany`)
        const gone = rows().filter((r) => matches(r, args.where))
        tables[name] = rows().filter((r) => !matches(r, args.where))
        if (name === 'conversationTopic') {
          const ids = new Set(gone.map((t) => t.id))
          tables.topicChunk = tables.topicChunk.filter((c) => !ids.has(c.topicId))
          tables.scenarioTopic = tables.scenarioTopic.filter((l) => !ids.has(l.topicId))
          for (const t of [tables.challenge, tables.lesson, tables.vocabSession]) for (const r of t) if (ids.has(r.topicId)) r.topicId = null
        }
        return { count: gone.length }
      },
    }
  }
  const db = Object.fromEntries((Object.keys(tables) as (keyof FakeTables)[]).map((k) => [k, delegate(k)])) as unknown as Tx

  const tails = new Map<string, Promise<void>>()
  const held = new WeakMap<object, (() => void)[]>()
  const lockUser = async (tx: Tx, userId: string) => {
    log.push('lockUser')
    const prev = tails.get(userId) ?? Promise.resolve()
    let release!: () => void
    const mine = new Promise<void>((r) => (release = r))
    tails.set(userId, prev.then(() => mine))
    await prev
    held.get(tx)?.push(release)
    return true
  }
  const deps = (over: Partial<ChallengeDeps> = {}): Partial<ChallengeDeps> => ({
    db,
    now: () => new Date(clock.now.getTime()),
    transaction: async (fn) => {
      const tx = Object.create(db) as Tx
      // infra `lockUserRow`(`SELECT … FOR UPDATE`)를 쓰는 경로(수업 점유 claimLessonTx)도 같은 사용자 잠금을 탄다.
      Object.assign(tx, { $queryRaw: async (_sql: unknown, userId: string) => (await lockUser(tx, userId), [{ id: userId }]) })
      held.set(tx, [])
      const before = opts.rollback ? structuredClone(tables) : null
      try {
        return await fn(tx)
      } catch (e) {
        if (before) Object.assign(tables, before)
        throw e
      } finally {
        for (const release of held.get(tx) ?? []) release()
      }
    },
    lockUser,
    doneLessonCount: async (userId, topicId) => tables.lesson.filter((l) => l.userId === userId && l.topicId === topicId && l.status === 'DONE').length,
    dailyWordCount: async () => 10,
    ...over,
  })
  return { tables, log, clock, db, deps, beforeActiveCheck, beforeCreate, fault }
}

/** 이 KST 시각(`2026-10-06 09:00`)의 Date. */
export function kst(dateTime: string): Date {
  const [d, t] = dateTime.split(' ')
  return new Date(`${d}T${t ?? '00:00'}:00.000+09:00`)
}

/** 쓰기 호출(만들기·고치기) 중 `Challenge` 밖 표에 쓴 것. */
export function foreignWrites(log: readonly string[]): string[] {
  return log.filter((l) => /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)$/.test(l) && !l.startsWith('challenge.'))
}
