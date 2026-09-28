import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unsentText } from '../talkCopy'

test('못 보낸 띠 문구: 발화를 붙일 수 없는 409 세 갈래(USED·EXPIRED·OTHER_CHAT, task-018)는 모두 "다시 보내면 글자로"', () => {
  for (const r of ['utteranceUsed', 'utteranceExpired', 'utteranceOtherChat'] as const) assert.match(unsentText(r), /다시 보내면 글자로 보내져요\.$/, r)
  assert.match(unsentText('utteranceOtherChat'), /^다른 대화에서 녹음한 말/)
  assert.notEqual(unsentText('utteranceOtherChat'), unsentText('other'))
})
