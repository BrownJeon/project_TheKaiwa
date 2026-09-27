import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JsonSchemaError, runJsonWithRetry, type JsonAttemptFn } from '../json/schemaValidate'
import { newTraceId } from '../trace'

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: { items: { type: 'array', items: { type: 'string' } } },
}
type Out = { items: string[] }
/** 'bad' 가 들어 있으면 위반(항목별 후검증 흉내). */
const extraCheck = (d: unknown) => (d as Out).items.filter((x) => x.startsWith('bad')).map((x) => `${x} 위반`)

function scripted(responses: (string | Error)[]): { fn: JsonAttemptFn; calls: () => number } {
  let i = 0
  return {
    fn: async () => {
      const r = responses[i++]
      if (r instanceof Error) throw r
      return r
    },
    calls: () => i,
  }
}

test('기존 동작 불변: softExtraCheck 없으면 재시도 뒤에도 남은 extraCheck 위반은 JsonSchemaError', async () => {
  const s = scripted(['{"items":["ok","bad1"]}', '{"items":["ok","bad2"]}'])
  await assert.rejects(runJsonWithRetry<Out>(s.fn, { schema, extraCheck }), JsonSchemaError)
  assert.equal(s.calls(), 2)
})

test('기존 동작 불변: 1차 통과면 1회, 2차 통과면 2회 — 결과에 soft 전용 필드 없음', async () => {
  const a = await runJsonWithRetry<Out>(scripted(['{"items":["ok"]}']).fn, { schema, extraCheck })
  assert.deepEqual(a, { data: { items: ['ok'] }, attempts: 1 })
  const b = await runJsonWithRetry<Out>(scripted(['{"items":["bad"]}', '{"items":["ok"]}']).fn, { schema, extraCheck })
  assert.deepEqual(b, { data: { items: ['ok'] }, attempts: 2 })
})

test('D11 soft: 재시도는 1회뿐, 남은 위반은 던지지 않고 residualViolations·candidates 로 돌려준다', async () => {
  const s = scripted(['{"items":["ok1","bad1"]}', '{"items":["ok1","bad2","ok2"]}', 'never'])
  const r = await runJsonWithRetry<Out>(s.fn, { schema, extraCheck, softExtraCheck: true })
  assert.equal(s.calls(), 2)
  assert.equal(r.attempts, 2)
  assert.deepEqual(r.data.items, ['ok1', 'bad2', 'ok2'])
  assert.deepEqual(r.residualViolations, ['bad2 위반'])
  assert.equal(r.candidates?.length, 2)
  assert.deepEqual(r.candidates?.[0].items, ['ok1', 'bad1'])
})

test('D11 soft: 1차가 깨끗하면 재시도 없음', async () => {
  const s = scripted(['{"items":["ok"]}'])
  const r = await runJsonWithRetry<Out>(s.fn, { schema, extraCheck, softExtraCheck: true })
  assert.equal(s.calls(), 1)
  assert.deepEqual(r.residualViolations, [])
  assert.equal(r.candidates?.length, 1)
})

test('D11 soft: 재시도 호출이 실패하거나 스키마를 어기면 1차 응답으로 돌아간다(정상 항목 유실 없음)', async () => {
  const timeout = scripted(['{"items":["ok","bad"]}', new Error('timeout')])
  const r1 = await runJsonWithRetry<Out>(timeout.fn, { schema, extraCheck, softExtraCheck: true })
  assert.deepEqual(r1.data.items, ['ok', 'bad'])
  assert.deepEqual(r1.residualViolations, ['bad 위반'])
  const broken = scripted(['{"items":["ok","bad"]}', '{"items":"not-array"}'])
  const r2 = await runJsonWithRetry<Out>(broken.fn, { schema, extraCheck, softExtraCheck: true })
  assert.deepEqual(r2.data.items, ['ok', 'bad'])
})

test('D11 soft: 스키마·파싱 위반은 기존처럼 1회 재시도 후 JsonSchemaError', async () => {
  await assert.rejects(runJsonWithRetry<Out>(scripted(['nope', '{"items":1}']).fn, { schema, extraCheck, softExtraCheck: true }), JsonSchemaError)
  const r = await runJsonWithRetry<Out>(scripted(['nope', '{"items":["ok","bad"]}']).fn, { schema, extraCheck, softExtraCheck: true })
  assert.deepEqual(r.residualViolations, ['bad 위반'])
  assert.equal(r.candidates?.length, 1, '1차가 스키마를 못 넘었으면 후보는 2차 하나')
})

test('traceId: t_ + base62 20자 = 22자, 매번 다르다', () => {
  const a = newTraceId()
  assert.match(a, /^t_[0-9A-Za-z]{20}$/)
  assert.equal(a.length, 22)
  assert.notEqual(a, newTraceId())
})
