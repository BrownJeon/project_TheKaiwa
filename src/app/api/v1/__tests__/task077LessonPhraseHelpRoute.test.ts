/**
 * task-077 #184 `POST /api/v1/lessons/:id/phrase-help` — 라우트 파일 그대로 시험(DB·엔진·세션·LLM 0).
 * - 소유 확인은 **진짜** learning `assertOwnedLesson` 이 가짜 `prisma.lesson` 델리게이트(레슨 표: id·userId·status)를 읽는다 — 남의·없는·형식 틀린 레슨 404, 상태(READY·IN_PROGRESS·DONE·GENERATING·FAILED) 무관 200.
 * - 서비스는 가짜(`helpLessonPhrase` — 서비스 자체 판정은 conversation `task077LessonHelpServer.test.ts` 몫). 본문 검사·한도는 진짜(`readPhraseHelpBody`·`rateLimit`).
 * - #180·#181 라우트도 같은 프로세스에 함께 실어 ① 응답·오류 봉투가 #180 과 **바이트까지 같다** ② 분당 10·하루 300 이 세 라우트에서 **합산**됨을 실제 호출로 본다.
 *
 * 방법(task056PhraseHelpRoute 와 같음): 이 파일 안에서만 `@/modules/infra`·`@/modules/conversation` 의 require 캐시 항목을 "진짜 + 세션·한도 기록·서비스 가짜" 로 바꿔 끼운 **뒤에** route.ts 를 처음 읽는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

type Json = { success: boolean; data: { code?: string; details?: Record<string, unknown>; items?: unknown[] } & Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const infraPath = req.resolve('@/modules/infra')
const conversationPath = req.resolve('@/modules/conversation')
const infra = req(infraPath) as typeof import('@/modules/infra')
const conversation = req(conversationPath) as typeof import('@/modules/conversation')
const { ApiError, prisma } = infra

const U = 'cuser_lph_00000000000000'
const OTHER = 'cuser_lph_other000000000'
let sessionUser: string | null = U
const limitKeys: string[] = []
const serviceCalls: string[] = []
const serviceSignals: (AbortSignal | undefined)[] = []
const ownerQueries: unknown[] = []

/** 가짜 레슨 표 — `self` 는 지금 세션 사용자(시험마다 다른 사용자라 한도 창이 섞이지 않는다), `other` 는 남. 진짜 `assertOwnedLesson` 은 `prisma.lesson.count({ where: { id, userId } })` 만 읽는다. */
const LESSONS: Record<string, { owner: 'self' | 'other'; status: string }> = {
  les_ready: { owner: 'self', status: 'READY' },
  les_progress: { owner: 'self', status: 'IN_PROGRESS' },
  les_done: { owner: 'self', status: 'DONE' },
  les_gen: { owner: 'self', status: 'GENERATING' },
  les_failed: { owner: 'self', status: 'FAILED' },
  les_busy: { owner: 'self', status: 'IN_PROGRESS' },
  les_empty: { owner: 'self', status: 'IN_PROGRESS' },
  les_other: { owner: 'other', status: 'IN_PROGRESS' },
}
let selfUser = U
const rowOf = (where: { id?: unknown; userId?: unknown }) => {
  const r = typeof where.id === 'string' ? LESSONS[where.id] : undefined
  if (!r) return null
  const userId = r.owner === 'self' ? selfUser : OTHER
  return where.userId === undefined || where.userId === userId ? { id: where.id, userId, status: r.status } : null
}
Object.defineProperty(prisma, 'lesson', {
  configurable: true,
  writable: true,
  value: {
    count: async (args: { where: { id?: unknown; userId?: unknown } }) => (ownerQueries.push(args.where), rowOf(args.where) ? 1 : 0),
    findFirst: async (args: { where: { id?: unknown; userId?: unknown } }) => (ownerQueries.push(args.where), rowOf(args.where)),
    findUnique: async (args: { where: { id?: unknown; userId?: unknown } }) => (ownerQueries.push(args.where), rowOf(args.where)),
  },
})

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

const ITEMS = [
  { ja: '週末に友達に会いました。', ko: '주말에 친구를 만났어요.', labelKo: '정중하게', whyKo: '지난 일을 말할 때 흔해요.' },
  { ja: '週末、友達に会ったよ。', ko: '주말에 친구 만났어.', labelKo: '편하게' },
]
const busy = () => new ApiError('CONFLICT', '일본어 표현을 찾는 중이에요.', { reason: 'PHRASE_BUSY' })

swap(infraPath, {
  ...infra,
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
  helpLessonPhrase: async (userId: string, lessonId: string, body: { queryKo: string }, _deps?: unknown, signal?: AbortSignal) => {
    serviceCalls.push(`lesson:${userId}:${lessonId}:${body.queryKo}`)
    serviceSignals.push(signal)
    if (lessonId === 'les_busy') throw busy()
    if (lessonId === 'les_empty') return { items: [] }
    return { items: ITEMS }
  },
  // #180·#181 — 봉투 대조·한도 합산용. 같은 결과를 낸다.
  helpPhrase: async (_userId: string, chatId: string, body: { queryKo: string }) => {
    serviceCalls.push(`chat:${chatId}:${body.queryKo}`)
    if (chatId === 'chat_busy') throw busy()
    if (chatId === 'chat_empty') return { items: [] }
    return { items: ITEMS }
  },
  helpWordPhrase: async (_userId: string, body: { queryKo: string }) => {
    serviceCalls.push(`word:${body.queryKo}`)
    return { items: [{ ja: '友達', ko: '친구' }] }
  },
})

const lessonRoute = req(join(__dirname, '..', 'lessons', '[id]', 'phrase-help', 'route.ts')) as { POST: Handler }
const chatRoute = req(join(__dirname, '..', 'chats', '[id]', 'phrase-help', 'route.ts')) as { POST: Handler }
const wordRoute = req(join(__dirname, '..', 'words', 'phrase-help', 'route.ts')) as { POST: Handler }

/** 시험마다 다른 사용자 — 한도 창(분당 10)이 시험 사이에 섞이지 않게. `self` 레슨의 주인도 이 사용자다. */
const reset = (user: string | null) => {
  sessionUser = user
  if (user) selfUser = user
  limitKeys.length = 0
  serviceCalls.length = 0
  serviceSignals.length = 0
  ownerQueries.length = 0
}
const post = (body: string, signal?: AbortSignal) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body, ...(signal ? { signal } : {}) })
type Res = { status: number; text: string; json: Json; headers: Headers }
async function run(h: Handler, body: string, id?: string, signal?: AbortSignal): Promise<Res> {
  const res = await h(post(body, signal), { params: Promise.resolve({ id }) })
  const text = await res.text()
  return { status: res.status, text, json: JSON.parse(text) as Json, headers: res.headers }
}
const call = (body: string, id = 'les_progress', signal?: AbortSignal) => run(lessonRoute.POST, body, id, signal)
const callChat = (body: string, id = 'chat_ok') => run(chatRoute.POST, body, id)
const callWord = (body: string) => run(wordRoute.POST, body)
const limitCalls = () => limitKeys.filter((k) => k.startsWith('phrase-help')).length
const lessonCalls = () => serviceCalls.filter((c) => c.startsWith('lesson:')).length
const Q = JSON.stringify({ queryKo: '  주말에 친구를 만났어요  ' })

test('바꿔 끼우기 확인 + 정상 200: {items} · no-store · 한도 키 분당·하루 각 1회 · 소유 확인은 (id, userId) · 정리한 질의·레슨 id 가 서비스로', async () => {
  reset(U)
  const r = await call(Q)
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { success: true, data: { items: ITEMS }, message: null })
  assert.equal(r.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(limitKeys, [`phrase-help:${U}`, `phrase-help-day:${U}`])
  assert.deepEqual(ownerQueries, [{ id: 'les_progress', userId: U }], '소유 확인은 (id, userId) 로 한 번')
  assert.deepEqual(serviceCalls, [`lesson:${U}:les_progress:주말에 친구를 만났어요`])
  const empty = await call(Q, 'les_empty')
  assert.equal(empty.status, 200)
  assert.deepEqual(empty.json.data, { items: [] }, '거절·못 찾음도 200 빈 목록')
})

test('응답 모양이 #180 과 바이트까지 같다: 성공·빈 목록·PHRASE_BUSY·본문 400 봉투와 상태·헤더', async () => {
  reset('cuser_lph_bytes0000000000')
  {
    const x = await call(Q, 'les_progress')
    const y = await callChat(Q, 'chat_ok')
    assert.equal(x.status, 200)
    assert.equal(x.text, y.text, '성공: 본문 바이트 동일')
    assert.equal(x.headers.get('Cache-Control'), y.headers.get('Cache-Control'))
    assert.equal(x.headers.get('content-type'), y.headers.get('content-type'))
  }
  for (const [label, lessonId, chatId] of [['빈 목록', 'les_empty', 'chat_empty'], ['PHRASE_BUSY', 'les_busy', 'chat_busy']] as const) {
    const x = await call(Q, lessonId)
    const y = await callChat(Q, chatId)
    assert.equal(x.status, y.status, label)
    assert.equal(x.text, y.text, `${label}: 본문 바이트 동일`)
  }
  const busyRes = await call(Q, 'les_busy')
  assert.equal(busyRes.status, 409)
  assert.equal(busyRes.json.data.details?.reason, 'PHRASE_BUSY')
  for (const bad of ['{bad', JSON.stringify({ queryKo: 'I want a coffee' }), JSON.stringify({ queryKo: Q, lessonId: 'x' })]) {
    const x = await call(bad)
    const y = await callChat(bad)
    assert.equal(x.status, 400)
    assert.equal(x.text, y.text, `400 봉투 동일: ${bad.slice(0, 20)}`)
  }
})

test('레슨 상태는 묻지 않는다: READY·IN_PROGRESS·DONE(끝난 레슨)·GENERATING·FAILED 모두 200 — 409 ENDED 없음', async () => {
  for (const id of ['les_ready', 'les_progress', 'les_done', 'les_gen', 'les_failed']) {
    reset('cuser_lph_state000000000')
    const r = await call(Q, id)
    assert.equal(r.status, 200, id)
    assert.deepEqual(r.json.data, { items: ITEMS }, id)
    assert.equal(lessonCalls(), 1, id)
  }
})

test('404: 남의 레슨·없는 레슨·형식 틀린 id — 서비스(엔진) 0 · 한도는 쓴다(#180 과 같은 순서) · 남의 것과 없는 것의 봉투가 같다(존재 숨김)', async () => {
  reset('cuser_lph_404_00000000000')
  const bodies: string[] = []
  for (const id of ['les_other', 'les_nope', '../etc', 'a'.repeat(41), '']) {
    const before = limitCalls()
    const r = await call(Q, id)
    assert.equal(r.status, 404, `id=${id.slice(0, 10)}`)
    assert.equal(r.json.data.code, 'NOT_FOUND')
    assert.equal(r.json.message, '수업을 찾을 수 없어요.')
    assert.equal(limitCalls() - before, 2, '404 는 DB 를 읽는 거절이라 한도 안')
    bodies.push(r.text)
  }
  assert.equal(lessonCalls(), 0, '404 는 서비스 0')
  assert.equal(new Set(bodies).size, 1, '남의·없는·형식 틀린 레슨이 같은 봉투')
  // 남의 레슨도 그 주인은 그대로 쓸 수 있다(404 는 주인이 아닐 때만).
  reset(OTHER)
  assert.equal((await call(Q, 'les_other')).status, 200)
  assert.deepEqual(ownerQueries, [{ id: 'les_other', userId: OTHER }])
})

test('본문 400 — reason 8종(+잘못된 JSON·1KB 초과)은 field·reason·message 그대로 · 한도·소유 확인·서비스 0 · 그 뒤 정상 200', async () => {
  reset('cuser_lph_400_00000000000')
  const cases: [string, string | null, string | null][] = [
    ['{bad', null, null],
    [JSON.stringify({ queryKo: '가'.repeat(400) }), null, null],
    [JSON.stringify({ queryKo: 5 }), 'queryKo', 'type'],
    [JSON.stringify({}), 'queryKo', 'required'],
    ['', 'queryKo', 'required'],
    [JSON.stringify({ queryKo: '가'.repeat(101) }), 'queryKo', 'max_length'],
    [JSON.stringify({ queryKo: '<b>안녕</b> 라고 말하고 싶어' }), 'queryKo', 'forbidden_char'],
    [JSON.stringify({ queryKo: '?!...!!' }), 'queryKo', 'no_text'],
    [JSON.stringify({ queryKo: 'I want a coffee' }), 'queryKo', 'no_hangul'],
    [JSON.stringify({ queryKo: '키는 sk-ant-api03-abcdefgh12345678 이라고 말하고 싶어' }), 'queryKo', 'secret_like'],
    [JSON.stringify({ queryKo: '안녕하세요', save: true }), 'body', 'unknown_key'],
    [JSON.stringify({ queryKo: '안녕하세요', mode: 'word' }), 'body', 'unknown_key'],
    [JSON.stringify({ queryKo: '   ' }), 'queryKo', 'required'],
  ]
  for (const [b, field, reason] of cases) {
    const r = await call(b)
    assert.equal(r.status, 400, b.slice(0, 40))
    assert.equal(r.json.data.code, 'VALIDATION')
    if (field) {
      assert.equal(r.json.data.details?.field, field, b.slice(0, 40))
      assert.equal(r.json.data.details?.reason, reason, b.slice(0, 40))
    }
  }
  assert.equal(limitCalls(), 0, '본문 400 은 한도 차감 0')
  assert.deepEqual(ownerQueries, [], '본문 400 은 소유 확인(DB) 0')
  assert.deepEqual(serviceCalls, [], '본문 400 은 서비스 0')
  // 본문 400 이 먼저다 — 남의 레슨이어도 나쁜 본문이면 400.
  assert.equal((await call('{bad', 'les_other')).status, 400)
  assert.equal((await call(Q)).status, 200)
})

test('본문 1KB 상한: 1024바이트는 통과 · 1025바이트부터 400(한도·소유 확인·서비스 0)', async () => {
  reset('cuser_lph_1kb_00000000000')
  const base = JSON.stringify({ queryKo: '안녕하세요' })
  const padded = (bytes: number) => base + ' '.repeat(bytes - Buffer.byteLength(base))
  const big = await call(padded(1025))
  assert.equal(big.status, 400)
  assert.equal(big.json.message, '요청 본문이 너무 큽니다.')
  assert.equal(limitCalls(), 0)
  assert.deepEqual(ownerQueries, [])
  assert.equal((await call(padded(1024))).status, 200)
})

test('세션 없음 401: 본문·한도·소유 확인·서비스보다 먼저(나쁜 본문·남의 레슨이어도 401)', async () => {
  reset(null)
  for (const [b, id] of [['{bad', 'les_progress'], [Q, 'les_other'], [Q, 'les_progress']] as const) {
    const r = await call(b, id)
    assert.equal(r.status, 401)
    assert.equal(r.json.data.code, 'UNAUTHENTICATED')
  }
  assert.equal(limitCalls(), 0)
  assert.deepEqual(ownerQueries, [])
  assert.deepEqual(serviceCalls, [])
})

test('분당 10: 200·404·409 가 섞여도 10번 다 쓰면 11번째는 429(Retry-After·retryAfterSec) — 소유 확인·서비스 0', async () => {
  reset('cuser_lph_min0000000000')
  const ids = ['les_progress', 'les_nope', 'les_busy', 'les_other']
  const want = [200, 404, 409, 404]
  for (let i = 0; i < 10; i++) {
    const r = await call(Q, ids[i % 4])
    assert.equal(r.status, want[i % 4], `#${i}`)
    assert.equal(limitCalls(), (i + 1) * 2)
  }
  const ownerBefore = ownerQueries.length
  const svcBefore = serviceCalls.length
  const r = await call(Q, 'les_progress')
  assert.equal(r.status, 429)
  assert.equal(r.json.data.code, 'RATE_LIMITED')
  const sec = Number(r.headers.get('Retry-After'))
  assert.ok(sec > 0 && sec <= 60)
  assert.equal(r.json.data.details?.retryAfterSec, sec)
  assert.equal(ownerQueries.length, ownerBefore, '한도 초과면 소유 확인 0')
  assert.equal(serviceCalls.length, svcBefore, '한도 초과면 서비스 0')
})

test('한도 합산(B3 A) — 분당: #180 6번 + #181 2번 + #184 2번 = 10 → 세 라우트 모두 11번째 429 · 반대로 #184 10번 뒤 #180·#181 도 429 · 다른 사용자는 별개', async () => {
  const u1 = 'cuser_lph_share100000000'
  reset(u1)
  for (let i = 0; i < 6; i++) assert.equal((await callChat(Q)).status, 200, `#180 #${i}`)
  for (let i = 0; i < 2; i++) assert.equal((await callWord(JSON.stringify({ queryKo: '친구' }))).status, 200, `#181 #${i}`)
  for (let i = 0; i < 2; i++) assert.equal((await call(Q, 'les_progress')).status, 200, `#184 #${i}`)
  assert.equal((await call(Q, 'les_progress')).status, 429, '#184 11번째')
  assert.equal((await callChat(Q)).status, 429, '#180 도 429')
  assert.equal((await callWord(JSON.stringify({ queryKo: '친구' }))).status, 429, '#181 도 429')

  const u2 = 'cuser_lph_share200000000'
  reset(u2)
  for (let i = 0; i < 10; i++) assert.equal((await call(Q, 'les_done')).status, 200, `#184 #${i}`)
  assert.equal((await callChat(Q)).status, 429, '#184 가 다 쓴 뒤 #180 은 429')
  assert.equal((await callWord(JSON.stringify({ queryKo: '친구' }))).status, 429, '#184 가 다 쓴 뒤 #181 은 429')

  reset('cuser_lph_share300000000')
  assert.equal((await callChat(Q)).status, 200, '다른 사용자는 별개 창')
})

test('한도 합산(B3 A) — 하루 300: #180·#184 를 번갈아 300번(분 창은 시계를 넘겨 비움) → 301번째는 두 라우트 모두 429(하루 창 Retry-After)', async () => {
  const u = 'cuser_lph_day0000000000'
  reset(u)
  const realNow = Date.now
  let t = realNow()
  Date.now = () => t
  try {
    for (let i = 0; i < 300; i++) {
      if (i > 0 && i % 10 === 0) t += 61_000
      const r = i % 2 === 0 ? await call(Q, 'les_progress') : await callChat(Q)
      assert.equal(r.status, 200, `#${i}`)
    }
    t += 61_000
    const a = await call(Q, 'les_progress')
    assert.equal(a.status, 429)
    assert.ok(Number(a.headers.get('Retry-After')) > 60, '분 창이 아니라 하루 창')
    assert.equal((await callChat(Q)).status, 429)
    assert.equal(lessonCalls(), 150)
  } finally {
    Date.now = realNow
  }
})

test('req.signal 이 서비스까지 전달된다(5번째 인자) — 손님이 끊으면 서비스가 받은 신호도 abort', async () => {
  reset('cuser_lph_sig_00000000000')
  const ac = new AbortController()
  const r = await call(Q, 'les_progress', ac.signal)
  assert.equal(r.status, 200)
  const got = serviceSignals[0]
  assert.ok(got instanceof AbortSignal)
  assert.equal(got.aborted, false)
  ac.abort()
  assert.equal(got.aborted, true)
})

test('라우트 소스: 엔진·모델 이름 없음 · spawn/fetch 없음 · 쓰기 없음 · import 는 infra·conversation·learning 의 index 만', () => {
  const src = readFileSync(join(__dirname, '..', 'lessons', '[id]', 'phrase-help', 'route.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(src, /claude|haiku|sonnet|opus|anthropic|reazon|whisper|style-?bert|qwen|ollama|speaker_?id|model_?id/i)
  assert.doesNotMatch(src, /\bspawn\b|\bfetch\(|child_process|prisma|withTransaction|\.(create|update|upsert|delete)\(/)
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(imports, ['@/modules/conversation', '@/modules/infra', '@/modules/learning'])
})
