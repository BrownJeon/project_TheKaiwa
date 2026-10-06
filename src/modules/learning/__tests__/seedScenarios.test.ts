/**
 * task-010d A3a — 시드 상황 로더(`prisma/seed-scenarios.ts`) 단위 테스트(DB 없음). 검사(문제 전부 모음)·안정 id·계획(create/keep/update·연결 교체·지우지 않음)
 * · 시드가 아닌 행과 id 가 겹치면 멈춤 · 쓰기 단계(가짜 prisma — update 데이터에 상태 없음·DbNull·연결 교체 범위, REV-134 L-3)
 * · 실제 `seed-data/scenarios.json`(PE 작성)이 있으면 그 파일도 검사한다(없으면 건너뜀).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma, type PrismaClient } from '@prisma/client'
import { parseSeedScenarios, planSeedScenarios, seedScenarioId, seedScenarios, summarizeSeedScenariosPlan, type ExistingScenario } from '../../../../prisma/seed-scenarios'
import type { SeedTopicInput } from '../../../../prisma/seed-topics'

const TOPIC_KEYS = new Set(['cafe', 'road'])

const entry = (over: Record<string, unknown> = {}) => ({
  key: 'cafe-size',
  topics: [{ key: 'cafe', weight: 2 }],
  title: '사이즈·온도 바꿔 주문하기',
  titleJa: 'サイズと温度を変えて注文する',
  level: 'N5',
  difficulty: 2,
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '원하는 온도·크기로 음료를 주문해요', successCriteria: ['크기 말하기', '온도 말하기'] },
  steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }],
  opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요. 주문은요?' },
  keyExpressions: [
    { id: 'hot', ja: 'ホットで', ko: '따뜻한 걸로', chunkType: 'MODIFIER' },
    { id: 'size', ja: 'Mサイズ', ko: 'M 사이즈' },
    { id: 'please', ja: '〜にしてください', match: 'にしてください', ko: '~로 해 주세요' },
  ],
  constraints: { conditions: ['점원이 사이즈를 되묻는다'] },
  ...over,
})

test('검사 통과: 안정 id(scn_<key>) · 저장 모양(goal 저장 키·constraints 에 단계·첫마디·표현 고정 id·match) · 필수 수 기본 2', () => {
  const [s] = parseSeedScenarios([entry()], TOPIC_KEYS)
  assert.equal(s.id, 'scn_cafe-size')
  assert.equal(s.id, seedScenarioId('cafe-size'))
  assert.deepEqual(s.topics, [{ key: 'cafe', weight: 2 }])
  assert.deepEqual(s.data.goal, { communicativeGoal_ko: '원하는 온도·크기로 음료를 주문해요', successCriteria: ['크기 말하기', '온도 말하기'] })
  assert.deepEqual(s.data.constraints, { conditions: ['점원이 사이즈를 되묻는다'], steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }], opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요. 주문은요?' } })
  assert.deepEqual(s.data.keyExpressions, [
    { id: 'hot', ja: 'ホットで', ko: '따뜻한 걸로', chunkType: 'MODIFIER' },
    { id: 'size', ja: 'Mサイズ', ko: 'M 사이즈' },
    { id: 'please', ja: '〜にしてください', ko: '~로 해 주세요', match: 'にしてください' },
  ])
  assert.deepEqual(s.data.completionRule, { requiredExpressions: 2, tutorJudgement: true })
  const alias = parseSeedScenarios([entry({ goal: { communicativeGoal_ko: '저장 키로 쓴 목표', successCriteria: ['하나'] }, completionRule: { requiredExpressions: 3 } })], TOPIC_KEYS)[0]
  assert.equal((alias.data.goal as { communicativeGoal_ko: string }).communicativeGoal_ko, '저장 키로 쓴 목표')
  assert.equal(alias.data.completionRule.requiredExpressions, 3)
})

test('검사 실패: key 형식·중복 · 모르는 주제 key · 표현 id 없음/중복 · constraints 에 steps · 한도 — 전부 모아 한 번에 던진다', () => {
  const raw = [
    entry({ key: 'Bad Key' }),
    entry(),
    entry(),
    entry({ key: 'road-x', topics: [{ key: 'nowhere' }] }),
    entry({ key: 'expr', keyExpressions: [{ ja: 'A', ko: 'a' }, { id: 'x', ja: 'B', ko: 'b' }, { id: 'x', ja: 'C', ko: 'c' }] }),
    entry({ key: 'cons', constraints: { steps: [] } }),
    entry({ key: 'long', title: 'あ'.repeat(41) }),
  ]
  assert.throws(() => parseSeedScenarios(raw, TOPIC_KEYS), (e: Error) => {
    for (const want of ['key 는 소문자', 'key 중복: cafe-size', 'topics.json 의 key', 'keyExpressions[0].id', '표현 id 가 겹쳐요: x', 'constraints 는 객체이고', 'title: 제목은(는) 40자']) assert.ok(e.message.includes(want), `${want}\n${e.message}`)
    return true
  })
  assert.throws(() => parseSeedScenarios({}, TOPIC_KEYS), /배열/)
})

function existingOf(over: Partial<ExistingScenario> = {}): ExistingScenario {
  const [s] = parseSeedScenarios([entry()], TOPIC_KEYS)
  return { id: s.id, userId: null, isSeed: true, ...s.data, topics: [{ topicId: 'tp_cafe', weight: 2 }], ...over }
}

test('계획: 새 행 create · 같으면 keep(키 순서 무관) · 칸이 바뀌면 update · 연결이 다르면 교체 · 빠진 시드는 지우지 않음 · 시드 아닌 행과 겹치면 멈춤', () => {
  const seeds = parseSeedScenarios([entry(), entry({ key: 'road-ask', topics: [{ key: 'road' }] })], TOPIC_KEYS)
  const ids = new Map([['cafe', 'tp_cafe'], ['road', 'tp_road']])
  const fresh = planSeedScenarios(seeds, [], ids)
  assert.deepEqual(fresh.scenarios.map((s) => [s.id, s.action, s.linksChanged]), [['scn_cafe-size', 'create', true], ['scn_road-ask', 'create', true]])
  const reordered = existingOf({ goal: { successCriteria: ['크기 말하기', '온도 말하기'], communicativeGoal_ko: '원하는 온도·크기로 음료를 주문해요' } })
  const same = planSeedScenarios(seeds.slice(0, 1), [reordered, { ...existingOf({ id: 'scn_old', title: '빠진 시드' }) }], ids)
  assert.equal(same.scenarios[0].action, 'keep')
  assert.equal(same.scenarios[0].linksChanged, false)
  assert.deepEqual(same.orphans, [{ id: 'scn_old', title: '빠진 시드' }])
  assert.equal(summarizeSeedScenariosPlan(same).writes, 0)
  const changed = planSeedScenarios(seeds.slice(0, 1), [existingOf({ title: '옛 제목', topics: [{ topicId: 'tp_cafe', weight: 1 }] })], ids)
  assert.deepEqual([changed.scenarios[0].action, changed.scenarios[0].changes, changed.scenarios[0].linksChanged], ['update', ['title'], true])
  const pending = planSeedScenarios(seeds.slice(1), [], new Map([['cafe', 'tp_cafe'], ['road', null]]))
  assert.deepEqual(pending.scenarios[0].missingTopics, ['road'], '드라이런에서 아직 없는 주제')
  assert.throws(() => planSeedScenarios(seeds.slice(0, 1), [existingOf({ isSeed: false, userId: 'u1' })], ids), /시드가 아닌 행/)
})

const realFile = join(process.cwd(), 'prisma/seed-data/scenarios.json')
test('실제 seed-data/scenarios.json(있을 때) — 검사 통과·key 유일·주제 key 가 topics.json 에 있음', { skip: !existsSync(realFile) && 'scenarios.json 아직 없음(PE 작성 전)' }, () => {
  const topics = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/topics.json'), 'utf8')) as SeedTopicInput[]
  const seeds = parseSeedScenarios(JSON.parse(readFileSync(realFile, 'utf8')), new Set(topics.map((t) => t.key)))
  assert.ok(seeds.length > 0)
  assert.equal(new Set(seeds.map((s) => s.id)).size, seeds.length)
})

// ── 쓰기 단계(seedScenarios — 가짜 prisma, REV-134 L-3 ②) ─────────────────

const TOPIC_SEEDS: SeedTopicInput[] = [
  { key: 'cafe', title: '카페', titleJa: 'カフェ', level: 'N5', description: '카페', tags: [], chunks: [] },
  { key: 'road', title: '길 묻기', titleJa: '道を聞く', level: 'N5', description: '길', tags: [], chunks: [] },
]
const DB_TOPICS = [
  { id: 'tp_cafe', title: '카페', titleJa: 'カフェ', level: 'N5', description: '카페', tags: [], chunks: [] },
  { id: 'tp_road', title: '길 묻기', titleJa: '道を聞く', level: 'N5', description: '길', tags: [], chunks: [] },
]

type Call = { op: string; args: Record<string, unknown> }

function fakePrisma(existing: Record<string, unknown>[], topics: Record<string, unknown>[] = DB_TOPICS) {
  const calls: Call[] = []
  const write = (op: string) => async (args: Record<string, unknown>) => (calls.push({ op, args }), { count: 1 })
  const tx = {
    scenario: { create: write('scenario.create'), update: write('scenario.update'), delete: write('scenario.delete'), deleteMany: write('scenario.deleteMany') },
    scenarioTopic: { deleteMany: write('scenarioTopic.deleteMany'), createMany: write('scenarioTopic.createMany') },
  }
  const prisma = {
    conversationTopic: { findMany: async () => topics },
    scenario: { ...tx.scenario, findMany: async () => existing },
    scenarioTopic: tx.scenarioTopic,
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => (calls.push({ op: '$transaction', args: {} }), fn(tx)),
  }
  return { prisma: prisma as unknown as PrismaClient, calls }
}

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const log = console.log
  console.log = () => {}
  try {
    return await fn()
  } finally {
    console.log = log
  }
}

test('쓰기: 새 상황 create(시드·주인 없음·ACTIVE·grammarPoints 없으면 DbNull) + 그 상황 연결만 교체 · 상황마다 한 트랜잭션', async () => {
  const { prisma, calls } = fakePrisma([])
  const sum = await quiet(() => seedScenarios(prisma, [entry(), entry({ key: 'road-ask', topics: [{ key: 'road' }], grammarPoints: ['〜てください'] })], TOPIC_SEEDS))
  assert.deepEqual(calls.map((c) => c.op), ['$transaction', 'scenario.create', 'scenarioTopic.deleteMany', 'scenarioTopic.createMany', '$transaction', 'scenario.create', 'scenarioTopic.deleteMany', 'scenarioTopic.createMany'])
  const [c1, c2] = calls.filter((c) => c.op === 'scenario.create').map((c) => c.args.data as Record<string, unknown>)
  assert.deepEqual([c1.id, c1.userId, c1.isSeed, c1.status], ['scn_cafe-size', null, true, 'ACTIVE'])
  assert.equal(c1.grammarPoints, Prisma.DbNull, 'JSON 칸 null 은 DbNull(Prisma 의 JSON null 과 구별)')
  assert.deepEqual(c2.grammarPoints, ['〜てください'])
  assert.deepEqual(
    calls.filter((c) => c.op === 'scenarioTopic.deleteMany').map((c) => c.args),
    [{ where: { scenarioId: 'scn_cafe-size' } }, { where: { scenarioId: 'scn_road-ask' } }],
    'deleteMany 범위 = 그 상황의 연결뿐',
  )
  assert.deepEqual(calls.find((c) => c.op === 'scenarioTopic.createMany')!.args, { data: [{ scenarioId: 'scn_cafe-size', topicId: 'tp_cafe', weight: 2 }] })
  assert.deepEqual(sum, { scenarios: { keep: 0, update: 0, create: 2 }, linksChanged: 2, orphans: 0, writes: 4 })
})

test('쓰기: 바뀐 시드 update 는 상태·소유 칸을 싣지 않는다(숨긴 시드를 되살리지 않음) · 같으면 쓰기 0 · 빠진 시드 상황은 지우지 않음', async () => {
  const [s] = parseSeedScenarios([entry()], TOPIC_KEYS)
  const hidden = { id: s.id, userId: null, isSeed: true, status: 'ARCHIVED', ...s.data, title: '옛 제목', topics: [{ topicId: 'tp_cafe', weight: 2 }] }
  const orphan = { id: 'scn_old', userId: null, isSeed: true, status: 'ACTIVE', ...s.data, title: '빠진 시드', topics: [] }
  const { prisma, calls } = fakePrisma([hidden, orphan])
  await quiet(() => seedScenarios(prisma, [entry()], TOPIC_SEEDS))
  assert.deepEqual(calls.map((c) => c.op), ['$transaction', 'scenario.update'], '연결이 같으면 연결은 건드리지 않음')
  const up = calls[1].args as { where: unknown; data: Record<string, unknown> }
  assert.deepEqual(up.where, { id: s.id })
  for (const k of ['status', 'userId', 'isSeed', 'id']) assert.equal(k in up.data, false, `update 데이터에 ${k} 없음`)
  assert.equal(up.data.title, s.data.title)
  assert.equal(up.data.grammarPoints, Prisma.DbNull)
  assert.ok(!calls.some((c) => /delete/.test(c.op) && c.op !== 'scenarioTopic.deleteMany'), '상황 삭제 경로 없음(빠진 시드 scn_old 포함)')

  const same = fakePrisma([{ id: s.id, userId: null, isSeed: true, status: 'ACTIVE', ...s.data, topics: [{ topicId: 'tp_cafe', weight: 2 }] }])
  const sum = await quiet(() => seedScenarios(same.prisma, [entry()], TOPIC_SEEDS))
  assert.deepEqual(same.calls, [], '같으면 트랜잭션도 열지 않는다')
  assert.equal(sum.writes, 0)
})

test('쓰기 전 멈춤: 드라이런 = 쓰기 0 · 주제가 DB 에 없으면(실제 실행) 쓰기 전에 던짐 · 시드가 아닌 행과 id 가 겹치면 던짐 · 검사 실패면 DB 를 읽지도 않음', async () => {
  const dry = fakePrisma([])
  const plan = await quiet(() => seedScenarios(dry.prisma, [entry()], TOPIC_SEEDS, { dryRun: true }))
  assert.deepEqual(dry.calls, [])
  assert.equal(plan.writes, 2)
  const noTopic = fakePrisma([], [DB_TOPICS[1]])
  await assert.rejects(quiet(() => seedScenarios(noTopic.prisma, [entry()], TOPIC_SEEDS)), /주제가 DB 에 없어/)
  assert.deepEqual(noTopic.calls, [])
  const clash = fakePrisma([{ id: 'scn_cafe-size', userId: 'u1', isSeed: false, title: 'x', topics: [] }])
  await assert.rejects(quiet(() => seedScenarios(clash.prisma, [entry()], TOPIC_SEEDS)), /시드가 아닌 행/)
  assert.deepEqual(clash.calls, [])
  let read = false
  const strict = { conversationTopic: { findMany: async () => ((read = true), DB_TOPICS) } } as unknown as PrismaClient
  await assert.rejects(seedScenarios(strict, [entry({ title: '' })], TOPIC_SEEDS), /scenarios\.json 문제/)
  assert.equal(read, false)
  assert.throws(() => parseSeedScenarios([entry({ constraints: { exprSeq: 3 } })], TOPIC_KEYS), /exprSeq/)
})
