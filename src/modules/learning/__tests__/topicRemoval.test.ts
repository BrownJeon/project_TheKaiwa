/**
 * task-045 T3-1 — 주제 삭제(#172 사전 조회 · #173 삭제 · #176 포트)와 삭제 경쟁 수정(createChallenge · #59 수업 점유 · Codex C1).
 * 가짜 DB(`challengeFakeDb` — fk·rollback·tick 선택 기능)만 쓴다. #47 주제 단어 세트의 경쟁은 task042.test.ts(그 경로의 가짜가 거기 있다).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, dates } from '@/modules/infra'
import type { TopicRemovalPreview } from '@/types/topic'
import { freezeDailyGoal } from '../challenges/metrics'
import { createChallenge } from '../challenges/service'
import type { CreateChallengeInput } from '../challenges/validate'
import { claimLessonTx, type LessonGeneration, type LessonMaterials } from '../lessons/generate'
import { restoreSeed } from '../seedOverride/ops'
import { loadRestoreRelinkPlan } from '../seedOverride/relink'
import { makeTopicRemovalPort, parseTopicRemovalAck, previewTopicRemoval, removeUserTopic } from '../seedOverride/topicRemoval'
import { isTopicFkViolation, mapTopicGone } from '../topics/visible'
import { fakeDb, type FakeDbOptions } from './challengeFakeDb'

const U = 'userA'
const O = 'userB'
const TODAY = '2026-10-06' // fakeDb 시계 2026-10-06T00:00Z = KST 09:00
const day = (d: string) => dates.toDbDate(d)
const GOAL = freezeDailyGoal({ lesson: true, words: false, wordCount: null })

type Row = Record<string, unknown>
const challenge = (id: string, topicId: string | null, status: 'ACTIVE' | 'ENDED' | 'COMPLETED', start: string, end: string, extra: Row = {}): Row => ({
  id, userId: U, title: `${id} 챌린지`, topicId, topicTitleSnap: '내 주제', level: 'N5', lengthDays: dates.countDays(start, end), startDate: day(start), endDate: day(end),
  dailyGoal: GOAL, status, activeKey: status === 'ACTIVE' ? U : null, result: null, endedAt: status === 'ACTIVE' ? null : new Date('2026-10-01T00:00:00Z'), createdAt: new Date('2026-09-20T00:00:00Z'), ...extra,
})

function fixture(opts: FakeDbOptions = { fk: true, rollback: true }) {
  const f = fakeDb(opts)
  const T = f.tables
  T.conversationTopic.push(
    { id: 'topSeed', userId: null, isSeed: true, title: '카페', level: 'N5' },
    { id: 'topMine', userId: U, isSeed: false, title: '내 주제', level: 'N5' },
    { id: 'topOther', userId: O, isSeed: false, title: '남의 주제', level: 'N5' },
  )
  const chunk = (id: string, topicId: string, order: number, textJa: string) => ({ id, topicId, order, chunkType: 'ACTION', textJa, reading: null, meaningKo: '뜻', note: null })
  T.topicChunk.push(chunk('c1', 'topMine', 0, '注文する'), chunk('c2', 'topMine', 1, '払う'), chunk('c3', 'topSeed', 0, '飲む'))
  T.scenario.push(
    { id: 'scnOnly', userId: U, isSeed: false, status: 'ACTIVE', title: '혼자 붙은 상황' },
    { id: 'scnMulti', userId: U, isSeed: false, status: 'ACTIVE', title: '둘 붙은 상황' },
    { id: 'scnOld', userId: U, isSeed: false, status: 'ARCHIVED', title: '보관된 상황' },
    { id: 'scnSeed', userId: null, isSeed: true, status: 'ACTIVE', title: '시드 상황' },
  )
  T.scenarioTopic.push(
    { scenarioId: 'scnOnly', topicId: 'topMine', weight: 1 },
    { scenarioId: 'scnMulti', topicId: 'topMine', weight: 2 },
    { scenarioId: 'scnMulti', topicId: 'topSeed', weight: 1 },
    { scenarioId: 'scnOld', topicId: 'topMine', weight: 1 },
    { scenarioId: 'scnSeed', topicId: 'topSeed', weight: 1 },
  )
  T.challenge.push(
    challenge('chEnded', 'topMine', 'ENDED', '2026-09-01', '2026-09-07'),
    challenge('chDone', 'topMine', 'COMPLETED', '2026-09-10', '2026-09-16', { activeKey: null }),
    challenge('chLive', 'topMine', 'ACTIVE', '2026-10-04', '2026-10-10'),
  )
  T.lesson.push({ id: 'les1', userId: U, topicId: 'topMine', status: 'DONE' }, { id: 'les2', userId: U, topicId: 'topMine', status: 'READY' })
  T.vocabSession.push({ id: 'vs1', userId: U, topicId: 'topMine', status: 'DONE' })
  const now = () => new Date(f.clock.now.getTime())
  const port = makeTopicRemovalPort({ now })
  return { f, T, now, port }
}

const reasonOf = (e: unknown) => (e instanceof ApiError ? `${e.code}:${String(e.details?.reason ?? '')}` : `raw:${(e as Error)?.message}`)
const rejectsWith = async (p: Promise<unknown>, want: string) => {
  try {
    await p
  } catch (e) {
    assert.equal(reasonOf(e), want)
    return e as ApiError
  }
  assert.fail(`${want} 로 실패해야 한다`)
}
const writes = (log: readonly string[]) => log.filter((l) => /\.(create|createMany|update|updateMany|delete|deleteMany)$/.test(l))

test('#172 사전 조회 — 진행 중 챌린지(며칠째)·끝난 챌린지 수·보관 vs 연결 끊기·보관된 상황 제외·수업·표현 수 · 읽기 전용', async () => {
  const { f } = fixture()
  const p = await previewTopicRemoval(U, 'topMine', { db: f.db, now: () => f.clock.now })
  assert.deepEqual(p, {
    topicId: 'topMine', title: '내 주제', isSeed: false, isSeedCopy: false, ack: 'chLive',
    activeChallenge: { id: 'chLive', title: 'chLive 챌린지', day: 3, lengthDays: 7 },
    finishedChallenges: 2,
    scenariosArchived: [{ id: 'scnOnly', title: '혼자 붙은 상황' }],
    scenariosUnlinked: [{ id: 'scnMulti', title: '둘 붙은 상황' }],
    scenariosRelinked: [],
    doneLessons: 1, chunks: 2,
  } satisfies TopicRemovalPreview)
  assert.deepEqual(writes(f.log), [], '사전 조회는 쓰지 않는다')
  const seed = await previewTopicRemoval(U, 'topSeed', { db: f.db, now: () => f.clock.now })
  assert.deepEqual([seed.isSeed, seed.scenariosArchived, seed.scenariosUnlinked, seed.scenariosRelinked], [true, [], [], []])
  await rejectsWith(previewTopicRemoval(U, 'topOther', { db: f.db }), 'NOT_FOUND:TOPIC_GONE')
  await rejectsWith(previewTopicRemoval(U, 'topNone', { db: f.db }), 'NOT_FOUND:TOPIC_GONE')
  await rejectsWith(previewTopicRemoval(U, '../x', { db: f.db }), 'NOT_FOUND:TOPIC_GONE')
})

test('#173 삭제 — 진행 중 챌린지 행 삭제 · 끝난/완료 유지(topicId null) · 혼자 붙은 상황만 보관 · 연결·표현 삭제 · 수업·세트 topicId null', async () => {
  const { f, T } = fixture()
  const r = await removeUserTopic(U, 'topMine', { ack: 'chLive' }, { ...f.deps() })
  assert.deepEqual(r, { topicId: 'topMine', result: 'REMOVED', challengeDeleted: true, deletedChallengeId: 'chLive', scenariosArchived: 1, scenariosUnlinked: 1, scenariosRelinked: 0, seedId: null })
  assert.deepEqual(T.challenge.map((c) => `${c.id}:${c.status}:${String(c.topicId)}`).sort(), ['chDone:COMPLETED:null', 'chEnded:ENDED:null'])
  assert.deepEqual(T.scenario.map((s) => `${s.id}:${s.status}`).sort(), ['scnMulti:ACTIVE', 'scnOld:ARCHIVED', 'scnOnly:ARCHIVED', 'scnSeed:ACTIVE'])
  assert.deepEqual(T.scenarioTopic.map((l) => `${l.scenarioId}>${l.topicId}`).sort(), ['scnMulti>topSeed', 'scnSeed>topSeed'])
  assert.ok(!T.conversationTopic.some((t) => t.id === 'topMine'))
  assert.deepEqual(T.topicChunk.map((c) => c.id), ['c3'])
  assert.deepEqual([...T.lesson.map((l) => l.topicId), ...T.vocabSession.map((v) => v.topicId)], [null, null, null])
  assert.ok(T.conversationTopic.some((t) => t.id === 'topOther') && T.conversationTopic.some((t) => t.id === 'topSeed'), '남의 주제·시드 불변')
  assert.equal(f.log.indexOf('lockUser') < f.log.indexOf('challenge.deleteMany'), true, '잠금 뒤에 지운다')
})

test('#173 ack — 서버 판단과 다르면 409 IMPACT_CHANGED + 새 사전 조회, 아무것도 안 바뀜 · 없음(null)도 409 · 챌린지 없으면 none 으로 삭제', async () => {
  const { f, T } = fixture()
  const before = structuredClone(T)
  const e = await rejectsWith(removeUserTopic(U, 'topMine', { ack: 'none' }, { ...f.deps() }), 'CONFLICT:IMPACT_CHANGED')
  const preview = e.details?.preview as TopicRemovalPreview
  assert.equal(preview.ack, 'chLive')
  assert.equal(preview.activeChallenge?.id, 'chLive')
  await rejectsWith(removeUserTopic(U, 'topMine', { ack: null }, { ...f.deps() }), 'CONFLICT:IMPACT_CHANGED')
  assert.deepEqual(T, before, '409 는 쓰기 0(롤백)')
  // 챌린지를 끝낸 뒤에는 옛 ack(chLive)가 409 이고 none 이 맞다.
  Object.assign(T.challenge.find((c) => c.id === 'chLive') as Row, { status: 'ENDED', activeKey: null })
  const e2 = await rejectsWith(removeUserTopic(U, 'topMine', { ack: 'chLive' }, { ...f.deps() }), 'CONFLICT:IMPACT_CHANGED')
  assert.equal((e2.details?.preview as TopicRemovalPreview).ack, 'none')
  const r = await removeUserTopic(U, 'topMine', { ack: 'none' }, { ...f.deps() })
  assert.equal(r.challengeDeleted, false)
  assert.equal(T.challenge.length, 3, '끝난 챌린지 3개 모두 유지')
  assert.equal(parseTopicRemovalAck(null), null)
  assert.equal(parseTopicRemovalAck('none'), 'none')
  assert.throws(() => parseTopicRemovalAck('x y'), (err: unknown) => reasonOf(err) === 'VALIDATION:invalid')
})

test('#173 시드 id = 그 사용자 목록에서만 숨김(override copyId null) · 시드 주제·진행 중 챌린지·상황 불변 · 남의 주제 404', async () => {
  const { f, T } = fixture()
  T.challenge.splice(0, T.challenge.length, challenge('chSeed', 'topSeed', 'ACTIVE', '2026-10-05', '2026-10-11'))
  const before = structuredClone({ c: T.conversationTopic, s: T.scenario, l: T.scenarioTopic, ch: T.challenge })
  const r = await removeUserTopic(U, 'topSeed', { ack: null }, { ...f.deps() })
  assert.equal(r.result, 'HIDDEN')
  assert.deepEqual(T.userSeedOverride.map((o) => `${o.userId}|${o.kind}|${o.seedId}|${String(o.copyId)}`), [`${U}|TOPIC|topSeed|null`])
  assert.deepEqual({ c: T.conversationTopic, s: T.scenario, l: T.scenarioTopic, ch: T.challenge }, before)
  const again = await removeUserTopic(U, 'topSeed', { ack: null }, { ...f.deps() })
  assert.equal(again.result, 'HIDDEN')
  assert.equal(T.userSeedOverride.length, 1, '멱등')
  const n = T.conversationTopic.length
  await rejectsWith(removeUserTopic(U, 'topOther', { ack: 'none' }, { ...f.deps() }), 'NOT_FOUND:TOPIC_GONE')
  await rejectsWith(removeUserTopic(U, 'nope', { ack: 'none' }, { ...f.deps() }), 'NOT_FOUND:TOPIC_GONE')
  assert.equal(T.conversationTopic.length, n)
})

test('기간 지난 진행 중 챌린지 — 지우기 전에 완료로 전이(삭제 안 함) · 사전 조회는 끝난 챌린지로 센다(ack none)', async () => {
  const { f, T } = fixture()
  Object.assign(T.challenge.find((c) => c.id === 'chLive') as Row, { startDate: day('2026-09-28'), endDate: day('2026-10-04') })
  const p = await previewTopicRemoval(U, 'topMine', { db: f.db, now: () => f.clock.now })
  assert.deepEqual([p.ack, p.activeChallenge, p.finishedChallenges], ['none', null, 3])
  const r = await removeUserTopic(U, 'topMine', { ack: 'none' }, { ...f.deps() })
  assert.equal(r.challengeDeleted, false)
  const live = T.challenge.find((c) => c.id === 'chLive') as Row
  assert.deepEqual([live.status, live.topicId, live.activeKey], ['COMPLETED', null, null])
  assert.ok(live.result, '완료 결과를 얼린 뒤 주제가 지워진다')
})

function copyFixture() {
  const x = fixture()
  x.T.conversationTopic.push({ id: 'topCopy', userId: U, isSeed: false, title: '카페(내 버전)', level: 'N5' })
  x.T.userSeedOverride.push({ id: 'ov1', userId: U, kind: 'TOPIC', seedId: 'topSeed', copyId: 'topCopy' })
  x.T.scenario.push({ id: 'scnCopy', userId: U, isSeed: false, status: 'ACTIVE', title: '사본에 붙은 상황' }, { id: 'scnCopy2', userId: U, isSeed: false, status: 'ACTIVE', title: '사본+시드' })
  x.T.scenarioTopic.push({ scenarioId: 'scnCopy', topicId: 'topCopy', weight: 3 }, { scenarioId: 'scnCopy2', topicId: 'topCopy', weight: 1 }, { scenarioId: 'scnCopy2', topicId: 'topSeed', weight: 2 })
  return x
}

test('내 버전(사본) 삭제 — 사전 조회의 되돌려 붙는 상황 = planRestoreRelink 계산 · 삭제는 내 상황을 시드 주제로 되돌려 붙이고 override 를 숨김으로(고아 없음)', async () => {
  const { f, T } = copyFixture()
  const p = await previewTopicRemoval(U, 'topCopy', { db: f.db, now: () => f.clock.now })
  const plan = await loadRestoreRelinkPlan(f.db, U, 'topCopy', 'topSeed')
  assert.deepEqual(p.scenariosRelinked.map((s) => s.id), plan?.relinkedScenarioIds)
  assert.deepEqual([p.isSeedCopy, p.scenariosArchived, p.scenariosUnlinked, p.ack], [true, [], [], 'none'])
  const r = await removeUserTopic(U, 'topCopy', { ack: 'none' }, { ...f.deps() })
  assert.deepEqual([r.seedId, r.scenariosRelinked, r.scenariosArchived], ['topSeed', 2, 0])
  const links = (sid: string) => T.scenarioTopic.filter((l) => l.scenarioId === sid).map((l) => `${l.topicId}:${l.weight}`)
  assert.deepEqual([links('scnCopy'), links('scnCopy2')], [['topSeed:3'], ['topSeed:2']])
  assert.ok(T.scenario.filter((s) => String(s.id).startsWith('scnCopy')).every((s) => s.status === 'ACTIVE'))
  assert.deepEqual(T.userSeedOverride.map((o) => o.copyId), [null], '시드는 그 사용자 목록에서 숨김으로 남고 고아가 없다')
})

test('포트 연결 — restoreSeed(#176) 가 removeUserTopicTx 로 실제 삭제 · override 삭제 · ack 다르면 아무것도 안 바뀜', async () => {
  const { f, T, port } = copyFixture()
  T.challenge.push(challenge('chCopy', 'topCopy', 'ACTIVE', '2026-10-06', '2026-10-08', { activeKey: `${U}-2` }))
  const before = structuredClone(T)
  await rejectsWith(restoreSeed(U, 'TOPIC', 'topSeed', { ack: 'none' }, { ...f.deps(), removeTopic: port }), 'CONFLICT:IMPACT_CHANGED')
  assert.deepEqual(T, before, '재연결·override 도 함께 되돌린다(한 트랜잭션)')
  const r = await restoreSeed(U, 'TOPIC', 'topSeed', { ack: 'chCopy' }, { ...f.deps(), removeTopic: port })
  assert.equal(r.path, 'COPY')
  assert.deepEqual([r.removal?.result, r.removal?.deletedChallengeId], ['REMOVED', 'chCopy'])
  assert.ok(!T.conversationTopic.some((t) => t.id === 'topCopy'))
  assert.deepEqual(T.userSeedOverride, [], '되돌리기 = override 삭제(시드가 다시 보인다)')
  assert.deepEqual(T.scenarioTopic.filter((l) => l.scenarioId === 'scnCopy').map((l) => l.topicId), ['topSeed'])
})

test('한 트랜잭션 — 마지막 단계(주제 삭제)에서 실패하면 챌린지·상황·연결·표현·override 전부 그대로', async () => {
  for (const at of ['conversationTopic.deleteMany', 'topicChunk.deleteMany', 'scenario.updateMany']) {
    const { f, T } = copyFixture()
    const before = structuredClone(T)
    f.fault.at = at
    await assert.rejects(removeUserTopic(U, 'topMine', { ack: 'chLive' }, { ...f.deps() }), /injected fault/)
    assert.deepEqual(T, before, `${at} 실패 → 아무것도 지워지지 않음`)
  }
})

// ── 경쟁(Codex C1) ─────────────────────────────────────────────────────────────

const chInput = (topicId: string): CreateChallengeInput => ({ topicId, lengthDays: 7, start: 'TODAY', lesson: true, words: false }) as CreateChallengeInput

test('경쟁 ⓒ 삭제 먼저 × createChallenge — 잠금 전에 읽은 주제가 잠금 뒤 사라짐 → 404 TOPIC_GONE · challenge.create 시도 0', async () => {
  const { f, T } = fixture()
  T.challenge.splice(0)
  let ran = false
  const base = f.deps().lockUser!
  await rejectsWith(
    createChallenge(U, chInput('topMine'), f.deps({
      lockUser: async (tx, userId) => {
        if (!ran) {
          ran = true
          await removeUserTopic(U, 'topMine', { ack: 'none' }, { ...f.deps() })
        }
        return base(tx, userId)
      },
    })),
    'NOT_FOUND:TOPIC_GONE',
  )
  assert.ok(ran)
  assert.ok(!f.log.includes('challenge.create'), '잠금 안 재확인에서 멈춘다(FK 위반까지 가지 않음)')
  assert.equal(T.challenge.length, 0)
})

test('경쟁 ⓒ 생성 먼저 × 삭제 — 확인 창(ack none) 뒤 생긴 챌린지는 409 IMPACT_CHANGED 로 알리고, 새 ack 로 지우면 그 챌린지도 지운다', async () => {
  const { f, T } = fixture()
  T.challenge.splice(0)
  const p = await previewTopicRemoval(U, 'topMine', { db: f.db, now: () => f.clock.now })
  assert.equal(p.ack, 'none')
  const made = await createChallenge(U, chInput('topMine'), f.deps())
  const e = await rejectsWith(removeUserTopic(U, 'topMine', { ack: p.ack }, { ...f.deps() }), 'CONFLICT:IMPACT_CHANGED')
  const fresh = e.details?.preview as TopicRemovalPreview
  assert.equal(fresh.activeChallenge?.id, made.id)
  const r = await removeUserTopic(U, 'topMine', { ack: fresh.ack }, { ...f.deps() })
  assert.equal(r.deletedChallengeId, made.id)
  assert.equal(T.challenge.length, 0)
})

test('경쟁 ⓒ 동시 실행(호출마다 양보) — 둘 다 성공하는 일 없음 · 주제 없는 진행 중 챌린지가 남지 않음', async () => {
  const wins = { remove: 0, create: 0 }
  const after = async <T>(lag: number, fn: () => Promise<T>) => {
    for (let i = 0; i < lag; i++) await new Promise<void>((r) => setImmediate(r))
    return fn()
  }
  for (let run = 0; run < 16; run++) {
    const { f, T } = fixture({ fk: true, tick: true })
    T.challenge.splice(0)
    const lag = run % 8
    const remove = () => removeUserTopic(U, 'topMine', { ack: 'none' }, { ...f.deps() })
    const make = () => createChallenge(U, chInput('topMine'), f.deps())
    const [rm, ch] = await Promise.allSettled(run < 8 ? [after(lag, remove), make()] : [remove(), after(lag, make)])
    assert.ok(!(rm.status === 'fulfilled' && ch.status === 'fulfilled'), `lag ${lag}: 둘 다 성공하면 안 된다`)
    if (rm.status === 'fulfilled') assert.equal(reasonOf((ch as PromiseRejectedResult).reason), 'NOT_FOUND:TOPIC_GONE')
    else assert.equal(reasonOf(rm.reason), 'CONFLICT:IMPACT_CHANGED')
    assert.ok(!T.challenge.some((c) => c.status === 'ACTIVE' && c.topicId === null), `lag ${lag}: 주제 없는 진행 중 챌린지`)
    wins[rm.status === 'fulfilled' ? 'remove' : 'create']++
  }
  assert.ok(wins.remove > 0 && wins.create > 0, `두 순서를 모두 거쳐야 한다: ${JSON.stringify(wins)}`)
})

test('경쟁 ⓒ 잠금 밖 삭제(시드 로더 등) → FK 위반 P2003 은 500 이 아니라 404 TOPIC_GONE', async () => {
  const { f, T } = fixture()
  T.challenge.splice(0)
  f.beforeCreate.fn = async (name) => {
    if (name === 'challenge') T.conversationTopic = T.conversationTopic.filter((t) => t.id !== 'topMine')
  }
  await rejectsWith(createChallenge(U, chInput('topMine'), f.deps()), 'NOT_FOUND:TOPIC_GONE')
})

const GEN: LessonGeneration = { request: {} as LessonGeneration['request'], promptVersion: 'lesson@t3', inputMeta: { source: 'topic' } }
const lessonOf = (topicId: string): LessonMaterials => ({
  input: { kind: 'topic', topicId }, topic: { id: topicId, title: '주제', titleJa: null, level: 'N5', chunks: [] } as unknown as LessonMaterials['topic'], scenario: null, level: 'N5', previousTitles: [], previousNextPreview: null,
})
const claim = (f: ReturnType<typeof fakeDb>, m: LessonMaterials) => f.deps().transaction!((tx) => claimLessonTx(tx, U, m, GEN, TODAY, 'tr-t3'))

test('경쟁 ⓐ #59 수업 점유 — 삭제 먼저: 잠금 뒤 재확인 404 TOPIC_GONE(lesson.create 0) · 생성 먼저: 삭제 뒤 수업은 남고 topicId null · 잠금 밖 삭제 P2003 → 404', async () => {
  const a = fixture()
  const m = lessonOf('topMine')
  await removeUserTopic(U, 'topMine', { ack: 'chLive' }, { ...a.f.deps() })
  await rejectsWith(claim(a.f, m), 'NOT_FOUND:TOPIC_GONE')
  assert.ok(!a.f.log.includes('lesson.create'))

  const b = fixture()
  const r = await claim(b.f, m)
  assert.equal(r.reused, false)
  await removeUserTopic(U, 'topMine', { ack: 'chLive' }, { ...b.f.deps() })
  assert.equal((b.T.lesson.find((l) => l.id === r.lessonId) as Row).topicId, null)

  const c = fixture()
  c.f.beforeCreate.fn = async (name) => {
    if (name === 'lesson') c.T.conversationTopic = c.T.conversationTopic.filter((t) => t.id !== 'topMine')
  }
  await rejectsWith(claim(c.f, m), 'NOT_FOUND:TOPIC_GONE')
})

test('경쟁 ⓐ #59 가린 시드 — 숨김이면 404, 진행 중 챌린지 주제면 허용(§0 #9) · 챌린지는 가린 시드로 새로 만들 수 없음', async () => {
  const { f, T } = fixture()
  T.challenge.splice(0)
  T.userSeedOverride.push({ id: 'ovH', userId: U, kind: 'TOPIC', seedId: 'topSeed', copyId: null })
  await rejectsWith(claim(f, lessonOf('topSeed')), 'NOT_FOUND:TOPIC_GONE')
  await rejectsWith(createChallenge(U, chInput('topSeed'), f.deps()), 'NOT_FOUND:TOPIC_GONE')
  T.challenge.push(challenge('chSeed', 'topSeed', 'ACTIVE', '2026-10-05', '2026-10-11'))
  const r = await claim(f, lessonOf('topSeed'))
  assert.equal(r.reused, false)
  assert.equal((T.lesson.find((l) => l.id === r.lessonId) as Row).topicId, 'topSeed')
  // 다른 사용자의 숨김은 영향이 없다(챌린지 없이도 U 는 그 시드로 수업을 만든다 — 오늘 만든 수업 재사용).
  T.challenge.splice(0)
  T.lesson.splice(0)
  T.aiJob.splice(0)
  T.userSeedOverride = [{ id: 'ovO', userId: O, kind: 'TOPIC', seedId: 'topSeed', copyId: null }]
  const r2 = await claim(f, lessonOf('topSeed'))
  assert.equal((T.lesson.find((l) => l.id === r2.lessonId) as Row).topicId, 'topSeed')
})

test('FK 위반 판정 — topicId FK 만 TOPIC_GONE, 다른 FK·다른 오류는 그대로', () => {
  const fk = (field: string) => Object.assign(new Error('fk'), { code: 'P2003', meta: { field_name: field } })
  assert.equal(isTopicFkViolation(fk('Challenge_topicId_fkey (index)')), true)
  assert.equal(isTopicFkViolation(Object.assign(new Error('fk'), { code: 'P2003', meta: { constraint: 'Lesson_topicId_fkey' } })), true)
  assert.equal(isTopicFkViolation(fk('Lesson_userId_fkey (index)')), false)
  assert.equal(isTopicFkViolation(Object.assign(new Error('u'), { code: 'P2002', meta: { target: 'topicId' } })), false)
  assert.equal(reasonOf(mapTopicGone(fk('VocabSession_topicId_fkey (index)'))), 'NOT_FOUND:TOPIC_GONE')
  const other = fk('Lesson_userId_fkey (index)')
  assert.equal(mapTopicGone(other), other)
})
