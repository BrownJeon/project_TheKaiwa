import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GrowthResponse, GrowthWeeks } from '@/types/plan'
import { GrowthLoader, type GrowthLoaderDeps } from '../growthLoader'
import { fewFixture, richFixture } from './growthFixtures'

// task-080 감사 M1 — `useGrowthData` 의 상태 기계(screens.md §36-4 ①③④)를 가짜 요청·가짜 시계로 돌린다.
const D: Record<GrowthWeeks, GrowthResponse> = { 4: fewFixture(4), 8: fewFixture(8), 12: richFixture(12) }

function harness(initial: GrowthWeeks = 4) {
  let clock = 1_000
  let tid = 0
  const calls: GrowthWeeks[] = []
  const pending: { w: GrowthWeeks; resolve: (d: GrowthResponse) => void; reject: (e: unknown) => void }[] = []
  const timers = new Map<number, { fn: () => void; at: number }>()
  const cleared: number[] = []
  const deps: GrowthLoaderDeps = {
    load: (w) => {
      calls.push(w)
      return new Promise((resolve, reject) => pending.push({ w, resolve, reject }))
    },
    now: () => clock,
    setTimer: (fn, ms) => {
      timers.set(++tid, { fn, at: clock + ms })
      return tid
    },
    clearTimer: (t) => {
      cleared.push(t as number)
      timers.delete(t as number)
    },
  }
  const loader = new GrowthLoader(initial, deps)
  const h = {
    loader,
    calls,
    timers,
    cleared,
    notified: 0,
    view: () => loader.getView(),
    async answer(w: GrowthWeeks, ok: boolean) {
      const i = pending.findIndex((p) => p.w === w)
      assert.ok(i >= 0, `요청 중인 ${w}주가 없음`)
      const [p] = pending.splice(i, 1)
      if (ok) p.resolve(D[w])
      else p.reject(new Error('offline'))
      await new Promise<void>((r) => setImmediate(r))
    },
    advance(ms: number) {
      clock += ms
      for (const [id, t] of [...timers]) {
        if (t.at <= clock) {
          timers.delete(id)
          t.fn()
        }
      }
    },
  }
  loader.subscribe(() => h.notified++)
  return h
}

test('첫 로딩 — 마운트(start) 전에는 요청하지 않고, 응답 전 loading · 응답 뒤 ready', async () => {
  const h = harness(4)
  assert.deepEqual(h.calls, [])
  h.loader.start()
  assert.deepEqual(h.calls, [4])
  assert.deepEqual(h.view(), { status: 'loading', weeks: 4, data: null, busy: false })
  await h.answer(4, true)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 4, data: D[4], busy: false })
})

test('기간별 캐시 — 처음 고른 기간은 앞 내용 + busy, 다시 고른 기간은 요청 없이 즉시', async () => {
  const h = harness(4)
  h.loader.start()
  await h.answer(4, true)
  h.loader.setWeeks(8)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 8, data: D[4], busy: true }, '③ 앞 기간 내용을 그대로')
  await h.answer(8, true)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 8, data: D[8], busy: false })
  h.loader.setWeeks(4)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 4, data: D[4], busy: false })
  h.loader.setWeeks(8)
  assert.equal(h.view().data, D[8])
  assert.deepEqual(h.calls, [4, 8], '캐시로 돌아온 기간은 다시 부르지 않는다')
})

test('늦게 온 응답은 다른 기간을 덮지 않는다 — 4 → 8(요청 중) → 12 에서 8 이 와도 화면은 4 내용 + busy', async () => {
  const h = harness(4)
  h.loader.start()
  await h.answer(4, true)
  h.loader.setWeeks(8)
  h.loader.setWeeks(12)
  await h.answer(8, true)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 12, data: D[4], busy: true })
  h.loader.setWeeks(8)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 8, data: D[8], busy: false }, '먼저 온 8 은 캐시에 남는다')
  await h.answer(12, true)
  assert.equal(h.view().data, D[8], '고른 기간(8)이 아닌 12 응답은 보이는 내용을 바꾸지 않는다')
})

test('오류 — 지금 기간만 오류, 기간을 바꾸면 잊고 돌아오면 다시 부른다(앞 내용이 있으면 그 기간은 그대로)', async () => {
  const h = harness(4)
  h.loader.start()
  await h.answer(4, false)
  assert.deepEqual(h.view(), { status: 'error', weeks: 4, data: null, busy: false })
  h.loader.setWeeks(8)
  assert.equal(h.view().status, 'loading', '보일 내용이 하나도 없으면 자리표시')
  h.loader.setWeeks(4)
  assert.deepEqual(h.calls, [4, 8, 4], '오류를 잊었으니 다시 부른다')
  await h.answer(4, true)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 4, data: D[4], busy: false })

  h.loader.setWeeks(12)
  await h.answer(12, false)
  assert.deepEqual(h.view(), { status: 'error', weeks: 12, data: null, busy: false }, '기간 바꾸기 요청 실패도 오류')
  h.loader.setWeeks(4)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 4, data: D[4], busy: false })
  h.loader.setWeeks(12)
  assert.equal(h.view().status, 'ready', '오류를 잊고 다시 부르는 동안은 앞 내용 + busy')
  assert.equal(h.view().busy, true)
  assert.deepEqual(h.calls.slice(-1), [12])
})

test('[다시 불러오기] — 바로 실패해도 자리표시 최소 500ms, 성공은 기다리지 않는다, 500ms 넘게 걸린 실패는 바로 오류', async () => {
  const h = harness(4)
  h.loader.start()
  await h.answer(4, false)
  h.loader.reload()
  assert.equal(h.view().status, 'loading')
  h.advance(100)
  await h.answer(4, false)
  assert.equal(h.view().status, 'loading', '100ms 에 실패 — 아직 자리표시')
  assert.equal(h.timers.size, 1)
  assert.equal([...h.timers.values()][0].at - 1_100, 400, '남은 400ms 를 기다린다')
  h.advance(399)
  assert.equal(h.view().status, 'loading')
  h.advance(1)
  assert.equal(h.view().status, 'error')

  h.loader.reload()
  h.advance(30)
  await h.answer(4, true)
  assert.deepEqual(h.view(), { status: 'ready', weeks: 4, data: D[4], busy: false }, '성공은 즉시')
  assert.equal(h.timers.size, 0)

  const h2 = harness(8)
  h2.loader.start()
  await h2.answer(8, false)
  h2.loader.reload()
  h2.advance(600)
  await h2.answer(8, false)
  assert.equal(h2.view().status, 'error')
  assert.equal(h2.timers.size, 0)
})

test('언마운트(stop) 뒤 — 늦은 응답·유예 타이머가 상태를 바꾸지도 알리지도 않는다, StrictMode 재마운트는 이어 쓴다', async () => {
  const h = harness(4)
  h.loader.start()
  h.loader.stop()
  const before = h.notified
  await h.answer(4, true)
  assert.equal(h.notified, before)
  assert.equal(h.view().status, 'loading')

  const r = harness(4)
  r.loader.start()
  await r.answer(4, false)
  r.loader.reload()
  await r.answer(4, false)
  assert.equal(r.timers.size, 1)
  r.loader.stop()
  assert.equal(r.timers.size, 0, '유예 타이머를 지운다')
  assert.equal(r.cleared.length, 1)
  const n = r.notified
  r.advance(1_000)
  assert.equal(r.notified, n)

  const s = harness(12)
  s.loader.start()
  s.loader.stop()
  s.loader.start()
  assert.deepEqual(s.calls, [12], '같은 기간 요청은 한 번만(요청 중 중복 막기)')
  await s.answer(12, true)
  assert.deepEqual(s.view(), { status: 'ready', weeks: 12, data: D[12], busy: false })
})

test('사용자·화면 간 누출 없음 — 컨트롤러마다 캐시가 따로다(모듈 전역 캐시 없음)', async () => {
  const a = harness(4)
  a.loader.start()
  await a.answer(4, true)
  const b = harness(4)
  b.loader.start()
  assert.deepEqual(b.view(), { status: 'loading', weeks: 4, data: null, busy: false })
  assert.deepEqual(b.calls, [4], '새 화면은 새로 읽는다')
})

test('getView 는 바뀌지 않으면 같은 객체(useSyncExternalStore 규칙) · 같은 기간 setWeeks 는 아무 일 없음', async () => {
  const h = harness(4)
  h.loader.start()
  await h.answer(4, true)
  const v = h.view()
  const n = h.notified
  h.loader.setWeeks(4)
  assert.equal(h.view(), v)
  assert.equal(h.notified, n)
})
