/**
 * task-053 (IMP-0028) — 오늘의 단어 단계 우선 가중. DB·엔진 0, 전부 시드 고정(결정적).
 * 계약 세 가지: ① 단계 계수 표 ② `ceiling` 을 주지 않으면 변경 전과 완전히 같다(같은 시드 → 같은 결과) ③ 후보가 모자라면 계수 0 단어로 채운다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEVEL_FACTOR_FLOOR,
  LEVEL_ORDER,
  ceilingOf,
  createRng,
  generateWordSet,
  levelFactor,
  sampleWeighted,
  shuffle,
  weightOf,
  type LevelCode,
  type SetCandidate,
} from '../vocab/setGenerator'
import { levelCeilingFor } from '../vocab/sessions'

const NOW = new Date('2026-09-27T03:00:00.000Z')
const DAY = 86_400_000
const LEVELS: readonly LevelCode[] = ['N5', 'N4', 'N3', 'N2', 'N1']

test('단계 계수 표: 천장 N5~N1 × 단어 N5~N1 전부 — d≤0 → 1 · 1 → 0.3 · 2 → 0.05 · ≥3 → 0', () => {
  const byD = (d: number) => (d <= 0 ? 1 : d === 1 ? 0.3 : d === 2 ? 0.05 : 0)
  for (let c = 0; c < 5; c++) {
    for (let w = 0; w < 5; w++) assert.equal(levelFactor(LEVELS[w], LEVELS[c]), byD(w - c), `단어 ${LEVELS[w]} / 천장 ${LEVELS[c]}`)
  }
  // 이력서 표의 값을 그대로 — 천장 N5 일 때 N5 1 · N4 0.3 · N3 0.05 · N2 0 · N1 0
  assert.deepEqual(LEVELS.map((l) => levelFactor(l, 'N5')), [1, 0.3, 0.05, 0, 0])
  assert.deepEqual(LEVELS.map((l) => levelFactor(l, 'N4')), [1, 1, 0.3, 0.05, 0])
  assert.deepEqual(LEVELS.map((l) => levelFactor(l, 'N1')), [1, 1, 1, 1, 1], '천장이 N1 이면 아무것도 줄이지 않는다')
})

test('단계 계수: 단어 단계나 천장이 없거나 모르는 값이면 1(줄이지 않는다)', () => {
  for (const c of [...LEVELS, null, undefined, '', 'N6', 'x']) {
    assert.equal(levelFactor(null, c), 1)
    assert.equal(levelFactor(undefined, c), 1)
    assert.equal(levelFactor('N6', c), 1)
  }
  for (const w of LEVELS) {
    assert.equal(levelFactor(w, null), 1)
    assert.equal(levelFactor(w, undefined), 1)
    assert.equal(levelFactor(w, 'N6'), 1)
  }
})

test('천장 = 지금 수준·목표 수준 중 어려운 쪽, 목표가 없으면 지금 수준, 알 수 없으면 undefined', () => {
  assert.deepEqual(LEVEL_ORDER, LEVELS)
  assert.equal(ceilingOf('N5', null), 'N5')
  assert.equal(ceilingOf('N5', undefined), 'N5')
  assert.equal(ceilingOf('N5', 'N3'), 'N3', '목표가 더 어려우면 목표')
  assert.equal(ceilingOf('N3', 'N5'), 'N3', '목표가 더 쉬워도 지금 수준 아래로 내리지 않는다')
  assert.equal(ceilingOf('N2', 'N2'), 'N2')
  assert.equal(ceilingOf('N4', 'N1'), 'N1')
  assert.equal(ceilingOf('N1', 'N5'), 'N1')
  assert.equal(ceilingOf('??', 'N4'), 'N4', '모르는 값은 건너뛴다')
  assert.equal(ceilingOf('??', null), undefined)
  assert.equal(ceilingOf(null, undefined), undefined)
})

// ── 호환: ceiling 을 안 주면 변경 전과 같다 ───────────────────────────────────

function words(n: number, over: (i: number) => Partial<SetCandidate> = () => ({})): SetCandidate[] {
  return Array.from({ length: n }, (_, i) => ({ id: `w${String(i).padStart(3, '0')}`, correctCount: 0, wrongCount: 0, lastSeenAt: null, ...over(i) }))
}

/** 변경 전 `generateWordSet`(HEAD 9b1675b) 본문 그대로 — 호환 시험의 기준. */
function legacyGenerateWordSet<T extends SetCandidate>(pool: readonly T[], count: number, rng: () => number, now: Date): T[] {
  const sorted = pool.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const picked = sampleWeighted(sorted, sorted.map((c) => weightOf(c, now)), Math.min(count, sorted.length), rng)
  return shuffle(picked, rng)
}

const variedPool = (withLevel: boolean) =>
  words(40, (i) => ({
    correctCount: i % 3,
    wrongCount: i % 5,
    lastSeenAt: i % 4 ? new Date(NOW.getTime() - i * DAY) : null,
    ...(withLevel ? { jlpt: LEVELS[i % 5] } : {}),
  }))

test('호환(고정 기대값): 변경 전 구현이 만든 세트 — ceiling 없이 호출하면 그대로 나온다', () => {
  const pool = variedPool(false)
  assert.deepEqual(generateWordSet(pool, 10, createRng('Cgolden-1'), NOW).map((w) => w.id), ['w014', 'w032', 'w013', 'w034', 'w028', 'w033', 'w011', 'w002', 'w008', 'w023'])
  assert.deepEqual(generateWordSet(pool, 10, createRng('Fgolden-2'), NOW).map((w) => w.id), ['w013', 'w022', 'w018', 'w009', 'w038', 'w016', 'w012', 'w001', 'w034', 'w008'])
})

test('호환: ceiling 없음(생략·null·undefined)은 단계가 붙은 후보여도 변경 전과 같다 — 난수 소비 순서까지(60 시드)', () => {
  const pool = variedPool(true)
  for (let s = 0; s < 60; s++) {
    const seed = `Ccompat${s}`
    const legacy = legacyGenerateWordSet(pool, 10, createRng(seed), NOW).map((w) => w.id)
    assert.deepEqual(generateWordSet(pool, 10, createRng(seed), NOW).map((w) => w.id), legacy, `생략 ${seed}`)
    assert.deepEqual(generateWordSet(pool, 10, createRng(seed), NOW, null).map((w) => w.id), legacy, `null ${seed}`)
    assert.deepEqual(generateWordSet(pool, 10, createRng(seed), NOW, undefined).map((w) => w.id), legacy, `undefined ${seed}`)
  }
})

test('단계가 없는 후보는 ceiling 을 줘도 가중이 변하지 않는다 — 결과가 변경 전과 같다(60 시드)', () => {
  const pool = [...variedPool(false), ...words(10, (i) => ({ id: `x${i}`, jlpt: null, wrongCount: i % 4 }))]
  for (const ceiling of LEVELS) {
    for (let s = 0; s < 20; s++) {
      const seed = `Fnolevel${ceiling}${s}`
      assert.deepEqual(
        generateWordSet(pool, 10, createRng(seed), NOW, ceiling).map((w) => w.id),
        legacyGenerateWordSet(pool, 10, createRng(seed), NOW).map((w) => w.id),
        `${ceiling} ${seed}`,
      )
    }
  }
})

test('후보 입력 순서와 무관하게 같은 시드 → 같은 세트(ceiling 이 있어도)', () => {
  const pool = variedPool(true)
  for (let s = 0; s < 20; s++) {
    const seed = `Corder${s}`
    assert.deepEqual(
      generateWordSet(pool, 10, createRng(seed), NOW, 'N4').map((w) => w.id),
      generateWordSet(pool.slice().reverse(), 10, createRng(seed), NOW, 'N4').map((w) => w.id),
    )
  }
})

test('단계 계수는 기존 가중(오답·최근성)에 곱해진다 — 천장 이하 단어끼리는 순서가 그대로', () => {
  // 천장 N3: N5·N4·N3 단어만 있는 풀은 계수가 전부 1 → ceiling 유무와 결과가 같다.
  const pool = words(40, (i) => ({ jlpt: LEVELS[i % 3], wrongCount: i % 5, correctCount: i % 2, lastSeenAt: i % 3 ? new Date(NOW.getTime() - i * DAY) : null }))
  for (let s = 0; s < 20; s++) {
    const seed = `Cbelow${s}`
    assert.deepEqual(generateWordSet(pool, 10, createRng(seed), NOW, 'N3').map((w) => w.id), legacyGenerateWordSet(pool, 10, createRng(seed), NOW).map((w) => w.id))
  }
})

// ── 분포: 실제 보유 개수를 닮은 합성 풀 ────────────────────────────────────────

const COUNTS: Record<LevelCode, number> = { N5: 676, N4: 629, N3: 1649, N2: 1767, N1: 3034 }
const TOTAL = LEVELS.reduce((n, l) => n + COUNTS[l], 0)
const SYNTH: SetCandidate[] = LEVELS.flatMap((l) => Array.from({ length: COUNTS[l] }, (_, i) => ({ id: `${l}-${String(i).padStart(4, '0')}`, jlpt: l, correctCount: 0, wrongCount: 0, lastSeenAt: null })))
const SETS = 250
const CARDS = 10

/** 시드 고정 `SETS`세트 × `CARDS`장에서 단계별 장수. */
function tally(ceiling: LevelCode | undefined, tag: string): Record<LevelCode, number> {
  const out: Record<LevelCode, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 }
  for (let i = 0; i < SETS; i++) {
    for (const w of generateWordSet(SYNTH, CARDS, createRng(`C${tag}${i}`), NOW, ceiling)) out[w.jlpt as LevelCode]++
  }
  return out
}
const shares = (t: Record<LevelCode, number>): Record<LevelCode, number> => {
  const sum = LEVELS.reduce((n, l) => n + t[l], 0)
  return Object.fromEntries(LEVELS.map((l) => [l, t[l] / sum])) as Record<LevelCode, number>
}
/** 계수 표대로의 이론 비중. */
const theory = (ceiling: LevelCode | undefined): Record<LevelCode, number> => {
  const w = LEVELS.map((l) => COUNTS[l] * (ceiling ? levelFactor(l, ceiling) : 1))
  const sum = w.reduce((a, b) => a + b, 0)
  return Object.fromEntries(LEVELS.map((l, i) => [l, w[i] / sum])) as Record<LevelCode, number>
}
const TOL = 0.04 // 2,500장 표본 오차(≈4σ)에 여유

function assertNear(actual: Record<LevelCode, number>, expected: Record<LevelCode, number>, label: string): void {
  for (const l of LEVELS) assert.ok(Math.abs(actual[l] - expected[l]) <= TOL, `${label} ${l}: 실제 ${(actual[l] * 100).toFixed(1)}% / 이론 ${(expected[l] * 100).toFixed(1)}%`)
}

test('합성 풀 개수(이력서 실측)와 이론 비중 표 — 천장 N5 → 71.4/19.9/8.7/0/0, 천장 N4 → 35.8/33.3/26.2/4.7/0', () => {
  assert.equal(TOTAL, 7755)
  const pct = (c: LevelCode) => LEVELS.map((l) => Math.round(theory(c)[l] * 1000) / 10)
  assert.deepEqual(pct('N5'), [71.4, 19.9, 8.7, 0, 0])
  assert.deepEqual(pct('N4'), [35.8, 33.3, 26.2, 4.7, 0])
  assert.deepEqual(LEVELS.map((l) => Math.round(theory(undefined)[l] * 1000) / 10), [8.7, 8.1, 21.3, 22.8, 39.1], '천장 없음 = 풀 비중')
})

test('분포: 천장 N5 — N5 가 대부분, N4·N3 소량, N2·N1 은 사실상 0 (이론값 근처)', () => {
  const t = tally('N5', 'dist-n5')
  const s = shares(t)
  assertNear(s, theory('N5'), '천장 N5')
  assert.equal(t.N2 + t.N1, 0, `천장보다 3단계 이상 위(N2·N1)는 후보가 충분하면 나오지 않는다: ${t.N2 + t.N1}장`)
  assert.ok(s.N5 > 0.6 && s.N5 > s.N4 && s.N4 > s.N3, 'N5 > N4 > N3 순서')
})

test('분포: 천장 N4 — N5·N4 가 비슷하고 N3 가 그다음, N2 소량, N1 은 0', () => {
  const t = tally('N4', 'dist-n4')
  const s = shares(t)
  assertNear(s, theory('N4'), '천장 N4')
  assert.ok(Math.abs(s.N5 - s.N4) < 0.06, `N5(${(s.N5 * 100).toFixed(1)}%)와 N4(${(s.N4 * 100).toFixed(1)}%)가 비슷`)
  assert.ok(s.N4 > s.N2 && s.N3 > s.N2, '천장 위 단계가 천장 이하보다 적다')
  assert.equal(t.N1, 0, 'N1(천장보다 3단계 위)은 나오지 않는다')
})

test('분포: 천장 N1(최상급) — 아무것도 줄이지 않아 풀 비중과 같다', () => {
  assertNear(shares(tally('N1', 'dist-n1')), theory(undefined), '천장 N1')
})

test('분포: 천장 없음 — 풀 비중과 같다(N1 39%·N2 23%·N3 21%·N4 8%·N5 9%)', () => {
  const s = shares(tally(undefined, 'dist-none'))
  assertNear(s, theory(undefined), '천장 없음')
  assert.ok(s.N1 > 0.3, `N1 ${(s.N1 * 100).toFixed(1)}%`)
})

test('분포 비교: 같은 시드에서 천장 N5 가 천장 없음보다 N1+N2 비중을 크게 줄인다', () => {
  const hard = (t: Record<LevelCode, number>) => (t.N1 + t.N2) / (CARDS * SETS)
  const before = hard(tally(undefined, 'dist-cmp'))
  const after = hard(tally('N5', 'dist-cmp'))
  assert.ok(before > 0.5, `변경 전 N1+N2 ${(before * 100).toFixed(1)}%`)
  assert.ok(after < 0.01, `천장 N5 N1+N2 ${(after * 100).toFixed(1)}%`)
})

test('분포: 오답·최근성 가중은 그대로 곱해진다 — 같은 단계 안에서는 오답 단어가 더 자주 뽑힌다', () => {
  const pool = LEVELS.flatMap((l) => Array.from({ length: 30 }, (_, i): SetCandidate => ({ id: `${l}-${String(i).padStart(2, '0')}`, jlpt: l, correctCount: 0, wrongCount: i < 3 ? 4 : 0, lastSeenAt: new Date(NOW.getTime() - 5 * DAY) })))
  let wrongPicked = 0
  let total = 0
  for (let i = 0; i < 200; i++) {
    for (const w of generateWordSet(pool, 10, createRng(`Cwrong${i}`), NOW, 'N4')) {
      if (w.jlpt === 'N5' || w.jlpt === 'N4') {
        total++
        if (w.wrongCount > 0) wrongPicked++
      }
    }
  }
  // 오답 3개(가중 8 — 상한) vs 나머지 27개(가중 1): 풀 비중 10% 인데 뽑힘 비중은 훨씬 높아야 한다.
  assert.ok(wrongPicked / total > 0.3, `오답 단어 비중 ${((wrongPicked / total) * 100).toFixed(1)}%`)
})

// ── 채움: 후보가 모자라면 계수 0 단어가 마지막에 채운다 ─────────────────────────

test('채움: 전부 천장보다 3단계 이상 높아도 min(count, 풀) 장이 나온다', () => {
  const hard = words(12, (i) => ({ jlpt: i % 2 ? 'N1' : 'N2' }))
  const ten = generateWordSet(hard, 10, createRng('Cfill1'), NOW, 'N5')
  assert.equal(ten.length, 10)
  assert.equal(new Set(ten.map((w) => w.id)).size, 10, '비복원')
  assert.equal(generateWordSet(hard, 20, createRng('Cfill2'), NOW, 'N5').length, 12, 'count > 풀 → 풀 전체')
  assert.equal(generateWordSet(hard.slice(0, 3), 10, createRng('Cfill3'), NOW, 'N5').length, 3)
  assert.deepEqual(generateWordSet(hard, 10, createRng('Cfill1'), NOW, 'N5').map((w) => w.id), ten.map((w) => w.id), '채워진 세트도 같은 시드 → 같은 결과')
})

test('채움: 천장 이하·근처 후보는 모두 먼저 들어가고 모자란 만큼만 계수 0 단어가 채운다', () => {
  // N5 3개(계수 1) + N4 2개(0.3) + N3 2개(0.05) + 계수 0 인 N2·N1 20개, count 10 → 앞의 7개는 전부 들어간다.
  const pool: SetCandidate[] = [
    ...words(3, (i) => ({ id: `a${i}`, jlpt: 'N5' as const })),
    ...words(2, (i) => ({ id: `b${i}`, jlpt: 'N4' as const })),
    ...words(2, (i) => ({ id: `c${i}`, jlpt: 'N3' as const })),
    ...words(20, (i) => ({ id: `z${String(i).padStart(2, '0')}`, jlpt: (i % 2 ? 'N1' : 'N2') as LevelCode })),
  ]
  for (let s = 0; s < 30; s++) {
    const ids = generateWordSet(pool, 10, createRng(`Cfill-mix${s}`), NOW, 'N5').map((w) => w.id)
    assert.equal(ids.length, 10)
    for (const want of ['a0', 'a1', 'a2', 'b0', 'b1', 'c0', 'c1']) assert.ok(ids.includes(want), `${want} 포함 (시드 ${s})`)
    assert.equal(ids.filter((id) => id.startsWith('z')).length, 3, '모자란 3장만 계수 0 단어')
  }
})

test('채움: 계수 0 단어끼리는 시드마다 다르게 뽑힌다 — 바닥 가중이 없으면 키가 −∞ 로 뭉쳐 항상 앞쪽 id 만 나온다', () => {
  const hard = words(30, () => ({ jlpt: 'N1' as const }))
  const seen = new Set<string>()
  const lists = new Set<string>()
  for (let s = 0; s < 40; s++) {
    const ids = generateWordSet(hard, 5, createRng(`Cfill-rand${s}`), NOW, 'N5').map((w) => w.id)
    assert.equal(new Set(ids).size, 5)
    ids.forEach((id) => seen.add(id))
    lists.add(ids.slice().sort().join())
  }
  assert.ok(seen.size >= 20, `40세트에서 서로 다른 단어 ${seen.size}개(30개 중)`)
  assert.ok(lists.size >= 30, `서로 다른 조합 ${lists.size}개`)
})

test('채움: 후보가 충분하면 계수 0 단어는 나오지 않는다(바닥 가중 1e-9)', () => {
  assert.equal(LEVEL_FACTOR_FLOOR, 1e-9)
  const pool: SetCandidate[] = [...words(40, (i) => ({ id: `e${String(i).padStart(2, '0')}`, jlpt: 'N5' as const })), ...words(40, (i) => ({ id: `h${String(i).padStart(2, '0')}`, jlpt: 'N1' as const }))]
  for (let s = 0; s < 100; s++) {
    const ids = generateWordSet(pool, 10, createRng(`Fenough${s}`), NOW, 'N5').map((w) => w.id)
    assert.ok(ids.every((id) => id.startsWith('e')), `시드 ${s}: ${ids.join(',')}`)
  }
})

test('채움: 단계가 없는 후보(계수 1)는 천장보다 높은 단계 후보보다 항상 먼저 뽑힌다', () => {
  const pool: SetCandidate[] = [...words(8, (i) => ({ id: `n${i}`, jlpt: null })), ...words(20, (i) => ({ id: `h${String(i).padStart(2, '0')}`, jlpt: 'N1' as const }))]
  for (let s = 0; s < 30; s++) {
    const ids = generateWordSet(pool, 10, createRng(`Fnull${s}`), NOW, 'N5').map((w) => w.id)
    assert.equal(ids.filter((id) => id.startsWith('n')).length, 8)
    assert.equal(ids.length, 10)
  }
})

// ── 프로필 → 천장 ─────────────────────────────────────────────────────────────

test('levelCeilingFor: (진행 중 챌린지 없음) 프로필의 지금·목표 수준 중 어려운 쪽 / 읽기 실패·이상한 값은 undefined(가중 없이 진행)', async () => {
  // task-076: 챌린지 조회는 가짜(없음) — 챌린지가 있을 때의 기준은 task076.test.ts.
  const noChallenge = async () => null
  const seen: string[] = []
  const reader = (level: string, goalLevel: string | null) => async (userId: string) => {
    seen.push(userId)
    return { level, goalLevel }
  }
  assert.equal(await levelCeilingFor('u1', reader('N5', null), noChallenge), 'N5')
  assert.equal(await levelCeilingFor('u1', reader('N5', 'N3'), noChallenge), 'N3')
  assert.equal(await levelCeilingFor('u1', reader('N3', 'N5'), noChallenge), 'N3')
  assert.equal(await levelCeilingFor('u1', reader('N1', 'N1'), noChallenge), 'N1')
  assert.deepEqual(seen, ['u1', 'u1', 'u1', 'u1'], '사용자 id 로 읽는다')
  assert.equal(await levelCeilingFor('u1', async () => { throw new Error('db down') }, noChallenge), undefined)
  assert.equal(await levelCeilingFor('u1', () => Promise.reject(new Error('timeout')), noChallenge), undefined)
  assert.equal(await levelCeilingFor('u1', reader('??', null), noChallenge), undefined)
})
