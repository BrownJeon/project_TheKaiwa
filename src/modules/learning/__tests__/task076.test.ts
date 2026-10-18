/**
 * task-076(IMP-0051) — 챌린지 난이도(#156 `level`)와 생성 기준 수준 T. 오프라인(메모리 DB·가짜 읽기) — 공유 DB 를 읽지 않는다.
 *
 * 정답은 승인 데모 v2 「수준 결정표」 9줄(`docs/demo/task-076-challenge-level-v2.html#rules`)을 **손으로 옮긴 표**다 — 구현 식을 되풀이하지 않는다.
 * 소비처: ① 오늘의 회화 주제 수업 재료(`loadTopicLessonMaterials`) ② #58 추천 새 칸(`lessonLevel`·`levelSource`, `level` 은 주제 난이도 그대로)
 *        ③ 챌린지 주제 세트 「새 단어」 수준(`topicWordsLevel` → `runTopicWords` 의 A12 `[수준]`·검사 ⑤) ④ 내 단어장 세트 가중 기준(`levelCeilingFor`, D6 A).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { JlptLevel } from '@prisma/client'
import { ApiError, type Tx } from '@/modules/infra'
import { createChallenge, endChallenge, parseCreateChallengeBody } from '../challenges'
import type { LessonRecommendation } from '../lessons'
import { loadScenarioLessonMaterials, loadTopicLessonMaterials, type ScenarioLessonDeps, type TopicLessonDeps } from '../lessons/generate'
import { attachLessonLevel, recommendWithLessonLevel } from '../lessons/today'
import { getInProgressChallengeLevel, readTargetLevel, resolveTargetLevel, type TargetLevelProfile } from '../targetLevel'
import { levelCeilingFor, mineSetCeiling, topicWordsLevel } from '../vocab/sessions'
import { runTopicWords, type TopicWordsDriver, type TopicWordsOutput } from '../vocab/topicSet'
import { fakeDb, kst, type FakeDb } from './challengeFakeDb'

const U = 'cuser0000000000000000000u1'
const T_CH = 'ctopicchal000000000000001' // 챌린지 주제(N4)
const T_OTHER = 'ctopicother00000000000002' // 다른 주제(N5)

type Lv = JlptLevel
interface Row {
  n: number
  what: string
  /** 진행 중 챌린지 난이도(만들기 본문 `level`) — undefined = 챌린지 없음, null = 고르지 않음(주제 난이도 N4) */
  challenge?: Lv | null
  profile: { level: Lv; goalLevel: Lv | null } | 'FAIL'
  /** 기대값(데모 결정표 「바뀐 뒤」 손으로 옮김) */
  t: { level: Lv; source: 'CHALLENGE' | 'GOAL' | 'LEVEL' } | null
  /** 오늘의 회화 주제 수업 수준 — 행 9 는 null = 주제 수준 그대로 */
  lesson: Lv | null
  /** 챌린지 주제 세트 새 단어 수준(챌린지 있을 때만) */
  newWord: Lv | null
  /** 내 단어장 세트 가중 기준 */
  ceiling: Lv | undefined
}

const TABLE: Row[] = [
  { n: 1, what: '챌린지를 주제보다 어렵게', challenge: 'N3', profile: { level: 'N4', goalLevel: 'N3' }, t: { level: 'N3', source: 'CHALLENGE' }, lesson: 'N3', newWord: 'N3', ceiling: 'N3' },
  { n: 2, what: '챌린지를 주제보다 쉽게', challenge: 'N5', profile: { level: 'N4', goalLevel: 'N3' }, t: { level: 'N5', source: 'CHALLENGE' }, lesson: 'N5', newWord: 'N5', ceiling: 'N5' },
  { n: 3, what: '챌린지를 내 수준보다 2단계 위로', challenge: 'N2', profile: { level: 'N4', goalLevel: null }, t: { level: 'N2', source: 'CHALLENGE' }, lesson: 'N2', newWord: 'N2', ceiling: 'N2' },
  { n: 4, what: '이미 진행 중인 챌린지(난이도 = 주제)', challenge: null, profile: { level: 'N4', goalLevel: 'N3' }, t: { level: 'N4', source: 'CHALLENGE' }, lesson: 'N4', newWord: 'N4', ceiling: 'N4' },
  { n: 5, what: '챌린지 없음 · 목표 있음', profile: { level: 'N4', goalLevel: 'N3' }, t: { level: 'N3', source: 'GOAL' }, lesson: 'N3', newWord: null, ceiling: 'N3' },
  { n: 6, what: '챌린지 없음 · 목표 없음(D5)', profile: { level: 'N4', goalLevel: null }, t: { level: 'N4', source: 'LEVEL' }, lesson: 'N4', newWord: null, ceiling: 'N4' },
  { n: 7, what: '목표가 지금보다 3단계 위', profile: { level: 'N5', goalLevel: 'N2' }, t: { level: 'N2', source: 'GOAL' }, lesson: 'N2', newWord: null, ceiling: 'N2' },
  { n: 8, what: '목표가 지금보다 쉬움', profile: { level: 'N3', goalLevel: 'N4' }, t: { level: 'N4', source: 'GOAL' }, lesson: 'N4', newWord: null, ceiling: 'N3' },
  { n: 9, what: '프로필을 못 읽음', profile: 'FAIL', t: null, lesson: null, newWord: null, ceiling: undefined },
]

/** 행의 세계 — 주제 2개(챌린지 주제 N4·다른 주제 N5), 행에 챌린지가 있으면 #156 으로 만든다(본문 `level` 은 행 값). */
async function world(row: Pick<Row, 'challenge'>, at = '2026-10-06 09:00'): Promise<FakeDb> {
  const f = fakeDb()
  f.clock.now = kst(at)
  f.tables.conversationTopic.push({ id: T_CH, userId: null, title: '카페 주문', level: 'N4' }, { id: T_OTHER, userId: null, title: '길 묻기', level: 'N5' })
  if (row.challenge !== undefined) {
    const level = row.challenge === null ? {} : { level: row.challenge }
    await createChallenge(U, parseCreateChallengeBody({ topicId: T_CH, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false }, ...level }), f.deps())
  }
  return f
}

const profileReader = (row: Pick<Row, 'profile'>) => async (): Promise<{ level: string; goalLevel: string | null } & TargetLevelProfile> => {
  if (row.profile === 'FAIL') throw Object.assign(new Error('db down'), { name: 'FakeProfileError' })
  return row.profile
}

/** console.error 를 잠시 모은다(로그에 비밀·본문이 없는지 볼 때도 쓴다). */
async function quiet<T>(fn: () => Promise<T>): Promise<{ v: T; logs: unknown[][] }> {
  const logs: unknown[][] = []
  const orig = console.error
  console.error = (...a: unknown[]) => void logs.push(a)
  try {
    return { v: await fn(), logs }
  } finally {
    console.error = orig
  }
}

// ── 규칙 ────────────────────────────────────────────────────────────────────

test('resolveTargetLevel — 결정표 9줄(손으로 적은 정답) · 챌린지 > 목표 > 지금 수준 · 알 수 없으면 null', () => {
  // 행 4 는 만들 때 주제 난이도(N4)를 얼린 값이 챌린지 난이도다.
  const challengeOf = (r: Row): Lv | null => (r.challenge === undefined ? null : (r.challenge ?? 'N4'))
  for (const r of TABLE) {
    assert.deepEqual(resolveTargetLevel(challengeOf(r), r.profile === 'FAIL' ? null : r.profile), r.t, `${r.n}번 줄 ${r.what}`)
  }
  assert.deepEqual(resolveTargetLevel('N1', null), { level: 'N1', source: 'CHALLENGE' }, '챌린지가 있으면 프로필이 없어도')
  assert.deepEqual(resolveTargetLevel(null, { level: 'N5', goalLevel: undefined }), { level: 'N5', source: 'LEVEL' })
  assert.deepEqual(resolveTargetLevel('n3', { level: 'N5', goalLevel: 'X' }), { level: 'N5', source: 'LEVEL' }, '이상한 값은 없는 것으로')
  assert.equal(resolveTargetLevel(undefined, { level: '??', goalLevel: null }), null)
})

// ── #156 만들기 `level` ─────────────────────────────────────────────────────

const base = { topicId: T_CH, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } }

test('#156 본문 level — N5~N1 그대로 · 생략/null = null(주제 난이도) · 그 밖 400 VALIDATION(field level) · 모르는 키 400 은 그대로', () => {
  for (const l of ['N5', 'N4', 'N3', 'N2', 'N1'] as const) assert.equal(parseCreateChallengeBody({ ...base, level: l }).level, l)
  assert.equal(parseCreateChallengeBody({ ...base }).level, null)
  assert.equal(parseCreateChallengeBody({ ...base, level: null }).level, null)
  for (const bad of ['N6', 'n3', 'N 3', '', 'JLPT N3', 3, true, ['N3'], { level: 'N3' }]) {
    assert.throws(
      () => parseCreateChallengeBody({ ...base, level: bad }),
      (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && e.details?.field === 'level' && e.details?.reason === 'N5|N4|N3|N2|N1',
      JSON.stringify(bad),
    )
  }
  assert.throws(
    () => parseCreateChallengeBody({ ...base, level: 'N3', goalLevel: 'N3' }),
    (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && e.details?.reason === 'unknown_key' && e.details?.field === 'goalLevel',
  )
})

test('#156 만들기 — 고른 난이도가 Challenge.level·응답 level 로 저장된다 · 고르지 않으면 주제 난이도(지금 동작)', async () => {
  const picked = await world({ challenge: 'N2' })
  assert.equal(picked.tables.challenge[0].level, 'N2')
  const kept = await world({ challenge: null })
  assert.equal(kept.tables.challenge[0].level, 'N4', '주제 난이도')
  const f = await world({ challenge: undefined })
  const d = await createChallenge(U, parseCreateChallengeBody({ ...base, level: 'N5' }), f.deps())
  assert.equal(d.level, 'N5', '#156 응답(#157 상세 모양)의 level')
})

// ── 진행 중 판정 ─────────────────────────────────────────────────────────────

test('getInProgressChallengeLevel — 진행 중(시작 전 포함)만 · 그만둔 것·기간 지난 것·없음은 null · 읽기만', async () => {
  const f = await world({ challenge: undefined })
  const now = () => f.clock.now
  assert.equal(await getInProgressChallengeLevel(f.db, U, now()), null)
  const c = await createChallenge(U, parseCreateChallengeBody({ ...base, start: 'TOMORROW', level: 'N3' }), f.deps())
  assert.deepEqual(await getInProgressChallengeLevel(f.db, U, now()), { challengeId: c.id, topicId: T_CH, level: 'N3' }, '내일 시작도 진행 중(isChallengeInProgress)')
  f.clock.now = kst('2026-10-20 09:00') // 마지막 날(10/13) 지남 — 정산 전이어도 진행 중이 아니다
  assert.equal(await getInProgressChallengeLevel(f.db, U, now()), null)
  f.clock.now = kst('2026-10-06 09:00')
  await endChallenge(U, c.id, f.deps())
  assert.equal(await getInProgressChallengeLevel(f.db, U, now()), null)
  f.log.length = 0
  await getInProgressChallengeLevel(f.db, U, now())
  assert.deepEqual(f.log.filter((l) => !l.endsWith('.findFirst')), [], '읽기만')
})

// ── 소비처 ① 오늘의 회화 주제 수업 ──────────────────────────────────────────

function topicDeps(f: FakeDb, row: Pick<Row, 'profile'>): TopicLessonDeps {
  return {
    topic: async (_u, id) => {
      const t = f.tables.conversationTopic.find((x) => x.id === id)
      return t ? { id: t.id as string, title: t.title as string, titleJa: null, level: t.level as Lv, chunks: [] } : null
    },
    visible: async () => true,
    challengeTopicId: async () => null,
    history: async () => ({ previousTitles: [], previousNextPreview: null }),
    targetLevel: (u) => readTargetLevel(u, { db: f.db, now: () => f.clock.now, profile: profileReader(row) }),
  }
}

test('오늘의 회화 주제 수업 수준(L7) — 결정표 9줄: 챌린지 주제·다른 주제 모두 T · 프로필을 못 읽으면 주제 수준(수업은 만들어짐)', async () => {
  for (const r of TABLE) {
    const f = await world(r)
    for (const topicId of [T_CH, T_OTHER]) {
      const topicLevel = topicId === T_CH ? 'N4' : 'N5'
      const { v: m } = await quiet(() => loadTopicLessonMaterials(U, { kind: 'topic', topicId }, topicDeps(f, r)))
      assert.equal(m.level, r.lesson ?? topicLevel, `${r.n}번 줄 ${r.what} — ${topicId === T_CH ? '챌린지 주제' : '다른 주제'}`)
      assert.equal(m.topic?.level, topicLevel, '주제 재료의 수준은 그대로(Lesson.level·A4 는 m.level)')
    }
  }
})

test('오늘의 회화 — 챌린지 조회가 실패하면 기준을 확정하지 않고 주제 수준 · 로그는 오류 이름만', async () => {
  const f = await world({ challenge: 'N2' })
  const err = Object.assign(new Error('비밀이 섞일 수 있는 메시지'), { name: 'FakeQueryError' })
  const brokenDb = { challenge: { findFirst: async () => Promise.reject(err) } } as unknown as Tx
  const deps = { ...topicDeps(f, { profile: { level: 'N4', goalLevel: 'N3' } }), targetLevel: (u: string) => readTargetLevel(u, { db: brokenDb, now: () => f.clock.now, profile: async () => ({ level: 'N4', goalLevel: 'N3' }) }) }
  const { v: m, logs } = await quiet(() => loadTopicLessonMaterials(U, { kind: 'topic', topicId: T_CH }, deps))
  assert.equal(m.level, 'N4')
  assert.deepEqual(logs, [['[learning] 기준 수준 계산 실패:', 'FakeQueryError']])
})

test('상황 수업(L7)은 T 를 쓰지 않는다 — 대표 주제 수준 그대로(진행 중 챌린지 N2 가 있어도)', async () => {
  const f = await world({ challenge: 'N2' })
  const sDeps: ScenarioLessonDeps = {
    start: async () => ({ scenario: { id: 'scn1' }, topic: { id: T_CH } }) as unknown as Awaited<ReturnType<ScenarioLessonDeps['start']>>,
    material: async () => ({ id: 'scn1', title: '카페', titleJa: null, level: 'N5' }) as unknown as Awaited<ReturnType<ScenarioLessonDeps['material']>>,
    topic: topicDeps(f, { profile: { level: 'N4', goalLevel: null } }).topic,
    history: async () => ({ previousTitles: [], previousNextPreview: null }),
  }
  const m = await loadScenarioLessonMaterials(U, { kind: 'scenario', scenarioId: 'scn1', topicId: null }, sDeps)
  assert.equal(m.level, 'N4')
})

// ── 소비처 ② #58 추천 새 칸 ─────────────────────────────────────────────────

const HISTORY: LessonRecommendation = { topicId: T_OTHER, topicTitle: '길 묻기', level: 'N5', reason: 'CONTINUE', nextPreview: null }

test('#58 추천 — lessonLevel·levelSource = T(결정표 1~8줄) · level 은 주제 난이도 그대로(L8) · 추천 주제·reason 불변', async () => {
  for (const r of TABLE.filter((x) => x.profile !== 'FAIL')) {
    const f = await world(r)
    const p = r.profile as { level: Lv; goalLevel: Lv | null }
    const rec = await recommendWithLessonLevel(U, p, { db: f.db, challenge: f.deps(), byHistory: async () => HISTORY })
    const t = r.t as NonNullable<Row['t']>
    if (r.challenge !== undefined) {
      // 챌린지 주제 최우선 — level = 주제 난이도(N4), 수업은 챌린지 난이도
      assert.deepEqual(rec, { topicId: T_CH, topicTitle: '카페 주문', level: 'N4', reason: 'CHALLENGE', nextPreview: null, lessonLevel: t.level, levelSource: 'CHALLENGE' }, `${r.n}번 줄`)
    } else {
      assert.deepEqual(rec, { ...HISTORY, lessonLevel: t.level, levelSource: t.source }, `${r.n}번 줄`)
    }
  }
})

test('#58 추천 — 기준을 확정 못 하면(챌린지 조회 실패) lessonLevel·levelSource null · 추천이 null 이면 null · attachLessonLevel 은 추천을 바꾸지 않는다', async () => {
  const f = await world({ challenge: undefined })
  const brokenDb = { ...(f.db as unknown as Record<string, unknown>), challenge: { findFirst: async () => Promise.reject(new Error('x')) } } as unknown as Tx
  const { v: rec } = await quiet(() => recommendWithLessonLevel(U, { level: 'N4', goalLevel: 'N3' }, { db: f.db, challenge: f.deps({ db: brokenDb }), byHistory: async () => HISTORY }))
  assert.deepEqual(rec, { ...HISTORY, lessonLevel: null, levelSource: null })
  assert.equal(await recommendWithLessonLevel(U, { level: 'N4', goalLevel: null }, { db: f.db, challenge: f.deps(), byHistory: async () => null }), null)
  assert.equal(attachLessonLevel(null, { level: 'N3', source: 'GOAL' }), null)
  const out = attachLessonLevel(HISTORY, { level: 'N1', source: 'GOAL' })
  assert.deepEqual(HISTORY, { topicId: T_OTHER, topicTitle: '길 묻기', level: 'N5', reason: 'CONTINUE', nextPreview: null }, '원본 불변')
  assert.equal(out?.level, 'N5')
})

// ── 소비처 ③ 챌린지 주제 「새 단어」 ─────────────────────────────────────────

test('챌린지 주제 새 단어 수준(D4 A) — 결정표: 진행 중 챌린지의 주제 세트만 챌린지 난이도 · 다른 주제·챌린지 없음은 주제 수준', async () => {
  for (const r of TABLE) {
    const f = await world(r)
    const ch = await getInProgressChallengeLevel(f.db, U, f.clock.now)
    assert.equal(topicWordsLevel({ id: T_CH, level: 'N4' }, ch), r.newWord ?? 'N4', `${r.n}번 줄 — 챌린지 주제 세트`)
    assert.equal(topicWordsLevel({ id: T_OTHER, level: 'N5' }, ch), 'N5', `${r.n}번 줄 — 다른 주제 세트는 지금 그대로`)
  }
})

test('runTopicWords — level 을 주면 A12 [수준](build topic.level)과 검사 ⑤(assemble level)에 같은 값 · 생략하면 주제 수준 · 그 밖 입력 불변', async () => {
  const material = { topic: { id: T_CH, title: '카페 주문', titleJa: null, description: null, level: 'N4' as const }, chunkTexts: ['コーヒー'], chunkMeanings: ['커피'] }
  const seen: { build: string[]; assemble: string[]; titles: string[] } = { build: [], assemble: [], titles: [] }
  const driver: TopicWordsDriver = {
    promptVersion: 'topicWords@test',
    build: (input) => (seen.build.push(input.topic.level), seen.titles.push(input.topic.title), { task: 'topicWords', system: 's', messages: [{ role: 'user', content: 'u' }], jsonSchema: { type: 'object' } }),
    assemble: (_raw, ctx) => (seen.assemble.push(ctx.level), { words: [{ textJa: '紅茶', reading: 'こうちゃ', meaningKo: '홍차', chunkType: 'NAME', jlpt: null, exampleJa: null, exampleKo: null }], received: 1 }),
  }
  const deps = { complete: async () => ({ data: { words: [] } as TopicWordsOutput }), trace: () => {}, now: () => Date.now() }
  const args = { userId: U, material, targetCount: 5, priorSurfaces: [], driver, deadlineAt: Date.now() + 30_000 }
  assert.equal((await runTopicWords(deps, { ...args, level: 'N2' })).ok, true)
  assert.equal((await runTopicWords(deps, args)).ok, true)
  assert.deepEqual(seen, { build: ['N2', 'N4'], assemble: ['N2', 'N4'], titles: ['카페 주문', '카페 주문'] })
  assert.equal(material.topic.level, 'N4', '재료는 바꾸지 않는다')
})

// ── 소비처 ④ 내 단어장 세트 가중 기준(D6 A) ──────────────────────────────────

test('내 단어장 세트 가중 기준(D6 A) — 결정표 9줄 · 챌린지 있으면 챌린지 난이도, 없으면 지금·목표 중 어려운 쪽', async () => {
  for (const r of TABLE) {
    const f = await world(r)
    const challengeOf = async (u: string) => (await getInProgressChallengeLevel(f.db, u, f.clock.now))?.level ?? null
    assert.equal(await levelCeilingFor(U, profileReader(r), challengeOf), r.ceiling, `${r.n}번 줄 ${r.what}`)
  }
})

test('levelCeilingFor — 챌린지 조회 실패·프로필 실패는 undefined(가중 없이 세트) · 사용자 id 로 읽는다 · mineSetCeiling 순수 표', async () => {
  const asked: string[] = []
  const profile = async (u: string) => (asked.push(`p:${u}`), { level: 'N4', goalLevel: 'N3' })
  const ch = (lv: string | null) => async (u: string) => (asked.push(`c:${u}`), lv)
  assert.equal(await levelCeilingFor(U, profile, ch('N5')), 'N5')
  assert.deepEqual(asked.sort(), [`c:${U}`, `p:${U}`])
  assert.equal(await levelCeilingFor(U, profile, async () => Promise.reject(new Error('down'))), undefined, '챌린지 조회 실패')
  assert.equal(await levelCeilingFor(U, async () => Promise.reject(new Error('down')), ch('N5')), undefined, '프로필 실패(챌린지 있어도)')
  assert.equal(await levelCeilingFor(U, async () => ({ level: '??', goalLevel: null }), ch(null)), undefined, '알 수 없는 값')
  // 순수 — [챌린지, 지금, 목표] → 기준
  const cases: [string | null, string | null, string | null, string | undefined][] = [
    ['N5', 'N4', 'N3', 'N5'], ['N1', 'N5', null, 'N1'], ['N4', 'N4', 'N3', 'N4'],
    [null, 'N4', 'N3', 'N3'], [null, 'N3', 'N4', 'N3'], [null, 'N5', null, 'N5'], [null, null, 'N2', 'N2'], [null, null, null, undefined], ['bad', 'N4', null, 'N4'],
  ]
  for (const [c, l, g, want] of cases) assert.equal(mineSetCeiling(c, { level: l, goalLevel: g }), want, `${c}/${l}/${g}`)
})
