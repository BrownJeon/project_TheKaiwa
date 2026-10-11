/**
 * task-058 — #169 `suggestReply`·#178 `runOpeningDraft` 의 손님 취소(`req.signal`) 전달 시험(DB·LLM 0, 가짜 deps).
 * #180 `helpPhrase`(task-056 REV-190 M1·REV-192 L-R2)와 같은 약속을 두 서비스에 건다:
 *  ① 서비스가 받은 신호를 **같은 객체 그대로** 엔진 요청에 싣는다(신호가 없으면 `signal` 칸 자체가 없다 — 기존 동작) ·
 *  ② 신호가 abort 된 상태의 `AbortError` 만 분류된 409 `CANCELLED`(500·오류 로그 없음, Trace 에는 코드만) ·
 *  ③ 그 사이 잠금(`PRACTICE_BUSY`·`DRAFT_BUSY`)은 유지되다가 abort 하면 풀려 같은 사용자가 바로 다시 부를 수 있다 ·
 *  ④ 신호가 살아 있는데 `AbortError` 가 새면 취소로 둔갑하지 않고 기존 매핑 그대로.
 * 라우트가 `req.signal` 을 서비스로 넘기는지는 `app/api/v1/__tests__/task058CancelRoute.test.ts` 가 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, classifyError, toErrorResponse } from '@/modules/infra'
import type { LlmJsonRequest, LlmJsonResult, TraceRecord } from '@/modules/engine'
import { readScenarioRolePlayMaterial, type ScenarioMaterialDb, type ScenarioRolePlayMaterial } from '@/modules/learning'
import type { ReplyPracticeModel } from '../structuredResponse/replyPractice'
import type { OpeningDraftResponse } from '../structuredResponse/openingDraftSchemas'
import { suggestReply, type PracticeMessageRow, type ReplyPracticeDeps } from '../chats/replyPractice'
import { runOpeningDraft, type OpeningDraftRunDeps } from '../chats/openingDraftRun'
import { cancelledError, isAbortError } from '../chats/requestCancel'

const U = 'cuser0000000000000000p058'
const CHAT_AT = new Date('2026-10-11T01:00:00Z')
const REPLY_FIX = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/reply-practice.json'), 'utf8')) as { modelResponses: Record<string, ReplyPracticeModel> }

const named = (name: string) => Object.assign(new Error('x'), { name })
const llmResult = <T>(data: T): LlmJsonResult<T> => ({ data, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: 1 })

async function rejects(p: Promise<unknown>, code: string, reason?: string): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof ApiError, `ApiError 여야 함: ${String(e)}`)
    assert.equal(e.code, code)
    if (reason !== undefined) assert.equal(e.details?.reason, reason)
    return e
  }
  assert.fail(`${code} 오류가 나야 함`)
}

/**
 * 엔진(claudeCli)과 같은 약속의 가짜 — `signal` 이 abort 되면 name 'AbortError' 로 거절한다.
 * 신호가 안 오는 결함(전달 누락)이어도 시험이 멈추지 않게 1초 뒤 스스로 거절하고, `release` 로 시험이 먼저 끝나도 풀 수 있다(잠금이 뒤 시험으로 새지 않게).
 */
interface EngineSeen {
  cancelled: boolean
  release?: () => void
}
function abortableEngine(onCall: (req: { signal?: AbortSignal }) => void, seen: EngineSeen): (req: { signal?: AbortSignal }) => Promise<never> {
  return (req) => {
    onCall(req)
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(named('FakeEngineNeverAborted')), 1000)
      seen.release = () => {
        clearTimeout(timer)
        reject(named('FakeEngineReleased'))
      }
      const stop = () => {
        clearTimeout(timer)
        seen.cancelled = true
        reject(named('AbortError'))
      }
      if (req.signal?.aborted) stop()
      else req.signal?.addEventListener('abort', stop, { once: true })
    })
  }
}

/** `console.error` 를 모아 돌려준다(취소가 오류 로그를 내지 않는지·새는 AbortError 는 내는지). */
async function captureErrors<T>(fn: () => Promise<T>): Promise<{ result: T; logged: string[] }> {
  const logged: string[] = []
  const orig = console.error
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(' '))
  try {
    return { result: await fn(), logged }
  } finally {
    console.error = orig
  }
}

// ── 공용 헬퍼 ────────────────────────────────────────────────────────────────

test('requestCancel: isAbortError 는 name === AbortError 만 · cancelledError 는 분류된 409 CANCELLED(500·오류 로그 없음)', async () => {
  assert.equal(isAbortError(named('AbortError')), true)
  for (const e of [named('LlmTimeoutError'), new Error('AbortError'), null, undefined, 'AbortError', {}]) assert.equal(isAbortError(e), false)
  const e = cancelledError()
  assert.ok(e instanceof ApiError)
  assert.equal(e.code, 'CONFLICT')
  assert.equal(e.details?.reason, 'CANCELLED')
  const { result, logged } = await captureErrors(async () => toErrorResponse(e).status)
  assert.equal(result, 409)
  assert.deepEqual(logged, [])
})

// ── #169 reply-practice ──────────────────────────────────────────────────────

const SCENARIO_ROW = {
  id: 'scn_seed',
  title: '카페에서 주문하기',
  titleJa: 'カフェで注文する',
  level: 'N5',
  status: 'ACTIVE',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '음료를 사이즈까지 정해 주문한다', successCriteria: ['음료 이름'] },
  constraints: { steps: [{ ko: '음료 말하기' }, { ko: '사이즈 말하기' }], opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요' } },
  keyExpressions: [
    { id: 'e1', ja: 'アイスコーヒーをください', ko: '아이스커피 주세요', match: 'アイスコーヒー' },
    { id: 'e2', ja: 'Lサイズでお願いします', ko: 'L 사이즈로 부탁해요', match: 'Lサイズ' },
  ],
  completionRule: { requiredExpressions: 2 },
}
async function material(): Promise<ScenarioRolePlayMaterial> {
  const db = { scenario: { findFirst: async () => SCENARIO_ROW }, topicChunk: { findMany: async () => [] } } as unknown as ScenarioMaterialDb
  return (await readScenarioRolePlayMaterial(U, 'scn_seed', db))!
}
const at = (s: number) => new Date(CHAT_AT.getTime() + s * 1000)
/** 새것부터(desc) — 실제 `recentMessages` 와 같은 순서. */
const convo = (): PracticeMessageRow[] => [
  { id: 'm2', role: 'ASSISTANT', status: 'DONE', content: 'サイズはどうしますか？', createdAt: at(21) },
  { id: 'm1', role: 'USER', status: 'DONE', content: 'アイスコーヒーをください', createdAt: at(20) },
  { id: 'm0', role: 'ASSISTANT', status: 'DONE', content: 'いらっしゃいませ。ご注文は？', createdAt: at(0) },
]
const TUTOR_TEXT = 'サイズはどうしますか？'

function replyWorld(over: Partial<ReplyPracticeDeps> = {}) {
  const reqs: LlmJsonRequest<ReplyPracticeModel>[] = []
  const traces: TraceRecord[] = []
  const deps: ReplyPracticeDeps = {
    readChat: async (userId, chatId) => (userId === U && chatId === 'chat_rp' ? ({ id: 'chat_rp', kind: 'TALK', level: 'N4', scenarioId: 'scn_seed', createdAt: CHAT_AT, endedAt: null } as never) : null),
    recentMessages: async () => convo(),
    turnLocked: () => false,
    isEnded: async () => false,
    readMaterial: async () => material(),
    learnerTexts: async () => ['アイスコーヒーをください'],
    learnerLevel: async () => 'N5',
    complete: async (req) => (reqs.push(req), llmResult(REPLY_FIX.modelResponses.good)),
    trace: async (t) => void traces.push(t),
    ...over,
  }
  return { deps, reqs, traces }
}
/** 엔진 호출이 시작된 뒤(읽기 await 들이 끝난 뒤)에야 신호를 확인할 수 있다. */
const untilCalled = async (reqs: unknown[]) => {
  for (let i = 0; i < 200 && reqs.length === 0; i++) await new Promise((r) => setTimeout(r, 5))
  assert.equal(reqs.length, 1, '엔진 호출 진행 중')
}

test('#169 손님 취소(signal): 신호가 엔진 요청까지 그대로 → 진행 중엔 PRACTICE_BUSY 유지 → abort 하면 409 CANCELLED(500·오류 로그 0) · 잠금 즉시 해제 · Trace 는 코드만', async () => {
  const ac = new AbortController()
  const seen: EngineSeen = { cancelled: false }
  const w = replyWorld()
  w.deps.complete = abortableEngine((r) => w.reqs.push(r as LlmJsonRequest<ReplyPracticeModel>), seen)
  let err: unknown
  let status = 0
  let logged: string[] = []
  try {
    ;({ logged } = await captureErrors(async () => {
      const settled = suggestReply(U, 'chat_rp', 'm2', w.deps, ac.signal).then(() => null, (e: unknown) => e)
      await untilCalled(w.reqs)
      assert.equal(w.reqs[0].signal, ac.signal, '라우트가 준 신호가 엔진 요청에 그대로(복사·누락 없음)')
      assert.equal(w.reqs[0].signal?.aborted, false)
      // 진행 중에는 잠금이 유지된다 — 둘째 호출은 LLM 을 부르지 않고 거절된다.
      await rejects(suggestReply(U, 'chat_rp', 'm2', replyWorld().deps), 'CONFLICT', 'PRACTICE_BUSY')
      ac.abort()
      err = await settled
      status = toErrorResponse(err).status
    }))
  } finally {
    ac.abort() // 단언이 먼저 실패해도 가짜 엔진을 풀어 잠금이 뒤 시험으로 새지 않게(이미 abort 됐으면 무해).
    seen.release?.()
  }
  assert.ok(err instanceof ApiError, `ApiError 여야 함: ${String(err)}`)
  assert.equal(err.code, 'CONFLICT')
  assert.equal(err.details?.reason, 'CANCELLED')
  assert.equal(status, 409, '봉투로 바뀌어도 500 이 아니다')
  assert.equal(seen.cancelled, true, '엔진이 취소를 받았다')
  assert.deepEqual(logged, [], '취소는 오류 로그(INTERNAL 의 console.error)를 내지 않는다')

  // 잠금 해제: 같은 사용자가 바로 다시 부르면 200 이다. 신호 없이 부르면 요청에 signal 칸도 없다(기존 동작 그대로).
  const again = replyWorld()
  const r = await suggestReply(U, 'chat_rp', 'm2', again.deps)
  assert.equal(r.messageId, 'm2')
  assert.ok(!('signal' in again.reqs[0]), '신호를 안 주면 요청에 signal 칸이 없다')

  assert.equal(w.traces.length, 1)
  assert.equal(w.traces[0].status, 'ERROR')
  assert.equal(w.traces[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].steps[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].refType, 'replyPractice')
  const t = JSON.stringify(w.traces)
  for (const s of [TUTOR_TEXT, 'アイスコーヒー', '손님', '점원', '카페']) assert.ok(!t.includes(s), `Trace 원문 없음: ${s}`)
})

test('#169 호출 전에 이미 끊긴 신호도 같은 길(409 CANCELLED, 잠금 해제) · 신호가 있어도 취소가 아닌 엔진 실패는 기존 매핑(504)', async () => {
  const ac = new AbortController()
  ac.abort()
  const seen: EngineSeen = { cancelled: false }
  const w = replyWorld()
  w.deps.complete = abortableEngine((r) => w.reqs.push(r as LlmJsonRequest<ReplyPracticeModel>), seen)
  await rejects(suggestReply(U, 'chat_rp', 'm2', w.deps, ac.signal), 'CONFLICT', 'CANCELLED')
  assert.equal(seen.cancelled, true)
  assert.equal((await suggestReply(U, 'chat_rp', 'm2', replyWorld().deps)).messageId, 'm2', '잠금 해제')

  const slow = replyWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(suggestReply(U, 'chat_rp', 'm2', slow.deps, new AbortController().signal), (e: Error) => classifyError(e).status === 504)
  assert.equal(slow.traces[0].errorCode, 'ENGINE_TIMEOUT')
})

test('#169 취소 판정은 오류 이름만이 아니라 신호도 본다: 신호가 살아 있는데 AbortError 가 새면 CANCELLED 로 둔갑하지 않고 기존 매핑(INTERNAL 500·오류 로그 있음) · 잠금은 풀린다', async () => {
  const leaky = () => replyWorld({ complete: async () => Promise.reject(named('AbortError')) })

  // 신호가 abort 된 상태 + AbortError → 취소.
  const gone = new AbortController()
  gone.abort()
  const a = leaky()
  await rejects(suggestReply(U, 'chat_rp', 'm2', a.deps, gone.signal), 'CONFLICT', 'CANCELLED')

  // 신호는 살아 있음(어댑터가 자기 타이머 등으로 만든 AbortError 가 샌 경우) → 취소로 숨기지 않는다.
  const live = new AbortController()
  const b = leaky()
  const { result, logged } = await captureErrors(async () => {
    const err = await suggestReply(U, 'chat_rp', 'm2', b.deps, live.signal).then(() => null, (e: unknown) => e)
    return { err, status: toErrorResponse(err).status }
  })
  assert.ok(result.err instanceof Error, `오류가 나야 함: ${String(result.err)}`)
  assert.ok(!(result.err instanceof ApiError && result.err.details?.reason === 'CANCELLED'), '살아 있는 신호의 AbortError 는 CANCELLED 가 아니다')
  assert.equal(classifyError(result.err).code, 'INTERNAL')
  assert.equal(result.status, 500, '409 로 둔갑하지 않는다')
  assert.equal(logged.length, 1, '오류 로그가 남는다(조용히 삼키지 않는다)')
  assert.equal(b.traces[0].errorCode, 'INTERNAL')
  assert.equal(b.traces[0].steps[0].errorCode, 'INTERNAL')

  assert.equal((await suggestReply(U, 'chat_rp', 'm2', replyWorld().deps, live.signal)).messageId, 'm2', '잠금 해제')
})

test('#169 취소 판정은 신호만이 아니라 오류 이름도 본다: 신호가 abort 된 상태에서 AbortError 가 아닌 엔진 실패(시간 초과)는 CANCELLED 로 둔갑하지 않고 기존 매핑(504·Trace ENGINE_TIMEOUT) · 잠금은 풀린다', async () => {
  // 화면 상한(PRACTICE_TIMEOUT_MS 12s)과 서버 fast 12s 가 겹쳐 손님이 끊은 순간 엔진 시간 초과도 나는 경우 — 진짜 504 가 로그 없는 409 로 바뀌고 Trace 에 진짜 코드가 안 남으면 안 된다.
  for (const when of ['호출 전에 이미', '호출 도중에'] as const) {
    const ac = new AbortController()
    if (when === '호출 전에 이미') ac.abort()
    const w = replyWorld({
      complete: async () => {
        ac.abort()
        throw named('LlmTimeoutError')
      },
    })
    const err = await suggestReply(U, 'chat_rp', 'm2', w.deps, ac.signal).then(() => null, (e: unknown) => e)
    assert.equal(ac.signal.aborted, true, `${when} abort 된 신호`)
    assert.ok(err instanceof Error, `${when}: 오류가 나야 함: ${String(err)}`)
    assert.ok(!(err instanceof ApiError && err.details?.reason === 'CANCELLED'), `${when}: 시간 초과가 CANCELLED 로 둔갑하지 않는다`)
    assert.equal(classifyError(err).code, 'ENGINE_TIMEOUT')
    assert.equal(toErrorResponse(err).status, 504, `${when}: 409 가 아니라 기존 504`)
    assert.equal(w.traces.length, 1)
    assert.equal(w.traces[0].errorCode, 'ENGINE_TIMEOUT', `${when}: Trace 에 진짜 코드`)
    assert.equal(w.traces[0].steps[0].errorCode, 'ENGINE_TIMEOUT')
    assert.equal((await suggestReply(U, 'chat_rp', 'm2', replyWorld().deps)).messageId, 'm2', `${when}: 잠금 해제`)
  }
})

// ── #178 openings/draft ──────────────────────────────────────────────────────

const roles = { learner: '손님', tutor: '점원' }
const KO = '어서 오세요. 주문해 주세요.'
const openingBody = { ko: KO, scenario: { title: null, titleJa: null, goal: null, placeTitle: null, roles, level: 'N5' as const } }
const okOpening: OpeningDraftResponse = { status: 'OK', ja: 'いらっしゃいませ。', reading: null }

function openingWorld(over: Partial<Pick<OpeningDraftRunDeps, 'complete' | 'trace'>> = {}) {
  const reqs: Parameters<OpeningDraftRunDeps['complete']>[0][] = []
  const traces: TraceRecord[] = []
  const deps: Pick<OpeningDraftRunDeps, 'complete' | 'trace'> = {
    complete: async (req) => (reqs.push(req), llmResult(okOpening)),
    trace: async (t) => void traces.push(t),
    ...over,
  }
  return { deps, reqs, traces }
}

test('#178 손님 취소(signal): 신호가 엔진 요청까지 그대로 → 진행 중엔 DRAFT_BUSY 유지 → abort 하면 409 CANCELLED(500·오류 로그 0) · 잠금 즉시 해제 · Trace 는 코드만', async () => {
  const ac = new AbortController()
  const seen: EngineSeen = { cancelled: false }
  const w = openingWorld()
  w.deps.complete = abortableEngine((r) => w.reqs.push(r as never), seen)
  let err: unknown
  let status = 0
  let logged: string[] = []
  try {
    ;({ logged } = await captureErrors(async () => {
      const settled = runOpeningDraft(U, openingBody, w.deps, ac.signal).then(() => null, (e: unknown) => e)
      await untilCalled(w.reqs)
      assert.equal(w.reqs[0].signal, ac.signal, '라우트가 준 신호가 엔진 요청에 그대로(복사·누락 없음)')
      assert.equal(w.reqs[0].signal?.aborted, false)
      await rejects(runOpeningDraft(U, openingBody, openingWorld().deps), 'CONFLICT', 'DRAFT_BUSY')
      ac.abort()
      err = await settled
      status = toErrorResponse(err).status
    }))
  } finally {
    ac.abort()
    seen.release?.()
  }
  assert.ok(err instanceof ApiError, `ApiError 여야 함: ${String(err)}`)
  assert.equal(err.code, 'CONFLICT')
  assert.equal(err.details?.reason, 'CANCELLED')
  assert.equal(status, 409)
  assert.equal(seen.cancelled, true, '엔진이 취소를 받았다')
  assert.deepEqual(logged, [], '취소는 오류 로그를 내지 않는다')

  const again = openingWorld()
  assert.equal((await runOpeningDraft(U, openingBody, again.deps)).ja, 'いらっしゃいませ。', '잠금 해제 — 같은 사용자 즉시 재호출 200')
  assert.ok(!('signal' in again.reqs[0]), '신호를 안 주면 요청에 signal 칸이 없다')

  assert.equal(w.traces.length, 1)
  assert.equal(w.traces[0].status, 'ERROR')
  assert.equal(w.traces[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].steps[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].refType, 'openingDraft')
  const t = JSON.stringify(w.traces)
  for (const s of [KO, 'いらっしゃいませ', '손님', '점원']) assert.ok(!t.includes(s), `Trace 원문 없음: ${s}`)
})

test('#178 호출 전에 이미 끊긴 신호도 같은 길(409 CANCELLED, 잠금 해제) · 신호가 있어도 취소가 아닌 엔진 실패는 기존 매핑(502 TIMEOUT)', async () => {
  const ac = new AbortController()
  ac.abort()
  const seen: EngineSeen = { cancelled: false }
  const w = openingWorld()
  w.deps.complete = abortableEngine((r) => w.reqs.push(r as never), seen)
  await rejects(runOpeningDraft(U, openingBody, w.deps, ac.signal), 'CONFLICT', 'CANCELLED')
  assert.equal(seen.cancelled, true)
  assert.equal((await runOpeningDraft(U, openingBody, openingWorld().deps)).ja, 'いらっしゃいませ。', '잠금 해제')

  const slow = openingWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await rejects(runOpeningDraft(U, openingBody, slow.deps, new AbortController().signal), 'ENGINE_ERROR', 'TIMEOUT')
  assert.equal(slow.traces[0].steps[0].errorCode, 'ENGINE_TIMEOUT')
})

test('#178 취소 판정은 오류 이름만이 아니라 신호도 본다: 신호가 살아 있는데 AbortError 가 새면 CANCELLED 로 둔갑하지 않고 기존 매핑(502 ENGINE_FAILED) · 잠금은 풀린다', async () => {
  const leaky = () => openingWorld({ complete: async () => Promise.reject(named('AbortError')) })

  const gone = new AbortController()
  gone.abort()
  const a = leaky()
  await rejects(runOpeningDraft(U, openingBody, a.deps, gone.signal), 'CONFLICT', 'CANCELLED')

  const live = new AbortController()
  const b = leaky()
  const { result, logged } = await captureErrors(async () => {
    const err = await rejects(runOpeningDraft(U, openingBody, b.deps, live.signal), 'ENGINE_ERROR', 'ENGINE_FAILED')
    return { err, status: toErrorResponse(err).status }
  })
  assert.notEqual(result.err.details?.reason, 'CANCELLED', '살아 있는 신호의 AbortError 는 CANCELLED 가 아니다')
  assert.equal(result.status, 502, '409 로 둔갑하지 않는다')
  assert.deepEqual(logged, [], '이 경로의 기존 매핑은 분류된 502 라 오류 로그가 없다(바뀌지 않았다)')
  assert.equal(b.traces[0].errorCode, 'ENGINE_ERROR')
  assert.equal(b.traces[0].steps[0].errorCode, 'INTERNAL')

  assert.equal((await runOpeningDraft(U, openingBody, openingWorld().deps, live.signal)).ja, 'いらっしゃいませ。', '잠금 해제')
})

test('#178 취소 판정은 신호만이 아니라 오류 이름도 본다: 신호가 abort 된 상태에서 AbortError 가 아닌 엔진 실패(시간 초과)는 CANCELLED 로 둔갑하지 않고 기존 매핑(502 TIMEOUT·Trace ENGINE_TIMEOUT) · 잠금은 풀린다', async () => {
  // 손님이 끊은([그만두기]·이탈) 순간 엔진 시간 초과도 겹쳐 난 경우 — 진짜 오류가 로그 없는 409 로 바뀌고 Trace 에 진짜 코드가 안 남으면 안 된다.
  for (const when of ['호출 전에 이미', '호출 도중에'] as const) {
    const ac = new AbortController()
    if (when === '호출 전에 이미') ac.abort()
    const w = openingWorld({
      complete: async () => {
        ac.abort()
        throw named('LlmTimeoutError')
      },
    })
    const err = await rejects(runOpeningDraft(U, openingBody, w.deps, ac.signal), 'ENGINE_ERROR', 'TIMEOUT')
    assert.equal(ac.signal.aborted, true, `${when} abort 된 신호`)
    assert.notEqual(err.details?.reason, 'CANCELLED', `${when}: 시간 초과가 CANCELLED 로 둔갑하지 않는다`)
    assert.equal(toErrorResponse(err).status, 502, `${when}: 409 가 아니라 기존 502`)
    assert.equal(w.traces.length, 1)
    assert.equal(w.traces[0].errorCode, 'ENGINE_ERROR', `${when}: Trace 에 진짜 코드`)
    assert.equal(w.traces[0].steps[0].errorCode, 'ENGINE_TIMEOUT')
    assert.equal((await runOpeningDraft(U, openingBody, openingWorld().deps)).ja, 'いらっしゃいませ。', `${when}: 잠금 해제`)
  }
})
