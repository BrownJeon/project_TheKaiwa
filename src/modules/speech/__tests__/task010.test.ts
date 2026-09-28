import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { audioKept, lessonUtteranceProblem } from '../utterances/lesson'

const reason = (e: ApiError | null) => (e?.details as { reason?: string } | undefined)?.reason ?? null
const NOW = Date.parse('2026-09-28T03:00:00Z')
const row = (over: Partial<Parameters<typeof lessonUtteranceProblem>[0]> = {}) => ({
  chatId: null, chatMessageId: null, evaluationItemId: null, lessonId: null, createdAt: new Date(NOW - 60_000),
  audioPath: 'users/u/utterances/2026-09/x.wav', audioExpiresAt: new Date(NOW + 86_400_000), audioDeletedAt: null, ...over,
})

test('#62b 발화 연결 판정: 미사용·10분 이내만, 같은 레슨 재참조는 허용', () => {
  assert.equal(lessonUtteranceProblem(row(), 'ls1', NOW), null)
  assert.equal(reason(lessonUtteranceProblem(row({ chatMessageId: 'm1' }), 'ls1', NOW)), 'UTTERANCE_USED')
  assert.equal(reason(lessonUtteranceProblem(row({ evaluationItemId: 'e1' }), 'ls1', NOW)), 'UTTERANCE_USED')
  assert.equal(reason(lessonUtteranceProblem(row({ chatId: 'c1' }), 'ls1', NOW)), 'UTTERANCE_OTHER_CHAT')
  assert.equal(reason(lessonUtteranceProblem(row({ lessonId: 'ls2' }), 'ls1', NOW)), 'UTTERANCE_OTHER_LESSON')
  assert.equal(reason(lessonUtteranceProblem(row({ createdAt: new Date(NOW - 11 * 60_000) }), 'ls1', NOW)), 'UTTERANCE_EXPIRED')
  assert.equal(lessonUtteranceProblem(row({ lessonId: 'ls1', createdAt: new Date(NOW - 60 * 60_000) }), 'ls1', NOW), null, '이미 이 레슨에 붙은 발화')
})

test('#62b hasAudio: 경로 있음·지우지 않음·보존 기한 안', () => {
  assert.equal(audioKept(row(), NOW), true)
  assert.equal(audioKept(row({ audioPath: null }), NOW), false)
  assert.equal(audioKept(row({ audioDeletedAt: new Date(NOW) }), NOW), false)
  assert.equal(audioKept(row({ audioExpiresAt: new Date(NOW - 1) }), NOW), false)
})
