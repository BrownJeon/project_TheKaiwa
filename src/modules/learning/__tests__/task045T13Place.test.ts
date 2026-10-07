/**
 * task-045 T1-3 — 서비스 쪽 고정(DB·LLM 없음, 메모리 가짜 DB):
 * - 장소 저장 검사(REV-150 L4, Leader 결정): #163·#164 의 `topicIds` 가 **이 사용자가 가린 시드 주제**(숨김·내 버전·고아)면 400 `not_linked`, 쓰기 0.
 *   내 버전(사본) id·보이는 시드·내 주제는 통과, 없는/남의 주제는 기존 `not_found` 그대로, 다른 사용자의 override 는 영향 없음, 시드가 없으면 override 를 읽지 않음.
 * - #164 `opening: null` = 첫마디 지우기(계약 §8 ③) — 단계·표현은 그대로.
 * - #179 `listSeedOverrideItems`: 본인 override 만 · 시드 제목은 공유 시드 행에서만(남의 행 id 를 가리켜도 제목 null) · `kind` 필터.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { createScenario, getScenarioDetail, updateScenario } from '../scenarios/catalog'
import { listSeedOverrideItems } from '../seedOverride'
import { scenarioFakeDb } from './scenarioFakeDb'

const ME = 'cuser000000000000000me045'
const OTHER = 'cuser000000000000other045'
const T0 = new Date('2026-09-01T00:00:00.000Z')

function seeded() {
  const f = scenarioFakeDb()
  f.tables.conversationTopic.push(
    { id: 'topic_cafe', userId: null, isSeed: true, title: '카페', titleJa: 'カフェ', createdAt: T0 },
    { id: 'topic_road', userId: null, isSeed: true, title: '길 묻기', titleJa: '道を聞く', createdAt: T0 },
    { id: 'topic_shop', userId: null, isSeed: true, title: '가게', titleJa: '店', createdAt: T0 },
    { id: 'topic_cafe_mine', userId: ME, isSeed: false, title: '카페(내 버전)', titleJa: 'カフェ', createdAt: T0 },
    { id: 'topic_mine', userId: ME, isSeed: false, title: '내 주제', titleJa: null, createdAt: T0 },
    { id: 'topic_other', userId: OTHER, isSeed: false, title: '남의 주제', titleJa: null, createdAt: T0 },
  )
  f.tables.scenario.push({
    id: 'scn_seed', userId: null, isSeed: true, status: 'ACTIVE', title: '시드 상황', titleJa: null, description: null, level: 'N5', difficulty: 2,
    roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoal_ko: '주문', successCriteria: ['주문'] }, constraints: { steps: [{ ko: '인사' }] },
    keyExpressions: [{ id: 'e1', ja: 'ください', ko: '주세요' }], completionRule: { requiredExpressions: 1 }, grammarPoints: null, createdAt: T0, updatedAt: T0,
  })
  const ov = (id: string, userId: string, kind: string, seedId: string, copyId: string | null) => ({ id, userId, kind, seedId, copyId, createdAt: T0, updatedAt: T0 })
  f.tables.userSeedOverride.push(
    ov('ov1', ME, 'TOPIC', 'topic_cafe', 'topic_cafe_mine'), // 내 버전
    ov('ov2', ME, 'TOPIC', 'topic_road', null), // 숨김
    ov('ov3', ME, 'TOPIC', 'topic_shop', 'topic_gone'), // 고아(사본 행 없음)
    ov('ov4', OTHER, 'TOPIC', 'topic_mine', null), // 남의 override(시드도 아닌 id) — ME 에 영향 없음
    ov('ov5', ME, 'SCENARIO', 'scn_seed', null),
    ov('ov6', ME, 'SCENARIO', 'topic_other', null), // 시드 상황이 아닌 id 를 가리키는 위조 행 — 제목이 나오면 안 된다
  )
  return f
}

const body = (topicIds: string[]) => ({
  title: '편의점에서 계산하기',
  titleJa: 'コンビニで会計する',
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '봉투를 묻고 답해요', successCriteria: ['봉투 필요 여부 답하기'] },
  steps: [{ ko: '인사하기' }, { ko: '봉투 묻기' }],
  keyExpressions: [{ ja: '袋はいりません', ko: '봉투는 필요 없어요' }, { ja: 'カードで', ko: '카드로' }],
  opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' },
  topicIds,
})

const fieldErr = (field: string, reason: string) => (e: unknown) => {
  assert.ok(e instanceof ApiError, String(e))
  assert.equal(e.code, 'VALIDATION')
  assert.equal(e.details?.field, field)
  assert.equal(e.details?.reason, reason)
  return true
}

test('#163 장소: 가린 시드 주제(숨김·내 버전으로 바꿈·고아) 400 not_linked · 쓰기 0 — 문구는 목록 새로 고침 안내', async () => {
  for (const hidden of ['topic_road', 'topic_cafe', 'topic_shop']) {
    const f = seeded()
    const before = JSON.stringify(f.tables)
    await assert.rejects(createScenario(ME, body(['topic_mine', hidden]), f.deps()), fieldErr('topicIds[1]', 'not_linked'))
    assert.equal(JSON.stringify(f.tables), before, hidden)
  }
})

test('#163 장소: 내 버전 id·내 주제 통과(연결 저장) · 없는/남의 주제는 기존 not_found 그대로(가린 시드보다 앞 칸이면 그 칸이 첫 문제)', async () => {
  const f = seeded()
  const d = await createScenario(ME, body(['topic_cafe_mine', 'topic_mine']), f.deps())
  assert.deepEqual(f.tables.scenarioTopic.filter((l) => l.scenarioId === d.id).map((l) => l.topicId).sort(), ['topic_cafe_mine', 'topic_mine'])
  await assert.rejects(createScenario(ME, body(['topic_other', 'topic_road']), f.deps()), (e: unknown) => {
    fieldErr('topicIds[0]', 'not_found')(e)
    assert.deepEqual((e as ApiError).details?.problems && ((e as ApiError).details!.problems as { reason: string }[]).map((p) => p.reason), ['not_found', 'not_linked'])
    return true
  })
})

test('#163 장소: 다른 사용자의 override 는 영향 없음 — OTHER 는 ME 가 숨긴 시드 주제를 고를 수 있다 · 시드가 없으면 override 를 읽지 않는다', async () => {
  const f = seeded()
  const d = await createScenario(OTHER, body(['topic_road', 'topic_other']), f.deps())
  assert.equal(d.isMine, true)
  // 저장(scenario.create) 앞의 override 읽기만 센다 — 저장 뒤 상세 응답 조합(목록 가시성)의 읽기는 별개.
  const beforeCreate = (log: readonly string[]) => log.slice(0, log.indexOf('scenario.create')).filter((l) => l.startsWith('userSeedOverride.')).length
  assert.equal(beforeCreate(f.log), 1, '시드가 있으면 1회')
  const g = seeded()
  await createScenario(ME, body(['topic_mine', 'topic_cafe_mine']), g.deps())
  assert.equal(beforeCreate(g.log), 0, '내 주제·내 버전만이면 override 를 읽지 않는다')
  const h = seeded()
  h.reads.length = 0
  await assert.rejects(createScenario(ME, body(['topic_road']), h.deps()), fieldErr('topicIds[0]', 'not_linked'))
  const overrideReads = h.reads.filter((r) => r.op === 'userSeedOverride')
  assert.equal(overrideReads.length, 1)
  assert.deepEqual(overrideReads[0].where, { userId: ME, kind: 'TOPIC' }, '이 사용자·주제 종류로만 읽는다')
})

test('#164 장소: 가린 시드 주제로 고치기 400 not_linked(제목 같은 다른 칸도 안 바뀜) · 내 버전 id 는 통과', async () => {
  const f = seeded()
  const d = await createScenario(ME, body(['topic_mine']), f.deps())
  const before = JSON.stringify(f.tables.scenario.find((r) => r.id === d.id))
  await assert.rejects(updateScenario(ME, d.id, { title: '바뀐 제목', topicIds: ['topic_road'] }, f.deps()), fieldErr('topicIds[0]', 'not_linked'))
  assert.equal(JSON.stringify(f.tables.scenario.find((r) => r.id === d.id)), before)
  const u = await updateScenario(ME, d.id, { topicIds: ['topic_cafe_mine'] }, f.deps())
  assert.deepEqual(f.tables.scenarioTopic.filter((l) => l.scenarioId === u.id).map((l) => l.topicId), ['topic_cafe_mine'])
})

test('#164 opening:null = 첫마디 지우기(계약 §8 ③) — 상세에서 opening 키 빠짐 · 저장 constraints.opening null · 단계·표현 그대로 · 칸을 빼면 유지', async () => {
  const f = seeded()
  const d = await createScenario(ME, body(['topic_mine']), f.deps())
  assert.deepEqual(d.opening, { ja: 'いらっしゃいませ。', ko: '어서 오세요.' })
  const kept = await updateScenario(ME, d.id, { title: '제목만' }, f.deps())
  assert.deepEqual(kept.opening, d.opening, '칸을 빼면 첫마디 유지')
  const cleared = await updateScenario(ME, d.id, { opening: null }, f.deps())
  assert.equal('opening' in cleared, false, '상세는 첫마디가 없으면 opening 키를 싣지 않는다(#162 기존 모양)')
  assert.deepEqual(cleared.steps, d.steps)
  assert.deepEqual(cleared.keyExpressions, d.keyExpressions)
  assert.equal('opening' in (await getScenarioDetail(ME, d.id, f.deps())), false, '다시 읽어도 지워져 있다')
  const row = f.tables.scenario.find((r) => r.id === d.id)!
  assert.equal((row.constraints as Record<string, unknown>).opening, null)
})

test('#179 listSeedOverrideItems — 본인 override 만 · 공유 시드 제목만(남의 행을 가리키면 null) · 고아는 HIDDEN·copyId null · kind 필터', async () => {
  const f = seeded()
  const mine = await listSeedOverrideItems(ME, undefined, f.db)
  const byId = new Map(mine.map((i) => [`${i.kind}:${i.seedId}`, i]))
  assert.equal(mine.length, 5)
  assert.deepEqual(
    [...byId.values()].map((i) => [i.kind, i.seedId, i.seedTitle, i.state, i.copyId, i.orphan]).sort(),
    [
      ['SCENARIO', 'scn_seed', '시드 상황', 'HIDDEN', null, false],
      ['SCENARIO', 'topic_other', null, 'HIDDEN', null, false],
      ['TOPIC', 'topic_cafe', '카페', 'COPIED', 'topic_cafe_mine', false],
      ['TOPIC', 'topic_road', '길 묻기', 'HIDDEN', null, false],
      ['TOPIC', 'topic_shop', '가게', 'HIDDEN', null, true],
    ].sort(),
  )
  assert.ok(!JSON.stringify(mine).includes('남의 주제'), '남의 행 제목 노출 0')
  const other = await listSeedOverrideItems(OTHER, undefined, f.db)
  assert.deepEqual(other.map((i) => [i.seedId, i.seedTitle]), [['topic_mine', null]], 'OTHER 는 자기 것 1개만, 시드가 아닌 행 제목 null')
  assert.deepEqual((await listSeedOverrideItems(ME, 'SCENARIO', f.db)).map((i) => i.kind), ['SCENARIO', 'SCENARIO'])
  assert.deepEqual(await listSeedOverrideItems('cuser_nobody_0000000000000', undefined, f.db), [])
})
