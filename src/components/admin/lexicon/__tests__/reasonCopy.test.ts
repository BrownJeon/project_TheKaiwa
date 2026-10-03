import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateWriteMeta } from '../kana'
import { fieldErrorText, mapServerFieldErrors } from '../lexiconCopy'

// task-012c 후속(R1): 이유 칸 비밀 유사 422·운영 10자 미만이 "변경 이유를 입력해 주세요"로 보이던 문제.
test('발음 사전 이유: 운영 쓰기는 10자 이상(요청 전) · 서버 E_REASON_SECRET_LIKE·E_REASON 문구', () => {
  assert.deepEqual(validateWriteMeta('짧은 이유', 'PRODUCTION', true).reason, { code: 'TOO_SHORT', n: 5 })
  assert.equal(validateWriteMeta('짧은 이유', '', false).reason, undefined)
  assert.equal(validateWriteMeta('日本橋 오독 고침 — 사용자 신고', 'PRODUCTION', true).reason, undefined)
  assert.match(fieldErrorText('reason', { code: 'TOO_SHORT', n: 5 }), /10자 이상.*5자/)
  const secret = mapServerFieldErrors({ status: 422, message: '', code: 'UNPROCESSABLE', details: { reason: 'E_REASON_SECRET_LIKE', fields: { reason: 'E_REASON_SECRET_LIKE' } }, retryAfterSec: null })
  assert.ok(secret?.reason)
  assert.match(fieldErrorText('reason', secret!.reason!), /비밀처럼 보이는 글자/)
  assert.match(fieldErrorText('reason', { code: 'E_REASON' }), /10자 이상/)
  assert.equal(fieldErrorText('reason', { code: 'REQUIRED' }), '변경 이유를 입력해 주세요.')
})
