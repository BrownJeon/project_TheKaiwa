/**
 * task-045 T1-3·T3-2 — 시드 관리·주제 삭제 라우트 계약을 라우트 파일 그대로 시험한다(DB·엔진·세션·LLM 0, `task045T2Routes.test.ts` 와 같은 방법):
 * `@/modules/infra`·`@/modules/learning` 의 require 캐시를 "진짜 + 세션·한도 기록·서비스 가짜"로 바꾼 뒤 route.ts 를 처음 읽는다.
 * 본문·쿼리 해석기(`parseTopicRemovalAck`·`parseSeedRefBody`·`normalizeScenarioInput`·`isSeedKind`·`_lib/saveBody`)와 포트 `removeUserTopicTx` 는 진짜.
 * - #172 GET /topics/:id/removal · #173 DELETE /topics/:id?ack= · #174 POST /topics/:id/fork · #175 POST /scenarios/:id/fork
 * - #176 POST /seed-overrides/restore(포트 주입) · #179 GET /seed-overrides?kind= · #165 DELETE /scenarios/:id(시드 id = 숨김)
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
const { ApiError } = infra

let sessionUser = 'cuser_t13_000000000000000'
const limitKeys: string[] = []
const calls: { fn: string; args: unknown[] }[] = []
const record = (fn: string, ...args: unknown[]) => calls.push({ fn, args })

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

const PREVIEW = { topicId: 'topic_mine', title: '내 주제', isSeed: false, isSeedCopy: false, ack: 'chal_1', activeChallenge: { id: 'chal_1', title: '7일', day: 3, lengthDays: 7 } }
const removed = (topicId: string, over: Record<string, unknown> = {}) => ({
  topicId, result: 'REMOVED', mode: 'DELETE', challengeDeleted: true, deletedChallengeId: 'chal_1', scenariosArchived: 2, scenariosUnlinked: 1, scenariosRelinked: 0, seedId: null, ...over,
})
const fakeTopic = (id: string) => ({ id, title: '카페', titleJa: 'カフェ', level: 'N5', description: '설명', tags: [], isSeed: false, chunks: [{ chunkType: 'NAME' }], lessonCount: 0, lastLessonAt: null, lastLessonTitle: null })
const thrown = (id: string): never | void => {
  if (id === 'copied') throw new ApiError('CONFLICT', '이미 내 버전이 있어요.', { reason: 'ALREADY_COPIED', state: 'COPIED' })
  if (id === 'limit') throw new ApiError('CONFLICT', '한도', { reason: 'TOPIC_LIMIT', limit: 30 })
  if (id === 'slimit') throw new ApiError('CONFLICT', '한도', { reason: 'SCENARIO_LIMIT', limit: 50 })
  if (id === 'daily') throw new ApiError('RATE_LIMITED', '오늘은 더 못 해요.', { reason: 'DAILY_LIMIT', limit: 10, retryAfterSec: 60 })
  if (id === 'nosuch') throw new ApiError('NOT_FOUND', '찾을 수 없는 기본 항목이에요.', { reason: 'SEED_NOT_FOUND' })
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
  previewTopicRemoval: async (u: string, id: string) => {
    record('preview', u, id)
    if (id === 'gone') throw new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.', { reason: 'TOPIC_GONE' })
    return { ...PREVIEW, topicId: id }
  },
  removeUserTopic: async (u: string, id: string, opts: { ack: string | null }) => {
    record('remove', u, id, opts.ack)
    if (id === 'changed') throw new ApiError('CONFLICT', '그사이 바뀌었어요.', { reason: 'IMPACT_CHANGED', preview: PREVIEW })
    if (id === 'gone') throw new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.', { reason: 'TOPIC_GONE' })
    if (id === 'seed_topic') return removed(id, { result: 'HIDDEN', challengeDeleted: false, deletedChallengeId: null, scenariosArchived: 0, scenariosUnlinked: 0 })
    return removed(id)
  },
  forkSeedTopic: async (u: string, id: string, body: unknown) => {
    record('forkTopic', u, id, body)
    thrown(id)
    return { kind: 'TOPIC', seedId: id, copyId: `copy_${id}`, relinkedScenarioIds: ['scn_mine'] }
  },
  listTopics: async (u: string, q: unknown) => {
    record('listTopics', u, q)
    return { items: [fakeTopic('topic_other_mine'), fakeTopic('copy_seed_cafe')], level: ['N5', 'N4', 'N3', 'N2', 'N1'] }
  },
  forkSeedScenario: async (u: string, id: string, body: unknown) => {
    record('forkScenario', u, id, body)
    thrown(id)
    return { kind: 'SCENARIO', seedId: id, copyId: `scopy_${id}`, relinkedScenarioIds: [] }
  },
  getScenarioDetail: async (u: string, id: string) => (record('detail', u, id), { id, isMine: true, title: '사본' }),
  restoreSeed: async (u: string, kind: string, seedId: string, opts: { ack: string | null }, over?: { removeTopic?: unknown }) => {
    record('restore', u, kind, seedId, opts.ack, over?.removeTopic)
    if (seedId === 'changed') throw new ApiError('CONFLICT', '그사이 바뀌었어요.', { reason: 'IMPACT_CHANGED', preview: PREVIEW })
    if (seedId === 'none_here') throw new ApiError('NOT_FOUND', '되돌릴 내용이 없어요.', { reason: 'NOT_OVERRIDDEN' })
    return kind === 'TOPIC'
      ? { kind, seedId, path: 'COPY', copyId: 'copy_x', removal: removed('copy_x', { mode: 'RESTORE', scenariosArchived: 0, scenariosRelinked: 2, seedId }) }
      : { kind, seedId, path: 'HIDDEN', copyId: null, removal: null }
  },
  listSeedOverrideItems: async (u: string, kind?: string) => {
    record('items', u, kind)
    return [{ kind: 'TOPIC', seedId: 'seed_cafe', seedTitle: '카페', state: 'COPIED', copyId: 'copy_seed_cafe', orphan: false, updatedAt: '2026-10-07T00:00:00.000Z' }]
  },
  archiveScenario: async (u: string, id: string) => {
    record('archive', u, id)
    if (id.startsWith('seed')) throw new ApiError('NOT_FOUND', '이 상황은 지울 수 없어요.', { reason: 'SEED' })
    if (id === 'others') throw new ApiError('NOT_FOUND', '상황을 찾을 수 없어요.')
    return { id, status: 'ARCHIVED', alreadyArchived: id === 'mine_again' }
  },
  hideSeed: async (u: string, kind: string, id: string) => {
    record('hide', u, kind, id)
    return { kind, seedId: id, state: id === 'seed_copied' ? 'COPIED' : 'HIDDEN', changed: id === 'seed_new' }
  },
})

const route = <T>(...p: string[]) => req(join(__dirname, '..', ...p, 'route.ts')) as T
const topicIdRoute = route<{ PATCH: Handler; DELETE: Handler }>('topics', '[id]')
const removalRoute = route<{ GET: Handler }>('topics', '[id]', 'removal')
const topicForkRoute = route<{ POST: Handler }>('topics', '[id]', 'fork')
const scenarioIdRoute = route<{ DELETE: Handler }>('scenarios', '[id]')
const scenarioForkRoute = route<{ POST: Handler }>('scenarios', '[id]', 'fork')
const restoreRoute = route<{ POST: Handler }>('seed-overrides', 'restore')
const overridesRoute = route<{ GET: Handler }>('seed-overrides')

const reset = (user: string) => {
  sessionUser = user
  limitKeys.length = 0
  calls.length = 0
}
const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) })
const mk = (method: string, url: string, body?: string) => new Request(`http://localhost${url}`, { method, ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body }) })
async function call(h: Handler, r: Request, ctx: unknown = {}): Promise<{ status: number; json: Json; headers: Headers }> {
  const res = await h(r, ctx)
  return { status: res.status, json: (await res.json()) as Json, headers: res.headers }
}
const fns = () => calls.map((c) => c.fn)
const CHUNKS = [
  ['NAME', '病院', 'びょういん', '병원'], ['NAME', '薬', 'くすり', '약'], ['NAME', '医者', 'いしゃ', '의사'], ['ACTION', '待ちます', 'まちます', '기다려요'],
  ['ACTION', '呼びます', 'よびます', '불러요'], ['FEELING', '痛いです', 'いたいです', '아파요'], ['FEELING', '寒いです', 'さむいです', '추워요'], ['MODIFIER', '少し', 'すこし', '조금'],
].map(([chunkType, textJa, reading, meaningKo]) => ({ chunkType, textJa, reading, meaningKo }))
const full = (over: Record<string, unknown> = {}) => ({ title: '병원 진료', titleJa: '病院', level: 'N5', description: '병원에서 말해요.', chunks: CHUNKS, ...over })

test('#172 GET /topics/:id/removal: 200 no-store(세션 사용자·경로 id 그대로, 한도 0) · 404 TOPIC_GONE 그대로', async () => {
  reset('cuser_t13_preview_00000000')
  const r = await call(removalRoute.GET, mk('GET', '/api/v1/topics/topic_mine/removal'), ctxOf('topic_mine'))
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'private, no-store')
  assert.equal(r.json.data.ack, 'chal_1')
  assert.deepEqual(calls[0], { fn: 'preview', args: ['cuser_t13_preview_00000000', 'topic_mine'] })
  const gone = await call(removalRoute.GET, mk('GET', '/api/v1/topics/gone/removal'), ctxOf('gone'))
  assert.equal(gone.status, 404)
  assert.equal(gone.json.data.details?.reason, 'TOPIC_GONE')
  assert.equal(limitKeys.length, 0)
})

test('#173 DELETE /topics/:id?ack=: 형식 틀린 ack 400(한도·서비스 0) · 없음→null · none·챌린지 id 그대로 · REMOVED 개수 · 시드 HIDDEN · 409 IMPACT_CHANGED details.preview · 404', async () => {
  reset('cuser_t13_delete_000000000')
  for (const bad of ['bad%20id', 'a'.repeat(41), '%3Cx%3E']) {
    const r = await call(topicIdRoute.DELETE, mk('DELETE', `/api/v1/topics/topic_mine?ack=${bad}`), ctxOf('topic_mine'))
    assert.equal(r.status, 400, bad)
    assert.equal(r.json.data.details?.field, 'ack')
  }
  assert.equal(limitKeys.length + calls.length, 0)
  const acks: unknown[] = []
  for (const q of ['', '?ack=', '?ack=none', '?ack=chal_1']) {
    const r = await call(topicIdRoute.DELETE, mk('DELETE', `/api/v1/topics/topic_mine${q}`), ctxOf('topic_mine'))
    assert.equal(r.status, 200)
    acks.push(calls.at(-1)!.args[2])
  }
  assert.deepEqual(acks, [null, null, 'none', 'chal_1'])
  const ok = await call(topicIdRoute.DELETE, mk('DELETE', '/api/v1/topics/topic_mine?ack=chal_1'), ctxOf('topic_mine'))
  assert.equal(ok.json.data.result, 'REMOVED')
  assert.equal(ok.json.data.mode, 'DELETE')
  assert.equal(ok.json.data.challengeDeleted, true)
  assert.equal(ok.json.data.scenariosArchived, 2)
  const seed = await call(topicIdRoute.DELETE, mk('DELETE', '/api/v1/topics/seed_topic'), ctxOf('seed_topic'))
  assert.equal(seed.status, 200)
  assert.equal(seed.json.data.result, 'HIDDEN')
  const changed = await call(topicIdRoute.DELETE, mk('DELETE', '/api/v1/topics/changed?ack=none'), ctxOf('changed'))
  assert.equal(changed.status, 409)
  assert.equal(changed.json.data.code, 'CONFLICT')
  assert.equal(changed.json.data.details?.reason, 'IMPACT_CHANGED')
  assert.deepEqual(changed.json.data.details?.preview, PREVIEW)
  assert.equal((await call(topicIdRoute.DELETE, mk('DELETE', '/api/v1/topics/gone?ack=none'), ctxOf('gone'))).status, 404)
  assert.ok(calls.every((c) => c.args[0] === 'cuser_t13_delete_000000000'))
  assert.ok(limitKeys.every((k) => k === 'topic-write:cuser_t13_delete_000000000'))
})

test('#174 POST /topics/:id/fork: 빈 본문(본문 없음·{}) = 그대로 복사 · 전체 입력은 #57 과 같은 검사(정규화 값 전달) · 400 한도·서비스 0 · 201 {topic(#56 모양), warnings, copyId}', async () => {
  reset('cuser_t13_tfork_0000000000')
  const bodies: unknown[] = []
  for (const b of [undefined, '{}', '  ']) {
    const r = await call(topicForkRoute.POST, mk('POST', '/api/v1/topics/seed_cafe/fork', b), ctxOf('seed_cafe'))
    assert.equal(r.status, 201, String(b))
    bodies.push(calls.find((c) => c.fn === 'forkTopic')!.args[2])
    calls.length = 0
  }
  assert.deepEqual(bodies, [{}, {}, {}])
  const emojiTitle = `커피${String.fromCodePoint(0x2615, 0xfe0f)}`
  const r = await call(topicForkRoute.POST, mk('POST', '/api/v1/topics/seed_cafe/fork', JSON.stringify(full({ title: `  ${emojiTitle}\n주제 `, description: null }))), ctxOf('seed_cafe'))
  assert.equal(r.status, 201)
  const sent = calls.find((c) => c.fn === 'forkTopic')!.args[2] as Record<string, unknown>
  assert.equal(sent.title, `${emojiTitle} 주제`, '줄바꿈 접기·앞뒤 공백 걷기(#57 과 같은 정규화), 이모지 VS16 허용')
  assert.equal(sent.description, null)
  assert.equal((sent.chunks as unknown[]).length, 8)
  assert.equal((r.json.data.topic as { id: string }).id, 'copy_seed_cafe', '사본 id 의 #56 항목')
  assert.equal(r.json.data.copyId, 'copy_seed_cafe')
  assert.equal(r.json.data.seedId, 'seed_cafe')
  assert.deepEqual(r.json.data.relinkedScenarioIds, ['scn_mine'])
  assert.ok(Array.isArray(r.json.data.warnings))
  assert.deepEqual(calls.find((c) => c.fn === 'listTopics')!.args[1], { level: null, mine: true, allLevels: true })
  reset('cuser_t13_tfork_bad_000000')
  const zwj = `가${String.fromCodePoint(0x200d)}나`
  for (const b of ['{', JSON.stringify({ title: '부분만' }), JSON.stringify(full({ chunks: CHUNKS.slice(0, 7) })), JSON.stringify(full({ title: '<b>병원' })), JSON.stringify(full({ title: '가'.repeat(21) })), JSON.stringify(full({ title: zwj })), JSON.stringify(full({ x: 1 }))]) {
    const bad = await call(topicForkRoute.POST, mk('POST', '/api/v1/topics/seed_cafe/fork', b), ctxOf('seed_cafe'))
    assert.equal(bad.status, 400, b.slice(0, 40))
  }
  assert.equal(limitKeys.length + calls.length, 0)
})

test('#174 오류 그대로: 409 ALREADY_COPIED(state)·TOPIC_LIMIT · 429 DAILY_LIMIT · 404 SEED_NOT_FOUND — 모두 한도 1회씩(topic-write)', async () => {
  reset('cuser_t13_tforkerr_0000000')
  const want: [string, number, string][] = [['copied', 409, 'ALREADY_COPIED'], ['limit', 409, 'TOPIC_LIMIT'], ['daily', 429, 'DAILY_LIMIT'], ['nosuch', 404, 'SEED_NOT_FOUND']]
  for (const [id, status, reason] of want) {
    const r = await call(topicForkRoute.POST, mk('POST', `/api/v1/topics/${id}/fork`, '{}'), ctxOf(id))
    assert.equal(r.status, status, id)
    assert.equal(r.json.data.details?.reason, reason)
  }
  assert.deepEqual(limitKeys, Array(4).fill('topic-write:cuser_t13_tforkerr_0000000'))
  assert.equal(fns().filter((f) => f === 'listTopics').length, 0, '실패하면 목록을 읽지 않는다')
})

test('#175 POST /scenarios/:id/fork: 빈 본문 = 그대로 · 칸 모양 400(#164 와 같은 검사) 한도·서비스 0 · 정상 201 상세(사본) · 오류 그대로', async () => {
  reset('cuser_t13_sfork_0000000000')
  const empty = await call(scenarioForkRoute.POST, mk('POST', '/api/v1/scenarios/seed_order/fork'), ctxOf('seed_order'))
  assert.equal(empty.status, 201)
  assert.equal(empty.json.data.id, 'scopy_seed_order')
  assert.deepEqual(calls[0].args[2], {})
  assert.deepEqual(calls[1], { fn: 'detail', args: ['cuser_t13_sfork_0000000000', 'scopy_seed_order'] })
  const patch = { title: '내 카페 주문', opening: null, topicIds: ['copy_topic'] }
  const ok = await call(scenarioForkRoute.POST, mk('POST', '/api/v1/scenarios/seed_order/fork', JSON.stringify(patch)), ctxOf('seed_order'))
  assert.equal(ok.status, 201)
  assert.deepEqual(calls.filter((c) => c.fn === 'forkScenario').at(-1)!.args[2], patch, '본문은 서비스가 같은 정규화로 다시 본다')
  reset('cuser_t13_sfork_bad_000000')
  for (const b of ['{', JSON.stringify({ x: 1 }), JSON.stringify({ title: 3 }), JSON.stringify({ level: 'N9' }), JSON.stringify({ opening: 'x' })]) {
    const bad = await call(scenarioForkRoute.POST, mk('POST', '/api/v1/scenarios/seed_order/fork', b), ctxOf('seed_order'))
    assert.equal(bad.status, 400, b)
  }
  const shape = await call(scenarioForkRoute.POST, mk('POST', '/api/v1/scenarios/seed_order/fork', JSON.stringify({ title: 3 })), ctxOf('seed_order'))
  assert.equal(shape.json.data.details?.field, 'title')
  assert.ok(Array.isArray(shape.json.data.details?.problems))
  assert.equal(limitKeys.length + calls.length, 0)
  for (const [id, status, reason] of [['copied', 409, 'ALREADY_COPIED'], ['slimit', 409, 'SCENARIO_LIMIT'], ['daily', 429, 'DAILY_LIMIT'], ['nosuch', 404, 'SEED_NOT_FOUND']] as const) {
    const r = await call(scenarioForkRoute.POST, mk('POST', `/api/v1/scenarios/${id}/fork`, '{}'), ctxOf(id))
    assert.equal(r.status, status, id)
    assert.equal(r.json.data.details?.reason, reason)
  }
  assert.deepEqual(limitKeys, Array(4).fill('scenario-write:cuser_t13_sfork_bad_000000'))
})

test('#176 POST /seed-overrides/restore: 주제 삭제 포트(removeUserTopicTx)를 반드시 주입 · ack 전달 · 400(kind·seedId·ack) 한도 0 · removal.mode RESTORE · 409 details.preview · 404', async () => {
  reset('cuser_t13_restore_00000000')
  for (const b of ['{', JSON.stringify({ kind: 'topic', seedId: 's1' }), JSON.stringify({ kind: 'TOPIC', seedId: 'bad id' }), JSON.stringify({ kind: 'TOPIC', seedId: 's1', ack: '<x>' }), JSON.stringify({ kind: 'TOPIC' })]) {
    const r = await call(restoreRoute.POST, mk('POST', '/api/v1/seed-overrides/restore', b))
    assert.equal(r.status, 400, b)
  }
  assert.equal(limitKeys.length + calls.length, 0)
  const t = await call(restoreRoute.POST, mk('POST', '/api/v1/seed-overrides/restore', JSON.stringify({ kind: 'TOPIC', seedId: 'seed_cafe', ack: 'none' })))
  assert.equal(t.status, 200)
  const [u, kind, seedId, ack, port] = calls[0].args
  assert.deepEqual([u, kind, seedId, ack], ['cuser_t13_restore_00000000', 'TOPIC', 'seed_cafe', 'none'])
  assert.equal(port, learning.removeUserTopicTx, '포트 = 진짜 removeUserTopicTx(빼면 400 FEATURE_NOT_READY)')
  assert.equal((t.json.data.removal as { mode: string }).mode, 'RESTORE')
  assert.equal((t.json.data.removal as { scenariosRelinked: number }).scenariosRelinked, 2)
  const sc = await call(restoreRoute.POST, mk('POST', '/api/v1/seed-overrides/restore', JSON.stringify({ kind: 'SCENARIO', seedId: 'seed_order' })))
  assert.equal(sc.status, 200)
  assert.equal(calls[1].args[3], null, 'ack 없으면 null')
  assert.equal(calls[1].args[4], learning.removeUserTopicTx)
  const changed = await call(restoreRoute.POST, mk('POST', '/api/v1/seed-overrides/restore', JSON.stringify({ kind: 'TOPIC', seedId: 'changed', ack: 'none' })))
  assert.equal(changed.status, 409)
  assert.equal(changed.json.data.details?.reason, 'IMPACT_CHANGED')
  assert.deepEqual(changed.json.data.details?.preview, PREVIEW)
  const none = await call(restoreRoute.POST, mk('POST', '/api/v1/seed-overrides/restore', JSON.stringify({ kind: 'SCENARIO', seedId: 'none_here' })))
  assert.equal(none.status, 404)
  assert.equal(none.json.data.details?.reason, 'NOT_OVERRIDDEN')
  assert.deepEqual(limitKeys, ['topic-write:', 'scenario-write:', 'topic-write:', 'scenario-write:'].map((k) => `${k}cuser_t13_restore_00000000`))
})

test('#179 GET /seed-overrides?kind=: 세션 사용자만(쿼리의 다른 userId 무시) · kind 생략 = 전부 · 잘못된 kind 400 · no-store · 한도 0', async () => {
  reset('cuser_t13_items_A_00000000')
  const all = await call(overridesRoute.GET, mk('GET', '/api/v1/seed-overrides?userId=cuser_t13_items_B_00000000'))
  assert.equal(all.status, 200)
  assert.equal(all.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual((all.json.data.items as { seedTitle: string }[]).map((i) => i.seedTitle), ['카페'])
  const topics = await call(overridesRoute.GET, mk('GET', '/api/v1/seed-overrides?kind=TOPIC'))
  assert.equal(topics.status, 200)
  for (const k of ['topic', 'ALL', '']) assert.equal((await call(overridesRoute.GET, mk('GET', `/api/v1/seed-overrides?kind=${k}`))).status, 400, k)
  assert.deepEqual(calls.map((c) => c.args), [['cuser_t13_items_A_00000000', undefined], ['cuser_t13_items_A_00000000', 'TOPIC']])
  reset('cuser_t13_items_B_00000000')
  await call(overridesRoute.GET, mk('GET', '/api/v1/seed-overrides'))
  assert.deepEqual(calls[0].args, ['cuser_t13_items_B_00000000', undefined])
  assert.equal(limitKeys.length, 0)
})

test('#165 DELETE /scenarios/:id: 내 상황 = 기존 응답 + result ARCHIVED(숨김 호출 0) · 시드 id = 그 사용자만 숨김(HIDDEN, alreadyHidden) · 남의 것 404(숨김 0)', async () => {
  reset('cuser_t13_sdel_00000000000')
  const mine = await call(scenarioIdRoute.DELETE, mk('DELETE', '/api/v1/scenarios/mine_1'), ctxOf('mine_1'))
  assert.equal(mine.status, 200)
  assert.deepEqual(mine.json.data, { id: 'mine_1', status: 'ARCHIVED', alreadyArchived: false, result: 'ARCHIVED' })
  const again = await call(scenarioIdRoute.DELETE, mk('DELETE', '/api/v1/scenarios/mine_again'), ctxOf('mine_again'))
  assert.equal(again.json.data.alreadyArchived, true)
  assert.ok(!fns().includes('hide'))
  const seed = await call(scenarioIdRoute.DELETE, mk('DELETE', '/api/v1/scenarios/seed_new'), ctxOf('seed_new'))
  assert.equal(seed.status, 200)
  assert.deepEqual(seed.json.data, { id: 'seed_new', result: 'HIDDEN', state: 'HIDDEN', alreadyHidden: false })
  assert.deepEqual(calls.at(-1), { fn: 'hide', args: ['cuser_t13_sdel_00000000000', 'SCENARIO', 'seed_new'] })
  const copied = await call(scenarioIdRoute.DELETE, mk('DELETE', '/api/v1/scenarios/seed_copied'), ctxOf('seed_copied'))
  assert.deepEqual(copied.json.data, { id: 'seed_copied', result: 'HIDDEN', state: 'COPIED', alreadyHidden: true })
  calls.length = 0
  const other = await call(scenarioIdRoute.DELETE, mk('DELETE', '/api/v1/scenarios/others'), ctxOf('others'))
  assert.equal(other.status, 404)
  assert.deepEqual(fns(), ['archive'], '남의 것·없는 것은 숨기지 않는다')
  assert.ok(limitKeys.every((k) => k === 'scenario-write:cuser_t13_sdel_00000000000'))
})
