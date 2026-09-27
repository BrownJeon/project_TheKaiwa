import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ChatMessageView } from '@/types/chat'
import {
  endsWithUnfinishedReply,
  lastServerId,
  mergeMessages,
  pendingCorrectionCount,
  prependMessages,
  turnBaseOf,
  userMessageCount,
} from '../messages'

const at = '2026-09-27T05:00:00.000Z'
const u = (id: string, extra: Partial<ChatMessageView> = {}): ChatMessageView => ({ id, role: 'USER', content: id, status: 'DONE', createdAt: at, ...extra })
const a = (id: string, status: ChatMessageView['status'] = 'DONE'): ChatMessageView => ({ id, role: 'ASSISTANT', content: id, status, createdAt: at })

test('mergeMessages: 같은 id 는 제자리 교체, 새 id 는 뒤에', () => {
  const prev = [u('m1'), a('m2', 'PENDING')]
  const out = mergeMessages(prev, [a('m2'), u('m3')])
  assert.deepEqual(out.map((m) => `${m.id}:${m.status}`), ['m1:DONE', 'm2:DONE', 'm3:DONE'])
  assert.notEqual(out, prev, '새 배열')
})

test('prependMessages: 이미 있는 id 는 버리고 앞에 붙인다', () => {
  const out = prependMessages([u('m3'), a('m4')], [u('m1'), a('m2'), u('m3')])
  assert.deepEqual(out.map((m) => m.id), ['m1', 'm2', 'm3', 'm4'])
})

test('lastServerId·turnBaseOf: 임시 말풍선은 건너뛴다', () => {
  const ms = [u('m1'), a('m2'), u('m3'), a('m4', 'PENDING'), u('tmp_1', { localStatus: 'SENDING' })]
  assert.equal(lastServerId(ms), 'm4')
  assert.equal(turnBaseOf(ms), 'm2', '마지막 사용자 메시지(m3) 직전')
  assert.equal(turnBaseOf([u('m1'), a('m2', 'FAILED')]), null, '첫 턴이면 after 없이')
  assert.equal(turnBaseOf([]), null)
})

test('집계: 사용자 메시지 수·남은 교정·끝나지 않은 답', () => {
  const cr = (id: string, status: 'PROPOSED' | 'ACCEPTED') => ({ id, status, original: 'x', corrected: 'y', explanation: '', errorType: 'GRAMMAR' as const, severity: 'MINOR' as const, chunkType: null })
  const ms = [u('m1', { corrections: [cr('c1', 'PROPOSED'), cr('c2', 'ACCEPTED')] }), a('m2'), u('m3', { corrections: [cr('c3', 'PROPOSED')] }), a('m4', 'FAILED'), u('tmp_9')]
  assert.equal(userMessageCount(ms), 2)
  assert.equal(pendingCorrectionCount(ms), 2)
  assert.equal(endsWithUnfinishedReply(ms.slice(0, 4)), true)
  assert.equal(endsWithUnfinishedReply(ms.slice(0, 2)), false)
})
