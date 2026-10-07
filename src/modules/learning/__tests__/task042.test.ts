/**
 * task-042 주제 단어 세트(B2 = A12 새 단어 + B1 폴백) — DB·LLM 없이 가짜 db/tx·가짜 엔진으로.
 * 설계서 `docs/design/challenge.md` §4-3a~e·§5-2·§9-2, 이력서 완료 기준 2.
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import type { ChunkType } from '@prisma/client'
import { ApiError, type Tx } from '@/modules/infra'
import { lessonRepetitionItems, type StoredLessonContent } from '../lessons/content'
import { registerRepetitionItems, repetitionRefId } from '../repetition'
import {
  CARD_REF_AI_WORD, buildTopicPool, cardRepetitionKey, repetitionKeyOfCard, type TopicPoolChunkRow,
} from '../topics/pool'
import {
  createVocabSession, finishVocabSessionDetailed, parseCreateSessionBody, readVocabSessionTx, replayVocabSession, topicCountsOf, toCardDto,
} from '../vocab/sessions'
import {
  TOPIC_WORDS_DAILY_ATTEMPTS, composeTopicCards, isTopicWordsGenerating, recheckTopicWords, resetTopicWordsStateForTest, runTopicWords, todayTopicState,
  topicCardCounts, topicCardRepetitionInputs, topicWordsAttemptsUsed, topicWordsFailureReason,
  type TodayTopicCardRow, type TopicSetDeps, type TopicWordCandidate, type TopicWordsCallResult, type TopicWordsDriver, type TopicWordsOutput,
} from '../vocab/topicSet'
import { createRng } from '../vocab/setGenerator'

const U = 'user-1'
const OTHER = 'user-2'
const TOPIC = 'topic-cafe'
const NOW = new Date('2026-10-06T03:00:00.000Z') // KST 12:00
const TODAY = '2026-10-06'
const code = (c: string, reason?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (reason === undefined || e.details?.reason === reason)

// ── 픽스처 ─────────────────────────────────────────────────────────────────────

const BASE: [string, string, string, ChunkType][] = [
  ['コーヒー', 'こーひー', '커피', 'NAME'], ['紅茶', 'こうちゃ', '홍차', 'NAME'], ['ケーキ', 'けーき', '케이크', 'NAME'], ['ください', 'ください', '주세요', 'ACTION'],
  ['お願いします', 'おねがいします', '부탁합니다', 'ACTION'], ['いくらですか', 'いくらですか', '얼마예요', 'ACTION'], ['おいしい', 'おいしい', '맛있다', 'FEELING'], ['ホット', 'ほっと', '뜨거운 것', 'MODIFIER'],
  ['アイス', 'あいす', '차가운 것', 'MODIFIER'], ['ひとつ', 'ひとつ', '하나', 'MODIFIER'], ['ふたつ', 'ふたつ', '둘', 'MODIFIER'], ['ここで', 'ここで', '여기서', 'MODIFIER'],
]
const CHUNKS: TopicPoolChunkRow[] = BASE.map(([textJa, reading, meaningKo, chunkType], i) => ({ id: `c${String(i).padStart(2, '0')}`, textJa, reading, meaningKo, chunkType }))

const AI: [string, string, string, ChunkType][] = [
  ['砂糖', 'さとう', '설탕', 'NAME'], ['牛乳', 'ぎゅうにゅう', '우유', 'NAME'], ['氷', 'こおり', '얼음', 'NAME'], ['持ち帰り', 'もちかえり', '포장', 'NAME'],
  ['店内', 'てんない', '매장 안', 'MODIFIER'], ['注文します', 'ちゅうもんします', '주문합니다', 'ACTION'], ['お会計', 'おかいけい', '계산', 'NAME'], ['甘い', 'あまい', '달다', 'FEELING'],
  ['苦い', 'にがい', '쓰다', 'FEELING'], ['少し', 'すこし', '조금', 'MODIFIER'], ['すぐ', 'すぐ', '곧', 'MODIFIER'], ['待ちます', 'まちます', '기다립니다', 'ACTION'],
  ['温かいです', 'あたたかいです', '따뜻해요', 'FEELING'], ['ストロー', 'すとろー', '빨대', 'NAME'], ['カップ', 'かっぷ', '컵', 'NAME'], ['大きい', 'おおきい', '크다', 'FEELING'],
]
const aiWords = (n: number, from = 0): TopicWordsOutput['words'] => AI.slice(from, from + n).map(([textJa, reading, meaningKo, chunkType]) => ({ textJa, reading, meaningKo, chunkType, jlpt: 'N5' as const, valid: true }))
const toCandidate = (w: TopicWordsOutput['words'][number]): TopicWordCandidate => ({ textJa: w.textJa, reading: w.reading, meaningKo: w.meaningKo, chunkType: w.chunkType, jlpt: w.jlpt === 'null' ? null : w.jlpt })
const candidates = (n: number, from = 0): TopicWordCandidate[] => aiWords(n, from).map(toCandidate)

function lessonContent(chunks: StoredLessonContent['chunks']): StoredLessonContent {
  return {
    v: 1, title: 'カフェで', titleKo: '카페에서', rolesKo: { A: '손님', B: '점원' }, dialogue: [], segmentCount: 0, chunks,
    grammar: [{ id: 'g1', pattern: '〜をください', explanationKo: '주세요', exampleJa: 'コーヒーをください', exampleReading: 'こーひーをください', exampleKo: '커피 주세요' }],
    quiz: [{ id: 'q1', promptKo: '?', promptJa: null, choices: ['a', 'b'], answer: 0, targetIds: ['new-1'], explanationKo: '' }],
    application: [], speaking: [], nextPreview: { titleKo: '', teaserKo: '' },
  }
}

/** ⓐ 주제 조각 id 그대로(표기만 조금 다름) ⓑ new-N ⓒ 다른 주제 조각 id. */
const LESSON_A = lessonContent([
  { id: 'c00', textJa: 'コーヒーを', reading: 'こーひーを', meaningKo: '커피를', chunkType: 'NAME', isNew: false },
  { id: 'new-1', textJa: '温かいです', reading: 'あたたかいです', meaningKo: '따뜻해요', chunkType: 'FEELING', isNew: true },
  { id: 'zz-other-topic', textJa: 'メニュー', reading: 'めにゅー', meaningKo: '메뉴', chunkType: 'NAME', isNew: true },
])

// ── 가짜 DB(이 파일의 쿼리 모양만 해석) ─────────────────────────────────────────────

type Row = Record<string, unknown>
const sameDate = (a: unknown, b: unknown) => a instanceof Date && b instanceof Date && a.getTime() === b.getTime()

class FakeDb {
  topics: Row[] = [
    { id: TOPIC, userId: null, title: '카페 주문', titleJa: 'カフェで注文', description: '카페에서 주문하기', level: 'N5' },
    { id: 'topic-mine-other', userId: OTHER, title: '남의 주제', titleJa: null, description: null, level: 'N5' },
  ]
  chunks: Row[] = CHUNKS.map((c, i) => ({ ...c, topicId: TOPIC, order: i }))
  lessons: Row[] = []
  sessions: Row[] = []
  attempts: Row[] = []
  words: Row[] = [{ id: 'w1', userId: U, archived: false, meaning: '사과' }, { id: 'w2', userId: U, archived: false, meaning: '책' }]
  rep: Row[] = []
  snapshots: Row[] = []
  logs: Row[] = []
  /** task-045 T3 — 잠금 안 주제 재확인(가린 시드 override · 진행 중 챌린지 예외)과 FK 위반 주입. */
  overrides: Row[] = []
  challenges: Row[] = []
  sessionCreateError: unknown = null
  wordCreates = 0
  sessionCreates = 0
  private seq = 0
  clock = NOW.getTime()
  id(p: string) {
    return `${p}${++this.seq}`
  }

  sessionView(s: Row) {
    const t = this.topics.find((x) => x.id === s.topicId)
    return { ...s, topic: s.topicId && t ? { title: t.title } : null }
  }

  matchAttempt(a: Row, where: Row): boolean {
    if (where.sessionId !== undefined) {
      const w = where.sessionId as unknown
      if (typeof w === 'string' ? a.sessionId !== w : !(w as { in: string[] }).in.includes(a.sessionId as string)) return false
    }
    if (where.refType !== undefined) {
      const w = where.refType as unknown
      if (typeof w === 'string' ? a.refType !== w : !(w as { in: string[] }).in.includes(a.refType as string)) return false
    }
    if (where.answer !== undefined && a.answer !== where.answer) return false
    if (where.flagged !== undefined && a.flagged !== where.flagged) return false
    if (where.wordId !== undefined) return false
    const sw = where.session as Row | undefined
    if (sw) {
      const s = this.sessions.find((x) => x.id === a.sessionId)
      if (!s) return false
      for (const [k, v] of Object.entries(sw)) {
        if (k === 'date' ? !sameDate(s.date, v) : s[k] !== v) return false
      }
    }
    return true
  }

  tx(): Tx {
    return fakeTx(this)
  }

  /** 세트의 카드에 답을 적고 끝낸 것처럼(카운터는 무시). */
  answer(sessionId: string, picks: Record<number, 'CORRECT' | 'WRONG' | 'SKIPPED'>, status: 'DONE' | 'ABANDONED' | 'IN_PROGRESS' = 'DONE') {
    for (const a of this.attempts) if (a.sessionId === sessionId && picks[a.order as number]) {
      a.answer = picks[a.order as number]
      a.answeredAt = NOW
    }
    ;(this.sessions.find((s) => s.id === sessionId) as Row).status = status
  }
}

function fakeTx(db: FakeDb): Tx {
  const sessionOf = (a: Row) => db.sessions.find((s) => s.id === a.sessionId) as Row
  return {
    $queryRaw: async () => [{ id: 'locked' }],
    $executeRaw: async () => 1,
    conversationTopic: {
      findFirst: async ({ where }: { where: Row }) => {
        const owner = ((where.OR as Row[])[1] as Row).userId
        const t = db.topics.find((x) => x.id === where.id && (x.userId === null || x.userId === owner))
        if (!t) return null
        return { ...t, chunks: db.chunks.filter((c) => c.topicId === t.id).map((c) => ({ textJa: c.textJa, meaningKo: c.meaningKo })) }
      },
    },
    topicChunk: { findMany: async ({ where }: { where: Row }) => db.chunks.filter((c) => c.topicId === where.topicId) },
    lesson: {
      findMany: async ({ where }: { where: Row }) =>
        db.lessons.filter((l) => l.userId === where.userId && l.topicId === where.topicId && l.kind === where.kind && l.status === where.status).map((l) => ({ id: l.id, content: l.content })),
    },
    vocabSession: {
      findFirst: async ({ where, select }: { where: Row; select?: Row }) => {
        const s = db.sessions.filter((x) => Object.entries(where).every(([k, v]) => x[k] === v)).at(-1)
        if (!s) return null
        const view = db.sessionView(s) as Row
        if (select?.attempts) view.attempts = db.attempts.filter((a) => a.sessionId === s.id).sort((a, b) => (a.order as number) - (b.order as number))
        return view
      },
      findUniqueOrThrow: async ({ where }: { where: Row }) => db.sessionView(db.sessions.find((x) => x.id === where.id) as Row),
      create: async ({ data }: { data: Row }) => {
        if (db.sessionCreateError) throw db.sessionCreateError
        db.sessionCreates++
        const s = { id: db.id('vs'), correctCount: 0, wrongCount: 0, skippedCount: 0, status: 'IN_PROGRESS', keptAt: null, replayOfId: null, finishedAt: null, durationSec: null, topicId: null, startedAt: new Date(db.clock++), ...data }
        db.sessions.push(s)
        return db.sessionView(s)
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const s = db.sessions.find((x) => x.id === where.id) as Row
        Object.assign(s, data)
        return db.sessionView(s)
      },
    },
    vocabAttempt: {
      findFirst: async ({ where }: { where: Row }) => db.attempts.find((a) => db.matchAttempt(a, where)) ?? null,
      findMany: async ({ where }: { where: Row }) =>
        db.attempts.filter((a) => db.matchAttempt(a, where)).map((a) => ({ ...a, word: null, session: { status: sessionOf(a).status, replayOfId: sessionOf(a).replayOfId, date: sessionOf(a).date } })),
      createMany: async ({ data }: { data: Row[] }) => {
        for (const d of data) db.attempts.push({ id: db.id('va'), answer: null, chosenText: null, responseMs: null, flagged: false, answeredAt: null, refType: null, refId: null, ...d })
        return { count: data.length }
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        let n = 0
        for (const a of db.attempts) if (a.sessionId === where.sessionId && (where.answer !== null || a.answer === null)) {
          Object.assign(a, data)
          n++
        }
        return { count: n }
      },
      count: async ({ where }: { where: Row }) => db.attempts.filter((a) => db.matchAttempt(a, where)).length,
      groupBy: async ({ where }: { where: Row }) => {
        const m = new Map<string, number>()
        for (const a of db.attempts.filter((x) => db.matchAttempt(x, where))) m.set(`${a.sessionId}|${a.refType}`, (m.get(`${a.sessionId}|${a.refType}`) ?? 0) + 1)
        return [...m].map(([k, n]) => ({ sessionId: k.split('|')[0], refType: k.split('|')[1], _count: { _all: n } }))
      },
    },
    repetitionItem: {
      findMany: async ({ where }: { where: Row }) =>
        db.rep.filter((r) => r.userId === where.userId && (where.OR as Row[]).some((o) => o.refType === r.refType && (typeof o.refId === 'string' ? o.refId === r.refId : (o.refId as { in: string[] }).in.includes(r.refId as string)))),
      create: async ({ data }: { data: Row }) => {
        const row = { id: db.id('ri'), ...data }
        db.rep.push(row)
        return { id: row.id }
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const r = db.rep.find((x) => x.id === where.id) as Row
        for (const [k, v] of Object.entries(data)) r[k] = v && typeof v === 'object' && 'increment' in v ? (r[k] as number) + (v as { increment: number }).increment : v
        return {}
      },
    },
    wordEntry: {
      findMany: async ({ where }: { where: Row }) => db.words.filter((w) => w.userId === where.userId && w.archived === false),
      updateMany: async () => ({ count: 0 }),
      create: async () => {
        db.wordCreates++
        return {}
      },
    },
    studyLog: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: db.id('sl'), ...data }
        db.logs.push(row)
        return { id: row.id }
      },
      findFirst: async ({ where }: { where: Row }) => db.logs.find((l) => l.refId === where.refId) ?? null,
    },
    statsSnapshot: {
      create: async ({ data }: { data: Row }) => {
        db.snapshots.push(data)
        return {}
      },
      findUnique: async () => ({ data: {} }),
      update: async () => ({}),
    },
    learningObservation: { createMany: async ({ data }: { data: Row[] }) => ({ count: data.length }) },
    userSeedOverride: { findFirst: async ({ where }: { where: Row }) => db.overrides.find((o) => o.userId === where.userId && o.kind === where.kind && o.seedId === where.seedId) ?? null },
    challenge: { findFirst: async ({ where }: { where: Row }) => db.challenges.find((c) => c.userId === where.userId && c.status === where.status && c.topicId === where.topicId) ?? null },
  } as unknown as Tx
}

interface Harness {
  db: FakeDb
  deps: Partial<TopicSetDeps>
  calls: { req: Parameters<TopicSetDeps['complete']>[0] }[]
  traces: Parameters<TopicSetDeps['trace']>[0][]
}

function harness(complete?: TopicSetDeps['complete'], over: Partial<TopicSetDeps> = {}): Harness {
  const db = new FakeDb()
  const calls: Harness['calls'] = []
  const traces: Harness['traces'] = []
  const tx = db.tx()
  const deps: Partial<TopicSetDeps> = {
    db: tx,
    transaction: (fn) => fn(tx),
    complete: async (req) => {
      calls.push({ req })
      return complete ? complete(req) : { data: { words: aiWords(13) }, connectionKey: 'conn', model: 'm', attempts: 1, promptChars: 900 }
    },
    trace: (t) => void traces.push(t),
    now: () => NOW.getTime(),
    wallMs: 30_000,
    ...over,
  }
  return { db, deps, calls, traces }
}

const passDriver: TopicWordsDriver = {
  promptVersion: 'topicWords@test',
  build: (input) => ({ task: 'topicWords', system: '[모드] TOPIC_WORDS', messages: [{ role: 'user', content: `[주제] ${input.topic.title}` }], jsonSchema: { type: 'object' } }),
  assemble: (raw) => {
    const list = (raw as TopicWordsOutput).words
    return { words: list.filter((w) => w.valid).map(toCandidate), received: list.length }
  },
}

const create = (h: Harness, body: Record<string, unknown>, opts: { signal?: AbortSignal; driver?: TopicWordsDriver | null; userId?: string } = {}) => {
  const input = parseCreateSessionBody({ topicId: TOPIC, mode: 'CHOICE', ...body })
  return createVocabSession(opts.userId ?? U, { count: input.count ?? 10, mode: input.mode, category: input.category, topicId: input.topicId, generate: input.generate }, {
    topicWords: opts.driver === null ? undefined : (opts.driver ?? passDriver), signal: opts.signal, deps: h.deps,
  })
}

type Created = Exclude<Awaited<ReturnType<typeof createVocabSession>>, { session: null }>
const created = (r: Awaited<ReturnType<typeof createVocabSession>>): Created => {
  assert.ok(r.session, `세트가 만들어져야 한다: ${JSON.stringify(r)}`)
  return r as Created
}

beforeEach(() => resetTopicWordsStateForTest())

// ── 1. 풀·키 동일성(K1) ──────────────────────────────────────────────────────────

test('pool 키 동일성 ⓐⓑⓒ: 수업 완료와 같은 입력(그 주제 조각 id 집합) — ⓐ TopicChunk(기본 표현 쪽) · ⓑⓒ Expr', () => {
  const pool = buildTopicPool(CHUNKS, [{ id: 'L1', content: LESSON_A as never }])
  assert.deepEqual([...pool.topicChunkIds].sort(), CHUNKS.map((c) => c.id).sort(), 'topicChunkIds = 그 주제 조각 id 전부(lifecycle 과 같은 입력)')
  const lessonEntries = pool.entries.filter((e) => e.origin === 'LESSON')
  assert.deepEqual(lessonEntries.map((e) => [e.refType, e.textJa]), [['Expr', '温かいです'], ['Expr', 'メニュー']], 'ⓐ 는 수업 표현으로 들어오지 않는다')
  assert.equal(pool.chunkTotal, 12)
  assert.equal(pool.lessonExprCount, 2)
  // 수업 완료가 등록하는 키와 한 글자도 다르지 않다.
  const completion = lessonRepetitionItems(LESSON_A, { topicChunkIds: new Set(CHUNKS.map((c) => c.id)), outcomes: [] })
  assert.deepEqual(completion.filter((i) => i.contentId === 'c00').map((i) => [i.refType, i.refId]), [['TopicChunk', 'c00']])
  for (const e of lessonEntries) assert.ok(completion.some((i) => i.refType === e.refType && i.refId === e.refId), `${e.textJa} 키 일치`)
  // 입력 누락 검출: 조각 id 집합이 비면 ⓐ 가 Expr 로 바뀐다 → 위 단언이 깨진다.
  const missing = lessonRepetitionItems(LESSON_A, { topicChunkIds: new Set(), outcomes: [] })
  assert.equal(missing.find((i) => i.contentId === 'c00')?.refType, 'Expr')
  const brokenPool = buildTopicPool([], [{ id: 'L1', content: LESSON_A as never }])
  assert.ok(brokenPool.entries.some((e) => e.textJa === 'コーヒーを' && e.refType === 'Expr'), '조각을 빠뜨리면 ⓐ 가 수업 표현으로 샌다(이 테스트가 잡는 회귀)')
})

test('pool: 정규화 표기 중복 제거(기본 표현이 이김) · 폭 필터(표기 >80·읽기 >120) · 깨진 수업 본문 무시', () => {
  const long = 'あ'.repeat(81)
  const content = lessonContent([
    { id: 'new-1', textJa: 'コーヒー。', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME', isNew: true },
    { id: 'new-2', textJa: long, reading: 'あ', meaningKo: '긴 것', chunkType: 'NAME', isNew: true },
    { id: 'new-3', textJa: '短い', reading: 'み'.repeat(121), meaningKo: '짧다', chunkType: 'FEELING', isNew: true },
  ])
  const pool = buildTopicPool(CHUNKS, [{ id: 'L1', content: content as never }, { id: 'L2', content: { broken: true } }, { id: 'L3', content: null }])
  assert.equal(pool.lessonExprCount, 0)
  assert.equal(pool.entries.length, 12)
  assert.equal(pool.lessonsRead, 3)
})

test('repetitionKeyOfCard: AiWord → Expr(같은 sha1), 나머지 그대로', () => {
  const ref = repetitionRefId('温かいです')
  assert.deepEqual(repetitionKeyOfCard(CARD_REF_AI_WORD, ref), { refType: 'Expr', refId: ref })
  assert.deepEqual(repetitionKeyOfCard('TopicChunk', 'c01'), { refType: 'TopicChunk', refId: 'c01' })
  assert.equal(cardRepetitionKey('AiWord', ref), cardRepetitionKey('Expr', ref))
})

test('키 동일성(통합): 수업 완료로 Expr 등록 뒤 같은 표기의 새 단어·수업 표현 카드를 끝내면 RepetitionItem 행 수 불변·카운터만 증가', async () => {
  const db = new FakeDb()
  const tx = db.tx()
  const completion = lessonRepetitionItems(LESSON_A, { topicChunkIds: new Set(CHUNKS.map((c) => c.id)), outcomes: ['CORRECT'] })
  await registerRepetitionItems(U, completion, tx, { today: TODAY, now: NOW })
  const before = db.rep.length
  const ref = repetitionRefId('温かいです')
  const cards = [
    { refType: 'AiWord', refId: ref, answer: 'CORRECT' as const, surfaceSnap: '温かいです', meaningSnap: '따뜻해요' },
    { refType: 'TopicChunk', refId: 'c00', answer: 'WRONG' as const, surfaceSnap: 'コーヒー', meaningSnap: '커피' },
    { refType: 'Expr', refId: repetitionRefId('メニュー'), answer: 'SKIPPED' as const, surfaceSnap: 'メニュー', meaningSnap: '메뉴' },
    { refType: null, refId: null, answer: 'CORRECT' as const, surfaceSnap: '단어', meaningSnap: '뜻' },
  ]
  const inputs = topicCardRepetitionInputs(cards)
  assert.deepEqual(inputs.map((i) => [i.itemType, i.refType, i.refId]), [['EXPRESSION', 'Expr', ref], ['CHUNK', 'TopicChunk', 'c00']], '건너뜀·단어장 카드는 빠짐')
  await registerRepetitionItems(U, inputs, tx, { today: TODAY, now: NOW })
  assert.equal(db.rep.length, before, '새 행 없음 — 수업이 만든 행에 쌓인다')
  const row = db.rep.find((r) => r.refType === 'Expr' && r.refId === ref) as Row
  assert.deepEqual([row.studiedCount, row.correctCount], [2, 2], '수업 퀴즈 1 + 세트 1')
})

// ── 2. 카드 구성(순수) ─────────────────────────────────────────────────────────

const pool12 = () => buildTopicPool(CHUNKS, [])
const rng = (s = 'Cseed') => createRng(s)

test('구성: 새 단어 13 → 앞에서 10장(AI)·시드 셔플 재현 / 7 → 7 + B1 3(MIXED) / 같은 키·표기·오늘 답한 키 제외', () => {
  const base = { reuse: false, todayAi: [], answered: new Set<string>(), pool: pool12(), stats: new Map(), now: NOW }
  const a = composeTopicCards({ ...base, count: 10, fresh: candidates(13), rng: rng() })
  assert.equal(a.aiCount, 10)
  assert.ok(a.cards.every((c) => c.refType === 'AiWord'))
  assert.deepEqual(a.cards.map((c) => c.surface).sort(), AI.slice(0, 10).map((w) => w[0]).sort(), '앞에서 10장')
  assert.deepEqual(composeTopicCards({ ...base, count: 10, fresh: candidates(13), rng: rng() }).cards, a.cards, '같은 시드 → 같은 순서')
  const b = composeTopicCards({ ...base, count: 10, fresh: candidates(7), rng: rng() })
  assert.equal(b.aiCount, 7)
  assert.equal(b.cards.length, 10)
  assert.equal(b.cards.filter((c) => c.refType === 'TopicChunk').length, 3)
  // 새 단어가 기본 표현과 표기가 같으면(정규화) 그 기본 표현은 채움에서 빠진다 · 오늘 답한 키의 새 단어는 버린다.
  const dup: TopicWordCandidate = { textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME', jlpt: null }
  const answered = new Set([cardRepetitionKey('Expr', repetitionRefId('砂糖'))])
  const c = composeTopicCards({ ...base, answered, count: 12, fresh: [dup, ...candidates(2)], rng: rng() })
  assert.equal(c.cards.filter((x) => x.surface === 'コーヒー').length, 1)
  assert.ok(!c.cards.some((x) => x.surface === '砂糖'), '오늘 답한 표현은 다시 내지 않는다')
})

test('구성: 재사용 — 오늘 새 단어 중 답한 것 제외·남은 것 먼저, 모자라면 B1 · 오늘 답한(맞힘·틀림) 키만 제외(건너뜀은 다시 나옴)', () => {
  const rows: TodayTopicCardRow[] = candidates(10).map((w, i) => ({
    refType: 'AiWord', refId: repetitionRefId(w.textJa), surfaceSnap: w.textJa, readingSnap: w.reading, meaningSnap: w.meaningKo,
    answer: i < 3 ? 'CORRECT' : i === 3 ? 'WRONG' : i === 4 ? 'SKIPPED' : null, session: { status: 'DONE', replayOfId: null },
  }))
  rows.push({ refType: 'TopicChunk', refId: 'c00', surfaceSnap: 'コーヒー', readingSnap: 'こーひー', meaningSnap: '커피', answer: 'CORRECT', session: { status: 'DONE', replayOfId: null } })
  // 다시 풀기 세트의 새 단어는 "오늘 만든 새 단어"가 아니다.
  rows.push({ refType: 'AiWord', refId: repetitionRefId('過去'), surfaceSnap: '過去', readingSnap: 'かこ', meaningSnap: '과거', answer: null, session: { status: 'DONE', replayOfId: 'old' } })
  const state = todayTopicState(rows)
  assert.equal(state.todayAi.length, 10)
  assert.equal(state.answered.size, 5)
  const r = composeTopicCards({ count: 10, fresh: null, reuse: true, todayAi: state.todayAi, answered: state.answered, pool: pool12(), stats: new Map(), rng: rng(), now: NOW })
  assert.equal(r.reusableLeft, 6)
  assert.equal(r.aiCount, 6)
  assert.equal(r.cards.length, 10)
  assert.ok(!r.cards.some((c) => c.refId === 'c00'), '오늘 답한 기본 표현 제외')
  assert.ok(r.cards.some((c) => c.surface === AI[4][0]), '건너뛴 새 단어는 다시 나온다')
})

test('구성: 풀까지 비면 0장(빈 상태는 호출자) · 카드 출처 수 · 정답 미노출 카드 DTO', () => {
  const all = new Set(CHUNKS.map((c) => cardRepetitionKey('TopicChunk', c.id)))
  const r = composeTopicCards({ count: 10, fresh: null, reuse: false, todayAi: [], answered: all, pool: pool12(), stats: new Map(), rng: rng(), now: NOW })
  assert.equal(r.cards.length, 0)
  assert.deepEqual(topicCardCounts([{ refType: 'Expr' }, { refType: 'AiWord' }, { refType: 'AiWord' }, { refType: 'TopicChunk' }, { refType: null }]), { lessonCardCount: 1, aiCardCount: 2 })
  const dto = toCardDto('CHOICE', 'IN_PROGRESS', { order: 0, wordId: null, surfaceSnap: '砂糖', readingSnap: 'さとう', meaningSnap: '설탕', choices: ['설탕', '우유', '얼음', '포장'], answer: null, chosenText: null, flagged: false, answeredAt: null, word: null })
  assert.equal('meaning' in dto || 'correctText' in dto || 'answer' in dto, false)
})

test('서버 재검사(⑥·칸 폭): 전체 제외 집합과 정규화 표기가 같으면·앞 항목과 같으면·표기 >80·읽기 >120·뜻 >200·이상한 종류 → 버림', () => {
  const w = (textJa: string, extra: Partial<TopicWordCandidate> = {}): TopicWordCandidate => ({ textJa, reading: 'よみ', meaningKo: '뜻', chunkType: 'NAME', jlpt: null, ...extra })
  const out = recheckTopicWords([
    w('コーヒー。'), w('砂糖'), w('砂糖 '), w('あ'.repeat(81)), w('長い', { reading: 'な'.repeat(121) }), w('意味', { meaningKo: '가'.repeat(201) }),
    w('種類', { chunkType: 'OTHER' as ChunkType }), w('牛乳'),
  ], ['コーヒー'])
  assert.deepEqual(out.map((x) => x.textJa), ['砂糖', '牛乳'])
})

// ── 3. A12 실행 — 벽시계·취소·사유 ───────────────────────────────────────────────

const material = { topic: { id: TOPIC, title: '카페 주문', titleJa: 'カフェで注文', description: null, level: 'N5' as const }, chunkTexts: BASE.map((b) => b[0]), chunkMeanings: BASE.map((b) => b[2]) }

test('A12 실행: 성공 → 통과 단어·Trace 1행(원문 없음, lane interactive)·exclude = 기본 표현 → 이전 새 단어 순', async () => {
  const seen: { task: string; signal?: AbortSignal; traceId?: string }[] = []
  const traces: Harness['traces'] = []
  let built: unknown = null
  const driver: TopicWordsDriver = { ...passDriver, build: (i) => ((built = i), passDriver.build(i)) }
  const r = await runTopicWords(
    { complete: async (req) => (seen.push(req), { data: { words: [...aiWords(5), { ...aiWords(1)[0], textJa: '嘘', valid: false }] }, connectionKey: 'k', model: 'mdl', attempts: 1, promptChars: 800 }), trace: (t) => void traces.push(t), now: () => Date.now() },
    { userId: U, material, targetCount: 10, priorSurfaces: ['ミルク'], driver, deadlineAt: Date.now() + 30_000 },
  )
  assert.ok(r.ok && r.words.length === 5)
  assert.equal(seen.length, 1)
  assert.equal(seen[0].task, 'topicWords')
  assert.ok(seen[0].signal instanceof AbortSignal)
  assert.deepEqual((built as { exclude: string[] }).exclude, [...BASE.map((b) => b[0]), 'ミルク'])
  assert.equal(traces.length, 1)
  assert.equal(traces[0].refType, 'topicWords')
  assert.equal(traces[0].status, 'PARTIAL')
  assert.equal(traces[0].steps[0].lane, 'interactive')
  assert.ok(!JSON.stringify(traces[0]).includes('砂糖'), 'Trace 에 단어 원문 없음')
})

test('A12 실행: 벽시계 마감(큐 대기 포함) → 결과를 기다리지 않고 TIMEOUT · 엔진에 취소 신호 / 마감이 이미 지났으면 호출 0', async () => {
  let signal: AbortSignal | undefined
  const started = Date.now()
  const r = await runTopicWords(
    { complete: (req) => ((signal = req.signal), new Promise<never>(() => {})), trace: () => {}, now: () => Date.now() },
    { userId: U, material, targetCount: 10, priorSurfaces: [], driver: passDriver, deadlineAt: Date.now() + 40 },
  )
  assert.deepEqual(r, { ok: false, reason: 'TIMEOUT' })
  assert.ok(Date.now() - started < 1_000)
  assert.equal(signal?.aborted, true, '큐에 있던 호출은 이 신호로 프로세스를 띄우지 않는다')
  let n = 0
  const late = await runTopicWords({ complete: async () => (n++, { data: { words: [] } }), trace: () => {}, now: () => Date.now() }, { userId: U, material, targetCount: 10, priorSurfaces: [], driver: passDriver, deadlineAt: Date.now() - 1 })
  assert.deepEqual([late, n], [{ ok: false, reason: 'TIMEOUT' }, 0])
})

test('A12 실행: 손님 취소 → CANCELLED·엔진 취소 / 이미 끊긴 요청은 호출 0', async () => {
  const ac = new AbortController()
  let signal: AbortSignal | undefined
  setTimeout(() => ac.abort(), 10)
  const r = await runTopicWords(
    { complete: (req) => ((signal = req.signal), new Promise<never>(() => {})), trace: () => {}, now: () => Date.now() },
    { userId: U, material, targetCount: 10, priorSurfaces: [], driver: passDriver, signal: ac.signal, deadlineAt: Date.now() + 30_000 },
  )
  assert.deepEqual(r, { ok: false, reason: 'CANCELLED' })
  assert.equal(signal?.aborted, true)
  let n = 0
  const gone = await runTopicWords({ complete: async () => (n++, { data: { words: [] } }), trace: () => {}, now: () => Date.now() }, { userId: U, material, targetCount: 10, priorSurfaces: [], driver: passDriver, signal: AbortSignal.abort(), deadlineAt: Date.now() + 30_000 })
  assert.deepEqual([gone, n], [{ ok: false, reason: 'CANCELLED' }, 0])
})

test('A12 실행: 엔진 오류 이름 → 사유(시간 초과 TIMEOUT · ajv 재시도 뒤 위반 INVALID · 엔진 없음·계약·그 밖 FAILED) · 통과 0장 INVALID · build·assemble 예외 FAILED', async () => {
  const named = (name: string) => Object.assign(new Error('x'), { name })
  assert.equal(topicWordsFailureReason(named('LlmTimeoutError')), 'TIMEOUT')
  assert.equal(topicWordsFailureReason(named('ClaudeCliTimeoutError')), 'TIMEOUT')
  assert.equal(topicWordsFailureReason(named('JsonSchemaError')), 'INVALID')
  assert.equal(topicWordsFailureReason(named('NoEngineAvailableError')), 'FAILED')
  assert.equal(topicWordsFailureReason(named('LlmContractError')), 'FAILED')
  const run = (complete: TopicSetDeps['complete'], driver = passDriver) => runTopicWords({ complete, trace: () => {}, now: () => Date.now() }, { userId: U, material, targetCount: 10, priorSurfaces: [], driver, deadlineAt: Date.now() + 30_000 })
  assert.deepEqual(await run(async () => Promise.reject(named('JsonSchemaError'))), { ok: false, reason: 'INVALID' })
  assert.deepEqual(await run(async () => ({ data: { words: aiWords(3).map((w) => ({ ...w, valid: false })) } })), { ok: false, reason: 'INVALID' })
  assert.deepEqual(await run(async () => ({ data: { words: aiWords(3) } }), { ...passDriver, build: () => { throw new Error('bad') } }), { ok: false, reason: 'FAILED' })
  assert.deepEqual(
    await run(async () => ({ data: { words: aiWords(3) } }), { ...passDriver, assemble: () => { throw new TypeError('bug') } }),
    { ok: false, reason: 'FAILED' },
    'assemble 예외는 엔진 응답 위반(INVALID)이 아니라 코드 오류(FAILED) — REV-121 L-1',
  )
})

// ── 4. #47 주제 세트 — 순서·폴백·상한(가짜 db·tx·엔진) ─────────────────────────────

test('#47 첫 세트: A12 1회 → 새 단어 10장(AI)·topic.aiCardCount 10·정답·refId 미노출·단어장 추가 0·Trace 1', async () => {
  const h = harness()
  const r = created(await create(h, { count: 10 }))
  assert.equal(h.calls.length, 1, '요청당 A12 ≤ 1회')
  assert.deepEqual(r.generation, { source: 'AI', generatedNow: true, reason: null })
  assert.deepEqual(r.session.topic, { id: TOPIC, title: '카페 주문', lessonCardCount: 0, aiCardCount: 10 })
  assert.equal(r.session.mode, 'CHOICE')
  assert.equal(r.cards.length, 10)
  for (const c of r.cards) {
    assert.equal(c.choices?.length, 4)
    assert.equal('meaning' in c || 'correctText' in c || 'answer' in c || 'refId' in c || 'refType' in c, false)
  }
  const json = JSON.stringify(r)
  for (const a of h.db.attempts) assert.ok(!json.includes(a.refId as string), 'refId 응답 0')
  assert.equal(h.db.wordCreates, 0)
  assert.equal(h.traces.length, 1)
  const s = h.db.sessions[0]
  assert.equal(s.topicId, TOPIC)
  assert.ok(h.db.attempts.every((a) => a.wordId === null && a.refType === 'AiWord' && a.refId === repetitionRefId(a.surfaceSnap as string)))
  // #49 같은 값
  const read = await readVocabSessionTx(h.db.tx(), U, s.id as string)
  assert.deepEqual(read.session.topic, r.session.topic)
  // #48 groupBy 와 같은 값
  assert.deepEqual((await topicCountsOf(h.db.tx(), [{ id: s.id as string, topicId: TOPIC }])).get(s.id as string), { lessonCardCount: 0, aiCardCount: 10 })
})

test('#47 같은 날 두 번째 세트: LLM 0회(재사용) — 안 푼 새 단어 6 + 주제 표현 4(MIXED·NEW_DONE), 다 풀면 B1 만', async () => {
  const h = harness()
  const first = created(await create(h, { count: 10 }))
  h.db.answer(first.session.id, { 0: 'CORRECT', 1: 'CORRECT', 2: 'WRONG', 3: 'WRONG' })
  const second = created(await create(h, { count: 10 }))
  assert.equal(h.calls.length, 1, '같은 날 재사용 — LLM 0회')
  assert.deepEqual(second.generation, { source: 'MIXED', generatedNow: false, reason: 'NEW_DONE' })
  assert.equal(second.session.topic?.aiCardCount, 6)
  const answeredSurfaces = new Set(h.db.attempts.filter((a) => a.sessionId === first.session.id && (a.order as number) < 4).map((a) => a.surfaceSnap))
  assert.ok(!second.cards.some((c) => answeredSurfaces.has(c.surface)), '오늘 답한 새 단어는 다시 안 나온다')
  // 남은 새 단어도 다 풀면 B1 만(source TOPIC, reason NEW_DONE)
  h.db.answer(second.session.id, Object.fromEntries(second.cards.map((_, i) => [i, 'CORRECT' as const])))
  const third = created(await create(h, { count: 5 }))
  assert.deepEqual(third.generation, { source: 'TOPIC', generatedNow: false, reason: 'NEW_DONE' })
  assert.equal(h.calls.length, 1)
})

test('#47 generate:false → SKIPPED·LLM 0 / 수업 표현이 섞이면 lessonCardCount', async () => {
  const h = harness()
  h.db.lessons.push({ id: 'L1', userId: U, topicId: TOPIC, kind: 'NEW', status: 'DONE', content: LESSON_A })
  const r = created(await create(h, { count: 14, generate: false }))
  assert.equal(h.calls.length, 0)
  assert.deepEqual(r.generation, { source: 'TOPIC', generatedNow: false, reason: 'SKIPPED' })
  assert.deepEqual(r.session.topic, { id: TOPIC, title: '카페 주문', lessonCardCount: 2, aiCardCount: 0 })
  assert.equal(topicWordsAttemptsUsed(U, TODAY), 0)
})

test('#47 폴백 사유: 통과 7/10 → MIXED·SHORT · 엔진 실패 → TOPIC·FAILED · 엔진 없음(driver 없음) → FAILED', async () => {
  const short = harness(async () => ({ data: { words: aiWords(7) } }))
  assert.deepEqual(created(await create(short, { count: 10 })).generation, { source: 'MIXED', generatedNow: true, reason: 'SHORT' })
  const failed = harness(async () => Promise.reject(Object.assign(new Error('x'), { name: 'NoEngineAvailableError' })))
  const f = created(await create(failed, { count: 10 }))
  assert.deepEqual(f.generation, { source: 'TOPIC', generatedNow: false, reason: 'FAILED' })
  assert.equal(f.cards.length, 10, '폴백 세트도 목표 장수만큼(하루 목표가 LLM 으로 막히지 않는다)')
  resetTopicWordsStateForTest()
  const noDriver = harness()
  assert.equal(created(await create(noDriver, { count: 10 }, { driver: null })).generation?.reason, 'FAILED')
  assert.equal(noDriver.calls.length, 0)
})

test('#47 벽시계 30초(테스트 40ms): 엔진이 늦으면 TIMEOUT 폴백 세트·엔진 취소 신호', async () => {
  const h = harness(() => new Promise<never>(() => {}), { wallMs: 40 })
  const r = created(await create(h, { count: 10 }))
  assert.deepEqual(r.generation, { source: 'TOPIC', generatedNow: false, reason: 'TIMEOUT' })
  assert.equal(h.calls[0].req.signal?.aborted, true)
  assert.equal(r.session.topic?.aiCardCount, 0)
})

test('#47 손님 취소: 생성 중 끊기면 세트 0·시도 되돌림 · 끊긴 요청은 409 CANCELLED', async () => {
  const h = harness(() => new Promise<never>(() => {}))
  const ac = new AbortController()
  setTimeout(() => ac.abort(), 10)
  await assert.rejects(create(h, { count: 10 }, { signal: ac.signal }), code('CONFLICT', 'CANCELLED'))
  assert.equal(h.db.sessionCreates, 0, '세트를 만들지 않는다')
  assert.equal(h.calls[0].req.signal?.aborted, true)
  assert.equal(topicWordsAttemptsUsed(U, TODAY), 0)
  // 생성 없는 경로도 끊긴 요청이면 만들지 않는다
  await assert.rejects(create(h, { count: 10, generate: false }, { signal: AbortSignal.abort() }), code('CONFLICT', 'CANCELLED'))
  assert.equal(h.db.sessionCreates, 0)
})

test('#47 손님 취소: A12 가 성공한 직후(세트 트랜잭션 전) 끊겨도 세트 0·시도 되돌림·생성 중 표시 해제 — REV-121 L-2', async () => {
  const ac = new AbortController()
  // A12 Trace 는 엔진 결과를 받은 뒤 runTopicWords 가 돌아오기 직전에 남는다 — 그 순간 손님이 끊긴 것으로 친다.
  const h = harness(undefined, { trace: () => ac.abort() })
  await assert.rejects(create(h, { count: 10 }, { signal: ac.signal }), code('CONFLICT', 'CANCELLED'))
  assert.equal(h.calls.length, 1, 'A12 는 성공까지 갔다')
  assert.equal(h.db.sessionCreates, 0, '세트를 만들지 않는다')
  assert.equal(topicWordsAttemptsUsed(U, TODAY), 0, 'A12 도중 취소와 같이 하루 시도를 되돌린다')
  assert.equal(isTopicWordsGenerating(U), false, '생성 중 표시 해제')
  // 같은 날 다시 들어오면 GENERATING·LIMIT 없이 새로 만든다.
  const again = created(await create(h, { count: 10 }))
  assert.deepEqual(again.generation, { source: 'AI', generatedNow: true, reason: null })
  assert.equal(topicWordsAttemptsUsed(U, TODAY), 1)
})

test('#47 하루 시도 3번: 실패만 하면 다음 세트에서 다시 시도, 4번째는 LIMIT(LLM 0)', async () => {
  const h = harness(async () => Promise.reject(Object.assign(new Error('x'), { name: 'LlmTimeoutError' })))
  for (let i = 0; i < TOPIC_WORDS_DAILY_ATTEMPTS; i++) {
    const r = created(await create(h, { count: 5 }))
    assert.equal(r.generation?.reason, 'TIMEOUT')
    h.db.answer(r.session.id, {}, 'ABANDONED')
  }
  const limited = created(await create(h, { count: 5 }))
  assert.deepEqual(limited.generation, { source: 'TOPIC', generatedNow: false, reason: 'LIMIT' })
  assert.equal(h.calls.length, TOPIC_WORDS_DAILY_ATTEMPTS)
})

test('#47 생성 중 두 번째 요청 → 409 GENERATING(generate:false 는 막지 않음) · 풀던 세트 → 409 sessionId(LLM 0)', async () => {
  let release: (v: TopicWordsCallResult) => void = () => {}
  const h = harness(() => new Promise<TopicWordsCallResult>((res) => (release = res)))
  const p1 = create(h, { count: 10 })
  while (!h.calls.length) await new Promise((r) => setImmediate(r))
  await assert.rejects(create(h, { count: 10 }), code('CONFLICT', 'GENERATING'))
  const skip = created(await create(h, { count: 5, generate: false }))
  assert.equal(skip.generation?.reason, 'SKIPPED')
  release({ data: { words: aiWords(13) } })
  await assert.rejects(p1, (e: unknown) => e instanceof ApiError && e.code === 'CONFLICT' && e.details?.sessionId === skip.session.id, '그 사이 풀던 세트가 생기면 만든 단어는 버리고 409')
  await assert.rejects(create(h, { count: 10 }), (e: unknown) => e instanceof ApiError && e.details?.sessionId === skip.session.id)
  assert.equal(h.calls.length, 1, '풀던 세트가 있으면 LLM 을 부르지 않는다')
})

test('#47 주제 접근: 없는 주제·남의 주제 404(LLM 0) · 본문 검증(topicId+category·generate 단독·형식)', async () => {
  const h = harness()
  await assert.rejects(create(h, { topicId: 'nope' }), code('NOT_FOUND'))
  await assert.rejects(create(h, { topicId: 'topic-mine-other' }), code('NOT_FOUND'))
  assert.equal(h.calls.length, 0)
  assert.throws(() => parseCreateSessionBody({ topicId: TOPIC, category: '음식' }), code('VALIDATION'))
  assert.throws(() => parseCreateSessionBody({ generate: false }), code('VALIDATION'))
  assert.throws(() => parseCreateSessionBody({ topicId: TOPIC, generate: 'no' }), code('VALIDATION'))
  assert.throws(() => parseCreateSessionBody({ topicId: 7 }), code('VALIDATION'))
  assert.deepEqual(parseCreateSessionBody({ topicId: TOPIC }), { count: undefined, mode: 'CHOICE', category: null, topicId: TOPIC, generate: true })
  assert.deepEqual(parseCreateSessionBody({ topicId: TOPIC, generate: false }), { count: undefined, mode: 'CHOICE', category: null, topicId: TOPIC, generate: false })
  assert.deepEqual(parseCreateSessionBody({}), { count: undefined, mode: 'CHOICE', category: null }, '주제 세트가 아니면 칸 없음(기존 응답 모양 그대로)')
})

test('#47 빈 상태: 오늘 기본 표현을 다 답했고 새 단어가 없으면 TOPIC_ALL_DONE_TODAY(CTA MY_WORDS) / 조각 0 주제 TOPIC_EMPTY', async () => {
  const h = harness()
  const r = created(await create(h, { count: 12, generate: false }))
  h.db.answer(r.session.id, Object.fromEntries(r.cards.map((_, i) => [i, 'WRONG' as const])))
  assert.deepEqual(await create(h, { count: 10, generate: false }), { session: null, empty: { reason: 'TOPIC_ALL_DONE_TODAY', cta: ['MY_WORDS'] } })
  const e = harness(async () => ({ data: { words: [] } }))
  e.db.chunks = []
  assert.deepEqual(await create(e, { count: 10 }), { session: null, empty: { reason: 'TOPIC_EMPTY', cta: ['MY_WORDS'] } })
})

// ── 5. #51 끝내기 · #53 다시 풀기 ───────────────────────────────────────────────

test('#51 주제 세트 끝내기: 반복 항목(AiWord→Expr·TopicChunk→CHUNK)·스냅샷 data.topicId·StudyLog "주제 단어 「…」"·wrongWords.source·단어장 추가 0', async () => {
  const h = harness(async () => ({ data: { words: aiWords(7) } }))
  const r = created(await create(h, { count: 10 }))
  const cards = h.db.attempts.filter((a) => a.sessionId === r.session.id)
  const ai = cards.find((a) => a.refType === 'AiWord') as Row
  const chunk = cards.find((a) => a.refType === 'TopicChunk') as Row
  h.db.answer(r.session.id, { [ai.order as number]: 'CORRECT', [chunk.order as number]: 'WRONG' }, 'IN_PROGRESS')
  const tx = h.db.tx()
  const done = await finishVocabSessionDetailed(U, r.session.id, { transaction: (fn) => fn(tx) })
  assert.equal(done.finishedNow, true)
  assert.deepEqual(h.db.rep.map((x) => [x.itemType, x.refType, x.refId]).sort(), [['CHUNK', 'TopicChunk', chunk.refId], ['EXPRESSION', 'Expr', ai.refId]].sort())
  const snap = h.db.snapshots.find((s) => s.kind === 'VOCAB_SESSION') as Row
  assert.equal((snap.data as Row).topicId, TOPIC)
  assert.deepEqual([(snap.data as Row).correct, (snap.data as Row).wrong, (snap.data as Row).date], [1, 1, TODAY])
  assert.match(h.db.logs[0].summary as string, /^주제 단어 「카페 주문」 10장/)
  assert.deepEqual(done.result.wrongWords.map((w) => [w.surface, w.source, w.wordId]), [[chunk.surfaceSnap, 'TOPIC', null]])
  assert.deepEqual(done.result.session.topic, { id: TOPIC, title: '카페 주문', lessonCardCount: 0, aiCardCount: 7 })
  assert.equal(h.db.wordCreates, 0)
})

test('#53 주제 세트 다시 풀기: 주제 세트로(topicId·refType/refId 복사, LLM 0) · 보기는 주제 풀 기준(CHOICE 유지) · topic 수 같음', async () => {
  const h = harness()
  const r = created(await create(h, { count: 10 }))
  h.db.answer(r.session.id, { 0: 'CORRECT' })
  ;(h.db.sessions[0] as Row).keptAt = NOW
  const tx = h.db.tx()
  const rep = await replayVocabSession(U, r.session.id, { transaction: (fn) => fn(tx) })
  assert.equal(h.calls.length, 1, '다시 풀기는 LLM 을 부르지 않는다')
  assert.equal(rep.session.mode, 'CHOICE', '주제 풀 뜻으로 보기를 만든다(wordId=null 이어도 FLIP 강등 없음)')
  assert.equal(rep.session.replayOfId, r.session.id)
  assert.deepEqual(rep.session.topic, r.session.topic)
  const copied = h.db.attempts.filter((a) => a.sessionId === rep.session.id)
  const orig = h.db.attempts.filter((a) => a.sessionId === r.session.id)
  assert.deepEqual(copied.map((a) => `${a.refType}:${a.refId}`).sort(), orig.map((a) => `${a.refType}:${a.refId}`).sort())
  assert.equal((h.db.sessions.at(-1) as Row).topicId, TOPIC)
  for (const c of rep.cards) assert.ok(c.choices?.length === 4 && !('meaning' in c))
})

// ── 6. 보강(신규 소환 developer) — 생성 중 표시 범위·벽시계 기준·이전 표기 제외·스냅샷 불변 ─────────────────

test('#47 생성 중 표시는 세트 트랜잭션이 끝날 때까지 — 커밋 전 틈의 두 번째 요청도 409 GENERATING(A12 두 번째 호출 0)', async () => {
  const h = harness()
  let enterTx: () => void = () => {}
  const gate = new Promise<void>((res) => (enterTx = res))
  let inTx = false
  const realTx = h.deps.transaction as NonNullable<TopicSetDeps['transaction']>
  h.deps.transaction = async (fn) => {
    inTx = true
    await gate
    return realTx(fn)
  }
  const p1 = create(h, { count: 10 })
  while (!inTx) await new Promise((r) => setImmediate(r))
  assert.equal(h.calls.length, 1, 'A12 는 끝났고 트랜잭션 대기 중')
  await assert.rejects(create(h, { count: 10 }), code('CONFLICT', 'GENERATING'))
  assert.equal(h.calls.length, 1)
  enterTx()
  created(await p1)
  // 트랜잭션이 끝나면 표시가 풀린다 — 오늘 새 단어가 있으니 재사용(LLM 0)으로 풀던 세트 409 까지 간다.
  await assert.rejects(create(h, { count: 10 }), (e: unknown) => e instanceof ApiError && e.code === 'CONFLICT' && typeof e.details?.sessionId === 'string')
  assert.equal(h.calls.length, 1)
})

test('#47 벽시계 기준 = 요청 시작(startedAt) — 라우트 앞단·큐 대기로 이미 30초가 지났으면 A12 0회·TIMEOUT 폴백', async () => {
  const h = harness()
  const r = created(await createVocabSession(U, { count: 10, mode: 'CHOICE', category: null, topicId: TOPIC, generate: true }, {
    topicWords: passDriver, deps: h.deps, startedAt: NOW.getTime() - 30_000,
  }))
  assert.equal(h.calls.length, 0)
  assert.deepEqual(r.generation, { source: 'TOPIC', generatedNow: false, reason: 'TIMEOUT' })
  assert.equal(h.traces.length, 1, '중단도 Trace 1행')
  assert.equal(h.traces[0].errorCode, 'WALL_CLOCK')
})

test('#47 다음 날 생성: exclude = 기본 표현 → 이전 새 단어 표기 · 모델이 그 표기를 다시 내면 서버가 버림(SHORT) · 기본 표현 표기도 버림', async () => {
  let builtExclude: string[] = []
  const variants: number[] = []
  const driver: TopicWordsDriver = { ...passDriver, build: (i) => ((builtExclude = i.exclude), variants.push(i.variant), passDriver.build(i)) }
  let day = NOW.getTime()
  const h = harness(async () => ({ data: { words: [{ textJa: 'コーヒー', reading: 'こーひー', meaningKo: '커피', chunkType: 'NAME', jlpt: 'N5', valid: true }, ...aiWords(13)] } }), { now: () => day })
  const d1 = created(await create(h, { count: 10 }, { driver }))
  assert.equal(d1.session.topic?.aiCardCount, 10, '1일째: 기본 표현 표기(コーヒー)는 버리고 새 단어 10장')
  const usedDay1 = h.db.attempts.filter((a) => a.sessionId === d1.session.id).map((a) => a.surfaceSnap as string)
  assert.ok(!usedDay1.includes('コーヒー'))
  h.db.answer(d1.session.id, { 0: 'CORRECT' })
  // 1일째 세트를 다시 풀어도(날짜만 다른 복사본) "새 단어를 만든 날"로 세지 않는다.
  ;(h.db.sessions[0] as Row).keptAt = NOW
  day += 12 * 3600_000
  const tx = h.db.tx()
  const rep = await replayVocabSession(U, d1.session.id, { transaction: (fn) => fn(tx) })
  h.db.answer(rep.session.id, { 0: 'WRONG' })
  ;(h.db.sessions.at(-1) as Row).date = new Date(Date.UTC(2026, 9, 7))
  day += 12 * 3600_000
  const d2 = created(await create(h, { count: 10 }, { driver }))
  assert.equal(h.calls.length, 2, '다음 날은 다시 생성(전날 세트의 다시 풀기는 오늘 생성을 막지 않는다)')
  assert.deepEqual(variants, [0, 1], 'variant = 새 단어를 이미 만든 날 수(다시 풀기 세트 제외) — PE 인계 2')
  assert.deepEqual(builtExclude.slice(0, BASE.length), BASE.map((b) => b[0]), '기본 표현이 앞')
  assert.deepEqual(new Set(builtExclude.slice(BASE.length)), new Set(usedDay1), '이어서 이전 새 단어 표기(카드로 낸 것만)')
  const d2Ai = h.db.attempts.filter((a) => a.sessionId === d2.session.id && a.refType === 'AiWord').map((a) => a.surfaceSnap as string)
  assert.ok(d2Ai.every((s) => !usedDay1.includes(s) && s !== 'コーヒー'), '이전에 낸 표기·기본 표현 표기는 다시 카드가 되지 않는다')
  assert.equal(d2Ai.length, 3, '1일째에 안 쓴 3개만 남는다')
  assert.deepEqual(d2.generation, { source: 'MIXED', generatedNow: true, reason: 'SHORT' })
})

test('#51·#53 스냅샷 불변: 다시 풀기는 스냅샷 0 · 멱등 재호출 0 · 주제가 지워져도(topicId SetNull) 기존 data.topicId 그대로', async () => {
  const h = harness()
  const r = created(await create(h, { count: 10 }))
  h.db.answer(r.session.id, { 0: 'CORRECT', 1: 'WRONG' }, 'IN_PROGRESS')
  const tx = h.db.tx()
  const run = { transaction: <T>(fn: (t: Tx) => Promise<T>) => fn(tx) }
  await finishVocabSessionDetailed(U, r.session.id, run)
  const snap = structuredClone(h.db.snapshots)
  assert.equal(snap.filter((s) => s.kind === 'VOCAB_SESSION').length, 1)
  const again = await finishVocabSessionDetailed(U, r.session.id, run)
  assert.equal(again.finishedNow, false)
  assert.deepEqual(again.result.session.topic, { id: TOPIC, title: '카페 주문', lessonCardCount: 0, aiCardCount: 10 }, '멱등 응답도 같은 topic 수(groupBy)')
  ;(h.db.sessions[0] as Row).keptAt = NOW
  await replayVocabSession(U, r.session.id, run)
  assert.deepEqual(h.db.snapshots, snap, '재호출·다시 풀기는 스냅샷을 쓰지 않는다')
  ;(h.db.sessions[0] as Row).topicId = null
  const gone = await finishVocabSessionDetailed(U, r.session.id, run)
  assert.equal(gone.result.session.topic, null, '주제가 지워진 세트는 topic null')
  assert.deepEqual(h.db.snapshots, snap, '지운 뒤에도 스냅샷(data.topicId) 불변')
})

// ── 7. 정적 경계 ────────────────────────────────────────────────────────────────

const LEARNING = 'src/modules/learning'

const topicGone = (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND' && e.details?.reason === 'TOPIC_GONE'

test('#47 삭제 경쟁(task-045 T3, Codex C1 ⓑ) — A12 도중 주제가 지워지면 세트를 만들지 않는다(404 TOPIC_GONE·새 단어 버림, 잠금은 저장 구간만)', async () => {
  const h: Harness = harness(async () => {
    h.db.topics = h.db.topics.filter((t) => t.id !== TOPIC)
    return { data: { words: aiWords(13) }, connectionKey: 'conn', model: 'm', attempts: 1, promptChars: 900 }
  })
  await assert.rejects(create(h, { count: 10 }), topicGone)
  assert.equal(h.calls.length, 1, 'AI 는 한 번 불렸다(잠금 밖)')
  assert.equal(h.db.sessionCreates, 0)
  assert.equal(h.db.attempts.length, 0)
})

test('#47 가린 시드(task-045 T3) — 숨김이면 404 · 진행 중 챌린지 주제면 허용(§0 #9) · 다른 사용자의 숨김은 영향 없음', async () => {
  const g = harness()
  g.db.overrides.push({ userId: OTHER, kind: 'TOPIC', seedId: TOPIC, copyId: null })
  created(await create(g, { count: 5, generate: false }))
  const h = harness()
  h.db.overrides.push({ userId: U, kind: 'TOPIC', seedId: TOPIC, copyId: null })
  await assert.rejects(create(h, { count: 5, generate: false }), topicGone)
  assert.equal(h.db.sessionCreates, 0)
  h.db.challenges.push({ userId: U, status: 'ACTIVE', topicId: TOPIC, endDate: new Date('2099-12-31T00:00:00Z') })
  created(await create(h, { count: 5, generate: false }))
})

test('#47 가린 시드 시작(task-045 T3-1b, REV-150 M1) — 숨김이면 A12 를 부르기 전에 404 TOPIC_GONE(LLM 0·세트 0) · 진행 중 챌린지 주제면 생성까지 간다', async () => {
  const h = harness()
  h.db.overrides.push({ userId: U, kind: 'TOPIC', seedId: TOPIC, copyId: null })
  await assert.rejects(create(h, { count: 5, generate: true }), topicGone)
  assert.deepEqual([h.calls.length, h.db.sessionCreates], [0, 0])
  h.db.challenges.push({ userId: U, status: 'ACTIVE', topicId: TOPIC, endDate: new Date('2099-12-31T00:00:00Z') })
  created(await create(h, { count: 5, generate: true }))
  assert.equal(h.calls.length, 1)
})

test('#47 FK 위반(task-045 T3) — 세트 저장 때 주제 FK P2003 은 404 TOPIC_GONE, 다른 FK 오류는 그대로 던진다', async () => {
  const h = harness()
  h.db.sessionCreateError = Object.assign(new Error('fk'), { code: 'P2003', meta: { field_name: 'VocabSession_topicId_fkey (index)' } })
  await assert.rejects(create(h, { count: 5, generate: false }), topicGone)
  const other = Object.assign(new Error('fk-user'), { code: 'P2003', meta: { field_name: 'VocabSession_userId_fkey (index)' } })
  h.db.sessionCreateError = other
  await assert.rejects(create(h, { count: 5, generate: false }), (e: unknown) => e === other)
})

/** 값 import·re-export 지정자. `import type`·`export type` 는 빌드에서 지워져 순환을 만들지 않으므로 뺀다(`import { type A, b }` 는 값). */
function valueImportSpecifiers(src: string): string[] {
  const clause = String.raw`(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+))?)`
  const out: string[] = []
  for (const m of src.matchAll(new RegExp(String.raw`^(?:import|export)\s+(type\s+)?${clause}\s+from\s+'([^']+)'`, 'gm'))) if (!m[1]) out.push(m[2])
  for (const m of src.matchAll(/^import\s+'([^']+)'/gm)) out.push(m[1])
  for (const m of src.matchAll(/\bimport\(\s*'([^']+)'\s*\)/g)) out.push(m[1])
  return out
}

/** 지정자 → 저장소 경로(확장자·`/index` 없이). 패키지는 null. */
function resolveImport(file: string, spec: string): string | null {
  const p = spec.startsWith('@/') ? posix.join('src', spec.slice(2)) : spec.startsWith('.') ? posix.join(posix.dirname(file), spec) : null
  return p ? p.replace(/\.ts$/, '').replace(/\/index$/, '') : null
}

/** `lessons/today → challenges → topics/pool` 순환을 다시 닫는 값 import — challenges 전체·lessons/today·barrel(lessons·learning index). */
const closesCycle = (p: string) =>
  p === LEARNING || p === `${LEARNING}/lessons` || p === `${LEARNING}/lessons/today` || p === `${LEARNING}/challenges` || p.startsWith(`${LEARNING}/challenges/`)

test('import 경계(REV-121 L-5): T2 파일 전체(topics/**·vocab/topicSet·sessions·distractors)가 challenges·lessons/today·barrel 을 값 import 하지 않는다 · L3 파일에 @/modules/conversation 0', () => {
  // 검사기 자체 확인 — 여러 줄 import·re-export·별칭 경로는 잡고, 타입 전용은 뺀다.
  const probe = valueImportSpecifiers([
    "import type { A } from '../challenges'",
    "import {\n  type B,\n  c,\n} from '../lessons'",
    "export * from '../lessons/today'",
    "export type { D } from '..'",
    "import x, { y } from '@/modules/learning'",
    "export function f() { return 'from' }",
  ].join('\n'))
  assert.deepEqual(probe, ['../lessons', '../lessons/today', '@/modules/learning'])
  const from = `${LEARNING}/topics/pool.ts`
  assert.deepEqual(
    ['../lessons', '../lessons/index', '../lessons/today', '../lessons/content', '..', '../index', '@/modules/learning', '../challenges/progress', '../repetition'].map((s) => closesCycle(resolveImport(from, s) as string)),
    [true, true, true, false, true, true, true, true, false],
  )

  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  const files = [
    ...readdirSync(join(process.cwd(), `${LEARNING}/topics`)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')).map((f) => `${LEARNING}/topics/${f}`),
    `${LEARNING}/vocab/topicSet.ts`, `${LEARNING}/vocab/sessions.ts`, `${LEARNING}/vocab/distractors.ts`,
  ]
  assert.ok(files.includes(`${LEARNING}/topics/pool.ts`) && files.includes(`${LEARNING}/topics/index.ts`))
  for (const p of files) {
    const src = read(p)
    const bad = valueImportSpecifiers(src).filter((s) => {
      const r = resolveImport(p, s)
      return r !== null && closesCycle(r)
    })
    assert.deepEqual(bad, [], `${p} — 순환을 닫는 값 import`)
    assert.doesNotMatch(src, /@\/modules\/conversation/, p)
  }
  assert.match(read(`${LEARNING}/topics/pool.ts`), /from '\.\.\/lessons\/content'/, 'pool 은 수업 본문 파일을 직접 쓴다')
})
