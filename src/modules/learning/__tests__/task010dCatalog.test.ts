/**
 * task-010d A3a — 상황 목록·상세·추천·내 상황 만들기/고치기/지우기 단위 테스트(DB·LLM 없음, 메모리 가짜 DB).
 * 고정하는 것: 가시성(시드 + 내 것만, 남의 것 404·세부 없음) · 시드 고치기/지우기 불가(404 SEED) · 지운 상황(목록 제외·상세 404·고치기 409·지우기 멱등) ·
 * 입력 정리·한도(문제 전부 모음) · 표현 id(만들 때 서버가 정함·고칠 때 유지) · 추천 규칙(이유 4종·같은 날 제외·이유마다 하나 먼저·≤3) · 진행 중 대화 · 쓰는 표.
 * 실제 DB 경로는 `tests/live/task010d-a3a-smoke.ts`(QA 계정 4).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { SCENARIO_LIMITS } from '@/types/scenario'
import { archiveScenario, createScenario, getScenarioDetail, listScenarios, mergeScenarioFields, parseScenarioListQuery, updateScenario } from '../scenarios/catalog'
import { recommendScenarios, type RecommendCandidate, type RecommendSignals } from '../scenarios/recommend'
import { assignExpressionIds, cleanScenarioText, normalizeScenarioInput } from '../scenarios/shape'
import { readScenarioOpening, readScenarioSteps } from '../scenarios/view'
import { scenarioFakeDb, scenarioForeignWrites } from './scenarioFakeDb'

const ME = 'cuser000000000000000me010'
const OTHER = 'cuser000000000000other010'
const T0 = new Date('2026-09-01T00:00:00.000Z')

function expectApi(code: string, extra?: (e: ApiError) => void) {
  return (e: unknown) => {
    assert.ok(e instanceof ApiError, `ApiError 기대: ${String(e)}`)
    assert.equal(e.code, code)
    extra?.(e)
    return true
  }
}

function scenarioRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    userId: null,
    isSeed: true,
    status: 'ACTIVE',
    title: `상황 ${id}`,
    titleJa: `場面 ${id}`,
    description: null,
    level: 'N5',
    difficulty: 2,
    roles: { learner: '손님', tutor: '점원' },
    goal: { communicativeGoal_ko: '원하는 음료를 주문해요', successCriteria: ['크기 말하기', '온도 말하기'] },
    constraints: { steps: [{ ko: '인사하기' }, { ko: '주문하기' }, { ko: '계산하기' }], opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' } },
    keyExpressions: [
      { id: 'e1', ja: 'ホットで', ko: '따뜻한 걸로' },
      { id: 'e2', ja: 'Mサイズ', ko: 'M 사이즈' },
      { chunkId: 'chunk_coffee' },
    ],
    completionRule: { requiredExpressions: 2, tutorJudgement: true },
    grammarPoints: null,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  }
}

function seeded() {
  const f = scenarioFakeDb()
  f.tables.conversationTopic.push(
    { id: 'topic_cafe', userId: null, isSeed: true, title: '카페', titleJa: 'カフェ', createdAt: new Date('2026-08-01T00:00:00Z') },
    { id: 'topic_road', userId: null, isSeed: true, title: '길 묻기', titleJa: '道を聞く', createdAt: new Date('2026-08-02T00:00:00Z') },
    { id: 'topic_mine', userId: ME, isSeed: false, title: '내 주제', titleJa: null, createdAt: new Date('2026-08-03T00:00:00Z') },
    { id: 'topic_other', userId: OTHER, isSeed: false, title: '남의 주제', titleJa: null, createdAt: new Date('2026-08-04T00:00:00Z') },
  )
  f.tables.topicChunk.push({ id: 'chunk_coffee', topicId: 'topic_cafe', textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME', order: 0 })
  f.tables.scenario.push(
    scenarioRow('scn_cafe_a', { difficulty: 1 }),
    scenarioRow('scn_cafe_b', { difficulty: 3, createdAt: new Date('2026-09-02T00:00:00Z') }),
    scenarioRow('scn_road_a', { level: 'N4', createdAt: new Date('2026-09-03T00:00:00Z') }),
    scenarioRow('scn_hidden', { status: 'ARCHIVED' }),
    scenarioRow('mine_1', { userId: ME, isSeed: false, title: '내 상황 1', createdAt: new Date('2026-10-01T00:00:00Z') }),
    scenarioRow('mine_2', { userId: ME, isSeed: false, title: '내 상황 2', createdAt: new Date('2026-10-02T00:00:00Z') }),
    scenarioRow('mine_gone', { userId: ME, isSeed: false, status: 'ARCHIVED' }),
    scenarioRow('other_1', { userId: OTHER, isSeed: false, title: '남의 상황' }),
    scenarioRow('orphan_null', { isSeed: false, title: '주인 없는 비시드' }),
  )
  f.tables.scenarioTopic.push(
    { scenarioId: 'scn_cafe_a', topicId: 'topic_cafe', weight: 2 },
    { scenarioId: 'scn_cafe_b', topicId: 'topic_cafe', weight: 1 },
    { scenarioId: 'scn_road_a', topicId: 'topic_road', weight: 1 },
    { scenarioId: 'scn_road_a', topicId: 'topic_other', weight: 5 },
    { scenarioId: 'mine_1', topicId: 'topic_mine', weight: 1 },
  )
  return f
}

const query = (s = '') => parseScenarioListQuery(new URLSearchParams(s))

const validBody = () => ({
  title: '편의점에서 계산하기',
  titleJa: 'コンビニで会計する',
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '봉투와 포인트 카드를 묻고 답해요', successCriteria: ['봉투 필요 여부 답하기'] },
  steps: [{ ko: '인사하기' }, { ko: '봉투 묻기' }, { ko: '계산하기' }],
  keyExpressions: [
    { ja: '袋はいりません', ko: '봉투는 필요 없어요', id: 'client_chosen' },
    { ja: 'カードで', reading: 'かーどで', ko: '카드로' },
  ],
  opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' },
  topicIds: ['topic_cafe'],
})

// ── 입력 정리·검사(순수) ───────────────────────────────────────────────

test('글 정리: 보이지 않는 문자·줄바꿈·탭·제어문자를 지우고 공백을 하나로 — 전각 공백은 남긴다', () => {
  assert.equal(cleanScenarioText(' 카\u{200B}페\u{2028}주문\n\t하기\u{0007}  끝 '), '카페 주문 하기 끝')
  assert.equal(cleanScenarioText('\u{3164}\u{FEFF}\u{2800}'), '')
  assert.equal(cleanScenarioText('コーヒー\u{3000}ください'), 'コーヒー\u{3000}ください')
})

test('만들기 검사: 올바른 본문은 문제 0, 필수 칸·한도·금지 문자·비밀 유사·모르는 칸·중복 표현을 한 번에 모은다', () => {
  assert.deepEqual(normalizeScenarioInput(validBody(), 'create').problems, [])
  const bad = {
    ...validBody(),
    title: 'あ'.repeat(SCENARIO_LIMITS.titleMax + 1),
    description: '<script>alert(1)</script>',
    titleJa: 'sk-abcdefghijklmnop',
    steps: Array.from({ length: SCENARIO_LIMITS.stepsMax + 1 }, (_, i) => ({ ko: `단계 ${i}` })),
    keyExpressions: [{ ja: 'カードで', ko: '카드로' }, { ja: 'カードで', ko: '카드로' }],
    requiredExpressions: 3,
    extra: 1,
  }
  const { problems } = normalizeScenarioInput(bad, 'create')
  const got = problems.map((p) => `${p.field}:${p.reason}`)
  for (const want of ['extra:unknown_key', 'title:max_length', 'description:forbidden_char', 'titleJa:secret_like', `steps:max ${SCENARIO_LIMITS.stepsMax}`, 'keyExpressions[1].ja:duplicate', 'requiredExpressions:range 1-2']) {
    assert.ok(got.includes(want), `${want} 가 문제 목록에 있어야 함: ${got.join(' | ')}`)
  }
  const missing = normalizeScenarioInput({ title: '제목만' }, 'create').problems.map((p) => p.field)
  for (const f of ['level', 'roles', 'goal', 'steps', 'keyExpressions']) assert.ok(missing.includes(f), `${f} 필수`)
  assert.deepEqual(normalizeScenarioInput({}, 'patch').problems.map((p) => p.reason), ['empty'])
  const short = normalizeScenarioInput({ ...validBody(), keyExpressions: [{ ja: 'カードで', ko: '카드로' }], steps: [{ ko: '하나' }] }, 'create').problems.map((p) => `${p.field}:${p.reason}`)
  assert.ok(short.includes(`keyExpressions:min ${SCENARIO_LIMITS.expressionsMin}`) && short.includes(`steps:min ${SCENARIO_LIMITS.stepsMin}`))
})

test('표현 id: 만들 때는 들어온 id 를 쓰지 않고 e1…, 고칠 때는 기존 id 유지·새 표현은 기존 최대 다음 번호', () => {
  const items = [
    { id: 'client_chosen', ja: 'A', reading: null, ko: 'a', chunkType: null, match: null },
    { id: null, ja: 'B', reading: null, ko: 'b', chunkType: null, match: null },
  ]
  assert.deepEqual(assignExpressionIds(items, new Set()), ['e1', 'e2'])
  assert.deepEqual(
    assignExpressionIds([{ ...items[0], id: 'e3' }, { ...items[1], id: 'nope' }, { ...items[1], id: 'e3', ja: 'C' }], new Set(['e1', 'e3'])),
    ['e3', 'e4', 'e5'],
    '기존 e3 유지 · 모르는 id 와 겹친 e3 는 새 번호(e1 은 지워진 표현이라도 다시 쓰지 않음)',
  )
})

test('읽기: 단계·첫마디는 constraints 우선, goal 쪽 옛 위치도 읽는다', () => {
  assert.deepEqual(readScenarioSteps({ steps: [{ ko: '하나' }, '둘', { ko: ' ' }] }), [{ ko: '하나' }, { ko: '둘' }])
  assert.deepEqual(readScenarioSteps(null, { steps: ['옛 단계'] }), [{ ko: '옛 단계' }])
  assert.deepEqual(readScenarioOpening(null, { opening: { ja: 'どうぞ', ko: '여기요' } }), { ja: 'どうぞ', ko: '여기요' })
  assert.equal(readScenarioOpening({ opening: { ko: '뜻만' } }), null)
})

test('목록 쿼리: 모르는 조건·잘못된 값은 400, 커서는 오프셋', () => {
  assert.deepEqual(query('topicId=topic_cafe&recommended=1&mine=0&limit=5'), { topicId: 'topic_cafe', level: null, recommended: true, mine: false, limit: 5, offset: 0 })
  assert.throws(() => query('sort=new'), expectApi('VALIDATION'))
  assert.throws(() => query('level=N6'), expectApi('VALIDATION'))
  assert.throws(() => query('recommended=yes'), expectApi('VALIDATION'))
  assert.throws(() => query(`limit=${SCENARIO_LIMITS.listMax + 1}`), expectApi('VALIDATION'))
  assert.throws(() => query('cursor=%%%'), expectApi('VALIDATION'))
})

// ── 추천(순수) ─────────────────────────────────────────────────────────

const cand = (id: string, over: Partial<RecommendCandidate> = {}): RecommendCandidate => ({ id, level: 'N5', difficulty: 2, createdAt: T0, topicWeights: new Map(), ...over })
const signals = (over: Partial<RecommendSignals> = {}): RecommendSignals => ({ today: '2026-10-07', learnerLevel: 'N5', last: new Map(), repetition: new Map(), focusTopicId: null, ...over })

test('추천: 이유 4종 · 오늘 한 상황 제외 · 수준 위 제외 · 이유마다 하나 먼저 · 최대 3', () => {
  const day = (d: string) => ({ at: new Date(`${d}T10:00:00+09:00`), day: d })
  const s = signals({
    focusTopicId: 'topic_cafe',
    last: new Map([
      ['retry_old', { ...day('2026-09-30'), outcome: 'NOT_YET' as const }],
      ['retry_almost', { ...day('2026-09-20'), outcome: 'ALMOST' as const }],
      ['today_fail', { ...day('2026-10-07'), outcome: 'NOT_YET' as const }],
      ['done_due', { ...day('2026-09-25'), outcome: 'ACHIEVED' as const }],
      ['done_later', { ...day('2026-10-05'), outcome: 'ACHIEVED' as const }],
    ]),
    repetition: new Map([
      ['done_due', { nextDue: '2026-10-07', priority: 'NORMAL' as const }],
      ['done_later', { nextDue: '2026-10-10', priority: 'NORMAL' as const }],
    ]),
  })
  const cands = [
    cand('retry_old'), cand('retry_almost'), cand('today_fail'), cand('done_due'), cand('done_later'),
    cand('topic_new', { topicWeights: new Map([['topic_cafe', 1]]) }),
    cand('easy_new', { difficulty: 1 }),
    cand('hard_level', { level: 'N3', difficulty: 1 }),
  ]
  const r = recommendScenarios(cands, s)
  assert.deepEqual(r, [
    { id: 'retry_old', reason: 'RETRY_NOT_YET' },
    { id: 'done_due', reason: 'REVIEW_DUE' },
    { id: 'topic_new', reason: 'NEXT_IN_TOPIC' },
  ], 'NOT_YET 이 ALMOST 보다 먼저 · 오늘 한 상황·다음 학습일 전·학습자 수준 위는 빠짐 · 이유마다 하나씩')
  const all = recommendScenarios(cands, s, 10).map((x) => x.id)
  assert.deepEqual(all, ['retry_old', 'done_due', 'topic_new', 'easy_new', 'retry_almost'])
  assert.ok(!all.includes('today_fail') && !all.includes('done_later') && !all.includes('hard_level'))
  assert.deepEqual(recommendScenarios([cand('n5'), cand('n4', { level: 'N4' }), cand('n5easy', { difficulty: 1 }), cand('n3', { level: 'N3', difficulty: 1 })], signals({ learnerLevel: 'N4' })), [
    { id: 'n5easy', reason: 'NEW_EASY' },
    { id: 'n4', reason: 'NEW_EASY' },
    { id: 'n5', reason: 'NEW_EASY' },
  ], 'NEW_EASY = 난이도 낮은 순, 같으면 학습자 수준(N4)에 가까운 순 · 학습자 수준 위(N3)는 빠짐')
})

// ── 목록·상세 ───────────────────────────────────────────────────────────

test('목록: 시드 + 내 상황(ACTIVE)만 — 남의 상황·주인 없는 비시드·지운 상황 0, 내 것 먼저(최근 순) → 시드(주제 순서·난이도)', async () => {
  const f = seeded()
  const r = await listScenarios(ME, query(), f.deps())
  assert.deepEqual(r.items.map((i) => i.id), ['mine_2', 'mine_1', 'scn_cafe_a', 'scn_cafe_b', 'scn_road_a'])
  assert.equal(r.nextCursor, null)
  const mine = r.items.find((i) => i.id === 'mine_1')!
  assert.equal(mine.isMine, true)
  assert.deepEqual(mine.topics, [{ id: 'topic_mine', title: '내 주제', titleJa: null }])
  const road = r.items.find((i) => i.id === 'scn_road_a')!
  assert.deepEqual(road.topics.map((t) => t.id), ['topic_road'], '남의 주제 연결은 보이지 않는다(weight 가 커도)')
  assert.equal(road.isMine, false)
  const cafe = r.items.find((i) => i.id === 'scn_cafe_a')!
  assert.equal(cafe.goalKo, '원하는 음료를 주문해요')
  assert.equal(cafe.stepCount, 3)
  assert.equal(cafe.expressionCount, 3, 'chunkId 참조 표현은 조각 표기로 채워 센다')
  const other = await listScenarios(OTHER, query(), f.deps())
  assert.deepEqual(other.items.map((i) => i.id), ['other_1', 'scn_cafe_a', 'scn_cafe_b', 'scn_road_a'])
  assert.deepEqual(scenarioForeignWrites(f.log), [])
})

test('목록 거르기: mine=1 · level · topicId(남의 주제면 0) · 커서', async () => {
  const f = seeded()
  assert.deepEqual((await listScenarios(ME, query('mine=1'), f.deps())).items.map((i) => i.id), ['mine_2', 'mine_1'])
  assert.deepEqual((await listScenarios(ME, query('level=N4'), f.deps())).items.map((i) => i.id), ['scn_road_a'])
  assert.deepEqual((await listScenarios(ME, query('topicId=topic_cafe'), f.deps())).items.map((i) => i.id), ['scn_cafe_a', 'scn_cafe_b'])
  assert.deepEqual((await listScenarios(ME, query('topicId=topic_other'), f.deps())).items, [], '남의 주제로는 거를 수 없다')
  const p1 = await listScenarios(ME, query('limit=2'), f.deps())
  assert.deepEqual(p1.items.map((i) => i.id), ['mine_2', 'mine_1'])
  assert.ok(p1.nextCursor)
  const p2 = await listScenarios(ME, parseScenarioListQuery(new URLSearchParams({ limit: '2', cursor: p1.nextCursor! })), f.deps())
  assert.deepEqual(p2.items.map((i) => i.id), ['scn_cafe_a', 'scn_cafe_b'])
})

test('목록 추천·지난 결과: 관측의 마지막 결과(meta) · 반복 항목 · 오늘 끝낸 수업 주제 — recommended=1 은 추천 순서', async () => {
  const f = seeded()
  f.tables.learningObservation.push(
    { id: 'o1', userId: ME, kind: 'SCENARIO_COMPLETED', outcome: 'FAIL', scenarioId: 'scn_cafe_b', refType: 'Chat', refId: 'chat_b1', occurredAt: new Date('2026-10-01T01:00:00Z'), meta: { outcome: 'NOT_YET', used: 1, total: 3 } },
    { id: 'o2', userId: ME, kind: 'SCENARIO_COMPLETED', outcome: 'SUCCESS', scenarioId: 'scn_cafe_a', refType: 'Chat', refId: 'chat_a1', occurredAt: new Date('2026-09-28T01:00:00Z'), meta: { outcome: 'ACHIEVED', used: 3, total: 3 } },
    { id: 'o3', userId: OTHER, kind: 'SCENARIO_COMPLETED', outcome: 'SUCCESS', scenarioId: 'scn_road_a', refType: 'Chat', refId: 'chat_x', occurredAt: new Date('2026-10-01T01:00:00Z'), meta: { outcome: 'ACHIEVED' } },
  )
  f.tables.repetitionItem.push({ id: 'r1', userId: ME, refType: 'Scenario', refId: 'scn_cafe_a', nextDueAt: new Date('2026-10-06T00:00:00Z'), priority: 'NORMAL' })
  f.tables.lesson.push({ id: 'l1', userId: ME, status: 'DONE', date: new Date('2026-10-07T00:00:00Z'), topicId: 'topic_road', completedAt: new Date('2026-10-07T01:00:00Z') })
  const r = await listScenarios(ME, query(), f.deps())
  const b = r.items.find((i) => i.id === 'scn_cafe_b')!
  assert.deepEqual(b.last, { at: '2026-10-01T01:00:00.000Z', outcome: 'NOT_YET', usedCount: 1, totalCount: 3 })
  assert.equal(r.items.find((i) => i.id === 'scn_road_a')!.last, undefined, '남의 관측은 내 결과가 아니다')
  assert.deepEqual(r.recommendedIds, ['scn_cafe_b', 'scn_cafe_a', 'scn_road_a'])
  assert.deepEqual(r.items.filter((i) => i.recommended).map((i) => [i.id, i.recommendReason]).sort(), [['scn_cafe_a', 'REVIEW_DUE'], ['scn_cafe_b', 'RETRY_NOT_YET'], ['scn_road_a', 'NEXT_IN_TOPIC']])
  const reco = await listScenarios(ME, query('recommended=1&limit=2'), f.deps())
  assert.deepEqual(reco.items.map((i) => i.id), ['scn_cafe_b', 'scn_cafe_a'])
  const inTopic = await listScenarios(ME, query('topicId=topic_cafe&recommended=1&limit=1'), f.deps())
  assert.deepEqual(inTopic.items.map((i) => [i.id, i.recommendReason]), [['scn_cafe_b', 'RETRY_NOT_YET']])
})

test('진행 중 대화: 후보 중 끝낸 대화(관측)는 빼고 가장 최근 것 — 없으면 칸 없음', async () => {
  const f = seeded()
  f.tables.learningObservation.push({ id: 'o9', userId: ME, kind: 'SCENARIO_COMPLETED', outcome: 'SUCCESS', scenarioId: 'scn_cafe_a', refType: 'Chat', refId: 'chat_done', occurredAt: new Date('2026-10-06T00:00:00Z'), meta: {} })
  const openChats = async () => [
    { scenarioId: 'scn_cafe_a', chatId: 'chat_done', at: new Date('2026-10-06T09:00:00Z') },
    { scenarioId: 'scn_cafe_a', chatId: 'chat_old', at: new Date('2026-10-01T00:00:00Z') },
    { scenarioId: 'scn_cafe_b', chatId: 'chat_b', at: new Date('2026-10-02T00:00:00Z') },
    { scenarioId: 'other_1', chatId: 'chat_leak', at: new Date('2026-10-02T00:00:00Z') },
  ]
  const r = await listScenarios(ME, query(), f.deps(), { openChats })
  const by = new Map(r.items.map((i) => [i.id, i.inProgressChatId]))
  assert.equal(by.get('scn_cafe_a'), 'chat_old')
  assert.equal(by.get('scn_cafe_b'), 'chat_b')
  assert.equal(by.get('scn_road_a'), undefined)
  assert.ok(!r.items.some((i) => i.inProgressChatId === 'chat_leak'))
  assert.equal((await listScenarios(ME, query(), f.deps())).items.some((i) => 'inProgressChatId' in i), false, 'openChats 없으면 칸 없음')
})

test('상세: 시드·내 것 — 목표·단계·핵심 표현(id 규약)·필수 수·첫마디 / 남의 것·주인 없는 비시드·없음·형식 틀림 404(세부 없음) / 지운 것 404 ARCHIVED', async () => {
  const f = seeded()
  const d = await getScenarioDetail(ME, 'scn_cafe_a', f.deps())
  assert.deepEqual(d.goal, { communicativeGoalKo: '원하는 음료를 주문해요', successCriteria: ['크기 말하기', '온도 말하기'] })
  assert.deepEqual(d.steps, [{ ko: '인사하기' }, { ko: '주문하기' }, { ko: '계산하기' }])
  assert.deepEqual(d.keyExpressions, [
    { id: 'e1', ja: 'ホットで', ko: '따뜻한 걸로' },
    { id: 'e2', ja: 'Mサイズ', ko: 'M 사이즈' },
    { id: 'chunk_coffee', ja: 'コーヒー', reading: 'こーひー', ko: '커피' },
  ])
  assert.equal(d.requiredExpressions, 2)
  assert.deepEqual(d.opening, { ja: 'いらっしゃいませ。', ko: '어서 오세요.' })
  assert.equal((await getScenarioDetail(ME, 'mine_1', f.deps())).isMine, true)
  for (const id of ['other_1', 'orphan_null', 'nope', 'bad id!', 'x'.repeat(41)]) {
    await assert.rejects(getScenarioDetail(ME, id, f.deps()), expectApi('NOT_FOUND', (e) => assert.equal(e.details, undefined, `${id}: 세부 없음`)))
  }
  await assert.rejects(getScenarioDetail(ME, 'mine_gone', f.deps()), expectApi('NOT_FOUND', (e) => assert.equal(e.details?.reason, 'ARCHIVED')))
  await assert.rejects(getScenarioDetail(ME, 'scn_hidden', f.deps()), expectApi('NOT_FOUND', (e) => assert.equal(e.details?.reason, 'ARCHIVED')))
})

// ── 만들기·고치기·지우기 ────────────────────────────────────────────────

test('만들기: 잠금 → 한도 확인 → Scenario 1 + ScenarioTopic — 저장 모양·서버가 정한 표현 id·응답 = 상세(isMine)', async () => {
  const f = seeded()
  const d = await createScenario(ME, validBody(), f.deps())
  assert.equal(d.isMine, true)
  assert.deepEqual(d.keyExpressions.map((e) => e.id), ['e1', 'e2'], '클라이언트 id 는 쓰지 않는다')
  assert.equal(d.requiredExpressions, 2)
  assert.deepEqual(d.topics.map((t) => t.id), ['topic_cafe'])
  const row = f.tables.scenario.find((r) => r.id === d.id)!
  assert.equal(row.userId, ME)
  assert.equal(row.isSeed, false)
  assert.equal(row.status, 'ACTIVE')
  assert.deepEqual(row.goal, { communicativeGoal_ko: '봉투와 포인트 카드를 묻고 답해요', successCriteria: ['봉투 필요 여부 답하기'] })
  assert.deepEqual(row.constraints, { steps: [{ ko: '인사하기' }, { ko: '봉투 묻기' }, { ko: '계산하기' }], opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' } })
  assert.deepEqual(row.completionRule, { requiredExpressions: 2, tutorJudgement: true })
  assert.equal(f.log.indexOf('lockUser') < f.log.indexOf('scenario.create'), true, '사용자 잠금이 먼저')
  assert.deepEqual(scenarioForeignWrites(f.log), [], 'Scenario·ScenarioTopic 밖에는 쓰지 않는다')
})

test('만들기 거절: 남의 주제·없는 주제 400(행 0) · ACTIVE 50 → 409 SCENARIO_LIMIT · 하루 30 → 429 DAILY_LIMIT · 잘못된 본문 400 problems', async () => {
  const f = seeded()
  const before = f.tables.scenario.length
  await assert.rejects(createScenario(ME, { ...validBody(), topicIds: ['topic_other', 'topic_none'] }, f.deps()), expectApi('VALIDATION', (e) => {
    assert.equal(e.details?.field, 'topicIds[0]')
    assert.equal((e.details?.problems as unknown[]).length, 2)
  }))
  assert.equal(f.tables.scenario.length, before, '거절이면 행 0')
  await assert.rejects(createScenario(ME, { ...validBody(), title: '' }, f.deps()), expectApi('VALIDATION', (e) => assert.equal(e.details?.field, 'title')))

  const g = seeded()
  for (let i = 0; i < SCENARIO_LIMITS.activePerUser - 2; i++) g.tables.scenario.push(scenarioRow(`fill_${i}`, { userId: ME, isSeed: false, createdAt: new Date('2026-09-01T00:00:00Z') }))
  await assert.rejects(createScenario(ME, validBody(), g.deps()), expectApi('CONFLICT', (e) => assert.equal(e.details?.reason, 'SCENARIO_LIMIT')))
  assert.equal((await createScenario(OTHER, validBody(), g.deps())).isMine, true, '한도는 사용자마다')

  const h = seeded()
  for (let i = 0; i < SCENARIO_LIMITS.createPerDay; i++) h.tables.scenario.push(scenarioRow(`today_${i}`, { userId: ME, isSeed: false, status: 'ARCHIVED', createdAt: new Date('2026-10-06T16:00:00Z') }))
  await assert.rejects(createScenario(ME, validBody(), h.deps()), expectApi('RATE_LIMITED', (e) => {
    assert.equal(e.details?.reason, 'DAILY_LIMIT')
    assert.ok((e.details?.retryAfterSec as number) > 0)
  }))
  h.tables.scenario.forEach((r) => {
    if (String(r.id).startsWith('today_')) r.createdAt = new Date('2026-10-06T14:59:00Z')
  })
  assert.ok((await createScenario(ME, validBody(), h.deps())).id, 'KST 전날 만든 것은 오늘 한도에 들지 않는다')
})

test('고치기: 보낸 칸만 · 기존 표현 id 유지 · 단계만 바꿔도 첫마디·다른 constraints 칸 유지 · 필수 수는 새 표현 수에 맞춤', async () => {
  const f = seeded()
  f.tables.scenario.find((r) => r.id === 'mine_1')!.constraints = { conditions: ['빨리 말함'], steps: [{ ko: 'a' }, { ko: 'b' }], opening: { ja: 'どうぞ', ko: '여기요' } }
  const d = await updateScenario(ME, 'mine_1', { title: '고친 제목', steps: [{ ko: '첫째' }, { ko: '둘째' }] }, f.deps())
  assert.equal(d.title, '고친 제목')
  assert.deepEqual(d.steps, [{ ko: '첫째' }, { ko: '둘째' }])
  assert.deepEqual(d.opening, { ja: 'どうぞ', ko: '여기요' })
  assert.deepEqual(f.tables.scenario.find((r) => r.id === 'mine_1')!.constraints, { conditions: ['빨리 말함'], steps: [{ ko: '첫째' }, { ko: '둘째' }], opening: { ja: 'どうぞ', ko: '여기요' } })
  const e = await updateScenario(ME, 'mine_1', { keyExpressions: [{ id: 'e2', ja: 'Mサイズ', ko: 'M 사이즈' }, { ja: '新しい', ko: '새 표현' }] }, f.deps())
  assert.deepEqual(e.keyExpressions.map((x) => x.id), ['e2', 'e3'])
  const merged = mergeScenarioFields({ constraints: null, keyExpressions: [{ id: 'e1', ja: 'A', ko: 'a' }, { id: 'e2', ja: 'B', ko: 'b' }, { id: 'e3', ja: 'C', ko: 'c' }], completionRule: { requiredExpressions: 3 } }, { keyExpressions: [{ id: 'e1', ja: 'A', reading: null, ko: 'a', chunkType: null, match: null }, { id: null, ja: 'D', reading: null, ko: 'd', chunkType: null, match: null }] })
  assert.deepEqual(merged.problems, [])
  assert.deepEqual(merged.data.completionRule, { requiredExpressions: 2, tutorJudgement: true }, '저장된 필수 3 → 표현 2개면 2')
  await assert.rejects(updateScenario(ME, 'mine_1', { requiredExpressions: 5 }, f.deps()), expectApi('VALIDATION', (x) => assert.equal(x.details?.field, 'requiredExpressions')))
  const t = await updateScenario(ME, 'mine_1', { topicIds: ['topic_road', 'topic_mine'] }, f.deps())
  assert.deepEqual(t.topics.map((x) => x.id), ['topic_road', 'topic_mine'], '앞쪽이 대표(weight 큼)')
  assert.deepEqual(scenarioForeignWrites(f.log), [])
})

test('고치기·지우기 거절: 시드 404 SEED · 남의 것·주인 없는 비시드 404(세부 없음) · 지운 상황 고치기 409 ARCHIVED — 행 변화 0', async () => {
  const f = seeded()
  const snapshot = JSON.stringify(f.tables.scenario)
  await assert.rejects(updateScenario(ME, 'scn_cafe_a', { title: '시드 고치기' }, f.deps()), expectApi('NOT_FOUND', (e) => assert.equal(e.details?.reason, 'SEED')))
  await assert.rejects(archiveScenario(ME, 'scn_cafe_a', f.deps()), expectApi('NOT_FOUND', (e) => assert.equal(e.details?.reason, 'SEED')))
  for (const id of ['other_1', 'orphan_null']) {
    await assert.rejects(updateScenario(ME, id, { title: '남의 것' }, f.deps()), expectApi('NOT_FOUND', (e) => assert.equal(e.details, undefined)))
    await assert.rejects(archiveScenario(ME, id, f.deps()), expectApi('NOT_FOUND', (e) => assert.equal(e.details, undefined)))
  }
  await assert.rejects(updateScenario(ME, 'mine_gone', { title: '되살리기' }, f.deps()), expectApi('CONFLICT', (e) => assert.equal(e.details?.reason, 'ARCHIVED')))
  assert.equal(JSON.stringify(f.tables.scenario), snapshot)
})

test('지우기 = ARCHIVED(멱등) — 목록·상세에서 빠지고 연결·행은 남는다', async () => {
  const f = seeded()
  assert.deepEqual(await archiveScenario(ME, 'mine_1', f.deps()), { id: 'mine_1', status: 'ARCHIVED', alreadyArchived: false })
  assert.deepEqual(await archiveScenario(ME, 'mine_1', f.deps()), { id: 'mine_1', status: 'ARCHIVED', alreadyArchived: true })
  assert.ok(!(await listScenarios(ME, query(), f.deps())).items.some((i) => i.id === 'mine_1'))
  await assert.rejects(getScenarioDetail(ME, 'mine_1', f.deps()), expectApi('NOT_FOUND'))
  assert.ok(f.tables.scenario.some((r) => r.id === 'mine_1' && r.status === 'ARCHIVED'))
  assert.ok(f.tables.scenarioTopic.some((l) => l.scenarioId === 'mine_1'))
  assert.deepEqual(scenarioForeignWrites(f.log), [])
})
