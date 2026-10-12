/**
 * task-062 — 손님 취소 판정(`isAbortError`)·취소 오류(`cancelledError`)의 정의가 `chats/requestCancel.ts` 하나뿐이고
 * 세 서비스(#169 `replyPractice`·#178 `openingDraftRun`·#180 `phraseHelp`)가 모두 거기서 가져다 쓴다.
 * 이유: 한쪽 사본에만 조건이 뒤늦게 붙던 표류(REV-190→192)를 다시 만들지 않으려고 `phraseHelp` 의 글자 같은 사본을 걷었다.
 * 소스 검사라 주석 처리된 호출은 통과하지 않게 `readCode`(주석만 걷는 공용 도구)로 읽는다. 동작 시험은 `task056PhraseHelp`·`task058Cancel`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { readCode } from '../../../components/__tests__/sourceCode'
import { ApiError } from '@/modules/infra'
import { cancelledError, isAbortError } from '../chats/requestCancel'

const SERVICES = ['replyPractice.ts', 'openingDraftRun.ts', 'phraseHelp.ts']
const chats = (f: string) => readCode(join(__dirname, '..', 'chats', f))

test('세 서비스는 requestCancel 에서 두 정의를 가져오고 자기 파일에 따로 정의하지 않는다', () => {
  for (const f of SERVICES) {
    const src = chats(f)
    assert.match(src, /import \{ cancelledError, isAbortError \} from '\.\/requestCancel'/, `${f}: requestCancel import`)
    assert.doesNotMatch(src, /\b(?:const|let|var|function)\s+(?:isAbortError|cancelledError)\b/, `${f}: 같은 이름의 자기 정의`)
  }
})

test('세 서비스의 취소 분기는 같은 모양 — 요청 신호가 실제로 abort 됐을 때만, 이름 판정과 함께, 분류된 취소 오류로', () => {
  for (const f of SERVICES) {
    const src = chats(f)
    assert.match(src, /if \(signal\?\.aborted === true && isAbortError\(e\)\) \{[\s\S]*?throw cancelledError\(\)/, `${f}: 취소 분기`)
  }
})

test('requestCancel 의 정의 — 이름이 정확히 AbortError 일 때만 · 취소 오류는 분류된 409 CANCELLED(문구 고정)', () => {
  assert.equal(isAbortError(Object.assign(new Error('x'), { name: 'AbortError' })), true)
  for (const e of [new Error('AbortError'), Object.assign(new Error('x'), { name: 'LlmTimeoutError' }), null, undefined, 'AbortError']) assert.equal(isAbortError(e), false)
  const e = cancelledError()
  assert.ok(e instanceof ApiError)
  assert.equal(e.code, 'CONFLICT')
  assert.equal(e.userMessage, '요청이 취소됐어요.')
  assert.deepEqual(e.details, { reason: 'CANCELLED' })
})
