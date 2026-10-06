/**
 * task-010d A1-서버 — 상황 역할극 learning 쪽 단위 테스트(DB·LLM 없음). 표현 id 규약·필수 수·강사 판정 보정·종료 판정(순수),
 * 시작 재료 읽기(가짜 DB — 시드·본인만, 남의 것 404, 주제 선택 규칙), 종료 트랜잭션(가짜 tx — 쓰는 행 수·잠금 순서·멱등·판정 없음·0턴).
 * 실제 DB 경로는 `tests/live/task010d-a1-smoke.ts`(QA 계정 4).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, type Tx } from '@/modules/infra'
import {
  detectScenarioExpressions,
  judgeScenarioCompletion,
  normalizeScenarioVerdict,
  readScenarioExpressions,
  scenarioChunkIds,
  scenarioRequiredExpressions,
  SCENARIO_EXPRESSION_MAX,
  type ScenarioChunkRef,
} from '../scenarios/expressions'
import { linkedTopicsFor, resolveScenarioChatStart, type ScenarioStartDb } from '../scenarios/start'
import {
  endScenarioRolePlay,
  isScenarioRolePlayEnded,
  scenarioEndLookupSince,
  SCENARIO_END_LOOKUP_MARGIN_MS,
  SCENARIO_REPETITION_REF_TYPE,
  SCENARIO_UNJUDGED_CONFIDENCE,
  type ScenarioEndInput,
} from '../scenarios/end'
import { emptyDaily } from '../snapshots'

const U = 'cuser0000000000000000010d'
const OTHER = 'cuser000000000000000other'
const CHUNKS = new Map<string, ScenarioChunkRef>([['chunk_coffee', { textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME' }]])
const KEY_EXPRESSIONS = [
  { chunkId: 'chunk_coffee' },
  { id: 'e2', ja: 'ホットで', ko: '따뜻한 걸로' },
  { id: 'e3', ja: '大きいサイズ', reading: 'おおきいサイズ', ko: '큰 사이즈' },
  { id: 'e4', ja: '〜にしてください', match: 'にしてください', ko: '~로 해 주세요' },
]

function expectApi(code: string, extra?: (e: ApiError) => void) {
  return (e: unknown) => {
    assert.ok(e instanceof ApiError, `ApiError 기대: ${String(e)}`)
    assert.equal(e.code, code)
    extra?.(e)
    return true
  }
}

// ── 표현 id 규약 · 필수 수 · 보정 · 판정(순수) ────────────────────────────

test('표현 id 규약: id > chunkId > 자리 번호, 같은 id 는 처음 것만, 조각 표기 보충, 표기 없는 항목은 버림', () => {
  const ex = readScenarioExpressions(
    [
      ...KEY_EXPRESSIONS,
      { id: 'e2', ja: '重複' },
      { chunkId: 'chunk_missing' },
      'ありがとうございます',
      { id: 'bad id!', ja: 'すみません' },
      { ja: '' },
      42,
    ],
    CHUNKS,
  )
  assert.deepEqual(
    ex.map((e) => e.id),
    ['chunk_coffee', 'e2', 'e3', 'e4', 'k7', 'k8'],
    '조각 참조는 chunkId, 문자열 항목·잘못된 id 는 자리 번호(1부터), 표기 없는 조각 참조·빈 항목·숫자는 버림',
  )
  const coffee = ex[0]
  assert.deepEqual([coffee.textJa, coffee.reading, coffee.meaningKo, coffee.chunkType, coffee.chunkId], ['コーヒー', 'こーひー', '커피', 'NAME', 'chunk_coffee'])
  assert.equal(ex[1].textJa, 'ホットで', '같은 id 두 번째(重複)는 버림')
  assert.equal(ex[3].match, 'にしてください')
  assert.deepEqual(scenarioChunkIds(KEY_EXPRESSIONS), ['chunk_coffee'])
  assert.deepEqual(readScenarioExpressions(null), [])
  assert.equal(readScenarioExpressions(Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, ja: `表現${i}` }))).length, SCENARIO_EXPRESSION_MAX, '상한')
})

test('필수 수: requiredExpressions > minKeyExpressions(옛 키) > 기본 2, 0~표현 수로 자름', () => {
  assert.equal(scenarioRequiredExpressions({ requiredExpressions: 3, minKeyExpressions: 1 }, 4), 3)
  assert.equal(scenarioRequiredExpressions({ minKeyExpressions: 1 }, 4), 1)
  assert.equal(scenarioRequiredExpressions({ tutorJudgement: true }, 4), 2)
  assert.equal(scenarioRequiredExpressions(null, 1), 1, '표현이 1개면 1')
  assert.equal(scenarioRequiredExpressions({ requiredExpressions: 9 }, 4), 4)
  assert.equal(scenarioRequiredExpressions({ requiredExpressions: -2 }, 4), 0)
  assert.equal(scenarioRequiredExpressions({ requiredExpressions: 2 }, 0), 0)
})

test('강사 판정 보정: 목록 밖 id 버림·중복 제거·양쪽에 있으면 쓴 표현만·모양이 어긋나면 null', () => {
  const ids = ['chunk_coffee', 'e2', 'e3', 'e4']
  const v = normalizeScenarioVerdict({ goalAchieved: true, communicationSuccess: 'yes', usedExpressionIds: ['e2', 'e2', 'zzz', 3], missedExpressionIds: ['e2', 'e3', 'nope'] }, ids)
  assert.deepEqual(v, { goalAchieved: true, communicationSuccess: null, usedExpressionIds: ['e2'], missedExpressionIds: ['e3'] })
  assert.equal(normalizeScenarioVerdict(undefined, ids), null)
  assert.equal(normalizeScenarioVerdict([], ids), null)
  assert.equal(normalizeScenarioVerdict({ usedExpressionIds: ['zzz'] }, ids), null, '남는 것이 없으면 판정 없음')
  assert.deepEqual(normalizeScenarioVerdict({ goalAchieved: false }, ids), { goalAchieved: false, communicationSuccess: null, usedExpressionIds: [], missedExpressionIds: [] })
})

test('코드 표현 확인: 가타카나/히라가나·정중형 어미·match 핵심·읽기(가나로 말함)', () => {
  const ex = readScenarioExpressions(KEY_EXPRESSIONS, CHUNKS)
  assert.deepEqual(detectScenarioExpressions(['こーひーをください'], ex), ['chunk_coffee'], '가타카나 표기를 히라가나로 말해도')
  assert.deepEqual(detectScenarioExpressions(['ホットでお願いします'], ex), ['e2'])
  assert.deepEqual(detectScenarioExpressions(['おおきいさいずにして'], ex), ['e3', 'e4'], '읽기·match 의 정중형을 뗀 핵심(にして)')
  assert.deepEqual(detectScenarioExpressions(['', 'こんにちは'], ex), [])
})

test('종료 판정: 쓴 표현 = 코드 확인 ∪ (강사 ∩ 핵심), 달성 = 강사 + 코드 규칙 둘 다, 강사만 = 거의, 판정 없음 + 규칙 = 거의', () => {
  const ex = readScenarioExpressions(KEY_EXPRESSIONS, CHUNKS)
  const texts = ['コーヒーをください', '大きいサイズにしてください']
  const ok = judgeScenarioCompletion({ expressions: ex, required: 2, learnerTexts: texts, verdict: { goalAchieved: true, communicationSuccess: true, usedExpressionIds: ['e2'], missedExpressionIds: [] } })
  assert.deepEqual(ok.usedIds, ['chunk_coffee', 'e2', 'e3', 'e4'])
  assert.deepEqual(ok.verifiedIds, ['chunk_coffee', 'e3', 'e4'], '강사 제안만으로 들어온 e2 는 확인 목록에 없음')
  assert.deepEqual([ok.missedIds, ok.codeRulePassed, ok.goalAchieved, ok.outcome, ok.judged], [[], true, true, 'ACHIEVED', true])

  const tutorOnly = judgeScenarioCompletion({ expressions: ex, required: 2, learnerTexts: ['コーヒー'], verdict: { goalAchieved: true, communicationSuccess: true, usedExpressionIds: [], missedExpressionIds: [] } })
  assert.deepEqual([tutorOnly.usedIds.length, tutorOnly.codeRulePassed, tutorOnly.goalAchieved, tutorOnly.outcome], [1, false, false, 'ALMOST'])

  const ruleOnly = judgeScenarioCompletion({ expressions: ex, required: 2, learnerTexts: texts, verdict: { goalAchieved: false, communicationSuccess: false, usedExpressionIds: [], missedExpressionIds: [] } })
  assert.deepEqual([ruleOnly.codeRulePassed, ruleOnly.outcome], [true, 'NOT_YET'], '강사가 아니라고 하면 아직(데모 결정 d)')

  const unjudged = judgeScenarioCompletion({ expressions: ex, required: 2, learnerTexts: texts, verdict: null })
  assert.deepEqual([unjudged.tutorGoalAchieved, unjudged.goalAchieved, unjudged.outcome, unjudged.judged], [null, false, 'ALMOST', false], '판정 없이 달성으로 올리지 않음')
  assert.equal(judgeScenarioCompletion({ expressions: ex, required: 2, learnerTexts: ['はい'], verdict: null }).outcome, 'NOT_YET')

  const none = judgeScenarioCompletion({ expressions: [], required: 2, learnerTexts: ['はい'], verdict: { goalAchieved: true, communicationSuccess: true, usedExpressionIds: [], missedExpressionIds: [] } })
  assert.deepEqual([none.required, none.codeRulePassed, none.outcome], [0, true, 'ACHIEVED'], '핵심 표현이 없으면 강사 판단만')
})

// ── 시작 재료 읽기(가짜 DB) ──────────────────────────────────────────────

type Row = Record<string, unknown>
/** where 를 실제로 평가한다(키 일치 + OR) — 소유자 조건이 빠지면 테스트가 깨지게. */
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Row[]).some((w) => matches(row, w))
    if (v && typeof v === 'object' && !(v instanceof Date) && 'gte' in v) return row[k] instanceof Date && (row[k] as Date).getTime() >= ((v as Row).gte as Date).getTime()
    return row[k] === v
  })
}

interface FakeTopicLink { topicId: string; weight: number; topic: { id: string; title: string; userId: string | null } }
interface FakeScenario { id: string; userId: string | null; isSeed: boolean; title: string; titleJa: string | null; level: 'N5' | 'N4'; status: string; topics: FakeTopicLink[] }

function startDb(scenarios: FakeScenario[], lessons: { id: string; userId: string; topicId: string | null; scenarioId: string | null }[]) {
  const seen: Row[] = []
  const db = {
    lesson: {
      findFirst: async (args: { where: Row }) => {
        seen.push({ table: 'lesson', where: args.where })
        const l = lessons.find((x) => matches(x as unknown as Row, args.where))
        return l ? { id: l.id, topicId: l.topicId, scenarioId: l.scenarioId } : null
      },
    },
    scenario: {
      findFirst: async (args: { where: Row }) => {
        seen.push({ table: 'scenario', where: args.where })
        return scenarios.find((x) => matches(x as unknown as Row, args.where)) ?? null
      },
    },
  }
  return { db: db as unknown as ScenarioStartDb, seen }
}

const topicLink = (id: string, weight: number, userId: string | null = null): FakeTopicLink => ({ topicId: id, weight, topic: { id, title: `주제 ${id}`, userId } })
const SEED: FakeScenario = { id: 'scn_seed', userId: null, isSeed: true, title: '사이즈·온도 바꿔 주문하기', titleJa: 'サイズと温度を変えて注文する', level: 'N5', status: 'ACTIVE', topics: [topicLink('t_low', 1), topicLink('t_cafe', 3), topicLink('t_mine_other', 9, OTHER)] }
const MINE: FakeScenario = { ...SEED, id: 'scn_mine', userId: U, isSeed: false, title: '내 상황', topics: [] }
const THEIRS: FakeScenario = { ...SEED, id: 'scn_theirs', userId: OTHER, isSeed: false, title: '남의 상황' }
const FAKE_SEED: FakeScenario = { ...SEED, id: 'scn_fake_seed', userId: null, isSeed: false }
const ARCHIVED: FakeScenario = { ...SEED, id: 'scn_archived', status: 'ARCHIVED' }
const LESSONS = [
  { id: 'les_mine', userId: U, topicId: 't_low', scenarioId: null },
  { id: 'les_scn', userId: U, topicId: 't_other', scenarioId: 'scn_seed' },
  { id: 'les_theirs', userId: OTHER, topicId: 't_cafe', scenarioId: 'scn_seed' },
]

test('시작 접근: 시드·본인 상황만, 남의 상황·isSeed 아닌 무주 상황 404(존재를 드러내지 않음), 숨긴 상황 409', async () => {
  const { db, seen } = startDb([SEED, MINE, THEIRS, FAKE_SEED, ARCHIVED], LESSONS)
  const seed = await resolveScenarioChatStart(U, { scenarioId: 'scn_seed', lessonId: null, topicId: null }, db)
  assert.deepEqual([seed.scenario.id, seed.scenario.level, seed.lessonId], ['scn_seed', 'N5', null])
  assert.deepEqual((seen.at(-1) as { where: Row }).where, { id: 'scn_seed', OR: [{ userId: null, isSeed: true }, { userId: U }] }, '소유자 조건이 쿼리에 들어간다')
  assert.equal((await resolveScenarioChatStart(U, { scenarioId: 'scn_mine', lessonId: null, topicId: null }, db)).scenario.id, 'scn_mine')
  for (const id of ['scn_theirs', 'scn_fake_seed', 'scn_none', 'x'.repeat(41)]) {
    await assert.rejects(resolveScenarioChatStart(U, { scenarioId: id, lessonId: null, topicId: null }, db), expectApi('NOT_FOUND', (e) => assert.equal(e.userMessage, '상황을 찾을 수 없어요.')))
  }
  await assert.rejects(resolveScenarioChatStart(U, { scenarioId: 'scn_archived', lessonId: null, topicId: null }, db), expectApi('CONFLICT', (e) => assert.deepEqual(e.details, { reason: 'ARCHIVED' })))
  await assert.rejects(resolveScenarioChatStart(U, { scenarioId: null, lessonId: null, topicId: null }, db), expectApi('VALIDATION'))
})

test('시작 레슨: 본인 레슨만(남의 것 404), lessonId 만 오면 그 레슨의 상황, 상황 없는 레슨은 400', async () => {
  const { db } = startDb([SEED, MINE], LESSONS)
  await assert.rejects(resolveScenarioChatStart(U, { scenarioId: 'scn_seed', lessonId: 'les_theirs', topicId: null }, db), expectApi('NOT_FOUND', (e) => assert.equal(e.userMessage, '수업을 찾을 수 없어요.')))
  const viaLesson = await resolveScenarioChatStart(U, { scenarioId: null, lessonId: 'les_scn', topicId: null }, db)
  assert.deepEqual([viaLesson.scenario.id, viaLesson.lessonId], ['scn_seed', 'les_scn'])
  await assert.rejects(resolveScenarioChatStart(U, { scenarioId: null, lessonId: 'les_mine', topicId: null }, db), expectApi('VALIDATION', (e) => assert.equal((e.details as Row).field, 'scenarioId')))
  const both = await resolveScenarioChatStart(U, { scenarioId: 'scn_seed', lessonId: 'les_mine', topicId: null }, db)
  assert.deepEqual([both.scenario.id, both.lessonId], ['scn_seed', 'les_mine'])
})

test('시작 주제: 요청(이어진 주제만, 아니면 400) > 레슨 주제(이어져 있을 때) > weight 큰 주제 > 없음, 남의 사용자 주제는 고르지 않음', async () => {
  const { db } = startDb([SEED, MINE], LESSONS)
  const req = await resolveScenarioChatStart(U, { scenarioId: 'scn_seed', lessonId: null, topicId: 't_low' }, db)
  assert.deepEqual([req.topic?.id, req.topicSource], ['t_low', 'REQUEST'])
  await assert.rejects(resolveScenarioChatStart(U, { scenarioId: 'scn_seed', lessonId: null, topicId: 't_mine_other' }, db), expectApi('VALIDATION', (e) => assert.equal((e.details as Row).reason, 'not_linked')))
  await assert.rejects(resolveScenarioChatStart(U, { scenarioId: 'scn_seed', lessonId: null, topicId: 't_unlinked' }, db), expectApi('VALIDATION'))
  const fromLesson = await resolveScenarioChatStart(U, { scenarioId: 'scn_seed', lessonId: 'les_mine', topicId: null }, db)
  assert.deepEqual([fromLesson.topic?.id, fromLesson.topicSource], ['t_low', 'LESSON'])
  const top = await resolveScenarioChatStart(U, { scenarioId: null, lessonId: 'les_scn', topicId: null }, db)
  assert.deepEqual([top.topic?.id, top.topicSource], ['t_cafe', 'SCENARIO'], '레슨 주제(t_other)가 상황과 이어지지 않으면 weight 큰 주제 — 남의 주제(weight 9)는 제외')
  const none = await resolveScenarioChatStart(U, { scenarioId: 'scn_mine', lessonId: null, topicId: null }, db)
  assert.deepEqual([none.topic, none.topicSource], [null, 'NONE'])
  assert.deepEqual(linkedTopicsFor(U, [topicLink('b', 2), topicLink('a', 2), topicLink('c', 5, U)]).map((t) => t.id), ['c', 'a', 'b'], '같은 weight 는 id 순')
})

// ── 종료 트랜잭션(가짜 tx) ────────────────────────────────────────────────

interface FakeObs { userId: string; kind: string; refType: string; refId: string; meta?: Row; outcome: string; confidence: number; scenarioId: string | null; skill: string; occurredAt?: Date }

/** 관측 `occurredAt` 은 DB 기본값(now())이라 가짜가 대신 찍는다 — 기본은 NOW(종료 시각). */
function endTx(opts: { scenarios?: Row[]; repetition?: Row[]; obsAt?: Date } = {}) {
  const calls: { op: string; args?: unknown }[] = []
  const scenarios = opts.scenarios ?? [{ id: 'scn_seed', userId: null, isSeed: true, title: '사이즈·온도 바꿔 주문하기', titleJa: 'サイズと温度を変えて注文する', keyExpressions: KEY_EXPRESSIONS, completionRule: { requiredExpressions: 2, tutorJudgement: true } }]
  const repetition = [...(opts.repetition ?? [])]
  const observations: FakeObs[] = []
  const logs: Row[] = []
  let daily: unknown = null
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?')
      calls.push({ op: sql.includes('`User`') ? 'lockUser' : 'lockDaily', args: values })
      return sql.includes('`User`') ? [{ id: values[0] }] : [{ id: 'daily-row' }]
    },
    $executeRaw: async () => {
      calls.push({ op: 'ensureDaily' })
      if (daily === null) daily = emptyDaily()
      return 1
    },
    learningObservation: {
      findFirst: async (args: { where: Row }) => {
        calls.push({ op: 'obs.findFirst', args })
        const o = observations.find((x) => matches(x as unknown as Row, args.where))
        return o ? { meta: o.meta ?? null } : null
      },
      createMany: async (args: { data: FakeObs[] }) => {
        calls.push({ op: 'obs.createMany', args })
        observations.push(...args.data.map((o) => ({ occurredAt: opts.obsAt ?? NOW, ...o })))
        return { count: args.data.length }
      },
    },
    scenario: {
      findFirst: async (args: { where: Row }) => {
        calls.push({ op: 'scenario.findFirst', args })
        return scenarios.find((x) => matches(x, args.where)) ?? null
      },
    },
    topicChunk: {
      findMany: async (args: { where: { id: { in: string[] } } }) => {
        calls.push({ op: 'chunk.findMany', args })
        return args.where.id.in.flatMap((id) => (CHUNKS.has(id) ? [{ id, ...CHUNKS.get(id)! }] : []))
      },
    },
    repetitionItem: {
      findMany: async () => repetition,
      create: async (args: { data: Row }) => {
        calls.push({ op: 'rep.create', args })
        const id = `rep${repetition.length + 1}`
        repetition.push({ id, ...args.data })
        return { id }
      },
      update: async (args: unknown) => {
        calls.push({ op: 'rep.update', args })
        return {}
      },
    },
    studyLog: {
      create: async (args: { data: Row }) => {
        calls.push({ op: 'log.create', args })
        const id = `log${logs.length + 1}`
        logs.push({ id, ...args.data })
        return { id }
      },
      findFirst: async (args: { where: Row }) => {
        calls.push({ op: 'log.findFirst', args })
        return (logs.find((l) => matches(l, args.where)) as { id: string; result: unknown } | undefined) ?? null
      },
    },
    statsSnapshot: {
      findUnique: async () => ({ data: daily }),
      update: async (args: { data: { data: unknown } }) => {
        calls.push({ op: 'daily.update', args })
        daily = args.data.data
        return {}
      },
    },
  }
  return { tx: tx as unknown as Tx, calls, observations, logs, repetition, daily: () => daily as Row }
}

const CHAT_AT = new Date('2026-10-06T09:58:00Z')

const WRITE_OPS = new Set(['rep.create', 'rep.update', 'log.create', 'daily.update', 'obs.createMany', 'ensureDaily'])
const writes = (calls: { op: string }[]) => calls.filter((c) => WRITE_OPS.has(c.op)).map((c) => c.op)

function endInput(over: Partial<ScenarioEndInput> = {}): ScenarioEndInput {
  return {
    chatId: 'chat_rp_1',
    chatCreatedAt: CHAT_AT,
    scenarioId: 'scn_seed',
    lessonId: 'les_mine',
    topicId: 't_cafe',
    turns: 2,
    learnerTexts: ['コーヒーをください', '大きいサイズにしてください'],
    corrections: { proposed: 3, accepted: 1, ignored: 1 },
    hintsUsed: 2,
    selfCorrections: 1,
    startedAt: new Date('2026-10-06T10:00:00Z'),
    verdict: { goalAchieved: true, communicationSuccess: true, usedExpressionIds: ['e2', 'zzz'], missedExpressionIds: ['e3'] },
    ...over,
  }
}

const NOW = new Date('2026-10-06T10:05:00Z')

test('종료 한 트랜잭션: 사용자 잠금 먼저 → RepetitionItem(SCENARIO) 1 · StudyLog(TALK, DIRECT) 1 · DAILY 2회 갱신 · 관측(SCENARIO_COMPLETED) 1 — 교정·삭제 없음', async () => {
  const f = endTx()
  const r = await endScenarioRolePlay(U, endInput(), f.tx, { now: NOW })
  assert.equal(f.calls[0].op, 'lockUser', '첫 쿼리 = 사용자 행 잠금')
  assert.deepEqual(f.calls[0].args, [U])
  assert.deepEqual(writes(f.calls), ['rep.create', 'log.create', 'ensureDaily', 'daily.update', 'obs.createMany', 'ensureDaily', 'daily.update'])
  assert.ok(!f.calls.some((c) => /correction|delete/i.test(c.op)), 'Correction·삭제 경로를 건드리지 않음')

  const rep = f.calls.find((c) => c.op === 'rep.create')!.args as { data: Row }
  assert.deepEqual(
    [rep.data.userId, rep.data.itemType, rep.data.refType, rep.data.refId, rep.data.textJa, rep.data.meaningKo, rep.data.studiedCount, rep.data.correctCount, rep.data.wrongCount, rep.data.decidedBy],
    [U, 'SCENARIO', SCENARIO_REPETITION_REF_TYPE, 'scn_seed', 'サイズと温度を変えて注文する', '사이즈·온도 바꿔 주문하기', 1, 1, 0, 'FALLBACK'],
  )

  const log = (f.calls.find((c) => c.op === 'log.create')!.args as { data: Row }).data
  assert.deepEqual([log.userId, log.type, log.origin, log.refId, log.correctionsCount, log.durationSec], [U, 'TALK', 'DIRECT', 'chat_rp_1', 3, 300])
  assert.equal(log.summary, '상황 역할극 「사이즈·온도 바꿔 주문하기」 · 목표 달성 · 핵심 표현 4/4')
  const result = log.result as { turns: number; corrections: Row; scenario: Row; endOfTopic: boolean }
  assert.deepEqual([result.turns, result.corrections, result.endOfTopic], [2, { proposed: 3, accepted: 1, ignored: 1 }, false])
  assert.deepEqual(result.scenario, {
    scenarioId: 'scn_seed',
    outcome: 'ACHIEVED',
    goalAchieved: true,
    tutorGoalAchieved: true,
    codeRulePassed: true,
    communicationSuccess: true,
    judged: true,
    hintsUsed: 2,
    selfCorrections: 1,
    usedExpressionIds: ['chunk_coffee', 'e2', 'e3', 'e4'],
    missedExpressionIds: [],
    verifiedExpressionIds: ['chunk_coffee', 'e3', 'e4'],
    requiredExpressions: 2,
    totalExpressions: 4,
    topicId: 't_cafe',
    lessonId: 'les_mine',
    repetitionItemId: 'rep1',
  })
  assert.ok(!JSON.stringify(log).includes('コーヒーをください'), '학습자 말 원문은 저장하지 않음')

  const d = f.daily() as Row & { corrections: Row; repetition: Row; observations: { total: number; bySkill: Record<string, Row> } }
  assert.deepEqual([d.talkTurns, d.corrections.proposed, d.corrections.accepted, d.repetition.studied], [2, 3, 0, 1], 'DAILY = 기존 TALK 종료 칸(talkTurns·corrections.proposed) + repetition.studied')
  assert.equal(d.observations.total, 1)
  assert.deepEqual(d.observations.bySkill.CONVERSATION_MAINTAIN, { success: 1, partial: 0, fail: 0, skipped: 0 })

  assert.equal(f.observations.length, 1)
  const o = f.observations[0]
  assert.deepEqual([o.kind, o.outcome, o.skill, o.refType, o.refId, o.scenarioId, o.confidence], ['SCENARIO_COMPLETED', 'SUCCESS', 'CONVERSATION_MAINTAIN', 'Chat', 'chat_rp_1', 'scn_seed', 1])
  assert.ok(JSON.stringify(o.meta).length <= 1024)
  assert.deepEqual([r.replayed, r.outcome, r.studyLogId, r.repetitionItemId, r.expressions.usedIds.length, r.expressions.verifiedIds.length], [false, 'ACHIEVED', 'log1', 'rep1', 4, 3])
  assert.equal(await isScenarioRolePlayEnded(U, { id: 'chat_rp_1', createdAt: CHAT_AT }, f.tx), true)
  assert.equal(await isScenarioRolePlayEnded(OTHER, { id: 'chat_rp_1', createdAt: CHAT_AT }, f.tx), false)
})

test('끝낸 표식 조회 = 대화 생성 시각 하한(REV-134 M-2): 멱등 확인·isScenarioRolePlayEnded 둘 다 occurredAt ≥ Chat.createdAt − 하루 · 경계 안은 끝냄 · 밖은 아님', async () => {
  const since = new Date(CHAT_AT.getTime() - SCENARIO_END_LOOKUP_MARGIN_MS)
  assert.deepEqual(scenarioEndLookupSince(CHAT_AT), since)
  assert.equal(scenarioEndLookupSince(new Date('nope')), null)
  assert.equal(scenarioEndLookupSince(undefined), null)

  const f = endTx()
  await endScenarioRolePlay(U, endInput(), f.tx, { now: NOW })
  const probe = f.calls.find((c) => c.op === 'obs.findFirst')!.args as { where: Row }
  assert.deepEqual(probe.where, { userId: U, occurredAt: { gte: since }, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: 'chat_rp_1' }, '시간 하한이 있어야 (userId, occurredAt) 범위만 탄다')
  const ended = f.calls.filter((c) => c.op === 'obs.findFirst').length
  assert.equal(await isScenarioRolePlayEnded(U, { id: 'chat_rp_1', createdAt: CHAT_AT }, f.tx), true)
  const turnProbe = f.calls.filter((c) => c.op === 'obs.findFirst')[ended].args as { where: Row }
  assert.deepEqual(turnProbe.where, probe.where, '턴 경로 확인도 같은 하한')

  // 경계: 표식이 하한과 같으면 끝낸 대화(gte), 1ms 앞이면 이 대화의 표식이 아니다(대화보다 하루 넘게 먼저 생긴 표식은 없다).
  const edge = endTx({ obsAt: since })
  await endScenarioRolePlay(U, endInput(), edge.tx, { now: NOW })
  assert.equal(await isScenarioRolePlayEnded(U, { id: 'chat_rp_1', createdAt: CHAT_AT }, edge.tx), true)
  assert.equal((await endScenarioRolePlay(U, endInput(), edge.tx, { now: NOW })).replayed, true)
  const before = endTx({ obsAt: new Date(since.getTime() - 1) })
  await endScenarioRolePlay(U, endInput(), before.tx, { now: NOW })
  assert.equal(await isScenarioRolePlayEnded(U, { id: 'chat_rp_1', createdAt: CHAT_AT }, before.tx), false)

  // 생성 시각이 이상하면 하한 없이 찾는다(느리지만 결과는 같다).
  const bad = endTx()
  await endScenarioRolePlay(U, endInput({ chatCreatedAt: new Date('nope') }), bad.tx, { now: NOW })
  const badProbe = bad.calls.find((c) => c.op === 'obs.findFirst')!.args as { where: Row }
  assert.equal('occurredAt' in badProbe.where, false)
  assert.equal(await isScenarioRolePlayEnded(U, { id: 'chat_rp_1', createdAt: new Date('nope') }, bad.tx), true)
  assert.equal(await isScenarioRolePlayEnded(U, { id: '', createdAt: CHAT_AT }, bad.tx), false)
})

test('종료 멱등: 같은 대화 두 번째 종료는 쓰기 0 · 처음 결과 그대로(replayed)', async () => {
  const f = endTx()
  const first = await endScenarioRolePlay(U, endInput(), f.tx, { now: NOW })
  const before = writes(f.calls).length
  const again = await endScenarioRolePlay(U, endInput({ verdict: { goalAchieved: false } }), f.tx, { now: NOW })
  assert.equal(writes(f.calls).length, before, '두 번째는 쓰기 없음')
  assert.equal(f.calls.filter((c) => c.op === 'lockUser').length, 2, '두 번째도 사용자 잠금 뒤에 확인한다(동시 요청 직렬화)')
  assert.deepEqual([again.replayed, again.outcome, again.studyLogId, again.repetitionItemId, again.goalAchieved, again.turns, again.hintsUsed], [true, first.outcome, first.studyLogId, first.repetitionItemId, true, 2, 2])
  assert.deepEqual(again.expressions, first.expressions)
  f.logs.length = 0
  const afterLogDeleted = await endScenarioRolePlay(U, endInput(), f.tx, { now: NOW })
  assert.deepEqual([afterLogDeleted.replayed, afterLogDeleted.studyLogId, afterLogDeleted.outcome, afterLogDeleted.expressions.usedIds], [true, null, 'ACHIEVED', []], 'StudyLog 를 지워도(#73) 다시 기록하지 않음 — 표식은 관측')
  assert.equal(writes(f.calls).length, before)
})

test('종료 판정 없음(A1-PE 전): 달성으로 올리지 않음 · 관측 신뢰도 0.5 · 반복 학습은 "아직"(오답 +1)', async () => {
  const f = endTx()
  const r = await endScenarioRolePlay(U, endInput({ verdict: undefined }), f.tx, { now: NOW })
  assert.deepEqual([r.outcome, r.goalAchieved, r.judged, r.tutorGoalAchieved, r.codeRulePassed], ['ALMOST', false, false, null, true])
  assert.deepEqual([f.observations[0].outcome, f.observations[0].confidence], ['PARTIAL', SCENARIO_UNJUDGED_CONFIDENCE])
  const rep = (f.calls.find((c) => c.op === 'rep.create')!.args as { data: Row }).data
  assert.deepEqual([rep.correctCount, rep.wrongCount], [0, 1])

  const g = endTx()
  const miss = await endScenarioRolePlay(U, endInput({ verdict: { goalAchieved: false, communicationSuccess: false }, learnerTexts: ['はい'] }), g.tx, { now: NOW })
  assert.deepEqual([miss.outcome, g.observations[0].outcome, g.observations[0].confidence], ['NOT_YET', 'FAIL', 1])
  assert.ok(String((g.calls.find((c) => c.op === 'log.create')!.args as { data: Row }).data.summary).includes('아직 목표 전 · 핵심 표현 0/4'))
})

test('종료 거부: 0턴 409(아무 쿼리도 없음) · 남의 상황 404(기록 없음) · 잘못된 id 404', async () => {
  const f = endTx()
  await assert.rejects(endScenarioRolePlay(U, endInput({ turns: 0 }), f.tx, { now: NOW }), expectApi('CONFLICT', (e) => assert.deepEqual(e.details, { reason: 'NO_TURNS' })))
  assert.equal(f.calls.length, 0)
  const g = endTx({ scenarios: [{ id: 'scn_theirs', userId: OTHER, isSeed: false, title: 'x', titleJa: null, keyExpressions: [], completionRule: {} }] })
  await assert.rejects(endScenarioRolePlay(U, endInput({ scenarioId: 'scn_theirs' }), g.tx, { now: NOW }), expectApi('NOT_FOUND'))
  assert.deepEqual(writes(g.calls), [])
  await assert.rejects(endScenarioRolePlay(U, endInput({ chatId: '' }), g.tx), expectApi('NOT_FOUND'))
  await assert.rejects(endScenarioRolePlay(U, endInput({ scenarioId: 'x'.repeat(41) }), g.tx), expectApi('NOT_FOUND'))
})

test('종료 재도전: 이미 있는 RepetitionItem(SCENARIO) 은 update(증가만)', async () => {
  const f = endTx({ repetition: [{ id: 'rep_old', refType: SCENARIO_REPETITION_REF_TYPE, refId: 'scn_seed', intervalDays: 5, priority: 'NORMAL', feedbackCount: 0 }] })
  const r = await endScenarioRolePlay(U, endInput(), f.tx, { now: NOW })
  assert.deepEqual(writes(f.calls).slice(0, 2), ['rep.update', 'log.create'])
  const up = f.calls.find((c) => c.op === 'rep.update')!.args as { where: Row; data: Row }
  assert.deepEqual([up.where.id, up.data.studiedCount, up.data.correctCount, up.data.wrongCount, up.data.intervalDays], ['rep_old', { increment: 1 }, { increment: 1 }, { increment: 0 }, 5])
  assert.equal(r.repetitionItemId, 'rep_old')
})
