/**
 * Codex C2-2(task-010) — 발화 한 개 = 한 곳(채팅 메시지·레슨 말하기·평가 문항). 사전 검사와 조건부 연결 조건이 세 경로에서 대칭인지.
 * 실제 DB 경합(레슨 연결 ∥ 채팅 연결)은 `tests/live/task010-c2-race.ts`.
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { evaluationUtteranceProblem } from '../utterances/evaluation'
import { lessonUtteranceProblem } from '../utterances/lesson'
import { utteranceDb } from '../utterances/store'
import { checkUtteranceForTurn, turnUtteranceProblem } from '../utterances/turn'
import { unclaimedUtteranceWhere } from '../utterances/usage'

const U1 = 'cuser00000000000000000001'
const CHAT_A = 'cchataaaaaaaaaaaaaaaaaaaa'
const NOW = Date.parse('2026-09-28T03:00:00Z')
const reason = (e: unknown) => (e instanceof ApiError ? (e.details as { reason?: string } | undefined)?.reason : undefined) ?? null
const row = (over: Partial<{ chatId: string | null; chatMessageId: string | null; lessonId: string | null; evaluationItemId: string | null }> = {}) => ({
  chatId: null,
  chatMessageId: null,
  lessonId: null,
  evaluationItemId: null,
  createdAt: new Date(NOW - 60_000),
  audioPath: null,
  audioExpiresAt: null,
  audioDeletedAt: null,
  ...over,
})

test('연결 조건(원자 claim): 세 용도 모두 메시지·레슨·평가 문항 NULL, 레슨·평가는 대화방 녹음(chatId)도 NULL', () => {
  assert.deepEqual(unclaimedUtteranceWhere(U1, 'u1', 'chatMessage'), { id: 'u1', userId: U1, chatMessageId: null, lessonId: null, evaluationItemId: null })
  assert.deepEqual(unclaimedUtteranceWhere(U1, 'u1', 'lesson'), { id: 'u1', userId: U1, chatMessageId: null, lessonId: null, evaluationItemId: null, chatId: null })
  assert.deepEqual(unclaimedUtteranceWhere(U1, 'u1', 'evaluationItem'), { id: 'u1', userId: U1, chatMessageId: null, lessonId: null, evaluationItemId: null, chatId: null })
})

test('사전 검사 대칭: 레슨에 쓴 발화 → 채팅 턴 409 USED, 채팅 메시지에 쓴 발화 → 레슨 409 USED, 평가 문항에 쓴 발화 → 둘 다 409', () => {
  // 레슨 → 채팅(이번에 막은 쪽 — 전에는 lessonId 를 보지 않아 통과했다)
  assert.equal(reason(turnUtteranceProblem(row({ lessonId: 'ls1' }), CHAT_A, NOW)), 'UTTERANCE_USED')
  assert.equal(reason(turnUtteranceProblem(row({ evaluationItemId: 'ei1' }), CHAT_A, NOW)), 'UTTERANCE_USED')
  // 채팅 → 레슨·평가(그 반대)
  assert.equal(reason(lessonUtteranceProblem(row({ chatMessageId: 'm1', chatId: CHAT_A }), 'ls1', NOW)), 'UTTERANCE_USED')
  assert.equal(reason(evaluationUtteranceProblem(row({ chatMessageId: 'm1', chatId: CHAT_A }), 'ei1', NOW)), 'UTTERANCE_USED')
  // 레슨 ↔ 평가
  assert.equal(reason(lessonUtteranceProblem(row({ evaluationItemId: 'ei1' }), 'ls1', NOW)), 'UTTERANCE_USED')
  assert.equal(reason(evaluationUtteranceProblem(row({ lessonId: 'ls1' }), 'ei1', NOW)), 'UTTERANCE_OTHER_LESSON')
  // 아무 데도 안 쓴 발화는 세 경로 모두 통과(채팅은 대화방 녹음도 같은 방이면 통과)
  assert.equal(turnUtteranceProblem(row(), CHAT_A, NOW), null)
  assert.equal(turnUtteranceProblem(row({ chatId: CHAT_A }), CHAT_A, NOW), null)
  assert.equal(lessonUtteranceProblem(row(), 'ls1', NOW), null)
  assert.equal(evaluationUtteranceProblem(row(), 'ei1', NOW), null)
})

test('채팅 턴 수락 전 검사: 레슨에 연결된 발화는 DB 에서 읽은 lessonId 로 409(조회 칸에 lessonId·evaluationItemId 포함)', async (t) => {
  t.after(() => mock.restoreAll())
  mock.method(utteranceDb, 'findForTurn', async (userId: string, id: string) =>
    userId === U1 && id === 'uL' ? { id: 'uL', chatId: null, chatMessageId: null, lessonId: 'ls1', evaluationItemId: null, createdAt: new Date(NOW - 5_000), finalText: 'はい' } : null,
  )
  await assert.rejects(checkUtteranceForTurn(U1, 'uL', CHAT_A, NOW), (e: unknown) => reason(e) === 'UTTERANCE_USED')
})
