import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { OFF, type AnnotationState } from '@/components/common/japanese/annotations'
import type { ReadingSegment } from '@/modules/speech/reading/client'
import type { WordEntry, WordListPage } from '@/types/vocab'
import {
  createFavoriteController,
  favoriteErrorText,
  favoriteStep,
  favoriteView,
  rowStarLayout,
  type FavEffect,
  type FavState,
} from '../favorite'
import FavoriteStar from '../FavoriteStar'
import { FAVORITE_COPY, favoriteMatchParts, GENERIC_ERROR, listConditionText, listLeadText, NETWORK_ERROR, WORD_NOT_FOUND, WORD_SOURCE_OPTIONS } from '../labels'
import { listHeader, WORD_FILTER_INITIAL, type WordListFilter } from '../logic'
import { emptyVariant } from '../validate'
import WordDetailSheet from '../WordDetailSheet'
import WordRow from '../WordRow'
import WordsEmpty from '../WordsEmpty'
import { WordsPageList } from '../WordsScreen'
import type { WordFavorites } from '../useWordFavorites'
import { navForKey, settleWords, wordsCondKey, wordsListUrl, wordsPagerView, WORDS_INITIAL } from '../wordsPaging'

// task-074 §32-13 — 즐겨찾기 화면 규칙. 동작 시험 중심(컨트롤러를 가짜 send 로 돌린다). 정적 렌더·소스 스캔은 보조.

const noop = () => {}
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

// ── 컨트롤러(가짜 send — 시험이 약속을 직접 풀고 거절한다) ─────────────────────────────

type Deferred = { id: string; to: boolean; resolve: (v: { favorite?: unknown } | null | undefined) => void; reject: (e: unknown) => void }
function rig(o: { inFav?: boolean } = {}) {
  let t = 0
  const sent: Deferred[] = []
  const changes: FavState[] = []
  const effects: FavEffect[] = []
  let inFav = o.inFav ?? false
  const c = createFavoriteController({
    send: (id, to) =>
      new Promise((resolve, reject) => {
        sent.push({ id, to, resolve, reject })
      }),
    now: () => ++t,
    inFavoriteView: () => inFav,
    onChange: (s) => changes.push(s),
    onEffect: (x) => effects.push(x),
  })
  return { c, sent, changes, effects, setInFav: (v: boolean) => (inFav = v), tick: () => t }
}
const flush = () => new Promise<void>((r) => setImmediate(r))

test('C1 누름 → 요청 1(켜기), view = 켜짐·잠김 · 처리 중 같은 id 다시 누름(행이든 시트든) → 요청 여전히 1', async () => {
  const r = rig()
  r.c.press('w1', false)
  assert.equal(r.sent.length, 1)
  assert.deepEqual([r.sent[0]!.id, r.sent[0]!.to], ['w1', true])
  assert.deepEqual(r.c.view('w1', false, 0), { on: true, locked: true })
  r.c.press('w1', true) // 행에서 보인 값(켜짐)으로 다시
  r.c.press('w1', false) // 시트가 옛 값으로 다시
  assert.equal(r.sent.length, 1, '잠긴 별은 요청을 보내지 않는다')
  r.c.press('w2', true)
  assert.equal(r.sent.length, 2, '다른 단어는 따로 잠긴다')
  assert.equal(r.sent[1]!.to, false)
  r.sent[0]!.resolve({ favorite: true })
  await flush()
  assert.deepEqual(r.c.view('w1', false, 0), { on: true, locked: false }, '응답 뒤 잠김 풀림')
  r.c.press('w1', true)
  assert.equal(r.sent.length, 3, '잠김이 풀리면 다시 보낸다')
})

test('C2 성공: 즐겨찾기 칸 + 끔이면 reload·removedToast 1회 · 칸이 아니거나 켬이면 효과 0 · 판단은 응답 순간의 칸', async () => {
  const a = rig({ inFav: true })
  a.c.press('w1', true)
  a.sent[0]!.resolve({ favorite: false })
  await flush()
  assert.deepEqual(a.effects, [{ id: 'w1', reload: true, toast: FAVORITE_COPY.removedToast, notFound: false }])

  const b = rig({ inFav: false })
  b.c.press('w1', true)
  b.sent[0]!.resolve({ favorite: false })
  await flush()
  assert.deepEqual(b.effects, [], '즐겨찾기 칸이 아니면 토스트·다시 읽기 없음(D10)')

  const c = rig({ inFav: true })
  c.c.press('w1', false)
  c.sent[0]!.resolve({ favorite: true })
  await flush()
  assert.deepEqual(c.effects, [], '켜기는 행이 빠지지 않는다')

  const d = rig({ inFav: false })
  d.c.press('w1', true)
  d.setInFav(true) // 처리 중에 즐겨찾기 칸으로 옮김
  d.sent[0]!.resolve({ favorite: false })
  await flush()
  assert.equal(d.effects.length, 1)
  assert.equal(d.effects[0]!.reload, true)
})

test('C3 실패: 500 → 누르기 전 값 + GENERIC · 상태 0 → NETWORK · 404 → notFound + WORD_NOT_FOUND · 모르는 거절 → GENERIC', async () => {
  for (const [status, text, nf] of [
    [500, GENERIC_ERROR, false],
    [0, NETWORK_ERROR, false],
    [404, WORD_NOT_FOUND, true],
    [400, GENERIC_ERROR, false],
    [401, GENERIC_ERROR, false],
  ] as const) {
    const r = rig({ inFav: true })
    r.c.press('w1', false)
    r.sent[0]!.reject(Object.assign(new Error('x'), { status }))
    await flush()
    assert.deepEqual(r.c.view('w1', false, 0), { on: false, locked: false }, `${status} 되돌림`)
    assert.deepEqual(r.effects, [{ id: 'w1', reload: false, toast: text, notFound: nf }], String(status))
  }
  const r = rig()
  r.c.press('w1', false)
  r.sent[0]!.reject('boom')
  await flush()
  assert.equal(r.effects[0]!.toast, GENERIC_ERROR)
  assert.equal(favoriteErrorText(429), GENERIC_ERROR, '429 전용 문구 없음')
})

test('C4 앞서 켜서 확정한 별을 끄다 실패 → 켜짐으로 되돌림(서버 옛 값·!to 아님) · send 가 바로 던져도 같은 길', async () => {
  const r = rig()
  r.c.press('w1', false)
  r.sent[0]!.resolve({ favorite: true })
  await flush()
  r.c.press('w1', true)
  assert.deepEqual(r.c.view('w1', false, 0), { on: false, locked: true })
  r.sent[1]!.reject(Object.assign(new Error('x'), { status: 500 }))
  await flush()
  assert.deepEqual(r.c.view('w1', false, 0), { on: true, locked: false }, '서버 옛 값(false)이 아니라 앞서 확정한 켜짐')

  const effects: FavEffect[] = []
  const c = createFavoriteController({
    send: () => {
      throw Object.assign(new Error('sync'), { status: 0 })
    },
    now: () => 1,
    inFavoriteView: () => false,
    onChange: noop,
    onEffect: (x) => effects.push(x),
  })
  c.press('w9', true)
  await flush()
  assert.deepEqual(c.view('w9', true, 0), { on: true, locked: false })
  assert.equal(effects[0]!.toast, NETWORK_ERROR)
})

test('C5 dispose 뒤 도착한 응답·실패 → onChange·onEffect 0 · dispose 뒤 누름도 무시', async () => {
  const r = rig({ inFav: true })
  r.c.press('w1', true)
  r.c.press('w2', false)
  const before = r.changes.length
  r.c.dispose()
  r.sent[0]!.resolve({ favorite: false })
  r.sent[1]!.reject(Object.assign(new Error('x'), { status: 404 }))
  await flush()
  assert.equal(r.changes.length, before)
  assert.deepEqual(r.effects, [])
  r.c.press('w3', false)
  assert.equal(r.sent.length, 2)
})

test('C6 응답 favorite 이 없거나 boolean 아님 → 요청한 값 · boolean 이면 서버 값', async () => {
  for (const body of [undefined, null, {}, { favorite: 'true' }, { favorite: 1 }]) {
    const r = rig()
    r.c.press('w1', false)
    r.sent[0]!.resolve(body as { favorite?: unknown })
    await flush()
    assert.deepEqual(r.c.view('w1', false, 0), { on: true, locked: false }, JSON.stringify(body))
  }
  const r = rig()
  r.c.press('w1', false)
  r.sent[0]!.resolve({ favorite: false })
  await flush()
  assert.deepEqual(r.c.view('w1', true, 0), { on: false, locked: false }, '서버가 끔이라 하면 끔')
})

test('C7 favoriteStep — 기록 없는 id 의 ok·fail 은 무시(상태 같은 객체) · 처리 중 아닌 기록의 ok 도 무시', () => {
  const s: FavState = {}
  assert.equal(favoriteStep(s, { type: 'ok', id: 'x', value: true, at: 1, inFavoriteView: true }).state, s)
  assert.equal(favoriteStep(s, { type: 'fail', id: 'x', status: 500 }).ignored, true)
  const done: FavState = { x: { value: true, pending: false, at: 3, before: null } }
  const st = favoriteStep(done, { type: 'ok', id: 'x', value: false, at: 9, inFavoriteView: true })
  assert.equal(st.state, done)
  assert.equal(st.reload, false)
})

// ── favoriteView — 읽은 시각 비교(§32-5) ─────────────────────────────────────────────

test('V1 favoriteView: 처리 중 우선 · at > readAt 이면 기록 · at <= readAt 이면 서버 값 · 기록 없으면 서버(undefined = 꺼짐)', () => {
  assert.deepEqual(favoriteView(false, 99, { value: true, pending: true, at: 5, before: null }), { on: true, locked: true }, '처리 중은 읽은 시각과 무관')
  assert.deepEqual(favoriteView(false, 4, { value: true, pending: false, at: 5, before: null }), { on: true, locked: false })
  assert.deepEqual(favoriteView(false, 5, { value: true, pending: false, at: 5, before: null }), { on: false, locked: false }, '같은 시각은 서버 값')
  assert.deepEqual(favoriteView(false, 6, { value: true, pending: false, at: 5, before: null }), { on: false, locked: false }, '별을 만진 뒤 새로 읽은 값(다른 기기 변경 포함)은 그대로')
  assert.deepEqual(favoriteView(undefined, 0, undefined), { on: false, locked: false })
  assert.deepEqual(favoriteView(true, 0, undefined), { on: true, locked: false })
})

test('V2 저장·보관 응답이 옛 별 값을 들고 와도 화면 값 불변 — 저장 요청을 별보다 먼저 보낸 경우(readAt < 별 확정)', async () => {
  const r = rig()
  const sheetReadAt = r.c.stamp() // 1: [저장] 보내기 직전
  r.c.press('w1', false) // 2: 별 켬
  r.sent[0]!.resolve({ favorite: true })
  await flush() // 3: 확정
  const savedResponseFavorite = false // 저장 요청이 먼저 서버에 닿아 옛 값
  assert.deepEqual(r.c.view('w1', savedResponseFavorite, sheetReadAt), { on: true, locked: false })
  const listReadAt = r.c.stamp() // 4: 확정 뒤 목록 다시 읽기
  assert.deepEqual(r.c.view('w1', true, listReadAt), { on: true, locked: false })
  assert.deepEqual(r.c.view('w1', false, listReadAt), { on: false, locked: false }, '확정 뒤 읽은 값(다른 기기에서 끔)은 그대로 보인다')
})

// ── rowStarLayout — HangulLine·JaText 와 같은 판정표(§32-2) ─────────────────────────────

const seg = (surface: string, pron: string | null): ReadingSegment => ({ surface, ruby: null, pron, boundary: null })
const READY: AnnotationState = { s: 'ready', segments: [seg('食べる', 'タベル')] }
const READY_EMPTY: AnnotationState = { s: 'ready', segments: [seg('?', null)] }

test('L1 rowStarLayout 한글 판정 — 설정 로드 전·한글 끔·off·none·빈 한글이면 셋째 줄 비움(H2), loading·ready 면 안 비움', () => {
  const base = { prefsLoaded: true, showFurigana: true, showHangul: true, ruby: null }
  const pad = (o: Partial<typeof base & { hangul: AnnotationState }>) => rowStarLayout({ ...base, hangul: READY, ...o }).line3Pad
  assert.equal(pad({}), false, 'ready + 한글 있음')
  assert.equal(pad({ hangul: { s: 'loading' } }), false, '로딩은 자리표시 막대가 둘째 줄에 있다')
  assert.equal(pad({ hangul: READY_EMPTY }), true, 'ready 인데 한글이 비면 HangulLine 이 그리지 않는다')
  assert.equal(pad({ hangul: OFF }), true)
  assert.equal(pad({ hangul: { s: 'none' } }), true)
  assert.equal(pad({ showHangul: false }), true)
  assert.equal(pad({ prefsLoaded: false }), true, '설정 로드 전은 한글 줄을 그리지 않는다')
  assert.equal(pad({ prefsLoaded: false, hangul: { s: 'loading' } }), true)
})

test('L2 rowStarLayout 세로 자리 — 히라가나 켬 + 루비 있음만 2.471em, 로드 전·끔·루비 null 은 2.021em(빈 루비 배열은 있음)', () => {
  const top = (o: { prefsLoaded?: boolean; showFurigana?: boolean; ruby?: readonly unknown[] | null }) =>
    rowStarLayout({ prefsLoaded: true, showFurigana: true, showHangul: true, ruby: [{ text: '食', reading: 'た' }], hangul: READY, ...o }).top
  assert.equal(top({}), '2.471em')
  assert.equal(top({ ruby: [] }), '2.471em', 'JaText 는 넘겨받은 루비가 [] 여도 줄간격을 건다(!![] === true)')
  assert.equal(top({ ruby: null }), '2.021em')
  assert.equal(top({ showFurigana: false }), '2.021em')
  assert.equal(top({ prefsLoaded: false }), '2.021em')
  for (const h of [READY, OFF, { s: 'loading' } as AnnotationState]) {
    assert.equal(rowStarLayout({ prefsLoaded: true, showFurigana: false, showHangul: false, ruby: null, hangul: h }).top, '2.021em', '한글과 무관')
  }
})

// ── 출처 4칸 · 주소 · 열쇠 · 머리 줄 · 빈 화면 ─────────────────────────────────────────

const F: WordListFilter = WORD_FILTER_INITIAL
const FAV: WordListFilter = { ...F, source: 'favorite' }

test('U1 즐겨찾기 칸 주소 = source=all&…&favorite=1 정확히 · 다른 칸은 favorite 키 없음(지금 주소 그대로) · 조건 AND', () => {
  assert.equal(wordsListUrl(FAV, 'recent', 0), '/api/v1/words?source=all&archived=0&favorite=1&sort=recent&page=1&limit=7')
  assert.equal(
    wordsListUrl({ ...FAV, q: '猫', category: '여행', chunk: 'NAME', archived: true }, 'wrong', 1),
    '/api/v1/words?q=%E7%8C%AB&category=%EC%97%AC%ED%96%89&chunkType=NAME&source=all&archived=1&favorite=1&sort=wrong&page=2&limit=7',
  )
  for (const source of ['all', 'mine', 'base'] as const) {
    const u = wordsListUrl({ ...F, source }, 'recent', 0)
    assert.ok(!u.includes('favorite'), source)
    assert.ok(u.includes(`source=${source}&`), source)
  }
  assert.ok(!wordsListUrl(F, 'recent', 0).includes('favorite=0'), 'favorite=0 을 보내지 않는다')
})

test('U2 칸마다 조건 열쇠가 달라 1쪽 · 즐겨찾기 칸 ↔ 전체 칸 전환도 1쪽', () => {
  const keys = WORD_SOURCE_OPTIONS.map((o) => wordsCondKey({ ...F, source: o.value }, 'recent'))
  assert.equal(new Set(keys).size, 4)
  const nav = { key: wordsCondKey(F, 'recent'), page: 5, kind: 'page' as const, seq: 3 }
  const moved = navForKey(nav, wordsCondKey(FAV, 'recent'))
  assert.equal(moved.page, 0)
  assert.equal(moved.kind, 'filter')
})

const page = (total: number, items = 1): WordListPage => ({
  items: Array.from({ length: items }, (_, i) => word({ id: `p${i}` })),
  total,
  baseTotal: 7758,
  pages: Math.max(1, Math.ceil(total / 7)),
  page: 1,
  limit: 7,
})
const ready = (f: WordListFilter, total: number) =>
  settleWords(WORDS_INITIAL, { kind: 'first', page: 0, shown: { ...f, sort: 'recent' } }, { ok: true, page: page(total) }).state

test('U3 머리 줄 앞말 순서 보관함 > 검색 > 즐겨찾기 > 출처 · 조건 맨 앞 「즐겨찾기」는 앞말이 보관함·검색일 때만', () => {
  assert.deepEqual(listHeader(ready(FAV, 8), 0), { lead: 'favorite', n: 8, condition: null, pageNo: 1 })
  assert.equal(listLeadText('favorite', 1234), '즐겨찾기 1,234개')
  assert.deepEqual(listHeader(ready({ ...FAV, chunk: 'EXPRESSION' }, 3), 0), { lead: 'favorite', n: 3, condition: '표현 조각', pageNo: null }, '즐겨찾기 앞말이면 조건에 다시 넣지 않음')
  assert.deepEqual(listHeader(ready({ ...FAV, archived: true }, 1), 0), { lead: 'archived', n: 1, condition: '즐겨찾기', pageNo: null })
  assert.deepEqual(listHeader(ready({ ...FAV, q: 'ねこ', category: '여행' }, 0), 0), { lead: 'search', q: 'ねこ', n: 0, condition: '즐겨찾기 · 여행', pageNo: null })
  assert.deepEqual(listHeader(ready({ ...FAV, archived: true, q: 'ねこ', chunk: 'NAME' }, 2), 0)?.condition, '즐겨찾기 · 이름 조각')
  assert.equal(listHeader(ready({ ...F, archived: true }, 1), 0)?.condition, null, '다른 칸에는 「즐겨찾기」 없음')
  assert.equal(listConditionText({ category: null, chunk: null, source: 'mine', archived: true, q: 'x' }), null)
})

test('U4 emptyVariant: 즐겨찾기 칸이면 무엇보다 먼저 — 다른 조건 하나라도 있으면 noFavoriteMatch, 없으면 noFavorite · 다른 칸 순서 그대로', () => {
  const q = { q: '', category: null, archived: false, chunk: null }
  assert.equal(emptyVariant({ ...q, source: 'favorite' }, { active: 0, archived: 3 }), 'noFavorite', 'allArchived 보다 먼저')
  assert.equal(emptyVariant({ ...q, source: 'favorite', q: 'ねこ', chunk: 'NAME' }, null), 'noFavoriteMatch', 'noSearchChunk 보다 먼저')
  assert.equal(emptyVariant({ ...q, source: 'favorite', archived: true }, null), 'noFavoriteMatch')
  assert.equal(emptyVariant({ ...q, source: 'favorite', category: '여행' }, null), 'noFavoriteMatch')
  assert.equal(emptyVariant({ ...q, source: 'favorite', chunk: 'FEELING' }, null), 'noFavoriteMatch')
  assert.equal(emptyVariant({ ...q, source: 'all', q: 'ねこ' }, null), 'noSearch')
  assert.equal(emptyVariant({ ...q, source: 'mine' }, null), 'noMine')
})

test('U5 빈 화면 렌더 — 두 경우 문구·버튼 하나(조건 풀기), 「‘q’ 추가하기」 없음 · 검색어는 lang="ja" · 조건 순서 검색 → 보관함 → 분류 → 조각', () => {
  let cleared = 0
  const r = (variant: 'noFavorite' | 'noFavoriteMatch', o: { q?: string; archived?: boolean; category?: string | null; chunk?: 'NAME' | null } = {}) =>
    renderToStaticMarkup(
      createElement(WordsEmpty, { variant, q: o.q ?? '', archived: o.archived ?? false, category: o.category ?? null, chunk: o.chunk ?? null, onAdd: noop, onShowArchive: noop, onShowAll: noop, onClearFavorite: () => cleared++ }),
    )
  const none = r('noFavorite')
  assert.match(none, />즐겨찾기한 단어가 없어요<\/p><p[^>]*>단어 줄의 별을 누르면 여기에 모여요\.<\/p><button[^>]*>모든 단어 보기<\/button>/)
  const m = r('noFavoriteMatch', { q: 'ねこ', archived: true, category: '여행', chunk: 'NAME' })
  assert.match(m, />조건에 맞는 즐겨찾기가 없어요</)
  const text = m.replace(/<[^>]+>/g, '')
  assert.ok(text.includes('‘ねこ’ 검색 · 보관함 · 여행 · 이름 조각 안에서 즐겨찾기만 찾았어요.'), text)
  assert.match(m, /‘<span lang="ja">ねこ<\/span>’ 검색/)
  assert.match(m, /<button[^>]*>즐겨찾기 조건 풀기<\/button>/)
  assert.doesNotMatch(m + none, /추가하기/)
  assert.equal((m.match(/<button/g) ?? []).length, 1)
  assert.equal(r('noFavoriteMatch', { archived: true }).replace(/<[^>]+>/g, '').includes('보관함 안에서 즐겨찾기만 찾았어요.'), true)
  const parts = favoriteMatchParts({ q: 'ねこ', archived: false, category: null, chunk: null })
  assert.equal(parts.map((p) => p.pre + (p.ja ?? '') + p.post).join(' · ') + FAVORITE_COPY.matchBody(''), FAVORITE_COPY.matchBody('‘ねこ’ 검색'), '글자 = matchBody 단일 출처')
  // 버튼이 onClearFavorite 에 이어졌는지(소스 스캔 보조 — 렌더로는 누를 수 없다)
  void cleared
})

test('U6 FAVORITE_COPY 글자 = §32-8 표 · 429 키 없음 · 실패 문구는 공통 문구', () => {
  assert.deepEqual(
    { ...FAVORITE_COPY, lead: FAVORITE_COPY.lead(8), matchBody: FAVORITE_COPY.matchBody('{조건}') },
    {
      star: '즐겨찾기',
      sourceLabel: '즐겨찾기',
      lead: '즐겨찾기 8개',
      condition: '즐겨찾기',
      noneTitle: '즐겨찾기한 단어가 없어요',
      noneBody: '단어 줄의 별을 누르면 여기에 모여요.',
      noneBtn: '모든 단어 보기',
      matchTitle: '조건에 맞는 즐겨찾기가 없어요',
      matchBody: '{조건} 안에서 즐겨찾기만 찾았어요.',
      matchBtn: '즐겨찾기 조건 풀기',
      removedToast: '즐겨찾기에서 뺐어요',
    },
  )
  assert.equal(JSON.stringify(Object.keys(FAVORITE_COPY)).includes('429'), false)
  assert.deepEqual([favoriteErrorText(0), favoriteErrorText(404), favoriteErrorText(500)], [NETWORK_ERROR, WORD_NOT_FOUND, GENERIC_ERROR])
})

// ── 부품 동작(jsdom 없이 — 컴포넌트 함수를 렌더 안에서 불러 나온 요소의 처리기를 직접 부른다) ──────────────

/** 훅을 쓰는 컴포넌트를 렌더 문맥 안에서 함수로 불러 돌려준 요소 트리를 얻는다(자식은 그리지 않는다). */
function elementOf<P>(Comp: (p: P) => ReactNode, props: P): ReactElement {
  let out: ReactNode = null
  function Probe() {
    out = Comp(props)
    return null
  }
  renderToStaticMarkup(createElement(Probe))
  assert.ok(isValidElement(out))
  return out as ReactElement
}
const kids = (el: ReactElement): ReactNode[] => {
  const c = (el.props as { children?: ReactNode }).children
  return Array.isArray(c) ? c : [c]
}

test('B1 FavoriteStar: 잠기면 onPress 0(aria-disabled, disabled 아님) · 풀리면 1 · aria-pressed 늘 · 행 이름 = <span lang="ja">단어</span> 즐겨찾기 · 시트 이름 = 즐겨찾기', () => {
  let n = 0
  const btn = (locked: boolean) => FavoriteStar({ variant: 'row', surface: '食べる', top: '2.471em', on: true, locked, onPress: () => n++ }) as ReactElement<{ onClick: () => void }>
  btn(true).props.onClick()
  assert.equal(n, 0, '잠긴 별은 누름 무시')
  btn(false).props.onClick()
  assert.equal(n, 1)
  const html = (p: Parameters<typeof FavoriteStar>[0]) => renderToStaticMarkup(createElement(FavoriteStar, p))
  const onRow = html({ variant: 'row', surface: '食べる', top: '2.021em', on: true, locked: true, onPress: noop })
  assert.match(onRow, /^<button type="button" aria-pressed="true" aria-disabled="true" class="absolute right-\[9px\] z-\[1\] [^"]*text-\[18px\][^"]*" style="top:2.021em">/)
  assert.doesNotMatch(onRow, /\sdisabled=""|title=/)
  assert.match(onRow, /<span class="sr-only"><span lang="ja">食べる<\/span> 즐겨찾기<\/span><\/button>$/)
  assert.match(onRow, /class="fill-warn stroke-ink"/)
  const offSheet = html({ variant: 'sheet', on: false, locked: false, onPress: noop })
  assert.match(offSheet, /^<button type="button" aria-pressed="false" class="grid h-11 w-11 flex-none place-items-center rounded-full">/)
  assert.match(offSheet, /class="fill-none stroke-ink2"/)
  assert.match(offSheet, /<span class="sr-only">즐겨찾기<\/span><\/button>$/)
  assert.match(onRow, /before:-top-\[11px\] before:-bottom-\[5px\]/, '누르는 곳 44×44(위 11·아래 5)')
})

test('B2 WordRow: li 에 처리기 없음 · 열기 단추와 별이 형제 · 별 → onStar(word, 보인 값) · 열기 → onOpen(word)', () => {
  const calls: unknown[][] = []
  const w = word()
  const inner = (WordRow as unknown as { type: (p: Parameters<typeof WordRow>[0]) => ReactNode }).type
  for (const favOn of [false, true]) {
    calls.length = 0
    const li = elementOf(inner, { word: w, sort: 'recent', onOpen: (x) => calls.push(['open', x]), ruby: null, hangul: OFF, favOn, favLocked: false, onStar: (x, s) => calls.push(['star', x, s]) })
    assert.equal(li.type, 'li')
    assert.equal(Object.keys(li.props as object).filter((k) => /^on[A-Z]/.test(k)).length, 0, 'li 에 클릭 처리기 없음(버블링으로 열리지 않게)')
    const [openBtn, star] = kids(li) as ReactElement<Record<string, unknown>>[]
    assert.equal(openBtn!.type, 'button')
    assert.equal(star!.type, FavoriteStar)
    ;(star!.props.onPress as () => void)()
    assert.deepEqual(calls, [['star', w, favOn]])
    ;(openBtn!.props.onClick as () => void)()
    assert.deepEqual(calls[1], ['open', w])
  }
})

const favStub = (view: { on: boolean; locked: boolean }, presses: unknown[][]): WordFavorites => ({
  press: (id, shown) => presses.push([id, shown]),
  view: () => view,
  stamp: () => 7,
})

test('B3 WordDetailSheet: 머리 별 = fav.view 값, 누르면 fav.press(id, 보인 값) · fav 를 안 넘기면(채택 교정 모음) 머리 별 없음', () => {
  const presses: unknown[][] = []
  const base = { wordId: 'w1', preview: word({ favorite: false }), categories: [], onClose: noop, onChanged: noop, onRemoved: noop, onArchivedChange: noop, onOpenWord: noop, onNotFound: noop, onToast: noop }
  const sheet = elementOf(WordDetailSheet, { ...base, fav: favStub({ on: true, locked: false }, presses) })
  const action = (sheet.props as { headerAction?: ReactElement<Record<string, unknown>> }).headerAction
  assert.ok(action && action.type === FavoriteStar)
  assert.equal(action.props.variant, 'sheet')
  assert.equal(action.props.on, true, '서버 값(false)이 아니라 fav.view 값')
  ;(action.props.onPress as () => void)()
  assert.deepEqual(presses, [['w1', true]])
  const none = elementOf(WordDetailSheet, base)
  assert.equal((none.props as { headerAction?: unknown }).headerAction, undefined)
})

test('B4 목록 렌더: 보이는 행마다 단추 2개 · 열기 단추 안 <button 0 · 별 aria-pressed 늘 · 잠김 aria-disabled · 셋째 줄 pr-6(H2) · 빈 자리 행 단추 0', () => {
  const items = Array.from({ length: 3 }, (_, i) => word({ id: `r${i}`, surface: `語${i}` }))
  const html = renderToStaticMarkup(
    createElement(WordsPageList, {
      items,
      layers: items.map(() => ({ ruby: null, hangul: OFF })),
      sort: 'recent',
      status: 'ready',
      paged: true,
      view: wordsPagerView({ page: 1, pages: 2, total: 10, status: 'ready' }),
      favView: (w) => ({ on: w.id === 'r1', locked: w.id === 'r2' }),
      onStar: noop,
      onOpen: noop,
      onPrev: noop,
      onNext: noop,
      onJump: noop,
      onRetry: noop,
    }),
  )
  const rows = html.match(/<li class="relative">[\s\S]*?<\/li>/g) ?? []
  assert.equal(rows.length, 3)
  rows.forEach((row, i) => {
    assert.equal((row.match(/<button/g) ?? []).length, 2, `행 ${i}`)
    const open = row.match(/^<li class="relative">(<button[\s\S]*?<\/button>)<button/)
    assert.ok(open, '열기 단추 다음에 형제 별')
    assert.equal((open![1].match(/<button/g) ?? []).length, 1, '열기 단추 안에 단추 없음')
    assert.doesNotMatch(open![1], /즐겨찾기/, '행 이름에 별 이름이 섞이지 않는다')
    assert.match(row, new RegExp(`aria-pressed="${i === 1}"`))
    assert.match(row, new RegExp(`<span lang="ja">語${i}</span> 즐겨찾기`))
    assert.equal(/aria-disabled="true"/.test(row), i === 2)
    assert.match(row, /<span class="flex w-full min-w-0 items-baseline gap-2 pr-6">/, '설정 로드 전 = 한글 줄 없음 → 셋째 줄 비움')
  })
  const fillers = html.match(/<li aria-hidden="true" class="invisible">[\s\S]*?<\/li>/g) ?? []
  assert.equal(fillers.length, 4)
  for (const f of fillers) assert.doesNotMatch(f, /<button/)
})

// ── 소스 스캔(보조) ──────────────────────────────────────────────────────────────────

const src = (f: string) => readFileSync(join(__dirname, '..', f), 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')

test('S1 별 값은 favoriteView 경유만 — WordRow·WordDetailSheet 에 .favorite 를 그리는 곳 0 · 시트 별은 confirmDelete 가 아닐 때만', () => {
  assert.doesNotMatch(src('WordRow.tsx'), /\.favorite\b/)
  const s = src('WordDetailSheet.tsx')
  assert.deepEqual(s.match(/\bw(?:ord)?\??\.favorite\b/g), ['w.favorite'], '쓰는 곳은 fav.view 인자 하나')
  assert.match(s, /fav\.view\(w\.id, w\.favorite, readAt\)/)
  assert.match(s, /headerAction=\{fav && fv && mode !== 'confirmDelete' \? <FavoriteStar variant="sheet"/)
  const scr = src('WordsScreen.tsx')
  assert.match(scr, /favView=\{\(w\) => fav\.view\(w\.id, w\.favorite, listReadAt\)\}/)
  assert.match(scr, /onClearFavorite=\{\(\) => changeFilter\(\{ source: 'all' \}\)\}/)
})
