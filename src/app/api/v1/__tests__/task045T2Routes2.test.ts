/**
 * task-045 감사 보완(REV-152b L2·L3) — #171 PATCH /topics/:id 의 쓰기 한도 소모를 라우트 파일 그대로 시험한다(DB·세션·LLM 0,
 * `task045T2Routes.test.ts` 와 같은 방법: require 캐시의 `@/modules/infra`·`@/modules/learning` 을 "진짜 + 세션·한도 기록·서비스 가짜"로 바꾼 뒤 route.ts 를 처음 읽는다).
 * - 정상 PATCH 는 `topic-write:<사용자>` 를 정확히 1회 소모 · 400(본문·카드번호 모양 설명)은 미소모·서비스 0 · 분당 한도를 넘으면 진짜 429.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Json = { success: boolean; data: { code?: string; details?: Record<string, unknown> } & Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const paths = { infra: req.resolve('@/modules/infra'), learning: req.resolve('@/modules/learning') }
const infra = req(paths.infra) as typeof import('@/modules/infra')
const learning = req(paths.learning) as typeof import('@/modules/learning')

let sessionUser = 'cuser_t2r2_000000000000'
const limitKeys: string[] = []
const calls: string[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

swap(paths.infra, {
  ...infra,
  requireSession: async () => ({ user: { id: sessionUser, email: 'qa@example.test', name: null, role: 'USER' } }),
  rateLimit: (key: string, limit: number, windowMs?: number) => {
    limitKeys.push(key)
    infra.rateLimit(key, limit, windowMs)
  },
})
swap(paths.learning, {
  ...learning,
  updateUserTopic: async (_u: string, id: string) => {
    calls.push(`update:${id}`)
    return { id, title: 't', titleJa: null, level: 'N5', description: null, tags: [], isSeed: false, chunks: [], lessonCount: 0, lastLessonAt: null, lastLessonTitle: null }
  },
})

const topicIdRoute = req(join(__dirname, '..', 'topics', '[id]', 'route.ts')) as { PATCH: Handler }
const { TOPIC_WRITE_PER_MINUTE } = req(join(__dirname, '..', 'topics', '_lib', 'saveBody.ts')) as { TOPIC_WRITE_PER_MINUTE: number }

const reset = (user: string) => {
  sessionUser = user
  limitKeys.length = 0
  calls.length = 0
}
const patch = (body: string) => new Request('http://localhost/api/v1/topics/mine1', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body })
const ctx = { params: Promise.resolve({ id: 'mine1' }) }
async function call(body: string): Promise<{ status: number; json: Json }> {
  const res = await topicIdRoute.PATCH(patch(body), ctx)
  return { status: res.status, json: (await res.json()) as Json }
}

test('REV-152b L2 #171 PATCH — 정상 요청은 topic-write 한도를 정확히 1회 소모 · 400(본문·카드번호 모양 설명)은 미소모·서비스 0', async () => {
  const user = 'cuser_t2r2_once_0000000'
  reset(user)
  for (const b of ['{', '{}', JSON.stringify({ description: '카드 4111 1111 1111 1111 로 결제' })]) {
    const r = await call(b)
    assert.equal(r.status, 400, b)
  }
  assert.deepEqual(limitKeys, [])
  assert.deepEqual(calls, [])
  const secret = await call(JSON.stringify({ description: '4111-1111-1111-1111' }))
  assert.equal(secret.json.data.details?.reason ?? (secret.json.data.details?.fields as Array<{ reason: string }> | undefined)?.[0]?.reason, 'secret_like')
  const ok = await call(JSON.stringify({ title: '새 이름' }))
  assert.equal(ok.status, 200)
  assert.deepEqual(limitKeys, [`topic-write:${user}`])
  assert.deepEqual(calls, ['update:mine1'])
})

test('REV-152b L2 #171 PATCH — 분당 한도를 넘으면 429(서비스 미호출)', async () => {
  const user = 'cuser_t2r2_limit_000000'
  reset(user)
  for (let i = 0; i < TOPIC_WRITE_PER_MINUTE; i++) assert.equal((await call(JSON.stringify({ title: `이름 ${i}` }))).status, 200)
  const over = await call(JSON.stringify({ title: '하나 더' }))
  assert.equal(over.status, 429)
  assert.equal(calls.length, TOPIC_WRITE_PER_MINUTE)
  assert.equal(limitKeys.length, TOPIC_WRITE_PER_MINUTE + 1)
})
