/**
 * task-041 REV-120 L-4 — #58 `recommendation` 의 챌린지 분기(`recommendTodayLesson`)를 메모리 DB 로 확인한다(오프라인 — 공유 DB 를 읽지 않는다).
 * 기존 추천 규칙(`byHistory` — CONTINUE·NEXT_TOPIC·START)은 이 task 에서 바꾸지 않았고 실제 DB 를 읽으므로, 여기서는 가짜로 바꿔
 * "챌린지 분기가 그쪽으로 넘어갔는지·그 결과를 손대지 않고 돌려주는지"만 본다. 챌린지 분기는 읽기만 한다(LLM·잡·Trace 0).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { JlptLevel } from '@prisma/client'
import type { Tx } from '@/modules/infra'
import { createChallenge, endChallenge, parseCreateChallengeBody } from '../challenges'
import type { LessonRecommendation } from '../lessons'
import { recommendTodayLesson, type TodayRecommendDeps } from '../lessons/today'
import { fakeDb, foreignWrites, kst, type FakeDb } from './challengeFakeDb'

const U = 'cuser0000000000000000000u1'
const U2 = 'cuser0000000000000000000u2'
const T = 'ctopiccafe000000000000001'
const T_OTHER = 'ctopicroad000000000000002'

function world(at = '2026-10-06 09:00'): FakeDb {
  const f = fakeDb()
  f.clock.now = kst(at)
  f.tables.conversationTopic.push({ id: T, userId: null, title: '카페 주문', level: 'N5' }, { id: T_OTHER, userId: null, title: '길 묻기', level: 'N5' })
  for (let i = 1; i <= 12; i++) {
    f.tables.topicChunk.push({ id: `cchunk${String(i).padStart(4, '0')}`, topicId: T, chunkType: 'NAME', textJa: `表現${i}`, reading: 'ひょうげん', meaningKo: `뜻${i}`, order: i })
  }
  return f
}

const body = (over: Record<string, unknown> = {}, goal: Record<string, unknown> = {}) =>
  parseCreateChallengeBody({ topicId: T, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 10, ...goal }, ...over })

let seq = 0
function lessonSnap(f: FakeDb, date: string, at: string, over: Record<string, unknown> = {}): void {
  seq++
  f.tables.statsSnapshot.push({
    id: `crsnap${String(seq).padStart(6, '0')}`, userId: U, kind: 'LESSON', periodKey: `crlesson${String(seq).padStart(6, '0')}`,
    data: { kind: 'NEW', topicId: T, score: 80, stageDone: 5, itemCount: 4, quizCorrect: 4, quizTotal: 5, date, ...over }, createdAt: kst(at),
  })
}

const content = (titleKo: string) => ({ v: 1, title: 't', dialogue: [], chunks: [], grammar: [], quiz: [], application: [], speaking: [], nextPreview: { titleKo, teaserKo: `${titleKo} 미리보기` } })

/** 기존 추천이 돌려줄 값 — 챌린지 분기가 넘어가면 이 객체가 그대로(같은 참조) 나와야 한다. */
const HISTORY: LessonRecommendation = { topicId: T_OTHER, topicTitle: '길 묻기', level: 'N5', reason: 'CONTINUE', nextPreview: null }

/** 추천 1회 — 그 사이 DB 호출만 따로 모아 "읽기만"을 확인한다. */
async function recommend(f: FakeDb, level: JlptLevel, over: Partial<TodayRecommendDeps> = {}): Promise<{ r: LessonRecommendation | null; history: string[]; log: string[] }> {
  const history: string[] = []
  f.log.length = 0
  const r = await recommendTodayLesson(U, level, {
    db: f.db,
    challenge: f.deps(),
    byHistory: async (userId, lv) => {
      history.push(`${userId}:${lv}`)
      return HISTORY
    },
    ...over,
  })
  const log = [...f.log]
  assert.deepEqual(log.filter((l) => /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)$/.test(l)), [], '추천은 읽기만')
  return { r, history, log }
}

function assertNoAi(f: FakeDb): void {
  assert.deepEqual(foreignWrites(f.log), [])
  assert.equal(f.tables.aiJob.length, 0, 'AiJob 행 0')
  assert.equal(f.tables.requestTrace.length, 0, 'RequestTrace 행 0')
}

test('#58 추천 — 진행 중 챌린지·오늘 그 주제 새 수업 미완료 → CHALLENGE·그 주제 최우선(기존 추천을 부르지 않음)·그 주제 마지막 새 수업의 nextPreview', async () => {
  const f = world()
  await createChallenge(U, body(), f.deps())
  const first = await recommend(f, 'N5')
  assert.deepEqual(first.r, { topicId: T, topicTitle: '카페 주문', level: 'N5', reason: 'CHALLENGE', nextPreview: null }) // 그 주제 수업을 아직 안 함
  assert.deepEqual(first.history, [])
  f.tables.lesson.push(
    { id: 'clesson000001', userId: U, topicId: T, kind: 'NEW', status: 'DONE', completedAt: kst('2026-10-04 20:00'), content: content('주문 이어 가기') },
    { id: 'clesson000002', userId: U, topicId: T, kind: 'NEW', status: 'DONE', completedAt: kst('2026-10-05 20:00'), content: content('계산하기') },
    { id: 'clesson000003', userId: U, topicId: T, kind: 'REVIEW', status: 'DONE', completedAt: kst('2026-10-05 21:00'), content: content('복습 수업') },
    { id: 'clesson000004', userId: U, topicId: T_OTHER, kind: 'NEW', status: 'DONE', completedAt: kst('2026-10-05 22:00'), content: content('다른 주제') },
    { id: 'clesson000005', userId: U2, topicId: T, kind: 'NEW', status: 'DONE', completedAt: kst('2026-10-05 23:00'), content: content('남의 수업') },
    { id: 'clesson000006', userId: U, topicId: T, kind: 'NEW', status: 'READY', completedAt: null, content: content('아직 안 끝낸 수업') },
  )
  const next = await recommend(f, 'N4') // 학습자 수준과 무관하게 챌린지 주제·그 주제 수준
  assert.deepEqual(next.r, { topicId: T, topicTitle: '카페 주문', level: 'N5', reason: 'CHALLENGE', nextPreview: { titleKo: '계산하기', teaserKo: '계산하기 미리보기' } })
  assert.deepEqual(next.history, [])
  assert.equal(next.log.filter((l) => l === 'lesson.findFirst').length, 1)
  assertNoAi(f)
})

test('#58 추천 — 오늘 챌린지 주제 새 수업을 끝냈으면(스냅샷) 기존 추천으로 넘어가 결과를 그대로 돌려준다 · 수업 과제를 끈 챌린지도 기존 추천', async () => {
  const f = world()
  const c = await createChallenge(U, body(), f.deps())
  lessonSnap(f, '2026-10-06', '2026-10-06 10:00', { kind: 'REVIEW' }) // 복습 수업은 세지 않는다
  lessonSnap(f, '2026-10-06', '2026-10-06 10:01', { topicId: T_OTHER }) // 다른 주제도
  f.clock.now = kst('2026-10-06 10:02')
  assert.equal((await recommend(f, 'N5')).r?.reason, 'CHALLENGE')
  lessonSnap(f, '2026-10-06', '2026-10-06 10:05')
  f.clock.now = kst('2026-10-06 10:06')
  const done = await recommend(f, 'N5')
  assert.equal(done.r, HISTORY)
  assert.deepEqual(done.history, [`${U}:N5`])
  assert.ok(!done.log.includes('lesson.findFirst'), '챌린지 분기의 마지막 수업 조회 없음')
  await endChallenge(U, c.id, f.deps())
  await createChallenge(U, body({}, { lesson: false }), f.deps())
  const wordsOnly = await recommend(f, 'N5')
  assert.equal(wordsOnly.r, HISTORY)
  assert.deepEqual(wordsOnly.history, [`${U}:N5`])
  assertNoAi(f)
})

test('#58 추천 — 진행 중 챌린지 없음·내일 시작·그만둔 챌린지 → 기존 추천 그대로(학습자 수준을 그대로 넘김, 마지막 수업 조회 없음)', async () => {
  const f = world()
  const none = await recommend(f, 'N4')
  assert.equal(none.r, HISTORY)
  assert.deepEqual(none.history, [`${U}:N4`])
  assert.ok(!none.log.includes('lesson.findFirst'))
  const c = await createChallenge(U, body({ start: 'TOMORROW' }), f.deps())
  const upcoming = await recommend(f, 'N4')
  assert.equal(upcoming.r, HISTORY)
  assert.deepEqual(upcoming.history, [`${U}:N4`])
  await endChallenge(U, c.id, f.deps())
  const ended = await recommend(f, 'N4')
  assert.equal(ended.r, HISTORY)
  assert.deepEqual(ended.history, [`${U}:N4`])
  const noHistory = await recommend(f, 'N5', { byHistory: async () => null }) // 기존 추천이 null 이면 null 그대로
  assert.equal(noHistory.r, null)
  assertNoAi(f)
})

test('#58 추천 — 챌린지 계산이 실패하면(쿼리 오류) 기존 추천으로 · 로그는 오류 이름만', async () => {
  const f = world()
  await createChallenge(U, body(), f.deps())
  const err = Object.assign(new Error('비밀이 섞일 수 있는 메시지'), { name: 'FakeQueryError' })
  const brokenDb = { ...(f.db as unknown as Record<string, unknown>), challenge: { findFirst: async () => Promise.reject(err) } } as unknown as Tx
  const logs: unknown[][] = []
  const orig = console.error
  console.error = (...a: unknown[]) => {
    logs.push(a)
  }
  let out: Awaited<ReturnType<typeof recommend>>
  try {
    out = await recommend(f, 'N5', { challenge: f.deps({ db: brokenDb }) })
  } finally {
    console.error = orig
  }
  assert.equal(out.r, HISTORY)
  assert.deepEqual(out.history, [`${U}:N5`])
  assert.deepEqual(logs, [['[today] 챌린지 추천 계산 실패:', 'FakeQueryError']])
  assertNoAi(f)
})
