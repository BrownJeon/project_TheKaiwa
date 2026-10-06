/**
 * task-010d REV-142 L-4(Codex C2 ②) — 라우트의 **본문 파싱 ↔ 한도 차감 순서**를 라우트 파일 그대로 시험한다(DB·엔진·세션·LLM 0).
 * - #169 `chats/[id]/reply-practice`: 본문 형태 400(잘못된 JSON·키·messageId)은 한도를 쓰지 않는다 · 정상 200·404·409 는 쓴다(DB 를 읽는 거절 경로 보호).
 * - #166 `scenarios/drafts`(동작 변경 없음 — 현재 사실 고정): 본문 형태 400 은 안 쓰고 · `topicId not_found` 400·`DRAFT_BUSY` 409 는 쓴다.
 *
 * 방법: `node --test` 는 시험 파일마다 별도 프로세스이므로, 이 파일 안에서만 `@/modules/infra`·`@/modules/conversation` 의 require 캐시 항목을
 * "진짜 + 세션·한도 기록·서비스 가짜" 객체로 바꿔 끼운 **뒤에** route.ts 를 처음 읽는다. 한도는 진짜 `rateLimit` 을 그대로 불러 429 도 실제 동작이다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Json = { success: boolean; data: { code?: string; details?: Record<string, unknown> } & Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const infraPath = req.resolve('@/modules/infra')
const conversationPath = req.resolve('@/modules/conversation')
// 진짜 모듈을 먼저 다 읽는다(서비스·하위 층은 진짜 infra 를 쥔 채로 남는다).
const infra = req(infraPath) as typeof import('@/modules/infra')
const conversation = req(conversationPath) as typeof import('@/modules/conversation')
const { ApiError } = infra

let sessionUser = 'cuser_rl_000000000000000'
const limitKeys: string[] = []
const serviceCalls: string[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

swap(infraPath, {
  ...infra,
  requireSession: async () => ({ user: { id: sessionUser, email: 'qa@example.test', name: null, role: 'USER' } }),
  rateLimit: (key: string, limit: number, windowMs?: number) => {
    limitKeys.push(key)
    infra.rateLimit(key, limit, windowMs)
  },
})
swap(conversationPath, {
  ...conversation,
  // #169 서비스 — messageId 로 결과를 고른다(서비스 자체 판정은 conversation 시험 몫).
  suggestReply: async (_userId: string, _chatId: string, messageId: string) => {
    serviceCalls.push(`suggest:${messageId}`)
    if (messageId === 'm_404') throw new ApiError('NOT_FOUND', '대화를 찾을 수 없습니다.')
    if (messageId === 'm_409') throw new ApiError('CONFLICT', '새 말이 와서 연습을 닫았어요.', { reason: 'NOT_LATEST' })
    return { messageId, ja: 'はい', ko: '네' }
  },
  // #166 서비스 — topicId 로 결과를 고른다.
  draftScenario: async (_userId: string, body: { topicId: string | null }) => {
    serviceCalls.push(`draft:${body.topicId ?? '-'}`)
    if (body.topicId === 'top_other') throw new ApiError('VALIDATION', '고를 수 없는 장소예요. 다시 골라 주세요.', { field: 'topicId', reason: 'not_found' })
    if (body.topicId === 'top_busy') throw new ApiError('CONFLICT', '초안을 만드는 중이에요.', { reason: 'DRAFT_BUSY' })
    return { draft: { title: 't' } }
  },
})

const replyRoute = req(join(__dirname, '..', 'chats', '[id]', 'reply-practice', 'route.ts')) as { POST: Handler }
const draftRoute = req(join(__dirname, '..', 'scenarios', 'drafts', 'route.ts')) as { POST: Handler }

const reset = (user: string) => {
  sessionUser = user
  limitKeys.length = 0
  serviceCalls.length = 0
}
const post = (body: string) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
async function callReply(body: string): Promise<{ status: number; json: Json }> {
  const res = await replyRoute.POST(post(body), { params: Promise.resolve({ id: 'chat_rp' }) })
  return { status: res.status, json: (await res.json()) as Json }
}
async function callDraft(body: string): Promise<{ status: number; json: Json }> {
  const res = await draftRoute.POST(post(body), {})
  return { status: res.status, json: (await res.json()) as Json }
}
const replyLimitCalls = () => limitKeys.filter((k) => k.startsWith('reply-practice')).length
const draftLimitCalls = () => limitKeys.filter((k) => k.startsWith('scenario-draft')).length

const DESC = '회사 근처 카페에서 아이스커피를 주문하고 싶어요'

test('바꿔 끼우기 확인: 라우트가 가짜 세션·한도 기록을 쓴다(아니면 아래 시험이 무의미)', async () => {
  reset('cuser_rl_check0000000000')
  const r = await callReply(JSON.stringify({ messageId: 'm_ok' }))
  assert.equal(r.status, 200)
  assert.deepEqual(limitKeys, ['reply-practice:cuser_rl_check0000000000', 'reply-practice-day:cuser_rl_check0000000000'])
  assert.deepEqual(serviceCalls, ['suggest:m_ok'])
})

test('#169 본문 형태 400(잘못된 JSON·객체 아님·그 밖 키·messageId 없음/형식) 은 한도를 쓰지 않는다 — 11회(분당 10 초과) 뒤에도 정상 요청 200', async () => {
  reset('cuser_rl_169bad000000000')
  const bad = ['{bad', '[1]', JSON.stringify({ messageId: 'm_ok', save: true }), JSON.stringify({}), JSON.stringify({ messageId: 'x'.repeat(41) }), JSON.stringify({ messageId: 7 })]
  for (let i = 0; i < 11; i++) {
    const r = await callReply(bad[i % bad.length])
    assert.equal(r.status, 400, `#${i} ${bad[i % bad.length]}`)
    assert.equal(r.json.data.code, 'VALIDATION')
  }
  assert.equal(replyLimitCalls(), 0, '본문 400 은 한도 차감 0')
  assert.deepEqual(serviceCalls, [], '본문 400 은 서비스(DB) 0')
  const ok = await callReply(JSON.stringify({ messageId: 'm_ok' }))
  assert.equal(ok.status, 200, '본문 400 을 아무리 보내도 한도가 남아 있다')
  assert.equal(replyLimitCalls(), 2, '정상 요청 1건 = 분당·하루 각 1회')
})

test('#169 정상 200·404(남의·없는 대화)·409(NOT_LATEST) 는 한도를 쓴다 — 분당 10 을 다 쓰면 11번째는 429(서비스 호출 없음, Retry-After)', async () => {
  reset('cuser_rl_169use000000000')
  const ids = ['m_ok', 'm_404', 'm_409']
  const want = [200, 404, 409]
  for (let i = 0; i < 10; i++) {
    const r = await callReply(JSON.stringify({ messageId: ids[i % 3] }))
    assert.equal(r.status, want[i % 3], `#${i}`)
    assert.equal(replyLimitCalls(), (i + 1) * 2, `#${i} 차감`)
  }
  const before = serviceCalls.length
  const res = await replyRoute.POST(post(JSON.stringify({ messageId: 'm_ok' })), { params: Promise.resolve({ id: 'chat_rp' }) })
  assert.equal(res.status, 429)
  assert.ok(Number(res.headers.get('Retry-After')) > 0)
  assert.equal(serviceCalls.length, before, '한도 초과면 서비스를 부르지 않는다')
})

test('#166 본문 형태 400(설명 5자 미만·그 밖 키·수준·topicId 형식) 은 한도를 쓰지 않는다 — 7회(분당 6 초과) 뒤에도 정상 요청 200', async () => {
  reset('cuser_rl_166bad000000000')
  const bad = [
    { description: '카페', level: 'N5' },
    { description: DESC, level: 'N5', save: true },
    { description: DESC, level: 'N9' },
    { description: DESC, level: 'N5', topicId: 'x'.repeat(41) },
  ]
  for (let i = 0; i < 7; i++) {
    const r = await callDraft(JSON.stringify(bad[i % bad.length]))
    assert.equal(r.status, 400, `#${i}`)
  }
  assert.equal(draftLimitCalls(), 0)
  assert.deepEqual(serviceCalls, [])
  const ok = await callDraft(JSON.stringify({ description: DESC, level: 'N5' }))
  assert.equal(ok.status, 200)
  assert.equal(draftLimitCalls(), 2)
})

test('#166 topicId not_found 400·DRAFT_BUSY 409 는 한도를 쓴다(현재 동작 고정 — 서비스가 DB 를 읽은 뒤의 거절) · 분당 6 을 다 쓰면 7번째 429', async () => {
  reset('cuser_rl_166use000000000')
  const r1 = await callDraft(JSON.stringify({ description: DESC, level: 'N5', topicId: 'top_busy' }))
  assert.equal(r1.status, 409)
  assert.equal(r1.json.data.details?.reason, 'DRAFT_BUSY')
  assert.equal(draftLimitCalls(), 2, 'DRAFT_BUSY 도 차감')
  for (let i = 0; i < 5; i++) {
    const r = await callDraft(JSON.stringify({ description: DESC, level: 'N5', topicId: 'top_other' }))
    assert.equal(r.status, 400)
    assert.deepEqual([r.json.data.details?.field, r.json.data.details?.reason], ['topicId', 'not_found'])
  }
  assert.equal(draftLimitCalls(), 12, 'topicId not_found 도 차감')
  const before = serviceCalls.length
  const r7 = await callDraft(JSON.stringify({ description: DESC, level: 'N5', topicId: 'top_other' }))
  assert.equal(r7.status, 429)
  assert.equal(serviceCalls.length, before)
})
