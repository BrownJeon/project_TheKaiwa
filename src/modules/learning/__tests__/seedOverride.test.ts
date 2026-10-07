/**
 * task-045 T1 — 시드 사용자별 관리(UserSeedOverride) 단위 테스트. 메모리 가짜 DB(seedOverrideFakeDb), 실제 DB 없음.
 * 계약 docs/design/topic-scenario-manager.md §1·§2·§4(불변식·알고리즘).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '@/modules/infra'
import {
  detachCopy, forkSeedScenario, forkSeedTopic, hiddenSeedIds, hideSeed, isSeedVisibleFor, listSeedOverrides, normalizeTopicInput, parseSeedRefBody,
  resolvePlaceTopicId, restoreSeed, visibleRowsWhere, visibleSeedWhere, type TopicRemovalPort,
} from '../seedOverride'
import { matches } from './challengeFakeDb'
import { invariantViolations, seedOverrideFakeDb } from './seedOverrideFakeDb'

const U = 'userA'
const V = 'userB'
const OLD = new Date('2026-09-01T00:00:00.000Z')

function fixture() {
  const f = seedOverrideFakeDb()
  const T = f.tables
  const topic = (id: string, userId: string | null, title: string) => ({ id, userId, isSeed: userId === null, title, titleJa: null, level: 'N5', description: `${title} 설명`, tags: userId ? null : ['seed'], createdAt: OLD, updatedAt: OLD })
  T.conversationTopic.push(topic('topCafe', null, '카페'), topic('topStation', null, '역'))
  T.topicChunk.push(
    { id: 'chk1', topicId: 'topCafe', chunkType: 'NAME', textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', order: 0, note: '음료' },
    { id: 'chk2', topicId: 'topCafe', chunkType: 'ACTION', textJa: '注文する', reading: 'ちゅうもんする', meaningKo: '주문하다', order: 1, note: null },
    { id: 'chk3', topicId: 'topCafe', chunkType: 'FEELING', textJa: 'おいしい', reading: null, meaningKo: '맛있다', order: 2, note: null },
  )
  T.scenario.push({
    id: 'scnOrder', userId: null, isSeed: true, status: 'ACTIVE', title: '카페에서 주문', titleJa: 'カフェで注文', description: '음료를 주문한다', level: 'N5', difficulty: 2,
    roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoal_ko: '음료 주문하기', successCriteria: ['음료를 고른다'] },
    constraints: { steps: [{ ko: '인사' }, { ko: '주문' }], opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' }, exprSeq: 9 },
    keyExpressions: [{ id: 'k1', ja: 'コーヒーをください', reading: 'こーひーをください', ko: '커피 주세요' }, { id: 'e7', ja: 'これをください', ko: '이거 주세요' }],
    grammarPoints: null, completionRule: { requiredExpressions: 2, tutorJudgement: true }, createdAt: OLD, updatedAt: OLD,
  })
  T.scenarioTopic.push({ scenarioId: 'scnOrder', topicId: 'topCafe', weight: 1 })
  return f
}

const reason = (code: string, r: string) => (e: unknown) => e instanceof ApiError && e.code === code && (e.details as { reason?: string } | undefined)?.reason === r
const seedSnap = (f: ReturnType<typeof fixture>) =>
  JSON.stringify([f.tables.conversationTopic.filter((t) => t.userId === null), f.tables.topicChunk.filter((c) => ['chk1', 'chk2', 'chk3'].includes(c.id as string)), f.tables.scenario.filter((s) => s.userId === null), f.tables.scenarioTopic.filter((l) => l.scenarioId === 'scnOrder')])

/** 가짜 주제 삭제 포트 — 계약 §4 의 최소 흉내(주제·조각 삭제). 받은 인자를 남긴다. */
function fakeRemoval(f: ReturnType<typeof fixture>, calls: unknown[]): TopicRemovalPort {
  return async (tx, userId, topicId, opts) => {
    calls.push({ userId, topicId, ack: opts.ack })
    await tx.topicChunk.deleteMany({ where: { topicId } })
    await tx.scenarioTopic.deleteMany({ where: { topicId } })
    await tx.conversationTopic.deleteMany({ where: { id: topicId, userId } })
    return { topicId, challengesRemoved: 0 }
  }
}

// ── hide ──

test('hide — 숨김 행(copyId null) 생성 · 다시 부르면 무변경(멱등) · 그 사용자 목록에서만 가려진다', async () => {
  const f = fixture()
  const a = await hideSeed(U, 'TOPIC', 'topCafe', f.deps())
  assert.deepEqual(a, { kind: 'TOPIC', seedId: 'topCafe', state: 'HIDDEN', changed: true })
  const b = await hideSeed(U, 'TOPIC', 'topCafe', f.deps())
  assert.deepEqual(b, { kind: 'TOPIC', seedId: 'topCafe', state: 'HIDDEN', changed: false })
  assert.equal(f.tables.userSeedOverride.length, 1)
  assert.equal(f.tables.userSeedOverride[0].copyId, null)
  const listFor = async (uid: string) => {
    const hidden = await hiddenSeedIds(f.db, uid, 'TOPIC')
    return f.tables.conversationTopic.filter((t) => matches(t, visibleRowsWhere(uid, hidden))).map((t) => t.id)
  }
  assert.deepEqual(await listFor(U), ['topStation'])
  assert.deepEqual(await listFor(V), ['topCafe', 'topStation'], '다른 사용자의 override 는 영향이 없다')
  assert.equal(await isSeedVisibleFor(f.db, U, 'TOPIC', 'topCafe'), false)
  assert.equal(await isSeedVisibleFor(f.db, V, 'TOPIC', 'topCafe'), true)
  assert.equal(await isSeedVisibleFor(f.db, U, 'SCENARIO', 'topCafe'), true, '종류가 다르면 별개')
  assert.deepEqual(invariantViolations(f.tables), [])
})

test('hide — 시드가 아닌 id·없는 id·형식이 틀린 id 는 404 SEED_NOT_FOUND, 모르는 종류는 400 · 사본이 있으면 무변경 COPIED', async () => {
  const f = fixture()
  f.tables.conversationTopic.push({ id: 'topMine', userId: U, isSeed: false, title: '내 주제', level: 'N5', createdAt: OLD })
  await assert.rejects(hideSeed(U, 'TOPIC', 'topMine', f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'))
  await assert.rejects(hideSeed(U, 'TOPIC', 'nope', f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'))
  await assert.rejects(hideSeed(U, 'SCENARIO', 'a b/c', f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'))
  await assert.rejects(hideSeed(U, 'TOPIC', 'scnOrder', f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'), '종류가 맞지 않는 시드')
  await assert.rejects(hideSeed(U, 'WORD' as 'TOPIC', 'topCafe', f.deps()), reason('VALIDATION', 'enum'))
  assert.equal(f.tables.userSeedOverride.length, 0)
  const fork = await forkSeedScenario(U, 'scnOrder', {}, f.deps())
  const h = await hideSeed(U, 'SCENARIO', 'scnOrder', f.deps())
  assert.deepEqual(h, { kind: 'SCENARIO', seedId: 'scnOrder', state: 'COPIED', changed: false })
  assert.equal(f.tables.userSeedOverride[0].copyId, fork.copyId, '숨김이 사본을 덮어쓰지 않는다')
})

// ── fork 상황 ──

test('fork 상황 — 사본(내 행) + override 한 번에 · 시드 행은 바이트 동일 · 표현 id·exprSeq 유지 후 병합', async () => {
  const f = fixture()
  const before = seedSnap(f)
  const r = await forkSeedScenario(U, 'scnOrder', {
    title: '내 카페 주문',
    keyExpressions: [{ id: 'k1', ja: 'コーヒーをください', ko: '커피 주세요' }, { ja: 'ラテをください', ko: '라테 주세요' }],
  }, f.deps())
  assert.equal(seedSnap(f), before, '시드 행·연결을 바꾸지 않는다')
  const copy = f.tables.scenario.find((s) => s.id === r.copyId)!
  assert.deepEqual([copy.userId, copy.isSeed, copy.status, copy.title, copy.titleJa, copy.level], [U, false, 'ACTIVE', '내 카페 주문', 'カフェで注文', 'N5'])
  assert.deepEqual((copy.keyExpressions as { id: string }[]).map((e) => e.id), ['k1', 'e10'], 'k1 유지, 새 표현은 시드 고수위(9) 다음')
  const c = copy.constraints as { exprSeq: number; opening: unknown; steps: unknown }
  assert.equal(c.exprSeq, 10)
  assert.deepEqual(c.opening, { ja: 'いらっしゃいませ。', ko: '어서 오세요.' })
  assert.deepEqual(f.tables.scenarioTopic.filter((l) => l.scenarioId === r.copyId).map((l) => [l.topicId, l.weight]), [['topCafe', 1]])
  assert.deepEqual(f.tables.userSeedOverride.map((o) => [o.userId, o.kind, o.seedId, o.copyId]), [[U, 'SCENARIO', 'scnOrder', r.copyId]])
  assert.deepEqual(r, { kind: 'SCENARIO', seedId: 'scnOrder', copyId: r.copyId, relinkedScenarioIds: [] })
  assert.deepEqual(invariantViolations(f.tables), [])
  const ins = f.log.indexOf('scenario.create')
  assert.ok(f.log.indexOf('lockUser') > -1 && f.log.indexOf('lockUser') < ins, '잠금 뒤에 쓴다')
})

test('fork 상황 — 두 번째 fork 는 409 ALREADY_COPIED(덮어쓰지 않음) · 숨긴 시드도 409 HIDDEN · 다른 사용자는 따로 사본', async () => {
  const f = fixture()
  const first = await forkSeedScenario(U, 'scnOrder', { title: '첫 사본' }, f.deps())
  await assert.rejects(forkSeedScenario(U, 'scnOrder', { title: '둘째' }, f.deps()), (e) => reason('CONFLICT', 'ALREADY_COPIED')(e) && (e as ApiError).details?.state === 'COPIED')
  assert.equal(f.tables.scenario.filter((s) => s.userId === U).length, 1)
  assert.equal(f.tables.userSeedOverride[0].copyId, first.copyId)
  await hideSeed(V, 'SCENARIO', 'scnOrder', f.deps())
  await assert.rejects(forkSeedScenario(V, 'scnOrder', {}, f.deps()), (e) => reason('CONFLICT', 'ALREADY_COPIED')(e) && (e as ApiError).details?.state === 'HIDDEN')
  const w = await forkSeedScenario('userC', 'scnOrder', {}, f.deps())
  assert.notEqual(w.copyId, first.copyId)
  assert.deepEqual(invariantViolations(f.tables), [])
})

test('fork 상황 — 시드 아닌 id(남의 상황·내 상황)·없는 id 404 · 입력 오류 400 · 장소는 시드/내 주제만', async () => {
  const f = fixture()
  f.tables.scenario.push({ ...structuredClone(f.tables.scenario[0]), id: 'scnTheirs', userId: V, isSeed: false })
  await assert.rejects(forkSeedScenario(U, 'scnTheirs', {}, f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'))
  await assert.rejects(forkSeedScenario(V, 'scnTheirs', {}, f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'), '내 상황도 시드가 아니다')
  await assert.rejects(forkSeedScenario(U, 'missing', {}, f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'))
  await assert.rejects(forkSeedScenario(U, 'scnOrder', { difficulty: 9 }, f.deps()), (e) => e instanceof ApiError && e.code === 'VALIDATION')
  f.tables.conversationTopic.push({ id: 'topV', userId: V, isSeed: false, title: '남의 주제', level: 'N5', createdAt: OLD })
  await assert.rejects(forkSeedScenario(U, 'scnOrder', { topicIds: ['topV'] }, f.deps()), reason('VALIDATION', 'not_found'))
  assert.equal(f.tables.userSeedOverride.length, 0)
  assert.equal(f.tables.scenario.filter((s) => s.userId === U).length, 0, '거절은 쓰기 전에')
})

test('fork 상황 — 한도: ACTIVE 50 → 409 SCENARIO_LIMIT · 하루 30(KST) → 429 DAILY_LIMIT(retryAfterSec)', async () => {
  const f = fixture()
  for (let i = 0; i < 50; i++) f.tables.scenario.push({ id: `mine${i}`, userId: U, isSeed: false, status: 'ACTIVE', createdAt: OLD })
  await assert.rejects(forkSeedScenario(U, 'scnOrder', {}, f.deps()), reason('CONFLICT', 'SCENARIO_LIMIT'))
  const g = fixture()
  const today = new Date('2026-10-06T15:00:00.000Z') // KST 10-07 00:00
  for (let i = 0; i < 30; i++) g.tables.scenario.push({ id: `made${i}`, userId: U, isSeed: false, status: 'ARCHIVED', createdAt: today })
  await assert.rejects(forkSeedScenario(U, 'scnOrder', {}, g.deps()), (e) => reason('RATE_LIMITED', 'DAILY_LIMIT')(e) && (e as ApiError).details?.retryAfterSec === 43200)
  g.tables.scenario.forEach((s) => s.id !== 'scnOrder' && (s.createdAt = new Date('2026-10-06T14:59:59.000Z')))
  const ok = await forkSeedScenario(U, 'scnOrder', {}, g.deps())
  assert.ok(ok.copyId, 'KST 전날 만든 것은 하루 한도에 들지 않는다')
})

// ── fork 주제 ──

test('fork 주제 — 조각은 새 id 로 복사(메모·순서 유지) · 시드 주제·조각·시드 상황 연결 불변 · 내 상황 연결만 사본으로 이동', async () => {
  const f = fixture()
  f.tables.scenario.push({ id: 'scnMine', userId: U, isSeed: false, status: 'ACTIVE', createdAt: OLD }, { id: 'scnMineOld', userId: U, isSeed: false, status: 'ARCHIVED', createdAt: OLD }, { id: 'scnTheirs', userId: V, isSeed: false, status: 'ACTIVE', createdAt: OLD })
  f.tables.scenarioTopic.push({ scenarioId: 'scnMine', topicId: 'topCafe', weight: 2 }, { scenarioId: 'scnMine', topicId: 'topStation', weight: 1 }, { scenarioId: 'scnMineOld', topicId: 'topCafe', weight: 1 }, { scenarioId: 'scnTheirs', topicId: 'topCafe', weight: 1 })
  const before = seedSnap(f)
  const r = await forkSeedTopic(U, 'topCafe', { title: '나의 카페' }, f.deps())
  assert.equal(seedSnap(f), before)
  const copy = f.tables.conversationTopic.find((t) => t.id === r.copyId)!
  assert.deepEqual([copy.userId, copy.isSeed, copy.title, copy.level, copy.description, copy.tags], [U, false, '나의 카페', 'N5', '카페 설명', ['seed']])
  const chunks = f.tables.topicChunk.filter((c) => c.topicId === r.copyId)
  assert.deepEqual(chunks.map((c) => [c.chunkType, c.textJa, c.reading, c.meaningKo, c.note, c.order]), [['NAME', 'コーヒー', 'こーひー', '커피', '음료', 0], ['ACTION', '注文する', 'ちゅうもんする', '주문하다', null, 1], ['FEELING', 'おいしい', null, '맛있다', null, 2]])
  assert.ok(chunks.every((c) => !['chk1', 'chk2', 'chk3'].includes(c.id as string)), '조각은 새 행')
  const linksOf = (sid: string) => f.tables.scenarioTopic.filter((l) => l.scenarioId === sid).map((l) => `${l.topicId}:${l.weight}`).sort()
  assert.deepEqual(linksOf('scnMine'), [`${r.copyId}:2`, 'topStation:1'])
  assert.deepEqual(linksOf('scnMineOld'), [`${r.copyId}:1`])
  assert.deepEqual(linksOf('scnTheirs'), ['topCafe:1'], '남의 상황은 그대로')
  assert.deepEqual(linksOf('scnOrder'), ['topCafe:1'], '시드 상황 연결은 그대로(읽을 때 치환)')
  assert.deepEqual(r.relinkedScenarioIds.sort(), ['scnMine', 'scnMineOld'])
  assert.equal(await resolvePlaceTopicId(f.db, U, 'topCafe'), r.copyId)
  assert.equal(await resolvePlaceTopicId(f.db, V, 'topCafe'), 'topCafe', '다른 사용자는 원본')
  assert.equal(await resolvePlaceTopicId(f.db, U, 'topStation'), 'topStation')
  assert.deepEqual(invariantViolations(f.tables), [])
})

test('fork 주제 — 보낸 조각이 전부 · 입력 검사(제목 20자·모르는 키·조각 모양) · 한도 30·하루 10', async () => {
  const f = fixture()
  const r = await forkSeedTopic(U, 'topCafe', { title: ' 카페2 ', titleJa: '', chunks: [{ chunkType: 'MODIFIER', textJa: 'とても', reading: 'とても', meaningKo: '매우' }] }, f.deps())
  const copy = f.tables.conversationTopic.find((t) => t.id === r.copyId)!
  assert.deepEqual([copy.title, copy.titleJa], ['카페2', null])
  assert.deepEqual(f.tables.topicChunk.filter((c) => c.topicId === r.copyId).map((c) => c.textJa), ['とても'])
  const bad = fixture()
  await assert.rejects(forkSeedTopic(U, 'topCafe', { title: '가'.repeat(21) }, bad.deps()), reason('VALIDATION', 'max 20'))
  await assert.rejects(forkSeedTopic(U, 'topCafe', { userId: V }, bad.deps()), reason('VALIDATION', 'unknown_key'))
  await assert.rejects(forkSeedTopic(U, 'topCafe', { chunks: [{ chunkType: 'X', textJa: 'a', meaningKo: 'b' }] }, bad.deps()), reason('VALIDATION', 'enum'))
  await assert.rejects(forkSeedTopic(U, 'topCafe', { chunks: [] }, bad.deps()), reason('VALIDATION', 'range 1-40'))
  await assert.rejects(forkSeedTopic(U, 'topCafe', { level: 'N9' }, bad.deps()), reason('VALIDATION', 'enum'))
  await assert.rejects(forkSeedTopic(U, 'topCafe', { title: `a${String.fromCodePoint(7)}b` }, bad.deps()), reason('VALIDATION', 'control_char'))
  const lim = fixture()
  for (let i = 0; i < 30; i++) lim.tables.conversationTopic.push({ id: `mt${i}`, userId: U, isSeed: false, title: 't', level: 'N5', createdAt: OLD })
  await assert.rejects(forkSeedTopic(U, 'topCafe', {}, lim.deps()), reason('CONFLICT', 'TOPIC_LIMIT'))
  const day = fixture()
  for (let i = 0; i < 10; i++) day.tables.conversationTopic.push({ id: `dt${i}`, userId: U, isSeed: false, title: 't', level: 'N5', createdAt: new Date('2026-10-07T01:00:00.000Z') })
  await assert.rejects(forkSeedTopic(U, 'topCafe', {}, day.deps()), reason('RATE_LIMITED', 'DAILY_LIMIT'))
  for (const g of [bad, lim, day]) assert.equal(g.tables.userSeedOverride.length, 0)
})

test('fork 주제 — 남의 주제·내 주제 id 는 404 · 상황 fork 의 장소는 내 주제 사본으로 바뀐다', async () => {
  const f = fixture()
  f.tables.conversationTopic.push({ id: 'topV', userId: V, isSeed: false, title: '남', level: 'N5', createdAt: OLD })
  await assert.rejects(forkSeedTopic(U, 'topV', {}, f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'))
  await assert.rejects(forkSeedTopic(V, 'topV', {}, f.deps()), reason('NOT_FOUND', 'SEED_NOT_FOUND'))
  const t = await forkSeedTopic(U, 'topCafe', {}, f.deps())
  const s = await forkSeedScenario(U, 'scnOrder', {}, f.deps())
  assert.deepEqual(f.tables.scenarioTopic.filter((l) => l.scenarioId === s.copyId).map((l) => l.topicId), [t.copyId])
  const s2 = await forkSeedScenario(V, 'scnOrder', { topicIds: ['topCafe', 'topStation'] }, f.deps())
  assert.deepEqual(f.tables.scenarioTopic.filter((l) => l.scenarioId === s2.copyId).map((l) => [l.topicId, l.weight]), [['topCafe', 2], ['topStation', 1]])
})

// ── restore ──

test('restore — 숨김: override 삭제로 다시 보임 · 없으면 404 NOT_OVERRIDDEN · 남의 override 는 못 지움', async () => {
  const f = fixture()
  await hideSeed(U, 'TOPIC', 'topCafe', f.deps())
  await assert.rejects(restoreSeed(V, 'TOPIC', 'topCafe', {}, f.deps()), reason('NOT_FOUND', 'NOT_OVERRIDDEN'))
  assert.equal(f.tables.userSeedOverride.length, 1)
  const r = await restoreSeed(U, 'TOPIC', 'topCafe', {}, f.deps())
  assert.deepEqual(r, { kind: 'TOPIC', seedId: 'topCafe', path: 'HIDDEN', copyId: null, removal: null })
  assert.equal(await isSeedVisibleFor(f.db, U, 'TOPIC', 'topCafe'), true)
  await assert.rejects(restoreSeed(U, 'TOPIC', 'topCafe', {}, f.deps()), reason('NOT_FOUND', 'NOT_OVERRIDDEN'))
})

test('restore — 상황 사본: 사본 ARCHIVED(#165 의미) + override 삭제, 시드 불변', async () => {
  const f = fixture()
  const before = seedSnap(f)
  const k = await forkSeedScenario(U, 'scnOrder', { title: '내 것' }, f.deps())
  const r = await restoreSeed(U, 'SCENARIO', 'scnOrder', {}, f.deps())
  assert.deepEqual([r.path, r.copyId], ['COPY', k.copyId])
  assert.equal(f.tables.scenario.find((s) => s.id === k.copyId)!.status, 'ARCHIVED')
  assert.equal(f.tables.userSeedOverride.length, 0)
  assert.equal(seedSnap(f), before)
  const again = await forkSeedScenario(U, 'scnOrder', {}, f.deps())
  assert.notEqual(again.copyId, k.copyId, '되돌린 뒤 새로 고치면 새 사본')
  assert.deepEqual(invariantViolations(f.tables), [])
})

test('restore — 주제 사본: 주입된 삭제 포트에 ack 전달 → 사본 삭제 + override 삭제 · 포트 미연결이면 FEATURE_NOT_READY 이고 아무것도 안 지움', async () => {
  const f = fixture()
  const t = await forkSeedTopic(U, 'topCafe', {}, f.deps())
  await assert.rejects(restoreSeed(U, 'TOPIC', 'topCafe', { ack: 'none' }, f.deps()), reason('FEATURE_NOT_READY', 'TOPIC_REMOVAL_UNAVAILABLE'))
  assert.equal(f.tables.userSeedOverride.length, 1)
  assert.ok(f.tables.conversationTopic.some((x) => x.id === t.copyId))
  const calls: unknown[] = []
  const r = await restoreSeed(U, 'TOPIC', 'topCafe', { ack: 'none' }, f.deps({ removeTopic: fakeRemoval(f, calls) }))
  assert.deepEqual(calls, [{ userId: U, topicId: t.copyId, ack: 'none' }])
  assert.deepEqual([r.path, r.copyId, r.removal], ['COPY', t.copyId, { topicId: t.copyId, challengesRemoved: 0 }])
  assert.equal(f.tables.conversationTopic.some((x) => x.id === t.copyId), false)
  assert.equal(f.tables.userSeedOverride.length, 0)
  assert.equal(await isSeedVisibleFor(f.db, U, 'TOPIC', 'topCafe'), true)
})

test('restore — 포트가 409 IMPACT_CHANGED 를 던지면 override 를 지우지 않는다(같은 tx 실패)', async () => {
  const f = fixture()
  await forkSeedTopic(U, 'topCafe', {}, f.deps())
  const port: TopicRemovalPort = async () => {
    throw new ApiError('CONFLICT', '바뀌었어요', { reason: 'IMPACT_CHANGED' })
  }
  await assert.rejects(restoreSeed(U, 'TOPIC', 'topCafe', { ack: 'none' }, f.deps({ removeTopic: port })), reason('CONFLICT', 'IMPACT_CHANGED'))
  assert.equal(f.tables.userSeedOverride.length, 1)
})

test('고아 override — 사본이 사라진(주제)·지운(상황 ARCHIVED) override 는 숨김으로 읽고 · fork 409 · restore 가 포트 없이 정리', async () => {
  const f = fixture()
  f.tables.userSeedOverride.push({ id: 'ov1', userId: U, kind: 'TOPIC', seedId: 'topCafe', copyId: 'gone', createdAt: OLD, updatedAt: OLD })
  const k = await forkSeedScenario(U, 'scnOrder', {}, f.deps())
  f.tables.scenario.find((s) => s.id === k.copyId)!.status = 'ARCHIVED'
  assert.deepEqual(await hiddenSeedIds(f.db, U, 'TOPIC'), ['topCafe'])
  const list = await listSeedOverrides(f.db, U)
  assert.deepEqual(list.map((o) => [o.kind, o.seedId, o.state, o.copyId, o.orphan]).sort(), [['SCENARIO', 'scnOrder', 'HIDDEN', null, true], ['TOPIC', 'topCafe', 'HIDDEN', null, true]])
  assert.equal(await resolvePlaceTopicId(f.db, U, 'topCafe'), 'topCafe', '고아는 치환하지 않는다')
  await assert.rejects(forkSeedTopic(U, 'topCafe', {}, f.deps()), (e) => reason('CONFLICT', 'ALREADY_COPIED')(e) && (e as ApiError).details?.state === 'HIDDEN')
  const calls: unknown[] = []
  const r = await restoreSeed(U, 'TOPIC', 'topCafe', {}, f.deps({ removeTopic: fakeRemoval(f, calls) }))
  assert.deepEqual([r.path, r.copyId, calls.length], ['ORPHAN', 'gone', 0])
  const s = await restoreSeed(U, 'SCENARIO', 'scnOrder', {}, f.deps())
  assert.deepEqual([s.path, f.tables.scenario.find((x) => x.id === k.copyId)!.status], ['ORPHAN', 'ARCHIVED'])
  assert.deepEqual(f.tables.userSeedOverride, [])
})

// ── 도구 ──

test('도구 — visibleSeedWhere·listSeedOverrides·detachCopy·parseSeedRefBody·normalizeTopicInput', async () => {
  assert.deepEqual(visibleSeedWhere([]), { userId: null })
  assert.deepEqual(visibleSeedWhere(['a']), { userId: null, id: { notIn: ['a'] } })
  const f = fixture()
  const t = await forkSeedTopic(U, 'topCafe', {}, f.deps())
  await hideSeed(U, 'SCENARIO', 'scnOrder', f.deps())
  await forkSeedTopic(V, 'topCafe', {}, f.deps())
  const mine = await listSeedOverrides(f.db, U)
  assert.deepEqual(mine.map((o) => [o.kind, o.state, o.copyId]).sort(), [['SCENARIO', 'HIDDEN', null], ['TOPIC', 'COPIED', t.copyId]])
  assert.deepEqual((await listSeedOverrides(f.db, U, 'TOPIC')).length, 1)
  assert.equal(await detachCopy(f.db, U, 'TOPIC', t.copyId), 1)
  assert.deepEqual(f.tables.userSeedOverride.filter((o) => o.copyId === null).map((o) => o.userId).sort(), [U, U], 'V 의 사본 override 는 그대로')
  assert.deepEqual(parseSeedRefBody({ kind: 'TOPIC', seedId: 'topCafe', ack: 'none' }), { kind: 'TOPIC', seedId: 'topCafe', ack: 'none' })
  assert.deepEqual(parseSeedRefBody({ kind: 'SCENARIO', seedId: 'x1' }), { kind: 'SCENARIO', seedId: 'x1', ack: null })
  assert.throws(() => parseSeedRefBody({ kind: 'X', seedId: 'a' }), reason('VALIDATION', 'enum'))
  assert.throws(() => parseSeedRefBody({ kind: 'TOPIC', seedId: '../a' }), reason('VALIDATION', 'invalid'))
  assert.throws(() => parseSeedRefBody({ kind: 'TOPIC', seedId: 'a', ack: 'drop table' }), reason('VALIDATION', 'invalid'))
  assert.deepEqual(normalizeTopicInput({ description: '  ', titleJa: null }), { value: { description: null, titleJa: null }, problems: [] })
})
