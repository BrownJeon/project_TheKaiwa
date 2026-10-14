import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WordEntry, WordListPage } from '@/types/vocab'
import { listHeader, WORD_FILTER_INITIAL, type WordListFilter, type WordListHeader } from '../logic'
import { settleWords, WORDS_INITIAL, type WordsListState } from '../wordsPaging'

// task-023 REV-050 M-1(머리 줄은 응답의 조건으로) + task-068 §28-2 F · T26(출처별 앞말 · 쪽 접미사).

const ALL: WordListFilter = WORD_FILTER_INITIAL
const TRIP: WordListFilter = { ...ALL, category: '여행' }
const TRIP_FEEL: WordListFilter = { ...TRIP, chunk: 'FEELING' }
const TRIP_ACTION: WordListFilter = { ...TRIP, chunk: 'ACTION' }

function word(id: string): WordEntry {
  return { id } as WordEntry
}

function page(total: number, rows = Math.min(total, 3)): WordListPage {
  return { items: Array.from({ length: rows }, (_, i) => word(`w${total}-${i}`)), total, page: 1, pages: Math.max(1, Math.ceil(total / 7)), limit: 7, baseTotal: 7755 }
}

function ready(f: WordListFilter, p: Partial<WordListPage>): WordsListState {
  return settleWords(WORDS_INITIAL, { kind: 'first', page: 0, shown: { ...f, sort: 'recent' } }, { ok: true, page: p }).state
}

/** WordsScreen 의 목록 effect 와 같은 순서 — 요청마다 번호를 올리고, 마지막 요청의 응답만 받아들인다(reqRef). */
function screen() {
  let latest = 0
  let list: WordsListState = WORDS_INITIAL
  return {
    request(f: WordListFilter) {
      const id = ++latest
      return (p: WordListPage) => {
        if (id === latest) list = settleWords(list, { kind: 'filter', page: 0, shown: { ...f, sort: 'recent' } }, { ok: true, page: p }).state
      }
    },
    get header(): WordListHeader | null {
      return listHeader(list, 0)
    },
  }
}

test('머리 줄: 첫 응답 전·첫 읽기 오류 중에는 null, 응답이 오면 그 응답의 조건과 total', () => {
  assert.equal(listHeader(WORDS_INITIAL, 0), null)
  const r = ready(TRIP_FEEL, page(9))
  assert.deepEqual(listHeader(r, 0), { lead: 'all', n: 9, condition: '여행 · 느낌 조각', pageNo: 1 })
  assert.equal(listHeader({ ...r, status: 'firstError', error: 'x' }, 0), null)
  assert.equal(listHeader({ ...r, status: 'first' }, 0), null)
  assert.notEqual(listHeader({ ...r, status: 'paging' }, 1), null, '쪽을 넘기는 중에도 앞 응답의 머리 줄은 남는다')
})

test('머리 줄: 보관함 > 검색 > 출처 순, total 이 없으면 받은 행 수', () => {
  assert.deepEqual(listHeader(ready({ ...ALL, archived: true, q: '食' }, page(2)), 0), { lead: 'archived', n: 2, condition: null, pageNo: null })
  assert.deepEqual(listHeader(ready({ ...TRIP, q: '食べ' }, page(4)), 0), { lead: 'search', q: '食べ', n: 4, condition: '여행', pageNo: null })
  assert.deepEqual(listHeader(ready(ALL, { items: [word('a'), word('b')] }), 0), { lead: 'all', n: 2, condition: null, pageNo: null })
})

test('T26 머리 줄: 출처별 앞말(all·mine·base) · 7개 이하 1쪽이면 쪽 접미사 없음 · 넘으면 1부터 센 쪽', () => {
  assert.equal(listHeader(ready({ ...ALL, source: 'mine' }, page(3)), 0)?.lead, 'mine')
  assert.equal(listHeader(ready({ ...ALL, source: 'base' }, page(7755)), 0)?.lead, 'base')
  assert.equal(listHeader(ready(ALL, page(7)), 0)?.pageNo, null, '7개면 한 쪽뿐 — 접미사 없음')
  assert.equal(listHeader(ready(ALL, page(8)), 0)?.pageNo, 1)
  assert.equal(listHeader(ready(ALL, page(7758)), 2)?.pageNo, 3)
  assert.equal(listHeader(ready(ALL, page(3)), 1)?.pageNo, 2, '1쪽이 아니면 줄었어도 접미사(쪽 줄과 같이)')
})

test('필터 연속 전환: 응답 전에는 이전 응답의 개수·조건을 함께 유지하고, 마지막 요청의 응답이 오면 함께 바뀐다(M-1)', () => {
  const sc = screen()
  sc.request(TRIP)(page(9))
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: '여행', pageNo: 1 })

  const toFeel = sc.request(TRIP_FEEL)
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: '여행', pageNo: 1 }, '새 조건 + 이전 개수로 섞이지 않는다')
  const toAction = sc.request(TRIP_ACTION)
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: '여행', pageNo: 1 })

  toFeel(page(5))
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: '여행', pageNo: 1 }, '지나간 요청의 응답은 버린다')
  toAction(page(3))
  assert.deepEqual(sc.header, { lead: 'all', n: 3, condition: '여행 · 액션 조각', pageNo: null })
})

test('응답 지연 역전: 도착 순서가 어떻든 마지막 요청의 응답으로 끝나고, 중간에도 개수·조건은 한 응답에서만 나온다', () => {
  const reqs: { f: WordListFilter; total: number }[] = [
    { f: TRIP, total: 9 },
    { f: TRIP_FEEL, total: 5 },
    { f: TRIP_ACTION, total: 3 },
  ]
  const orders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]
  const valid = new Set(reqs.map((r) => JSON.stringify(listHeader(ready(r.f, page(r.total)), 0))))
  for (const order of orders) {
    const sc = screen()
    const arrive = reqs.map((r) => sc.request(r.f))
    for (const i of order) {
      arrive[i](page(reqs[i].total))
      const h = sc.header
      if (h) assert.ok(valid.has(JSON.stringify(h)), `섞인 머리 줄 ${JSON.stringify(h)} (order ${order})`)
    }
    assert.deepEqual(sc.header, { lead: 'all', n: 3, condition: '여행 · 액션 조각', pageNo: null }, `order ${order}`)
  }
})
