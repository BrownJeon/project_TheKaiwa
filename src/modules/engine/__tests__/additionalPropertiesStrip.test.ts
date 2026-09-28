import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enableAdditionalPropertiesStrip, extractAndValidate } from '../json/schemaValidate'

// task-010 후속(2026-09-29, prompt-engineer) — `enableAdditionalPropertiesStrip` 은 등록된 스키마에 한해 ajv
// 검증 직전에 **스키마 밖 키만** 결정적으로 지운다. 필수 필드는 절대 건드리지 않는다(required 키는 항상
// `properties` 에도 있어 "추가" 취급되지 않는다) — 여기서는 LESSON 이 아니라 순수 제네릭 스키마로 그 규칙 자체를
// 검증한다(`conversation/__tests__/lesson.test.ts` 의 lesson@v7 절은 LESSON_SCHEMA 로 실제 사용례를 검증한다).

const nestedSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'note', 'items', 'inner'],
  properties: {
    id: { type: 'string' },
    note: { anyOf: [{ type: 'null' }, { type: 'string' }] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['a', 'b'],
        properties: { a: { type: 'string' }, b: { type: 'string' } },
      },
    },
    inner: {
      type: 'object',
      additionalProperties: false,
      required: ['x'],
      properties: { x: { type: 'string' } },
    },
  },
} as const
enableAdditionalPropertiesStrip(nestedSchema)

// 등록하지 않은 비교용 스키마(구조는 같다) — 등록 여부만 다르다.
const unregisteredSchema = JSON.parse(JSON.stringify(nestedSchema))

test('등록된 스키마: 최상위·배열 항목·중첩 객체 어디든 스키마 밖 키를 지우고 통과시킨다', () => {
  const raw = JSON.stringify({
    id: 'x1',
    note: null,
    extraTop: '스키마 밖',
    items: [{ a: '1', b: '2', extraItem: '스키마 밖' }],
    inner: { x: 'ok', extraInner: '스키마 밖' },
  })
  const result = extractAndValidate(raw, nestedSchema)
  assert.equal(result.ok, true)
  if (!result.ok) return
  const data = result.data as Record<string, unknown>
  assert.ok(!('extraTop' in data))
  assert.ok(!('extraItem' in (data.items as Record<string, unknown>[])[0]))
  assert.ok(!('extraInner' in (data.inner as Record<string, unknown>)))
  assert.equal(data.id, 'x1')
  assert.deepEqual((data.items as { a: string; b: string }[])[0], { a: '1', b: '2' })
})

test('등록되지 않은 스키마(같은 구조): 지금처럼 additionalProperties 위반으로 실패한다 — 동작이 그대로다', () => {
  const raw = JSON.stringify({ id: 'x1', note: null, items: [], inner: { x: 'ok', extraInner: '스키마 밖' } })
  const result = extractAndValidate(raw, unregisteredSchema)
  assert.equal(result.ok, false, '등록하지 않은 스키마는 그대로 위반으로 잡혀야 한다(다른 A 지점 동작 불변)')
})

test('필수 필드가 실제로 없으면(이름이 바뀐 경우) 스키마 밖 키를 지워도 여전히 실패한다 — 추측 매핑하지 않는다', () => {
  // note 대신 memo 를 보낸 경우 — memo 는 지워지지만 note 자리는 여전히 비어 있다.
  const raw = JSON.stringify({ id: 'x1', memo: '이건 note 가 아니다', items: [], inner: { x: 'ok' } })
  const result = extractAndValidate(raw, nestedSchema)
  assert.equal(result.ok, false)
  if (result.ok || result.parseError) return
  assert.ok(result.violations.some((v) => v.includes('note')), `note 누락이 위반에 남아야 한다: ${JSON.stringify(result.violations)}`)
})

test('null 을 받는 anyOf 필드는 그대로 유지된다(anyOf 분기 선택이 타입을 안다)', () => {
  const raw = JSON.stringify({ id: 'x1', note: null, items: [], inner: { x: 'ok' } })
  const result = extractAndValidate(raw, nestedSchema)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal((result.data as Record<string, unknown>).note, null)
})
