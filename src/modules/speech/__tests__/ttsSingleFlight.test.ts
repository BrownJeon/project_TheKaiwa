import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSingleFlight, type Produced } from '../tts/singleFlight'

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

/** 파일 캐시 + 합성 호출 수를 흉내 낸다. 저장은 `storeGate` 가 풀릴 때까지 멈춰 있다. */
function harness() {
  const cache = new Map<string, string>()
  let synthCalls = 0
  let storeGate = deferred<void>()
  const flight = createSingleFlight<string, string>({
    readCache: async (k) => cache.get(k) ?? null,
    store: async (k, v) => {
      await storeGate.promise
      cache.set(k, v)
    },
  })
  /** synthesizeSentence 와 같은 순서: lookup → (게이트) → produce. */
  const request = async (key: string, synth: () => Promise<string>, beforeProduce?: () => Promise<void>) => {
    const found = await flight.lookup(key)
    if (found.source === 'CACHE') return { source: 'CACHE' as const, value: found.value }
    let run: Produced<string, string>
    if (found.source === 'SHARED') run = found
    else {
      await beforeProduce?.()
      run = await flight.produce(key, found.seq, () => {
        synthCalls++
        return synth()
      })
    }
    if (run.source === 'CACHE') return { source: 'CACHE' as const, value: run.value }
    return { source: run.source, value: await run.promise }
  }
  return {
    flight,
    cache,
    request,
    synthCalls: () => synthCalls,
    releaseStore: () => storeGate.resolve(),
    resetStoreGate: () => (storeGate = deferred<void>()),
  }
}

test('동시 요청 N개 → 엔진 호출 1회, MISS(SYNTH) 1 · HIT(SHARED) N-1, 같은 오디오', async () => {
  const h = harness()
  const synth = deferred<string>()
  const reqs = Array.from({ length: 5 }, () => h.request('k', () => synth.promise))
  await flush()
  synth.resolve('wav-1')
  const out = await Promise.all(reqs)
  assert.equal(h.synthCalls(), 1)
  assert.deepEqual(out.map((o) => o.source).sort(), ['SHARED', 'SHARED', 'SHARED', 'SHARED', 'SYNTH'])
  assert.ok(out.every((o) => o.value === 'wav-1'))
})

test('저장 중(응답은 끝났고 파일 쓰기 전) 도착한 요청 → 합류(HIT), 재합성 0', async () => {
  const h = harness()
  const first = await h.request('k', async () => 'wav-1')
  assert.equal(first.source, 'SYNTH')
  assert.equal(h.cache.has('k'), false) // 저장은 아직
  const during = await h.request('k', async () => 'wav-2')
  assert.equal(during.source, 'SHARED')
  assert.equal(during.value, 'wav-1')
  h.releaseStore()
  await flush()
  assert.equal(h.flight.size(), 0)
  const after = await h.request('k', async () => 'wav-3')
  assert.equal(after.source, 'CACHE')
  assert.equal(h.synthCalls(), 1)
})

test('틈: 캐시 미스 뒤 produce 전에 다른 합성이 저장까지 끝나 진행 중 항목이 사라져도 → 캐시 재확인(HIT), 재합성 0', async () => {
  const h = harness()
  h.releaseStore()
  const other = deferred<void>()
  // 요청 B: lookup 은 MISS(아직 아무것도 없음) → 게이트(상태 확인)에서 멈춘 사이 요청 A 가 합성·저장을 끝낸다.
  const b = h.request('k', async () => 'wav-B', () => other.promise)
  await flush()
  const a = await h.request('k', async () => 'wav-A')
  assert.equal(a.source, 'SYNTH')
  await flush()
  assert.equal(h.flight.size(), 0)
  assert.equal(h.cache.get('k'), 'wav-A')
  other.resolve()
  const rb = await b
  assert.equal(rb.source, 'CACHE')
  assert.equal(rb.value, 'wav-A')
  assert.equal(h.synthCalls(), 1)
})

test('게이트 사이에 같은 키 합성이 시작됐으면 합류, 실패는 합류 요청에도 전달되고 다음 요청은 새로 합성', async () => {
  const h = harness()
  h.releaseStore()
  const gate = deferred<void>()
  const synth = deferred<string>()
  const b = h.request('k', async () => 'wav-B', () => gate.promise)
  await flush()
  const a = h.request('k', () => synth.promise)
  await flush()
  gate.resolve()
  await flush()
  synth.reject(new Error('engine down'))
  const [ra, rb] = await Promise.allSettled([a, b])
  assert.equal(ra.status, 'rejected')
  assert.equal(rb.status, 'rejected')
  assert.equal(h.synthCalls(), 1)
  await flush()
  assert.equal(h.flight.size(), 0)
  const again = await h.request('k', async () => 'wav-2')
  assert.equal(again.source, 'SYNTH')
  assert.equal(h.synthCalls(), 2)
})
