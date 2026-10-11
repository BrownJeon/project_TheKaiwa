/**
 * task-055 Developer C — 화면 상태 전이(`logic.ts` 「화면 상태 전이」 절)와 `CorrectionsScreen` 의 규칙을 묶는 시험(screens.md §21-4·21-5·21-6).
 * 상태 판단은 순수 함수로 확인하고, 화면이 그 함수·규칙을 쓰는지는 소스로 묶는다(브라우저 없이 닫을 수 있는 21-12 A 항목).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { DrawerCorrectionItem } from '@/types/chat'
import {
  DRAWER_FILTER_NONE,
  DRAWER_LIST_INITIAL,
  drawerQuery,
  drawerView,
  focusWishStep,
  keepSearchTooLong,
  listFromFirstError,
  listFromFirstPage,
  listWithMore,
  listWithWordSurface,
  sameFilter,
  showEnd,
  type DrawerCorrectionFilter,
  type DrawerFocusWish,
} from '../logic'

const root = join(__dirname, '..', '..')
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
const screen = read('drawer', 'CorrectionsScreen.tsx')

const item = (id: string, extra: Partial<DrawerCorrectionItem> = {}): DrawerCorrectionItem => ({
  id,
  original: 'a',
  corrected: 'b',
  explanation: '',
  extraNoteKo: null,
  errorType: 'GRAMMAR',
  severity: 'MINOR',
  chunkType: null,
  chat: { id: 'ch', title: 't', kind: 'CHAT' },
  resolvedAt: '2026-10-10T00:00:00.000Z',
  ...extra,
})
const F = (f: Partial<DrawerCorrectionFilter> = {}): DrawerCorrectionFilter => ({ ...DRAWER_FILTER_NONE, ...f })
const facets = { errorType: [{ value: 'GRAMMAR' as const, count: 2 }] }

// ── 상태 → 그릴 모양(§21-4) ────────────────────────────────────────────────────

test('첫 로딩: 받은 것 없음 → 자리표시 · 유형 줄 자리표시 · 검색·조각 inert · 머리 줄 비움', () => {
  const q = drawerQuery(F(), 0)
  assert.deepEqual(drawerView(DRAWER_LIST_INITIAL, q), { body: 'skeleton', firstLoading: true, typeRow: 'skeleton', head: false })
})

test('첫 쪽 성공 → 목록 · 유형 칩 · 머리 줄', () => {
  const q = drawerQuery(F(), 0)
  const l = listFromFirstPage(q, { items: [item('1')], nextCursor: null, facets })
  assert.deepEqual(drawerView(l, q), { body: 'list', firstLoading: false, typeRow: 'chips', head: true })
  assert.deepEqual(l.shown, F())
})

test('빈 상태 구분: 조건 없음 0개 = E1, 유형·조각만 = E2, 검색어 있음 = E3(유형이 함께여도)', () => {
  const v = (f: DrawerCorrectionFilter) => {
    const q = drawerQuery(f, 0)
    return drawerView(listFromFirstPage(q, { items: [], nextCursor: null, facets: { errorType: [] } }), q).body
  }
  assert.equal(v(F()), 'emptyFirst')
  assert.equal(v(F({ errorType: 'PARTICLE' })), 'emptyFilter')
  assert.equal(v(F({ chunkType: 'NAME' })), 'emptyFilter')
  assert.equal(v(F({ q: '駅' })), 'emptySearch')
  assert.equal(v(F({ q: '駅', errorType: 'PARTICLE' })), 'emptySearch')
})

test('조건 바꾸는 중: 새 요청이 나가면 옛 목록 대신 자리표시, 유형 줄은 직전 숫자로 남음(firstLoading 아님)', () => {
  const q0 = drawerQuery(F(), 0)
  const l = listFromFirstPage(q0, { items: [item('1')], nextCursor: 'x', facets })
  const q1 = drawerQuery(F({ errorType: 'GRAMMAR' }), 1)
  assert.deepEqual(drawerView(l, q1), { body: 'skeleton', firstLoading: false, typeRow: 'chips', head: false })
})

test('요청 경합: 목록은 「지금 요청 객체」의 답일 때만 그린다 — 같은 조건이라도 옛 요청의 답이면 읽는 중', () => {
  const qa = drawerQuery(F({ chunkType: 'NAME' }), 1)
  const qb = drawerQuery(F({ chunkType: 'NAME' }), 2)
  const late = listFromFirstPage(qa, { items: [item('old')], nextCursor: null, facets })
  assert.equal(drawerView(late, qb).body, 'skeleton')
  assert.equal(drawerView(late, qa).body, 'list')
})

test('첫 로딩 실패: 오류 상자 · 유형 줄 없음 · 머리 줄 비움', () => {
  const q = drawerQuery(F(), 0)
  const l = listFromFirstError(DRAWER_LIST_INITIAL, q, '교정을 불러오지 못했어요. 네트워크를 확인해 주세요.')
  assert.deepEqual(drawerView(l, q), { body: 'error', firstLoading: false, typeRow: 'none', head: false })
})

test('조건을 바꾼 첫 쪽 실패: 옛 항목은 지우고 오류, 유형 줄은 직전 facets 로 남음(§21-13 ⑧)', () => {
  const q0 = drawerQuery(F(), 0)
  const ok = listFromFirstPage(q0, { items: [item('1')], nextCursor: 'x', facets })
  const q1 = drawerQuery(F({ chunkType: 'FEELING' }), 1)
  const err = listFromFirstError(ok, q1, 'e')
  assert.equal(err.items.length, 0)
  assert.equal(err.nextCursor, null)
  assert.deepEqual(err.facets, facets)
  assert.deepEqual(drawerView(err, q1), { body: 'error', firstLoading: false, typeRow: 'chips', head: false })
})

test('[다시 시도]: 한 번도 못 받았으면 다시 첫 로딩 모양(자리표시·유형 줄 자리표시)', () => {
  const q0 = drawerQuery(F(), 0)
  const err = listFromFirstError(DRAWER_LIST_INITIAL, q0, 'e')
  const q1 = drawerQuery(F(), 1, 20, { retry: true })
  assert.deepEqual(drawerView(err, q1), { body: 'skeleton', firstLoading: true, typeRow: 'skeleton', head: false })
})

test('단어 시트 뒤 조용한 다시 읽기: 받은 목록을 그대로 보인다(위치 유지), 오류 뒤면 자리표시', () => {
  const q0 = drawerQuery(F(), 0)
  const ok = listFromFirstPage(q0, { items: [item('1')], nextCursor: null, facets })
  const q1 = drawerQuery(F(), 1, 20, { silent: true })
  assert.deepEqual(drawerView(ok, q1), { body: 'list', firstLoading: false, typeRow: 'chips', head: true })
  const err = listFromFirstError(ok, q0, 'e')
  assert.equal(drawerView(err, q1).body, 'skeleton')
})

test('조용한 다시 읽기 실패: 받은 목록·커서·더 보기 표시를 그대로 두고 읽는 중만 끝낸다(오류 상자 없음)', () => {
  const q0 = drawerQuery(F(), 0)
  const ok = listWithMore(listFromFirstPage(q0, { items: [item('1')], nextCursor: 'c', facets }), { items: [item('2')], nextCursor: 'd' })
  const q1 = drawerQuery(F(), 1, 20, { silent: true })
  const after = listFromFirstError(ok, q1, 'e')
  assert.equal(after.query, q1)
  assert.deepEqual(after.items, ok.items)
  assert.equal(after.nextCursor, 'd')
  assert.equal(after.status, 'ready')
  assert.deepEqual(drawerView(after, q1), { body: 'list', firstLoading: false, typeRow: 'chips', head: true })
})

// ── 더 보기·facets(§21-5 C·D·E) ───────────────────────────────────────────────

test('더 보기: id 중복 제거로 이어 붙이고, facets·shown 은 첫 쪽 것을 유지(cursor 응답의 facets 무시)', () => {
  const q = drawerQuery(F(), 0)
  const l = listFromFirstPage(q, { items: [item('1'), item('2')], nextCursor: 'c1', facets })
  const m = listWithMore(l, { items: [item('2'), item('3')], nextCursor: null, facets: { errorType: [{ value: 'OTHER', count: 99 }] } })
  assert.deepEqual(m.items.map((c) => c.id), ['1', '2', '3'])
  assert.deepEqual(m.facets, facets)
  assert.equal(m.nextCursor, null)
  assert.equal(m.query, q, '더 보기는 요청 객체를 바꾸지 않는다(읽는 중이 되지 않음)')
})

test('끝 표시: 다음 쪽 없음 + 더 보기를 한 번 이상 성공했을 때만(한 쪽으로 끝나면 없음)', () => {
  const q = drawerQuery(F(), 0)
  const one = listFromFirstPage(q, { items: [item('1')], nextCursor: null, facets })
  assert.equal(showEnd(one), false)
  const two = listWithMore(listFromFirstPage(q, { items: [item('1')], nextCursor: 'c', facets }), { items: [item('2')], nextCursor: null })
  assert.equal(showEnd(two), true)
  const mid = listWithMore(listFromFirstPage(q, { items: [item('1')], nextCursor: 'c', facets }), { items: [item('2')], nextCursor: 'd' })
  assert.equal(showEnd(mid), false)
})

test('응답 방어: items 가 배열이 아니면 빈 목록, 빈 커서는 null, facets 없으면 빈 집계', () => {
  const q = drawerQuery(F(), 0)
  const l = listFromFirstPage(q, { items: null as never, nextCursor: '' })
  assert.deepEqual(l.items, [])
  assert.equal(l.nextCursor, null)
  assert.deepEqual(l.facets, { errorType: [] })
})

test('단어 표현 수정: 그 단어를 가리키는 카드 버튼 글자만 바뀐다(요청 없음), 없으면 같은 상태 객체', () => {
  const q = drawerQuery(F(), 0)
  const l = listFromFirstPage(q, { items: [item('1', { savedWord: { id: 'w', surface: '降りる' } }), item('2')], nextCursor: null, facets })
  const n = listWithWordSurface(l, 'w', '下りる')
  assert.equal(n.items[0].savedWord?.surface, '下りる')
  assert.equal(n.items[1], l.items[1])
  assert.equal(listWithWordSurface(l, 'zz', 'x'), l)
})

// ── 다시 그린 뒤 초점(REV-184 R2) ──────────────────────────────────────────────

test('초점 기록: 기다리던 다시 읽기의 답이 반영되기 전에는 기다리고(요소를 찾지도 않음), 반영되면 앞에서부터 있는 요소로 한 번', () => {
  const q0 = drawerQuery(F(), 0)
  const shownList = listFromFirstPage(q0, { items: [item('1'), item('2')], nextCursor: null, facets })
  const reload = drawerQuery(F(), 1, 20, { silent: true })
  const wish: DrawerFocusWish = { ids: ['dcr_1_go', 'dcr_1'], scroll: false, after: reload }
  const looked: string[] = []
  const lookup = (id: string) => {
    looked.push(id)
    return id === 'dcr_1' ? { id } : null
  }
  // 다시 읽는 중(목록은 옛 요청의 답) — 그 사이 다른 카드를 펼쳐 effect 가 돌아도 초점을 옮기지 않는다.
  assert.deepEqual(focusWishStep(wish, shownList.query, lookup), { kind: 'wait' })
  assert.deepEqual(looked, [], '기다리는 동안에는 DOM 을 보지 않는다')
  assert.deepEqual(focusWishStep(wish, null, lookup), { kind: 'wait' }, '첫 응답 전')
  // 다시 읽기 성공·조용한 실패 모두 목록 상태가 그 요청의 답이 된다.
  const ok = listFromFirstPage(reload, { items: [item('1')], nextCursor: null, facets })
  assert.deepEqual(focusWishStep(wish, ok.query, lookup), { kind: 'apply', target: { id: 'dcr_1' } })
  assert.deepEqual(looked, ['dcr_1_go', 'dcr_1'])
  const silentFail = listFromFirstError(shownList, reload, 'e')
  assert.equal(focusWishStep(wish, silentFail.query, lookup).kind, 'apply')
})

test('초점 기록: 답이 반영됐는데 대상이 없으면 버린다(drop) · 더 새 요청의 답이 깔렸어도 버린다', () => {
  const reload = drawerQuery(F(), 3, 20, { silent: true })
  const wish: DrawerFocusWish = { ids: ['dcr_gone'], scroll: false, after: reload }
  assert.deepEqual(focusWishStep(wish, reload, () => null), { kind: 'drop' }, '다시 읽은 목록에 그 카드가 없음')
  const newer = drawerQuery(F({ errorType: 'PARTICLE' }), 4)
  assert.deepEqual(focusWishStep(wish, newer, () => ({})), { kind: 'drop' }, '그 사이 다른 요청이 이겼다')
  const older = drawerQuery(F(), 2)
  assert.deepEqual(focusWishStep(wish, older, () => ({})), { kind: 'wait' }, '옛 요청의 답이 아직 깔려 있음')
})

test('초점 기록 배선: effect 는 focusWishStep 만 따르고(기다림이면 그대로, 아니면 비운 뒤 옮김), 펼침·접음·조건 변경은 기록을 버린다', () => {
  assert.match(
    screen,
    /const step = focusWishStep\(want, list\.query, \(id\) => document\.getElementById\(id\)\)\s*if \(step\.kind === 'wait'\) return\s*focusNext\.current = null\s*if \(step\.kind === 'drop'\) return\s*step\.target\.focus\(\{ preventScroll: true \}\)/,
  )
  assert.ok(!/if \(!el\) return/.test(screen), '요소가 없을 때 기록을 남긴 채 돌아가지 않는다')
  assert.match(screen, /const toggle = useCallback\(\(id: string\) => \{\s*focusNext\.current = null\s*setOpen/)
  assert.match(screen, /clearRestoreQuery\(\)\s*focusNext\.current = null\s*setQuery\(drawerQuery\(next, query\.tick \+ 1\)\)/)
  // 단어 삭제·없음: 기다릴 요청 = 지금 내보낸 조용한 다시 읽기 그 객체.
  assert.match(screen, /focusNext\.current = \{ ids: \[cardButtonId\(fromId\)\], scroll: false, after: reloadKeep\(\) \}/)
  assert.match(screen, /const next = drawerQuery\(query\.filter, query\.tick \+ 1, reloadLimit\(list\.items\.length\), \{ silent: true \}\)\s*setQuery\(next\)\s*return next/)
  // 돌아오기 복원: 지금 반영하는 첫 쪽 요청(q) 뒤에.
  assert.match(screen, /focusNext\.current = \{ ids: \[cardGoId\(f\), cardButtonId\(f\)\], scroll: true, after: q \}/)
  assert.equal((screen.match(/focusNext\.current = \{/g) ?? []).length, 2, '초점 기록을 만드는 곳은 둘뿐')
})

// ── 검색 40자 안내(REV-184 R4) ───────────────────────────────────────────────

test('40자 초과 안내: 입력을 40자 이하로 줄이면 풀리고 41자 이상이면 남는다 · 입력 중에는 새로 띄우지 않는다', () => {
  const s40 = 'あ'.repeat(40)
  const s41 = 'あ'.repeat(41)
  assert.equal(keepSearchTooLong(true, s41), true)
  assert.equal(keepSearchTooLong(true, s40), false, '경계 40자는 해제')
  assert.equal(keepSearchTooLong(true, ''), false)
  assert.equal(keepSearchTooLong(true, `  ${s40}  `), false, '확정 때와 같이 앞뒤 공백은 세지 않는다')
  assert.equal(keepSearchTooLong(true, '😀'.repeat(40)), false, '서로게이트 쌍은 1자(코드포인트)')
  assert.equal(keepSearchTooLong(true, '😀'.repeat(41)), true)
  assert.equal(keepSearchTooLong(false, s41), false, '안내는 Enter 확정 때만 뜬다')
})

test('40자 안내 배선: onInput 은 입력값 + 안내 유지 판단만(조회·조건 변경 없음), 확정 규칙은 그대로', () => {
  assert.match(screen, /onInput=\{onSearchInput\}/)
  const m = screen.match(/const onSearchInput = \(v: string\) => \{([\s\S]*?)\n {2}\}/)
  assert.ok(m)
  assert.match(m[1], /^\s*setQInput\(v\)\s*setQTooLong\(\(was\) => keepSearchTooLong\(was, v\)\)\s*$/)
  assert.ok(!/changeFilter|setQuery|apiGet/.test(m[1]), 'Enter 확정 전에는 조회 0')
  assert.match(screen, /error=\{qTooLong \? C\.searchTooLong : null\}/)
})

test('sameFilter: 세 값이 모두 같을 때만 같다', () => {
  assert.ok(sameFilter(F({ q: 'a' }), F({ q: 'a' })))
  assert.ok(!sameFilter(F(), F({ chunkType: 'NAME' })))
  assert.ok(!sameFilter(F(), F({ errorType: 'OTHER' })))
})

// ── 화면이 규칙을 지키는가(소스) ────────────────────────────────────────────────

test('첫 쪽 요청: abort + 요청 번호로 늦은 응답 버림, 상태 판단은 drawerView/listFrom* 로', () => {
  assert.match(screen, /new AbortController\(\)/)
  assert.match(screen, /const id = \+\+reqRef\.current/)
  assert.match(screen, /if \(id !== reqRef\.current\) return/)
  assert.match(screen, /drawerView\(list, query\)/)
  assert.match(screen, /listFromFirstPage\(q, page\)/)
  assert.match(screen, /listFromFirstError\(l, q, loadErrorText\(toErr\(e\)\)\)/)
  assert.match(screen, /retryFailHoldMs\(true, startedAt, Date\.now\(\)\)/)
})

test('더 보기: 시작 때 번호를 들고 가 조건이 바뀌면 버림, 다시 누름 무시, 실패는 한 줄(받은 항목 유지)', () => {
  assert.match(screen, /if \(!list\.nextCursor \|\| loadingMore \|\| list\.query !== query\) return/)
  assert.match(screen, /listWithMore\(l, page\)/)
  assert.match(screen, /setMoreError\(C\.moreError\)/)
  assert.match(screen, /aria-busy=\{loadingMore \|\| undefined\}/)
})

test('검색: Enter 확정(commitWhileTyping=false)·40자 초과는 안내만·빈 칸 해제, 조각 칩은 4종(withNone=false), 보기 설정에 번역 없음', () => {
  assert.match(screen, /commitWhileTyping=\{false\}/)
  assert.match(screen, /cpLength\(t\) > DRAWER_Q_MAX\) \{\s*setQTooLong\(true\)\s*return/)
  assert.match(screen, /withNone=\{false\}/)
  assert.match(screen, /<DisplayToggles keys=\{\['fu', 'hg'\]\}/)
  assert.ok(!/'tr'/.test(screen))
})

test('돌아오기: 마운트 때 기록 지움, 떠나기 전 replaceState + 한 건 기록, 복원 값은 지금 주소에서', () => {
  assert.match(screen, /useEffect\(\(\) => \{\s*forgetCorrectionsReturn\(\)\s*\}, \[\]\)/)
  assert.match(screen, /correctionsReturnUrl\(list\.shown \?\? DRAWER_FILTER_NONE, \{ focus: c\.id, n: reloadLimit\(list\.items\.length\) \}\)/)
  assert.match(screen, /window\.history\.replaceState\(null, '', back\)/)
  assert.match(screen, /rememberCorrectionsReturn\(back, src\)/)
  assert.match(screen, /parseCorrectionsReturnQuery\(sp\)/)
  assert.match(screen, /drawerQuery\(init\.filter, 0, init\.n \?\? DRAWER_PAGE_SIZE\)/)
  assert.match(screen, /window\.history\.replaceState\(null, '', DRAWER_CORRECTIONS_PATH\)/)
})

test('단어 시트: WordDetailSheet props 그대로(categories=[]), 삭제·없음은 토스트 + 조용한 다시 읽기, 표현 수정은 글자만', () => {
  assert.match(screen, /categories=\{\[\]\}/)
  assert.match(screen, /afterWordGone\(wordSheet\.fromId, C\.wordRemoved\)/)
  assert.match(screen, /afterWordGone\(wordSheet\.fromId, WORD_NOT_FOUND\)/)
  assert.match(screen, /listWithWordSurface\(l, w\.id, w\.surface\)/)
  assert.match(screen, /reloadLimit\(list\.items\.length\), \{ silent: true \}/)
})

test('E1 버튼은 회화·채팅 탭 링크, 오류 [다시 시도]는 44px(min-h-11), E2/E3 버튼 min-h-11', () => {
  assert.match(screen, /href="\/study\/ai\?tab=talk"/)
  assert.match(screen, /href="\/study\/ai\?tab=chat"/)
  assert.match(screen, /className="mt-0\.5 inline-flex min-h-11 items-center font-semibold underline"/)
  assert.equal((screen.match(/className="min-h-11 self-start"/g) ?? []).length, 2)
  assert.ok(!/ErrorBlock/.test(screen), '공용 ErrorBlock(44px 미달)은 쓰지 않는다')
})

test('금지: 교정 편집·삭제·채택·무시 요청 없음(GET 만), 새 서버 쓰기 없음, 「불러오는 중」 글자는 더 보기 버튼에만', () => {
  for (const f of readdirSync(join(root, 'drawer')).filter((n) => n.endsWith('.tsx') || n.endsWith('.ts'))) {
    const src = read('drawer', f)
    assert.ok(!/apiPost|apiPut|apiPatch|apiDelete|fetch\(/.test(src), f)
    assert.ok(!/animate-pulse/.test(src), f)
  }
  assert.ok(!/불러오는 중/.test(screen), '문구는 correctionsCopy 의 moreBusy 하나')
})

test('엔진·모델·호스트 이름 0건(drawer 전체·교정 모음 라우트)', () => {
  const app = join(root, '..', 'app', '(app)', 'drawer', 'corrections')
  const files = [
    ...readdirSync(join(root, 'drawer')).filter((n) => /\.tsx?$/.test(n)).map((n) => readFileSync(join(root, 'drawer', n), 'utf8')),
    ...readdirSync(app).map((n) => readFileSync(join(app, n), 'utf8')),
  ]
  for (const src of files) assert.ok(!/claude|whisper|reazon|style-?bert|sbv2|qwen|ollama|sonnet|haiku|opus|home-m4/i.test(src))
})
