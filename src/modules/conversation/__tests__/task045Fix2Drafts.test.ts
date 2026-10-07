/**
 * task-045 감사 잔여 보완(REV-155 L1·REV-154 개발자 남은 위험 ②) — DB·LLM·엔진 0:
 * - #177 `draftScenarioVariant`·#178 `runOpeningDraft` 잠금: 확인(has) 뒤 await 없음 · 등록(add) 바로 다음 줄이 try(소스 구조) +
 *   등록 직전 단계(시계·Trace id)에서 던져도 · 본문(요청 조립) 예외 · LLM 예외 · 시간 초과 · 알 수 없는 예외 · 동시 요청 뒤에도 같은 사용자가 다시 부를 수 있다.
 * - #166 `draftScenario` 장소: 기본 어댑터(`readScenarioDraftTopic`)가 이 사용자가 가린 시드 주제를 400 `{field:'topicId', reason:'not_linked'}` 로
 *   막는다 — LLM 호출 0·잠금 미점유. 보이는 시드·내 버전(사본)은 LLM 까지 가고, 남의 주제는 기존 `not_found` 그대로.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import type { LlmJsonResult } from '@/modules/engine'
import { readScenarioDraftTopic } from '@/modules/learning'
import type { ScenarioDetail } from '@/types/scenario'
import type { OpeningDraftResponse } from '../structuredResponse/openingDraftSchemas'
import type { ScenarioVariantModelResponse } from '../structuredResponse/scenarioVariantSchemas'
import { draftScenarioVariant, readScenarioVariantBase, readScenarioVariantBody } from '../chats/scenarioVariantDraft'
import { readOpeningDraftBody, runOpeningDraft } from '../chats/openingDraftRun'
import { draftScenario, type ScenarioDraftDeps } from '../chats/scenarioDraft'

const ROOT = process.cwd()
const named = (name: string, message = 'x') => Object.assign(new Error(message), { name })
const deferred = <T>() => {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => ((resolve = a), (reject = b)))
  return { promise, resolve, reject }
}
async function rejects(p: Promise<unknown>, code: string, reason?: string): Promise<ApiError> {
  const e = await p.then(
    () => assert.fail(`${code} 오류 기대`),
    (x: unknown) => x,
  )
  assert.ok(e instanceof ApiError, `ApiError 기대: ${String(e)}`)
  assert.equal(e.code, code)
  if (reason !== undefined) assert.equal(e.details?.reason, reason)
  return e
}

/** 첫 `Date.now()` 한 번만 던진다 — 잠금 확인 뒤 등록 앞 단계(Trace 시각)에서 터지는 경우를 흉내 낸다. */
async function failFirstClock(run: () => Promise<unknown>): Promise<unknown> {
  const real = Date.now
  const boom = new Error('clock-boom')
  let armed = true
  Date.now = () => {
    if (armed) {
      armed = false
      throw boom
    }
    return real.call(Date)
  }
  try {
    const e = await run().then(
      () => assert.fail('예외 기대'),
      (x: unknown) => x,
    )
    assert.equal(e, boom, '시계 예외가 그대로 올라온다')
    return e
  } finally {
    Date.now = real
  }
}

function lockShape(file: string): void {
  const src = readFileSync(join(ROOT, 'src/modules/conversation/chats', file), 'utf8')
  const has = src.indexOf('if (inFlight.has(userId))')
  const add = src.indexOf('inFlight.add(userId)')
  assert.ok(has > 0 && add > has, `${file}: 확인 뒤 등록`)
  assert.equal(src.indexOf('inFlight.add(userId)', add + 1), -1, `${file}: 등록은 한 곳`)
  assert.ok(!/\bawait\b/.test(src.slice(has, add)), `${file}: 확인~등록 사이 await 없음(같은 사용자 끼어들기)`)
  assert.match(src.slice(add), /^inFlight\.add\(userId\)\n\s*try \{/, `${file}: 등록과 try 사이에 문장이 있으면 던질 때 영구 DRAFT_BUSY`)
}

// ── #177 변형 초안 ──────────────────────────────────────────────────────────
interface SeedScenario { key: string; title: string; titleJa: string; description: string; level: 'N5'; roles: { learner: string; tutor: string }; goal: { communicativeGoalKo: string; successCriteria: string[] }; steps: { ko: string }[]; keyExpressions: { ja: string; reading?: string; ko: string }[]; opening: { ja: string; ko: string } | null }
const seed = (JSON.parse(readFileSync(join(ROOT, 'prisma/seed-data/scenarios.json'), 'utf8')) as SeedScenario[]).find((s) => s.key === 'cafe-order-drink')!
const detail: ScenarioDetail = {
  id: 'sc_fx2',
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
}
type VariantBody = Parameters<typeof draftScenarioVariant>[2]
type VariantRun = NonNullable<Parameters<typeof draftScenarioVariant>[3]>
const variantRun = (respond: () => Promise<ScenarioVariantModelResponse>, onCall: () => void = () => undefined): VariantRun => ({
  complete: async () => {
    onCall()
    return { data: await respond(), connectionKey: 'conn', model: 'm', attempts: 1, promptChars: 4100 } as unknown as LlmJsonResult<ScenarioVariantModelResponse>
  },
  trace: async () => undefined,
})

test('#177 잠금 — 등록과 try 사이 문장 0(소스) · 등록 직전 시계 예외·본문 예외·LLM 예외·시간 초과·알 수 없는 예외·동시 요청 뒤에도 다시 부를 수 있다', async () => {
  lockShape('scenarioVariantDraft.ts')
  const U = 'cuser_fx2_variant_00000000'
  const target = await readScenarioVariantBase(U, 'sc_fx2', { readDetail: async () => detail, visibility: async () => ({ hiddenScenarios: new Set<string>(), hiddenTopics: new Set<string>() }) })
  const body = readScenarioVariantBody({ axes: { persona: 'kind' } }, 'N5')
  const passesLock = async () => {
    let calls = 0
    await rejects(draftScenarioVariant(U, target, body, variantRun(async () => Promise.reject(named('ClaudeCliExecError')), () => calls++)), 'ENGINE_ERROR')
    assert.equal(calls, 1, '잠금에 막히지 않고 LLM 까지 간다')
  }

  await failFirstClock(() => draftScenarioVariant(U, target, body, variantRun(async () => Promise.reject(named('ClaudeCliExecError')))))
  await passesLock()

  const noChange = { ...body, axes: { persona: 'same', twist: 'none', flow: 'same', level: 'same' }, note: null } as unknown as VariantBody
  await rejects(draftScenarioVariant(U, target, noChange, variantRun(async () => Promise.reject(named('ClaudeCliExecError')))), 'UNPROCESSABLE', 'NO_VARIATION')
  await passesLock()

  await rejects(draftScenarioVariant(U, target, body, variantRun(async () => Promise.reject(named('ClaudeCliExecError')))), 'ENGINE_ERROR')
  await passesLock()
  await rejects(draftScenarioVariant(U, target, body, variantRun(async () => Promise.reject(named('LlmTimeoutError')))), 'ENGINE_TIMEOUT', 'TIMEOUT')
  await passesLock()
  await assert.rejects(draftScenarioVariant(U, target, body, variantRun(async () => Promise.reject(new TypeError('boom')))), TypeError)
  await passesLock()

  const gate = deferred<ScenarioVariantModelResponse>()
  const first = draftScenarioVariant(U, target, body, variantRun(() => gate.promise))
  await rejects(draftScenarioVariant(U, target, body, variantRun(async () => Promise.reject(named('ClaudeCliExecError')))), 'CONFLICT', 'DRAFT_BUSY')
  gate.reject(named('LlmTimeoutError'))
  await rejects(first, 'ENGINE_TIMEOUT', 'TIMEOUT')
  await passesLock()
})

// ── #178 첫마디 ─────────────────────────────────────────────────────────────
type OpeningRun = NonNullable<Parameters<typeof runOpeningDraft>[2]>
const openingRun = (respond: () => Promise<OpeningDraftResponse>, onCall: () => void = () => undefined): OpeningRun => ({
  complete: async () => {
    onCall()
    return { data: await respond(), connectionKey: 'conn', model: 'm', attempts: 1, promptChars: 2100 } as unknown as LlmJsonResult<OpeningDraftResponse>
  },
  trace: async () => undefined,
})

test('#178 잠금 — 등록과 try 사이 문장 0(소스) · 등록 직전 시계 예외·본문 예외·LLM 예외·시간 초과·알 수 없는 예외·동시 요청 뒤에도 다시 부를 수 있다', async () => {
  lockShape('openingDraftRun.ts')
  const U = 'cuser_fx2_opening_00000000'
  const body = await readOpeningDraftBody(U, { ko: '어서 오세요, 무엇을 드릴까요?', scenario: { title: '카페 주문', level: 'N5', roles: { learner: '손님', tutor: '점원' } } }, { profileLevel: async () => 'N5' })
  const passesLock = async () => {
    let calls = 0
    await rejects(runOpeningDraft(U, body, openingRun(async () => Promise.reject(named('ClaudeCliExecError')), () => calls++)), 'ENGINE_ERROR')
    assert.equal(calls, 1, '잠금에 막히지 않고 LLM 까지 간다')
  }

  await failFirstClock(() => runOpeningDraft(U, body, openingRun(async () => Promise.reject(named('ClaudeCliExecError')))))
  await passesLock()

  await rejects(runOpeningDraft(U, { ...body, ko: '' }, openingRun(async () => Promise.reject(named('ClaudeCliExecError')))), 'VALIDATION')
  await passesLock()

  await rejects(runOpeningDraft(U, body, openingRun(async () => Promise.reject(named('ClaudeCliExecError')))), 'ENGINE_ERROR', 'ENGINE_FAILED')
  await passesLock()
  await rejects(runOpeningDraft(U, body, openingRun(async () => Promise.reject(named('LlmTimeoutError')))), 'ENGINE_ERROR', 'TIMEOUT')
  await passesLock()
  await rejects(runOpeningDraft(U, body, openingRun(async () => Promise.reject(new TypeError('boom')))), 'ENGINE_ERROR')
  await passesLock()

  const gate = deferred<OpeningDraftResponse>()
  const first = runOpeningDraft(U, body, openingRun(() => gate.promise))
  await rejects(runOpeningDraft(U, body, openingRun(async () => Promise.reject(named('ClaudeCliExecError')))), 'CONFLICT', 'DRAFT_BUSY')
  gate.reject(named('LlmTimeoutError'))
  await rejects(first, 'ENGINE_ERROR', 'TIMEOUT')
  await passesLock()
})

// ── #166 상황 초안 장소 ──────────────────────────────────────────────────────
test('#166 상황 초안 — 가린 시드 주제는 400 not_linked(LLM 0·잠금 0) · 보이는 시드·내 버전은 LLM 까지 · 남의 주제 not_found · 다른 사용자 override 무관 · 기본 어댑터 연결', async () => {
  const U = 'cuser_fx2_draft_000000000'
  const OTHER = 'cuser_fx2_other_000000000'
  const topics = [
    { id: 'top_seed_hidden', userId: null, title: '카페', titleJa: 'カフェ' },
    { id: 'top_seed_ok', userId: null, title: '길 묻기', titleJa: null },
    { id: 'top_copy', userId: U, title: '카페(내 버전)', titleJa: 'カフェ' },
    { id: 'top_other', userId: OTHER, title: '남의 장소', titleJa: null },
  ]
  const overrides = [
    { userId: U, kind: 'TOPIC', seedId: 'top_seed_hidden', copyId: 'top_copy' },
    { userId: OTHER, kind: 'TOPIC', seedId: 'top_seed_ok', copyId: null },
  ]
  type W = { id?: string; OR?: { userId: string | null }[]; userId?: string; kind?: string; seedId?: string }
  const db = {
    conversationTopic: { findFirst: async (a: { where: W }) => topics.find((t) => t.id === a.where.id && (a.where.OR ?? []).some((c) => c.userId === t.userId)) ?? null },
    userSeedOverride: { findFirst: async (a: { where: W }) => overrides.find((o) => o.userId === a.where.userId && o.kind === a.where.kind && o.seedId === a.where.seedId) ?? null },
  }
  let llm = 0
  const deps: ScenarioDraftDeps = {
    readTopic: (userId, topicId) => readScenarioDraftTopic(userId, topicId, db as never),
    complete: async () => {
      llm++
      throw named('ClaudeCliExecError')
    },
    trace: async () => undefined,
  }
  const DESC = '카페에서 따뜻한 라테를 주문하고 컵 크기를 고르는 상황이에요.'
  const run = (userId: string, topicId: string) => draftScenario(userId, { description: DESC, level: 'N5', topicId }, deps)

  const e = await rejects(run(U, 'top_seed_hidden'), 'VALIDATION', 'not_linked')
  assert.deepEqual(e.details, { field: 'topicId', reason: 'not_linked' })
  assert.equal(llm, 0, '가린 시드면 LLM 0')
  for (const [id, n] of [['top_seed_ok', 1], ['top_copy', 2]] as const) {
    const x = await run(U, id).then(
      () => null,
      (err: unknown) => err,
    )
    assert.ok(!(x instanceof ApiError && x.code === 'VALIDATION'), `${id} 는 장소 검사를 통과해야 함: ${String(x)}`)
    assert.equal(llm, n, `${id} → LLM 까지(잠금도 풀려 있음)`)
  }
  await rejects(run(U, 'top_other'), 'VALIDATION', 'not_found')
  await rejects(run(OTHER, 'top_seed_ok'), 'VALIDATION', 'not_linked')
  assert.equal(llm, 2)

  const src = readFileSync(join(ROOT, 'src/modules/conversation/chats/scenarioDraft.ts'), 'utf8')
  assert.match(src, /readTopic: \(userId, topicId\) => readScenarioDraftTopic\(userId, topicId\)/, '운영 기본 어댑터가 같은 함수(기본 DB)를 쓴다')
})
