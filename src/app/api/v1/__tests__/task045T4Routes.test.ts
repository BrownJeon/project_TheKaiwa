/**
 * task-045 T4 — #177 `POST /scenarios/:id/variants/drafts` · #178 `POST /scenarios/openings/draft` 라우트 계약을 라우트 파일 그대로 시험한다
 * (DB·엔진·세션·LLM 0, `task045T2Routes.test.ts` 와 같은 방법: require 캐시를 "진짜 + 세션·한도 기록·서비스 가짜"로 바꾼 뒤 route.ts 를 처음 읽는다).
 * - #177: 기준 상황 가시성(내 것·보이는 시드 통과, 남의 것·없음·가린 시드 404 — 한도·서비스 0) · 가린 시드 주제는 장소에서 빠짐 · 본문 400·422 `NO_VARIATION` 한도 미소모 ·
 *   한도 키(분당 `scenario-variant`, 하루 #166 과 같은 `scenario-draft-day` 40) · N1 의 `up` 접힘.
 * - #178: 본문 400 한도 미소모 · 한도 키·분당 10·하루 60 · 서비스 오류 그대로.
 * - Next App Router 경로: `scenarios/openings/draft`(정적)가 `scenarios/[id]`(동적)와 충돌하지 않는다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { ScenarioDetail } from '@/types/scenario'
import type { ScenarioVariantBody, ScenarioVariantTarget } from '@/modules/conversation'

type Json = { success: boolean; data: { code?: string; details?: Record<string, unknown> } & Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>

const req = createRequire(__filename)
const paths = { infra: req.resolve('@/modules/infra'), conversation: req.resolve('@/modules/conversation') }
const infra = req(paths.infra) as typeof import('@/modules/infra')
const conversation = req(paths.conversation) as typeof import('@/modules/conversation')
const { ApiError } = infra

let sessionUser = 'cuser_t4r_0000000000000'
const limitKeys: string[] = []
const calls: string[] = []
const targets: ScenarioVariantTarget[] = []

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

const detail = (id: string, o: Partial<ScenarioDetail> = {}): ScenarioDetail =>
  ({
    id,
    title: '카페에서 주문',
    titleJa: null,
    level: 'N5',
    difficulty: 1,
    isMine: false,
    roles: { learner: '손님', tutor: '점원' },
    goalKo: '음료 주문',
    stepCount: 1,
    expressionCount: 1,
    topics: [{ id: 'tp_cafe', title: '카페', titleJa: null }],
    recommended: false,
    description: null,
    goal: { communicativeGoalKo: '음료 주문', successCriteria: ['주문한다'] },
    steps: [{ ko: '주문한다' }],
    keyExpressions: [{ id: 'e1', ja: 'コーヒーをください', ko: '커피 주세요' }],
    requiredExpressions: 1,
    ...o,
  }) as ScenarioDetail
const DETAILS: Record<string, ScenarioDetail> = {
  sc_mine: detail('sc_mine', { isMine: true, topics: [{ id: 'tp_mine', title: '내 카페', titleJa: null }, { id: 'tp_hidden', title: '가린 장소', titleJa: null }] }),
  sc_seed: detail('sc_seed'),
  sc_hidden: detail('sc_hidden'),
  sc_n1: detail('sc_n1', { isMine: true, level: 'N1' }),
}
const variantDeps = {
  readDetail: async (_u: string, id: string) => {
    const d = DETAILS[id]
    if (!d) throw new ApiError('NOT_FOUND', '상황을 찾을 수 없어요.')
    return d
  },
  visibility: async () => ({ hiddenScenarios: new Set(['sc_hidden']), hiddenTopics: new Set(['tp_hidden']) }),
}

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
  readScenarioVariantBase: (userId: string, id: string) => conversation.readScenarioVariantBase(userId, id, variantDeps),
  draftScenarioVariant: async (_u: string, target: ScenarioVariantTarget, body: ScenarioVariantBody) => {
    calls.push(`variant:${target.scenarioId}`)
    targets.push(target)
    if (body.note === '바쁨') throw new ApiError('CONFLICT', '초안을 만드는 중이에요.', { reason: 'DRAFT_BUSY' })
    return { draft: { title: 'v', topicIds: (target.base.topics ?? []).map((t) => t.id) }, changedFields: ['roles'], axes: body.axes }
  },
  readOpeningDraftBody: (userId: string, raw: Record<string, unknown>) => conversation.readOpeningDraftBody(userId, raw, { profileLevel: async () => 'N4' }),
  runOpeningDraft: async (_u: string, body: { ko: string; scenario: { level: string } }) => {
    calls.push(`opening:${body.scenario.level}`)
    if (body.ko.startsWith('길어')) throw new ApiError('UNPROCESSABLE', conversation.OPENING_DRAFT_TOO_LONG_MESSAGE, { reason: 'TOO_LONG' })
    return { ja: 'いらっしゃいませ。', reading: null, warnings: [] }
  },
})

const variantRoute = req(join(__dirname, '..', 'scenarios', '[id]', 'variants', 'drafts', 'route.ts')) as { POST: Handler }
const openingRoute = req(join(__dirname, '..', 'scenarios', 'openings', 'draft', 'route.ts')) as { POST: Handler }

let seq = 0
const reset = () => {
  sessionUser = `cuser_t4r_${String(++seq).padStart(13, '0')}`
  limitKeys.length = 0
  calls.length = 0
  targets.length = 0
}
const post = (url: string, body: unknown) => new Request(`http://localhost/api/v1${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
async function call(h: Handler, r: Request, ctx: unknown = {}): Promise<{ status: number; json: Json; headers: Headers }> {
  const res = await h(r, ctx)
  return { status: res.status, json: (await res.json()) as Json, headers: res.headers }
}
const variant = (id: string, body: unknown) => call(variantRoute.POST, post(`/scenarios/${id}/variants/drafts`, body), { params: Promise.resolve({ id }) })
const opening = (body: unknown) => call(openingRoute.POST, post('/scenarios/openings/draft', body))
const fill = (key: string, limit: number, windowMs: number) => {
  for (let i = 0; i < limit; i++) infra.rateLimit(key, limit, windowMs)
}

// ── #177 ────────────────────────────────────────────────────────────────────
test('#177 내 상황 200: {draft, changedFields, axes} · 한도 키 2개(분당 변형·하루 #166 공용) · no-store · 가린 시드 주제는 장소에서 빠짐', async () => {
  reset()
  const r = await variant('sc_mine', { axes: { persona: 'busy' } })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual(r.json.data.axes, { persona: 'busy', twist: 'none', flow: 'same', level: 'same' })
  assert.deepEqual((r.json.data.draft as { topicIds: string[] }).topicIds, ['tp_mine'])
  assert.deepEqual(limitKeys, [`scenario-variant:${sessionUser}`, `scenario-draft-day:${sessionUser}`])
  assert.equal(r.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(calls, ['variant:sc_mine'])
})

test('#177 기준 상황 가시성: 보이는 시드 200 · 가린 시드·남의 것·없음 404(한도·서비스 0)', async () => {
  reset()
  assert.equal((await variant('sc_seed', { axes: { twist: 'mishear' } })).status, 200)
  for (const id of ['sc_hidden', 'sc_other', 'nope']) {
    reset()
    const r = await variant(id, { axes: { twist: 'mishear' } })
    assert.equal(r.status, 404, id)
    assert.equal(r.json.message, '상황을 찾을 수 없어요.')
    assert.deepEqual(limitKeys, [], `${id}: 404 는 한도를 쓰지 않는다`)
    assert.deepEqual(calls, [])
  }
})

test('#177 본문 400·바꿀 점 없음 422 NO_VARIATION 은 한도를 쓰지 않고 서비스도 부르지 않는다 · N1 의 up 만 422, 다른 축과 함께면 up 은 same 으로 접힘', async () => {
  for (const [id, body, status, code] of [
    ['sc_mine', { axes: { persona: 'busy' }, extra: 1 }, 400, 'VALIDATION'],
    ['sc_mine', { axes: { persona: 'angry' } }, 400, 'VALIDATION'],
    ['sc_mine', { axes: { persona: 'busy' }, note: 'https://example.com' }, 400, 'VALIDATION'],
    ['sc_mine', { axes: { persona: 'same', twist: 'none' } }, 422, 'UNPROCESSABLE'],
    ['sc_mine', {}, 400, 'VALIDATION'],
    ['sc_n1', { axes: { level: 'up' } }, 422, 'UNPROCESSABLE'],
  ] as [string, unknown, number, string][]) {
    reset()
    const r = await variant(id, body)
    assert.equal(r.status, status, JSON.stringify(body))
    assert.equal(r.json.data.code, code)
    if (status === 422) assert.equal(r.json.data.details?.reason, 'NO_VARIATION')
    assert.deepEqual(limitKeys, [], `${JSON.stringify(body)}: 한도 미소모`)
    assert.deepEqual(calls, [])
  }
  reset()
  const r = await variant('sc_n1', { axes: { persona: 'kind', level: 'up' } })
  assert.equal(r.status, 200)
  assert.equal((r.json.data.axes as { level: string }).level, 'same')
})

test('#177 DRAFT_BUSY 409 는 한도를 쓴다 · 분당 6 넘으면 429 · 하루 카운터는 #166 과 같은 키(40)를 공유한다', async () => {
  reset()
  const busy = await variant('sc_mine', { axes: { persona: 'busy' }, note: '바쁨' })
  assert.equal(busy.status, 409)
  assert.equal(busy.json.data.details?.reason, 'DRAFT_BUSY')
  assert.equal(limitKeys.length, 2)
  for (let i = 1; i < 6; i++) assert.equal((await variant('sc_mine', { axes: { flow: 'suggest' } })).status, 200, `${i + 1}번째`)
  const over = await variant('sc_mine', { axes: { flow: 'suggest' } })
  assert.equal(over.status, 429)
  assert.ok(Number(over.headers.get('retry-after')) > 0)

  reset()
  fill(`scenario-draft-day:${sessionUser}`, 40, 86_400_000)
  const day = await variant('sc_mine', { axes: { flow: 'suggest' } })
  assert.equal(day.status, 429, '#166 이 하루 40 을 다 쓰면 변형도 막힌다')
  assert.deepEqual(calls, [])
  const src166 = readFileSync(join(__dirname, '..', 'scenarios', 'drafts', 'route.ts'), 'utf8')
  assert.match(src166, /const DRAFT_PER_DAY = 40\b/)
  assert.match(src166, /rateLimit\(`scenario-draft-day:\$\{s\.user\.id\}`, DRAFT_PER_DAY, 86_400_000\)/)
})

// ── #178 ────────────────────────────────────────────────────────────────────
const roles = { learner: '손님', tutor: '점원' }
test('#178 200 {ja, reading, warnings} · 한도 키 2개 · no-store · 수준이 없으면 학습자 수준', async () => {
  reset()
  const r = await opening({ ko: '어서 오세요.', scenario: { roles } })
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.deepEqual(r.json.data, { ja: 'いらっしゃいませ。', reading: null, warnings: [] })
  assert.deepEqual(limitKeys, [`opening-draft:${sessionUser}`, `opening-draft-day:${sessionUser}`])
  assert.equal(r.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(calls, ['opening:N4'])
})

test('#178 본문 400 은 한도 미소모 · 서비스 422 TOO_LONG 그대로 · 분당 10 넘으면 429 · 하루 60', async () => {
  for (const body of [{ ko: 'hello', scenario: { roles } }, { ko: '어서 오세요.' }, { ko: '어서 오세요.', scenario: { roles }, x: 1 }, { ko: '', scenario: { roles } }]) {
    reset()
    const r = await opening(body)
    assert.equal(r.status, 400, JSON.stringify(body))
    assert.deepEqual(limitKeys, [])
    assert.deepEqual(calls, [])
  }
  reset()
  const long = await opening({ ko: '길어요 정말 길어요', scenario: { roles, level: 'N5' } })
  assert.equal(long.status, 422)
  assert.equal(long.json.data.details?.reason, 'TOO_LONG')
  assert.equal(long.json.message, conversation.OPENING_DRAFT_TOO_LONG_MESSAGE)
  for (let i = 1; i < 10; i++) assert.equal((await opening({ ko: '어서 오세요.', scenario: { roles } })).status, 200, `${i + 1}번째`)
  assert.equal((await opening({ ko: '어서 오세요.', scenario: { roles } })).status, 429)
  reset()
  fill(`opening-draft-day:${sessionUser}`, 60, 86_400_000)
  assert.equal((await opening({ ko: '어서 오세요.', scenario: { roles } })).status, 429)
  reset()
  fill(`opening-draft-day:${sessionUser}`, 59, 86_400_000)
  assert.equal((await opening({ ko: '어서 오세요.', scenario: { roles } })).status, 200, '59 번 뒤 60 번째는 통과')
})

// ── Next App Router 경로 충돌 ────────────────────────────────────────────────
test('경로: /scenarios/openings/draft 는 정적 라우트로, /scenarios/<id>/variants/drafts 는 [id] 로 간다 — 형제 동적 세그먼트 이름 충돌 없음', () => {
  const appDir = join(__dirname, '..', '..', '..')
  const routes: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && e.name !== '__tests__' && e.name !== '_lib') walk(join(dir, e.name))
    if (existsSync(join(dir, 'route.ts'))) routes.push(`/${relative(appDir, dir).split(sep).filter((s) => !/^\(.*\)$/.test(s)).join('/')}`)
  }
  walk(join(appDir, 'api'))
  const { getSortedRoutes } = req('next/dist/shared/lib/router/utils/sorted-routes') as { getSortedRoutes: (r: string[]) => string[] }
  const { getRouteRegex } = req('next/dist/shared/lib/router/utils/route-regex') as { getRouteRegex: (r: string) => { re: RegExp } }
  const sorted = getSortedRoutes(routes)
  const match = (path: string): string | undefined => (routes.includes(path) ? path : sorted.find((r) => r.includes('[') && getRouteRegex(r).re.test(path)))
  assert.ok(routes.includes('/api/v1/scenarios/openings/draft') && routes.includes('/api/v1/scenarios/[id]/variants/drafts'))
  assert.equal(match('/api/v1/scenarios/openings/draft'), '/api/v1/scenarios/openings/draft')
  assert.equal(match('/api/v1/scenarios/sc_abc/variants/drafts'), '/api/v1/scenarios/[id]/variants/drafts')
  assert.equal(match('/api/v1/scenarios/drafts'), '/api/v1/scenarios/drafts')
  assert.equal(match('/api/v1/scenarios/sc_abc'), '/api/v1/scenarios/[id]')
  assert.equal(sorted.length, routes.length, 'getSortedRoutes 가 충돌 없이 전부 정렬(형제 동적 세그먼트 이름이 다르면 던진다)')
})
