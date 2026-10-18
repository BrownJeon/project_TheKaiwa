/**
 * task-074 — #182 `POST /words/:id/favorite` · #183 `…/unfavorite` · #40 `GET /words?favorite=` 를 라우트 파일 그대로 실행한다(DB·세션 0).
 * `@/modules/infra` 의 require 캐시를 「진짜 + 세션 가짜」로 바꾼 뒤 route.ts 를 처음 읽는다(task045T13Routes 와 같은 방법). learning 은 진짜이고
 * `prisma` 싱글턴의 모델 대리자만 가짜 DB(`wordFakeDb.ts`)로 바꿔 끼운다 — 응답 모양·상태 코드·사용자 격리를 실제 경로로 본다.
 * 세션은 한 박자 늦게 풀리는 Promise 로 준다 — 라우트가 `await requireSession()` 을 빠뜨리면 `s.user` 가 없어 500 이 나 시험이 잡는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { base, createWordFakeDb, state, word } from '../../../../modules/learning/__tests__/wordFakeDb'

type Json = { success: boolean; data: Record<string, unknown> & { code?: string; details?: Record<string, unknown>; items?: Record<string, unknown>[] }; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const infraPath = req.resolve('@/modules/infra')
const infra = req(infraPath) as typeof import('@/modules/infra')
const { ApiError, prisma } = infra

let sessionUser: string | null = 'A'
const sessionCalls: string[] = []
const m = req.cache[infraPath]
assert.ok(m)
m.exports = {
  ...infra,
  requireSession: () =>
    new Promise((resolve, reject) =>
      setTimeout(() => {
        sessionCalls.push(sessionUser ?? '(none)')
        if (!sessionUser) reject(new ApiError('UNAUTHENTICATED', '로그인이 필요합니다.'))
        else resolve({ user: { id: sessionUser, email: 'qa@example.test', name: null, role: 'USER' } })
      }, 2),
    ),
}

const fake = createWordFakeDb({
  words: [
    base('b1', 'N5-0001', { surface: '映画' }),
    base('b2', 'N5-0002', { surface: '日' }),
    word({ id: 'a1', userId: 'A', surface: '猫' }),
    word({ id: 'x1', userId: 'B', surface: '魚' }),
  ],
  states: [state('B', 'b1', { favorite: true, favoritedAt: new Date('2026-10-01T00:10:00.000Z') })],
})
{
  const client = prisma as unknown as Record<string, unknown>
  const db = fake.db as unknown as Record<string, unknown>
  for (const k of ['wordEntry', 'userWordState', 'vocabAttempt', 'evaluationItem', '$queryRaw']) client[k] = db[k]
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(fake.db)
}

const route = (...p: string[]) => req(join(__dirname, '..', ...p, 'route.ts')) as Record<string, Handler>
const fav = route('words', '[id]', 'favorite')
const unfav = route('words', '[id]', 'unfavorite')
const list = route('words')

const mk = (method: string, url: string) => Object.assign(new Request(`http://localhost${url}`, { method }), { nextUrl: new URL(`http://localhost${url}`) })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
async function call(h: Handler, r: unknown, c: unknown = {}): Promise<{ status: number; json: Json }> {
  const res = await h(r, c)
  return { status: res.status, json: (await res.json()) as Json }
}
const post = (h: Record<string, Handler>, id: string) => call(h.POST!, mk('POST', `/api/v1/words/${encodeURIComponent(id)}/x`), ctx(id))
const get = (qs: string) => call(list.GET!, mk('GET', `/api/v1/words?${qs}`))

test('R1 라우트 모양: favorite·unfavorite 는 POST 하나씩(보관 라우트와 같음)', () => {
  assert.deepEqual(Object.keys(fav).filter((k) => /^(GET|POST|PATCH|PUT|DELETE)$/.test(k)), ['POST'])
  assert.deepEqual(Object.keys(unfav).filter((k) => /^(GET|POST|PATCH|PUT|DELETE)$/.test(k)), ['POST'])
})

test('R2 #182/#183 200 응답 = 봉투 { success, data: WordEntry 전체 } · 요청자 세션의 id 로 쓴다 · 멱등', async () => {
  sessionUser = 'A'
  sessionCalls.length = 0
  const on = await post(fav, 'b1')
  assert.equal(on.status, 200)
  assert.equal(on.json.success, true)
  for (const k of ['id', 'surface', 'origin', 'readOnly', 'archived', 'archivedAt', 'favorite', 'favoritedAt', 'correctCount']) assert.ok(k in on.json.data, k)
  assert.deepEqual([on.json.data.id, on.json.data.origin, on.json.data.favorite], ['b1', 'BASE', true])
  assert.equal('userId' in on.json.data || 'seedKey' in on.json.data, false, '소유자·seedKey 는 싣지 않는다')
  assert.deepEqual(sessionCalls, ['A'])
  const again = await post(fav, 'b1')
  assert.equal(again.json.data.favoritedAt, on.json.data.favoritedAt)
  assert.equal(fake.states.filter((s) => s.userId === 'A' && s.wordId === 'b1').length, 1)
  const off = await post(unfav, 'b1')
  assert.deepEqual([off.status, off.json.data.favorite, off.json.data.favoritedAt], [200, false, null])
  const off2 = await post(unfav, 'b1')
  assert.deepEqual([off2.status, off2.json.data.favorite], [200, false])
  assert.equal(fake.states.find((s) => s.userId === 'B' && s.wordId === 'b1')!.favorite, true, 'B 의 별 그대로')
})

test('R3 남의 단어·없는 id → 404 NOT_FOUND(행 0) · 세션 없음 → 401 · 세션 없으면 DB 를 읽지 않는다', async () => {
  sessionUser = 'A'
  for (const h of [fav, unfav]) {
    for (const id of ['x1', 'nope']) {
      const r = await post(h, id)
      assert.deepEqual([r.status, r.json.success, r.json.data.code], [404, false, 'NOT_FOUND'], id)
    }
  }
  assert.equal(fake.states.some((s) => s.userId === 'A' && (s.wordId === 'x1' || s.wordId === 'nope')), false)
  sessionUser = null
  fake.log.length = 0
  for (const h of [fav, unfav]) {
    const r = await post(h, 'a1')
    assert.deepEqual([r.status, r.json.data.code], [401, 'UNAUTHENTICATED'])
  }
  const l = await get('favorite=1')
  assert.equal(l.status, 401)
  assert.deepEqual(fake.log, [], '인증 실패 시 DB 접근 0')
  sessionUser = 'A'
})

test('R4 #40 favorite=1 → 요청자 별만 · 항목 favorite · favorite=2 → 400 field=favorite · B 세션은 B 의 별', async () => {
  sessionUser = 'A'
  await post(fav, 'a1')
  const r = await get('favorite=1&limit=7')
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.data.items!.map((w) => [w.id, w.favorite]), [['a1', true]])
  assert.deepEqual([r.json.data.total, r.json.data.pages, r.json.data.baseTotal], [1, 1, 2])
  const all = await get('limit=7')
  assert.deepEqual(all.json.data.items!.map((w) => [w.id, w.favorite]), [['a1', true], ['b1', false], ['b2', false]])
  const bad = await get('favorite=2')
  assert.deepEqual([bad.status, bad.json.data.code, bad.json.data.details?.field], [400, 'VALIDATION', 'favorite'])
  sessionUser = 'B'
  const rb = await get('favorite=1&limit=7')
  assert.deepEqual(rb.json.data.items!.map((w) => [w.id, w.favorite]), [['b1', true]], 'A 가 켠 a1 은 B 에게 안 보이고(남의 단어) B 의 b1 만')
  sessionUser = 'A'
})

const CONTRACT = [process.env.KAIWA_PROJECT_ROOT, process.cwd()].filter(Boolean).map((r) => join(r!, 'docs/design/api-contract.md')).find((p) => existsSync(p))
test('R5 계약 대조: #182·#183 요약표 행(POST·경로) · §2-9 상세 행 · #40 favorite 쿼리', { skip: CONTRACT ? false : 'docs 없음(KAIWA_PROJECT_ROOT 로 저장소 경로를 주면 실행)' }, () => {
  const doc = readFileSync(CONTRACT!, 'utf8').split('\n')
  assert.ok(doc.some((l) => l.startsWith('| 182 | POST | `/api/v1/words/:id/favorite` |')), '#182 요약 행')
  assert.ok(doc.some((l) => l.startsWith('| 183 | POST | `/api/v1/words/:id/unfavorite` |')), '#183 요약 행')
  assert.ok(doc.some((l) => l.startsWith('| #182 `POST /api/v1/words/:id/favorite` · #183 `/unfavorite` |')), '§2-9 상세 행')
  assert.match(doc.find((l) => l.startsWith('| 40 | GET |'))!, /favorite=/)
  assert.match(doc.find((l) => l.startsWith('| #40 `GET /api/v1/words?'))!, /favorite=0\\\|1/)
  assert.equal(doc.filter((l) => /^\| 18[23] \|/.test(l)).length, 2, '번호 충돌 없음')
})
