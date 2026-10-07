/**
 * task-045 T2 — #57 `createUserTopic` · #171 `updateUserTopic` · #56 `level=all`. 메모리 가짜 DB(공유 DB 0).
 * 가짜 트랜잭션은 throw 시 표 전체를 되돌린다(실제 DB 롤백 흉내) — "던지는 위치가 트랜잭션 안인가"를 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Tx } from '@/modules/infra'
import type { TopicCreateInput, TopicSaveChunk } from '@/types/topicWrite'
import { createUserTopic, type TopicWriteDeps } from '../topics/create'
import { updateUserTopic } from '../topics/update'
import { listTopics, parseTopicQuery } from '../topics'
import { seedOverrideFakeDb, type SeedFakeTables } from './seedOverrideFakeDb'

const U = 'cuser_t2_00000000000000a'
const OTHER = 'cuser_t2_00000000000000b'
const NOW = new Date('2026-10-07T03:00:00.000Z') // 12:00 KST — KST 하루 시작 = 2026-10-06T15:00Z

type Row = Record<string, unknown>

function world() {
  const w = seedOverrideFakeDb(NOW)
  const base = w.deps()
  // 롤백 흉내: 잠금을 얻은 직후의 표를 기억했다가 그 트랜잭션이 던지면 되돌린다(같은 사용자 쓰기는 잠금으로 직렬화되므로 남의 커밋을 지우지 않는다).
  const snaps = new WeakMap<object, SeedFakeTables>()
  const transaction: TopicWriteDeps['transaction'] = async (fn) => {
    let txRef: object | null = null
    try {
      return await base.transaction!((tx) => ((txRef = tx), fn(tx)))
    } catch (e) {
      const snap = txRef ? snaps.get(txRef) : undefined
      if (snap) for (const k of Object.keys(snap) as (keyof SeedFakeTables)[]) w.tables[k] = snap[k]
      throw e
    }
  }
  const lockUser: TopicWriteDeps['lockUser'] = async (tx, userId) => {
    const r = await base.lockUser!(tx, userId)
    snaps.set(tx, structuredClone(w.tables))
    return r
  }
  const deps: Partial<TopicWriteDeps> = {
    transaction,
    lockUser,
    now: base.now,
    lessonStats: async () => ({ lessonCount: 2, lastLessonAt: '2026-10-01T00:00:00.000Z', lastLessonTitle: '病院で' }),
  }
  const topic = (o: Row) => w.tables.conversationTopic.push({ createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: NOW, tags: null, titleJa: null, description: null, level: 'N5', ...o })
  const chunk = (o: Row) => w.tables.topicChunk.push({ chunkType: 'NAME', reading: 'よみ', meaningKo: '뜻', note: null, createdAt: NOW, updatedAt: NOW, ...o })
  return { ...w, deps, topic, chunk }
}

const BASE: Array<[TopicSaveChunk['chunkType'], string, string, string]> = [
  ['NAME', '病院', 'びょういん', '병원'], ['NAME', '薬', 'くすり', '약'], ['NAME', '医者', 'いしゃ', '의사'],
  ['ACTION', '待ちます', 'まちます', '기다려요'], ['ACTION', '呼びます', 'よびます', '불러요'], ['ACTION', '休みます', 'やすみます', '쉬어요'],
  ['FEELING', '痛いです', 'いたいです', '아파요'], ['FEELING', '寒いです', 'さむいです', '추워요'], ['FEELING', '眠いです', 'ねむいです', '졸려요'],
  ['MODIFIER', '少し', 'すこし', '조금'], ['MODIFIER', '毎日', 'まいにち', '매일'], ['MODIFIER', '早く', 'はやく', '빨리'],
]
const chunks = (n = 12): TopicSaveChunk[] => BASE.slice(0, n).map(([chunkType, textJa, reading, meaningKo]) => ({ chunkType, textJa, reading, meaningKo }))
const input = (o: Partial<TopicCreateInput> = {}): TopicCreateInput => ({ title: '병원 진료', titleJa: '病院で診察', level: 'N5', description: '병원에서 증상을 말해요.', chunks: chunks(), ...o })

async function rejects(p: Promise<unknown>, code: string, reason?: string): Promise<Record<string, unknown>> {
  try {
    await p
  } catch (e) {
    const err = e as { code?: string; details?: Record<string, unknown> }
    assert.equal(err.code, code, `code ${err.code}`)
    if (reason) assert.equal(err.details?.reason, reason)
    return err.details ?? {}
  }
  assert.fail(`expected ${code}`)
}

const mineCount = (w: ReturnType<typeof world>, userId = U) => w.tables.conversationTopic.filter((r) => r.userId === userId).length

test('#57 저장: 잠금 뒤 한도 → 주제(userId=U·isSeed=false·tags 없음) + 표현(order = 배열 인덱스) · 응답 = #56 항목 모양(레슨 0)', async () => {
  const w = world()
  const dto = await createUserTopic(U, input(), w.deps)
  const row = w.tables.conversationTopic.find((r) => r.id === dto.id)!
  assert.equal(row.userId, U)
  assert.equal(row.isSeed, false)
  assert.equal(row.tags, undefined)
  assert.equal(row.level, 'N5')
  const saved = w.tables.topicChunk.filter((c) => c.topicId === dto.id)
  assert.deepEqual(saved.map((c) => [c.order, c.textJa, c.note]), BASE.map(([, t], i) => [i, t, null]))
  assert.deepEqual(dto.chunks.map((c) => c.textJa), BASE.map(([, t]) => t))
  assert.deepEqual({ isSeed: dto.isSeed, tags: dto.tags, lessonCount: dto.lessonCount, lastLessonAt: dto.lastLessonAt, lastLessonTitle: dto.lastLessonTitle }, { isSeed: false, tags: [], lessonCount: 0, lastLessonAt: null, lastLessonTitle: null })
  const i = w.log.indexOf('lockUser')
  assert.ok(i >= 0 && i < w.log.indexOf('conversationTopic.count') && i < w.log.indexOf('conversationTopic.create'), w.log.join(','))
})

test('#57 내 주제 30개 경계: 29개면 저장 · 30개면 409 TOPIC_LIMIT(쓰기 0) — 시드·남의 주제는 세지 않는다', async () => {
  const w = world()
  for (let i = 0; i < 29; i++) w.topic({ id: `t${i}`, userId: U, isSeed: false, title: `내 ${i}` })
  w.topic({ id: 'seed1', userId: null, isSeed: true, title: '시드' })
  w.topic({ id: 'oth1', userId: OTHER, isSeed: false, title: '남' })
  await createUserTopic(U, input(), w.deps)
  assert.equal(mineCount(w), 30)
  const chunkRows = w.tables.topicChunk.length
  const d = await rejects(createUserTopic(U, input(), w.deps), 'CONFLICT', 'TOPIC_LIMIT')
  assert.equal(d.limit, 30)
  assert.equal(mineCount(w), 30)
  assert.equal(w.tables.topicChunk.length, chunkRows)
})

test('#57 하루 10개(KST): 오늘 만든 내 주제(사본 포함) 9개면 저장 · 10개면 429 DAILY_LIMIT(retryAfterSec = KST 자정까지) · 어제(KST) 것은 세지 않는다', async () => {
  const w = world()
  for (let i = 0; i < 9; i++) w.topic({ id: `d${i}`, userId: U, isSeed: false, title: `오늘 ${i}`, createdAt: new Date('2026-10-06T15:00:00.000Z') })
  w.topic({ id: 'y1', userId: U, isSeed: false, title: '어제', createdAt: new Date('2026-10-06T14:59:59.000Z') })
  await createUserTopic(U, input(), w.deps)
  const d = await rejects(createUserTopic(U, input(), w.deps), 'RATE_LIMITED', 'DAILY_LIMIT')
  assert.equal(d.limit, 10)
  assert.equal(d.retryAfterSec, 12 * 3600)
  assert.equal(mineCount(w), 11)
})

test('#57 백스톱(서비스 단독 호출): 표현 7·21개 · 읽기 빈 글 · 제목 21자 · 수준 밖 → 400(쓰기 0, 잠금 전)', async () => {
  const w = world()
  const many = [...chunks(), ...chunks().map((c, i) => ({ ...c, textJa: `${c.textJa}${i}` }))]
  for (const bad of [input({ chunks: chunks(7) }), input({ chunks: many.slice(0, 21) }), input({ chunks: chunks().map((c, i) => (i === 3 ? { ...c, reading: '  ' } : c)) }), input({ title: '가'.repeat(21) }), input({ level: 'N0' as never })]) {
    await rejects(createUserTopic(U, bad, w.deps), 'VALIDATION')
  }
  assert.equal(w.tables.conversationTopic.length, 0)
  assert.equal(w.log.includes('lockUser'), false)
  await createUserTopic(U, input({ chunks: chunks(8) }), w.deps)
  await createUserTopic(U, input({ chunks: many.slice(0, 20) }), w.deps)
})

test('#57 동시 저장 2건(29개에서): 잠금으로 직렬화 — 하나만 저장, 하나는 409', async () => {
  const w = world()
  for (let i = 0; i < 29; i++) w.topic({ id: `t${i}`, userId: U, isSeed: false, title: `내 ${i}` })
  const r = await Promise.allSettled([createUserTopic(U, input(), w.deps), createUserTopic(U, input(), w.deps)])
  assert.deepEqual(r.map((x) => x.status).sort(), ['fulfilled', 'rejected'])
  assert.equal(mineCount(w), 30)
})

function seeded() {
  const w = world()
  w.topic({ id: 'mine1', userId: U, isSeed: false, title: '내 주제', level: 'N4', tags: ['a', 3] })
  for (const [i, [chunkType, textJa, reading, meaningKo]] of BASE.slice(0, 10).entries()) w.chunk({ id: `c${i}`, topicId: 'mine1', chunkType, textJa, reading, meaningKo, order: i, note: i === 0 ? '메모' : null })
  w.topic({ id: 'seed1', userId: null, isSeed: true, title: '시드' })
  w.chunk({ id: 's0', topicId: 'seed1', textJa: '駅', reading: 'えき', meaningKo: '역', order: 0 })
  w.topic({ id: 'oth1', userId: OTHER, isSeed: false, title: '남의 주제' })
  w.chunk({ id: 'o0', topicId: 'oth1', textJa: '駅', reading: 'えき', meaningKo: '역', order: 0 })
  return w
}
const current = (w: ReturnType<typeof world>, topicId = 'mine1') => w.tables.topicChunk.filter((c) => c.topicId === topicId).sort((a, b) => (a.order as number) - (b.order as number))
const asSave = (r: Row): TopicSaveChunk => ({ id: r.id as string, chunkType: r.chunkType as TopicSaveChunk['chunkType'], textJa: r.textJa as string, reading: r.reading as string, meaningKo: r.meaningKo as string })

test('#171 조각 diff: id 있는 표현은 행 id 유지(바뀐 것만 갱신·note 보존) · 새 표현 생성 · 빠진 기존 표현 삭제 · order = 새 배열 순서', async () => {
  const w = seeded()
  const old = current(w).map(asSave)
  const next: TopicSaveChunk[] = [
    { ...old[2] }, // 순서만 바뀜
    { ...old[0], meaningKo: '병원, 의원' }, // 내용 바뀜(note 는 그대로)
    ...old.slice(3, 9), // c3..c8 그대로(순서 1칸씩 앞당김 → order 바뀜)
    { chunkType: 'MODIFIER', textJa: '早く', reading: 'はやく', meaningKo: '빨리' }, // 새 표현
  ] // c1·c9 빠짐
  const before = w.log.length
  const dto = await updateUserTopic(U, 'mine1', { chunks: next }, w.deps)
  const rows = current(w)
  assert.deepEqual(rows.map((r) => r.id).slice(0, 8), ['c2', 'c0', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'])
  assert.equal(rows.length, 9)
  assert.equal(rows[8].textJa, '早く')
  assert.ok(!['c1', 'c9'].some((id) => w.tables.topicChunk.some((c) => c.id === id)))
  assert.deepEqual(rows.map((r) => r.order), [0, 1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(rows[1].meaningKo, '병원, 의원')
  assert.equal(rows[1].note, '메모')
  assert.deepEqual(dto.chunks.map((c) => c.id).slice(0, 2), ['c2', 'c0'])
  assert.deepEqual({ lessonCount: dto.lessonCount, lastLessonTitle: dto.lastLessonTitle, tags: dto.tags, level: dto.level, isSeed: dto.isSeed }, { lessonCount: 2, lastLessonTitle: '病院で', tags: ['a'], level: 'N4', isSeed: false })
  const ops = w.log.slice(before)
  assert.equal(ops.filter((o) => o === 'topicChunk.updateMany').length, 8, '바뀐 표현만 갱신(c2·c0·c3~c8 — 9번째는 새 표현)')
  assert.equal(ops.filter((o) => o === 'topicChunk.createMany').length, 1)
  assert.equal(w.tables.topicChunk.filter((c) => c.topicId !== 'mine1').length, 2, '다른 주제의 표현은 그대로')
})

test('#171 바뀐 것이 없으면 표현 갱신 0 · 칸만 보내면 표현은 손대지 않는다 · 시드·남의 주제 표현 무변경', async () => {
  const w = seeded()
  const before = w.log.length
  await updateUserTopic(U, 'mine1', { chunks: current(w).map(asSave) }, w.deps)
  assert.equal(w.log.slice(before).filter((o) => o.startsWith('topicChunk.') && o !== 'topicChunk.findMany').length, 0)
  const dto = await updateUserTopic(U, 'mine1', { title: '새 이름', description: null }, w.deps)
  const t = w.tables.conversationTopic.find((r) => r.id === 'mine1')!
  assert.deepEqual([t.title, t.description, t.titleJa], ['새 이름', null, null])
  assert.equal(dto.chunks.length, 10)
  assert.deepEqual(current(w).map((r) => r.id), ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'])
})

test('#171 거절: 시드 409 USE_FORK · 남의·없는·형식 틀린 id 404 TOPIC_GONE(같은 문구) · 빈 본문 400 — 쓰기 0', async () => {
  const w = seeded()
  const snap = structuredClone(w.tables)
  await rejects(updateUserTopic(U, 'seed1', { title: '바꿈' }, w.deps), 'CONFLICT', 'USE_FORK')
  const msgs = new Set<string>()
  for (const id of ['oth1', 'nope_000000000000000000', 'bad id!', '']) {
    try {
      await updateUserTopic(U, id, { title: '바꿈' }, w.deps)
      assert.fail('should throw')
    } catch (e) {
      assert.equal((e as { details?: { reason?: string } }).details?.reason, 'TOPIC_GONE')
      msgs.add((e as Error).message)
    }
  }
  assert.equal(msgs.size, 1)
  await rejects(updateUserTopic(U, 'mine1', {}, w.deps), 'VALIDATION', 'empty')
  assert.deepEqual(w.tables, snap)
})

test('#171 남의·다른 주제의 표현 id · 같은 id 두 번 → 400 이고 같은 요청의 제목 변경·삭제도 되돌려진다(트랜잭션 안에서 던짐)', async () => {
  const w = seeded()
  const snap = structuredClone(w.tables)
  const mine = current(w).map(asSave)
  const foreign = [...mine.slice(0, 9), { ...mine[9], id: 'o0' }]
  const d1 = await rejects(updateUserTopic(U, 'mine1', { title: '바뀌면 안 됨', chunks: foreign }, w.deps), 'VALIDATION', 'not_found')
  assert.equal(d1.field, 'chunks[9].id')
  const d2 = await rejects(updateUserTopic(U, 'mine1', { title: '바뀌면 안 됨', chunks: [...mine.slice(0, 9), { ...mine[0] }] }, w.deps), 'VALIDATION', 'duplicate')
  assert.equal(d2.field, 'chunks[9].id')
  assert.deepEqual(w.tables, snap)
})

test('#171 동시 고치기 2건: 잠금으로 직렬화 — 두 번째는 첫 번째 결과 위에 diff(표현 수 = 마지막 요청 그대로, 중복 행 없음)', async () => {
  const w = seeded()
  const mine = current(w).map(asSave)
  const a = [...mine.slice(0, 8)]
  const b = [...mine, { chunkType: 'MODIFIER' as const, textJa: '早く', reading: 'はやく', meaningKo: '빨리' }]
  await Promise.allSettled([updateUserTopic(U, 'mine1', { chunks: a }, w.deps), updateUserTopic(U, 'mine1', { chunks: b }, w.deps)])
  // 두 번째(b)는 c8·c9 가 이미 지워진 뒤라 400 not_found 로 끝나거나(직렬화) 성공한다 — 어느 쪽이든 표가 섞이지 않는다.
  const rows = current(w)
  assert.ok(rows.length === 8 || rows.length === 11, `rows ${rows.length}`)
  assert.equal(new Set(rows.map((r) => r.textJa)).size, rows.length)
})

test('#56 level=all: 다섯 수준 전부 · 프로필을 읽지 않는다 · mine 과 조합 · 기존 level·창 동작 불변', async () => {
  assert.deepEqual(parseTopicQuery(new URLSearchParams('level=all')), { level: null, mine: false, allLevels: true })
  assert.deepEqual(parseTopicQuery(new URLSearchParams('level=all&mine=1')), { level: null, mine: true, allLevels: true })
  assert.deepEqual(parseTopicQuery(new URLSearchParams('level=N3')), { level: 'N3', mine: false })
  assert.deepEqual(parseTopicQuery(new URLSearchParams('')), { level: null, mine: false })
  for (const bad of ['level=ALL', 'level=N6', 'level=', 'lvl=all']) assert.throws(() => parseTopicQuery(new URLSearchParams(bad)), (e: { code?: string }) => e.code === 'VALIDATION', bad)
  const calls: Row[] = []
  const db = {
    userSeedOverride: { findMany: async () => [] },
    conversationTopic: { findMany: async (a: Row) => (calls.push(a), []) },
    lesson: { groupBy: async () => [], findMany: async () => [] },
  } as unknown as Tx
  const all = await listTopics(U, { level: null, mine: false, allLevels: true }, db)
  assert.deepEqual(all.level, ['N5', 'N4', 'N3', 'N2', 'N1'])
  assert.deepEqual((calls[0].where as Row).level, { in: ['N5', 'N4', 'N3', 'N2', 'N1'] })
  const mine = await listTopics(U, { level: null, mine: true, allLevels: true }, db)
  assert.deepEqual(mine.level, ['N5', 'N4', 'N3', 'N2', 'N1'])
  assert.equal((calls[1].where as Row).userId, U)
  const one = await listTopics(U, { level: 'N2', mine: false }, db)
  assert.deepEqual(one.level, ['N2'])
})
