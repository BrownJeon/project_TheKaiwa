import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tx } from '@/modules/infra'
import { acceptProposal } from '../proposals'

function fakeTx(payload: Record<string, unknown>) {
  const proposal = { id: 'p1', kind: 'ADD_WORD', payload, status: 'PROPOSED', chatId: null, messageId: null, expiresAt: null, createdAt: new Date(), resolvedAt: null, result: null, chat: null }
  return {
    $queryRaw: async () => [{ id: 'u1' }],
    tutorProposal: {
      findFirst: async () => proposal,
      updateMany: async () => ({ count: 1 }),
    },
  } as unknown as Tx
}

test('#38 ADD_WORD 채택: 레슨 메모 제안이면 source=LESSON·sourceRefId=레슨 id + 보강 칸, 그 밖은 TUTOR·제안 id', async () => {
  const lesson = await acceptProposal('u1', 'p1', undefined, fakeTx({ surface: '注文', reading: 'ちゅうもん', meaning: '주문', lessonId: 'ls1', source: 'LESSON', example: 'ご注文は?', exampleKo: '주문은?', partOfSpeech: 'NOUN', jlpt: 'N4', segment: 1 }))
  assert.equal(lesson.kind, 'ADD_WORD')
  if (lesson.kind !== 'ADD_WORD') return
  assert.deepEqual([lesson.source, lesson.sourceRefId], ['LESSON', 'ls1'])
  assert.deepEqual(lesson.word, { surface: '注文', reading: 'ちゅうもん', meaning: '주문', partOfSpeech: 'NOUN', jlpt: 'N4', example: 'ご注文は?', exampleKo: '주문은?' }, 'segment 같은 메타 칸은 단어 입력에 넣지 않는다')
  const chat = await acceptProposal('u1', 'p1', { meaning: '영화' }, fakeTx({ surface: '映画', reading: 'えいが', meaning: '영화관', example: 'x' }))
  if (chat.kind !== 'ADD_WORD') return assert.fail()
  assert.deepEqual([chat.source, chat.sourceRefId], ['TUTOR', 'p1'])
  assert.deepEqual(chat.word, { surface: '映画', reading: 'えいが', meaning: '영화' }, '채팅 제안은 예전 칸만(+override)')
  const forged = await acceptProposal('u1', 'p1', undefined, fakeTx({ surface: 'x', reading: '', meaning: 'y', source: 'LESSON', lessonId: '../../etc' }))
  if (forged.kind !== 'ADD_WORD') return assert.fail()
  assert.equal(forged.source, 'LESSON', '형식 검사는 id 길이만 — sourceRefId 는 FK 없는 참조 칸')
})
