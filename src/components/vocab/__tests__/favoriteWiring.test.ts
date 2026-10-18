/**
 * task-074 감사 REV-074U M-1 — 즐겨찾기 화면 **배선**의 동작 시험(jsdom 없음, 소스 스캔 없음).
 * - 단어장 화면의 효과 처리·목록 응답 꼬리·행 별 처리기(`wordsFavoriteEffect.ts`): 진짜 컨트롤러 + 가짜 setter 로 돌린다.
 * - 별 요청 경로: 진짜 `sendFavorite` 를 가짜 전역 `fetch` 로(켜기 /favorite · 끄기 /unfavorite · 오류 status → 컨트롤러 문구).
 * - 컨트롤러 수명(`mountFavoriteController`): 정리 = dispose, StrictMode 껐다 켜기.
 * - 상세 시트 저장·보관: 진짜 처리기를 시험 프로세스 한정 `useState` 대체(호출 순서별 슬롯 유지) 위에서 부른다 — 보내기 직전 stamp → 응답 뒤 readAt.
 * - 빈 화면 두 단추: 처리기 직접 호출 · 행 셋째 줄/별 자리(설정 로드 뒤): 시험 프로세스 한정 `useSyncExternalStore` 대체로 정적 렌더.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createElement as h, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { OFF, type AnnotationState } from '@/components/common/japanese/annotations'
import { DISPLAY_DEFAULTS, displayPrefsStore, type DisplayValues } from '@/components/common/japanese/displayPrefs'
import type { ReadingSegment } from '@/modules/speech/reading/client'
import type { WordEntry } from '@/types/vocab'
import { createFavoriteController, type FavEffect, type FavoriteController } from '../favorite'
import FavoriteStar from '../FavoriteStar'
import { FAVORITE_COPY, GENERIC_ERROR, NETWORK_ERROR, WORD_NOT_FOUND } from '../labels'
import { WORD_FILTER_INITIAL } from '../logic'
import { mountFavoriteController, sendFavorite, stampedSend, type WordFavorites } from '../useWordFavorites'
import WordDetailSheet, { DetailActions } from '../WordDetailSheet'
import WordForm from '../WordForm'
import WordsEmpty from '../WordsEmpty'
import WordsScreen, { WordsPageList } from '../WordsScreen'
import {
  detailSheetAfterGone,
  finishWordsArrival,
  runWordsFavoriteEffect,
  wordsFavoriteEffect,
  wordsInFavoriteView,
  wordsStarHandler,
  type WordsArrivalDeps,
} from '../wordsFavoriteEffect'
import { wordsPagerView } from '../wordsPaging'

const React = createRequire(__filename)('react') as Record<string, unknown>
const noop = () => {}
const flush = () => new Promise<void>((r) => setImmediate(r))
const word = (o: Partial<WordEntry> = {}): WordEntry => ({
  id: 'w1',
  surface: '食べる',
  reading: 'たべる',
  meaning: '먹다',
  partOfSpeech: 'VERB',
  chunkType: 'ACTION',
  category: null,
  source: 'SEED',
  origin: 'BASE',
  readOnly: true,
  correctCount: 0,
  wrongCount: 0,
  archived: false,
  ...o,
})
const fx = (o: Partial<FavEffect>): FavEffect => ({ id: 'w1', reload: false, toast: null, notFound: false, ...o })

/** 요소 트리에서 children 을 따라 모든 요소(그리지 않는다). */
function walk(n: ReactNode, out: ReactElement<Record<string, unknown>>[] = []): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(n)) {
    for (const c of n) walk(c as ReactNode, out)
    return out
  }
  if (!isValidElement(n)) return out
  out.push(n as ReactElement<Record<string, unknown>>)
  walk((n.props as { children?: ReactNode }).children, out)
  return out
}

/** 훅을 쓰는 컴포넌트를 렌더 문맥 안에서 함수로 불러 돌려준 요소를 얻는다(`wrap` = 문맥 제공자). */
function elementOf<P>(Comp: (p: P) => ReactNode, props: P, wrap?: (el: ReactElement) => ReactElement): ReactNode {
  let out: ReactNode = null
  function Probe() {
    out = Comp(props)
    return null
  }
  renderToStaticMarkup(wrap ? wrap(h(Probe)) : h(Probe))
  return out
}

// ── (a) 단어장 화면 효과 처리 ───────────────────────────────────────────────────────

type Sheet0 = { kind: 'detail'; id: string } | { kind: 'add'; key: number } | { kind: 'jump' } | null

function screenRig(sheet: Sheet0 = null) {
  const calls: unknown[][] = []
  const state = { sheet }
  const focusCheck = { current: false }
  const deps = {
    showToast: (m: string) => calls.push(['toast', m]),
    setSheet: (u: (s: Sheet0) => Sheet0) => {
      state.sheet = u(state.sheet)
      calls.push(['sheet', state.sheet])
    },
    reloadAll: () => calls.push(['reloadAll']),
    // 다시 읽기를 부르는 순간 초점 확인이 이미 걸려 있어야 한다(응답이 먼저 와도 소비되게).
    request: (k: 'reload') => calls.push(['request', k, focusCheck.current]),
    focusCheck,
  }
  return { calls, state, deps, focusCheck }
}

test('W1 효과 → 할 일 표: 끔(즐겨찾기 칸) = 토스트+같은 쪽 다시 읽기+초점 확인 · 실패 = 토스트만 · 404 = 토스트+그 단어 시트 닫기+전체 다시 읽기 · 없음 = 0', () => {
  const none = { toast: null, closeDetailId: null, reloadAll: false, reload: false, focusCheck: false }
  assert.deepEqual(wordsFavoriteEffect(fx({ reload: true, toast: FAVORITE_COPY.removedToast })), { ...none, toast: FAVORITE_COPY.removedToast, reload: true, focusCheck: true })
  assert.deepEqual(wordsFavoriteEffect(fx({ toast: GENERIC_ERROR })), { ...none, toast: GENERIC_ERROR })
  assert.deepEqual(wordsFavoriteEffect(fx({ toast: NETWORK_ERROR })), { ...none, toast: NETWORK_ERROR })
  assert.deepEqual(wordsFavoriteEffect(fx({ id: 'w9', toast: WORD_NOT_FOUND, notFound: true })), { ...none, toast: WORD_NOT_FOUND, closeDetailId: 'w9', reloadAll: true })
  assert.deepEqual(wordsFavoriteEffect(fx({ id: 'w9', toast: WORD_NOT_FOUND, notFound: true, reload: true })).reload, false, '404 가 먼저 — 같은 쪽 다시 읽기 대신 전체')
  assert.deepEqual(wordsFavoriteEffect(fx({})), none)
})

test('W2 실행 순서·시트 닫기: 토스트 1번 → 그 단어 상세 시트만 닫음 → 전체 다시 읽기 | 초점 확인 건 뒤 같은 쪽 다시 읽기', () => {
  const r = screenRig({ kind: 'detail', id: 'w1' })
  runWordsFavoriteEffect(fx({ toast: WORD_NOT_FOUND, notFound: true }), r.deps)
  assert.deepEqual(r.calls, [['toast', WORD_NOT_FOUND], ['sheet', null], ['reloadAll']])
  assert.equal(r.focusCheck.current, false)

  const other = screenRig({ kind: 'detail', id: 'w2' })
  runWordsFavoriteEffect(fx({ toast: WORD_NOT_FOUND, notFound: true }), other.deps)
  assert.deepEqual(other.state.sheet, { kind: 'detail', id: 'w2' }, '다른 단어 시트는 그대로')
  for (const s of [{ kind: 'add', key: 1 }, { kind: 'jump' }, null] as Sheet0[]) assert.equal(detailSheetAfterGone(s, 'w1'), s)
  assert.equal(detailSheetAfterGone({ kind: 'detail', id: 'w1' } as Sheet0, 'w1'), null)

  const off = screenRig({ kind: 'detail', id: 'w1' })
  runWordsFavoriteEffect(fx({ reload: true, toast: FAVORITE_COPY.removedToast }), off.deps)
  assert.deepEqual(off.calls, [['toast', FAVORITE_COPY.removedToast], ['request', 'reload', true]])
  assert.deepEqual(off.state.sheet, { kind: 'detail', id: 'w1' }, '끔 응답은 열린 시트를 닫지 않는다')

  const fail = screenRig({ kind: 'detail', id: 'w1' })
  runWordsFavoriteEffect(fx({ toast: GENERIC_ERROR }), fail.deps)
  assert.deepEqual(fail.calls, [['toast', GENERIC_ERROR]])
})

test('W3 진짜 컨트롤러 + 화면 배선: 즐겨찾기 칸에서 끔 성공 → 「뺐어요」·초점 확인·다시 읽기 · 다른 칸·켬 → 0 · 404 → 시트 닫기·전체 1번 · 500/연결 끊김 → 토스트만', async () => {
  const list = { shown: { ...WORD_FILTER_INITIAL, source: 'favorite' as const, sort: 'recent' as const } }
  const r = screenRig({ kind: 'detail', id: 'w1' })
  const sent: Array<{ id: string; to: boolean; resolve: (v: { favorite?: unknown }) => void; reject: (e: unknown) => void }> = []
  let t = 0
  const c = createFavoriteController({
    send: (id, to) => new Promise((resolve, reject) => sent.push({ id, to, resolve, reject })),
    now: () => ++t,
    inFavoriteView: () => wordsInFavoriteView(list),
    onChange: noop,
    onEffect: (x) => runWordsFavoriteEffect(x, r.deps),
  })
  c.press('w1', true)
  sent[0]!.resolve({ favorite: false })
  await flush()
  assert.deepEqual(r.calls, [['toast', FAVORITE_COPY.removedToast], ['request', 'reload', true]])

  r.calls.length = 0
  r.focusCheck.current = false
  c.press('w1', false) // 켬 — 즐겨찾기 칸이어도 효과 0
  sent[1]!.resolve({ favorite: true })
  await flush()
  assert.deepEqual(r.calls, [])

  list.shown = { ...list.shown, source: 'all' as never }
  c.press('w1', true) // 다른 칸에서 끔 — 효과 0
  sent[2]!.resolve({ favorite: false })
  await flush()
  assert.deepEqual(r.calls, [])

  c.press('w1', false)
  sent[3]!.reject({ status: 404 })
  await flush()
  assert.deepEqual(r.calls, [['toast', WORD_NOT_FOUND], ['sheet', null], ['reloadAll']])

  for (const [status, msg] of [
    [500, GENERIC_ERROR],
    [0, NETWORK_ERROR],
  ] as const) {
    r.calls.length = 0
    r.state.sheet = { kind: 'detail', id: 'w1' }
    c.press('w1', false)
    sent.at(-1)!.reject({ status })
    await flush()
    assert.deepEqual(r.calls, [['toast', msg]], `status ${status}`)
    assert.deepEqual(r.state.sheet, { kind: 'detail', id: 'w1' })
  }
})

test('W4 지금 깔린 목록이 「즐겨찾기」 칸인가 — shown.source 만 본다(응답 전 null = 아님)', () => {
  assert.equal(wordsInFavoriteView({ shown: null }), false)
  assert.equal(wordsInFavoriteView({ shown: { ...WORD_FILTER_INITIAL, source: 'favorite', sort: 'recent' } }), true)
  for (const source of ['all', 'mine', 'base'] as const) assert.equal(wordsInFavoriteView({ shown: { ...WORD_FILTER_INITIAL, source: source as never, sort: 'wrong' } }), false, source)
})

test('W5 행 별 처리기: 누른 순간 보인 값을 그대로 컨트롤러에(뒤집는 것은 컨트롤러) — 진짜 컨트롤러로 켜짐 보임 → 끄기 요청', () => {
  const presses: unknown[][] = []
  const onStar = wordsStarHandler((id, shown) => presses.push([id, shown]))
  onStar(word({ id: 'a' }), true)
  onStar(word({ id: 'b' }), false)
  assert.deepEqual(presses, [
    ['a', true],
    ['b', false],
  ])
  const sent: unknown[][] = []
  const c = createFavoriteController({ send: (id, to) => (sent.push([id, to]), new Promise(noop)), now: () => 1, inFavoriteView: () => false, onChange: noop, onEffect: noop })
  wordsStarHandler(c.press)(word({ id: 'z' }), true)
  assert.deepEqual(sent, [['z', false]])
})

function arrivalRig(armed: boolean, active: unknown) {
  const calls: unknown[][] = []
  const frames: Array<() => void> = []
  const BODY = { body: true }
  const d: WordsArrivalDeps = {
    setListReadAt: (t) => calls.push(['readAt', t]),
    showToast: (m) => calls.push(['toast', m]),
    focusHead: (scroll) => calls.push(['focusHead', scroll]),
    focusCheck: { current: armed },
    nextFrame: (cb) => {
      calls.push(['frame'])
      frames.push(cb)
    },
    activeElement: () => (active === 'BODY' ? BODY : active),
    body: () => BODY,
  }
  return { calls, frames, d }
}

test('W6 목록 응답 꼬리: 성공만 listReadAt=보내기 직전 시각 · 토스트·머리 줄 초점(끌어올림) · 초점 확인은 한 번 소비 → 다음 그림 뒤 초점이 body·없음일 때만 머리 줄(끌어올리지 않음)', () => {
  const ok = arrivalRig(false, null)
  finishWordsArrival({ ok: true, readAt: 42, toast: null, focusHead: false }, ok.d)
  assert.deepEqual(ok.calls, [['readAt', 42]])

  const err = arrivalRig(false, null)
  finishWordsArrival({ ok: false, readAt: 42, toast: '못 불러왔어요', focusHead: false }, err.d)
  assert.deepEqual(err.calls, [['toast', '못 불러왔어요']], '오류 응답은 readAt 을 앞당기지 않는다')

  const page = arrivalRig(false, null)
  finishWordsArrival({ ok: true, readAt: 7, toast: null, focusHead: true }, page.d)
  assert.deepEqual(page.calls, [['readAt', 7], ['focusHead', true]])

  for (const [active, expectFocus] of [
    ['BODY', true],
    [null, true],
    [{ button: 'other' }, false],
  ] as const) {
    const r = arrivalRig(true, active)
    finishWordsArrival({ ok: true, readAt: 9, toast: null, focusHead: false }, r.d)
    assert.equal(r.d.focusCheck.current, false, '걸린 초점 확인은 소비')
    assert.deepEqual(r.calls, [['readAt', 9], ['frame']], '판정은 다음 그림 뒤')
    assert.equal(r.frames.length, 1)
    r.frames[0]!()
    assert.deepEqual(r.calls.slice(2), expectFocus ? [['focusHead', false]] : [], String(active))
  }
  const idle = arrivalRig(false, 'BODY')
  finishWordsArrival({ ok: true, readAt: 1, toast: null, focusHead: false }, idle.d)
  assert.equal(idle.frames.length, 0, '걸려 있지 않으면 초점을 건드리지 않는다')
})

const ROUTER = { push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop }

test('W7 단어장 화면이 상세 시트에 화면 하나의 별 기록(fav)을 넘긴다 — 시트 머리 별이 단어장에서 보인다', () => {
  const orig = React.useSyncExternalStore
  // 시험 프로세스 한정: 수화 뒤(클라이언트 스냅샷) 화면을 흉내 — 시트는 수화 뒤에만 그린다.
  React.useSyncExternalStore = (_s: unknown, get: () => unknown) => get()
  try {
    const out = elementOf(WordsScreen, { initialWordId: 'w1' }, (el) => h(AppRouterContext.Provider, { value: ROUTER as never }, el))
    const sheet = walk(out).find((e) => e.type === WordDetailSheet)
    assert.ok(sheet, '상세 시트 요소')
    const fav = sheet.props.fav as WordFavorites | undefined
    assert.ok(fav, 'fav 를 넘긴다')
    for (const k of ['press', 'view', 'stamp'] as const) assert.equal(typeof fav[k], 'function', k)
    assert.deepEqual(fav.view('w1', true, 0), { on: true, locked: false }, '기록이 없으면 서버 값')
  } finally {
    React.useSyncExternalStore = orig
  }
})

// ── (b) 별 요청 경로·컨트롤러 수명 ───────────────────────────────────────────────────

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
async function withFetch<T>(impl: (url: string, init: RequestInit) => Promise<Response>, run: () => Promise<T>): Promise<T> {
  const orig = globalThis.fetch
  globalThis.fetch = ((url: unknown, init: RequestInit) => impl(String(url), init)) as typeof fetch
  try {
    return await run()
  } finally {
    globalThis.fetch = orig
  }
}
const statusOfRejection = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof Error)
    return (e as { status?: unknown }).status
  }
  assert.fail('거절되어야 함')
}

test('B5 sendFavorite(가짜 fetch): 켜기 = POST /api/v1/words/:id/favorite · 끄기 = POST …/unfavorite(id 는 인코딩) · 성공 = data', async () => {
  const seen: string[] = []
  await withFetch(
    async (url, init) => {
      seen.push(`${init.method} ${url}`)
      return json(200, { success: true, data: { id: 'a/b', favorite: url.endsWith('/favorite') }, message: null })
    },
    async () => {
      assert.deepEqual(await sendFavorite('a/b', true), { id: 'a/b', favorite: true })
      assert.deepEqual(await sendFavorite('a/b', false), { id: 'a/b', favorite: false })
    },
  )
  assert.deepEqual(seen, ['POST /api/v1/words/a%2Fb/favorite', 'POST /api/v1/words/a%2Fb/unfavorite'])
})

test('B6 sendFavorite 오류 → 컨트롤러가 읽는 status: 404·500 은 그 값 · 연결 실패 0 · 모르는 모양(취소) −1 → 진짜 컨트롤러 문구(404 만 notFound)', async () => {
  const cases: Array<[string, () => Promise<Response>, number, string, boolean]> = [
    ['404', async () => json(404, { success: false, data: { code: 'NOT_FOUND' }, message: '서버 문구' }), 404, WORD_NOT_FOUND, true],
    ['500', async () => json(500, { success: false, data: { code: 'INTERNAL' }, message: '서버 문구' }), 500, GENERIC_ERROR, false],
    ['offline', async () => Promise.reject(new TypeError('fetch failed')), 0, NETWORK_ERROR, false],
    ['abort', async () => Promise.reject(new DOMException('aborted', 'AbortError')), -1, GENERIC_ERROR, false],
  ]
  for (const [name, impl, status, toast, notFound] of cases) {
    await withFetch(impl, async () => {
      assert.equal(await statusOfRejection(sendFavorite('w1', true)), status, name)
      const effects: FavEffect[] = []
      const c = createFavoriteController({ send: sendFavorite, now: () => 1, inFavoriteView: () => true, onChange: noop, onEffect: (x) => effects.push(x) })
      c.press('w1', false)
      await flush()
      await flush()
      assert.deepEqual(effects, [{ id: 'w1', reload: false, toast, notFound }], name)
      assert.deepEqual(c.view('w1', false, 0), { on: false, locked: false }, `${name} 되돌림`)
    })
  }
})

test('B7 컨트롤러 수명: 붙이면 slot 에 · 정리 = dispose(뒤 응답·누름 0) + slot 비움 · StrictMode 껐다 켜기 뒤 늦은 옛 정리는 새 컨트롤러를 지우지 않음', async () => {
  const slot: { current: FavoriteController | null } = { current: null }
  const sent: Array<(v: { favorite?: unknown }) => void> = []
  const log: string[] = []
  const deps = {
    send: () => new Promise<{ favorite?: unknown }>((resolve) => sent.push(resolve)),
    now: () => 1,
    inFavoriteView: () => true,
    onChange: () => log.push('change'),
    onEffect: () => log.push('effect'),
  }
  const cleanup1 = mountFavoriteController(slot, deps)
  const c1 = slot.current
  assert.ok(c1)
  c1.press('w1', true)
  assert.deepEqual(log, ['change'])
  cleanup1()
  assert.equal(slot.current, null)
  sent[0]!({ favorite: false })
  await flush()
  assert.deepEqual(log, ['change'], '정리 뒤 도착한 응답은 상태·효과 0')
  c1.press('w2', false)
  assert.equal(sent.length, 1, '정리 뒤 누름도 요청 0')

  const cleanupA = mountFavoriteController(slot, deps)
  const cleanupB = mountFavoriteController(slot, deps)
  const cB = slot.current as FavoriteController | null // assert.equal(…, null) 이 좁힌 타입을 푼다
  cleanupA()
  assert.equal(slot.current, cB, '옛 정리는 새 컨트롤러를 지우지 않는다')
  cB!.press('w3', false)
  assert.equal(sent.length, 2, '새 컨트롤러는 살아 있다')
  cleanupB()
  assert.equal(slot.current, null)
})

// ── (c) 상세 시트: 보내기 직전 stamp → 응답 뒤 readAt ─────────────────────────────────

test('C8 stampedSend: 시계를 먼저 찍고 그다음 보낸다 · 돌려준 readAt = 그 시각 · res = 보낸 요청', async () => {
  const order: string[] = []
  const p = Promise.resolve('응답')
  const out = stampedSend(
    () => (order.push('stamp'), 5),
    () => (order.push('send'), p),
  )
  assert.deepEqual(order, ['stamp', 'send'])
  assert.equal(out.readAt, 5)
  assert.equal(out.res, p)
})

/**
 * 시험 프로세스 한정 — `useState` 를 호출 순서별 슬롯으로 바꿔 다시 불러도 값이 남게 한다(효과는 돌지 않는다 = 서버 렌더 그대로).
 * 처리기는 진짜 컴포넌트가 만든 것을 그대로 부른다. setState 는 `events` 에 ['set', 값] 으로 남는다.
 */
function statefulSheet(events: unknown[][]) {
  const orig = React.useState
  const slots: unknown[] = []
  let cursor = 0
  React.useState = (init: unknown) => {
    const i = cursor++
    if (!(i in slots)) slots[i] = typeof init === 'function' ? (init as () => unknown)() : init
    const set = (a: unknown) => {
      slots[i] = typeof a === 'function' ? (a as (p: unknown) => unknown)(slots[i]) : a
      events.push(['set', slots[i]])
    }
    return [slots[i], set]
  }
  return {
    render(props: Parameters<typeof WordDetailSheet>[0]) {
      cursor = 0
      const el = elementOf(WordDetailSheet, props)
      assert.ok(isValidElement(el))
      return el as ReactElement<Record<string, unknown>>
    },
    restore: () => {
      React.useState = orig
    },
  }
}

function sheetRig(w: WordEntry, respond: (url: string, init: RequestInit) => Response) {
  const events: unknown[][] = []
  const calls: unknown[][] = []
  let n = 7000
  const fav: WordFavorites = {
    press: (id, shown) => calls.push(['press', id, shown]),
    view: () => ({ on: true, locked: false }),
    stamp: () => {
      n += 1
      events.push(['stamp', n])
      return n
    },
  }
  const props: Parameters<typeof WordDetailSheet>[0] = {
    wordId: w.id,
    preview: w,
    categories: [],
    fav,
    onClose: noop,
    onChanged: (x) => calls.push(['changed', x]),
    onRemoved: (id) => calls.push(['removed', id]),
    onArchivedChange: (x) => calls.push(['archived', x]),
    onOpenWord: noop,
    onNotFound: () => calls.push(['notFound']),
    onToast: (m) => calls.push(['toast', m]),
  }
  const fetchImpl = (url: string, init: RequestInit) => {
    events.push(['fetch', `${init.method} ${url}`, init.body])
    return Promise.resolve(respond(url, init)).then((r) => {
      events.push(['responded'])
      return r
    })
  }
  return { events, calls, props, fetchImpl, stamps: () => events.filter((e) => e[0] === 'stamp').map((e) => e[1]) }
}
const idx = (events: unknown[][], pred: (e: unknown[]) => boolean) => events.findIndex(pred)
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 20 && !cond(); i++) await flush()
}

test('C9 상세 시트 저장(진짜 처리기): [수정] → 뜻 고침 → 제출 = PATCH 1번 · stamp 는 보내기 직전 · 응답을 받은 뒤 readAt = 그 시각 · 수정 모드에도 머리 별', async () => {
  const w = word({ id: 'm1', origin: 'MINE', readOnly: false, source: 'MANUAL' })
  const r = sheetRig(w, () => json(200, { success: true, data: { ...w, meaning: '마시다' }, message: null }))
  const H = statefulSheet(r.events)
  try {
    await withFetch(
      async (url, init) => r.fetchImpl(url, init),
      async () => {
        const view = H.render(r.props)
        ;(walk(view).find((e) => e.type === DetailActions)!.props.onEdit as () => void)()
        const edit = H.render(r.props)
        const star = edit.props.headerAction as ReactElement<Record<string, unknown>> | undefined
        assert.ok(star && star.type === FavoriteStar, '수정 모드에도 머리 별')
        ;(star.props.onPress as () => void)()
        assert.deepEqual(r.calls, [['press', 'm1', true]])
        r.calls.length = 0
        ;(walk(edit).find((e) => e.type === WordForm)!.props.onChange as (k: string, v: string) => void)('meaning', '마시다')
        const ready = H.render(r.props)
        assert.deepEqual(r.events.filter((e) => e[0] !== 'set'), [], '제출 전 요청·stamp 0')
        ;(walk(ready).find((e) => e.type === 'form')!.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: noop })
        await until(() => r.calls.some((c) => c[0] === 'changed'))
      },
    )
  } finally {
    H.restore()
  }
  const [stamp] = r.stamps()
  assert.equal(r.stamps().length, 1, 'stamp 1번')
  const iStamp = idx(r.events, (e) => e[0] === 'stamp')
  const iFetch = idx(r.events, (e) => e[0] === 'fetch')
  const iResp = idx(r.events, (e) => e[0] === 'responded')
  const iRead = idx(r.events, (e) => e[0] === 'set' && e[1] === stamp)
  assert.deepEqual(r.events[iFetch]!.slice(1), ['PATCH /api/v1/words/m1', JSON.stringify({ meaning: '마시다' })])
  assert.ok(iStamp >= 0 && iStamp < iFetch, 'stamp 는 보내기 직전')
  assert.ok(iRead > iResp, `readAt 은 응답 뒤에 그 stamp 로 (${iRead} > ${iResp})`)
  assert.equal(r.events.filter((e) => e[0] === 'set' && e[1] === stamp).length, 1)
  assert.deepEqual(
    r.calls.map((c) => c[0]),
    ['changed', 'toast'],
  )
  assert.equal((r.calls[0]![1] as WordEntry).meaning, '마시다')
})

test('C10 상세 시트 보관·보관 풀기(진짜 처리기): POST …/archive|unarchive 1번 · stamp 는 보내기 직전 · 응답 뒤 readAt = 그 시각 · 실패면 readAt 그대로', async () => {
  for (const archived of [false, true]) {
    const w = word({ id: 'b1', archived })
    const r = sheetRig(w, () => json(200, { success: true, data: { id: 'b1', archived: !archived }, message: null }))
    const H = statefulSheet(r.events)
    try {
      await withFetch(
        async (url, init) => r.fetchImpl(url, init),
        async () => {
          ;(walk(H.render(r.props)).find((e) => e.type === DetailActions)!.props.onArchive as () => void)()
          await until(() => r.calls.some((c) => c[0] === 'archived'))
        },
      )
    } finally {
      H.restore()
    }
    const [stamp] = r.stamps()
    assert.equal(r.stamps().length, 1)
    const iFetch = idx(r.events, (e) => e[0] === 'fetch')
    assert.equal(r.events[iFetch]![1], `POST /api/v1/words/b1/${archived ? 'unarchive' : 'archive'}`)
    assert.ok(idx(r.events, (e) => e[0] === 'stamp') < iFetch, 'stamp 는 보내기 직전')
    const iRead = idx(r.events, (e) => e[0] === 'set' && e[1] === stamp)
    assert.ok(iRead > idx(r.events, (e) => e[0] === 'responded'), 'readAt 은 응답 뒤')
    assert.equal((r.calls.find((c) => c[0] === 'archived')![1] as WordEntry).archived, !archived)
  }

  const w = word({ id: 'b2' })
  const r = sheetRig(w, () => json(500, { success: false, data: { code: 'INTERNAL' }, message: null }))
  const H = statefulSheet(r.events)
  try {
    await withFetch(
      async (url, init) => r.fetchImpl(url, init),
      async () => {
        ;(walk(H.render(r.props)).find((e) => e.type === DetailActions)!.props.onArchive as () => void)()
        await until(() => r.calls.some((c) => c[0] === 'toast'))
      },
    )
  } finally {
    H.restore()
  }
  const [stamp] = r.stamps()
  assert.equal(r.events.filter((e) => e[0] === 'set' && e[1] === stamp).length, 0, '실패면 readAt 그대로')
  assert.equal(r.calls.filter((c) => c[0] === 'archived').length, 0)
})

test('C11 머리 별: 보기 모드에는 있고 삭제 확인 모드에는 없다(진짜 [삭제] 처리기로 모드 전환)', () => {
  const r = sheetRig(word({ id: 'm2', origin: 'MINE', readOnly: false, source: 'MANUAL' }), () => json(200, {}))
  const H = statefulSheet(r.events)
  try {
    const view = H.render(r.props)
    const star = view.props.headerAction as ReactElement<Record<string, unknown>>
    assert.equal(star.type, FavoriteStar)
    ;(walk(view).find((e) => e.type === DetailActions)!.props.onDelete as () => void)()
    const confirm = H.render(r.props)
    assert.equal(confirm.props.headerAction, undefined)
  } finally {
    H.restore()
  }
})

// ── (d) 빈 화면 두 단추 ───────────────────────────────────────────────────────────

test('D1 빈 화면 「즐겨찾기 0」·「조건과 겹쳐 0」: 누를 수 있는 것은 단추 하나 · 누르면 즐겨찾기 칸만 푼다(onClearFavorite) — 다른 처리기 0', () => {
  for (const [variant, cond] of [
    ['noFavorite', { q: '', category: null, chunk: null, archived: false }],
    ['noFavoriteMatch', { q: 'ねこ', category: '동물', chunk: 'ACTION', archived: true }],
    ['noFavoriteMatch', { q: '', category: null, chunk: null, archived: true }],
  ] as const) {
    const calls: string[] = []
    const el = WordsEmpty({
      variant,
      ...cond,
      onAdd: () => calls.push('add'),
      onShowArchive: () => calls.push('archive'),
      onShowAll: () => calls.push('showAll'),
      onClearChunk: () => calls.push('clearChunk'),
      onClearFavorite: () => calls.push('clearFavorite'),
    })
    const clickable = walk(el).filter((e) => typeof e.props.onClick === 'function')
    assert.equal(clickable.length, 1, variant)
    ;(clickable[0]!.props.onClick as () => void)()
    assert.deepEqual(calls, ['clearFavorite'], variant)
  }
})

// ── (e) 행 셋째 줄 비움·별 자리 — 설정 로드 뒤 ─────────────────────────────────────────

const seg = (surface: string, pron: string | null): ReadingSegment => ({ surface, ruby: null, pron, boundary: null })
const READY: AnnotationState = { s: 'ready', segments: [seg('食べる', 'タベル')] }
const NONE: AnnotationState = { s: 'ready', segments: [seg('?', null)] }
const LOADING = { s: 'loading' } as AnnotationState
const RUBY = [{ text: '食', reading: 'た' }, { text: 'べる', reading: null }]

function rowsWithPrefs(p: Partial<DisplayValues>, layers: { ruby: unknown; hangul: AnnotationState }[]): string[] {
  const orig = React.useSyncExternalStore as (...a: unknown[]) => unknown
  const snap = { ...DISPLAY_DEFAULTS, ...p, loaded: true, error: false, trEpoch: 0, failEpoch: 0 }
  // 시험 프로세스 한정: 표시 설정 저장소만 「로드됨」 스냅샷을 돌려준다(서버 렌더는 원래 로드 전 스냅샷).
  React.useSyncExternalStore = (sub: unknown, get: unknown, srv: unknown) => (get === displayPrefsStore.getSnapshot ? snap : orig(sub, get, srv))
  try {
    const items = layers.map((_, i) => word({ id: `r${i}` }))
    const html = renderToStaticMarkup(
      h(WordsPageList, {
        items,
        layers: layers as never,
        sort: 'recent',
        status: 'ready',
        paged: false,
        view: wordsPagerView({ page: 0, pages: 1, total: items.length, status: 'ready' }),
        favView: () => ({ on: false, locked: false }),
        onStar: noop,
        onOpen: noop,
        onPrev: noop,
        onNext: noop,
        onJump: noop,
        onRetry: noop,
      }),
    )
    return html.match(/<li class="relative">[\s\S]*?<\/li>/g) ?? []
  } finally {
    React.useSyncExternalStore = orig
  }
}
const padded = (row: string) => /items-baseline gap-2 pr-6"/.test(row)
const topOf = (row: string) => row.match(/style="top:([0-9.]+em)"/)?.[1]
const hasHangulText = (row: string) => /한글 발음: /.test(row)

test('E1 설정 로드 뒤 행: 한글 줄(분석됨·로딩)이 있으면 셋째 줄을 비우지 않고 없으면 비운다 · 별 자리 = 히라가나 켬+루비 있음만 2.471em', () => {
  const layers = [
    { ruby: RUBY, hangul: READY },
    { ruby: null, hangul: NONE },
    { ruby: RUBY, hangul: LOADING },
    { ruby: [], hangul: OFF },
  ]
  const on = rowsWithPrefs({}, layers)
  assert.equal(on.length, 4)
  assert.deepEqual(on.map(padded), [false, true, false, true], '히라가나·한글 켬')
  assert.deepEqual(on.map(topOf), ['2.471em', '2.021em', '2.471em', '2.471em'])
  assert.ok(hasHangulText(on[0]!) && !hasHangulText(on[1]!), '한글 줄을 그린 행 = 비우지 않은 행')

  const fuOff = rowsWithPrefs({ showFurigana: false }, layers)
  assert.deepEqual(fuOff.map(topOf), ['2.021em', '2.021em', '2.021em', '2.021em'], '히라가나 끔')
  assert.deepEqual(fuOff.map(padded), [false, true, false, true])

  const hgOff = rowsWithPrefs({ showHangul: false }, layers)
  assert.deepEqual(hgOff.map(padded), [true, true, true, true], '한글 끔 = 한글 줄 없음')
  assert.ok(!hgOff.some(hasHangulText))
  assert.deepEqual(hgOff.map(topOf), ['2.471em', '2.021em', '2.471em', '2.471em'])
})
