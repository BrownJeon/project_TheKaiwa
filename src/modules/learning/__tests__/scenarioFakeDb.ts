/**
 * task-010d A3a 단위 테스트용 메모리 DB — 상황 목록·상세·만들기·고치기·지우기가 쓰는 Prisma 부분집합만 흉내 낸다(공유 DB 를 건드리지 않음).
 * where 판정은 챌린지 가짜(`challengeFakeDb.matches`)를 그대로 쓴다. `select` 는 무시하고 행 전체 사본을 돌려준다.
 * 모든 호출을 `log` 에 남긴다 — "쓰는 표는 Scenario·ScenarioTopic 뿐" 단언용.
 */
import type { Tx } from '@/modules/infra'
import type { ScenarioDeps } from '../scenarios'
import { matches } from './challengeFakeDb'

type Row = Record<string, unknown>
type Where = Record<string, unknown> | undefined

export interface ScenarioFakeTables {
  scenario: Row[]
  scenarioTopic: Row[]
  conversationTopic: Row[]
  topicChunk: Row[]
  learningObservation: Row[]
  repetitionItem: Row[]
  lesson: Row[]
}

function sortRows(rows: Row[], orderBy: unknown): Row[] {
  const list = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []) as Record<string, 'asc' | 'desc'>[]
  const keys = list.flatMap((o) => Object.entries(o))
  const val = (v: unknown) => (v instanceof Date ? v.getTime() : v)
  return [...rows].sort((a, b) => {
    for (const [k, d] of keys) {
      const x = val(a[k])
      const y = val(b[k])
      if (x === y) continue
      if (x == null) return d === 'asc' ? -1 : 1
      if (y == null) return d === 'asc' ? 1 : -1
      const c = (x as number | string) < (y as number | string) ? -1 : 1
      return d === 'asc' ? c : -c
    }
    return 0
  })
}

export function scenarioFakeDb(now = new Date('2026-10-07T03:00:00.000Z')) {
  const tables: ScenarioFakeTables = { scenario: [], scenarioTopic: [], conversationTopic: [], topicChunk: [], learningObservation: [], repetitionItem: [], lesson: [] }
  const log: string[] = []
  const clock = { now }
  let seq = 0
  const delegate = (name: keyof ScenarioFakeTables) => {
    const rows = () => tables[name]
    const find = (args: { where?: Where; orderBy?: unknown; take?: number } = {}) => {
      let out = sortRows(rows().filter((r) => matches(r, args.where)), args.orderBy)
      if (typeof args.take === 'number') out = out.slice(0, args.take)
      return out.map((r) => ({ ...r }))
    }
    const stamp = (data: Row): Row => {
      const t = new Date(clock.now.getTime())
      return { id: `${name.slice(0, 3)}${String(++seq).padStart(5, '0')}`, createdAt: t, updatedAt: t, ...data }
    }
    return {
      findMany: async (a?: { where?: Where; orderBy?: unknown; take?: number }) => (log.push(`${name}.findMany`), find(a)),
      findFirst: async (a?: { where?: Where; orderBy?: unknown }) => (log.push(`${name}.findFirst`), find({ ...a, take: 1 })[0] ?? null),
      count: async (a?: { where?: Where }) => (log.push(`${name}.count`), find(a).length),
      create: async (a: { data: Row }) => {
        log.push(`${name}.create`)
        const row = stamp(a.data)
        rows().push(row)
        return { ...row }
      },
      createMany: async (a: { data: Row[] }) => {
        log.push(`${name}.createMany`)
        for (const d of a.data) rows().push(stamp(d))
        return { count: a.data.length }
      },
      updateMany: async (a: { where: Where; data: Row }) => {
        log.push(`${name}.updateMany`)
        let count = 0
        for (const r of rows()) {
          if (!matches(r, a.where)) continue
          Object.assign(r, a.data, { updatedAt: new Date(clock.now.getTime()) })
          count++
        }
        return { count }
      },
      deleteMany: async (a: { where: Where }) => {
        log.push(`${name}.deleteMany`)
        const keep = rows().filter((r) => !matches(r, a.where))
        const count = rows().length - keep.length
        tables[name] = keep
        return { count }
      },
    }
  }
  const db = Object.fromEntries((Object.keys(tables) as (keyof ScenarioFakeTables)[]).map((k) => [k, delegate(k)])) as unknown as Tx
  const deps = (over: Partial<ScenarioDeps> = {}): Partial<ScenarioDeps> => ({
    db,
    now: () => new Date(clock.now.getTime()),
    transaction: async (fn) => fn(Object.create(db) as Tx),
    lockUser: async () => (log.push('lockUser'), true),
    learnerLevel: async () => 'N5',
    ...over,
  })
  return { tables, log, clock, db, deps }
}

/** 쓰기 호출 중 Scenario·ScenarioTopic 밖 표에 쓴 것. */
export function scenarioForeignWrites(log: readonly string[]): string[] {
  return log.filter((l) => /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)$/.test(l) && !/^scenario(Topic)?\./.test(l))
}
