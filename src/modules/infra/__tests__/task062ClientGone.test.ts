/**
 * task-062 — `withApi` 가 「손님이 이미 끊긴 요청」의 'aborted' 계열 오류만 오류 로그에서 뺀다(DB·LLM·네트워크 0).
 * 소음의 원천: 본문을 읽는 도중 연결이 끊기면 Node 가 읽기를 `Error('aborted')`(보통 code `ECONNRESET` 동반)로 거절하고, 그때 `req.signal` 은 이미 abort 돼 있다
 * (dev 서버에서 본문 절반만 보내고 소켓을 끊어 재현 — 기록 `task-062-dev-record`).
 * 소음 조건 = 신호 abort **그리고** (`message === 'aborted'` 또는 `name === 'AbortError'`). `code: 'ECONNRESET'` 만으로는 소음이 아니다 —
 * 상류(게이트웨이·M4·DB) 연결 리셋은 손님이 끊긴 뒤에도 실제 백엔드 장애 신호라 계속 기록한다(Leader 지시 2026-10-12).
 * 지키는 약속:
 *  ① 끊긴 요청 + `message:'aborted', code:'ECONNRESET'`(실제 재현 모양) → `console.error` 0, 응답(상태·봉투)은 그대로 500 ·
 *  ② 끊긴 요청 + `code:'ECONNRESET'` 만(message 다름) → 로그 1회 · ③ 신호가 살아 있는 요청의 같은 오류 → 로그 1회, 응답 동일 ·
 *  ④ 끊긴 요청 + `name:'AbortError'` → 로그 0 · 일반 오류 → 신호와 무관하게 로그 1회 + 500 ·
 *  분류된 `ApiError`·엔진 오류 이름 → 로그 없음, 상태·봉투 불변 · 신호가 없는 호출 → 로그 1회(숨기지 않는다) ·
 *  'aborted' 가 **정확히 일치**하지 않는 문구·다른 `code` 는 신호가 abort 여도 계속 기록한다.
 */
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { NextRequest } from 'next/server'
import { ApiError, toErrorResponse, withApi } from '../http'

type Env = { success: boolean; data: { code?: string; details?: Record<string, unknown> }; message: string | null }
interface Outcome {
  status: number
  body: Env
  logs: unknown[][]
}

const abortedRead = () => Object.assign(new Error('aborted'), { code: 'ECONNRESET' })
const named = (name: string, message = 'x') => Object.assign(new Error(message), { name })

const reqWith = (signal?: AbortSignal): NextRequest => new Request('http://x/api/v1/t', { method: 'POST', ...(signal ? { signal } : {}) }) as unknown as NextRequest
const abortedSignal = (): AbortSignal => {
  const ac = new AbortController()
  ac.abort()
  return ac.signal
}
const liveSignal = (): AbortSignal => new AbortController().signal

async function run(req: unknown, thrown: unknown): Promise<Outcome> {
  const spy = mock.method(console, 'error', () => undefined)
  try {
    const res = await withApi(async () => {
      throw thrown
    })(req as NextRequest, undefined)
    return { status: res.status, body: (await res.json()) as Env, logs: spy.mock.calls.map((c) => c.arguments) }
  } finally {
    spy.mock.restore()
  }
}

const INTERNAL_BODY: Env = { success: false, data: { code: 'INTERNAL' }, message: '요청을 처리하지 못했습니다.' }

test('① 끊긴 요청 + 본문 읽기 중 끊김(`Error: aborted`·ECONNRESET) → 오류 로그 0, 응답은 그대로 500 INTERNAL 봉투', async () => {
  const r = await run(reqWith(abortedSignal()), abortedRead())
  assert.equal(r.logs.length, 0)
  assert.equal(r.status, 500)
  assert.deepEqual(r.body, INTERNAL_BODY)
})

test('① ④ 끊긴 요청의 소음 갈래는 message 가 aborted 이거나 name 이 AbortError — 각각 단독으로 소음', async () => {
  for (const [label, e] of [
    ['message 만(code 없음)', new Error('aborted')],
    ['message + code(실제 재현 모양)', abortedRead()],
    ['name 만', named('AbortError', 'The operation was aborted.')],
    ['DOMException', new DOMException('This operation was aborted', 'AbortError')],
  ] as const) {
    const r = await run(reqWith(abortedSignal()), e)
    assert.equal(r.logs.length, 0, `${label}: 로그 0`)
    assert.equal(r.status, 500, label)
    assert.deepEqual(r.body, INTERNAL_BODY, label)
  }
})

test('② 끊긴 요청이어도 code 만 ECONNRESET(message 는 다름)이면 상류 장애 신호라 로그 1회 — 응답은 같다', async () => {
  for (const message of ['socket hang up', 'read ECONNRESET', 'connect failed']) {
    const e = Object.assign(new Error(message), { code: 'ECONNRESET' })
    const r = await run(reqWith(abortedSignal()), e)
    assert.equal(r.logs.length, 1, message)
    assert.deepEqual(r.logs[0], ['[api] 처리되지 않은 예외:', `Error: ${message}`], message)
    assert.equal(r.status, 500, message)
    assert.deepEqual(r.body, INTERNAL_BODY, message)
  }
})

test('③ 신호가 살아 있는 요청의 같은 오류는 로그 1회 — 응답은 끊긴 요청과 글자까지 같다', async () => {
  const live = await run(reqWith(liveSignal()), abortedRead())
  const gone = await run(reqWith(abortedSignal()), abortedRead())
  assert.equal(live.logs.length, 1)
  assert.deepEqual(live.logs[0], ['[api] 처리되지 않은 예외:', 'Error: aborted'])
  assert.equal(live.status, 500)
  assert.deepEqual(live.body, INTERNAL_BODY)
  assert.deepEqual({ status: live.status, body: live.body }, { status: gone.status, body: gone.body }, '로그만 다르고 응답은 같다')
  const liveCodeOnly = await run(reqWith(liveSignal()), Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))
  assert.equal(liveCodeOnly.logs.length, 1, '살아 있는 요청의 code 만 ECONNRESET')
  // AbortError 이름도 신호가 살아 있으면 기록한다(어댑터 자체 타이머가 새어도 진짜 결함이 숨지 않는다).
  const named1 = await run(reqWith(liveSignal()), named('AbortError'))
  assert.equal(named1.logs.length, 1)
  assert.equal(named1.status, 500)
})

test('일반 오류는 신호 상태와 무관하게 로그 1회 + 500', async () => {
  for (const [label, signal] of [['신호 없음', undefined], ['살아 있음', liveSignal()], ['abort 됨', abortedSignal()]] as const) {
    const r = await run(reqWith(signal), new Error('boom'))
    assert.equal(r.logs.length, 1, label)
    assert.deepEqual(r.logs[0], ['[api] 처리되지 않은 예외:', 'Error: boom'], label)
    assert.equal(r.status, 500, label)
    assert.deepEqual(r.body, INTERNAL_BODY, label)
  }
  const str = await run(reqWith(abortedSignal()), 'aborted')
  assert.equal(str.logs.length, 1, '문자열로 던진 오류는 객체 모양이 아니라 소음으로 보지 않는다')
})

test('분류된 `ApiError`·엔진 오류 이름은 신호와 무관하게 로그 없이 상태·봉투 그대로', async () => {
  for (const signal of [undefined, liveSignal(), abortedSignal()]) {
    const nf = await run(reqWith(signal), new ApiError('NOT_FOUND', '없어요.', { reason: 'X' }))
    assert.equal(nf.logs.length, 0)
    assert.equal(nf.status, 404)
    assert.deepEqual(nf.body, { success: false, data: { code: 'NOT_FOUND', details: { reason: 'X' } }, message: '없어요.' })
    const cancelled = await run(reqWith(signal), new ApiError('CONFLICT', '요청이 취소됐어요.', { reason: 'CANCELLED' }))
    assert.equal(cancelled.logs.length, 0)
    assert.equal(cancelled.status, 409)
    assert.equal(cancelled.body.data.details?.reason, 'CANCELLED')
    const timeout = await run(reqWith(signal), named('LlmTimeoutError'))
    assert.equal(timeout.logs.length, 0)
    assert.equal(timeout.status, 504)
    assert.equal(timeout.body.data.code, 'ENGINE_TIMEOUT')
  }
})

test('신호가 없는 호출(요청 객체가 비어 있거나 없음)은 숨기지 않는다 — 로그 1회, 던지지 않는다', async () => {
  for (const [label, req] of [['빈 객체', {}], ['undefined', undefined], ['null', null]] as const) {
    const r = await run(req, abortedRead())
    assert.equal(r.logs.length, 1, label)
    assert.equal(r.status, 500, label)
    assert.deepEqual(r.body, INTERNAL_BODY, label)
  }
})

test('정확히 일치하지 않는 문구·다른 code·다른 이름은 신호가 abort 여도 계속 기록한다', async () => {
  for (const [label, e] of [
    ['문구에 포함', new Error('request aborted by upstream')],
    ['대소문자', new Error('Aborted')],
    ['다른 code', Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' })],
    ['code 만 ECONNRESET', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })],
    ['다른 이름', named('TypeError', 'fetch failed')],
  ] as const) {
    const r = await run(reqWith(abortedSignal()), e)
    assert.equal(r.logs.length, 1, label)
    assert.equal(r.status, 500, label)
  }
})

test('정상 응답은 그대로 지나가고, `toErrorResponse` 를 직접 부르면(옵션 없음) 예전처럼 기록한다', async () => {
  const spy = mock.method(console, 'error', () => undefined)
  try {
    const res = await withApi(async () => new Response('fine', { status: 201 }))(reqWith(abortedSignal()), undefined)
    assert.equal(res.status, 201)
    assert.equal(await res.text(), 'fine')
    assert.equal(spy.mock.callCount(), 0)
    const direct = toErrorResponse(abortedRead())
    assert.equal(direct.status, 500)
    assert.equal(spy.mock.callCount(), 1, '옵션이 없으면 기록 — SSE 등 다른 호출부 동작 불변')
    const quiet = toErrorResponse(abortedRead(), { clientGone: true })
    assert.equal(quiet.status, 500)
    assert.equal(spy.mock.callCount(), 1, 'clientGone 이면 기록하지 않지만 응답은 같다')
    assert.deepEqual(await quiet.json(), INTERNAL_BODY)
  } finally {
    spy.mock.restore()
  }
})
