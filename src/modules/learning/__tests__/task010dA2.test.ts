/**
 * task-010d A2 — #59 `{scenarioId}` 상황 수업(서버). DB·LLM 없음 — 가짜 db·가짜 tx.
 *  ① 본문 검증: scenarioId 형식·sourceText 동시 400·topicId 형식
 *  ② 재료: 접근(시드·본인 / 남의·무주 404)·숨김 409·이어지지 않은 주제 400·대표 주제(최대 weight·동률 topicId 오름차순 첫 번째·남의 주제 제외·없음 null)·수준·이전 수업 키
 *     — 규칙은 역할극 대화 시작(#28)과 같은 `resolveScenarioChatStart` 를 그대로 태운다
 *  ③ 재사용 키: 일반 ↔ 상황 · 상황 ↔ 다른 상황은 재사용 안 함, 같은 상황은 재사용, 되살리기(FAILED)도 같은 키 안에서만, 붙여넣기는 재사용 없음
 *  ④ 저장: `Lesson.scenarioId`·`topicId`·제목·잡 promptVersion
 *  ⑤ DTO: `LessonDto.scenarioId`·#58 항목
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Tx } from '@/modules/infra'
import { ApiError } from '@/modules/infra'
import { claimLessonTx, loadScenarioLessonMaterials, sameLessonWhere, type LessonGeneration, type LessonMaterials, type ScenarioLessonDeps } from '../lessons/generate'
import { toLessonDto, type LessonRow } from '../lessons/rows'
import { parseCreateLessonBody } from '../lessons/validate'
import { readScenarioRolePlayMaterial, resolveScenarioChatStart, type ScenarioMaterialDb, type ScenarioStartDb } from '../scenarios/start'
import type { LessonTopicMaterial } from '../topics'

const U = 'cuser00000000000000000001'
const U2 = 'cuser00000000000000000002'
const TODAY = '2026-10-07'

function code(c: string, reason?: string) {
  return (e: unknown) => {
    assert.ok(e instanceof ApiError, `ApiError 기대: ${String(e)}`)
    assert.equal(e.code, c)
    if (reason !== undefined) assert.equal((e.details as { reason?: string } | undefined)?.reason, reason)
    return true
  }
}

// ── ① 본문 검증 ─────────────────────────────────────────────────────────────────────────────

test('#59 본문: {scenarioId} = 상황 수업, {scenarioId, topicId} = 주제 지정, 형식 틀림 400', () => {
  assert.deepEqual(parseCreateLessonBody({ scenarioId: 'scn-1' }), { kind: 'scenario', scenarioId: 'scn-1', topicId: null })
  assert.deepEqual(parseCreateLessonBody({ scenarioId: 'scn-1', topicId: 't-1' }), { kind: 'scenario', scenarioId: 'scn-1', topicId: 't-1' })
  assert.deepEqual(parseCreateLessonBody({ scenarioId: 'scn-1', topicId: null }), { kind: 'scenario', scenarioId: 'scn-1', topicId: null })
  assert.throws(() => parseCreateLessonBody({ scenarioId: '../x' }), code('VALIDATION', 'invalid'))
  assert.throws(() => parseCreateLessonBody({ scenarioId: 7 }), code('VALIDATION', 'invalid'))
  assert.throws(() => parseCreateLessonBody({ scenarioId: 'x'.repeat(41) }), code('VALIDATION', 'invalid'))
  assert.throws(() => parseCreateLessonBody({ scenarioId: 'scn-1', topicId: 'a b' }), code('VALIDATION', 'invalid'))
  assert.throws(() => parseCreateLessonBody({ scenarioId: 'scn-1', extra: 1 }), code('VALIDATION', 'unknown_key'))
})

test('#59 본문: scenarioId 와 sourceText 를 같이 보내면 400 not_with_scenario(문장이 어떤 값이든)', () => {
  const ja = 'これは日本語の文章です。'.repeat(6)
  for (const body of [{ scenarioId: 'scn-1', sourceText: ja }, { scenarioId: 'scn-1', topicId: 't-1', sourceText: ja }, { scenarioId: 'scn-1', sourceText: '' }]) {
    assert.throws(() => parseCreateLessonBody(body), (e: unknown) => {
      code('VALIDATION', 'not_with_scenario')(e)
      assert.equal(((e as ApiError).details as { field?: string }).field, 'sourceText')
      return true
    })
  }
})

test('#59 본문: 일반 수업 규칙은 그대로(주제/문장 하나, 둘 다·둘 다 없음 400 one_of)', () => {
  assert.deepEqual(parseCreateLessonBody({ topicId: 't1' }), { kind: 'topic', topicId: 't1' })
  assert.deepEqual(parseCreateLessonBody({ topicId: 't1', scenarioId: null }), { kind: 'topic', topicId: 't1' })
  assert.throws(() => parseCreateLessonBody({}), code('VALIDATION', 'one_of'))
  assert.throws(() => parseCreateLessonBody({ topicId: 't1', sourceText: 'x' }), code('VALIDATION', 'one_of'))
})

// ── ② 재료(가짜 db — `scenarioAccessWhere` 조건을 그대로 평가) ─────────────────────────────

interface FakeTopicLink { topicId: string; weight: number; topic: { id: string; title: string; userId: string | null } }
interface FakeScenario {
  id: string
  userId: string | null
  isSeed: boolean
  status: string
  title: string
  titleJa: string | null
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  roles: unknown
  goal: unknown
  constraints: unknown
  keyExpressions: unknown
  completionRule: unknown
  topics: FakeTopicLink[]
}

const link = (topicId: string, weight: number, userId: string | null = null): FakeTopicLink => ({ topicId, weight, topic: { id: topicId, title: `주제 ${topicId}`, userId } })
const body = { roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoal_ko: '주문을 바꾼다', successCriteria: ['바꿨다'] }, constraints: { steps: [{ ko: '인사' }, { ko: '바꾸기' }] }, keyExpressions: [{ id: 'e1', ja: 'サイズを変えてください', ko: '사이즈를 바꿔 주세요' }, { id: 'e2', ja: 'ホットにしてください', ko: '따뜻하게요' }], completionRule: { requiredExpressions: 1 } }
const SCENARIOS: FakeScenario[] = [
  // 동률(2·2)은 배열 순서와 무관하게 topicId 오름차순 첫 번째(t-a) — 남의 주제(t-z, weight 9)는 고르지 않는다
  { id: 'scn-seed', userId: null, isSeed: true, status: 'ACTIVE', title: '카페에서 주문 바꾸기', titleJa: 'カフェで注文を変える', level: 'N5', ...body, topics: [link('t-b', 1), link('t-c', 2), link('t-z', 9, U2), link('t-a', 2)] },
  { id: 'scn-mine', userId: U, isSeed: false, status: 'ACTIVE', title: '내 상황(장소 없음)', titleJa: null, level: 'N3', ...body, topics: [] },
  { id: 'scn-empty-topic', userId: U, isSeed: false, status: 'ACTIVE', title: '조각 없는 장소', titleJa: null, level: 'N3', ...body, topics: [link('t-empty', 1, U)] },
  { id: 'scn-other', userId: U2, isSeed: false, status: 'ACTIVE', title: '남의 상황', titleJa: null, level: 'N5', ...body, topics: [] },
  { id: 'scn-orphan', userId: null, isSeed: false, status: 'ACTIVE', title: '무주 상황', titleJa: null, level: 'N5', ...body, topics: [] },
  { id: 'scn-arch', userId: U, isSeed: false, status: 'ARCHIVED', title: '숨긴 상황', titleJa: null, level: 'N5', ...body, topics: [link('t-a', 1)] },
  { id: 'scn-seed-arch', userId: null, isSeed: true, status: 'ARCHIVED', title: '숨긴 시드', titleJa: null, level: 'N5', ...body, topics: [] },
]

const TOPICS: Record<string, LessonTopicMaterial> = {
  't-a': { id: 't-a', title: '주제 t-a', titleJa: null, level: 'N4', chunks: [{ id: 'ca1', chunkType: 'ACTION', textJa: '注文する', reading: 'ちゅうもんする', meaningKo: '주문하다', order: 1 }] as LessonTopicMaterial['chunks'] },
  't-b': { id: 't-b', title: '주제 t-b', titleJa: null, level: 'N5', chunks: [] },
  't-c': { id: 't-c', title: '주제 t-c', titleJa: null, level: 'N5', chunks: [] },
  't-empty': { id: 't-empty', title: '주제 t-empty', titleJa: null, level: 'N2', chunks: [] },
}

type AccessWhere = { id: string; OR?: ({ userId: null; isSeed: true } | { userId: string })[] }
/** Prisma 와 같게 해석 — `OR` 이 없으면 id 만 본다(소유 조건이 빠진 변이를 시험이 404 단언으로 잡게). */
function matchesAccess(s: FakeScenario, where: AccessWhere): boolean {
  if (s.id !== where.id) return false
  if (!where.OR) return true
  return where.OR.some((c) => ('isSeed' in c ? s.userId === null && s.isSeed === c.isSeed : s.userId === c.userId))
}

function fakeScenarioDb() {
  const calls: string[] = []
  const db = {
    lesson: { findFirst: async () => null },
    scenario: {
      findFirst: async ({ where }: { where: AccessWhere }) => {
        calls.push(`scenario:${where.id}`)
        return SCENARIOS.find((s) => matchesAccess(s, where)) ?? null
      },
    },
    topicChunk: { findMany: async () => [] },
  }
  return { db, calls }
}

function deps(over: Partial<ScenarioLessonDeps> = {}) {
  const { db, calls } = fakeScenarioDb()
  const historyKeys: unknown[] = []
  const d: ScenarioLessonDeps = {
    start: (u, i) => resolveScenarioChatStart(u, i, db as unknown as ScenarioStartDb),
    material: (u, id) => readScenarioRolePlayMaterial(u, id, db as unknown as ScenarioMaterialDb),
    topic: async (_u, id) => TOPICS[id] ?? null,
    history: async (_u, key) => {
      historyKeys.push(key)
      return { previousTitles: ['이전 제목'], previousNextPreview: null }
    },
    ...over,
  }
  return { d, calls, historyKeys }
}

const scenarioInput = (scenarioId: string, topicId: string | null = null) => ({ kind: 'scenario' as const, scenarioId, topicId })

test('재료: 시드 상황 → 대표 주제 = 최대 weight, 동률이면 topicId 오름차순 첫 번째(t-a) · 남의 주제(t-z) 제외 · 수준 = 주제 수준 · 이전 수업 키 = 주제', async () => {
  const { d, historyKeys } = deps()
  const m = await loadScenarioLessonMaterials(U, scenarioInput('scn-seed'), d)
  assert.equal(m.topic?.id, 't-a')
  assert.equal(m.scenario?.id, 'scn-seed')
  assert.equal(m.scenario?.title, '카페에서 주문 바꾸기')
  assert.equal(m.level, 'N4', '대표 주제 수준(상황 N5 아님)')
  assert.deepEqual(historyKeys, [{ topicId: 't-a' }])
  assert.deepEqual(m.previousTitles, ['이전 제목'])
  assert.deepEqual(m.scenario?.expressions.map((e) => e.id), ['e1', 'e2'])
})

test('재료: 요청 topicId 가 이어진 주제면 그 주제(t-b, weight 1이어도), 이어지지 않았거나 남의 주제면 400 not_linked', async () => {
  const { d } = deps()
  const m = await loadScenarioLessonMaterials(U, scenarioInput('scn-seed', 't-b'), d)
  assert.equal(m.topic?.id, 't-b')
  assert.equal(m.level, 'N5')
  await assert.rejects(loadScenarioLessonMaterials(U, scenarioInput('scn-seed', 't-q'), d), code('VALIDATION', 'not_linked'))
  await assert.rejects(loadScenarioLessonMaterials(U, scenarioInput('scn-seed', 't-z'), d), code('VALIDATION', 'not_linked'))
})

test('재료: 이어진 주제가 없는 내 상황 → topic null(상황 단독)·수준 = 상황 수준·이전 수업 키 = 상황', async () => {
  const { d, historyKeys } = deps()
  const m = await loadScenarioLessonMaterials(U, scenarioInput('scn-mine'), d)
  assert.equal(m.topic, null)
  assert.equal(m.scenario?.id, 'scn-mine')
  assert.equal(m.level, 'N3')
  assert.deepEqual(historyKeys, [{ scenarioId: 'scn-mine' }])
})

test('재료: 조각 없는 대표 주제도 topicId 로는 남는다(프롬프트는 라우트가 상황 단독으로) · 수준 = 그 주제 수준', async () => {
  const { d } = deps()
  const m = await loadScenarioLessonMaterials(U, scenarioInput('scn-empty-topic'), d)
  assert.equal(m.topic?.id, 't-empty')
  assert.equal(m.topic?.chunks.length, 0)
  assert.equal(m.level, 'N2')
})

test('재료: 남의 상황·무주(isSeed 아님) 상황·없는 상황 404 — 다른 사용자 입장에서도 내 상황은 404', async () => {
  const { d } = deps()
  for (const id of ['scn-other', 'scn-orphan', 'scn-none']) await assert.rejects(loadScenarioLessonMaterials(U, scenarioInput(id), d), code('NOT_FOUND'), id)
  await assert.rejects(loadScenarioLessonMaterials(U2, scenarioInput('scn-mine'), d), code('NOT_FOUND'))
  const other = await loadScenarioLessonMaterials(U2, scenarioInput('scn-other'), d)
  assert.equal(other.scenario?.id, 'scn-other', '본인 것은 열린다')
})

test('재료: 숨긴(ARCHIVED) 상황은 새 수업도 409 ARCHIVED — 내 것·시드 모두, 주제 지정과 무관', async () => {
  const { d } = deps()
  await assert.rejects(loadScenarioLessonMaterials(U, scenarioInput('scn-arch'), d), code('CONFLICT', 'ARCHIVED'))
  await assert.rejects(loadScenarioLessonMaterials(U, scenarioInput('scn-arch', 't-a'), d), code('CONFLICT', 'ARCHIVED'))
  await assert.rejects(loadScenarioLessonMaterials(U, scenarioInput('scn-seed-arch'), d), code('CONFLICT', 'ARCHIVED'))
})

test('재료: 판정과 재료 읽기 사이에 상황이 사라지면 404(재료 null)', async () => {
  const { d } = deps({ material: async () => null })
  await assert.rejects(loadScenarioLessonMaterials(U, scenarioInput('scn-seed'), d), code('NOT_FOUND'))
})

// ── ③④ 재사용 키·점유(가짜 tx) ─────────────────────────────────────────────────────────────

interface FakeLesson { id: string; userId: string; topicId: string | null; scenarioId: string | null; kind: string; date: Date; status: string; createdAt: number; title?: string; level?: string; sourceText?: string | null }
interface FakeJob { id: string; userId: string; kind: string; refId: string | null; status: string; createdAt: Date; startedAt: Date | null; payload?: unknown }

function fakeTx(lessons: FakeLesson[], jobs: FakeJob[] = []) {
  const created: Record<string, unknown>[] = []
  const revived: string[] = []
  const eq = (v: unknown, w: unknown) => w === undefined || v === w
  const tx = {
    $queryRaw: async () => [{ id: U }],
    lesson: {
      findMany: async ({ where }: { where: { userId: string; topicId: string | null; scenarioId: string | null; kind: string; date: Date; status: { in: string[] } } }) =>
        lessons
          .filter((l) => l.userId === where.userId && eq(l.topicId, where.topicId) && eq(l.scenarioId, where.scenarioId) && l.kind === where.kind && l.date.getTime() === where.date.getTime() && where.status.in.includes(l.status))
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((l) => ({ id: l.id, status: l.status })),
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: { status: string } }) => {
        const l = lessons.find((x) => x.id === where.id && x.status === where.status)
        if (l) l.status = data.status
        return { count: l ? 1 : 0 }
      },
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        revived.push(where.id)
        const l = lessons.find((x) => x.id === where.id)!
        l.status = data.status
        return { id: l.id }
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data)
        const id = `new-lesson-${created.length}`
        lessons.push({ id, userId: data.userId as string, topicId: data.topicId as string | null, scenarioId: data.scenarioId as string | null, kind: 'NEW', date: data.date as Date, status: 'GENERATING', createdAt: 99 })
        return { id }
      },
    },
    aiJob: {
      findMany: async ({ where }: { where: { userId: string; kind: string; refId?: string; status: { in: string[] } } }) =>
        jobs.filter((j) => j.userId === where.userId && j.kind === where.kind && (where.refId === undefined || j.refId === where.refId) && where.status.in.includes(j.status)),
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const job: FakeJob = { id: `job-${jobs.length + 1}`, userId: data.userId as string, kind: data.kind as string, refId: data.refId as string | null, status: 'QUEUED', createdAt: new Date(), startedAt: null, payload: data.payload }
        jobs.push(job)
        return { id: job.id }
      },
    },
  }
  return { tx: tx as unknown as Tx, created, revived, jobs }
}

const DAY = new Date(`${TODAY}T00:00:00.000Z`)
const lessonRow = (id: string, topicId: string | null, scenarioId: string | null, status = 'READY', createdAt = 1): FakeLesson => ({ id, userId: U, topicId, scenarioId, kind: 'NEW', date: DAY, status, createdAt })

const GEN: LessonGeneration = { request: {} as LessonGeneration['request'], promptVersion: 'lessonScenario@v1', inputMeta: { source: 'scenario' } }
const GEN_PLAIN: LessonGeneration = { request: {} as LessonGeneration['request'], promptVersion: 'lesson@v9', inputMeta: { source: 'topic' } }

const topicT: LessonTopicMaterial = { id: 'T', title: '카페', titleJa: null, level: 'N5', chunks: [] }
function mats(kind: 'topic' | 'scenario' | 'scenarioOnly' | 'text', scenarioId = 'S1'): LessonMaterials {
  const scenario = { id: scenarioId, title: `상황 ${scenarioId}`, titleJa: null, level: 'N3' } as LessonMaterials['scenario']
  if (kind === 'topic') return { input: { kind: 'topic', topicId: 'T' }, topic: topicT, scenario: null, level: 'N5', previousTitles: [], previousNextPreview: null }
  if (kind === 'text') return { input: { kind: 'text', sourceText: 'これは文章です' }, topic: null, scenario: null, level: 'N4', previousTitles: [], previousNextPreview: null }
  if (kind === 'scenarioOnly') return { input: { kind: 'scenario', scenarioId, topicId: null }, topic: null, scenario, level: 'N3', previousTitles: [], previousNextPreview: null }
  return { input: { kind: 'scenario', scenarioId, topicId: null }, topic: topicT, scenario, level: 'N5', previousTitles: [], previousNextPreview: null }
}

test('재사용 키(순수): 일반 = scenarioId null · 상황 = (주제, 상황) · 주제 없는 상황 = topicId null · 붙여넣기 = 재사용 없음', () => {
  const w = (m: LessonMaterials) => sameLessonWhere(U, m, DAY)
  assert.deepEqual({ t: w(mats('topic'))?.topicId, s: w(mats('topic'))?.scenarioId }, { t: 'T', s: null })
  assert.deepEqual({ t: w(mats('scenario'))?.topicId, s: w(mats('scenario'))?.scenarioId }, { t: 'T', s: 'S1' })
  assert.deepEqual({ t: w(mats('scenarioOnly'))?.topicId, s: w(mats('scenarioOnly'))?.scenarioId }, { t: null, s: 'S1' })
  assert.equal(w(mats('text')), null)
  assert.ok(Object.prototype.hasOwnProperty.call(w(mats('topic')), 'scenarioId'), '일반 수업 키에도 scenarioId(null) 가 있어야 상황 수업을 재사용하지 않는다')
})

test('재사용: 같은 날 같은 주제의 일반 수업이 READY 여도 상황 수업은 새로 만든다(scenarioId·topicId 저장, 제목 = 상황 제목)', async () => {
  const f = fakeTx([lessonRow('L-general', 'T', null)])
  const r = await claimLessonTx(f.tx, U, mats('scenario'), GEN, TODAY, 'tr1')
  assert.equal(r.reused, false)
  assert.equal(f.created.length, 1)
  assert.equal(f.created[0].scenarioId, 'S1')
  assert.equal(f.created[0].topicId, 'T')
  assert.equal(f.created[0].title, '상황 S1')
  assert.equal(f.created[0].sourceText, null)
  assert.equal(f.created[0].level, 'N5')
  assert.equal((f.jobs.at(-1)?.payload as { promptVersion?: string }).promptVersion, 'lessonScenario@v1')
})

test('재사용: 상황 수업이 READY 여도 같은 주제 일반 수업 요청은 새로 만든다(scenarioId null 저장)', async () => {
  const f = fakeTx([lessonRow('L-s1', 'T', 'S1')])
  const r = await claimLessonTx(f.tx, U, mats('topic'), GEN_PLAIN, TODAY, 'tr1')
  assert.equal(r.reused, false)
  assert.equal(f.created[0].scenarioId, null)
  assert.equal(f.created[0].topicId, 'T')
  assert.equal(f.created[0].title, '카페')
})

test('재사용: 같은 주제의 다른 상황 수업은 재사용하지 않고, 같은 상황 수업은 재사용한다(새 잡 없음)', async () => {
  const f = fakeTx([lessonRow('L-s1', 'T', 'S1')])
  const other = await claimLessonTx(f.tx, U, mats('scenario', 'S2'), GEN, TODAY, 'tr1')
  assert.equal(other.reused, false)
  assert.equal(f.created[0].scenarioId, 'S2')
  const g = fakeTx([lessonRow('L-s1', 'T', 'S1', 'IN_PROGRESS')])
  const same = await claimLessonTx(g.tx, U, mats('scenario', 'S1'), GEN, TODAY, 'tr1')
  assert.deepEqual(same, { lessonId: 'L-s1', jobId: null, status: 'IN_PROGRESS', reused: true, claim: null })
  assert.equal(g.created.length, 0)
  assert.equal(g.jobs.length, 0)
})

test('재사용: 주제 없는 상황 수업도 같은 상황이면 재사용, 진행 중 생성이면 그 잡을 돌려준다', async () => {
  const f = fakeTx([lessonRow('L-only', null, 'S1', 'READY')])
  assert.equal((await claimLessonTx(f.tx, U, mats('scenarioOnly'), GEN, TODAY, 'tr1')).lessonId, 'L-only')
  const g = fakeTx([lessonRow('L-gen', null, 'S1', 'GENERATING')], [{ id: 'job-live', userId: U, kind: 'LESSON_GEN', refId: 'L-gen', status: 'RUNNING', createdAt: new Date(), startedAt: new Date() }])
  const r = await claimLessonTx(g.tx, U, mats('scenarioOnly'), GEN, TODAY, 'tr1')
  assert.deepEqual({ id: r.lessonId, job: r.jobId, reused: r.reused }, { id: 'L-gen', job: 'job-live', reused: true })
})

test('되살리기: 같은 키의 FAILED 만 되살린다 — 일반 수업 FAILED 는 상황 수업으로 덮지 않는다', async () => {
  const f = fakeTx([lessonRow('L-general-failed', 'T', null, 'FAILED')])
  const r = await claimLessonTx(f.tx, U, mats('scenario'), GEN, TODAY, 'tr1')
  assert.equal(f.revived.length, 0)
  assert.equal(r.lessonId, 'new-lesson-1')
  const g = fakeTx([lessonRow('L-s1-failed', 'T', 'S1', 'FAILED')])
  const r2 = await claimLessonTx(g.tx, U, mats('scenario'), GEN, TODAY, 'tr1')
  assert.deepEqual(g.revived, ['L-s1-failed'])
  assert.equal(r2.lessonId, 'L-s1-failed')
})

test('붙여넣기 수업은 이전처럼 재사용 확인 없이 새로 만든다(scenarioId null)', async () => {
  const f = fakeTx([lessonRow('L-text', null, null, 'READY')])
  const r = await claimLessonTx(f.tx, U, mats('text'), GEN_PLAIN, TODAY, 'tr1')
  assert.equal(r.reused, false)
  assert.equal(f.created[0].scenarioId, null)
  assert.equal(f.created[0].sourceText, 'これは文章です')
})

test('사용자당 동시 생성 1 은 상황 수업에도 그대로(다른 수업 생성 중 409 GENERATING)', async () => {
  const f = fakeTx([], [{ id: 'job-busy', userId: U, kind: 'LESSON_GEN', refId: 'L-x', status: 'RUNNING', createdAt: new Date(), startedAt: new Date() }])
  await assert.rejects(claimLessonTx(f.tx, U, mats('scenario'), GEN, TODAY, 'tr1'), code('CONFLICT', 'GENERATING'))
})

// ── ⑤ DTO ────────────────────────────────────────────────────────────────────────────────

test('LessonDto.scenarioId: 상황 수업은 id, 일반은 null, 칸이 없는 옛 행도 null', () => {
  const now = new Date('2026-10-07T00:00:00Z')
  const base = { id: 'l1', userId: U, topicId: 'T', date: now, kind: 'NEW', title: 't', level: 'N5', content: null, status: 'READY', stageDone: 0, progress: null, score: null, sourceLessonIds: null, sourceText: null, error: null, createdAt: now, updatedAt: now, completedAt: null, topic: { id: 'T', title: '카페' }, reviewSchedule: null }
  assert.equal(toLessonDto({ ...base, scenarioId: 'S1' } as unknown as LessonRow).scenarioId, 'S1')
  assert.equal(toLessonDto({ ...base, scenarioId: null } as unknown as LessonRow).scenarioId, null)
  assert.equal(toLessonDto(base as unknown as LessonRow).scenarioId, null)
})

test('#58·#60 직렬화: LESSON_SELECT·오늘 항목 select 에 scenarioId 가 있고 항목에 실린다(소스 확인)', () => {
  const rows = readFileSync(join(process.cwd(), 'src/modules/learning/lessons/rows.ts'), 'utf8')
  assert.match(rows, /LESSON_SELECT = \{[^}]*scenarioId: true/)
  const today = readFileSync(join(process.cwd(), 'src/modules/learning/lessons/today.ts'), 'utf8')
  assert.match(today, /ITEM_SELECT = \{[^}]*scenarioId: true/)
  assert.match(today, /scenarioId: r\.scenarioId \?\? null/)
})
