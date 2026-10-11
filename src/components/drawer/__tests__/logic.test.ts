/**
 * task-055 채택 교정 모음 순수 함수(screens.md §21-10 ② (a)~(f)) — 요청 주소 · 유형 칩 · 머리 줄 개수 · 빈 상태 종류 · 원래 대화 주소 · 돌아오기 주소.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ERROR_TYPE_LABEL } from '@/components/chat/labels'
import { isCorrectionsHref } from '@/components/shell/correctionsReturn'
import type { DrawerCorrectionFacets, DrawerCorrectionItem, ErrorType } from '@/types/chat'
import {
  appendUnique,
  correctionsReturnUrl,
  DRAWER_CHUNK_TYPES,
  DRAWER_ERROR_TYPES,
  DRAWER_FILTER_NONE,
  drawerCorrectionsUrl,
  emptyKindOf,
  facetTotal,
  hasCondition,
  headCount,
  loadErrorText,
  parseCorrectionsReturnQuery,
  reloadLimit,
  searchHasOtherCondition,
  sourceHrefOf,
  sourcePathOf,
  typeChips,
  validQ,
  type DrawerCorrectionFilter,
} from '../logic'

const F = (p: Partial<DrawerCorrectionFilter> = {}): DrawerCorrectionFilter => ({ ...DRAWER_FILTER_NONE, ...p })
const facets = (...rows: [ErrorType, number][]): DrawerCorrectionFacets => ({ errorType: rows.map(([value, count]) => ({ value, count })) })
const item = (id: string, kind: 'TALK' | 'CHAT' | 'ASK' = 'TALK', chatId = 'c1'): DrawerCorrectionItem => ({
  id,
  original: 'x',
  corrected: 'y',
  explanation: 'z',
  extraNoteKo: null,
  errorType: 'PARTICLE',
  severity: 'MINOR',
  chunkType: null,
  chat: { id: chatId, title: 't', kind },
  resolvedAt: '2026-10-10T00:00:00.000Z',
})
const qs = (url: string) => new URLSearchParams(url.slice(url.indexOf('?') + 1))

test('목록: 유형 9종(선언 순 = 라벨 표 순)·조각 4종(「없음」 없음)', () => {
  assert.deepEqual([...DRAWER_ERROR_TYPES], Object.keys(ERROR_TYPE_LABEL))
  assert.deepEqual([...DRAWER_CHUNK_TYPES], ['NAME', 'ACTION', 'FEELING', 'MODIFIER'])
})

// ── (a) 요청 주소 ──────────────────────────────────────────────────────────────

test('(a) 요청 주소: 값이 있는 조건만 · limit 은 늘(기본 20) · cursor 는 다음 쪽만', () => {
  assert.equal(drawerCorrectionsUrl(F()), '/api/v1/drawer/corrections?limit=20')
  const all = drawerCorrectionsUrl(F({ errorType: 'PARTICLE', chunkType: 'ACTION', q: '  に 조사 ' }), { cursor: 'abc==' })
  assert.ok(all.startsWith('/api/v1/drawer/corrections?'))
  const p = qs(all)
  assert.deepEqual([...p.keys()], ['errorType', 'chunkType', 'q', 'limit', 'cursor'])
  assert.equal(p.get('errorType'), 'PARTICLE')
  assert.equal(p.get('chunkType'), 'ACTION')
  assert.equal(p.get('q'), 'に 조사', '앞뒤 공백을 뺀 값')
  assert.equal(p.get('limit'), '20')
  assert.equal(p.get('cursor'), 'abc==')
  assert.equal(qs(drawerCorrectionsUrl(F(), { limit: 40 })).get('limit'), '40', '돌아오기·다시 읽기는 받은 개수만큼')
  assert.equal(qs(drawerCorrectionsUrl(F(), { limit: 999 })).get('limit'), '50', '계약 상한')
  assert.equal(qs(drawerCorrectionsUrl(F(), { limit: 0 })).get('limit'), '1')
  assert.equal(qs(drawerCorrectionsUrl(F(), { limit: Number.NaN })).get('limit'), '20')
  assert.equal(qs(drawerCorrectionsUrl(F(), { cursor: null })).has('cursor'), false)
  assert.equal(qs(drawerCorrectionsUrl(F(), { cursor: '' })).has('cursor'), false)
})

test('(a) 요청 주소: 형식이 틀린 조건·빈 칸·40자 초과 검색어는 붙이지 않는다(서버 400 을 화면이 막는다)', () => {
  const bad = F({ errorType: 'NOPE' as ErrorType, chunkType: 'none' as never, q: '   ' })
  assert.equal(drawerCorrectionsUrl(bad), '/api/v1/drawer/corrections?limit=20')
  assert.equal(qs(drawerCorrectionsUrl(F({ q: 'あ'.repeat(40) }))).get('q'), 'あ'.repeat(40), '40자 통과')
  assert.equal(qs(drawerCorrectionsUrl(F({ q: 'あ'.repeat(41) }))).has('q'), false, '41자는 보내지 않음')
  assert.equal(qs(drawerCorrectionsUrl(F({ q: '😀'.repeat(40) }))).get('q'), '😀'.repeat(40), '이모지(서로게이트 쌍)는 1자')
})

test('검색어 경계(validQ): trim 후 1~40 코드포인트', () => {
  assert.equal(validQ(''), null)
  assert.equal(validQ('  '), null)
  assert.equal(validQ(' a '), 'a')
  assert.equal(validQ('a'.repeat(40)), 'a'.repeat(40))
  assert.equal(validQ('a'.repeat(41)), null)
  assert.equal(validQ(`  ${'😀'.repeat(40)}  `), '😀'.repeat(40))
  assert.equal(validQ('😀'.repeat(41)), null)
  assert.equal(validQ(42), null)
})

// ── (b) 유형 칩 ────────────────────────────────────────────────────────────────

test('(b) 유형 칩: 서버 순서 그대로 · 「전체」 = 합 · 고른 유형이 0이면 그 칩만 0 으로 끝에', () => {
  const f = facets(['PARTICLE', 12], ['CONJUGATION', 5], ['GRAMMAR', 5])
  assert.equal(facetTotal(f), 22)
  assert.deepEqual(typeChips(f, null), [
    { value: 'PARTICLE', count: 12 },
    { value: 'CONJUGATION', count: 5 },
    { value: 'GRAMMAR', count: 5 },
  ])
  assert.deepEqual(typeChips(f, 'CONJUGATION').map((c) => c.value), ['PARTICLE', 'CONJUGATION', 'GRAMMAR'], '고른 유형이 있으면 그대로')
  assert.deepEqual(typeChips(f, 'POLITENESS').at(-1), { value: 'POLITENESS', count: 0 }, '검색·조각을 바꾸다 0이 된 고른 유형')
  assert.equal(typeChips(f, 'POLITENESS').length, 4)
  assert.deepEqual(typeChips(facets(), 'OTHER'), [{ value: 'OTHER', count: 0 }])
  assert.deepEqual(typeChips(facets(), null), [])
  assert.deepEqual(typeChips(undefined, null), [], '더 보기 응답처럼 facets 가 없으면 빈 줄')
})

test('(b) 유형 칩: 모르는 유형·0 이하·숫자 아닌 개수는 버린다(라벨 없는 칩 방지)', () => {
  const weird = { errorType: [{ value: 'NEW_TYPE', count: 3 }, { value: 'PARTICLE', count: 0 }, { value: 'GRAMMAR', count: Number.NaN }, { value: 'OTHER', count: 2 }] } as unknown as DrawerCorrectionFacets
  assert.deepEqual(typeChips(weird, null), [{ value: 'OTHER', count: 2 }])
  assert.equal(facetTotal(weird), 2)
  assert.equal(facetTotal({} as DrawerCorrectionFacets), 0)
})

// ── (c) 머리 줄 n ──────────────────────────────────────────────────────────────

test('(c) 머리 줄 n: 유형을 안 골랐으면 합, 골랐으면 그 유형 count(합이 아니다), 없으면 0', () => {
  const f = facets(['PARTICLE', 12], ['CONJUGATION', 2])
  assert.equal(headCount(f, null), 14)
  assert.equal(headCount(f, 'CONJUGATION'), 2, 'facets 는 유형 조건을 뺀 집계 — 합(14)을 쓰면 틀린다')
  assert.equal(headCount(f, 'POLITENESS'), 0)
  assert.equal(headCount(undefined, null), 0)
})

// ── (d) 빈 상태 종류 ────────────────────────────────────────────────────────────

test('(d) 빈 상태: 항목 있으면 null · 검색어 → E3 · 유형/조각 → E2 · 조건 없음 → E1', () => {
  assert.equal(emptyKindOf(F(), 3), null)
  assert.equal(emptyKindOf(F({ q: 'x' }), 1), null)
  assert.equal(emptyKindOf(F(), 0), 'first')
  assert.equal(emptyKindOf(F({ errorType: 'PARTICLE' }), 0), 'filter')
  assert.equal(emptyKindOf(F({ chunkType: 'NAME' }), 0), 'filter')
  assert.equal(emptyKindOf(F({ errorType: 'PARTICLE', chunkType: 'NAME' }), 0), 'filter')
  assert.equal(emptyKindOf(F({ q: '존댓말' }), 0), 'search')
  assert.equal(emptyKindOf(F({ q: '존댓말', errorType: 'PARTICLE' }), 0), 'search', '검색이 걸려 있으면 유형·조각이 있어도 E3')
  assert.equal(searchHasOtherCondition(F({ q: 'x' })), false)
  assert.equal(searchHasOtherCondition(F({ q: 'x', chunkType: 'FEELING' })), true)
  assert.equal(hasCondition(F()), false)
  assert.equal(hasCondition(F({ q: 'x' })), true)
})

// ── 더 보기·오류 ─────────────────────────────────────────────────────────────────

test('더 보기: id 로 중복을 걸러 뒤에 붙인다 · 다시 읽기 개수는 20~50', () => {
  const a = [item('1'), item('2')]
  assert.deepEqual(appendUnique(a, [item('2'), item('3'), item('3')]).map((c) => c.id), ['1', '2', '3'])
  assert.deepEqual(appendUnique([], []), [])
  assert.deepEqual([reloadLimit(0), reloadLimit(7), reloadLimit(20), reloadLimit(33), reloadLimit(50), reloadLimit(90), reloadLimit(Number.NaN)], [20, 20, 20, 33, 50, 50, 20])
})

test('첫 쪽 실패 문구: 네트워크(0)만 「네트워크를 확인해 주세요」', () => {
  assert.equal(loadErrorText({ status: 0 }), '교정을 불러오지 못했어요. 네트워크를 확인해 주세요.')
  for (const status of [-1, 400, 500, 503]) assert.equal(loadErrorText({ status }), '교정을 불러오지 못했어요.')
})

// ── (e) 원래 대화 주소 ──────────────────────────────────────────────────────────

test('(e) 원래 대화 주소: 회화 → 회화방 #cr_ · 채팅 → 표현 점검 #cr_ · ASK → null · 대화 id 인코딩', () => {
  assert.equal(sourceHrefOf(item('cr1', 'TALK', 'chat1')), '/study/ai/talk/chat1#cr_cr1')
  assert.equal(sourceHrefOf(item('cr1', 'CHAT', 'chat1')), '/study/ai/chat/chat1/review#cr_cr1')
  assert.equal(sourceHrefOf(item('cr1', 'ASK', 'chat1')), null)
  assert.equal(sourcePathOf(item('cr1', 'ASK')), null)
  assert.equal(sourceHrefOf(item('cr1', 'TALK', 'a/b?c#d')), '/study/ai/talk/a%2Fb%3Fc%23d#cr_cr1')
  assert.equal(sourcePathOf(item('cr1', 'CHAT', 'a b')), '/study/ai/chat/a%20b/review', '돌아오기 기록의 원본 경로 = 해시 뺀 주소')
  assert.equal(sourceHrefOf(item('cr9', 'CHAT', 'c2')), `${sourcePathOf(item('cr9', 'CHAT', 'c2'))}#cr_cr9`)
})

// ── (f) 돌아오기 주소 ───────────────────────────────────────────────────────────

test('(f) 돌아오기 주소 만들기: 조건·focus·n 만, 없으면 /drawer/corrections', () => {
  assert.equal(correctionsReturnUrl(F()), '/drawer/corrections')
  assert.equal(correctionsReturnUrl(F(), { focus: 'cr_1', n: 20 }), '/drawer/corrections?focus=cr_1&n=20')
  assert.equal(
    correctionsReturnUrl(F({ errorType: 'CONJUGATION', chunkType: 'ACTION', q: 'に' }), { focus: 'cmabc', n: 40 }),
    '/drawer/corrections?errorType=CONJUGATION&chunkType=ACTION&q=%E3%81%AB&focus=cmabc&n=40',
  )
})

test("(f) 돌아오기 주소 인코딩: 공백은 %20(+ 아님) · !'()* 도 %XX · 결과는 기록이 받는 문자만", () => {
  const url = correctionsReturnUrl(F({ q: "a b+c !'()* ~._-" }), { focus: 'x', n: 20 })
  assert.equal(url, '/drawer/corrections?q=a%20b%2Bc%20%21%27%28%29%2A%20~._-&focus=x&n=20')
  assert.ok(!url.includes('+'))
  assert.ok(isCorrectionsHref(url), url)
  assert.equal(parseCorrectionsReturnQuery(qs(url)).filter.q, "a b+c !'()* ~._-", '읽으면 같은 값')
})

test('(f) 돌아오기 주소 만들기: 형식이 틀린 값은 그 값만 빠진다', () => {
  assert.equal(correctionsReturnUrl(F({ errorType: 'X' as ErrorType, q: 'ok' }), { focus: 'bad id!', n: 51 }), '/drawer/corrections?q=ok')
  assert.equal(correctionsReturnUrl(F({ q: 'a'.repeat(41) }), { focus: 'a'.repeat(65), n: 0 }), '/drawer/corrections')
  assert.equal(correctionsReturnUrl(F(), { n: 2.5 }), '/drawer/corrections')
  assert.equal(correctionsReturnUrl(F(), { focus: null, n: null }), '/drawer/corrections')
})

test('(f) 만들고 읽으면 같은 값 · 가장 긴 주소도 700자 이하이고 기록이 받는다', () => {
  const cases: [DrawerCorrectionFilter, string | null, number | null][] = [
    [F(), null, null],
    [F({ errorType: 'PRONUNCIATION' }), 'cr_x-1', 20],
    [F({ chunkType: 'MODIFIER', q: '존댓말' }), null, 50],
    [F({ errorType: 'OTHER', chunkType: 'NAME', q: 'お願いします 😀' }), 'A'.repeat(64), 1],
  ]
  for (const [f, focus, n] of cases) {
    const url = correctionsReturnUrl(f, { focus, n })
    assert.ok(isCorrectionsHref(url), url)
    assert.deepEqual(parseCorrectionsReturnQuery(qs(url)), { filter: f, focus, n }, url)
  }
  const worst = correctionsReturnUrl(F({ errorType: 'PRONUNCIATION', chunkType: 'MODIFIER', q: '😀'.repeat(40) }), { focus: 'a'.repeat(64), n: 50 })
  assert.ok(worst.length <= 700, String(worst.length))
  assert.ok(isCorrectionsHref(worst))
  assert.deepEqual(parseCorrectionsReturnQuery(qs(worst)).filter.q, '😀'.repeat(40))
})

test('(f) 돌아오기 쿼리 읽기: 9종/4종/40자/focus/n 경계 — 틀린 값은 그 값만 버린다', () => {
  const p = (s: string) => parseCorrectionsReturnQuery(new URLSearchParams(s))
  assert.deepEqual(p(''), { filter: F(), focus: null, n: null })
  assert.deepEqual(p('errorType=PARTICLE&chunkType=FEELING&q=%20x%20&focus=cr_1&n=33'), { filter: F({ errorType: 'PARTICLE', chunkType: 'FEELING', q: 'x' }), focus: 'cr_1', n: 33 })
  assert.deepEqual(p('errorType=particle&chunkType=none&q=&focus=a.b&n=33'), { filter: F(), focus: null, n: 33 }, '소문자 유형·없음 조각·빈 q·점 든 focus')
  assert.equal(p(`q=${'あ'.repeat(40)}`).filter.q, 'あ'.repeat(40))
  assert.equal(p(`q=${'あ'.repeat(41)}`).filter.q, '', '41자')
  assert.equal(p(`focus=${'a'.repeat(64)}`).focus, 'a'.repeat(64))
  assert.equal(p(`focus=${'a'.repeat(65)}`).focus, null)
  for (const [n, want] of [['1', 1], ['50', 50], ['0', null], ['51', null], ['05', null], ['2.5', null], ['-1', null], ['1e1', null], ['', null], ['abc', null]] as const) {
    assert.equal(p(`n=${n}`).n, want, `n=${n}`)
  }
  assert.equal(p('errorType=PARTICLE&errorType=GRAMMAR').filter.errorType, null, '같은 키 둘 이상은 버린다')
  assert.equal(p('q=a+b').filter.q, 'a b', '+ 는 URLSearchParams 가 공백으로 읽는다(만든 주소에는 + 가 없다)')
})

test('(f) page.tsx searchParams(객체) 모양도 읽는다 — 배열 값은 버린다', () => {
  assert.deepEqual(parseCorrectionsReturnQuery({ errorType: 'GRAMMAR', chunkType: 'ACTION', q: ' 활용 ', focus: 'cr2', n: '20' }), {
    filter: F({ errorType: 'GRAMMAR', chunkType: 'ACTION', q: '활용' }),
    focus: 'cr2',
    n: 20,
  })
  assert.deepEqual(parseCorrectionsReturnQuery({ errorType: ['GRAMMAR', 'OTHER'], q: undefined, n: ['20'] }), { filter: F(), focus: null, n: null })
})
