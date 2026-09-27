import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actionErrorText, turnFailure, turnNoticeText } from '../labels'

const LEAK = /claude|haiku|sonnet|opus|qwen|엔진|모델|trace/i

test('턴 오류 문구: 400 만 서버 문구, 나머지는 화면 표 문구(서버 문구의 구현 용어가 새지 않는다)', () => {
  const serverMsg = 'AI 엔진을 지금 사용할 수 없습니다.'
  assert.equal(turnNoticeText({ status: 400, message: '1,000자까지 보낼 수 있어요' }), '1,000자까지 보낼 수 있어요')
  for (const status of [0, 404, 409, 422, 429, 502, 504, 500, -1]) {
    const text = turnNoticeText({ status, message: serverMsg }, 7)
    assert.doesNotMatch(text, LEAK, `status=${status}`)
    assert.notEqual(text, serverMsg)
  }
  assert.match(turnNoticeText({ status: 429 }, 7), /7초/)
})

test('버튼 동작 오류 문구도 400 만 서버 문구', () => {
  assert.equal(actionErrorText({ status: 400, message: '제목은 100자까지' }), '제목은 100자까지')
  for (const status of [0, 404, 409, 422, 502, 504]) assert.doesNotMatch(actionErrorText({ status, message: 'AI 엔진 오류' }), LEAK)
})

test('SSE error → 실패 말풍선: 422·retryable=false 는 재시도 없음, 시간 초과·그 외는 다시 받기', () => {
  assert.deepEqual(turnFailure('ENGINE_UNAVAILABLE', true).retryable, false)
  assert.deepEqual(turnFailure('ENGINE_ERROR', false).retryable, false)
  assert.equal(turnFailure('ENGINE_TIMEOUT', true).retryable, true)
  assert.match(turnFailure('ENGINE_TIMEOUT', true).text, /오래/)
  assert.equal(turnFailure(undefined, undefined).retryable, true)
  for (const code of ['ENGINE_UNAVAILABLE', 'ENGINE_TIMEOUT', 'ENGINE_ERROR', undefined]) assert.doesNotMatch(turnFailure(code, true).text, LEAK)
})
