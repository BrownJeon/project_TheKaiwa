/**
 * 회화방 일본어 도우미 요청 수명주기(task-056 REV-191 M-2) — `createHelperRequester` 를 가짜 서버·`mock.timers` 로 돌려 본다(React 없음).
 *  - 동시에 하나(받는 중 재요청 거부, 앞 요청은 끊지 않음) · 5초 slow · 12초 끊고 시간 초과 · 끝나면 타이머 정리 ·
 *    dispose(언마운트) = abort + 타이머 정리 + 늦은 응답 버림 · dispose 뒤 새 요청은 앞 요청의 늦은 응답에 흔들리지 않음.
 *  - 훅 `usePhraseHelper` 가 이 컨트롤러에 맡기는 배선은 `phraseHelperRender.test.ts` 소스 시험이 잠근다.
 *  - 한국어 IME 조합 Enter 판정 `isImeEnter`(MU5).
 *  - `cancelPending`(말하기·턴 시작 시 아직 답이 오지 않은 요청 자동 취소, 사용자 결정 2026-10-11): 로딩·slow 만 abort+타이머 정리, 끝난 요청은 무동작,
 *    취소 직후 새 요청 가능, 취소된 요청의 늦은 응답·거절은 상태를 오염시키지 않고 오류·시간 초과로 알리지 않는다.
 */
import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import type { PhraseHelpItem } from '@/types/phraseHelp'
import { createHelperRequester, HELPER_SLOW_MS, HELPER_TIMEOUT_MS, isImeEnter, type HelperSettle } from '../phraseHelperLogic'

interface Call {
  signal: AbortSignal
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
}

/** fetch 처럼 신호가 끊기면 AbortError 로 거절한다. `honorAbort:false` = 신호를 무시하고 나중에 답하는 서버. */
function fakeServer(opts: { honorAbort?: boolean } = {}) {
  const calls: Call[] = []
  const request = (signal: AbortSignal) =>
    new Promise<unknown>((resolve, reject) => {
      calls.push({ signal, resolve, reject })
      if (opts.honorAbort !== false) signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true })
    })
  return { calls, request }
}

function recorder() {
  const settled: HelperSettle[] = []
  const r = {
    settled,
    slow: 0,
    on: {
      onSlow: () => {
        r.slow++
      },
      settle: (x: HelperSettle) => {
        settled.push(x)
      },
    },
  }
  return r
}

/** 가짜 시계 + setTimeout·clearTimeout 엿보기(컨트롤러가 만든 타이머를 지웠는지). */
function clock(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const set = t.mock.method(globalThis, 'setTimeout')
  const clear = t.mock.method(globalThis, 'clearTimeout')
  return {
    tick: (ms: number) => t.mock.timers.tick(ms),
    made: () => set.mock.calls.map((c) => c.result as unknown),
    cleared: () => clear.mock.calls.map((c) => c.arguments[0] as unknown),
  }
}

const A: PhraseHelpItem[] = [{ ja: '喉が枯れました。', ko: '목이 쉬었어요.' }]
const B: PhraseHelpItem[] = [{ ja: '声がかすれた。', ko: '목소리가 쉬었어.' }]

test('동시에 하나(MU1): 받는 중 두 번째 start 는 null — 요청은 한 번만, 앞 요청은 끊지 않고 끝까지 받는다', async (t) => {
  const c = clock(t)
  const s = fakeServer()
  const r = recorder()
  const req = createHelperRequester()
  assert.equal(req.pending(), false)
  const p1 = req.start(s.request, r.on)
  assert.ok(p1)
  assert.equal(req.pending(), true)
  assert.equal(req.start(s.request, r.on), null)
  assert.equal(req.start(s.request, r.on), null)
  assert.equal(s.calls.length, 1)
  assert.equal(s.calls[0].signal.aborted, false, '거부된 재요청이 앞 요청을 끊지 않는다')
  assert.equal(c.made().length, 2, '타이머는 첫 요청의 둘(12초·5초)뿐')
  s.calls[0].resolve({ items: A })
  await p1
  assert.deepEqual(r.settled, [{ kind: 'items', items: A }])
  assert.equal(req.pending(), false)
  for (const id of c.made()) assert.ok(c.cleared().includes(id), '끝나면 타이머 둘 다 지운다')
  c.tick(HELPER_TIMEOUT_MS + 1)
  assert.equal(r.slow, 0, '5초 전에 끝났으면 slow 없음')
  // 끝난 뒤에는 새 요청을 받는다
  const p2 = req.start(s.request, r.on)
  assert.ok(p2)
  assert.equal(s.calls.length, 2)
  s.calls[1].resolve({ items: [] })
  await p2
  assert.deepEqual(r.settled.at(-1), { kind: 'items', items: [] })
})

test('5초 slow · 12초 시간 초과: 5초에 onSlow 한 번, 12초에 신호를 끊고 시간 초과로 결말, 그 뒤 pending 이 풀린다', async (t) => {
  const c = clock(t)
  const s = fakeServer()
  const r = recorder()
  const req = createHelperRequester()
  const p = req.start(s.request, r.on)!
  c.tick(HELPER_SLOW_MS - 1)
  assert.equal(r.slow, 0)
  c.tick(1)
  assert.equal(r.slow, 1)
  c.tick(HELPER_TIMEOUT_MS - HELPER_SLOW_MS - 1)
  assert.equal(s.calls[0].signal.aborted, false)
  assert.equal(req.pending(), true)
  c.tick(1)
  assert.equal(s.calls[0].signal.aborted, true, '12초에 끊는다')
  await p
  assert.deepEqual(r.settled, [{ kind: 'failed', failure: { kind: 'timeout' } }])
  assert.equal(r.slow, 1)
  assert.equal(req.pending(), false)
})

test('12초 시간 초과 — 신호를 무시하는 서버가 뒤늦게 답해도 결말은 시간 초과 하나, 답이 올 때까지는 받는 중', async (t) => {
  const c = clock(t)
  const s = fakeServer({ honorAbort: false })
  const r = recorder()
  const req = createHelperRequester()
  const p = req.start(s.request, r.on)!
  c.tick(HELPER_TIMEOUT_MS)
  assert.equal(s.calls[0].signal.aborted, true)
  assert.equal(req.pending(), true)
  assert.equal(req.start(s.request, r.on), null)
  s.calls[0].resolve({ items: A })
  await p
  assert.deepEqual(r.settled, [{ kind: 'failed', failure: { kind: 'timeout' } }])
  assert.equal(req.pending(), false)
})

test('dispose(언마운트, MU2): 받는 중 요청을 abort · 타이머 둘 다 지움 · 그 뒤 응답·오류는 버림 · 5초·12초가 지나도 아무 일 없음', async (t) => {
  for (const honorAbort of [true, false]) {
    const c = clock(t)
    const s = fakeServer({ honorAbort })
    const r = recorder()
    const req = createHelperRequester()
    const p = req.start(s.request, r.on)!
    const made = c.made().slice(-2)
    req.dispose()
    assert.equal(s.calls[0].signal.aborted, true, `honorAbort=${honorAbort}: abort`)
    for (const id of made) assert.ok(c.cleared().includes(id), `honorAbort=${honorAbort}: 타이머 정리`)
    assert.equal(req.pending(), false)
    c.tick(HELPER_TIMEOUT_MS + 1)
    assert.equal(r.slow, 0)
    s.calls[0].resolve({ items: A })
    await p
    assert.deepEqual(r.settled, [], `honorAbort=${honorAbort}: 늦은 응답 버림`)
    t.mock.reset()
  }
  // 받는 중이 없을 때 dispose 는 아무것도 하지 않는다(StrictMode 의 두 번 마운트)
  const r = recorder()
  const req = createHelperRequester()
  req.dispose()
  assert.equal(req.pending(), false)
  assert.deepEqual(r.settled, [])
})

test('늦은 응답 무시: dispose 뒤 새 요청 — 앞 요청의 늦은 응답·오류는 버리고, 앞 요청의 정리가 새 요청을 지우지 않는다', async (t) => {
  const c = clock(t)
  const s = fakeServer({ honorAbort: false })
  const r = recorder()
  const req = createHelperRequester()
  const p1 = req.start(s.request, r.on)!
  c.tick(1_000)
  req.dispose()
  const p2 = req.start(s.request, r.on)
  assert.ok(p2, 'dispose 뒤에도 새 요청은 받는다')
  assert.equal(s.calls.length, 2)
  assert.equal(s.calls[0].signal.aborted, true)
  assert.equal(s.calls[1].signal.aborted, false)
  s.calls[0].resolve({ items: B })
  await p1
  assert.deepEqual(r.settled, [], '앞 요청의 늦은 응답 버림')
  assert.equal(req.pending(), true, '앞 요청의 finally 가 새 요청을 지우지 않는다')
  c.tick(HELPER_SLOW_MS - 1_000)
  assert.equal(r.slow, 0, '앞 요청의 5초는 울리지 않는다')
  c.tick(1_000)
  assert.equal(r.slow, 1, '새 요청의 5초')
  s.calls[1].resolve({ items: A })
  await p2
  assert.deepEqual(r.settled, [{ kind: 'items', items: A }])
  assert.equal(req.pending(), false)
  // 오류도 같다: 앞 요청이 버려진 뒤 실패해도 결말 없음
  const p3 = req.start(s.request, r.on)!
  req.dispose()
  s.calls[2].reject(new Error('network'))
  await p3
  assert.equal(r.settled.length, 1)
})

test('isImeEnter(MU5): 조합 중 Enter(isComposing 또는 keyCode 229)만 참 — 보통 Enter·조합 중 다른 키는 거짓', () => {
  const ev = (key: string, isComposing: boolean, keyCode: number) => ({ key, keyCode, nativeEvent: { isComposing } })
  assert.equal(isImeEnter(ev('Enter', true, 13)), true)
  assert.equal(isImeEnter(ev('Enter', false, 229)), true)
  assert.equal(isImeEnter(ev('Enter', true, 229)), true)
  assert.equal(isImeEnter(ev('Enter', false, 13)), false)
  assert.equal(isImeEnter(ev('a', true, 229)), false)
  assert.equal(isImeEnter(ev('Process', false, 229)), false)
})

/* ── cancelPending: 말하기·턴 시작 시 아직 답이 오지 않은 요청 취소 ─────────────────────── */

test('cancelPending(로딩·slow 중): 신호를 끊고 타이머 둘을 지우며 true — 그 요청은 오류·시간 초과·결과 어느 쪽으로도 알리지 않는다', async (t) => {
  for (const stage of ['loading', 'slow'] as const) {
    const c = clock(t)
    const s = fakeServer()
    const r = recorder()
    const req = createHelperRequester()
    const p = req.start(s.request, r.on)!
    const made = c.made().slice(-2)
    if (stage === 'slow') {
      c.tick(HELPER_SLOW_MS)
      assert.equal(r.slow, 1, 'slow 단계까지 갔다')
    }
    assert.equal(req.pending(), true)
    assert.equal(s.calls[0].signal.aborted, false)
    assert.equal(req.cancelPending(), true, `${stage}: 취소했다`)
    assert.equal(s.calls[0].signal.aborted, true, `${stage}: abort`)
    for (const id of made) assert.ok(c.cleared().includes(id), `${stage}: 타이머 정리`)
    assert.equal(req.pending(), false, `${stage}: 받는 중이 아니다`)
    c.tick(HELPER_TIMEOUT_MS + 1)
    assert.equal(r.slow, stage === 'slow' ? 1 : 0, `${stage}: 취소 뒤 5초·12초 타이머는 울리지 않는다`)
    await p
    assert.deepEqual(r.settled, [], `${stage}: abort 가 만든 거절을 오류(error)·시간 초과(timeout)로 알리지 않는다`)
    assert.equal(req.cancelPending(), false, `${stage}: 두 번째 취소는 무동작`)
    t.mock.reset()
  }
})

test('cancelPending 은 받는 중이 아니면 무동작(false) — 시작 전 · 결과/오류로 끝난 뒤 · 결말을 알리는 도중 · 12초에 끊긴 요청', async (t) => {
  const c = clock(t)
  const s = fakeServer({ honorAbort: false })
  const settled: HelperSettle[] = []
  let during: boolean | null = null
  const req = createHelperRequester()
  const on = {
    onSlow: () => {},
    settle: (x: HelperSettle) => {
      settled.push(x)
      during = req.cancelPending()
    },
  }
  assert.equal(req.cancelPending(), false, '시작 전')

  const p1 = req.start(s.request, on)!
  s.calls[0].resolve({ items: A })
  await p1
  assert.equal(during, false, '결말(settle)을 알리는 도중에는 취소할 것이 없다')
  assert.equal(s.calls[0].signal.aborted, false, '끝나는 요청의 신호를 끊지 않는다')
  assert.equal(req.cancelPending(), false, '결과로 끝난 뒤')
  assert.deepEqual(settled, [{ kind: 'items', items: A }])

  const p2 = req.start(s.request, on)!
  s.calls[1].reject(new Error('network'))
  await p2
  assert.equal(req.cancelPending(), false, '오류로 끝난 뒤')
  assert.equal(settled.length, 2)
  assert.equal(settled[1].kind, 'failed')

  const p3 = req.start(s.request, on)!
  c.tick(HELPER_TIMEOUT_MS)
  assert.equal(s.calls[2].signal.aborted, true, '12초 — 화면이 먼저 끊었다')
  assert.equal(req.pending(), true, '서버가 답할 때까지는 받는 중')
  assert.equal(req.cancelPending(), false, '12초에 끊긴 요청은 시간 초과로 끝나야 한다(멈춤 안내로 바꾸지 않는다)')
  s.calls[2].resolve({ items: B })
  await p3
  assert.deepEqual(settled[2], { kind: 'failed', failure: { kind: 'timeout' } })
  assert.equal(req.cancelPending(), false)
})

test('취소 직후 새 요청: 요청 1건 제한이 풀리고, 취소된 요청의 늦은 응답·거절·정리는 새 요청을 흔들지 않는다', async (t) => {
  const c = clock(t)
  const s = fakeServer({ honorAbort: false })
  const r = recorder()
  const req = createHelperRequester()
  const p1 = req.start(s.request, r.on)!
  c.tick(1_000)
  assert.equal(req.start(s.request, r.on), null, '취소 전에는 받는 중이라 거부')
  assert.equal(req.cancelPending(), true)
  const p2 = req.start(s.request, r.on)
  assert.ok(p2, '취소 직후 바로 새 요청을 받는다')
  assert.equal(s.calls.length, 2)
  assert.equal(s.calls[0].signal.aborted, true)
  assert.equal(s.calls[1].signal.aborted, false)
  assert.equal(req.pending(), true)

  s.calls[0].resolve({ items: B })
  await p1
  assert.deepEqual(r.settled, [], '취소된 요청의 늦은 응답 버림')
  assert.equal(req.pending(), true, '취소된 요청의 finally 가 새 요청을 지우지 않는다')
  c.tick(HELPER_SLOW_MS - 1_000)
  assert.equal(r.slow, 0, '취소된 요청의 5초는 울리지 않는다')
  c.tick(1_000)
  assert.equal(r.slow, 1, '새 요청의 5초')
  s.calls[1].resolve({ items: A })
  await p2
  assert.deepEqual(r.settled, [{ kind: 'items', items: A }])
  assert.equal(req.pending(), false)

  // 취소된 요청이 뒤늦게 거절돼도(네트워크 오류·AbortError 아닌 오류) 결말 없음
  const p3 = req.start(s.request, r.on)!
  assert.equal(req.cancelPending(), true)
  s.calls[2].reject(new Error('network'))
  await p3
  assert.equal(r.settled.length, 1)
  const p4 = req.start(s.request, r.on)!
  assert.equal(req.cancelPending(), true)
  s.calls[3].reject(new DOMException('The operation was aborted.', 'AbortError'))
  await p4
  assert.equal(r.settled.length, 1, 'AbortError 거절도 오류로 알리지 않는다')
})
