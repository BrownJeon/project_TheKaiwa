/**
 * task-068 S-B2 — 「내 단어 + 공용 기본 단어」 범위로 바뀐 읽기 경로: 평가 재료(#65)·레슨 메모 단어장 연결(#62a)·복습 재료 단어 읽기(#63).
 * (세트 풀·끝내기 카운터 T28 은 task059CardFirst.test.ts, 교정 모음 savedWord T30 은 conversation task055drawer.test.ts.)
 * 가짜 DB — DB 접속 없음.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, type Tx } from '@/modules/infra'
import { EVAL_MATERIALS_MAX, loadEvaluationMaterials, pickEvalMaterials, type EvalMaterialWord } from '../evaluation/materials'
import { wordbookMatches, wordbookOrder } from '../lessons/memo'
import { reviewWordReadWhere } from '../reviewSchedule'
import { createRng, sampleWeighted, weightOf, type LevelCode } from '../vocab/setGenerator'
import { loadActiveWordStates } from '../vocab/wordState'
import { fakeUserWordState, matchWhere, stateRow } from './wordWhereFake'

type Row = Record<string, unknown>
const A = 'user-a'
const B = 'user-b'
const T = (m: number) => new Date(Date.UTC(2026, 9, 14, 0, m))

const w = (id: string, over: Row = {}): Row => ({
  id, userId: A, source: 'MANUAL', surface: id, reading: null, meaning: `뜻-${id}`, jlpt: null, seedKey: null, createdAt: T(0), ...over,
})
const base = (id: string, seedKey: string, over: Row = {}): Row => w(id, { userId: null, source: 'SEED', seedKey, jlpt: seedKey.slice(0, 2), createdAt: T(0), ...over })

function pick(r: Row, select?: Row): Row {
  return select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, r[k]])) : { ...r }
}

/** wordEntry.findMany(where·select·take) + userWordState + evaluationItem(빈) — 저장 순서를 뒤집어 돌려준다(DB 순서에 기대지 않는지). */
function fakeDb(words: Row[], states: Row[] = []) {
  const db = { words, states }
  return {
    wordEntry: { findMany: async (a: { where?: Row; select?: Row; take?: number }) => words.filter((x) => matchWhere(x, a.where, states)).reverse().slice(0, a.take).map((x) => pick(x, a.select)) },
    userWordState: fakeUserWordState(db),
    evaluationItem: { findMany: async () => [] },
  } as unknown as Tx
}

// ── #65 평가 재료 ────────────────────────────────────────────────────────────

const EVAL_INPUT = { kind: 'TALK' as const, topicId: null, level: 'N5' as const }
/** 프로필 읽기 가짜 — 천장 때문에 목표 수준을 읽는다(실제 `getProfile` 은 DB 를 친다). */
const PROFILE = async () => ({ level: 'N5', goalLevel: null as string | null })

test('#65 재료 풀 = 내 단어 + 기본 단어(내가 보관 안 함) — 남의 단어·내가 보관한 기본 단어 없음, 남의 보관은 무관', async () => {
  const words = [w('m1'), w('m2'), w('x1', { userId: B }), base('b1', 'N5-0001'), base('b2', 'N5-0002'), base('b3', 'N4-0001'), base('b4', 'N1-0001')]
  const states = [stateRow(A, 'b2', { archived: true }), stateRow(B, 'b1', { archived: true }), stateRow(B, 'm1', { archived: true })]
  const r = await loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb(words, states), pickEvalMaterials, PROFILE)
  assert.equal(r.wordCount, 5)
  assert.deepEqual(r.words.map((x) => x.id).sort(), ['b1', 'b3', 'b4', 'm1', 'm2'])
})

test('#65 「많이 틀린 순」은 나의 UserWordState wrongCount(상태 없으면 0) — 다른 사용자의 기록은 순서·가중에 들어가지 않는다', async () => {
  const words = [w('m1'), base('b1', 'N5-0001'), base('b2', 'N5-0002'), base('b3', 'N5-0003'), base('b4', 'N5-0004'), base('b5', 'N5-0005')]
  const states = [stateRow(A, 'b3', { wrongCount: 5 }), stateRow(A, 'm1', { wrongCount: 2, correctCount: 1 }), stateRow(B, 'b5', { wrongCount: 99 })]
  const r = await loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb(words, states), pickEvalMaterials, PROFILE)
  assert.deepEqual(r.words.slice(0, 2).map((x) => [x.id, x.wrongCount]), [['b3', 5], ['m1', 2]])
  assert.equal(r.words.find((x) => x.id === 'b5')?.wrongCount, 0, 'user-b 의 99 는 나에게 0')
  assert.equal(r.words.find((x) => x.id === 'm1')?.correctCount, 1)
})

test('#65 단어가 모자라면 400 NOT_ENOUGH_WORDS — 셈은 보이고 보관 안 한 단어(기본 단어 포함)', async () => {
  const words = [w('m1'), base('b1', 'N5-0001'), base('b2', 'N5-0002'), w('x1', { userId: B }), w('x2', { userId: B })]
  const states = [stateRow(A, 'b2', { archived: true })]
  await assert.rejects(loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb(words, states), pickEvalMaterials, PROFILE), (e: unknown) => {
    assert.ok(e instanceof ApiError)
    assert.deepEqual([e.code, e.details?.reason, e.details?.have, e.details?.need], ['VALIDATION', 'NOT_ENOUGH_WORDS', 2, 4])
    return true
  })
})

/** REV-068B-1/2 — 옛 상한(2,000)을 넘는 풀. 기본 단어 2,500 은 id 가 작고 내 새 단어(오답 0)는 id 가 더 크다(옛 정렬 후 자르기가 밀어내던 모양). */
const BASE_COUNT = 2_500
const bigPool = () => [
  ...Array.from({ length: BASE_COUNT }, (_, i) => base(`b${String(i + 1).padStart(5, '0')}`, `N5-${String(i + 1).padStart(5, '0')}`)),
  w('m1'), w('m2'), w('m3'),
]

test('#65 풀은 자르지 않는다 — 기본 단어 2,500 + 내 새 단어(오답 0)도 후보로 pickEvalMaterials 에 들어가고, wordCount 는 실제 풀 길이', async () => {
  const words = bigPool()
  const seen: { length: number; ids: Set<string> }[] = []
  const spy: typeof pickEvalMaterials = (pool, ...rest) => (seen.push({ length: pool.length, ids: new Set(pool.map((x) => x.id)) }), pickEvalMaterials(pool, ...rest))
  const r = await loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb(words, []), spy, PROFILE)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].length, BASE_COUNT + 3, '옛 POOL_MAX 2,000 으로 자르지 않고 보이는 단어 전부')
  for (const id of ['m1', 'm2', 'm3', 'b00001', `b${String(BASE_COUNT).padStart(5, '0')}`]) assert.ok(seen[0].ids.has(id), `${id} 는 후보여야 한다`)
  assert.equal(r.wordCount, BASE_COUNT + 3, 'trace 의 「보관하지 않은 단어 수」는 자르기 전 실제 길이')
  assert.equal(r.words.length, EVAL_MATERIALS_MAX, '풀이 커져도 재료는 ≤15')
})

test('#65 풀이 커도 내가 보관한 기본 단어는 풀에서 빠지고 나의 오답 수가 풀에 붙으며, 재료는 오답 내림차순', async () => {
  const words = bigPool()
  const states = [stateRow(A, 'b00001', { archived: true }), stateRow(A, 'm2', { wrongCount: 4 }), stateRow(A, 'b00002', { wrongCount: 3 }), stateRow(B, 'b00003', { wrongCount: 9 })]
  const seen: { id: string; wrongCount: number }[][] = []
  const spy: typeof pickEvalMaterials = (pool, ...rest) => (seen.push(pool.map((x) => ({ id: x.id, wrongCount: x.wrongCount }))), pickEvalMaterials(pool, ...rest))
  const r = await loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb(words, states), spy, PROFILE)
  const byId = new Map(seen[0].map((x) => [x.id, x.wrongCount]))
  assert.equal(r.wordCount, BASE_COUNT + 2)
  assert.equal(byId.has('b00001'), false, '내가 보관한 기본 단어')
  assert.deepEqual([byId.get('m2'), byId.get('b00002'), byId.get('b00003')], [4, 3, 0], '내 오답만 붙고 user-b 의 9 는 0')
  assert.deepEqual(r.words.map((x) => x.wrongCount), [...r.words.map((x) => x.wrongCount)].sort((a, b) => b - a))
})

// ── #65 평가 재료의 수준 상한(천장) — 오늘의 단어 세트(task-053)와 같은 가중. 기본 단어 N1 3천 개가 풀에 들어와 생긴 구멍 ─────────────────────────

const NOW = T(0)
const mw = (id: string, jlpt: LevelCode | null | undefined, over: Partial<EvalMaterialWord> = {}): EvalMaterialWord => ({
  id, surface: `s-${id}`, reading: null, meaning: `m-${id}`, correctCount: 0, wrongCount: 0, lastSeenAt: null, ...(jlpt === undefined ? {} : { jlpt }), ...over,
})
const range = (n: number, make: (i: number) => EvalMaterialWord) => Array.from({ length: n }, (_, i) => make(i))
const idsOf = (xs: readonly EvalMaterialWord[]) => xs.map((x) => x.id)
const countOf = (xs: readonly EvalMaterialWord[], level: LevelCode | null) => xs.filter((x) => (x.jlpt ?? null) === level).length
/** 천장 도입 전의 `pickEvalMaterials` 그대로(참조 구현) — `ceiling` 이 없을 때 결과·난수 소비가 이것과 같아야 한다. */
function pickBeforeCeiling(pool: readonly EvalMaterialWord[], recent: ReadonlySet<string>, rng: () => number, now: Date, max = EVAL_MATERIALS_MAX): EvalMaterialWord[] {
  const sorted = pool.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const weights = sorted.map((x) => weightOf(x, now) * (recent.has(x.surface) ? 0.1 : 1))
  const picked = sampleWeighted(sorted, weights, Math.min(max, sorted.length), rng)
  return picked.map((x, i) => ({ x, i })).sort((p, q) => q.x.wrongCount - p.x.wrongCount || p.i - q.i).map((p) => p.x)
}
const SEEDS = Array.from({ length: 50 }, (_, i) => `ceil-${i}`)

test('#65 천장(ceiling)이 없으면 변경 전과 완전히 같다 — 결과 목록·순서·난수 소비 (jlpt 가 있어도, ceiling 이 null/undefined 여도)', () => {
  const levels: (LevelCode | null | undefined)[] = ['N5', 'N4', 'N3', 'N2', 'N1', null, undefined]
  const pool = range(120, (i) => mw(`p${String(i).padStart(3, '0')}`, levels[i % levels.length], {
    wrongCount: i % 7 === 0 ? 3 : i % 11 === 0 ? 1 : 0, correctCount: i % 5 === 0 ? 2 : 0, lastSeenAt: i % 3 === 0 ? new Date(NOW.getTime() - 3_600_000) : i % 3 === 1 ? new Date(NOW.getTime() - 3 * 86_400_000) : null,
  }))
  const recent = new Set(['s-p004', 's-p010', 's-p033'])
  for (const seed of SEEDS.slice(0, 20)) {
    const want = pickBeforeCeiling(pool, recent, createRng(seed), NOW)
    const rngA = createRng(seed)
    const a = pickEvalMaterials(pool, recent, rngA, NOW)
    const rngB = createRng(seed)
    const b = pickEvalMaterials(pool, recent, rngB, NOW, EVAL_MATERIALS_MAX, null)
    const rngC = createRng(seed)
    const c = pickEvalMaterials(pool, recent, rngC, NOW, EVAL_MATERIALS_MAX, undefined)
    const rngRef = createRng(seed)
    pickBeforeCeiling(pool, recent, rngRef, NOW)
    assert.deepEqual(idsOf(a), idsOf(want), `seed ${seed}`)
    assert.deepEqual(idsOf(b), idsOf(want))
    assert.deepEqual(idsOf(c), idsOf(want))
    const next = rngRef()
    assert.equal(rngA(), next, '난수 소비 수가 같다')
    assert.equal(rngB(), next)
    assert.equal(rngC(), next)
  }
  // jlpt 칸이 아예 없는 후보(옛 모양)도 ceiling 이 있어도 변경 전과 같다 — levelFactor 가 단계 모르면 1
  const bare = range(40, (i) => mw(`q${String(i).padStart(2, '0')}`, undefined, { wrongCount: i % 4 }))
  for (const seed of SEEDS.slice(0, 10)) assert.deepEqual(idsOf(pickEvalMaterials(bare, recent, createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N5')), idsOf(pickBeforeCeiling(bare, recent, createRng(seed), NOW)))
})

test('#65 N5 천장 + N5 단어 소수와 N1 단어 다수인 풀 — N1 은 50번 모두 한 번도 안 뽑힌다(천장 없으면 평균 14개 가까이)', () => {
  const pool = [...range(20, (i) => mw(`a${String(i).padStart(3, '0')}`, 'N5')), ...range(300, (i) => mw(`z${String(i).padStart(3, '0')}`, 'N1'))]
  let n1 = 0
  let n1Free = 0
  for (const seed of SEEDS) {
    const picked = pickEvalMaterials(pool, new Set(), createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N5')
    assert.equal(picked.length, EVAL_MATERIALS_MAX)
    n1 += countOf(picked, 'N1')
    n1Free += countOf(pickEvalMaterials(pool, new Set(), createRng(seed), NOW), 'N1')
  }
  assert.equal(n1 / SEEDS.length, 0, `천장 N5: 15개 중 N1 평균 ${n1 / SEEDS.length}`)
  assert.ok(n1Free / SEEDS.length > 12, `대조(천장 없음): N1 평균 ${n1Free / SEEDS.length} — 이 풀이 N1 로 쏠리는 풀임을 확인`)
})

test('#65 천장은 점진적으로 줄인다(N5 천장: N5 > N4 > N3 > N2·N1) — 그리고 쉬운 단어가 모자라면 어려운 단어가 맨 마지막에 채운다', () => {
  const pool = [...range(60, (i) => mw(`a${String(i).padStart(3, '0')}`, 'N5')), ...range(60, (i) => mw(`b${String(i).padStart(3, '0')}`, 'N4')), ...range(60, (i) => mw(`c${String(i).padStart(3, '0')}`, 'N3')), ...range(60, (i) => mw(`d${String(i).padStart(3, '0')}`, 'N2'))]
  const by = { N5: 0, N4: 0, N3: 0, N2: 0 }
  for (const seed of SEEDS) for (const x of pickEvalMaterials(pool, new Set(), createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N5')) by[x.jlpt as keyof typeof by]++
  assert.ok(by.N5 > by.N4 && by.N4 > by.N3 && by.N3 >= by.N2, JSON.stringify(by))
  assert.equal(by.N2, 0, 'N2 는 천장보다 3단계 위 — 계수 0(바닥값)')
  // 쉬운 단어 5개뿐이면 재료 15개를 채우되 쉬운 단어 5개는 반드시 들어 있다(바닥값 덕에 후보가 모자랄 때만 어려운 단어로 채운다)
  const thin = [...range(5, (i) => mw(`a${i}`, 'N5')), ...range(100, (i) => mw(`z${String(i).padStart(3, '0')}`, 'N1'))]
  for (const seed of SEEDS.slice(0, 10)) {
    const picked = pickEvalMaterials(thin, new Set(), createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N5')
    assert.equal(picked.length, EVAL_MATERIALS_MAX)
    assert.equal(countOf(picked, 'N5'), 5)
  }
})

test('#65 N1 천장이면 N1 단어도 그대로 뽑힌다(같은 풀 — 평균 12개 이상)', () => {
  const pool = [...range(20, (i) => mw(`a${String(i).padStart(3, '0')}`, 'N5')), ...range(300, (i) => mw(`z${String(i).padStart(3, '0')}`, 'N1'))]
  let n1 = 0
  for (const seed of SEEDS) n1 += countOf(pickEvalMaterials(pool, new Set(), createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N1'), 'N1')
  assert.ok(n1 / SEEDS.length > 12, `천장 N1: N1 평균 ${n1 / SEEDS.length}`)
})

test('#65 jlpt 가 없는(null·칸 없음) 내 단어는 천장 아래 단어와 같은 가중 — 불이익 없음(jlpt N5 였을 때와 똑같이 뽑힌다)', () => {
  const mine = (jlpt: LevelCode | null | undefined) => range(10, (i) => mw(`m${String(i).padStart(2, '0')}`, jlpt, { wrongCount: i % 3 }))
  const others = [...range(10, (i) => mw(`n${String(i).padStart(2, '0')}`, 'N5')), ...range(100, (i) => mw(`z${String(i).padStart(3, '0')}`, 'N1'))]
  let mineSeen = 0
  for (const seed of SEEDS) {
    const asNull = pickEvalMaterials([...mine(null), ...others], new Set(), createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N5')
    const asMissing = pickEvalMaterials([...mine(undefined), ...others], new Set(), createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N5')
    const asN5 = pickEvalMaterials([...mine('N5'), ...others], new Set(), createRng(seed), NOW, EVAL_MATERIALS_MAX, 'N5')
    assert.deepEqual(idsOf(asNull), idsOf(asN5), `seed ${seed}: null = N5`)
    assert.deepEqual(idsOf(asMissing), idsOf(asN5))
    assert.equal(countOf(asNull, 'N1'), 0, '쉬운 단어 20개가 있으니 N1 은 안 뽑힌다')
    mineSeen += asNull.filter((x) => x.id.startsWith('m')).length
  }
  assert.ok(mineSeen / SEEDS.length > 6 && mineSeen / SEEDS.length < 9, `내 단어 10/20 중 15개 뽑기 → 평균 7.5 (실제 ${mineSeen / SEEDS.length})`)
})

/** loadEvaluationMaterials 가 pick 에 넘긴 인자를 엿본다. */
function spyPick() {
  const calls: { pool: EvalMaterialWord[]; max: number | undefined; ceiling: LevelCode | null | undefined }[] = []
  const pick: typeof pickEvalMaterials = (pool, recent, rng, now, max, ceiling) => (calls.push({ pool: pool.slice(), max, ceiling }), pickEvalMaterials(pool, recent, rng, now, max, ceiling))
  return { calls, pick }
}
const profileOf = (level: string, goalLevel: string | null) => {
  const log: string[] = []
  return { log, read: async (userId: string) => (log.push(userId), { level, goalLevel }) }
}
const FIVE = [w('m1'), w('m2'), base('b1', 'N5-0001'), base('b2', 'N4-0001'), base('b3', 'N1-0001')]

test('#65 loadEvaluationMaterials — 천장 = ceilingOf(평가 수준, 프로필 목표 수준): 평가 수준이 위면 평가 수준, 목표가 위면 목표, 목표 없으면 평가 수준', async () => {
  const cases: [string, string | null, LevelCode][] = [['N5', 'N3', 'N3'], ['N3', 'N5', 'N3'], ['N5', null, 'N5'], ['N4', 'N4', 'N4'], ['N5', 'N1', 'N1']]
  for (const [evalLevel, goal, want] of cases) {
    const { calls, pick } = spyPick()
    const prof = profileOf('N2', goal) // 프로필 level(N2)은 평가 수준을 직접 준 요청에서는 쓰이지 않는다
    const r = await loadEvaluationMaterials(A, { kind: 'TALK', topicId: null, level: evalLevel as 'N5' }, T(10), fakeDb(FIVE), pick, prof.read)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].ceiling, want, `평가 ${evalLevel} · 목표 ${goal}`)
    assert.equal(calls[0].max, EVAL_MATERIALS_MAX)
    assert.equal(r.level, evalLevel)
    assert.deepEqual(prof.log, [A], '프로필은 사용자 id 로 한 번만')
  }
})

test('#65 loadEvaluationMaterials — 평가 수준을 안 주면 프로필 수준을 쓰고 같은 읽기 한 번으로 천장까지(프로필 이중 호출 없음)', async () => {
  const { calls, pick } = spyPick()
  const prof = profileOf('N4', 'N2')
  const r = await loadEvaluationMaterials(A, { kind: 'TALK', topicId: null, level: null }, T(10), fakeDb(FIVE), pick, prof.read)
  assert.equal(r.level, 'N4')
  assert.equal(calls[0].ceiling, 'N2')
  assert.deepEqual(prof.log, [A])
})

test('#65 loadEvaluationMaterials — 프로필 읽기 실패: 평가 수준을 준 요청은 평가 수준만으로 천장(평가는 만든다), 안 준 요청은 전과 같이 실패', async () => {
  const boom = async () => { throw new Error('db down') }
  const { calls, pick } = spyPick()
  const r = await loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb(FIVE), pick, boom)
  assert.equal(calls[0].ceiling, 'N5')
  assert.equal(r.words.length, FIVE.length)
  await assert.rejects(loadEvaluationMaterials(A, { kind: 'TALK', topicId: null, level: null }, T(10), fakeDb(FIVE), pick, boom), /db down/)
})

test('#65 loadEvaluationMaterials — 단어가 모자란 요청은 프로필을 읽지 않는다(검사에서 끝나는 요청에 읽기를 더하지 않음) · 풀 SELECT 의 jlpt 가 pick 까지 간다', async () => {
  const prof = profileOf('N5', null)
  await assert.rejects(loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb([w('m1')]), pickEvalMaterials, prof.read), (e: unknown) => e instanceof ApiError && e.details?.reason === 'NOT_ENOUGH_WORDS')
  assert.deepEqual(prof.log, [], '단어 수 검사 전에 끝났으니 읽기 0')
  const { calls, pick } = spyPick()
  await loadEvaluationMaterials(A, EVAL_INPUT, T(10), fakeDb(FIVE), pick, PROFILE)
  const jlptOf = new Map(calls[0].pool.map((x) => [x.id, x.jlpt]))
  assert.deepEqual([jlptOf.get('b1'), jlptOf.get('b2'), jlptOf.get('b3'), jlptOf.get('m1')], ['N5', 'N4', 'N1', null], '기본 단어는 단계가 붙고 내 단어(직접 입력)는 null')
})

test('#65 end-to-end: N5 학습자(프로필 N5·목표 없음)의 평가 재료에는 N1 기본 단어가 섞이지 않는다 — 기본 단어 N5 20 + N1 300 + 내 단어 3(jlpt null)', async () => {
  const words = [
    ...Array.from({ length: 20 }, (_, i) => base(`n5-${String(i).padStart(3, '0')}`, `N5-${String(i + 1).padStart(4, '0')}`)),
    ...Array.from({ length: 300 }, (_, i) => base(`n1-${String(i).padStart(3, '0')}`, `N1-${String(i + 1).padStart(4, '0')}`)),
    w('m1'), w('m2'), w('m3'),
  ]
  let n1 = 0
  let mine = 0
  for (let s = 0; s < 30; s++) {
    const r = await loadEvaluationMaterials(A, EVAL_INPUT, T(s), fakeDb(words, []), pickEvalMaterials, PROFILE)
    assert.equal(r.words.length, EVAL_MATERIALS_MAX)
    n1 += r.words.filter((x) => x.id.startsWith('n1-')).length // id 로 센다 — jlpt 칸이 SELECT 에서 빠져도 이 단언이 헛돌지 않게
    mine += r.words.filter((x) => x.id.startsWith('m')).length
  }
  assert.equal(n1, 0, `30번 중 N1 ${n1}개`)
  assert.ok(mine > 0, '내 단어(jlpt null)는 천장 아래 후보로 그대로 들어온다')
})

test('loadActiveWordStates — 내가 보관하지 않은 상태 행만(보관한 행·남의 행 제외), 행이 없는 단어는 맵에 없다', async () => {
  const states = [
    stateRow(A, 'w1', { correctCount: 2, wrongCount: 1 }), stateRow(A, 'w2', { archived: true, wrongCount: 9 }), stateRow(B, 'w3', { wrongCount: 7 }),
  ]
  const m = await loadActiveWordStates(fakeDb([w('w1'), w('w2'), w('w3', { userId: B }), w('w4')], states), A)
  assert.deepEqual([...m.keys()], ['w1'])
  assert.deepEqual([m.get('w1')?.correctCount, m.get('w1')?.wrongCount, m.get('w1')?.archived], [2, 1, false])
  assert.equal((await loadActiveWordStates(fakeDb([], []), A)).size, 0)
})

// ── #62a 레슨 메모 「이미 단어장에 있음」 ────────────────────────────────────

test('#62a 단어장 연결: 기본 단어에 있는 표현도 IN_WORDBOOK 대상(그 기본 단어 id) · 남의 단어는 보지 않음', async () => {
  const words = [base('b-eiga', 'N5-0100', { surface: '映画' }), w('x-neko', { userId: B, surface: '猫' }), w('m-mado', { surface: '窓' })]
  const m = await wordbookMatches(A, ['映画', '猫', '窓'], fakeDb(words))
  assert.deepEqual([...m].sort(), [['映画', 'b-eiga'], ['窓', 'm-mado']])
})

test('#62a 같은 표기가 여럿이면 내 단어(먼저 만든 행) → 없으면 기본 단어 순서 첫 행(jlpt N5→N1 → seedKey) — 저장 순서와 무관', async () => {
  const words = [
    base('b-n1', 'N1-0001', { surface: '日' }), base('b-n5b', 'N5-0002', { surface: '日' }), base('b-n5x', 'N5X-0001', { surface: '日' }), base('b-n5a', 'N5-0001', { surface: '日' }),
    base('b-only', 'N4-0003', { surface: '月' }), base('b-only1', 'N1-0003', { surface: '月' }),
    w('m-new', { surface: '今日', createdAt: T(5) }), base('b-kyo', 'N5-0009', { surface: '今日' }), w('m-old', { surface: '今日', createdAt: T(1) }),
  ]
  for (const rows of [words, [...words].reverse()]) {
    const m = await wordbookMatches(A, ['日', '月', '今日'], fakeDb(rows))
    assert.deepEqual([m.get('日'), m.get('月'), m.get('今日')], ['b-n5a', 'b-only', 'm-old'])
  }
  const sorted = words.filter((x) => x.surface === '日').sort((a, b) => wordbookOrder(a as never, b as never)).map((x) => x.seedKey)
  assert.deepEqual(sorted, ['N5-0001', 'N5-0002', 'N5X-0001', 'N1-0001'], 'seedKey 글자 순만 보면 N1 이 먼저 — 단계를 먼저 본다(T17 과 같은 함정)')
})

// ── #63 복습 재료의 단어 읽기 ───────────────────────────────────────────────

test('#63 복습 재료 단어 읽기 범위: 반복 항목이 가리키는 기본 단어·내 단어는 읽고, 남의 단어·목록 밖 id 는 안 읽는다', () => {
  const words = [w('m1'), base('b1', 'N5-0001'), w('x1', { userId: B }), base('b2', 'N5-0002')]
  const where = reviewWordReadWhere(A, ['m1', 'b1', 'x1'])
  assert.deepEqual(words.filter((x) => matchWhere(x, where as Row)).map((x) => x.id), ['m1', 'b1'])
  const orphan = w('o1', { userId: null, source: 'MANUAL' })
  assert.equal(matchWhere(orphan, reviewWordReadWhere(A, ['o1']) as Row), false, '주인 없는 행이라도 SEED 가 아니면 기본 단어가 아니다')
})
