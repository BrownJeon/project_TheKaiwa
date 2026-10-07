/**
 * task-045 T4 — #177 변형 상황 초안 실행(`readScenarioVariantBase`·`readScenarioVariantBody`·`draftScenarioVariant`) ·
 * #178 첫마디 일본어 제안 실행(`readOpeningDraftBody`·`runOpeningDraft`) · `LLM_TASKS` 두 항목 pin. 엔진·실제 DB 0(가짜 deps + 기록하는 가짜 prisma).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, type Tx } from '@/modules/infra'
import { isLlmTask, LLM_TASKS, type LlmJsonResult, type TraceRecord } from '@/modules/engine'
import { loadSeedVisibility } from '@/modules/learning'
import type { ScenarioDetail } from '@/types/scenario'
import { OPENING_DRAFT_PROMPT_VERSION, OPENING_DRAFT_TOO_LONG_MESSAGE } from '../prompts/openingDraft'
import { SCENARIO_VARIANT_PROMPT_VERSION } from '../prompts/scenarioVariant'
import type { OpeningDraftResponse } from '../structuredResponse/openingDraftSchemas'
import type { ScenarioVariantModelResponse } from '../structuredResponse/scenarioVariantSchemas'
import {
  draftScenarioVariant,
  readScenarioVariantBase,
  readScenarioVariantBody,
  SCENARIO_VARIANT_FAIL_MESSAGE,
  SCENARIO_VARIANT_REJECT_MESSAGE,
  type ScenarioVariantDeps,
  type ScenarioVariantTarget,
} from '../chats/scenarioVariantDraft'
import { OPENING_DRAFT_FAIL_MESSAGE, OPENING_DRAFT_REJECT_MESSAGE, readOpeningDraftBody, runOpeningDraft, type OpeningDraftRunDeps } from '../chats/openingDraftRun'

const ROOT = process.cwd()
interface SeedScenario { key: string; title: string; titleJa: string; description: string; level: 'N5'; roles: { learner: string; tutor: string }; goal: { communicativeGoalKo: string; successCriteria: string[] }; steps: { ko: string }[]; keyExpressions: { ja: string; reading?: string; ko: string }[]; opening: { ja: string; ko: string } | null }
const seed = (JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/scenarios.json'), 'utf8')) as SeedScenario[]).find((s) => s.key === 'cafe-order-drink')!
const fx = JSON.parse(readFileSync(join(ROOT, 'tests/prompts/fixtures/scenario-variant.json'), 'utf8')) as { samples: Record<string, { response: ScenarioVariantModelResponse }> }
const busyResponse = (): ScenarioVariantModelResponse => structuredClone(fx.samples['cafe-busy'].response)

const U = 'cuser_t4_aaaaaaaaaaaaaaaa'
const U2 = 'cuser_t4_bbbbbbbbbbbbbbbb'

function detail(id: string, o: Partial<ScenarioDetail> = {}): ScenarioDetail {
  return {
    id,
    title: seed.title,
    titleJa: seed.titleJa,
    level: seed.level,
    difficulty: 1,
    isMine: false,
    roles: seed.roles,
    goalKo: seed.goal.communicativeGoalKo,
    stepCount: seed.steps.length,
    expressionCount: seed.keyExpressions.length,
    topics: [{ id: 'tp_cafe', title: '카페', titleJa: null }],
    recommended: false,
    description: seed.description,
    goal: seed.goal,
    steps: seed.steps,
    keyExpressions: seed.keyExpressions.map((e, i) => ({ id: `e${i + 1}`, ja: e.ja, ...(e.reading ? { reading: e.reading } : {}), ko: e.ko })),
    requiredExpressions: 2,
    ...(seed.opening ? { opening: seed.opening } : {}),
    ...o,
  }
}

/** 기록하는 가짜 prisma — 읽기(find*)는 정해 둔 값, 그 밖 메서드는 "쓰기"로 기록한다(이 기능은 행을 만들지 않으므로 0 이어야 한다). */
function recordingDb(overrides: { kind: 'TOPIC' | 'SCENARIO'; seedId: string; copyId: string | null }[], liveCopies: string[] = []) {
  const writes: string[] = []
  const reads: string[] = []
  const model = (name: string) =>
    new Proxy({}, {
      get: (_t, method: string) => async (args: { where?: { id?: { in?: string[] } } }) => {
        if (!method.startsWith('find') && method !== 'count') {
          writes.push(`${name}.${method}`)
          return {}
        }
        reads.push(`${name}.${method}`)
        if (name === 'userSeedOverride' && method === 'findMany') return overrides.map((r, i) => ({ id: `ov${i}`, userId: U, ...r, createdAt: new Date(0), updatedAt: new Date(0) }))
        if (method === 'findMany') return (args?.where?.id?.in ?? []).filter((id) => liveCopies.includes(id)).map((id) => ({ id }))
        return method === 'count' ? 0 : null
      },
    })
  const db = new Proxy({}, { get: (_t, name: string) => (name.startsWith('$') ? async () => (writes.push(name), []) : model(name)) }) as unknown as Tx
  return { db, writes, reads }
}

function variantDeps(details: Record<string, ScenarioDetail>, db: Tx, respond: () => Promise<ScenarioVariantModelResponse> = async () => busyResponse()) {
  const traces: TraceRecord[] = []
  const calls: Record<string, unknown>[] = []
  const deps: ScenarioVariantDeps = {
    readDetail: async (_u, id) => {
      const d = details[id]
      if (!d) throw new ApiError('NOT_FOUND', '상황을 찾을 수 없어요.')
      return d
    },
    visibility: (userId) => loadSeedVisibility(db, userId),
    complete: async (req) => {
      calls.push(req as unknown as Record<string, unknown>)
      const data = await respond()
      return { data, connectionKey: 'conn', model: 'm', attempts: 1, promptChars: 4100 } as unknown as LlmJsonResult<ScenarioVariantModelResponse>
    },
    trace: async (t) => void traces.push(t),
  }
  return { deps, traces, calls }
}

async function rejects(p: Promise<unknown> | (() => unknown), code: string, reason?: string): Promise<ApiError> {
  try {
    await (typeof p === 'function' ? p() : p)
  } catch (e) {
    assert.ok(e instanceof ApiError, `ApiError 기대: ${String(e)}`)
    assert.equal(e.code, code)
    if (reason !== undefined) assert.equal(e.details?.reason, reason)
    return e
  }
  assert.fail(`${code} 오류 기대`)
}

const named = (name: string, message = 'x') => Object.assign(new Error(message), { name })
const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => ((resolve = a), (reject = b)))
  return { promise, resolve, reject }
}

// ── LLM_TASKS ───────────────────────────────────────────────────────────────
test('LLM_TASKS pin: scenarioVariant {balanced, 40s, interactive}·openingDraft {balanced, 25s, interactive}', () => {
  assert.deepEqual(LLM_TASKS.scenarioVariant, { tier: 'balanced', timeoutMs: 40_000, lane: 'interactive' })
  assert.deepEqual(LLM_TASKS.openingDraft, { tier: 'balanced', timeoutMs: 25_000, lane: 'interactive' })
  assert.ok(isLlmTask('scenarioVariant') && isLlmTask('openingDraft'))
})

// ── #177 기준 상황 가시성 ────────────────────────────────────────────────────
test('#177 기준 상황: 내 상황·보이는 시드 통과, 가린 시드·남의 것·없음 404(같은 문구) — 가린 시드 주제는 장소에서 빠지고 DB 쓰기 0', async () => {
  const { db, writes } = recordingDb([
    { kind: 'SCENARIO', seedId: 'sc_hidden', copyId: null },
    { kind: 'SCENARIO', seedId: 'sc_copied', copyId: 'sc_mycopy' },
    { kind: 'TOPIC', seedId: 'tp_hidden', copyId: null },
  ])
  const two = [{ id: 'tp_mine', title: '내 카페', titleJa: null }, { id: 'tp_hidden', title: '가린 장소', titleJa: null }]
  const { deps } = variantDeps(
    {
      sc_mine: detail('sc_mine', { isMine: true, topics: two }),
      sc_seed: detail('sc_seed'),
      sc_hidden: detail('sc_hidden'),
      sc_copied: detail('sc_copied'),
      sc_mycopy: detail('sc_mycopy', { isMine: true }),
    },
    db,
  )
  const mine = await readScenarioVariantBase(U, 'sc_mine', deps)
  assert.equal(mine.scenarioId, 'sc_mine')
  assert.deepEqual(mine.base.topics, [{ id: 'tp_mine', title: '내 카페' }], '가린 시드 주제는 장소에서 뺀다')
  assert.equal((await readScenarioVariantBase(U, 'sc_seed', deps)).base.title, seed.title)
  assert.equal((await readScenarioVariantBase(U, 'sc_mycopy', deps)).scenarioId, 'sc_mycopy')
  for (const id of ['sc_hidden', 'sc_copied', 'sc_other', 'nope']) {
    const e = await rejects(readScenarioVariantBase(U, id, deps), 'NOT_FOUND')
    assert.equal(e.userMessage, '상황을 찾을 수 없어요.', id)
  }
  // 다른 사용자의 숨김은 이 사용자에게 영향이 없다(override 는 사용자별) — 같은 가짜 DB 라도 visibility 는 userId 로 부른다.
  assert.deepEqual(writes, [], '기준 상황 읽기는 행을 만들지 않는다')
})

// ── #177 본문 ───────────────────────────────────────────────────────────────
test('#177 본문: 바꿀 점 없음 422 NO_VARIATION · N1 의 up 만 → 422 · 칸 문제 400(첫 문제 + problems) · 정상 값', async () => {
  await rejects(() => readScenarioVariantBody({ axes: { persona: 'same', twist: 'none' } }, 'N5'), 'UNPROCESSABLE', 'NO_VARIATION')
  await rejects(() => readScenarioVariantBody({ axes: { level: 'up' } }, 'N1'), 'UNPROCESSABLE', 'NO_VARIATION')
  assert.throws(() => readScenarioVariantBody({ axes: { persona: 'angry' } }, 'N5'), (e: ApiError) => e.code === 'VALIDATION' && e.details?.field === 'axes.persona' && e.details?.reason === 'enum')
  assert.throws(() => readScenarioVariantBody({ axes: { persona: 'busy' }, extra: 1 }, 'N5'), (e: ApiError) => e.code === 'VALIDATION' && e.details?.reason === 'unknown_key' && Array.isArray(e.details?.problems))
  assert.deepEqual(readScenarioVariantBody({ axes: { persona: 'busy', level: 'up' } }, 'N1').axes, { persona: 'busy', twist: 'none', flow: 'same', level: 'same' })
  assert.deepEqual(readScenarioVariantBody({ axes: { level: 'up' }, note: '  ' }, 'N5'), { axes: { persona: 'same', twist: 'none', flow: 'same', level: 'up' }, note: null })
})

// ── #177 초안 ───────────────────────────────────────────────────────────────
async function cafeTarget(level: ScenarioDetail['level'] = 'N5', topics = [{ id: 'tp_cafe', title: '카페', titleJa: null }]): Promise<{ target: ScenarioVariantTarget; db: ReturnType<typeof recordingDb> }> {
  const rdb = recordingDb([])
  const { deps } = variantDeps({ sc: detail('sc', { level, topics }) }, rdb.db)
  return { target: await readScenarioVariantBase(U, 'sc', deps), db: rdb }
}

test('#177 성공: 200 {draft, changedFields, axes} · 장소 = 기준 상황의 장소 · task scenarioVariant · Trace 에 원문 없음 · 행 0', async () => {
  const { target, db } = await cafeTarget()
  const { deps, traces, calls } = variantDeps({}, db.db)
  const note = '손님이 많아서 서두르는 느낌으로 부탁해요'
  const out = await draftScenarioVariant(U, target, readScenarioVariantBody({ axes: { persona: 'busy' }, note }, 'N5'), deps)
  assert.deepEqual(out.axes, { persona: 'busy', twist: 'none', flow: 'same', level: 'same' })
  assert.deepEqual(out.draft.topicIds, ['tp_cafe'])
  assert.ok(out.changedFields.length > 0 && out.changedFields.includes('roles'), JSON.stringify(out.changedFields))
  assert.equal(out.draft.description, seed.description, '설명은 기준 설명 그대로(직접 적은 글은 저장 안 함)')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].task, 'scenarioVariant')
  assert.ok(!('context' in calls[0]) && typeof calls[0].traceId === 'string')
  await new Promise((r) => setImmediate(r))
  assert.equal(traces.length, 1)
  const t = JSON.stringify(traces[0])
  for (const s of [note, seed.title, seed.roles.tutor, out.draft.title, seed.keyExpressions[0].ja]) assert.ok(!t.includes(s), `Trace 에 원문: ${s}`)
  assert.equal(traces[0].refType, 'scenarioVariant')
  assert.equal(traces[0].steps[0].promptVersion, SCENARIO_VARIANT_PROMPT_VERSION)
  assert.deepEqual(db.writes, [])
})

test('#177 N1 기준: up 은 same 으로 접혀 응답 axes 에 반영', async () => {
  const { target, db } = await cafeTarget('N1')
  const resp = busyResponse()
  if (resp.draft && typeof resp.draft === 'object') (resp.draft as unknown as Record<string, unknown>).level = 'N1'
  const { deps, calls } = variantDeps({}, db.db, async () => resp)
  const out = await draftScenarioVariant(U, target, readScenarioVariantBody({ axes: { persona: 'busy', level: 'up' } }, 'N1'), deps)
  assert.equal(out.axes.level, 'same')
  assert.equal(out.draft.level, 'N1')
  assert.equal(calls.length, 1)
})

test('#177 오류 매핑: UNSAFE 422 · INVALID 502 · JsonSchemaError 502 · 시간 초과 504 · 큐 포화 429 그대로 · 엔진 오류 502 · 알 수 없는 예외는 그대로', async () => {
  const { target, db } = await cafeTarget()
  const body = readScenarioVariantBody({ axes: { twist: 'trouble' } }, 'N5')
  const run = (respond: () => Promise<ScenarioVariantModelResponse>) => draftScenarioVariant(U, target, body, variantDeps({}, db.db, respond).deps)
  const unsafe = await rejects(run(async () => ({ status: 'UNSAFE', draft: null }) as unknown as ScenarioVariantModelResponse), 'UNPROCESSABLE', 'NOT_A_VARIANT')
  assert.equal(unsafe.userMessage, SCENARIO_VARIANT_REJECT_MESSAGE)
  const inv = await rejects(run(async () => ({ status: 'OK', draft: null }) as unknown as ScenarioVariantModelResponse), 'ENGINE_ERROR', 'DRAFT_INVALID')
  assert.equal(inv.userMessage, SCENARIO_VARIANT_FAIL_MESSAGE)
  await rejects(run(async () => Promise.reject(named('JsonSchemaError'))), 'ENGINE_ERROR', 'DRAFT_INVALID')
  const to = await rejects(run(async () => Promise.reject(named('LlmTimeoutError'))), 'ENGINE_TIMEOUT', 'TIMEOUT')
  assert.equal(to.userMessage, SCENARIO_VARIANT_FAIL_MESSAGE)
  await rejects(run(async () => Promise.reject(new ApiError('RATE_LIMITED', '요청이 많아요.', { retryAfterSec: 3 }))), 'RATE_LIMITED')
  await rejects(run(async () => Promise.reject(named('ClaudeCliExecError'))), 'ENGINE_ERROR', 'ENGINE_FAILED')
  await rejects(run(async () => Promise.reject(named('NoEngineAvailableError'))), 'ENGINE_ERROR', 'ENGINE_UNAVAILABLE')
  const bug = new TypeError('boom')
  await assert.rejects(run(async () => Promise.reject(bug)), (e) => e === bug)
  assert.deepEqual(db.writes, [])
})

test('#177 동시 1건: 같은 사용자 두 번째 409 DRAFT_BUSY · 다른 사용자 통과 · 성공·예외·시간 초과·거절 뒤 모두 잠금 해제', async () => {
  const { target, db } = await cafeTarget()
  const body = readScenarioVariantBody({ axes: { persona: 'kind' } }, 'N5')
  const gate = deferred<ScenarioVariantModelResponse>()
  const slow = variantDeps({}, db.db, () => gate.promise).deps
  const first = draftScenarioVariant(U, target, body, slow)
  await rejects(draftScenarioVariant(U, target, body, variantDeps({}, db.db).deps), 'CONFLICT', 'DRAFT_BUSY')
  await draftScenarioVariant(U2, target, body, variantDeps({}, db.db).deps)
  gate.resolve(busyResponse())
  await first
  for (const respond of [
    async () => Promise.reject(named('ClaudeCliExecError')),
    async () => Promise.reject(named('LlmTimeoutError')),
    async () => ({ status: 'UNSAFE', draft: null }) as unknown as ScenarioVariantModelResponse,
    async () => Promise.reject(new TypeError('boom')),
  ]) {
    await assert.rejects(draftScenarioVariant(U, target, body, variantDeps({}, db.db, respond).deps))
    await draftScenarioVariant(U, target, body, variantDeps({}, db.db).deps)
  }
})

// ── #178 첫마디 ─────────────────────────────────────────────────────────────
function openingDeps(respond: () => Promise<OpeningDraftResponse>) {
  const traces: TraceRecord[] = []
  const calls: Record<string, unknown>[] = []
  let profileReads = 0
  const deps: OpeningDraftRunDeps = {
    profileLevel: async () => (profileReads++, 'N4'),
    complete: async (req) => {
      calls.push(req as unknown as Record<string, unknown>)
      return { data: await respond(), connectionKey: 'conn', model: 'm', attempts: 1, promptChars: 2100 } as unknown as LlmJsonResult<OpeningDraftResponse>
    },
    trace: async (t) => void traces.push(t),
  }
  return { deps, traces, calls, profileReads: () => profileReads }
}
const roles = { learner: '손님', tutor: '점원' }
const okOpening = (ja: string, reading: string | null): OpeningDraftResponse => ({ status: 'OK', ja, reading })

test('#178 본문: 칸 문제 400(프로필 안 읽음) · 수준이 없을 때만 프로필 · 한글 없는 ko 400 no_hangul', async () => {
  const d = openingDeps(async () => okOpening('いらっしゃいませ。', null))
  await assert.rejects(readOpeningDraftBody(U, { ko: '어서 오세요', scenario: { roles }, extra: 1 }, d.deps), (e: ApiError) => e.code === 'VALIDATION' && e.details?.reason === 'unknown_key')
  await assert.rejects(readOpeningDraftBody(U, { ko: 'hello', scenario: { roles } }, d.deps), (e: ApiError) => e.details?.field === 'ko' && e.details?.reason === 'no_hangul')
  await assert.rejects(readOpeningDraftBody(U, { ko: '어서 오세요', scenario: { roles: { learner: '손님' } } }, d.deps), (e: ApiError) => e.details?.field === 'scenario.roles.tutor')
  assert.equal(d.profileReads(), 0)
  assert.equal((await readOpeningDraftBody(U, { ko: '어서 오세요', scenario: { roles, level: 'N3' } }, d.deps)).scenario.level, 'N3')
  assert.equal(d.profileReads(), 0)
  assert.equal((await readOpeningDraftBody(U, { ko: '어서 오세요', scenario: { roles } }, d.deps)).scenario.level, 'N4')
  assert.equal(d.profileReads(), 1)
})

test('#178 성공: {ja, reading, warnings} · task openingDraft · finalize 에 ko 를 넘긴다(한국어에 있던 로마자 통과) · Trace 원문 0', async () => {
  const ko = 'Wi-Fi 비밀번호를 알려 드릴까요?'
  const ja = 'WiFiのパスワードをお教えしましょうか。'
  const d = openingDeps(async () => okOpening(ja, null))
  const body = await readOpeningDraftBody(U, { ko, scenario: { roles, level: 'N4', title: '카페 와이파이' } }, d.deps)
  const out = await runOpeningDraft(U, body, d.deps)
  assert.equal(out.ja, ja)
  assert.equal(out.reading, null)
  assert.ok(Array.isArray(out.warnings))
  assert.equal(d.calls[0].task, 'openingDraft')
  await new Promise((r) => setImmediate(r))
  const t = JSON.stringify(d.traces)
  for (const s of [ko, ja, '카페 와이파이', '점원']) assert.ok(!t.includes(s), `Trace 에 원문: ${s}`)
  assert.equal(d.traces[0].refType, 'openingDraft')
  assert.equal(d.traces[0].steps[0].promptVersion, OPENING_DRAFT_PROMPT_VERSION)
  const plain = openingDeps(async () => okOpening('いらっしゃいませ。', 'いらっしゃいませ。'))
  assert.deepEqual(await runOpeningDraft(U, await readOpeningDraftBody(U, { ko: '어서 오세요.', scenario: { roles, level: 'N5' } }, plain.deps), plain.deps), { ja: 'いらっしゃいませ。', reading: 'いらっしゃいませ。', warnings: [] })
})

test('#178 오류 매핑: NOT_AN_UTTERANCE·UNSAFE 같은 422 · TOO_LONG 422 · INVALID·JsonSchemaError·엔진 오류·시간 초과 502 · 큐 포화 429', async () => {
  const body = { ko: '어서 오세요.', scenario: { title: null, titleJa: null, goal: null, placeTitle: null, roles, level: 'N5' as const } }
  const run = (respond: () => Promise<OpeningDraftResponse>) => runOpeningDraft(U, body, openingDeps(respond).deps)
  for (const status of ['NOT_AN_UTTERANCE', 'UNSAFE'] as const) {
    const e = await rejects(run(async () => ({ status, ja: null, reading: null })), 'UNPROCESSABLE', 'NOT_AN_UTTERANCE')
    assert.equal(e.userMessage, OPENING_DRAFT_REJECT_MESSAGE)
  }
  const long = await rejects(run(async () => okOpening(`${'いらっしゃいませ'.repeat(8)}。`, null)), 'UNPROCESSABLE', 'TOO_LONG')
  assert.equal(long.userMessage, OPENING_DRAFT_TOO_LONG_MESSAGE)
  for (const [respond, reason] of [
    [async () => ({ status: 'OK', ja: null, reading: null }), 'DRAFT_INVALID'],
    [async () => Promise.reject(named('JsonSchemaError')), 'DRAFT_INVALID'],
    [async () => Promise.reject(named('ClaudeCliExecError')), 'ENGINE_FAILED'],
    [async () => Promise.reject(named('LlmTimeoutError')), 'TIMEOUT'],
  ] as [() => Promise<OpeningDraftResponse>, string][]) {
    const e = await rejects(run(respond), 'ENGINE_ERROR', reason)
    assert.equal(e.userMessage, OPENING_DRAFT_FAIL_MESSAGE)
  }
  await rejects(run(async () => Promise.reject(new ApiError('RATE_LIMITED', '요청이 많아요.'))), 'RATE_LIMITED')
})

test('#178 동시 1건 409 DRAFT_BUSY · 예외 뒤 잠금 해제', async () => {
  const body = { ko: '어서 오세요.', scenario: { title: null, titleJa: null, goal: null, placeTitle: null, roles, level: 'N5' as const } }
  const gate = deferred<OpeningDraftResponse>()
  const first = runOpeningDraft(U, body, openingDeps(() => gate.promise).deps)
  await rejects(runOpeningDraft(U, body, openingDeps(async () => okOpening('いらっしゃいませ。', null)).deps), 'CONFLICT', 'DRAFT_BUSY')
  await runOpeningDraft(U2, body, openingDeps(async () => okOpening('いらっしゃいませ。', null)).deps)
  gate.reject(named('LlmTimeoutError'))
  await assert.rejects(first)
  assert.equal((await runOpeningDraft(U, body, openingDeps(async () => okOpening('いらっしゃいませ。', null)).deps)).ja, 'いらっしゃいませ。')
})
