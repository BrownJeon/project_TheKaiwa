/**
 * task-067 D3 — #27 `GET /api/v1/chats` 라우트가 `listChats` 의 `total` 을 그대로 싣고 질의(kind·limit·cursor)를 바꾸지 않는다
 * (DB·세션 0, `task045T2Routes.test.ts` 와 같은 방법: `@/modules/infra`·`@/modules/conversation` require 캐시를 바꾼 뒤 route.ts 를 처음 읽는다).
 * `total` 의 뜻(소유자·kind·커서 무관)은 `modules/conversation/__tests__/task067ChatListTotal.test.ts` 가 잠근다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Json = { success: boolean; data: Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>
type ListQuery = Parameters<typeof import('@/modules/conversation').listChats>[1]

const req = createRequire(__filename)
const paths = { infra: req.resolve('@/modules/infra'), conversation: req.resolve('@/modules/conversation') }
const infra = req(paths.infra) as typeof import('@/modules/infra')
const conversation = req(paths.conversation) as typeof import('@/modules/conversation')

const ME = 'cuser_t067r_me_00000000'
const calls: { userId: string; q: ListQuery }[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}
swap(paths.infra, {
  ...infra,
  requireSession: async () => ({ user: { id: ME, email: 'qa@example.test', name: null, role: 'USER' } }),
})
swap(paths.conversation, {
  ...conversation,
  listChats: async (userId: string, q: ListQuery) => {
    calls.push({ userId, q })
    return { items: [{ id: 'c1' }, { id: 'c2' }], nextCursor: q.cursor ? null : 'next-1', total: 37 }
  },
})

const chatsRoute = req(join(__dirname, '..', 'chats', 'route.ts')) as { GET: Handler }

async function get(q: string): Promise<{ status: number; json: Json }> {
  const url = `http://localhost/api/v1/chats${q}`
  const res = await chatsRoute.GET(Object.assign(new Request(url), { nextUrl: new URL(url) }), {})
  return { status: res.status, json: (await res.json()) as Json }
}

test('GET ?kind=ASK&limit=5 → 200 {items, nextCursor, total} — total 을 그대로 싣고 질의는 그대로 넘긴다', async () => {
  calls.length = 0
  const r = await get('?kind=ASK&limit=5')
  assert.equal(r.status, 200)
  assert.equal(r.json.success, true)
  assert.deepEqual(r.json.data, { items: [{ id: 'c1' }, { id: 'c2' }], nextCursor: 'next-1', total: 37 })
  assert.deepEqual(calls, [{ userId: ME, q: { kind: 'ASK', limit: 5, cursor: null } }])
})

test('다음 쪽(cursor) · kind 없음 · limit 기본 20 — 기존 질의 해석 불변', async () => {
  calls.length = 0
  const r = await get('?kind=ASK&limit=5&cursor=abc')
  assert.equal(r.json.data.total, 37)
  assert.equal(r.json.data.nextCursor, null)
  await get('')
  assert.deepEqual(calls, [
    { userId: ME, q: { kind: 'ASK', limit: 5, cursor: 'abc' } },
    { userId: ME, q: { kind: undefined, limit: 20, cursor: null } },
  ])
})

test('잘못된 kind 는 목록을 읽기 전에 400(기존 동작 불변)', async () => {
  calls.length = 0
  assert.equal((await get('?kind=NOPE')).status, 400)
  assert.equal(calls.length, 0)
})
