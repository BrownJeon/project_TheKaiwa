import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluationUtteranceProblem } from '../utterances/evaluation'

const NOW = Date.parse('2026-09-28T10:00:00Z')
const row = (over: Partial<Parameters<typeof evaluationUtteranceProblem>[0]> = {}) => ({
  chatId: null,
  chatMessageId: null,
  evaluationItemId: null,
  lessonId: null,
  createdAt: new Date(NOW - 60_000),
  ...over,
})
const reason = (e: unknown) => (e as { details?: { reason?: string } } | null)?.details?.reason ?? null

test('평가 문항 발화 연결 조건: 메시지·대화방·레슨·다른 문항 409, 이 문항 재사용 허용, 처음 연결은 10분 이내', () => {
  assert.equal(evaluationUtteranceProblem(row(), 'ei1', NOW), null)
  assert.equal(reason(evaluationUtteranceProblem(row({ chatMessageId: 'm1' }), 'ei1', NOW)), 'UTTERANCE_USED')
  assert.equal(reason(evaluationUtteranceProblem(row({ chatId: 'c1' }), 'ei1', NOW)), 'UTTERANCE_OTHER_CHAT')
  assert.equal(reason(evaluationUtteranceProblem(row({ lessonId: 'l1' }), 'ei1', NOW)), 'UTTERANCE_OTHER_LESSON')
  assert.equal(reason(evaluationUtteranceProblem(row({ evaluationItemId: 'ei2' }), 'ei1', NOW)), 'UTTERANCE_USED')
  assert.equal(evaluationUtteranceProblem(row({ evaluationItemId: 'ei1', createdAt: new Date(NOW - 3_600_000) }), 'ei1', NOW), null)
  assert.equal(reason(evaluationUtteranceProblem(row({ createdAt: new Date(NOW - 11 * 60_000) }), 'ei1', NOW)), 'UTTERANCE_EXPIRED')
})
