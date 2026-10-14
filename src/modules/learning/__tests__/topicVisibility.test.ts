/**
 * task-045 T3-1b — 숨긴 시드 주제로 새로 시작하는 나머지 세 곳(REV-150 M1): #28 새 채팅(`getTopicRef`) · #47 주제 단어 세트(`loadTopicSetMaterial`) ·
 * #65 평가(`loadEvaluationMaterials`), 그리고 #59 수업 재료(`getTopicForLesson`). 진행 중 챌린지 예외는 #59·#47 에만 있다.
 * 메모리 가짜(세 표 + 평가 재료 두 표)만 쓴다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, type Tx } from '@/modules/infra'
import { loadEvaluationMaterials } from '../evaluation/materials'
import { getTopicForLesson, getTopicRef } from '../topics'
import { assertTopicVisible, isTopicVisibleTo } from '../topics/visible'
import { loadTopicSetMaterial } from '../vocab/topicSet'
import { matches } from './challengeFakeDb'

type Row = Record<string, unknown>
const U = 'userA'
const V = 'userB'

function mini() {
  const T = {
    conversationTopic: [
      { id: 'topSeed', userId: null, title: '카페', titleJa: null, level: 'N5', description: null },
      { id: 'topMine', userId: U, title: '내 주제', titleJa: null, level: 'N5', description: null },
      { id: 'topOther', userId: V, title: '남의 주제', titleJa: null, level: 'N5', description: null },
    ] as Row[],
    userSeedOverride: [] as Row[],
    challenge: [] as Row[],
  }
  const log: string[] = []
  const first = (name: keyof typeof T) => async ({ where }: { where: Row }) => {
    log.push(`${name}.findFirst`)
    const r = T[name].find((x) => matches(x, where))
    return r ? { ...r, chunks: [] } : null
  }
  const db = {
    conversationTopic: { findFirst: first('conversationTopic') },
    userSeedOverride: { findFirst: first('userSeedOverride') },
    challenge: { findFirst: first('challenge') },
    wordEntry: { findMany: async () => [] },
    userWordState: { findMany: async () => [] },
    evaluationItem: { findMany: async () => [] },
  } as unknown as Tx
  return { T, db, log }
}

const hide = (T: ReturnType<typeof mini>['T'], userId: string, copyId: string | null = null) => T.userSeedOverride.push({ userId, kind: 'TOPIC', seedId: 'topSeed', copyId })
// 진행 중 = ACTIVE 이고 종료일이 오늘 이후(REV-152a L-1 `isChallengeInProgress`) — 실제 시계를 쓰는 경로도 있어 종료일은 먼 미래로 둔다.
const liveChallenge = (T: ReturnType<typeof mini>['T'], status = 'ACTIVE') => T.challenge.push({ id: 'ch1', userId: U, status, topicId: 'topSeed', endDate: new Date('2099-12-31T00:00:00Z') })
const reasonOf = (e: unknown) => (e instanceof ApiError ? `${e.code}:${String(e.details?.reason ?? '')}` : `raw:${(e as Error)?.message}`)
const evalOf = (db: Tx, topicId: string) => loadEvaluationMaterials(U, { kind: 'WORDS', topicId, level: 'N5' }, new Date('2026-10-07T03:00:00Z'), db)
const evalReason = async (db: Tx, topicId: string) => evalOf(db, topicId).then(() => 'ok', reasonOf)

test('#28 getTopicRef — 가린 시드(숨김·내 버전) null · 진행 중 챌린지여도 null(예외 없음) · 남의 숨김 무영향 · 내 주제·남의 주제 그대로', async () => {
  const { T, db } = mini()
  assert.deepEqual(await getTopicRef(U, 'topSeed', db), { id: 'topSeed', title: '카페' })
  hide(T, V)
  assert.deepEqual(await getTopicRef(U, 'topSeed', db), { id: 'topSeed', title: '카페' }, '다른 사용자의 숨김은 영향 없음')
  hide(T, U)
  assert.equal(await getTopicRef(U, 'topSeed', db), null)
  liveChallenge(T)
  assert.equal(await getTopicRef(U, 'topSeed', db), null, '#28 에는 진행 중 챌린지 예외가 없다')
  T.userSeedOverride.splice(0, T.userSeedOverride.length, { userId: U, kind: 'TOPIC', seedId: 'topSeed', copyId: 'topMine' })
  assert.equal(await getTopicRef(U, 'topSeed', db), null, '내 버전으로 바꾼 시드도 새 채팅 불가(사본 id 로 시작)')
  assert.deepEqual(await getTopicRef(U, 'topMine', db), { id: 'topMine', title: '내 주제' })
  assert.equal(await getTopicRef(U, 'topOther', db), null)
  assert.equal(await getTopicRef(U, 'x'.repeat(41), db), null)
})

test('#59 getTopicForLesson — 가린 시드 null · 진행 중(ACTIVE) 챌린지 주제면 읽음 · 끝난 챌린지는 예외 아님 · 돌려주는 모양에 userId 없음', async () => {
  const { T, db, log } = mini()
  const seen = await getTopicForLesson(U, 'topSeed', db)
  assert.deepEqual(seen, { id: 'topSeed', title: '카페', titleJa: null, level: 'N5', chunks: [] })
  assert.ok(!log.includes('challenge.findFirst'), '가리지 않았으면 챌린지를 읽지 않는다')
  hide(T, U)
  assert.equal(await getTopicForLesson(U, 'topSeed', db), null)
  liveChallenge(T, 'ENDED')
  assert.equal(await getTopicForLesson(U, 'topSeed', db), null, '끝난 챌린지는 예외 아님')
  T.challenge.splice(0)
  liveChallenge(T)
  assert.equal((await getTopicForLesson(U, 'topSeed', db))?.id, 'topSeed', '진행 중 챌린지 주제는 계속(§0 #9)')
  assert.equal(await getTopicForLesson(U, 'topOther', db), null)
})

test('#47 loadTopicSetMaterial — 가린 시드는 A12 전에 404 TOPIC_GONE · 진행 중 챌린지 예외 · 없는 주제는 null(기존)', async () => {
  const { T, db } = mini()
  assert.equal((await loadTopicSetMaterial(db, U, 'topSeed'))?.topic.id, 'topSeed')
  hide(T, U)
  await assert.rejects(loadTopicSetMaterial(db, U, 'topSeed'), (e: unknown) => reasonOf(e) === 'NOT_FOUND:TOPIC_GONE')
  liveChallenge(T)
  assert.equal((await loadTopicSetMaterial(db, U, 'topSeed'))?.topic.id, 'topSeed')
  assert.equal(await loadTopicSetMaterial(db, U, 'topOther'), null)
  assert.equal(await loadTopicSetMaterial(db, U, 'topMine').then((m) => m?.topic.id), 'topMine')
})

test('#65 loadEvaluationMaterials — 가린 시드·진행 중 챌린지여도 404 TOPIC_GONE(예외 없음) · 보이는 주제는 주제 검사를 지나 단어 수 검사로', async () => {
  const { T, db } = mini()
  assert.equal(await evalReason(db, 'topSeed'), 'VALIDATION:NOT_ENOUGH_WORDS', '보이는 시드 = 주제 통과')
  assert.equal(await evalReason(db, 'topOther'), 'NOT_FOUND:TOPIC_GONE')
  hide(T, U)
  assert.equal(await evalReason(db, 'topSeed'), 'NOT_FOUND:TOPIC_GONE')
  liveChallenge(T)
  assert.equal(await evalReason(db, 'topSeed'), 'NOT_FOUND:TOPIC_GONE', '평가에는 챌린지 예외 없음')
  assert.equal(await evalReason(db, 'topMine'), 'VALIDATION:NOT_ENOUGH_WORDS')
})

test('isTopicVisibleTo · assertTopicVisible — 같은 판정(내 주제는 override 조회 0 · 가린 시드는 allowActiveChallenge 일 때만 챌린지 조회)', async () => {
  const { T, db, log } = mini()
  assert.equal(await isTopicVisibleTo(db, U, { id: 'topMine', userId: U }), true)
  assert.equal(log.length, 0, '내 주제는 조회 0')
  hide(T, U)
  liveChallenge(T)
  assert.equal(await isTopicVisibleTo(db, U, { id: 'topSeed', userId: null }), false)
  assert.ok(!log.includes('challenge.findFirst'), '예외를 켜지 않으면 챌린지를 읽지 않는다')
  assert.equal(await isTopicVisibleTo(db, U, { id: 'topSeed', userId: null }, { allowActiveChallenge: true }), true)
  await assert.rejects(assertTopicVisible(db, U, 'topSeed'), (e: unknown) => reasonOf(e) === 'NOT_FOUND:TOPIC_GONE')
  assert.deepEqual(await assertTopicVisible(db, U, 'topSeed', { allowActiveChallenge: true }), { id: 'topSeed', userId: null })
})
