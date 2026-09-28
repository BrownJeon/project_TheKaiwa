import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { completeJson, renderTranscript, type LlmExtraCheckInfo } from '../../engine/llm'
import { routerDeps, type ResolvedConnection } from '../../engine/router'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkLessonResponse } from '../structuredResponse/checks'
import { repairLessonResponse, LESSON_REPAIR_CHUNKS_MAX, type LessonRepairSourceChunk } from '../structuredResponse/repair'
import { LESSON_READING_PATTERN, LESSON_SCHEMA, type ChunkType, type LessonChunkOut, type LessonResponse } from '../structuredResponse/schemas'
import { loadPersona } from '../persona/loader'
import {
  buildLessonRequest,
  LessonInputError,
  LESSON_HEADER_CAP,
  LESSON_MAX_ACCEPTED_CORRECTIONS,
  LESSON_MAX_PREVIOUS_TITLES,
  LESSON_MAX_TOPIC_CHUNKS,
  LESSON_PROMPT_VERSION,
  LESSON_SOURCE_TEXT_MAX,
  LESSON_SOURCE_TEXT_MIN,
  LESSON_USER_PROMPT_CAP,
  type LessonTopicChunkInput,
  type LessonTopicInput,
} from '../prompts/lesson'

interface Fixture {
  topic: LessonTopicInput
  sourceText: string
  acceptedCorrections: { original: string; corrected: string }[]
  previousTitles: string[]
  previousNextPreview: { titleKo: string; teaserKo: string }
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/lesson.json'), 'utf8')) as Fixture

const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

/** fixture.topic.chunks 전부(12개 모두 reading 있음, §"픽스처" 테스트가 확인) 를 repairLessonResponse 재료 형태로. */
const repairSourceChunks: LessonRepairSourceChunk[] = fixture.topic.chunks.map((c) => ({
  id: c.id,
  chunkType: c.chunkType,
  textJa: c.textJa,
  reading: c.reading!,
  meaningKo: c.meaningKo,
}))
/** 8개짜리 새 표현 조각(입력 조각과 무관) — 8개 상한 시나리오에서 chunks 를 채우는 용도. */
function syntheticNewChunk(n: number): LessonChunkOut {
  return { id: `new-${n}`, textJa: `単語${n}`, reading: `たんご${n}`, meaningKo: `단어${n}`, chunkType: 'MODIFIER', isNew: true }
}

// ── 합성 응답(스키마·후검증 통과용) ──────────────────────────────────────────

function validLessonResponse(topic: LessonTopicInput): LessonResponse {
  const [c1, c2, c3, c4] = topic.chunks
  return {
    title: '自己紹介レッスン',
    titleKo: '자기소개 수업',
    rolesKo: { A: '학생', B: '선생님' },
    dialogue: [
      { speaker: 'A', ja: 'はじめまして。', reading: 'はじめまして。', ko: '처음 뵙겠습니다.' },
      { speaker: 'B', ja: 'はじめまして。よろしくお願いします。', reading: 'はじめまして。よろしくおねがいします。', ko: '처음 뵙겠습니다. 잘 부탁합니다.' },
      { speaker: 'A', ja: '私の名前はブラウンです。', reading: 'わたしのなまえはぶらうんです。', ko: '제 이름은 브라운입니다.' },
      { speaker: 'B', ja: '韓国から来ましたか。', reading: 'かんこくからきましたか。', ko: '한국에서 왔나요?' },
      { speaker: 'A', ja: 'はい、韓国から来ました。', reading: 'はい、かんこくからきました。', ko: '네, 한국에서 왔습니다.' },
      { speaker: 'B', ja: '会社員ですか。', reading: 'かいしゃいんですか。', ko: '회사원인가요?' },
    ],
    chunks: [
      { id: c1.id, textJa: c1.textJa, reading: c1.reading!, meaningKo: c1.meaningKo, chunkType: c1.chunkType, isNew: false },
      { id: c2.id, textJa: c2.textJa, reading: c2.reading!, meaningKo: c2.meaningKo, chunkType: c2.chunkType, isNew: false },
      { id: c3.id, textJa: c3.textJa, reading: c3.reading!, meaningKo: c3.meaningKo, chunkType: c3.chunkType, isNew: false },
      { id: c4.id, textJa: c4.textJa, reading: c4.reading!, meaningKo: c4.meaningKo, chunkType: c4.chunkType, isNew: false },
      { id: 'new-1', textJa: '来ました', reading: 'きました', meaningKo: '왔습니다', chunkType: 'ACTION', isNew: true },
    ],
    grammar: [
      { id: 'g1', pattern: '〜から来ました', explanationKo: '출신지를 말할 때 쓰는 표현이에요.', exampleJa: '日本から来ました。', exampleReading: 'にほんからきました。', exampleKo: '일본에서 왔습니다.' },
    ],
    quiz: [
      { id: 'q1', promptKo: '「はじめまして」의 뜻은?', promptJa: null, choices: ['처음 뵙겠습니다', '안녕히 가세요', '감사합니다', '미안합니다'], answer: 0, targetIds: [c1.id], explanationKo: '첫 인사 표현이에요.' },
      { id: 'q2', promptKo: null, promptJa: '「＿＿から来ました」의 빈칸에 알맞은 것은?', choices: ['韓国', '会社', '名前', '嬉しい'], answer: 0, targetIds: ['g1'], explanationKo: '출신 국가를 넣어요.' },
      { id: 'q3', promptKo: '올바른 문형은?', promptJa: null, choices: ['会社員です', '会社員だ', '会社員でした', '会社員だった'], answer: 0, targetIds: [c3.id], explanationKo: '정중체 です 를 씁니다.' },
      { id: 'q4', promptKo: '「名前」의 뜻은?', promptJa: null, choices: ['이름', '기쁘다', '살다', '일하다'], answer: 0, targetIds: [c2.id], explanationKo: '이번 수업에서 배운 표현이에요.' },
      { id: 'q5', promptKo: '来ました 의 읽기는?', promptJa: null, choices: ['きました', 'いきました', 'かきました', 'みました'], answer: 0, targetIds: ['new-1'], explanationKo: '来る의 과거형이에요.' },
    ],
    application: [
      { id: 'a1', promptKo: '자신의 이름을 소개해 보세요.', hintJa: '私の名前は〜です。', modelAnswerJa: '私の名前はブラウンです。', modelReading: 'わたしのなまえはぶらうんです。', modelKo: '제 이름은 브라운입니다.', targetIds: [c1.id, c2.id] },
      { id: 'a2', promptKo: '어디에서 왔는지 말해 보세요.', hintJa: null, modelAnswerJa: '韓国から来ました。', modelReading: 'かんこくからきました。', modelKo: '한국에서 왔습니다.', targetIds: ['g1'] },
      { id: 'a3', promptKo: '직업을 소개해 보세요.', hintJa: null, modelAnswerJa: '会社員です。', modelReading: 'かいしゃいんです。', modelKo: '회사원입니다.', targetIds: [c3.id] },
    ],
    // 2026-09-28 Leader 3차 결정: modelAnswerJa 가 자기 targetIds 의 textJa/reading 을 실제로 담아야 한다
    // (checkLessonResponse ④·repairLessonResponse ④) — 그래서 각 답이 대응하는 조각 표기를 그대로 담게 짰다.
    speaking: [
      { id: 's1', promptKo: '자신을 가리켜 말해 보세요.', targetIds: [c1.id], modelAnswerJa: '私です。', modelReading: 'わたしです。', modelKo: '저예요.' },
      { id: 's2', promptKo: '이름과 직업을 소개해 보세요.', targetIds: [c2.id, c3.id], modelAnswerJa: '名前はブラウンです。会社員です。', modelReading: 'なまえはぶらうんです。かいしゃいんです。', modelKo: '이름은 브라운입니다. 회사원입니다.' },
      { id: 's3', promptKo: '지금 어디에 사는지 말해 보세요.', targetIds: [c4.id], modelAnswerJa: '東京に住んでいます。', modelReading: 'とうきょうにすんでいます。', modelKo: '도쿄에 살고 있습니다.' },
    ],
    nextPreview: { titleKo: '취미 이야기하기', teaserKo: '다음엔 좋아하는 것을 물어보는 표현을 배워요.' },
  }
}

test('픽스처: 주제 12조각(NAME/ACTION/FEELING/MODIFIER 각 3) · sourceText 50~2,000자 · 일본어 비율 ≥30%', () => {
  assert.equal(fixture.topic.chunks.length, 12)
  const byType = new Map<ChunkType, number>()
  for (const c of fixture.topic.chunks) byType.set(c.chunkType, (byType.get(c.chunkType) ?? 0) + 1)
  assert.deepEqual([...byType.values()].sort(), [3, 3, 3, 3])
  assert.ok(fixture.sourceText.length >= LESSON_SOURCE_TEXT_MIN && fixture.sourceText.length <= LESSON_SOURCE_TEXT_MAX)
})

// ── buildLessonRequest 기본 형태 ──────────────────────────────────────────

test('buildLessonRequest(topic): task·persona·jsonSchema·메시지 형태, allowedChunkIds 가 topic.chunks.id 그대로', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  assert.equal(req.task, 'lesson')
  assert.equal(req.persona?.name, 'tutor')
  assert.equal(req.jsonSchema, LESSON_SCHEMA)
  assert.equal(req.messages.length, 1)
  assert.equal(req.messages[0].role, 'user')
  assert.deepEqual(req.allowedChunkIds, fixture.topic.chunks.map((c) => c.id))
  assert.equal(req.skippedChunks, 0)
  assert.match(req.system, /\[모드\] LESSON/)
  assert.match(req.system, /\[난이도\] N4/)
  assert.ok(req.messages[0].content.includes('[주제]'))
  assert.ok(req.messages[0].content.includes('id=chunk-01'))
})

test('buildLessonRequest(sourceText): [원문] 블록, allowedChunkIds=[], skippedChunks=0', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: fixture.sourceText })
  assert.equal(req.task, 'lesson')
  assert.deepEqual(req.allowedChunkIds, [])
  assert.equal(req.skippedChunks, 0)
  assert.ok(req.messages[0].content.startsWith('[원문]'))
  assert.ok(req.messages[0].content.includes(fixture.sourceText), 'sourceText 는 자르지 않고 그대로 담아야 한다')
})

test('topic·sourceText 는 정확히 하나만 — 둘 다 주거나 둘 다 안 주면 LessonInputError', () => {
  assert.throws(() => buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic, sourceText: fixture.sourceText }), LessonInputError)
  assert.throws(() => buildLessonRequest({ todayKst: '2026-09-28', learner }), LessonInputError)
})

test('sourceText 길이 상한 — 50자 미만·2,000자 초과는 LessonInputError', () => {
  assert.throws(() => buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: 'あ'.repeat(LESSON_SOURCE_TEXT_MIN - 1) }), LessonInputError)
  assert.throws(() => buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: 'あ'.repeat(LESSON_SOURCE_TEXT_MAX + 1) }), LessonInputError)
  // 경계값은 통과해야 한다.
  assert.doesNotThrow(() => buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: 'あ'.repeat(LESSON_SOURCE_TEXT_MIN) }))
  assert.doesNotThrow(() => buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: 'あ'.repeat(LESSON_SOURCE_TEXT_MAX) }))
})

test('sourceText 일본어 비율 <30% 는 LessonInputError(인젝션·엉뚱한 붙여넣기 가드)', () => {
  const notJapanese = 'This is an English paragraph pretending to be a Japanese lesson source text input for testing purposes only today.'.padEnd(60, ' x')
  assert.throws(() => buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: notJapanese }), LessonInputError)
})

test('topic.chunks 가 비어 있으면 LessonInputError', () => {
  assert.throws(() => buildLessonRequest({ todayKst: '2026-09-28', learner, topic: { ...fixture.topic, chunks: [] } }), LessonInputError)
})

test(`topic.chunks 가 ${LESSON_MAX_TOPIC_CHUNKS}개를 넘으면 앞에서부터 잘라 skippedChunks 로 알린다`, () => {
  const many: LessonTopicChunkInput[] = Array.from({ length: LESSON_MAX_TOPIC_CHUNKS + 7 }, (_, i) => ({
    id: `c${i}`,
    chunkType: (['NAME', 'ACTION', 'FEELING', 'MODIFIER'] as const)[i % 4],
    textJa: `単語${i}`,
    reading: `たんご${i}`,
    meaningKo: `단어${i}`,
  }))
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: { ...fixture.topic, chunks: many } })
  assert.equal(req.skippedChunks, 7)
  assert.equal(req.allowedChunkIds.length, LESSON_MAX_TOPIC_CHUNKS)
  assert.deepEqual(req.allowedChunkIds, many.slice(0, LESSON_MAX_TOPIC_CHUNKS).map((c) => c.id))
  assert.ok(req.messages[0].content.includes('id=c0'))
  assert.ok(!req.messages[0].content.includes(`id=c${LESSON_MAX_TOPIC_CHUNKS}`), '상한을 넘는 조각은 프롬프트에 실리지 않아야 한다')
})

test(`acceptedCorrections·previousTitles 는 각 ${LESSON_MAX_ACCEPTED_CORRECTIONS}·${LESSON_MAX_PREVIOUS_TITLES}개로 잘린다`, () => {
  const corrections = Array.from({ length: 12 }, (_, i) => ({ original: `원문${i}`, corrected: `교정${i}` }))
  const titles = Array.from({ length: 12 }, (_, i) => `수업제목${i}`)
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic, acceptedCorrections: corrections, previousTitles: titles })
  const body = req.messages[0].content
  for (let i = 0; i < LESSON_MAX_ACCEPTED_CORRECTIONS; i++) assert.ok(body.includes(`원문${i}`), `correction ${i} 는 남아야 한다`)
  for (let i = LESSON_MAX_ACCEPTED_CORRECTIONS; i < 12; i++) assert.ok(!body.includes(`원문${i}`), `correction ${i} 는 잘려야 한다`)
  for (let i = 0; i < LESSON_MAX_PREVIOUS_TITLES; i++) assert.ok(body.includes(`수업제목${i}`), `title ${i} 는 남아야 한다`)
  for (let i = LESSON_MAX_PREVIOUS_TITLES; i < 12; i++) assert.ok(!body.includes(`수업제목${i}`), `title ${i} 는 잘려야 한다`)
})

test('헤더 상한(≤600) 준수', () => {
  const heavy = { ...learner, displayName: '브라운'.repeat(30), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner: heavy, topic: fixture.topic })
  const headerLine = req.system.split('\n').find((l) => l.startsWith('[학습자]'))!
  assert.ok(headerLine.length <= LESSON_HEADER_CAP)
})

// ── 프롬프트 예산 회귀(최악 입력 조합 ≤ 상한) ────────────────────────────────

test('예산: 주제 경로 — 조각·교정·이전 제목·직전 예고를 전부 상한까지 채운 최악 조합도 ≤ LESSON_USER_PROMPT_CAP', () => {
  const heavyLearner = {
    displayName: '브라운'.repeat(10), teacherName: '유우'.repeat(5), level: 'N3',
    strictness: 'STRICT' as const, correctionMode: 'COACH' as const, explainDepth: 'DETAILED' as const,
    goal: 'x'.repeat(400), streakDays: 999, weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), dueReviews: 99,
  }
  const chunks: LessonTopicChunkInput[] = Array.from({ length: 40 }, (_, i) => ({
    id: `clx${'a'.repeat(22)}${i}`,
    chunkType: (['NAME', 'ACTION', 'FEELING', 'MODIFIER'] as const)[i % 4],
    textJa: 'あ'.repeat(120),
    reading: 'あ'.repeat(160),
    meaningKo: '가'.repeat(160),
  }))
  const corrections = Array.from({ length: 20 }, () => ({ original: 'あ'.repeat(1_000), corrected: 'あ'.repeat(1_000) }))
  const previousTitles = Array.from({ length: 20 }, () => 'あ'.repeat(120))
  const req = buildLessonRequest({
    todayKst: '2026-09-28',
    learner: heavyLearner,
    topic: { title: 'あ'.repeat(80), titleJa: 'あ'.repeat(80), level: 'N3', chunks },
    acceptedCorrections: corrections,
    previousTitles,
    previousNextPreview: { titleKo: '가'.repeat(40), teaserKo: '가'.repeat(60) },
  })
  const prompt = renderTranscript(req.system, req.messages)
  assert.ok(prompt.length <= LESSON_USER_PROMPT_CAP, `주제 경로 최악 조합 ${prompt.length}자 > ${LESSON_USER_PROMPT_CAP}`)
})

test('예산: sourceText 경로 — 2,000자 원문 + 교정·이전 제목·직전 예고 최악 조합도 ≤ LESSON_USER_PROMPT_CAP', () => {
  const heavyLearner = { ...learner, displayName: '브라운'.repeat(10), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
  const corrections = Array.from({ length: 20 }, () => ({ original: 'あ'.repeat(1_000), corrected: 'あ'.repeat(1_000) }))
  const previousTitles = Array.from({ length: 20 }, () => 'あ'.repeat(120))
  const req = buildLessonRequest({
    todayKst: '2026-09-28',
    learner: heavyLearner,
    sourceText: 'あ'.repeat(LESSON_SOURCE_TEXT_MAX),
    acceptedCorrections: corrections,
    previousTitles,
    previousNextPreview: { titleKo: '가'.repeat(40), teaserKo: '가'.repeat(60) },
  })
  const prompt = renderTranscript(req.system, req.messages)
  assert.ok(prompt.length <= LESSON_USER_PROMPT_CAP, `sourceText 경로 최악 조합 ${prompt.length}자 > ${LESSON_USER_PROMPT_CAP}`)
})

test('예산: 시드 주제 수준의 정상 입력은 캡의 절반에도 못 미친다(여유 확인용 sanity)', () => {
  const req = buildLessonRequest({
    todayKst: '2026-09-28', learner, topic: fixture.topic,
    acceptedCorrections: fixture.acceptedCorrections, previousTitles: fixture.previousTitles, previousNextPreview: fixture.previousNextPreview,
  })
  const prompt = renderTranscript(req.system, req.messages)
  assert.ok(prompt.length < LESSON_USER_PROMPT_CAP / 2, `정상 입력 ${prompt.length}자`)
})

// ── persona 안정성·경계(REV-004 계열) ────────────────────────────────────

test('persona(→ --system-prompt)는 topic·교정·이전 제목이 달라도 바이트 동일(같은 학습자·같은 수준·같은 모드) — TALK K4-3 과 같은 전제', () => {
  const a = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  const b = buildLessonRequest({
    todayKst: '2026-10-05', learner: { ...learner, streakDays: 99 }, sourceText: fixture.sourceText,
    acceptedCorrections: fixture.acceptedCorrections, previousTitles: fixture.previousTitles,
  })
  assert.equal(a.persona!.prompt, b.persona!.prompt)
  assert.ok(!a.persona!.prompt.includes('自己紹介'), '주제 내용은 persona 가 아니라 messages 쪽에만 있어야 한다')
})

test('입력 경계: topic·sourceText 데이터는 [입력] 블록(messages)에만, system 에는 새지 않는다', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  assert.ok(!req.system.includes('chunk-01'), '조각 id 는 system 이 아니라 messages 쪽에 있어야 한다')
  // meaningKo("저" 등)는 한 글자짜리라 system 의 다른 한국어 지시문 안에 우연히 나타날 수 있어(예: "저장해라") 검사에 못 쓴다.
  // chunks[0].textJa("私")도 못 쓴다 — lesson@v2 의 reading 금지 예시 문구가 일반적인 한자 예문("私は元気です。")을 담고 있어
  // 우연히 겹친다. 대신 여러 글자짜리·지시문에 나올 리 없는 chunks[3].textJa("住んでいます")로 실제 데이터가 system 에 새지
  // 않았는지 본다.
  assert.ok(!req.system.includes(fixture.topic.chunks[3].textJa), '조각 표기는 system 이 아니라 messages 쪽에 있어야 한다')
})

// ── LESSON_SCHEMA ──────────────────────────────────────────────────────

test('LESSON_SCHEMA: 유효 응답 통과, 스키마 밖 필드·필수 누락·개수 위반은 실패', () => {
  const ok = validLessonResponse(fixture.topic)
  assert.deepEqual(validateOutput(ok, LESSON_SCHEMA), { ok: true })
  assert.equal(validateOutput({ ...ok, extra: 1 }, LESSON_SCHEMA).ok, false)
  const missingTitle: Record<string, unknown> = { ...ok }
  delete missingTitle.title
  assert.equal(validateOutput(missingTitle, LESSON_SCHEMA).ok, false)
  assert.equal(validateOutput({ ...ok, quiz: ok.quiz.slice(0, 4) }, LESSON_SCHEMA).ok, false, 'quiz 는 정확히 5개')
  assert.equal(validateOutput({ ...ok, dialogue: ok.dialogue.slice(0, 4) }, LESSON_SCHEMA).ok, false, 'dialogue 는 최소 6개')
  assert.equal(validateOutput({ ...ok, application: [...ok.application, ok.application[0]] }, LESSON_SCHEMA).ok, false, 'application 은 정확히 3개')
})

test('LESSON_SCHEMA: quiz.choices 중복은 uniqueItems 위반, 4개가 아니면 위반', () => {
  const ok = validLessonResponse(fixture.topic)
  const dupChoices = { ...ok, quiz: [{ ...ok.quiz[0], choices: ['같음', '같음', 'A', 'B'] }, ...ok.quiz.slice(1)] }
  assert.equal(validateOutput(dupChoices, LESSON_SCHEMA).ok, false)
  const threeChoices = { ...ok, quiz: [{ ...ok.quiz[0], choices: ['A', 'B', 'C'] }, ...ok.quiz.slice(1)] }
  assert.equal(validateOutput(threeChoices, LESSON_SCHEMA).ok, false)
})

test('LESSON_SCHEMA: reading 계열 필드는 가나(히라가나+가타카나, +장음·문장부호)만 — 한자·로마자·한글은 위반(lesson@v3)', () => {
  const ok = validLessonResponse(fixture.topic)
  const kanjiReading = { ...ok, dialogue: [{ ...ok.dialogue[0], reading: '私は元気です。' }, ...ok.dialogue.slice(1)] }
  assert.equal(validateOutput(kanjiReading, LESSON_SCHEMA).ok, false)
  const romajiReading = { ...ok, grammar: [{ ...ok.grammar[0], exampleReading: 'nihon kara kimashita' }] }
  assert.equal(validateOutput(romajiReading, LESSON_SCHEMA).ok, false)
  const hangulReading = { ...ok, chunks: [{ ...ok.chunks[0], reading: '와타시' }, ...ok.chunks.slice(1)] }
  assert.equal(validateOutput(hangulReading, LESSON_SCHEMA).ok, false)
  // v3: 가타카나(외래어 표기)는 이제 통과해야 한다 — sourceText 실측(8회 중 4회 FAILED)의 원인이 이 규칙 자체였다.
  const katakanaReading = { ...ok, chunks: [{ ...ok.chunks[0], reading: 'ワタシ' }, ...ok.chunks.slice(1)] }
  assert.deepEqual(validateOutput(katakanaReading, LESSON_SCHEMA), { ok: true })
  const katakanaLoanword = { ...ok, dialogue: [{ ...ok.dialogue[0], reading: 'コーヒーをおねがいします。' }, ...ok.dialogue.slice(1)] }
  assert.deepEqual(validateOutput(katakanaLoanword, LESSON_SCHEMA), { ok: true }, '히라가나+가타카나 혼용도 통과해야 한다')
})

test('LESSON_SCHEMA: reading 계열 필드는 일본어 괄호형 인용부호(「」『』)도 통과해야 한다(lesson@v4, 운영 11b 후속)', () => {
  const ok = validLessonResponse(fixture.topic)
  // 운영 스모크 원문의 대화체 인용(「ご注文はお決まりですか」)을 재현 — v3 패턴(히라가나+가타카나만)은 이 두 문자만으로
  // 거부했었다(tests/live/lesson-paste-raw-capture.ts 로 확보한 실제 실패 원문과 같은 모양).
  const quotedReading = { ...ok, dialogue: [{ ...ok.dialogue[0], reading: 'てんいんさんに「ごちゅうもんはおきまりですか」ときかれました。' }, ...ok.dialogue.slice(1)] }
  assert.deepEqual(validateOutput(quotedReading, LESSON_SCHEMA), { ok: true }, '「」 인용부호가 포함된 reading 도 통과해야 한다')
  const nestedQuote = { ...ok, grammar: [{ ...ok.grammar[0], exampleReading: 'せんせいは『がんばって』といいました。' }] }
  assert.deepEqual(validateOutput(nestedQuote, LESSON_SCHEMA), { ok: true }, '『』(이중 인용부호)도 통과해야 한다')
  // 괄호가 있어도 한자·로마자·한글은 여전히 위반이어야 한다(패턴이 무분별하게 넓어지지 않았는지 확인).
  const kanjiWithQuote = { ...ok, dialogue: [{ ...ok.dialogue[0], reading: '「私」と言いました。' }, ...ok.dialogue.slice(1)] }
  assert.equal(validateOutput(kanjiWithQuote, LESSON_SCHEMA).ok, false, '인용부호 허용이 한자까지 열어주면 안 된다')
})

// ── checkLessonResponse ────────────────────────────────────────────────

test('checkLessonResponse: 유효 응답은 위반 0', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  assert.deepEqual(checkLessonResponse({ allowedChunkIds }, ok), [])
})

test('checkLessonResponse: 입력에 없는 chunk id(new- 형식도 아님)는 위반', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const bad = { ...ok, chunks: [{ ...ok.chunks[0], id: 'made-up-id' }, ...ok.chunks.slice(1)] }
  const v = checkLessonResponse({ allowedChunkIds }, bad)
  assert.ok(v.some((m) => m.includes('made-up-id')))
})

test('checkLessonResponse: 중복 chunk id 는 위반', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const bad = { ...ok, chunks: [ok.chunks[0], ok.chunks[0], ...ok.chunks.slice(2)] }
  const v = checkLessonResponse({ allowedChunkIds }, bad)
  assert.ok(v.some((m) => m.includes('중복')))
})

test('checkLessonResponse: isNew 불일치(기존 id 인데 true / new- 인데 false)는 위반', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const wrongTrue = { ...ok, chunks: [{ ...ok.chunks[0], isNew: true }, ...ok.chunks.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, wrongTrue).some((m) => m.includes('isNew=false')))
  const wrongFalse = { ...ok, chunks: [...ok.chunks.slice(0, 4), { ...ok.chunks[4], isNew: false }] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, wrongFalse).some((m) => m.includes('isNew=true')))
})

test('checkLessonResponse: targetIds 가 이 레슨의 chunks·grammar id 밖이면 위반(quiz·application·speaking 전부)', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const badQuiz = { ...ok, quiz: [{ ...ok.quiz[0], targetIds: ['no-such-id'] }, ...ok.quiz.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, badQuiz).some((m) => m.includes('quiz[0]') && m.includes('no-such-id')))
  const badApp = { ...ok, application: [{ ...ok.application[0], targetIds: ['no-such-id'] }, ...ok.application.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, badApp).some((m) => m.includes('application[0]')))
  const badSpeaking = { ...ok, speaking: [{ ...ok.speaking[0], targetIds: ['no-such-id'] }, ...ok.speaking.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, badSpeaking).some((m) => m.includes('speaking[0]')))
})

test('checkLessonResponse: quiz.promptKo·promptJa 가 둘 다 null 이면 위반', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const bothNull = { ...ok, quiz: [{ ...ok.quiz[0], promptKo: null, promptJa: null }, ...ok.quiz.slice(1)] }
  const v = checkLessonResponse({ allowedChunkIds }, bothNull)
  assert.ok(v.some((m) => m.includes('promptKo') && m.includes('promptJa')))
})

test('checkLessonResponse: 일본어 필드(ja·textJa·exampleJa·modelAnswerJa)에 한글이 섞이면 위반', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const hangulDialogue = { ...ok, dialogue: [{ ...ok.dialogue[0], ja: '안녕하세요。' }, ...ok.dialogue.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, hangulDialogue).some((m) => m.includes('dialogue[0].ja')))
  const hangulChunk = { ...ok, chunks: [{ ...ok.chunks[0], textJa: '안녕' }, ...ok.chunks.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, hangulChunk).some((m) => m.includes('chunks[0].textJa')))
  const hangulGrammar = { ...ok, grammar: [{ ...ok.grammar[0], exampleJa: '안녕하세요' }] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, hangulGrammar).some((m) => m.includes('grammar[0].exampleJa')))
  const hangulApp = { ...ok, application: [{ ...ok.application[0], modelAnswerJa: '안녕' }, ...ok.application.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, hangulApp).some((m) => m.includes('application[0].modelAnswerJa')))
  const hangulSpeaking = { ...ok, speaking: [{ ...ok.speaking[0], modelAnswerJa: '안녕' }, ...ok.speaking.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds }, hangulSpeaking).some((m) => m.includes('speaking[0].modelAnswerJa')))
})

test('checkLessonResponse: 엔진·모델 이름이 어디든 섞이면 위반(엔진명 비노출)', () => {
  const ok = validLessonResponse(fixture.topic)
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const leaked = { ...ok, nextPreview: { ...ok.nextPreview, teaserKo: 'Claude 선생님이 준비했어요' } }
  const v = checkLessonResponse({ allowedChunkIds }, leaked)
  assert.ok(v.some((m) => m.includes('엔진')))
})

// ── repairLessonResponse(task-010 신뢰도 보강, lesson@v2) ────────────────────

test('repairLessonResponse: 자리가 있으면(chunks<LESSON_REPAIR_CHUNKS_MAX) 입력 조각 데이터로 채워 넣는다(isNew:false), targetIds 는 그대로', () => {
  const ok = validLessonResponse(fixture.topic) // chunks 5개(c1~c4 + new-1) — 8개 미만
  const missing = fixture.topic.chunks.find((c) => c.id === 'chunk-07')! // FEELING 嬉しいです — ok.chunks 에는 없음
  const data = { ...ok, quiz: [{ ...ok.quiz[0], targetIds: [...ok.quiz[0].targetIds, missing.id] }, ...ok.quiz.slice(1)] }
  assert.equal(data.chunks.length, 5)
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 1, removed: 0, contentMismatchRemoved: 0 })
  assert.equal(data.chunks.length, 6)
  const added = data.chunks.find((c) => c.id === missing.id)
  assert.ok(added, '입력 조각이 chunks 에 채워져야 한다')
  assert.equal(added!.textJa, missing.textJa)
  assert.equal(added!.reading, missing.reading)
  assert.equal(added!.meaningKo, missing.meaningKo)
  assert.equal(added!.chunkType, missing.chunkType)
  assert.equal(added!.isNew, false, '입력 조각을 채워 넣은 것이므로 isNew=false')
  assert.ok(data.quiz[0].targetIds.includes(missing.id), 'targetIds 는 건드리지 않는다(이제 유효한 참조가 됐다)')
  // 보정 뒤에는 checkLessonResponse 위반도 사라져야 한다.
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  assert.deepEqual(checkLessonResponse({ allowedChunkIds }, data), [])
})

test('repairLessonResponse: chunks 가 이미 LESSON_REPAIR_CHUNKS_MAX(10, 보정 전용 상한)면 채우지 않고 targetIds 에서 뺀다(다른 참조가 남아 있으면)', () => {
  const ok = validLessonResponse(fixture.topic)
  // ok.chunks 는 5개(c1~c4 + new-1) — 합성 조각 5개를 더해 보정 전용 상한 10개를 채운다(LLM 이 아는 스키마 상한 8 이 아니다).
  const tenChunks: LessonChunkOut[] = [...ok.chunks, syntheticNewChunk(2), syntheticNewChunk(3), syntheticNewChunk(4), syntheticNewChunk(5), syntheticNewChunk(6)]
  assert.equal(tenChunks.length, LESSON_REPAIR_CHUNKS_MAX)
  const missing = fixture.topic.chunks.find((c) => c.id === 'chunk-07')!
  const c1 = fixture.topic.chunks[0]
  const data = {
    ...ok,
    chunks: tenChunks,
    speaking: [{ ...ok.speaking[0], targetIds: [missing.id, c1.id] }, ...ok.speaking.slice(1)], // 다른 유효 id 와 함께라 비지 않는다
  }
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 0, removed: 1, contentMismatchRemoved: 0 })
  assert.equal(data.chunks.length, LESSON_REPAIR_CHUNKS_MAX, 'chunks 는 보정 전용 상한을 넘지 않는다')
  assert.ok(!data.chunks.some((c) => c.id === missing.id), '자리가 없으면 채우지 않는다')
  assert.deepEqual(data.speaking[0].targetIds, [c1.id], 'targetIds 에서 빠지고 유효한 id 만 남는다')
})

test('repairLessonResponse: 빼면 targetIds 가 빈 배열이 되는 occurrence 는 손대지 않는다(위반이 그대로 남는다)', () => {
  const ok = validLessonResponse(fixture.topic)
  const tenChunks: LessonChunkOut[] = [...ok.chunks, syntheticNewChunk(2), syntheticNewChunk(3), syntheticNewChunk(4), syntheticNewChunk(5), syntheticNewChunk(6)]
  assert.equal(tenChunks.length, LESSON_REPAIR_CHUNKS_MAX)
  const missing = fixture.topic.chunks.find((c) => c.id === 'chunk-10')!
  const data = { ...ok, chunks: tenChunks, application: [{ ...ok.application[0], targetIds: [missing.id] }, ...ok.application.slice(1)] }
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 0, removed: 0, contentMismatchRemoved: 0 })
  assert.deepEqual(data.application[0].targetIds, [missing.id], '빈 배열이 될 occurrence 는 원래대로 둔다')
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  assert.ok(checkLessonResponse({ allowedChunkIds }, data).some((m) => m.includes('application[0]')), '보정하지 않았으니 위반이 남아야 한다')
})

test('repairLessonResponse: 8개 상태에서 시작하면 10개(보정 전용 상한)까지 채우고, 그 다음(11번째 자리)은 제거한다(Leader 2차 결정 회귀)', () => {
  const ok = validLessonResponse(fixture.topic)
  // ok.chunks 는 5개 — 합성 조각 3개를 더해 "모델이 실제로 낼 수 있는" 스키마 상한 8개로 시작한다.
  const eightChunks: LessonChunkOut[] = [...ok.chunks, syntheticNewChunk(2), syntheticNewChunk(3), syntheticNewChunk(4)]
  assert.equal(eightChunks.length, 8)
  const m1 = fixture.topic.chunks.find((c) => c.id === 'chunk-07')! // 9번째로 채워질 것
  const m2 = fixture.topic.chunks.find((c) => c.id === 'chunk-08')! // 10번째로 채워질 것
  const m3 = fixture.topic.chunks.find((c) => c.id === 'chunk-09')! // 자리가 없어 제거될 것
  const c1 = fixture.topic.chunks[0]
  const data = {
    ...ok,
    chunks: eightChunks,
    quiz: [{ ...ok.quiz[0], targetIds: [m1.id] }, { ...ok.quiz[1], targetIds: [m2.id] }, ...ok.quiz.slice(2)],
    // m3 는 유효한 c1.id 와 함께 둬서 "빼면 빈 배열" 규칙에 걸리지 않게 한다(순수하게 자리 부족만 시험).
    speaking: [{ ...ok.speaking[0], targetIds: [m3.id, c1.id] }, ...ok.speaking.slice(1)],
  }
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 2, removed: 1, contentMismatchRemoved: 0 }, 'm1·m2 는 채워지고(8→9→10), m3 는 상한 도달 후라 제거된다')
  assert.equal(data.chunks.length, LESSON_REPAIR_CHUNKS_MAX)
  assert.ok(data.chunks.some((c) => c.id === m1.id) && data.chunks.some((c) => c.id === m2.id), 'm1·m2 는 채워져야 한다')
  assert.ok(!data.chunks.some((c) => c.id === m3.id), 'm3 는 자리가 없어 채워지지 않아야 한다')
  assert.deepEqual(data.quiz[0].targetIds, [m1.id])
  assert.deepEqual(data.quiz[1].targetIds, [m2.id])
  assert.deepEqual(data.speaking[0].targetIds, [c1.id], 'm3 는 targetIds 에서 빠지고 유효한 id 만 남는다')
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  assert.deepEqual(checkLessonResponse({ allowedChunkIds }, data), [], '보정 뒤 위반이 전부 사라져야 한다')
})

test('repairLessonResponse: 입력에도 없는 id(환각)는 손대지 않는다', () => {
  const ok = validLessonResponse(fixture.topic)
  const data = { ...ok, quiz: [{ ...ok.quiz[0], targetIds: ['totally-made-up-id'] }, ...ok.quiz.slice(1)] }
  const before = data.chunks.length
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 0, removed: 0, contentMismatchRemoved: 0 })
  assert.equal(data.chunks.length, before)
  assert.deepEqual(data.quiz[0].targetIds, ['totally-made-up-id'])
})

test('repairLessonResponse: 여러 occurrence 에서 같은 id 를 채웠으면 전부 유효해진다(한 번만 채움)', () => {
  const ok = validLessonResponse(fixture.topic)
  const missing = fixture.topic.chunks.find((c) => c.id === 'chunk-09')!
  const data = {
    ...ok,
    quiz: [{ ...ok.quiz[0], targetIds: [missing.id] }, ...ok.quiz.slice(1)],
    application: [{ ...ok.application[0], targetIds: [missing.id] }, ...ok.application.slice(1)],
  }
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 1, removed: 0, contentMismatchRemoved: 0 }, '같은 id 는 한 번만 채우면 모든 occurrence 가 유효해진다')
  assert.equal(data.chunks.filter((c) => c.id === missing.id).length, 1, 'chunks 에 중복으로 채우지 않는다')
})

// ── repairLessonResponse ④ · checkLessonResponse ④ (2026-09-28 Leader 3차 결정 — 모범 답이 목표 표현을 담지 않는 경우) ──

test('repairLessonResponse: 모범 답이 목표 chunk 표현을 담지 않으면 그 id 를 targetIds 에서 뺀다(다른 유효 참조가 남아 있으면)', () => {
  const ok = validLessonResponse(fixture.topic)
  const c1 = fixture.topic.chunks[0] // 私 — s1 의 modelAnswerJa('私です。')에 실제로 담겨 있다
  const c2 = fixture.topic.chunks[1] // 名前 — speaking[0] 의 modelAnswerJa 에는 없다(담지 않은 표현)
  const data = { ...ok, speaking: [{ ...ok.speaking[0], targetIds: [c1.id, c2.id] }, ...ok.speaking.slice(1)] }
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 0, removed: 0, contentMismatchRemoved: 1 }, 'c2(名前)는 모범 답에 없어 빠지고, c1(私)만 남아야 한다')
  assert.deepEqual(data.speaking[0].targetIds, [c1.id])
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  assert.deepEqual(checkLessonResponse({ allowedChunkIds }, data), [], '보정 뒤에는 위반이 없어야 한다')
})

test('repairLessonResponse: 모범 답이 유일한 목표 chunk 표현을 담지 않으면(빼면 빈 배열) 손대지 않고 checkLessonResponse 가 위반으로 잡는다', () => {
  const ok = validLessonResponse(fixture.topic)
  const c2 = fixture.topic.chunks[1] // 名前 — application[0] 의 원래 modelAnswerJa('私の名前はブラウンです。')에는 있지만, 여기선 안 담긴 답으로 바꿔 시험한다
  const data = {
    ...ok,
    application: [{ ...ok.application[0], targetIds: [c2.id], modelAnswerJa: '会社員です。', modelReading: 'かいしゃいんです。' }, ...ok.application.slice(1)],
  }
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.deepEqual(result, { filled: 0, removed: 0, contentMismatchRemoved: 0 }, '유일한 참조라 빼면 빈 배열 — 손대지 않는다')
  assert.deepEqual(data.application[0].targetIds, [c2.id], '건드리지 않아야 한다')
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  const violations = checkLessonResponse({ allowedChunkIds }, data)
  assert.ok(
    violations.some((m) => m.includes('application[0].modelAnswerJa') && m.includes('名前') && m.includes('chunk-02')),
    `위반 메시지가 어느 표현·어느 id 인지 알려줘야 한다: ${JSON.stringify(violations)}`,
  )
})

// ── lesson@v6(2026-09-28, v5 재측정 잔여) — tolerateContentMismatch: 재시도까지 다 쓴 마지막 시도에서만 ④ 를 눈감는다 ──

test('checkLessonResponse: tolerateContentMismatch=true 면 ④(콘텐츠 매칭)만 눈감고 ①~③·한글·엔진명은 그대로 강제한다', () => {
  const ok = validLessonResponse(fixture.topic)
  const c2 = fixture.topic.chunks[1] // 名前 — 위 "빼면 빈 배열" 테스트와 같은 모양(유일한 참조가 콘텐츠 불일치)
  const contentMismatch = {
    ...ok,
    application: [{ ...ok.application[0], targetIds: [c2.id], modelAnswerJa: '会社員です。', modelReading: 'かいしゃいんです。' }, ...ok.application.slice(1)],
  }
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  assert.notDeepEqual(checkLessonResponse({ allowedChunkIds }, contentMismatch), [], '기본값(false)은 여전히 위반으로 잡아야 한다')
  assert.deepEqual(checkLessonResponse({ allowedChunkIds, tolerateContentMismatch: true }, contentMismatch), [], 'tolerateContentMismatch=true 면 ④ 위반이 사라져야 한다')

  // ①(존재하지 않는 id)·한글 혼입·엔진명 노출은 tolerateContentMismatch 와 무관하게 여전히 걸려야 한다.
  const missingId = { ...ok, quiz: [{ ...ok.quiz[0], targetIds: ['no-such-id'] }, ...ok.quiz.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds, tolerateContentMismatch: true }, missingId).some((m) => m.includes('no-such-id')), 'targetIds 존재 검사는 계속 강제돼야 한다')
  const hangul = { ...ok, dialogue: [{ ...ok.dialogue[0], ja: '안녕하세요。' }, ...ok.dialogue.slice(1)] }
  assert.ok(checkLessonResponse({ allowedChunkIds, tolerateContentMismatch: true }, hangul).some((m) => m.includes('dialogue[0].ja')), '한글 혼입 검사는 계속 강제돼야 한다')
  const leaked = { ...ok, nextPreview: { ...ok.nextPreview, teaserKo: 'Claude 선생님이 준비했어요' } }
  assert.ok(checkLessonResponse({ allowedChunkIds, tolerateContentMismatch: true }, leaked).some((m) => m.includes('엔진')), '엔진명 노출 검사는 계속 강제돼야 한다')
})

/** 엔진(`runJsonWithRetry` → `completeJson`)이 extraCheck 에 넘기는 시도 정보(REV-032 M1). */
function attemptInfo(attempt: number): LlmExtraCheckInfo {
  return { attempt, maxAttempts: 2, traceId: null }
}

/** 유일한 참조가 콘텐츠 불일치(④)인 응답 — repair 도 못 고치는 모양(application[0] → 名前, 모범 답엔 없음). */
function contentMismatchResponse(): LessonResponse {
  const ok = validLessonResponse(fixture.topic)
  const c2 = fixture.topic.chunks[1]
  return {
    ...ok,
    application: [{ ...ok.application[0], targetIds: [c2.id], modelAnswerJa: '会社員です。', modelReading: 'かいしゃいんです。' }, ...ok.application.slice(1)],
  }
}

/** 존재하지 않는 id(①, 데이터 무결성) — 마지막 시도에서도 눈감지 않는다. */
function missingIdResponse(): LessonResponse {
  const ok = validLessonResponse(fixture.topic)
  return { ...ok, quiz: [{ ...ok.quiz[0], targetIds: ['totally-made-up-id'] }, ...ok.quiz.slice(1)] }
}

test('buildLessonRequest 의 extraCheck: 콘텐츠 매칭만 남았을 때 1차(재시도 전)에는 그대로 위반, 2차(재시도, 마지막)에는 눈감는다', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  const contentMismatch = contentMismatchResponse()
  const first = req.extraCheck!(structuredClone(contentMismatch), attemptInfo(1))
  assert.notDeepEqual(first, [], '1차(재시도로 보내기 전)는 여전히 위반으로 잡아야 재시도가 걸린다')
  const second = req.extraCheck!(structuredClone(contentMismatch), attemptInfo(2))
  assert.deepEqual(second, [], '2차(마지막 시도)에는 같은 위반을 눈감아 레슨을 살려야 한다')
})

test('REV-032 M1: extraCheck 는 호출 횟수를 세지 않는다 — 시도 정보가 없거나 1차면 몇 번째 호출이든 완화하지 않는다', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  const contentMismatch = contentMismatchResponse()
  for (let i = 0; i < 3; i++) {
    assert.notDeepEqual(req.extraCheck!(structuredClone(contentMismatch)), [], `정보 없는 ${i + 1}번째 호출도 강제해야 한다`)
    assert.notDeepEqual(req.extraCheck!(structuredClone(contentMismatch), attemptInfo(1)), [], `1차 정보면 ${i + 1}번째 호출도 강제해야 한다`)
  }
})

test('buildLessonRequest 의 extraCheck: 2차에도 id 존재(①) 같은 데이터 무결성 위반은 눈감지 않는다', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  const second = req.extraCheck!(structuredClone(missingIdResponse()), attemptInfo(2))
  assert.ok(second.some((m) => m.includes('totally-made-up-id')), '2차(마지막)에도 존재하지 않는 id 는 여전히 위반이어야 한다(환각은 repair 도 손대지 않는다)')
})

test('REV-032 M1: router 폴백 — connection A 가 2회 다 실패한 뒤 B 의 1차에서는 ④ 완화가 꺼지고 2차에서만 켜진다', async (t) => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  // 가짜 LLM(home-m4 형식 `{message:{content}}`) — connection 은 경로(/a·/b)로 가른다. 각 경로의 응답 순서가 곧 시도 순서다.
  const script: Record<string, string[]> = {
    '/a/v1/chat': [JSON.stringify(contentMismatchResponse()), JSON.stringify(missingIdResponse())],
    '/b/v1/chat': [JSON.stringify(contentMismatchResponse()), JSON.stringify(contentMismatchResponse())],
  }
  const hits: string[] = []
  const server = createServer((rq, rs) => {
    rq.resume()
    rq.on('end', () => {
      const path = rq.url ?? ''
      hits.push(path)
      const next = script[path]?.shift()
      if (next === undefined) {
        rs.writeHead(500).end('unexpected call')
        return
      }
      rs.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ message: { content: next } }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  const keyEnv = 'KAIWA_TEST_FAKE_LLM_KEY'
  process.env[keyEnv] = 'test-only'
  const conn = (key: string, base: string): ResolvedConnection => ({
    id: key,
    key,
    engineId: 'home-m4-api',
    connectionType: 'HTTP',
    connection: { baseUrl: `http://127.0.0.1:${port}${base}` },
    runtime: { model: 'fake-model' },
    credentialRef: `env:${keyEnv}`,
  })
  mock.method(routerDeps, 'loadChain', async () => [conn('fake-a', '/a'), conn('fake-b', '/b')])
  const infoLines: string[] = []
  mock.method(console, 'info', (...a: unknown[]) => void infoLines.push(a.map(String).join(' ')))
  mock.method(console, 'warn', () => {})
  t.after(() => {
    mock.restoreAll()
    server.closeAllConnections()
    server.close()
    delete process.env[keyEnv]
  })

  const r = await completeJson<LessonResponse>({ ...req, traceId: 't_REV032fallbackTest0' })

  assert.deepEqual(hits, ['/a/v1/chat', '/a/v1/chat', '/b/v1/chat', '/b/v1/chat'], 'A 2회(① 로 실패) → B 1차(④ 강제로 재시도) → B 2차')
  assert.equal(r.connectionKey, 'fake-b')
  assert.equal(r.attempts, 2, 'B 의 1차에서 완화가 켜졌다면 B 1회로 끝났을 것(클로저 카운터 버그의 증상)')
  const tolerated = infoLines.filter((l) => l.startsWith('[lesson] 마지막 시도'))
  assert.equal(tolerated.length, 1, `완화는 B 의 2차에서 한 번만 쓰여야 한다: ${JSON.stringify(tolerated)}`)
  assert.match(tolerated[0], /trace=t_REV032fallbackTest0 attempt=2\/2$/, '로그에 상관 id·시도 번호가 있어야 한다')
  assert.ok(!/[぀-ヿ一-鿿]/.test(tolerated[0]), '로그에 모범 답·원문(일본어)을 싣지 않는다')
})

test('checkLessonResponse ④: grammar targetId 는 콘텐츠 매칭 대상이 아니다(문형이 문장에 그대로 나타나길 기대하지 않는다)', () => {
  const ok = validLessonResponse(fixture.topic)
  // a2 는 이미 targetIds:['g1'] 이고 modelAnswerJa='韓国から来ました。'(문형 pattern '〜から来ました' 자체는 아니지만 자연스러운 활용문).
  const allowedChunkIds = fixture.topic.chunks.map((c) => c.id)
  assert.deepEqual(checkLessonResponse({ allowedChunkIds }, ok), [], 'grammar 참조는 modelAnswerJa 내용 매칭을 요구하지 않는다')
})

test('buildLessonRequest 의 extraCheck: 보정으로 계약을 지킬 수 있으면 위반 없이 통과하고 data 가 실제로 채워진다(엔진 재호출 없이)', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  const ok = validLessonResponse(fixture.topic)
  const c07 = fixture.topic.chunks.find((c) => c.id === 'chunk-07')!
  const c10 = fixture.topic.chunks.find((c) => c.id === 'chunk-10')!
  // developer 실측(task-010 17:20)에서 실제로 관찰된 모양 — application·speaking 의 targetIds 가 입력 조각 id 이지만
  // 이번 응답 chunks 에는 없는 것을 가리킨다. modelAnswerJa 는 그 조각 표기를 담게 바꿔(④ 콘텐츠 검사 통과용) id 존재
  // 보정(①~③)만 이 테스트의 관심사로 남긴다.
  const broken: LessonResponse = {
    ...ok,
    application: [{ ...ok.application[0], targetIds: [c07.id], modelAnswerJa: `${c07.textJa}。` }, ...ok.application.slice(1)],
    speaking: [{ ...ok.speaking[0], targetIds: [c10.id], modelAnswerJa: `${c10.textJa}。` }, ...ok.speaking.slice(1)],
  }
  assert.equal(req.extraCheck!(broken).length, 0, 'extraCheck 가 보정 후 위반 없음을 돌려줘야 한다(재시도 없이 성공)')
  assert.ok(broken.chunks.some((c) => c.id === c07.id), 'chunk-07 이 채워졌어야 한다')
  assert.ok(broken.chunks.some((c) => c.id === c10.id), 'chunk-10 이 채워졌어야 한다')
})

test('lesson@v6: 프롬프트 버전·id 규칙 위치(chunks 바로 뒤)·reading 예시(가나 허용·한자·로마자 금지·외래어 가타카나)', () => {
  assert.equal(LESSON_PROMPT_VERSION, 'lesson@v6')
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  const chunksIdx = req.system.indexOf('- chunks:')
  const idRuleIdx = req.system.indexOf('- **id 규칙')
  const grammarIdx = req.system.indexOf('- grammar:')
  assert.ok(chunksIdx !== -1 && idRuleIdx !== -1 && grammarIdx !== -1)
  assert.ok(chunksIdx < idRuleIdx && idRuleIdx < grammarIdx, 'id 규칙이 chunks 바로 뒤·grammar 보다 앞이어야 한다(더 앞으로)')
  assert.ok(req.system.includes('watashi wa genki desu') || req.system.includes('私は元気です'), 'reading 금지 예시(한자·로마자)가 있어야 한다')
  assert.ok(req.system.includes('コーヒー'), 'v3: 외래어는 가타카나 그대로 두라는 예시가 있어야 한다')
})

// ── lesson@v4(2026-09-28 운영 11b 후속) — LESSON_READING_PATTERN 에 「」『』 추가 ──────────

test('lesson@v4: LESSON_READING_PATTERN 이 CJK 괄호형 인용부호(「」『』, U+300C~U+300F)를 허용한다 — 프롬프트 지시문은 v3 그대로(모델이 아니라 스키마가 좁았던 경우)', () => {
  assert.ok(LESSON_READING_PATTERN.includes('「'), 'reading 패턴에 「 가 포함돼야 한다')
  assert.ok(LESSON_READING_PATTERN.includes('」'), 'reading 패턴에 」 가 포함돼야 한다')
  assert.ok(LESSON_READING_PATTERN.includes('『') && LESSON_READING_PATTERN.includes('』'), 'reading 패턴에 이중 인용부호 『』 도 포함돼야 한다')
  // 이번 수정은 검증(스키마) 전용 — lessonInstruction 문구에 인용부호 관련 새 지시를 추가하지 않았다(모델 유도를
  // 바꿀 이유가 없었다 — 모델 행동은 이미 맞았고 스키마가 좁았을 뿐이다).
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  assert.ok(req.system.includes('reading 계열 필드'), 'reading 지시문 자체는 남아 있어야 한다')
  assert.ok(!req.system.includes('괄호') && !req.system.includes('인용부호'), 'v4 는 지시문에 괄호·인용부호 관련 새 문구를 추가하지 않는다(스키마만 넓혔다)')
})

// ── lesson@v5(2026-09-28, v4 재측정에서 드러난 2차 원인) — modelAnswerJa 콘텐츠 매칭 규칙을 모델에게 처음 알린다 ──

test('lesson@v5: "모범 답 내용 규칙"이 id 규칙 바로 뒤·grammar 보다 앞에 있고, chunk 는 실제 포함·grammar 는 예외임을 명시한다', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, topic: fixture.topic })
  const idRuleIdx = req.system.indexOf('- **id 규칙')
  const contentRuleIdx = req.system.indexOf('- **모범 답 내용 규칙')
  const grammarIdx = req.system.indexOf('- grammar:')
  assert.ok(idRuleIdx !== -1 && contentRuleIdx !== -1 && grammarIdx !== -1)
  assert.ok(idRuleIdx < contentRuleIdx && contentRuleIdx < grammarIdx, '모범 답 내용 규칙은 id 규칙 바로 뒤·grammar 보다 앞이어야 한다')
  assert.match(req.system, /modelAnswerJa.*(문장 안에 실제로 써서|실제로 그 문장)/, 'chunk 표현을 실제로 써야 한다는 지시가 있어야 한다')
  assert.ok(req.system.includes('grammar id') && req.system.includes('문형을 살린'), 'grammar id 는 문형 활용만으로 충분하다는 예외가 있어야 한다(matching.ts·checks.ts 와 같은 기준)')
})

test('lesson@v5: sourceText 경로에도 모범 답 내용 규칙이 실린다(주제 경로 전용이 아니다)', () => {
  const req = buildLessonRequest({ todayKst: '2026-09-28', learner, sourceText: fixture.sourceText })
  assert.ok(req.system.includes('- **모범 답 내용 규칙'))
})

// ── persona §6 LESSON 행 ──────────────────────────────────────────────

test('loadPersona({mode:"LESSON"}): §6 표에 LESSON 행만 남고 다른 모드 행은 빠진다', () => {
  const p = loadPersona({ sections: [6], level: 'N4', mode: 'LESSON' })
  assert.match(p.prompt, /\| LESSON \|/)
  assert.ok(!p.prompt.includes('| TALK |'))
  assert.ok(!p.prompt.includes('| REVIEW_DECISION |'))
})
