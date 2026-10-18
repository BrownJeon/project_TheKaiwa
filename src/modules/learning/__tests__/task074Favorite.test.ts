/**
 * task-074 즐겨찾기 서버(IMP-0049) — #182/#183 토글 · #40 `favorite=0|1` · WordEntry 를 돌려주는 곳의 `favorite`·`favoritedAt`.
 * DB 접속 0: `prisma` 싱글턴의 모델 대리자·`$transaction` 을 가짜 DB(`wordFakeDb.ts`)로 바꿔 끼우고 시험이 끝나면 되돌린다(task068Words 와 같은 방법).
 * 필터 시험은 「`favorite=1` 결과 = `favorite=0` 결과 ∩ 내 즐겨찾기」를 조건 조합 전부에 대해 대조한다(소스 문자열 스캔 아님 — task-072 교훈).
 */
import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, prisma } from '@/modules/infra'
import {
  createWord, deleteWord, getWordDetail, listWords, parseWordListQuery, parseWordPatch, setWordArchived, setWordFavorite, updateWord, wordListFilter,
  type WordListQuery,
} from '../vocab/words'
import { EMPTY_WORD_STATE, bumpWordStates, favoritedBy } from '../vocab/wordState'
import { base, createWordFakeDb, state, word } from './wordFakeDb'

const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m))
const tick = () => new Promise((r) => setTimeout(r, 5))

function fixture() {
  return createWordFakeDb({
    words: [
      base('b1', 'N5-0001', { surface: '映画', chunkType: 'NAME' }),
      base('b2', 'N5-0002', { surface: '走る', chunkType: 'ACTION' }),
      base('b3', 'N4-0001', { surface: '猫舌', chunkType: 'NAME', category: '초급 (N4)' }),
      base('b4', 'N4-0002', { surface: '嬉しい', chunkType: 'FEELING', category: '초급 (N4)' }),
      word({ id: 'a1', userId: 'A', surface: '猫', category: '여행', chunkType: 'NAME', createdAt: at(1) }),
      word({ id: 'a2', userId: 'A', surface: '犬', category: '여행', chunkType: 'ACTION', createdAt: at(5) }),
      word({ id: 'a3', userId: 'A', surface: '鳥', chunkType: 'NAME', createdAt: at(3) }),
      word({ id: 'a4', userId: 'A', surface: '猫背', chunkType: 'FEELING', createdAt: at(2) }),
      word({ id: 'x1', userId: 'B', surface: '魚', category: '여행', createdAt: at(9) }),
    ],
    states: [
      state('A', 'b3', { wrongCount: 2 }),
      state('A', 'a2', { wrongCount: 1 }),
      state('B', 'b1', { favorite: true, favoritedAt: at(10) }),
      state('B', 'x1', { favorite: true, favoritedAt: at(11) }),
      state('B', 'b2', { archived: true, archivedAt: at(12), favorite: true, favoritedAt: at(12) }),
    ],
  })
}

type Fake = ReturnType<typeof createWordFakeDb>

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

const q = (over: Partial<WordListQuery> = {}): WordListQuery => ({
  q: null, category: null, chunkType: null, source: 'all', archived: false, favorite: false, sort: 'recent', limit: 100, page: 1, ...over,
})
const ids = async (userId: string, over: Partial<WordListQuery> = {}) => (await listWords(userId, q(over))).items.map((w) => w.id)
const apiErr = (code: string, check: (e: ApiError) => boolean = () => true) => (e: unknown) => e instanceof ApiError && e.code === code && check(e)
const myFavs = (fake: Fake, userId: string) => new Set(fake.states.filter((s) => s.userId === userId && s.favorite).map((s) => s.wordId))
const upserts = (fake: Fake) => fake.log.filter((l) => l === 'state:upsert').length

test('F1 #40 쿼리 favorite: 1 → true · 0/빈 값/없음 → false(조건 없음) · 그 밖 400 field=favorite · 반복은 첫 값 · archived 와 독립', () => {
  const p = (s: string) => parseWordListQuery(new URLSearchParams(s), 7)
  assert.equal(p('favorite=1').favorite, true)
  for (const s of ['favorite=0', 'favorite=', '']) assert.equal(p(s).favorite, false, s)
  for (const v of ['2', 'true', 'yes', '01', ' 1', '1,0', '-1', 'TRUE', '1 ']) {
    assert.throws(() => p(`favorite=${encodeURIComponent(v)}`), apiErr('VALIDATION', (e) => e.details?.field === 'favorite' && e.details?.reason === '0|1'), v)
  }
  assert.equal(p('favorite=1&favorite=0').favorite, true, '반복은 첫 값')
  const both = p('archived=1&favorite=1&source=mine')
  assert.deepEqual([both.archived, both.favorite, both.source], [true, true, 'mine'])
  const onlyArch = p('archived=1')
  assert.deepEqual([onlyArch.archived, onlyArch.favorite], [true, false])
})

test('F2 where: favorite=true 면 요청자 기준 favoritedBy 를 AND 로 하나 더, false 면 예전 모양 그대로', () => {
  const b = { q: null, category: null, chunkType: null, archived: false, source: 'all' } as const
  assert.deepEqual(favoritedBy('u1'), { states: { some: { userId: 'u1', favorite: true } } })
  const off = wordListFilter('u1', { ...b, favorite: false })
  assert.deepEqual(off, wordListFilter('u1', b), 'favorite 없음 = false')
  assert.equal((off.AND as object[]).length, 2)
  const on = wordListFilter('u1', { ...b, favorite: true, archived: true, source: 'base', chunkType: 'NAME' })
  assert.deepEqual(on, {
    AND: [{ userId: null, source: 'SEED' }, { states: { some: { userId: 'u1', archived: true } } }, { states: { some: { userId: 'u1', favorite: true } } }, { chunkType: 'NAME' }],
  })
})

test('F3 기본 단어 켜기 → 끄기 → 켜기: 행 하나 · 두 번 켜도 favoritedAt 유지 · 끄면 null · 두 번 꺼도 쓰기 0 · WordEntry 변경 0', async (t) => {
  const fake = install(t, fixture())
  const before = JSON.stringify(fake.words)
  const on1 = await setWordFavorite('A', 'b1', true)
  assert.deepEqual([on1.id, on1.origin, on1.readOnly, on1.favorite, on1.archived], ['b1', 'BASE', true, true, false])
  assert.match(on1.favoritedAt ?? '', /^\d{4}-\d\d-\d\dT/)
  await tick()
  const on2 = await setWordFavorite('A', 'b1', true)
  assert.equal(on2.favoritedAt, on1.favoritedAt, '이미 켜짐 → favoritedAt 유지')
  assert.equal(upserts(fake), 1, '두 번째 켜기는 쓰지 않는다')
  assert.equal(fake.states.filter((s) => s.userId === 'A' && s.wordId === 'b1').length, 1)
  const off1 = await setWordFavorite('A', 'b1', false)
  assert.deepEqual([off1.favorite, off1.favoritedAt], [false, null])
  const off2 = await setWordFavorite('A', 'b1', false)
  assert.deepEqual([off2.favorite, off2.favoritedAt], [false, null])
  assert.equal(upserts(fake), 2, '두 번째 끄기는 쓰지 않는다')
  await tick()
  const on3 = await setWordFavorite('A', 'b1', true)
  assert.equal(on3.favorite, true)
  assert.ok(on3.favoritedAt && on3.favoritedAt > on1.favoritedAt!, '다시 켜면 새 시각')
  assert.equal(fake.states.filter((s) => s.userId === 'A' && s.wordId === 'b1').length, 1)
  assert.equal(JSON.stringify(fake.words), before, 'WordEntry 행 변경 0')
  const bState = fake.states.find((s) => s.userId === 'B' && s.wordId === 'b1')!
  assert.deepEqual([bState.favorite, bState.favoritedAt?.getTime()], [true, at(10).getTime()], 'B 의 별은 그대로')
})

test('F4 상태 행이 없는 단어 끄기 → 행을 만들지 않음 · 응답 false · 잠금 먼저(lock:user 가 쓰기 앞)', async (t) => {
  const fake = install(t, fixture())
  const r = await setWordFavorite('A', 'b4', false)
  assert.deepEqual([r.favorite, r.favoritedAt], [false, null])
  assert.equal(fake.states.some((s) => s.userId === 'A' && s.wordId === 'b4'), false)
  fake.log.length = 0
  await setWordFavorite('A', 'b4', true)
  const lock = fake.log.indexOf('lock:user')
  assert.ok(lock >= 0 && lock < fake.log.indexOf('state:upsert'), fake.log.join(','))
  assert.equal(fake.log[0], 'lock:user', `잠금이 첫 DB 동작이어야 한다(상태 읽기보다 앞): ${fake.log.join(',')}`)
  assert.ok(lock < fake.log.indexOf('state:findUnique'), '잠금은 상태 읽기 앞(두 연타가 같은 옛 상태를 읽지 않게)')
})

test('F5 내 단어 켜기·끄기 + 사용자 격리: B 의 별은 A 의 목록·상세·필터에 안 보이고, A 는 B 의 단어를 켤 수 없다(404·행 0)', async (t) => {
  const fake = install(t, fixture())
  const mine = await setWordFavorite('A', 'a1', true)
  assert.deepEqual([mine.origin, mine.favorite], ['MINE', true])
  const list = await listWords('A', q())
  assert.equal(list.items.find((w) => w.id === 'b1')!.favorite, false, 'B 가 켠 b1 은 A 에게 false')
  assert.equal(list.items.find((w) => w.id === 'a1')!.favorite, true)
  assert.deepEqual(await ids('A', { favorite: true }), ['a1'])
  assert.deepEqual((await ids('B', { favorite: true })).sort(), ['b1', 'x1'], 'B 의 보관 안 한 별만(b2 는 보관함)')
  assert.deepEqual(await ids('B', { favorite: true, archived: true }), ['b2'])
  const dA = await getWordDetail('A', 'b1')
  assert.deepEqual([dA.favorite, dA.favoritedAt], [false, null])
  const dB = await getWordDetail('B', 'b1')
  assert.deepEqual([dB.favorite, dB.favoritedAt], [true, at(10).toISOString()])
  for (const on of [true, false]) {
    await assert.rejects(setWordFavorite('A', 'x1', on), apiErr('NOT_FOUND'))
    await assert.rejects(setWordFavorite('B', 'a1', on), apiErr('NOT_FOUND'))
  }
  assert.equal(fake.states.some((s) => s.userId === 'A' && s.wordId === 'x1'), false)
  assert.equal(fake.states.some((s) => s.userId === 'B' && s.wordId === 'a1'), false)
  assert.equal(fake.states.find((s) => s.userId === 'B' && s.wordId === 'x1')!.favorite, true, 'B 의 별은 그대로')
  const off = await setWordFavorite('A', 'a1', false)
  assert.equal(off.favorite, false)
  assert.deepEqual(await ids('A', { favorite: true }), [])
})

test('F6 없는 id·빈 id·41자 id·지운 단어 → 404, 상태 행 0', async (t) => {
  const fake = install(t, fixture())
  for (const id of ['nope', '', 'x'.repeat(41)]) await assert.rejects(setWordFavorite('A', id, true), apiErr('NOT_FOUND'), JSON.stringify(id))
  await setWordFavorite('A', 'a3', true)
  await deleteWord('A', 'a3')
  assert.equal(fake.states.some((s) => s.wordId === 'a3'), false, '단어 삭제 시 상태 행 cascade')
  await assert.rejects(setWordFavorite('A', 'a3', true), apiErr('NOT_FOUND'))
  await assert.rejects(setWordFavorite('A', 'a3', false), apiErr('NOT_FOUND'))
  assert.equal(fake.states.some((s) => s.wordId === 'a3' || s.wordId === 'nope'), false)
})

test('F7 보관과 독립: 보관해도 별 유지 · 보관함+즐겨찾기 = 보관한 별만 · 보관 중 별 끄기는 보관을 안 바꿈 · 토글 응답은 서로의 칸을 싣는다', async (t) => {
  const fake = install(t, fixture())
  await setWordFavorite('A', 'a1', true)
  await setWordFavorite('A', 'b2', true)
  const arch = await setWordArchived('A', 'a1', true)
  assert.deepEqual([arch.archived, arch.favorite], [true, true], '보관 응답에 별이 실린다')
  assert.deepEqual(await ids('A', { favorite: true }), ['b2'], '보관 아님 + 별')
  assert.deepEqual(await ids('A', { favorite: true, archived: true }), ['a1'], '보관함 + 별')
  const unfav = await setWordFavorite('A', 'a1', false)
  assert.deepEqual([unfav.archived, unfav.favorite], [true, false], '별 끄기 응답에 보관이 실린다')
  assert.deepEqual(await ids('A', { favorite: true, archived: true }), [])
  assert.deepEqual(await ids('A', { archived: true }), ['a1'], '보관 그대로')
  await setWordFavorite('A', 'a1', true)
  const unarch = await setWordArchived('A', 'a1', false)
  assert.deepEqual([unarch.archived, unarch.favorite], [false, true])
  assert.deepEqual(await ids('A', { favorite: true }), ['a1', 'b2'])
  const s = fake.states.find((x) => x.userId === 'A' && x.wordId === 'a1')!
  assert.deepEqual([s.archived, s.archivedAt, s.favorite], [false, null, true])
})

test('F8 AND 조합 전부: favorite=1 결과 = favorite=0 결과 ∩ 내 별(순서 유지) · total·pages 정확 · baseTotal 불변 · 항목 favorite=true', async (t) => {
  const fake = install(t, fixture())
  for (const id of ['a1', 'a2', 'b1', 'b3', 'b4']) await setWordFavorite('A', id, true)
  await setWordArchived('A', 'b4', true)
  await setWordArchived('A', 'a4', true)
  const favs = myFavs(fake, 'A')
  let checked = 0
  let nonEmpty = 0
  for (const source of ['all', 'mine', 'base'] as const) {
    for (const archived of [false, true]) {
      for (const chunkType of [null, 'NAME', 'ACTION', 'FEELING'] as const) {
        for (const text of [null, '猫']) {
          for (const category of [null, '여행']) {
            for (const sort of ['recent', 'wrong', 'surface'] as const) {
              const cond = { source, archived, chunkType, q: text, category, sort }
              const all = await listWords('A', q({ ...cond }))
              const fav = await listWords('A', q({ ...cond, favorite: true }))
              const want = all.items.map((w) => w.id).filter((id) => favs.has(id))
              const label = JSON.stringify(cond)
              assert.deepEqual(fav.items.map((w) => w.id), want, label)
              assert.equal(fav.total, want.length, label)
              assert.equal(fav.pages, Math.max(1, Math.ceil(want.length / 100)), label)
              assert.equal(fav.baseTotal, 4, label)
              assert.equal(all.baseTotal, 4, label)
              assert.ok(fav.items.every((w) => w.favorite === true && typeof w.favoritedAt === 'string'), label)
              for (const w of all.items) assert.equal(w.favorite, favs.has(w.id), `${label} ${w.id}`)
              checked += 1
              if (want.length) nonEmpty += 1
              if (want.length > 1) {
                const paged: string[] = []
                const first = await listWords('A', q({ ...cond, favorite: true, limit: 1 }))
                assert.equal(first.pages, want.length, label)
                for (let page = 1; page <= first.pages; page += 1) paged.push(...(await listWords('A', q({ ...cond, favorite: true, limit: 1, page }))).items.map((w) => w.id))
                assert.deepEqual(paged, want, `${label} 쪽 이어 붙이기`)
              }
            }
          }
        }
      }
    }
  }
  assert.equal(checked, 3 * 2 * 4 * 2 * 2 * 3)
  assert.ok(nonEmpty >= 20, `비지 않은 조합 ${nonEmpty}`)
})

test('F9 항목 기본값: 상태 행이 없거나 별을 안 켠 단어는 favorite=false·favoritedAt=null(EMPTY_WORD_STATE)', async (t) => {
  install(t, fixture())
  assert.deepEqual([EMPTY_WORD_STATE.favorite, EMPTY_WORD_STATE.favoritedAt], [false, null])
  const items = (await listWords('A', q())).items
  assert.ok(items.length > 0)
  for (const w of items) {
    assert.equal(Object.prototype.hasOwnProperty.call(w, 'favorite'), true, w.id)
    assert.deepEqual([w.favorite, w.favoritedAt], [false, null], w.id)
  }
})

test('F10 WordEntry 를 돌려주는 곳: 상세 #42 · 수정 #43 응답(별 유지) · 생성 #41(새 단어 false) · 채택 연결(기본 단어의 내 별) · #43 본문 favorite 는 400 read_only', async (t) => {
  const fake = install(t, fixture())
  await setWordFavorite('A', 'a2', true)
  await setWordFavorite('A', 'b1', true)
  const detail = await getWordDetail('A', 'a2')
  assert.equal(detail.favorite, true)
  const fav = fake.states.find((s) => s.userId === 'A' && s.wordId === 'a2')!.favoritedAt!.toISOString()
  const upd = await updateWord('A', 'a2', { meaning: '개(수정)' })
  assert.deepEqual([upd.meaning, upd.favorite, upd.favoritedAt], ['개(수정)', true, fav], '[저장] 응답이 별을 잃지 않는다')
  const created = await createWord('A', { surface: '新しい', meaning: '새롭다', source: 'MANUAL' })
  assert.deepEqual([created.origin, created.favorite, created.favoritedAt], ['MINE', false, null])
  const linked = await createWord('A', { surface: '映画', meaning: '영화', reading: 'b1-r', source: 'CORRECTION' }, undefined, { linkBaseDuplicate: true })
  assert.deepEqual([linked.id, linked.origin, linked.favorite], ['b1', 'BASE', true], '채택이 기본 단어로 연결되면 내 별이 실린다')
  const linkedB = await createWord('B', { surface: '走る', meaning: '달리다', reading: 'b2-r', source: 'CORRECTION' }, undefined, { linkBaseDuplicate: true })
  assert.deepEqual([linkedB.id, linkedB.favorite], ['b2', true])
  const linkedA = await createWord('A', { surface: '走る', meaning: '달리다', reading: 'b2-r', source: 'CORRECTION' }, undefined, { linkBaseDuplicate: true })
  assert.deepEqual([linkedA.id, linkedA.favorite], ['b2', false], 'B 의 별은 A 에게 안 실린다')
  for (const k of ['favorite', 'favoritedAt']) {
    assert.throws(() => parseWordPatch({ [k]: true }), apiErr('VALIDATION', (e) => e.details?.field === k && e.details?.reason === 'read_only'), k)
  }
})

// ── REV-074S 시험 보강(M-1·M-2·L-1·L-2) — 제품 코드 변경 없이 「이 변이를 넣으면 실패한다」를 고정한다 ────────────────────

test('F11 잠금 순서(L-1): 토글의 첫 DB 동작은 늘 사용자 행 잠금 — 켜기/끄기 × 상태 행 있음/없음 × 없는 id 모두, 잠금은 한 번', async (t) => {
  const fake = install(t, fixture())
  const runs: [string, boolean, string][] = [
    ['b4', true, '행 없음 → 켜기'],
    ['b4', true, '이미 켜짐 → 켜기(쓰기 없음)'],
    ['b4', false, '켜짐 → 끄기'],
    ['b4', false, '이미 꺼짐 → 끄기(쓰기 없음)'],
    ['a1', false, '행 없는 내 단어 → 끄기(행 만들지 않음)'],
    ['nope', true, '없는 id → 404'],
  ]
  for (const [id, on, label] of runs) {
    fake.log.length = 0
    await setWordFavorite('A', id, on).catch(() => undefined)
    const log = fake.log.join(',')
    assert.equal(fake.log[0], 'lock:user', `${label}: ${log}`)
    assert.equal(fake.log.filter((l) => l === 'lock:user').length, 1, `${label}: ${log}`)
    const read = fake.log.indexOf('state:findUnique')
    if (read >= 0) assert.ok(fake.log.indexOf('word:findFirst') < read, `${label}: 보이는 단어 확인이 상태 읽기보다 먼저 ${log}`)
  }
})

const NOW = new Date('2026-10-14T03:00:00.000Z')

test('F12 세트 끝내기 카운터(M-1): 맞힘·틀림·건너뜀 어느 경로도 favorite·favoritedAt 을 안 지운다 · 보관 별도 · 새로 만든 행은 별 아님 · 남의 별 그대로', async () => {
  const fake = createWordFakeDb({
    words: [
      base('b1', 'N5-0001'), base('b2', 'N5-0002'), base('b3', 'N5-0003'),
      word({ id: 'a1', userId: 'A' }), word({ id: 'a2', userId: 'A' }), word({ id: 'a3', userId: 'A' }), word({ id: 'a4', userId: 'A' }),
    ],
    states: [
      state('A', 'b1', { favorite: true, favoritedAt: at(10) }),
      state('A', 'b2', { favorite: true, favoritedAt: at(11), wrongCount: 1, archived: true, archivedAt: at(12) }),
      state('A', 'a1', { favorite: true, favoritedAt: at(13) }),
      state('A', 'a2', { favorite: true, favoritedAt: at(14) }),
      state('A', 'a3', {}),
      state('B', 'b1', { favorite: true, favoritedAt: at(20) }),
    ],
  })
  // b1·a3·b3 맞힘 · b2 틀림 · a1 건너뜀 · a2 는 맞힘 → 건너뜀(두 목록에 있는 id)
  await bumpWordStates(fake.db, 'A', { correctIds: ['b1', 'a2', 'a3', 'b3'], wrongIds: ['b2'], skippedIds: ['a1', 'a2'] }, NOW)
  const of = (u: string, w: string) => fake.states.find((s) => s.userId === u && s.wordId === w)!
  const star = (u: string, w: string) => [of(u, w).favorite, of(u, w).favoritedAt?.getTime() ?? null]
  assert.deepEqual(star('A', 'b1'), [true, at(10).getTime()], '맞힘')
  assert.deepEqual(star('A', 'b2'), [true, at(11).getTime()], '틀림 + 보관한 별')
  assert.deepEqual(star('A', 'a1'), [true, at(13).getTime()], '건너뜀')
  assert.deepEqual(star('A', 'a2'), [true, at(14).getTime()], '맞힘 뒤 건너뜀')
  assert.deepEqual(star('A', 'a3'), [false, null], '별 아닌 단어는 채점해도 별이 생기지 않는다')
  assert.deepEqual(star('A', 'b3'), [false, null], '이번에 처음 만든 상태 행도 별 아님')
  assert.deepEqual(star('B', 'b1'), [true, at(20).getTime()], 'B 의 별은 그대로')
  assert.deepEqual([of('A', 'b2').archived, of('A', 'b2').archivedAt?.getTime()], [true, at(12).getTime()], '보관도 그대로')
  // 카운터는 실제로 올랐다 — 위 단언이 「아무것도 안 해서」 통과한 게 아님
  assert.deepEqual([of('A', 'b1').correctCount, of('A', 'b2').wrongCount, of('A', 'a1').lastResult, of('A', 'a2').correctCount, of('A', 'a2').lastResult], [1, 2, 'SKIPPED', 1, 'SKIPPED'])
  assert.deepEqual([of('A', 'b3').correctCount, of('B', 'b1').correctCount], [1, 0])
  assert.equal(fake.states.some((s) => s.userId === 'A' && s.wordId === 'a4'), false, '채점 안 한 단어에 행을 만들지 않는다')
  assert.deepEqual([...myFavs(fake, 'A')].sort(), ['a1', 'a2', 'b1', 'b2'])
})

test('F13 시각 독립: 보관·풀기는 favoritedAt 을, 별 켜기·끄기는 archivedAt 을 그대로 둔다(양방향)', async (t) => {
  const fake = install(t, fixture())
  const on = await setWordFavorite('A', 'a1', true)
  const arch = await setWordArchived('A', 'a1', true)
  assert.equal(arch.favoritedAt, on.favoritedAt, '보관해도 favoritedAt 유지')
  await tick()
  const back = await setWordArchived('A', 'a1', false)
  assert.equal(back.favoritedAt, on.favoritedAt, '풀어도 favoritedAt 유지')
  const row = fake.states.find((s) => s.userId === 'A' && s.wordId === 'a1')!
  assert.deepEqual([row.favorite, row.favoritedAt?.toISOString()], [true, on.favoritedAt])
  const archived = await setWordArchived('A', 'a2', true)
  assert.ok(archived.archivedAt, '보관 시각이 있다')
  await tick()
  const f1 = await setWordFavorite('A', 'a2', true)
  assert.equal(f1.archivedAt, archived.archivedAt, '별을 켜도 archivedAt 유지')
  await tick()
  const f0 = await setWordFavorite('A', 'a2', false)
  assert.deepEqual([f0.archived, f0.archivedAt], [true, archived.archivedAt], '별을 꺼도 보관·archivedAt 유지')
})

test('F14 상태 행을 쓰지 않는 길: 목록·상세·수정(#43, 빈 패치 포함)·생성(#41)·채택 연결은 UserWordState 에 쓰지 않는다 — 별 행 그대로', async (t) => {
  const fake = install(t, fixture())
  await setWordFavorite('A', 'a2', true)
  await setWordFavorite('A', 'b1', true)
  const before = JSON.stringify(fake.states)
  fake.log.length = 0
  await listWords('A', q())
  await listWords('A', q({ favorite: true, sort: 'wrong' }))
  await getWordDetail('A', 'a2')
  await updateWord('A', 'a2', { meaning: '개(수정)' })
  await updateWord('A', 'a2', {})
  await createWord('A', { surface: '新しい', meaning: '새롭다', source: 'MANUAL' })
  await createWord('A', { surface: '映画', meaning: '영화', reading: 'b1-r', source: 'CORRECTION' }, undefined, { linkBaseDuplicate: true })
  assert.equal(JSON.stringify(fake.states), before, '상태 행 변경 0')
  assert.deepEqual(fake.log.filter((l) => /^state:(upsert|updateMany|createMany)$/.test(l)), [], '상태 쓰기 호출 0')
  assert.deepEqual([...myFavs(fake, 'A')].sort(), ['a2', 'b1'])
})

/** 「많이 틀린 순」 시험용 — 틀린 단어 중 별/별 아님·보관·분류·남의 상태가 섞여 있다. 기대값은 아래 손계산 표(코드 출력이 아님). */
function wrongFixture() {
  return createWordFakeDb({
    words: [
      base('b1', 'N5-0001', { surface: 'あお', category: '여행' }),
      base('b2', 'N5-0002', { surface: 'かお' }),
      base('b3', 'N4-0001', { surface: 'うみ' }),
      base('b4', 'N4-0002', { surface: 'すし' }),
      word({ id: 'a1', userId: 'A', surface: 'さか', category: '여행', createdAt: at(1) }),
      word({ id: 'a2', userId: 'A', surface: 'いぬ', category: '여행', createdAt: at(5) }),
      word({ id: 'a3', userId: 'A', surface: 'えび', createdAt: at(3) }),
      word({ id: 'a4', userId: 'A', surface: 'たこ', createdAt: at(2) }),
      word({ id: 'a5', userId: 'A', surface: 'ひる', createdAt: at(4) }),
      word({ id: 'x1', userId: 'B', surface: 'ねこ', createdAt: at(9) }),
    ],
    // A: 틀린 수(w) · ★ = 별.   b1 w3★ · b2 w3 · b3 w2★ · b4 w1 · a1 w2 · a2 w2★ · a3 w0★ · a4 w4 · a5 w5★(보관)
    states: [
      state('A', 'b1', { wrongCount: 3, favorite: true, favoritedAt: at(20) }),
      state('A', 'b2', { wrongCount: 3 }),
      state('A', 'b3', { wrongCount: 2, favorite: true, favoritedAt: at(21) }),
      state('A', 'b4', { wrongCount: 1 }),
      state('A', 'a1', { wrongCount: 2 }),
      state('A', 'a2', { wrongCount: 2, favorite: true, favoritedAt: at(22) }),
      state('A', 'a3', { favorite: true, favoritedAt: at(23) }),
      state('A', 'a4', { wrongCount: 4 }),
      state('A', 'a5', { wrongCount: 5, favorite: true, favoritedAt: at(24), archived: true, archivedAt: at(25) }),
      // B 의 상태 — A 의 어떤 목록에도 새면 안 된다(x1 은 B 의 단어, b2 는 같은 기본 단어에 대한 B 의 별·틀린 수 9)
      state('B', 'x1', { wrongCount: 9, favorite: true, favoritedAt: at(26) }),
      state('B', 'b2', { wrongCount: 9, favorite: true, favoritedAt: at(27) }),
    ],
  })
}

test('F15 즐겨찾기 × 정렬(M-2): 별 아닌 틀린 단어가 섞여도 favorite=1 은 별만 · 순서·total 은 손계산 표와 같다(wrong·recent·surface)', async (t) => {
  install(t, wrongFixture())
  const list = (userId: string, over: Partial<WordListQuery>) => listWords(userId, q(over))
  const want = async (label: string, userId: string, over: Partial<WordListQuery>, expected: string[]) => {
    const r = await list(userId, over)
    assert.deepEqual(r.items.map((w) => w.id), expected, label)
    assert.equal(r.total, expected.length, `${label} total`)
    assert.equal(r.baseTotal, 4, `${label} baseTotal`)
    if (over.favorite) assert.ok(r.items.every((w) => w.favorite === true), `${label} 항목 favorite`)
  }
  // 별(A, 보관 안 한 것): b1(w3) b3(w2) a2(w2) a3(w0). 틀림 같으면 내 단어 먼저 → a2 가 b3 앞. 안 틀린 별 a3 는 맨 뒤.
  await want('wrong+별', 'A', { sort: 'wrong', favorite: true }, ['b1', 'a2', 'b3', 'a3'])
  // 별 아닌 틀린 단어(b2 a4 a1 b4)는 한 개도 들어오지 않는다
  for (const nonStar of ['b2', 'a4', 'a1', 'b4', 'a5', 'x1']) assert.equal((await ids('A', { sort: 'wrong', favorite: true })).includes(nonStar), false, nonStar)
  // 조건 없음(favorite=0): 틀린 수 내림차순 a4(4) b1 b2(3) a2 a1 b3(2) b4(1), 안 틀린 a3 는 뒤. 보관한 a5 는 빠진다.
  await want('wrong 전체', 'A', { sort: 'wrong' }, ['a4', 'b1', 'b2', 'a2', 'a1', 'b3', 'b4', 'a3'])
  await want('recent+별', 'A', { sort: 'recent', favorite: true }, ['a2', 'a3', 'b1', 'b3'])
  await want('surface+별', 'A', { sort: 'surface', favorite: true }, ['b1', 'a2', 'b3', 'a3'])
  // 보관함: 보관한 별 a5 하나
  await want('wrong+별+보관함', 'A', { sort: 'wrong', favorite: true, archived: true }, ['a5'])
  await want('wrong+보관함', 'A', { sort: 'wrong', archived: true }, ['a5'])
  await want('recent+별+보관함', 'A', { sort: 'recent', favorite: true, archived: true }, ['a5'])
  // 출처
  await want('wrong+별+내 단어', 'A', { sort: 'wrong', favorite: true, source: 'mine' }, ['a2', 'a3'])
  await want('wrong+별+기본 단어', 'A', { sort: 'wrong', favorite: true, source: 'base' }, ['b1', 'b3'])
  // 분류(여행: b1 a1 a2)
  await want('wrong+별+여행', 'A', { sort: 'wrong', favorite: true, category: '여행' }, ['b1', 'a2'])
  await want('wrong+여행', 'A', { sort: 'wrong', category: '여행' }, ['b1', 'a2', 'a1'])
  // 다른 사용자: B 의 별은 x1(내 단어)과 기본 단어 b2 — A 의 상태는 하나도 안 보인다(둘 다 B 에게 9번 틀림, 내 단어 먼저)
  await want('B wrong+별', 'B', { sort: 'wrong', favorite: true }, ['x1', 'b2'])
  // 쪽 이어붙이기 — 틀린 묶음(3)과 안 틀린 묶음(1) 경계를 지난다
  const p1 = await list('A', { sort: 'wrong', favorite: true, limit: 2, page: 1 })
  const p2 = await list('A', { sort: 'wrong', favorite: true, limit: 2, page: 2 })
  const p3 = await list('A', { sort: 'wrong', favorite: true, limit: 2, page: 3 })
  assert.deepEqual([p1.items.map((w) => w.id), p2.items.map((w) => w.id), p3.items.map((w) => w.id)], [['b1', 'a2'], ['b3', 'a3'], []])
  assert.deepEqual([p1.total, p1.pages, p3.total], [4, 2, 4])
})

const SCHEMA = [process.env.KAIWA_PROJECT_ROOT, process.cwd()].filter(Boolean).map((r) => join(r!, 'prisma/schema.prisma')).find((p) => existsSync(p))

test('F16 스키마(L-2): UserWordState 에 favorite(Boolean 기본 false)·favoritedAt(DateTime?)·(userId, favorite) 색인·(userId, wordId) 유니크가 있다', () => {
  assert.ok(SCHEMA, 'prisma/schema.prisma 를 찾지 못했다(KAIWA_PROJECT_ROOT 로 저장소 경로를 줄 수 있다)')
  const block = /\nmodel UserWordState \{([\s\S]*?)\n\}/.exec(readFileSync(SCHEMA!, 'utf8'))?.[1]
  assert.ok(block, 'model UserWordState 블록')
  const lines = block!.split('\n').map((l) => l.replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' ')).filter(Boolean)
  for (const want of ['favorite Boolean @default(false)', 'favoritedAt DateTime?', '@@index([userId, favorite])', '@@unique([userId, wordId])']) {
    assert.ok(lines.includes(want), `UserWordState 에 \`${want}\` 가 없다 — ${lines.join(' | ')}`)
  }
})
