/**
 * task-011 화면 배선(2026-10-01) — 데모 결정 f=A 틀린 곳 찾기 조각 답(`spotIndex`)·A7 한 줄 형식, 결정 b=B "글자로 보기"(#67c, `textRevealedAt`).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tx } from '@/modules/infra'
import { ApiError } from '@/modules/infra'
import { revealItemTextInTx } from '../evaluation/answer'
import { gradingMaterials } from '../evaluation/grade'
import { toEvaluationDto, type EvaluationItemRow, type EvaluationRow } from '../evaluation/rows'
import { displayAnswer, gradingAnswerText, normalizeAnswer, spotAnswer } from '../evaluation/scoring'
import { parseAnswerBody } from '../evaluation/validate'

const code = (c: string, reason?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (reason === undefined || (e.details as { reason?: string } | undefined)?.reason === reason)

const SPOT = { kind: 'CORRECTION_SPOT' as const, prompt: { sentenceJa: '昨日、友だちと映画を見に行きます。', segments: ['昨日、', '友だちと', '映画を', '見に', '行きます。'] }, expected: { wrongSpan: '行きます' } }

const item = (over: Partial<EvaluationItemRow> & Pick<EvaluationItemRow, 'id' | 'order' | 'kind'>): EvaluationItemRow => ({
  prompt: {},
  expected: {},
  wordId: null,
  wordSurfaceSnap: null,
  chunkType: null,
  answerText: null,
  inputSource: null,
  score: null,
  maxScore: 10,
  feedback: null,
  dims: ['accuracy'],
  answeredAt: null,
  textRevealedAt: null,
  ...over,
})

const evRow = (over: Partial<EvaluationRow> = {}): EvaluationRow => ({
  id: 'ev1', userId: 'u1', kind: 'TALK', topicId: null, level: 'N4', status: 'IN_PROGRESS', totalScore: null, rubric: null, comment: null, nextFocus: null,
  studyLogId: null, error: null, startedAt: new Date('2026-10-01T10:00:00Z'), submittedAt: null, completedAt: null, topic: null, ...over,
})

test('#67 spotIndex: 정수 0~19·발화와 함께면 400·없으면 null', () => {
  assert.equal(parseAnswerBody({ answerText: '行きました', spotIndex: 4 }).spotIndex, 4)
  assert.equal(parseAnswerBody({ answerText: 'x' }).spotIndex, null)
  assert.throws(() => parseAnswerBody({ answerText: 'x', spotIndex: -1 }), code('VALIDATION'))
  assert.throws(() => parseAnswerBody({ answerText: 'x', spotIndex: 1.5 }), code('VALIDATION'))
  assert.throws(() => parseAnswerBody({ answerText: 'x', spotIndex: 20 }), code('VALIDATION'))
  assert.throws(() => parseAnswerBody({ utteranceId: 'ut_1', spotIndex: 0 }), code('VALIDATION', 'mismatch'))
})

test('틀린 곳 찾기 답 저장 모양: 조각 번호+글자 JSON · 범위 밖·조각 없는 문항·다른 문항 400 · 조각 없이 적은 답은 글자 그대로', () => {
  const stored = normalizeAnswer(SPOT, { answerText: '行きました。 어제 일이라서', pieceOrder: null, spotIndex: 4 })
  assert.deepEqual(spotAnswer(stored), { spot: 4, text: '行きました。 어제 일이라서' })
  assert.equal(normalizeAnswer(SPOT, { answerText: '昨日、友だちと映画を見に行きました。', pieceOrder: null }), '昨日、友だちと映画を見に行きました。')
  assert.throws(() => normalizeAnswer(SPOT, { answerText: 'x', pieceOrder: null, spotIndex: 5 }), code('VALIDATION', 'not_a_segment'))
  assert.throws(() => normalizeAnswer(SPOT, { answerText: null, pieceOrder: null, spotIndex: 1 }), code('VALIDATION', 'required'))
  assert.throws(() => normalizeAnswer({ ...SPOT, prompt: { sentenceJa: 'x' } }, { answerText: 'y', pieceOrder: null, spotIndex: 0 }), code('VALIDATION', 'no_segments'))
  assert.throws(() => normalizeAnswer({ kind: 'SITUATION_RESPOND', prompt: {}, expected: {} }, { answerText: 'y', pieceOrder: null, spotIndex: 0 }), code('VALIDATION', 'not_correction_spot'))
  assert.equal(spotAnswer('{"spot":"a","text":1}'), null)
  assert.equal(spotAnswer('그냥 글자'), null)
  assert.equal(spotAnswer('{깨진'), null)
})

test('내 답 표시·A7 한 줄: 조각을 고른 답은 "고른 곳 「…」 / 고친 말·이유", 조각 없는 답·다른 문항은 저장 글자 그대로', () => {
  const stored = JSON.stringify({ spot: 4, text: '行きました。 어제 일이라서' })
  assert.equal(displayAnswer(SPOT, stored), '行きました。 어제 일이라서')
  assert.equal(gradingAnswerText({ ...SPOT, answerText: stored }), '고른 곳 「行きます。」 / 고친 말·이유: 行きました。 어제 일이라서')
  assert.equal(gradingAnswerText({ ...SPOT, answerText: '고친 문장' }), '고친 문장')
  assert.equal(gradingAnswerText({ ...SPOT, answerText: null }), '')
  assert.equal(gradingAnswerText({ kind: 'SITUATION_RESPOND', prompt: {}, expected: {}, answerText: '{"spot":0,"text":"x"}' }), '{"spot":0,"text":"x"}')
  const m = gradingMaterials({ kind: 'TALK', level: 'N4' }, [item({ id: 'i5', order: 5, ...SPOT, answerText: stored })])
  assert.equal(m.subjectiveItems[0].answerText, '고른 곳 「行きます。」 / 고친 말·이유: 行きました。 어제 일이라서')
  assert.deepEqual(m.subjectiveItems[0].prompt.segments, SPOT.prompt.segments)
})

test('상세 DTO: 조각 답은 answerSpot·글자만 answerText, 글자로 본 듣기 문항은 제출 전에도 textJa·textRevealed', () => {
  const items = [
    item({ id: 'i0', order: 0, kind: 'LISTEN_RESPOND', prompt: { textJa: '週末は何をしますか', instructionKo: '답해 보세요' }, textRevealedAt: new Date('2026-10-01T10:02:00Z') }),
    item({ id: 'i1', order: 1, kind: 'LISTEN_RESPOND', prompt: { textJa: '日曜日、行きませんか', instructionKo: '답해 보세요' } }),
    item({ id: 'i5', order: 5, ...SPOT, answerText: JSON.stringify({ spot: 4, text: '行きました' }) }),
  ]
  const dto = toEvaluationDto(evRow(), items, { now: Date.parse('2026-10-01T10:03:00Z') })
  assert.deepEqual(dto.items[0].prompt, { textJa: '週末は何をしますか', instructionKo: '답해 보세요', textHidden: false })
  assert.equal(dto.items[0].textRevealed, true)
  assert.deepEqual(dto.items[1].prompt, { instructionKo: '답해 보세요', textHidden: true })
  assert.equal(dto.items[1].textRevealed, false)
  assert.equal(dto.items[2].answerSpot, 4)
  assert.equal(dto.items[2].answerText, '行きました')
  assert.deepEqual(dto.items[2].prompt, SPOT.prompt)
  assert.equal(dto.items[2].expected, null)
  assert.equal(dto.items[2].textRevealed, false)
})

function revealWorld(status: string, it: Partial<{ kind: string; prompt: unknown; textRevealedAt: Date | null }> | null) {
  const updates: unknown[] = []
  const row = item({ id: 'ci000000000000000000000001', order: 0, kind: 'LISTEN_RESPOND', prompt: { textJa: '週末は何をしますか', instructionKo: 'x' } })
  const cur = it ? { ...row, ...it } : null
  const tx = {
    $queryRaw: async () => [{ id: 'row' }],
    $executeRaw: async () => 1,
    evaluation: { findUniqueOrThrow: async () => evRow({ status: status as EvaluationRow['status'] }) },
    evaluationItem: {
      findFirst: async () => cur,
      update: async (a: { data: { textRevealedAt: Date } }) => {
        updates.push(a.data)
        if (cur) cur.textRevealedAt = a.data.textRevealedAt
        return cur
      },
    },
  } as unknown as Tx
  return { tx, updates }
}

const EV = 'cev0000000000000000000001'
const IT = 'ci000000000000000000000001'
const NOW = new Date('2026-10-01T10:04:00Z')

test('#67c 글자로 보기: 처음 한 번만 시각 기록(멱등)·상태 409·듣기 문항 아님 400·없는 문항 404', async () => {
  const w = revealWorld('IN_PROGRESS', {})
  const r1 = await revealItemTextInTx(w.tx, 'u1', EV, IT, NOW)
  assert.deepEqual(r1, { itemId: IT, textJa: '週末は何をしますか', textRevealed: true, textRevealedAt: NOW.toISOString() })
  const r2 = await revealItemTextInTx(w.tx, 'u1', EV, IT, new Date('2026-10-01T10:08:00Z'))
  assert.equal(r2.textRevealedAt, NOW.toISOString())
  assert.equal(w.updates.length, 1)

  await assert.doesNotReject(revealItemTextInTx(revealWorld('READY', {}).tx, 'u1', EV, IT, NOW))
  await assert.rejects(revealItemTextInTx(revealWorld('GRADING', {}).tx, 'u1', EV, IT, NOW), code('CONFLICT', 'SUBMITTED'))
  await assert.rejects(revealItemTextInTx(revealWorld('DONE', {}).tx, 'u1', EV, IT, NOW), code('CONFLICT', 'ALREADY_DONE'))
  await assert.rejects(revealItemTextInTx(revealWorld('IN_PROGRESS', { kind: 'SITUATION_RESPOND' }).tx, 'u1', EV, IT, NOW), code('VALIDATION', 'not_listen_item'))
  await assert.rejects(revealItemTextInTx(revealWorld('IN_PROGRESS', null).tx, 'u1', EV, IT, NOW), code('NOT_FOUND'))
  await assert.rejects(revealItemTextInTx(revealWorld('IN_PROGRESS', { prompt: { instructionKo: 'x' } }).tx, 'u1', EV, IT, NOW), code('CONFLICT', 'NO_TEXT'))
})
