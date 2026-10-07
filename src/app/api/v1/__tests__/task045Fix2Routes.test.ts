/**
 * task-045 감사 잔여 보완(REV-154 L-1 ①) — 주제 삭제 라우트가 요청에 실린 다른 사용자 id 를 믿지 않음을 라우트 파일 그대로 시험한다
 * (DB·엔진·세션·LLM 0, `task045T13Routes.test.ts` 와 같은 방법: `@/modules/infra`·`@/modules/learning` require 캐시를 진짜 + 세션·서비스 가짜로 바꾼 뒤 route.ts 를 읽는다).
 * - #172 GET /topics/:id/removal?userId=<남> · #173 DELETE /topics/:id?ack=none&userId=<남> · #176 POST /seed-overrides/restore 본문 userId=<남>
 *   → 서비스는 세션 사용자로만 불리고 남의 id 는 어떤 인자에도 실리지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const paths = { infra: req.resolve('@/modules/infra'), learning: req.resolve('@/modules/learning') }
const infra = req(paths.infra) as typeof import('@/modules/infra')
const learning = req(paths.learning) as typeof import('@/modules/learning')

const SESSION = 'cuser_fx2_session_0000000'
const OTHER = 'cuser_fx2_someone_else_00'
const calls: { fn: string; args: unknown[] }[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

const PREVIEW = { topicId: 'topic_mine', title: '내 주제', isSeed: false, isSeedCopy: false, ack: 'none', activeChallenge: null }
swap(paths.infra, {
  ...infra,
  requireSession: async () => ({ user: { id: SESSION, email: 'qa@example.test', name: null, role: 'USER' } }),
})
swap(paths.learning, {
  ...learning,
  previewTopicRemoval: async (...args: unknown[]) => (calls.push({ fn: 'preview', args }), { ...PREVIEW, topicId: args[1] }),
  removeUserTopic: async (...args: unknown[]) => {
    calls.push({ fn: 'remove', args })
    return { topicId: args[1], result: 'REMOVED', mode: 'DELETE', challengeDeleted: false, deletedChallengeId: null, scenariosArchived: 0, scenariosUnlinked: 0, scenariosRelinked: 0, seedId: null }
  },
  restoreSeed: async (...args: unknown[]) => (calls.push({ fn: 'restore', args }), { kind: args[1], seedId: args[2], path: 'HIDDEN', copyId: null, removal: null }),
})

const route = <T>(...p: string[]) => req(join(__dirname, '..', ...p, 'route.ts')) as T
const removalRoute = route<{ GET: Handler }>('topics', '[id]', 'removal')
const topicIdRoute = route<{ DELETE: Handler }>('topics', '[id]')
const restoreRoute = route<{ POST: Handler }>('seed-overrides', 'restore')

const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) })
const mk = (method: string, url: string, body?: string) => new Request(`http://localhost${url}`, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body }) })
const mentionsOther = () => JSON.stringify(calls).includes(OTHER)

test('#172 GET /topics/:id/removal?userId=<남> — 세션 사용자로만 조회(쿼리 userId 무시)', async () => {
  calls.length = 0
  const res = await removalRoute.GET(mk('GET', `/api/v1/topics/topic_mine/removal?userId=${OTHER}`), ctxOf('topic_mine'))
  assert.equal(res.status, 200)
  assert.deepEqual(calls, [{ fn: 'preview', args: [SESSION, 'topic_mine'] }])
  assert.ok(!mentionsOther())
})

test('#173 DELETE /topics/:id?ack=none&userId=<남> — 세션 사용자로만 지운다', async () => {
  calls.length = 0
  const res = await topicIdRoute.DELETE(mk('DELETE', `/api/v1/topics/topic_mine?ack=none&userId=${OTHER}`), ctxOf('topic_mine'))
  assert.equal(res.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].fn, 'remove')
  assert.deepEqual(calls[0].args.slice(0, 2), [SESSION, 'topic_mine'])
  assert.ok(!mentionsOther())
})

test('#176 POST /seed-overrides/restore 본문 userId=<남> — 서비스가 불리면 세션 사용자로만(남의 id 는 어떤 인자에도 없음)', async () => {
  calls.length = 0
  const res = await restoreRoute.POST(mk('POST', '/api/v1/seed-overrides/restore', JSON.stringify({ kind: 'SCENARIO', seedId: 'seed_scn', userId: OTHER })), {})
  assert.ok(res.status === 200 || res.status === 400, `200(모르는 키 무시) 또는 400(거절): ${res.status}`)
  if (res.status === 200) {
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0].args.slice(0, 3), [SESSION, 'SCENARIO', 'seed_scn'])
  } else {
    assert.equal(calls.length, 0)
  }
  assert.ok(!mentionsOther())
})
