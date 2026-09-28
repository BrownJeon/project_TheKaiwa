import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { planSeedChunks, planSeedTopics, seedTopics, summarizeSeedTopicsPlan, type ExistingTopic, type SeedTopicInput } from '../../../../prisma/seed-topics'

const seeds = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/topics.json'), 'utf8')) as SeedTopicInput[]

/** 예전 시드(지우고 새로 만들기)가 만든 DB 모양 — 조각 order = 배열 순서. */
function asCreatedByOldSeed(list: readonly SeedTopicInput[]): ExistingTopic[] {
  return list.map((t, ti) => ({
    id: `topic${ti}`,
    title: t.title,
    titleJa: t.titleJa,
    level: t.level,
    description: t.description,
    tags: t.tags,
    chunks: t.chunks.map((c, i) => ({ id: `t${ti}c${i}`, chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo, order: i })),
  }))
}

test('시드 = DB 이면 쓰기 0(모든 주제·조각 keep, id 그대로)', () => {
  const plan = planSeedTopics(seeds, asCreatedByOldSeed(seeds))
  const s = summarizeSeedTopicsPlan(plan)
  assert.equal(s.writes, 0)
  assert.equal(s.orphanChunks + s.orphanTopics, 0)
  assert.equal(s.topics.keep, seeds.length)
  assert.equal(s.chunks.keep, seeds.reduce((n, t) => n + t.chunks.length, 0))
  assert.ok(plan.topics.every((t, ti) => t.id === `topic${ti}` && t.chunks.every((c, i) => c.id === `t${ti}c${i}`)))
})

test('조각: 기존 행은 표기로 제자리(순서만 바뀌면 order 만 update), 표기 수정은 같은 순서 행을 update, 새 조각은 create — id 불변', () => {
  const existing = [
    { id: 'a', chunkType: 'NAME', textJa: '駅', reading: 'えき', meaningKo: '역', order: 0 },
    { id: 'b', chunkType: 'NAME', textJa: '切符', reading: 'きっぷ', meaningKo: '표', order: 1 },
    { id: 'c', chunkType: 'ACTION', textJa: '行きます', reading: 'いきます', meaningKo: '가요', order: 2 },
  ]
  const r = planSeedChunks(
    [
      { chunkType: 'NAME', textJa: '切符', reading: 'きっぷ', meaningKo: '표' },
      { chunkType: 'NAME', textJa: '駅', reading: 'えき', meaningKo: '역(정거장)' },
      { chunkType: 'ACTION', textJa: '行きましょう', reading: 'いきましょう', meaningKo: '갑시다' },
      { chunkType: 'NAME', textJa: '地図', reading: 'ちず', meaningKo: '지도' },
    ],
    existing,
  )
  assert.deepEqual(r.chunks.map((c) => [c.action, c.id, c.matchedBy]), [
    ['update', 'b', 'textJa'],
    ['update', 'a', 'textJa'],
    ['update', 'c', 'order'],
    ['create', null, null],
  ])
  assert.deepEqual(r.chunks[0].changes, ['order'])
  assert.deepEqual(r.chunks[1].changes.sort(), ['meaningKo', 'order'])
  assert.deepEqual(r.chunks[2].changes.sort(), ['meaningKo', 'reading', 'textJa'])
  assert.equal(r.orphans.length, 0)
  // 표기도 순서도 안 맞으면(중간 삽입으로 밀린 뒤 표기까지 고친 조각) 보수적으로 새 행 + 옛 행은 orphan(지우지 않음).
  const shifted = planSeedChunks(
    [
      { chunkType: 'NAME', textJa: '地図', reading: 'ちず', meaningKo: '지도' },
      { chunkType: 'NAME', textJa: '駅', reading: 'えき', meaningKo: '역' },
      { chunkType: 'NAME', textJa: '切符', reading: 'きっぷ', meaningKo: '표' },
      { chunkType: 'ACTION', textJa: '行きましょう', reading: 'いきましょう', meaningKo: '갑시다' },
    ],
    existing,
  )
  assert.deepEqual(shifted.chunks.map((c) => [c.action, c.id]), [['create', null], ['update', 'a'], ['update', 'b'], ['create', null]])
  assert.deepEqual(shifted.orphans.map((o) => o.id), ['c'])
})

test('조각: 시드에서 빠진 기존 조각은 지우지 않고 orphan 으로만(계획에 delete 없음)', () => {
  const existing = [
    { id: 'a', chunkType: 'NAME', textJa: '駅', reading: 'えき', meaningKo: '역', order: 0 },
    { id: 'b', chunkType: 'NAME', textJa: '切符', reading: 'きっぷ', meaningKo: '표', order: 1 },
    { id: 'z', chunkType: 'NAME', textJa: '古い', reading: 'ふるい', meaningKo: '낡다', order: 5 },
  ]
  const r = planSeedChunks([{ chunkType: 'NAME', textJa: '駅', reading: 'えき', meaningKo: '역' }, { chunkType: 'NAME', textJa: '切符', reading: 'きっぷ', meaningKo: '표' }], existing)
  assert.deepEqual(r.chunks.map((c) => c.action), ['keep', 'keep'])
  assert.deepEqual(r.orphans.map((o) => o.id), ['z'])
  assert.ok(r.chunks.every((c) => ['keep', 'update', 'create'].includes(c.action)))
})

test('주제: 제목 → 일본어 제목 순으로 매칭(제목만 고쳐도 같은 행 id), 새 주제 create, 빠진 시드 주제는 orphan', () => {
  const base = seeds.slice(0, 3)
  const existing = asCreatedByOldSeed(base)
  const renamed = base.map((t, i) => (i === 1 ? { ...t, title: `${t.title}(개정)` } : t))
  const added: SeedTopicInput = { key: 'new', title: '새 주제', titleJa: '新しい話題', level: 'N5', description: 'x', tags: [], chunks: [{ chunkType: 'NAME', textJa: '猫', reading: 'ねこ', meaningKo: '고양이' }] }
  const plan = planSeedTopics([renamed[0], renamed[1], added], existing)
  assert.deepEqual(plan.topics.map((t) => [t.action, t.id, t.matchedBy]), [
    ['keep', 'topic0', 'title'],
    ['update', 'topic1', 'titleJa'],
    ['create', null, null],
  ])
  assert.deepEqual(plan.topics[1].changes, ['title'])
  assert.ok(plan.topics[1].chunks.every((c, i) => c.action === 'keep' && c.id === `t1c${i}`), '주제 제목이 바뀌어도 조각 id 그대로')
  assert.deepEqual(plan.topics[2].chunks.map((c) => c.action), ['create'])
  assert.deepEqual(plan.orphanTopics, [{ id: 'topic2', title: base[2].title }])
  const s = summarizeSeedTopicsPlan(plan)
  assert.deepEqual([s.writes, s.orphanTopics], [3, 1], '주제 update 1 + 주제 create 1 + 조각 create 1')
})

test('seedTopics 드라이런: 읽기만 하고 쓰기 메서드를 한 번도 부르지 않는다', async () => {
  const writes: string[] = []
  const deny = (name: string) => async () => {
    writes.push(name)
    throw new Error(`쓰기 금지: ${name}`)
  }
  const existing = asCreatedByOldSeed(seeds)
  existing[0].chunks[0] = { ...existing[0].chunks[0], meaningKo: '바뀐 뜻' }
  const fake = {
    conversationTopic: { findMany: async () => existing, create: deny('topic.create'), update: deny('topic.update') },
    topicChunk: { create: deny('chunk.create'), update: deny('chunk.update'), deleteMany: deny('chunk.deleteMany'), createMany: deny('chunk.createMany') },
    $transaction: deny('$transaction'),
  } as unknown as PrismaClient
  const log = console.log
  console.log = () => undefined
  try {
    const s = await seedTopics(fake, seeds, { dryRun: true })
    assert.equal(s.writes, 1, '바뀐 뜻 1건만 계획')
    assert.deepEqual(writes, [])
  } finally {
    console.log = log
  }
})

test('seedTopics 적용: update·create 만 부르고 조각 삭제(deleteMany)·재생성(createMany)은 없다', async () => {
  const calls: string[] = []
  const existing = asCreatedByOldSeed(seeds.slice(0, 1))
  existing[0].chunks[2] = { ...existing[0].chunks[2], reading: 'まちがい' }
  existing[0].chunks.pop()
  const tx = {
    conversationTopic: { create: async () => (calls.push('topic.create'), { id: 'nt' }), update: async () => calls.push('topic.update') },
    topicChunk: { create: async () => calls.push('chunk.create'), update: async (a: { where: { id: string } }) => calls.push(`chunk.update:${a.where.id}`) },
  }
  const fake = {
    conversationTopic: { findMany: async () => existing },
    topicChunk: { deleteMany: async () => calls.push('chunk.deleteMany'), createMany: async () => calls.push('chunk.createMany') },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  } as unknown as PrismaClient
  const log = console.log
  console.log = () => undefined
  try {
    await seedTopics(fake, seeds.slice(0, 1), { dryRun: false })
  } finally {
    console.log = log
  }
  const last = seeds[0].chunks.length - 1
  assert.deepEqual(calls, ['chunk.update:t0c2', 'chunk.create'], `읽기 수정 1 + 빠졌던 마지막 조각(#${last}) create 1`)
})
