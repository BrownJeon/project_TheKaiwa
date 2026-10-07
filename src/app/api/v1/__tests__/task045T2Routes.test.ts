/**
 * task-045 T2 — 라우트 계약을 라우트 파일 그대로 시험한다(DB·엔진·세션·LLM 0, `task010dRateLimitOrder.test.ts` 와 같은 방법):
 * `@/modules/infra`·`@/modules/conversation`·`@/modules/learning` 의 require 캐시를 "진짜 + 세션·한도 기록·서비스 가짜"로 바꾼 뒤 route.ts 를 처음 읽는다.
 * - #57 POST /topics · #171 PATCH /topics/:id: 본문 400 은 한도를 쓰지 않고 서비스도 부르지 않는다 · 정상 201/200 `{topic, warnings}` · 서비스 오류 그대로.
 * - #170 POST /topics/drafts: 본문 400 한도 미소모 · 정상 200 no-store · `DRAFT_BUSY` 409 는 한도를 쓴다 · 분당 6 넘으면 진짜 429.
 * - #56 GET ?level=all → `listTopics` 에 allLevels.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'

type Json = { success: boolean; data: { code?: string; details?: Record<string, unknown> } & Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const paths = { infra: req.resolve('@/modules/infra'), conversation: req.resolve('@/modules/conversation'), learning: req.resolve('@/modules/learning') }
const infra = req(paths.infra) as typeof import('@/modules/infra')
const conversation = req(paths.conversation) as typeof import('@/modules/conversation')
const learning = req(paths.learning) as typeof import('@/modules/learning')
const { ApiError } = infra

let sessionUser = 'cuser_t2r_0000000000000'
const limitKeys: string[] = []
const calls: string[] = []
const listQueries: unknown[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

const fakeTopic = (id: string) => ({ id, title: 't', titleJa: null, level: 'N5', description: null, tags: [], isSeed: false, chunks: [{ chunkType: 'NAME' }], lessonCount: 0, lastLessonAt: null, lastLessonTitle: null })

swap(paths.infra, {
  ...infra,
  requireSession: async () => ({ user: { id: sessionUser, email: 'qa@example.test', name: null, role: 'USER' } }),
  rateLimit: (key: string, limit: number, windowMs?: number) => {
    limitKeys.push(key)
    infra.rateLimit(key, limit, windowMs)
  },
})
swap(paths.conversation, {
  ...conversation,
  readTopicDraftBody: (userId: string, raw: Record<string, unknown>) => conversation.readTopicDraftBody(userId, raw, { profileLevel: async () => 'N4' }),
  draftTopic: async (_u: string, body: { title: string }) => {
    calls.push(`draft:${body.title}`)
    if (body.title === '바쁨') throw new ApiError('CONFLICT', '주제 초안을 만드는 중이에요.', { reason: 'DRAFT_BUSY' })
    return { draft: { title: body.title }, warnings: ['CHUNKS_SHORT'] }
  },
})
swap(paths.learning, {
  ...learning,
  listTopics: async (_u: string, q: unknown) => (listQueries.push(q), { items: [], level: [] }),
  createUserTopic: async (_u: string, input: { title: string }) => {
    calls.push(`create:${input.title}`)
    if (input.title === '한도') throw new ApiError('CONFLICT', '내 주제는 30개까지', { reason: 'TOPIC_LIMIT' })
    return fakeTopic('new1')
  },
  updateUserTopic: async (_u: string, id: string) => {
    calls.push(`update:${id}`)
    if (id === 'seed1') throw new ApiError('CONFLICT', '기본 주제는 바로 고칠 수 없어요.', { reason: 'USE_FORK' })
    return fakeTopic(id)
  },
})

const topicsRoute = req(join(__dirname, '..', 'topics', 'route.ts')) as { GET: Handler; POST: Handler }
const topicIdRoute = req(join(__dirname, '..', 'topics', '[id]', 'route.ts')) as { PATCH: Handler }
const draftsRoute = req(join(__dirname, '..', 'topics', 'drafts', 'route.ts')) as { POST: Handler }

const reset = (user: string) => {
  sessionUser = user
  limitKeys.length = 0
  calls.length = 0
}
const send = (method: string, body: string, url = 'http://localhost/api/v1/topics') => new Request(url, { method, headers: { 'content-type': 'application/json' }, body })
async function call(h: Handler, r: Request, ctx: unknown = {}): Promise<{ status: number; json: Json; headers: Headers }> {
  const res = await h(r, ctx)
  return { status: res.status, json: (await res.json()) as Json, headers: res.headers }
}
const CHUNKS = [
  ['NAME', '病院', 'びょういん', '병원'], ['NAME', '薬', 'くすり', '약'], ['NAME', '医者', 'いしゃ', '의사'], ['ACTION', '待ちます', 'まちます', '기다려요'],
  ['ACTION', '呼びます', 'よびます', '불러요'], ['FEELING', '痛いです', 'いたいです', '아파요'], ['FEELING', '寒いです', 'さむいです', '추워요'], ['MODIFIER', '少し', 'すこし', '조금'],
].map(([chunkType, textJa, reading, meaningKo]) => ({ chunkType, textJa, reading, meaningKo }))
const valid = (title = '병원 진료') => JSON.stringify({ title, titleJa: '病院', level: 'N5', description: '병원에서 말해요.', chunks: CHUNKS })
const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) })

test('#57 POST /topics: 본문 400(잘못된 JSON·표현 7개·꺾쇠 제목)은 한도·서비스 0 · 정상 201 {topic, warnings} · 서비스 409 그대로(한도 1회)', async () => {
  reset('cuser_t2r_create_000000')
  for (const b of ['{', JSON.stringify({ ...JSON.parse(valid()), chunks: CHUNKS.slice(0, 7) }), valid('<b>병원')]) {
    const r = await call(topicsRoute.POST, send('POST', b))
    assert.equal(r.status, 400, b.slice(0, 30))
  }
  assert.equal(limitKeys.length, 0)
  assert.equal(calls.length, 0)
  const ok = await call(topicsRoute.POST, send('POST', valid()))
  assert.equal(ok.status, 201)
  assert.equal((ok.json.data.topic as { id: string }).id, 'new1')
  // 가짜 서비스가 돌려준 주제(표현 1개·설명·일본어 제목 없음)로 계산 — 라우트가 저장 결과에서 안내를 만든다
  assert.deepEqual(ok.json.data.warnings, ['CHUNKS_SHORT', 'TYPE_THIN_NAME', 'TYPE_THIN_ACTION', 'TYPE_THIN_FEELING', 'TYPE_THIN_MODIFIER', 'DESCRIPTION_MISSING', 'TITLE_JA_MISSING'])
  const lim = await call(topicsRoute.POST, send('POST', valid('한도')))
  assert.equal(lim.status, 409)
  assert.equal(lim.json.data.details?.reason, 'TOPIC_LIMIT')
  assert.deepEqual(limitKeys, ['topic-write:cuser_t2r_create_000000', 'topic-write:cuser_t2r_create_000000'])
})

test('#171 PATCH /topics/:id: 빈 본문·제목 21자 400(한도·서비스 0) · 정상 200 · 시드 409 USE_FORK 그대로', async () => {
  reset('cuser_t2r_update_000000')
  for (const b of ['{}', JSON.stringify({ title: '가'.repeat(21) })]) {
    const r = await call(topicIdRoute.PATCH, send('PATCH', b), ctxOf('mine1'))
    assert.equal(r.status, 400)
  }
  assert.equal(limitKeys.length + calls.length, 0)
  const ok = await call(topicIdRoute.PATCH, send('PATCH', JSON.stringify({ title: '새 이름' })), ctxOf('mine1'))
  assert.equal(ok.status, 200)
  assert.equal((ok.json.data.topic as { id: string }).id, 'mine1')
  assert.ok(Array.isArray(ok.json.data.warnings))
  const seed = await call(topicIdRoute.PATCH, send('PATCH', JSON.stringify({ title: '새 이름' })), ctxOf('seed1'))
  assert.equal(seed.status, 409)
  assert.equal(seed.json.data.details?.reason, 'USE_FORK')
  assert.deepEqual(calls, ['update:mine1', 'update:seed1'])
})

test('#170 POST /topics/drafts: 본문 400 한도 미소모 · 정상 200 no-store(수준 없으면 학습자 수준) · DRAFT_BUSY 409 는 한도 사용 · 분당 6 초과 429', async () => {
  reset('cuser_t2r_draft_0000000')
  for (const b of ['{', JSON.stringify({}), JSON.stringify({ title: '병원', x: 1 }), JSON.stringify({ title: '가'.repeat(41) })]) {
    const r = await call(draftsRoute.POST, send('POST', b, 'http://localhost/api/v1/topics/drafts'))
    assert.equal(r.status, 400)
  }
  assert.equal(limitKeys.length, 0)
  const ok = await call(draftsRoute.POST, send('POST', JSON.stringify({ title: '병원 진료' }), 'http://localhost/api/v1/topics/drafts'))
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(ok.json.data.warnings, ['CHUNKS_SHORT'])
  const busy = await call(draftsRoute.POST, send('POST', JSON.stringify({ title: '바쁨' }), 'http://localhost/api/v1/topics/drafts'))
  assert.equal(busy.status, 409)
  assert.equal(limitKeys.filter((k) => k.startsWith('topic-draft:')).length, 2)
  assert.equal(limitKeys.filter((k) => k.startsWith('topic-draft-day:')).length, 2)
  const statuses: number[] = []
  for (let i = 0; i < 5; i++) statuses.push((await call(draftsRoute.POST, send('POST', JSON.stringify({ title: '병원 진료' }), 'http://localhost/api/v1/topics/drafts'))).status)
  assert.deepEqual(statuses, [200, 200, 200, 200, 429])
})

test('#56 GET /topics?level=all → listTopics(allLevels) · 기존 쿼리 그대로', async () => {
  reset('cuser_t2r_list_00000000')
  listQueries.length = 0
  const get = (q: string) => call(topicsRoute.GET, Object.assign(new Request(`http://localhost/api/v1/topics${q}`), { nextUrl: new URL(`http://localhost/api/v1/topics${q}`) }))
  assert.equal((await get('?level=all&mine=1')).status, 200)
  assert.equal((await get('?level=N3')).status, 200)
  assert.equal((await get('?level=ALL')).status, 400)
  assert.deepEqual(listQueries, [{ level: null, mine: true, allLevels: true }, { level: 'N3', mine: false }])
})
