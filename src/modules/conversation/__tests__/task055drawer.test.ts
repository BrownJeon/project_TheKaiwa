/**
 * task-055 #79 서랍장 교정 — DB 없이 가짜 DB 로 계약(api-contract §2-17)을 검사한다.
 *
 * 가짜 DB 는 모듈이 쓰는 Prisma where 부분집합(같음·not·lt·contains·AND·OR)을 **실제로 해석**한다 — 인자 모양만 보는 대신
 * 커서 왕복·facets 의미·소유자 분리를 동작으로 확인하려고. 모르는 연산자·필드는 throw 해서 조용히 통과하지 않게 했다.
 *
 * `contains` 는 「Prisma 가 값을 이스케이프하지 않고 `LIKE '%값%'` 로 보낸다」(task-008 2026-09-27 NAS MariaDB 실측 — `contains:'%'` 가
 * 전 행 일치, `infra.escapeLike` 주석)와 MariaDB `LIKE` 의미(기본 이스케이프 문자 `\`, `%` = 0자 이상, `_` = 정확히 1자)를 흉내 낸다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, encodeCursor } from '@/modules/infra'
import {
  DRAWER_CHUNK_TYPES,
  DRAWER_ERROR_TYPES,
  drawerCorrectionWhere,
  listDrawerCorrections,
  parseDrawerCorrectionQuery,
  type DrawerCorrectionDb,
} from '../corrections/drawer'
import type { DrawerCorrectionPage } from '@/types/chat'

// ── 가짜 DB ─────────────────────────────────────────────────────────────

type Row = {
  id: string
  userId: string
  chatId: string
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
  original: string
  corrected: string
  explanation: string
  extraNoteKo: string | null
  errorType: string
  severity: 'MINOR' | 'MAJOR'
  chunkType: string | null
  savedWordId: string | null
  resolvedAt: Date | null
  createdAt: Date
}
type ChatRow = { id: string; userId: string; title: string; kind: 'TALK' | 'CHAT' | 'ASK' }
type WordRow = { id: string; userId: string | null; surface: string; source?: string }
type Where = Record<string, unknown>

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** MariaDB LIKE(기본 ESCAPE `\`) → 정규식. `_` 는 코드포인트 1자, `%` 는 줄바꿈 포함 0자 이상, 끝의 홀로 남은 `\` 는 글자 그대로. */
function likeRegex(pattern: string): RegExp {
  const cps = Array.from(pattern)
  let src = ''
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i]
    if (c === '\\' && i + 1 < cps.length) src += escRe(cps[++i])
    else if (c === '%') src += '[\\s\\S]*'
    else if (c === '_') src += '[\\s\\S]'
    else src += escRe(c)
  }
  return new RegExp(`^${src}$`, 'u')
}

const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b)
function cmp(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0
  throw new Error(`fake: 비교 불가 ${String(a)} ${String(b)}`)
}

function matches(row: Row, where: Where): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'AND') {
      if (!(v as Where[]).every((w) => matches(row, w))) return false
      continue
    }
    if (k === 'OR') {
      if (!(v as Where[]).some((w) => matches(row, w))) return false
      continue
    }
    if (!(k in row)) throw new Error(`fake: 모르는 필드 ${k}`)
    const val = (row as Record<string, unknown>)[k]
    if (v === null || typeof v !== 'object' || v instanceof Date) {
      if (!same(val, v)) return false
      continue
    }
    for (const [op, arg] of Object.entries(v as Record<string, unknown>)) {
      if (op === 'not') {
        if (same(val, arg)) return false
      } else if (op === 'lt') {
        if (val == null || !(cmp(val, arg) < 0)) return false
      } else if (op === 'contains') {
        if (typeof val !== 'string' || !likeRegex(`%${String(arg)}%`).test(val)) return false
      } else throw new Error(`fake: 모르는 연산자 ${op}`)
    }
  }
  return true
}

function pick<T extends Record<string, unknown>>(src: T, sel: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, on] of Object.entries(sel)) {
    if (on !== true) throw new Error(`fake: 중첩 select ${k}`)
    out[k] = src[k]
  }
  return out
}

interface Call {
  op: 'findMany' | 'groupBy'
  args: Record<string, unknown>
}

function fakeDb(rows: Row[], chats: ChatRow[], words: WordRow[] = []) {
  const calls: Call[] = []
  const chatById = new Map(chats.map((c) => [c.id, c]))
  const wordById = new Map(words.map((w) => [w.id, w]))
  const db = {
    correction: {
      async findMany(args: { where: Where; orderBy: Record<string, 'asc' | 'desc'>[]; take: number; select: Record<string, unknown> }) {
        calls.push({ op: 'findMany', args })
        for (const k of Object.keys(args)) if (!['where', 'orderBy', 'take', 'select'].includes(k)) throw new Error(`fake: 모르는 인자 ${k}`)
        const hit = rows.filter((r) => matches(r, args.where))
        hit.sort((a, b) => {
          for (const o of args.orderBy) {
            const [[f, dir]] = Object.entries(o)
            const c = cmp((a as Record<string, unknown>)[f], (b as Record<string, unknown>)[f])
            if (c !== 0) return dir === 'desc' ? -c : c
          }
          return 0
        })
        return hit.slice(0, args.take).map((r) => {
          const out: Record<string, unknown> = {}
          for (const [k, sel] of Object.entries(args.select)) {
            if (sel === true) {
              if (!(k in r)) throw new Error(`fake: 모르는 select ${k}`)
              out[k] = (r as Record<string, unknown>)[k]
            } else if (k === 'chat') {
              out.chat = pick(chatById.get(r.chatId)!, (sel as { select: Record<string, unknown> }).select)
            } else if (k === 'savedWord') {
              const w = r.savedWordId ? wordById.get(r.savedWordId) : undefined
              out.savedWord = w ? pick(w, (sel as { select: Record<string, unknown> }).select) : null
            } else throw new Error(`fake: 모르는 관계 ${k}`)
          }
          return out
        })
      },
      async groupBy(args: { by: string[]; where: Where; _count: { _all: true } }) {
        calls.push({ op: 'groupBy', args })
        assert.deepEqual(args.by, ['errorType'])
        const counts = new Map<string, number>()
        for (const r of rows) if (matches(r, args.where)) counts.set(r.errorType, (counts.get(r.errorType) ?? 0) + 1)
        // DB 의 groupBy 순서에 기대지 않는지 보려고 뒤집어 돌려준다.
        return [...counts].reverse().map(([errorType, n]) => ({ errorType, _count: { _all: n } }))
      },
    },
  }
  return { db: db as unknown as DrawerCorrectionDb, calls }
}

const T0 = Date.parse('2026-10-01T00:00:00.000Z')
let seq = 0
function mk(p: Partial<Row> = {}): Row {
  seq += 1
  return {
    id: `cr${String(seq).padStart(4, '0')}`,
    userId: 'u1',
    chatId: 'c1',
    status: 'ACCEPTED',
    original: 'わたしは学生です',
    corrected: 'わたしが学生です',
    explanation: '조사 설명',
    extraNoteKo: null,
    errorType: 'PARTICLE',
    severity: 'MINOR',
    chunkType: null,
    savedWordId: null,
    resolvedAt: new Date(T0 + seq * 60_000),
    createdAt: new Date(T0),
    ...p,
  }
}
const CHATS: ChatRow[] = [
  { id: 'c1', userId: 'u1', title: '카페 주문', kind: 'TALK' },
  { id: 'c2', userId: 'u1', title: '자기소개', kind: 'CHAT' },
  { id: 'c9', userId: 'u2', title: '남의 채팅', kind: 'CHAT' },
]
const qry = (s = '') => parseDrawerCorrectionQuery(new URLSearchParams(s))

async function rejects400(fn: () => unknown, field: string) {
  await assert.rejects(async () => fn(), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && e.details?.field === field)
}

// ── 쿼리 검증 ───────────────────────────────────────────────────────────

test('쿼리 기본값: 필터 없음·limit 20·cursor 없음, 빈 문자열은 없는 것으로 본다', () => {
  assert.deepEqual(qry(), { errorType: null, chunkType: null, q: null, limit: 20, cursor: null })
  assert.deepEqual(qry('errorType=&chunkType=&q=&limit=&cursor='), { errorType: null, chunkType: null, q: null, limit: 20, cursor: null })
  assert.deepEqual(qry('errorType=PARTICLE&chunkType=NAME&q=%E3%81%AF&limit=7&cursor=abc'), { errorType: 'PARTICLE', chunkType: 'NAME', q: 'は', limit: 7, cursor: 'abc' })
})

test('limit: 1~50 정수만(0·51·비숫자·소수·음수·공백 400), 경계 1·50 통과', async () => {
  for (const v of ['0', '51', '100', 'abc', '1.5', '-1', ' 5', '5 ', '1e1']) await rejects400(() => qry(`limit=${encodeURIComponent(v)}`), 'limit')
  assert.equal(qry('limit=1').limit, 1)
  assert.equal(qry('limit=50').limit, 50)
})

test('errorType 9종·chunkType 4종만 — 소문자·목록·「없음」·다른 enum 값은 400', async () => {
  for (const t of DRAWER_ERROR_TYPES) assert.equal(qry(`errorType=${t}`).errorType, t)
  for (const c of DRAWER_CHUNK_TYPES) assert.equal(qry(`chunkType=${c}`).chunkType, c)
  for (const v of ['particle', 'PARTICLE,GRAMMAR', 'NONE', 'none', 'MINOR', 'toString', '__proto__']) await rejects400(() => qry(`errorType=${encodeURIComponent(v)}`), 'errorType')
  for (const v of ['none', 'name', 'NULL', 'OTHER', 'PARTICLE', 'NAME,ACTION', 'constructor', 'EXPRESSION']) await rejects400(() => qry(`chunkType=${encodeURIComponent(v)}`), 'chunkType')
})

test('ErrorType 9종의 순서 = prisma/schema.prisma 선언 순(facets 동률 정렬 키), ChunkType 4종 = 스키마에서 단어 전용 EXPRESSION 을 뺀 값(task-068 J12)', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const enumValues = (name: string) => {
    const m = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)
    assert.ok(m, `enum ${name} 없음`)
    return m[1].split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean)
  }
  assert.deepEqual(DRAWER_ERROR_TYPES, enumValues('ErrorType'))
  assert.ok(enumValues('ChunkType').includes('EXPRESSION'))
  assert.deepEqual(DRAWER_CHUNK_TYPES, enumValues('ChunkType').filter((v) => v !== 'EXPRESSION'))
})

test('q: 앞뒤 공백 제거·공백뿐/빈 값은 없음, 40자(코드포인트) 통과·41자 400', async () => {
  assert.equal(qry(`q=${encodeURIComponent('  존댓말 \n')}`).q, '존댓말')
  assert.equal(qry(`q=${encodeURIComponent('   ')}`).q, null)
  assert.equal(qry('q=').q, null)
  assert.equal(qry(`q=${encodeURIComponent('あ'.repeat(40))}`).q, 'あ'.repeat(40))
  await rejects400(() => qry(`q=${encodeURIComponent('あ'.repeat(41))}`), 'q')
  // 서로게이트 쌍은 1자 — 이모지 40개(UTF-16 80단위)는 통과, 41개는 400.
  assert.equal(qry(`q=${encodeURIComponent('😀'.repeat(40))}`).q, '😀'.repeat(40))
  await rejects400(() => qry(`q=${encodeURIComponent('😀'.repeat(41))}`), 'q')
  // 앞뒤 공백을 빼고 40자면 통과.
  assert.equal(qry(`q=${encodeURIComponent(`  ${'a'.repeat(40)}  `)}`).q, 'a'.repeat(40))
})

// ── where 모양 ─────────────────────────────────────────────────────────

test('where: 소유자·ACCEPTED·resolvedAt 있음 + 필터 AND + 3필드 OR, LIKE 특수문자는 \\ 로 이스케이프', () => {
  assert.deepEqual(drawerCorrectionWhere('u1', { errorType: 'PARTICLE', chunkType: 'NAME', q: '50%_off\\' }), {
    userId: 'u1',
    status: 'ACCEPTED',
    resolvedAt: { not: null },
    errorType: 'PARTICLE',
    chunkType: 'NAME',
    OR: [{ original: { contains: '50\\%\\_off\\\\' } }, { corrected: { contains: '50\\%\\_off\\\\' } }, { explanation: { contains: '50\\%\\_off\\\\' } }],
  })
  assert.deepEqual(drawerCorrectionWhere('u1', { errorType: null, chunkType: null, q: null }), { userId: 'u1', status: 'ACCEPTED', resolvedAt: { not: null } })
})

// ── 소유자·상태 ────────────────────────────────────────────────────────

test('소유자: 남의 교정은 0건(빈 목록), ACCEPTED 만(PROPOSED·REJECTED·EXPIRED 제외), facets 도 같은 범위', async () => {
  const a1 = mk({ errorType: 'GRAMMAR' })
  const a2 = mk({ errorType: 'PARTICLE' })
  const rows = [
    a1,
    a2,
    mk({ status: 'PROPOSED', resolvedAt: null }),
    mk({ status: 'REJECTED' }),
    mk({ status: 'EXPIRED' }),
    mk({ userId: 'u2', chatId: 'c9', errorType: 'GRAMMAR' }),
    mk({ userId: 'u2', chatId: 'c9', errorType: 'VOCABULARY' }),
  ]
  const { db } = fakeDb(rows, CHATS)
  const p1 = await listDrawerCorrections('u1', qry(), db)
  assert.deepEqual(p1.items.map((i) => i.id), [a2.id, a1.id])
  assert.deepEqual(p1.facets, { errorType: [{ value: 'GRAMMAR', count: 1 }, { value: 'PARTICLE', count: 1 }] })
  // u1 의 교정 id 를 알아도 u3 의 목록에는 나오지 않는다(존재하지 않는 것처럼 빈 목록).
  const p3 = await listDrawerCorrections('u3', qry(), db)
  assert.deepEqual(p3, { items: [], nextCursor: null, facets: { errorType: [] } })
  const p2 = await listDrawerCorrections('u2', qry(), db)
  assert.equal(p2.items.length, 2)
  assert.ok(p2.items.every((i) => i.chat.id === 'c9'))
})

test('ACCEPTED 인데 resolvedAt 이 빈 행(채택 경로에는 없음)은 커서 키가 없어 제외한다', async () => {
  const ok1 = mk()
  const { db } = fakeDb([ok1, mk({ resolvedAt: null })], CHATS)
  const p = await listDrawerCorrections('u1', qry(), db)
  assert.deepEqual(p.items.map((i) => i.id), [ok1.id])
  assert.deepEqual(p.facets, { errorType: [{ value: 'PARTICLE', count: 1 }] })
})

// ── 검색 ───────────────────────────────────────────────────────────────

test('q: original·corrected·explanation 셋에서 부분 일치(OR), extraNoteKo 는 검색하지 않는다', async () => {
  const inOriginal = mk({ original: '先生に会います' })
  const inCorrected = mk({ corrected: '先生に会いました' })
  const inExplanation = mk({ explanation: '윗사람에게는 존댓말을 써요' })
  const onlyNote = mk({ extraNoteKo: 'N4 문법: 존댓말' })
  const none = mk()
  const { db } = fakeDb([inOriginal, inCorrected, inExplanation, onlyNote, none], CHATS)
  assert.deepEqual((await listDrawerCorrections('u1', qry('q=先生'), db)).items.map((i) => i.id), [inCorrected.id, inOriginal.id])
  assert.deepEqual((await listDrawerCorrections('u1', qry(`q=${encodeURIComponent(' 존댓말 ')}`), db)).items.map((i) => i.id), [inExplanation.id])
  const p = await listDrawerCorrections('u1', qry(`q=${encodeURIComponent('없는말')}`), db)
  assert.deepEqual(p, { items: [], nextCursor: null, facets: { errorType: [] } })
})

test('q: LIKE 특수문자 %·_·\\ 는 글자 그대로만 찾는다(와일드카드로 동작하지 않음)', async () => {
  const pct = mk({ explanation: '정답률 100% 문장' })
  const und = mk({ original: 'a_b' })
  const axb = mk({ original: 'axb' })
  const bs = mk({ corrected: 'C:\\path' })
  const plain = mk({ original: 'abc', corrected: 'abd', explanation: '평범' })
  const all = [pct, und, axb, bs, plain]
  const { db } = fakeDb(all, CHATS)
  const ids = async (q: string) => (await listDrawerCorrections('u1', qry(`q=${encodeURIComponent(q)}`), db)).items.map((i) => i.id).sort()
  assert.deepEqual(await ids('%'), [pct.id])
  assert.deepEqual(await ids('0%'), [pct.id])
  assert.deepEqual(await ids('_'), [und.id])
  assert.deepEqual(await ids('a_b'), [und.id])
  assert.deepEqual(await ids('\\'), [bs.id])
  assert.deepEqual(await ids('\\p'), [bs.id])
  assert.deepEqual(await ids('%%'), [])
  // 대조군: 이스케이프 없이 같은 값을 contains 로 보내면 가짜 DB 도 와일드카드로 해석한다(= 시험이 이스케이프 누락을 잡을 수 있다).
  const raw = fakeDb(all, CHATS)
  const sel = { id: true } as unknown as Parameters<DrawerCorrectionDb['correction']['findMany']>[0]['select']
  const leaked = await raw.db.correction.findMany({ where: { userId: 'u1', original: { contains: '_' } }, orderBy: [{ id: 'asc' }], take: 99, select: sel })
  assert.equal(leaked.length, all.length)
})

// ── 필터 조합 ──────────────────────────────────────────────────────────

test('필터 조합은 AND: errorType + chunkType + q 를 모두 만족하는 행만', async () => {
  const hit = mk({ errorType: 'PARTICLE', chunkType: 'NAME', original: '駅に行く' })
  const rows = [
    hit,
    mk({ errorType: 'PARTICLE', chunkType: 'NAME', original: '家に帰る' }),
    mk({ errorType: 'PARTICLE', chunkType: 'ACTION', original: '駅に行く' }),
    mk({ errorType: 'GRAMMAR', chunkType: 'NAME', original: '駅に行く' }),
    mk({ errorType: 'PARTICLE', chunkType: null, original: '駅に行く' }),
  ]
  const { db } = fakeDb(rows, CHATS)
  const p = await listDrawerCorrections('u1', qry(`errorType=PARTICLE&chunkType=NAME&q=${encodeURIComponent('駅')}`), db)
  assert.deepEqual(p.items.map((i) => i.id), [hit.id])
})

// ── facets ─────────────────────────────────────────────────────────────

test('첫 쪽 facets: errorType 조건만 빼고 chunkType·q 는 반영, 0개 생략, 많은 순 → 선언 순', async () => {
  const rows = [
    mk({ errorType: 'PARTICLE', chunkType: 'NAME', original: '駅に' }),
    mk({ errorType: 'PARTICLE', chunkType: 'NAME', original: '駅で' }),
    mk({ errorType: 'PARTICLE', chunkType: 'ACTION', original: '駅を' }),
    mk({ errorType: 'POLITENESS', chunkType: 'NAME', original: '駅です' }),
    mk({ errorType: 'GRAMMAR', chunkType: 'NAME', original: '駅だ' }),
    mk({ errorType: 'GRAMMAR', chunkType: null, original: '駅だった' }),
    mk({ errorType: 'CONJUGATION', chunkType: 'ACTION', original: '駅行った' }),
    mk({ errorType: 'VOCABULARY', chunkType: 'NAME', original: '電車' }),
  ]
  const { db, calls } = fakeDb(rows, CHATS)
  const p = await listDrawerCorrections('u1', qry(`errorType=PARTICLE&chunkType=NAME&q=${encodeURIComponent('駅')}`), db)
  assert.equal(p.items.length, 2)
  assert.ok(p.items.every((i) => i.errorType === 'PARTICLE' && i.chunkType === 'NAME'))
  // chunkType=NAME + q=駅 범위: PARTICLE 2 · GRAMMAR 1 · POLITENESS 1 (CONJUGATION 은 ACTION, VOCABULARY 는 q 불일치 → 생략). 동률은 선언 순(GRAMMAR < POLITENESS).
  assert.deepEqual(p.facets, { errorType: [{ value: 'PARTICLE', count: 2 }, { value: 'GRAMMAR', count: 1 }, { value: 'POLITENESS', count: 1 }] })
  // 쿼리 수: 목록 1 + groupBy 1(N+1 없음). groupBy where 에는 errorType 이 없고 chunkType·검색은 있다.
  assert.deepEqual(calls.map((c) => c.op).sort(), ['findMany', 'groupBy'])
  const gWhere = calls.find((c) => c.op === 'groupBy')!.args.where as Where
  assert.equal('errorType' in gWhere, false)
  assert.equal(gWhere.chunkType, 'NAME')
  assert.ok(Array.isArray(gWhere.OR))
  // 유형 칩 숫자 합 = 그 유형 필터를 뺀 목록 수(머리 줄 n개).
  const noType = await listDrawerCorrections('u1', qry(`chunkType=NAME&q=${encodeURIComponent('駅')}&limit=50`), db)
  assert.equal(p.facets!.errorType.reduce((s, f) => s + f.count, 0), noType.items.length)
})

test('facets: 모든 유형 동률이면 선언 순, groupBy 가 0개 행을 돌려줘도 생략', async () => {
  const rows = (['OTHER', 'NATURALNESS', 'GRAMMAR', 'WORD_ORDER'] as const).map((t) => mk({ errorType: t }))
  const { db } = fakeDb(rows, CHATS)
  const p = await listDrawerCorrections('u1', qry(), db)
  assert.deepEqual(p.facets!.errorType.map((f) => f.value), ['GRAMMAR', 'NATURALNESS', 'WORD_ORDER', 'OTHER'])
  const zeroDb: DrawerCorrectionDb = {
    correction: {
      findMany: async () => [],
      groupBy: async () => [{ errorType: 'PARTICLE', _count: { _all: 0 } }, { errorType: 'OTHER', _count: { _all: 3 } }],
    },
  }
  assert.deepEqual(await listDrawerCorrections('u1', qry(), zeroDb), { items: [], nextCursor: null, facets: { errorType: [{ value: 'OTHER', count: 3 }] } })
})

// ── 커서 ───────────────────────────────────────────────────────────────

test('커서 왕복: 같은 resolvedAt 에서는 id desc 로 안정, 중복·누락 0, 마지막 쪽 nextCursor null, 더 보기에는 facets 없음', async () => {
  const rows: Row[] = []
  // 23행 — 세 개씩 같은 시각(동률), 넣는 순서는 섞는다.
  for (let i = 0; i < 23; i++) rows.push(mk({ resolvedAt: new Date(T0 + Math.floor(i / 3) * 1000), errorType: i % 2 ? 'GRAMMAR' : 'PARTICLE' }))
  rows.reverse().push(...rows.splice(0, 7))
  const expected = [...rows].sort((a, b) => b.resolvedAt!.getTime() - a.resolvedAt!.getTime() || (a.id < b.id ? 1 : -1)).map((r) => r.id)
  const { db, calls } = fakeDb(rows, CHATS)
  const seen: string[] = []
  let cursor: string | null = null
  let pages = 0
  do {
    const before = calls.length
    const page: DrawerCorrectionPage = await listDrawerCorrections('u1', qry(`limit=5${cursor ? `&cursor=${cursor}` : ''}`), db)
    if (cursor) {
      assert.equal('facets' in page, false)
      assert.deepEqual(calls.slice(before).map((c) => c.op), ['findMany'])
    } else {
      assert.deepEqual(page.facets, { errorType: [{ value: 'PARTICLE', count: 12 }, { value: 'GRAMMAR', count: 11 }] })
    }
    seen.push(...page.items.map((i) => i.id))
    cursor = page.nextCursor
    pages += 1
  } while (cursor && pages < 10)
  assert.equal(pages, 5)
  assert.equal(cursor, null)
  assert.deepEqual(seen, expected)
  assert.equal(new Set(seen).size, 23)
})

test('nextCursor: 정확히 limit 개면 null, limit+1 개면 다음 쪽 1개 후 null', async () => {
  const five = Array.from({ length: 5 }, () => mk())
  assert.equal((await listDrawerCorrections('u1', qry('limit=5'), fakeDb(five, CHATS).db)).nextCursor, null)
  const six = [...five, mk()]
  const { db } = fakeDb(six, CHATS)
  const p1 = await listDrawerCorrections('u1', qry('limit=5'), db)
  assert.equal(p1.items.length, 5)
  assert.ok(p1.nextCursor)
  const p2 = await listDrawerCorrections('u1', qry(`limit=5&cursor=${p1.nextCursor}`), db)
  assert.equal(p2.items.length, 1)
  assert.equal(p2.nextCursor, null)
})

test('커서 + 필터: 더 보기에서도 필터·소유자 조건이 유지된다', async () => {
  const rows = Array.from({ length: 6 }, (_, i) => mk({ errorType: i % 2 ? 'GRAMMAR' : 'PARTICLE' }))
  rows.push(mk({ userId: 'u2', chatId: 'c9', errorType: 'PARTICLE' }))
  const { db } = fakeDb(rows, CHATS)
  const p1 = await listDrawerCorrections('u1', qry('errorType=PARTICLE&limit=2'), db)
  const p2 = await listDrawerCorrections('u1', qry(`errorType=PARTICLE&limit=2&cursor=${p1.nextCursor}`), db)
  assert.deepEqual([...p1.items, ...p2.items].map((i) => i.errorType), ['PARTICLE', 'PARTICLE', 'PARTICLE'])
  assert.equal(p2.nextCursor, null)
})

test('해석할 수 없는 커서는 DB 를 부르기 전에 400', async () => {
  const { db, calls } = fakeDb([mk()], CHATS)
  for (const c of ['garbage!!', encodeCursor({ o: 1 }), encodeCursor({ t: 'not-a-date', id: 'x' }), encodeCursor({ t: '2026-10-01T00:00:00.000Z', id: '' }), 'x'.repeat(401)]) {
    await rejects400(() => listDrawerCorrections('u1', qry(`cursor=${encodeURIComponent(c)}`), db), 'cursor')
  }
  assert.equal(calls.length, 0)
})

// ── 응답 모양 ──────────────────────────────────────────────────────────

test('응답 항목: 계약 필드만(상태·메시지 id·소유자 id 없음), original 은 저장 글자 그대로, extraNoteKo null/문자열', async () => {
  const raw = '  前後の空白\nと改行\t '
  const withNote = mk({ original: raw, corrected: ' 直した\n文 ', explanation: '설명\n둘째 줄', extraNoteKo: 'N4 문법 — 〜てしまう', chunkType: 'ACTION', severity: 'MAJOR', chatId: 'c2' })
  const noNote = mk({ extraNoteKo: null })
  const { db } = fakeDb([withNote, noNote], CHATS)
  const p = await listDrawerCorrections('u1', qry(), db)
  const [a, b] = p.items
  assert.equal(b.id, withNote.id)
  assert.deepEqual(b, {
    id: withNote.id,
    original: raw,
    corrected: ' 直した\n文 ',
    explanation: '설명\n둘째 줄',
    extraNoteKo: 'N4 문법 — 〜てしまう',
    errorType: 'PARTICLE',
    severity: 'MAJOR',
    chunkType: 'ACTION',
    chat: { id: 'c2', title: '자기소개', kind: 'CHAT' },
    resolvedAt: withNote.resolvedAt!.toISOString(),
  })
  assert.equal(a.extraNoteKo, null)
  assert.equal(a.chunkType, null)
  assert.deepEqual(Object.keys(a).sort(), ['chat', 'chunkType', 'corrected', 'errorType', 'explanation', 'extraNoteKo', 'id', 'original', 'resolvedAt', 'severity'])
})

test('savedWord: 같은 사용자 소유 단어만 {id, surface}, 남의 단어·연결 없음은 필드 생략(userId 는 내보내지 않음)', async () => {
  const words: WordRow[] = [
    { id: 'w1', userId: 'u1', surface: '駅' },
    { id: 'w9', userId: 'u2', surface: '他人' },
  ]
  const own = mk({ savedWordId: 'w1' })
  const foreign = mk({ savedWordId: 'w9' })
  const none = mk({ savedWordId: null })
  const dangling = mk({ savedWordId: 'w-gone' })
  const { db } = fakeDb([own, foreign, none, dangling], CHATS, words)
  const byId = new Map((await listDrawerCorrections('u1', qry(), db)).items.map((i) => [i.id, i]))
  assert.deepEqual(byId.get(own.id)!.savedWord, { id: 'w1', surface: '駅' })
  for (const r of [foreign, none, dangling]) assert.equal('savedWord' in byId.get(r.id)!, false)
})

test('T30 (task-068) savedWord: 공용 기본 단어(userId NULL · SEED)를 가리키면 싣고, 남의 단어·SEED 아닌 주인 없는 행은 숨긴다', async () => {
  const words: WordRow[] = [
    { id: 'b1', userId: null, surface: '映画', source: 'SEED' },
    { id: 'w9', userId: 'u2', surface: '他人', source: 'MANUAL' },
    { id: 'x1', userId: null, surface: '迷子', source: 'MANUAL' },
    { id: 'w1', userId: 'u1', surface: '駅', source: 'CORRECTION' },
  ]
  const toBase = mk({ savedWordId: 'b1' })
  const foreign = mk({ savedWordId: 'w9' })
  const orphan = mk({ savedWordId: 'x1' })
  const own = mk({ savedWordId: 'w1' })
  const { db } = fakeDb([toBase, foreign, orphan, own], CHATS, words)
  const items = (await listDrawerCorrections('u1', qry(), db)).items
  const byId = new Map(items.map((i) => [i.id, i]))
  assert.deepEqual(byId.get(toBase.id)!.savedWord, { id: 'b1', surface: '映画' }, '이관·채택(L4)으로 기본 단어를 가리키는 교정도 「단어장에 넣은 단어」 연결이 보인다')
  assert.deepEqual(byId.get(own.id)!.savedWord, { id: 'w1', surface: '駅' })
  for (const r of [foreign, orphan]) assert.equal('savedWord' in byId.get(r.id)!, false)
  assert.equal(JSON.stringify(items).includes('"source"'), false, '단어 출처 칸은 응답에 싣지 않는다')
  assert.equal(JSON.stringify(items).includes('"userId"'), false)
})

test('select: chat·savedWord 는 목록 쿼리 한 번의 select 로 읽는다(N+1 없음)', async () => {
  const { db, calls } = fakeDb(Array.from({ length: 4 }, (_, i) => mk({ savedWordId: i % 2 ? 'w1' : null })), CHATS, [{ id: 'w1', userId: 'u1', surface: '駅' }])
  await listDrawerCorrections('u1', qry('limit=3'), db)
  const finds = calls.filter((c) => c.op === 'findMany')
  assert.equal(finds.length, 1)
  const sel = finds[0].args.select as Record<string, unknown>
  assert.deepEqual(sel.chat, { select: { id: true, title: true, kind: true } })
  assert.deepEqual(sel.savedWord, { select: { id: true, surface: true, userId: true, source: true } })
  assert.equal(finds[0].args.take, 4)
  assert.deepEqual(finds[0].args.orderBy, [{ resolvedAt: 'desc' }, { id: 'desc' }])
})
