/**
 * task-068 단어장 서버(S-B1) — screens.md §28-9 T9(서버)·T11~T17·T25·T29 + 채택 경로 L4 + 초안 조각(wordEnrich@v2).
 * DB 접속 0: `prisma` 싱글턴의 모델 대리자·`$transaction` 을 가짜 DB(`wordFakeDb.ts`)로 바꿔 끼우고 시험이 끝나면 되돌린다.
 */
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, prisma } from '@/modules/infra'
import { LEVEL_CATEGORY_NAMES, isLevelCategory } from '@/types/seedPack'
import {
  assertEnrichSurfaceFree, compareBaseWords, createWord, deleteWord, getWordDetail, listCategories, listWords, parseWordInput, parseWordListQuery,
  parseWordPatch, setWordArchived, updateWord, type WordListQuery,
} from '../vocab/words'
import { cachedDraft, rememberDraft, toDraft, type WordEnrichOutput } from '../vocab/enrich'
import { base, createWordFakeDb, state, word, type FakeAttempt, type FakeEvalItem } from './wordFakeDb'

const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m))
const NOW = new Date()

function fixture(extra: { attempts?: FakeAttempt[]; evalItems?: FakeEvalItem[] } = {}) {
  return createWordFakeDb({
    words: [
      base('b5a', 'N5-0001', { surface: '映画', reading: 'えいが' }),
      base('b5b', 'N5-0002', { surface: '日', reading: 'にち' }),
      base('b5x', 'N5X-0001', { surface: '友だち', reading: 'ともだち' }),
      base('b4', 'N4-0001', { surface: '日', reading: 'ひ', category: '초급 (N4)' }),
      base('b1', 'N1-0001', { surface: '雨', reading: 'あめ', category: '최상급 (N1)' }),
      word({ id: 'a1', userId: 'A', surface: '猫', category: '여행', createdAt: at(1) }),
      word({ id: 'a2', userId: 'A', surface: '犬', category: 'N5 기초', createdAt: at(5), jlpt: 'N1' }),
      word({ id: 'a3', userId: 'A', surface: '鳥', createdAt: at(3) }),
      word({ id: 'a4', userId: 'A', surface: '日', reading: 'じつ', createdAt: at(2) }),
      word({ id: 'x1', userId: 'B', surface: '魚', category: '여행', createdAt: at(9) }),
    ],
    states: [
      state('B', 'b1', { wrongCount: 7 }),
      state('A', 'a3', { archived: true, archivedAt: at(0) }),
      state('A', 'b4', { wrongCount: 3 }),
      state('A', 'a1', { wrongCount: 3 }),
      state('A', 'b1', { wrongCount: 1, correctCount: 2 }),
      state('B', 'b5a', { wrongCount: 9, archived: true }),
    ],
    ...extra,
  })
}

type Fake = ReturnType<typeof createWordFakeDb>

/** `prisma` 의 모델 대리자를 가짜로 — PrismaClient 는 Proxy 라 mock.method 대신 직접 바꿔 끼운다(askRouteGuard 시험과 같은 방식). */
function install(t: TestContext, fake: Fake): Fake {
  const client = prisma as unknown as Record<string, unknown>
  const db = fake.db as unknown as Record<string, unknown>
  const keys = ['wordEntry', 'userWordState', 'vocabAttempt', 'evaluationItem', '$queryRaw', '$transaction'] as const
  const original = Object.fromEntries(keys.map((k) => [k, client[k]]))
  for (const k of keys) client[k] = db[k]
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(fake.db)
  t.after(() => {
    for (const k of keys) client[k] = original[k]
  })
  return fake
}

const q = (over: Partial<WordListQuery> = {}): WordListQuery => ({ q: null, category: null, chunkType: null, source: 'all', archived: false, favorite: false, sort: 'recent', limit: 100, page: 1, ...over })
const ids = async (userId: string, over: Partial<WordListQuery> = {}) => (await listWords(userId, q(over))).items.map((w) => w.id)
const apiErr = (code: string, check: (e: ApiError) => boolean = () => true) => (e: unknown) => e instanceof ApiError && e.code === code && check(e)

test('T11 #40 쿼리: none 400 · EXPRESSION 통과 · cursor 400 use_page · source/page 검사 · 반복은 첫 값', () => {
  const field = (f: string) => apiErr('VALIDATION', (e) => e.details?.field === f)
  assert.throws(() => parseWordListQuery(new URLSearchParams('chunkType=none'), 7), field('chunkType'))
  assert.equal(parseWordListQuery(new URLSearchParams('chunkType=EXPRESSION'), 7).chunkType, 'EXPRESSION')
  assert.throws(() => parseWordListQuery(new URLSearchParams('cursor=abc'), 7), apiErr('VALIDATION', (e) => e.details?.field === 'cursor' && e.details?.reason === 'use_page'))
  assert.throws(() => parseWordListQuery(new URLSearchParams('cursor='), 7), field('cursor'))
  for (const s of ['x', 'MINE', 'all,mine']) assert.throws(() => parseWordListQuery(new URLSearchParams({ source: s }), 7), field('source'), s)
  for (const p of ['0', '1.5', '-1', '100001', 'abc', '1e3', ' 2']) assert.throws(() => parseWordListQuery(new URLSearchParams({ page: p }), 7), field('page'), p)
  const d = parseWordListQuery(new URLSearchParams(''), 7)
  assert.deepEqual([d.page, d.source, d.limit, d.sort], [1, 'all', 7, 'recent'])
  assert.equal(parseWordListQuery(new URLSearchParams('page=100000'), 7).page, 100_000)
  const rep = parseWordListQuery(new URLSearchParams('source=mine&source=base&page=3&page=9'), 7)
  assert.deepEqual([rep.source, rep.page], ['mine', 3], '같은 이름 반복은 첫 값')
})

test('T16 #40 보이는 범위: 내 단어 + 기본 단어만 · source mine/base · 나의 보관 · total/pages/baseTotal · DTO 에 userId·seedKey 없음', async (t) => {
  install(t, fixture())
  assert.deepEqual((await ids('A')).sort(), ['a1', 'a2', 'a4', 'b1', 'b4', 'b5a', 'b5b', 'b5x'], 'B 의 x1 없음, 보관한 a3 없음')
  assert.deepEqual((await ids('A', { source: 'mine' })).sort(), ['a1', 'a2', 'a4'])
  assert.deepEqual((await ids('A', { source: 'base' })).sort(), ['b1', 'b4', 'b5a', 'b5b', 'b5x'])
  assert.deepEqual((await ids('A', { archived: true })).sort(), ['a3'])
  assert.deepEqual((await ids('B')).sort(), ['b1', 'b4', 'b5b', 'b5x', 'x1'], 'B 는 b5a 를 보관했다 — A 와 무관')
  const page = await listWords('A', q({ limit: 3, page: 2 }))
  assert.deepEqual([page.total, page.page, page.pages, page.limit, page.baseTotal, page.items.length], [8, 2, 3, 3, 5, 3])
  const beyond = await listWords('A', q({ limit: 3, page: 9 }))
  assert.deepEqual([beyond.items.length, beyond.page, beyond.pages, beyond.total], [0, 9, 3, 8], '쪽 수보다 크면 빈 items·page 그대로')
  const filtered = await listWords('A', q({ q: '日', limit: 7 }))
  assert.deepEqual([filtered.total, filtered.baseTotal], [3, 5], 'total = 조건을 건 수, baseTotal = 조건과 무관')
  const empty = await listWords('A', q({ q: '없는말' }))
  assert.deepEqual([empty.total, empty.pages, empty.items.length], [0, 1, 0], 'pages 는 최소 1')
  for (const w of (await listWords('A', q())).items) {
    assert.equal('userId' in w, false)
    assert.equal('seedKey' in w, false)
    assert.equal(w.origin, w.id.startsWith('b') ? 'BASE' : 'MINE')
    assert.equal(w.readOnly, w.origin === 'BASE')
  }
  const b1 = (await listWords('A', q({ source: 'base' }))).items.find((w) => w.id === 'b1')!
  assert.deepEqual([b1.wrongCount, b1.correctCount], [1, 2], '상태 칸은 나의 UserWordState')
  const b5aForA = (await listWords('A', q())).items.find((w) => w.id === 'b5a')!
  assert.deepEqual([b5aForA.wrongCount, b5aForA.archived], [0, false], 'B 의 상태가 A 에게 보이지 않는다')
})

test('T17 #40 정렬 같은 값 순서: 최근 = 내 단어(createdAt desc) → 기본 단어(jlpt N5→N1, seedKey) · 많이 틀린 = 나의 wrongCount · 가나다 = 표기 뒤 내 단어 먼저', async (t) => {
  install(t, fixture())
  assert.deepEqual(await ids('A'), ['a2', 'a4', 'a1', 'b5a', 'b5b', 'b5x', 'b4', 'b1'], 'seedKey 글자 순(N1 먼저)이 아니라 단계 먼저')
  assert.deepEqual(await ids('A', { sort: 'wrong' }), ['a1', 'b4', 'b1', 'a2', 'a4', 'b5a', 'b5b', 'b5x'], 'B 의 틀림(b5a 9)은 A 순서에 없다')
  const surface = await ids('A', { sort: 'surface' })
  assert.deepEqual(surface.filter((id) => ['a4', 'b4', 'b5b'].includes(id)), ['a4', 'b4', 'b5b'], '같은 표기 日: 내 단어 먼저, 기본 단어끼리 seedKey')
  // 쪽을 이어 붙여도 같은 순서(묶음 경계를 넘는 쪽)
  for (const sort of ['recent', 'wrong', 'surface'] as const) {
    const whole = await ids('A', { sort })
    const paged: string[] = []
    for (let p = 1; p <= 3; p++) paged.push(...(await ids('A', { sort, limit: 3, page: p })))
    assert.deepEqual(paged, whole, sort)
  }
  const sorted = [base('k1', 'N1-0001'), base('k4', 'N4-0001'), base('k52', 'N5-0002'), base('k51', 'N5-0001'), base('k5x', 'N5X-0001')].sort(compareBaseWords)
  assert.deepEqual(sorted.map((w) => w.seedKey), ['N5-0001', 'N5-0002', 'N5X-0001', 'N4-0001', 'N1-0001'])
})

test('T9 #46 분류: 난이도 이름·기본 단어는 null 묶음, 직접 정한 분류만 칩, 합계는 접기 전과 같다(나의 보관 기준)', async (t) => {
  assert.deepEqual([...LEVEL_CATEGORY_NAMES], ['초보자 (N5)', '초급 (N4)', '중급 (N3)', '고급 (N2)', '최상급 (N1)', 'N5 기초'])
  for (const v of LEVEL_CATEGORY_NAMES) assert.equal(isLevelCategory(v), true)
  for (const v of ['초보자(N5)', '여행', null, undefined, 3]) assert.equal(isLevelCategory(v), false)
  install(t, fixture())
  const cats = await listCategories('A')
  assert.deepEqual(cats, [{ category: '여행', count: 1, archivedCount: 0 }, { category: null, count: 7, archivedCount: 1 }])
  const sum = cats.reduce((n, c) => n + c.count + c.archivedCount, 0)
  assert.equal(sum, 9, 'A 에게 보이는 단어 수 전부(기본 5 + 내 4)')
  assert.equal(cats.find((c) => c.category === null)!.count, (await listWords('A', q({ category: null }))).total - 1, '「전체」 = 보관 안 한 단어 수(여행 1 제외)')
  const catsB = await listCategories('B')
  assert.deepEqual(catsB, [{ category: '여행', count: 1, archivedCount: 0 }, { category: null, count: 4, archivedCount: 1 }])
})

test('T12 기본 단어 수정·삭제 거절: 403 READ_ONLY · 쓰기 0 · 남의 단어 404 · 내 단어는 그대로 고치고 지움', async (t) => {
  const fake = install(t, fixture())
  const before = JSON.stringify(fake.words)
  const readOnly = apiErr('FORBIDDEN', (e) => e.details?.code === 'READ_ONLY')
  await assert.rejects(updateWord('A', 'b5a', { meaning: '무비' }), readOnly)
  await assert.rejects(deleteWord('A', 'b5a'), readOnly)
  assert.equal(JSON.stringify(fake.words), before, '행 변경 0')
  assert.equal(fake.log.filter((l) => l === 'word:update' || l === 'word:deleteMany').length, 1, '삭제 시도는 where {id, userId} 한 번뿐(기본 단어엔 닿지 않음)')
  await assert.rejects(updateWord('A', 'x1', { meaning: 'x' }), apiErr('NOT_FOUND'))
  await assert.rejects(deleteWord('A', 'x1'), apiErr('NOT_FOUND'))
  assert.equal((await updateWord('A', 'a1', { meaning: '고양이', chunkType: 'EXPRESSION' })).chunkType, 'EXPRESSION')
  assert.deepEqual(await deleteWord('A', 'a1'), { deleted: true, snapshotKept: true })
  assert.equal(fake.words.some((w) => w.id === 'a1'), false)
  assert.equal(fake.states.some((s) => s.wordId === 'a1'), false, '그 단어의 상태도 함께(cascade)')
})

test('T13 기본 단어와 같은 단어: (표기·읽기)/읽기 빔 → 409 BASE_DUPLICATE · 다른 읽기 저장 · 여럿이면 기본 단어 순서 첫 행 · 내 단어 중복이 먼저 · #43 도 같음', async (t) => {
  const fake = install(t, fixture())
  const baseDup = (id: string) => apiErr('CONFLICT', (e) => e.details?.code === 'BASE_DUPLICATE' && e.details?.existingId === id)
  const saveAs = (user: string, surface: string, reading: string | null) => createWord(user, { surface, meaning: 'm', reading, source: 'MANUAL' })
  const save = (surface: string, reading: string | null) => saveAs('A', surface, reading)
  await assert.rejects(save('映画', 'えいが'), baseDup('b5a'))
  await assert.rejects(save('映画', null), baseDup('b5a'), '읽기 빔 = 같은 단어로 본다')
  await assert.rejects(saveAs('C', '日', null), baseDup('b5b'), '日 にち(N5)·ひ(N4) — N5 가 먼저')
  await assert.rejects(saveAs('C', '日', 'ひ'), baseDup('b4'))
  for (let i = 0; i < 3; i++) await assert.rejects(saveAs('C', '日', ''), baseDup('b5b'), '호출마다 같은 existingId')
  await assert.rejects(save('日', 'ひ'), apiErr('CONFLICT', (e) => e.details?.existingId === 'a4' && e.details?.code === undefined), '내 단어 중복(a4 日)을 먼저 본다')
  await assert.rejects(updateWord('A', 'a1', { surface: '映画', reading: 'えいが' }), baseDup('b5a'))
  await assert.rejects(updateWord('A', 'a4', { reading: 'ひ' }), baseDup('b4'), '읽기만 바꿔도 기본 단어 중복 검사')
  assert.equal((await updateWord('A', 'a4', { meaning: '날' })).meaning, '날', '표기·읽기가 그대로면 검사하지 않는다')
  await assert.rejects(assertEnrichSurfaceFree('A', '雨'), baseDup('b1'), '보강 전 확인은 표기만')
  await assertEnrichSurfaceFree('A', '空')
  const other = await save('映画', 'えいがかん')
  assert.deepEqual([other.origin, other.surface], ['MINE', '映画'], '같은 표기·다른 읽기는 저장')
  await assert.rejects(save('猫', null), apiErr('CONFLICT', (e) => e.details?.existingId === 'a1' && e.details?.code === undefined), '내 단어 중복은 code 없이')
  await assert.rejects(assertEnrichSurfaceFree('A', '映画'), apiErr('CONFLICT', (e) => e.details?.existingId === other.id && !e.details?.code), '보강 전 확인도 내 단어 먼저')
  assert.equal(fake.words.filter((w) => w.surface === '映画' && w.userId === 'A').length, 1)
})

test('T13 순서: #41 보강 경로는 LLM(enrichWord) 전에 중복을 본다 — 라우트 소스 순서', () => {
  const route = readFileSync(join(process.cwd(), 'src/app/api/v1/words/route.ts'), 'utf8')
  const guard = route.indexOf('await assertEnrichSurfaceFree(')
  assert.ok(guard > 0 && guard < route.indexOf('await enrichWord('))
  assert.match(route, /parseWordInput\(rest, '', \{ jlpt: false \}\)/, '#41 저장에서만 jlpt 거절')
})

test('L4 채택 경로: 기본 단어와 같으면 새로 만들지 않고 그 기본 단어를 돌려준다 · 내 단어 중복은 그대로 409 · 조각은 받은 값(T29)', async (t) => {
  const fake = install(t, fixture())
  const linked = await createWord('A', { surface: '映画', meaning: '영화', reading: 'えいが', source: 'CORRECTION', sourceRefId: 'cr1' }, fake.db, { linkBaseDuplicate: true })
  assert.deepEqual([linked.id, linked.origin, linked.readOnly], ['b5a', 'BASE', true])
  assert.equal(fake.log.includes('word:create'), false, '단어를 새로 만들지 않는다')
  await assert.rejects(createWord('A', { surface: '猫', meaning: 'm', source: 'TUTOR' }, fake.db, { linkBaseDuplicate: true }), apiErr('CONFLICT', (e) => e.details?.existingId === 'a1'))
  const saved = await createWord('A', { ...parseWordInput({ surface: '勉強', meaning: '공부', chunkType: 'ACTION', jlpt: 'N5' }, 'addWord.'), source: 'CORRECTION' }, fake.db, { linkBaseDuplicate: true })
  assert.deepEqual([saved.chunkType, saved.jlpt, saved.origin], ['ACTION', 'N5', 'MINE'], '채택 경로는 jlpt 를 그대로 받는다')
  const quick = await createWord('A', { ...parseWordInput({ surface: '空', meaning: '하늘' }, '', { jlpt: false }), source: 'MANUAL' })
  assert.equal(quick.chunkType, null, '조각 없는 빠른 넣기도 저장(L1)')
  for (const route of ['src/app/api/v1/corrections/[id]/accept/route.ts', 'src/app/api/v1/proposals/[id]/accept/route.ts']) {
    assert.match(readFileSync(join(process.cwd(), route), 'utf8'), /createWord\([^\n]*, tx, \{ linkBaseDuplicate: true \}\)/, route)
  }
})

test('#41·#43 본문(task-068): #41 jlpt 400 unknown_key · #43 jlpt 400 read_only · chunkType null 400 required · 5유형', () => {
  const err = (field: string, reason: string) => apiErr('VALIDATION', (e) => e.details?.field === field && e.details?.reason === reason)
  assert.throws(() => parseWordInput({ surface: 'a', meaning: 'b', jlpt: 'N5' }, '', { jlpt: false }), err('jlpt', 'unknown_key'))
  assert.throws(() => parseWordInput({ surface: 'a', meaning: 'b', jlpt: null }, '', { jlpt: false }), err('jlpt', 'unknown_key'))
  assert.equal(parseWordInput({ surface: 'a', meaning: 'b', chunkType: 'EXPRESSION' }, '', { jlpt: false }).chunkType, 'EXPRESSION')
  assert.equal(parseWordInput({ surface: 'a', meaning: 'b', jlpt: 'N4' }, 'addWord.').jlpt, 'N4')
  assert.throws(() => parseWordPatch({ jlpt: 'N5' }), err('jlpt', 'read_only'))
  assert.throws(() => parseWordPatch({ chunkType: null }), err('chunkType', 'required'))
  assert.deepEqual(parseWordPatch({ chunkType: 'EXPRESSION' }), { chunkType: 'EXPRESSION' })
  assert.throws(() => parseWordPatch({ chunkType: 'none' }), err('chunkType', 'NAME|ACTION|FEELING|MODIFIER|EXPRESSION'))
})

test('T14 #42 기록은 내 것만: 기본 단어에 B 의 카드·평가가 있어도 A 의 stats 엔 0 · 기본 단어는 누구에게나 · 남의 단어 404', async (t) => {
  const recent = new Date(NOW.getTime() - 60_000)
  const attempts: FakeAttempt[] = [
    ...[1, 2, 3].map((i) => ({ id: `xb${i}`, wordId: 'b5a', answer: 'WRONG', answeredAt: recent, sessionUserId: 'B' })),
    { id: 'xa1', wordId: 'b5a', answer: 'CORRECT', answeredAt: recent, sessionUserId: 'A' },
    { id: 'xa2', wordId: 'b5a', answer: 'SKIPPED', answeredAt: recent, sessionUserId: 'A' },
  ]
  install(t, fixture({ attempts, evalItems: [{ id: 'e1', wordId: 'b5a', evaluationUserId: 'B' }] }))
  const d = await getWordDetail('A', 'b5a')
  assert.deepEqual(d.stats, { attempts: 1, last7d: { correct: 1, wrong: 0 }, evalAppearances: 0 })
  assert.deepEqual([d.origin, d.readOnly, d.wrongCount], ['BASE', true, 0])
  const dB = await getWordDetail('B', 'b5a')
  assert.deepEqual(dB.stats, { attempts: 3, last7d: { correct: 0, wrong: 3 }, evalAppearances: 1 })
  assert.deepEqual([dB.wrongCount, dB.archived], [9, true])
  await assert.rejects(getWordDetail('A', 'x1'), apiErr('NOT_FOUND'))
  await assert.rejects(getWordDetail('B', 'a1'), apiErr('NOT_FOUND'))
})

test('T15 보관은 사용자별: A 가 기본 단어를 보관하면 UserWordState(A) 한 행만 · WordEntry 변경 0 · B 목록 그대로 · 두 번 보관해도 archivedAt 유지 · 풀기', async (t) => {
  const fake = install(t, fixture())
  const before = JSON.stringify(fake.words)
  const first = await setWordArchived('A', 'b5b', true)
  assert.deepEqual([first.archived, first.origin], [true, 'BASE'])
  const again = await setWordArchived('A', 'b5b', true)
  assert.equal(again.archivedAt, first.archivedAt)
  assert.equal(JSON.stringify(fake.words), before, 'WordEntry 행 변경 0')
  assert.equal(fake.states.filter((s) => s.wordId === 'b5b').length, 1)
  assert.equal((await ids('A')).includes('b5b'), false)
  assert.equal((await ids('B')).includes('b5b'), true)
  const un = await setWordArchived('A', 'b5b', false)
  assert.deepEqual([un.archived, un.archivedAt], [false, null])
  assert.equal((await ids('A')).includes('b5b'), true)
  await assert.rejects(setWordArchived('A', 'x1', true), apiErr('NOT_FOUND'))
  assert.equal(fake.states.some((s) => s.userId === 'A' && s.wordId === 'x1'), false)
})

test('초안 조각(wordEnrich@v2): 5유형만 옮김 · valid=false 면 null · v1 캐시(chunkType 없음)는 미스', () => {
  const out: WordEnrichOutput = { valid: true, invalidReason: null, reading: 'べんきょう', meaning: '공부', partOfSpeech: 'NOUN', chunkType: 'ACTION', jlpt: 'N5', example: null, exampleKo: null }
  assert.equal(toDraft('勉強', out).chunkType, 'ACTION')
  assert.equal(toDraft('勉強', { ...out, chunkType: 'EXPRESSION' }).chunkType, 'EXPRESSION')
  assert.equal(toDraft('勉強', { ...out, chunkType: 'none' as never }).chunkType, null, '허용 목록 밖 → null')
  assert.equal(toDraft('勉強', { ...out, chunkType: undefined as never }).chunkType, null)
  assert.equal(toDraft('안녕', { ...out, valid: false, invalidReason: '한국어' }).chunkType, null)
  const v1 = { surface: 'v1語', valid: true, invalidReason: null, reading: 'r', meaning: 'm', partOfSpeech: 'NOUN', jlpt: null, example: null, exampleKo: null } as never
  rememberDraft('v1語', 'N5', v1, 1_000)
  assert.equal(cachedDraft('v1語', 'N5', 2_000), null, 'v1 초안은 미스')
  rememberDraft('v2語', 'N5', toDraft('v2語', out), 1_000)
  assert.equal(cachedDraft('v2語', 'N5', 2_000)?.chunkType, 'ACTION')
})

const CONTRACT = [process.env.KAIWA_PROJECT_ROOT, process.cwd()].filter(Boolean).map((r) => join(r!, 'docs/design/api-contract.md')).find((p) => existsSync(p))
test('T25 계약 대조: #46b 폐지 · seed-pack 라우트 없음 · #40~#46 라우트 메서드 = 계약 표', { skip: CONTRACT ? false : 'docs 없음(KAIWA_PROJECT_ROOT 로 저장소 경로를 주면 실행)' }, () => {
  const doc = readFileSync(CONTRACT!, 'utf8')
  const row = doc.split('\n').find((l) => /^\| ~~46b~~ /.test(l))
  assert.ok(row && row.includes('폐지'), '§1-2 표 #46b 줄 = 폐지')
  const api = join(process.cwd(), 'src/app/api/v1/words')
  assert.equal(existsSync(join(api, 'seed-pack')), false)
  const want: Record<string, string[]> = {
    'route.ts': ['GET', 'POST'], '[id]/route.ts': ['GET', 'PATCH', 'DELETE'], '[id]/archive/route.ts': ['POST'], '[id]/unarchive/route.ts': ['POST'], 'categories/route.ts': ['GET'],
  }
  const rows = doc.split('\n').filter((l) => /^\| 4[0-6] \|/.test(l))
  for (const [file, methods] of Object.entries(want)) {
    const src = readFileSync(join(api, file), 'utf8')
    assert.deepEqual([...src.matchAll(/export const (GET|POST|PATCH|DELETE)\b/g)].map((m) => m[1]).sort(), [...methods].sort(), file)
    for (const m of methods) assert.ok(rows.some((r) => r.includes(`| ${m} |`)), `${file} ${m} 이 계약 표에 있다`)
  }
  const tbl40 = rows.find((r) => r.startsWith('| 40 |'))!
  assert.match(tbl40, /page=/)
  assert.match(tbl40, /baseTotal/)
})
