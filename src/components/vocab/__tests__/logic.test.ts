import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WordEntry, WordListPage } from '@/types/vocab'
import { listFromPage, listHeader, listWithoutRow, WORD_LIST_INITIAL, type WordListFilter, type WordListHeader, type WordListState } from '../logic'

const ALL: WordListFilter = { q: '', category: null, chunk: null, archived: false }
const N5: WordListFilter = { ...ALL, category: 'N5 기초' }
const N5_FEEL: WordListFilter = { ...N5, chunk: 'FEELING' }
const N5_ACTION: WordListFilter = { ...N5, chunk: 'ACTION' }

function word(id: string): WordEntry {
  return { id } as WordEntry
}

function page(total: number, rows = Math.min(total, 3)): WordListPage {
  return { items: Array.from({ length: rows }, (_, i) => word(`w${total}-${i}`)), nextCursor: null, total }
}

/** WordsScreen 의 목록 effect 와 같은 순서 — 요청마다 번호를 올리고, 마지막 요청의 응답만 받아들인다(reqRef). */
function screen() {
  let latest = 0
  let list: WordListState = WORD_LIST_INITIAL
  return {
    request(f: WordListFilter) {
      const id = ++latest
      return (p: WordListPage) => {
        if (id === latest) list = listFromPage(f, p)
      }
    },
    get header(): WordListHeader | null {
      return listHeader(list)
    },
  }
}

test('머리 줄: 첫 응답 전·오류 중에는 null, 응답이 오면 그 응답의 조건과 total', () => {
  assert.equal(listHeader(WORD_LIST_INITIAL), null)
  const ready = listFromPage(N5_FEEL, page(9))
  assert.deepEqual(listHeader(ready), { lead: 'all', n: 9, condition: 'N5 기초 · 느낌 조각' })
  assert.equal(listHeader({ ...ready, status: 'error', error: 'x' }), null)
  assert.equal(listHeader({ ...ready, status: 'loading' }), null)
})

test('머리 줄: 보관함 > 검색 > 전체 순, total 이 없으면 받은 행 수', () => {
  assert.deepEqual(listHeader(listFromPage({ ...ALL, archived: true, q: '食' }, page(2))), { lead: 'archived', n: 2, condition: null })
  assert.deepEqual(listHeader(listFromPage({ ...N5, q: '食べ' }, page(4))), { lead: 'search', q: '食べ', n: 4, condition: 'N5 기초' })
  assert.deepEqual(listHeader(listFromPage(ALL, { items: [word('a'), word('b')], nextCursor: 'c', total: null })), { lead: 'all', n: 2, condition: null })
})

test('listFromPage: 빠진 필드는 빈 값으로, 조건은 요청 때 값을 그대로 담는다', () => {
  const s = listFromPage(N5, { items: undefined, nextCursor: undefined, total: '3' as unknown as number })
  assert.deepEqual(s, { items: [], nextCursor: null, total: null, status: 'ready', error: null, shown: N5 })
  assert.deepEqual(listFromPage(N5, null).items, [])
})

test('필터 연속 전환: 응답 전에는 이전 응답의 개수·조건을 함께 유지하고, 마지막 요청의 응답이 오면 함께 바뀐다(M-1)', () => {
  const sc = screen()
  sc.request(N5)(page(9))
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: 'N5 기초' })

  const toFeel = sc.request(N5_FEEL)
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: 'N5 기초' }, '새 조건 + 이전 개수로 섞이지 않는다')
  const toAction = sc.request(N5_ACTION)
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: 'N5 기초' })

  toFeel(page(5))
  assert.deepEqual(sc.header, { lead: 'all', n: 9, condition: 'N5 기초' }, '지나간 요청의 응답은 버린다')
  toAction(page(3))
  assert.deepEqual(sc.header, { lead: 'all', n: 3, condition: 'N5 기초 · 액션 조각' })
})

test('응답 지연 역전: 도착 순서가 어떻든 마지막 요청의 응답으로 끝나고, 중간에도 개수·조건은 한 응답에서만 나온다', () => {
  const reqs: { f: WordListFilter; total: number }[] = [
    { f: N5, total: 9 },
    { f: N5_FEEL, total: 5 },
    { f: N5_ACTION, total: 3 },
  ]
  const orders = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]
  const valid = new Set(reqs.map((r) => JSON.stringify(listHeader(listFromPage(r.f, page(r.total))))))
  for (const order of orders) {
    const sc = screen()
    const arrive = reqs.map((r) => sc.request(r.f))
    for (const i of order) {
      arrive[i](page(reqs[i].total))
      const h = sc.header
      if (h) assert.ok(valid.has(JSON.stringify(h)), `섞인 머리 줄 ${JSON.stringify(h)} (order ${order})`)
    }
    assert.deepEqual(sc.header, { lead: 'all', n: 3, condition: 'N5 기초 · 액션 조각' }, `order ${order}`)
  }
})

test('listWithoutRow: 목록에 있던 행만 total 을 줄이고, 머리 줄 조건은 그대로', () => {
  const s = listFromPage(N5_FEEL, { items: [word('a'), word('b')], nextCursor: null, total: 2 })
  const one = listWithoutRow(s, 'a')
  assert.deepEqual(one.items.map((w) => w.id), ['b'])
  assert.deepEqual(listHeader(one), { lead: 'all', n: 1, condition: 'N5 기초 · 느낌 조각' })
  assert.equal(listWithoutRow(one, 'zzz').total, 1, '없는 행은 개수를 바꾸지 않는다')
  assert.equal(listWithoutRow({ ...one, total: null }, 'b').total, null)
  assert.equal(listWithoutRow({ ...one, total: 0 }, 'b').total, 0)
})
