/**
 * task-045 감사 보완(REV-152a M-1 · REV-152b M1·L2) — 메모리 가짜만(공유 DB 0).
 * - #65 평가 점유(`claimEvaluationTx`): 잠금 직후 주제 재확인(진행 중 챌린지 예외 없음) · 저장 FK 위반(P2003 topicId) → 404 `TOPIC_GONE`.
 * - #171 조각 식별: 같은 id 라도 표현 글(정규화 키)이 바뀌면 삭제 + 새 id — 읽기·뜻·문장부호·순서만 바뀌면 id 유지 · 챌린지 진행률에서 빠짐.
 * - #171 남의 주제: 소유자 선검사에서 404 — 쓰기 시도 0.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, type Tx } from '@/modules/infra'
import type { TopicSaveChunk } from '@/types/topicWrite'
import { challengeTopicProgress } from '../challenges/topicProgress'
import type { ChallengeDeps } from '../challenges/store'
import { claimEvaluationTx } from '../evaluation/generate'
import type { EvaluationMaterials } from '../evaluation/materials'
import { CARD_REF_TOPIC_CHUNK } from '../topics/pool'
import { updateUserTopic } from '../topics/update'
import { fakeDb } from './challengeFakeDb'

type Row = Record<string, unknown>
const U = 'userA'
const O = 'userB'
const reasonOf = (e: unknown) => (e instanceof ApiError ? `${e.code}:${String(e.details?.reason ?? '')}` : `raw:${(e as Error)?.message}`)
const rejectsWith = async (p: Promise<unknown>, want: string) => {
  try {
    await p
  } catch (e) {
    assert.equal(reasonOf(e), want)
    return
  }
  assert.fail(`${want} 로 실패해야 한다`)
}
const fk = (field: string) => Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003', meta: { field_name: field } })

// ── #65 평가 점유 ────────────────────────────────────────────────────────────────────────────────

function evalWorld(createError: unknown = null) {
  const T = {
    conversationTopic: [
      { id: 'topSeed', userId: null },
      { id: 'topMine', userId: U },
      { id: 'topOther', userId: O },
    ] as Row[],
    userSeedOverride: [] as Row[],
    challenge: [] as Row[],
    evaluation: [] as Row[],
  }
  const log: string[] = []
  const eq = (r: Row, w: Row): boolean => Object.entries(w).every(([k, v]) => (k === 'OR' ? (v as Row[]).some((o) => eq(r, o)) : typeof v === 'object' && v !== null ? true : r[k] === v))
  const db = {
    conversationTopic: { findFirst: async ({ where }: { where: Row }) => (log.push('conversationTopic.findFirst'), T.conversationTopic.find((r) => eq(r, where)) ?? null) },
    userSeedOverride: { findFirst: async ({ where }: { where: Row }) => T.userSeedOverride.find((r) => r.userId === where.userId && r.kind === where.kind && r.seedId === where.seedId) ?? null },
    challenge: { findFirst: async ({ where }: { where: Row }) => T.challenge.find((r) => r.userId === where.userId && r.status === where.status && r.topicId === where.topicId) ?? null },
    evaluation: {
      findMany: async () => [],
      findFirst: async () => null,
      create: async ({ data }: { data: Row }) => {
        log.push('evaluation.create')
        if (createError) throw createError
        T.evaluation.push({ ...data, id: 'ev1' })
        return { id: 'ev1' }
      },
      update: async () => (log.push('evaluation.update'), {}),
      updateMany: async () => (log.push('evaluation.updateMany'), { count: 0 }),
    },
    aiJob: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
      create: async () => (log.push('aiJob.create'), { id: 'job1' }),
    },
  } as unknown as Tx
  return { T, db, log }
}
const evalMaterials = (topicId: string | null): EvaluationMaterials => ({ kind: 'WORDS', level: 'N5', topic: topicId ? { id: topicId, title: '주제' } : null, words: [] }) as unknown as EvaluationMaterials
const claimEval = (db: Tx, topicId: string | null) => claimEvaluationTx(db, U, evalMaterials(topicId), 'evalGen@t', {} as never, 'tr-1')

test('REV-152a M-1 #65 평가 점유 — 잠금 안 재확인: 가린 시드·지워진 주제·남의 주제 404 TOPIC_GONE(평가·잡 0) · 진행 중 챌린지가 있어도 예외 없음', async () => {
  const w = evalWorld()
  w.T.userSeedOverride.push({ userId: U, kind: 'TOPIC', seedId: 'topSeed', copyId: null })
  w.T.challenge.push({ userId: U, status: 'ACTIVE', topicId: 'topSeed', endDate: new Date('2099-12-31T00:00:00Z') })
  await rejectsWith(claimEval(w.db, 'topSeed'), 'NOT_FOUND:TOPIC_GONE')
  await rejectsWith(claimEval(w.db, 'topGone'), 'NOT_FOUND:TOPIC_GONE')
  await rejectsWith(claimEval(w.db, 'topOther'), 'NOT_FOUND:TOPIC_GONE')
  assert.deepEqual(w.log.filter((l) => l !== 'conversationTopic.findFirst'), [], '쓰기 0')
})

test('REV-152a M-1 #65 평가 점유 — 보이는 주제는 그대로 점유(topicId 저장·잡 생성) · 주제 없는 평가는 주제를 읽지 않는다', async () => {
  const w = evalWorld()
  const c = await claimEval(w.db, 'topMine')
  assert.deepEqual(c, { evaluationId: 'ev1', jobId: 'job1', traceId: 'tr-1' })
  assert.equal(w.T.evaluation[0].topicId, 'topMine')
  const w2 = evalWorld()
  await claimEval(w2.db, null)
  assert.ok(!w2.log.includes('conversationTopic.findFirst'))
  assert.equal(w2.T.evaluation[0].topicId, null)
})

test('REV-152a M-1 #65 평가 저장 FK 위반 — topicId FK 면 404 TOPIC_GONE, 다른 FK·다른 오류는 그대로', async () => {
  await rejectsWith(claimEval(evalWorld(fk('Evaluation_topicId_fkey (index)')).db, 'topMine'), 'NOT_FOUND:TOPIC_GONE')
  const other = fk('Evaluation_userId_fkey (index)')
  await assert.rejects(claimEval(evalWorld(other).db, 'topMine'), (e: unknown) => e === other)
})

// ── #171 조각 식별 ──────────────────────────────────────────────────────────────────────────────

const BASE: Array<[TopicSaveChunk['chunkType'], string, string, string]> = [
  ['NAME', '病院', 'びょういん', '병원'], ['NAME', '薬', 'くすり', '약'], ['NAME', '医者', 'いしゃ', '의사'], ['ACTION', '待ちます', 'まちます', '기다려요'],
  ['ACTION', '呼びます', 'よびます', '불러요'], ['FEELING', '痛いです', 'いたいです', '아파요'], ['FEELING', '寒いです', 'さむいです', '추워요'], ['MODIFIER', '少し', 'すこし', '조금'],
]

function topicWorld() {
  const f = fakeDb()
  const T = f.tables
  T.conversationTopic.push(
    { id: 'mine1', userId: U, isSeed: false, title: '병원', titleJa: null, level: 'N5', description: null, tags: null },
    { id: 'oth1', userId: O, isSeed: false, title: '남의 주제', titleJa: null, level: 'N5', description: null, tags: null },
  )
  for (const [i, [chunkType, textJa, reading, meaningKo]] of BASE.entries()) T.topicChunk.push({ id: `c${i}`, topicId: 'mine1', chunkType, textJa, reading, meaningKo, order: i, note: i === 0 ? '메모' : null })
  T.topicChunk.push({ id: 'o0', topicId: 'oth1', chunkType: 'NAME', textJa: '駅', reading: 'えき', meaningKo: '역', order: 0, note: null })
  const base = f.deps()
  const deps = { transaction: base.transaction!, lockUser: base.lockUser!, now: () => f.clock.now, lessonStats: async () => ({ lessonCount: 0, lastLessonAt: null, lastLessonTitle: null }) }
  const current = () => T.topicChunk.filter((c) => c.topicId === 'mine1').sort((a, b) => (a.order as number) - (b.order as number))
  const asSave = (r: Row): TopicSaveChunk => ({ id: r.id as string, chunkType: r.chunkType as TopicSaveChunk['chunkType'], textJa: r.textJa as string, reading: r.reading as string, meaningKo: r.meaningKo as string })
  return { f, T, deps, current, asSave }
}

test('REV-152b M1 #171 같은 id 라도 표현 글이 바뀌면 옛 행 삭제 + 새 id(메모 없음) · 읽기·뜻·문장부호·순서만 바뀌면 id 유지', async () => {
  const w = topicWorld()
  const old = w.current().map(w.asSave)
  const next: TopicSaveChunk[] = [
    { ...old[1] }, // 순서만(c1 → 0번)
    { ...old[0], textJa: '受付', reading: 'うけつけ', meaningKo: '접수' }, // 같은 id(c0)에 다른 표현 → 새 행
    { ...old[2], reading: 'おいしゃ' }, // 읽기만
    { ...old[3], meaningKo: '기다립니다' }, // 뜻만
    { ...old[4] },
    { ...old[5], textJa: '痛いです。' }, // 문장부호만 — 정규화 키가 같다
    { ...old[6], chunkType: 'ACTION' }, // 유형만
    { ...old[7] },
  ]
  const dto = await updateUserTopic(U, 'mine1', { chunks: next }, w.deps)
  const rows = w.current()
  assert.deepEqual(rows.map((r) => r.id).filter((id) => id !== rows[1].id), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'])
  assert.notEqual(rows[1].id, 'c0', '글이 바뀐 칸은 새 id')
  assert.ok(!w.T.topicChunk.some((c) => c.id === 'c0'), '옛 행은 지워짐')
  assert.deepEqual([rows[1].textJa, rows[1].reading, rows[1].note, rows[1].order], ['受付', 'うけつけ', null, 1])
  assert.deepEqual([rows[2].reading, rows[3].meaningKo, rows[5].textJa, rows[6].chunkType], ['おいしゃ', '기다립니다', '痛いです。', 'ACTION'])
  assert.deepEqual(dto.chunks.map((c) => c.id), rows.map((r) => r.id))
  assert.equal(w.T.topicChunk.filter((c) => c.topicId === 'oth1').length, 1)
})

test('REV-152b M1 진행 중 챌린지 주제 — 익힌 표현의 글을 같은 칸에서 바꾸면 그 익힘은 진행률에서 빠진다(분모는 그대로) · 읽기만 바꾸면 유지', async () => {
  const w = topicWorld()
  const progressDeps = { db: w.f.db, doneLessonCount: async () => 0 } as unknown as ChallengeDeps
  w.T.repetitionItem.push(
    { id: 'r0', userId: U, refType: CARD_REF_TOPIC_CHUNK, refId: 'c0', textJa: '病院', studiedCount: 3, correctCount: 3, wrongCount: 0 },
    { id: 'r2', userId: U, refType: CARD_REF_TOPIC_CHUNK, refId: 'c2', textJa: '医者', studiedCount: 3, correctCount: 3, wrongCount: 0 },
  )
  const before = await challengeTopicProgress(progressDeps, U, 'mine1')
  assert.deepEqual([before.chunkTotal, before.chunkStudied, before.chunkMastered], [8, 2, 2])
  const old = w.current().map(w.asSave)
  await updateUserTopic(U, 'mine1', { chunks: [{ ...old[0], textJa: '受付', reading: 'うけつけ' }, { ...old[1] }, { ...old[2], reading: 'おいしゃ' }, ...old.slice(3)] }, w.deps)
  const after = await challengeTopicProgress(progressDeps, U, 'mine1')
  assert.deepEqual([after.chunkTotal, after.chunkStudied, after.chunkMastered], [8, 1, 1], '「病院」을 익힌 기록이 「受付」로 넘어가지 않는다 · 읽기만 바꾼 「医者」는 유지')
})

test('REV-152b L2 #171 남의 주제 — 소유자 선검사에서 404 TOPIC_GONE · 쓰기 시도 0(주제·표현)', async () => {
  const w = topicWorld()
  w.f.log.length = 0
  await rejectsWith(updateUserTopic(U, 'oth1', { title: '바꿈', chunks: BASE.map(([chunkType, textJa, reading, meaningKo]) => ({ chunkType, textJa, reading, meaningKo })) }, w.deps), 'NOT_FOUND:TOPIC_GONE')
  assert.deepEqual(w.f.log.filter((l) => /\.(create|createMany|update|updateMany|delete|deleteMany)$/.test(l)), [])
  assert.equal(w.T.conversationTopic.find((t) => t.id === 'oth1')?.title, '남의 주제')
})
