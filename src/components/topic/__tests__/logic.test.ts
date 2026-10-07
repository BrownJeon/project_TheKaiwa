import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ChallengeSummary } from '@/types/challenge'
import type { Topic } from '@/types/lesson'
import type { ScenarioListItem } from '@/types/scenario'
import type { SeedOverrideItem } from '@/types/seedOverride'
import {
  activeChallengeBadge,
  buildScenarioRows,
  buildTopicSections,
  copyIdSet,
  filterScenarioRows,
  hiddenSeedCount,
  manageHref,
  parseManageTab,
  scenarioCountByTopic,
  scenarioOrigin,
  topicHref,
  topicLimitReached,
  topicOrigin,
} from '../logic'

const ov = (o: Partial<SeedOverrideItem>): SeedOverrideItem => ({
  kind: 'TOPIC',
  seedId: 's1',
  seedTitle: '카페',
  state: 'COPIED',
  copyId: 'c1',
  orphan: false,
  updatedAt: '2026-10-07T00:00:00.000Z',
  ...o,
})

const topic = (o: Partial<Topic>): Topic => ({
  id: 't',
  title: '주제',
  titleJa: null,
  level: 'N4',
  description: null,
  tags: [],
  isSeed: false,
  chunks: [],
  lessonCount: 0,
  lastLessonAt: null,
  ...o,
})

const chunks = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `k${i}`, chunkType: 'NAME' as const, textJa: '口座', reading: 'こうざ', meaningKo: '계좌', order: i }))

const sc = (o: Partial<ScenarioListItem>): ScenarioListItem => ({
  id: 'x',
  title: '상황',
  titleJa: null,
  level: 'N5',
  difficulty: 2,
  isMine: false,
  roles: { learner: '손님', tutor: '점원' },
  goalKo: '주문하기',
  stepCount: 3,
  expressionCount: 4,
  topics: [],
  recommended: false,
  ...o,
})

const challenge = (o: { status?: ChallengeSummary['status']; topicId?: string | null; day?: number }): ChallengeSummary =>
  ({
    id: 'ch1',
    title: '병원 진료 14일',
    topic: { id: o.topicId === undefined ? 't1' : o.topicId, title: '병원 진료', exists: o.topicId !== null },
    level: 'N4',
    lengthDays: 14,
    startDate: '2026-10-04',
    endDate: '2026-10-17',
    status: o.status ?? 'ACTIVE',
    stats: { dayIndex: o.day ?? 4 },
  }) as unknown as ChallengeSummary

test('copyIdSet — 그 종류의 내 버전만(숨김·고아·다른 종류 제외)', () => {
  const set = copyIdSet(
    [
      ov({ copyId: 'c1' }),
      ov({ seedId: 's2', state: 'HIDDEN', copyId: null }),
      ov({ seedId: 's3', copyId: 'c3', orphan: true }),
      ov({ kind: 'SCENARIO', seedId: 'q1', copyId: 'qc1' }),
    ],
    'TOPIC',
  )
  assert.deepEqual([...set], ['c1'])
  assert.deepEqual([...copyIdSet([ov({ kind: 'SCENARIO', copyId: 'qc1' })], 'SCENARIO')], ['qc1'])
})

test('hiddenSeedCount — 숨김 + 고아(주제·상황 합), 살아 있는 내 버전은 셈하지 않음', () => {
  assert.equal(hiddenSeedCount([ov({}), ov({ state: 'HIDDEN', copyId: null }), ov({ kind: 'SCENARIO', state: 'HIDDEN', copyId: null }), ov({ orphan: true })]), 3)
  assert.equal(hiddenSeedCount([]), 0)
})

test('topicOrigin·scenarioOrigin — isSeed/isMine → SEED, 사본 id → COPY, 그 밖 MINE', () => {
  const copies = new Set(['c1'])
  assert.equal(topicOrigin({ id: 's1', isSeed: true }, copies), 'SEED')
  assert.equal(topicOrigin({ id: 'c1', isSeed: false }, copies), 'COPY')
  assert.equal(topicOrigin({ id: 'm1', isSeed: false }, copies), 'MINE')
  assert.equal(scenarioOrigin({ id: 'c1', isMine: false }, copies), 'SEED')
  assert.equal(scenarioOrigin({ id: 'c1', isMine: true }, copies), 'COPY')
  assert.equal(scenarioOrigin({ id: 'm1', isMine: true }, copies), 'MINE')
})

test('scenarioCountByTopic — 여러 주제에 이어진 상황은 주제마다 1, 같은 주제 중복은 1번', () => {
  const m = scenarioCountByTopic([
    sc({ id: 'a', topics: [{ id: 't1', title: '', titleJa: null }, { id: 't2', title: '', titleJa: null }] }),
    sc({ id: 'b', topics: [{ id: 't1', title: '', titleJa: null }, { id: 't1', title: '', titleJa: null }] }),
    sc({ id: 'c', topics: [] }),
  ])
  assert.equal(m.get('t1'), 2)
  assert.equal(m.get('t2'), 1)
  assert.equal(m.get('t3'), undefined)
})

test('activeChallengeBadge — 진행 중·1일째 이상·주제 있음일 때만', () => {
  assert.deepEqual(activeChallengeBadge({ items: [challenge({ day: 4 })] }), { topicId: 't1', day: 4 })
  assert.equal(activeChallengeBadge({ items: [challenge({ day: 0 })] }), null)
  assert.equal(activeChallengeBadge({ items: [challenge({ topicId: null })] }), null)
  assert.equal(activeChallengeBadge({ items: [challenge({ status: 'COMPLETED' })] }), null)
  assert.equal(activeChallengeBadge({ items: [] }), null)
  assert.equal(activeChallengeBadge(null), null)
})

test('buildTopicSections — 내가 만든 절은 MINE, 기본 절은 기본(서버 순서) 뒤 내 버전(이름순), 한도 셈은 MINE+COPY', () => {
  const topics = [
    topic({ id: 's1', title: '카페 주문', isSeed: true, chunks: chunks(12) }),
    topic({ id: 'm1', title: '은행 계좌', titleJa: '銀行で口座を作る', chunks: chunks(10) }),
    topic({ id: 'c2', title: '하', isSeed: false }),
    topic({ id: 's2', title: '길 묻기', isSeed: true, titleJa: '  ' }),
    topic({ id: 'c1', title: '가', isSeed: false }),
  ]
  const out = buildTopicSections(topics, {
    copyIds: new Set(['c1', 'c2']),
    scenarioCounts: new Map([['s1', 3]]),
    active: { topicId: 'm1', day: 2 },
  })
  assert.deepEqual(
    out.mine.map((r) => r.id),
    ['m1'],
  )
  assert.deepEqual(
    out.seed.map((r) => [r.id, r.origin]),
    [
      ['s1', 'SEED'],
      ['s2', 'SEED'],
      ['c1', 'COPY'],
      ['c2', 'COPY'],
    ],
  )
  assert.equal(out.ownedCount, 3)
  const s1 = out.seed[0]
  assert.equal(s1.scenarioCount, 3)
  assert.equal(s1.chunkCount, 12)
  assert.equal(out.seed[1].scenarioCount, 0)
  assert.equal(out.seed[1].titleJa, null)
  assert.equal(out.mine[0].challengeDay, 2)
  assert.equal(out.mine[0].titleJa, '銀行で口座を作る')
  assert.equal(s1.challengeDay, null)
})

test('buildTopicSections — #161 실패(null)면 상황 수 null(행은 「기본 표현 n개」만)', () => {
  const out = buildTopicSections([topic({ id: 'm1' })], { copyIds: new Set(), scenarioCounts: null, active: null })
  assert.equal(out.mine[0].scenarioCount, null)
})

test('topicLimitReached — 30개부터 막힘', () => {
  assert.equal(topicLimitReached(29), false)
  assert.equal(topicLimitReached(30), true)
})

test('buildScenarioRows·filterScenarioRows — 칩 셈, 「내가 만든」=MINE, 「기본」=기본+내 버전, 한도 셈=MINE+COPY', () => {
  const r = buildScenarioRows([sc({ id: 'seed1' }), sc({ id: 'mine1', isMine: true }), sc({ id: 'copy1', isMine: true }), sc({ id: 'seed2' })], new Set(['copy1']))
  assert.deepEqual(r.counts, { all: 4, mine: 1, seed: 3 })
  assert.equal(r.ownedCount, 2)
  assert.deepEqual(
    filterScenarioRows(r.rows, 'mine').map((x) => x.item.id),
    ['mine1'],
  )
  assert.deepEqual(
    filterScenarioRows(r.rows, 'seed').map((x) => x.item.id),
    ['seed1', 'copy1', 'seed2'],
  )
  assert.equal(filterScenarioRows(r.rows, 'all').length, 4)
})

test('주소 — 주제 탭은 쿼리 없음, 상황 탭·시트, 잘못된 탭 값은 주제', () => {
  assert.equal(manageHref('topics'), '/settings/scenarios')
  assert.equal(manageHref('scenarios'), '/settings/scenarios?tab=scenarios')
  assert.equal(manageHref('scenarios', 'ab c'), '/settings/scenarios?tab=scenarios&sc=ab%20c')
  assert.equal(parseManageTab('scenarios'), 'scenarios')
  assert.equal(parseManageTab(['scenarios']), 'topics')
  assert.equal(parseManageTab(undefined), 'topics')
  assert.equal(topicHref('a/b'), '/settings/scenarios/topics/a%2Fb')
})
