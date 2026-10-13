/**
 * task-067 시험용 — `listChats` 가 쓰는 `chat.findMany`·`chat.count` 를 메모리 행으로 흉내 낸다(DB 0).
 * where 는 실제로 쓰는 모양(필드 같음·`lt`·Date 같음·`AND`·`OR`)만 해석하고, 모르는 모양은 던져서 조건이 바뀌면 시험이 먼저 깨지게 한다.
 */
import type { ChatKind } from '@prisma/client'
import type { ListChatsDeps } from '../chats'

export interface FakeChatRow {
  id: string
  userId: string
  kind: ChatKind
  title: string
  level: null
  lastMessageAt: Date | null
  preview: string | null
  messageCount: number
  reviewedAt: Date | null
  createdAt: Date
  topic: null
  scenarioId: string | null
  endedAt: Date | null
}

type Where = Record<string, unknown>

function fieldMatches(actual: unknown, cond: unknown): boolean {
  if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime()
  if (cond && typeof cond === 'object') {
    const keys = Object.keys(cond)
    if (keys.length !== 1 || keys[0] !== 'lt') throw new Error(`fake: 모르는 조건 ${JSON.stringify(cond)}`)
    const lt = (cond as { lt: unknown }).lt
    if (actual === null || actual === undefined) return false
    if (lt instanceof Date) return actual instanceof Date && actual.getTime() < lt.getTime()
    return typeof actual === 'string' && typeof lt === 'string' && actual < lt
  }
  return actual === cond
}

export function matchesWhere(row: FakeChatRow, where: Where): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND') {
      if (!(v as Where[]).every((w) => matchesWhere(row, w))) return false
    } else if (k === 'OR') {
      if (!(v as Where[]).some((w) => matchesWhere(row, w))) return false
    } else if (k === 'userId' || k === 'kind' || k === 'id' || k === 'lastMessageAt') {
      if (!fieldMatches(row[k], v)) return false
    } else {
      throw new Error(`fake: 모르는 필드 ${k}`)
    }
  }
  return true
}

/** `lastMessageAt desc, id desc`(MySQL 처럼 NULL 은 내림차순 끝). */
function byListOrder(a: FakeChatRow, b: FakeChatRow): number {
  const ta = a.lastMessageAt?.getTime() ?? -Infinity
  const tb = b.lastMessageAt?.getTime() ?? -Infinity
  if (ta !== tb) return tb - ta
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

export interface FakeChatListDb {
  rows: FakeChatRow[]
  calls: { op: 'findMany' | 'count'; where: Where }[]
  deps: ListChatsDeps
}

export function fakeChatListDb(rows: FakeChatRow[]): FakeChatListDb {
  const state: FakeChatListDb = { rows, calls: [], deps: undefined as unknown as ListChatsDeps }
  const chat = {
    findMany: async (args: { where: Where; take: number }) => {
      state.calls.push({ op: 'findMany', where: args.where })
      return state.rows.filter((r) => matchesWhere(r, args.where)).sort(byListOrder).slice(0, args.take)
    },
    count: async (args: { where: Where }) => {
      state.calls.push({ op: 'count', where: args.where })
      return state.rows.filter((r) => matchesWhere(r, args.where)).length
    },
  }
  state.deps = {
    db: { chat } as unknown as ListChatsDeps['db'],
    sweep: async () => undefined,
    running: async () => new Set<string>(),
    badges: async () => new Map(),
  }
  return state
}

export function chatRow(id: string, userId: string, kind: ChatKind, minutesAgo: number, base = new Date('2026-10-13T07:00:00Z')): FakeChatRow {
  const at = new Date(base.getTime() - minutesAgo * 60_000)
  return { id, userId, kind, title: `제목 ${id}`, level: null, lastMessageAt: at, preview: null, messageCount: 1, reviewedAt: null, createdAt: at, topic: null, scenarioId: null, endedAt: null }
}
