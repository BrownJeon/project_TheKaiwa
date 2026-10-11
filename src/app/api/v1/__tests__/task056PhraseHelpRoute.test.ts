/**
 * task-056 #180 `POST /api/v1/chats/:id/phrase-help` — 라우트 파일 그대로 시험(DB·엔진·세션·LLM 0).
 * - 본문 400(잘못된 JSON·1KB 초과·reason 8종)은 한도를 쓰지 않고 서비스(DB)도 부르지 않는다 — field·reason·message 그대로.
 * - 정상 200 `{items}` + `Cache-Control: private, no-store` · 404·409(서비스 거절)는 한도를 쓴다(#169 REV-142 L-4 와 같은 순서).
 * - 429: 분당 10(11번째) · 하루 300(301번째, 분 창은 시계를 넘겨 비운다) — `Retry-After`·`retryAfterSec`, 서비스 호출 없음.
 * - 본문 1KB 상한(유효하지만 큰 본문 → 400, 경계 1024/1025바이트) · 세션 없음 401(본문·한도·서비스보다 먼저) · `req.signal` 이 서비스까지 전달(REV-190 M1·L2·L4).
 *
 * 방법(task010dRateLimitOrder 와 같음): 이 파일 안에서만 `@/modules/infra`·`@/modules/conversation` 의 require 캐시 항목을
 * "진짜 + 세션·한도 기록·서비스 가짜" 로 바꿔 끼운 **뒤에** route.ts 를 처음 읽는다. 한도는 진짜 `rateLimit` 을 그대로 부른다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Json = { success: boolean; data: { code?: string; details?: Record<string, unknown>; items?: unknown[] } & Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const infraPath = req.resolve('@/modules/infra')
const conversationPath = req.resolve('@/modules/conversation')
const infra = req(infraPath) as typeof import('@/modules/infra')
const conversation = req(conversationPath) as typeof import('@/modules/conversation')
const { ApiError } = infra

let sessionUser: string | null = 'cuser_ph_000000000000000'
const limitKeys: string[] = []
const serviceCalls: string[] = []
const serviceSignals: (AbortSignal | undefined)[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

swap(infraPath, {
  ...infra,
  // 진짜 `requireSession` 처럼 세션이 없으면 401 봉투용 ApiError 를 던진다.
  requireSession: async () => {
    if (!sessionUser) throw new ApiError('UNAUTHENTICATED', '로그인이 필요합니다.')
    return { user: { id: sessionUser, email: 'qa@example.test', name: null, role: 'USER' } }
  },
  rateLimit: (key: string, limit: number, windowMs?: number) => {
    limitKeys.push(key)
    infra.rateLimit(key, limit, windowMs)
  },
})
swap(conversationPath, {
  ...conversation,
  // 본문 검사는 진짜(readPhraseHelpBody) — 서비스만 가짜. 대화 id 로 결과를 고른다(서비스 자체 판정은 conversation 시험 몫).
  helpPhrase: async (_userId: string, chatId: string, body: { queryKo: string }, _deps?: unknown, signal?: AbortSignal) => {
    serviceCalls.push(`${chatId}:${body.queryKo}`)
    serviceSignals.push(signal)
    if (chatId === 'chat_404') throw new ApiError('NOT_FOUND', '채팅을 찾을 수 없어요.')
    if (chatId === 'chat_ended') throw new ApiError('CONFLICT', '마친 역할극이에요.', { reason: 'ENDED' })
    if (chatId === 'chat_busy') throw new ApiError('CONFLICT', '일본어 표현을 찾는 중이에요.', { reason: 'PHRASE_BUSY' })
    if (chatId === 'chat_empty') return { items: [] }
    return { items: [{ ja: 'コーヒーください。', ko: '커피 주세요.' }] }
  },
})

const route = req(join(__dirname, '..', 'chats', '[id]', 'phrase-help', 'route.ts')) as { POST: Handler }

const reset = (user: string | null) => {
  sessionUser = user
  limitKeys.length = 0
  serviceCalls.length = 0
  serviceSignals.length = 0
}
const post = (body: string, signal?: AbortSignal) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body, ...(signal ? { signal } : {}) })
async function call(body: string, id = 'chat_ok', signal?: AbortSignal): Promise<{ status: number; json: Json; headers: Headers }> {
  const res = await route.POST(post(body, signal), { params: Promise.resolve({ id }) })
  return { status: res.status, json: (await res.json()) as Json, headers: res.headers }
}
const limitCalls = () => limitKeys.filter((k) => k.startsWith('phrase-help')).length
const Q = JSON.stringify({ queryKo: '커피 한 잔 주문하고 싶어요' })

test('바꿔 끼우기 확인 + 정상 200: {items} · no-store · 한도 키 분당·하루 각 1회', async () => {
  reset('cuser_ph_check0000000000')
  const r = await call(Q)
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.data, { items: [{ ja: 'コーヒーください。', ko: '커피 주세요.' }] })
  assert.equal(r.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(limitKeys, ['phrase-help:cuser_ph_check0000000000', 'phrase-help-day:cuser_ph_check0000000000'])
  assert.deepEqual(serviceCalls, ['chat_ok:커피 한 잔 주문하고 싶어요'], '정리한 질의가 서비스로')
  const empty = await call(Q, 'chat_empty')
  assert.equal(empty.status, 200)
  assert.deepEqual(empty.json.data, { items: [] }, '거절·못 찾음도 200 빈 목록')
  assert.equal(empty.headers.get('Cache-Control'), 'private, no-store')
})

test('본문 400 — reason 8종(+잘못된 JSON·1KB 초과)은 field·reason·message 그대로 · 한도 미소모 · 서비스(DB) 0 · 그 뒤 정상 요청 200', async () => {
  reset('cuser_ph_bad00000000000')
  const cases: [string, string | null, string | null][] = [
    ['{bad', null, null],
    [JSON.stringify({ queryKo: '가'.repeat(400) }), null, null], // 1KB 초과(UTF-8 3바이트 × 400)
    [JSON.stringify({ queryKo: 5 }), 'queryKo', 'type'],
    [JSON.stringify({}), 'queryKo', 'required'],
    ['', 'queryKo', 'required'],
    [JSON.stringify({ queryKo: '가'.repeat(101) }), 'queryKo', 'max_length'],
    [JSON.stringify({ queryKo: '<b>안녕</b> 라고 말하고 싶어' }), 'queryKo', 'forbidden_char'],
    [JSON.stringify({ queryKo: '?!...!!' }), 'queryKo', 'no_text'],
    [JSON.stringify({ queryKo: 'I want a coffee' }), 'queryKo', 'no_hangul'],
    [JSON.stringify({ queryKo: '키는 sk-ant-api03-abcdefgh12345678 이라고 말하고 싶어' }), 'queryKo', 'secret_like'],
    [JSON.stringify({ queryKo: '안녕하세요', save: true }), 'body', 'unknown_key'],
    [JSON.stringify({ queryKo: '   ' }), 'queryKo', 'required'],
  ]
  for (const [b, field, reason] of cases) {
    const r = await call(b)
    assert.equal(r.status, 400, b.slice(0, 40))
    assert.equal(r.json.data.code, 'VALIDATION')
    if (field) {
      assert.equal(r.json.data.details?.field, field, b.slice(0, 40))
      assert.equal(r.json.data.details?.reason, reason, b.slice(0, 40))
      assert.ok(r.json.message && /[가-힣]/.test(r.json.message), '사용자용 한국어 message')
    }
  }
  assert.equal(limitCalls(), 0, '본문 400 은 한도 차감 0')
  assert.deepEqual(serviceCalls, [], '본문 400 은 서비스(DB) 0')
  const ok = await call(Q)
  assert.equal(ok.status, 200, '본문 400 을 12번 보내도 한도가 남아 있다')
})

test('404·409(ENDED·PHRASE_BUSY) 는 한도를 쓴다 — 분당 10 을 다 쓰면 11번째는 429(Retry-After·retryAfterSec, 서비스 호출 없음)', async () => {
  reset('cuser_ph_min00000000000')
  const ids = ['chat_ok', 'chat_404', 'chat_ended', 'chat_busy']
  const want: [number, string | undefined][] = [[200, undefined], [404, 'NOT_FOUND'], [409, 'ENDED'], [409, 'PHRASE_BUSY']]
  for (let i = 0; i < 10; i++) {
    const r = await call(Q, ids[i % 4])
    assert.equal(r.status, want[i % 4][0], `#${i}`)
    if (r.status === 409) assert.equal(r.json.data.details?.reason, want[i % 4][1])
    assert.equal(limitCalls(), (i + 1) * 2, `#${i} 차감`)
  }
  const before = serviceCalls.length
  const r = await call(Q)
  assert.equal(r.status, 429)
  assert.equal(r.json.data.code, 'RATE_LIMITED')
  const sec = Number(r.headers.get('Retry-After'))
  assert.ok(sec > 0 && sec <= 60)
  assert.equal(r.json.data.details?.retryAfterSec, sec)
  assert.equal(serviceCalls.length, before, '한도 초과면 서비스를 부르지 않는다')
})

test('하루 300: 분 창을 비워 가며 300번째까지 200 · 301번째 429(하루 창 Retry-After)', async () => {
  reset('cuser_ph_day00000000000')
  const realNow = Date.now
  let t = realNow()
  Date.now = () => t
  try {
    for (let i = 0; i < 300; i++) {
      if (i > 0 && i % 10 === 0) t += 61_000
      const r = await call(Q)
      assert.equal(r.status, 200, `#${i}`)
    }
    t += 61_000
    const r = await call(Q)
    assert.equal(r.status, 429)
    assert.ok(Number(r.headers.get('Retry-After')) > 60, '분 창이 아니라 하루 창')
    assert.equal(serviceCalls.length, 300)
  } finally {
    Date.now = realNow
  }
})

test('본문 1KB 상한: 유효한 JSON 이라도 1024바이트를 넘으면 400(본문 너무 큼, 한도·서비스 0) — 1024바이트는 통과, 1025바이트부터 400', async () => {
  reset('cuser_ph_size0000000000')
  const base = JSON.stringify({ queryKo: '안녕하세요' })
  const padded = (bytes: number) => base + ' '.repeat(bytes - Buffer.byteLength(base))
  // 질의는 짧고 형식도 맞다 — 상한이 풀리면(64KB) 200 이 되므로 `max_length` 같은 질의 검사와 구분된다.
  assert.equal(Buffer.byteLength(padded(1025)), 1025)
  const big = await call(padded(1025))
  assert.equal(big.status, 400)
  assert.equal(big.json.data.code, 'VALIDATION')
  assert.equal(big.json.message, '요청 본문이 너무 큽니다.')
  assert.equal(big.json.data.details, undefined, '질의 검사 reason 이 아니라 본문 크기 거절')
  const huge = await call(padded(5000))
  assert.equal(huge.status, 400)
  assert.equal(limitCalls(), 0, '크기 400 은 한도 차감 0')
  assert.deepEqual(serviceCalls, [], '크기 400 은 서비스(DB) 0')
  const edge = await call(padded(1024))
  assert.equal(edge.status, 200, '1024바이트 경계는 통과')
  assert.equal(serviceCalls.length, 1)
})

test('세션 없음 401: 본문 검사·한도·서비스보다 먼저 거절한다(나쁜 본문이어도 400 이 아니라 401)', async () => {
  reset(null)
  for (const b of ['{bad', Q, JSON.stringify({ queryKo: 'I want a coffee' })]) {
    const r = await call(b)
    assert.equal(r.status, 401, b.slice(0, 20))
    assert.equal(r.json.data.code, 'UNAUTHENTICATED')
  }
  assert.equal(limitCalls(), 0, '세션 없음은 한도 차감 0')
  assert.deepEqual(serviceCalls, [], '세션 없음은 서비스 0')
})

test('req.signal 이 서비스까지 전달된다: 손님이 요청을 끊으면(abort) 서비스가 받은 신호도 abort — 서비스 시험이 그 신호의 엔진 취소를 본다', async () => {
  reset('cuser_ph_signal00000000')
  const ac = new AbortController()
  const r = await call(Q, 'chat_ok', ac.signal)
  assert.equal(r.status, 200)
  assert.equal(serviceSignals.length, 1)
  const got = serviceSignals[0]
  assert.ok(got instanceof AbortSignal, '서비스 5번째 인자가 AbortSignal')
  assert.equal(got.aborted, false, '연결이 살아 있는 동안은 abort 아님')
  ac.abort()
  assert.equal(got.aborted, true, '손님이 끊으면 서비스가 받은 신호도 abort')
  // 신호 없이 부른 요청도 Request 가 항상 신호를 갖는다 — 서비스는 항상 받는다.
  await call(Q)
  assert.ok(serviceSignals[1] instanceof AbortSignal)
})
