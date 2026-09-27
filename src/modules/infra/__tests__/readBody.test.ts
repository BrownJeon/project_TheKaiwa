import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { NextRequest } from 'next/server'
import { readBodyCapped, readJsonObject } from '../http'

/** 조각을 하나씩 내주고 몇 번 읽혔는지 센다(상한을 넘으면 더 읽지 않아야 한다). */
function streamRequest(chunks: number, chunkBytes: number, headers: Record<string, string> = {}): { req: Request; pulled: () => number } {
  let n = 0
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (n >= chunks) return c.close()
      n++
      c.enqueue(new Uint8Array(chunkBytes).fill(0x20))
    },
  }, { highWaterMark: 0 })
  const req = new Request('http://x/api', { method: 'POST', body, headers, duplex: 'half' } as RequestInit & { duplex: 'half' })
  return { req, pulled: () => n }
}

test('readJsonObject: Content-Length 가 상한을 넘으면 읽기 전에 400', async () => {
  const s = streamRequest(100, 1024, { 'content-length': String(100 * 1024) })
  await assert.rejects(() => readJsonObject(s.req as NextRequest, 64 * 1024), (e: Error & { code?: string }) => e.code === 'VALIDATION' && /너무 큽니다/.test(e.message))
  assert.equal(s.pulled(), 0, '본문을 한 조각도 읽지 않는다')
})

test('readJsonObject: Content-Length 없이 상한을 넘으면 넘는 순간 중단·400', async () => {
  const s = streamRequest(1000, 1024)
  await assert.rejects(() => readJsonObject(s.req as NextRequest, 8 * 1024), (e: Error & { code?: string }) => e.code === 'VALIDATION')
  assert.ok(s.pulled() <= 16, `읽은 조각 ${s.pulled()} — 상한 직후에 멈춘다`)
})

test('readJsonObject: 정상 본문·빈 본문·형식 오류는 기존과 같다', async () => {
  const ok = new Request('http://x/api', { method: 'POST', body: JSON.stringify({ a: 1, t: 'こんにちは' }), headers: { 'content-type': 'application/json' } })
  assert.deepEqual(await readJsonObject(ok as NextRequest), { a: 1, t: 'こんにちは' })
  assert.deepEqual(await readJsonObject(new Request('http://x/api', { method: 'POST', body: '  ' }) as NextRequest), {})
  assert.deepEqual(await readJsonObject(new Request('http://x/api', { method: 'POST' }) as NextRequest), {})
  await assert.rejects(() => readJsonObject(new Request('http://x/api', { method: 'POST', body: '[1]' }) as NextRequest), /JSON 객체/)
  await assert.rejects(() => readJsonObject(new Request('http://x/api', { method: 'POST', body: '{bad' }) as NextRequest), /JSON 형식/)
  const exact = JSON.stringify({ k: 'x'.repeat(100) })
  assert.deepEqual(await readJsonObject(new Request('http://x/api', { method: 'POST', body: exact }) as NextRequest, Buffer.byteLength(exact)), { k: 'x'.repeat(100) }, '상한과 같은 크기는 통과')
  assert.equal(await readBodyCapped(new Request('http://x/api', { method: 'POST', body: exact }), Buffer.byteLength(exact) - 1), null)
})
