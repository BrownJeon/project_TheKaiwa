/**
 * task-067 D3 — #27 `listChats` 응답에 `total` additive(DB 0, 메모리 가짜 `chat.findMany/count`):
 * 같은 소유자·`kind` 의 전체 수 · 커서·limit 과 무관 · 남의 대화·지운 대화 제외 · 0개면 0 · 기존 필드·정렬·커서 불변 · 개수와 목록이 같은 조건.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chatListFilter, listChats } from '../chats'
import { chatRow, fakeChatListDb, type FakeChatRow } from './fakeChatListDb'

const ME = 'cuser_t067_me_000000000'
const OTHER = 'cuser_t067_other_000000'
const NOBODY = 'cuser_t067_empty_000000'

function seed(): FakeChatRow[] {
  const rows: FakeChatRow[] = []
  for (let i = 0; i < 7; i++) rows.push(chatRow(`ask_me_${i}`, ME, 'ASK', i * 10))
  for (let i = 0; i < 3; i++) rows.push(chatRow(`talk_me_${i}`, ME, 'TALK', i * 10 + 5))
  for (let i = 0; i < 4; i++) rows.push(chatRow(`ask_ot_${i}`, OTHER, 'ASK', i * 10 + 1))
  return rows
}

const ITEM_KEYS = ['createdAt', 'id', 'kind', 'lastMessageAt', 'level', 'messageCount', 'preview', 'reviewedAt', 'running', 'title', 'topic']

test('ASK 5개씩: 첫 쪽 items 5 · total 7(남의 ASK 4·내 TALK 3 제외) · 다음 쪽 커서 있음 · 응답 키는 기존 + total', async () => {
  const f = fakeChatListDb(seed())
  const p1 = await listChats(ME, { kind: 'ASK', limit: 5 }, f.deps)
  assert.deepEqual(Object.keys(p1).sort(), ['items', 'nextCursor', 'total'])
  assert.equal(p1.items.length, 5)
  assert.equal(p1.total, 7)
  assert.ok(p1.total > p1.items.length)
  assert.ok(p1.nextCursor)
  assert.deepEqual(p1.items.map((c) => c.id), ['ask_me_0', 'ask_me_1', 'ask_me_2', 'ask_me_3', 'ask_me_4'])
  for (const c of p1.items) assert.deepEqual(Object.keys(c).sort(), ITEM_KEYS)
})

test('커서로 다음 쪽을 읽어도 total 은 같다 · 두 쪽 합이 전체 · 마지막 쪽 커서 없음', async () => {
  const f = fakeChatListDb(seed())
  const p1 = await listChats(ME, { kind: 'ASK', limit: 5 }, f.deps)
  const p2 = await listChats(ME, { kind: 'ASK', limit: 5, cursor: p1.nextCursor }, f.deps)
  assert.equal(p2.total, 7)
  assert.equal(p2.items.length, 2)
  assert.equal(p2.nextCursor, null)
  const ids = [...p1.items, ...p2.items].map((c) => c.id)
  assert.equal(new Set(ids).size, 7)
  assert.ok(ids.every((id) => id.startsWith('ask_me_')))
})

test('kind 에 따라 total 이 달라진다 — 없음(전체) 10 · TALK 3 · CHAT 0', async () => {
  const f = fakeChatListDb(seed())
  assert.equal((await listChats(ME, { limit: 5 }, f.deps)).total, 10)
  assert.equal((await listChats(ME, { kind: 'TALK', limit: 5 }, f.deps)).total, 3)
  const chat = await listChats(ME, { kind: 'CHAT', limit: 5 }, f.deps)
  assert.deepEqual(chat, { items: [], nextCursor: null, total: 0 })
})

test('대화가 하나도 없으면 total 0 · limit 이 전체보다 크면 total = items 수', async () => {
  const f = fakeChatListDb(seed())
  assert.deepEqual(await listChats(NOBODY, { kind: 'ASK', limit: 5 }, f.deps), { items: [], nextCursor: null, total: 0 })
  const all = await listChats(ME, { kind: 'ASK', limit: 20 }, f.deps)
  assert.equal(all.total, 7)
  assert.equal(all.items.length, 7)
  assert.equal(all.nextCursor, null)
})

test('지운 대화(#31 은 행 삭제)는 total 에서 빠진다', async () => {
  const f = fakeChatListDb(seed())
  f.rows.splice(f.rows.findIndex((r) => r.id === 'ask_me_3'), 1)
  const p = await listChats(ME, { kind: 'ASK', limit: 5 }, f.deps)
  assert.equal(p.total, 6)
  assert.ok(!p.items.some((c) => c.id === 'ask_me_3'))
})

test('개수 질의는 목록과 같은 조건(커서만 뺀 것)을 쓴다 — 조건은 chatListFilter 한 곳', async () => {
  assert.deepEqual(chatListFilter(ME, 'ASK'), { userId: ME, kind: 'ASK' })
  assert.deepEqual(chatListFilter(ME), { userId: ME })
  const f = fakeChatListDb(seed())
  const p1 = await listChats(ME, { kind: 'ASK', limit: 5 }, f.deps)
  await listChats(ME, { kind: 'ASK', limit: 5, cursor: p1.nextCursor }, f.deps)
  const [find1, count1, find2, count2] = f.calls
  assert.deepEqual([find1.op, count1.op, find2.op, count2.op], ['findMany', 'count', 'findMany', 'count'])
  assert.deepEqual(count1.where, chatListFilter(ME, 'ASK'))
  assert.deepEqual(find1.where, count1.where)
  assert.deepEqual(count2.where, count1.where)
  assert.deepEqual((find2.where as { AND: unknown[] }).AND[0], count2.where)
})

test('stale PENDING 정리는 읽기 전에 사용자 범위로 한 번', async () => {
  const f = fakeChatListDb(seed())
  const order: string[] = []
  const deps = { ...f.deps, sweep: async (u: string) => void order.push(`sweep:${u}`) }
  const inner = deps.db.chat
  deps.db = { chat: { findMany: ((a: never) => (order.push('find'), inner.findMany(a))) as never, count: ((a: never) => (order.push('count'), inner.count(a))) as never } }
  await listChats(ME, { kind: 'ASK', limit: 5 }, deps)
  assert.deepEqual(order, [`sweep:${ME}`, 'find', 'count'])
})
