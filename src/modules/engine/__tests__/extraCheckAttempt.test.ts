import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSON_MAX_ATTEMPTS, JsonSchemaError, runJsonWithRetry, type JsonAttemptFn, type JsonAttemptInfo } from '../json/schemaValidate'

// REV-032 M1 — runJsonWithRetry 가 extraCheck 에 "이 호출 안의 몇 번째 시도인지"를 넘긴다.

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: { items: { type: 'array', items: { type: 'string' } } },
}
type Out = { items: string[] }

function scripted(responses: string[]): JsonAttemptFn {
  let i = 0
  return async () => responses[i++]
}

function recorder(violate: (d: Out, info: JsonAttemptInfo) => boolean) {
  const seen: JsonAttemptInfo[] = []
  const extraCheck = (d: unknown, info: JsonAttemptInfo) => {
    seen.push(info)
    return violate(d as Out, info) ? ['위반'] : []
  }
  return { seen, extraCheck }
}

test('extraCheck 는 시도 번호와 최대 시도 수를 받는다(1차 위반 → 재시도)', async () => {
  const { seen, extraCheck } = recorder((d) => d.items.includes('bad'))
  const r = await runJsonWithRetry<Out>(scripted(['{"items":["bad"]}', '{"items":["ok"]}']), { schema, extraCheck })
  assert.equal(r.attempts, 2)
  assert.deepEqual(seen, [
    { attempt: 1, maxAttempts: JSON_MAX_ATTEMPTS },
    { attempt: 2, maxAttempts: JSON_MAX_ATTEMPTS },
  ])
})

test('1차가 ajv 단계에서 걸려 extraCheck 가 안 불려도 재시도는 attempt=2 로 불린다(번호가 밀리지 않는다)', async () => {
  const { seen, extraCheck } = recorder(() => false)
  const r = await runJsonWithRetry<Out>(scripted(['{"items":1}', '{"items":["ok"]}']), { schema, extraCheck })
  assert.equal(r.attempts, 2)
  assert.deepEqual(seen, [{ attempt: 2, maxAttempts: JSON_MAX_ATTEMPTS }])
})

test('마지막 시도에서만 통과시키는 검사는 2차에 통과한다 — 호출마다 번호가 1부터 다시 시작한다(폴백 connection 경계)', async () => {
  const lastOnly = (d: Out, info: JsonAttemptInfo) => d.items.includes('soft') && info.attempt < info.maxAttempts
  for (const round of [1, 2]) {
    const { seen, extraCheck } = recorder(lastOnly)
    const r = await runJsonWithRetry<Out>(scripted(['{"items":["soft"]}', '{"items":["soft"]}']), { schema, extraCheck })
    assert.equal(r.attempts, 2, `round ${round}: 1차는 강제, 2차에서 통과`)
    assert.deepEqual(seen.map((s) => s.attempt), [1, 2], `round ${round}: 이전 호출의 번호가 이어지지 않아야 한다`)
  }
})

test('softExtraCheck 경로도 같은 시도 정보를 넘긴다', async () => {
  const { seen, extraCheck } = recorder((d) => d.items.includes('bad'))
  const r = await runJsonWithRetry<Out>(scripted(['{"items":["bad"]}', '{"items":["bad"]}']), { schema, extraCheck, softExtraCheck: true })
  assert.deepEqual(r.residualViolations, ['위반'])
  assert.deepEqual(seen.map((s) => s.attempt), [1, 2])
})

test('인자를 받지 않는 기존 extraCheck 도 그대로 동작한다(하위 호환)', async () => {
  const legacy = (d: unknown) => ((d as Out).items.includes('bad') ? ['위반'] : [])
  await assert.rejects(runJsonWithRetry<Out>(scripted(['{"items":["bad"]}', '{"items":["bad"]}']), { schema, extraCheck: legacy }), JsonSchemaError)
  const r = await runJsonWithRetry<Out>(scripted(['{"items":["bad"]}', '{"items":["ok"]}']), { schema, extraCheck: legacy })
  assert.equal(r.attempts, 2)
})
