/**
 * task-045 T1-2 — 시드 가시성 연결(목록·추천·장소·새 시작 거절) + "기본으로 되돌리기" 연결 복귀. 메모리 가짜 DB, 실제 DB 없음.
 * 계약 docs/design/topic-scenario-manager.md §2·§4·§8 ①.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ApiError, type Tx } from '@/modules/infra'
import { createChallenge, parseCreateChallengeBody } from '../challenges'
import { loadScenarioLessonMaterials, loadTopicLessonMaterials, type ScenarioLessonDeps } from '../lessons/generate'
import { getScenarioDetail, listScenarios, type ScenarioListQuery } from '../scenarios/catalog'
import { readScenarioRolePlayMaterial, resolveScenarioChatStart, type ScenarioMaterialDb, type ScenarioStartDb } from '../scenarios/start'
import { applyRestoreRelink, forkSeedTopic, isSeedVisibleFor, loadRestoreRelinkPlan, planRestoreRelink, restoreSeed, type TopicRemovalPort } from '../seedOverride'
import { listTopics, pickFewestLessonTopic } from '../topics'
import { fakeDb, kst, matches } from './challengeFakeDb'
import { scenarioFakeDb } from './scenarioFakeDb'
import { invariantViolations, seedOverrideFakeDb } from './seedOverrideFakeDb'

const A = 'userA'
const B = 'userB'
const OLD = new Date('2026-09-01T00:00:00.000Z')
const at = (min: number) => new Date(OLD.getTime() + min * 60_000)
type Row = Record<string, unknown>

const code = (c: string, r?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (r === undefined || (e.details as { reason?: string } | undefined)?.reason === r)

/**
 * 시드 주제 topCafe·topStation·topPark, A 의 내 버전 topCafeA(topCafe 사본), A 가 숨긴 topPark, A 가 숨긴 시드 상황 scnHidden.
 * 시드 상황 scnOrder→topCafe · scnTicket→topStation · scnHidden→topStation · scnPark→topPark, A 의 상황 scnMineA→topCafeA(fork 때 옮긴 연결).
 */
function world() {
  const f = scenarioFakeDb()
  const T = f.tables
  const topic = (id: string, userId: string | null, title: string, min: number) => ({ id, userId, isSeed: userId === null, title, titleJa: null, level: 'N5', description: null, tags: null, createdAt: at(min), updatedAt: at(min) })
  T.conversationTopic.push(topic('topCafe', null, '카페', 0), topic('topStation', null, '역', 1), topic('topPark', null, '공원', 2), topic('topCafeA', A, '나의 카페', 500))
  const scn = (id: string, userId: string | null, min: number) => ({
    id, userId, isSeed: userId === null, status: 'ACTIVE', title: id, titleJa: null, description: null, level: 'N5', difficulty: 2,
    roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoal_ko: '목표' }, constraints: null, keyExpressions: [], grammarPoints: null,
    completionRule: { requiredExpressions: 0 }, createdAt: at(min), updatedAt: at(min),
  })
  T.scenario.push(scn('scnOrder', null, 10), scn('scnTicket', null, 11), scn('scnHidden', null, 12), scn('scnPark', null, 13), scn('scnMineA', A, 600))
  T.scenarioTopic.push(
    { scenarioId: 'scnOrder', topicId: 'topCafe', weight: 1 },
    { scenarioId: 'scnTicket', topicId: 'topStation', weight: 1 },
    { scenarioId: 'scnHidden', topicId: 'topStation', weight: 1 },
    { scenarioId: 'scnPark', topicId: 'topPark', weight: 1 },
    { scenarioId: 'scnMineA', topicId: 'topCafeA', weight: 1 },
  )
  return f
}

function overrideA(f: ReturnType<typeof world>) {
  const o = (id: string, kind: string, seedId: string, copyId: string | null) => ({ id, userId: A, kind, seedId, copyId, createdAt: at(700), updatedAt: at(700) })
  f.tables.userSeedOverride.push(o('o1', 'TOPIC', 'topCafe', 'topCafeA'), o('o2', 'TOPIC', 'topPark', null), o('o3', 'SCENARIO', 'scnHidden', null))
}

const listQ = (over: Partial<ScenarioListQuery> = {}): ScenarioListQuery => ({ topicId: null, level: null, recommended: false, mine: false, limit: 50, offset: 0, ...over })
const ids = (items: { id: string }[]) => items.map((i) => i.id).sort()
const topicsOf = (items: { id: string; topics: { id: string; title: string }[] }[], id: string) => items.find((i) => i.id === id)?.topics.map((t) => `${t.id}:${t.title}`)
const count = (log: readonly string[], op: string) => log.filter((l) => l === op).length

/** 시작 판정용 가짜 — 상황 행에 연결 주제를 붙여 돌려준다(START_SELECT 의 중첩 select 흉내). */
function startDb(f: ReturnType<typeof world>): ScenarioStartDb {
  return {
    lesson: { findFirst: async ({ where }: { where: Row }) => (f.tables.lesson.find((l) => matches(l, where)) as never) ?? null },
    scenario: {
      findFirst: async ({ where }: { where: Row }) => {
        const s = f.tables.scenario.find((r) => matches(r, where))
        if (!s) return null
        const topics = f.tables.scenarioTopic.filter((l) => l.scenarioId === s.id).map((l) => {
          const t = f.tables.conversationTopic.find((x) => x.id === l.topicId)!
          return { topicId: l.topicId, weight: l.weight, topic: { id: t.id, title: t.title, userId: t.userId } }
        })
        return { ...s, topics } as never
      },
    },
    userSeedOverride: f.db.userSeedOverride,
    conversationTopic: f.db.conversationTopic,
  } as unknown as ScenarioStartDb
}

// ── #161 목록·추천·장소 필터 ──

test('목록 — 가린 시드 상황 제외 · 내 버전 주제로 장소 치환 · 숨긴 시드 주제는 장소에서 빠짐 · 다른 사용자는 원본 그대로', async () => {
  const f = world()
  const before = await listScenarios(B, listQ(), f.deps())
  overrideA(f)
  const a = await listScenarios(A, listQ(), f.deps())
  assert.deepEqual(ids(a.items), ['scnMineA', 'scnOrder', 'scnPark', 'scnTicket'])
  assert.deepEqual(topicsOf(a.items, 'scnOrder'), ['topCafeA:나의 카페'], '시드 상황의 장소가 내 버전으로 보인다(저장 변경 없음)')
  assert.deepEqual(topicsOf(a.items, 'scnPark'), [], '숨긴 시드 주제는 장소에서 빠진다')
  assert.deepEqual(topicsOf(a.items, 'scnMineA'), ['topCafeA:나의 카페'])
  assert.ok(!a.recommendedIds.includes('scnHidden') && a.recommendedIds.every((id) => ids(a.items).includes(id)), '추천도 가린 상황 제외')
  assert.deepEqual(f.tables.scenarioTopic.find((l) => l.scenarioId === 'scnOrder'), { scenarioId: 'scnOrder', topicId: 'topCafe', weight: 1 }, '저장된 연결 불변')
  const b = await listScenarios(B, listQ(), f.deps())
  assert.deepEqual(b, before, 'A 의 override 는 B 의 목록에 영향이 없다')
  assert.deepEqual(ids(b.items), ['scnHidden', 'scnOrder', 'scnPark', 'scnTicket'])
  assert.deepEqual(topicsOf(b.items, 'scnOrder'), ['topCafe:카페'])
})

test('목록 — 장소 칩 필터: 내 버전 id 는 원래 시드 주제에 붙은 시드 상황도 포함 · 가린 시드 주제 id 는 결과 없음 · B 는 원본 id 로', async () => {
  const f = world()
  overrideA(f)
  assert.deepEqual(ids((await listScenarios(A, listQ({ topicId: 'topCafeA' }), f.deps())).items), ['scnMineA', 'scnOrder'])
  assert.deepEqual((await listScenarios(A, listQ({ topicId: 'topCafe' }), f.deps())).items, [])
  assert.deepEqual((await listScenarios(A, listQ({ topicId: 'topPark' }), f.deps())).items, [])
  assert.deepEqual(ids((await listScenarios(A, listQ({ topicId: 'topStation' }), f.deps())).items), ['scnTicket'], '가린 시드 상황은 필터 결과에도 없다')
  assert.deepEqual(ids((await listScenarios(B, listQ({ topicId: 'topCafe' }), f.deps())).items), ['scnOrder'])
  assert.deepEqual(ids((await listScenarios(B, listQ({ topicId: 'topStation' }), f.deps())).items), ['scnHidden', 'scnTicket'])
  assert.deepEqual((await listScenarios(B, listQ({ topicId: 'topCafeA' }), f.deps())).items, [], 'B 는 A 의 내 버전으로 거를 수 없다')
})

test('상세 — 가린 시드 상황도 id 로 직접 읽힌다(지난 기록 열람) · 장소는 내 버전으로', async () => {
  const f = world()
  overrideA(f)
  assert.equal((await getScenarioDetail(A, 'scnHidden', f.deps())).id, 'scnHidden')
  assert.deepEqual((await getScenarioDetail(A, 'scnOrder', f.deps())).topics.map((t) => t.id), ['topCafeA'])
})

test('일반 동작 불변 — override 가 없는 사용자는 추가 조회 1회(override)뿐, 주제 조회 수 그대로', async () => {
  const f = world()
  f.log.length = 0
  await listScenarios(B, listQ(), f.deps())
  assert.equal(count(f.log, 'userSeedOverride.findMany'), 1)
  assert.equal(count(f.log, 'conversationTopic.findMany'), 1, '내 버전 생존 조회 없음')
  f.log.length = 0
  await listTopics(B, { level: 'N5', mine: false }, withGroupBy(f.db))
  assert.equal(count(f.log, 'userSeedOverride.findMany'), 1)
  f.log.length = 0
  await resolveScenarioChatStart(B, { scenarioId: 'scnOrder', lessonId: null, topicId: null }, startDb(f))
  assert.deepEqual([count(f.log, 'userSeedOverride.findMany'), count(f.log, 'conversationTopic.findMany')], [1, 0])
})

// ── #56 주제 목록·수업 추천 주제 ──

/** 주제 목록이 쓰는 lesson.groupBy(끝낸 수업 통계)를 빈 결과로 흉내. */
function withGroupBy(db: Tx): Tx {
  const lesson = (db as unknown as { lesson: object }).lesson
  return Object.assign(Object.create(db), { lesson: { ...lesson, groupBy: async () => [] } }) as Tx
}

test('주제 목록 — 가린 시드(숨김·내 버전) 제외 · 내 버전은 내 행(isSeed false) · mine=1 은 내 것만 · B 는 시드 전부', async () => {
  const f = world()
  overrideA(f)
  const a = await listTopics(A, { level: 'N5', mine: false }, withGroupBy(f.db))
  assert.deepEqual(a.items.map((t) => `${t.id}:${t.isSeed}`), ['topStation:true', 'topCafeA:false'])
  assert.deepEqual((await listTopics(A, { level: 'N5', mine: true }, withGroupBy(f.db))).items.map((t) => t.id), ['topCafeA'])
  assert.deepEqual((await listTopics(B, { level: 'N5', mine: false }, withGroupBy(f.db))).items.map((t) => t.id), ['topCafe', 'topStation', 'topPark'])
})

test('수업 추천 주제 — 가린 시드는 고르지 않는다(A) · B 는 원본에서 고른다', async () => {
  const f = world()
  overrideA(f)
  assert.equal((await pickFewestLessonTopic(A, ['N5'], null, withGroupBy(f.db)))?.id, 'topStation')
  assert.equal((await pickFewestLessonTopic(A, ['N5'], 'topStation', withGroupBy(f.db)))?.id, 'topCafeA')
  assert.equal((await pickFewestLessonTopic(B, ['N5'], null, withGroupBy(f.db)))?.id, 'topCafe')
})

// ── #28 역할극 시작 · #59 수업 ──

test('역할극 시작 — 가린 시드 상황은 없는 상황과 같은 404 · B 는 시작 · 진행 재료(이어 가기)는 그대로 읽힌다', async () => {
  const f = world()
  overrideA(f)
  const db = startDb(f)
  await assert.rejects(resolveScenarioChatStart(A, { scenarioId: 'scnHidden', lessonId: null, topicId: null }, db), code('NOT_FOUND'))
  assert.equal((await resolveScenarioChatStart(B, { scenarioId: 'scnHidden', lessonId: null, topicId: null }, db)).scenario.id, 'scnHidden')
  const material = await readScenarioRolePlayMaterial(A, 'scnHidden', f.db as unknown as ScenarioMaterialDb)
  assert.equal(material?.id, 'scnHidden')
})

test('역할극 시작 — 장소: 내 버전으로 시작(이름 포함) · 원래 시드 주제 id 요청은 400 not_linked · 숨긴 시드 주제는 빠짐 · 내 상황도 시작', async () => {
  const f = world()
  overrideA(f)
  const db = startDb(f)
  const s = await resolveScenarioChatStart(A, { scenarioId: 'scnOrder', lessonId: null, topicId: null }, db)
  assert.deepEqual([s.topic, s.topicSource], [{ id: 'topCafeA', title: '나의 카페' }, 'SCENARIO'])
  assert.deepEqual((await resolveScenarioChatStart(A, { scenarioId: 'scnOrder', lessonId: null, topicId: 'topCafeA' }, db)).topicSource, 'REQUEST')
  await assert.rejects(resolveScenarioChatStart(A, { scenarioId: 'scnOrder', lessonId: null, topicId: 'topCafe' }, db), code('VALIDATION', 'not_linked'))
  const park = await resolveScenarioChatStart(A, { scenarioId: 'scnPark', lessonId: null, topicId: null }, db)
  assert.deepEqual([park.topic, park.topicSource], [null, 'NONE'])
  assert.equal((await resolveScenarioChatStart(A, { scenarioId: 'scnMineA', lessonId: null, topicId: null }, db)).topic?.id, 'topCafeA')
  assert.deepEqual((await resolveScenarioChatStart(B, { scenarioId: 'scnOrder', lessonId: null, topicId: null }, db)).topic, { id: 'topCafe', title: '카페' })
  assert.deepEqual((await resolveScenarioChatStart(B, { scenarioId: 'scnPark', lessonId: null, topicId: null }, db)).topic, { id: 'topPark', title: '공원' })
})

test('수업 생성 — 가린 시드 상황·주제로는 새 수업 404 · 내 버전 주제·B 는 허용', async () => {
  const f = world()
  overrideA(f)
  const db = startDb(f)
  const sDeps: ScenarioLessonDeps = {
    start: (u, i) => resolveScenarioChatStart(u, i, db),
    material: (u, id) => readScenarioRolePlayMaterial(u, id, f.db as unknown as ScenarioMaterialDb),
    topic: async (_u, id) => ({ id, title: id, titleJa: null, level: 'N5', chunks: [] }),
    history: async () => ({ previousTitles: [], previousNextPreview: null }),
  }
  await assert.rejects(loadScenarioLessonMaterials(A, { kind: 'scenario', scenarioId: 'scnHidden', topicId: null }, sDeps), code('NOT_FOUND'))
  assert.equal((await loadScenarioLessonMaterials(A, { kind: 'scenario', scenarioId: 'scnOrder', topicId: null }, sDeps)).topic?.id, 'topCafeA')
  const challengeAsked: string[] = []
  const tDeps = {
    topic: sDeps.topic,
    visible: (u: string, t: string) => isSeedVisibleFor(f.db, u, 'TOPIC', t),
    challengeTopicId: async (u: string) => (challengeAsked.push(u), u === A ? 'topPark' : null),
    history: sDeps.history,
  }
  await assert.rejects(loadTopicLessonMaterials(A, { kind: 'topic', topicId: 'topCafe' }, tDeps), code('NOT_FOUND'))
  assert.equal((await loadTopicLessonMaterials(A, { kind: 'topic', topicId: 'topPark' }, tDeps)).topic?.id, 'topPark', '진행 중 챌린지 주제면 숨긴 뒤에도 챌린지 수업은 계속(§0 #9)')
  challengeAsked.length = 0
  assert.equal((await loadTopicLessonMaterials(A, { kind: 'topic', topicId: 'topCafeA' }, tDeps)).topic?.id, 'topCafeA')
  assert.equal((await loadTopicLessonMaterials(B, { kind: 'topic', topicId: 'topCafe' }, tDeps)).topic?.id, 'topCafe')
  assert.deepEqual(challengeAsked, [], '보이는 주제는 챌린지를 조회하지 않는다')
  await assert.rejects(loadTopicLessonMaterials(B, { kind: 'topic', topicId: 'topGone' }, { ...tDeps, topic: async () => null }), code('NOT_FOUND'))
})

// ── #156 챌린지 만들기 ──

test('챌린지 만들기 — 가린 시드 주제는 없는 주제와 같은 404(쓰기 0) · 내 버전 주제·다른 사용자는 만든다', async () => {
  const U = 'cuser0000000000000000000u1'
  const U2 = 'cuser0000000000000000000u2'
  const T = 'ctopiccafe000000000000001'
  const C = 'ctopiccopy000000000000004'
  const f = fakeDb()
  f.clock.now = kst('2026-10-06 09:00')
  f.tables.conversationTopic.push({ id: T, userId: null, title: '카페 주문', level: 'N5' }, { id: C, userId: U, isSeed: false, title: '나의 카페', level: 'N5' })
  f.tables.userSeedOverride.push({ id: 'o1', userId: U, kind: 'TOPIC', seedId: T, copyId: C })
  const body = (topicId: string) => parseCreateChallengeBody({ topicId, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
  await assert.rejects(createChallenge(U, body(T), f.deps()), code('NOT_FOUND'))
  assert.equal(f.tables.challenge.length, 0)
  assert.equal((await createChallenge(U2, body(T), f.deps())).topic.id, T)
  assert.equal((await createChallenge(U, body(C), f.deps())).topic.id, C)
})

// ── #176 되돌리기: 내 상황 연결 복귀 ──

test('되돌리기(주제 사본) — 내 상황이 보관되지 않고 시드 주제로 돌아간다 · 새로 만든 상황도 · 중복 연결 없음 · 한도 넘은 예전 행은 더하지 않음', async () => {
  const f = seedOverrideFakeDb()
  const T = f.tables
  T.conversationTopic.push({ id: 'topCafe', userId: null, isSeed: true, title: '카페', titleJa: null, level: 'N5', description: null, tags: null, createdAt: OLD, updatedAt: OLD })
  T.scenario.push({ id: 'scnSeed', userId: null, isSeed: true, status: 'ACTIVE', createdAt: OLD })
  T.scenarioTopic.push({ scenarioId: 'scnSeed', topicId: 'topCafe', weight: 1 })
  T.scenario.push({ id: 'scnMine', userId: A, isSeed: false, status: 'ACTIVE', createdAt: OLD })
  T.scenarioTopic.push({ scenarioId: 'scnMine', topicId: 'topCafe', weight: 2 }, { scenarioId: 'scnMine', topicId: 'topStation', weight: 1 })
  const fork = await forkSeedTopic(A, 'topCafe', {}, f.deps())
  const C = fork.copyId
  T.scenario.push({ id: 'scnNew', userId: A, isSeed: false, status: 'ACTIVE', createdAt: OLD }, { id: 'scnBoth', userId: A, isSeed: false, status: 'ACTIVE', createdAt: OLD }, { id: 'scnFull', userId: A, isSeed: false, status: 'ACTIVE', createdAt: OLD })
  T.scenarioTopic.push(
    { scenarioId: 'scnNew', topicId: C, weight: 1 },
    { scenarioId: 'scnBoth', topicId: C, weight: 3 }, { scenarioId: 'scnBoth', topicId: 'topCafe', weight: 1 },
    { scenarioId: 'scnFull', topicId: C, weight: 1 }, { scenarioId: 'scnFull', topicId: 'topX', weight: 1 }, { scenarioId: 'scnFull', topicId: 'topY', weight: 1 }, { scenarioId: 'scnFull', topicId: 'topZ', weight: 1 },
  )
  // §4 흉내: 사본 주제에만 붙은 내 상황은 보관, 나머지는 연결만 끊고 주제 삭제. T3-1b 부터 되돌려 붙이기는 포트 몫(mode RESTORE) —
  // 실제 포트와 같은 계산(relink.ts)을 먼저 적용한다(실제 포트 시험은 topicRemoval.test.ts "T3-1b #176").
  const archived: string[] = []
  const modes: unknown[] = []
  const port: TopicRemovalPort = async (tx, userId, topicId, opts) => {
    modes.push(opts.mode)
    const plan = opts.mode === 'RESTORE' ? await loadRestoreRelinkPlan(tx, userId, topicId, 'topCafe') : null
    if (plan) await applyRestoreRelink(tx, plan, topicId, 'topCafe')
    for (const l of T.scenarioTopic.filter((x) => x.topicId === topicId)) {
      if (!T.scenarioTopic.some((x) => x.scenarioId === l.scenarioId && x.topicId !== topicId)) archived.push(l.scenarioId as string)
    }
    await tx.scenarioTopic.deleteMany({ where: { topicId } })
    await tx.conversationTopic.deleteMany({ where: { id: topicId, userId } })
    return { archived }
  }
  const r = await restoreSeed(A, 'TOPIC', 'topCafe', { ack: 'none' }, f.deps({ removeTopic: port }))
  assert.equal(r.path, 'COPY')
  assert.deepEqual(modes, ['RESTORE'], 'restoreSeed 는 포트를 RESTORE 로 부른다')
  assert.deepEqual(archived, [], '되돌리기로 보관되는 내 상황 없음')
  const linksOf = (sid: string) => T.scenarioTopic.filter((l) => l.scenarioId === sid).map((l) => `${l.topicId}:${l.weight}`).sort()
  assert.deepEqual(linksOf('scnMine'), ['topCafe:2', 'topStation:1'], 'fork 로 옮긴 연결이 원래대로')
  assert.deepEqual(linksOf('scnNew'), ['topCafe:1'], '사본으로 새로 만든 상황도 시드 주제로')
  assert.deepEqual(linksOf('scnBoth'), ['topCafe:1'], '이미 시드에 붙어 있으면 중복 연결을 만들지 않는다')
  assert.deepEqual(linksOf('scnFull'), ['topX:1', 'topY:1', 'topZ:1'], '한도(3)를 이미 넘은 예전 행에는 더하지 않는다')
  assert.deepEqual(linksOf('scnSeed'), ['topCafe:1'])
  assert.ok(T.scenario.every((s) => s.status === 'ACTIVE'))
  assert.deepEqual(invariantViolations(T), [])
})

test('planRestoreRelink — 순수 계산: 내 상황만·연결 수가 늘지 않음·가장 큰 weight·결정적 순서', () => {
  const p = planRestoreRelink(
    [
      { scenarioId: 's2', topicId: 'C', weight: 2 },
      { scenarioId: 's1', topicId: 'C', weight: 1 },
      { scenarioId: 's1', topicId: 'X', weight: 3 },
      { scenarioId: 's3', topicId: 'C', weight: 1 },
      { scenarioId: 's3', topicId: 'S', weight: 5 },
      { scenarioId: 's4', topicId: 'X', weight: 1 },
    ],
    'C',
    'S',
  )
  assert.deepEqual(p, { unlink: ['s1', 's2', 's3'], link: [{ scenarioId: 's1', weight: 1 }, { scenarioId: 's2', weight: 2 }], relinkedScenarioIds: ['s1', 's2', 's3'] })
  assert.deepEqual(planRestoreRelink([], 'C', 'S'), { unlink: [], link: [], relinkedScenarioIds: [] })
})

test('구조 — learning 하위 모듈은 seedOverride index 를 거치지 않는다(ops → scenarios/catalog 순환 방지)', () => {
  // T3: challenges/service 는 잠금 안 재확인 헬퍼(topics/visible — 그 파일이 가시성 도구를 직접 import)를 쓴다. vocab/sessions·topics/remove 도 같은 규칙.
  const files = ['topics/index.ts', 'topics/visible.ts', 'topics/remove.ts', 'scenarios/catalog.ts', 'scenarios/start.ts', 'challenges/service.ts', 'lessons/generate.ts', 'vocab/sessions.ts']
  const direct: Record<string, RegExp> = {
    'challenges/service.ts': /from '\.\.\/topics\/visible'/,
    'vocab/sessions.ts': /from '\.\.\/topics\/visible'/,
    'topics/remove.ts': /from '\.\.\/seedOverride\/(store|relink)'/,
  }
  for (const file of files) {
    const src = readFileSync(join(process.cwd(), 'src/modules/learning', file), 'utf8')
    assert.ok(!/from '\.\.\/seedOverride(\/index)?'/.test(src) && !/from '@\/modules\/learning'/.test(src), file)
    assert.ok((direct[file] ?? /from '\.\.\/seedOverride\/visibility'/).test(src), `${file} 가 가시성 도구(또는 재확인 헬퍼)를 직접 import`)
  }
})
