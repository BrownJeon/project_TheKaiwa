/**
 * task-012c 1단계 — 발음 사전(003g) 쓰기 경로의 reason 에 CX-3 공용 검사 적용(Leader 03:15 결정).
 * 003g 계약(칸 오류 422 `E_REASON`)은 유지하고 비밀 유사만 `E_REASON_SECRET_LIKE` 로 갈래를 올린다. 원문은 오류 어디에도 없다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { fieldErrors, readWriteMeta } from '../speech/lexicon'

test('readWriteMeta — 줄바꿈·제어문자는 공백으로, 1~200자, PRODUCTION 은 10자 이상(칸 오류 E_REASON)', () => {
  assert.deepEqual(readWriteMeta({ baseVersion: 1, reason: '첫 줄\n둘째 줄\t끝' }), { baseVersion: 1, reason: '첫 줄 둘째 줄 끝', confirm: null, reasonErrors: [] })
  assert.equal(readWriteMeta({ baseVersion: 1, reason: 'x' }).reasonErrors.length, 0, 'LOCAL 은 1자 허용(003g 스모크 이유 x)')
  const short = readWriteMeta({ baseVersion: 1, reason: '수정' }, { production: true })
  assert.equal(short.reasonErrors[0]?.code, 'E_REASON')
  assert.equal(short.reason, '')
  assert.equal(readWriteMeta({ baseVersion: 1, reason: '운영 사전 오독 수정 요청' }, { production: true }).reasonErrors.length, 0)
  assert.equal(readWriteMeta({ baseVersion: 1, reason: 'あ'.repeat(201) }).reasonErrors[0]?.code, 'E_REASON')
})

test('readWriteMeta·fieldErrors — 비밀 유사 이유는 E_REASON_SECRET_LIKE(422, details.reason 도 같은 값), 원문 미포함', () => {
  const raw = '키 교체 token=ghp_AAAABBBBccccDDDD1111'
  const meta = readWriteMeta({ baseVersion: 2, reason: raw })
  assert.equal(meta.reasonErrors[0]?.code, 'E_REASON_SECRET_LIKE')
  assert.equal(meta.reason, '')
  const e = fieldErrors([{ field: 'reading', code: 'E_READING', message: '읽기 오류' }, ...meta.reasonErrors])
  assert.ok(e instanceof ApiError)
  assert.equal(e.code, 'UNPROCESSABLE')
  assert.equal(e.details?.reason, 'E_REASON_SECRET_LIKE')
  assert.deepEqual(e.details?.fields, { reading: 'E_READING', reason: 'E_REASON_SECRET_LIKE' })
  assert.ok(!JSON.stringify({ m: e.message, d: e.details }).includes('ghp_AAAA'))
  const plain = fieldErrors([{ field: 'reading', code: 'E_READING', message: 'x' }])
  assert.equal(plain.details?.reason, 'E_LEXICON_ENTRY_INVALID', '비밀 유사가 없으면 003g 갈래 그대로')
})

test('readWriteMeta — Codex C2 ③: 서식 문자(ZWSP·soft hyphen·BOM)로 끊은 비밀 유사 이유도 발음 사전 경로에서 E_REASON_SECRET_LIKE(같은 공용 함수)', () => {
  for (const raw of ['pass\u200Bword=hunter2', 'key s\u00ADk-proj-AbCdEf1234567890', 'Bear\uFEFFer abcdef1234567890']) {
    const meta = readWriteMeta({ baseVersion: 1, reason: raw })
    assert.equal(meta.reasonErrors[0]?.code, 'E_REASON_SECRET_LIKE', JSON.stringify(raw))
    assert.equal(meta.reason, '')
  }
  const padded = readWriteMeta({ baseVersion: 1, reason: `수정${'\u200B'.repeat(12)}` }, { production: true })
  assert.equal(padded.reasonErrors[0]?.code, 'E_REASON', '폭 0 문자로 채운 PRODUCTION 이유는 10자 미달')
})
