/**
 * task-010d A3a — 시드 상황 로더(`prisma/seed-scenarios.ts`) 단위 테스트(DB 없음). 검사(문제 전부 모음)·안정 id·계획(create/keep/update·연결 교체·지우지 않음)
 * · 시드가 아닌 행과 id 가 겹치면 멈춤 · 실제 `seed-data/scenarios.json`(PE 작성)이 있으면 그 파일도 검사한다(없으면 건너뜀).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSeedScenarios, planSeedScenarios, seedScenarioId, summarizeSeedScenariosPlan, type ExistingScenario } from '../../../../prisma/seed-scenarios'
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
