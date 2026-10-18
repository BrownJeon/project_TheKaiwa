import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WordEntry, WordListPage, WordSort } from '@/types/vocab'
import { WORD_FILTER_INITIAL, type WordListFilter } from '../logic'
import {
  beginWords,
  clampAfterResponse,
  fillerCount,
  focusHeadLine,
  isWordsPaged,
  navForKey,
  navTo,
  pageAfterAdd,
  parseJumpPage,
  settleWords,
  wordPages,
  WORDS_INITIAL,
  WORDS_PAGE,
  wordsCondKey,
  wordsListUrl,
  wordsPagerView,
  type WordsListState,
  type WordsNav,
  type WordsShown,
} from '../wordsPaging'

// task-068 §28-9 T1~T8 — 단어장 7개씩 쪽(순수 계산·쪽 상태·요청 시작/끝).

const F = WORD_FILTER_INITIAL
const SHOWN: WordsShown = { ...F, sort: 'recent' }
const w = (id: string) => ({ id }) as WordEntry
const rows = (n: number, p = 'w') => Array.from({ length: n }, (_, i) => w(`${p}${i}`))
const resp = (total: number, n: number, o: Partial<WordListPage> = {}): WordListPage => ({
  items: rows(n),
  total,
  page: 1,
  pages: Math.max(1, Math.ceil(total / 7)),
  limit: 7,
  baseTotal: 7758,
  ...o,
})
const readyAt = (total: number, n = Math.min(total, 7)): WordsListState =>
  settleWords(WORDS_INITIAL, { kind: 'first', page: 0, shown: SHOWN }, { ok: true, page: resp(total, n) }).state

test('T1 한 쪽 최대 7행 — WORDS_PAGE === 7 · 주소에 limit=7·page=<0부터+1>·cursor 키 없음 · source 는 all 이어도 넣음', () => {
  assert.equal(WORDS_PAGE, 7)
  assert.equal(wordsListUrl(F, 'recent', 0), '/api/v1/words?source=all&archived=0&sort=recent&page=1&limit=7')
  assert.equal(
    wordsListUrl({ q: '食べ', category: '여행', chunk: 'EXPRESSION', archived: true, source: 'mine' }, 'wrong', 2),
    '/api/v1/words?q=%E9%A3%9F%E3%81%B9&category=%EC%97%AC%ED%96%89&chunkType=EXPRESSION&source=mine&archived=1&sort=wrong&page=3&limit=7',
  )
  for (const p of [0, 1, 1108]) assert.ok(!wordsListUrl(F, 'surface', p).includes('cursor'))
})

test('T2 쪽 수 = max(1, ⌈total/7⌉) — 0→1 · 1→1 · 7→1 · 8→2 · 7755→1108 · 7758→1109 · null→1', () => {
  assert.deepEqual([0, 1, 7, 8, 7755, 7758].map(wordPages), [1, 1, 1, 2, 1108, 1109])
  assert.equal(wordPages(null), 1)
})

test('T3 7개 이하 1쪽이면 쪽 줄 없음 — total ≤ 7 && page 0 → false · 8개부터 · 1쪽이 아니면 늘 있음', () => {
  assert.equal(isWordsPaged(0, 0), false)
  assert.equal(isWordsPaged(7, 0), false)
  assert.equal(isWordsPaged(null, 0), false)
  assert.equal(isWordsPaged(8, 0), true)
  assert.equal(isWordsPaged(3, 1), true, '다른 기기에서 지워 줄었어도 2쪽이면 쪽 줄을 남긴다')
})

test('T4 wordsPagerView — 1쪽 이전 흐림 · 마지막 다음 흐림 · paging 셋 다 흐림 + 목표 쪽 라벨 · pageError 다음만 흐림 · 문구', () => {
  const v1 = wordsPagerView({ page: 0, pages: 1109, total: 7758, status: 'ready' })
  assert.deepEqual([v1.prevDisabled, v1.nextDisabled, v1.centerDisabled], [true, false, false])
  const last = wordsPagerView({ page: 1108, pages: 1109, total: 7758, status: 'ready' })
  assert.deepEqual([last.prevDisabled, last.nextDisabled, last.centerDisabled], [false, true, false])
  const busy = wordsPagerView({ page: 3, pages: 1109, total: 7758, status: 'paging' })
  assert.deepEqual([busy.prevDisabled, busy.nextDisabled, busy.centerDisabled], [true, true, true])
  assert.equal(busy.label, '4 / 1,109')
  assert.equal(busy.sub, '불러오는 중…')
  assert.equal(busy.sr, '4쪽을 불러오고 있어요')
  const err = wordsPagerView({ page: 2, pages: 1109, total: 7758, status: 'pageError' })
  assert.deepEqual([err.prevDisabled, err.nextDisabled, err.centerDisabled], [false, true, false])
  const mid = wordsPagerView({ page: 2, pages: 1109, total: 7758, status: 'ready' })
  assert.equal(mid.label, '3 / 1,109')
  assert.equal(mid.sub, '모두 7,758개')
  assert.equal(mid.centerAria, '3 / 1,109 — 쪽으로 이동')
  assert.equal(mid.sr, '1,109쪽 중 3쪽 · 모두 7,758개')
  for (const status of ['first', 'firstError'] as const) {
    const v = wordsPagerView({ page: 0, pages: 3, total: null, status })
    assert.ok(v.prevDisabled && v.nextDisabled, status)
  }
})

test('T5 빈 자리 — 마지막 쪽 7 − 행 수 · 쪽 오류 5 · 쪽 줄 없으면 0', () => {
  assert.equal(fillerCount(true, 3, 'ready'), 4)
  assert.equal(fillerCount(true, 7, 'ready'), 0)
  assert.equal(fillerCount(true, 0, 'pageError'), 5)
  assert.equal(fillerCount(true, 7, 'pageError'), 5)
  assert.equal(fillerCount(false, 3, 'ready'), 0)
  assert.equal(fillerCount(false, 0, 'pageError'), 0)
})

test('T6 parseJumpPage(v, 1109) — 엄격: 숫자·쉼표·공백·전각 숫자만', () => {
  for (const bad of ['', '0', '1110', '1.5', '-3', '12a', 'abc', '1e3', '+5', '０'])
    assert.equal(parseJumpPage(bad, 1109), null, JSON.stringify(bad))
  assert.equal(parseJumpPage('1', 1109), 0)
  assert.equal(parseJumpPage(' 12 ', 1109), 11)
  assert.equal(parseJumpPage('1,109', 1109), 1108)
  assert.equal(parseJumpPage('１２', 1109), 11)
  assert.equal(parseJumpPage('１，１０９', 1109), 1108)
  assert.equal(parseJumpPage('1', 1), 0)
  assert.equal(parseJumpPage('2', 1), null)
})

test('T7 D2 — 조건 하나라도 바뀌면 1쪽 · 같으면 그대로(같은 객체) · pageAfterAdd · 쪽은 0부터 그대로 남음', () => {
  const base: { f: WordListFilter; sort: WordSort } = { f: { ...F, q: 'a', category: '여행', chunk: 'NAME' }, sort: 'recent' }
  const key0 = wordsCondKey(base.f, base.sort)
  const nav: WordsNav = { key: key0, page: 5, kind: 'page', seq: 3 }
  assert.equal(navForKey(nav, key0), nav, '같은 조건 — 상세·추가·쪽 시트를 닫아도 쪽 불변')
  const patches: Partial<WordListFilter>[] = [{ q: 'b' }, { source: 'mine' }, { source: 'base' }, { category: null }, { chunk: 'EXPRESSION' }, { chunk: null }, { archived: true }]
  for (const patch of patches) {
    const next = navForKey(nav, wordsCondKey({ ...base.f, ...patch }, base.sort))
    assert.equal(next.page, 0, JSON.stringify(patch))
    assert.equal(next.kind, 'filter')
    assert.ok(next.seq > nav.seq)
  }
  for (const sort of ['wrong', 'surface'] as const) assert.equal(navForKey(nav, wordsCondKey(base.f, sort)).page, 0, sort)
  assert.deepEqual(navTo(nav, key0, 7, 'page'), { key: key0, page: 7, kind: 'page', seq: 4 })
  assert.equal(pageAfterAdd('recent', 5), 0)
  assert.equal(pageAfterAdd('wrong', 5), 5)
  assert.equal(pageAfterAdd('surface', 5), 5)
})

test('T8 clampAfterResponse — (5,30)=4 · (2,30)=2 · (0,0)=0', () => {
  assert.equal(clampAfterResponse(5, 30), 4)
  assert.equal(clampAfterResponse(2, 30), 2)
  assert.equal(clampAfterResponse(0, 0), 0)
})

test('T8 비었고 쪽 수가 줄었을 때만 한 번 다시 읽음 — 보정 응답이 또 비고 더 줄어도 세 번째 요청 0(가짜 apiGet · 화면 루프)', async () => {
  const calls: number[] = []
  // 30개 → 5쪽. 6쪽(0부터 5)을 요청했는데 그 사이 다른 기기에서 계속 지워 응답마다 쪽 수가 더 줄고 행은 늘 비어 온다.
  const totals = [30, 7, 0]
  const apiGet = async (page: number): Promise<WordListPage> => {
    const total = totals[Math.min(calls.length, totals.length - 1)] ?? 0
    calls.push(page)
    return resp(total, 0, { page: page + 1, pages: Math.max(1, Math.ceil(total / 7)) })
  }
  let s = beginWords(readyAt(30), 'page')
  let req: { kind: 'page' | 'clamp'; page: number; shown: WordsShown } = { kind: 'page', page: 5, shown: SHOWN }
  // WordsScreen 과 같은 루프 — clampTo 가 오면 그 쪽으로 `clamp` 요청을 낸다.
  for (let guard = 0; guard < 10; guard++) {
    const out = settleWords(s, req, { ok: true, page: await apiGet(req.page) })
    if (out.clampTo === null) {
      s = out.state
      break
    }
    assert.equal(out.state, s, '보정 전에는 상태를 바꾸지 않는다')
    s = beginWords(s, 'clamp')
    req = { kind: 'clamp', page: out.clampTo, shown: SHOWN }
  }
  assert.deepEqual(calls, [5, 4], '요청은 처음 + 보정 한 번뿐')
  assert.equal(s.status, 'ready')
  assert.deepEqual(s.items, [])
  // 요청 쪽이 쪽 수 안이면 비어도 보정하지 않는다.
  assert.equal(settleWords(s, { kind: 'page', page: 2, shown: SHOWN }, { ok: true, page: resp(30, 0) }).clampTo, null)
  assert.equal(settleWords(s, { kind: 'page', page: 5, shown: SHOWN }, { ok: true, page: resp(30, 0) }).clampTo, 4)
})

test('요청 시작 — 쪽 넘김·다시 시도·보정만 paging, 조건 변경·다시 읽기는 지금 행을 둔 채 · 첫 읽기 전에는 first', () => {
  const r = readyAt(30)
  assert.equal(beginWords(r, 'page').status, 'paging')
  assert.equal(beginWords(r, 'retry').status, 'paging')
  assert.equal(beginWords(r, 'clamp').status, 'paging')
  assert.equal(beginWords(r, 'filter'), r)
  assert.equal(beginWords(r, 'reload'), r)
  assert.equal(beginWords(WORDS_INITIAL, 'filter').status, 'first')
  assert.equal(beginWords({ ...WORDS_INITIAL, status: 'firstError', error: 'x' }, 'first').status, 'first')
})

test('요청 끝 — 첫 읽기 실패 firstError · 다시 읽기 실패는 행을 둔 채 토스트 · 쪽·조건 실패는 pageError · 쪽 넘김 성공만 머리 줄 초점', () => {
  const first = settleWords(beginWords(WORDS_INITIAL, 'first'), { kind: 'first', page: 0, shown: SHOWN }, { ok: false, error: '단어장을 불러오지 못했어요.' })
  assert.deepEqual([first.state.status, first.state.error, first.toast], ['firstError', '단어장을 불러오지 못했어요.', null])
  const r = readyAt(30)
  const reload = settleWords(r, { kind: 'reload', page: 1, shown: SHOWN }, { ok: false, error: 'E' })
  assert.equal(reload.state, r)
  assert.equal(reload.toast, 'E')
  for (const kind of ['page', 'retry', 'filter'] as const) {
    const o = settleWords(beginWords(r, kind), { kind, page: 1, shown: SHOWN }, { ok: false, error: 'E' })
    assert.equal(o.state.status, 'pageError', kind)
    assert.equal(o.toast, null)
  }
  const okPage = settleWords(beginWords(r, 'page'), { kind: 'page', page: 1, shown: SHOWN }, { ok: true, page: resp(30, 7, { page: 2 }) })
  assert.deepEqual([okPage.state.status, okPage.focusHead, okPage.state.pages, okPage.state.baseTotal], ['ready', true, 5, 7758])
  assert.equal(settleWords(r, { kind: 'reload', page: 1, shown: SHOWN }, { ok: true, page: resp(30, 7) }).focusHead, false)
  assert.equal(settleWords(r, { kind: 'filter', page: 0, shown: SHOWN }, { ok: true, page: resp(30, 7) }).focusHead, false)
  // 서버 pages 를 쓴다(다르면 서버 값) · 빠지면 total 로 계산
  assert.equal(settleWords(r, { kind: 'reload', page: 0, shown: SHOWN }, { ok: true, page: { items: rows(7), total: 30 } }).state.pages, 5)
  assert.equal(settleWords(r, { kind: 'reload', page: 0, shown: SHOWN }, { ok: true, page: resp(30, 7, { pages: 9 }) }).state.pages, 9)
})

test('REV-068C-1 쪽 넘기는 중 끼어든 다시 읽기가 실패해도 paging 에 갇히지 않는다 — 그 쪽의 쪽 오류로, [다시 시도]로 복구', () => {
  const r = readyAt(30)
  // [다음] → 회색 자리 → 화면 복귀(visibilitychange)가 같은 쪽을 다시 읽으며 끼어든다(앞 쪽 요청은 취소됨).
  const mid = beginWords(beginWords(r, 'page'), 'reload')
  assert.equal(mid.status, 'paging', '끼어든 다시 읽기는 상태를 그대로 둔다')
  const out = settleWords(mid, { kind: 'reload', page: 1, shown: SHOWN }, { ok: false, error: 'E' })
  assert.equal(out.state.status, 'pageError')
  assert.equal(out.toast, null, '오류 상자(role=alert)가 알린다 — 토스트를 겹치지 않는다')
  assert.equal(out.focusHead, false)
  const v = wordsPagerView({ page: 1, pages: out.state.pages, total: out.state.total, status: out.state.status })
  assert.deepEqual([v.prevDisabled, v.nextDisabled, v.centerDisabled], [false, true, false], '쪽 오류 — 이전·가운데는 쓸 수 있다')
  // [다시 시도] → 그 쪽을 받으면 ready + 머리 줄 초점
  const back = settleWords(beginWords(out.state, 'retry'), { kind: 'retry', page: 1, shown: SHOWN }, { ok: true, page: resp(30, 7, { page: 2 }) })
  assert.deepEqual([back.state.status, back.focusHead], ['ready', true])
  // 이미 쪽 오류인 채로 끼어든 다시 읽기가 실패해도 그대로 쪽 오류(토스트만) · ready 에서는 지금처럼 행을 둔 채 토스트
  const errState = settleWords(beginWords(r, 'page'), { kind: 'page', page: 1, shown: SHOWN }, { ok: false, error: 'E' }).state
  const again = settleWords(beginWords(errState, 'reload'), { kind: 'reload', page: 1, shown: SHOWN }, { ok: false, error: 'E2' })
  assert.deepEqual([again.state.status, again.toast], ['pageError', 'E2'])
})

test('REV-068C-1 어떤 요청 종류가 어떤 상태에서 실패해도 paging 이 남지 않는다 (first 는 firstError)', () => {
  const r = readyAt(30)
  const starts: Record<string, WordsListState> = {
    ready: r,
    paging: beginWords(r, 'page'),
    pageError: settleWords(beginWords(r, 'page'), { kind: 'page', page: 1, shown: SHOWN }, { ok: false, error: 'E' }).state,
  }
  for (const [name, start] of Object.entries(starts)) {
    for (const kind of ['page', 'retry', 'filter', 'reload', 'clamp'] as const) {
      const out = settleWords(beginWords(start, kind), { kind, page: 1, shown: SHOWN }, { ok: false, error: 'E' })
      assert.notEqual(out.state.status, 'paging', `${name} → ${kind} 실패`)
    }
  }
  const first = settleWords(beginWords(WORDS_INITIAL, 'first'), { kind: 'first', page: 0, shown: SHOWN }, { ok: false, error: 'E' })
  assert.equal(first.state.status, 'firstError')
})

test('REV-068C-4 머리 줄 초점 — 쪽 도착·삭제는 머리 줄을 위로 끌어오고(scroll), 안내 띠 ✕ 는 초점만(스크롤 0)', () => {
  const calls: string[] = []
  const el = {
    scrollIntoView: (o: ScrollIntoViewOptions) => calls.push(`scroll:${JSON.stringify(o)}`),
    focus: (o: FocusOptions) => calls.push(`focus:${JSON.stringify(o)}`),
  }
  focusHeadLine(el, true)
  assert.deepEqual(calls, ['scroll:{"block":"start","behavior":"auto"}', 'focus:{"preventScroll":true}'], '쪽 도착: 스크롤 → 초점(스크롤 막음)')
  calls.length = 0
  focusHeadLine(el, false)
  assert.deepEqual(calls, ['focus:{"preventScroll":true}'], '안내 띠 ✕: 초점만')
  assert.doesNotThrow(() => focusHeadLine(null, true))
})

test('REV-068C-4 배선 — 안내 띠 닫기는 scroll:false, 쪽 도착·삭제는 scroll:true 로 머리 줄 초점을 요청한다 (소스 스캔)', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const src = readFileSync(join(__dirname, '..', 'WordsScreen.tsx'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  assert.match(src, /<BaseWordBand[^>]*onClosed=\{\(\) => askHeadFocus\(false\)\}/)
  assert.match(src, /onRemoved=\{[\s\S]*?askHeadFocus\(true\)/)
  // task-074 REV-074U M-1: 목록 응답 꼬리를 `finishWordsArrival`(wordsFavoriteEffect.ts)로 옮겼다 — 쪽 도착 초점은 거기서 focusHead(true),
  // 화면은 그 값을 setFocusReq 로 잇는다(꼬리의 동작은 favoriteWiring.test W6 이 고정).
  assert.match(src, /finishWordsArrival\(\s*\{ ok: res\.ok, readAt, toast: out\.toast, focusHead: out\.focusHead \}/)
  assert.match(src, /focusHead: \(scroll\) => setFocusReq\(\(r\) => \(\{ tick: r\.tick \+ 1, scroll \}\)\)/)
  const tail = readFileSync(join(__dirname, '..', 'wordsFavoriteEffect.ts'), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  assert.match(tail, /if \(a\.focusHead\) d\.focusHead\(true\)/)
  assert.match(src, /focusHeadLine\(headRef\.current, focusReq\.scroll\)/)
  assert.doesNotMatch(src, /scrollIntoView/, '스크롤은 focusHeadLine 한 곳에서만')
})

test('T7 쪽은 저장소에 쓰지 않는다 — wordsPaging·WordsScreen 소스에 쪽 저장 0', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const strip = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  for (const f of ['wordsPaging.ts', 'WordsScreen.tsx']) {
    const src = strip(f)
    assert.doesNotMatch(src, /localStorage|sessionStorage/, f)
    assert.doesNotMatch(src, /(writeStore|putSession|useStored\w*)\([^)]*page/i, f)
  }
})
