import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { isDeepStrictEqual } from 'node:util'
import { extractJson } from '../json/extractJson'
import { repairRootClose } from '../json/repairRootClose'
import { extractAndValidate, JsonSchemaError, runJsonAnalysis, runJsonWithRetry, validateOutput, type AnalyzeResult, type JsonAttemptFn } from '../json/schemaValidate'
import type { LlmMessage } from '../adapters/llm/homeM4'

// task-037 — 루트 객체를 한 칸 일찍 닫는 JSON 구문 슬립(`…"proposals":[]},"userKo":"…"}`)의 좁은 복구.
// 입력은 전부 합성 문장이다(실사용자 대화·사람 이름 없음). 슬립의 **구조**만 task-036 REV-109 의 원자료 모양을 따른다.
//
// 이 파일이 증명하는 것: ① 슬립 합성 5건이 복구된다 ② 문자열 안 `},"`·루트 뒤 쓰레기 등은 복구하지 않는다(null)
// ③ **차분 퍼즈** — `extractJson` 이 성공하는 입력은 옵션을 켜도 옛 결과와 바이트 동일(복구 경로를 타지 않는다)
// ④ `runJsonWithRetry`·soft 경로에서 재시도 없이(attempts===1) 끝나고, 옵션 off 면 지금처럼 재시도한다.

const STYLES = ['NEUTRAL', 'ENCOURAGING', 'CALM', 'CHEERFUL'] as const

/** TALK 응답과 같은 모양의 로컬 스키마(엔진 층 테스트가 conversation 층을 import 하지 않게). `userKo` 는 선택·맨 끝. */
const TALK_LIKE = {
  type: 'object',
  additionalProperties: false,
  required: ['speech', 'conversation', 'correction', 'learning', 'endOfTopic', 'proposals'],
  properties: {
    speech: { type: 'object', additionalProperties: false, required: ['style'], properties: { style: { type: 'string', enum: [...STYLES] } } },
    conversation: {
      type: 'object',
      additionalProperties: false,
      required: ['replyJa', 'replyKo'],
      properties: { replyJa: { type: 'string', minLength: 1 }, replyKo: { type: 'string', minLength: 1 } },
    },
    correction: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['original', 'corrected', 'explanationKo'],
          properties: { original: { type: 'string', minLength: 1 }, corrected: { type: 'string', minLength: 1 }, explanationKo: { type: 'string', minLength: 1 } },
        },
      ],
    },
    learning: {
      type: 'object',
      additionalProperties: false,
      required: ['grammarPoint', 'difficulty'],
      properties: { grammarPoint: { anyOf: [{ type: 'null' }, { type: 'string' }] }, difficulty: { type: 'string', enum: ['N5', 'N4', 'N3', 'N2', 'N1'] } },
    },
    endOfTopic: { type: 'boolean' },
    proposals: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'payload'],
        properties: {
          kind: { type: 'string', enum: ['ADD_WORD'] },
          payload: {
            type: 'object',
            additionalProperties: false,
            required: ['surface', 'reading', 'meaning'],
            properties: { surface: { type: 'string', minLength: 1 }, reading: { type: 'string' }, meaning: { type: 'string', minLength: 1 } },
          },
        },
      },
    },
    userKo: { anyOf: [{ type: 'null' }, { type: 'string' }] },
  },
} as const

type Doc = Record<string, unknown>

const talkDoc = (over: Doc = {}): Doc => ({
  speech: { style: 'ENCOURAGING' },
  conversation: { replyJa: 'そうですか！どんな映画でしたか？', replyKo: '그렇군요! 어떤 영화였어요?' },
  correction: null,
  learning: { grammarPoint: '〜に行きました', difficulty: 'N5' },
  endOfTopic: false,
  proposals: [],
  ...over,
})

/** 슬립 모양 조립: 루트를 마지막 필드(proposals)에서 닫은 뒤 `,"userKo":…}` 를 잇는다. */
function slipOf(doc: Doc, userKo: string, o: { fence?: boolean; pretty?: boolean } = {}): string {
  const body = o.pretty ? JSON.stringify(doc, null, 2) : JSON.stringify(doc)
  const text = o.pretty ? `${body}\n  ,\n  "userKo": ${JSON.stringify(userKo)}\n}` : `${body},"userKo":${JSON.stringify(userKo)}}`
  return o.fence ? `\`\`\`json\n${text}\n\`\`\`` : text
}

const KO = '어제 영화를 봤어요.'

// ── (a) 슬립 합성 5건 ───────────────────────────────────────────────────────────────

const SLIPS: { name: string; raw: string; intended: Doc }[] = [
  { name: 'TALK 골격 + 코드펜스 + correction null', raw: slipOf(talkDoc(), KO, { fence: true }), intended: { ...talkDoc(), userKo: KO } },
  { name: '코드펜스 없음', raw: slipOf(talkDoc({ endOfTopic: true }), KO), intended: { ...talkDoc({ endOfTopic: true }), userKo: KO } },
  {
    name: '교정 있는 변형(설명 문자열 안에 `},"` 와 이스케이프 따옴표)',
    raw: slipOf(
      talkDoc({ correction: { original: '映画を見るました', corrected: '映画を見ました', explanationKo: '활용 오류 — 형태 `}," 기호` 와 \\ 역슬래시, "따옴표" 가 글자로 들어 있음' } }),
      '저는 영화를 봤어요.',
      { fence: true },
    ),
    intended: {
      ...talkDoc({ correction: { original: '映画を見るました', corrected: '映画を見ました', explanationKo: '활용 오류 — 형태 `}," 기호` 와 \\ 역슬래시, "따옴표" 가 글자로 들어 있음' } }),
      userKo: '저는 영화를 봤어요.',
    },
  },
  { name: '들여쓴 출력(루트 닫음과 다음 키 사이 줄바꿈·쉼표 줄)', raw: slipOf(talkDoc(), KO, { pretty: true }), intended: { ...talkDoc(), userKo: KO } },
  {
    name: 'proposals 가 비어 있지 않은 변형(중첩 배열·객체 뒤에서 닫힘)',
    raw: slipOf(talkDoc({ proposals: [{ kind: 'ADD_WORD', payload: { surface: '映画館', reading: 'えいがかん', meaning: '영화관' } }] }), KO, { fence: true }),
    intended: { ...talkDoc({ proposals: [{ kind: 'ADD_WORD', payload: { surface: '映画館', reading: 'えいがかん', meaning: '영화관' } }] }), userKo: KO },
  },
]

test('슬립 합성 5건: 옛 경로(extractJson)는 실패하고, repairRootClose 는 `}` 하나만 지운 문자열을 돌려주며 userKo 가 루트 키가 된다', () => {
  assert.equal(SLIPS.length, 5)
  for (const s of SLIPS) {
    assert.throws(() => extractJson(s.raw), `${s.name}: 입력이 실제 구문 슬립이어야 한다(옛 경로 실패)`)
    const fixed = repairRootClose(s.raw)
    assert.notEqual(fixed, null, s.name)
    const cleaned = s.raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
    assert.equal(fixed!.length, cleaned.length - 1, `${s.name}: 한 글자만 줄어든다`)
    const obj = JSON.parse(fixed!) as Doc
    assert.deepEqual(obj, s.intended, s.name)
    assert.ok('userKo' in obj && !('userKo' in (obj.conversation as Doc)), `${s.name}: userKo 는 루트 키`)
    assert.equal(repairRootClose(fixed!), null, `${s.name}: 복구본은 다시 복구되지 않는다(호출당 한 번)`)

    const on = extractAndValidate(s.raw, TALK_LIKE, { repairRootClose: true })
    assert.deepEqual(on, { ok: true, data: s.intended, repaired: 'ROOT_CLOSE' }, s.name)
    assert.deepEqual(extractAndValidate(s.raw, TALK_LIKE), { ok: false, parseError: true }, `${s.name}: 옵션 off(기본)면 지금처럼 파싱 실패`)
    assert.deepEqual(extractAndValidate(s.raw, TALK_LIKE, { repairRootClose: false }), { ok: false, parseError: true })
  }
})

// ── (b) 음성: 복구하지 않는 모양 ─────────────────────────────────────────────────────

test('음성: 문자열 안 `},"`·루트 뒤 쓰레기·두 번 닫힘·배열 루트·빈 입력·이미 정상 → null', () => {
  const nulls: [string, string][] = [
    ['문자열 안 `},"` 만 있고 슬립이 아님(문자열이 닫히지 않음)', '{"a":"x},"b":1}'],
    ['문자열 값 끝이 `},` 인 정상 JSON(`},"` 가 글자로 나옴)', '{"a":"x},","b":"y"}'],
    ['문자열 안 `},"` 가 이스케이프 따옴표와 함께 있는 정상 JSON', '{"a":"x},\\"y","b":2}'],
    ['루트 뒤 `}` 한 개 더', '{"a":1}}'],
    ['루트 둘(쉼표로 이음)', '{"a":1},{"b":2}'],
    ['루트가 닫히고 키만 오고 닫는 `}` 없음', '{"a":1},"b"'],
    ['키-값은 있으나 루트를 닫지 않음', '{"a":1},"b":2'],
    ['두 번 닫힘(중간 `}` 뒤에 키가 또 이어지고 끝에서 닫힘)', '{"a":1},"b":2},"c":3}'],
    ['끝에 `}` 가 하나 더', '{"a":1},"b":2}}'],
    ['슬립 뒤 쓰레기 문장', '{"a":1},"b":2}\n설명입니다.'],
    ['서문이 앞에 붙은 슬립(첫 글자가 `{` 가 아님)', '답변입니다: {"a":1},"b":2}'],
    ['배열 루트 안의 객체 뒤 문자열', '[{"a":1},"b"]'],
    ['배열 루트(정상)', '[{"a":1}]'],
    ['배열 루트 안 슬립 모양', '[{"a":1},"b":2}]'],
    ['괄호 짝 불일치', '{"a":[1}],"b":2}'],
    ['루트 뒤에 키가 아닌 것', '{"a":1},123}'],
    ['루트 뒤 쉼표 다음이 객체', '{"a":1},{"b":2}}'],
    ['빈 문자열', ''],
    ['공백뿐', '  \n\t '],
    ['JSON 아님', 'はい、そうですね。'],
    ['여는 괄호만', '{'],
    ['닫는 괄호만', '}'],
    ['빈 객체', '{}'],
    ['닫히지 않는 문자열', '{"a":"x'],
    ['중첩 깊은 정상 JSON', '{"a":{"b":{"c":[1,2,{"d":{"e":[[],[{}]]}}]}},"f":"g"}'],
    ['정상 JSON + 코드펜스', '```json\n{"a":1,"b":{"c":[1,2]}}\n```'],
    ['정상 JSON(들여쓰기)', JSON.stringify({ a: 1, b: [1, { c: 2 }] }, null, 2)],
    ['문자열 값 안에 슬립 모양 텍스트가 든 정상 JSON', JSON.stringify({ a: '{"x":1},"y":2}', b: 1 })],
    ['문자열 안 `},"` 뒤에 진짜 닫힘 하나(정상)', '{"a":"p},\\"q","b":{"c":"}"}}'],
  ]
  for (const [name, raw] of nulls) assert.equal(repairRootClose(raw), null, name)

  // 문자열 안 `},"` 는 건드리지 않는다 — 진짜 슬립과 같이 있어도 지워지는 `}` 는 문자열 밖의 것 하나다.
  const tricky = '{"a":"x},\\"y","b":{"c":"}"}},"d":"e},\\"f"}'
  const fixed = repairRootClose(tricky)
  assert.equal(fixed, '{"a":"x},\\"y","b":{"c":"}"},"d":"e},\\"f"}')
  assert.deepEqual(JSON.parse(fixed!), { a: 'x},"y', b: { c: '}' }, d: 'e},"f' })
})

test('복구 후에도 ajv·extraCheck 는 그대로 엄격하다: 복구본이 스키마를 어기면 위반 결과(재시도 경로)이고 우회하지 않는다', () => {
  const badStyle = slipOf(talkDoc({ speech: { style: 'LOUD' } }), KO)
  const r = extractAndValidate(badStyle, TALK_LIKE, { repairRootClose: true })
  assert.equal(r.ok, false)
  assert.ok(!r.ok && !r.parseError && r.violations.some((v) => v.includes('/speech/style')), JSON.stringify(r))
  const direct = validateOutput({ ...talkDoc({ speech: { style: 'LOUD' } }), userKo: KO }, TALK_LIKE)
  assert.deepEqual(r, { ok: false, parseError: false, violations: direct.ok ? [] : direct.violations }, '복구 객체의 위반 = 같은 객체를 직접 검증한 위반')

  const extraField = slipOf(talkDoc({ surprise: 1 }), KO)
  const r2 = extractAndValidate(extraField, TALK_LIKE, { repairRootClose: true })
  assert.ok(!r2.ok && !r2.parseError && r2.violations.some((v) => v.includes('허용되지 않은 필드')), JSON.stringify(r2))

  const missing = slipOf({ speech: { style: 'CALM' } }, KO)
  const r3 = extractAndValidate(missing, TALK_LIKE, { repairRootClose: true })
  assert.ok(!r3.ok && !r3.parseError && r3.violations.some((v) => v.includes('필수 필드')), JSON.stringify(r3))
})

test('복구본이 JSON.parse 를 못 통과하면(문자열 안 원본 개행 등) 옛 parseError 와 같다 — 복구가 새 실패 모양을 만들지 않는다', () => {
  const raw = '{"a":"줄\n바꿈"},"b":2}'
  assert.notEqual(repairRootClose(raw), null)
  assert.deepEqual(extractAndValidate(raw, { type: 'object' }, { repairRootClose: true }), { ok: false, parseError: true })
})

test('repairRootClose + stripAdditionalProperties 는 함께 켤 수 있다 — 복구한 객체에도 같은 순서(파싱 → strip → ajv)가 적용된다', () => {
  const raw = slipOf(talkDoc({ conversation: { replyJa: 'はい。', replyKo: '네.', extraKey: 'x' } }), KO)
  const strictOnly = extractAndValidate(raw, TALK_LIKE, { repairRootClose: true })
  assert.equal(strictOnly.ok, false)
  const both = extractAndValidate(raw, TALK_LIKE, { repairRootClose: true, stripAdditionalProperties: true })
  assert.equal(both.ok, true)
  assert.ok(both.ok && both.repaired === 'ROOT_CLOSE' && !('extraKey' in (both.data as { conversation: Doc }).conversation), JSON.stringify(both))
})

// ── (c) 차분 퍼즈 ───────────────────────────────────────────────────────────────────

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 구조 문자·이스케이프 대상·유니코드(서로게이트 쌍 포함)·`},` 로 끝나는 조각(→ 닫는 따옴표와 만나 `},"` 가 글자로 나온다). */
const POOL = ['a', 'b', 'z', '0', '9', ' ', '"', '\\', '{', '}', '[', ']', ',', ':', '\n', '\t', '日', '本', '語', 'ひ', 'ガ', '😀', 'é', '/', '},', '","', '\\"', '"}', '{"', '],', ' ', '\u0001']

type Rand = () => number
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const int = (r: Rand, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1))

function nasty(r: Rand, min = 0, max = 8): string {
  let s = ''
  for (let n = int(r, min, max); n > 0; n--) s += pick(r, POOL)
  return s
}

function genValue(r: Rand, depth: number): unknown {
  const k = int(r, 0, depth <= 0 ? 4 : 7)
  switch (k) {
    case 0:
      return null
    case 1:
      return r() < 0.5
    case 2:
      return Math.round((r() - 0.5) * 1e6) / (r() < 0.5 ? 1 : 100)
    case 3:
    case 4:
      return nasty(r)
    case 5:
    case 6:
      return Array.from({ length: int(r, 0, 3) }, () => genValue(r, depth - 1))
    default:
      return genObject(r, depth - 1, 0)
  }
}

function genObject(r: Rand, depth: number, minKeys: number): Doc {
  const o: Doc = {}
  for (let n = int(r, minKeys, minKeys + 4), i = 0; i < n; i++) {
    const key = r() < 0.7 ? `k${i}` : nasty(r, 1, 5)
    if (key === '__proto__') continue
    o[key] = genValue(r, depth)
  }
  return o
}

function genTalkDoc(r: Rand): Doc {
  const text = () => nasty(r, 1, 20)
  return {
    speech: { style: pick(r, STYLES) },
    conversation: { replyJa: text(), replyKo: text() },
    correction: r() < 0.5 ? null : { original: text(), corrected: text(), explanationKo: text() },
    learning: { grammarPoint: r() < 0.5 ? null : text(), difficulty: pick(r, ['N5', 'N4', 'N3'] as const) },
    endOfTopic: r() < 0.5,
    proposals: r() < 0.7 ? [] : [{ kind: 'ADD_WORD', payload: { surface: text(), reading: nasty(r), meaning: text() } }],
  }
}

const STRUCT = ['{', '}', '[', ']', '"', ',', ':', '\\', ' ']
function mutate(text: string, r: Rand): string {
  let t = text
  for (let n = int(r, 1, 3); n > 0 && t.length > 0; n--) {
    const i = int(r, 0, t.length - 1)
    switch (int(r, 0, 7)) {
      case 0:
        t = t.slice(0, i) + t.slice(i + 1)
        break
      case 1:
        t = t.slice(0, i) + pick(r, STRUCT) + t.slice(i)
        break
      case 2:
        t = t.slice(0, i) + t[i] + t.slice(i)
        break
      case 3:
        if (i + 1 < t.length) t = t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2)
        break
      case 4:
        t = t.slice(0, Math.max(1, i))
        break
      case 5: {
        const idx = [...t].flatMap((c, j) => (c === '{' || c === '}' || c === ',' ? [j] : []))
        if (idx.length > 0) {
          const j = pick(r, idx)
          t = t.slice(0, j) + t.slice(j + 1)
        }
        break
      }
      case 6:
        t = t.slice(0, i) + '}' + t.slice(i)
        break
      default:
        t = t.slice(0, i) + pick(r, STRUCT) + t.slice(i + 1)
    }
  }
  return t
}

const FENCE_OPEN = ['```json\n', '```\n', '```JSON\n', '']
const WRAP_PRE = ['', '', '네, 알겠습니다.\n', '답변: ']
const WRAP_POST = ['', '', '\n```', '\n\n이상입니다.']

/** task-037 전의 `extractAndValidate`(strip 미사용 경로) 복사본 — 차분 퍼즈의 기준. 이 함수는 수정하지 않는다. */
function legacyExtractAndValidate(raw: string, schema: object): AnalyzeResult {
  let parsed: unknown
  try {
    parsed = extractJson(raw)
  } catch {
    return { ok: false, parseError: true }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, parseError: true }
  const result = validateOutput(parsed, schema)
  if (result.ok) return { ok: true, data: parsed }
  return { ok: false, parseError: false, violations: result.violations }
}

const OPEN = { type: 'object' } as const
const STRICT = { type: 'object', additionalProperties: false, required: ['k0'], properties: { k0: { type: 'string' }, k1: { type: 'number' } } } as const
const SCHEMAS = [OPEN, STRICT, TALK_LIKE] as const

const FUZZ_N = 120_000

/** 퍼즈 안쪽 루프용 — 통과할 때 메시지 문자열(입력 JSON.stringify 등)을 만들지 않는다(12만 × 3 스키마에서 수십 초가 걸렸다). */
function must(cond: unknown, msg: () => string): asserts cond {
  if (!cond) assert.fail(msg())
}
function mustEqual(actual: unknown, expected: unknown, msg: () => string): void {
  if (!isDeepStrictEqual(actual, expected)) assert.fail(`${msg()}\n  actual=${JSON.stringify(actual)}\n  expected=${JSON.stringify(expected)}`)
}
function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

test(`차분 퍼즈 N=${FUZZ_N}: extractJson 이 성공하는 입력은 옵션 on 도 옛 결과와 동일(복구 미호출), 복구가 나오면 항상 루트 조기 닫힘 모양, 예외·무한 루프 없음`, () => {
  // 파싱 실패 예외를 수십만 번 만든다 — 스택 수집만 꺼도 몇 배 빨라진다(테스트 끝에 원복).
  const prevLimit = Error.stackTraceLimit
  Error.stackTraceLimit = 0
  try {
    fuzz()
  } finally {
    Error.stackTraceLimit = prevLimit
  }
})

function fuzz(): void {
  const r = rng(0x5eed037)
  const stats = {
    texts: 0,
    extractOk: 0,
    notRepaired: 0,
    repairedOk: 0,
    repairedViolation: 0,
    constructedSlips: 0,
    repairNonNullButUnparsable: 0,
  }
  const started = Date.now()

  for (let n = 0; n < FUZZ_N; n++) {
    // ── 텍스트 생성 ──
    let text: string
    let intended: Doc | null = null // 슬립을 "조립"한 경우만: 복구가 되살려야 하는 원 객체
    const fam = r()
    if (fam < 0.2) {
      text = JSON.stringify(genObject(r, 3, 0))
    } else if (fam < 0.27) {
      text = JSON.stringify(genObject(r, 3, 1), null, int(r, 1, 4))
    } else if (fam < 0.32) {
      text = JSON.stringify(pick(r, [[genObject(r, 2, 0)], 'x', 12, null, true, [], [1, 'a']]))
    } else if (fam < 0.42) {
      text = pick(r, WRAP_PRE) + pick(r, FENCE_OPEN) + JSON.stringify(genObject(r, 3, 0)) + pick(r, WRAP_POST)
    } else if (fam < 0.58) {
      // 슬립 조립(일반 객체): 키를 앞 k 개 / 나머지로 나눠 앞부분을 닫고 쉼표로 잇는다.
      const doc = genObject(r, 3, 2)
      const keys = Object.keys(doc)
      const k = int(r, 1, keys.length - 1)
      const first: Doc = {}
      const rest: Doc = {}
      keys.forEach((key, i) => ((i < k ? first : rest)[key] = doc[key]))
      const sep = pick(r, [',', ' ,', ',\n  ', '\n,', ' , '])
      const body = JSON.stringify(first) + sep + JSON.stringify(rest).slice(1)
      const fenceOpen = pick(r, FENCE_OPEN)
      text = fenceOpen + body + (fenceOpen ? '\n```' : '')
      intended = doc
    } else if (fam < 0.7) {
      // 슬립 조립(TALK 모양): `…proposals:[]},"userKo":"…"}`
      const doc = genTalkDoc(r)
      const ko = nasty(r, 0, 12)
      text = slipOf(doc, ko, { fence: r() < 0.5, pretty: r() < 0.2 })
      intended = { ...doc, userKo: ko }
    } else {
      // 변이: 정상·슬립 텍스트를 1~3 군데 망가뜨린다.
      const src = r() < 0.4 ? slipOf(genTalkDoc(r), nasty(r, 0, 6), { fence: r() < 0.5 }) : JSON.stringify(genObject(r, 3, 0), null, r() < 0.3 ? 2 : 0)
      text = mutate(src, r)
    }
    stats.texts++

    // ── 기준(옛 구현)과 새 구현 ──
    let ejOk = true
    try {
      extractJson(text)
    } catch {
      ejOk = false
    }
    const fixed = repairRootClose(text) // 예외를 던지면 이 테스트가 실패한다
    if (ejOk) {
      stats.extractOk++
      must(fixed === null, () => `extractJson 이 성공하는 입력에는 복구 후보가 없다: ${JSON.stringify(text)}`)
    }

    // 복구 문자열의 모양 검증(스키마와 무관 — 텍스트당 한 번). JSON.parse 를 오라클로 독립 검증한다.
    let fixedObj: Doc | null = null
    if (fixed !== null) {
      const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
      must(fixed.length === cleaned.length - 1, () => `복구본은 한 글자 짧다: ${JSON.stringify(text)}`)
      let p = 0
      while (p < fixed.length && fixed[p] === cleaned[p]) p++
      must(cleaned[p] === '}', () => `지워진 글자는 \`}\` 하나: ${JSON.stringify(text)}`)
      must(cleaned.slice(0, p) + cleaned.slice(p + 1) === fixed, () => `${JSON.stringify(text)}`)
      must(/^\s*,\s*"/.test(cleaned.slice(p + 1)), () => `루트가 닫힌 직후 쉼표+다음 키: ${JSON.stringify(text)}`)
      must(repairRootClose(fixed) === null, () => `복구본은 다시 복구되지 않는다: ${JSON.stringify(text)}`)
      if (parsesAsJson(fixed)) {
        fixedObj = JSON.parse(fixed) as Doc
        const prefixParsed: unknown = JSON.parse(cleaned.slice(0, p + 1)) // 지워진 `}` 까지가 그 자체로 완결된 JSON 객체여야 한다
        must(prefixParsed !== null && typeof prefixParsed === 'object' && !Array.isArray(prefixParsed), () => `${JSON.stringify(text)}`)
        must(!parsesAsJson(cleaned), () => `원문은 파싱이 안 된다(그래서 복구 후보): ${JSON.stringify(text)}`)
        if (intended) {
          mustEqual(fixedObj, intended, () => `조립한 슬립은 원 객체로 복구된다: ${JSON.stringify(text)}`)
          stats.constructedSlips++
        }
      } else {
        stats.repairNonNullButUnparsable++
      }
    }

    // 정상 입력은 세 스키마 모두(싸다), 파싱이 실패하는 입력은 텍스트마다 스키마 하나(예외 생성이 비싸다 — 12만 건 전체가 세 스키마를 다 겪는다).
    const schemas = ejOk ? [...SCHEMAS] : [SCHEMAS[n % SCHEMAS.length]]
    for (const schema of schemas) {
      const legacy = legacyExtractAndValidate(text, schema)
      const off = extractAndValidate(text, schema)
      const on = extractAndValidate(text, schema, { repairRootClose: true })
      mustEqual(off, legacy, () => `옵션 off 는 옛 결과와 동일: ${JSON.stringify(text)}`)
      if (ejOk) {
        mustEqual(on, legacy, () => `extractJson 성공 입력은 옵션 on 도 옛 결과와 동일: ${JSON.stringify(text)}`)
        must(!('repaired' in on), () => '복구 표식 없음')
        continue
      }
      if (fixedObj === null) {
        mustEqual(on, legacy, () => `복구할 수 없으면 옵션 on 도 옛 결과(parseError) 그대로: ${JSON.stringify(text)}`)
        stats.notRepaired++
        continue
      }
      const v = validateOutput(fixedObj, schema)
      if (v.ok) {
        mustEqual(on, { ok: true, data: fixedObj, repaired: 'ROOT_CLOSE' }, () => `복구 성공 결과 모양: ${JSON.stringify(text)}`)
        stats.repairedOk++
      } else {
        mustEqual(on, { ok: false, parseError: false, violations: v.violations }, () => `복구본의 위반은 직접 검증한 위반과 같다(검증 우회 없음): ${JSON.stringify(text)}`)
        stats.repairedViolation++
      }
    }
  }

  const ms = Date.now() - started
  // 퍼즈가 의미 있으려면 세 갈래(정상·복구 성공·복구 불가)와 "복구했지만 스키마 위반" 이 모두 충분히 나와야 한다.
  assert.ok(stats.extractOk > 20_000, `정상 입력이 충분해야 한다: ${JSON.stringify(stats)}`)
  assert.ok(stats.repairedOk > 5_000, `복구 성공이 충분해야 한다: ${JSON.stringify(stats)}`)
  assert.ok(stats.constructedSlips > 15_000, `조립한 슬립이 전부 복구돼야 한다: ${JSON.stringify(stats)}`)
  assert.ok(stats.notRepaired > 5_000, `변이로 깨진 입력(복구 불가)이 충분해야 한다: ${JSON.stringify(stats)}`)
  assert.ok(stats.repairedViolation > 5_000, `복구했지만 스키마를 어긴 경우가 충분해야 한다: ${JSON.stringify(stats)}`)
  assert.ok(ms < 60_000, `퍼즈가 너무 오래 걸린다(무한 루프 의심): ${ms}ms`)
  console.log(`[task-037 fuzz] ${JSON.stringify({ ...stats, ms })}`)
}

// ── (d) runJsonWithRetry · soft 경로 ────────────────────────────────────────────────

function scripted(raws: string[]): { attempt: JsonAttemptFn; calls: ({ hint: string; previousRaw: string } | null)[] } {
  const calls: ({ hint: string; previousRaw: string } | null)[] = []
  const attempt: JsonAttemptFn = async (retry) => {
    calls.push(retry)
    const next = raws[calls.length - 1]
    if (next === undefined) throw new Error('예상보다 많은 호출')
    return next
  }
  return { attempt, calls }
}

function captureWarn(t: { after: (fn: () => void) => void }): string[] {
  const lines: string[] = []
  mock.method(console, 'warn', (...a: unknown[]) => void lines.push(a.map(String).join(' ')))
  t.after(() => mock.restoreAll())
  return lines
}

const GOOD = JSON.stringify({ ...talkDoc(), userKo: KO })

test('runJsonWithRetry(옵션 on): 슬립 1차 응답 → 호출 1회·attempts===1·repaired===ROOT_CLOSE·로그 한 줄(내용 없음)', async (t) => {
  const warns = captureWarn(t)
  const { attempt, calls } = scripted([SLIPS[0].raw])
  const r = await runJsonWithRetry(attempt, { schema: TALK_LIKE, repairRootClose: true })
  assert.equal(r.attempts, 1)
  assert.equal(r.repaired, 'ROOT_CLOSE')
  assert.deepEqual(r.data, SLIPS[0].intended)
  assert.equal(calls.length, 1, '재시도 호출이 없다')
  assert.deepEqual(warns, ['[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략'])
  assert.ok(!warns.join('').includes('映画') && !warns.join('').includes('영화'), '응답·문장 내용은 로그에 없다')
})

test('runJsonWithRetry: 슬립 5건 전부 옵션 on 이면 재시도 없이, 옵션 off(기본)이면 지금처럼 재시도(2회 호출·attempts===2·repaired 키 없음)', async (t) => {
  captureWarn(t)
  for (const s of SLIPS) {
    const on = scripted([s.raw])
    const rOn = await runJsonWithRetry(on.attempt, { schema: TALK_LIKE, repairRootClose: true })
    assert.deepEqual([rOn.attempts, on.calls.length, rOn.repaired], [1, 1, 'ROOT_CLOSE'], s.name)

    const off = scripted([s.raw, GOOD])
    const rOff = await runJsonWithRetry(off.attempt, { schema: TALK_LIKE })
    assert.equal(rOff.attempts, 2, s.name)
    assert.equal(off.calls.length, 2)
    assert.ok(!('repaired' in rOff), s.name)
    assert.ok(off.calls[1]!.hint.includes('유효한 JSON을 찾지 못했다'), '옵션 off 의 재시도 사유는 JSON 파싱 실패(지금 동작 그대로)')

    const offExplicit = scripted([s.raw, GOOD])
    assert.equal((await runJsonWithRetry(offExplicit.attempt, { schema: TALK_LIKE, repairRootClose: false })).attempts, 2)
  }
})

test('runJsonWithRetry: 복구 후 ajv 위반이면 기존 위반 경로(재시도), extraCheck 위반도 같다 — 복구가 검증을 우회하지 않는다', async (t) => {
  const warns = captureWarn(t)
  const badStyle = scripted([slipOf(talkDoc({ speech: { style: 'LOUD' } }), KO), GOOD])
  const r = await runJsonWithRetry(badStyle.attempt, { schema: TALK_LIKE, repairRootClose: true })
  assert.equal(r.attempts, 2)
  assert.ok(!('repaired' in r), '재시도 응답은 정상 JSON 이라 복구 표식이 없다')
  assert.equal(badStyle.calls.length, 2)
  assert.ok(badStyle.calls[1]!.hint.includes('/speech/style'), '재시도 힌트는 복구 객체의 위반을 담는다')
  assert.ok(!warns.some((w) => w.includes('구문 슬립 복구')), '받아들이지 않은 복구는 로그에 세지 않는다')

  const extra = scripted([SLIPS[0].raw, GOOD])
  const r2 = await runJsonWithRetry(extra.attempt, { schema: TALK_LIKE, repairRootClose: true, extraCheck: (_d, info) => (info.attempt === 1 ? ['extraCheck 위반(테스트)'] : []) })
  assert.equal(r2.attempts, 2)
  assert.equal(extra.calls.length, 2)
  assert.ok(extra.calls[1]!.hint.includes('extraCheck 위반(테스트)'), '재시도 힌트에 extraCheck 위반이 담긴다')

  const both = scripted([slipOf(talkDoc({ speech: { style: 'LOUD' } }), KO), slipOf(talkDoc({ speech: { style: 'LOUD' } }), KO)])
  await assert.rejects(runJsonWithRetry(both.attempt, { schema: TALK_LIKE, repairRootClose: true }), JsonSchemaError)
  assert.equal(both.calls.length, 2, '재시도는 1회로 고정 — 복구가 이 상한을 바꾸지 않는다')
})

test('runJsonWithRetry: 2차 응답이 슬립이어도 옵션 on 이면 복구해 받아들인다(attempts===2·repaired)', async (t) => {
  const warns = captureWarn(t)
  const s = scripted(['이건 JSON 이 아니에요', SLIPS[1].raw])
  const r = await runJsonWithRetry(s.attempt, { schema: TALK_LIKE, repairRootClose: true })
  assert.deepEqual([r.attempts, r.repaired, s.calls.length], [2, 'ROOT_CLOSE', 2])
  assert.ok(warns.some((w) => w.startsWith('[json] 구문 슬립 복구(ROOT_CLOSE)')), `재시도 응답에서 복구하면 로그가 남는다: ${JSON.stringify(warns)}`)
})

test('runJsonWithRetry: 정상 1차 응답은 옵션 on 이어도 결과·로그가 같다(복구 경로 미호출)', async (t) => {
  const warns = captureWarn(t)
  const a = scripted([GOOD])
  const on = await runJsonWithRetry(a.attempt, { schema: TALK_LIKE, repairRootClose: true })
  const b = scripted([GOOD])
  const off = await runJsonWithRetry(b.attempt, { schema: TALK_LIKE })
  assert.deepStrictEqual(on, off)
  assert.deepEqual(on, { data: { ...talkDoc(), userKo: KO }, attempts: 1 })
  assert.deepEqual(warns, [])
})

test('soft 경로(TALK·CHAT 이 실제로 타는 길): 슬립 → 호출 1회·attempts===1·candidates 1개·repaired, 옵션 off 면 재시도', async (t) => {
  const warns = captureWarn(t)
  const on = scripted([SLIPS[2].raw])
  const r = await runJsonWithRetry(on.attempt, { schema: TALK_LIKE, softExtraCheck: true, repairRootClose: true })
  assert.deepEqual([r.attempts, on.calls.length, r.repaired, r.residualViolations, r.candidates?.length], [1, 1, 'ROOT_CLOSE', [], 1])
  assert.deepEqual(r.data, SLIPS[2].intended)
  assert.deepEqual(warns, ['[json] 구문 슬립 복구(ROOT_CLOSE) — 재시도 생략'])

  const off = scripted([SLIPS[2].raw, GOOD])
  const rOff = await runJsonWithRetry(off.attempt, { schema: TALK_LIKE, softExtraCheck: true })
  assert.equal(rOff.attempts, 2)
  assert.equal(off.calls.length, 2)
  assert.ok(!('repaired' in rOff), 'soft 옵션 off: repaired 키 없음')
})

test('soft 경로: 복구한 1차 응답에 extraCheck 위반이 있으면 재시도하고, 재시도도 실패하면 복구본(1차)으로 돌아간다 — repaired 는 data 의 출처를 따른다', async (t) => {
  captureWarn(t)
  const s = scripted([SLIPS[0].raw, '또 JSON 아님'])
  const r = await runJsonWithRetry(s.attempt, { schema: TALK_LIKE, softExtraCheck: true, repairRootClose: true, extraCheck: () => ['항목 위반(테스트)'] })
  assert.equal(r.attempts, 2)
  assert.equal(s.calls.length, 2)
  assert.deepEqual(r.data, SLIPS[0].intended, '스키마를 통과한 첫(복구) 응답으로 돌아간다')
  assert.deepEqual(r.residualViolations, ['항목 위반(테스트)'])
  assert.equal(r.repaired, 'ROOT_CLOSE')

  // 재시도 응답이 정상이면 data 는 그것이고 복구 표식은 없다.
  const s2 = scripted([SLIPS[0].raw, GOOD])
  const r2 = await runJsonWithRetry(s2.attempt, { schema: TALK_LIKE, softExtraCheck: true, repairRootClose: true, extraCheck: (_d, info) => (info.attempt === 1 ? ['항목 위반(테스트)'] : []) })
  assert.equal(r2.attempts, 2)
  assert.ok(!('repaired' in r2), '재시도 응답이 data 면 repaired 키 없음')
  assert.deepEqual(r2.residualViolations, [])
})

test('soft 경로: 복구본이 ajv 위반이면 기존 경로 — 재시도 후에도 위반이면 JsonSchemaError', async (t) => {
  captureWarn(t)
  const raw = slipOf(talkDoc({ endOfTopic: 'no' }), KO)
  const s = scripted([raw, raw])
  await assert.rejects(runJsonWithRetry(s.attempt, { schema: TALK_LIKE, softExtraCheck: true, repairRootClose: true }), JsonSchemaError)
  assert.equal(s.calls.length, 2)
})

// ── (e) REV-110 L-3 · L-4: 비문자열 입력 · runJsonAnalysis 옵션 전달 ─────────────────────

test('REV-110 L-3: 문자열이 아닌 입력(undefined·null·숫자·불리언·객체·배열)은 옵션 on/off 결과가 같다(parseError) — 복구 함수는 던지지 않고 null', () => {
  const inputs: unknown[] = [undefined, null, 0, 42, true, {}, { a: 1 }, ['a'], []]
  for (const x of inputs) {
    const label = `입력 ${typeof x}:${JSON.stringify(x)}`
    assert.equal(repairRootClose(x as never), null, `${label}: repairRootClose 는 null`)
    const off = extractAndValidate(x as never, { type: 'object' })
    const on = extractAndValidate(x as never, { type: 'object' }, { repairRootClose: true })
    assert.deepEqual(off, { ok: false, parseError: true }, `${label}: 옵션 off`)
    assert.deepEqual(on, off, `${label}: 옵션 on 도 같다(TypeError 가 새어 나오지 않는다)`)
  }
})

test('REV-110 L-4: runJsonAnalysis 는 repairRootClose 를 그대로 넘긴다 — true 면 슬립을 복구(호출 1회·repaired), 없음(undefined)·false 면 지금처럼 재시도(호출 2회·repaired 키 없음)', async (t) => {
  captureWarn(t)
  const messages: LlmMessage[] = [
    { role: 'system', content: 'SYS' },
    { role: 'user', content: 'U' },
  ]
  const run = async (repairRootCloseOpt: boolean | undefined) => {
    const raws = [SLIPS[0].raw, GOOD]
    let calls = 0
    const chatFn = async () => {
      const next = raws[calls++]
      if (next === undefined) throw new Error('예상보다 많은 호출')
      return next
    }
    const r = await runJsonAnalysis({ messages, schema: TALK_LIKE, chatFn, repairRootClose: repairRootCloseOpt })
    return { r, calls }
  }

  const on = await run(true)
  assert.equal(on.calls, 1, 'true: 재시도 호출이 없다')
  assert.equal(on.r.attempts, 1)
  assert.equal(on.r.repaired, 'ROOT_CLOSE')
  assert.deepEqual(on.r.data, SLIPS[0].intended)

  for (const opt of [undefined, false]) {
    const off = await run(opt)
    assert.equal(off.calls, 2, `${String(opt)}: 슬립을 복구하지 않고 재시도한다`)
    assert.equal(off.r.attempts, 2)
    assert.ok(!('repaired' in off.r), `${String(opt)}: repaired 키가 없다`)
  }
})
