/**
 * task-059 카드 우선 세트(IMP-0011) — 서버. 계약 api-contract §2-10 #47·#49·#50·#51·#53, 이력서 「서버 명세」·「Leader 결정」.
 * DB 없이 가짜 tx(이 파일의 쿼리 모양만 해석)로 세트 생성·답·끝내기·다시 풀기를 끝까지 돌린다.
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { ChunkType, PartOfSpeech } from '@prisma/client'
import { ApiError, dates, type Tx } from '@/modules/infra'
import {
  composeWordSessionLocked, createVocabSession, finishVocabSessionDetailed, parseAttemptBody, parseCreateSessionBody, readVocabSessionTx, recordAttempt,
  replayVocabSession, toCardDto, type CreateSessionResult, type VocabCardDto,
} from '../vocab/sessions'
import { requestedModeOf } from '../vocab/setGenerator'
import { resetTopicWordsStateForTest, type TopicSetDeps } from '../vocab/topicSet'
import { fakeUserWordState, matchWhere, stateRow } from './wordWhereFake'

const U = 'user-1'
const OTHER = 'user-2'
const NOW = new Date('2026-10-11T03:00:00.000Z') // KST 12:00
const TODAY = '2026-10-11'
const TOPIC = 'topic-mine'
const code = (c: string, reason?: string, field?: string) => (e: unknown) =>
  e instanceof ApiError && e.code === c && (reason === undefined || e.details?.reason === reason) && (field === undefined || e.details?.field === field)

type Row = Record<string, unknown>
const sameDate = (a: unknown, b: unknown) => a instanceof Date && b instanceof Date && a.getTime() === b.getTime()

const WORDS: [string, string, string, string, PartOfSpeech][] = [
  ['w1', '食べる', 'たべる', '먹다', 'VERB'], ['w2', '行く', 'いく', '가다', 'VERB'], ['w3', '水', 'みず', '물', 'NOUN'],
  ['w4', '高い', 'たかい', '비싸다', 'ADJ_I'], ['w5', '友達', 'ともだち', '친구', 'NOUN'], ['w6', '火', 'ひ', '불', 'NOUN'],
]
const wordRow = ([id, surface, reading, meaning, partOfSpeech]: (typeof WORDS)[number], over: Row = {}): Row => ({
  id, userId: U, source: 'MANUAL', archived: false, category: null, surface, reading, meaning, partOfSpeech, correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null,
  example: `${surface}の例文。`, exampleKo: `${meaning} 예문`, jlpt: null, ...over,
})

const CHUNKS: [string, string, string, ChunkType][] = [
  ['コーヒー', 'こーひー', '커피', 'NAME'], ['紅茶', 'こうちゃ', '홍차', 'NAME'], ['ください', 'ください', '주세요', 'ACTION'],
  ['お願いします', 'おねがいします', '부탁합니다', 'ACTION'], ['おいしい', 'おいしい', '맛있다', 'FEELING'], ['ひとつ', 'ひとつ', '하나', 'MODIFIER'],
]

// ── 가짜 DB ───────────────────────────────────────────────────────────────────

class FakeDb {
  words: Row[] = WORDS.map((w) => wordRow(w))
  topics: Row[] = [{ id: TOPIC, userId: U, title: '카페', titleJa: null, description: null, level: 'N5' }]
  chunks: Row[] = CHUNKS.map(([textJa, reading, meaningKo, chunkType], i) => ({ id: `c${i}`, topicId: TOPIC, order: i, textJa, reading, meaningKo, chunkType }))
  sessions: Row[] = []
  attempts: Row[] = []
  logs: Row[] = []
  snapshots: Row[] = []
  rep: Row[] = []
  observations: Row[] = []
  /** task-068: 나의 학습 상태(UserWordState) — 카운터는 단어 행이 아니라 여기에 쌓인다. */
  states: Row[] = []
  ops: string[] = []
  private seq = 0
  clock = NOW.getTime()

  id(p: string): string {
    return `${p}${++this.seq}`
  }

  sessionView(s: Row): Row {
    const t = this.topics.find((x) => x.id === s.topicId)
    return { ...s, topic: s.topicId && t ? { title: t.title } : null }
  }

  matchAttempt(a: Row, where: Row): boolean {
    for (const [k, v] of Object.entries(where)) {
      if (k === 'session') {
        const s = this.sessions.find((x) => x.id === a.sessionId)
        if (!s) return false
        for (const [sk, sv] of Object.entries(v as Row)) if (sk === 'date' ? !sameDate(s.date, sv) : s[sk] !== sv) return false
        continue
      }
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) {
          if (!(v.in as unknown[]).includes(a[k])) return false
          continue
        }
        if ('not' in v) {
          if ((a[k] ?? null) === (v as { not: unknown }).not) return false
          continue
        }
      }
      if ((a[k] ?? null) !== v) return false
    }
    return true
  }

  project(a: Row, select?: Row): Row {
    const s = this.sessions.find((x) => x.id === a.sessionId) as Row
    const w = a.wordId ? this.words.find((x) => x.id === a.wordId) : undefined
    const full: Row = { ...a, word: w ? { example: w.example ?? null, exampleKo: w.exampleKo ?? null } : null, session: { status: s.status, replayOfId: s.replayOfId, date: s.date } }
    if (!select) return full
    return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, full[k] ?? null]))
  }

  rowsOf(sessionId: string): Row[] {
    return this.attempts.filter((a) => a.sessionId === sessionId).sort((a, b) => (a.order as number) - (b.order as number))
  }

  word(id: string): Row {
    return this.words.find((w) => w.id === id) as Row
  }

  /** 나(U)의 단어 상태 — 행이 없으면 0·미보관(= 기본값). */
  st(wordId: string): Row {
    return this.states.find((x) => x.userId === U && x.wordId === wordId) ?? stateRow(U, wordId)
  }

  tx(): Tx {
    return fakeTx(this)
  }

  run(): { transaction: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> } {
    const tx = this.tx()
    return { transaction: (fn) => fn(tx) }
  }

  /** 오늘 끝낸 세트(그 단어들은 오늘 풀에서 빠진다). */
  doneToday(wordIds: string[]): void {
    const id = this.id('vs-done')
    this.sessions.push({ id, userId: U, mode: 'FLIP', status: 'DONE', date: dates.toDbDate(TODAY), seed: 'Fdone', topicId: null, replayOfId: null, keptAt: null, cardCount: wordIds.length, startedAt: NOW })
    wordIds.forEach((wordId, order) => this.attempts.push({ id: this.id('va'), sessionId: id, order, wordId, surfaceSnap: 's', readingSnap: null, meaningSnap: 'm', answer: 'CORRECT' }))
  }
}

function fakeTx(db: FakeDb): Tx {
  return {
      $queryRaw: async (strings: TemplateStringsArray, ...v: unknown[]) => {
        if (strings.join('?').includes('FROM VocabSession')) return db.sessions.some((s) => s.id === v[0] && s.userId === v[1]) ? [{ id: v[0] }] : []
        return [{ id: 'locked' }]
      },
      $executeRaw: async () => 1,
      conversationTopic: {
        findFirst: async ({ where }: { where: Row }) => {
          const owner = ((where.OR as Row[])[1] as Row).userId
          const t = db.topics.find((x) => x.id === where.id && (x.userId === null || x.userId === owner))
          return t ? { ...t, chunks: db.chunks.filter((c) => c.topicId === t.id).map((c) => ({ textJa: c.textJa, meaningKo: c.meaningKo })) } : null
        },
      },
      topicChunk: { findMany: async ({ where }: { where: Row }) => db.chunks.filter((c) => c.topicId === where.topicId) },
      lesson: { findMany: async () => [] },
      userSeedOverride: { findFirst: async () => null },
      challenge: { findFirst: async () => null },
      vocabSession: {
        findFirst: async ({ where, select }: { where: Row; select?: Row }) => {
          const s = db.sessions.filter((x) => Object.entries(where).every(([k, v]) => x[k] === v)).at(-1)
          if (!s) return null
          const view = db.sessionView(s)
          if (select?.attempts) view.attempts = db.rowsOf(s.id as string).map((a) => db.project(a, (select.attempts as Row).select as Row))
          return view
        },
        findUniqueOrThrow: async ({ where }: { where: Row }) => db.sessionView(db.sessions.find((x) => x.id === where.id) as Row),
        create: async ({ data }: { data: Row }) => {
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
        findMany: async ({ where, select }: { where: Row; select?: Row }) =>
          db.attempts.filter((a) => db.matchAttempt(a, where)).sort((a, b) => (a.order as number) - (b.order as number)).map((a) => db.project(a, select)),
        findUnique: async ({ where, select }: { where: { sessionId_order: { sessionId: string; order: number } }; select?: Row }) => {
          const a = db.attempts.find((x) => x.sessionId === where.sessionId_order.sessionId && x.order === where.sessionId_order.order)
          return a ? db.project(a, select) : null
        },
        findUniqueOrThrow: async ({ where, select }: { where: Row; select?: Row }) => db.project(db.attempts.find((x) => x.id === where.id) as Row, select),
        createMany: async ({ data }: { data: Row[] }) => {
          for (const d of data) db.attempts.push({ id: db.id('va'), answer: null, chosenText: null, responseMs: null, flagged: false, answeredAt: null, refType: null, refId: null, exampleSnap: null, exampleKoSnap: null, ...d })
          return { count: data.length }
        },
        update: async ({ where, data }: { where: Row; data: Row }) => {
          Object.assign(db.attempts.find((x) => x.id === where.id) as Row, data)
          return {}
        },
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          const hit = db.attempts.filter((a) => db.matchAttempt(a, where))
          for (const a of hit) Object.assign(a, data)
          return { count: hit.length }
        },
        count: async ({ where }: { where: Row }) => db.attempts.filter((a) => db.matchAttempt(a, where)).length,
        groupBy: async ({ where }: { where: Row }) => {
          const m = new Map<string, number>()
          for (const a of db.attempts.filter((x) => db.matchAttempt(x, where))) m.set(`${a.sessionId}|${a.refType}`, (m.get(`${a.sessionId}|${a.refType}`) ?? 0) + 1)
          return [...m].map(([k, n]) => ({ sessionId: k.split('|')[0], refType: k.split('|')[1], _count: { _all: n } }))
        },
      },
      wordEntry: {
        findMany: async ({ where }: { where: Row }) => db.words.filter((w) => matchWhere(w, where, db.states)),
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
          db.ops.push('word:updateMany')
          const hit = db.words.filter((w) => matchWhere(w, where, db.states))
          for (const w of hit) {
            for (const [k, v] of Object.entries(data)) w[k] = v && typeof v === 'object' && 'increment' in v ? (w[k] as number) + (v as { increment: number }).increment : v
          }
          return { count: hit.length }
        },
      },
      userWordState: fakeUserWordState(db, db.ops),
      repetitionItem: {
        findMany: async ({ where }: { where: Row }) =>
          db.rep.filter((r) => r.userId === where.userId && ((where.OR as Row[] | undefined) ?? []).some((o) => o.refType === r.refType && (typeof o.refId === 'string' ? o.refId === r.refId : (o.refId as { in: string[] }).in.includes(r.refId as string)))),
        create: async ({ data }: { data: Row }) => {
          const row = { id: db.id('ri'), ...data }
          db.rep.push(row)
          return { id: row.id }
        },
        update: async () => ({}),
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
      learningObservation: {
        createMany: async ({ data }: { data: Row[] }) => {
          db.observations.push(...data)
          return { count: data.length }
        },
      },
    } as unknown as Tx
}

type Created = Extract<CreateSessionResult, { session: object }>
const created = (r: CreateSessionResult): Created => {
  assert.ok(r.session, `세트가 만들어져야 한다: ${JSON.stringify(r)}`)
  return r as Created
}

const wordSet = (db: FakeDb, body: Record<string, unknown> = {}, count = 6) => {
  const input = parseCreateSessionBody(body)
  return composeWordSessionLocked(db.tx(), U, { count, mode: input.mode, category: input.category }, undefined, NOW).then(created)
}

const attempt = (db: FakeDb, sessionId: string, body: Record<string, unknown>, userId = U) => recordAttempt(userId, sessionId, parseAttemptBody(body), db.run())

/** 카드의 정답 뜻(가짜 DB 의 스냅샷) — 화면은 이 값을 모른다고 가정하지만 시험은 채점 확인에 쓴다. */
const meaningAt = (db: FakeDb, sessionId: string, order: number) => db.rowsOf(sessionId)[order].meaningSnap as string
const wrongChoiceAt = (db: FakeDb, sessionId: string, order: number) => (db.rowsOf(sessionId)[order].choices as string[]).find((c) => c !== meaningAt(db, sessionId, order)) as string

function assertCardChoices(card: VocabCardDto, meaning: string): void {
  assert.equal(card.choices?.length, 4, `${card.surface} 보기 4개`)
  assert.equal(new Set(card.choices).size, 4, `${card.surface} 보기는 서로 다른 문자열`)
  assert.ok(card.choices?.includes(meaning), `${card.surface} 보기에 정답 포함`)
}

beforeEach(() => resetTopicWordsStateForTest())

// ── 1. #47 기본 방식·카드 우선 보기 ───────────────────────────────────────────────

test('#47 본문: mode 생략 기본 FLIP(내 단어장·주제 모두), CHOICE 는 명시할 때만', () => {
  assert.equal(parseCreateSessionBody({}).mode, 'FLIP')
  assert.equal(parseCreateSessionBody({ topicId: TOPIC }).mode, 'FLIP')
  assert.equal(parseCreateSessionBody({ mode: 'CHOICE' }).mode, 'CHOICE')
  assert.equal(parseCreateSessionBody({ mode: 'FLIP', count: 10 }).mode, 'FLIP')
})

test('#47 카드 우선(FLIP): 카드마다 보기 4개(정답 포함·서로 다름) + 뜻·예문 처음부터, DB 스냅샷 = 응답, 강등 표시 없음', async () => {
  const db = new FakeDb()
  const r = await wordSet(db)
  assert.equal(r.session.mode, 'FLIP')
  assert.equal(r.session.downgraded, false)
  assert.equal(requestedModeOf(db.sessions.at(-1)?.seed as string), 'FLIP')
  assert.equal(r.cards.length, 6)
  const rows = db.rowsOf(r.session.id)
  for (const c of r.cards) {
    const row = rows[c.order]
    assertCardChoices(c, row.meaningSnap as string)
    assert.deepEqual(row.choices, c.choices, 'VocabAttempt.choices 스냅샷 = 응답 보기')
    assert.equal(c.meaning, row.meaningSnap, 'FLIP 은 뜻을 처음부터')
    assert.equal(c.example, `${c.surface}の例文。`)
    assert.equal('answer' in c || 'correctText' in c || 'chosenText' in c, false, '미답 카드에 채점 필드 없음')
  }
})

test('#47 보기 셔플: 정답 자리가 한 곳에 고정되지 않는다(세트 4개 × 6장)', async () => {
  const positions = new Set<number>()
  for (let i = 0; i < 4; i++) {
    const db = new FakeDb()
    const r = await wordSet(db)
    for (const c of r.cards) positions.add((c.choices as string[]).indexOf(c.meaning as string))
  }
  assert.ok(positions.size >= 2, `positions=${[...positions]}`)
})

test('#47 보기 재료 부족 → 세트 전체 보기 없음(키 없음·DB null), 강등 표시 없음 — 풀 <4 · 단어 <4 · 서로 다른 뜻 <4', async () => {
  const cases: [string, (db: FakeDb) => void][] = [
    ['단어 3개', (db) => (db.words = db.words.slice(0, 3))],
    ['풀 3개(오늘 끝낸 3개 제외)', (db) => db.doneToday(['w4', 'w5', 'w6'])],
    ['서로 다른 뜻 3개', (db) => db.words.forEach((w, i) => (w.meaning = ['먹다', '가다', '물'][i % 3]))],
  ]
  for (const [name, setup] of cases) {
    const db = new FakeDb()
    setup(db)
    const r = await wordSet(db)
    assert.equal(r.session.mode, 'FLIP', name)
    assert.equal(r.session.downgraded, false, name)
    assert.ok(r.cards.length > 0, name)
    for (const c of r.cards) {
      assert.equal('choices' in c, false, `${name} — ${c.surface} 보기 키 없음`)
      assert.equal(typeof c.meaning, 'string', `${name} — 뜻은 그대로`)
    }
    assert.ok(db.rowsOf(r.session.id).every((a) => a.choices == null), `${name} — DB choices 전부 null`)
  }
})

test('#47 CHOICE 명시 호환: 보기 4개·정답/뜻/예문 미노출 그대로 · 재료 부족이면 이전처럼 FLIP 강등(downgraded, 보기 없음)', async () => {
  const db = new FakeDb()
  const r = await wordSet(db, { mode: 'CHOICE' })
  assert.equal(r.session.mode, 'CHOICE')
  assert.equal(r.session.downgraded, false)
  for (const c of r.cards) {
    assert.deepEqual(Object.keys(c).sort(), ['answered', 'choices', 'flagged', 'order', 'reading', 'surface', 'wordId'].sort(), '미답 CHOICE 카드 키 그대로')
    assertCardChoices(c, meaningAt(db, r.session.id, c.order))
  }
  const few = new FakeDb()
  few.words = few.words.slice(0, 3)
  const d = await wordSet(few, { mode: 'CHOICE' })
  assert.equal(d.session.mode, 'FLIP')
  assert.equal(d.session.downgraded, true, '요청 CHOICE → FLIP 은 이전처럼 강등')
  assert.ok(d.cards.every((c) => !('choices' in c)), '강등된 FLIP 세트는 보기 없음(카드 우선 보기를 만들지 않는다)')
})

const topicDeps = (db: FakeDb): Partial<TopicSetDeps> => ({ db: db.tx(), transaction: (fn) => fn(db.tx()), now: () => NOW.getTime(), trace: () => {}, wallMs: 30_000 })

test('#47 주제 세트(기본 FLIP): 같은 insertSession 규칙 — 보기 4개, 재료 부족이면 세트 전체 보기 없음', async () => {
  const deps = topicDeps
  const db = new FakeDb()
  const input = parseCreateSessionBody({ topicId: TOPIC, generate: false })
  const r = created(await createVocabSession(U, { count: 6, mode: input.mode, category: null, topicId: input.topicId, generate: false }, { deps: deps(db) }))
  assert.equal(r.session.mode, 'FLIP')
  assert.equal(r.session.downgraded, false)
  assert.equal(r.session.topic?.id, TOPIC)
  const rows = db.rowsOf(r.session.id)
  for (const c of r.cards) {
    assertCardChoices(c, rows[c.order].meaningSnap as string)
    assert.equal(c.meaning, rows[c.order].meaningSnap)
  }
  const thin = new FakeDb()
  thin.chunks = thin.chunks.slice(0, 3)
  thin.words = []
  const t = created(await createVocabSession(U, { count: 6, mode: 'FLIP', category: null, topicId: TOPIC, generate: false }, { deps: deps(thin) }))
  assert.equal(t.cards.length, 3)
  assert.ok(t.cards.every((c) => !('choices' in c)), '뜻 3개뿐 — 보기 없음')
  assert.ok(thin.rowsOf(t.session.id).every((a) => a.choices == null))
  assert.equal(t.session.downgraded, false)
})

test('toCardDto: FLIP 보기는 있을 때만 키(없음·null·빈 배열 → 키 없음), CHOICE 는 늘 키', () => {
  const base = { order: 0, wordId: 'w1', surfaceSnap: '映画', readingSnap: 'えいが', meaningSnap: '영화', answer: null, chosenText: null, flagged: false, answeredAt: null, word: null, exampleSnap: null, exampleKoSnap: null }
  const four = ['음악', '영화', '사진', '여행']
  assert.deepEqual(toCardDto('FLIP', 'IN_PROGRESS', { ...base, choices: four }).choices, four)
  for (const choices of [null, []]) assert.equal('choices' in toCardDto('FLIP', 'IN_PROGRESS', { ...base, choices }), false, JSON.stringify(choices))
  assert.deepEqual(toCardDto('CHOICE', 'IN_PROGRESS', { ...base, choices: null }).choices, [], 'CHOICE 는 이전 그대로(빈 배열)')
  const flip = toCardDto('FLIP', 'IN_PROGRESS', { ...base, choices: four })
  assert.equal(flip.meaning, '영화')
  assert.equal(flip.correctText, undefined, 'FLIP 미답 카드는 채점 필드 없음')
})

// ── 2. #50 혼합 수용 ─────────────────────────────────────────────────────────────

test('#50 FLIP 세트 보기 답: 서버 채점(정답 CORRECT·다른 보기 WRONG), chosenText 기록, 응답은 CHOICE 와 같은 모양', async () => {
  const db = new FakeDb()
  const r = await wordSet(db)
  const ok = await attempt(db, r.session.id, { order: 0, chosenText: meaningAt(db, r.session.id, 0), responseMs: 1200 })
  assert.ok('answer' in ok)
  assert.equal(ok.answer, 'CORRECT')
  assert.equal(ok.correctText, meaningAt(db, r.session.id, 0))
  assert.equal(ok.chosenText, meaningAt(db, r.session.id, 0))
  assert.equal(typeof ok.example, 'string')
  const wrongPick = wrongChoiceAt(db, r.session.id, 1)
  const ng = await attempt(db, r.session.id, { order: 1, chosenText: wrongPick, responseMs: 900 })
  assert.ok('answer' in ng)
  assert.deepEqual([ng.answer, ng.chosenText, ng.correctText], ['WRONG', wrongPick, meaningAt(db, r.session.id, 1)])
  const rows = db.rowsOf(r.session.id)
  assert.deepEqual([rows[0].answer, rows[0].chosenText, rows[0].responseMs], ['CORRECT', meaningAt(db, r.session.id, 0), 1200])
  assert.deepEqual([rows[1].answer, rows[1].chosenText], ['WRONG', wrongPick])
})

test('#50 FLIP 세트 자기 채점은 그대로(chosenText 없음) · 보기에 없는 답 400 not_in_choices(행 변화 없음)', async () => {
  const db = new FakeDb()
  const r = await wordSet(db)
  const self = await attempt(db, r.session.id, { order: 2, selfResult: 'WRONG', responseMs: 3000 })
  assert.ok('answer' in self)
  assert.deepEqual([self.answer, self.chosenText], ['WRONG', null])
  await assert.rejects(attempt(db, r.session.id, { order: 3, chosenText: '없는 보기' }), code('VALIDATION', 'not_in_choices', 'chosenText'))
  assert.equal(db.rowsOf(r.session.id)[3].answer, null)
})

test('#50 보기 없는 FLIP 세트(이전 뒤집기·재료 부족)에 chosenText → 400 not_in_choices (뜻 문자열을 보내도)', async () => {
  const db = new FakeDb()
  db.words = db.words.slice(0, 3)
  const r = await wordSet(db)
  await assert.rejects(attempt(db, r.session.id, { order: 0, chosenText: meaningAt(db, r.session.id, 0) }), code('VALIDATION', 'not_in_choices', 'chosenText'))
  assert.equal(db.rowsOf(r.session.id)[0].answer, null)
  const self = await attempt(db, r.session.id, { order: 0, selfResult: 'CORRECT' })
  assert.ok('answer' in self && self.answer === 'CORRECT', '자기 채점은 된다')
})

test('#50 CHOICE 세트: selfResult 는 계속 400 mode · 보기 답은 그대로 채점', async () => {
  const db = new FakeDb()
  const r = await wordSet(db, { mode: 'CHOICE' })
  await assert.rejects(attempt(db, r.session.id, { order: 0, selfResult: 'CORRECT' }), code('VALIDATION', 'mode', 'selfResult'))
  assert.equal(db.rowsOf(r.session.id)[0].answer, null)
  const ok = await attempt(db, r.session.id, { order: 0, chosenText: meaningAt(db, r.session.id, 0) })
  assert.ok('answer' in ok && ok.answer === 'CORRECT')
})

test('#50 두 답을 같이 보내면 one_answer(모드 검사보다 먼저) · 같은 order 재전송은 다른 방식이어도 첫 결과 그대로', async () => {
  assert.throws(() => parseAttemptBody({ order: 0, chosenText: '먹다', selfResult: 'CORRECT' }), code('VALIDATION', 'one_answer', 'selfResult'))
  const db = new FakeDb()
  const r = await wordSet(db)
  const first = await attempt(db, r.session.id, { order: 0, selfResult: 'WRONG' })
  const again = await attempt(db, r.session.id, { order: 0, chosenText: meaningAt(db, r.session.id, 0) })
  assert.deepEqual(again, first, '자기 채점 뒤 보기 답 → 첫 결과')
  const firstChoice = await attempt(db, r.session.id, { order: 1, chosenText: wrongChoiceAt(db, r.session.id, 1) })
  const againSelf = await attempt(db, r.session.id, { order: 1, selfResult: 'CORRECT' })
  assert.deepEqual(againSelf, firstChoice, '보기 답 뒤 자기 채점 → 첫 결과')
  const rows = db.rowsOf(r.session.id)
  assert.deepEqual([rows[0].answer, rows[0].chosenText, rows[1].answer], ['WRONG', null, 'WRONG'])
})

test('#50 끝난 세트 409 · 남의 세트 404', async () => {
  const db = new FakeDb()
  const r = await wordSet(db)
  await assert.rejects(attempt(db, r.session.id, { order: 0, chosenText: meaningAt(db, r.session.id, 0) }, OTHER), code('NOT_FOUND'))
  await attempt(db, r.session.id, { order: 0, selfResult: 'CORRECT' })
  await finishVocabSessionDetailed(U, r.session.id, db.run())
  await assert.rejects(attempt(db, r.session.id, { order: 1, chosenText: meaningAt(db, r.session.id, 1) }), code('CONFLICT'))
})

// ── 3. #49 복원 · #51 혼합 합산 ─────────────────────────────────────────────────

/** Q9 5장 예: 0 스스로 알았어요 · 1 보기 정답 · 2 보기 오답 · 3 스스로 몰랐어요 · 4 표시만(끝낼 때 건너뜀). */
async function mixedSet(db: FakeDb): Promise<Created> {
  const r = await wordSet(db, {}, 5)
  await attempt(db, r.session.id, { order: 0, selfResult: 'CORRECT', responseMs: 2000 })
  await attempt(db, r.session.id, { order: 1, chosenText: meaningAt(db, r.session.id, 1), responseMs: 2100 })
  await attempt(db, r.session.id, { order: 2, chosenText: wrongChoiceAt(db, r.session.id, 2), responseMs: 2200 })
  await attempt(db, r.session.id, { order: 3, selfResult: 'WRONG', responseMs: 2300 })
  await attempt(db, r.session.id, { order: 4, flagged: true })
  return r
}

// ── task-068 T28: 세트 풀 = 내 단어 + 공용 기본 단어(내가 보관 안 한 것) · 끝내기 카운터는 나의 UserWordState 에만 ──────────────

const asBase = (db: FakeDb) => db.words.forEach((w) => Object.assign(w, { userId: null, source: 'SEED' }))

test('T28 풀: 기본 단어도 풀에 들어오고, 내가 보관한 기본 단어만 빠진다(다른 사용자의 보관·상태는 내 풀과 무관)', async () => {
  const mine = new FakeDb()
  asBase(mine)
  mine.words.push(wordRow(['m1', '駅', 'えき', '역', 'NOUN']), wordRow(['x1', '他人', 'たにん', '남', 'NOUN'], { userId: 'user-2' }))
  mine.states.push(stateRow(U, 'w1', { archived: true }), stateRow('user-2', 'w2', { archived: true }))
  const ids = (await wordSet(mine, {}, 30)).cards.map((c) => c.wordId).sort()
  assert.deepEqual(ids, ['m1', 'w2', 'w3', 'w4', 'w5', 'w6'], '내 단어 m1 + 기본 단어(내가 보관한 w1 제외 — user-2 가 보관한 w2 는 있음) · 남의 단어 x1 없음')
  const other = new FakeDb()
  asBase(other)
  other.states.push(stateRow('user-2', 'w1', { archived: true }))
  assert.equal((await wordSet(other, {}, 30)).cards.some((c) => c.wordId === 'w1'), true, '남(user-2)이 보관한 기본 단어는 내 풀에 그대로')
})

test('T28 빈 풀: 보이는 단어를 모두 보관하면 NO_WORDS · cta 는 [ADD_WORD] 하나(기본 단어 넣기 SEED_PACK 없음 — L7)', async () => {
  const db = new FakeDb()
  asBase(db)
  db.states.push(...db.words.map((w) => stateRow(U, w.id as string, { archived: true })))
  const r = await composeWordSessionLocked(db.tx(), U, { count: 10, mode: 'FLIP', category: null }, undefined, NOW)
  assert.deepEqual(r, { session: null, empty: { reason: 'NO_WORDS', cta: ['ADD_WORD'] } })
})

test('T28 풀 가중 상태: 나의 보관 안 한 상태 행만 읽는다(where = {userId: 나, archived: false}) — 풀 id 를 IN 으로 보내지 않음', async () => {
  const db = new FakeDb()
  asBase(db)
  const seen: Row[] = []
  const tx = db.tx() as unknown as Record<string, Record<string, (a: Row) => Promise<unknown>>>
  const orig = tx.userWordState.findMany
  tx.userWordState.findMany = async (a: Row) => (seen.push(a.where as Row), orig(a))
  await composeWordSessionLocked(tx as unknown as Tx, U, { count: 5, mode: 'FLIP', category: null }, undefined, NOW)
  assert.deepEqual(seen, [{ userId: U, archived: false }])
})

test('T28 끝내기(기본 단어 카드): 카운터는 나의 UserWordState 에만 생기고, 공용 행·다른 사용자 상태는 그대로', async () => {
  const db = new FakeDb()
  asBase(db)
  db.states.push(stateRow('user-2', 'w1', { wrongCount: 7 }), stateRow('user-2', 'w2', { correctCount: 3 }))
  const r = await mixedSet(db)
  const wid = (o: number) => db.rowsOf(r.session.id)[o].wordId as string
  await finishVocabSessionDetailed(U, r.session.id, db.run())
  assert.equal(db.states.filter((x) => x.userId === U).length, 5, '답한·건너뛴 카드 5장 = 내 상태 행 5개')
  assert.deepEqual([db.st(wid(0)).correctCount, db.st(wid(1)).correctCount, db.st(wid(2)).wrongCount, db.st(wid(3)).wrongCount, db.st(wid(4)).lastResult], [1, 1, 1, 1, 'SKIPPED'])
  assert.deepEqual(db.states.filter((x) => x.userId === 'user-2').map((x) => [x.wordId, x.correctCount, x.wrongCount, x.lastResult]), [['w1', 0, 7, null], ['w2', 3, 0, null]])
  assert.equal(db.ops.includes('word:updateMany'), false)
  assert.deepEqual(db.words.map((w) => [w.userId, w.correctCount, w.wrongCount, w.lastSeenAt, w.lastResult]), db.words.map(() => [null, 0, 0, null, null]))
})

test('T28 분류 세트: 분류 이름이 기본 단어의 분류와 같으면 기본 단어도 후보(보관한 것만 빠짐) · 내 분류는 내 단어만', async () => {
  const seed = () => {
    const db = new FakeDb()
    asBase(db)
    for (const w of db.words) w.category = '초보자 (N5)'
    db.words.push(wordRow(['m1', '駅', 'えき', '역', 'NOUN'], { category: '내 분류' }))
    return db
  }
  const db = seed()
  db.states.push(stateRow(U, 'w1', { archived: true }))
  const ids = (await wordSet(db, { category: '초보자 (N5)' }, 30)).cards.map((c) => c.wordId).sort()
  assert.deepEqual(ids, ['w2', 'w3', 'w4', 'w5', 'w6'], '같은 분류의 기본 단어(내가 보관한 w1 제외) — 다른 분류인 내 단어 m1 은 없다')
  assert.deepEqual((await wordSet(seed(), { category: '내 분류' }, 30)).cards.map((c) => c.wordId), ['m1'])
})

test('T28 주제 세트 뜻 보기 재료: 기본 단어의 뜻도 보기 원천(내 단어가 없어도 보기 4개), 내가 보관한 기본 단어는 재료에서 빠진다', async () => {
  const run = async (archive: string[]) => {
    const db = new FakeDb()
    asBase(db)
    db.chunks = db.chunks.slice(0, 2) // 주제 풀 뜻은 2개 — 나머지 보기는 단어장(기본 단어)에서만 온다
    db.states.push(...archive.map((id) => stateRow(U, id, { archived: true })))
    return { db, r: created(await createVocabSession(U, { count: 6, mode: 'FLIP', category: null, topicId: TOPIC, generate: false }, { deps: topicDeps(db) })) }
  }
  const open = await run([])
  assert.equal(open.r.cards.length, 2)
  for (const c of open.r.cards) assertCardChoices(c, open.db.rowsOf(open.r.session.id)[c.order].meaningSnap as string)
  const shut = await run(['w1', 'w2', 'w3', 'w4', 'w5']) // 남은 기본 단어 1개 + 주제 풀 2개 = 서로 다른 뜻 3개 < 4
  assert.ok(shut.r.cards.every((c) => !('choices' in c)), '보관한 기본 단어는 보기 재료가 아니다')
})

test('T28 다시 풀기(주제 세트) 뜻 보기 재료: 기본 단어의 뜻을 쓰고, 내가 보관한 기본 단어는 뺀다', async () => {
  const run = async (archive: string[]) => {
    const db = new FakeDb()
    asBase(db)
    db.chunks = db.chunks.slice(0, 2)
    const src = created(await createVocabSession(U, { count: 6, mode: 'FLIP', category: null, topicId: TOPIC, generate: false }, { deps: topicDeps(db) }))
    await attempt(db, src.session.id, { order: 0, skipped: true })
    await finishVocabSessionDetailed(U, src.session.id, db.run())
    ;(db.sessions.find((s) => s.id === src.session.id) as Row).keptAt = NOW
    db.states.push(...archive.map((id) => stateRow(U, id, { archived: true })))
    return { db, rep: await replayVocabSession(U, src.session.id, db.run()) }
  }
  const open = await run([])
  assert.equal(open.rep.session.topic?.id, TOPIC)
  for (const c of open.rep.cards) assertCardChoices(c, open.db.rowsOf(open.rep.session.id)[c.order].meaningSnap as string)
  const shut = await run(['w1', 'w2', 'w3', 'w4', 'w5'])
  assert.ok(shut.rep.cards.every((c) => !('choices' in c)), '보관한 기본 단어는 다시 풀기 보기 재료도 아니다')
})

test('T28 다시 풀기(단어 세트) 뜻 보기 재료: 모든 단어가 기본 단어여도 보기 4개 · 보관한 기본 단어는 재료에서 빠진다', async () => {
  const run = async (archive: string[]) => {
    const db = new FakeDb()
    asBase(db)
    const src = await keptSet(db, {})
    db.states.push(...archive.map((id) => stateRow(U, id, { archived: true })))
    return { db, rep: await replayVocabSession(U, src.session.id, db.run()) }
  }
  const open = await run([])
  for (const c of open.rep.cards) assertCardChoices(c, open.db.rowsOf(open.rep.session.id)[c.order].meaningSnap as string)
  const shut = await run(['w1', 'w2', 'w3']) // 보이는 단어 6 → 3 이라 서로 다른 뜻 3개 < 4 — 카드(보관 무시)는 그대로, 보기만 없다
  assert.equal(shut.rep.cards.length, 5)
  assert.ok(shut.rep.cards.every((c) => !('choices' in c)))
})

test('#49 새로고침 복원: 보기로 답한 카드 = chosenText·choices·answer·correctText, 스스로 답한 카드 = chosenText null, 미답 = 보기·뜻만', async () => {
  const db = new FakeDb()
  const r = await mixedSet(db)
  const read = await readVocabSessionTx(db.tx(), U, r.session.id)
  assert.equal(read.session.mode, 'FLIP')
  const [c0, c1, c2, , c4] = read.cards
  assert.deepEqual([c0.answered, c0.answer, c0.chosenText], [true, 'CORRECT', null])
  assert.deepEqual([c1.answer, c1.chosenText, c1.correctText], ['CORRECT', meaningAt(db, r.session.id, 1), meaningAt(db, r.session.id, 1)])
  assert.deepEqual([c2.answer, c2.chosenText], ['WRONG', wrongChoiceAt(db, r.session.id, 2)])
  for (const c of read.cards) assertCardChoices(c, meaningAt(db, r.session.id, c.order))
  assert.deepEqual(read.cards.map((c) => c.choices), r.cards.map((c) => c.choices), '보기는 생성 때와 같다(스냅샷)')
  assert.deepEqual([c4.answered, c4.flagged, 'answer' in c4, 'chosenText' in c4, c4.meaning], [false, true, false, false, meaningAt(db, r.session.id, 4)])
  assert.equal(read.cards.filter((c) => c.chosenText != null).length, 2, '화면이 세는 「객관식으로 답한 카드」 = 2')
})

test('#51 혼합 세트 끝내기: 답한 방식과 무관하게 합산(맞힘 2·틀림 2·건너뜀 1) · 나의 UserWordState 카운터 · 반복 항목·관측·스냅샷 · 요약 「카드」', async () => {
  const db = new FakeDb()
  const r = await mixedSet(db)
  const wid = (o: number) => db.rowsOf(r.session.id)[o].wordId as string
  const done = await finishVocabSessionDetailed(U, r.session.id, db.run())
  assert.equal(done.finishedNow, true)
  assert.deepEqual([done.result.session.status, done.result.session.correctCount, done.result.session.wrongCount, done.result.session.skippedCount], ['DONE', 2, 2, 1])
  assert.equal(done.result.flaggedCount, 1)
  assert.deepEqual(done.result.wrongWords.map((w) => w.wordId).sort(), [wid(2), wid(3)].sort())
  assert.deepEqual([db.st(wid(0)).correctCount, db.st(wid(1)).correctCount, db.st(wid(2)).wrongCount, db.st(wid(3)).wrongCount], [1, 1, 1, 1])
  assert.deepEqual([db.st(wid(0)).lastResult, db.st(wid(1)).lastResult, db.st(wid(2)).lastResult, db.st(wid(3)).lastResult, db.st(wid(4)).lastResult], ['CORRECT', 'CORRECT', 'WRONG', 'WRONG', 'SKIPPED'])
  assert.deepEqual([db.st(wid(4)).correctCount, db.st(wid(4)).wrongCount], [0, 0], '건너뜀은 카운터 그대로')
  assert.equal(db.ops.includes('word:updateMany'), false, 'task-068: 단어 행(WordEntry) 카운터는 쓰지 않는다')
  assert.deepEqual(db.words.map((w) => [w.correctCount, w.wrongCount, w.lastResult]), db.words.map(() => [0, 0, null]))
  assert.equal(db.rowsOf(r.session.id).filter((a) => a.chosenText != null).length, 2, 'chosenText 는 보기로 답한 2행만')
  assert.equal(db.logs.length, 1)
  assert.equal(db.logs[0].summary, '오늘의 단어 5장(카드) · 맞힘 2 · 틀림 2 · 건너뜀 1')
  const snap = db.snapshots.find((s) => s.kind === 'VOCAB_SESSION') as Row
  assert.deepEqual([(snap.data as Row).correct, (snap.data as Row).wrong, (snap.data as Row).skipped, (snap.data as Row).mode], [2, 2, 1, 'FLIP'])
  assert.equal(db.rep.length, 4, '반복 항목은 답한 카드(맞힘·틀림)만')
  assert.deepEqual(db.observations.map((o) => o.outcome), ['SUCCESS', 'SUCCESS', 'FAIL', 'FAIL', 'SKIPPED'])
})

test('#51 요약 방식 문구: CHOICE 세트 「보기 고르기」 그대로', async () => {
  const db = new FakeDb()
  const r = await wordSet(db, { mode: 'CHOICE' }, 5)
  await attempt(db, r.session.id, { order: 0, chosenText: meaningAt(db, r.session.id, 0) })
  await finishVocabSessionDetailed(U, r.session.id, db.run())
  assert.equal(db.logs[0].summary, '오늘의 단어 5장(보기 고르기) · 맞힘 1 · 틀림 0 · 건너뜀 4')
})

// ── 4. #53 다시 풀기 새 방식 ─────────────────────────────────────────────────────

async function keptSet(db: FakeDb, body: Record<string, unknown>): Promise<Created> {
  const r = await wordSet(db, body, 5)
  await attempt(db, r.session.id, { order: 0, skipped: true })
  await finishVocabSessionDetailed(U, r.session.id, db.run())
  ;(db.sessions.find((s) => s.id === r.session.id) as Row).keptAt = NOW
  return r
}

test('#53 원래 CHOICE 인 보관 세트 → 새 세트는 카드 우선(FLIP + 보기 4개 + 뜻), 강등 표시 없음, 새 시드', async () => {
  const db = new FakeDb()
  const src = await keptSet(db, { mode: 'CHOICE' })
  const rep = await replayVocabSession(U, src.session.id, db.run())
  assert.equal(rep.session.mode, 'FLIP')
  assert.equal(rep.session.downgraded, false)
  assert.equal(rep.session.replayOfId, src.session.id)
  const newRow = db.sessions.at(-1) as Row
  const srcRow = db.sessions.find((s) => s.id === src.session.id) as Row
  assert.equal(requestedModeOf(newRow.seed as string), 'FLIP')
  assert.notEqual(newRow.seed, srcRow.seed)
  assert.deepEqual(rep.cards.map((c) => c.wordId).sort(), src.cards.map((c) => c.wordId).sort(), '같은 단어 목록')
  const rows = db.rowsOf(rep.session.id)
  for (const c of rep.cards) {
    assertCardChoices(c, rows[c.order].meaningSnap as string)
    assert.equal(c.meaning, rows[c.order].meaningSnap)
    assert.deepEqual(rows[c.order].choices, c.choices)
  }
  const ok = await attempt(db, rep.session.id, { order: 0, chosenText: meaningAt(db, rep.session.id, 0) })
  assert.ok('answer' in ok && ok.answer === 'CORRECT', '다시 푼 세트도 보기 답을 받는다')
})

test('#53 주제 CHOICE 세트 다시 풀기 → 주제 세트 그대로 + 카드 우선(FLIP·강등 표시 없음·보기 4개·뜻), 보기 답 채점', async () => {
  const db = new FakeDb()
  const src = created(await createVocabSession(U, { count: 6, mode: 'CHOICE', category: null, topicId: TOPIC, generate: false }, { deps: topicDeps(db) }))
  assert.equal(src.session.mode, 'CHOICE')
  await attempt(db, src.session.id, { order: 0, chosenText: meaningAt(db, src.session.id, 0) })
  await finishVocabSessionDetailed(U, src.session.id, db.run())
  ;(db.sessions.find((s) => s.id === src.session.id) as Row).keptAt = NOW
  const rep = await replayVocabSession(U, src.session.id, db.run())
  assert.deepEqual([rep.session.mode, rep.session.downgraded, rep.session.replayOfId, rep.session.topic?.id], ['FLIP', false, src.session.id, TOPIC])
  assert.equal(requestedModeOf((db.sessions.at(-1) as Row).seed as string), 'FLIP')
  const rows = db.rowsOf(rep.session.id)
  for (const c of rep.cards) {
    assertCardChoices(c, rows[c.order].meaningSnap as string)
    assert.equal(c.meaning, rows[c.order].meaningSnap)
  }
  const ng = await attempt(db, rep.session.id, { order: 1, chosenText: wrongChoiceAt(db, rep.session.id, 1) })
  assert.ok('answer' in ng && ng.answer === 'WRONG')
})

test('#53 원래 FLIP 은 FLIP — 삭제된 단어(Snap) 카드도 같은 규칙으로 보기를 만든다', async () => {
  const db = new FakeDb()
  const src = await keptSet(db, {})
  const gone = db.rowsOf(src.session.id)[0]
  db.words = db.words.filter((w) => w.id !== gone.wordId)
  for (const a of db.attempts) if (a.wordId === gone.wordId) a.wordId = null
  const rep = await replayVocabSession(U, src.session.id, db.run())
  assert.equal(rep.session.mode, 'FLIP')
  assert.equal(rep.session.downgraded, false, '삭제 단어가 있어도 강등 없음(이전 E4 대체)')
  const deleted = rep.cards.find((c) => c.wordId === null) as VocabCardDto
  assert.ok(deleted, '삭제된 단어 카드')
  assert.equal(deleted.meaning, gone.meaningSnap)
  for (const c of rep.cards) assertCardChoices(c, c.meaning as string)
})

test('#53 뜻 재료가 한 카드라도 모자라면 세트 전체 보기 없음(카드마다 섞이지 않는다)', async () => {
  const db = new FakeDb()
  db.sessions.push({ id: 'vs-old', userId: U, mode: 'CHOICE', status: 'DONE', keptAt: NOW, cardCount: 2, topicId: null, replayOfId: null, startedAt: NOW, date: dates.toDbDate(TODAY), seed: 'Cold', requestedCount: 2 })
  db.attempts.push(
    { id: 'a1', sessionId: 'vs-old', order: 0, wordId: 'w1', surfaceSnap: '食べる', readingSnap: 'たべる', meaningSnap: '먹다', answer: 'CORRECT', refType: null, refId: null },
    { id: 'a2', sessionId: 'vs-old', order: 1, wordId: null, surfaceSnap: '消えた', readingSnap: 'きえた', meaningSnap: '사라짐', answer: 'WRONG', refType: null, refId: null },
  )
  // 남은 단어의 뜻 3개 — 삭제 카드(사라짐)는 다른 뜻 3개로 보기를 만들 수 있지만, 먹다 카드는 오답 2개뿐이라 못 만든다.
  db.words = db.words.slice(0, 3)
  const rep = await replayVocabSession(U, 'vs-old', db.run())
  assert.equal(rep.session.mode, 'FLIP')
  assert.ok(rep.cards.every((c) => !('choices' in c)), '세트 전체 보기 없음')
  assert.ok(db.rowsOf(rep.session.id).every((a) => a.choices == null))
  assert.ok(rep.cards.every((c) => typeof c.meaning === 'string'))
})
