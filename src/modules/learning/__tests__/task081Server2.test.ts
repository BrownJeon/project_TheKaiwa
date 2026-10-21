/**
 * task-081 서버 갈래 2(§37-13·§37-12-9) — «문제» 제거 뒤 레슨 완료(#62)·StudyLog·StatsSnapshot(LESSON)·관측·반복 항목·챌린지 읽기·ASK 점수.
 * 새 수업 = `content.quiz` 가 빈 배열(저장 JSON 에 `quiz` 키 없음) → 점수 없음(null)·문항 키 생략. 옛 수업(문항 있음)은 그대로.
 * DB 0 — 가짜 tx 를 `prisma.$transaction` 에 끼운다(askRouteGuard.test.ts 선례). LLM 0.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '@/modules/infra'
import { completeLessonDetailed, lessonQuizFigures, lessonQuizResultKeys, lessonStudySummary, LESSON_COMPLETE_MIN_STAGE } from '../lessons/lifecycle'
import { scoreQuiz } from '../lessons/content'
import { lessonObservations, quizTargetTally } from '../lessons/observations'
import { computeChallengeMetrics, freezeChallengeResult, freezeDailyGoal, readChallengeResult, readChallengeSnaps, type MetricChallenge } from '../challenges/metrics'
import { getLessonsByTopic, getProgressSummary, type RetrievalCtx } from '../recordRetrieval/sources'
import { resolveRange } from '../recordRetrieval/range'
import { dbDate, kst, retrievalFakeDb } from '../recordRetrieval/__tests__/fakeDb'

const U = 'cuser00000000000000000081'
const L = 'clesson000000000000000081'

// ── 픽스처 ──────────────────────────────────────────────────────────────────────

const OLD_QUIZ = [
  { id: 'q1', promptKo: '표', promptJa: null, choices: ['切符', '席'], answer: 0, targetIds: ['c1'], explanationKo: '.' },
  { id: 'q2', promptKo: '문형', promptJa: null, choices: ['A', 'B'], answer: 0, targetIds: ['g1'], explanationKo: '.' },
]

function storedContent(withQuiz: boolean): Record<string, unknown> {
  return {
    v: 1,
    title: '駅で',
    titleKo: '역에서',
    rolesKo: { A: '손님', B: '역무원' },
    dialogue: [{ speaker: 'A', ja: '切符をください。', reading: 'きっぷをください。', ko: '표 주세요.', segment: 0, ...(withQuiz ? {} : { pieces: null }) }],
    chunks: [
      { id: 'c1', textJa: '切符', reading: 'きっぷ', meaningKo: '표', chunkType: 'EXPRESSION', isNew: true },
      { id: 'c2', textJa: '片道', reading: 'かたみち', meaningKo: '편도', chunkType: 'EXPRESSION', isNew: true },
    ],
    grammar: [{ id: 'g1', pattern: '〜をください', explanationKo: '~주세요', exampleJa: '水をください。', exampleReading: 'みずをください。', exampleKo: '물 주세요.' }],
    ...(withQuiz ? { quiz: OLD_QUIZ } : {}),
    application: [{ id: 'a1', promptKo: '.', hintJa: null, modelAnswerJa: '切符をください。', modelReading: '', modelKo: '', targetIds: ['c1'] }],
    speaking: [
      { id: 's1', promptKo: '.', targetIds: ['c1', 'g1'], modelAnswerJa: '', modelReading: '', modelKo: '' },
      { id: 's2', promptKo: '.', targetIds: ['c2'], modelAnswerJa: '', modelReading: '', modelKo: '' },
    ],
    nextPreview: { titleKo: '다음', teaserKo: '예고' },
    segmentCount: 1,
  }
}

const SPOKEN = [{ itemId: 's1', text: '切符をください', matchedIds: ['c1', 'g1'], missedIds: [], utteranceId: null, at: '2026-10-21T01:00:00.000Z' }]

function lessonRow(opts: { kind?: 'NEW' | 'REVIEW'; withQuiz: boolean; stageDone?: number; answers?: (number | null)[] }) {
  return {
    id: L, userId: U, topicId: null, scenarioId: null, date: dbDate('2026-10-21'), kind: opts.kind ?? 'NEW', title: '駅で', level: 'N4',
    content: storedContent(opts.withQuiz), status: 'IN_PROGRESS', stageDone: opts.stageDone ?? 4,
    progress: { application: { answers: ['切符をください。'] }, speaking: SPOKEN, ...(opts.answers ? { quiz: { answers: opts.answers } } : {}) },
    score: null, sourceLessonIds: null, sourceText: null, error: null, createdAt: new Date(), updatedAt: new Date(), completedAt: null,
    topic: null, reviewSchedule: null,
  }
}

interface Call { model: string; op: string; args: any } // eslint-disable-line @typescript-eslint/no-explicit-any

function fakeTx(row: ReturnType<typeof lessonRow>, opts: { schedule?: { id: string; itemIds: string[]; status: string }; existingRep?: { id: string }[] } = {}) {
  const calls: Call[] = []
  let seq = 0
  const rec = (model: string, op: string, ret: (a: any) => unknown) => async (args: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    calls.push({ model, op, args })
    return ret(args)
  }
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      const sql = strings.join('?')
      calls.push({ model: '$raw', op: 'query', args: sql })
      if (sql.includes('`User`')) return [{ id: U }]
      if (sql.includes('FROM Lesson')) return [{ id: row.id }]
      if (sql.includes('FROM StatsSnapshot')) return [{ id: 'snapdaily' }]
      return []
    },
    $executeRaw: async (strings: TemplateStringsArray) => {
      calls.push({ model: '$raw', op: 'execute', args: strings.join('?') })
      return 1
    },
    lesson: { findUniqueOrThrow: rec('lesson', 'findUniqueOrThrow', () => row), update: rec('lesson', 'update', (a) => ({ ...row, ...a.data })) },
    topicChunk: { findMany: rec('topicChunk', 'findMany', () => []) },
    repetitionItem: {
      findMany: rec('repetitionItem', 'findMany', () => (opts.existingRep ?? []).map((r) => ({ ...r, refType: 'x', refId: 'x', intervalDays: 3, priority: 'NORMAL', feedbackCount: 0 }))),
      create: rec('repetitionItem', 'create', () => ({ id: `rep${++seq}` })),
      update: rec('repetitionItem', 'update', () => ({})),
    },
    studyLog: { create: rec('studyLog', 'create', () => ({ id: 'log1' })) },
    statsSnapshot: { create: rec('statsSnapshot', 'create', () => ({})), findUnique: rec('statsSnapshot', 'findUnique', () => ({ data: null })), update: rec('statsSnapshot', 'update', () => ({})) },
    learningObservation: { createMany: rec('learningObservation', 'createMany', (a) => ({ count: a.data.length })) },
    reviewSchedule: { findFirst: rec('reviewSchedule', 'findFirst', () => opts.schedule ?? null), updateMany: rec('reviewSchedule', 'updateMany', () => ({ count: 1 })) },
  }
  return { tx, calls }
}

async function runComplete(row: ReturnType<typeof lessonRow>, opts: Parameters<typeof fakeTx>[1] = {}) {
  const f = fakeTx(row, opts)
  const client = prisma as unknown as Record<string, unknown>
  const original = client.$transaction
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(f.tx)
  try {
    const out = await completeLessonDetailed(U, row.id)
    return { out, calls: f.calls }
  } finally {
    client.$transaction = original
  }
}

const one = (calls: Call[], model: string, op: string) => {
  const hit = calls.filter((c) => c.model === model && c.op === op)
  assert.equal(hit.length, 1, `${model}.${op} 1회`)
  return hit[0].args
}
const QUIZ_KEYS = ['score', 'quizCorrect', 'quizTotal', 'quizAnswered']

// ── 순수 함수 ──────────────────────────────────────────────────────────────────

test('lessonQuizFigures: 문항 없음 → score·quiz null·outcomes [] / 문항 있음 → scoreQuiz 그대로', () => {
  assert.deepEqual(lessonQuizFigures([], undefined), { score: null, quiz: null, outcomes: [] })
  assert.deepEqual(lessonQuizFigures([], [0, 1]), { score: null, quiz: null, outcomes: [] }, '남은 답이 있어도 문항이 없으면 점수 없음')
  const s = scoreQuiz(OLD_QUIZ, [0, 1])
  assert.deepEqual(lessonQuizFigures(OLD_QUIZ, [0, 1]), { score: s.score, quiz: { correct: s.correct, total: s.total, answered: s.answered }, outcomes: s.outcomes })
  assert.equal(lessonQuizFigures(OLD_QUIZ, undefined).score, 0, '옛 수업 미답은 0점(지금 그대로)')
})

test('lessonStudySummary·lessonQuizResultKeys: 새 수업 «문제» 없음·키 생략 / 옛 수업 지금 문자열·키 그대로', () => {
  const expr = { usedIds: ['c1'], missedIds: ['c2'] }
  assert.equal(lessonStudySummary('NEW', '역에서', null, expr), '오늘의 회화 「역에서」 · 말하기 표현 1/2')
  assert.equal(lessonStudySummary('REVIEW', '역에서', null, expr), '오늘의 복습 「역에서」 · 말하기 표현 1/2')
  assert.equal(lessonStudySummary('NEW', '역에서', { correct: 3, total: 5, answered: 4 }, expr), '오늘의 회화 「역에서」 · 문제 3/5 · 말하기 표현 1/2')
  assert.deepEqual(lessonQuizResultKeys(lessonQuizFigures([], undefined)), {})
  assert.deepEqual(lessonQuizResultKeys(lessonQuizFigures(OLD_QUIZ, [0, 1])), { score: 50, quizCorrect: 1, quizTotal: 2, quizAnswered: 2 })
})

test('관측: 문항이 없으면 GRAMMAR_USE·VOCAB_RECOGNITION 0건, 말하기 SENTENCE_PRODUCTION 은 그대로 · quizTargetTally 빈 Map', () => {
  const c = storedContent(false) as never as Parameters<typeof lessonObservations>[1]
  const out = lessonObservations(L, { ...c, quiz: [] }, [], SPOKEN)
  assert.deepEqual(out.map((o) => [o.kind, o.outcome]), [['SENTENCE_PRODUCTION', 'SUCCESS'], ['SENTENCE_PRODUCTION', 'SKIPPED']])
  assert.equal(quizTargetTally([], []).size, 0)
})

// ── #62 완료 — 새 수업 ─────────────────────────────────────────────────────────

test('#62 새 수업(quiz 없음, stageDone 4): Lesson.score null·응답 null·StudyLog 문항 키 생략·스냅샷 score null·관측 말하기만·반복 항목 0/0 등록', async () => {
  assert.equal(LESSON_COMPLETE_MIN_STAGE, 4)
  const { out, calls } = await runComplete(lessonRow({ withQuiz: false, stageDone: 4 }))
  const r = out.result
  assert.equal(r.lesson.score, null)
  assert.equal(r.lesson.stageDone, 5)
  assert.equal(r.result.score, null)
  assert.equal(r.result.quiz, null)
  assert.equal(r.result.applicationDone, 1)
  assert.deepEqual(r.result.expressions, { usedIds: ['c1', 'g1'], missedIds: ['c2'] })

  const upd = one(calls, 'lesson', 'update')
  assert.equal(upd.data.score, null, 'Lesson.score = null')
  assert.equal(upd.data.status, 'DONE')

  const log = one(calls, 'studyLog', 'create').data
  assert.equal(log.summary, '오늘의 회화 「역에서」 · 말하기 표현 2/3')
  assert.ok(!/문제/.test(log.summary))
  for (const k of QUIZ_KEYS) assert.ok(!(k in log.result), `StudyLog.result 에 ${k} 키 없음`)
  assert.deepEqual(Object.keys(log.result), ['stageDone', 'applicationDone', 'usedExpressionIds', 'missedExpressionIds', 'itemIds', 'listen', 'speakingDone', 'topicId', 'source'])

  const snaps = calls.filter((c) => c.model === 'statsSnapshot' && c.op === 'create')
  assert.equal(snaps.length, 1)
  assert.equal(snaps[0].args.data.kind, 'LESSON')
  assert.deepEqual(snaps[0].args.data.data, { kind: 'NEW', topicId: null, score: null, stageDone: 5, itemCount: 3, date: snaps[0].args.data.data.date })
  assert.ok(!('quizCorrect' in snaps[0].args.data.data) && !('quizTotal' in snaps[0].args.data.data))

  const obs = one(calls, 'learningObservation', 'createMany').data as { kind: string }[]
  assert.ok(obs.length > 0 && obs.every((o) => o.kind === 'SENTENCE_PRODUCTION'), '문항 관측 0건')

  const reps = calls.filter((c) => c.model === 'repetitionItem' && c.op === 'create').map((c) => c.args.data)
  assert.deepEqual(reps.map((d) => [d.itemType, d.textJa, d.correctCount, d.wrongCount]), [['EXPRESSION', '切符', 0, 0], ['EXPRESSION', '片道', 0, 0], ['GRAMMAR', '〜をください', 0, 0]], '조각·문형 계속 등록, 정답·오답 0')
  assert.deepEqual(r.result.repetition, { items: 3, created: 3, updated: 0 })
  // LESSON 스냅샷은 만들기만 — 고치는 쓰기는 DAILY 행(snapdaily)뿐
  assert.ok(calls.filter((c) => c.model === 'statsSnapshot' && c.op === 'update').every((c) => c.args.where.id === 'snapdaily'))
})

test('#62 새 수업 stageDone 3 은 지금처럼 409 STAGES_LEFT(쓰기 0)', async () => {
  await assert.rejects(runComplete(lessonRow({ withQuiz: false, stageDone: 3 })), (e: unknown) => (e as { details?: { reason?: string } }).details?.reason === 'STAGES_LEFT')
})

test('#62 새 복습 레슨(REVIEW, quiz 없음): mixSpec 항목 studiedCount+1 만(정답·오답 증가 0)·«오늘의 복습» 요약·score null', async () => {
  const row = lessonRow({ kind: 'REVIEW', withQuiz: false })
  const { out, calls } = await runComplete(row, { schedule: { id: 'rs1', itemIds: ['rep-a', 'rep-b'], status: 'DUE' }, existingRep: [{ id: 'rep-a' }, { id: 'rep-b' }] })
  assert.equal(out.result.lesson.score, null)
  const upd = calls.filter((c) => c.model === 'repetitionItem' && c.op === 'update').map((c) => c.args.data)
  assert.equal(upd.length, 2)
  for (const d of upd) assert.deepEqual([d.studiedCount, d.correctCount, d.wrongCount], [{ increment: 1 }, { increment: 0 }, { increment: 0 }])
  assert.equal(calls.filter((c) => c.model === 'repetitionItem' && c.op === 'create').length, 0)
  const log = one(calls, 'studyLog', 'create').data
  assert.equal(log.summary, '오늘의 복습 「역에서」 · 말하기 표현 2/3')
  for (const k of QUIZ_KEYS) assert.ok(!(k in log.result))
  assert.equal(one(calls, 'statsSnapshot', 'create').data.data.score, null)
})

// ── #62 완료 — 옛 수업(문항 있음) 불변 ───────────────────────────────────────────

test('#62 옛 수업(진행 중, 답 [0,1]): 답을 그대로 채점·지금 문자열·지금 키·지금 스냅샷 모양(키 순서 포함)', async () => {
  const { out, calls } = await runComplete(lessonRow({ withQuiz: true, answers: [0, 1] }))
  assert.equal(out.result.lesson.score, 50)
  assert.equal(out.result.result.score, 50)
  assert.deepEqual(out.result.result.quiz, { correct: 1, total: 2, answered: 2 })
  assert.equal(one(calls, 'lesson', 'update').data.score, 50)
  const log = one(calls, 'studyLog', 'create').data
  assert.equal(log.summary, '오늘의 회화 「역에서」 · 문제 1/2 · 말하기 표현 2/3')
  assert.deepEqual(Object.keys(log.result).slice(0, 6), ['stageDone', 'score', 'quizCorrect', 'quizTotal', 'quizAnswered', 'applicationDone'])
  assert.deepEqual([log.result.score, log.result.quizCorrect, log.result.quizTotal, log.result.quizAnswered], [50, 1, 2, 2])
  const snap = one(calls, 'statsSnapshot', 'create').data.data
  assert.equal(JSON.stringify(snap), JSON.stringify({ kind: 'NEW', topicId: null, score: 50, stageDone: 5, itemCount: 3, quizCorrect: 1, quizTotal: 2, date: snap.date }), '옛 수업 스냅샷 모양 불변')
  const obs = one(calls, 'learningObservation', 'createMany').data as { kind: string; outcome: string }[]
  assert.deepEqual(obs.slice(0, 2).map((o) => [o.kind, o.outcome]), [['VOCAB_RECOGNITION', 'SUCCESS'], ['GRAMMAR_USE', 'FAIL']])
  const reps = calls.filter((c) => c.model === 'repetitionItem' && c.op === 'create').map((c) => [c.args.data.textJa, c.args.data.correctCount, c.args.data.wrongCount])
  assert.deepEqual(reps, [['切符', 1, 0], ['片道', 0, 0], ['〜をください', 0, 1]], '옛 수업은 오답이 wrongCount 로 간다')
})

// ── 챌린지 읽기 ─────────────────────────────────────────────────────────────────

const GOAL = freezeDailyGoal({ lesson: true, words: false, wordCount: 10 })
const TOPIC = 'ctopic0000000000000000081'
const CH: MetricChallenge = { status: 'ACTIVE', startDate: '2026-10-20', endDate: '2026-10-22', endedAt: null, topicId: TOPIC, dailyGoal: GOAL }
const snapRow = (id: string, data: Record<string, unknown>, at: string) => ({ id, kind: 'LESSON', periodKey: `clesson${id.padStart(18, '0')}`, data, createdAt: kst(at) })

test('챌린지: 새 수업 스냅샷(문항 키 없음) → quiz null 로 읽음 · 오늘의 회화 완료(MET)는 스냅샷 존재로 판정', () => {
  const snaps = readChallengeSnaps([snapRow('n1', { kind: 'NEW', topicId: TOPIC, score: null, stageDone: 5, itemCount: 3, date: '2026-10-21' }, '2026-10-21 09:00')])
  assert.deepEqual([snaps.lessons[0].quizCorrect, snaps.lessons[0].quizTotal], [null, null])
  const m = computeChallengeMetrics(CH, snaps, '2026-10-21', kst('2026-10-21 10:00'))
  const day = m.days.find((d) => d.date === '2026-10-21')!
  assert.equal(day.state, 'MET')
  assert.deepEqual([day.lesson?.done, day.lesson?.quizCorrect, day.lesson?.quizTotal], [1, null, null])
})

test('챌린지: 옛 스냅샷은 숫자 그대로 · 같은 날 옛·새 수업이면 점수 있는 옛 수업이 대표 · 얼린 결과 [null,null] 왕복', () => {
  const old = snapRow('o1', { kind: 'NEW', topicId: TOPIC, score: 60, stageDone: 5, itemCount: 3, quizCorrect: 3, quizTotal: 5, date: '2026-10-20' }, '2026-10-20 09:00')
  const mixOld = snapRow('o2', { kind: 'NEW', topicId: TOPIC, score: 40, stageDone: 5, itemCount: 3, quizCorrect: 2, quizTotal: 5, date: '2026-10-21' }, '2026-10-21 08:00')
  const mixNew = snapRow('n2', { kind: 'NEW', topicId: TOPIC, score: null, stageDone: 5, itemCount: 3, date: '2026-10-21' }, '2026-10-21 09:00')
  const onlyNew = snapRow('n3', { kind: 'NEW', topicId: TOPIC, score: null, stageDone: 5, itemCount: 3, date: '2026-10-22' }, '2026-10-22 09:00')
  const snaps = readChallengeSnaps([old, mixOld, mixNew, onlyNew])
  assert.deepEqual([snaps.lessons[0].quizCorrect, snaps.lessons[0].quizTotal], [3, 5])
  const done: MetricChallenge = { ...CH, status: 'COMPLETED', endedAt: kst('2026-10-23 00:00') }
  const m = computeChallengeMetrics(done, snaps, '2026-10-23', kst('2026-10-23 00:00'))
  assert.deepEqual(m.days.map((d) => [d.state, d.lesson?.done, d.lesson?.quizCorrect ?? null]), [['MET', 1, 3], ['MET', 2, 2], ['MET', 1, null]])
  assert.equal(m.days[1].lesson?.lessonId, mixOld.periodKey)
  const frozen = freezeChallengeResult(m, GOAL, null)
  assert.deepEqual(frozen.days.map((d) => d.quiz), [[3, 5], [2, 5], [null, null]])
  const back = readChallengeResult(JSON.parse(JSON.stringify(frozen)))
  assert.ok(back, '[null,null] 이 든 결과도 읽힌다')
  assert.deepEqual(back.days.map((d) => d.quiz), [[3, 5], [2, 5], [null, null]])
  const bad = JSON.parse(JSON.stringify(frozen))
  bad.days[2].quiz = [null, 5]
  assert.equal(readChallengeResult(bad), null, '한쪽만 null 은 손상')
})

// ── ASK 맥락 — 레슨 점수 null ────────────────────────────────────────────────────

test('ASK 기록 조회: 점수 없는 레슨(null)은 «점수» 언급 없음(0점으로 읽지 않음) · 옛 레슨은 «점수 N점» 그대로', async () => {
  const f = retrievalFakeDb()
  const NOW = kst('2026-10-21 12:00')
  const base = { userId: U, topicId: 'ctopic0000000000000000081', scenarioId: null, date: dbDate('2026-10-21'), kind: 'NEW', content: null, sourceText: null, createdAt: NOW, completedAt: NOW }
  f.tables.lesson.push({ ...base, id: 'clessonnew0000000000000081', title: '새 레슨', status: 'DONE', score: null })
  f.tables.lesson.push({ ...base, id: 'clessonold0000000000000081', title: '옛 레슨', status: 'DONE', score: 80, createdAt: kst('2026-10-21 08:00') })
  const ctx: RetrievalCtx = { db: f.db, userId: U, range: resolveRange('ALL', NOW), terms: [], corrections: null, rolePlays: null }
  const text = (cs: unknown[], title: string) => JSON.stringify(cs.find((c) => JSON.stringify(c).includes(title)) ?? null)
  const progress = await getProgressSummary(ctx)
  assert.ok(text(progress, '새 레슨') !== 'null' && !text(progress, '새 레슨').includes('점수'))
  assert.ok(!/0점/.test(text(progress, '새 레슨')))
  assert.ok(text(progress, '옛 레슨').includes('점수 80점'))
  const byTopic = await getLessonsByTopic(ctx, base.topicId)
  assert.ok(byTopic.length === 0 || !text(byTopic, '새 레슨').includes('점수'), '주제별 조회도 null 은 점수 생략')
})
