/**
 * task-080 — #78 `GET /api/v1/plan/growth?weeks=` 라우트: 인증 없음 401(계산 함수 호출 0) · weeks 4|8|12(생략 4)·그 밖 400 · 세션 userId 만 넘김 ·
 * 응답 = getGrowth 결과 그대로. DB·세션 0(`task067ChatsRouteTotal.test.ts` 와 같은 방법 — require 캐시를 바꾼 뒤 route.ts 를 처음 읽는다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Json = { success: boolean; data: Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const paths = { infra: req.resolve('@/modules/infra'), learning: req.resolve('@/modules/learning') }
const infra = req(paths.infra) as typeof import('@/modules/infra')
const learning = req(paths.learning) as typeof import('@/modules/learning')

const ME = 'cuser_t080r_me_00000000'
let signedIn = true
const calls: { userId: string; weeks: number }[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}
swap(paths.infra, {
  ...infra,
  requireSession: async () => {
    if (!signedIn) throw new infra.ApiError('UNAUTHENTICATED', '로그인이 필요합니다.')
    return { user: { id: ME, email: 'qa@example.test', name: null, role: 'USER' } }
  },
})
swap(paths.learning, {
  ...learning,
  getGrowth: async (userId: string, weeks: number) => {
    calls.push({ userId, weeks })
    return { range: { weeks }, since: null, marker: 'from-getGrowth' }
  },
})

const route = req(join(__dirname, '..', 'plan', 'growth', 'route.ts')) as { GET: Handler }

async function get(q: string): Promise<{ status: number; json: Json }> {
  const url = `http://localhost/api/v1/plan/growth${q}`
  const res = await route.GET(Object.assign(new Request(url), { nextUrl: new URL(url) }), {})
  return { status: res.status, json: (await res.json()) as Json }
}

test('세션 없음 → 401, 계산 함수 호출 0 (잘못된 weeks 여도 인증이 먼저)', async () => {
  calls.length = 0
  signedIn = false
  try {
    assert.equal((await get('')).status, 401)
    assert.equal((await get('?weeks=99')).status, 401)
  } finally {
    signedIn = true
  }
  assert.equal(calls.length, 0)
})

test('weeks 생략 = 4 · 4|8|12 → 200 {success, data = getGrowth 결과}, 세션 userId 만 넘긴다', async () => {
  calls.length = 0
  const r = await get('')
  assert.equal(r.status, 200)
  assert.equal(r.json.success, true)
  assert.deepEqual(r.json.data, { range: { weeks: 4 }, since: null, marker: 'from-getGrowth' })
  await get('?weeks=8')
  await get('?weeks=12')
  // 남의 id 를 주소에 넣어도 무시된다(세션 사용자만)
  await get('?weeks=4&userId=cuser_other_000000000000')
  assert.deepEqual(calls, [
    { userId: ME, weeks: 4 },
    { userId: ME, weeks: 8 },
    { userId: ME, weeks: 12 },
    { userId: ME, weeks: 4 },
  ])
})

test('weeks 가 4|8|12 밖이면 400 VALIDATION {field:weeks, reason:"4|8|12"}, 계산 함수 호출 0', async () => {
  calls.length = 0
  for (const bad of ['5', '0', '04', 'abc', '8.0', '-4']) {
    const r = await get(`?weeks=${encodeURIComponent(bad)}`)
    assert.equal(r.status, 400, bad)
    assert.equal(r.json.success, false)
    assert.deepEqual(r.json.data, { code: 'VALIDATION', details: { field: 'weeks', reason: '4|8|12' } }, bad)
  }
  assert.equal(calls.length, 0)
})
