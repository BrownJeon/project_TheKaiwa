/**
 * task-058 — #169 `POST /api/v1/chats/:id/reply-practice`·#178 `POST /api/v1/scenarios/openings/draft` 라우트가 `req.signal` 을 서비스로 넘기는지
 * 라우트 파일 그대로 시험한다(DB·세션·LLM 0). #180 `task056PhraseHelpRoute.test.ts` 와 같은 방법: 이 파일 안에서만 `@/modules/infra`·`@/modules/conversation`
 * 의 require 캐시 항목을 "진짜 + 세션·한도 기록·서비스 감싸기" 로 바꿔 끼운 **뒤에** route.ts 를 처음 읽는다.
 * 서비스는 가짜가 아니라 **진짜**다 — 감싸개가 라우트가 넘긴 인자(`deps`·`signal`)만 기록하고 가짜 deps(엔진 포함)로 진짜 서비스를 부른다.
 * 그래서 진짜 `Request` + `AbortController` 의 abort 가 라우트 → 서비스 → 엔진 요청의 신호로 이어져 409 `CANCELLED` 봉투로 돌아오는 전 구간이 한 번에 보인다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readScenarioRolePlayMaterial, type ScenarioMaterialDb } from '@/modules/learning'

type Json = { success: boolean; data: { code?: string; details?: Record<string, unknown> } & Record<string, unknown>; message: string | null }
type Handler = (req: unknown, ctx: unknown) => Promise<Response>
type EngineReq = { signal?: AbortSignal }
/** 엔진 결과의 모양만(라우트 층은 `@/modules/engine` 을 직접 import 하지 못한다 — ESLint). */
type EngineResult<T> = { data: T; connectionKey: string; model: string; elapsedMs: number; promptChars: number; attempts: number }

const req = createRequire(__filename)
const infraPath = req.resolve('@/modules/infra')
const conversationPath = req.resolve('@/modules/conversation')
const infra = req(infraPath) as typeof import('@/modules/infra')
const conversation = req(conversationPath) as typeof import('@/modules/conversation')

const REPLY_GOOD = (JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/reply-practice.json'), 'utf8')) as { modelResponses: Record<string, unknown> }).modelResponses.good
const CHAT_AT = new Date('2026-10-11T01:00:00Z')
const at = (s: number) => new Date(CHAT_AT.getTime() + s * 1000)

let sessionUser = 'cuser_p58_000000000000000'
let engineMode: 'ok' | 'abortable' = 'ok'
const engineReqs: EngineReq[] = []
const seenReply: { deps: unknown; signal: AbortSignal | undefined }[] = []
const seenOpening: { deps: unknown; signal: AbortSignal | undefined }[] = []
const engineState = { cancelled: false, release: undefined as undefined | (() => void) }

function swap(path: string, exports: Record<string, unknown>): void {
  const m = req.cache[path]
  assert.ok(m, `${path} 가 먼저 로드돼 있어야 함`)
  m.exports = exports
}

/** 엔진(claudeCli)과 같은 약속의 가짜 — `abortable` 모드에서는 신호가 abort 되면 name 'AbortError' 로 거절(전달 누락이어도 1초 뒤 스스로 거절해 멈추지 않는다). */
function fakeEngine<T>(okData: T): (r: EngineReq) => Promise<EngineResult<T>> {
  return async (r) => {
    engineReqs.push(r)
    if (engineMode === 'ok') return { data: okData, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: 1 }
    return new Promise((_resolve, reject) => {
      const named = (name: string) => Object.assign(new Error('x'), { name })
      const timer = setTimeout(() => reject(named('FakeEngineNeverAborted')), 1000)
      engineState.release = () => {
        clearTimeout(timer)
        reject(named('FakeEngineReleased'))
      }
      const stop = () => {
        clearTimeout(timer)
        engineState.cancelled = true
        reject(named('AbortError'))
      }
      if (r.signal?.aborted) stop()
      else r.signal?.addEventListener('abort', stop, { once: true })
    })
  }
}

const SCENARIO_ROW = {
  id: 'scn_seed',
  title: '카페에서 주문하기',
  titleJa: 'カフェで注文する',
  level: 'N5',
  status: 'ACTIVE',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '음료를 사이즈까지 정해 주문한다', successCriteria: ['음료 이름'] },
  constraints: { steps: [{ ko: '음료 말하기' }, { ko: '사이즈 말하기' }], opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요' } },
  keyExpressions: [
    { id: 'e1', ja: 'アイスコーヒーをください', ko: '아이스커피 주세요', match: 'アイスコーヒー' },
    { id: 'e2', ja: 'Lサイズでお願いします', ko: 'L 사이즈로 부탁해요', match: 'Lサイズ' },
  ],
  completionRule: { requiredExpressions: 2 },
}
const materialDb = { scenario: { findFirst: async () => SCENARIO_ROW }, topicChunk: { findMany: async () => [] } } as unknown as ScenarioMaterialDb

/** 진짜 `suggestReply` 에 줄 가짜 deps — DB 0, 엔진만 `fakeEngine`. */
function replyDeps(): NonNullable<Parameters<typeof conversation.suggestReply>[3]> {
  return {
    readChat: async (userId, chatId) => (userId === sessionUser && chatId === 'chat_rp' ? ({ id: 'chat_rp', kind: 'TALK', level: 'N4', scenarioId: 'scn_seed', createdAt: CHAT_AT, endedAt: null } as never) : null),
    recentMessages: async () => [
      { id: 'm2', role: 'ASSISTANT', status: 'DONE', content: 'サイズはどうしますか？', createdAt: at(21) },
      { id: 'm1', role: 'USER', status: 'DONE', content: 'アイスコーヒーをください', createdAt: at(20) },
    ],
    turnLocked: () => false,
    isEnded: async () => false,
    readMaterial: async (userId, scenarioId) => readScenarioRolePlayMaterial(userId, scenarioId, materialDb),
    learnerTexts: async () => ['アイスコーヒーをください'],
    learnerLevel: async () => 'N5',
    complete: fakeEngine(REPLY_GOOD) as never,
    trace: async () => undefined,
  }
}
/** 진짜 `runOpeningDraft` 에 줄 가짜 deps. */
function openingDeps(): NonNullable<Parameters<typeof conversation.runOpeningDraft>[2]> {
  return {
    complete: fakeEngine({ status: 'OK', ja: 'いらっしゃいませ。', reading: null }) as never,
    trace: async () => undefined,
  }
}

swap(infraPath, {
  ...infra,
  requireSession: async () => ({ user: { id: sessionUser, email: 'qa@example.test', name: null, role: 'USER' } }),
})
swap(conversationPath, {
  ...conversation,
  // 라우트가 넘긴 인자(deps 는 undefined 여야 하고 신호는 라우트의 req.signal 이어야 한다)를 기록한 뒤 진짜 서비스를 가짜 deps 로 부른다.
  suggestReply: async (userId: string, chatId: string, messageId: string, deps?: unknown, signal?: AbortSignal) => {
    seenReply.push({ deps, signal })
    return conversation.suggestReply(userId, chatId, messageId, replyDeps(), signal)
  },
  runOpeningDraft: async (userId: string, body: Parameters<typeof conversation.runOpeningDraft>[1], deps?: unknown, signal?: AbortSignal) => {
    seenOpening.push({ deps, signal })
    return conversation.runOpeningDraft(userId, body, openingDeps(), signal)
  },
})

const replyRoute = req(join(__dirname, '..', 'chats', '[id]', 'reply-practice', 'route.ts')) as { POST: Handler }
const openingRoute = req(join(__dirname, '..', 'scenarios', 'openings', 'draft', 'route.ts')) as { POST: Handler }

let seq = 0
const reset = (mode: 'ok' | 'abortable' = 'ok') => {
  sessionUser = `cuser_p58_${String(++seq).padStart(15, '0')}`
  engineMode = mode
  engineReqs.length = 0
  seenReply.length = 0
  seenOpening.length = 0
  engineState.cancelled = false
  engineState.release = undefined
}
const post = (body: unknown, signal?: AbortSignal) =>
  new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...(signal ? { signal } : {}) })
async function send(h: Handler, r: Request, ctx: unknown = {}): Promise<{ status: number; json: Json }> {
  const res = await h(r, ctx)
  return { status: res.status, json: (await res.json()) as Json }
}
const reply = (signal?: AbortSignal) => send(replyRoute.POST, post({ messageId: 'm2' }, signal), { params: Promise.resolve({ id: 'chat_rp' }) })
const OPENING_BODY = { ko: '어서 오세요. 주문해 주세요.', scenario: { roles: { learner: '손님', tutor: '점원' }, level: 'N5' } }
const opening = (signal?: AbortSignal) => send(openingRoute.POST, post(OPENING_BODY, signal))
const untilEngine = async () => {
  for (let i = 0; i < 200 && engineReqs.length === 0; i++) await new Promise((r) => setTimeout(r, 5))
  assert.equal(engineReqs.length, 1, '엔진 호출 진행 중')
}
/** 취소는 오류 로그를 내지 않는다 — 시험 중 `console.error` 호출을 모은다. */
async function withErrorSpy<T>(fn: () => Promise<T>): Promise<{ result: T; logged: string[] }> {
  const logged: string[] = []
  const orig = console.error
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(' '))
  try {
    return { result: await fn(), logged }
  } finally {
    console.error = orig
  }
}

test('#169 라우트: req.signal 이 서비스 마지막(5번째) 인자로 간다(deps 는 undefined) — 손님이 끊으면 서비스가 받은 신호도 abort · 서비스는 그 신호를 엔진 요청에 그대로 싣는다', async () => {
  reset()
  const ac = new AbortController()
  const r = await reply(ac.signal)
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.data.messageId, 'm2')
  assert.equal(seenReply.length, 1)
  assert.equal(seenReply[0].deps, undefined, '4번째 인자는 기본 deps 자리')
  const got = seenReply[0].signal
  assert.ok(got instanceof AbortSignal, '서비스 5번째 인자가 AbortSignal')
  assert.equal(got.aborted, false, '연결이 살아 있는 동안은 abort 아님')
  assert.equal(engineReqs[0].signal, got, '서비스가 같은 신호 객체를 엔진 요청에 실었다')
  ac.abort()
  assert.equal(got.aborted, true, '손님이 끊으면 서비스가 받은 신호도 abort')
  await reply() // 신호 없이 부른 요청도 Request 가 항상 신호를 갖는다 — 서비스는 항상 받는다.
  assert.ok(seenReply[1].signal instanceof AbortSignal)
})

test('#178 라우트: req.signal 이 서비스 마지막(4번째) 인자로 간다(deps 는 undefined) — 손님이 끊으면 서비스가 받은 신호도 abort · 서비스는 그 신호를 엔진 요청에 그대로 싣는다', async () => {
  reset()
  const ac = new AbortController()
  const r = await opening(ac.signal)
  assert.equal(r.status, 200, JSON.stringify(r.json))
  assert.equal(r.json.data.ja, 'いらっしゃいませ。')
  assert.equal(seenOpening.length, 1)
  assert.equal(seenOpening[0].deps, undefined, '3번째 인자는 기본 deps 자리')
  const got = seenOpening[0].signal
  assert.ok(got instanceof AbortSignal, '서비스 4번째 인자가 AbortSignal')
  assert.equal(got.aborted, false)
  assert.equal(engineReqs[0].signal, got, '서비스가 같은 신호 객체를 엔진 요청에 실었다')
  ac.abort()
  assert.equal(got.aborted, true)
  await opening()
  assert.ok(seenOpening[1].signal instanceof AbortSignal)
})

test('#169 전 구간: 엔진이 도는 중에 손님이 요청을 끊으면(abort) 엔진이 취소를 받고 409 CANCELLED 봉투(500·오류 로그 0) — 같은 사용자의 즉시 재호출은 200(잠금 해제)', async () => {
  reset('abortable')
  const ac = new AbortController()
  let res: { status: number; json: Json }
  let logged: string[]
  try {
    ;({ result: res, logged } = await withErrorSpy(async () => {
      const pending = reply(ac.signal)
      await untilEngine()
      assert.equal(engineReqs[0].signal, seenReply[0].signal, '라우트 → 서비스 → 엔진 요청이 같은 신호')
      ac.abort()
      return pending
    }))
  } finally {
    ac.abort()
    engineState.release?.() // 단언이 먼저 실패해도 가짜 엔진을 풀어 잠금이 샌 채로 남지 않게
  }
  assert.equal(engineState.cancelled, true, '엔진이 취소를 받았다')
  assert.equal(res.status, 409)
  assert.equal(res.json.success, false)
  assert.equal(res.json.data.code, 'CONFLICT')
  assert.equal(res.json.data.details?.reason, 'CANCELLED')
  assert.deepEqual(logged, [], '취소는 오류 로그를 내지 않는다')

  engineMode = 'ok'
  engineReqs.length = 0
  const again = await reply()
  assert.equal(again.status, 200, `PRACTICE_BUSY 가 남으면 안 된다: ${JSON.stringify(again.json)}`)
})

test('#178 전 구간: 엔진이 도는 중에 손님이 요청을 끊으면(abort) 엔진이 취소를 받고 409 CANCELLED 봉투(500·오류 로그 0) — 같은 사용자의 즉시 재호출은 200(잠금 해제)', async () => {
  reset('abortable')
  const ac = new AbortController()
  let res: { status: number; json: Json }
  let logged: string[]
  try {
    ;({ result: res, logged } = await withErrorSpy(async () => {
      const pending = opening(ac.signal)
      await untilEngine()
      assert.equal(engineReqs[0].signal, seenOpening[0].signal, '라우트 → 서비스 → 엔진 요청이 같은 신호')
      ac.abort()
      return pending
    }))
  } finally {
    ac.abort()
    engineState.release?.()
  }
  assert.equal(engineState.cancelled, true, '엔진이 취소를 받았다')
  assert.equal(res.status, 409)
  assert.equal(res.json.data.code, 'CONFLICT')
  assert.equal(res.json.data.details?.reason, 'CANCELLED')
  assert.deepEqual(logged, [], '취소는 오류 로그를 내지 않는다')

  engineMode = 'ok'
  engineReqs.length = 0
  const again = await opening()
  assert.equal(again.status, 200, `DRAFT_BUSY 가 남으면 안 된다: ${JSON.stringify(again.json)}`)
})
