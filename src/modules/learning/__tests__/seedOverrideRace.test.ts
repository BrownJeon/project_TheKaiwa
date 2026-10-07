/**
 * task-045 T1 — 시드 override 경합 시험(계약 §4 "경합 시험을 T1 완료 기준에"). 가짜 DB 는 호출마다 양보해 동시 트랜잭션이 끼어들고,
 * 잠금은 사용자별 FIFO 뮤텍스다(먼저 부른 쪽이 먼저 잡는다). 끝 상태는 언제나 불변식(행 없음 | 살아 있는 내 사본 | 숨김)을 지킨다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, type Tx } from '@/modules/infra'
import { detachCopy, forkSeedScenario, forkSeedTopic, hideSeed, restoreSeed, type SeedOverrideDeps, type TopicRemovalPort } from '../seedOverride'
import { invariantViolations, seedOverrideFakeDb } from './seedOverrideFakeDb'

const U = 'userA'
const OLD = new Date('2026-09-01T00:00:00.000Z')

function fixture() {
  const f = seedOverrideFakeDb()
  f.tables.conversationTopic.push({ id: 'topCafe', userId: null, isSeed: true, title: '카페', titleJa: null, level: 'N5', description: null, tags: null, createdAt: OLD, updatedAt: OLD })
  f.tables.topicChunk.push({ id: 'chk1', topicId: 'topCafe', chunkType: 'NAME', textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', order: 0, note: null })
  f.tables.scenario.push({
    id: 'scnOrder', userId: null, isSeed: true, status: 'ACTIVE', title: '주문', titleJa: null, description: null, level: 'N5', difficulty: 2,
    roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoal_ko: '주문', successCriteria: ['주문'] }, constraints: { steps: [{ ko: '인사' }, { ko: '주문' }] },
    keyExpressions: [{ id: 'k1', ja: 'ください', ko: '주세요' }, { id: 'k2', ja: 'ありがとう', ko: '고마워요' }], grammarPoints: null,
    completionRule: { requiredExpressions: 1, tutorJudgement: true }, createdAt: OLD, updatedAt: OLD,
  })
  f.tables.scenarioTopic.push({ scenarioId: 'scnOrder', topicId: 'topCafe', weight: 1 })
  return f
}

const settled = (rs: PromiseSettledResult<unknown>[]) => rs.map((r) => (r.status === 'fulfilled' ? 'ok' : r.reason instanceof ApiError ? String((r.reason.details as { reason?: string })?.reason ?? r.reason.code) : `ERR ${String(r.reason)}`))

function removal(): TopicRemovalPort {
  return async (tx, userId, topicId) => {
    await tx.topicChunk.deleteMany({ where: { topicId } })
    await tx.conversationTopic.deleteMany({ where: { id: topicId, userId } })
    return { topicId }
  }
}

/** T3 의 "내 주제 삭제"(사본 id 직접 삭제)를 흉내 — 잠금 뒤 주제 삭제 + 같은 tx 에서 override 를 숨김으로(detachCopy). */
async function simulatedDeleteMyTopic(deps: Partial<SeedOverrideDeps>, topicId: string): Promise<string> {
  return deps.transaction!(async (tx: Tx) => {
    await deps.lockUser!(tx, U)
    const n = (await tx.conversationTopic.deleteMany({ where: { id: topicId, userId: U, isSeed: false } })).count
    if (!n) return 'gone'
    await detachCopy(tx, U, 'TOPIC', topicId)
    return 'deleted'
  })
}

test('경합 — 두 탭 동시 상황 fork: 하나만 성공·다른 하나 409 · 사본 1·override 1', async () => {
  const f = fixture()
  const rs = await Promise.allSettled([forkSeedScenario(U, 'scnOrder', { title: '탭1' }, f.deps()), forkSeedScenario(U, 'scnOrder', { title: '탭2' }, f.deps())])
  assert.deepEqual(settled(rs), ['ok', 'ALREADY_COPIED'])
  assert.equal(f.tables.scenario.filter((s) => s.userId === U).length, 1)
  assert.equal(f.tables.userSeedOverride.length, 1)
  assert.deepEqual(invariantViolations(f.tables), [])
})

test('경합 — 두 탭 동시 주제 fork: 하나만 성공 · 주제 사본 1·조각 사본 1·override 1', async () => {
  const f = fixture()
  const rs = await Promise.allSettled([forkSeedTopic(U, 'topCafe', {}, f.deps()), forkSeedTopic(U, 'topCafe', {}, f.deps())])
  assert.deepEqual(settled(rs), ['ok', 'ALREADY_COPIED'])
  assert.equal(f.tables.conversationTopic.filter((t) => t.userId === U).length, 1)
  assert.equal(f.tables.topicChunk.filter((c) => c.topicId !== 'topCafe').length, 1)
  assert.deepEqual(invariantViolations(f.tables), [])
})

test('경합 — fork × hide 두 순서: 먼저 잡은 쪽이 이기고 나중 쪽은 무변경/409 · override 1', async () => {
  const a = fixture()
  const ra = await Promise.allSettled([forkSeedScenario(U, 'scnOrder', {}, a.deps()), hideSeed(U, 'SCENARIO', 'scnOrder', a.deps())])
  assert.deepEqual(settled(ra), ['ok', 'ok'])
  assert.deepEqual((ra[1] as PromiseFulfilledResult<{ state: string; changed: boolean }>).value, { kind: 'SCENARIO', seedId: 'scnOrder', state: 'COPIED', changed: false })
  assert.equal(a.tables.userSeedOverride.length, 1)
  assert.notEqual(a.tables.userSeedOverride[0].copyId, null)
  const b = fixture()
  const rb = await Promise.allSettled([hideSeed(U, 'SCENARIO', 'scnOrder', b.deps()), forkSeedScenario(U, 'scnOrder', {}, b.deps())])
  assert.deepEqual(settled(rb), ['ok', 'ALREADY_COPIED'])
  assert.deepEqual([b.tables.userSeedOverride.length, b.tables.userSeedOverride[0].copyId, b.tables.scenario.filter((s) => s.userId === U).length], [1, null, 0])
  for (const g of [a, b]) assert.deepEqual(invariantViolations(g.tables), [])
})

test('경합 — restore × fork 두 순서(숨김에서 시작 / 사본에서 시작) · 끝 상태 불변식', async () => {
  const a = fixture()
  await hideSeed(U, 'SCENARIO', 'scnOrder', a.deps())
  const ra = await Promise.allSettled([restoreSeed(U, 'SCENARIO', 'scnOrder', {}, a.deps()), forkSeedScenario(U, 'scnOrder', {}, a.deps())])
  assert.deepEqual(settled(ra), ['ok', 'ok'], 'restore 가 먼저 숨김을 풀고 fork 가 사본을 만든다')
  assert.equal(a.tables.userSeedOverride.length, 1)
  const b = fixture()
  await forkSeedScenario(U, 'scnOrder', {}, b.deps())
  const rb = await Promise.allSettled([forkSeedScenario(U, 'scnOrder', {}, b.deps()), restoreSeed(U, 'SCENARIO', 'scnOrder', {}, b.deps())])
  assert.deepEqual(settled(rb), ['ALREADY_COPIED', 'ok'])
  assert.deepEqual([b.tables.userSeedOverride.length, b.tables.scenario.filter((s) => s.userId === U).map((s) => s.status)], [0, ['ARCHIVED']])
  const c = fixture()
  await forkSeedTopic(U, 'topCafe', {}, c.deps())
  const rc = await Promise.allSettled([restoreSeed(U, 'TOPIC', 'topCafe', { ack: 'none' }, c.deps({ removeTopic: removal() })), forkSeedTopic(U, 'topCafe', {}, c.deps())])
  assert.deepEqual(settled(rc), ['ok', 'ok'], '되돌린 뒤의 fork 는 새 사본')
  assert.equal(c.tables.conversationTopic.filter((t) => t.userId === U).length, 1)
  for (const g of [a, b, c]) assert.deepEqual(invariantViolations(g.tables), [])
})

test('경합 — restore × 내 주제 삭제(T3 흉내, detachCopy) 두 순서 · 고아 없음', async () => {
  for (const order of ['restoreFirst', 'deleteFirst'] as const) {
    const f = fixture()
    const t = await forkSeedTopic(U, 'topCafe', {}, f.deps())
    const restore = () => restoreSeed(U, 'TOPIC', 'topCafe', { ack: 'none' }, f.deps({ removeTopic: removal() }))
    const del = () => simulatedDeleteMyTopic(f.deps(), t.copyId)
    const rs = order === 'restoreFirst' ? await Promise.allSettled([restore(), del()]) : await Promise.allSettled([del(), restore()])
    assert.deepEqual(settled(rs), ['ok', 'ok'], order)
    const restored = rs[order === 'restoreFirst' ? 0 : 1] as PromiseFulfilledResult<{ path: string }>
    assert.equal(restored.value.path, order === 'restoreFirst' ? 'COPY' : 'HIDDEN', order)
    assert.deepEqual([f.tables.userSeedOverride.length, f.tables.conversationTopic.filter((x) => x.userId === U).length], [0, 0], order)
    assert.deepEqual(invariantViolations(f.tables), [], order)
  }
})

test('경합 — 다른 사용자끼리는 서로 막지 않는다(각자 사본) · 시드 로더가 시드 행을 고쳐도 사본은 그대로', async () => {
  const f = fixture()
  const rs = await Promise.allSettled([forkSeedScenario(U, 'scnOrder', { title: 'A' }, f.deps()), forkSeedScenario('userB', 'scnOrder', { title: 'B' }, f.deps())])
  assert.deepEqual(settled(rs), ['ok', 'ok'])
  assert.deepEqual(f.tables.userSeedOverride.map((o) => o.userId).sort(), [U, 'userB'])
  const seed = f.tables.scenario.find((s) => s.id === 'scnOrder')!
  seed.title = '시드 로더가 바꾼 제목'
  assert.deepEqual(f.tables.scenario.filter((s) => s.userId !== null).map((s) => s.title).sort(), ['A', 'B'])
  assert.deepEqual(invariantViolations(f.tables), [])
})
