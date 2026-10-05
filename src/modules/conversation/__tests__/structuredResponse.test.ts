import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkChatReview, checkTalkResponse, countJaSentences, isExactOriginal, isVerbatimQuote } from '../structuredResponse/checks'
import { CHAT_SCHEMA, TALK_SCHEMA, type TutorResponse } from '../structuredResponse/schemas'

const input = '昨日映画を見に行くました'
const ok: TutorResponse = {
  conversation: { replyJa: 'そうですか。何の映画を見ましたか？', replyKo: '그래요? 무슨 영화를 봤어요?' },
  correction: { required: true, original: input, corrected: '昨日映画を見に行きました', explanationKo: '액션 조각 「行くました」는 「行きました」예요.', errorType: 'CONJUGATION', severity: 'MINOR', chunkType: 'ACTION', hintKo: null },
  learning: { grammarPoint: '動詞の過去形', difficulty: 'N5' },
  speech: { style: 'ENCOURAGING' },
  endOfTopic: false,
  proposals: [],
  userKo: '어제 영화를 보러 갔습니다.',
}

test('TALK 스키마: 정상 응답 통과, CHAT 스키마는 correction 이 있으면 위반', () => {
  assert.deepEqual(validateOutput(ok, TALK_SCHEMA), { ok: true })
  assert.equal(validateOutput(ok, CHAT_SCHEMA).ok, false)
  assert.deepEqual(validateOutput({ ...ok, correction: null }, CHAT_SCHEMA), { ok: true })
})

test('원문 무수정(V1): TALK 는 바이트 일치만, REVIEW 는 메시지 전체 또는 문장 하나 전체만', () => {
  assert.ok(isExactOriginal(input, input))
  assert.ok(!isExactOriginal(input, '行く'), '두 글자 조각 인용은 거부(REV-004 Critical 우회 케이스)')
  assert.ok(!isExactOriginal('はい。' + input, input), 'TALK 는 부분 인용도 거부')
  assert.ok(!isExactOriginal(input, '昨日映画を見に行きました'))
  assert.ok(!isExactOriginal(input, ' ' + input))
  const two = 'はい、そうです。' + input + '。'
  assert.ok(isVerbatimQuote(two, input + '。'), 'REVIEW: 문장 하나 전체는 허용')
  assert.ok(!isVerbatimQuote(two, '行く'), 'REVIEW: 문장 안 조각은 거부')
  assert.ok(!isVerbatimQuote(two, '映画を見に'), 'REVIEW: 문장 일부는 거부')
  assert.deepEqual(checkTalkResponse(input, ok), [])
  const bad = { ...ok, correction: { ...ok.correction!, original: '昨日、映画を見に行くました' } }
  assert.equal(checkTalkResponse(input, bad).length, 1)
  const partial = { ...ok, correction: { ...ok.correction!, original: '行くました' } }
  assert.equal(checkTalkResponse(input, partial).length, 1)
})

test('task-010c: correction.hintKo — 스키마는 nullable 문자열 통과, checks 는 corrected 를 그대로 포함하면 위반', () => {
  assert.deepEqual(validateOutput({ ...ok, correction: { ...ok.correction!, hintKo: null } }, TALK_SCHEMA), { ok: true })
  assert.deepEqual(validateOutput({ ...ok, correction: { ...ok.correction!, hintKo: '조사를 다시 확인해 볼까요?' } }, TALK_SCHEMA), { ok: true })
  const missing: Record<string, unknown> = { ...ok.correction }
  delete missing.hintKo
  assert.equal(validateOutput({ ...ok, correction: missing }, TALK_SCHEMA).ok, false, 'hintKo 는 additive 이지만 required — 빠지면 스키마 위반')
  assert.deepEqual(checkTalkResponse(input, { ...ok, correction: { ...ok.correction!, hintKo: '힌트예요' } }), [], '정답을 포함하지 않은 힌트는 위반 없음')
  const leaking = { ...ok, correction: { ...ok.correction!, hintKo: `힌트: ${ok.correction!.corrected} 라고 해요` } }
  assert.ok(checkTalkResponse(input, leaking).some((v) => v.includes('hintKo')), 'hintKo 가 corrected 를 그대로 포함하면 위반')
})

test('replyJa 문장 상한(재시도는 3문장 초과부터)과 corrected==original 검출', () => {
  assert.equal(countJaSentences('はい。そうです。いいですね！'), 3)
  const three = { ...ok, conversation: { ...ok.conversation, replyJa: 'はい。そうです。いいですね！' } }
  assert.deepEqual(checkTalkResponse(input, three), [])
  const four = { ...ok, conversation: { ...ok.conversation, replyJa: 'はい。そうです。いいですね！何を見ましたか？' } }
  assert.ok(checkTalkResponse(input, four).some((v) => v.includes('3문장')))
  const same = { ...ok, correction: { ...ok.correction!, corrected: input } }
  assert.ok(checkTalkResponse(input, same).some((v) => v.includes('null')))
})

test('REVIEW: 입력에 없는 message_id·원문 변형을 잡는다', () => {
  const msgs = [{ id: 'm1', text: input }]
  const item = { message_id: 'm1', original: input, corrected: '昨日映画を見に行きました', explanation_ko: 'x', error_type: 'CONJUGATION' as const, severity: 'MINOR' as const, chunk_type: 'ACTION' as const }
  assert.deepEqual(checkChatReview(msgs, { items: [item], summary_ko: 's', strengths: [], focus: [] }), [])
  assert.equal(checkChatReview(msgs, { items: [{ ...item, message_id: 'm9' }], summary_ko: 's', strengths: [], focus: [] }).length, 1)
})
