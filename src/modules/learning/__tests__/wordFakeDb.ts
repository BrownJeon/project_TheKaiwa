/**
 * task-068 단어장 가짜 DB — `WordEntry`·`UserWordState`(+ 상세 통계용 `VocabAttempt`·`EvaluationItem`)를 메모리로 흉내 낸다.
 * learning 모듈이 실제로 쓰는 Prisma where·orderBy 모양만 해석한다(모르는 키는 던져서 시험이 조용히 통과하지 않게).
 * 정렬은 MariaDB 규칙을 따른다: NULL 은 가장 작은 값(asc 면 앞, desc 면 뒤), `jlpt` ENUM 은 선언 순서(N5 → N1).
 * 문자열 비교는 바이트 순(콜레이션 흉내 없음) — 시험 픽스처는 콜레이션이 순서를 바꾸지 않는 글자만 쓴다.
 */
import type { Tx } from '@/modules/infra'

export type FakeWord = {
  id: string
  userId: string | null
  seedKey: string | null
  surface: string
  reading: string | null
  meaning: string
  partOfSpeech: string
  chunkType: string | null
  jlpt: string | null
  example: string | null
  exampleKo: string | null
  note: string | null
  category: string | null
  source: string
  sourceRefId: string | null
  correctCount: number
  wrongCount: number
  lastSeenAt: Date | null
  lastResult: string | null
  archived: boolean
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type FakeState = {
  id: string
  userId: string
  wordId: string
  correctCount: number
  wrongCount: number
  lastSeenAt: Date | null
  lastResult: string | null
  archived: boolean
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type FakeAttempt = { id: string; wordId: string | null; answer: string | null; answeredAt: Date | null; sessionUserId: string }
export type FakeEvalItem = { id: string; wordId: string | null; evaluationUserId: string }

const T0 = new Date('2026-10-01T00:00:00.000Z')
let seq = 0

export function word(over: Partial<FakeWord> & Pick<FakeWord, 'id'>): FakeWord {
  return {
    userId: null, seedKey: null, surface: over.id, reading: null, meaning: 'm', partOfSpeech: 'NOUN', chunkType: 'NAME', jlpt: null,
    example: null, exampleKo: null, note: null, category: null, source: 'MANUAL', sourceRefId: null,
    correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null, archived: false, archivedAt: null, createdAt: T0, updatedAt: T0,
    ...over,
  }
}

/** 기본 단어(공용 · 읽기 전용) 픽스처. */
export function base(id: string, seedKey: string, over: Partial<FakeWord> = {}): FakeWord {
  const jlpt = over.jlpt ?? seedKey.slice(0, 2)
  return word({ id, seedKey, userId: null, source: 'SEED', jlpt, category: over.category ?? '초보자 (N5)', reading: over.reading ?? `${id}-r`, ...over })
}

export function state(userId: string, wordId: string, over: Partial<FakeState> = {}): FakeState {
  return { id: `st${++seq}`, userId, wordId, correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null, archived: false, archivedAt: null, createdAt: T0, updatedAt: T0, ...over }
}

const JLPT_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1']

type Where = Record<string, unknown>

function unescapeLike(s: string): string {
  return s.replace(/\\([\\%_])/g, '$1')
}

function matchScalar(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime()
  if (typeof cond !== 'object') return value === cond
  const c = cond as Record<string, unknown>
  for (const [op, arg] of Object.entries(c)) {
    if (op === 'in') { if (!(arg as unknown[]).includes(value)) return false } else if (op === 'notIn') { if ((arg as unknown[]).includes(value)) return false } else if (op === 'not') { if (matchScalar(value, arg)) return false } else if (op === 'contains') { if (typeof value !== 'string' || !value.includes(unescapeLike(arg as string))) return false } else if (op === 'gt') { if (!((value as number) > (arg as number))) return false } else if (op === 'gte') { if (!((value as number) >= (arg as number))) return false } else if (op === 'lt') { if (!((value as number) < (arg as number))) return false } else throw new Error(`fake db: 모르는 연산 ${op}`)
  }
  return true
}

function matchRow<R extends Record<string, unknown>>(row: R, where: Where | undefined, rel: (row: R, key: string, cond: unknown) => boolean | undefined): boolean {
  if (!where) return true
  for (const [k, cond] of Object.entries(where)) {
    if (cond === undefined) continue
    if (k === 'AND') { if (!(cond as Where[]).every((w) => matchRow(row, w, rel))) return false; continue }
    if (k === 'OR') { if (!(cond as Where[]).some((w) => matchRow(row, w, rel))) return false; continue }
    if (k === 'NOT') { if ((Array.isArray(cond) ? cond : [cond]).some((w) => matchRow(row, w as Where, rel))) return false; continue }
    const r = rel(row, k, cond)
    if (r !== undefined) { if (!r) return false; continue }
    if (!(k in row)) throw new Error(`fake db: 모르는 칸 ${k}`)
    if (!matchScalar(row[k], cond)) return false
  }
  return true
}

function cmp(a: unknown, b: unknown, field: string): number {
  if (a === b) return 0
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1
  if (field === 'jlpt') return JLPT_ORDER.indexOf(a as string) - JLPT_ORDER.indexOf(b as string)
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : 1
}

function sortRows<R extends Record<string, unknown>>(rows: R[], orderBy: unknown): R[] {
  if (!orderBy) return rows
  const list = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<string, 'asc' | 'desc'>[]
  return rows.slice().sort((x, y) => {
    for (const o of list) {
      const [field, dir] = Object.entries(o)[0]!
      const c = cmp(x[field], y[field], field)
      if (c) return dir === 'desc' ? -c : c
    }
    return 0
  })
}

function pickSelect<R extends Record<string, unknown>>(row: R, select: Record<string, unknown> | undefined, nested: (row: R, key: string, arg: unknown) => unknown): Record<string, unknown> {
  if (!select) return { ...row }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(select)) {
    if (!v) continue
    if (v === true) {
      if (!(k in row)) throw new Error(`fake db: select 모르는 칸 ${k}`)
      out[k] = row[k]
    } else out[k] = nested(row, k, v)
  }
  return out
}

export interface FakeDbLog {
  ops: string[]
}

export function createWordFakeDb(init: { words?: FakeWord[]; states?: FakeState[]; attempts?: FakeAttempt[]; evalItems?: FakeEvalItem[] } = {}) {
  const words = [...(init.words ?? [])]
  const states = [...(init.states ?? [])]
  const attempts = [...(init.attempts ?? [])]
  const evalItems = [...(init.evalItems ?? [])]
  const log: string[] = []

  const stateWhere = (s: FakeState, w: Where | undefined): boolean => matchRow(s as unknown as Record<string, unknown>, w, () => undefined)

  const wordRel = (row: FakeWord, key: string, cond: unknown): boolean | undefined => {
    if (key !== 'states') return undefined
    const c = cond as { some?: Where; none?: Where; every?: Where }
    const mine = states.filter((s) => s.wordId === row.id)
    if (c.some) return mine.some((s) => stateWhere(s, c.some))
    if (c.none) return !mine.some((s) => stateWhere(s, c.none))
    throw new Error('fake db: states 관계 조건')
  }
  const wordMatch = (w: FakeWord, where: Where | undefined) => matchRow(w as unknown as Record<string, unknown>, where, (r, k, c) => wordRel(r as unknown as FakeWord, k, c))
  const wordNested = (row: FakeWord, key: string, arg: unknown) => {
    if (key !== 'states') throw new Error(`fake db: select 관계 ${key}`)
    const a = arg as { where?: Where; select?: Record<string, unknown> }
    return states.filter((s) => s.wordId === row.id && stateWhere(s, a.where)).map((s) => pickSelect(s as unknown as Record<string, unknown>, a.select, () => undefined))
  }
  const selectWord = (w: FakeWord, select?: Record<string, unknown>) => pickSelect(w as unknown as Record<string, unknown>, select, (r, k, a) => wordNested(r as unknown as FakeWord, k, a))

  const findWords = (a: { where?: Where; orderBy?: unknown; skip?: number; take?: number }) => {
    const rows = sortRows(words.filter((w) => wordMatch(w, a.where)) as unknown as Record<string, unknown>[], a.orderBy) as unknown as FakeWord[]
    const from = a.skip ?? 0
    return rows.slice(from, a.take === undefined ? undefined : from + a.take)
  }

  const uniqueState = (where: { userId_wordId: { userId: string; wordId: string } }) =>
    states.find((s) => s.userId === where.userId_wordId.userId && s.wordId === where.userId_wordId.wordId) ?? null

  const applyStateData = (s: FakeState, data: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && 'increment' in (v as object)) (s as unknown as Record<string, number>)[k] += (v as { increment: number }).increment
      else (s as unknown as Record<string, unknown>)[k] = v
    }
  }

  const db = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('?')
      log.push(sql.includes('`User`') ? 'lock:user' : `raw:${sql}`)
      return [{ id: 'x' }]
    },
    wordEntry: {
      findMany: async (a: { where?: Where; orderBy?: unknown; skip?: number; take?: number; select?: Record<string, unknown> }) => {
        log.push('word:findMany')
        return findWords(a).map((w) => selectWord(w, a.select))
      },
      findFirst: async (a: { where?: Where; orderBy?: unknown; select?: Record<string, unknown> }) => {
        log.push('word:findFirst')
        const w = findWords({ ...a, take: 1 })[0]
        return w ? selectWord(w, a.select) : null
      },
      findFirstOrThrow: async (a: { where?: Where; select?: Record<string, unknown> }) => {
        log.push('word:findFirst')
        const w = findWords({ ...a, take: 1 })[0]
        if (!w) throw new Error('not found')
        return selectWord(w, a.select)
      },
      findUniqueOrThrow: async (a: { where: { id: string }; select?: Record<string, unknown> }) => {
        const w = words.find((x) => x.id === a.where.id)
        if (!w) throw new Error('not found')
        return selectWord(w, a.select)
      },
      count: async (a: { where?: Where } = {}) => (log.push('word:count'), words.filter((w) => wordMatch(w, a.where)).length),
      groupBy: async (a: { by: string[]; where?: Where; _count: { _all: true } }) => {
        log.push('word:groupBy')
        const map = new Map<string, Record<string, unknown> & { _count: { _all: number } }>()
        for (const w of words.filter((x) => wordMatch(x, a.where))) {
          const key = JSON.stringify(a.by.map((b) => (w as unknown as Record<string, unknown>)[b]))
          const g = map.get(key) ?? { ...Object.fromEntries(a.by.map((b) => [b, (w as unknown as Record<string, unknown>)[b]])), _count: { _all: 0 } }
          g._count._all += 1
          map.set(key, g)
        }
        return [...map.values()]
      },
      create: async (a: { data: Partial<FakeWord>; select?: Record<string, unknown> }) => {
        log.push('word:create')
        const w = word({ id: `new${++seq}`, ...a.data } as FakeWord)
        words.push(w)
        return selectWord(w, a.select)
      },
      update: async (a: { where: Where; data: Partial<FakeWord>; select?: Record<string, unknown> }) => {
        log.push('word:update')
        const w = words.find((x) => wordMatch(x, a.where))
        if (!w) throw new Error('not found')
        Object.assign(w, a.data)
        return selectWord(w, a.select)
      },
      updateMany: async (a: { where?: Where; data: Partial<FakeWord> }) => {
        log.push('word:updateMany')
        const hit = words.filter((w) => wordMatch(w, a.where))
        for (const w of hit) Object.assign(w, a.data)
        return { count: hit.length }
      },
      deleteMany: async (a: { where?: Where }) => {
        log.push('word:deleteMany')
        const hit = words.filter((w) => wordMatch(w, a.where))
        for (const w of hit) {
          words.splice(words.indexOf(w), 1)
          for (const s of states.filter((x) => x.wordId === w.id)) states.splice(states.indexOf(s), 1)
        }
        return { count: hit.length }
      },
    },
    userWordState: {
      findMany: async (a: { where?: Where; select?: Record<string, unknown> }) => {
        log.push('state:findMany')
        return states.filter((s) => stateWhere(s, a.where)).map((s) => pickSelect(s as unknown as Record<string, unknown>, a.select, () => undefined))
      },
      findUnique: async (a: { where: { userId_wordId: { userId: string; wordId: string } }; select?: Record<string, unknown> }) => {
        log.push('state:findUnique')
        const s = uniqueState(a.where)
        return s ? pickSelect(s as unknown as Record<string, unknown>, a.select, () => undefined) : null
      },
      createMany: async (a: { data: { userId: string; wordId: string }[]; skipDuplicates?: boolean }) => {
        log.push('state:createMany')
        let count = 0
        for (const d of a.data) {
          if (uniqueState({ userId_wordId: d })) {
            if (!a.skipDuplicates) throw new Error('unique violation')
            continue
          }
          if (!words.some((w) => w.id === d.wordId)) throw new Error('fk violation')
          states.push(state(d.userId, d.wordId))
          count += 1
        }
        return { count }
      },
      updateMany: async (a: { where?: Where; data: Record<string, unknown> }) => {
        log.push('state:updateMany')
        const hit = states.filter((s) => stateWhere(s, a.where))
        for (const s of hit) applyStateData(s, a.data)
        return { count: hit.length }
      },
      upsert: async (a: { where: { userId_wordId: { userId: string; wordId: string } }; create: Partial<FakeState> & { userId: string; wordId: string }; update: Record<string, unknown> }) => {
        log.push('state:upsert')
        const s = uniqueState(a.where)
        if (s) {
          applyStateData(s, a.update)
          return s
        }
        if (!words.some((w) => w.id === a.create.wordId)) throw new Error('fk violation')
        const n = state(a.create.userId, a.create.wordId, a.create)
        states.push(n)
        return n
      },
    },
    vocabAttempt: {
      count: async (a: { where: Where }) => attempts.filter((x) => attemptMatch(x, a.where)).length,
      groupBy: async (a: { by: ['answer']; where: Where }) => {
        const map = new Map<string, number>()
        for (const x of attempts.filter((y) => attemptMatch(y, a.where))) map.set(x.answer ?? '', (map.get(x.answer ?? '') ?? 0) + 1)
        return [...map].map(([answer, n]) => ({ answer, _count: { _all: n } }))
      },
    },
    evaluationItem: {
      count: async (a: { where: Where }) => evalItems.filter((x) => matchRow(x as unknown as Record<string, unknown>, a.where, (r, k, c) => (k === 'evaluation' ? (r as unknown as FakeEvalItem).evaluationUserId === (c as { userId: string }).userId : undefined))).length,
    },
  }

  function attemptMatch(x: FakeAttempt, where: Where): boolean {
    return matchRow(x as unknown as Record<string, unknown>, where, (r, k, c) => {
      if (k === 'session') return (r as unknown as FakeAttempt).sessionUserId === (c as { userId: string }).userId
      if (k === 'answeredAt') return (r as unknown as FakeAttempt).answeredAt !== null && (r as unknown as FakeAttempt).answeredAt!.getTime() >= ((c as { gte: Date }).gte).getTime()
      return undefined
    })
  }

  return { db: db as unknown as Tx, words, states, log }
}
