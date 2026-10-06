/**
 * task-010d A3b-1 — learning 쪽 Leader 승인 additive 2함수(DB·LLM 없음, 가짜 db):
 *  - `readScenarioRolePlayMaterial`(start.ts): 접근 = 시드·본인만(타인 null), ARCHIVED 도 이어 감(새 시작은 `resolveScenarioChatStart` 409 그대로),
 *    `match` 포함, 참조 조각 없으면 쿼리 1회, 모양 틀린 JSON 에도 throw 없음.
 *  - `readScenarioRolePlayResult`(end.ts): 끝남 → 처음 결과(쓰기 0) · 안 끝남 null · 다른 사용자·다른 상황 null · 시간 하한.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { detectScenarioExpressions } from '../scenarios/expressions'
import { readScenarioRolePlayMaterial, resolveScenarioChatStart, type ScenarioMaterialDb, type ScenarioStartDb } from '../scenarios/start'
import { readScenarioRolePlayResult, SCENARIO_END_LOOKUP_MARGIN_MS } from '../scenarios/end'

const ME = 'cuser000000000000000me010'
const OTHER = 'cuser00000000000000other0'

type Row = Record<string, unknown>

/** 접근 where(`scenarioAccessWhere` 모양: `{id, OR:[{userId:null,isSeed:true},{userId}]}`)를 실제로 판정하는 가짜. */
function accessMatch(r: Row, where: { id: string; OR: Record<string, unknown>[] }): boolean {
  return r.id === where.id && where.OR.some((c) => Object.entries(c).every(([k, v]) => r[k] === v))
}

function materialDb(rows: Row[], chunks: Row[] = []) {
  const calls: string[] = []
  const db = {
    scenario: {
      findFirst: async (a: { where: { id: string; OR: Record<string, unknown>[] } }) => {
        calls.push('scenario.findFirst')
        const r = rows.find((x) => accessMatch(x, a.where))
        return r ? { ...r } : null
      },
    },
    topicChunk: {
      findMany: async (a: { where: { id: { in: string[] } } }) => {
        calls.push('topicChunk.findMany')
        return chunks.filter((c) => a.where.id.in.includes(c.id as string))
      },
    },
  }
  return { db: db as unknown as ScenarioMaterialDb, calls }
}

const base = (id: string, extra: Row = {}): Row => ({
  id,
  userId: null,
  isSeed: true,
  status: 'ACTIVE',
  title: '사이즈 바꿔 주문하기',
  titleJa: 'サイズを変えて注文する',
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoal_ko: '음료 크기를 바꿔 주문하기', successCriteria: ['크기 말하기'] },
  constraints: { steps: [{ ko: '인사' }, { ko: '주문' }], opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' }, exprSeq: 3 },
  keyExpressions: [
    { id: 'e1', ja: '〜にしてください', ko: '~로 해 주세요', match: 'にしてください' },
    { id: 'e2', ja: 'Lサイズ', ko: 'L 사이즈' },
  ],
  completionRule: { requiredExpressions: 1 },
  ...extra,
})

test('진행 재료: 시드·본인 상황은 읽고 남의 상황·주인 없는 비시드·형식 틀린 id 는 null(존재를 드러내지 않음)', async () => {
  const { db } = materialDb([base('scn_seed'), base('mine_1', { userId: ME, isSeed: false }), base('other_1', { userId: OTHER, isSeed: false }), base('orphan', { isSeed: false })])
  assert.equal((await readScenarioRolePlayMaterial(ME, 'scn_seed', db))?.id, 'scn_seed')
  assert.equal((await readScenarioRolePlayMaterial(ME, 'mine_1', db))?.id, 'mine_1')
  assert.equal(await readScenarioRolePlayMaterial(ME, 'other_1', db), null)
  assert.equal(await readScenarioRolePlayMaterial(ME, 'orphan', db), null)
  assert.equal(await readScenarioRolePlayMaterial(ME, '', db), null)
  assert.equal(await readScenarioRolePlayMaterial(ME, 'x'.repeat(41), db), null)
  assert.equal((await readScenarioRolePlayMaterial(OTHER, 'other_1', db))?.id, 'other_1', '주인에게는 보인다')
})

test('진행 재료: ARCHIVED 상황도 이어 간다(진행 중 역할극) — 새 역할극 시작은 resolveScenarioChatStart 가 409 ARCHIVED 로 그대로 막는다', async () => {
  const gone = base('mine_gone', { userId: ME, isSeed: false, status: 'ARCHIVED' })
  const { db } = materialDb([gone])
  const m = await readScenarioRolePlayMaterial(ME, 'mine_gone', db)
  assert.deepEqual([m?.id, m?.status], ['mine_gone', 'ARCHIVED'])
  const startDb = {
    lesson: { findFirst: async () => null },
    scenario: { findFirst: async (a: { where: { id: string; OR: Record<string, unknown>[] } }) => (accessMatch(gone, a.where) ? { ...gone, topics: [] } : null) },
  } as unknown as ScenarioStartDb
  await assert.rejects(resolveScenarioChatStart(ME, { scenarioId: 'mine_gone', lessonId: null, topicId: null }, startDb), (e: unknown) => {
    assert.ok(e instanceof ApiError)
    assert.equal(e.code, 'CONFLICT')
    assert.equal(e.details?.reason, 'ARCHIVED')
    return true
  })
})

test('진행 재료: 표현에 match 포함(코드 표현 확인이 카탈로그·종료와 같다) · 단계·첫마디·목표·필수 수 · 참조 조각 없으면 쿼리 1회', async () => {
  const { db, calls } = materialDb([base('scn_seed')])
  const m = await readScenarioRolePlayMaterial(ME, 'scn_seed', db)
  assert.ok(m)
  assert.deepEqual(calls, ['scenario.findFirst'], '참조 조각이 없으면 topicChunk 를 읽지 않는다')
  assert.equal(m.expressions[0].match, 'にしてください')
  assert.deepEqual(detectScenarioExpressions(['Mサイズにしてください'], m.expressions), ['e1'], 'match 로 확인')
  assert.deepEqual(m.steps, [{ ko: '인사' }, { ko: '주문' }])
  assert.deepEqual(m.opening, { ja: 'いらっしゃいませ。', ko: '어서 오세요.' })
  assert.deepEqual(m.roles, { learner: '손님', tutor: '점원' })
  assert.equal(m.goal.communicativeGoalKo, '음료 크기를 바꿔 주문하기')
  assert.equal(m.requiredExpressions, 1)
  assert.deepEqual(Object.keys(m.row).sort(), ['completionRule', 'constraints', 'goal', 'keyExpressions', 'roles'], '프롬프트 어댑터 입력은 저장 JSON 칸 그대로')
})

test('진행 재료: 참조 조각이 있으면 2회째 쿼리로 표기를 채우고, 옛 위치(goal.steps·goal.opening)·모양 틀린 칸에도 throw 없음', async () => {
  const odd = base('scn_odd', {
    goal: { communicativeGoal: '옛 키 목표', steps: ['옛 단계'], opening: { ja: 'どうぞ。' } },
    constraints: 'broken',
    keyExpressions: [{ chunkId: 'chunk_coffee' }, 7, null, { id: 'bad id!', ja: 'ください' }],
    completionRule: null,
    roles: [],
  })
  const { db, calls } = materialDb([odd], [{ id: 'chunk_coffee', textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME' }])
  const m = await readScenarioRolePlayMaterial(ME, 'scn_odd', db)
  assert.ok(m)
  assert.deepEqual(calls, ['scenario.findFirst', 'topicChunk.findMany'])
  assert.deepEqual(m.expressions.map((e) => [e.id, e.textJa]), [['chunk_coffee', 'コーヒー'], ['k4', 'ください']])
  assert.deepEqual(m.steps, [{ ko: '옛 단계' }])
  assert.deepEqual(m.opening, { ja: 'どうぞ。', ko: '' })
  assert.deepEqual(m.roles, { learner: '', tutor: '' })
  assert.equal(m.requiredExpressions, 2)
})

// ── 결과 읽기 ───────────────────────────────────────────────────────────────

const CHAT_AT = new Date('2026-10-07T01:00:00Z')
const OBS = {
  id: 'obs1',
  userId: ME,
  kind: 'SCENARIO_COMPLETED',
  refType: 'Chat',
  refId: 'chat_rp',
  scenarioId: 'scn_seed',
  occurredAt: new Date('2026-10-07T01:10:00Z'),
  meta: { outcome: 'ALMOST', goal: false, tutor: true, rule: false, comm: true, judged: true, used: 1, req: 2, total: 3, turns: 4, hints: 1, self: 0, logId: 'log1', repId: 'rep1' },
}
const LOG = { id: 'log1', userId: ME, result: { scenario: { scenarioId: 'scn_seed', usedExpressionIds: ['e1'], missedExpressionIds: ['e2', 'e3'], verifiedExpressionIds: ['e1'] } } }

function resultDb(obs: Row[], logs: Row[] = [LOG]) {
  const wheres: Record<string, unknown>[] = []
  const writes: string[] = []
  const gte = (v: unknown, w: unknown) => !w || typeof w !== 'object' || !('gte' in (w as object)) || (v as Date).getTime() >= ((w as { gte: Date }).gte as Date).getTime()
  const db = {
    learningObservation: {
      findFirst: async (a: { where: Record<string, unknown> }) => {
        wheres.push(a.where)
        const w = a.where
        // Prisma 처럼 값이 undefined 인 조건은 거르지 않는다.
        return (
          obs.find((o) => Object.entries(w).every(([k, v]) => v === undefined || (k === 'occurredAt' ? gte(o.occurredAt, v) : o[k] === v))) ?? null
        )
      },
      create: async () => (writes.push('obs.create'), null),
    },
    studyLog: {
      findFirst: async (a: { where: { id: string; userId: string } }) => logs.find((l) => l.id === a.where.id && l.userId === a.where.userId) ?? null,
      create: async () => (writes.push('log.create'), null),
    },
  }
  return { db: db as never, wheres, writes }
}

test('결과 읽기: 끝낸 대화 → 처음 결과(replayed)·표현 id·endedAt = 관측 시각, 쓰기 0 · 안 끝낸 대화 null', async () => {
  const { db, wheres, writes } = resultDb([OBS])
  const r = await readScenarioRolePlayResult(ME, { id: 'chat_rp', createdAt: CHAT_AT, scenarioId: 'scn_seed' }, db)
  assert.ok(r)
  assert.deepEqual([r.replayed, r.outcome, r.judged, r.tutorGoalAchieved, r.turns, r.studyLogId, r.repetitionItemId], [true, 'ALMOST', true, true, 4, 'log1', 'rep1'])
  assert.deepEqual(r.expressions, { usedIds: ['e1'], missedIds: ['e2', 'e3'], verifiedIds: ['e1'], required: 2, total: 3 })
  assert.equal(r.endedAt.getTime(), OBS.occurredAt.getTime())
  assert.deepEqual(writes, [])
  const w = wheres[0] as { occurredAt: { gte: Date } }
  assert.equal(w.occurredAt.gte.getTime(), CHAT_AT.getTime() - SCENARIO_END_LOOKUP_MARGIN_MS, '대화 생성 시각 − 하루 하한(전수 훑기 없음)')
  assert.equal(await readScenarioRolePlayResult(ME, { id: 'chat_open', createdAt: CHAT_AT, scenarioId: 'scn_seed' }, db), null)
})

test('결과 읽기: 다른 사용자·다른 상황의 관측은 null(소유자·상황 조건)', async () => {
  const { db, wheres } = resultDb([OBS])
  assert.equal(await readScenarioRolePlayResult(OTHER, { id: 'chat_rp', createdAt: CHAT_AT, scenarioId: 'scn_seed' }, db), null, '다른 사용자')
  assert.equal(await readScenarioRolePlayResult(ME, { id: 'chat_rp', createdAt: CHAT_AT, scenarioId: 'scn_other' }, db), null, '다른 상황')
  assert.deepEqual([wheres[0].userId, wheres[1].scenarioId], [OTHER, 'scn_other'])
  assert.equal(await readScenarioRolePlayResult(ME, { id: '', createdAt: CHAT_AT, scenarioId: 'scn_seed' }, db), null)
})
