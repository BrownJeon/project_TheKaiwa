/**
 * task-041 — 챌린지 서버 코어(#155~#159·#58·#62·#70·#71 조합 함수)를 메모리 DB 로 확인한다(오프라인 — 공유 DB 를 읽지 않는다).
 * 동시성(동시 두 #156 → 하나만)·`activeKey` 해제·지연 전이 결정성·소유자 404·`challengeProgressAfter` null 목록·오늘 할 일 상태·
 * "챌린지 경로는 `Challenge` 밖 표에 쓰지 않고 AiJob·RequestTrace 행을 만들지 않는다"(5초 지표 ⓐ 의 결정적 부분).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ApiError } from '@/modules/infra'
import {
  challengeDayStates, challengeProgressAfter, createChallenge, endChallenge, getActiveChallengeTopic, getChallengeDetail, getChallengeToday, listChallenges,
  parseChallengeListQuery, parseCreateChallengeBody, parseEndChallengeBody, type ChallengeDeps,
} from '../challenges'
import { defaultWordCount } from '../challenges/service'
import { withChallengeCalendar, type CalendarDto } from '../studyLog/calendar'
import { fakeDb, foreignWrites, kst, type FakeDb } from './challengeFakeDb'

const U = 'cuser0000000000000000000u1'
const U2 = 'cuser0000000000000000000u2'
const T = 'ctopiccafe000000000000001'
const T_OTHER = 'ctopicroad000000000000002'
const T_U2 = 'ctopicu2mine0000000000003'

function world(at = '2026-10-06 09:00'): FakeDb {
  const f = fakeDb()
  f.clock.now = kst(at)
  f.tables.conversationTopic.push(
    { id: T, userId: null, title: '카페 주문', level: 'N5' },
    { id: T_OTHER, userId: null, title: '길 묻기', level: 'N5' },
    { id: T_U2, userId: U2, title: '남의 주제', level: 'N5' },
  )
  for (let i = 1; i <= 12; i++) {
    f.tables.topicChunk.push({ id: `cchunk${String(i).padStart(4, '0')}`, topicId: T, chunkType: 'NAME', textJa: `表現${i}`, reading: 'ひょうげん', meaningKo: `뜻${i}`, order: i })
  }
  return f
}

const body = (over: Record<string, unknown> = {}, goal: Record<string, unknown> = {}) =>
  parseCreateChallengeBody({ topicId: T, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 10, ...goal }, ...over })

let seq = 0
/** `at` = KST 시각 문자열 또는 정확한 `Date`(ms 단위 경합 재현용). 실제 행의 createdAt 은 Prisma 엔진이 INSERT 에 싣는 앱 시각이다(T-5). */
function snap(f: FakeDb, kind: 'LESSON' | 'VOCAB_SESSION', data: Record<string, unknown>, at: string | Date, userId = U): string {
  const periodKey = `${kind === 'LESSON' ? 'clesson' : 'csession'}${String(++seq).padStart(6, '0')}`
  f.tables.statsSnapshot.push({ id: `csnap${String(seq).padStart(6, '0')}`, userId, kind, periodKey, data, createdAt: typeof at === 'string' ? kst(at) : new Date(at.getTime()) })
  return periodKey
}
const lessonSnap = (f: FakeDb, date: string, at: string | Date, over: Record<string, unknown> = {}) =>
  snap(f, 'LESSON', { kind: 'NEW', topicId: T, score: 80, stageDone: 5, itemCount: 4, quizCorrect: 4, quizTotal: 5, date, ...over }, at)
const setSnap = (f: FakeDb, date: string, at: string | Date, c: number, w: number, s: number, over: Record<string, unknown> = {}) =>
  snap(f, 'VOCAB_SESSION', { cardCount: c + w + s, correct: c, wrong: w, skipped: s, durationSec: 60, mode: 'CHOICE', date, topicId: T, ...over }, at)

async function rejects(p: Promise<unknown>, code: string, reason?: string): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof ApiError, `ApiError 기대, 실제 ${String(e)}`)
    assert.equal(e.code, code)
    if (reason) assert.equal(e.details?.reason, reason)
    return e
  }
  assert.fail(`${code} 를 기대했는데 성공했다`)
}

function assertNoSideEffects(f: FakeDb): void {
  assert.deepEqual(foreignWrites(f.log), [], 'Challenge 밖 표 쓰기 0')
  assert.equal(f.tables.aiJob.length, 0, 'AiJob 행 0')
  assert.equal(f.tables.requestTrace.length, 0, 'RequestTrace 행 0')
  assert.ok(!f.log.some((l) => l.startsWith('requestTrace.') || l === 'aiJob.create'))
}

test('#156 만들기 — 자동 제목·서버 KST 날짜·dailyGoal 얼림(인정 8장)·상세 즉시 반환, 쓰기는 Challenge 1행뿐', async () => {
  const f = world()
  const d = await createChallenge(U, body(), f.deps())
  assert.equal(d.title, '카페 주문 7일 챌린지')
  assert.deepEqual([d.startDate, d.endDate, d.status, d.level, d.lengthDays], ['2026-10-06', '2026-10-12', 'ACTIVE', 'N5', 7])
  assert.deepEqual(d.dailyGoal, { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 })
  assert.deepEqual(d.topic, { id: T, title: '카페 주문', exists: true })
  assert.deepEqual([d.stats.dayIndex, d.stats.rate, d.stats.streak], [1, null, 0])
  assert.deepEqual(d.days.map((x) => x.state), ['TODAY', 'UPCOMING', 'UPCOMING', 'UPCOMING', 'UPCOMING', 'UPCOMING', 'UPCOMING'])
  assert.equal(d.topicProgress?.chunkTotal, 12)
  assert.deepEqual(d.today?.tasks.map((t) => [t.kind, t.state]), [['WORDS', 'TODO'], ['LESSON', 'TODO']])
  assert.equal(f.tables.challenge.length, 1)
  assert.equal(f.tables.challenge[0].activeKey, U)
  assertNoSideEffects(f)
  const tomorrow = await createChallenge(U2, parseCreateChallengeBody({ topicId: T, lengthDays: 14, start: 'TOMORROW', dailyGoal: { lesson: true, words: false }, title: ' 나의 도전 ' }), f.deps())
  assert.deepEqual([tomorrow.startDate, tomorrow.endDate, tomorrow.title, tomorrow.dailyGoal.wordCount, tomorrow.stats.dayIndex, tomorrow.today], ['2026-10-07', '2026-10-20', '나의 도전', null, 0, null])
})

test('#156 입력 검증 — 모르는 키·둘 다 끔·범위·장수 초과(WORD_COUNT_OVER_POOL poolSize)·주제 없음/남의 주제 404', async () => {
  assert.throws(() => body({ extra: 1 }), (e: unknown) => e instanceof ApiError && e.details?.reason === 'unknown_key')
  assert.throws(() => body({}, { hard: true }), (e: unknown) => e instanceof ApiError && e.details?.field === 'dailyGoal.hard')
  assert.throws(() => body({}, { lesson: false, words: false }), (e: unknown) => e instanceof ApiError && e.details?.reason === 'NO_TASK')
  assert.throws(() => body({ lengthDays: 10 }), (e: unknown) => e instanceof ApiError && e.details?.field === 'lengthDays')
  assert.throws(() => body({ start: '2026-10-07' }), (e: unknown) => e instanceof ApiError && e.details?.field === 'start')
  assert.throws(() => body({}, { wordCount: 8 }), (e: unknown) => e instanceof ApiError && e.details?.field === 'dailyGoal.wordCount')
  assert.throws(() => body({ title: 'x'.repeat(41) }), (e: unknown) => e instanceof ApiError && e.details?.field === 'title')
  const f = world()
  const over = await rejects(createChallenge(U, body({}, { wordCount: 15 }), f.deps()), 'VALIDATION', 'WORD_COUNT_OVER_POOL')
  assert.equal(over.details?.poolSize, 12)
  await rejects(createChallenge(U, body({ topicId: T_U2 }), f.deps()), 'NOT_FOUND')
  await rejects(createChallenge(U, body({ topicId: 'cnope00000000000000000000' }), f.deps()), 'NOT_FOUND')
  await rejects(createChallenge(U, body({ topicId: T_OTHER }), f.deps()), 'VALIDATION', 'WORD_COUNT_OVER_POOL') // 조각 0개 주제
  assert.equal(f.tables.challenge.length, 0)
  assert.deepEqual([defaultWordCount(10, 12), defaultWordCount(20, 12), defaultWordCount(7, 12), defaultWordCount(30, 30), defaultWordCount(10, 4)], [10, 10, 5, 15, null])
  const d = await createChallenge(U, body({}, { wordCount: undefined }), f.deps({ dailyWordCount: async () => 25 }))
  assert.equal(d.dailyGoal.wordCount, 10) // 기본 표현 12개라 15 는 못 고름
})

test('#156 진행 중 1개 — 순차 두 번째는 409 ACTIVE_EXISTS{challengeId} · 동시 두 요청(잠금 직렬화)도 하나만', async () => {
  const f = world()
  const first = await createChallenge(U, body(), f.deps())
  const e = await rejects(createChallenge(U, body({ topicId: T }), f.deps()), 'CONFLICT', 'ACTIVE_EXISTS')
  assert.equal(e.details?.challengeId, first.id)

  const g = world()
  const results = await Promise.allSettled([createChallenge(U, body(), g.deps()), createChallenge(U, body(), g.deps())])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  const rej = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
  assert.ok(rej.reason instanceof ApiError && rej.reason.code === 'CONFLICT' && rej.reason.details?.reason === 'ACTIVE_EXISTS')
  assert.equal(g.tables.challenge.length, 1)
  assert.equal(g.log.filter((l) => l === 'challenge.create').length, 1, '잠금이 직렬화해 두 번째는 INSERT 전에 409')
})

test('#156 잠금을 지나 두 요청이 겹쳐도 activeKey 유니크(P2002)가 하나만 남기고 같은 409 로 바꾼다', async () => {
  const f = world()
  let arrived = 0
  let open!: () => void
  const gate = new Promise<void>((r) => (open = r))
  f.beforeActiveCheck.fn = async () => {
    arrived++
    if (arrived >= 2) open()
    await gate
  }
  const noLock: Partial<ChallengeDeps> = { lockUser: async () => true }
  const results = await Promise.allSettled([createChallenge(U, body(), f.deps(noLock)), createChallenge(U, body(), f.deps(noLock))])
  f.beforeActiveCheck.fn = null
  assert.ok(arrived >= 2, '두 요청이 모두 진행 중 확인을 통과했다')
  assert.equal(f.log.filter((l) => l === 'challenge.create').length, 2, '두 번째 INSERT 가 유니크에 걸렸다')
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  const rej = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
  assert.ok(rej.reason instanceof ApiError && rej.reason.details?.reason === 'ACTIVE_EXISTS', String(rej.reason))
  assert.equal(rej.reason.details?.challengeId, f.tables.challenge[0].id)
  assert.equal(f.tables.challenge.length, 1)
})

test('#159 그만두기 — ENDED·activeKey 비움·result(USER) 얼림 · 다시 부르면 같은 응답(멱등) · 끝낸 뒤 새로 만들기 성공', async () => {
  const f = world()
  const c = await createChallenge(U, body(), f.deps())
  setSnap(f, '2026-10-06', '2026-10-06 10:00', 8, 2, 0)
  f.clock.now = kst('2026-10-06 15:00')
  const ended = await endChallenge(U, c.id, f.deps())
  assert.equal(ended.status, 'ENDED')
  assert.equal(ended.endedAt, kst('2026-10-06 15:00').toISOString())
  const row = f.tables.challenge[0]
  assert.equal(row.activeKey, null)
  assert.equal((row.result as { endReason: string }).endReason, 'USER')
  assert.deepEqual((row.result as { days: { state: string }[] }).days.map((d) => d.state), Array(7).fill('STOPPED'))
  f.clock.now = kst('2026-10-08 09:00')
  assert.deepEqual(await endChallenge(U, c.id, f.deps()), ended)
  const again = await createChallenge(U, body(), f.deps())
  assert.equal(again.status, 'ACTIVE')
  assert.equal(f.tables.challenge.filter((x) => x.status === 'ACTIVE').length, 1)
  assertNoSideEffects(f)
})

test('지연 전이 — 기간이 지나면 읽을 때 COMPLETED(endedAt = 마지막 날 다음 00:00 KST)·activeKey 비움, 언제 전이해도 result 같음 · 그 뒤 #159 는 409 NOT_ACTIVE', async () => {
  const build = async (settleAt: string) => {
    const f = world()
    const c = await createChallenge(U, body(), f.deps())
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-09']) {
      setSnap(f, d, `${d} 10:00`, 8, 2, 0)
      lessonSnap(f, d, `${d} 11:00`)
    }
    setSnap(f, '2026-10-12', '2026-10-13 00:10', 9, 1, 0) // 마지막 날 시작·자정 뒤 끝냄 → 마감 뒤
    f.clock.now = kst(settleAt)
    const today = await getChallengeToday(U, f.deps())
    return { f, c, today }
  }
  const early = await build('2026-10-13 09:00')
  const late = await build('2026-10-20 23:00')
  assert.equal(early.today.challenge, null)
  assert.equal(early.today.recentlyEnded?.status, 'COMPLETED')
  assert.deepEqual(early.today.recentlyEnded?.result, { lengthDays: 7, metDays: 3, elapsedDays: 7, rate: 0.43, longestStreak: 2, endReason: null })
  assert.equal(late.today.recentlyEnded, null) // 어제 00:00 이후에 끝난 것만
  const [a, b] = [early.f.tables.challenge[0], late.f.tables.challenge[0]]
  assert.deepEqual([a.status, a.activeKey, (a.endedAt as Date).toISOString()], ['COMPLETED', null, kst('2026-10-13 00:00').toISOString()])
  assert.deepEqual(a.result, b.result)
  assert.deepEqual((a.result as { days: { state: string }[] }).days.map((d) => d.state), ['MET', 'MET', 'MISSED', 'MET', 'MISSED', 'MISSED', 'MISSED'])
  await rejects(endChallenge(U, early.c.id, early.f.deps()), 'CONFLICT', 'NOT_ACTIVE')
  const detail = await getChallengeDetail(U, early.c.id, early.f.deps())
  assert.deepEqual([detail.stats.streak, detail.stats.dayIndex, detail.today, detail.totals.wordSets], [null, 7, null, 3])
  assert.equal(detail.days[0].lesson?.lessonId != null, true) // 끝난 챌린지도 원본 링크는 다시 계산해 붙인다
  assertNoSideEffects(early.f)
})

test('지연 전이 — 주제가 끊긴 진행 중(topicId=null)은 ENDED·endReason TOPIC_REMOVED', async () => {
  const f = world()
  await createChallenge(U, body(), f.deps())
  f.tables.challenge[0].topicId = null
  f.clock.now = kst('2026-10-07 09:00')
  const t = await getChallengeToday(U, f.deps())
  assert.equal(t.challenge, null)
  assert.deepEqual([f.tables.challenge[0].status, f.tables.challenge[0].activeKey, (f.tables.challenge[0].result as { endReason: string }).endReason], ['ENDED', null, 'TOPIC_REMOVED'])
  assert.equal(t.recentlyEnded?.result.endReason, 'TOPIC_REMOVED')
})

test('소유자 — 남의 챌린지·없는 id·형식이 틀린 id 는 상세·그만두기 모두 404', async () => {
  const f = world()
  const mine = await createChallenge(U, body(), f.deps())
  await rejects(getChallengeDetail(U2, mine.id, f.deps()), 'NOT_FOUND')
  await rejects(endChallenge(U2, mine.id, f.deps()), 'NOT_FOUND')
  await rejects(getChallengeDetail(U, 'cnotexist0000000000000000', f.deps()), 'NOT_FOUND')
  await rejects(getChallengeDetail(U, '../x', f.deps()), 'NOT_FOUND')
  assert.equal(f.tables.challenge[0].status, 'ACTIVE')
  assert.deepEqual((await listChallenges(U2, parseChallengeListQuery(new URLSearchParams()), f.deps())).items, [])
  assert.equal((await getChallengeToday(U2, f.deps())).challenge, null)
  assert.equal(await challengeProgressAfter(U2, { kind: 'LESSON', refId: lessonSnap(f, '2026-10-06', '2026-10-06 10:00') }, f.deps()), null)
})

test('#156 사용자당 하루 20회 — 21번째는 429(다음 KST 자정까지)', async () => {
  const f = world('2026-10-06 22:00')
  for (let i = 0; i < 20; i++) {
    const c = await createChallenge(U, body(), f.deps())
    await endChallenge(U, c.id, f.deps())
  }
  const e = await rejects(createChallenge(U, body(), f.deps()), 'RATE_LIMITED')
  assert.equal(e.details?.retryAfterSec, 2 * 3600)
  f.clock.now = kst('2026-10-07 00:01')
  assert.equal((await createChallenge(U, body(), f.deps())).status, 'ACTIVE')
})

test('삭제 후 지표 불변 — 수업·세트 행을 지워도 날짜 상태·누적은 그대로(스냅샷만 읽음), 원본 링크만 refExists=false', async () => {
  const f = world()
  const c = await createChallenge(U, body(), f.deps())
  const lid = lessonSnap(f, '2026-10-06', '2026-10-06 10:00')
  const sid = setSnap(f, '2026-10-06', '2026-10-06 10:30', 8, 2, 0)
  f.tables.lesson.push({ id: lid, userId: U, topicId: T, kind: 'NEW', status: 'DONE', date: new Date('2026-10-06T00:00:00Z'), createdAt: kst('2026-10-06 09:30'), updatedAt: kst('2026-10-06 10:00') })
  f.tables.vocabSession.push({ id: sid, userId: U, topicId: T, status: 'DONE', date: new Date('2026-10-06T00:00:00Z'), startedAt: kst('2026-10-06 10:20') })
  f.clock.now = kst('2026-10-06 11:00')
  const before = await getChallengeDetail(U, c.id, f.deps())
  assert.deepEqual([before.days[0].state, before.days[0].lesson?.refExists, before.days[0].words?.refExists], ['MET', true, true])
  f.tables.lesson.length = 0
  f.tables.vocabSession.length = 0
  const after = await getChallengeDetail(U, c.id, f.deps())
  assert.deepEqual(after.days.map((d) => d.state), before.days.map((d) => d.state))
  assert.deepEqual([after.stats, after.totals], [before.stats, before.totals])
  assert.deepEqual([after.days[0].lesson?.refExists, after.days[0].words?.refExists], [false, false])
})

test('challengeProgressAfter — 값: 수업 {words:null} · 세트 {words:{answered, need}} · goalMetNow 는 그날을 달성으로 바꾼 것만(확인 표 9)', async () => {
  const f = world()
  const c = await createChallenge(U, body(), f.deps())
  const l = lessonSnap(f, '2026-10-06', '2026-10-06 09:30')
  f.clock.now = kst('2026-10-06 09:31')
  assert.deepEqual(await challengeProgressAfter(U, { kind: 'LESSON', refId: l }, f.deps()), { challengeId: c.id, date: '2026-10-06', dayIndex: 1, goalMet: false, goalMetNow: false, words: null })
  const a = setSnap(f, '2026-10-06', '2026-10-06 10:00', 3, 1, 6)
  f.clock.now = kst('2026-10-06 10:01')
  assert.deepEqual(await challengeProgressAfter(U, { kind: 'VOCAB_SESSION', refId: a }, f.deps()), { challengeId: c.id, date: '2026-10-06', dayIndex: 1, goalMet: false, goalMetNow: false, words: { answered: 4, need: 8 } })
  const b = setSnap(f, '2026-10-06', '2026-10-06 10:30', 3, 1, 4)
  f.clock.now = kst('2026-10-06 10:31')
  const pb = await challengeProgressAfter(U, { kind: 'VOCAB_SESSION', refId: b }, f.deps())
  assert.deepEqual([pb?.goalMet, pb?.goalMetNow, pb?.words], [true, true, { answered: 8, need: 8 }])
  const pa = await challengeProgressAfter(U, { kind: 'VOCAB_SESSION', refId: a }, f.deps())
  assert.deepEqual([pa?.goalMet, pa?.goalMetNow], [true, false]) // 거의 동시에 끝내도 토스트는 한 번
  // 같은 ms 이거나 앱 시계가 조금 되돌려져도(createdAt > now) 방금 쓴 스냅샷이 빠지지 않는다 — createdAt 도 앱 시계다(REV-124 T-5)
  const skew = setSnap(f, '2026-10-06', '2026-10-06 10:40', 1, 0, 0)
  f.clock.now = kst('2026-10-06 10:39')
  assert.notEqual(await challengeProgressAfter(U, { kind: 'VOCAB_SESSION', refId: skew }, f.deps()), null)
  assertNoSideEffects(f)
})

test('challengeProgressAfter — null 목록(§5-4): 진행 중 없음·끝남·기간 밖·마지막 날 자정 뒤·다른 주제·내 단어장 세트·복습·붙여넣기·꺼진 과제·형태 이상·쿼리 오류', async () => {
  const f = world()
  const at = (s: string) => {
    f.clock.now = kst(s)
  }
  const none = lessonSnap(f, '2026-10-06', '2026-10-06 08:00')
  assert.equal(await challengeProgressAfter(U, { kind: 'LESSON', refId: none }, f.deps()), null) // 진행 중 없음
  const tomorrow = await createChallenge(U, body({ start: 'TOMORROW' }), f.deps())
  const today = lessonSnap(f, '2026-10-06', '2026-10-06 09:30')
  at('2026-10-06 09:31')
  assert.equal(await challengeProgressAfter(U, { kind: 'LESSON', refId: today }, f.deps()), null) // 기간 밖(내일 시작)
  await endChallenge(U, tomorrow.id, f.deps())
  const c = await createChallenge(U, body(), f.deps())
  const cases: [string, 'LESSON' | 'VOCAB_SESSION', string][] = [
    ['다른 주제 세트', 'VOCAB_SESSION', setSnap(f, '2026-10-06', '2026-10-06 10:00', 9, 1, 0, { topicId: T_OTHER })],
    ['내 단어장 세트', 'VOCAB_SESSION', setSnap(f, '2026-10-06', '2026-10-06 10:01', 9, 1, 0, { topicId: undefined })],
    ['복습 수업', 'LESSON', lessonSnap(f, '2026-10-06', '2026-10-06 10:02', { kind: 'REVIEW', topicId: null })],
    ['붙여넣기 수업', 'LESSON', lessonSnap(f, '2026-10-06', '2026-10-06 10:03', { topicId: null })],
    ['없는 스냅샷', 'LESSON', 'cnosnap000000000000000000'],
  ]
  at('2026-10-06 10:10')
  for (const [why, kind, refId] of cases) assert.equal(await challengeProgressAfter(U, { kind, refId }, f.deps()), null, why)
  // 마지막 날 자정 뒤(전이 전 ACTIVE): 10/12 시작·10/13 00:10 끝낸 세트
  const late = setSnap(f, '2026-10-12', '2026-10-13 00:10', 9, 1, 0)
  at('2026-10-13 00:11')
  assert.equal(await challengeProgressAfter(U, { kind: 'VOCAB_SESSION', refId: late }, f.deps()), null)
  assert.equal(f.tables.challenge.find((x) => x.id === c.id)?.status, 'ACTIVE') // 읽기 전용 — 전이하지 않는다
  // 꺼진 과제
  at('2026-10-06 11:00')
  await endChallenge(U, c.id, f.deps())
  const wordsOnly = await createChallenge(U, body({}, { lesson: false }), f.deps())
  const l2 = lessonSnap(f, '2026-10-06', '2026-10-06 11:10')
  at('2026-10-06 11:11')
  assert.equal(await challengeProgressAfter(U, { kind: 'LESSON', refId: l2 }, f.deps()), null)
  // 끝난 챌린지
  await endChallenge(U, wordsOnly.id, f.deps())
  const s3 = setSnap(f, '2026-10-06', '2026-10-06 11:20', 9, 1, 0)
  at('2026-10-06 11:21')
  assert.equal(await challengeProgressAfter(U, { kind: 'VOCAB_SESSION', refId: s3 }, f.deps()), null)
  // 형태 이상·쿼리 오류는 던지지 않고 null
  const bad = await createChallenge(U, body(), f.deps())
  f.tables.challenge.find((x) => x.id === bad.id)!.dailyGoal = { lesson: 'yes' }
  assert.equal(await challengeProgressAfter(U, { kind: 'VOCAB_SESSION', refId: s3 }, f.deps()), null)
  const broken = f.deps({ db: { challenge: { findFirst: async () => { throw new Error('db down') } } } as unknown as ChallengeDeps['db'] })
  assert.equal(await challengeProgressAfter(U, { kind: 'LESSON', refId: l2 }, broken), null)
})

test('#158 오늘 할 일 — 단어 TODO→SHORT→IN_PROGRESS→DONE · 수업 TODO/GENERATING(잡 살아 있음)/FAILED(죽은 잡, 표시만)/READY/IN_PROGRESS/CONTINUE/DONE', async () => {
  const f = world()
  await createChallenge(U, body(), f.deps())
  const tasks = async () => (await getChallengeToday(U, f.deps())).today!.tasks
  const words = async () => (await tasks()).find((t) => t.kind === 'WORDS')!
  const lesson = async () => (await tasks()).find((t) => t.kind === 'LESSON')!
  const d0 = new Date('2026-10-06T00:00:00Z')
  assert.equal((await words()).state, 'TODO')
  setSnap(f, '2026-10-06', '2026-10-06 09:10', 3, 1, 6)
  f.clock.now = kst('2026-10-06 09:20')
  assert.deepEqual(await words(), { kind: 'WORDS', state: 'SHORT', sessionId: f.tables.statsSnapshot.at(-1)!.periodKey, wordCount: 10, minAnswered: 8, answered: 4, sets: 1 })
  f.tables.vocabSession.push({ id: 'csessionopen0000000000001', userId: U, topicId: T, status: 'IN_PROGRESS', date: d0, startedAt: kst('2026-10-06 09:21') })
  assert.deepEqual([(await words()).state, (await words()).sessionId], ['IN_PROGRESS', 'csessionopen0000000000001'])
  f.tables.vocabSession[0].status = 'DONE'
  setSnap(f, '2026-10-06', '2026-10-06 09:30', 4, 0, 4)
  f.clock.now = kst('2026-10-06 09:31')
  assert.deepEqual([(await words()).state, (await words()).answered, (await words()).sets], ['DONE', 8, 2])

  // 다른 주제 수업이 오늘 끝났고 또 하나가 열려 있어도 챌린지 수업 줄의 주인은 챌린지 주제
  lessonSnap(f, '2026-10-06', '2026-10-06 09:40', { topicId: T_OTHER })
  f.tables.lesson.push({ id: 'clessonother0000000000001', userId: U, topicId: T_OTHER, kind: 'NEW', status: 'IN_PROGRESS', date: d0, createdAt: kst('2026-10-06 09:41'), updatedAt: kst('2026-10-06 09:41') })
  f.clock.now = kst('2026-10-06 09:45')
  assert.equal((await lesson()).state, 'TODO')
  // 어제 만든 챌린지 주제 수업 → 이어서 하기
  f.tables.lesson.push({ id: 'clessonyesterday000000001', userId: U, topicId: T, kind: 'NEW', status: 'READY', date: new Date('2026-10-05T00:00:00Z'), createdAt: kst('2026-10-05 20:00'), updatedAt: kst('2026-10-05 20:00') })
  assert.deepEqual(await lesson(), { kind: 'LESSON', state: 'CONTINUE', lessonId: 'clessonyesterday000000001', jobId: null })
  // 오늘 만드는 중 — 잡이 살아 있으면 GENERATING, 없으면 표시만 FAILED(레슨 행은 그대로)
  f.tables.lesson.push({ id: 'clessontoday0000000000001', userId: U, topicId: T, kind: 'NEW', status: 'GENERATING', date: d0, createdAt: kst('2026-10-06 09:46'), updatedAt: kst('2026-10-06 09:46') })
  assert.deepEqual(await lesson(), { kind: 'LESSON', state: 'FAILED', lessonId: 'clessontoday0000000000001', jobId: null })
  assert.equal(f.tables.lesson.at(-1)!.status, 'GENERATING')
  const live = new Date()
  f.tables.aiJob.push({ id: 'cjob00000000000000000001', userId: U, kind: 'LESSON_GEN', refId: 'clessontoday0000000000001', status: 'RUNNING', progress: 10, stage: null, error: null, createdAt: live, startedAt: live, finishedAt: null })
  assert.deepEqual(await lesson(), { kind: 'LESSON', state: 'GENERATING', lessonId: 'clessontoday0000000000001', jobId: 'cjob00000000000000000001' })
  for (const st of ['READY', 'IN_PROGRESS', 'FAILED'] as const) {
    f.tables.lesson.at(-1)!.status = st
    assert.equal((await lesson()).state, st)
  }
  const done = lessonSnap(f, '2026-10-06', '2026-10-06 10:00')
  f.clock.now = kst('2026-10-06 10:01')
  assert.deepEqual(await lesson(), { kind: 'LESSON', state: 'DONE', lessonId: done, jobId: null })
  assert.equal((await getChallengeToday(U, f.deps())).today?.goalMet, true)
  assert.deepEqual(foreignWrites(f.log), [])
})

test('#58 getActiveChallengeTopic — 기간 안·수업 과제 켜짐일 때만, 오늘 챌린지 수업을 끝내면 lessonDoneToday', async () => {
  const f = world()
  assert.equal(await getActiveChallengeTopic(U, f.deps()), null)
  const c = await createChallenge(U, body(), f.deps())
  assert.deepEqual(await getActiveChallengeTopic(U, f.deps()), { challengeId: c.id, topicId: T, topicTitle: '카페 주문', level: 'N5', lessonDoneToday: false })
  lessonSnap(f, '2026-10-06', '2026-10-06 10:00', { topicId: T_OTHER })
  lessonSnap(f, '2026-10-06', '2026-10-06 10:05', { kind: 'REVIEW', topicId: T })
  f.clock.now = kst('2026-10-06 10:10')
  assert.equal((await getActiveChallengeTopic(U, f.deps()))?.lessonDoneToday, false)
  lessonSnap(f, '2026-10-06', '2026-10-06 10:20')
  f.clock.now = kst('2026-10-06 10:21')
  assert.equal((await getActiveChallengeTopic(U, f.deps()))?.lessonDoneToday, true)
  await endChallenge(U, c.id, f.deps())
  await createChallenge(U, body({}, { lesson: false }), f.deps())
  assert.equal(await getActiveChallengeTopic(U, f.deps()), null) // 수업 과제 꺼짐
  const g = world()
  await createChallenge(U, body({ start: 'TOMORROW' }), g.deps())
  assert.equal(await getActiveChallengeTopic(U, g.deps()), null) // 시작 전
  assertNoSideEffects(g)
})

test('#155 목록 — 진행 중 먼저·끝난 것 endedAt desc·커서·status 필터·모르는 키 400', async () => {
  const f = world('2026-10-01 09:00')
  const ids: string[] = []
  for (let i = 0; i < 3; i++) {
    const c = await createChallenge(U, body(), f.deps())
    f.clock.now = new Date(f.clock.now.getTime() + 3600_000)
    await endChallenge(U, c.id, f.deps())
    ids.push(c.id)
  }
  const active = await createChallenge(U, body(), f.deps())
  const all = await listChallenges(U, parseChallengeListQuery(new URLSearchParams()), f.deps())
  assert.deepEqual(all.items.map((x) => x.id), [active.id, ids[2], ids[1], ids[0]])
  assert.equal(all.nextCursor, null)
  const p1 = await listChallenges(U, parseChallengeListQuery(new URLSearchParams('limit=2')), f.deps())
  assert.deepEqual(p1.items.map((x) => x.id), [active.id, ids[2]])
  const p2 = await listChallenges(U, parseChallengeListQuery(new URLSearchParams(`limit=2&cursor=${p1.nextCursor}`)), f.deps())
  assert.deepEqual([p2.items.map((x) => x.id), p2.nextCursor], [[ids[1], ids[0]], null])
  const one = await listChallenges(U, parseChallengeListQuery(new URLSearchParams('limit=1')), f.deps())
  assert.deepEqual(one.items.map((x) => x.id), [active.id])
  const rest = await listChallenges(U, parseChallengeListQuery(new URLSearchParams(`limit=5&cursor=${one.nextCursor}`)), f.deps())
  assert.deepEqual(rest.items.map((x) => x.id), [ids[2], ids[1], ids[0]])
  assert.deepEqual((await listChallenges(U, parseChallengeListQuery(new URLSearchParams('status=ACTIVE')), f.deps())).items.map((x) => x.id), [active.id])
  assert.deepEqual((await listChallenges(U, parseChallengeListQuery(new URLSearchParams('status=FINISHED')), f.deps())).items.map((x) => x.status), ['ENDED', 'ENDED', 'ENDED'])
  assert.throws(() => parseChallengeListQuery(new URLSearchParams('sort=asc')), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
  assert.throws(() => parseChallengeListQuery(new URLSearchParams('limit=51')), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
  assert.throws(() => parseChallengeListQuery(new URLSearchParams('status=COMPLETED')), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
})

test('#70·#71 challengeDayStates — 그 달 챌린지 날만 · 겹치는 날은 그만둔 날보다 새 챌린지 · 진행 중 요약 · 기존 달력 모양 불변', async () => {
  const f = world('2026-10-03 09:00')
  const old = await createChallenge(U, body(), f.deps())
  setSnap(f, '2026-10-03', '2026-10-03 10:00', 8, 2, 0)
  lessonSnap(f, '2026-10-03', '2026-10-03 11:00')
  f.clock.now = kst('2026-10-05 12:00')
  await endChallenge(U, old.id, f.deps())
  const cur = await createChallenge(U, body(), f.deps())
  f.clock.now = kst('2026-10-06 09:00')
  const r = await challengeDayStates(U, { from: '2026-10-01', to: '2026-10-31' }, f.deps())
  // 끝난(얼린 result) 챌린지 날도 need = 만들 때 얼린 인정 장수(10장 → 8)
  assert.deepEqual(r.days.get('2026-10-03'), { challengeId: old.id, title: '카페 주문 7일 챌린지', dayIndex: 1, state: 'MET', lesson: { quizCorrect: 4, quizTotal: 5 }, words: { correct: 8, wrong: 2, skipped: 0, cardCount: 10, ok: true, need: 8 }, createdAt: kst('2026-10-03 09:00') })
  assert.deepEqual([r.days.get('2026-10-04')?.state, r.days.get('2026-10-05')?.challengeId, r.days.get('2026-10-05')?.state], ['MISSED', cur.id, 'MISSED'])
  assert.deepEqual([r.days.get('2026-10-06')?.state, r.days.get('2026-10-11')?.state, r.days.get('2026-10-11')?.challengeId, r.days.has('2026-10-12')], ['TODAY', 'UPCOMING', cur.id, false])
  assert.deepEqual(r.active, { id: cur.id, metDays: 0, elapsedDays: 1, streak: 0 })
  const cal: CalendarDto = {
    month: '2026-10',
    today: '2026-10-06',
    days: [{ date: '2026-10-02', attended: false, types: [], minutes: 0, logCount: 0, hasEvaluation: false, reviewDue: false }, { date: '2026-10-03', attended: true, types: ['WORDS'], minutes: 1, logCount: 1, hasEvaluation: false, reviewDue: false }],
    summary: { attendedDays: 1, studyDays: 1, streak: 0, longestStreak: 1 },
  }
  const merged = withChallengeCalendar(cal, r)
  assert.equal('challenge' in merged.days[0], false)
  assert.deepEqual(merged.days[1].challenge, { challengeId: old.id, dayIndex: 1, state: 'MET' })
  assert.deepEqual(merged.summary.challenge, r.active)
  assert.deepEqual(withChallengeCalendar(cal, null), cal)
  const none = await challengeDayStates(U2, { from: '2026-10-01', to: '2026-10-31' }, f.deps())
  assert.deepEqual(withChallengeCalendar(cal, none), cal)
  assertNoSideEffects(f)
})

test('#71 하루 시트 words.need — 얼린 dailyGoal.wordsMinAnswered(5·10·15 → 4·8·12, 진행 중·끝난 날 같은 값) · 단어 과제를 끄면 null', async () => {
  for (const [wordCount, need] of [[5, 4], [10, 8]] as const) {
    const f = world()
    const c = await createChallenge(U, body({}, { wordCount }), f.deps())
    setSnap(f, '2026-10-06', '2026-10-06 10:00', 3, 1, 1)
    f.clock.now = kst('2026-10-06 10:01')
    const live = (await challengeDayStates(U, { from: '2026-10-06', to: '2026-10-06' }, f.deps())).days.get('2026-10-06')
    assert.deepEqual(live?.words, { correct: 3, wrong: 1, skipped: 1, cardCount: 5, ok: wordCount === 5, need })
    await endChallenge(U, c.id, f.deps())
    const frozen = (await challengeDayStates(U, { from: '2026-10-06', to: '2026-10-06' }, f.deps())).days.get('2026-10-06')
    assert.equal(frozen?.words?.need, need)
  }
  const g = world()
  g.tables.topicChunk.push(...[13, 14, 15].map((i) => ({ id: `cchunk${String(i).padStart(4, '0')}`, topicId: T, chunkType: 'NAME', textJa: `表現${i}`, reading: 'ひょうげん', meaningKo: `뜻${i}`, order: i })))
  await createChallenge(U, body({}, { wordCount: 15 }), g.deps())
  setSnap(g, '2026-10-06', '2026-10-06 10:00', 10, 2, 3)
  g.clock.now = kst('2026-10-06 10:01')
  assert.equal((await challengeDayStates(U, { from: '2026-10-06', to: '2026-10-06' }, g.deps())).days.get('2026-10-06')?.words?.need, 12)
  const h = world()
  await createChallenge(U, body({}, { words: false }), h.deps())
  setSnap(h, '2026-10-06', '2026-10-06 10:00', 8, 2, 0)
  h.clock.now = kst('2026-10-06 10:01')
  const off = (await challengeDayStates(U, { from: '2026-10-06', to: '2026-10-06' }, h.deps())).days.get('2026-10-06')
  assert.deepEqual([off?.words?.need, off?.words?.ok, off?.words?.correct], [null, null, 8])
})

test('#159 본문 — 빈 객체만(모르는 키 400)', () => {
  assert.doesNotThrow(() => parseEndChallengeBody({}))
  assert.throws(() => parseEndChallengeBody({ reason: 'x' }), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && e.details?.reason === 'unknown_key')
})

test('층·import — challenges 는 lessons·vocab·studyLog·conversation·engine·speech 를 import 하지 않고, today.ts·calendar.ts 는 ../challenges 만 쓴다', () => {
  const dir = join(__dirname, '..', 'challenges')
  for (const name of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(join(dir, name), 'utf8')
    const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    for (const spec of imports) {
      assert.ok(!/^\.\.\/(lessons|vocab|studyLog|reviewSchedule|repetition\/decision)(\/|$)/.test(spec), `${name}: ${spec}`)
      assert.ok(!/^@\/modules\/(conversation|engine|speech|admin)(\/|$)/.test(spec), `${name}: ${spec}`)
      assert.ok(!/claude|haiku|sonnet|opus|qwen|whisper|reazon|style-?bert/i.test(spec), `${name}: ${spec}`)
    }
  }
  for (const rel of ['lessons/today.ts', 'studyLog/calendar.ts']) {
    const src = readFileSync(join(__dirname, '..', rel), 'utf8')
    const ch = [...src.matchAll(/from '(\.\.\/challenges[^']*)'/g)].map((m) => m[1])
    assert.deepEqual(ch, ['../challenges'], rel)
  }
  const lifecycle = readFileSync(join(__dirname, '..', 'lessons', 'lifecycle.ts'), 'utf8')
  assert.ok(!/challenges/.test(lifecycle), '수업 완료 트랜잭션은 챌린지를 모른다')
})

test('REV-120 L-1 — 끝난 챌린지 한 행의 dailyGoal 형태가 깨져도 #155 목록·#158 recentlyEnded 는 500 대신 그 행만 뺀다(로그 한 줄)', async () => {
  const f = world('2026-10-01 09:00')
  const ids: string[] = []
  for (let i = 0; i < 3; i++) {
    const c = await createChallenge(U, body(), f.deps())
    f.clock.now = new Date(f.clock.now.getTime() + 3600_000)
    await endChallenge(U, c.id, f.deps())
    ids.push(c.id)
  }
  // 가장 최근에 끝낸 행·가운데 행을 깨뜨린다(수동 DB 수정·옛 행을 읽지 못하는 미래 규칙 버전 등).
  for (const id of [ids[2], ids[1]]) f.tables.challenge.find((r) => r.id === id)!.dailyGoal = { lesson: 'yes' }
  const logs: unknown[][] = []
  const orig = console.error
  console.error = (...a: unknown[]) => {
    logs.push(a)
  }
  try {
    const all = await listChallenges(U, parseChallengeListQuery(new URLSearchParams()), f.deps())
    assert.deepEqual([all.items.map((x) => x.id), all.nextCursor], [[ids[0]], null])
    const p1 = await listChallenges(U, parseChallengeListQuery(new URLSearchParams('limit=2')), f.deps())
    assert.deepEqual(p1.items.map((x) => x.id), []) // 이 쪽 두 행이 모두 깨짐 — 커서는 원래 행 기준이라 다음 쪽이 이어진다
    const p2 = await listChallenges(U, parseChallengeListQuery(new URLSearchParams(`limit=2&cursor=${p1.nextCursor}`)), f.deps())
    assert.deepEqual([p2.items.map((x) => x.id), p2.nextCursor], [[ids[0]], null])
    const today = await getChallengeToday(U, f.deps())
    assert.deepEqual([today.challenge, today.today, today.recentlyEnded], [null, null, null])
  } finally {
    console.error = orig
  }
  assert.ok(logs.length >= 2 && logs.every((a) => /dailyGoal/.test(String(a[0])) && (a[1] === ids[1] || a[1] === ids[2])), JSON.stringify(logs))
  const fresh = await createChallenge(U, body(), f.deps()) // 끝난 행이 깨져도 새로 만들기·오늘은 그대로
  assert.equal((await getChallengeToday(U, f.deps())).challenge?.id, fresh.id)
  assertNoSideEffects(f)
})

// ── REV-124 — 끝내는 시각(endedAt)은 사용자 행 잠금을 얻은 "뒤"에 잡는다 ─────────────────────────────────────
// 완료(수업 #62·세트 #51)는 사용자 행 잠금을 쥔 채 스냅샷을 만든다. 그만두기가 잠금 전에 시각을 잡으면, 잠금 대기 중 먼저 커밋된 완료가
// `createdAt ≥ endedAt` 로 불변 result 에서 영구히 빠진다(시계 하나에서 생기는 순서 역전).

const lessonOnly = () => body({}, { words: false })
const msAfter = (d: Date, ms: number) => new Date(d.getTime() + ms)

/**
 * 완료 트랜잭션(T1)이 사용자 잠금을 쥔 동안 `run`(T2)을 보낸다. T2 는 `arrive` 에 도착해 잠금을 기다리고, T1 은 `arrive+50ms` 에
 * 수업 스냅샷을 만든 뒤 `arrive+80ms` 에 커밋(잠금 해제)한다. T2 가 실제로 T1 스냅샷보다 먼저 잠금을 요청했는지도 확인한다.
 */
async function whileCompletionHoldsLock<R>(f: FakeDb, arrive: Date, run: () => Promise<R>): Promise<{ key: string; snapAt: Date; out: R }> {
  const deps = f.deps()
  const base = f.log.length
  let holding!: () => void
  const held = new Promise<void>((r) => (holding = r))
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  let key = ''
  const snapAt = msAfter(arrive, 50)
  const t1 = deps.transaction!(async (tx) => {
    await deps.lockUser!(tx, U)
    holding()
    await gate
    f.clock.now = snapAt
    key = lessonSnap(f, '2026-10-06', snapAt)
    f.log.push('T1:snapshot')
    f.clock.now = msAfter(arrive, 80)
  })
  await held
  f.clock.now = arrive
  const t2 = run()
  await new Promise((r) => setImmediate(r))
  release()
  await t1
  const out = await t2
  const mine = f.log.slice(base)
  const snapIdx = mine.indexOf('T1:snapshot')
  assert.equal(mine.filter((l, i) => l === 'lockUser' && i < snapIdx).length, 2, 'T2 가 T1 스냅샷보다 먼저 잠금을 요청해 기다렸다')
  return { key, snapAt, out }
}

test('REV-124 T-1 — 그만두기: 잠금 대기 중 먼저 커밋된 완료도 얼린 result 에 들어간다(endedAt = 잠금을 얻은 시각)', async () => {
  const f = world()
  const c = await createChallenge(U, lessonOnly(), f.deps())
  const arrive = kst('2026-10-06 09:30')
  const { snapAt, out: ended } = await whileCompletionHoldsLock(f, arrive, () => endChallenge(U, c.id, f.deps()))
  const row = f.tables.challenge.find((r) => r.id === c.id)!
  assert.equal((row.endedAt as Date).toISOString(), msAfter(arrive, 80).toISOString())
  assert.ok((row.endedAt as Date).getTime() > snapAt.getTime(), 'endedAt > 그 스냅샷 createdAt')
  assert.deepEqual([ended.status, ended.endedAt], ['ENDED', msAfter(arrive, 80).toISOString()])
  const d = await getChallengeDetail(U, c.id, f.deps())
  assert.deepEqual([d.result?.lessonsDone, d.result?.metDays, d.days[0].state, d.result?.endReason], [1, 1, 'MET', 'USER'])
  assertNoSideEffects(f)
})

test('REV-124 T-1 — 주제가 끊긴 진행 중(TOPIC_REMOVED) 지연 전이도 endedAt 을 잠금 뒤에 잡는다(#158 settleExpired · #156 안의 전이)', async () => {
  const arrive = kst('2026-10-06 09:30')
  const paths: [string, (f: FakeDb) => Promise<unknown>][] = [
    ['#158 settleExpired', (f) => getChallengeToday(U, f.deps())],
    ['#156 settleExpiredTx', (f) => createChallenge(U, lessonOnly(), f.deps())],
  ]
  for (const [why, run] of paths) {
    const f = world()
    const c = await createChallenge(U, lessonOnly(), f.deps())
    f.tables.challenge[0].topicId = null
    const { snapAt } = await whileCompletionHoldsLock(f, arrive, () => run(f))
    const row = f.tables.challenge.find((r) => r.id === c.id)!
    assert.deepEqual([row.status, row.activeKey, (row.result as { endReason: string }).endReason], ['ENDED', null, 'TOPIC_REMOVED'], why)
    assert.equal((row.endedAt as Date).toISOString(), msAfter(arrive, 80).toISOString(), why)
    assert.ok((row.endedAt as Date).getTime() > snapAt.getTime(), why)
  }
})

test('REV-124 T-2 — 반대 순서: 그만두기가 잠금을 먼저 얻으면 그 뒤 커밋된 완료는 result 에서 빠지고, 다시 조회해도 같은 값(불변)', async () => {
  const f = world()
  const c = await createChallenge(U, lessonOnly(), f.deps())
  const t = kst('2026-10-06 09:30')
  f.clock.now = t
  const deps = f.deps()
  let key = ''
  const ending = endChallenge(U, c.id, f.deps())
  const completing = deps.transaction!(async (tx) => {
    await deps.lockUser!(tx, U)
    f.clock.now = msAfter(t, 30)
    key = lessonSnap(f, '2026-10-06', f.clock.now)
  })
  await Promise.all([ending, completing])
  const row = f.tables.challenge.find((r) => r.id === c.id)!
  const s = f.tables.statsSnapshot.find((x) => x.periodKey === key)!
  assert.equal((row.endedAt as Date).toISOString(), t.toISOString())
  assert.ok((s.createdAt as Date).getTime() > (row.endedAt as Date).getTime(), '완료 스냅샷은 그만둔 뒤에 만들어졌다(기록은 남는다)')
  const frozen = structuredClone(row.result)
  const d1 = await getChallengeDetail(U, c.id, f.deps())
  assert.deepEqual([d1.result?.lessonsDone, d1.result?.metDays, d1.days[0].state], [0, 0, 'STOPPED'])
  f.clock.now = kst('2026-10-08 10:00')
  const d2 = await getChallengeDetail(U, c.id, f.deps())
  assert.deepEqual(d2.result, d1.result)
  assert.deepEqual(d2.days.map((x) => x.state), d1.days.map((x) => x.state))
  assert.deepEqual(row.result, frozen)
})

test('REV-124 T-3 — 경계(서비스 수준): 스냅샷 createdAt = endedAt − 1ms 는 포함, = endedAt 은 제외', async () => {
  const e = kst('2026-10-06 09:30')
  for (const [offsetMs, done, state] of [[-1, 1, 'MET'], [0, 0, 'STOPPED']] as const) {
    const f = world()
    const c = await createChallenge(U, lessonOnly(), f.deps())
    lessonSnap(f, '2026-10-06', msAfter(e, offsetMs))
    f.clock.now = e
    await endChallenge(U, c.id, f.deps())
    assert.equal((f.tables.challenge[0].endedAt as Date).toISOString(), e.toISOString())
    const d = await getChallengeDetail(U, c.id, f.deps())
    assert.deepEqual([d.result?.lessonsDone, d.days[0].state], [done, state], `offset ${offsetMs}ms`)
  }
})

test('REV-124 T-4 — 앱 시계를 ±10ms·±5s 옮겨도 무엇이 들어가는지는 createdAt < endedAt 순서로만 정해진다(결과 동일)', async () => {
  const results: unknown[] = []
  for (const skew of [-5000, -10, 0, 10, 5000]) {
    const f = world()
    f.clock.now = msAfter(kst('2026-10-06 09:00'), skew)
    const c = await createChallenge(U, lessonOnly(), f.deps())
    const arrive = msAfter(kst('2026-10-06 09:30'), skew)
    await whileCompletionHoldsLock(f, arrive, () => endChallenge(U, c.id, f.deps())) // 잠금 대기 중 커밋된 완료 → 포함
    lessonSnap(f, '2026-10-06', msAfter(arrive, 120)) // 그만둔 뒤 커밋된 완료 → 제외
    const row = f.tables.challenge[0]
    assert.equal((row.endedAt as Date).getTime() - arrive.getTime(), 80, `skew ${skew}`)
    const d = await getChallengeDetail(U, c.id, f.deps())
    assert.deepEqual([d.result?.lessonsDone, d.days[0].state], [1, 'MET'], `skew ${skew}`)
    results.push(d.result)
  }
  for (const r of results) assert.deepEqual(r, results[0])
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(p)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : []
  })
}

test('REV-124 T-5 전제 고정 — LESSON·VOCAB_SESSION 스냅샷 createdAt 은 앱 시계(엔진이 싣는 값), DB 시계로 쓰는 경로가 없다', () => {
  // Prisma `@default(now())` 는 DB 기본값이 아니라 쿼리 엔진이 INSERT 파라미터로 값을 보낸다(MySQL 8.0.46·Prisma 6.19.3 로 REV-124 실측).
  // 그래서 createdAt 과 endedAt(deps.now()) 은 같은 앱 시계다. 이 전제가 깨지면 DB↔앱 시계 오차가 곧바로 챌린지 지표의 경계에 들어온다.
  const root = join(__dirname, '..', '..', '..', '..')
  const schema = readFileSync(join(root, 'prisma', 'schema.prisma'), 'utf8')
  const model = schema.slice(schema.indexOf('model StatsSnapshot {'), schema.indexOf('\n}', schema.indexOf('model StatsSnapshot {')))
  assert.match(model, /\n\s+createdAt\s+DateTime\s+@default\(now\(\)\)\n/, 'dbgenerated(...) 로 바뀌면 DB 시계가 된다')

  const snapFile = join(root, 'src', 'modules', 'learning', 'snapshots', 'index.ts')
  const snapSrc = readFileSync(snapFile, 'utf8')
  for (const fn of ['createLessonSnapshot', 'createVocabSessionSnapshot']) {
    const start = snapSrc.indexOf(`export async function ${fn}(`)
    assert.ok(start >= 0, fn)
    const fnBody = snapSrc.slice(start, snapSrc.indexOf('\n}\n', start))
    assert.match(fnBody, /\.statsSnapshot\.create\(\{ data: \{/, fn)
    assert.doesNotMatch(fnBody, /createdAt|\$executeRaw|\$queryRaw/, fn)
  }
  const RAW_INSERT = /INSERT\s+INTO\s+`?StatsSnapshot`?[^`]*/gi
  const outsideDaily = snapSrc.replace(RAW_INSERT, (m) => (/'DAILY'/.test(m) ? '' : m))
  assert.doesNotMatch(outsideDaily, /createdAt|NOW\(/, 'DB 시계(NOW())는 DAILY raw INSERT 에만 — 다른 스냅샷 쓰기는 createdAt 을 싣지 않는다')

  const srcRoot = join(root, 'src')
  for (const file of sourceFiles(srcRoot)) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(RAW_INSERT)) {
      assert.match(m[0], /'DAILY'/, relative(root, file))
      assert.doesNotMatch(m[0], /LESSON|VOCAB_SESSION/, relative(root, file))
    }
    assert.doesNotMatch(src, /UPDATE\s+`?StatsSnapshot`?\s+SET[^`]*createdAt/i, relative(root, file))
    if (/\.statsSnapshot\.(create|createMany|upsert)\(/.test(src)) assert.equal(file, snapFile, `${relative(root, file)} — 스냅샷 생성은 snapshots/index.ts 에만`)
  }
})

test('REV-124 T-6 — 완료 커밋 뒤 그만두기가 먼저 끝나면 challengeProgressAfter 는 null(§5-4 끝남), 그 완료는 result 에 들어 있다', async () => {
  const f = world()
  const c = await createChallenge(U, lessonOnly(), f.deps())
  const t = kst('2026-10-06 09:30')
  const key = lessonSnap(f, '2026-10-06', t) // 수업 완료 커밋
  f.clock.now = msAfter(t, 10)
  await endChallenge(U, c.id, f.deps()) // 다른 탭의 그만두기가 완료 응답 조합보다 먼저 끝남
  assert.equal(await challengeProgressAfter(U, { kind: 'LESSON', refId: key }, f.deps()), null)
  const d = await getChallengeDetail(U, c.id, f.deps())
  assert.deepEqual([d.result?.lessonsDone, d.result?.metDays, d.days[0].state], [1, 1, 'MET'])
  assertNoSideEffects(f)
})
