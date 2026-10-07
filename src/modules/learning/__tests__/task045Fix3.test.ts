/**
 * task-045 Codex C2 보완 — 상황 지우기(#165)를 사용자 잠금 아래 한 트랜잭션으로, 시드 사본이면 override 를 숨김으로(`detachCopy`),
 * 상황 수업(#59 `scenarioId`) 점유는 잠금 뒤 상황을 다시 확인한다(지우기·숨김 뒤 새 시작 금지). 역할극 대화 쪽은 conversation `task045Fix3RolePlay.test.ts`.
 * 메모리 가짜(`challengeFakeDb`) — 잠금은 사용자별 FIFO 뮤텍스, `$queryRaw`(infra `lockUserRow`)도 같은 잠금을 탄다. 공유 DB 를 건드리지 않는다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '@/modules/infra'
import { claimLessonTx, type LessonGeneration, type LessonMaterials } from '../lessons/generate'
import { archiveScenario } from '../scenarios/catalog'
import { assertScenarioStartableTx } from '../scenarios/start'
import { hideSeed, restoreSeed } from '../seedOverride/ops'
import { fakeDb, type FakeDbOptions } from './challengeFakeDb'
import { invariantViolations, type SeedFakeTables } from './seedOverrideFakeDb'

const U = 'userA'
const O = 'userB'
const TODAY = '2026-10-06'
type Row = Record<string, unknown>

function fixture(opts: FakeDbOptions = {}) {
  const f = fakeDb(opts)
  const T = f.tables
  T.conversationTopic.push({ id: 'topSeed', userId: null, isSeed: true, title: '카페', level: 'N5' })
  T.scenario.push(
    { id: 'scnMine', userId: U, isSeed: false, status: 'ACTIVE', title: '내 상황' },
    { id: 'scnSeed', userId: null, isSeed: true, status: 'ACTIVE', title: '시드 상황' },
    { id: 'scnSeed2', userId: null, isSeed: true, status: 'ACTIVE', title: '시드 상황 2' },
    { id: 'scnCopy', userId: U, isSeed: false, status: 'ACTIVE', title: '시드 상황 2 · 내 버전' },
    { id: 'scnOther', userId: O, isSeed: false, status: 'ACTIVE', title: '남의 상황' },
  )
  T.scenarioTopic.push({ scenarioId: 'scnSeed', topicId: 'topSeed', weight: 1 })
  T.userSeedOverride.push({ id: 'ovCopy', userId: U, kind: 'SCENARIO', seedId: 'scnSeed2', copyId: 'scnCopy' })
  return { f, T }
}

const reasonOf = (e: unknown) => (e instanceof ApiError ? `${e.code}:${String(e.details?.reason ?? '')}` : `raw:${(e as Error)?.message}`)
async function rejectsWith(p: Promise<unknown>, want: string): Promise<void> {
  try {
    await p
  } catch (e) {
    assert.equal(reasonOf(e), want)
    return
  }
  assert.fail(`${want} 로 실패해야 한다`)
}
const writes = (log: readonly string[]) => log.filter((l) => /\.(create|createMany|update|updateMany|delete|deleteMany)$/.test(l))
const scenarioOf = (T: ReturnType<typeof fixture>['T'], id: string) => T.scenario.find((s) => s.id === id) as Row
const tick = () => new Promise<void>((r) => setImmediate(r))

// ── #165 지우기: 잠금·트랜잭션·detachCopy ─────────────────────────────────────────────────────────

test('#165 내 상황 지우기 — 사용자 잠금 뒤에 읽고 쓴다 · 사본이 아니면 override 표에 쓰지 않는다', async () => {
  const { f, T } = fixture()
  const before = JSON.stringify(T.userSeedOverride)
  assert.deepEqual(await archiveScenario(U, 'scnMine', f.deps()), { id: 'scnMine', status: 'ARCHIVED', alreadyArchived: false })
  assert.equal(f.log[0], 'lockUser', '첫 호출이 잠금이어야 한다')
  assert.ok(f.log.indexOf('scenario.findFirst') > 0)
  assert.deepEqual(writes(f.log), ['scenario.updateMany'], '사본이 아니면 override 쓰기 0')
  assert.equal(scenarioOf(T, 'scnMine').status, 'ARCHIVED')
  assert.equal(JSON.stringify(T.userSeedOverride), before)
})

test('#165 시드의 내 버전(사본) 지우기 — 같은 트랜잭션에서 override copyId=null(시드는 숨김 유지) · 고아 0 · 남의 override 불변', async () => {
  const { f, T } = fixture()
  // 다른 사용자 행(같은 copyId 를 가리키는 비정상 행이라도) 은 내 지우기가 건드리지 않는다.
  T.userSeedOverride.push({ id: 'ovOther', userId: O, kind: 'SCENARIO', seedId: 'scnSeed2', copyId: 'scnCopy' })
  const r = await archiveScenario(U, 'scnCopy', f.deps())
  assert.equal(r.alreadyArchived, false)
  assert.equal(scenarioOf(T, 'scnCopy').status, 'ARCHIVED')
  const mine = T.userSeedOverride.find((o) => o.id === 'ovCopy') as Row
  assert.equal(mine.copyId, null, '숨김으로 바뀐다(행은 남는다 — 시드는 계속 가려진다)')
  assert.equal(mine.seedId, 'scnSeed2')
  assert.equal((T.userSeedOverride.find((o) => o.id === 'ovOther') as Row).copyId, 'scnCopy')
  assert.deepEqual(invariantViolations({ ...T, userSeedOverride: T.userSeedOverride.filter((o) => o.userId === U) } as unknown as SeedFakeTables), [])
  assert.deepEqual(writes(f.log), ['scenario.updateMany', 'userSeedOverride.updateMany'])
  // 시드 상황은 여전히 이 사용자에게 가려져 새로 시작할 수 없다.
  await rejectsWith(f.deps().transaction!((tx) => assertScenarioStartableTx(tx, U, 'scnSeed2')), 'NOT_FOUND:')
})

test('#165 두 번 연속 지우기 — 두 번째는 alreadyArchived · 쓰기 0 · override 불변(멱등)', async () => {
  const { f, T } = fixture()
  await archiveScenario(U, 'scnCopy', f.deps())
  const snap = JSON.stringify(T)
  f.log.length = 0
  assert.deepEqual(await archiveScenario(U, 'scnCopy', f.deps()), { id: 'scnCopy', status: 'ARCHIVED', alreadyArchived: true })
  assert.deepEqual(writes(f.log), [])
  assert.equal(JSON.stringify(T), snap)
})

test('#165 사용자 행 없음(잠금 false) → 404 USER_GONE · 쓰기 0 · 거절(시드 SEED·남의 것 404)은 그대로', async () => {
  const { f, T } = fixture()
  const snap = JSON.stringify(T)
  await rejectsWith(archiveScenario(U, 'scnMine', f.deps({ lockUser: async () => false })), 'NOT_FOUND:USER_GONE')
  await rejectsWith(archiveScenario(U, 'scnSeed', f.deps()), 'NOT_FOUND:SEED')
  await rejectsWith(archiveScenario(U, 'scnOther', f.deps()), 'NOT_FOUND:')
  assert.deepEqual(writes(f.log), [])
  assert.equal(JSON.stringify(T), snap)
})

test('#165 지우기는 트랜잭션 안에서만 쓴다 — 주입한 transaction 이 tx 를 넘기지 않으면 db 로 쓰지 않는다', async () => {
  const { f, T } = fixture()
  let ran = 0
  const r = await archiveScenario(U, 'scnMine', f.deps({ transaction: async (fn) => (ran++, f.deps().transaction!(fn)) }))
  assert.equal(ran, 1)
  assert.equal(r.alreadyArchived, false)
  assert.equal(scenarioOf(T, 'scnMine').status, 'ARCHIVED')
})

test('restoreSeed 상황 사본 경로 — archiveScenarioTx 재사용: 잠금 1회(중복 잠금·이중 트랜잭션 없음) · 사본 ARCHIVED · override 삭제', { timeout: 5000 }, async () => {
  const { f, T } = fixture()
  let txs = 0
  const r = await restoreSeed(U, 'SCENARIO', 'scnSeed2', {}, f.deps({ transaction: async (fn) => (txs++, f.deps().transaction!(fn)) }))
  assert.deepEqual({ path: r.path, copyId: r.copyId }, { path: 'COPY', copyId: 'scnCopy' })
  assert.equal(txs, 1, '트랜잭션 1개')
  assert.equal(f.log.filter((l) => l === 'lockUser').length, 1, '잠금 1회')
  assert.equal(scenarioOf(T, 'scnCopy').status, 'ARCHIVED')
  assert.ok(!T.userSeedOverride.some((o) => o.userId === U && o.seedId === 'scnSeed2'), 'override 삭제 — 시드가 다시 보인다')
  await f.deps().transaction!((tx) => assertScenarioStartableTx(tx, U, 'scnSeed2'))
})

// ── #59 상황 수업 점유: 잠금 뒤 상황 재확인 ────────────────────────────────────────────────────────

const GEN: LessonGeneration = { request: {} as LessonGeneration['request'], promptVersion: 'lessonScenario@fix3', inputMeta: { source: 'scenario' } }
const scenarioLesson = (scenarioId: string, topicId: string | null = null): LessonMaterials => ({
  input: { kind: 'scenario', scenarioId, topicId },
  topic: topicId ? ({ id: topicId, title: '카페', titleJa: null, level: 'N5', chunks: [] } as unknown as LessonMaterials['topic']) : null,
  scenario: { id: scenarioId, title: `상황 ${scenarioId}`, titleJa: null, level: 'N5' } as LessonMaterials['scenario'],
  level: 'N5',
  previousTitles: [],
  previousNextPreview: null,
})
const claim = (f: ReturnType<typeof fakeDb>, m: LessonMaterials) => f.deps().transaction!((tx) => claimLessonTx(tx, U, m, GEN, TODAY, 'tr-fix3'))

test('#59 상황 수업 — 잠금 뒤 상황을 다시 읽는다(잠금 → scenario.findFirst → lesson.create) · 주제 수업은 상황을 읽지 않는다', async () => {
  const { f } = fixture()
  const r = await claim(f, scenarioLesson('scnMine'))
  assert.equal(r.reused, false)
  const lock = f.log.indexOf('lockUser')
  const read = f.log.indexOf('scenario.findFirst')
  assert.ok(lock >= 0 && read > lock && f.log.indexOf('lesson.create') > read, f.log.join(' '))
  assert.ok(!f.log.includes('userSeedOverride.findFirst'), '내 상황은 가림 조회를 하지 않는다')
  const g = fixture().f
  await claim(g, { input: { kind: 'topic', topicId: 'topSeed' }, topic: { id: 'topSeed', title: '카페', titleJa: null, level: 'N5', chunks: [] } as unknown as LessonMaterials['topic'], scenario: null, level: 'N5', previousTitles: [], previousNextPreview: null })
  assert.ok(!g.log.includes('scenario.findFirst'), '주제 수업의 쿼리는 그대로')
})

test('#59 경쟁 — 지우기 먼저: 시작 판정과 같은 409 ARCHIVED(lesson.create 0) · 생성 먼저: 지우기가 그 뒤에 성공하고 수업은 그대로', async () => {
  const a = fixture()
  await archiveScenario(U, 'scnMine', a.f.deps())
  await rejectsWith(claim(a.f, scenarioLesson('scnMine')), 'CONFLICT:ARCHIVED')
  assert.ok(!a.f.log.includes('lesson.create'))
  assert.equal(a.T.aiJob.length, 0)

  const b = fixture()
  const r = await claim(b.f, scenarioLesson('scnMine'))
  assert.equal((await archiveScenario(U, 'scnMine', b.f.deps())).alreadyArchived, false)
  const lesson = b.T.lesson.find((l) => l.id === r.lessonId) as Row
  assert.deepEqual({ scenarioId: lesson.scenarioId, status: lesson.status }, { scenarioId: 'scnMine', status: 'GENERATING' })
})

test('#59 경쟁 — 시드 숨김 먼저면 404(사유 없음, 시작 판정과 같음) · 진행 중 챌린지 예외는 주제에만(상황에는 없음) · 다른 사용자 숨김은 무관', async () => {
  const { f, T } = fixture()
  await hideSeed(U, 'SCENARIO', 'scnSeed', f.deps())
  await rejectsWith(claim(f, scenarioLesson('scnSeed')), 'NOT_FOUND:')
  T.challenge.push({ id: 'chLive', userId: U, status: 'ACTIVE', topicId: 'topSeed', activeKey: U, startDate: new Date('2026-10-05T00:00:00Z'), endDate: new Date('2099-12-31T00:00:00Z') })
  await rejectsWith(claim(f, scenarioLesson('scnSeed', 'topSeed')), 'NOT_FOUND:')
  assert.ok(!f.log.includes('lesson.create'))
  const o = fixture()
  await hideSeed(O, 'SCENARIO', 'scnSeed', o.f.deps())
  assert.equal((await claim(o.f, scenarioLesson('scnSeed'))).reused, false)
})

test('#59 동시 실행(호출마다 양보) — 어느 순서든 지운 뒤에 만든 수업은 없다, 두 순서를 모두 거친다', async () => {
  const wins = { archiveFirst: 0, claimFirst: 0 }
  // lag < 0 = 수업 점유를 -lag 번 늦춤, lag > 0 = 지우기를 lag 번 늦춤(점유는 잠금 전 읽기가 없어 늦추지 않으면 늘 먼저 잠근다).
  const later = async <T>(n: number, fn: () => Promise<T>) => {
    for (let i = 0; i < n; i++) await tick()
    return fn()
  }
  for (let lag = -6; lag <= 6; lag++) {
    const { f, T } = fixture({ tick: true })
    const [c, a] = await Promise.allSettled([
      later(Math.max(0, -lag), () => claim(f, scenarioLesson('scnMine'))),
      later(Math.max(0, lag), () => archiveScenario(U, 'scnMine', f.deps())),
    ])
    assert.equal(a.status, 'fulfilled', `lag ${lag}: 지우기는 늘 성공`)
    const created = f.log.indexOf('lesson.create')
    const archived = f.log.indexOf('scenario.updateMany')
    if (c.status === 'fulfilled') {
      assert.ok(created >= 0 && created < archived, `lag ${lag}: 수업은 지우기보다 먼저 — ${f.log.join(' ')}`)
      wins.claimFirst++
    } else {
      assert.equal(reasonOf(c.reason), 'CONFLICT:ARCHIVED')
      assert.equal(created, -1)
      assert.equal(T.lesson.length, 0)
      wins.archiveFirst++
    }
  }
  assert.ok(wins.archiveFirst > 0 && wins.claimFirst > 0, `두 순서를 모두 거쳐야 한다: ${JSON.stringify(wins)}`)
})
