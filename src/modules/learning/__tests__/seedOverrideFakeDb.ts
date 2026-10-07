/**
 * task-045 T1 단위 테스트용 메모리 DB — seedOverride 가 쓰는 Prisma 부분집합만 흉내 낸다(공유 DB 를 건드리지 않음).
 * - where 판정은 챌린지 가짜(`challengeFakeDb.matches`)를 쓴다. `select` 는 무시하고 행 전체 사본을 돌려준다.
 * - 모든 호출 앞에서 한 번 양보(setImmediate)해 동시에 돌린 트랜잭션이 실제로 끼어든다 — 잠금(`lockUser`)은 사용자별 FIFO 뮤텍스이고
 *   트랜잭션이 끝날 때 풀린다. 잠금을 빼면 끼어들기가 그대로 드러난다(경합 시험).
 * - `UserSeedOverride` 의 (userId, kind, seedId) 유니크와 `ScenarioTopic` 의 복합 PK (scenarioId, topicId)를 흉내 내 P2002 를 던진다(T3-1b, REV-150 L3).
 * - 롤백은 선택(`{ rollback: true }`) — 트랜잭션이 던지면 시작 때 표 전체로 되돌린다. 동시에 도는 트랜잭션이 있는 경합 시험에서는 켜지 않는다
 *   (다른 트랜잭션의 쓰기까지 되돌리므로). 기본값은 예전처럼 롤백 없음(쓰기 전에 판정하는지를 본다).
 */
import type { Tx } from '@/modules/infra'
import type { SeedOverrideDeps } from '../seedOverride'
import { matches } from './challengeFakeDb'

type Row = Record<string, unknown>
type Where = Record<string, unknown> | undefined

export interface SeedFakeTables {
  userSeedOverride: Row[]
  conversationTopic: Row[]
  topicChunk: Row[]
  scenario: Row[]
  scenarioTopic: Row[]
}

const tick = () => new Promise<void>((r) => setImmediate(r))

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o) => Object.entries(o as Record<string, 'asc' | 'desc'>))
  const val = (v: unknown) => (v instanceof Date ? v.getTime() : v)
  return [...rows].sort((a, b) => {
    for (const [k, d] of keys) {
      const x = val(a[k])
      const y = val(b[k])
      if (x === y) continue
      const c = (x as number | string) < (y as number | string) ? -1 : 1
      return d === 'asc' ? c : -c
    }
    return 0
  })
}

const uniqueKey: Partial<Record<keyof SeedFakeTables, (r: Row) => string>> = {
  userSeedOverride: (r) => `${String(r.userId)}|${String(r.kind)}|${String(r.seedId)}`,
  scenarioTopic: (r) => `${String(r.scenarioId)}|${String(r.topicId)}`,
}

export function seedOverrideFakeDb(now = new Date('2026-10-07T03:00:00.000Z'), opts: { rollback?: boolean } = {}) {
  const tables: SeedFakeTables = { userSeedOverride: [], conversationTopic: [], topicChunk: [], scenario: [], scenarioTopic: [] }
  const log: string[] = []
  const clock = { now }
  let seq = 0
  const delegate = (name: keyof SeedFakeTables) => {
    const rows = () => tables[name]
    const find = (a: { where?: Where; orderBy?: unknown; take?: number } = {}) => {
      let out = sortRows(rows().filter((r) => matches(r, a.where)), a.orderBy)
      if (typeof a.take === 'number') out = out.slice(0, a.take)
      return out.map((r) => structuredClone(r))
    }
    const stamp = (data: Row): Row => {
      const t = new Date(clock.now.getTime())
      return { id: `${name.slice(0, 3)}${String(++seq).padStart(5, '0')}`, createdAt: t, updatedAt: t, ...structuredClone(data) }
    }
    const assertUnique = (data: readonly Row[]) => {
      const key = uniqueKey[name]
      if (!key) return
      const seen = new Set(rows().map(key))
      for (const d of data) {
        if (seen.has(key(d))) throw Object.assign(new Error(`Unique constraint failed on ${name}`), { code: 'P2002', meta: { modelName: name } })
        seen.add(key(d))
      }
    }
    return {
      findMany: async (a?: { where?: Where; orderBy?: unknown; take?: number }) => (await tick(), log.push(`${name}.findMany`), find(a)),
      findFirst: async (a?: { where?: Where; orderBy?: unknown }) => (await tick(), log.push(`${name}.findFirst`), find({ ...a, take: 1 })[0] ?? null),
      count: async (a?: { where?: Where }) => (await tick(), log.push(`${name}.count`), find(a).length),
      create: async (a: { data: Row }) => {
        await tick()
        log.push(`${name}.create`)
        assertUnique([a.data])
        const row = stamp(a.data)
        rows().push(row)
        return structuredClone(row)
      },
      createMany: async (a: { data: Row[] }) => {
        await tick()
        log.push(`${name}.createMany`)
        assertUnique(a.data)
        for (const d of a.data) rows().push(stamp(d))
        return { count: a.data.length }
      },
      updateMany: async (a: { where: Where; data: Row }) => {
        await tick()
        log.push(`${name}.updateMany`)
        let count = 0
        for (const r of rows()) {
          if (!matches(r, a.where)) continue
          Object.assign(r, structuredClone(a.data), { updatedAt: new Date(clock.now.getTime()) })
          count++
        }
        return { count }
      },
      deleteMany: async (a: { where: Where }) => {
        await tick()
        log.push(`${name}.deleteMany`)
        const keep = rows().filter((r) => !matches(r, a.where))
        const count = rows().length - keep.length
        tables[name] = keep
        return { count }
      },
    }
  }
  const db = Object.fromEntries((Object.keys(tables) as (keyof SeedFakeTables)[]).map((k) => [k, delegate(k)])) as unknown as Tx

  const locks = new Map<string, Promise<void>>()
  const releases = new WeakMap<object, (() => void)[]>()
  const deps = (over: Partial<SeedOverrideDeps> = {}): Partial<SeedOverrideDeps> => ({
    db,
    now: () => new Date(clock.now.getTime()),
    transaction: async (fn) => {
      const tx = Object.create(db) as Tx
      const mine: (() => void)[] = []
      releases.set(tx, mine)
      const snapshot = opts.rollback ? structuredClone(tables) : null
      try {
        return await fn(tx)
      } catch (e) {
        if (snapshot) for (const k of Object.keys(tables) as (keyof SeedFakeTables)[]) tables[k] = snapshot[k]
        throw e
      } finally {
        for (const r of mine) r()
      }
    },
    lockUser: async (tx, userId) => {
      log.push('lockUser')
      const prev = locks.get(userId) ?? Promise.resolve()
      let release!: () => void
      const held = new Promise<void>((r) => (release = r))
      locks.set(userId, prev.then(() => held))
      releases.get(tx)?.push(release)
      await prev
      return true
    },
    ...over,
  })
  return { tables, log, clock, db, deps }
}

/** 불변식(계약 §4): override 마다 copyId=null 이거나, 그 사용자 소유 행(주제)·소유 ACTIVE 행(상황)을 가리킨다. 위반 목록. */
export function invariantViolations(t: SeedFakeTables): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const o of t.userSeedOverride) {
    const key = `${o.userId}|${o.kind}|${o.seedId}`
    if (seen.has(key)) out.push(`duplicate ${key}`)
    seen.add(key)
    if (o.copyId === null) continue
    const live =
      o.kind === 'TOPIC'
        ? t.conversationTopic.some((r) => r.id === o.copyId && r.userId === o.userId && r.isSeed === false)
        : t.scenario.some((r) => r.id === o.copyId && r.userId === o.userId && r.isSeed === false && r.status === 'ACTIVE')
    if (!live) out.push(`orphan ${key} -> ${String(o.copyId)}`)
  }
  return out
}
