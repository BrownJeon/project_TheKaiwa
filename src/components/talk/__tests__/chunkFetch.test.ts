import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHUNK_RETRY_MS, fetchChunkAudio } from '../chunkFetch'

const buf = new Uint8Array([1, 2, 3]).buffer
const err = (status: number) => Object.assign(new Error(`http ${status}`), { status })

test('청크 받기: 방금 합성된 청크의 404 는 짧게 다시 받는다(캐시 커밋 지연)', async () => {
  let calls = 0
  const waits: number[] = []
  const out = await fetchChunkAudio(
    '/api/v1/speech/tts/t',
    new AbortController().signal,
    async () => {
      calls++
      if (calls < 3) throw err(404)
      return buf
    },
    async (ms) => {
      waits.push(ms)
    },
  )
  assert.equal(out, buf)
  assert.equal(calls, 3)
  assert.deepEqual(waits, [CHUNK_RETRY_MS[0], CHUNK_RETRY_MS[1]])
})

test('청크 받기: 404 가 계속되면 3번 다시 받고 포기(큐가 그 청크를 건너뜀)', async () => {
  let calls = 0
  await assert.rejects(
    fetchChunkAudio('/u', new AbortController().signal, async () => {
      calls++
      throw err(404)
    }, async () => undefined),
    (e: unknown) => (e as { status: number }).status === 404,
  )
  assert.equal(calls, 1 + CHUNK_RETRY_MS.length)
})

test('청크 받기: 404 가 아닌 오류(401·0·502)와 취소는 다시 받지 않는다', async () => {
  for (const status of [401, 0, 502]) {
    let calls = 0
    await assert.rejects(fetchChunkAudio('/u', new AbortController().signal, async () => {
      calls++
      throw err(status)
    }, async () => undefined))
    assert.equal(calls, 1, `status ${status}`)
  }
  const ac = new AbortController()
  let calls = 0
  await assert.rejects(
    fetchChunkAudio('/u', ac.signal, async () => {
      calls++
      ac.abort()
      throw err(404)
    }, async () => undefined),
  )
  assert.equal(calls, 1)
})
