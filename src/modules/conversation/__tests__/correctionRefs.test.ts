import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listCorrectionRefsByWord, type CorrectionRefReader } from '../corrections'

test('listCorrectionRefsByWord: userId·savedWordId 로 거르고 {id, chatId} 만 읽는다, 잘못된 id 는 DB 를 부르지 않는다', async () => {
  const calls: unknown[] = []
  const db: CorrectionRefReader = {
    correction: {
      findMany: async (args) => {
        calls.push(args)
        return [{ id: 'cr_1', chatId: 'ch_1' }]
      },
    },
  }
  assert.deepEqual(await listCorrectionRefsByWord('u1', 'w1', db), [{ id: 'cr_1', chatId: 'ch_1' }])
  assert.deepEqual(calls[0], { where: { userId: 'u1', savedWordId: 'w1' }, select: { id: true, chatId: true }, orderBy: { createdAt: 'desc' }, take: 20 })
  assert.deepEqual(await listCorrectionRefsByWord('u1', '', db), [])
  assert.deepEqual(await listCorrectionRefsByWord('u1', 'x'.repeat(41), db), [])
  assert.deepEqual(await listCorrectionRefsByWord('', 'w1', db), [])
  assert.equal(calls.length, 1)
})
