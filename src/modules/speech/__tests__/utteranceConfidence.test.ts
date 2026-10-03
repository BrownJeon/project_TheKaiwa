/** task-010b 관측 신뢰도 재료 — 사용자가 확정한 글자 1.0 · 재확인 필요한 실시간 인식 0.5 · 그 밖은 분석 일치도(없으면 1.0, 0~1 로 자름). */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { utteranceConfidenceOf, utteranceConfidences } from '../utterances/confidence'

test('발화 신뢰도: USER 1.0 · 재확인 필요 REALTIME 0.5 · 분석 일치도 · 분석 전 1.0 · 범위 밖 자름', () => {
  assert.equal(utteranceConfidenceOf({ transcriptConfidence: 0.2, requiresReview: true, finalSource: 'USER' }), 1)
  assert.equal(utteranceConfidenceOf({ transcriptConfidence: 0.9, requiresReview: true, finalSource: 'REALTIME' }), 0.5)
  assert.equal(utteranceConfidenceOf({ transcriptConfidence: 0.72, requiresReview: false, finalSource: 'REALTIME' }), 0.72)
  assert.equal(utteranceConfidenceOf({ transcriptConfidence: null, requiresReview: false, finalSource: 'REALTIME' }), 1)
  assert.equal(utteranceConfidenceOf({ transcriptConfidence: 1.4, requiresReview: false, finalSource: 'SERVER' }), 1)
  assert.equal(utteranceConfidenceOf({ transcriptConfidence: -0.3, requiresReview: false, finalSource: 'SERVER' }), 0)
})

test('발화 신뢰도 조회: 형식이 틀린 id·빈 사용자는 DB 를 읽지 않고 빈 결과', async () => {
  assert.equal((await utteranceConfidences('u1', ['../x', '', 'a b'])).size, 0)
  assert.equal((await utteranceConfidences('', ['u_1'])).size, 0)
})
