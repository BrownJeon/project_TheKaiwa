import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type {
  ChallengeDailyGoal,
  ChallengeDay,
  ChallengeDetail,
  ChallengeListResponse,
  ChallengeStats,
  ChallengeSummary,
  ChallengeTask,
  ChallengeTodayResponse,
  DayChallenge,
} from '@/types/challenge'
import ChallengePlanCard from '../ChallengePlanCard'
import { COPY, CREATE, DAY_VIEW } from '../challengeCopy'
import { DayStrip } from '../DayStrip'
import {
  acceptLine,
  activeTodayView,
  canRetry,
  dayLineView,
  daySheetView,
  dayWord,
  defaultWordCount,
  detailMemo,
  endSheetView,
  endedCardLine,
  goalTasks,
  isListEmpty,
  listRowView,
  minAnsweredOf,
  nearestCount,
  parseDraft,
  parseStep,
  planCardKind,
  planStatTiles,
  rateTile,
  readListPages,
  resultHeroView,
  ruleLines,
  scoreRows,
  serializeDraft,
  stopDayIndex,
  streakTile,
  stripCellAria,
  stripCellIsToday,
  stripDateText,
  stripFocusDate,
  stripLegend,
  taskRowView,
  todayDayOf,
  wordCountOptions,
  EMPTY_DRAFT,
} from '../logic'

const GOAL: ChallengeDailyGoal = { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 }
const MORNING: ChallengeStats = { dayIndex: 4, elapsedDays: 3, metDays: 2, rate: 0.67, streak: 0, longestStreak: 2, todayMet: false }
const BOTH_DONE: ChallengeStats = { dayIndex: 4, elapsedDays: 4, metDays: 3, rate: 0.75, streak: 1, longestStreak: 2, todayMet: true }

const summary = (over: Partial<ChallengeSummary> = {}): ChallengeSummary => ({
  id: 'ch1',
  title: '카페 주문 7일 챌린지',
  topic: { id: 't1', title: '카페 주문', exists: true },
  level: 'N5',
  lengthDays: 7,
  startDate: '2026-10-03',
  endDate: '2026-10-09',
  status: 'ACTIVE',
  dailyGoal: GOAL,
  stats: MORNING,
  endedAt: null,
  ...over,
})
const words = (state: 'TODO' | 'IN_PROGRESS' | 'SHORT' | 'DONE', answered = 0, sets = 0): ChallengeTask => ({
  kind: 'WORDS', state, sessionId: null, wordCount: 10, minAnswered: 8, answered, sets,
})
const lesson = (state: Extract<ChallengeTask, { kind: 'LESSON' }>['state']): ChallengeTask => ({ kind: 'LESSON', state, lessonId: null, jobId: null })
const cday = (over: Partial<ChallengeDay> = {}): ChallengeDay => ({ date: '2026-10-05', dayIndex: 3, state: 'MET', goalMetAt: null, lesson: null, words: null, ...over })
const dw = (over: Partial<NonNullable<ChallengeDay['words']>> = {}): NonNullable<ChallengeDay['words']> => ({
  sets: 1, correct: 8, wrong: 1, skipped: 1, cardCount: 10, answered: 9, need: 8, ok: true, sessionId: 'vs1', refExists: true, ...over,
})
const detail = (over: Partial<ChallengeDetail> = {}): ChallengeDetail => ({
  ...summary(),
  days: [],
  topicProgress: null,
  totals: { lessonsDone: 2, wordSets: 3, wordsCorrect: 21 },
  today: null,
  result: null,
  ...over,
})

test('계획표 카드 변형: 불러오는 중 → 오류 → 진행 중 → 내일 시작 → 끝남 → 없음, 진행 중 + 끝남은 진행 중만', () => {
  const todayTasks = { date: '2026-10-06', dayIndex: 4, topic: { id: 't1', title: '카페 주문' }, tasks: [words('TODO'), lesson('TODO')], goalMet: false }
  const ended: ChallengeTodayResponse['recentlyEnded'] = {
    id: 'old', status: 'COMPLETED', title: '자기소개 7일 챌린지', endedAt: '2026-10-05T15:00:00.000Z',
    result: { lengthDays: 7, metDays: 5, elapsedDays: 7, rate: 0.71, longestStreak: 3, endReason: null },
  }
  assert.equal(planCardKind('loading', null), 'loading')
  assert.equal(planCardKind('error', null), 'error')
  assert.equal(planCardKind('ready', { challenge: summary(), today: todayTasks, recentlyEnded: null }), 'active')
  assert.equal(planCardKind('ready', { challenge: summary({ stats: { ...MORNING, dayIndex: 0, elapsedDays: 0, metDays: 0, rate: null } }), today: null, recentlyEnded: null }), 'tomorrow')
  assert.equal(planCardKind('ready', { challenge: null, today: null, recentlyEnded: ended }), 'ended')
  assert.equal(planCardKind('ready', { challenge: null, today: null, recentlyEnded: null }), 'none')
  assert.equal(planCardKind('ready', { challenge: summary(), today: todayTasks, recentlyEnded: ended }), 'active')
  assert.equal(endedCardLine(ended!), '7일 중 5일 달성 · 최장 연속 3일')
  assert.equal(endedCardLine({ ...ended!, status: 'ENDED', result: { ...ended!.result, elapsedDays: 0, metDays: 0 } }), '시작 전에 그만뒀어요')
})

test('오늘 할 일 줄: 단어 상태별 문구·모양·가는 곳(링크는 오늘 탭)', () => {
  const t = taskRowView(words('TODO'))
  assert.equal(t.desc, '오늘 0/8장 · 10장 세트 · 약 3분')
  assert.equal(t.href, '/study/today')
  assert.equal(t.aria, '할 일: 오늘의 단어, 오늘 0/8장 · 10장 세트 · 약 3분, 공부 탭에서 하기')
  assert.equal(taskRowView(words('IN_PROGRESS', 4)).go, '공부 탭에서 이어서')
  const s = taskRowView(words('SHORT', 4, 1))
  assert.equal(s.glyph, 'half')
  assert.equal(s.desc, '오늘 4/8장 · 4장 더 풀면 완료')
  assert.equal(s.aria, '덜 함: 오늘의 단어, 오늘 4/8장 · 4장 더 풀면 완료, 공부 탭에서 하기')
  const d2 = taskRowView(words('DONE', 12, 2))
  assert.equal(d2.desc, '2세트 합쳐 12장 풂(8장 이상)')
  assert.equal(d2.href, null)
  assert.equal(taskRowView(words('DONE', 9, 1)).desc, '오늘 9장 풂(8장 이상)')
  assert.equal(taskRowView(words('TODO'), { later: true }).desc, '내일부터 · 하루 10장 중 8장 이상')
  assert.equal(taskRowView(words('TODO'), { preview: true }).href, null)
})

test('오늘 할 일 줄: 회화 상태별 — 만드는 중은 글자만, 죽은 잡은 실패 표시, [오늘 수업 만들기] 버튼 없음', () => {
  assert.equal(taskRowView(lesson('TODO')).desc, '아직 안 만들었어요 · 공부 탭에서 누르면 1분쯤')
  const g = taskRowView(lesson('GENERATING'))
  assert.equal(g.glyph, 'spin')
  assert.equal(g.desc, '만드는 중 · 1분쯤')
  assert.equal(g.prefix, '준비 중: ')
  assert.equal(taskRowView(lesson('READY')).go, '공부 탭에서 시작')
  assert.equal(taskRowView(lesson('CONTINUE')).desc, '어제 만든 수업이 있어요 · 오늘 끝내면 오늘 기록으로 인정돼요')
  assert.equal(taskRowView(lesson('DONE')).desc, '끝냈어요')
  const f = taskRowView(lesson('FAILED'))
  assert.deepEqual([f.glyph, f.desc, f.go], ['fail', '만들지 못했어요', '공부 탭에서 다시'])
  assert.equal(taskRowView(lesson('TODO'), { later: true }).desc, '내일 공부 탭에서 만들어요')
  for (const st of ['TODO', 'GENERATING', 'READY', 'IN_PROGRESS', 'CONTINUE', 'DONE', 'FAILED'] as const) {
    assert.ok(!taskRowView(lesson(st)).aria.includes('오늘 수업 만들기'))
  }
})

test('꺼진 과제 줄 없음 · 할 일 한마디', () => {
  assert.deepEqual(goalTasks({ ...GOAL, words: false, wordCount: null, wordsMinAnswered: null }).map((t) => t.kind), ['LESSON'])
  assert.deepEqual(goalTasks({ ...GOAL, lesson: false }).map((t) => t.kind), ['WORDS'])
  assert.equal(dayWord([words('TODO'), lesson('TODO')], false), '아직 시작 전')
  assert.equal(dayWord([words('DONE', 8, 1), lesson('TODO')], false), '남은 것: 회화')
  assert.equal(dayWord([words('SHORT', 4, 1), lesson('TODO')], false), '남은 것: 단어 · 회화')
  assert.equal(dayWord([words('DONE', 8, 1), lesson('DONE')], true), '다 했어요')
})

test('지표 기준 수치: 아침 67% · 3일 중 2일 · 수행 연속 0일 → 둘 다 끝내면 75% · 4일 중 3일 · 1일, 첫날 "—"', () => {
  const [rate, streak] = planStatTiles(MORNING)
  assert.deepEqual([rate.value, rate.sub[0]], ['67%', '3일 중 2일'])
  assert.deepEqual([streak.label, streak.value, ...streak.sub], ['수행 연속', '0일', '하루 목표를 다 한 날만 계산해요', '오늘 채우면 1일'])
  const [r2, s2] = planStatTiles(BOTH_DONE)
  assert.deepEqual([r2.value, r2.sub[0], s2.value, s2.sub[1]], ['75%', '4일 중 3일', '1일', '오늘까지 이어졌어요'])
  const first = rateTile({ ...MORNING, dayIndex: 1, elapsedDays: 0, metDays: 0, rate: null, streak: 0 })
  assert.deepEqual([first.value, first.sub[0]], ['—', '오늘 채우면 생겨요'])
  assert.equal(rateTile({ ...MORNING, dayIndex: 0, elapsedDays: 0, metDays: 0, rate: null }).sub[0], '내일부터 셀게요')
  assert.equal(streakTile({ ...MORNING, dayIndex: 0 }).sub[1], '내일 채우면 1일')
  // 끝난 챌린지(streak:null)는 수행 연속 대신 최장 연속만
  const fin = planStatTiles({ ...MORNING, streak: null, longestStreak: 3 })
  assert.deepEqual(fin.map((t) => t.label), ['달성률', '최장 연속'])
  assert.ok(!fin.some((t) => t.label === '수행 연속'))
  assert.equal(detailMemo(MORNING), '오늘은 아직 끝나지 않아서 달성률에 넣지 않았어요. 오늘 채우면 수행 연속 1일이 돼요.')
  assert.equal(detailMemo(BOTH_DONE), '오늘 목표를 채워서 오늘도 달성률에 넣었어요. 수행 연속 1일째예요.')
  assert.equal(detailMemo({ ...MORNING, dayIndex: 1, elapsedDays: 0, metDays: 0, rate: null }), '첫날이에요. 오늘 목표를 채우면 달성률과 연속이 생겨요.')
})

test('하루 상태: 글자 + 모양(색만으로 구분하지 않음)', () => {
  const words6 = (Object.keys(DAY_VIEW) as (keyof typeof DAY_VIEW)[]).map((k) => DAY_VIEW[k].word)
  assert.deepEqual(words6, ['달성', '일부', '놓침', '오늘', '예정', '그만둠'])
  // 일부는 글자가 아니라 반원 그림(`half` → `PartialMark`) — 그림 검사는 marks.test.ts.
  assert.deepEqual([DAY_VIEW.MET.glyph, DAY_VIEW.PARTIAL.glyph, DAY_VIEW.MISSED.glyph, DAY_VIEW.STOPPED.glyph], ['✓', '', '✕', '–'])
  assert.deepEqual((Object.keys(DAY_VIEW) as (keyof typeof DAY_VIEW)[]).filter((k) => DAY_VIEW[k].half), ['PARTIAL'])
  for (const v of Object.values(DAY_VIEW)) assert.ok(!/text-(accent|warn|ink3)\b/.test(v.cls), v.cls)
  assert.equal(stripDateText('2026-10-05', 7), '5(월)')
  assert.equal(stripDateText('2026-10-05', 14), '10/5')
  assert.equal(stripCellAria({ date: '2026-10-05', dayIndex: 3, state: 'PARTIAL' }), '10월 5일 월요일, 3일째, 일부')
  assert.deepEqual(stripLegend([{ state: 'STOPPED' }, { state: 'MET' }, { state: 'MET' }]), ['MET', 'STOPPED'])
})

test('달력 하루 시트의 챌린지 줄(#71): 상태별 설명·need 보충', () => {
  const base: DayChallenge = { challengeId: 'ch1', title: '카페 주문 7일 챌린지', dayIndex: 3, state: 'MET', lesson: { quizCorrect: 4, quizTotal: 5 }, words: { correct: 8, wrong: 1, skipped: 1, cardCount: 10, ok: true, need: 8 } }
  const met = dayLineView(base, null)
  assert.equal(met.title, '챌린지 3일째 — 달성')
  assert.equal(met.desc, '하루 목표를 다 채웠어요 · 단어 10장 중 8장 맞힘')
  assert.equal(met.aria, '챌린지 3일째 달성, 하루 목표를 다 채웠어요 · 단어 10장 중 8장 맞힘, 챌린지 화면에서 보기')
  // task-081 새 수업은 점수 null — 같은 줄(점수를 읽지 않는다).
  assert.equal(dayLineView({ ...base, lesson: { quizCorrect: null, quizTotal: null } }, null).desc, '하루 목표를 다 채웠어요 · 단어 10장 중 8장 맞힘')
  const short = { ...base, state: 'PARTIAL' as const, lesson: null, words: { correct: 3, wrong: 1, skipped: 6, cardCount: 10, ok: false, need: null } }
  assert.equal(dayLineView(short, 8).desc, '단어를 4/8장만 풀었어요')
  assert.equal(dayLineView(short, null).desc, '단어를 4장 풀었어요 · 하루 목표에는 못 미쳤어요')
  assert.equal(dayLineView({ ...short, words: { ...short.words, need: 12 } }, 8).desc, '단어를 4/12장만 풀었어요')
  assert.equal(dayLineView({ ...base, state: 'PARTIAL', words: null }, null).desc, '회화는 했고 단어는 안 했어요')
  assert.equal(dayLineView({ ...base, state: 'PARTIAL', lesson: null }, null).desc, '단어는 했고 회화는 안 했어요')
  assert.equal(dayLineView({ ...base, state: 'MISSED', lesson: null, words: { correct: 0, wrong: 0, skipped: 10, cardCount: 10, ok: false, need: 8 } }, 8).desc, '건너뛰기만 해서 ‘놓침’이에요')
  assert.equal(dayLineView({ ...base, state: 'MISSED', lesson: null, words: null }, 8).desc, '이날은 챌린지 공부가 없었어요')
  assert.equal(dayLineView({ ...base, state: 'STOPPED' }, null).desc, '챌린지를 그만둔 뒤라 세지 않아요')
})

test('S5 하루 시트: 두 세트 날 기준 수치 · 건너뛰기만 · 원본 삭제됨 · 끝난 챌린지는 링크 없음', () => {
  const ctx = { goal: GOAL, topicTitle: '카페 주문', finished: false, stopDay: null, todayCounts: null }
  const two = daySheetView(cday({ words: dw({ sets: 2, correct: 6, wrong: 2, skipped: 12, cardCount: 20, answered: 8, ok: true }), lesson: { done: 1, quizCorrect: 5, quizTotal: 5, lessonId: 'l1', refExists: true } }), ctx)
  const w = two.rows.find((r) => r.kind === 'words')!
  assert.equal(w.main, '오늘의 단어 2세트 합계 — 20장 중 맞힘 6 · 틀림 2 · 건너뜀 12(푼 8장)')
  assert.equal(w.link?.label, '가장 많이 푼 세트 결과 보기 · 외 1세트 ›')
  assert.equal(w.badge?.text, '✓ 완료 · 푼 8장(8장 이상)')
  assert.equal(two.rows.find((r) => r.kind === 'lesson')?.main, '오늘의 회화 「카페 주문」 · 끝냄')
  assert.equal(two.title, '10월 5일 (월) · 3일째')
  const skip = daySheetView(cday({ state: 'MISSED', words: dw({ sets: 0, correct: 0, wrong: 0, skipped: 10, answered: 0, ok: false }) }), ctx)
  assert.equal(skip.rows[0].main, '건너뛰기만 함 · 푼 0장')
  assert.equal(skip.reason, '건너뛰기만 한 세트는 푼 것으로 세지 않아서 ‘놓침’이에요')
  assert.equal(skip.missedNote, true)
  const gone = daySheetView(cday({ words: dw({ refExists: false }) }), ctx)
  assert.equal(gone.rows[0].link, null)
  assert.equal(gone.rows[0].gone, true)
  assert.equal(gone.goneNote, true)
  const frozen = daySheetView(cday({ words: dw({ sessionId: null }) }), { ...ctx, finished: true })
  assert.equal(frozen.rows[0].link, null)
  assert.equal(frozen.frozenNote, true)
  const part = daySheetView(cday({ state: 'PARTIAL', words: dw({ correct: 3, wrong: 1, answered: 4, ok: false }), lesson: { done: 1, quizCorrect: 4, quizTotal: 5, lessonId: 'l1', refExists: true } }), ctx)
  assert.equal(part.reason, '단어를 4/8장만 풀었어요 · 회화는 했어요')
  assert.equal(daySheetView(cday({ state: 'STOPPED', dayIndex: 6 }), { ...ctx, finished: true, stopDay: 6 }).reason, '이날 챌린지를 그만둬서 달성률에 넣지 않아요')
  assert.equal(daySheetView(cday({ state: 'STOPPED', dayIndex: 7 }), { ...ctx, finished: true, stopDay: 6 }).reason, '그만둔 뒤라 세지 않아요')
  assert.equal(daySheetView(cday({ state: 'STOPPED', dayIndex: 1 }), { ...ctx, finished: true, stopDay: 0 }).reason, '시작하기 전에 그만둬서 세지 않아요')
  const today = daySheetView(cday({ state: 'TODAY', words: dw({ answered: 4, ok: false }) }), { ...ctx, todayCounts: { done: 0, total: 2 } })
  assert.equal(today.reason, '아직 진행 중이에요 · 오늘 할 일 0 / 2 · 단어 4/8장')
  assert.equal(today.todayCta, true)
  assert.equal(daySheetView(cday({ state: 'UPCOMING', dayIndex: 5 }), ctx).status, '5일째 · 예정')
})

test('날짜별 기록: 회화 끝냄/아직/수업 없음, 예정·그만둠 제외, 꺼진 과제 칸 없음', () => {
  const days = [
    cday({ dayIndex: 1, date: '2026-10-03', lesson: { done: 1, quizCorrect: 4, quizTotal: 5, lessonId: 'l', refExists: true }, words: dw() }),
    cday({ dayIndex: 2, date: '2026-10-04', state: 'MISSED', words: dw({ sets: 0, correct: 0, wrong: 0, answered: 0, skipped: 10, ok: false }) }),
    cday({ dayIndex: 3, date: '2026-10-05', state: 'TODAY' }),
    cday({ dayIndex: 4, date: '2026-10-06', state: 'UPCOMING' }),
    cday({ dayIndex: 5, date: '2026-10-07', state: 'STOPPED' }),
  ]
  const rows = scoreRows(days, GOAL)
  assert.equal(rows.length, 3)
  assert.equal(rows[0].lesson?.text, '끝냄')
  assert.deepEqual(Object.keys(rows[0].lesson ?? {}), ['text'], '점(dots) 없음')
  // task-081 새 수업(점수 null)도 같은 칸.
  assert.equal(scoreRows([cday({ dayIndex: 1, date: '2026-10-03', lesson: { done: 1, quizCorrect: null, quizTotal: null, lessonId: 'l', refExists: true } })], GOAL)[0].lesson?.text, '끝냄')
  assert.equal(rows[0].words, '8/10 맞힘')
  assert.equal(rows[1].words, '건너뛰기만 함')
  assert.equal(rows[1].lesson?.text, '수업 없음')
  assert.deepEqual([rows[2].lesson?.text, rows[2].words, rows[2].dateText], ['아직', '아직', '10/5 오늘'])
  assert.ok(!rows.some((r) => /점|평균|문제/.test(`${r.lesson?.text}${r.words}`)))
  assert.ok(ruleLines(GOAL).includes('회화는 수업을 끝내면 완료예요.'))
  assert.equal(scoreRows(days, { lesson: false, words: true })[0].lesson, null)
  assert.ok(!ruleLines({ ...GOAL, lesson: false }).some((l) => l.startsWith('회화는')))
  assert.ok(ruleLines(GOAL).some((l) => l.includes('수행 연속은 앱을 연 날(연속 출석)이 아니라')))
})

test('S4 오늘 칸은 일 번호로 찾는다 — 오늘 목표를 채운 날(MET)·일부·TODAY 모두 «끝냈어요»(점수 없음)·날짜 띠 초점·기록 표 "오늘"', () => {
  const ls = (q: number) => ({ done: 1, quizCorrect: q, quizTotal: 5, lessonId: 'l', refExists: true })
  const week = (todayState: ChallengeDay['state'], todayLesson: ChallengeDay['lesson']) => [
    cday({ dayIndex: 1, date: '2026-10-03', lesson: ls(5), words: dw() }),
    cday({ dayIndex: 2, date: '2026-10-04', lesson: ls(4), words: dw() }),
    cday({ dayIndex: 3, date: '2026-10-05', state: 'PARTIAL', words: dw({ correct: 6, wrong: 3, answered: 9, ok: true }) }),
    cday({ dayIndex: 4, date: '2026-10-06', state: todayState, lesson: todayLesson, words: dw() }),
    cday({ dayIndex: 5, date: '2026-10-07', state: 'UPCOMING' }),
    cday({ dayIndex: 6, date: '2026-10-08', state: 'UPCOMING' }),
    cday({ dayIndex: 7, date: '2026-10-09', state: 'UPCOMING' }),
  ]
  const todayTasks = (tasks: ChallengeTask[], goalMet: boolean) => ({ date: '2026-10-06', dayIndex: 4, topic: { id: 't1', title: '카페 주문' }, tasks, goalMet })

  // 오늘 둘 다 끝냄 → 서버는 오늘 칸을 MET 로 보낸다(TODAY 칸 없음).
  const met = detail({ stats: BOTH_DONE, days: week('MET', ls(4)), today: todayTasks([words('DONE', 9, 1), lesson('DONE')], true) })
  assert.ok(!met.days.some((x) => x.state === 'TODAY'))
  const mv = activeTodayView(met)
  assert.deepEqual([mv.todayIndex, mv.todayDay?.date], [4, '2026-10-06'])
  assert.equal(mv.rows.find((r) => r.key === 'LESSON')?.desc, '끝냈어요')
  assert.equal(stripFocusDate(met.days, mv.todayIndex), '2026-10-06')
  const metRow = scoreRows(met.days, GOAL, mv.todayIndex).find((r) => r.date === '2026-10-06')
  assert.deepEqual([metRow?.dateText, metRow?.lesson?.text], ['10/6 오늘', '끝냄'])
  assert.equal(scoreRows(met.days, GOAL, mv.todayIndex).filter((r) => r.dateText.endsWith(' 오늘')).length, 1)

  // 아직 진행 중(TODAY) — 회화만 끝냄이어도 같은 칸·같은 줄.
  const live = detail({ stats: MORNING, days: week('TODAY', ls(3)), today: todayTasks([words('TODO'), lesson('DONE')], false) })
  const lv = activeTodayView(live)
  assert.equal(lv.todayDay?.state, 'TODAY')
  assert.equal(lv.rows.find((r) => r.key === 'LESSON')?.desc, '끝냈어요')
  assert.equal(stripFocusDate(live.days, lv.todayIndex), '2026-10-06')

  // 상태가 일부여도(번호로만 찾는다) 같은 칸.
  assert.equal(todayDayOf(week('PARTIAL', ls(2)), 4)?.lesson?.quizCorrect, 2)

  // 오늘 수업 기록이 없으면 준비 줄 그대로.
  assert.equal(activeTodayView(detail({ stats: MORNING, days: week('TODAY', null), today: todayTasks([lesson('READY')], false) })).rows[0].desc, '수업이 준비됐어요 · 약 15분')

  // 내일 시작(`today` null · 일 번호 0) → 오늘 칸 없음 · 첫 칸 초점 · 줄 없음.
  const tmr = detail({ stats: { ...MORNING, dayIndex: 0, elapsedDays: 0, metDays: 0, rate: null }, days: week('UPCOMING', null).map((x) => ({ ...x, state: 'UPCOMING' as const })), today: null })
  const tv = activeTodayView(tmr)
  assert.deepEqual([tv.todayIndex, tv.todayDay, tv.rows.length], [0, null, 0])
  assert.equal(stripFocusDate(tmr.days, tv.todayIndex), '2026-10-03')
  assert.ok(!scoreRows(tmr.days, GOAL, tv.todayIndex).some((r) => r.dateText.endsWith(' 오늘')))

  // 끝난 챌린지(일 번호를 넘기지 않음) → 첫 칸 · 없는 번호 → null.
  assert.equal(stripFocusDate(met.days), '2026-10-03')
  assert.equal(todayDayOf(met.days, 9), null)
  assert.equal(stripFocusDate([], 4), null)
})

test('날짜 띠 오늘 테두리는 일 번호 칸 — 오늘 MET·TODAY·일부 모두 1칸(읽기 ", 오늘"), 내일 시작·끝난 챌린지는 0칸', () => {
  const week = (todayState: ChallengeDay['state']): ChallengeDay[] => [
    cday({ dayIndex: 1, date: '2026-10-03' }),
    cday({ dayIndex: 2, date: '2026-10-04', state: 'MISSED' }),
    cday({ dayIndex: 3, date: '2026-10-05', state: 'PARTIAL' }),
    cday({ dayIndex: 4, date: '2026-10-06', state: todayState }),
    cday({ dayIndex: 5, date: '2026-10-07', state: 'UPCOMING' }),
    cday({ dayIndex: 6, date: '2026-10-08', state: 'UPCOMING' }),
    cday({ dayIndex: 7, date: '2026-10-09', state: 'UPCOMING' }),
  ]
  const cells = (days: ChallengeDay[], todayIndex?: number | null) =>
    (renderToStaticMarkup(createElement(DayStrip, { days, lengthDays: 7, todayIndex, onOpen: () => {} })).match(/<button[^>]*>/g) ?? []).map((tag) => ({
      date: tag.match(/data-strip="([^"]+)"/)?.[1],
      accent: /\bborder-accent\b/.test(tag),
      line: /\bborder-line\b/.test(tag),
      aria: tag.match(/aria-label="([^"]+)"/)?.[1] ?? '',
    }))
  const accentDates = (days: ChallengeDay[], todayIndex?: number | null) => cells(days, todayIndex).filter((c) => c.accent).map((c) => c.date)
  const ariaOf = (days: ChallengeDay[], todayIndex: number | null, date: string) => cells(days, todayIndex).find((c) => c.date === date)?.aria

  // 오늘 목표를 채운 날(MET) — 서버가 TODAY 칸을 보내지 않아도 오늘 칸에 테두리, 읽기에도 오늘.
  assert.deepEqual(accentDates(week('MET'), 4), ['2026-10-06'])
  assert.equal(ariaOf(week('MET'), 4, '2026-10-06'), '10월 6일 화요일, 4일째, 달성, 오늘')
  // 다른 칸은 기존 선 색 · 읽기에 오늘 없음.
  for (const c of cells(week('MET'), 4).filter((x) => x.date !== '2026-10-06')) assert.ok(!c.accent && c.line && !c.aria.includes('오늘'), c.date)

  // TODAY · 일부 — 같은 한 칸. TODAY 는 상태 글자가 이미 "오늘"이라 겹쳐 붙이지 않는다.
  assert.deepEqual(accentDates(week('TODAY'), 4), ['2026-10-06'])
  assert.equal(ariaOf(week('TODAY'), 4, '2026-10-06'), '10월 6일 화요일, 4일째, 오늘')
  assert.deepEqual(accentDates(week('PARTIAL'), 4), ['2026-10-06'])

  // 내일 시작(일 번호 0, 모두 예정) → 테두리 없음.
  const tmr = week('UPCOMING').map((d) => ({ ...d, state: 'UPCOMING' as const }))
  assert.deepEqual(accentDates(tmr, 0), [])

  // 끝난 챌린지(결과 화면은 번호를 넘기지 않음) — 마지막 날이 MET 여도 테두리 없음.
  const ended = week('MET').map((d) => (d.state === 'UPCOMING' ? { ...d, state: 'MET' as const } : d))
  assert.deepEqual(accentDates(ended), [])
  assert.deepEqual(accentDates(ended, null), [])

  // 순수 판정.
  assert.equal(stripCellIsToday({ dayIndex: 4, state: 'MET' }, 4), true)
  assert.equal(stripCellIsToday({ dayIndex: 4, state: 'MET' }, null), false)
  assert.equal(stripCellIsToday({ dayIndex: 3, state: 'MET' }, 4), false)
  assert.equal(stripCellIsToday({ dayIndex: 4, state: 'TODAY' }), true)
  assert.equal(stripCellAria({ date: '2026-10-05', dayIndex: 3, state: 'PARTIAL' }, 4), '10월 5일 월요일, 3일째, 일부')
})

test('기록 목록 이어 읽기 — 빈 쪽 + 커서는 다음 쪽을 읽고, 같은 커서 반복·최대 쪽에서 멈춘다 · 빈 상태는 커서도 없을 때만', async () => {
  const row = summary({ id: 'old1', status: 'COMPLETED' })
  const pages: Record<string, ChallengeListResponse> = {
    '': { items: [], nextCursor: 'c1' },
    c1: { items: [], nextCursor: 'c2' },
    c2: { items: [row], nextCursor: 'c3' },
  }
  const calls: (string | null)[] = []
  const fetchPage = async (c: string | null) => {
    calls.push(c)
    return pages[c ?? '']
  }
  // 첫 쪽·둘째 쪽이 비어도 행이 나올 때까지 이어 읽는다.
  assert.deepEqual(await readListPages(fetchPage, null), { items: [row], nextCursor: 'c3' })
  assert.deepEqual(calls, [null, 'c1', 'c2'])

  // [더 보기] 도 같은 함수 — 행이 있으면 한 번만 읽는다.
  calls.length = 0
  assert.deepEqual(await readListPages(fetchPage, 'c2'), { items: [row], nextCursor: 'c3' })
  assert.deepEqual(calls, ['c2'])

  // 같은 커서가 되돌아오면(서버 이상) 커서를 버린다 — 끝없이 읽지 않는다.
  let loops = 0
  const loop = async (): Promise<ChallengeListResponse> => {
    loops++
    return { items: [], nextCursor: 'same' }
  }
  assert.deepEqual(await readListPages(loop, null), { items: [], nextCursor: null })
  assert.equal(loops, 2)

  // 최대 쪽 수까지 비면 커서를 남긴다 → 화면은 빈 상태 대신 [더 보기].
  let n = 0
  const endless = async (): Promise<ChallengeListResponse> => ({ items: [], nextCursor: `k${++n}` })
  const capped = await readListPages(endless, null, 3)
  assert.deepEqual([capped, n], [{ items: [], nextCursor: 'k3' }, 3])
  assert.equal(isListEmpty(capped.items, capped.nextCursor), false)

  assert.equal(isListEmpty([], null), true)
  assert.equal(isListEmpty([row], null), false)
})

test('S8 결과 기준 수치: 자기소개 71% · 최장 3일 / 길 묻기 그만둠 60% · 6일째 / 시작 전 그만둠', () => {
  const intro = detail({
    title: '자기소개 7일 챌린지', status: 'COMPLETED', stats: { dayIndex: 7, elapsedDays: 7, metDays: 5, rate: 0.71, streak: null, longestStreak: 3, todayMet: false },
    result: { ruleVersion: 1, endReason: null, metDays: 5, partialDays: 1, missedDays: 1, stoppedDays: 0, elapsedDays: 7, rate: 0.71, longestStreak: 3, lessonsDone: 6, wordSets: 7, wordsCorrect: 52, days: [] },
  })
  const v = resultHeroView(intro)
  assert.deepEqual([v.big, v.sub, v.badge.text, v.done.longest], ['7일 중 5일 달성', '달성률 71% · 일부 1일 · 놓침 1일', '기간 끝', 3])
  const road = detail({
    title: '길 묻기 14일 챌린지', lengthDays: 14, status: 'ENDED', stats: { dayIndex: 6, elapsedDays: 5, metDays: 3, rate: 0.6, streak: null, longestStreak: 2, todayMet: false },
    result: { ruleVersion: 1, endReason: 'USER', metDays: 3, partialDays: 1, missedDays: 1, stoppedDays: 9, elapsedDays: 5, rate: 0.6, longestStreak: 2, lessonsDone: 3, wordSets: 4, wordsCorrect: 30, days: [] },
  })
  const r = resultHeroView(road)
  assert.deepEqual([r.big, r.sub, r.badge.text, r.done.longest], ['5일 중 3일 달성', '14일 중 6일째에 그만뒀어요 · 달성률 60%', '그만둠', 2])
  const pre = resultHeroView(detail({ status: 'ENDED', stats: { dayIndex: 0, elapsedDays: 0, metDays: 0, rate: null, streak: null, longestStreak: 0, todayMet: false } }))
  assert.deepEqual([pre.big, pre.sub, pre.preStart], ['시작 전에 그만뒀어요', '7일 모두 그만둠 · 달성률 —', true])
  assert.equal(resultHeroView(detail({ status: 'COMPLETED', stats: { ...MORNING, dayIndex: 7, elapsedDays: 7, metDays: 7, rate: 1, streak: null } })).badge.text, '완주')
})

test('기록 목록 행 · [다시 도전] 노출(진행 중이 없을 때만)', () => {
  assert.deepEqual(listRowView(summary()), { desc: '10월 3일 ~ 10월 9일 · 4일째 · 3일 중 2일 달성', badge: 'active', badgeText: '진행 중' })
  assert.equal(listRowView(summary({ stats: { ...MORNING, dayIndex: 1, elapsedDays: 0, metDays: 0, rate: null } })).desc, '10월 3일 ~ 10월 9일 · 1일째 · 아직 지난 날이 없어요')
  assert.equal(listRowView(summary({ status: 'COMPLETED', stats: { ...MORNING, metDays: 7 } })).badgeText, '완주')
  assert.equal(listRowView(summary({ status: 'COMPLETED', stats: { ...MORNING, metDays: 5 } })).desc, '10월 3일 ~ 10월 9일 · 7일 중 5일 달성')
  const ended = listRowView(summary({ status: 'ENDED', stats: { ...MORNING, dayIndex: 6, elapsedDays: 5, metDays: 3 } }))
  assert.deepEqual([ended.desc, ended.badgeText], ['10월 3일 시작 · 6일째 그만둠 · 5일 중 3일 달성', '그만둠'])
  const today: ChallengeTodayResponse = { challenge: summary({ id: 'live' }), today: null, recentlyEnded: null }
  assert.deepEqual(canRetry(today, 'old'), { kind: 'blocked', id: 'live', title: '카페 주문 7일 챌린지', dayIndex: 4 })
  assert.deepEqual(canRetry({ challenge: null, today: null, recentlyEnded: null }, 'old'), { kind: 'show' })
  assert.deepEqual(canRetry(null, 'old'), { kind: 'show' })
})

test('그만두기 확인 문장 · 그만둔 날 번호', () => {
  const v = endSheetView(detail({ days: [cday({ state: 'MET' }), cday({ state: 'MET' }), cday({ state: 'PARTIAL' }), cday({ state: 'TODAY' })] }))
  assert.equal(v.intro, '「카페 주문 7일 챌린지」를 4일째에 끝내요.')
  assert.equal(v.lines[0], '지금까지 기록(달성 2일 · 일부 1일)은 그대로 남아요.')
  assert.equal(v.lines[1], '오늘(4일째)은 아직 목표를 채우지 않아서 달성률에서 빠져요 → 결과는 ‘3일 중 2일 달성’.')
  const pre = endSheetView(detail({ stats: { ...MORNING, dayIndex: 0, elapsedDays: 0, metDays: 0, rate: null } }))
  assert.equal(pre.intro, '「카페 주문 7일 챌린지」를 시작하기 전에 끝내요.')
  assert.ok(pre.lines.includes('아직 시작 전이라 모든 날이 ‘그만둠’이 되고 달성률은 생기지 않아요.'))
  assert.equal(stopDayIndex('2026-09-20', '2026-09-25T03:00:00.000Z', 14), 6)
  assert.equal(stopDayIndex('2026-10-07', '2026-10-06T03:00:00.000Z', 7), 0)
})

test('S3 만들기: 장수 막힘·이유 · 인정 장수 5→4·10→8·15→12 · 기본 장수 · 초안', () => {
  assert.deepEqual([5, 10, 15].map(minAnsweredOf), [4, 8, 12])
  assert.equal(acceptLine(10), '하루에 10장 중 8장 이상 풀면 인정')
  const twelve = wordCountOptions(12)
  assert.deepEqual(twelve.options.map((o) => o.disabled), [false, false, true])
  assert.equal(twelve.reason, '이 주제 표현이 12개라 15장은 고를 수 없어요')
  assert.equal(wordCountOptions(7).reason, '이 주제 표현이 7개라 10장 이상은 고를 수 없어요')
  assert.equal(wordCountOptions(4).wordsBlocked, '이 주제 표현이 4개라 단어 과제를 켤 수 없어요')
  assert.equal(wordCountOptions(20).reason, null)
  assert.equal(defaultWordCount(10, 12), 10)
  assert.equal(defaultWordCount(15, 12), 10)
  assert.equal(defaultWordCount(30, 20), 15)
  assert.equal(nearestCount(7.5), 5)
  const d = { ...EMPTY_DRAFT, topicId: 'topic_1', lengthDays: 14 as const, wordCount: 15 as const, start: 'TOMORROW' as const }
  assert.deepEqual(parseDraft(serializeDraft(d)), d)
  assert.equal(parseDraft('{bad'), null)
  assert.equal(parseDraft(JSON.stringify({ v: 1, topicId: '../x', lengthDays: 9 }))?.topicId, null)
  assert.equal(parseStep('3'), 3)
  assert.equal(parseStep('9'), 1)
  assert.ok(CREATE.wordsBody('카페 주문').startsWith('AI 가 매일 「카페 주문」 새 단어'))
})

test('화면 문구에 엔진명·모델명·task/Phase 번호 없음', () => {
  // 키 이름(aiWordHelp 등)은 화면에 나오지 않으므로 값만 모은다.
  const values: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') values.push(v)
    else if (typeof v === 'function') walk((v as (...a: unknown[]) => unknown)('주제', 12, 10))
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(COPY)
  walk(CREATE)
  walk(DAY_VIEW)
  const all = values.join('\n')
  assert.ok(values.length > 100)
  assert.ok(!/claude|whisper|reazon|style-?bert|haiku|sonnet|opus|qwen|task-?\d|phase\s?\d|AiWord|refType/i.test(all))
})

test('계획표 카드 렌더: 진행 중 = 링크 줄·지표·버튼 없음 / 오류 = 알림 / 없음 = 시작', () => {
  const today = { date: '2026-10-06', dayIndex: 4, topic: { id: 't1', title: '카페 주문' }, tasks: [words('TODO'), lesson('GENERATING')], goalMet: false }
  const html = renderToStaticMarkup(createElement(ChallengePlanCard, { status: 'ready', data: { challenge: summary(), today, recentlyEnded: null }, dailyWordCount: 10, onRetry: () => {} }))
  assert.ok(html.includes('챌린지 · 4일째 / 7일'))
  assert.ok(html.includes('카페 주문 7일 챌린지'))
  assert.ok(html.includes('67%') && html.includes('3일 중 2일') && html.includes('수행 연속'))
  assert.ok(html.includes('href="/study/today"'))
  assert.ok(html.includes('만드는 중 · 1분쯤'))
  assert.ok(!html.includes('오늘 수업 만들기'))
  assert.ok(!html.includes('<button'))
  const err = renderToStaticMarkup(createElement(ChallengePlanCard, { status: 'error', data: null, dailyWordCount: 10, onRetry: () => {} }))
  assert.ok(err.includes('role="alert"') && err.includes('달력은 그대로 볼 수 있어요.'))
  const none = renderToStaticMarkup(createElement(ChallengePlanCard, { status: 'ready', data: { challenge: null, today: null, recentlyEnded: null }, dailyWordCount: 12, onRetry: () => {} }))
  assert.ok(none.includes('href="/plan/challenge/new"') && none.includes('오늘의 단어 10장') && none.includes('href="/plan/challenges"'))
  const one = renderToStaticMarkup(
    createElement(ChallengePlanCard, {
      status: 'ready',
      data: { challenge: summary({ dailyGoal: { ...GOAL, words: false, wordCount: null, wordsMinAnswered: null } }), today: { ...today, tasks: [lesson('TODO')] }, recentlyEnded: null },
      dailyWordCount: 10,
      onRetry: () => {},
    }),
  )
  assert.ok(!one.includes('오늘의 단어') && one.includes('0 / 1'))
})
