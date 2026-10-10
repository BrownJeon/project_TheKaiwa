/**
 * task-048 — 역할극 `Chat.endedAt`(사용자 [마치기] 표식): #27 목록 뱃지·#169 대답 연습이 잠근/읽은 행의 표식을 먼저 보는지,
 * 백필 스크립트(`scripts/backfill-roleplay-endedat.ts`)가 기본 dry-run·NULL 행만·멱등인지. 종료·턴·#29 는 task010dA3b.test.ts 끝 절.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { SCENARIO_END_MARK } from '@/modules/learning'
import { rolePlayListBadges, type EndedRolePlayLookup } from '../chats/rolePlay'
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
        return obs.filter((o) => a.where.userId.in.includes(o.userId) && o.kind === a.where.kind && o.refType === a.where.refType && !!o.refId && a.where.refId.in.includes(o.refId))
      },
    },
    $transaction: async <T,>(fn: (tx: unknown) => Promise<T>) => (ops.push('tx'), fn(db)),
  }
  return { db: db as unknown as BackfillDb, ops }
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
