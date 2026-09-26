import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateOutput } from '../../engine/json/schemaValidate'
import { checkChatReview, checkTalkResponse, countJaSentences, isVerbatimQuote } from '../structuredResponse/checks'
import { CHAT_SCHEMA, TALK_SCHEMA, type TutorResponse } from '../structuredResponse/schemas'

const input = '昨日映画を見に行くました'
const ok: TutorResponse = {
  conversation: { replyJa: 'そうですか。何の映画を見ましたか？', replyReading: 'そうですか。なんの えいがを みましたか？', replyKo: '그래요? 무슨 영화를 봤어요?' },
  correction: { required: true, original: input, corrected: '昨日映画を見に行きました', explanationKo: '액션 조각 「行くました」는 「行きました」예요.', errorType: 'CONJUGATION', severity: 'MINOR', chunkType: 'ACTION' },
  learning: { grammarPoint: '動詞の過去形', difficulty: 'N5' },
  speech: { style: 'ENCOURAGING' },
  endOfTopic: false,
  proposals: [],
}

test('TALK 스키마: 정상 응답 통과, CHAT 스키마는 correction 이 있으면 위반', () => {
  assert.deepEqual(validateOutput(ok, TALK_SCHEMA), { ok: true })
  assert.equal(validateOutput(ok, CHAT_SCHEMA).ok, false)
  assert.deepEqual(validateOutput({ ...ok, correction: null }, CHAT_SCHEMA), { ok: true })
})

test('원문 무수정(V1): 바이트 일치·연속 부분 인용만 허용', () => {
  assert.ok(isVerbatimQuote(input, input))
  assert.ok(isVerbatimQuote('はい。' + input, input))
  assert.ok(!isVerbatimQuote(input, '昨日映画を見に行きました'))
  assert.ok(!isVerbatimQuote(input, ' ' + input))
  assert.deepEqual(checkTalkResponse(input, ok), [])
  const bad = { ...ok, correction: { ...ok.correction!, original: '昨日、映画を見に行くました' } }
  assert.equal(checkTalkResponse(input, bad).length, 1)
})

test('replyJa 2문장 상한과 corrected==original 검출', () => {
  assert.equal(countJaSentences('はい。そうです。いいですね！'), 3)
  const long = { ...ok, conversation: { ...ok.conversation, replyJa: 'はい。そうです。いいですね！' } }
  assert.ok(checkTalkResponse(input, long).some((v) => v.includes('2문장')))
  const same = { ...ok, correction: { ...ok.correction!, corrected: input } }
  assert.ok(checkTalkResponse(input, same).some((v) => v.includes('null')))
})

test('REVIEW: 입력에 없는 message_id·원문 변형을 잡는다', () => {
  const msgs = [{ id: 'm1', text: input }]
  const item = { message_id: 'm1', original: input, corrected: '昨日映画を見に行きました', explanation_ko: 'x', error_type: 'CONJUGATION' as const, severity: 'MINOR' as const, chunk_type: 'ACTION' as const }
  assert.deepEqual(checkChatReview(msgs, { items: [item], summary_ko: 's', strengths: [], focus: [] }), [])
  assert.equal(checkChatReview(msgs, { items: [{ ...item, message_id: 'm9' }], summary_ko: 's', strengths: [], focus: [] }).length, 1)
})
