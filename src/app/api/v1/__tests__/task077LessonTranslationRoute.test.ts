/**
 * task-077 #185 `POST /api/v1/lessons/:id/speaking-translation` — 라우트 파일 그대로 + **진짜 서비스**(`translateLessonSpeech`) 시험(DB·엔진·세션 0).
 * 바꿔 끼우는 것: 세션(`requireSession`)·한도 기록(진짜 `rateLimit` 을 그대로 부름)·레슨 소유(`assertOwnedLesson` — 형식이 잘못된 id 는 진짜 함수에 넘겨 DB 없이 404)
 * · 엔진·프로필·Trace(`lessonTranslationDeps` 세 칸) · 한도 독립 대조용 #181·#32t 서비스. 본문 검사·잠금·정리·오류 매핑은 진짜 코드다.
 * 방법(task056PhraseHelpRoute 와 같음): require 캐시의 `@/modules/{infra,learning,conversation}` 를 바꿔 끼운 **뒤에** route.ts 를 처음 읽는다.
 */
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma } from '@prisma/client'

type Json = { success: boolean; data: ({ code?: string; details?: Record<string, unknown> } & Record<string, unknown>) | null; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const infraPath = req.resolve('@/modules/infra')
const learningPath = req.resolve('@/modules/learning')
const conversationPath = req.resolve('@/modules/conversation')
const infra = req(infraPath) as typeof import('@/modules/infra')
const learning = req(learningPath) as typeof import('@/modules/learning')
const conversation = req(conversationPath) as typeof import('@/modules/conversation')
const { ApiError, prisma } = infra
const deps = conversation.lessonTranslationDeps
// 라우트 쪽(app)은 engine 을 import 하지 않는다(lint) — 엔진 경계 타입은 서비스 deps 에서 꺼낸다.
type TrReq = Parameters<typeof deps.complete>[0]
type TrResult = Awaited<ReturnType<typeof deps.complete>>
type TraceRecord = Parameters<typeof deps.trace>[0]

const OWNER = 'cuser_t077_owner_000000a'
const STRANGER = 'cuser_t077_stranger_0000'
const MINE = 'ls_t077_mine_0000000001'
const DONE = 'ls_t077_done_0000000001'
const THEIRS = 'ls_t077_theirs_000000001'
const JA = '週末に友達に会いました。'
const KO = '주말에 친구를 만났어요.'

let sessionUser: string | null = OWNER
const limitKeys: string[] = []
const ownerCalls: [string, string][] = []
const otherCalls: string[] = []
/** 레슨 → 주인(상태와 무관 — DONE 레슨도 같은 주인 표에 있다). */
const LESSON_OWNERS: Record<string, string> = { [MINE]: OWNER, [DONE]: OWNER, [THEIRS]: STRANGER }

/**
 * DB 호출 기록기(저장 없음) — 진짜 `prisma` 의 모든 모델 델리게이트와 raw·트랜잭션 진입점을 «기록만 하고 null 을 돌려주는» 가짜로 바꾼다.
 * 소유 확인은 아래에서 가짜 `assertOwnedLesson` 이 맡으므로(형식이 틀린 id 는 진짜 함수가 DB 전에 404) 이 파일의 어떤 경로에서도 DB 호출은 0 이어야 한다.
 * `await` 하지 않는 숨은 쓰기(`void prisma.lesson.updateMany(…).catch()`)는 응답에 나타나지 않아 응답 시험으로는 못 잡지만(REV-077S M7r) 기록기에는 남는다.
 */
const dbCalls: string[] = []
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const recordingDelegate = (model: string): object =>
  new Proxy({}, { get: (_t, op) => (typeof op === 'string' && op !== 'then' ? async () => (dbCalls.push(`${model}.${op}`), null) : undefined) })
for (const m of Object.values(Prisma.ModelName)) Object.defineProperty(prisma, lowerFirst(m), { configurable: true, writable: true, value: recordingDelegate(lowerFirst(m)) })
for (const fn of ['$transaction', '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe', '$runCommandRaw']) {
  Object.defineProperty(prisma, fn, { configurable: true, writable: true, value: async () => (dbCalls.push(fn), null) })
}

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

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
swap(learningPath, {
  ...learning,
  assertOwnedLesson: async (userId: string, id: string) => {
    ownerCalls.push([userId, id])
    if (!learning.isLessonId(id)) return learning.assertOwnedLesson(userId, id) // 진짜 함수 — 형식 검사에서 DB 전에 404
    if (LESSON_OWNERS[id] !== userId) throw new ApiError('NOT_FOUND', '레슨을 찾을 수 없어요.')
  },
})
swap(conversationPath, {
  ...conversation,
  helpWordPhrase: async () => (otherCalls.push('phrase'), { items: [] }),
  retryUserTranslation: async (_u: string, _c: string, messageId: string) => (otherCalls.push('chat-tr'), { messageId, translation: KO, cached: false }),
})

const route = req(join(__dirname, '..', 'lessons', '[id]', 'speaking-translation', 'route.ts')) as { POST: Handler }
const wordHelpRoute = req(join(__dirname, '..', 'words', 'phrase-help', 'route.ts')) as { POST: Handler }
const chatTrRoute = req(join(__dirname, '..', 'chats', '[id]', 'messages', '[messageId]', 'translation', 'route.ts')) as { POST: Handler }

const llmResult = (userKo: unknown): TrResult => ({ data: { userKo } as { userKo: string }, connectionKey: 'conn-x', model: 'model-x', elapsedMs: 2, promptChars: 300, attempts: 1 })

interface Engine {
  reqs: TrReq[]
  traces: TraceRecord[]
}
/** 엔진·프로필·Trace 가짜(진짜 서비스의 기본 deps 를 바꿔 낌). `complete` 를 넘기면 그 동작, 아니면 늘 KO. */
function engine(t: TestContext, complete?: (r: TrReq) => Promise<TrResult>): Engine {
  const e: Engine = { reqs: [], traces: [] }
  t.mock.method(deps, 'learnerLevel', async () => 'N4')
  t.mock.method(deps, 'complete', async (r: TrReq) => (e.reqs.push(r), complete ? complete(r) : llmResult(KO)))
  t.mock.method(deps, 'trace', async (tr: TraceRecord) => void e.traces.push(tr))
  return e
}

const reset = (user: string | null) => {
  sessionUser = user
  limitKeys.length = 0
  ownerCalls.length = 0
  otherCalls.length = 0
}
const post = (body: string, signal?: AbortSignal) => new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body, ...(signal ? { signal } : {}) })
async function call(body: string, id = MINE, signal?: AbortSignal): Promise<{ status: number; json: Json; headers: Headers }> {
  const res = await route.POST(post(body, signal), { params: Promise.resolve({ id }) })
  return { status: res.status, json: (await res.json()) as Json, headers: res.headers }
}
const B = (text: unknown) => JSON.stringify({ text })
const lessonLimit = () => limitKeys.filter((k) => k.startsWith('lesson-speaking-translation:')).length
/** 시험 사용자마다 자기 레슨 하나를 주인 표에 올린다(id = 사용자 id 의 `cuser` → `ls`). */
const ownLesson = (user: string) => {
  const id = user.replace(/^cuser/, 'ls')
  LESSON_OWNERS[id] = user
  return id
}

test('정상 200 {ko} · no-store · 한도 키 1회 · 소유 확인(세션 사용자, 경로 id) · 엔진 1회(같은 태스크) · req.signal 전달', async (t) => {
  reset(OWNER)
  const e = engine(t)
  const ac = new AbortController()
  const r = await call(B(` ${JA} `), MINE, ac.signal)
  assert.equal(r.status, 200)
  assert.deepEqual(r.json, { success: true, data: { ko: KO }, message: null })
  assert.equal(r.headers.get('Cache-Control'), 'private, no-store')
  assert.deepEqual(limitKeys, [`lesson-speaking-translation:${OWNER}`])
  assert.deepEqual(ownerCalls, [[OWNER, MINE]])
  assert.equal(e.reqs.length, 1)
  assert.equal(e.reqs[0].task, 'userTranslation')
  assert.deepEqual(e.reqs[0].messages, [{ role: 'user', content: `[입력] ${JA}` }], '정리한 글이 엔진으로')
  assert.ok(e.reqs[0].signal, '요청 신호가 엔진까지')
  ac.abort()
  assert.equal(e.reqs[0].signal?.aborted, true, '손님이 끊으면 엔진 호출의 신호도 끊긴다')
  assert.deepEqual(otherCalls, [])
})

test('끝낸 레슨도 번역한다(상태를 묻지 않음 — 끝낸 단계 다시 보기)', async (t) => {
  reset(OWNER)
  engine(t)
  const r = await call(B(JA), DONE)
  assert.equal(r.status, 200)
  assert.deepEqual(r.json.data, { ko: KO })
})

test('세션 없음 401 — 본문·한도·소유·엔진보다 먼저', async (t) => {
  reset(null)
  const e = engine(t)
  for (const body of [B(JA), 'not json', B('')]) {
    const r = await call(body)
    assert.equal(r.status, 401)
    assert.equal(r.json.data?.code, 'UNAUTHENTICATED')
  }
  assert.equal(limitKeys.length, 0)
  assert.equal(ownerCalls.length, 0)
  assert.equal(e.reqs.length, 0)
})

test('본문 400 표 — 한도·소유(DB)·엔진 미접촉 (손으로 적은 정답)', async (t) => {
  reset('cuser_t077_body_00000000')
  const e = engine(t)
  const rows: [string, string | null, string | null][] = [
    [B(''), 'text', 'required'],
    [B('  \n\t '), 'text', 'required'],
    ['{}', 'text', 'required'],
    [B(null), 'text', 'required'],
    [B(123), 'text', 'type'],
    [B(['あ']), 'text', 'type'],
    [B('あ'.repeat(1001)), 'text', 'max_length'],
    [JSON.stringify({ text: JA, itemId: 's1' }), 'body', 'unknown_key'],
    [JSON.stringify({ queryKo: '말' }), 'body', 'unknown_key'],
    ['not json', null, null],
    ['[]', null, null],
    ['"あ"', null, null],
    [JSON.stringify({ text: 'あ'.repeat(1000), pad: 'x'.repeat(8 * 1024) }), null, null], // 8KB 초과 → 읽기 전에 400(필드 판정 없음)
  ]
  for (const [body, field, reason] of rows) {
    const r = await call(body)
    assert.equal(r.status, 400, body.slice(0, 30))
    assert.equal(r.json.data?.code, 'VALIDATION')
    const d = (r.json.data?.details ?? {}) as { field?: string; reason?: string }
    assert.equal(d.field ?? null, field, body.slice(0, 30))
    assert.equal(d.reason ?? null, reason, body.slice(0, 30))
  }
  assert.equal(limitKeys.length, 0, '본문 400 은 한도를 쓰지 않는다')
  assert.equal(ownerCalls.length, 0, '본문 400 은 레슨을 읽지 않는다')
  assert.equal(e.reqs.length, 0)
})

test('본문 경계: 1,000 코드포인트(가나·이모지)·앞뒤 공백은 통과', async (t) => {
  reset('cuser_t077_edge_00000000')
  const lesson = ownLesson('cuser_t077_edge_00000000')
  engine(t)
  for (const text of ['あ'.repeat(1000), '😀'.repeat(1000), `  ${'あ'.repeat(1000)}  `]) {
    const r = await call(B(text), lesson)
    assert.equal(r.status, 200, `${text.length}`)
  }
})

test('소유 404: 남의 레슨·없는 레슨·형식이 잘못된 id — 엔진 0, 한도는 쓴다(DB 를 읽는 거절)', async (t) => {
  reset(OWNER)
  const e = engine(t)
  for (const id of [THEIRS, 'ls_t077_missing_00000001', 'bad id!', 'x'.repeat(41), '']) {
    const r = await call(B(JA), id)
    assert.equal(r.status, 404, id)
    assert.equal(r.json.data?.code, 'NOT_FOUND')
  }
  assert.equal(e.reqs.length, 0)
  assert.equal(lessonLimit(), 5)
  assert.deepEqual(ownerCalls.map((c) => c[0]), [OWNER, OWNER, OWNER, OWNER, OWNER], '소유 확인은 세션 사용자로만')
  reset(STRANGER)
  assert.equal((await call(B(JA), THEIRS)).status, 200, '주인에게는 열린다')
  assert.equal((await call(B(JA), MINE)).status, 404)
})

test('한도: 분당 20 — 21번째 429 RATE_LIMITED(Retry-After·retryAfterSec), 소유·엔진 미접촉', async (t) => {
  const user = 'cuser_t077_rate_00000000'
  const lesson = ownLesson(user)
  reset(user)
  const e = engine(t)
  for (let i = 0; i < 20; i++) assert.equal((await call(B(JA), lesson)).status, 200, `${i + 1}번째`)
  const before = { owner: ownerCalls.length, llm: e.reqs.length }
  const r = await call(B(JA), lesson)
  assert.equal(r.status, 429)
  assert.equal(r.json.data?.code, 'RATE_LIMITED')
  const sec = (r.json.data?.details as { retryAfterSec?: number }).retryAfterSec
  assert.ok(typeof sec === 'number' && sec >= 1 && sec <= 60)
  assert.equal(r.headers.get('Retry-After'), String(sec))
  assert.equal(ownerCalls.length, before.owner, '429 는 레슨을 읽지 않는다')
  assert.equal(e.reqs.length, before.llm)
  reset('cuser_t077_rate_00000001')
  assert.equal((await call(B(JA), ownLesson('cuser_t077_rate_00000001'))).status, 200, '다른 사용자는 별도 창')
})

test('한도 독립: 레슨 번역 한도를 다 써도 도우미(#181 = #180·#184 공유 키)·회화방 번역(#32t)은 그대로, 그 반대도', async (t) => {
  const user = 'cuser_t077_indep_0000000'
  const lesson = ownLesson(user)
  reset(user)
  engine(t)
  for (let i = 0; i < 20; i++) assert.equal((await call(B(JA), lesson)).status, 200)
  assert.equal((await call(B(JA), lesson)).status, 429)
  const help = await wordHelpRoute.POST(post(JSON.stringify({ queryKo: '임팩트' })), {})
  assert.equal(help.status, 200, '도우미는 막히지 않는다')
  const chatTr = await chatTrRoute.POST(post(''), { params: Promise.resolve({ id: 'c1', messageId: 'mu' }) })
  assert.equal(chatTr.status, 200, '회화방 번역은 막히지 않는다')

  const user2 = 'cuser_t077_indep_0000001'
  reset(user2)
  for (let i = 0; i < 10; i++) await wordHelpRoute.POST(post(JSON.stringify({ queryKo: '임팩트' })), {})
  assert.equal((await wordHelpRoute.POST(post(JSON.stringify({ queryKo: '임팩트' })), {})).status, 429, '도우미 한도 소진')
  for (let i = 0; i < 20; i++) await chatTrRoute.POST(post(''), { params: Promise.resolve({ id: 'c1', messageId: 'mu' }) })
  assert.equal((await chatTrRoute.POST(post(''), { params: Promise.resolve({ id: 'c1', messageId: 'mu' }) })).status, 429, '#32t 한도 소진')
  assert.equal((await call(B(JA), ownLesson(user2))).status, 200, '레슨 번역은 그대로')
  const keys = new Set(limitKeys.map((k) => k.split(':')[0]))
  assert.deepEqual([...keys].sort(), ['lesson-speaking-translation', 'phrase-help', 'phrase-help-day', 'user-translation'])
})

test('동시 1건: 같은 사용자 두 번째 409 TRANSLATION_BUSY · 다른 사용자 200 · 끝나면 다시 200', async (t) => {
  reset(OWNER)
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  let entered: () => void = () => {}
  const inEngine = new Promise<void>((r) => (entered = r))
  let n = 0
  engine(t, async () => (n++ === 0 ? (entered(), await gate, llmResult(KO)) : llmResult(KO)))
  const first = call(B(JA))
  await inEngine
  const second = await call(B('別の文です。'))
  assert.equal(second.status, 409)
  assert.equal(second.json.data?.code, 'CONFLICT')
  assert.equal((second.json.data?.details as { reason?: string }).reason, 'TRANSLATION_BUSY')
  reset(STRANGER)
  assert.equal((await call(B(JA), THEIRS)).status, 200)
  release()
  assert.equal((await first).status, 200)
  reset(OWNER)
  assert.equal((await call(B(JA))).status, 200)
})

test('손님이 끊으면 409 CANCELLED 로 끝나고 잠금이 풀린다(곧이은 다시 가져오기는 200)', async (t) => {
  reset('cuser_t077_cancel_000000')
  LESSON_OWNERS.ls_t077_cancel_000000001 = 'cuser_t077_cancel_000000'
  let entered: () => void = () => {}
  const inEngine = new Promise<void>((r) => (entered = r))
  engine(t, (r) => {
    entered()
    return new Promise((_, reject) => r.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))
  })
  const ac = new AbortController()
  const p = call(B(JA), 'ls_t077_cancel_000000001', ac.signal)
  await inEngine
  ac.abort()
  const r = await p
  assert.equal(r.status, 409)
  assert.equal((r.json.data?.details as { reason?: string }).reason, 'CANCELLED')
  t.mock.restoreAll()
  engine(t)
  assert.equal((await call(B(JA), 'ls_t077_cancel_000000001')).status, 200)
})

test('오류 매핑 표(화면: 400/404 = 번역할 수 없어요 · 409 = 바쁨 · 429 = 잠시 뒤 · 그 밖 = 다시 가져오기) — 손으로 적은 상태·코드', async (t) => {
  const user = 'cuser_t077_errmap_000000'
  LESSON_OWNERS.ls_t077_errmap_000000001 = user
  const rows: [string, () => Promise<TrResult>, number, string, string | null][] = [
    ['시간 초과', async () => Promise.reject(Object.assign(new Error('t'), { name: 'LlmTimeoutError' })), 504, 'ENGINE_TIMEOUT', null],
    ['엔진 없음', async () => Promise.reject(Object.assign(new Error('u'), { name: 'NoEngineAvailableError' })), 422, 'ENGINE_UNAVAILABLE', null],
    ['엔진 실패', async () => Promise.reject(Object.assign(new Error('f'), { name: 'LlmError' })), 502, 'ENGINE_ERROR', null],
    ['스키마 위반', async () => Promise.reject(Object.assign(new Error('s'), { name: 'JsonSchemaError' })), 502, 'ENGINE_ERROR', null],
    ['빈 번역', async () => llmResult(''), 502, 'ENGINE_ERROR', 'TRANSLATION_REJECTED'],
    ['베낀 번역', async () => llmResult(JA), 502, 'ENGINE_ERROR', 'TRANSLATION_REJECTED'],
    ['한글 없는 번역', async () => llmResult('I met a friend.'), 502, 'ENGINE_ERROR', 'TRANSLATION_REJECTED'],
    ['알 수 없는 예외', async () => Promise.reject(new TypeError('bug')), 500, 'INTERNAL', null],
  ]
  for (const [label, complete, status, code, reason] of rows) {
    reset(user)
    t.mock.restoreAll()
    t.mock.method(console, 'error', () => undefined)
    engine(t, complete)
    const r = await call(B(JA), 'ls_t077_errmap_000000001')
    assert.equal(r.status, status, label)
    assert.equal(r.json.success, false)
    assert.equal(r.json.data?.code, code, label)
    assert.equal((r.json.data?.details as { reason?: string } | undefined)?.reason ?? null, reason, label)
    assert.equal(JSON.stringify(r.json).includes('model-x') || JSON.stringify(r.json).includes('conn-x'), false, '응답에 엔진·모델 이름 없음')
    t.mock.restoreAll()
    engine(t)
    assert.equal((await call(B(JA), 'ls_t077_errmap_000000001')).status, 200, `${label} 뒤 잠금 풀림`)
  }
})

test('저장 없음·원문 미보관: 성공 응답은 {ko} 하나 · Trace 는 코드·수치만 · 콘솔에 원문·번역 0', async (t) => {
  reset(OWNER)
  const lines: string[] = []
  for (const k of ['log', 'info', 'warn', 'error', 'debug'] as const) t.mock.method(console, k, (...a: unknown[]) => void lines.push(a.map(String).join(' ')))
  const e = engine(t)
  const ok = await call(B(JA))
  assert.deepEqual(Object.keys(ok.json.data ?? {}), ['ko'])
  t.mock.method(deps, 'complete', async () => Promise.reject(new TypeError(`bug while handling`)))
  assert.equal((await call(B(JA))).status, 500)
  for (const tr of e.traces) {
    const s = JSON.stringify(tr)
    assert.equal(tr.refType, 'lessonTranslation')
    assert.equal(tr.refId, MINE)
    for (const raw of [JA, KO]) assert.equal(s.includes(raw), false)
  }
  for (const line of lines) for (const raw of [JA, KO]) assert.equal(line.includes(raw), false, line.slice(0, 60))
})

// ── 저장 없음·경계 — 소스·동작 (REV-077S Low-1) ─────────────────────────────────
// #184 의 라우트 소스 스캔(task077LessonPhraseHelpRoute)과 같은 수준을 #185 에도 둔다. 이 라우트의 DB 접촉은 learning 의 `assertOwnedLesson`(소유 확인 읽기) 하나뿐이고,
// 번역은 conversation 의 `translateLessonSpeech` 가 맡는다 — prisma 를 import 하지 않으므로 라우트 안에 쓰기를 숨길 자리가 없다.

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const ROUTE_SRC = stripComments(readFileSync(join(__dirname, '..', 'lessons', '[id]', 'speaking-translation', 'route.ts'), 'utf8'))

/** `import { a, type B as C } from 'x'` 들 → 모듈 → 가져온 원래 이름(`type` 표시·별칭 제거). */
function importsOf(src: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const m of src.matchAll(/^import\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+'([^']+)'/gm)) {
    const names = (m[1] ?? m[2] ?? m[3] ?? '')
      .split(',')
      .map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0])
      .filter(Boolean)
    out.set(m[4], [...(out.get(m[4]) ?? []), ...names])
  }
  return out
}

test('라우트 소스: 엔진·모델 이름 없음 · spawn/fetch 없음', () => {
  assert.doesNotMatch(ROUTE_SRC, /claude|haiku|sonnet|opus|anthropic|reazon|whisper|style-?bert|qwen|ollama|speaker_?id|model_?id/i)
  assert.doesNotMatch(ROUTE_SRC, /\bspawn\b|\bfetch\(|child_process/)
})

test('저장 없음(소스): 라우트에 prisma·쓰기 호출·fire-and-forget·로그가 없고 DB 접촉은 assertOwnedLesson 하나뿐 · import 는 infra·conversation·learning 의 index 와 타입뿐', () => {
  const forbidden: [string, RegExp][] = [
    ['prisma', /\bprisma\b/],
    ['트랜잭션·raw 쿼리', /withTransaction|lockUserRow|\$transaction|\$execute|\$query|\$runCommandRaw/],
    ['쓰기 메서드', /\.(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\(/],
    ['결과를 기다리지 않는 void 호출', /\bvoid\b/],
    ['.then/.catch 체인(떠 있는 호출)', /\.(then|catch)\(/],
    ['로그(원문·번역이 새는 길)', /\bconsole\b|process\.(stdout|stderr)|\blogger\b/],
  ]
  for (const [label, re] of forbidden) assert.doesNotMatch(ROUTE_SRC, re, `라우트 소스에 ${label} 가 있다`)

  const imports = importsOf(ROUTE_SRC)
  assert.deepEqual([...imports.keys()].sort(), ['@/modules/conversation', '@/modules/infra', '@/modules/learning', '@/types/lesson'])
  for (const name of imports.get('@/modules/infra') ?? []) assert.ok(['ok', 'rateLimit', 'readJsonObject', 'requireSession', 'withApi'].includes(name), `infra 에서 ${name} 를 가져온다`)
  assert.deepEqual((imports.get('@/modules/conversation') ?? []).slice().sort(), ['readLessonTranslationBody', 'translateLessonSpeech'])
  assert.deepEqual(imports.get('@/modules/learning'), ['assertOwnedLesson'], 'DB 를 읽는 길은 소유 확인 하나')
  const body = ROUTE_SRC.replace(/^import[\s\S]*?\sfrom\s'[^']+'$/gm, '')
  assert.equal((body.match(/\bassertOwnedLesson\(/g) ?? []).length, 1)
  assert.equal((body.match(/\btranslateLessonSpeech\(/g) ?? []).length, 1)
})

test('저장 없음(동작): 이 파일의 모든 경로(200·400·401·404·409·429·5xx·취소)에서 DB 호출 0 — 기록기가 비어 있다', async (t) => {
  assert.deepEqual(dbCalls, [], '앞선 모든 시험이 지나는 동안 DB 호출이 없었다')

  const user = 'cuser_t077_nodb_000000000'
  const lesson = ownLesson(user)
  reset(user)
  engine(t)
  assert.equal((await call(B(JA), lesson)).status, 200)
  assert.equal((await call(B(''), lesson)).status, 400)
  assert.equal((await call(B(JA), THEIRS)).status, 404)
  assert.equal((await call(B(JA), 'bad id!')).status, 404)
  reset(null)
  assert.equal((await call(B(JA), lesson)).status, 401)
  reset(user)
  t.mock.restoreAll()
  t.mock.method(console, 'error', () => undefined)
  engine(t, async () => llmResult(JA)) // 베낀 번역 → 502
  assert.equal((await call(B(JA), lesson)).status, 502)
  t.mock.restoreAll()
  t.mock.method(console, 'error', () => undefined)
  engine(t, async () => Promise.reject(new TypeError('bug'))) // 알 수 없는 예외 → 500
  assert.equal((await call(B(JA), lesson)).status, 500)
  await new Promise((r) => setImmediate(r)) // 결과를 기다리지 않는 호출이 있다면 여기서 모두 기록기에 닿는다
  assert.deepEqual(dbCalls, [])

  // 기록기가 살아 있다는 대조 — 같은 모양의 숨은 쓰기가 들어오면 이 배열에 남는다.
  void prisma.lesson.updateMany({ where: { id: 'x' }, data: {} }).catch(() => undefined)
  await prisma.chatMessage.update({ where: { id: 'x' }, data: {} })
  assert.deepEqual(dbCalls, ['lesson.updateMany', 'chatMessage.update'])
  dbCalls.length = 0
})
