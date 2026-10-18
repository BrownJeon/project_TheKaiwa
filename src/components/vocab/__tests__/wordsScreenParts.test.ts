import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OFF } from '@/components/common/japanese/annotations'
import { readStore, writeStore } from '@/components/common/storage'
import type { WordEntry } from '@/types/vocab'
import { BaseWordBandView, showBaseBand } from '../BaseWordBand'
import CategoryChips from '../CategoryChips'
import type { FavView } from '../favorite'
import { LEVEL_CATEGORY_NAMES } from '../labels'
import { VOCAB_KEYS } from '../hooks'
import { WordsHeadLine, WordsPageList } from '../WordsScreen'
import { fillerCount, isWordsPaged, wordsPagerView, type WordsStatus } from '../wordsPaging'

// task-068 §28-9 T1 · T3 · T5(렌더) · T26(머리 줄 렌더) · T27(안내 띠) — 목록 칸·머리 줄·안내 띠는 상태 없는 부품으로 나눠 서버 렌더로 시험한다.

const noop = () => {}
const word = (i: number, o: Partial<WordEntry> = {}): WordEntry => ({
  id: `w${i}`,
  surface: `語${i}`,
  reading: null,
  meaning: `뜻${i}`,
  partOfSpeech: 'NOUN',
  chunkType: 'NAME',
  category: null,
  source: 'SEED',
  origin: 'BASE',
  readOnly: true,
  correctCount: 0,
  wrongCount: 0,
  archived: false,
  ...o,
})
const words = (n: number) => Array.from({ length: n }, (_, i) => word(i))

function list(o: { n: number; total: number; page?: number; status?: WordsStatus; fav?: (w: WordEntry) => FavView }) {
  const page = o.page ?? 0
  const status = o.status ?? 'ready'
  const pages = Math.max(1, Math.ceil(o.total / 7))
  const items = words(o.n)
  return renderToStaticMarkup(
    createElement(WordsPageList, {
      items,
      layers: items.map(() => ({ ruby: null, hangul: OFF })),
      sort: 'recent',
      status,
      paged: isWordsPaged(o.total, page),
      view: wordsPagerView({ page, pages, total: o.total, status }),
      favView: o.fav ?? (() => ({ on: false, locked: false })),
      onStar: noop,
      onOpen: noop,
      onPrev: noop,
      onNext: noop,
      onJump: noop,
      onRetry: noop,
    }),
  )
}
const lis = (html: string) => html.match(/<li[^>]*>/g) ?? []
const visibleLis = (html: string) => lis(html).filter((l) => !/aria-hidden="true"/.test(l))
const fillerLis = (html: string) => (html.match(/<li aria-hidden="true" class="invisible">[\s\S]*?<\/li>/g) ?? [])

test('T1 보이는 행 ≤ 7 — 넘겨받은 행이 더 있어도 7개만 · 마지막 쪽 3행이면 행 3 + 빈 자리 4', () => {
  assert.equal(visibleLis(list({ n: 9, total: 30 })).length, 7)
  const last = list({ n: 3, total: 24, page: 3 })
  assert.equal(visibleLis(last).length, 3)
  assert.equal(fillerLis(last).length, 4)
  assert.equal(lis(last).length, 7, '마지막 쪽도 7행 높이(J1)')
})

test('T3 7개 이하 1쪽이면 쪽 줄·빈 자리·status 없음 · 8개면 쪽 줄', () => {
  const one = list({ n: 5, total: 5 })
  assert.doesNotMatch(one, /aria-label="단어 목록 쪽"/)
  assert.doesNotMatch(one, /role="status"/)
  assert.equal(fillerLis(one).length, 0)
  assert.equal(visibleLis(one).length, 5)
  const two = list({ n: 7, total: 8 })
  assert.match(two, /<nav aria-label="단어 목록 쪽"/)
  assert.match(two, /<p role="status" class="sr-only">2쪽 중 1쪽 · 모두 8개<\/p>/)
})

test('T5 빈 자리 = 숨은 행(aria-hidden + invisible, 안에 단추 0) · 쪽 오류 5 + 오류 상자 · 넘기는 중 회색 자리 7 + aria-busy', () => {
  const last = list({ n: 2, total: 9, page: 1 })
  for (const f of fillerLis(last)) assert.doesNotMatch(f, /<button/)
  assert.equal(fillerLis(last).length, fillerCount(true, 2, 'ready'))
  const err = list({ n: 7, total: 30, page: 2, status: 'pageError' })
  assert.match(err, /<div role="alert"[^>]*><span[^>]*>이 쪽을 불러오지 못했어요<\/span><span[^>]*>연결을 확인하고 다시 시도해 주세요\.<\/span><button[^>]*>다시 시도<\/button><\/div>/)
  assert.equal(fillerLis(err).length, 5)
  assert.equal(visibleLis(err).length, 0, '못 읽은 쪽의 옛 행은 그리지 않는다')
  assert.match(err, /aria-label="단어 목록 쪽"/, '쪽 줄 위치 유지')
  const busy = list({ n: 7, total: 30, page: 3, status: 'paging' })
  assert.match(busy, /<ul aria-busy="true"/)
  assert.equal(lis(busy).length, 7)
  assert.doesNotMatch(busy.split('<nav')[0] ?? '', /<button/, '회색 자리 안에는 단추가 없다')
  assert.equal(fillerLis(busy).length, 0)
  assert.doesNotMatch(list({ n: 7, total: 30 }), /aria-busy/)
})

test('T26 머리 줄 렌더 — 출처별 앞말 · 쪽 접미사 aria-hidden · 7개 이하면 접미사 0 · 응답 전 빈 줄 · tabIndex=-1', () => {
  const r = (head: Parameters<typeof WordsHeadLine>[0]['head']) => renderToStaticMarkup(createElement(WordsHeadLine, { head }))
  const empty = r(null)
  assert.match(empty, /^<p tabindex="-1" aria-live="polite"[^>]*><\/p>$/)
  const all = r({ lead: 'all', n: 7758, condition: '표현 조각', pageNo: 3 })
  assert.match(all, />단어 7,758개 · <span class="font-semibold text-ink">표현 조각<\/span><span aria-hidden="true" class="whitespace-nowrap"> · 3쪽<\/span><\/p>$/)
  assert.match(r({ lead: 'mine', n: 2, condition: null, pageNo: null }), />내 단어 2개<\/p>$/)
  assert.match(r({ lead: 'base', n: 7755, condition: null, pageNo: 1 }), />기본 단어 7,755개<span aria-hidden="true"/)
  assert.match(r({ lead: 'search', q: '映画', n: 1, condition: null, pageNo: null }), /‘<span lang="ja">映画<\/span>’ 검색 결과 1개<\/p>$/)
  assert.doesNotMatch(r({ lead: 'all', n: 5, condition: null, pageNo: null }), /쪽/)
})

test('T27 안내 띠 — 숫자 = baseTotal(쉼표) · 닫기 이름 · 0/없음/닫음/하이드레이션 전이면 안 그림', () => {
  const html = renderToStaticMarkup(createElement(BaseWordBandView, { n: 7758, onClose: noop }))
  assert.match(html, /^<div role="note"/)
  assert.match(html, /<b[^>]*>기본 단어 7,758개가 들어 있어요<\/b>/)
  assert.match(html, /aria-label="안내 닫기"/)
  assert.match(html, /bg-accent-soft/)
  assert.equal(showBaseBand({ hydrated: true, baseTotal: 7758, closed: null }), true)
  assert.equal(showBaseBand({ hydrated: false, baseTotal: 7758, closed: null }), false)
  assert.equal(showBaseBand({ hydrated: true, baseTotal: 0, closed: null }), false)
  assert.equal(showBaseBand({ hydrated: true, baseTotal: null, closed: null }), false)
  assert.equal(showBaseBand({ hydrated: true, baseTotal: 7758, closed: '1' }), false)
  assert.equal(VOCAB_KEYS.baseBand, 'kaiwa.words.baseBand')
})

test('T27 안내 띠 숫자는 고정값을 읽지 않는다(소스 스캔) · 저장소 접근이 던져도 깨지지 않는다(가짜 저장소)', () => {
  const strip = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  for (const f of ['BaseWordBand.tsx', 'WordsScreen.tsx']) {
    const src = strip(f)
    assert.doesNotMatch(src, /seedPackTotal|SEED_PACK_COUNT|7,?75[58]/, f)
  }
  assert.match(strip('BaseWordBand.tsx'), /useStoredString\(VOCAB_KEYS\.baseBand\)/)
  const g = globalThis as { window?: unknown }
  const before = g.window
  g.window = {
    get localStorage(): Storage {
      throw new Error('blocked')
    },
  }
  try {
    assert.doesNotThrow(() => writeStore('local', VOCAB_KEYS.baseBand, '1'))
    assert.equal(readStore('local', VOCAB_KEYS.baseBand), null)
  } finally {
    g.window = before
  }
})

test('T9 분류 칩(단어장·오늘 카드 공용 CategoryChips) — 난이도 이름 여섯 개는 칩이 되지 않고 「전체」 합계는 그대로', () => {
  const items = [
    { category: '초보자 (N5)', count: 628, archivedCount: 0 },
    { category: 'N5 기초', count: 50, archivedCount: 0 },
    { category: '최상급 (N1)', count: 3, archivedCount: 0 },
    { category: '여행', count: 2, archivedCount: 0 },
    { category: null, count: 7000, archivedCount: 1 },
  ]
  const html = renderToStaticMarkup(createElement(CategoryChips, { items, value: null, basis: 'active', onChange: noop }))
  for (const n of LEVEL_CATEGORY_NAMES) assert.ok(!html.includes(n), n)
  assert.match(html, />여행</)
  assert.match(html, /7,683|7683/, '「전체」 숫자는 모든 묶음의 합(난이도 이름 묶음도 센다)')
})
