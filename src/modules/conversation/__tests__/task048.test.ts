/**
 * task-048 — 역할극 `Chat.endedAt`(사용자 [마치기] 표식): #27 목록 뱃지·#169 대답 연습이 잠근/읽은 행의 표식을 먼저 보는지,
 * 백필 스크립트(`scripts/backfill-roleplay-endedat.ts`)가 기본 dry-run·NULL 행만·멱등인지. 종료·턴·#29 는 task010dA3b.test.ts 끝 절.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, type prisma, type Tx } from '@/modules/infra'
import { SCENARIO_END_MARK } from '@/modules/learning'
import { createChat, serializeChat, type ChatRow } from '../chats'
import { parseRawDateTime, rawDateOrNull, readRolePlayEndFacts, rolePlayListBadges, type EndedRolePlayLookup } from '../chats/rolePlay'
import { suggestReply, type ReplyPracticeDeps } from '../chats/replyPractice'
import { BACKFILL_BATCH, formatReport, runBackfill, type BackfillDb } from '../../../../scripts/backfill-roleplay-endedat'

const U = 'cuser00000000000000000048'
const OTHER = 'cuser0000000000000other48'
const AT = new Date('2026-10-07T01:00:00Z')

// ── #27 목록 뱃지 ───────────────────────────────────────────────────────────

test('#27 뱃지: endedAt 이 있는 역할극 행은 조회 없이 ended · 배치 관측 조회는 NULL 행만 · 전부 차 있으면 조회 0', async () => {
  const lookups: string[][] = []
  const lookup: EndedRolePlayLookup = async (_u, chats) => (lookups.push(chats.map((c) => c.id)), new Set(['c_old']))
  const rows = [
    { id: 'c_marked', kind: 'TALK' as const, scenarioId: 's1', createdAt: AT, endedAt: new Date('2026-10-07T02:00:00Z') },
    { id: 'c_old', kind: 'TALK' as const, scenarioId: 's1', createdAt: AT, endedAt: null },
    { id: 'c_open', kind: 'TALK' as const, scenarioId: 's2', createdAt: AT, endedAt: null },
    { id: 'c_plain', kind: 'TALK' as const, scenarioId: null, createdAt: AT, endedAt: null },
  ]
  const b = await rolePlayListBadges(U, rows, lookup)
  assert.deepEqual([...b.entries()], [
    ['c_marked', { id: 's1', ended: true }],
    ['c_old', { id: 's1', ended: true }],
    ['c_open', { id: 's2', ended: false }],
  ])
  assert.deepEqual(lookups, [['c_old', 'c_open']], '표식 있는 행은 관측 조회에서 뺀다')
  const all = await rolePlayListBadges(U, [rows[0]], lookup)
  assert.deepEqual([all.get('c_marked')?.ended, lookups.length], [true, 1], '전부 표식이면 조회 0')
})

// ── #169 대답 연습 ────────────────────────────────────────────────────────────

test('#169: 대화 행에 endedAt 이 있으면 관측 판정 없이 409 ENDED · NULL 이면 관측 판정(2차 방어)', async () => {
  let isEndedCalls = 0
  const deps = (endedAt: Date | null, observed: boolean): ReplyPracticeDeps => ({
    readChat: async () => ({ id: 'chat_rp', kind: 'TALK', level: 'N5', scenarioId: 'scn_seed', createdAt: AT, endedAt }),
    recentMessages: async () => [],
    turnLocked: () => false,
    isEnded: async () => (isEndedCalls++, observed),
    readMaterial: async () => assert.fail('재료를 읽으면 안 된다'),
    learnerTexts: async () => assert.fail('학습자 말을 읽으면 안 된다'),
    learnerLevel: async () => 'N5',
    complete: async () => assert.fail('LLM 을 부르면 안 된다'),
    trace: async () => undefined,
  })
  const ended = (e: unknown) => e instanceof ApiError && e.code === 'CONFLICT' && e.details?.reason === 'ENDED'
  await assert.rejects(suggestReply(U, 'chat_rp', 'm1', deps(new Date('2026-10-07T02:00:00Z'), false)), ended)
  assert.equal(isEndedCalls, 0)
  await assert.rejects(suggestReply(U, 'chat_rp', 'm1', deps(null, true)), ended)
  assert.equal(isEndedCalls, 1)
})

// ── 백필 스크립트 ────────────────────────────────────────────────────────────

type FakeChat = { id: string; userId: string; kind: string; scenarioId: string | null; endedAt: Date | null }
type FakeObs = { userId: string; kind: string; refType: string | null; refId: string | null; occurredAt: Date }
type W = Record<string, unknown>

function chatMatches(c: FakeChat, w: W): boolean {
  if (w.kind !== undefined && c.kind !== w.kind) return false
  if ((w.scenarioId as W | undefined)?.not === null && c.scenarioId === null) return false
  if ('endedAt' in w) {
    if (w.endedAt === null && c.endedAt !== null) return false
    if ((w.endedAt as W | null)?.not === null && c.endedAt === null) return false
  }
  if (typeof w.id === 'string' && c.id !== w.id) return false
  const gt = (w.id as W | undefined)?.gt
  if (typeof gt === 'string' && !(c.id > gt)) return false
  if (typeof w.userId === 'string' && c.userId !== w.userId) return false
  return true
}

function backfillDb(chats: FakeChat[], obs: FakeObs[]) {
  const ops: string[] = []
  const seen: number[] = []
  const db = {
    chat: {
      count: async (a: { where: W }) => (ops.push('count'), chats.filter((c) => chatMatches(c, a.where)).length),
      findMany: async (a: { where: W; take: number }) => {
        ops.push('findMany')
        return [...chats].sort((x, y) => (x.id < y.id ? -1 : 1)).filter((c) => chatMatches(c, a.where)).slice(0, a.take).map((c) => ({ id: c.id, userId: c.userId }))
      },
      updateMany: async (a: { where: W; data: { endedAt: Date } }) => {
        ops.push('update')
        const hit = chats.filter((c) => chatMatches(c, a.where))
        for (const c of hit) c.endedAt = a.data.endedAt
        return { count: hit.length }
      },
    },
    learningObservation: {
      findMany: async (a: { where: { userId: { in: string[] }; kind: string; refType: string; refId: { in: string[] } } }) => {
        ops.push('obs.findMany')
        assert.equal('occurredAt' in a.where, false, '백필은 시간 창 없이 찾는다(시계 어긋남 행도)')
        const rows = obs.filter((o) => a.where.userId.in.includes(o.userId) && o.kind === a.where.kind && o.refType === a.where.refType && !!o.refId && a.where.refId.in.includes(o.refId))
        seen.push(rows.length)
        return rows
      },
    },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => (ops.push('tx'), fn(db)),
  }
  return { db: db as unknown as BackfillDb, ops, seen }
}

const mark = (refId: string, at: string, userId = U): FakeObs => ({ userId, ...SCENARIO_END_MARK, refId, occurredAt: new Date(at) })

function world() {
  const filledAt = new Date('2026-10-01T00:00:00Z')
  const chats: FakeChat[] = [
    { id: 'c1', userId: U, kind: 'TALK', scenarioId: 's1', endedAt: null }, // 표식 2개 → 이른 쪽
    { id: 'c2', userId: U, kind: 'TALK', scenarioId: 's1', endedAt: null }, // 시계 어긋남(생성보다 이른 표식이어도 찾음)
    { id: 'c3', userId: U, kind: 'TALK', scenarioId: 's2', endedAt: null }, // 표식 없음(진행 중) → 그대로
    { id: 'c4', userId: U, kind: 'TALK', scenarioId: 's2', endedAt: null }, // 남의 표식만 → 그대로
    { id: 'c5', userId: U, kind: 'TALK', scenarioId: 's1', endedAt: filledAt }, // 이미 값 → 건드리지 않음
    { id: 'c6', userId: U, kind: 'TALK', scenarioId: null, endedAt: null }, // 역할극 아님
    { id: 'c7', userId: U, kind: 'CHAT', scenarioId: 's1', endedAt: null }, // 채팅
  ]
  const obs: FakeObs[] = [
    mark('c1', '2026-10-08T03:00:00Z'),
    mark('c1', '2026-10-08T02:00:00Z'),
    mark('c2', '2026-09-20T00:00:00Z'),
    mark('c4', '2026-10-08T05:00:00Z', OTHER),
    mark('c5', '2026-10-09T00:00:00Z'),
    mark('c6', '2026-10-09T00:00:00Z'),
    { userId: U, kind: 'TURN_FLOW', refType: 'Chat', refId: 'c3', occurredAt: new Date('2026-10-08T00:00:00Z') },
  ]
  return { chats, obs, filledAt }
}

test('백필 dry-run(기본): 쓰기 0 · 대상 = 표식 관측이 있는 NULL 역할극 대화(같은 사용자) · 표본 id·시각 범위만', async () => {
  const w = world()
  const { db, ops } = backfillDb(w.chats, w.obs)
  const r = await runBackfill(db, { apply: false })
  assert.deepEqual([r.apply, r.matched, r.updated], [false, 2, 0])
  assert.deepEqual(r.before, { empty: 4, filled: 1 })
  assert.deepEqual(r.after, r.before)
  assert.deepEqual(r.sampleChatIds, ['c1', 'c2'])
  assert.deepEqual(r.occurredAt, { min: '2026-09-20T00:00:00.000Z', max: '2026-10-08T02:00:00.000Z' })
  assert.equal(ops.filter((o) => o === 'update' || o === 'tx').length, 0, 'dry-run 은 UPDATE·트랜잭션 0')
  assert.ok(w.chats.every((c) => (c.id === 'c5' ? c.endedAt === w.filledAt : c.endedAt === null)))
  const text = formatReport(r).join('\n')
  assert.ok(text.includes('DRY-RUN') && text.includes('c1, c2'))
  assert.equal(BACKFILL_BATCH, 100)
})

test('백필 --apply: NULL 행만 이른 표식 시각으로 · 배치마다 트랜잭션 · 이미 값·역할극 아님·표식 없음·남의 표식은 그대로 · 다시 실행하면 0(멱등)', async () => {
  const w = world()
  const { db, ops } = backfillDb(w.chats, w.obs)
  const r = await runBackfill(db, { apply: true, batch: 2 })
  assert.deepEqual([r.matched, r.updated], [2, 2])
  assert.deepEqual(r.after, { empty: 2, filled: 3 })
  const by = new Map(w.chats.map((c) => [c.id, c.endedAt?.toISOString() ?? null]))
  assert.deepEqual(Object.fromEntries(by), {
    c1: '2026-10-08T02:00:00.000Z',
    c2: '2026-09-20T00:00:00.000Z',
    c3: null,
    c4: null,
    c5: w.filledAt.toISOString(),
    c6: null,
    c7: null,
  })
  assert.equal(ops.filter((o) => o === 'tx').length, 1, '채울 행이 있는 배치만 트랜잭션(c1·c2 는 첫 배치)')
  const again = await runBackfill(db, { apply: true, batch: 2 })
  assert.deepEqual([again.matched, again.updated], [0, 0])
  assert.deepEqual(again.before, again.after)
})

test('백필 교차 사용자 방어(REV-176 L-1): 한 배치에 두 사용자의 대화가 있고 관측 userId 와 대화 소유자가 어긋난 행은 채우지 않는다 · 정상 행은 채운다', async () => {
  const chat = (id: string, userId: string): FakeChat => ({ id, userId, kind: 'TALK', scenarioId: 's1', endedAt: null })
  const mk = () => ({
    chats: [chat('ca1', U), chat('ca2', U), chat('cb1', OTHER), chat('cb2', OTHER)],
    obs: [
      mark('ca1', '2026-10-08T01:00:00Z', U), // U 의 대화 + U 의 표식 → 채움
      mark('ca2', '2026-10-08T02:00:00Z', OTHER), // U 의 대화 + OTHER 의 표식(어긋남) → 그대로
      mark('cb1', '2026-10-08T03:00:00Z', OTHER), // OTHER 의 대화 + OTHER 의 표식 → 채움
      mark('cb2', '2026-10-08T04:00:00Z', U), // OTHER 의 대화 + U 의 표식(어긋남) → 그대로
    ],
  })
  const dry = mk()
  const a = backfillDb(dry.chats, dry.obs)
  const r = await runBackfill(a.db, { apply: false })
  assert.deepEqual(a.seen, [4], '가짜 조회가 어긋난 관측 2행을 포함해 4행을 돌려준다 — 이 시험이 헛돌지 않는다는 증거')
  assert.deepEqual([r.matched, r.sampleChatIds], [2, ['ca1', 'cb1']])
  assert.deepEqual(r.occurredAt, { min: '2026-10-08T01:00:00.000Z', max: '2026-10-08T03:00:00.000Z' }, '어긋난 행의 시각(02:00·04:00)은 범위에도 안 들어간다')

  const w = mk()
  const b = backfillDb(w.chats, w.obs)
  const applied = await runBackfill(b.db, { apply: true })
  assert.deepEqual([applied.matched, applied.updated], [2, 2])
  assert.deepEqual(Object.fromEntries(w.chats.map((c) => [c.id, c.endedAt?.toISOString() ?? null])), {
    ca1: '2026-10-08T01:00:00.000Z',
    ca2: null,
    cb1: '2026-10-08T03:00:00.000Z',
    cb2: null,
  })
})

// ── 원시 쿼리 시각 읽기(REV-176 L-2·L-4) ────────────────────────────────────────

test('rawDateOrNull·parseRawDateTime: 시간대 표지 없는 글은 UTC 로 읽는다 — 프로세스 TZ(Asia/Seoul·UTC)와 무관하게 같은 값', () => {
  const ms = Date.UTC(2026, 9, 10, 10, 0, 0, 123)
  // MariaDB DATETIME(3) 글 모양 · T 로 구분한 같은 모양 · 초·소수 생략형
  assert.equal(rawDateOrNull('2026-10-10 10:00:00.123')?.getTime(), ms)
  assert.equal(rawDateOrNull('2026-10-10T10:00:00.123')?.getTime(), ms)
  assert.equal(rawDateOrNull('2026-10-10 10:00:00')?.getTime(), Date.UTC(2026, 9, 10, 10, 0, 0))
  assert.equal(rawDateOrNull('2026-10-10 10:00')?.getTime(), Date.UTC(2026, 9, 10, 10, 0, 0))
  assert.equal(rawDateOrNull('  2026-10-10 10:00:00.123  ')?.getTime(), ms, '앞뒤 공백은 무시')
  // 시간대 표지가 있는 글은 그 표지대로
  assert.equal(rawDateOrNull('2026-10-10T10:00:00.123Z')?.getTime(), ms)
  assert.equal(rawDateOrNull('2026-10-10T19:00:00.123+09:00')?.getTime(), ms)
  assert.equal(rawDateOrNull('2026-10-10T05:00:00.123-05:00')?.getTime(), ms)
  // Date 는 그대로(같은 순간)
  const d = new Date(ms)
  assert.equal(rawDateOrNull(d)?.getTime(), ms)
  assert.equal(parseRawDateTime(d), d)
  // 비었거나 올바르지 않으면 null
  for (const v of [null, undefined, '', '   ', 'nope', '2026-13-45 99:99:99', new Date('nope')]) assert.equal(rawDateOrNull(v), null, JSON.stringify(v) ?? String(v))
  assert.ok(Number.isNaN(parseRawDateTime('nope').getTime()), '올바르지 않은 글은 Invalid Date(호출자가 하한 없이 처리)')
})

test('종료 재료(REV-176 L-2·L-4): 원시 쿼리가 DATETIME 을 시간대 없는 글로 줘도 chatEndedAt·chatCreatedAt 은 UTC 값 · 빈 값·칸 없음은 null', async () => {
  const factsTx = (chat: Record<string, unknown>) =>
    ({
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (strings.join('?').includes('`User`') ? [{ id: values[0] }] : [chat]),
      chatMessage: { findMany: async () => [], count: async () => 0 },
      correction: { groupBy: async () => [] },
    }) as unknown as Tx
  const base = { id: 'chat_rp_1', userId: U, kind: 'TALK', scenarioId: 'scn_seed', lessonId: null, topicId: null }
  const f = await readRolePlayEndFacts(U, 'chat_rp_1', factsTx({ ...base, createdAt: '2026-10-10 09:00:00.000', endedAt: '2026-10-10 10:00:00.123' }))
  assert.equal(f.chatCreatedAt.getTime(), Date.UTC(2026, 9, 10, 9, 0, 0, 0))
  assert.equal(f.chatEndedAt?.getTime(), Date.UTC(2026, 9, 10, 10, 0, 0, 123))
  const d = await readRolePlayEndFacts(U, 'chat_rp_1', factsTx({ ...base, createdAt: new Date('2026-10-10T09:00:00Z'), endedAt: new Date('2026-10-10T10:00:00.123Z') }))
  assert.equal(d.chatEndedAt?.getTime(), Date.UTC(2026, 9, 10, 10, 0, 0, 123))
  for (const endedAt of ['', null, undefined, 'nope']) {
    const n = await readRolePlayEndFacts(U, 'chat_rp_1', factsTx({ ...base, createdAt: new Date('2026-10-10T09:00:00Z'), ...(endedAt === undefined ? {} : { endedAt }) }))
    assert.equal(n.chatEndedAt, null, `endedAt=${JSON.stringify(endedAt)}`)
  }
})

test('#27·#28 응답(REV-176 L-4): serializeChat 은 필드를 골라 쓴다 — 행에 endedAt·scenarioId 가 있어도 응답 키는 11개뿐 · #28 createChat 도 같다', async () => {
  const KEYS = ['createdAt', 'id', 'kind', 'lastMessageAt', 'level', 'messageCount', 'preview', 'reviewedAt', 'running', 'title', 'topic']
  const ENDED = new Date('2026-10-07T02:00:00.000Z')
  const row = {
    id: 'chat_rp_1',
    kind: 'TALK',
    title: '카페 역할극',
    level: 'N5',
    lastMessageAt: AT,
    preview: 'こんにちは',
    messageCount: 4,
    reviewedAt: null,
    createdAt: AT,
    topic: null,
    scenarioId: 's1',
    endedAt: ENDED,
  }
  const dto = serializeChat(row as unknown as ChatRow, false)
  assert.deepEqual(Object.keys(dto).sort(), KEYS)
  assert.ok(!('endedAt' in dto) && !('scenarioId' in dto))
  assert.ok(!JSON.stringify(dto).includes(ENDED.toISOString()), 'endedAt 값이 다른 키로도 새지 않는다')
  const db = { chat: { create: async () => row } } as unknown as typeof prisma
  const created = await createChat(U, { kind: 'TALK', title: null, topicId: null, level: 'N5' }, { db })
  assert.deepEqual(Object.keys(created).sort(), KEYS)
  assert.ok(!JSON.stringify(created).includes(ENDED.toISOString()))
})
