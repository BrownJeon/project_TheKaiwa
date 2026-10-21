/**
 * task-010d A2 — #59 A4 입력 조립(`_lib/lessonInput.ts`). DB·LLM 없음.
 *  ① 일반 수업(주제·붙여넣기): 이 파일 이전 라우트가 만들던 객체와 같고(`scenario` 칸 없음) A4 요청 바이트도 같다 — PE 골든 해시(topic_full·source_full)와도 대조
 *  ② 상황 수업: PE 어댑터(`scenarioPromptParts`) 순서 그대로 `[상황]` 블록 · 주제+상황 / 조각 없는 주제·주제 없음 → 상황 단독 · 문장 없음 · `lessonScenario@v2`(task-081 PE 개정)
 *  ③ inputMeta: 일반은 이전 7칸 그대로, 상황만 2칸 추가 · LessonInputError 필드
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildLessonRequest, LESSON_PROMPT_VERSION, LessonInputError, lessonPromptVersion, type LessonInput } from '@/modules/conversation'
import type { LessonMaterials, ScenarioRolePlayMaterial } from '@/modules/learning'
import { asTopicChunkType } from '@/types/topic'
import { lessonInputErrorField, lessonInputFor, lessonInputMeta, lessonScenarioInput } from '../lessonInput'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson.json'), 'utf8')) as {
  topic: { title: string; titleJa?: string; level: 'N4'; chunks: { id: string; chunkType: string; textJa: string; reading: string | null; meaningKo: string }[] }
  sourceText: string
  acceptedCorrections: { original: string; corrected: string }[]
  previousTitles: string[]
  previousNextPreview: { titleKo: string; teaserKo: string }
}
const golden = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson-general-golden.json'), 'utf8')) as { cases: Record<string, { request: string; systemChars: number }> }

const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }
const heavy = { ...learner, displayName: '브라'.repeat(20), teacherName: '유'.repeat(30), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
const TODAY = '2026-10-07'

const topicMaterial = (): NonNullable<LessonMaterials['topic']> => ({
  id: 't-intro',
  title: fixture.topic.title,
  titleJa: fixture.topic.titleJa ?? null,
  level: fixture.topic.level,
  chunks: fixture.topic.chunks.map((c, i) => ({ ...c, order: i + 1 })) as NonNullable<LessonMaterials['topic']>['chunks'],
})

/** 이 파일 이전 `route.ts` 의 조립 그대로(HEAD 957d72e) — 일반 수업 입력이 바뀌지 않았음을 대조한다. */
function oldRouteInput(m: LessonMaterials, corrections: LessonInput['acceptedCorrections'], lr: LessonInput['learner']): LessonInput {
  const input = m.input
  return {
    todayKst: TODAY,
    learner: lr,
    topic: m.topic ? { title: m.topic.title, titleJa: m.topic.titleJa, level: m.topic.level, chunks: m.topic.chunks.map((c) => ({ id: c.id, chunkType: asTopicChunkType(c.chunkType, 'MODIFIER'), textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo })) } : null,
    sourceText: input.kind === 'text' ? input.sourceText : null,
    acceptedCorrections: corrections,
    previousTitles: m.previousTitles,
    previousNextPreview: m.previousNextPreview,
  }
}

const topicMats = (): LessonMaterials => ({ input: { kind: 'topic', topicId: 't-intro' }, topic: topicMaterial(), scenario: null, level: 'N4', previousTitles: fixture.previousTitles, previousNextPreview: fixture.previousNextPreview })
const textMats = (): LessonMaterials => ({ input: { kind: 'text', sourceText: fixture.sourceText }, topic: null, scenario: null, level: 'N4', previousTitles: fixture.previousTitles, previousNextPreview: fixture.previousNextPreview })

test('일반 수업: 조립 객체 = 이전 라우트 객체(scenario 칸 없음)·A4 요청 바이트 같음·promptVersion lesson@v9', () => {
  for (const m of [topicMats(), textMats()]) {
    const now = lessonInputFor(m, { todayKst: TODAY, learner, corrections: fixture.acceptedCorrections })
    const old = oldRouteInput(m, fixture.acceptedCorrections, learner)
    assert.deepEqual(now, old)
    assert.ok(!('scenario' in now), 'scenario 칸 자체가 없어야 한다')
    const a = buildLessonRequest(now)
    const b = buildLessonRequest(old)
    assert.equal(a.system, b.system)
    assert.equal(JSON.stringify(a.messages), JSON.stringify(b.messages))
    assert.equal(a.persona?.prompt, b.persona?.prompt)
    assert.equal(lessonPromptVersion(now), LESSON_PROMPT_VERSION)
  }
})

test('일반 수업: PE 골든 해시(topic_full·source_full — HEAD bcc04e2 lesson@v9)와 바이트까지 같다', () => {
  const cases: [string, LessonMaterials, LessonInput['learner']][] = [
    ['topic_full', topicMats(), learner],
    ['source_full', textMats(), heavy],
  ]
  for (const [name, m, lr] of cases) {
    const req = buildLessonRequest(lessonInputFor(m, { todayKst: TODAY, learner: lr, corrections: fixture.acceptedCorrections }))
    assert.equal(req.system.length, golden.cases[name].systemChars, `${name}: system 글자 수`)
    assert.equal(sha(`${req.system}\u0000${JSON.stringify(req.messages)}`), golden.cases[name].request, `${name}: system+messages`)
  }
})

const scenarioRow = {
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoal_ko: '주문한 음료의 사이즈와 온도를 바꿔 다시 주문한다', successCriteria: ['사이즈를 바꿨다'] },
  constraints: { steps: [{ ko: '인사하고 음료 말하기' }, { ko: '사이즈 바꾸기' }], opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요. 주문은요?' } },
  keyExpressions: [
    { id: 'e2', ja: 'ホットにしてください', ko: '따뜻한 걸로 해 주세요' },
    { id: 'e1', ja: 'サイズを変えてください', ko: '사이즈를 바꿔 주세요' },
    { id: 'e3', ja: '持ち帰りでお願いします', ko: '포장으로 부탁해요' },
  ],
  completionRule: { requiredExpressions: 2 },
}
function scenarioMaterial(over: Partial<ScenarioRolePlayMaterial> = {}): ScenarioRolePlayMaterial {
  return { id: 'scn-cafe', title: '카페에서 주문 바꾸기', titleJa: 'カフェで注文を変える', level: 'N5', status: 'ACTIVE', row: scenarioRow, chunks: new Map(), expressions: [], roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoalKo: '', successCriteria: [] }, steps: [], opening: null, requiredExpressions: 2, ...over }
}
const scenarioMats = (topic: LessonMaterials['topic'], level: LessonMaterials['level'] = 'N4'): LessonMaterials => ({
  input: { kind: 'scenario', scenarioId: 'scn-cafe', topicId: null },
  topic,
  scenario: scenarioMaterial(),
  level,
  previousTitles: [],
  previousNextPreview: null,
})

test('상황 수업(주제+상황): [상황] 블록·표현은 PE 어댑터 순서(e2→e1→e3)·주제 조각 id 유지·문장 없음·lessonScenario@v2', () => {
  const input = lessonInputFor(scenarioMats(topicMaterial()), { todayKst: TODAY, learner, corrections: [] })
  assert.equal(input.sourceText, null)
  assert.ok(input.topic, '조각 있는 대표 주제는 그대로')
  assert.equal(input.scenario?.level, 'N4', 'scenario.level = Lesson.level(대표 주제 수준)')
  assert.deepEqual(input.scenario?.expressions.map((e) => e.ja), ['ホットにしてください', 'サイズを変えてください', '持ち帰りでお願いします'])
  assert.deepEqual(input.scenario?.steps, [{ ko: '인사하고 음료 말하기' }, { ko: '사이즈 바꾸기' }])
  assert.equal(input.scenario?.goalKo, '주문한 음료의 사이즈와 온도를 바꿔 다시 주문한다')
  const req = buildLessonRequest(input)
  const body = req.messages[0].content
  assert.ok(body.indexOf('[주제]') === 0 && body.indexOf('[상황]') > 0, '주제 → 상황 순서')
  assert.match(body, /\[핵심 표현\] ホットにしてください\(따뜻한 걸로 해 주세요\)・サイズを変えてください/)
  assert.deepEqual(req.allowedChunkIds, fixture.topic.chunks.map((c) => c.id))
  assert.notEqual(lessonPromptVersion(input), LESSON_PROMPT_VERSION)
  assert.equal(lessonPromptVersion(input), 'lessonScenario@v2')
})

test('상황 수업: 대표 주제가 없거나 조각이 없으면 상황 단독(topic null) — LessonInputError 없이 만들어지고 조각 id 는 new-N 규칙', () => {
  for (const topic of [null, { ...topicMaterial(), chunks: [] }]) {
    const input = lessonInputFor(scenarioMats(topic, 'N3'), { todayKst: TODAY, learner, corrections: [] })
    assert.equal(input.topic, null)
    assert.equal(input.scenario?.level, 'N3')
    const req = buildLessonRequest(input)
    assert.deepEqual(req.allowedChunkIds, [])
    assert.ok(req.messages[0].content.startsWith('[상황]'))
    assert.ok(req.system.includes('"new-1","new-2"'), '상황 단독 = new-N id')
  }
})

test('상황 수업: 상황 제목이 비면 LessonInputError → 라우트 400 field scenarioId', () => {
  const m = { ...scenarioMats(null), scenario: scenarioMaterial({ title: '   ' }) }
  assert.throws(() => buildLessonRequest(lessonInputFor(m, { todayKst: TODAY, learner, corrections: [] })), LessonInputError)
  assert.equal(lessonInputErrorField(m.input), 'scenarioId')
  assert.equal(lessonInputErrorField({ kind: 'text', sourceText: 'x' }), 'sourceText')
  assert.equal(lessonInputErrorField({ kind: 'topic', topicId: 't' }), 'topicId')
})

test('일반 수업 재료에는 상황 입력이 생기지 않는다(lessonScenarioInput null)', () => {
  assert.equal(lessonScenarioInput(topicMats()), null)
  assert.equal(lessonScenarioInput(textMats()), null)
})

test('inputMeta: 일반 수업은 이전 7칸 그대로(순서 포함), 상황 수업만 scenarioWithTopic·scenarioExpressions 추가 — 본문 없음', () => {
  const m = topicMats()
  const input = lessonInputFor(m, { todayKst: TODAY, learner, corrections: fixture.acceptedCorrections })
  const req = buildLessonRequest(input)
  const meta = lessonInputMeta(m, input, req)
  assert.deepEqual(meta, {
    source: 'topic',
    chunks: req.allowedChunkIds.length,
    skippedChunks: req.skippedChunks,
    sourceChars: null,
    corrections: fixture.acceptedCorrections.length,
    previousTitles: fixture.previousTitles.length,
    previousPreview: true,
  })
  assert.deepEqual(Object.keys(meta), ['source', 'chunks', 'skippedChunks', 'sourceChars', 'corrections', 'previousTitles', 'previousPreview'])
  const sm = scenarioMats(topicMaterial())
  const sInput = lessonInputFor(sm, { todayKst: TODAY, learner, corrections: [] })
  const sMeta = lessonInputMeta(sm, sInput, buildLessonRequest(sInput))
  assert.equal(sMeta.source, 'scenario')
  assert.equal(sMeta.scenarioWithTopic, true)
  assert.equal(sMeta.scenarioExpressions, 3)
  assert.ok(!JSON.stringify(sMeta).includes('サイズ') && !JSON.stringify(sMeta).includes('카페'), '본문·제목 없음')
})

test('task-076: A4 주제 입력의 수준 = 레슨 수준 m.level(기준 수준 T) — 주제 행 수준이 아니다 · 프롬프트 [주제] 줄도 그 값', () => {
  const m: LessonMaterials = { ...topicMats(), level: 'N2' } // 주제 행은 N4, 진행 중 챌린지 난이도 N2
  const input = lessonInputFor(m, { todayKst: TODAY, learner, corrections: [] })
  assert.equal(input.topic?.level, 'N2')
  assert.equal(m.topic?.level, 'N4', '주제 재료는 그대로')
  const req = buildLessonRequest(input)
  const user = req.messages.map((x) => x.content).join('\n')
  assert.match(user, /\[주제\][^\n]*· 수준 N2/)
  assert.doesNotMatch(user, /\[주제\][^\n]*· 수준 N4/)
})
