/**
 * task-064 dev-S1 — `learning/recordRetrieval`(api-contract §2-18-A 3·5·9항). 메모리 DB 로만(공유 DB 를 읽지 않는다).
 * ① 격리(타 사용자 0건) ② D2=(b) 부정 시험(동의 문구 밖: 단어장 단어·교정 설명·역할극 표현·대화·발화 원문·PROPOSED/REJECTED 교정·내부 id·금지 칸 0건)
 * ③ 상한(건수·총 글자·항목 글자·truncated) ④ GENERAL = 함수 0·빈 결과 ⑤ KST 범위 경계 ⑥ 키 형식·sourceMap 일치 + resolveSourceKeys 재검증.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allowedSourceTypes,
  RECORD_RETRIEVAL_LIMITS,
  RECORD_SOURCE_TYPES,
  resolveSourceKeys,
  retrievalPlan,
  retrieveRecords,
  type AcceptedCorrectionQuery,
  type AcceptedCorrectionReader,
  type AcceptedCorrectionRow,
  type AskIntent,
  type AskScopeKey,
  type RetrievalResult,
  type RolePlayReader,
  type RolePlayRow,
} from '..'
import { assemble } from '../assemble'
import { mondayOf, resolveRange } from '../range'
import { getLessonsByTopic, getSkillState, type Candidate, type RetrievalCtx } from '../sources'
import { normalizeTerms } from '../text'
import { dbDate, kst, matches, retrievalFakeDb, TABLES, type RetrievalFake, type TableName } from './fakeDb'

const U = 'cuserask0000000000000000u1'
const U2 = 'cuserask0000000000000000u2'
const EMAIL = 'learner@example.com'
const NOW = kst('2026-10-08 12:00') // 목요일 — 이번 주 = 10-05(월)~10-11(일)

const cp = (s: string) => Array.from(s).length

function daily(over: Record<string, unknown> = {}) {
  return { attended: true, words: { sessions: 1, correct: 8, wrong: 2 }, talkTurns: 4, chatTurns: 2, corrections: { proposed: 3, accepted: 1 }, lessons: 1, reviews: 0, evals: 0, repetition: { studied: 2, focus: 0 }, ...over }
}

function lessonContent(tag: string, chunks?: { textJa: string; meaningKo: string }[]) {
  return {
    v: 1,
    title: `${tag} 레슨`,
    titleKo: `${tag} 레슨`,
    rolesKo: { A: '손님', B: '점원' },
    dialogue: [{ speaker: 'A', ja: `SECRET_DIALOGUE_${tag}`, reading: '', ko: `SECRET_DIALOGUE_KO_${tag}`, segment: 1 }],
    chunks: (chunks ?? [
      { textJa: '注文する', meaningKo: '주문하다' },
      { textJa: 'お会計', meaningKo: '계산' },
    ]).map((c, i) => ({ id: `c${i + 1}`, reading: '', chunkType: 'ACTION', isNew: true, ...c })),
    grammar: [{ id: 'g1', pattern: '〜てもいいですか', explanationKo: '해도 됩니까', exampleJa: `SECRET_EXAMPLE_${tag}`, exampleReading: '', exampleKo: '' }],
    quiz: [],
    application: [{ id: 'a1', promptKo: `SECRET_APP_${tag}`, hintJa: null, modelAnswerJa: '', modelReading: '', modelKo: '', targetIds: [] }],
    speaking: [],
    nextPreview: { titleKo: `SECRET_PREVIEW_${tag}`, teaserKo: '' },
    segmentCount: 1,
  }
}

const rep = (over: Record<string, unknown>) => ({ itemType: 'EXPRESSION', refType: 'Expr', refId: 'x', meaningKo: null, studiedCount: 1, wrongCount: 0, priority: 'NORMAL', createdAt: kst('2026-10-01 09:00'), updatedAt: kst('2026-10-01 09:00'), lastStudiedAt: null, ...over })

/** U 와 U2 의 기록을 같은 시각대로 심는다. U2 행과 동의 문구 밖 칸에는 `SECRET_` 표지를 넣는다. */
function world(): RetrievalFake {
  const f = retrievalFakeDb()
  const t = f.tables
  for (const [uid, p] of [[U, ''], [U2, 'SECRET_U2_']] as const) {
    const id = (s: string) => `${uid === U ? 'u1' : 'u2'}${s}`
    t.statsSnapshot.push(
      { id: id('ss1'), userId: uid, kind: 'DAILY', periodKey: '2026-10-05', data: daily() },
      { id: id('ss2'), userId: uid, kind: 'DAILY', periodKey: '2026-10-07', data: daily({ lessons: 0, evals: 1 }) },
      { id: id('ss3'), userId: uid, kind: 'DAILY', periodKey: '2026-09-20', data: daily() },
      { id: id('ss4'), userId: uid, kind: 'LESSON', periodKey: id('l1'), data: { note: `SECRET_SNAP_${uid}` } },
    )
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-09-20']) t.attendance.push({ id: id(`at${d}`), userId: uid, date: dbDate(d) })
    t.lesson.push(
      { id: id('l1'), userId: uid, topicId: 'ctopicseed1', scenarioId: null, date: dbDate('2026-10-06'), kind: 'NEW', title: `${p}카페에서 주문하기`, status: 'DONE', score: 85, content: lessonContent(`${p}L1`), sourceText: `SECRET_SOURCE_${uid}`, createdAt: kst('2026-10-06 09:00'), completedAt: kst('2026-10-06 09:30') },
      { id: id('l2'), userId: uid, topicId: 'ctopicseed1', scenarioId: 'cscen1', date: dbDate('2026-09-15'), kind: 'NEW', title: `${p}역 레슨`, status: 'DONE', score: 70, content: lessonContent(`${p}L2`), sourceText: null, createdAt: kst('2026-09-15 09:00'), completedAt: kst('2026-09-15 09:30') },
      { id: id('l3'), userId: uid, topicId: null, scenarioId: null, date: dbDate('2026-10-07'), kind: 'NEW', title: `SECRET_GENERATING_${uid}`, status: 'GENERATING', score: null, content: null, sourceText: 'SECRET_SOURCE_GEN', createdAt: kst('2026-10-07 09:00'), completedAt: null },
    )
    t.evaluation.push({ id: id('e1'), userId: uid, kind: 'WORDS', status: 'DONE', totalScore: 82, rubric: { accuracy: 4, vocabulary: 3, grammar: 2, naturalness: 3, assembly: 4 }, comment: `SECRET_EVAL_COMMENT_${uid}`, completedAt: kst('2026-10-07 10:00') })
    t.repetitionItem.push(
      // 교정 출처 — 고친 문장은 실리고 meaningKo(교정 설명에서 만든 값)는 안 실린다
      rep({ id: id('r1'), userId: uid, refType: 'Correction', textJa: `${p}学校に行きます`, meaningKo: `SECRET_CORR_MEANING_${uid}`, wrongCount: 1, priority: 'FOCUS', nextDueAt: dbDate('2026-10-07') }),
      // 단어장 단어 출처 — 개수로만
      rep({ id: id('r2'), userId: uid, itemType: 'WORD', refType: 'WordEntry', textJa: `SECRET_DUE_WORD_${uid}`, meaningKo: 'SECRET_DUE_WORD_KO', nextDueAt: dbDate('2026-10-08') }),
      // 레슨 표현 출처 — 표현·뜻 실림
      rep({ id: id('r3'), userId: uid, refType: 'Expr', textJa: `${p}注文する`, meaningKo: '주문하다', nextDueAt: dbDate('2026-10-08') }),
      // 상황 출처 — 개수로만
      rep({ id: id('r4'), userId: uid, itemType: 'SCENARIO', refType: 'Scenario', textJa: `SECRET_DUE_SCEN_${uid}`, meaningKo: 'SECRET_DUE_SCEN_KO', nextDueAt: dbDate('2026-10-06') }),
      // 아직 아님
      rep({ id: id('r5'), userId: uid, refType: 'Expr', textJa: `SECRET_NOT_DUE_${uid}`, nextDueAt: dbDate('2026-10-12') }),
    )
    // 단어장 — 조회 계층이 읽지 않는다(표 자체가 RetrievalDb 에 없다)
    t.wordEntry.push({ id: id('w1'), userId: uid, surface: `SECRET_WORD_${uid}`, reading: 'SECRET_WORD_READING', meaning: 'SECRET_WORD_MEANING', note: 'SECRET_NOTE', archived: false, createdAt: kst('2026-10-07 08:00') })
    t.learnerErrorStat.push(
      { id: id('es1'), userId: uid, type: 'PARTICLE', pattern: 'chunk:NAME', count: 3 },
      { id: id('es2'), userId: uid, type: 'PARTICLE', pattern: 'general', count: 2 },
      { id: id('es3'), userId: uid, type: 'CONJUGATION', pattern: 'general', count: 1 },
      { id: id('es4'), userId: uid, type: 'PRONUNCIATION', pattern: 'long-vowel', count: 9 },
    )
    t.correction.push(
      { id: id('c1'), userId: uid, chatId: id('ch1'), messageId: id('m1'), status: 'ACCEPTED', original: `${p}学校で行きます`, corrected: `${p}学校に行きます`, explanation: `SECRET_EXPL_${uid}`, extraNoteKo: 'SECRET_EXTRA', errorType: 'PARTICLE', createdAt: kst('2026-10-06 21:00') },
      { id: id('c2'), userId: uid, chatId: id('ch1'), messageId: id('m1'), status: 'PROPOSED', original: 'SECRET_PROPOSED_ORIG', corrected: 'SECRET_PROPOSED', explanation: 'SECRET_PROPOSED_EXPL', errorType: 'GRAMMAR', createdAt: kst('2026-10-07 21:00') },
      { id: id('c3'), userId: uid, chatId: id('ch1'), messageId: id('m1'), status: 'REJECTED', original: 'SECRET_REJECTED_ORIG', corrected: 'SECRET_REJECTED', explanation: 'SECRET_REJECTED_EXPL', errorType: 'GRAMMAR', createdAt: kst('2026-10-07 22:00') },
    )
    t.chat.push(
      { id: id('ch1'), userId: uid, kind: 'TALK', title: 'SECRET_CHAT_TITLE', scenarioId: 'cscen1', createdAt: kst('2026-10-06 20:00'), endedAt: kst('2026-10-06 20:20') },
      // 남의 비공개 상황을 가리키는 방(손상 행) — 그 상황 제목은 읽히지 않는다
      { id: id('ch2'), userId: uid, kind: 'TALK', title: 'SECRET_CHAT_TITLE2', scenarioId: uid === U ? 'cscenU2' : 'cscen1', createdAt: kst('2026-10-07 20:00'), endedAt: null },
      { id: id('ch3'), userId: uid, kind: 'CHAT', title: 'SECRET_CHAT_TITLE3', scenarioId: null, createdAt: kst('2026-10-07 20:00'), endedAt: null },
    )
    t.chatMessage.push({ id: id('m1'), chatId: id('ch1'), role: 'USER', content: 'SECRET_CHAT_MESSAGE', toolLog: { secret: 'SECRET_TOOLLOG' } })
    t.studyLog.push({ id: id('sl1'), userId: uid, date: dbDate('2026-10-06'), type: 'TALK', origin: 'ACCEPTED', summary: 'SECRET_SUMMARY', refId: id('ch1') })
    t.tutorProposal.push({ id: id('tp1'), userId: uid, kind: 'ADD_WORD', status: 'PROPOSED', payload: { surface: 'SECRET_PROPOSAL' } })
    t.requestTrace.push({ id: id('rt1'), userId: uid, steps: 'SECRET_TRACE' })
    t.utterance.push({ id: id('ut1'), userId: uid, finalText: 'SECRET_UTTERANCE' })
  }
  t.conversationTopic.push({ id: 'ctopicseed1', userId: null, isSeed: true, title: '역' })
  t.topicChunk.push({ id: 'cchunk1', topicId: 'ctopicseed1', chunkType: 'NAME', textJa: 'SECRET_SCEN_CHUNK', reading: '', meaningKo: 'SECRET_SCEN_CHUNK_KO' })
  t.scenario.push(
    { id: 'cscen1', userId: null, isSeed: true, title: '역에서 표 사기', titleJa: '駅で切符を買う', keyExpressions: [{ id: 'k1', ja: 'SECRET_SCEN_EXPR', ko: 'SECRET_SCEN_EXPR_KO' }, { chunkId: 'cchunk1' }] },
    { id: 'cscenU2', userId: U2, isSeed: false, title: 'SECRET_U2_SCENARIO', titleJa: null, keyExpressions: [{ id: 'k1', ja: 'SECRET_U2_SCEN_EXPR', ko: '' }] },
  )
  return f
}

/** 표 소유자(conversation)의 정직한 교정 읽기 — where userId·ACCEPTED·기간·검색어(원래·고친 문장), 설명 칸은 돌려주지 않는다. */
function honestReader(f: RetrievalFake, seen?: AcceptedCorrectionQuery[]): AcceptedCorrectionReader {
  return async (userId, q) => {
    seen?.push(q)
    const rows = f.tables.correction.filter((r) => matches(r, { userId, status: 'ACCEPTED', createdAt: q.from ? { gte: q.from, lt: q.toExclusive } : { lt: q.toExclusive } }))
    const hit = q.terms.length ? rows.filter((r) => q.terms.some((term) => [r.original, r.corrected].some((v) => String(v).includes(term)))) : rows
    return hit.slice(0, q.take).map((r) => ({ id: r.id, userId: r.userId, status: r.status, original: r.original, corrected: r.corrected, errorType: r.errorType, createdAt: r.createdAt })) as AcceptedCorrectionRow[]
  }
}

/** 잘못 구현된 교정 읽기 — 사용자·상태를 거르지 않고 표 전체(설명 칸 포함)를 돌려준다(learning 의 이중 방어 확인용). */
function leakyReader(f: RetrievalFake): AcceptedCorrectionReader {
  return async () => f.tables.correction as unknown as AcceptedCorrectionRow[]
}

function honestRolePlays(f: RetrievalFake): RolePlayReader {
  return async (userId, q) => {
    const range = q.from ? { gte: q.from, lt: q.toExclusive } : { lt: q.toExclusive }
    return f.tables.chat
      .filter((c) => matches(c, { userId, kind: 'TALK', scenarioId: { not: null }, OR: [{ createdAt: range }, { endedAt: range }] }))
      .slice(0, q.take)
      .map((c) => ({ chatId: c.id, userId: c.userId, scenarioId: c.scenarioId, createdAt: c.createdAt, endedAt: c.endedAt })) as RolePlayRow[]
  }
}

function leakyRolePlays(f: RetrievalFake): RolePlayReader {
  return async () => f.tables.chat.map((c) => ({ ...c, chatId: c.id })) as unknown as RolePlayRow[]
}

async function run(
  f: RetrievalFake,
  intent: AskIntent,
  key: AskScopeKey | null,
  opts: { terms?: string[]; reader?: AcceptedCorrectionReader | null; rolePlays?: RolePlayReader | null; now?: Date } = {},
): Promise<RetrievalResult> {
  return retrieveRecords(U, intent, key ? { key } : null, {
    db: f.db,
    now: () => opts.now ?? NOW,
    terms: opts.terms,
    corrections: opts.reader === undefined ? honestReader(f) : opts.reader,
    rolePlays: opts.rolePlays === undefined ? honestRolePlays(f) : opts.rolePlays,
  })
}

const allIdsOf = (f: RetrievalFake, uid?: string) =>
  TABLES.flatMap((tn) => f.tables[tn].filter((r) => uid === undefined || r.userId === uid).map((r) => String(r.id)))

// ── ④ GENERAL · 계획 ─────────────────────────────────────────────────────────

test('④ GENERAL — 조회 함수를 하나도 부르지 않고 빈 결과(근거 항상 빈 배열)', async () => {
  const f = world()
  let readerCalls = 0
  const r = await retrieveRecords(U, 'GENERAL', { key: 'ALL' }, {
    db: f.db,
    now: () => NOW,
    corrections: async () => { readerCalls++; return [] },
    rolePlays: async () => { readerCalls++; return [] },
  })
  assert.deepEqual(r.items, [])
  assert.deepEqual(Object.keys(r.sourceMap), [])
  assert.deepEqual(r.meta.functionsCalled, [])
  assert.equal(r.meta.count, 0)
  assert.equal(r.meta.truncated, false)
  assert.equal(f.calls.length, 0, 'DB 호출 0')
  assert.equal(readerCalls, 0, '주입 읽기 함수 호출 0')
  assert.deepEqual(resolveSourceKeys(r, ['S1']), [])
  assert.deepEqual([...allowedSourceTypes(r)], [])
})

test('④ 의도별 호출 함수 조합(계획) — PROGRESS·EXPRESSION(검색어 유무)·MIXED = 합집합, WORD 종류 없음', async () => {
  assert.deepEqual([...RECORD_SOURCE_TYPES].sort(), ['CORRECTION', 'EVALUATION', 'LESSON', 'REVIEW', 'SCENARIO', 'STUDY_LOG'])
  assert.deepEqual(retrievalPlan('PROGRESS', false), ['getProgressSummary', 'getDueReviews', 'getSkillState', 'getRecentCorrections'])
  assert.deepEqual(retrievalPlan('EXPRESSION', false), ['getRecentCorrections', 'findExpressions'])
  assert.deepEqual(retrievalPlan('EXPRESSION', true), ['findExpressions', 'getRecentCorrections'])
  assert.deepEqual(retrievalPlan('GENERAL', true), [])
  for (const t of [false, true]) {
    assert.deepEqual(new Set(retrievalPlan('MIXED', t)), new Set([...retrievalPlan('PROGRESS', t), ...retrievalPlan('EXPRESSION', t)]))
  }
  assert.equal(retrievalPlan('MIXED', true)[0], 'findExpressions', '검색어가 있으면 찾기가 맨 앞')
  const f = world()
  const r = await run(f, 'PROGRESS', 'THIS_WEEK')
  assert.deepEqual(r.meta.functionsCalled, retrievalPlan('PROGRESS', false))
  assert.deepEqual([...allowedSourceTypes(r)].sort(), ['CORRECTION', 'EVALUATION', 'LESSON', 'REVIEW', 'STUDY_LOG'])
  assert.ok(!r.items.some((i) => i.type === 'SCENARIO'), 'PROGRESS 는 상황 연습을 내지 않는다')
  await assert.rejects(retrieveRecords(U, 'NOPE' as AskIntent, null, { db: f.db }), TypeError)
})

test('④ 빈 userId 는 조회하지 않는다', async () => {
  const f = world()
  const r = await retrieveRecords('', 'MIXED', { key: 'ALL' }, { db: f.db, now: () => NOW })
  assert.equal(r.items.length, 0)
  assert.equal(f.calls.length, 0)
})

// ── ① 격리 · ② D2=(b) 부정 시험 ─────────────────────────────────────────────

for (const leaky of [false, true]) {
  for (const readerKind of ['honest', 'leaky'] as const) {
    test(`①② 격리·외부 전송 범위 — MIXED·ALL (select ${leaky ? '무시(leaky)' : '적용'}, 교정·역할극 읽기 ${readerKind})`, async () => {
      const base = world()
      const f = retrievalFakeDb({ leaky })
      for (const tn of TABLES) f.tables[tn].push(...base.tables[tn])
      const reader = readerKind === 'honest' ? honestReader(f) : leakyReader(f)
      const rolePlays = readerKind === 'honest' ? honestRolePlays(f) : leakyRolePlays(f)
      for (const terms of [[], ['学校'], ['注文'], ['표 사기']]) {
        f.calls.length = 0
        const r = await run(f, 'MIXED', 'ALL', { reader, rolePlays, terms })
        assert.ok(r.items.length > 0, '본인 기록은 나온다')
        const blob = JSON.stringify(r.items)
        // 금지 표지(타 사용자·단어장·교정 설명·역할극 표현·대화·발화·PROPOSED/REJECTED·금지 칸·toolLog·Trace) 0건
        assert.ok(!/SECRET_/.test(blob), `금지 표지가 항목에 실렸다: ${blob.match(/SECRET_[A-Z0-9_]*/)?.[0]}`)
        assert.ok(!blob.includes(EMAIL))
        // 내부 id 0건(본인·타인 모든 행 id·userId·상황 id)
        for (const id of [...allIdsOf(f), U, U2]) assert.ok(!blob.includes(id), `내부 id 가 항목에 실렸다: ${id}`)
        // 외부 항목은 허용 칸 5개뿐, 종류는 6종 안
        for (const it of r.items) {
          assert.deepEqual(Object.keys(it).sort(), ['dateKst', 'key', 'label', 'text', 'type'])
          assert.ok((RECORD_SOURCE_TYPES as readonly string[]).includes(it.type))
        }
        // sourceMap: 타 사용자 행 0건, 본인 행·집계(null)만
        assert.ok(!/SECRET_/.test(JSON.stringify(r.sourceMap)))
        for (const ref of Object.values(r.sourceMap)) {
          if (ref.id === null) {
            assert.ok(['STUDY_LOG', 'REVIEW', 'CORRECTION'].includes(ref.type), '집계는 세 종류뿐(SCENARIO 는 늘 방 id)')
            continue
          }
          assert.ok(ref.id.startsWith('u1'), `본인 행만: ${ref.id}`)
          if (ref.type === 'SCENARIO') {
            const chat = f.tables.chat.find((c) => c.id === ref.id)
            assert.ok(chat && chat.userId === U && chat.scenarioId === 'cscen1', 'SCENARIO id = 본인 역할극 방(공개 상황)')
          }
          if (ref.type === 'CORRECTION') assert.equal(f.tables.correction.find((c) => c.id === ref.id)?.status, 'ACCEPTED')
        }
        // 금지 표는 한 번도 부르지 않는다(단어장·조각 포함)
        const forbidden: TableName[] = ['wordEntry', 'topicChunk', 'correction', 'chat', 'chatMessage', 'tutorProposal', 'requestTrace', 'studyLog', 'utterance']
        assert.deepEqual(f.calls.filter((c) => forbidden.includes(c.table)), [])
        // 모든 쿼리: 명시 select + 본인 userId(상황 제목은 본인 또는 공개 시드)
        for (const c of f.calls) {
          if (c.op === 'findMany') assert.ok(c.args.select, `${c.table}.findMany select 없음`)
          for (const col of ['sourceText', 'keyExpressions', 'note', 'comment', 'summary', 'toolLog', 'email', 'explanation']) {
            assert.ok(!c.args.select?.[col], `${c.table} 금지 칸 select: ${col}`)
          }
          const w = c.args.where ?? {}
          if (c.table === 'scenario') assert.deepEqual(w.OR, [{ userId: null, isSeed: true }, { userId: U }])
          else assert.equal(w.userId, U, `${c.table}.${c.op} where.userId`)
        }
      }
    })
  }
}

test('② D2=(b) 포함 범위 — 공부 기록 요약·채택 교정(원래→고친 문장+유형)·레슨 배운 표현·복습 예정·역할극 요약이 실린다', async () => {
  const f = world()
  const r = await run(f, 'MIXED', 'ALL')
  const byType = (t: string) => r.items.filter((i) => i.type === t).map((i) => i.text)
  assert.ok(byType('STUDY_LOG').some((x) => x.includes('공부한 날 3일') && x.includes('출석 4일')))
  // REV-064-U L-2 — 사용자가 본 동의 문구(공부 횟수·점수·복습 예정 목록)에 연속 출석이 없으므로 결과 어디에도 「연속」 이 없다(계약 §2-18-A 5항 ③).
  assert.ok(r.items.length > 0)
  for (const i of r.items) assert.ok(!/연속/.test(i.text) && !/연속/.test(i.label), `「연속」 이 새어 나갔다: ${i.type} ${i.text}`)
  for (const sInfo of Object.values(r.sourceMap)) assert.ok(!/연속/.test(sInfo.label), '근거 카드 라벨에도 「연속」 이 없다')
  assert.ok(byType('CORRECTION').includes('채택한 교정(조사) · 「学校で行きます」 → 「学校に行きます」'), '교정 = 원래 문장 → 고친 문장 + 유형 라벨만')
  assert.ok(byType('CORRECTION').some((x) => x === '채택한 교정 유형 누적(전체 기간): 조사 5회, 활용 1회'), '유형 누적(발음 제외)')
  assert.ok(byType('LESSON').some((x) => x.includes('注文する 주문하다') && x.includes('〜てもいいですか 해도 됩니까')))
  assert.ok(byType('REVIEW').includes('오늘(2026-10-08) 기준 복습할 항목 4개(집중 1개) · 종류: 표현 1, 교정 1, 단어 1, 상황 1'))
  assert.ok(byType('REVIEW').some((x) => x.startsWith('복습 예정(교정) 学校に行きます · 학습 1회 · 틀림 1회 · 집중 항목')), '교정 출처 복습 = 고친 문장만')
  assert.ok(byType('REVIEW').some((x) => x.startsWith('복습 예정(표현) 注文する — 주문하다')))
  assert.equal(byType('REVIEW').length, 3, '단어장·상황 출처 복습 항목은 개수로만')
  assert.ok(byType('EVALUATION').some((x) => x.includes('82점') && x.includes('정확성 4')))
  assert.deepEqual(byType('SCENARIO'), ['역할극 「역에서 표 사기」 마침'])
  const scen = Object.values(r.sourceMap).find((s) => s.type === 'SCENARIO')
  assert.deepEqual(scen, { type: 'SCENARIO', id: 'u1ch1', date: '2026-10-06', label: '역에서 표 사기' })
})

test('② 지워진 역할극 방은 근거에서 빠진다(SCENARIO id = 방 chatId)', async () => {
  const f = world()
  f.tables.chat = f.tables.chat.filter((c) => c.id !== 'u1ch1')
  const r = await run(f, 'MIXED', 'ALL')
  assert.ok(!r.items.some((i) => i.type === 'SCENARIO'))
})

test('① getLessonsByTopic·getSkillState 직접 — 본인 행만, 잘못된 주제 id 는 조회 안 함', async () => {
  const f = world()
  const ctx: RetrievalCtx = { db: f.db, userId: U, range: resolveRange('ALL', NOW), terms: [], corrections: null, rolePlays: null }
  const lessons = await getLessonsByTopic(ctx, 'ctopicseed1')
  assert.deepEqual(lessons.map((l) => l.id), ['u1l1', 'u1l2'])
  assert.ok(lessons.every((l) => !/SECRET_/.test(l.text)))
  f.calls.length = 0
  assert.deepEqual(await getLessonsByTopic(ctx, "x' OR 1=1 --"), [])
  assert.equal(f.calls.length, 0)
  const skill = await getSkillState(ctx)
  assert.equal(skill.length, 1)
  assert.equal(skill[0].id, null)
  assert.match(skill[0].text, /조사 5회, 활용 1회$/)
  assert.deepEqual(await getSkillState({ ...ctx, userId: 'cnobody00000000000000000' }), [])
})

test('① 기록이 없는 사용자 — 집계도 내지 않는다(count=0 → 「관련 기록 없음」 신호)', async () => {
  const f = world()
  const r = await retrieveRecords('cnobody00000000000000000', 'MIXED', { key: 'ALL' }, { db: f.db, now: () => NOW, corrections: honestReader(f), rolePlays: honestRolePlays(f) })
  assert.equal(r.meta.count, 0)
  assert.deepEqual(r.items, [])
  assert.equal(r.meta.functionsCalled.length, 5)
})

test('읽기 함수가 없으면 교정·역할극 0건(던지지 않음)', async () => {
  const f = world()
  const r = await run(f, 'EXPRESSION', 'ALL', { reader: null, rolePlays: null })
  assert.ok(!r.items.some((i) => i.type === 'CORRECTION' || i.type === 'SCENARIO'))
  assert.ok(r.items.some((i) => i.type === 'LESSON'))
})

// ── ③ 상한 ──────────────────────────────────────────────────────────────────

function assertCaps(r: RetrievalResult) {
  assert.ok(r.items.length <= RECORD_RETRIEVAL_LIMITS.items)
  let total = 0
  for (const it of r.items) {
    assert.ok(cp(it.text) <= RECORD_RETRIEVAL_LIMITS.itemChars, `항목 글 ${cp(it.text)}자`)
    assert.ok(cp(it.label) <= RECORD_RETRIEVAL_LIMITS.labelChars, `라벨 ${cp(it.label)}자`)
    assert.ok(cp(it.label) > 0)
    assert.ok(!/[\n\r\t\u0000-\u001f]/.test(it.text + it.label), '한 줄')
    total += cp(it.text) + cp(it.label)
  }
  assert.ok(total <= RECORD_RETRIEVAL_LIMITS.totalChars, `총 ${total}자`)
  assert.equal(r.meta.count, r.items.length)
}

test('③ 작은 결과는 truncated=false, 상한 안', async () => {
  const f = world()
  const r = await run(f, 'PROGRESS', 'THIS_WEEK')
  assertCaps(r)
  assert.equal(r.meta.truncated, false)
})

test('③ 건수 상한 20 — 짧은 항목이 많으면 20개에서 멈추고 truncated', async () => {
  const f = retrievalFakeDb()
  for (let i = 0; i < 40; i++) {
    f.tables.correction.push({ id: `u1c${String(i).padStart(3, '0')}`, userId: U, status: 'ACCEPTED', original: 'あ', corrected: 'い', errorType: 'OTHER', createdAt: new Date(NOW.getTime() - i * 60_000) })
  }
  for (let i = 0; i < 10; i++) {
    f.tables.lesson.push({ id: `u1l${String(i).padStart(3, '0')}`, userId: U, date: dbDate('2026-10-01'), kind: 'NEW', title: `레슨${i}`, status: 'DONE', score: 50, content: null, createdAt: new Date(NOW.getTime() - i * 60_000) })
  }
  for (let i = 0; i < 12; i++) f.tables.repetitionItem.push(rep({ id: `u1r${String(i).padStart(3, '0')}`, userId: U, textJa: `語${i}`, nextDueAt: dbDate('2026-10-01') }))
  const r = await run(f, 'MIXED', 'ALL')
  assert.equal(r.items.length, 20)
  assert.equal(r.meta.truncated, true)
  assertCaps(r)
})

test('③ 총 글자 2,000 — 큰 항목은 들어갈 만큼만, truncated', async () => {
  const f = retrievalFakeDb()
  for (let i = 0; i < 10; i++) {
    f.tables.correction.push({ id: `u1c${i}`, userId: U, status: 'ACCEPTED', original: `原文${i}${'あ'.repeat(200)}`, corrected: `訂正${i}${'い'.repeat(200)}`, errorType: 'GRAMMAR', createdAt: new Date(NOW.getTime() - i * 60_000) })
  }
  const r = await run(f, 'EXPRESSION', 'ALL')
  assertCaps(r)
  assert.equal(r.meta.truncated, true)
  const corr = r.items.filter((i) => i.type === 'CORRECTION')
  assert.ok(corr.length >= 1 && corr.length < 10, `교정 ${corr.length}건만 들어감`)
  for (const c of corr) assert.ok(c.text.startsWith('채택한 교정(문법) · 「原文'), '머리(종류·원래 문장)는 남는다')
})

test('③ 항목 글 300자 — 넘치면 꼬리가 말줄임으로 잘리고 truncated, 머리는 남는다', async () => {
  const f = retrievalFakeDb()
  const chunks = Array.from({ length: 8 }, (_, i) => ({ textJa: `${'表現'.repeat(15)}${i}`, meaningKo: `${'뜻'.repeat(30)}${i}` }))
  f.tables.lesson.push({ id: 'u1l1', userId: U, date: dbDate('2026-10-06'), kind: 'NEW', title: '긴 레슨', status: 'IN_PROGRESS', score: null, content: lessonContent('L', chunks), createdAt: NOW })
  const r = await run(f, 'EXPRESSION', 'ALL', { reader: null, rolePlays: null })
  assert.equal(r.items.length, 1)
  assert.equal(cp(r.items[0].text), 300)
  assert.ok(r.items[0].text.startsWith('레슨 「긴 레슨」 배운 표현: 表現'))
  assert.ok(r.items[0].text.endsWith('…'))
  assert.equal(r.meta.truncated, true)
})

test('③ assemble 순서 규칙 — 번갈아 합치기·중복 행 1번·총 글자 넘는 항목 건너뛰고 작은 뒤 항목 담기·20건 멈춤', () => {
  const big = (i: number): Candidate => ({ fn: 'getRecentCorrections', type: 'CORRECTION', id: `b${i}`, dateKst: '2026-10-08', text: '가'.repeat(290), label: '라'.repeat(60), cut: false })
  const small: Candidate = { fn: 'getRecentCorrections', type: 'CORRECTION', id: 's', dateKst: '2026-10-08', text: '작다', label: '작', cut: false }
  const a = assemble([[big(1), big(2), big(3), big(4), big(5), big(6), big(7), small]])
  assert.deepEqual(a.items.map((i) => a.sourceMap[i.key].id), ['b1', 'b2', 'b3', 'b4', 'b5', 's'])
  assert.equal(a.truncated, true)
  const x = (fn: Candidate['fn'], id: string | null, type: Candidate['type'] = 'LESSON'): Candidate => ({ fn, type, id, dateKst: '2026-10-08', text: `t${id}`, label: `l${id}`, cut: false })
  const b = assemble([[x('getProgressSummary', null, 'STUDY_LOG'), x('getProgressSummary', 'L1')], [x('findExpressions', 'C1', 'CORRECTION'), x('findExpressions', 'L1'), x('findExpressions', 'C2', 'CORRECTION')]])
  assert.deepEqual(b.items.map((i) => b.sourceMap[i.key].id), [null, 'C1', 'L1', 'C2'], '번갈아 + LESSON:L1 은 앞의 것 하나')
  assert.equal(b.sourceMap.S3.label, 'lL1')
  assert.equal(b.truncated, false, '중복 제거는 잘림이 아니다')
  const many = assemble([Array.from({ length: 25 }, (_, i) => x('findExpressions', `L${i}`))])
  assert.equal(many.items.length, 20)
  assert.equal(many.truncated, true)
  const exact = assemble([Array.from({ length: 20 }, (_, i) => x('findExpressions', `L${i}`))])
  assert.equal(exact.truncated, false, '딱 20개는 잘림 아님')
  const cut = assemble([[{ ...x('findExpressions', 'L1'), cut: true }]])
  assert.equal(cut.truncated, true, '300자 잘림이 실리면 truncated')
  const bad = assemble([[{ ...x('findExpressions', 'L1'), dateKst: '10/08' }, { ...x('findExpressions', 'L2'), text: '' }]])
  assert.equal(bad.items.length, 0, '날짜 모양·빈 글 후보는 버린다')
})

test('③ 검색어 정규화 — 3개·20자·NFKC·와일드카드만인 말 버림, 읽기 함수에는 정규화된 말만 간다', async () => {
  assert.deepEqual(normalizeTerms(['ＡＢＣ', '〜ている', '%', '_', 'x'.repeat(30), 'ABC', '駅', 'もう一つ']), ['ABC', 'ている', 'x'.repeat(20)])
  assert.deepEqual(normalizeTerms('駅'), [])
  assert.deepEqual(normalizeTerms([1, null, { a: 1 }, '「駅」']), ['駅'])
  const f = world()
  const seen: AcceptedCorrectionQuery[] = []
  await run(f, 'EXPRESSION', 'ALL', { terms: ['  ５０%_off\n', '%%'], reader: honestReader(f, seen) })
  assert.deepEqual(seen.map((q) => q.terms), [['50%_off'], []], '찾기(검색어) + 최근 교정(검색어 없음)')
  assert.equal(seen[0].take, 5)
  assert.equal(seen[1].take, 10)
})

test('③ 검색어가 있으면 일치하는 표현·교정·역할극만(레슨은 일치한 표현을 앞에)', async () => {
  const f = world()
  const r = await run(f, 'EXPRESSION', 'ALL', { terms: ['お会計'] })
  const lesson = r.items.find((i) => i.type === 'LESSON')
  assert.ok(lesson && lesson.text.indexOf('お会計') < lesson.text.indexOf('注文する'), '일치한 표현이 앞')
  assert.ok(!r.items.some((i) => i.type === 'SCENARIO'), '제목이 맞지 않는 역할극 없음')
  const r2 = await run(f, 'EXPRESSION', 'ALL', { terms: ['切符'] })
  assert.ok(r2.items.some((i) => i.type === 'SCENARIO'), '상황 일본어 제목으로 찾는다')
  assert.ok(!r2.items.some((i) => i.type === 'LESSON'), '일치하지 않는 레슨 없음')
})

// ── ⑤ KST 범위 경계 ─────────────────────────────────────────────────────────

test('⑤ resolveRange — 이번 주 월~일 · 지난 30일(오늘 포함) · 전체, UTC 시각이 아니라 KST 달력', () => {
  const w = resolveRange('THIS_WEEK', NOW)
  assert.equal(w.today, '2026-10-08')
  assert.equal(w.fromKst, '2026-10-05')
  assert.equal(w.toKst, '2026-10-11')
  assert.equal(w.fromInstant?.toISOString(), '2026-10-04T15:00:00.000Z')
  assert.equal(w.toExclusive.toISOString(), '2026-10-11T15:00:00.000Z')
  // 일요일 23:59 KST → 같은 주, 월요일 00:00 KST → 새 주(UTC 로는 아직 일요일)
  assert.equal(resolveRange('THIS_WEEK', kst('2026-10-11 23:59')).fromKst, '2026-10-05')
  const mon = resolveRange('THIS_WEEK', new Date('2026-10-11T15:00:00.000Z'))
  assert.equal(mon.today, '2026-10-12')
  assert.equal(mon.fromKst, '2026-10-12')
  assert.equal(mon.toKst, '2026-10-18')
  // 월 경계(지난 30일) — 10-01 기준 09-02 부터
  const m = resolveRange('LAST_30D', kst('2026-10-01 09:00'))
  assert.equal(m.fromKst, '2026-09-02')
  assert.equal(m.toKst, '2026-10-01')
  // 연 경계 주(2026-12-31 목 → 12-28 월 ~ 2027-01-03 일)
  const y = resolveRange('THIS_WEEK', kst('2026-12-31 10:00'))
  assert.deepEqual([y.fromKst, y.toKst], ['2026-12-28', '2027-01-03'])
  const a = resolveRange('ALL', NOW)
  assert.equal(a.fromKst, null)
  assert.equal(a.fromInstant, null)
  for (const d of ['2026-10-05', '2026-10-08', '2026-10-11']) assert.equal(mondayOf(d), '2026-10-05')
  assert.equal(mondayOf('2026-10-12'), '2026-10-12')
})

function correctionAt(id: string, original: string, at: Date) {
  return { id, userId: U, status: 'ACCEPTED', original, corrected: `${original}!`, errorType: 'OTHER', createdAt: at }
}

test('⑤ 주 경계 — 일요일 23:59:59 KST 행은 다음 주 「이번 주」에서 빠지고 월요일 00:00 행은 들어간다', async () => {
  const f = retrievalFakeDb()
  f.tables.correction.push(correctionAt('u1csun', '日曜', kst('2026-10-11 23:59:59')), correctionAt('u1cmon', '月曜', kst('2026-10-12 00:00')))
  f.tables.statsSnapshot.push(
    { id: 'u1d1', userId: U, kind: 'DAILY', periodKey: '2026-10-11', data: daily({ lessons: 7 }) },
    { id: 'u1d2', userId: U, kind: 'DAILY', periodKey: '2026-10-12', data: daily({ lessons: 2 }) },
  )
  f.tables.lesson.push(
    { id: 'u1lsun', userId: U, date: dbDate('2026-10-11'), kind: 'NEW', title: '일요 레슨', status: 'DONE', score: 1, content: null, createdAt: NOW },
    { id: 'u1lmon', userId: U, date: dbDate('2026-10-12'), kind: 'NEW', title: '월요 레슨', status: 'DONE', score: 2, content: null, createdAt: NOW },
  )
  const monday = new Date('2026-10-11T15:30:00.000Z') // 10-12 00:30 KST
  const texts = (await run(f, 'MIXED', 'THIS_WEEK', { now: monday })).items.map((i) => i.text).join('\n')
  assert.ok(texts.includes('月曜') && !texts.includes('日曜'))
  assert.ok(texts.includes('월요 레슨') && !texts.includes('일요 레슨'), '@db.Date 칸도 같은 경계')
  assert.ok(texts.includes('레슨 완료 2회'), '그 주 DAILY 만 합산')
  const st = (await run(f, 'MIXED', 'THIS_WEEK', { now: kst('2026-10-11 23:59:59') })).items.map((i) => i.text).join('\n')
  assert.ok(st.includes('日曜') && !st.includes('月曜'))
  assert.ok(st.includes('일요 레슨') && !st.includes('월요 레슨'))
  assert.ok(st.includes('레슨 완료 7회'))
})

test('⑤ 월 경계(지난 30일) — 하한 날 00:00 KST 포함, 전날 23:59:59 제외, periodKey·평가 완료 시각도 같은 경계', async () => {
  const f = retrievalFakeDb()
  f.tables.correction.push(correctionAt('u1cin', '入る', kst('2026-09-02 00:00')), correctionAt('u1cout', '出る', kst('2026-09-01 23:59:59')))
  f.tables.statsSnapshot.push(
    { id: 'u1d1', userId: U, kind: 'DAILY', periodKey: '2026-09-01', data: daily({ lessons: 9 }) },
    { id: 'u1d2', userId: U, kind: 'DAILY', periodKey: '2026-09-02', data: daily({ lessons: 1 }) },
  )
  f.tables.evaluation.push(
    { id: 'u1ein', userId: U, kind: 'TALK', status: 'DONE', totalScore: 61, rubric: null, completedAt: kst('2026-09-02 00:00') },
    { id: 'u1eout', userId: U, kind: 'TALK', status: 'DONE', totalScore: 39, rubric: null, completedAt: kst('2026-09-01 23:59:59') },
  )
  const r = await run(f, 'MIXED', 'LAST_30D', { now: kst('2026-10-01 09:00') })
  const texts = r.items.map((i) => i.text).join('\n')
  assert.ok(texts.includes('入る') && !texts.includes('出る'))
  assert.ok(texts.includes('61점') && !texts.includes('39점'))
  assert.ok(texts.includes('레슨 완료 1회'))
  assert.ok(texts.includes('지난 30일(2026-09-02~2026-10-01)'))
  const all = await run(f, 'MIXED', null, { now: kst('2026-10-01 09:00') })
  assert.equal(all.meta.scopeKey, 'ALL', '범위 없음 = 전체 기간')
  assert.ok(all.items.map((i) => i.text).join('\n').includes('레슨 완료 10회'))
})

test('⑤ 자정 — 항목 날짜는 KST 달력(UTC 15:00 이후 시각은 다음 날)', async () => {
  const f = retrievalFakeDb()
  f.tables.correction.push(correctionAt('u1c1', '夜', new Date('2026-10-06T15:30:00.000Z')))
  const r = await run(f, 'EXPRESSION', 'ALL')
  assert.equal(r.items[0].dateKst, '2026-10-07')
  assert.equal(r.sourceMap.S1.date, '2026-10-07')
})

// ── ⑥ 키·sourceMap · 재검증 ─────────────────────────────────────────────────

test('⑥ 키 S1..Sn 연속·중복 없음, sourceMap 키·값이 항목과 일치', async () => {
  const f = world()
  for (const intent of ['PROGRESS', 'EXPRESSION', 'MIXED'] as const) {
    const r = await run(f, intent, 'ALL')
    assert.ok(r.items.length > 0)
    assert.deepEqual(r.items.map((i) => i.key), r.items.map((_, n) => `S${n + 1}`))
    assert.deepEqual(Object.keys(r.sourceMap), r.items.map((i) => i.key))
    for (const it of r.items) {
      const ref = r.sourceMap[it.key]
      assert.equal(ref.type, it.type)
      assert.equal(ref.date, it.dateKst)
      assert.equal(ref.label, it.label)
      assert.match(it.dateKst, /^\d{4}-\d{2}-\d{2}$/)
    }
    const real = Object.values(r.sourceMap).filter((s) => s.id !== null).map((s) => `${s.type}:${s.id}`)
    assert.equal(new Set(real).size, real.length, '같은 실제 행은 한 번만')
  }
})

test('⑥ resolveSourceKeys — 있는 키·허용 종류만, 순서 유지·중복·모양 어긋남·프로토타입 키 버림, 복사본', async () => {
  const f = world()
  const r = await run(f, 'MIXED', 'ALL')
  const keys = r.items.map((i) => i.key)
  const got = resolveSourceKeys(r, [keys[2], keys[0], keys[2], 'S99', 'S0', 's1', '__proto__', 'constructor', 1, null, keys[1]])
  assert.deepEqual(got, [r.sourceMap[keys[2]], r.sourceMap[keys[0]], r.sourceMap[keys[1]]])
  got[0].label = '바뀜'
  assert.notEqual(r.sourceMap[keys[2]].label, '바뀜')
  assert.deepEqual(resolveSourceKeys(r, 'S1'), [])
  assert.deepEqual(resolveSourceKeys(r, undefined), [])
  // 그 의도에서 부르지 않은 함수의 종류는 인정하지 않는다(계약 9항 ②)
  const forged: RetrievalResult = { ...r, meta: { ...r.meta, functionsCalled: ['getDueReviews'] } }
  const only = resolveSourceKeys(forged, keys)
  assert.ok(only.length > 0 && only.every((s) => s.type === 'REVIEW'))
  // GENERAL 결과에 sourceMap 이 있어도 빈 배열
  assert.deepEqual(resolveSourceKeys({ ...r, intent: 'GENERAL' }, keys), [])
  assert.equal(resolveSourceKeys(r, Array.from({ length: 30 }, (_, i) => `S${i + 1}`)).length, r.items.length)
})

test('⑥ 결과는 캐시하지 않는다 — 같은 호출 두 번이면 DB 도 두 번', async () => {
  const f = world()
  await run(f, 'PROGRESS', 'ALL')
  const first = f.calls.length
  await run(f, 'PROGRESS', 'ALL')
  assert.equal(f.calls.length, first * 2)
})
