/**
 * task-012b-2 REV-132 L-1·L-3 — 늦게 온 응답 버리기. 내 발화 기록의 "더 보기" ↔ 필터 전환, 회화방 카드 갱신 ↔ 방 전환.
 * 판정·본문은 `utteranceReview.ts`(네트워크는 주입)라 그대로 부르고, 화면·훅이 그 본문을 그대로 쓰는지는 소스를 정적으로 본다.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import type { UtteranceListDto, UtteranceListItem } from '@/types/speech'
import { appendPage, refreshRoomReviews, requestGate, settleIfCurrent, type ReviewEntry, type RoomRefreshDeps, type Settled } from '../utteranceReview'

const SPEECH = join(process.cwd(), 'src', 'components', 'speech')

function item(over: Partial<UtteranceListItem> = {}): UtteranceListItem {
  return {
    id: 'utt1',
    createdAt: '2026-10-06T11:00:00.000Z',
    durationMs: 2400,
    status: 'ANALYZED',
    realtimeText: '駅はどこですか',
    analysisText: '駅はどこにありますか',
    finalText: '駅はどこですか',
    finalSource: 'REALTIME',
    requiresReview: true,
    wasReviewTarget: true,
    audioAvailable: true,
    chatMessageId: 'msg1',
    context: { kind: 'TALK', id: 'chatA' },
    ...over,
  }
}

const dto = (items: UtteranceListItem[], nextCursor: string | null = null): UtteranceListDto => ({ items, nextCursor, reviewableCount: items.length })

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/* ── 공통: settleIfCurrent · requestGate ─────────────────────── */

test('settleIfCurrent: 조건이 그대로면 성공·실패를 그대로, 기다리는 사이 바뀌었으면 둘 다 stale', async () => {
  let current = true
  assert.deepEqual(await settleIfCurrent(async () => 1, () => current), { kind: 'ok', value: 1 })
  assert.deepEqual(
    await settleIfCurrent(
      async () => {
        throw new Error('x')
      },
      () => current,
    ),
    { kind: 'error' },
  )

  const ok = deferred<number>()
  const p1 = settleIfCurrent(() => ok.promise, () => current)
  current = false
  ok.resolve(2)
  assert.deepEqual(await p1, { kind: 'stale' })

  current = true
  const bad = deferred<number>()
  const p2 = settleIfCurrent(() => bad.promise, () => current)
  current = false
  bad.reject(new Error('late'))
  assert.deepEqual(await p2, { kind: 'stale' }, '옛 조건의 실패도 새 화면에 오류로 띄우지 않는다')
})

test('requestGate: invalidate 전에 받은 표만 무효 — 그 뒤에 받은 표는 유효', () => {
  const gate = requestGate()
  const before = gate.ticket()
  assert.equal(before(), true)
  gate.invalidate()
  const after = gate.ticket()
  assert.equal(before(), false)
  assert.equal(after(), true)
  gate.invalidate()
  gate.invalidate()
  assert.equal(after(), false)
  assert.equal(gate.ticket()(), true)
})

test('appendPage: 다음 쪽은 뒤에 붙고, 이미 있는 id 는 한 줄만', () => {
  const a = item({ id: 'a' })
  const b = item({ id: 'b' })
  const c = item({ id: 'c' })
  assert.deepEqual(
    appendPage([a, b], [b, c]).map((x) => x.id),
    ['a', 'b', 'c'],
  )
  assert.deepEqual(appendPage([], [a]), [a])
})

/* ── L-1: 더 보기 중 필터 전환 ───────────────────────────────── */

interface LogState {
  items: UtteranceListItem[]
  cursor: string | null
  more: 'idle' | 'loading' | 'error'
}

/** 화면 `loadMore` 의 세 갈래(아래 정적 검사가 화면에 같은 갈래가 있는지 본다) — stale 이면 상태 그대로. */
function afterMore(s: LogState, r: Settled<UtteranceListDto>): LogState {
  if (r.kind === 'stale') return s
  if (r.kind === 'error') return { ...s, more: 'error' }
  return { items: appendPage(s.items, r.value.items), cursor: r.value.nextCursor, more: 'idle' }
}

test('더 보기 중 필터 전환(L-1): 옛 필터의 다음 쪽은 새 필터의 첫 쪽 뒤에 와도 버려진다 — 행·커서·오류 섞임 0', async () => {
  const gate = requestGate()
  // 전체 보기 1쪽을 받은 상태에서 "더 보기"
  let s: LogState = { items: [item({ id: 'all1' })], cursor: 'cur-all-1', more: 'loading' }
  const allPage2 = deferred<UtteranceListDto>()
  const pending = settleIfCurrent(() => allPage2.promise, gate.ticket())
  // 확인 필요 탭으로 전환(화면의 pick: 표 무효 → 목록 비움) → 새 필터 첫 쪽 도착
  gate.invalidate()
  s = { items: [item({ id: 'rev1' })], cursor: 'cur-rev-1', more: 'idle' }
  // 그 뒤에 옛 필터 응답 도착
  allPage2.resolve(dto([item({ id: 'all2' }), item({ id: 'all3' })], 'cur-all-2'))
  s = afterMore(s, await pending)
  assert.deepEqual(
    s.items.map((x) => x.id),
    ['rev1'],
  )
  assert.equal(s.cursor, 'cur-rev-1')
  assert.equal(s.more, 'idle')

  // 옛 필터 요청이 실패로 끝나도 새 화면에 "더 불러오지 못했어요" 를 띄우지 않는다
  const failing = deferred<UtteranceListDto>()
  const pendingFail = settleIfCurrent(() => failing.promise, gate.ticket())
  gate.invalidate()
  failing.reject(new Error('net'))
  s = afterMore(s, await pendingFail)
  assert.equal(s.more, 'idle')

  // 새 필터의 더 보기는 그대로 붙는다
  s = afterMore(s, await settleIfCurrent(async () => dto([item({ id: 'rev2' })], null), gate.ticket()))
  assert.deepEqual(
    s.items.map((x) => x.id),
    ['rev1', 'rev2'],
  )
  assert.equal(s.cursor, null)
})

/* ── L-3: 회화방 카드 갱신 ───────────────────────────────────── */

function harness(over: Partial<RoomRefreshDeps> & { room?: string } = {}) {
  const state = { room: over.room ?? 'chatA', paused: false, entries: new Map<string, ReviewEntry>(), applied: 0, fetched: [] as string[] }
  const deps: RoomRefreshDeps = {
    currentRoom: () => state.room,
    paused: () => state.paused,
    inflight: { current: null },
    fetchList: async (id) => {
      state.fetched.push(id)
      return dto([item()])
    },
    keep: () => new Set(),
    apply: (update) => {
      state.applied++
      state.entries = update(state.entries)
    },
    ...over,
  }
  return { state, deps }
}

test('방 카드 갱신: 쉬는 중·같은 방이면 받아서 메시지 id 로 붙인다 — 요청은 그 방·확인할 것만', async () => {
  const { state, deps } = harness()
  assert.equal(await refreshRoomReviews('chatA', deps), 'applied')
  assert.deepEqual(state.fetched, ['chatA'])
  assert.equal(state.applied, 1)
  assert.equal(state.entries.get('msg1')?.item.id, 'utt1')
  assert.equal(deps.inflight.current, null)
})

test('방 전환(L-3): 응답이 오는 사이 방이 바뀌면 버린다 — 새 방 카드에 옛 방 발화 0, 진행 중 표시도 풀린다', async () => {
  const late = deferred<UtteranceListDto>()
  const { state, deps } = harness({ fetchList: () => late.promise })
  const p = refreshRoomReviews('chatA', deps)
  assert.equal(deps.inflight.current, 'chatA')
  state.room = 'chatB'
  late.resolve(dto([item({ id: 'fromA', chatMessageId: 'msgA' })]))
  assert.equal(await p, 'stale')
  assert.equal(state.applied, 0)
  assert.equal(state.entries.size, 0)
  assert.equal(deps.inflight.current, null)
})

test('방 전환(L-3): 옛 방 요청이 끝나도 새 방의 진행 중 표시는 지우지 않는다 — 새 방 첫 조회가 막히지 않는다', async () => {
  const lateA = deferred<UtteranceListDto>()
  const lateB = deferred<UtteranceListDto>()
  const { state, deps } = harness({ fetchList: (id) => (id === 'chatA' ? lateA.promise : lateB.promise) })
  const pA = refreshRoomReviews('chatA', deps)
  state.room = 'chatB'
  const pB = refreshRoomReviews('chatB', deps)
  assert.equal(deps.inflight.current, 'chatB')
  lateA.resolve(dto([item({ id: 'fromA', chatMessageId: 'msgA' })]))
  assert.equal(await pA, 'stale')
  assert.equal(deps.inflight.current, 'chatB')
  lateB.resolve(dto([item({ id: 'fromB', chatMessageId: 'msgB' })]))
  assert.equal(await pB, 'applied')
  assert.deepEqual([...state.entries.keys()], ['msgB'])
})

test('방 카드 갱신: 턴 중(paused)·같은 방 요청 진행 중이면 보내지 않는다(완료 기준 7)', async () => {
  const { state, deps } = harness()
  state.paused = true
  assert.equal(await refreshRoomReviews('chatA', deps), 'skipped')
  state.paused = false
  deps.inflight.current = 'chatA'
  assert.equal(await refreshRoomReviews('chatA', deps), 'skipped')
  assert.deepEqual(state.fetched, [])
})

test('방 카드 갱신: 실패는 조용히(failed) — 카드는 그대로, 진행 중 표시는 풀린다. 펼친·기록 중 카드는 응답 시점에 다시 읽어 남긴다', async () => {
  const { state, deps } = harness({
    fetchList: async () => {
      throw new Error('net')
    },
  })
  state.entries.set('msgKeep', { item: item({ id: 'keep', chatMessageId: 'msgKeep' }), resolved: null })
  assert.equal(await refreshRoomReviews('chatA', deps), 'failed')
  assert.equal(state.applied, 0)
  assert.equal(state.entries.size, 1)
  assert.equal(deps.inflight.current, null)

  let pinnedAtResponse = new Set<string>()
  const late = deferred<UtteranceListDto>()
  deps.fetchList = () => late.promise
  deps.keep = () => pinnedAtResponse
  const p = refreshRoomReviews('chatA', deps)
  pinnedAtResponse = new Set(['keep'])
  late.resolve(dto([]))
  assert.equal(await p, 'applied')
  assert.ok(state.entries.has('msgKeep'), '응답을 기다리는 사이 펼친 카드도 지우지 않는다')
})

/* ── 화면·훅이 위 본문을 그대로 쓰는가(정적) ───────────────────── */

test('useUtteranceReviews: 효과 본문은 refreshRoomReviews — 방은 렌더마다 갱신되는 roomRef, 턴은 pausedRef 로 응답 때 다시 읽는다', () => {
  const src = readFileSync(join(SPEECH, 'useUtteranceReviews.ts'), 'utf8')
  assert.match(src, /await refreshRoomReviews\(chatId, \{/)
  assert.match(src, /currentRoom: \(\) => roomRef\.current,/)
  assert.match(src, /paused: \(\) => pausedRef\.current,/)
  assert.match(src, /useEffect\(\(\) => \{\s*roomRef\.current = chatId/)
  assert.doesNotMatch(src, /mergeReviews\(/, '병합·폐기 판정을 훅 안에서 다시 하지 않는다')
})

test('UtteranceLog: 필터 전환(pick)이 표를 무효로 하고, 더 보기는 그 표로 응답을 거른다 — stale 이면 상태를 건드리지 않는다', () => {
  const src = readFileSync(join(SPEECH, 'UtteranceLog.tsx'), 'utf8')
  const load = src.slice(src.indexOf('const loadMore'), src.indexOf('const pick'))
  const pick = src.slice(src.indexOf('const pick'), src.indexOf('const texts'))
  assert.match(src, /const \[gate\] = useState\(requestGate\)/)
  assert.match(load, /settleIfCurrent\(\(\) => apiGet<UtteranceListDto>\(query\(cursor\)\), gate\.ticket\(\)\)/)
  assert.match(load, /if \(r\.kind === 'stale'\) return\n/)
  assert.match(load, /if \(r\.kind === 'error'\) \{\s*setMore\('error'\)\s*return/)
  assert.ok(load.indexOf("r.kind === 'stale'") < load.indexOf('setItems('), 'stale 판정이 상태 갱신보다 먼저')
  assert.match(load, /appendPage\(prev, r\.value\.items\)/)
  assert.match(pick, /if \(f === filter\) return\s+gate\.invalidate\(\)/)
})
