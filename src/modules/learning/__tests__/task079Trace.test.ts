/**
 * task-079 IMP-0056 — A12 Trace 단계에 예문 null 통계(`exampleNulled` 개수 · `exampleNulledBy` 사유별)를 남긴다.
 * `dropped` 와 같은 방식: 고정 코드와 숫자만, 120자 이내, 단어·예문 원문 없음. 오프라인(가짜 엔진·가짜 driver).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runTopicWords, type TopicWordsAssembled, type TopicWordsDriver, type TopicWordsOutput } from '../vocab/topicSet'
import type { TraceRecord } from '@/modules/engine'

const U = 'cuser0000000000000000000u1'
const material = { topic: { id: 'ctopictrace0000000000000001', title: '카페 주문', titleJa: null, description: null, level: 'N4' as const }, chunkTexts: ['コーヒー'], chunkMeanings: ['커피'] }

const word = { textJa: '紅茶', reading: 'こうちゃ', meaningKo: '홍차', chunkType: 'NAME' as const, jlpt: null, exampleJa: null, exampleKo: null }

function driverOf(assembled: TopicWordsAssembled): TopicWordsDriver {
  return {
    promptVersion: 'topicWords@test',
    build: () => ({ task: 'topicWords', system: 's', messages: [{ role: 'user', content: 'u' }], jsonSchema: { type: 'object' } }),
    assemble: () => assembled,
  }
}

async function runWith(assembled: TopicWordsAssembled): Promise<TraceRecord> {
  const traces: TraceRecord[] = []
  const deps = { complete: async () => ({ data: { words: [] } as TopicWordsOutput }), trace: (t: TraceRecord) => void traces.push(t), now: () => Date.now() }
  const r = await runTopicWords(deps, { userId: U, material, targetCount: 5, priorSurfaces: [], driver: driverOf(assembled), deadlineAt: Date.now() + 30_000 })
  assert.equal(r.ok, true)
  assert.equal(traces.length, 1)
  return traces[0]
}

test('A12 Trace: 예문 null 개수와 사유별 개수가 단계에 남는다(dropped 와 같은 형식) · 원문은 없다', async () => {
  const t = await runWith({
    words: [word],
    received: 4,
    droppedByReason: { SURFACE_SIMPLIFIED: 2, JLPT_WINDOW: 1 },
    exampleNulled: 3,
    exampleNulledByReason: { EXAMPLE_MISSING: 2, EXAMPLE_JA_SIMPLIFIED: 1 },
  })
  const step = t.steps[0]
  assert.equal(step.name, 'A12')
  assert.equal(step.dropped, 'SURFACE_SIMPLIFIED=2,JLPT_WINDOW=1', '새 사유 코드가 dropped 에 그대로 나온다')
  assert.equal(step.exampleNulled, 3)
  assert.equal(step.exampleNulledBy, 'EXAMPLE_MISSING=2,EXAMPLE_JA_SIMPLIFIED=1')
  assert.ok(!JSON.stringify(t).includes('紅茶') && !JSON.stringify(t).includes('홍차'), 'Trace 에 단어 원문 없음')
})

test('A12 Trace: 예문이 전부 통과하면 개수 0 · 사유 칸은 null / 통계를 못 주는 driver(구형 모양)는 둘 다 null — 기존 칸은 그대로', async () => {
  const full = await runWith({ words: [word], received: 1, droppedByReason: {}, exampleNulled: 0, exampleNulledByReason: {} })
  assert.equal(full.steps[0].exampleNulled, 0)
  assert.equal(full.steps[0].exampleNulledBy, null)
  assert.equal(full.steps[0].dropped, null)
  const legacy = await runWith({ words: [word], received: 1 })
  assert.equal(legacy.steps[0].exampleNulled, null)
  assert.equal(legacy.steps[0].exampleNulledBy, null)
  // 기존 칸 보존
  for (const k of ['ms', 'lane', 'connection', 'model', 'attempts', 'promptChars', 'target', 'received', 'kept', 'dropped', 'promptVersion']) assert.ok(k in legacy.steps[0], `${k} 칸`)
  assert.equal(legacy.steps[0].kept, 1)
  assert.equal(legacy.steps[0].promptVersion, 'topicWords@test')
})

test('A12 Trace: 사유가 많아도 120자를 넘지 않는다(앞에서부터 자름)', async () => {
  const reasons = ['EXAMPLE_MISSING', 'EXAMPLE_TYPE', 'EXAMPLE_ENGINE_NAME', 'EXAMPLE_JA_LEN', 'EXAMPLE_JA_CHARS', 'EXAMPLE_JA_SIMPLIFIED', 'EXAMPLE_KO_LEN', 'EXAMPLE_KO_CHARS']
  const byReason = Object.fromEntries(reasons.map((k, i) => [k, i + 10]))
  const t = await runWith({ words: [word], received: 1, exampleNulled: 88, exampleNulledByReason: byReason })
  const by = String(t.steps[0].exampleNulledBy)
  assert.ok(by.length <= 120, `길이 ${by.length}`)
  assert.ok(by.startsWith('EXAMPLE_MISSING=10,EXAMPLE_TYPE=11'))
  assert.equal(t.steps[0].exampleNulled, 88, '개수는 숫자 칸이라 잘리지 않는다')
})
