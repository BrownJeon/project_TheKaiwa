/**
 * task-064 dev-S1 — 기록 조회 계층 시험용 메모리 DB(공유 NAS DB 를 건드리지 않는다). 조회 계층이 쓰는 Prisma 부분집합만 흉내 낸다:
 * `findMany`(where·orderBy·take·select) · `count`(where). where 연산: 값 같음·null·in·notIn·not·lt·lte·gt·gte·contains(LIKE 이스케이프 해제,
 * 대소문자 무시 — MariaDB 기본 콜레이션)·OR·AND, 관계 필터는 `topicChunk.topic` 하나.
 *
 * - `leaky:true` 면 `select` 를 무시하고 행 전체를 돌려준다 — 「쿼리가 칸을 좁히지 않아도 글 만들기가 금지 칸을 싣지 않는다」를 따로 확인한다.
 * - 대화·교정·제안·추적 표도 만들어 두고(비밀 표지를 심는다) 조회 계층이 **한 번도 부르지 않는지** `calls` 로 단언한다.
 */
type Row = Record<string, unknown>
type Where = Record<string, unknown> | undefined

export const TABLES = [
  'statsSnapshot', 'attendance', 'repetitionItem', 'lesson', 'scenario', 'topicChunk', 'conversationTopic', 'wordEntry', 'evaluation', 'learnerErrorStat',
  'correction', 'chat', 'chatMessage', 'tutorProposal', 'requestTrace', 'studyLog', 'utterance',
] as const
export type TableName = (typeof TABLES)[number]

export interface Call {
  table: TableName
  op: 'findMany' | 'count'
  args: { where?: Where; select?: Record<string, unknown>; orderBy?: unknown; take?: number }
}

const isDate = (v: unknown): v is Date => v instanceof Date
const OPS = new Set(['in', 'notIn', 'not', 'lt', 'lte', 'gt', 'gte', 'equals', 'contains'])
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
const unescapeLike = (s: string) => s.replace(/\\([\\%_])/g, '$1')

function matchOp(v: unknown, op: Record<string, unknown>): boolean {
  for (const [k, x] of Object.entries(op)) {
    if (x === undefined) continue
    if (k === 'in' && !(x as unknown[]).some((y) => eq(v, y))) return false
    if (k === 'notIn' && (x as unknown[]).some((y) => eq(v, y))) return false
    if (k === 'equals' && !eq(v, x)) return false
    if (k === 'not' && (isOp(x) ? matchOp(v, x) : eq(v ?? null, x))) return false
    if (k === 'contains' && !(typeof v === 'string' && v.toLowerCase().includes(unescapeLike(String(x)).toLowerCase()))) return false
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

function pick(row: Row, select: Record<string, unknown> | undefined): Row {
  if (!select) return { ...row }
  const out: Row = {}
  for (const [k, v] of Object.entries(select)) if (v === true) out[k] = row[k]
  return out
}

export interface RetrievalFake {
  tables: Record<TableName, Row[]>
  calls: Call[]
  db: never
}

export function retrievalFakeDb(opts: { leaky?: boolean } = {}): RetrievalFake {
  const tables = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as Record<TableName, Row[]>
  const calls: Call[] = []
  const rels: Partial<Record<TableName, Record<string, (row: Row) => Row | null>>> = {
    topicChunk: { topic: (r) => tables.conversationTopic.find((t) => t.id === r.topicId) ?? null },
  }
  const delegate = (name: TableName) => {
    const find = (args: Call['args'] = {}) => {
      let out = tables[name].filter((r) => matches(r, args.where, rels[name]))
      out = sortRows(out, args.orderBy)
      if (typeof args.take === 'number') out = out.slice(0, args.take)
      return out
    }
    return {
      findMany: async (args: Call['args'] = {}) => {
        calls.push({ table: name, op: 'findMany', args })
        return find(args).map((r) => (opts.leaky ? { ...r } : pick(r, args.select)))
      },
      count: async (args: Call['args'] = {}) => {
        calls.push({ table: name, op: 'count', args })
        return find({ where: args.where }).length
      },
    }
  }
  const db = Object.fromEntries(TABLES.map((t) => [t, delegate(t)])) as never
  return { tables, calls, db }
}

/** KST 시각 `YYYY-MM-DD HH:mm[:ss]` → Date. */
export function kst(at: string): Date {
  const [d, t = '00:00'] = at.split(' ')
  return new Date(`${d}T${t.length === 5 ? `${t}:00` : t}+09:00`)
}

/** `@db.Date` 값(UTC 자정). */
export function dbDate(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`)
}
