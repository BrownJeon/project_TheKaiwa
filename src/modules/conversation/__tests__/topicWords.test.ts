/**
 * task-042 A12 `topicWords` 오프라인 회귀 — 요청 빌더·스키마·항목 검사(①~⑦)·장수 판정·제외 목록 상한·입력 주입 방어·시드 정답 대조.
 * task-049(v2): 단어마다 예문 `exampleJa`·`exampleKo` — 스키마 8키, 예문 검사(`checkTopicExample`)는 **예문만 null 로 만들고 단어는 버리지 않는다**.
 * 픽스처 `tests/prompts/fixtures/topic-words.json`(합성: 시드 5주제 × 수준 × 제외 목록 크기 + 이상 응답 17건 — v2 항목 모양으로 갱신, 기대값 불변)
 * · `topic-words-examples.json`(예문 28쌍 + 응답 8건). LLM 호출 없음.
 * task-078(v3): 시스템 프롬프트에 난이도 지시만 더함(+317자) — 스키마·검사·입력 블록 불변이라 길이 상한만 그만큼 올렸다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { llm } from '../../engine'
import { renderTranscript } from '../../engine/llm'
import { extractAndValidate, validateOutput, withJsonOnly } from '../../engine/json/schemaValidate'
import { normalizeRefText } from '../../learning/repetition'
import { levelWindow } from '../../learning/topics'
import {
  assembleTopicWords,
  buildTopicWordsExcludeLine,
  buildTopicWordsRequest,
  classifyTopicWordsResult,
  normalizeTopicWordKey,
  checkTopicExample,
  readingMatchesSurface,
  toHiragana,
  TOPIC_WORDS_EXAMPLE_JA_MAX,
  TOPIC_WORDS_EXAMPLE_KO_MAX,
  TOPIC_WORDS_EXCLUDE_MAX_CHARS,
  TOPIC_WORDS_EXCLUDE_MAX_ITEMS,
  TOPIC_WORDS_FOCUS,
  TOPIC_WORDS_PROMPT_VERSION,
  TOPIC_WORDS_SCHEMA,
  TOPIC_WORDS_SYSTEM_CHARS,
  TOPIC_WORDS_TASK,
  topicWordsLevelWindow,
  topicWordsRequestCount,
  TopicWordsInputError,
  type TopicExampleDropReason,
  type TopicWordDropReason,
  type TopicWordsResponse,
} from '../prompts/topicWords'
import type { JlptLevel } from '../structuredResponse/schemas'

interface FxChunk { textJa: string; reading: string; meaningKo: string; chunkType: string }
interface FxTopic { key: string; title: string; titleJa: string; description: string; level: JlptLevel; chunks: FxChunk[] }
interface FxCase {
  id: string
  topic: string
  level: string
  target: number
  title?: string
  titleJa?: string
  description?: string
  exclude: { base: boolean; prior: number }
  raw?: string[]
  expect: { count?: number; excludeSent?: number; truncated?: number | 'gt0'; excludeCharsMax?: number; inputLines?: number; noBracketInDescription?: boolean; titleMaxChars?: number; descMaxChars?: number; lineEquals?: string; error?: string }
}
interface FxResponse {
  id: string
  note: string
  topic: string
  level: JlptLevel
  target: number
  excludeMeanings?: string[]
  response: unknown
  expect: { schema: boolean; schemaWithStrip?: boolean; jlptNull?: number; kept?: number; dropped?: Partial<Record<TopicWordDropReason, number>>; classify?: { source: string; reason: string | null; fill: number } }
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/topic-words.json'), 'utf8')) as { topics: FxTopic[]; cases: FxCase[]; responses: FxResponse[] }
const topicOf = (key: string) => fixture.topics.find((t) => t.key === key)
interface FxExamplePair { id: string; note: string; input: { ja?: unknown; ko?: unknown; omit?: boolean }; expect: { reason: TopicExampleDropReason | null } }
interface FxExampleResponse {
  id: string
  note: string
  level: JlptLevel
  target: number
  response: unknown
  expect: { schema: boolean; schemaWithStrip?: boolean; kept: number; dropped: Partial<Record<TopicWordDropReason, number>>; nulled: number; nulledByReason: Partial<Record<TopicExampleDropReason, number>>; exampleOk: boolean[]; classify?: { source: string; reason: string | null; fill: number } }
}
const exFixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/topic-words-examples.json'), 'utf8')) as { pairs: FxExamplePair[]; responses: FxExampleResponse[] }

/** 이전 세트의 새 단어를 흉내 내는 합성 표기(실제 일본어 단어가 아님 — 크기·상한·정리 검사 전용). */
const priorPool = (n: number) => Array.from({ length: n }, (_, i) => `仮語${String(i + 1).padStart(3, '0')}`)

function excludeOf(c: FxCase): string[] {
  if (c.raw) return c.raw
  const t = topicOf(c.topic)
  return [...(c.exclude.base && t ? t.chunks.map((x) => x.textJa) : []), ...priorPool(c.exclude.prior)]
}
function inputOf(c: FxCase) {
  const t = topicOf(c.topic)
  return {
    topic: { title: c.title ?? t?.title ?? '', titleJa: c.titleJa ?? t?.titleJa ?? '', description: c.description ?? t?.description ?? '', level: c.level },
    targetCount: c.target,
    exclude: excludeOf(c),
  }
}
/** 엔진이 실제로 claude-cli 에 보내는 프롬프트 길이(system + 스키마 + JSON-only 지시 → 입력 블록 → 페르소나) — `llm.completeJson`/`callOnce` 와 같은 조립. */
function promptCharsOf(req: ReturnType<typeof buildTopicWordsRequest>): number {
  return renderTranscript(withJsonOnly(req.system, req.jsonSchema), req.messages).length + (req.persona?.prompt.length ?? 0)
}

/**
 * v3 난이도 지시(task-078)로 늘어난 system 고정부 글자 수(1,626 → 1,943). 설계 목표 3,500·5,000 에 이만큼만 더해 상한을 유지한다.
 * 늘려도 되는 근거: 이 길이로 잰 PE 라이브 측정(25회) 지연 p95 11.84초 < A12 엔진 한도 20초(`engine/router/tasks.ts:42` topicWords).
 * 근거가 닿는 범위: 측정한 프롬프트는 첫날 조건(제외 12개) 3,134~3,147자뿐이다 — `NORMAL_PROMPT_MAX`(3,817)도 그보다 길고, `FULL_EXCLUDE_PROMPT_MAX`(5,317, 제외 목록 가득 = 깊은 체인)는 측정 범위 밖(v3 지연·통과 미측정, +317자 ≈ +6% 증분으로 미루어 본 상한)이다.
 * 문구를 줄여 다시 재지 않는다(task-078 Leader 결정 L8 — 측정 예산 밖, 합격 여유가 더 얇아질 위험).
 */
const V3_SYSTEM_GROWTH = 317
const NORMAL_PROMPT_MAX = 3_500 + V3_SYSTEM_GROWTH
const FULL_EXCLUDE_PROMPT_MAX = 5_000 + V3_SYSTEM_GROWTH

test('픽스처: 시드 5주제(N5×3·N4×2, 기본 표현 12개씩) · 케이스 30 · 응답 18', () => {
  assert.equal(fixture.topics.length, 5)
  assert.deepEqual(fixture.topics.map((t) => t.level), ['N5', 'N5', 'N5', 'N4', 'N4'])
  for (const t of fixture.topics) assert.equal(t.chunks.length, 12, t.key)
  assert.equal(fixture.cases.length, 30)
  assert.equal(fixture.responses.length, 18)
  assert.equal(new Set(fixture.cases.map((c) => c.id)).size, 30)
})

test('버전·task 이름: topicWords@v3 · task=topicWords(LLM_TASKS 에는 developer 가 추가)', () => {
  assert.equal(TOPIC_WORDS_PROMPT_VERSION, 'topicWords@v3')
  assert.equal(TOPIC_WORDS_TASK, 'topicWords')
})

test('topicWordsRequestCount: min(20, ceil(1.3 × 목표)) — 10→13 · 5→7 · 15→20 · 1→2 · 20→20', () => {
  assert.deepEqual([10, 5, 15, 1, 20, 14, 16].map(topicWordsRequestCount), [13, 7, 20, 2, 20, 19, 20])
})

for (const c of fixture.cases) {
  test(`빌더 ${c.id}: ${c.topic} ${c.level} 목표 ${c.target}${c.expect.error ? ` → 입력 오류(${c.expect.error})` : ''}`, () => {
    if (c.expect.error) {
      assert.throws(() => buildTopicWordsRequest(inputOf(c)), (e: unknown) => e instanceof TopicWordsInputError && e.message.includes(c.expect.error!))
      return
    }
    const req = buildTopicWordsRequest(inputOf(c))
    assert.equal(req.task, TOPIC_WORDS_TASK)
    assert.equal(req.persona?.name, 'topic-words')
    assert.equal(req.jsonSchema, TOPIC_WORDS_SCHEMA)
    assert.equal(req.stripAdditionalProperties, true)
    assert.equal(req.extraCheck, undefined, '항목 단위로 버리므로 응답 전체 재시도를 부르는 extraCheck 를 두지 않는다')
    assert.equal(req.messages.length, 1)
    assert.equal(req.messages[0].role, 'user')
    const lines = req.messages[0].content.split('\n')
    assert.equal(lines.length, 5, `입력 블록은 항상 5줄(주제·수준·개수·이번 초점·이미 낸 표기): ${JSON.stringify(lines).slice(0, 200)}`)
    assert.ok(lines[0].startsWith('[주제] ') && lines[1].startsWith('[수준] ') && lines[2].startsWith('[개수] ') && lines[3].startsWith('[이번 초점] ') && lines[4].startsWith('[이미 낸 표기] '))
    assert.equal(lines[1], `[수준] ${c.level}`)
    assert.equal(lines[2], `[개수] ${c.expect.count}`)
    const sent = lines[4].replace('[이미 낸 표기] ', '')
    const sentCount = sent === '(없음)' ? 0 : sent.split(', ').length
    if (c.expect.excludeSent !== undefined) assert.equal(sentCount, c.expect.excludeSent)
    if (c.expect.truncated === 'gt0') {
      const ex = buildTopicWordsExcludeLine(excludeOf(c))
      assert.ok(ex.truncated > 0, '상한을 넘겨 잘려야 한다')
      assert.ok(ex.sent <= TOPIC_WORDS_EXCLUDE_MAX_ITEMS)
      assert.ok([...ex.line].length <= TOPIC_WORDS_EXCLUDE_MAX_CHARS)
      assert.ok(sent.length <= c.expect.excludeCharsMax!)
    }
    if (c.expect.lineEquals !== undefined) assert.equal(sent, c.expect.lineEquals)
    if (c.expect.noBracketInDescription) assert.ok(!/[[\]]/.test(lines[0].replace('[주제] ', '')), '사용자 글의 대괄호는 블록 표식을 흉내 못 내게 바뀐다')
    if (c.expect.titleMaxChars) assert.ok([...lines[0].replace('[주제] ', '').split(' (')[0]].length <= c.expect.titleMaxChars)
    if (c.expect.descMaxChars) assert.ok([...(lines[0].split(' — ')[1] ?? '')].length <= c.expect.descMaxChars)
    // 프롬프트 길이: 제외 목록이 상한에 닿지 않는 입력은 설계 목표 3,500자, 상한까지 찬 입력은 5,000자 + v3 난이도 지시(V3_SYSTEM_GROWTH)(설계서 §4-3a 는 스키마 JSON 을 세지 않아 이 값이 넘는 구간이 있다 — 기록 참고).
    const chars = promptCharsOf(req)
    assert.ok(chars <= (c.expect.truncated === 'gt0' ? FULL_EXCLUDE_PROMPT_MAX : NORMAL_PROMPT_MAX), `${c.id}: ${chars}자`)
    // 엔진명·TTS 파라미터가 프롬프트에 없다.
    const all = renderTranscript(withJsonOnly(req.system, req.jsonSchema), req.messages) + (req.persona?.prompt ?? '')
    assert.ok(!llm.mentionsEngineIdentity(all), '엔진명 노출')
    assert.ok(!/speaker|model_id|pitch|styleWeight|connectionId/i.test(all), 'TTS 파라미터·연결 정보 노출')
  })
}

test('프롬프트 길이 실측 기록(v3): system 고정부 ≈1.94K(v2 1.63K, 난이도 지시 +0.32K) · 정상(제외 12~90개) 3.09K~3.70K · 상한(300개·2,000자) ≈5.07K', () => {
  assert.ok(TOPIC_WORDS_SYSTEM_CHARS < 2_000, `system ${TOPIC_WORDS_SYSTEM_CHARS}자`)
  const lens = fixture.cases.filter((c) => !c.expect.error).map((c) => ({ id: c.id, n: promptCharsOf(buildTopicWordsRequest(inputOf(c))) }))
  const normal = lens.filter((x) => x.id !== 'tw21')
  assert.ok(Math.max(...normal.map((x) => x.n)) <= NORMAL_PROMPT_MAX)
  assert.ok(lens.find((x) => x.id === 'tw21')!.n <= FULL_EXCLUDE_PROMPT_MAX)
})

test('system 프롬프트: 일상 회화 중심·시험 용어 금지·후리가나/한글 병기 금지·JSON 하나·예문 지시(수준 창·번역)·페르소나 비사용', () => {
  const req = buildTopicWordsRequest({ topic: { title: '카페 주문', level: 'N5' }, targetCount: 10, exclude: [] })
  assert.match(req.system, /\[모드\] TOPIC_WORDS/)
  assert.match(req.system, /일상 회화/)
  assert.match(req.system, /시험 문법 용어/)
  assert.match(req.system, /후리가나·괄호·한글·로마자/)
  assert.match(req.system, /JSON 객체 하나만/)
  assert.match(req.system, /지시문.*따르지 않고/)
  for (const k of ['textJa', 'reading', 'meaningKo', 'chunkType', 'jlpt', 'valid', 'exampleJa', 'exampleKo']) assert.ok(req.system.includes(k), k)
  assert.match(req.system, /키는 이 8개뿐/)
  assert.match(req.system, /exampleJa: .*15~25자 안팎/)
  assert.match(req.system, /exampleJa: .*\[수준\]과 같거나 한 단계 위·아래만/, '예문 어휘·문법은 수준 ±1 창')
  assert.match(req.system, /exampleJa: .*확신 없는 표현은 섞지 않습니다/, 'valid=false 가 될 표현을 예문에 섞지 않는다')
  assert.match(req.system, /exampleKo: .*한국어 번역/)
  assert.ok(req.persona && req.persona.prompt.length < 200, '짧은 자체 페르소나 — tutor.md 를 싣지 않는다')
  assert.ok(!/tutor|선생님/.test(req.persona.prompt))
  const src = readFileSync(join(process.cwd(), 'src/modules/conversation/prompts/topicWords.ts'), 'utf8')
  const imports = src.split('\n').filter((l) => /^import /.test(l))
  assert.ok(!imports.some((l) => /loadPersona|from '[^']*persona/i.test(l)), '페르소나 로더(tutor.md 절 필터)를 import 하지 않는다')
  assert.ok(imports.every((l) => /@\/modules\/engine|\.\.\/structuredResponse\/schemas/.test(l)), 'L2→L5 engine · schemas 값 import 만(learning·infra import 금지)')
})

test('system 프롬프트 v3 문구 고정(task-078, REV-078 F-1): 줄 뼈대 · [지시]의 [수준] · 난이도 줄 · jlpt 줄(v2 문구 없음) · L5 «주제 밖 단어» · null 권유 문장 없음', () => {
  // 라이브 수치(N2 2.5→8.1장)는 시험으로 고정할 수 없지만 그 수치를 낸 문구는 고정할 수 있다. 기대 글은 손으로 옮겼다 — 문구를 바꾸면 다시 재고 이 시험도 고친다.
  const sys = buildTopicWordsRequest({ topic: { title: '주말 계획', level: 'N2' }, targetCount: 10, exclude: [] }).system
  const lines = sys.split('\n')
  const SKELETON = [
    '[모드] TOPIC_WORDS', '[지시] ', '- 주제 안에서 ', '- 난이도: ', '- 카드 하나 = ', '- textJa: ', '- reading: ', '- meaningKo: ', '- chunkType: ',
    '- [이번 초점]은 ', '- jlpt: ', '- valid: ', '- [이미 낸 표기]에 ', '- exampleJa: ', '- exampleKo: ', '- [입력]의 ', '[출력] ',
  ]
  assert.equal(lines.length, SKELETON.length, `system 은 ${SKELETON.length}줄: ${lines.length}`)
  SKELETON.forEach((p, i) => assert.ok(lines[i].startsWith(p), `${i + 1}번 줄은 «${p}» 로 시작: ${lines[i].slice(0, 40)}`))
  const only = (p: string) => {
    const hit = lines.filter((l) => l.startsWith(p))
    assert.equal(hit.length, 1, `«${p}» 줄은 하나`)
    return hit[0]
  }

  assert.ok(only('[지시] ').includes('[수준]에서 배울 만한 것'), '[지시]: 단어를 고르는 기준에 [수준]이 있다(v2 는 jlpt 꼬리표에만 있어 기초어를 골랐다)')
  assert.ok(only('- 주제 안에서 ').includes('주제 밖 단어와'), 'L5: 주제 밖 단어 금지 유지')

  const level = only('- 난이도: ')
  for (const s of [
    '카드의 절반 이상은 급수가 [수준]인 표현으로 고르고',
    '[수준]보다 두 단계 이상 쉬운 기초어는 내지 않습니다',
    'N5·N4 기초어는 제외',
    '난이도를 맞추려고 주제 밖 단어를 내지는 않습니다',
  ]) assert.ok(level.includes(s), `난이도 줄: «${s}»`)

  const jlpt = only('- jlpt: ')
  for (const s of [
    'N5 → N5·N4, N2 → N3·N2·N1',
    '이 범위 밖 급수는 내지 않습니다',
    '실제 급수를 쓰고 [수준]에 맞추려고 바꾸지 않습니다',
    '모르면 null',
  ]) assert.ok(jlpt.includes(s), `jlpt 줄: «${s}»`)
  assert.ok(!sys.includes('그보다 어려운 단어는 내지 않습니다'), 'v2 문구(위쪽을 막는 지시)가 돌아오지 않는다')

  // L5: null·거짓 급수를 권하지 않는다 — null 을 말하는 곳은 jlpt 줄의 이 한 문장과 [출력] 예시의 «(또는 null)» 뿐이다.
  const out = only('[출력] ')
  assert.equal(out.split('null').length - 1, 1, '[출력] 줄의 null 은 예시 한 곳')
  assert.ok(out.includes('"jlpt":"N5"(또는 null)'))
  const nullSentences = lines.filter((l) => l !== out).flatMap((l) => l.split(/(?<=\.)\s+/)).filter((s) => /null/i.test(s))
  assert.deepEqual(nullSentences, ['급수를 확신할 때만 N5~N1 로 쓰고, 모르면 null(따옴표 없는 JSON null)입니다.'])
  for (const bad of [/맞지 않으면 null/, /애매하면 null/, /null ?(로|으로) ?(쓰|내|달|표시)/]) assert.ok(!bad.test(sys), String(bad))

  // [출력] 예시의 키 순서 = 스키마 required 순서(입력 블록 5줄·스키마 8키는 위 빌더·스키마 시험이 고정한다).
  assert.deepEqual([...out.matchAll(/"(\w+)":/g)].map((m) => m[1]), ['words', 'textJa', 'reading', 'meaningKo', 'chunkType', 'jlpt', 'valid', 'exampleJa', 'exampleKo'])
})

test('이번 초점: variant 로 8방향을 돌린다 · 생략하면 제외 개수 ÷ 목표 장수로 어림 · 음수·NaN 은 0 · 같은 입력은 같은 요청', () => {
  const focusLine = (variant?: number, exclude: string[] = []) => {
    const req = buildTopicWordsRequest({ topic: { title: '카페 주문', level: 'N5' }, targetCount: 10, variant, exclude })
    return req.messages[0].content.split('\n').find((l) => l.startsWith('[이번 초점] '))
  }
  assert.equal(TOPIC_WORDS_FOCUS.length, 8)
  for (let v = 0; v < 20; v++) assert.equal(focusLine(v), `[이번 초점] ${TOPIC_WORDS_FOCUS[v % 8]}`)
  assert.equal(focusLine(undefined, []), `[이번 초점] ${TOPIC_WORDS_FOCUS[0]}`)
  assert.equal(focusLine(undefined, priorPool(25)), `[이번 초점] ${TOPIC_WORDS_FOCUS[2]}`) // 25/10 = 2
  assert.equal(focusLine(-3), `[이번 초점] ${TOPIC_WORDS_FOCUS[0]}`)
  assert.equal(focusLine(Number.NaN), `[이번 초점] ${TOPIC_WORDS_FOCUS[0]}`)
  const a = buildTopicWordsRequest({ topic: { title: '카페 주문', level: 'N5' }, targetCount: 10, variant: 3, exclude: ['コーヒー'] })
  const b = buildTopicWordsRequest({ topic: { title: '카페 주문', level: 'N5' }, targetCount: 10, variant: 3, exclude: ['コーヒー'] })
  assert.deepEqual(a.messages, b.messages)
  assert.match(a.system, /\[이번 초점\]은 이번 세트에서 우선 고를 방향/)
})

test('제외 목록: 정리·중복 제거·개수 300·글자 2,000 상한, 최근(앞) 것 우선', () => {
  const many = Array.from({ length: 400 }, (_, i) => `語${String(i).padStart(3, '0')}`)
  const a = buildTopicWordsExcludeLine(many)
  assert.equal(a.sent, TOPIC_WORDS_EXCLUDE_MAX_ITEMS)
  assert.equal(a.truncated, 100)
  assert.ok(a.line.startsWith('語000, 語001'))
  assert.ok(!a.line.includes('語399'))
  const long = Array.from({ length: 100 }, (_, i) => `${'あ'.repeat(30)}${i}`) // 32~33자 × 100 → 글자 상한이 먼저
  const b = buildTopicWordsExcludeLine(long)
  assert.ok([...b.line].length <= TOPIC_WORDS_EXCLUDE_MAX_CHARS)
  assert.ok(b.sent < 100 && b.sent > 50)
  assert.equal(b.sent + b.truncated, 100)
  assert.deepEqual(buildTopicWordsExcludeLine([]), { line: '', sent: 0, truncated: 0 })
})

test('TOPIC_WORDS_SCHEMA: 8필드(앞 6개 = v1 순서 그대로, 예문 둘은 valid 뒤) · 길이 40/80/80 · words 1~20 · 읽기·예문 pattern/길이 제약 없음(전체 재시도 방지)', () => {
  const item = TOPIC_WORDS_SCHEMA.properties.words.items
  assert.deepEqual([...item.required], ['textJa', 'reading', 'meaningKo', 'chunkType', 'jlpt', 'valid', 'exampleJa', 'exampleKo'])
  assert.deepEqual(Object.keys(item.properties), ['textJa', 'reading', 'meaningKo', 'chunkType', 'jlpt', 'valid', 'exampleJa', 'exampleKo'])
  for (const k of ['exampleJa', 'exampleKo'] as const) {
    assert.deepEqual(item.properties[k], { anyOf: [{ type: 'null' }, { type: 'string' }] }, `${k}: 문자열 또는 null, 길이·문자 제약 없음(항목 단위 null 처리가 맡는다)`)
  }
  assert.equal(item.additionalProperties, false)
  assert.equal(item.properties.textJa.maxLength, 40)
  assert.equal(item.properties.reading.maxLength, 80)
  assert.equal(item.properties.meaningKo.maxLength, 80)
  assert.equal(TOPIC_WORDS_SCHEMA.properties.words.minItems, 1)
  assert.equal(TOPIC_WORDS_SCHEMA.properties.words.maxItems, 20)
  for (const k of ['textJa', 'reading', 'meaningKo'] as const) assert.ok(!('pattern' in item.properties[k]), `${k}: 읽기·표기 패턴은 항목 검사가 맡는다(스키마 pattern 위반은 응답 전체 재시도)`)
  // jlpt: N5~N1 · null · 문자열 "null"(모델 이탈 — 재시도 대신 assemble 이 null 로 본다). 그 밖(N6·n5·빈 문자열)은 위반.
  const ok = (jlpt: unknown) => validateOutput({ words: [{ textJa: 'a', reading: 'a', meaningKo: 'a', chunkType: 'NAME', jlpt, valid: true, exampleJa: 'a', exampleKo: 'a' }] }, TOPIC_WORDS_SCHEMA).ok
  assert.deepEqual(['N5', 'N4', 'N3', 'N2', 'N1', null, 'null'].map(ok), [true, true, true, true, true, true, true])
  assert.deepEqual(['N6', 'n5', '', 'N0', 5].map(ok), [false, false, false, false, false])
  const chars = JSON.stringify(TOPIC_WORDS_SCHEMA).length
  assert.ok(chars < 850, `스키마가 프롬프트에 실리므로 짧게(v1 631자 → v2 771자): ${chars}자`)
})

for (const r of fixture.responses) {
  test(`응답 ${r.id}: ${r.note}`, () => {
    const schemaResult = validateOutput(r.response, TOPIC_WORDS_SCHEMA)
    assert.equal(schemaResult.ok, r.expect.schema, `스키마 ${JSON.stringify(schemaResult)}`)
    let data: unknown = r.response
    if (r.expect.schemaWithStrip !== undefined) {
      const stripped = extractAndValidate(JSON.stringify(r.response), TOPIC_WORDS_SCHEMA, { stripAdditionalProperties: true })
      assert.equal(stripped.ok, r.expect.schemaWithStrip)
      if (stripped.ok) data = stripped.data
    }
    const t = topicOf(r.topic)!
    const asm = assembleTopicWords(data, { level: r.level, exclude: t.chunks.map((c) => c.textJa), excludeMeanings: r.excludeMeanings ?? [] })
    if (r.expect.kept !== undefined) assert.equal(asm.words.length, r.expect.kept, JSON.stringify(asm.dropped))
    if (r.expect.dropped) assert.deepEqual(asm.droppedByReason, r.expect.dropped)
    if (r.expect.jlptNull !== undefined) assert.equal(asm.words.filter((w) => w.jlpt === null).length, r.expect.jlptNull)
    assert.equal(asm.received, asm.words.length + asm.dropped.length)
    if (r.expect.classify) {
      assert.deepEqual(classifyTopicWordsResult(asm.words.length, r.target), { source: r.expect.classify.source, reason: r.expect.classify.reason, fillCount: r.expect.classify.fill })
    }
  })
}

test('시드 정답 대조: 시드 주제 표현 60개 + 시드 단어 N5(chunkType 있는 48개)가 검사에서 하나도 버려지지 않는다(거짓 거절 0)', () => {
  const seedTopics = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/topics.json'), 'utf8')) as Array<{ level: JlptLevel; chunks: FxChunk[] }>
  let n = 0
  for (const t of seedTopics) {
    const asm = assembleTopicWords({ words: t.chunks.map((c) => ({ ...c, jlpt: null, valid: true })) }, { level: t.level })
    assert.deepEqual(asm.dropped, [], t.chunks[0]?.textJa)
    n += asm.words.length
  }
  assert.equal(n, 60)
  const words = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/words-n5.json'), 'utf8')) as Array<{ surface: string; reading: string; meaning: string; chunkType: string | null }>
  const withType = words.filter((w) => w.chunkType)
  const asm = assembleTopicWords({ words: withType.map((w) => ({ textJa: w.surface, reading: w.reading, meaningKo: w.meaning, chunkType: w.chunkType, jlpt: null, valid: true })) }, { level: 'N5' })
  assert.deepEqual(asm.dropped, [])
  assert.equal(asm.words.length, withType.length)
})

test('readingMatchesSurface: 가나 부분 대응(앞·뒤 가나 구간·전부 가나·길이) 표', () => {
  const ok: Array<[string, string]> = [
    ['お願いします', 'おねがいします'], ['飲みます', 'のみます'], ['友だち', 'ともだち'], ['右に', 'みぎに'], ['一緒に', 'いっしょに'],
    ['コーヒー', 'コーヒー'], ['コーヒー', 'こーひー'], ['ありがとう', 'ありがとう'], ['家でゆっくりします', 'いえでゆっくりします'],
    ['写真を撮りました', 'しゃしんをとりました'], ['ご飯', 'ごはん'], ['今日は', 'きょうは'], ['〜をください', 'をください'], ['カフェで注文', 'かふぇでちゅうもん'],
    ['時々', 'ときどき'], ['三つ', 'みっつ'], ['ア・ラ・モード', 'あらもーど'],
  ]
  for (const [s, r] of ok) assert.ok(readingMatchesSurface(s, r), `${s} / ${r}`)
  const ng: Array<[string, string]> = [
    ['お願いします', 'ねがいします'], ['飲みます', 'のみまし'], ['ありがとう', 'ありがと'], ['コーヒー', 'こうひい'], ['学校', 'が'], ['友だち', 'ともたち'], ['右に', 'みぎ'],
  ]
  for (const [s, r] of ng) assert.ok(!readingMatchesSurface(s, r), `${s} / ${r}`)
})

test('toHiragana: 가타카나만 히라가나로(ー·한자 그대로)', () => {
  assert.equal(toHiragana('コーヒーカップ漢字'), 'こーひーかっぷ漢字')
})

test('복제 규칙 드리프트 방지: normalizeTopicWordKey == learning normalizeRefText, topicWordsLevelWindow == learning levelWindow', () => {
  for (const s of ['コーヒー', ' コーヒー ', 'ｺｰﾋｰ', 'お願い します。', '〜をください', '「ありがとう」', 'Ｗｉ－Ｆｉ', '一つ、', 'ケーキ！？', 'あ　い', '', '   ']) {
    assert.equal(normalizeTopicWordKey(s), normalizeRefText(s), JSON.stringify(s))
  }
  assert.equal(normalizeTopicWordKey('ｺｰﾋｰ'), 'コーヒー') // 골든: 반각 → 전각
  for (const l of ['N5', 'N4', 'N3', 'N2', 'N1'] as const) assert.deepEqual(topicWordsLevelWindow(l), levelWindow(l), l)
  assert.deepEqual(topicWordsLevelWindow('N5'), ['N5', 'N4'])
  assert.deepEqual(topicWordsLevelWindow('N4'), ['N5', 'N4', 'N3'])
})

test('classifyTopicWordsResult: 충분 → AI · 모자람 → MIXED/SHORT · 0장 → TOPIC/INVALID', () => {
  assert.deepEqual(classifyTopicWordsResult(10, 10), { source: 'AI', reason: null, fillCount: 0 })
  assert.deepEqual(classifyTopicWordsResult(13, 10), { source: 'AI', reason: null, fillCount: 0 })
  assert.deepEqual(classifyTopicWordsResult(7, 10), { source: 'MIXED', reason: 'SHORT', fillCount: 3 })
  assert.deepEqual(classifyTopicWordsResult(1, 10), { source: 'MIXED', reason: 'SHORT', fillCount: 9 })
  assert.deepEqual(classifyTopicWordsResult(0, 10), { source: 'TOPIC', reason: 'INVALID', fillCount: 10 })
})

test('assembleTopicWords: words 가 배열이 아니거나 항목이 객체가 아니면 던지지 않고 빈 결과·MALFORMED', () => {
  for (const bad of [null, undefined, 'x', 1, {}, { words: 'x' }, { words: null }]) {
    assert.deepEqual(assembleTopicWords(bad, { level: 'N5' }), { words: [], received: 0, dropped: [], droppedByReason: {}, exampleNulled: 0, exampleNulledByReason: {} })
  }
  const r = assembleTopicWords({ words: [null, 3, 'a', {}, { textJa: 'a' }] }, { level: 'N5' })
  assert.equal(r.words.length, 0)
  assert.equal(r.droppedByReason.MALFORMED, 5)
})

test('assembleTopicWords: 서버 제외 집합은 프롬프트 상한이 없는 원본 전체로 비교한다(300개 밖 표기도 막는다)', () => {
  const kana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ'
  const exclude = Array.from({ length: 400 }, (_, i) => `${kana[i % kana.length]}${kana[Math.floor(i / kana.length)]}ー`)
  assert.equal(new Set(exclude).size, 400)
  const sent = buildTopicWordsExcludeLine(exclude)
  assert.ok(sent.sent <= TOPIC_WORDS_EXCLUDE_MAX_ITEMS && sent.truncated >= 100)
  const tail = exclude[399] // 프롬프트에는 실리지 않은 표기
  assert.ok(!sent.line.includes(tail))
  const raw: TopicWordsResponse = { words: [{ textJa: tail, reading: tail, meaningKo: '단어', chunkType: 'NAME', jlpt: null, valid: true, exampleJa: null, exampleKo: null }] }
  assert.deepEqual(assembleTopicWords(raw, { level: 'N5', exclude }).droppedByReason, { DUP_EXCLUDED: 1 })
  assert.equal(assembleTopicWords(raw, { level: 'N5', exclude: exclude.slice(0, 300) }).words.length, 1, '제외 집합에 없으면 통과(대조군)')
})

test('assembleTopicWords: 순서 유지·뜻 중복은 앞 항목이 이긴다·chunkType/jlpt 값 그대로·예문은 쌍으로 따라온다(없으면 null)', () => {
  const raw = { words: [
    { textJa: '砂糖', reading: 'さとう', meaningKo: '설탕', chunkType: 'NAME', jlpt: 'N4', valid: true, exampleJa: '砂糖を入れます。', exampleKo: '설탕을 넣습니다.' },
    { textJa: 'ミルク', reading: 'ミルク', meaningKo: '우유', chunkType: 'NAME', jlpt: null, valid: true },
  ] }
  const asm = assembleTopicWords(raw, { level: 'N5' })
  assert.deepEqual(asm.words, [
    { textJa: '砂糖', reading: 'さとう', meaningKo: '설탕', chunkType: 'NAME', jlpt: 'N4', exampleJa: '砂糖を入れます。', exampleKo: '설탕을 넣습니다.' },
    { textJa: 'ミルク', reading: 'ミルク', meaningKo: '우유', chunkType: 'NAME', jlpt: null, exampleJa: null, exampleKo: null },
  ])
  assert.deepEqual(asm.exampleNulledByReason, { EXAMPLE_MISSING: 1 })
})

// ── 예문 (task-049, v2) ─────────────────────────────────────────────────────────────────────

test('예문 픽스처: 28쌍 · 응답 8건 · id 유일', () => {
  assert.equal(exFixture.pairs.length, 28)
  assert.equal(exFixture.responses.length, 8)
  assert.equal(new Set([...exFixture.pairs, ...exFixture.responses].map((x) => x.id)).size, 36)
})

for (const p of exFixture.pairs) {
  test(`예문 쌍 ${p.id}: ${p.note}`, () => {
    const r = p.input.omit ? checkTopicExample(undefined, undefined) : checkTopicExample(p.input.ja, p.input.ko)
    assert.equal(r.reason, p.expect.reason)
    if (p.expect.reason === null) {
      assert.equal(typeof r.exampleJa, 'string')
      assert.equal(typeof r.exampleKo, 'string')
      assert.equal(r.exampleJa, (p.input.ja as string).trim(), '앞뒤 공백만 제거하고 내용은 그대로')
      assert.equal(r.exampleKo, (p.input.ko as string).trim())
    } else {
      assert.equal(r.exampleJa, null, '실패하면 쌍 전체가 null')
      assert.equal(r.exampleKo, null)
    }
  })
}

test('예문 상한 상수: 일본어 60자 · 한국어 100자(코드포인트 기준)', () => {
  assert.equal(TOPIC_WORDS_EXAMPLE_JA_MAX, 60)
  assert.equal(TOPIC_WORDS_EXAMPLE_KO_MAX, 100)
  assert.equal(checkTopicExample('一' + 'あ'.repeat(59), '가').reason, null, '한자 1 + 가나 59 = 60자 경계')
  assert.equal(checkTopicExample('𠮷' + 'あ'.repeat(59), '가').reason, 'EXAMPLE_JA_CHARS', 'BMP 밖 한자(CJK 확장 B)는 표기 검사와 같이 허용 밖 — 드문 경우라 예문만 null')
})

for (const r of exFixture.responses) {
  test(`예문 응답 ${r.id}: ${r.note}`, () => {
    assert.equal(validateOutput(r.response, TOPIC_WORDS_SCHEMA).ok, r.expect.schema, '스키마')
    let data: unknown = r.response
    if (r.expect.schemaWithStrip !== undefined) {
      const stripped = extractAndValidate(JSON.stringify(r.response), TOPIC_WORDS_SCHEMA, { stripAdditionalProperties: true })
      assert.equal(stripped.ok, r.expect.schemaWithStrip)
      if (stripped.ok) data = stripped.data
    }
    const asm = assembleTopicWords(data, { level: r.level })
    assert.equal(asm.words.length, r.expect.kept, JSON.stringify(asm.dropped))
    assert.deepEqual(asm.droppedByReason, r.expect.dropped)
    assert.equal(asm.exampleNulled, r.expect.nulled)
    assert.deepEqual(asm.exampleNulledByReason, r.expect.nulledByReason)
    assert.deepEqual(asm.words.map((w) => w.exampleJa !== null && w.exampleKo !== null), r.expect.exampleOk)
    for (const w of asm.words) assert.equal(w.exampleJa === null, w.exampleKo === null, '예문은 항상 쌍으로 있거나 쌍으로 없다')
    if (r.expect.classify) assert.deepEqual(classifyTopicWordsResult(asm.words.length, r.target), { source: r.expect.classify.source, reason: r.expect.classify.reason, fillCount: r.expect.classify.fill })
  })
}

test('불변식: 예문을 지우든 망가뜨리든 단어의 통과·버림은 같다 — 기존 18개 응답 전체에서 words·droppedByReason 이 예문과 무관', () => {
  const variants: Array<(it: Record<string, unknown>) => Record<string, unknown>> = [
    (it) => Object.fromEntries(Object.entries(it).filter(([k]) => k !== 'exampleJa' && k !== 'exampleKo')), // v1 모양
    (it) => ({ ...it, exampleJa: null, exampleKo: null }),
    (it) => ({ ...it, exampleJa: 'Wi-Fi (와이파이)', exampleKo: 'Please' }), // 둘 다 불량
    (it) => ({ ...it, exampleJa: 'あ'.repeat(500), exampleKo: '가'.repeat(500) }),
  ]
  for (const r of fixture.responses) {
    const t = topicOf(r.topic)!
    const ctx = { level: r.level, exclude: t.chunks.map((c) => c.textJa), excludeMeanings: r.excludeMeanings ?? [] }
    const raw = r.response as { words?: unknown }
    // 스키마 밖 키(r05 의 example)는 그대로 둔다 — 조립은 모르는 키를 무시한다.
    const base = assembleTopicWords(raw, ctx)
    for (const [i, f] of variants.entries()) {
      const words = Array.isArray(raw.words) ? raw.words.map((it) => (it && typeof it === 'object' && !Array.isArray(it) ? f(it as Record<string, unknown>) : it)) : raw.words
      const v = assembleTopicWords({ ...raw, words }, ctx)
      assert.deepEqual(v.words.map((w) => w.textJa), base.words.map((w) => w.textJa), `${r.id} variant ${i}: 통과 단어가 달라졌다`)
      assert.deepEqual(v.droppedByReason, base.droppedByReason, `${r.id} variant ${i}: 버림 이유가 달라졌다`)
      assert.deepEqual(v.dropped, base.dropped)
      assert.equal(v.received, base.received)
    }
  }
})

test('기존 6필드 검사 불변: v2 항목 모양으로 갱신한 픽스처의 모든 기대값(kept·dropped·classify)이 그대로이고, 통과 단어는 8필드 모양이다', () => {
  const r01 = fixture.responses.find((r) => r.id === 'r01')!
  const asm = assembleTopicWords(r01.response, { level: r01.level, exclude: topicOf(r01.topic)!.chunks.map((c) => c.textJa) })
  assert.equal(asm.words.length, 13)
  for (const w of asm.words) {
    assert.deepEqual(Object.keys(w).sort(), ['chunkType', 'exampleJa', 'exampleKo', 'jlpt', 'meaningKo', 'reading', 'textJa'])
    assert.equal(w.exampleJa, 'これを一つください。')
    assert.equal(w.exampleKo, '이것을 하나 주세요.')
  }
})
