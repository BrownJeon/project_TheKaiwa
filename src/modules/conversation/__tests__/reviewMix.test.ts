import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkLessonResponse } from '../structuredResponse/checks'
import { withPieces } from './lessonPiecesHelpers'
import { repairLessonResponse, type LessonRepairSourceChunk } from '../structuredResponse/repair'
import { LESSON_SCHEMA, type LessonResponse } from '../structuredResponse/schemas'
import { PIECES_INSTRUCTION_LINE } from '../prompts/piecesInstruction'
import { buildReviewMixRequest, REVIEW_MIX_MAX_ITEMS, REVIEW_MIX_HEADER_CAP, REVIEW_MIX_PROMPT_VERSION, ReviewMixInputError, type ReviewMixItemInput } from '../prompts/reviewMix'

interface Fixture {
  items: ReviewMixItemInput[]
  mixNoteKo: string
}
const fixture = JSON.parse(readFileSync(join(process.cwd(), 'tests/prompts/fixtures/review-mix.json'), 'utf8')) as Fixture
const learner = { displayName: '브라운', teacherName: '유우', level: 'N4', weaknesses: ['CONJUGATION(3)', 'PARTICLE(2)'], streakDays: 4 }

// ── buildReviewMixRequest 기본 형태 ──────────────────────────────────────

test('buildReviewMixRequest: task·persona·jsonSchema(A4 재사용)·메시지 형태, allowedChunkIds 가 mixSpec.id 그대로', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items, mixNoteKo: fixture.mixNoteKo })
  assert.equal(req.task, 'reviewMix')
  assert.equal(req.persona?.name, 'tutor')
  assert.equal(req.jsonSchema, LESSON_SCHEMA, 'A5 는 A4 스키마를 그대로 재사용한다')
  assert.equal(req.messages.length, 1)
  assert.equal(req.messages[0].role, 'user')
  assert.deepEqual(req.allowedChunkIds, fixture.items.map((i) => i.id))
  assert.equal(req.skippedItems, 0)
  assert.match(req.system, /\[모드\] LESSON/)
  assert.match(req.system, /\[복습\]/)
  assert.ok(req.messages[0].content.startsWith('[복습 재료]'))
  assert.ok(req.messages[0].content.includes('id=rep-01'))
  assert.equal(REVIEW_MIX_PROMPT_VERSION, 'reviewMix@v4')
})

test('reviewMix@v4(task-081): quiz 지시가 사라지고 «이해 → 문법 → 조각 → 응용 → 말하기»·최상위 키 목록(quiz 없음)으로 바뀐다', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  assert.ok(!/quiz/i.test(req.system), 'system 에 quiz 가 남아 있으면 안 된다')
  assert.ok(!req.system.includes('문제'), '«문제» 단계 이름이 남아 있으면 안 된다')
  assert.match(req.system, /5단계 복습 수업\(이해 → 문법 → 조각 → 응용 → 말하기\)/)
  assert.match(req.system, /최상위 키는 title, titleKo, rolesKo, dialogue, chunks, grammar, application, speaking, nextPreview/)
})

test('reviewMix@v4(task-081): pieces 지침은 A4 와 같은 한 줄이고 dialogue 줄 뒤·id 규칙 앞에 있다', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  const line = req.system.split('\n').find((l) => l.startsWith('- dialogue[].pieces'))
  assert.equal(line, PIECES_INSTRUCTION_LINE, 'A4 lesson@v10 과 같은 문장(지침 공유)')
  assert.ok(req.system.indexOf('- dialogue:') < req.system.indexOf('- dialogue[].pieces') && req.system.indexOf('- dialogue[].pieces') < req.system.indexOf('- **id 규칙'))
  // stripAdditionalProperties 는 A4 lesson·A12·phraseHelp 세 빌더만 켠다(task-019 가드) — A5 에 켤지는 Leader 결정(PE 기록 «열린 결정»).
  assert.equal(req.stripAdditionalProperties, undefined)
})

test('reviewMix@v3(task-010b): application·speaking 필드 나열 줄마다 targetIds 필수(빈 배열 금지)가 실린다 — 누락 시 1차 계약 위반→재시도→120s 초과 회귀', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-10-03', learner, level: 'N4', items: fixture.items })
  const lines = req.system.split('\n')
  for (const key of ['application', 'speaking']) {
    const line = lines.find((l) => l.startsWith(`- ${key}:`))
    assert.ok(line, `${key} 지시 줄이 있어야 한다`)
    assert.ok(line!.includes('targetIds 필수'), `${key} 줄에 targetIds 필수 명시`)
    assert.ok(line!.includes('빈 배열 금지'), `${key} 줄에 빈 배열 금지`)
    assert.ok(line!.includes('chunks·grammar id'), `${key} 줄에 허용 id 범위(chunks·grammar)`)
  }
  // 스키마 필수와 1:1 — 두 항목 스키마의 required 에 targetIds 가 있다(이 규칙의 근거).
  const props = (LESSON_SCHEMA as unknown as { properties: Record<string, { items: { required: string[] } }> }).properties
  for (const key of ['application', 'speaking']) assert.ok(props[key].items.required.includes('targetIds'), `${key} 스키마 required`)
})

test('mixNoteKo 가 있으면 지시문에 [참고] 줄로 실리고, 없으면 생략된다', () => {
  const withNote = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items, mixNoteKo: fixture.mixNoteKo })
  assert.ok(withNote.system.includes('[참고]'))
  assert.ok(withNote.system.includes(fixture.mixNoteKo.slice(0, 10)))
  const without = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  assert.ok(!without.system.includes('[참고]'))
  const blank = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items, mixNoteKo: '   ' })
  assert.ok(!blank.system.includes('[참고]'), '공백뿐인 mixNoteKo 는 없는 것과 같이 취급한다')
})

test('items 가 비어 있으면 ReviewMixInputError', () => {
  assert.throws(() => buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: [] }), ReviewMixInputError)
})

test(`items 가 ${REVIEW_MIX_MAX_ITEMS}개를 넘으면 앞에서부터 잘라 skippedItems 로 알린다`, () => {
  const many: ReviewMixItemInput[] = Array.from({ length: REVIEW_MIX_MAX_ITEMS + 5 }, (_, i) => ({
    id: `m${i}`, chunkType: (['NAME', 'ACTION', 'FEELING', 'MODIFIER'] as const)[i % 4], textJa: `単語${i}`, reading: `たんご${i}`, meaningKo: `단어${i}`,
  }))
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: many })
  assert.equal(req.skippedItems, 5)
  assert.equal(req.allowedChunkIds.length, REVIEW_MIX_MAX_ITEMS)
  assert.ok(req.messages[0].content.includes('id=m0'))
  assert.ok(!req.messages[0].content.includes(`id=m${REVIEW_MIX_MAX_ITEMS}`))
})

test('헤더 상한(≤600) 준수', () => {
  const heavy = { ...learner, displayName: '브라운'.repeat(30), weaknesses: Array.from({ length: 10 }, (_, i) => `CONJUGATION(${i})`), goal: 'x'.repeat(400) }
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner: heavy, level: 'N4', items: fixture.items })
  const headerLine = req.system.split('\n').find((l) => l.startsWith('[학습자]'))!
  assert.ok(headerLine.length <= REVIEW_MIX_HEADER_CAP)
})

test('지시문: 새 표현 금지·id 보존·reading 히라가나 규칙이 들어 있다', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  assert.ok(req.system.includes('새 표현을 넣지 않습니다'))
  assert.ok(req.system.includes('그대로') && req.system.includes('isNew=false'))
  assert.ok(req.system.includes('히라가나'))
})

// ── persona 안정성 ────────────────────────────────────────────────────

test('persona(→ --system-prompt)는 mixSpec 항목·mixNoteKo 가 달라도 바이트 동일(같은 학습자·같은 수준)', () => {
  const a = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  const b = buildReviewMixRequest({ todayKst: '2026-10-05', learner: { ...learner, streakDays: 99 }, level: 'N4', items: fixture.items.slice(0, 2), mixNoteKo: '다른 힌트' })
  assert.equal(a.persona!.prompt, b.persona!.prompt)
  assert.ok(!a.persona!.prompt.includes('よろしくお願いします'), 'mixSpec 데이터는 persona 가 아니라 messages 쪽에만 있어야 한다')
})

test('입력 경계: mixSpec 데이터·mixNoteKo 는 system/messages 안에서만, 서로 새지 않는다', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  assert.ok(!req.system.includes('rep-01'), 'mixSpec id 는 system 이 아니라 messages 쪽에 있어야 한다')
})

// ── A4 재사용 통합(schemas.ts·checks.ts·repair.ts 무변경 확인) ─────────────

function validReviewMixResponse(items: ReviewMixItemInput[]): LessonResponse {
  const [i1, i2, i3, i4] = items
  return {
    title: '復習レッスン',
    titleKo: '복습 수업',
    rolesKo: { A: '학생', B: '선생님' },
    dialogue: withPieces([
      { speaker: 'A', ja: 'はじめまして。', reading: 'はじめまして。', ko: '처음 뵙겠습니다.' },
      { speaker: 'B', ja: 'よろしくお願いします。', reading: 'よろしくおねがいします。', ko: '잘 부탁합니다.' },
      { speaker: 'A', ja: '会社員ですか。', reading: 'かいしゃいんですか。', ko: '회사원인가요?' },
      { speaker: 'B', ja: 'はい、会社員です。', reading: 'はい、かいしゃいんです。', ko: '네, 회사원입니다.' },
      { speaker: 'A', ja: '緊張していますか。', reading: 'きんちょうしていますか。', ko: '긴장되나요?' },
      { speaker: 'B', ja: '少し緊張しています。', reading: 'すこしきんちょうしています。', ko: '조금 긴장됩니다.' },
    ]),
    chunks: [
      { id: i1.id, textJa: i1.textJa, reading: i1.reading!, meaningKo: i1.meaningKo, chunkType: i1.chunkType, isNew: false },
      { id: i2.id, textJa: i2.textJa, reading: i2.reading!, meaningKo: i2.meaningKo, chunkType: i2.chunkType, isNew: false },
      { id: i3.id, textJa: i3.textJa, reading: i3.reading!, meaningKo: i3.meaningKo, chunkType: i3.chunkType, isNew: false },
      { id: i4.id, textJa: i4.textJa, reading: i4.reading!, meaningKo: i4.meaningKo, chunkType: i4.chunkType, isNew: false },
      { id: 'new-1', textJa: 'はい', reading: 'はい', meaningKo: '네', chunkType: 'MODIFIER', isNew: true },
    ],
    grammar: [
      { id: 'g1', pattern: '〜てもいいですか', explanationKo: '허락을 구할 때 쓰는 표현이에요.', exampleJa: '座ってもいいですか。', exampleReading: 'すわってもいいですか。', exampleKo: '앉아도 되나요?' },
    ],
    application: [
      { id: 'a1', promptKo: '허락을 구해 보세요.', hintJa: '〜てもいいですか。', modelAnswerJa: '座ってもいいですか。', modelReading: 'すわってもいいですか。', modelKo: '앉아도 되나요?', targetIds: ['g1'] },
      { id: 'a2', promptKo: '직업을 말해 보세요.', hintJa: null, modelAnswerJa: '会社員です。', modelReading: 'かいしゃいんです。', modelKo: '회사원입니다.', targetIds: [i4.id] },
      { id: 'a3', promptKo: '긴장된다고 말해 보세요.', hintJa: null, modelAnswerJa: '緊張しています。', modelReading: 'きんちょうしています。', modelKo: '긴장됩니다.', targetIds: [i3.id] },
    ],
    speaking: [
      { id: 's1', promptKo: '인사해 보세요.', targetIds: [i1.id], modelAnswerJa: 'よろしくお願いします。', modelReading: 'よろしくおねがいします。', modelKo: '잘 부탁합니다.' },
      { id: 's2', promptKo: '허락을 구해 보세요.', targetIds: ['g1'], modelAnswerJa: '座ってもいいですか。', modelReading: 'すわってもいいですか。', modelKo: '앉아도 되나요?' },
      { id: 's3', promptKo: '기분을 말해 보세요.', targetIds: [i3.id], modelAnswerJa: '緊張しています。', modelReading: 'きんちょうしています。', modelKo: '긴장됩니다.' },
    ],
    nextPreview: { titleKo: '오늘도 수고했어요', teaserKo: '복습을 잘 마쳤어요. 다음에도 함께 해요.' },
  }
}

test('checkLessonResponse: mixSpec id 를 그대로 쓴 유효 응답은 위반 0(A4 검사 무변경 재사용 확인)', () => {
  const ok = validReviewMixResponse(fixture.items)
  const allowedChunkIds = fixture.items.map((i) => i.id)
  assert.deepEqual(checkLessonResponse({ allowedChunkIds }, ok), [])
})

test('repairLessonResponse: mixSpec 항목을 targetIds 가 가리키지만 chunks 에서 빠졌으면 채워 넣는다(A4 보정 무변경 재사용 확인)', () => {
  const ok = validReviewMixResponse(fixture.items)
  const missing = fixture.items[4] // chunks 에 없는 mixSpec 항목(韓国から来ました)
  // task-081: quiz 가 없어져 application[0] 이 «보정 대상 id» 를 싣는다 — 모범 답이 그 조각 표기를 담아 ④ 콘텐츠 매칭에 걸리지 않게 한다.
  const data = { ...ok, application: [{ ...ok.application[0], targetIds: [...ok.application[0].targetIds, missing.id], modelAnswerJa: `座ってもいいですか。${missing.textJa}。` }, ...ok.application.slice(1)] }
  const repairSourceChunks: LessonRepairSourceChunk[] = fixture.items
    .filter((i): i is ReviewMixItemInput & { reading: string } => Boolean(i.reading))
    .map((i) => ({ id: i.id, chunkType: i.chunkType, textJa: i.textJa, reading: i.reading, meaningKo: i.meaningKo }))
  const result = repairLessonResponse({ allowedChunks: repairSourceChunks }, data)
  assert.equal(result.filled, 1)
  assert.ok(data.chunks.some((c) => c.id === missing.id && c.isNew === false))
  const allowedChunkIds = fixture.items.map((i) => i.id)
  assert.deepEqual(checkLessonResponse({ allowedChunkIds }, data), [])
})

test('buildReviewMixRequest.extraCheck: 보정 뒤 위반이 남지 않는 정상 응답은 빈 배열', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  const ok = validReviewMixResponse(fixture.items)
  const violations = req.extraCheck!(ok)
  assert.deepEqual(violations, [])
})

test('buildReviewMixRequest.extraCheck: mixSpec 에 없는 id(환각)를 chunks 에 쓰면 위반이 남는다(보정 대상이 아니다)', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  const ok = validReviewMixResponse(fixture.items)
  const hallucinated = { ...ok, chunks: [{ ...ok.chunks[0], id: 'made-up-id' }, ...ok.chunks.slice(1)] }
  const violations = req.extraCheck!(hallucinated)
  assert.ok(violations.some((m) => m.includes('made-up-id')))
})

// ── task-081 — 조각(pieces) 후검증·면책이 A4 와 같이 동작한다 ──────────────────────────────────

function brokenPieces(data: LessonResponse, idx: number[]): LessonResponse {
  return { ...data, dialogue: data.dialogue.map((d, i) => (idx.includes(i) ? { ...d, pieces: [{ ja: 'ＸＸ', type: 'NAME' as const, ko: '뜻', slash: false }] } : d)) }
}

test('reviewMix@v4: 정상 응답은 pieces 가 정리된 배열로 제자리 바뀌고, 위반 줄이 절반 이하면 그 줄만 null (재시도 없음)', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  const data = structuredClone(brokenPieces(validReviewMixResponse(fixture.items), [0, 3]))
  assert.deepEqual(req.extraCheck!(data), [])
  assert.deepEqual(data.dialogue.map((d) => d.pieces === null), [true, false, false, true, false, false])
})

test('reviewMix@v4: 절반을 넘으면 1차는 위반(재시도), 마지막 시도는 면책하고 위반 줄을 null 로 저장한다 — 복습 수업 생성을 실패시키지 않는다', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  const broken = brokenPieces(validReviewMixResponse(fixture.items), [0, 1, 2, 3, 4, 5])
  const info = (attempt: number) => ({ attempt, maxAttempts: 2, traceId: null })
  assert.ok(req.extraCheck!(structuredClone(broken), info(1)).some((m) => m.includes('dialogue[0]')))
  assert.ok(req.extraCheck!(structuredClone(broken)).length > 0, '시도 정보가 없으면 엄격')
  const logs: string[] = []
  const m = mock.method(console, 'info', (...a: unknown[]) => void logs.push(a.map(String).join(' ')))
  try {
    const last = structuredClone(broken)
    assert.deepEqual(req.extraCheck!(last, info(2)), [])
    assert.ok(last.dialogue.every((d) => d.pieces === null))
  } finally {
    m.mock.restore()
  }
  assert.ok(logs.some((l) => /^\[reviewMix\] 마지막 시도 — 눈감고 통과시킨 조각 위반 줄 6\/6 attempt=2\/2$/.test(l)), logs.join('\n'))
  assert.ok(logs.some((l) => /^\[reviewMix\] pieces — lines=6 nullLines=6 /.test(l)))
})

test('reviewMix@v4: 마지막 시도 면책은 조각 임계만 — id 환각 같은 위반은 그대로 위반', () => {
  const req = buildReviewMixRequest({ todayKst: '2026-09-28', learner, level: 'N4', items: fixture.items })
  const ok = validReviewMixResponse(fixture.items)
  const data = { ...brokenPieces(ok, [0, 1, 2, 3, 4, 5]), chunks: [{ ...ok.chunks[0], id: 'made-up-id' }, ...ok.chunks.slice(1)] }
  assert.ok(req.extraCheck!(structuredClone(data), { attempt: 2, maxAttempts: 2, traceId: null }).some((m) => m.includes('made-up-id')))
})
