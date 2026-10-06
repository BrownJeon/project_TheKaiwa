import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractAndValidate, runJsonWithRetry } from '../json/schemaValidate'

// task-010 후속(2026-09-29, prompt-engineer) → task-019(요청 옵션 전환) — `stripAdditionalProperties` 를 켠 호출만 ajv
// 검증 직전에 **스키마 밖 키만** 결정적으로 지운다. 필수 필드는 절대 건드리지 않는다(required 키는 항상 `properties` 에도
// 있어 "추가" 취급되지 않는다) — 여기서는 LESSON 이 아니라 순수 제네릭 스키마로 그 규칙 자체를 검증한다
// (`conversation/__tests__/lesson.test.ts` 의 lesson@v7 절은 LESSON_SCHEMA·completeJson 으로 실제 사용례를 검증한다).

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

const STRIP = { stripAdditionalProperties: true }

test('옵션을 켜면: 최상위·배열 항목·중첩 객체 어디든 스키마 밖 키를 지우고 통과시킨다', () => {
  const raw = JSON.stringify({
    id: 'x1',
    note: null,
    extraTop: '스키마 밖',
    items: [{ a: '1', b: '2', extraItem: '스키마 밖' }],
    inner: { x: 'ok', extraInner: '스키마 밖' },
  })
  const result = extractAndValidate(raw, nestedSchema, STRIP)
  assert.equal(result.ok, true)
  if (!result.ok) return
  const data = result.data as Record<string, unknown>
  assert.ok(!('extraTop' in data))
  assert.ok(!('extraItem' in (data.items as Record<string, unknown>[])[0]))
  assert.ok(!('extraInner' in (data.inner as Record<string, unknown>)))
  assert.equal(data.id, 'x1')
  assert.deepEqual((data.items as { a: string; b: string }[])[0], { a: '1', b: '2' })
})

test('옵션을 켜지 않으면(기본·false): 같은 스키마여도 지금처럼 additionalProperties 위반으로 실패한다 — 다른 A 지점 동작 불변', () => {
  const raw = JSON.stringify({ id: 'x1', note: null, items: [], inner: { x: 'ok', extraInner: '스키마 밖' } })
  assert.equal(extractAndValidate(raw, nestedSchema).ok, false, '옵션 인자 없음')
  assert.equal(extractAndValidate(raw, nestedSchema, {}).ok, false, '빈 옵션')
  assert.equal(extractAndValidate(raw, nestedSchema, { stripAdditionalProperties: false }).ok, false, 'false')
})

test('필수 필드가 실제로 없으면(이름이 바뀐 경우) 스키마 밖 키를 지워도 여전히 실패한다 — 추측 매핑하지 않는다', () => {
  // note 대신 memo 를 보낸 경우 — memo 는 지워지지만 note 자리는 여전히 비어 있다.
  const raw = JSON.stringify({ id: 'x1', memo: '이건 note 가 아니다', items: [], inner: { x: 'ok' } })
  const result = extractAndValidate(raw, nestedSchema, STRIP)
  assert.equal(result.ok, false)
  if (result.ok || result.parseError) return
  assert.ok(result.violations.some((v) => v.includes('note')), `note 누락이 위반에 남아야 한다: ${JSON.stringify(result.violations)}`)
})

test('null 을 받는 anyOf 필드는 그대로 유지된다(anyOf 분기 선택이 타입을 안다)', () => {
  const raw = JSON.stringify({ id: 'x1', note: null, items: [], inner: { x: 'ok' } })
  const result = extractAndValidate(raw, nestedSchema, STRIP)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal((result.data as Record<string, unknown>).note, null)
})

test('제거 로그는 키 경로만 싣는다(값 없음)', (t) => {
  const lines: string[] = []
  mock.method(console, 'info', (...a: unknown[]) => void lines.push(a.map(String).join(' ')))
  t.after(() => mock.restoreAll())
  const raw = JSON.stringify({ id: 'x1', note: null, items: [{ a: '1', b: '2', secretish: '값-노출-금지' }], inner: { x: 'ok' } })
  assert.equal(extractAndValidate(raw, nestedSchema, STRIP).ok, true)
  assert.deepEqual(lines, ['[json] 스키마 밖 필드 제거: items/0/secretish'])
})

test('runJsonWithRetry: 옵션이 매 시도에 전달된다 — 켜면 1회, 끄면 위반 → 재시도 1회', async (t) => {
  mock.method(console, 'info', () => {})
  mock.method(console, 'warn', () => {})
  t.after(() => mock.restoreAll())
  const withExtra = JSON.stringify({ id: 'x1', note: null, items: [], inner: { x: 'ok', extra: 1 } })
  const clean = JSON.stringify({ id: 'x1', note: null, items: [], inner: { x: 'ok' } })

  let calls = 0
  const on = await runJsonWithRetry(async () => (++calls, withExtra), { schema: nestedSchema, stripAdditionalProperties: true })
  assert.equal(on.attempts, 1)
  assert.equal(calls, 1)

  calls = 0
  const off = await runJsonWithRetry(async (retry) => (++calls, retry ? clean : withExtra), { schema: nestedSchema })
  assert.equal(off.attempts, 2, '옵션이 없으면 지금처럼 재시도')
  assert.equal(calls, 2)

  // softExtraCheck 경로도 같은 옵션을 따른다.
  calls = 0
  const soft = await runJsonWithRetry(async () => (++calls, withExtra), { schema: nestedSchema, softExtraCheck: true, stripAdditionalProperties: true })
  assert.equal(soft.attempts, 1)
  assert.equal(calls, 1)
})

// task-042(A12 topicWords@v1) — 켜는 곳이 둘로 늘었다. 근거: ① 설계서 §4-3a 가 요구한다(lesson@v7 선례). ② 막는 실패가 비싸다 — 항목 20개 × 6필드 중 하나에 스키마 밖
// 키(예: `example`)가 붙으면 `additionalProperties:false` 위반으로 **응답 전체가 재시도**돼 사용자가 기다리는 [시작하기] 가 6~12s 늘어난다. ③ 키가 깨끗하면 아무 일도 하지
// 않고 필수 필드 이름이 바뀐 응답은 여전히 위반이다. ⚠ 실측(haiku 126호출, `tests/live/task042-topicwords-measure.ts`)에서는 지운 키가 0건이라 **효과는 측정으로 입증되지
// 않았다** — 예방 보험이다. 효과가 끝내 0 이면 이 목록에서 빼도 된다(그때 이 주석·`topicWords.ts` 의 한 줄을 함께 고친다).
test('stripAdditionalProperties 를 켜는 프로덕션 코드는 A4 lesson·A12 topicWords 요청 빌더 둘뿐이다(다른 A 지점 불변)', () => {
  const modulesRoot = join(process.cwd(), 'src', 'modules')
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p)
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        // 주석(설명 문구의 `stripAdditionalProperties: true`)은 빼고 코드만 본다.
        const code = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
        if (/stripAdditionalProperties\s*:\s*true/.test(code)) offenders.push(p.slice(modulesRoot.length + 1))
      }
    }
  }
  walk(modulesRoot)
  assert.deepEqual(offenders.sort(), ['conversation/prompts/lesson.ts', 'conversation/prompts/topicWords.ts'])
})
