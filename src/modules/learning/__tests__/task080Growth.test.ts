/**
 * task-080 — #78 성장 탭 계산(docs/screens.md §36-6 A·B·C·36-7): 기간·주 시작 일요일 · 단계(정수 비교 50/70/85%) · 표본 기준(20건·3일 / 역할극 5번) ·
 * 추세(반 기간 각 20건·±5%p) · 추이선 점 · 출석(Attendance)·연속·since · 기록 전 주 · skills 없는 옛 행 · 평가 형식 · 응답 모양(errorTrend·uncertain 없음).
 * DB 0 — `getGrowth` 는 가짜 db 로 질의 조건(세션 사용자만·쓰기 없음)만 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, dates } from '@/modules/infra'
import { GROWTH_AXES } from '@/types/plan'
import { isStudyDay } from '../repetition/review'
import {
  buildGrowth,
  dailyKinds,
  evaluationFromSnapshot,
  getGrowth,
  GROWTH_AXIS_RECORDED,
  growthRange,
  longestRunOfDates,
  parseGrowthWeeks,
  skillSpark,
  skillStage,
  skillTrend,
  type DailyRowInput,
  type EvaluationRowInput,
  type GrowthDb,
  type GrowthInputs,
  type SkillCounts,
} from '../snapshots/growth'

const c = (success: number, partial: number, fail: number, skipped = 0): SkillCounts => ({ success, partial, fail, skipped })
const input = (over: Partial<GrowthInputs> = {}): GrowthInputs => ({ today: '2026-10-20', weeks: 4, attendanceDates: [], dailyRows: [], earliestDaily: null, evaluationRows: [], ...over })
const skillOf = (r: ReturnType<typeof buildGrowth>['response'], axis: string) => r.skills.find((s) => s.axis === axis)!
const RUBRIC = { accuracy: 3, vocabulary: 3, grammar: 2, naturalness: 3, assembly: 4 }

// ── A. 기간·날짜 ──────────────────────────────────────────────────────────────

test('growthRange — 2026-10-20(화): 4주 09-27 · 8주 08-30 · 12주 08-02 (데모 값과 같음), to = today, 주 시작 0', () => {
  assert.deepEqual(growthRange('2026-10-20', 4), { weeks: 4, from: '2026-09-27', to: '2026-10-20', today: '2026-10-20', weekStartsOn: 0 })
  assert.equal(growthRange('2026-10-20', 8).from, '2026-08-30')
  assert.equal(growthRange('2026-10-20', 12).from, '2026-08-02')
  // 오늘이 일요일 = 그 주 첫날, 토요일 = 그 주 끝날
  assert.equal(growthRange('2026-10-18', 4).from, '2026-09-27')
  assert.equal(growthRange('2026-10-24', 4).from, '2026-09-27')
  assert.equal(growthRange('2026-10-25', 4).from, '2026-10-04')
})

test('parseGrowthWeeks — 생략·빈 값 = 4, 4|8|12 만, 그 밖 400 VALIDATION {field:weeks, reason:"4|8|12"}', () => {
  assert.equal(parseGrowthWeeks(null), 4)
  assert.equal(parseGrowthWeeks(undefined), 4)
  assert.equal(parseGrowthWeeks(''), 4)
  assert.equal(parseGrowthWeeks('4'), 4)
  assert.equal(parseGrowthWeeks('8'), 8)
  assert.equal(parseGrowthWeeks('12'), 12)
  for (const bad of ['5', '04', '4.0', ' 4', 'abc', '-4', '16', '0']) {
    assert.throws(
      () => parseGrowthWeeks(bad),
      (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && (e.details as Record<string, unknown>).field === 'weeks' && (e.details as Record<string, unknown>).reason === '4|8|12',
      bad,
    )
  }
})

test('dailyKinds — 단어·수업·복습·대화(음성+글자 = 1)·평가·교정 채택 0~6, kinds>0 ⇔ isStudyDay', () => {
  const samples: unknown[] = [
    {},
    null,
    { words: { sessions: 1 } },
    { talkTurns: 3, chatTurns: 2 },
    { chatTurns: 1 },
    { corrections: { proposed: 5, accepted: 0 } },
    { words: { sessions: 1 }, lessons: 1, reviews: 1, talkTurns: 1, evals: 1, corrections: { accepted: 1 } },
    { attended: true, repetition: { studied: 3 }, observations: { total: 9 } },
  ]
  assert.deepEqual(samples.map(dailyKinds), [0, 0, 1, 1, 1, 0, 6, 0])
  for (const s of samples) assert.equal(dailyKinds(s) > 0, isStudyDay(s), JSON.stringify(s))
})

test('longestRunOfDates — 끊김·같은 날 중복·달 경계', () => {
  assert.equal(longestRunOfDates([]), 0)
  assert.equal(longestRunOfDates(['2026-10-01']), 1)
  assert.equal(longestRunOfDates(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04']), 3)
  assert.equal(longestRunOfDates(['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-03']), 3, '연속 중간의 같은 날 중복이 연속을 끊지 않는다(가드가 없으면 2)')
})

// ── B. 단계·추세·추이선 ────────────────────────────────────────────────────────

test('skillStage — 정수 비교, 정확히 50/70/85% 는 위 칸', () => {
  assert.equal(skillStage(c(0, 0, 0)), null)
  assert.equal(skillStage(c(9, 0, 11)), 0) // 45%
  assert.equal(skillStage(c(10, 0, 10)), 1) // 50% 정확히 → 익히는 중
  assert.equal(skillStage(c(9, 2, 9)), 1) // (9+1)/20 = 50%
  assert.equal(skillStage(c(9, 1, 10)), 0) // 47.5%
  assert.equal(skillStage(c(13, 1, 6)), 1) // 67.5%
  assert.equal(skillStage(c(14, 0, 6)), 2) // 70% 정확히
  assert.equal(skillStage(c(16, 1, 3)), 2) // 82.5%
  assert.equal(skillStage(c(17, 0, 3)), 3) // 85% 정확히
  assert.equal(skillStage(c(16, 2, 2)), 3) // 85% 정확히(일부 포함)
  assert.equal(skillStage(c(20, 0, 0, 50)), 3, '넘김은 n 에 안 든다')
  // 부동소수로는 경계가 흔들리는 비율(7/10 = 0.7)도 정수 비교라 위 칸
  assert.equal(skillStage(c(7, 0, 3)), 2)
})

test('skillTrend — L<2 null · 반 기간 n 19 null/20 판정 · ±5%p 정확히는 UP/DOWN · 홀수 L 은 뒤 반이 더 길다', () => {
  assert.equal(skillTrend([], 20), null)
  assert.equal(skillTrend([c(20, 0, 0)], 20), null)
  assert.equal(skillTrend([c(10, 0, 9), c(20, 0, 0)], 20), null, '앞 반 19건')
  assert.equal(skillTrend([c(10, 0, 10), c(11, 0, 9)], 20), 'UP', '50% → 55% 정확히 +5%p')
  assert.equal(skillTrend([c(10, 0, 10), c(10, 1, 9)], 20), 'FLAT', '50% → 52.5%')
  assert.equal(skillTrend([c(12, 0, 8), c(11, 0, 9)], 20), 'DOWN', '60% → 55% 정확히 −5%p')
  assert.equal(skillTrend([c(12, 0, 8), c(11, 1, 8)], 20), 'FLAT', '60% → 57.5%')
  // L=3: 앞 반 = 첫 주, 뒤 반 = 나머지 두 주 합
  assert.equal(skillTrend([c(10, 0, 10), c(6, 0, 4), c(6, 0, 4)], 20), 'UP')
  assert.equal(skillTrend([c(10, 0, 10), c(19, 0, 0), c(0, 0, 0)], 20), null, '뒤 반 19건')
  // SESSION 은 반마다 3번
  assert.equal(skillTrend([c(1, 0, 2), c(3, 0, 0)], 3), 'UP')
  assert.equal(skillTrend([c(1, 0, 1), c(3, 0, 0)], 3), null)
})

test('skillSpark — 그 주 n ≥ 5 만, 소수 셋째 자리', () => {
  assert.deepEqual(skillSpark([c(4, 0, 0), c(2, 0, 1, 9), c(5, 0, 0), c(3, 1, 2), c(2, 0, 1)]), [1, 0.583])
  assert.deepEqual(skillSpark([c(2, 0, 1), c(2, 0, 1), c(1, 2, 2)]), [0.4])
})

// ── 통합(buildGrowth) ─────────────────────────────────────────────────────────

function fixtureA(): GrowthInputs {
  const dailyRows: DailyRowInput[] = [
    { periodKey: '2026-10-08', data: { attended: false, words: { sessions: 1, correct: 6, wrong: 1 }, skills: { VOCAB_RECALL: { success: 6, partial: 0, fail: 1, skipped: 0, uncertain: 3 }, SENTENCE_PRODUCTION: { success: 5 } } } },
    {
      periodKey: '2026-10-09',
      data: {
        lessons: 1,
        skills: {
          VOCAB_RECALL: { success: 5, partial: 1, fail: 1, skipped: 2 },
          GRAMMAR_PARTICLE: { fail: 10 },
          SENTENCE_PRODUCTION: { success: 7 },
          LISTEN_RESPOND: { success: 30 },
          CONVERSATION_MAINTAIN: { success: 4, fail: 1 },
        },
      },
    },
    { periodKey: '2026-10-13', data: { talkTurns: 4, chatTurns: 2, corrections: { proposed: 3, accepted: 1 }, skills: { VOCAB_RECALL: { success: 5, fail: 1 }, GRAMMAR_PARTICLE: { success: 10 }, SENTENCE_PRODUCTION: { success: 7 } } } },
    { periodKey: '2026-10-19', data: { evals: 1 } }, // skills 칸 없는 옛 행(백필 전)
    { periodKey: '2026-10-20', data: { reviews: 1, words: { sessions: 2, correct: 10, wrong: 4 } } },
    { periodKey: '2026-09-01', data: { lessons: 9, skills: { VOCAB_RECALL: { success: 99 } } } }, // 기간 밖(방어)
  ]
  const at = (iso: string) => new Date(iso)
  const evaluationRows: EvaluationRowInput[] = [
    { periodKey: 'ev_talk', data: { kind: 'TALK', level: 'N4', total: 62, grade: 'FAIR', rubric: RUBRIC, itemCount: 5, date: '2026-10-06' }, createdAt: at('2026-10-06T11:20:00.000Z') },
    { periodKey: 'ev_words', data: { kind: 'WORDS', level: 'N4', total: 70, grade: 'GOOD', rubric: RUBRIC, itemCount: 10, date: '2026-10-06' }, createdAt: at('2026-10-06T09:00:00.000Z') },
    { periodKey: 'ev_old', data: { kind: 'TALK', level: 'N5', total: 40, grade: 'FAIR', rubric: RUBRIC, itemCount: 5, date: '2026-09-01' }, createdAt: at('2026-09-01T09:00:00.000Z') },
    { periodKey: 'ev_bad6', data: { kind: 'TALK', level: 'N4', total: 80, grade: 'GOOD', rubric: { ...RUBRIC, grammar: 6 }, itemCount: 5, date: '2026-10-10' }, createdAt: at('2026-10-10T09:00:00.000Z') },
    { periodKey: 'ev_badkey', data: { kind: 'TALK', level: 'N4', total: 80, grade: 'GOOD', rubric: { accuracy: 3 }, itemCount: 5, date: '2026-10-11' }, createdAt: at('2026-10-11T09:00:00.000Z') },
  ]
  return input({
    attendanceDates: ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-13', '2026-10-19', '2026-10-20'],
    dailyRows,
    earliestDaily: '2026-09-01',
    evaluationRows,
  })
}

test('buildGrowth — 응답 모양: range·since·summary·days·weeks·skills 5개·evaluations·hasEvaluations, errorTrend·uncertain 키 없음', () => {
  const { response: r, rejectedEvaluations } = buildGrowth(fixtureA())
  assert.deepEqual(Object.keys(r), ['range', 'since', 'summary', 'days', 'weeks', 'skills', 'evaluations', 'hasEvaluations'])
  assert.ok(!('errorTrend' in r))
  assert.deepEqual(r.range, { weeks: 4, from: '2026-09-27', to: '2026-10-20', today: '2026-10-20', weekStartsOn: 0 })
  assert.equal(r.since, '2026-09-01', '출석 최솟값과 DAILY 최솟값 중 이른 쪽')
  assert.equal(r.days.length, 24)
  assert.equal(r.days[0].date, '2026-09-27')
  assert.equal(r.days.at(-1)!.date, '2026-10-20')
  assert.deepEqual(r.skills.map((s) => s.axis), [...GROWTH_AXES])
  for (const s of r.skills) assert.ok(!('uncertain' in s), s.axis)
  assert.equal(rejectedEvaluations, 2)
})

test('buildGrowth — 출석은 Attendance: 연속 2(오늘 기준)·최장 4(전체 기간), days.attended, 공부한 날·이번 주', () => {
  const { response: r } = buildGrowth(fixtureA())
  assert.deepEqual(r.summary, { streak: 2, longestStreak: 4, studyDays: 5, thisWeekStudyDays: 2 })
  const d = (date: string) => r.days.find((x) => x.date === date)!
  assert.deepEqual(d('2026-10-10'), { date: '2026-10-10', attended: true, kinds: 0 }, '출석만 한 날')
  assert.deepEqual(d('2026-10-13'), { date: '2026-10-13', attended: true, kinds: 2 }, '대화(음성+글자 = 1) + 교정 채택')
  assert.deepEqual(d('2026-10-19'), { date: '2026-10-19', attended: true, kinds: 1 })
  assert.deepEqual(d('2026-10-12'), { date: '2026-10-12', attended: false, kinds: 0 })
})

test('buildGrowth — 주 4개(일요일 시작) 합계·before·studyDays·attendedDays, talkTurns 는 DAILY talkTurns 만', () => {
  const { response: r } = buildGrowth({ ...fixtureA(), earliestDaily: '2026-10-08' })
  assert.equal(r.since, '2026-10-08')
  assert.deepEqual(r.weeks.map((w) => [w.weekStart, w.before]), [['2026-09-27', true], ['2026-10-04', false], ['2026-10-11', false], ['2026-10-18', false]])
  const [w0, w1, w2, w3] = r.weeks
  assert.deepEqual(w0, { weekStart: '2026-09-27', before: true, attendedDays: 0, studyDays: 0, words: { sessions: 0, correct: 0, wrong: 0 }, lessons: 0, reviews: 0, talkTurns: 0, chatTurns: 0, correctionsAccepted: 0 })
  assert.deepEqual([w1.attendedDays, w1.studyDays, w1.words, w1.lessons], [3, 2, { sessions: 1, correct: 6, wrong: 1 }, 1])
  assert.deepEqual([w2.attendedDays, w2.studyDays, w2.talkTurns, w2.chatTurns, w2.correctionsAccepted], [2, 1, 4, 2, 1])
  assert.deepEqual([w3.attendedDays, w3.studyDays, w3.reviews, w3.words.sessions], [2, 2, 1, 2])
  // 기록 전 경계: 그 주 토요일 < since 일 때만 before
  const sat = buildGrowth({ ...input(), earliestDaily: '2026-10-03' }).response
  assert.equal(sat.weeks[0].before, false, 'since = 그 주 토요일 → 기록 전 아님')
  const sun = buildGrowth({ ...input(), earliestDaily: '2026-10-04' }).response
  assert.equal(sun.weeks[0].before, true, 'since = 다음 주 일요일 → 기록 전')
})

test('buildGrowth — 공부결과 축: 20건·3일 → 단계 / 20건·2일 → 아직 / 19건 → 아직 / 역할극 5번 → 단계 / 듣고 응답은 데이터가 있어도 기록 전', () => {
  const { response: r } = buildGrowth(fixtureA())
  const v = skillOf(r, 'VOCAB_RECALL')
  // 6+1 · 5+1+1(+넘김 2) · 5+1 = 20건, 3일
  assert.deepEqual([v.recorded, v.unit, v.n, v.success, v.partial, v.fail, v.skipped, v.obsDays, v.min, v.minDays, v.enough, v.stage], [true, 'OBSERVATION', 20, 16, 1, 3, 2, 3, 20, 3, true, 2])
  assert.equal(v.trend, null, '기록한 주 4개 → 앞 반(첫 두 주) 14건 < 20')
  assert.deepEqual(v.spark, [0.821, 0.833], '주별 n ≥ 5 인 주만(10/4 주 23/28, 10/11 주 10/12)')
  const g = skillOf(r, 'GRAMMAR_PARTICLE')
  assert.deepEqual([g.n, g.obsDays, g.enough, g.stage, g.trend], [20, 2, false, null, null], '20건이지만 2일')
  const sp = skillOf(r, 'SENTENCE_PRODUCTION')
  assert.deepEqual([sp.n, sp.obsDays, sp.enough, sp.stage], [19, 3, false, null], '19건')
  const cm = skillOf(r, 'CONVERSATION_MAINTAIN')
  assert.deepEqual([cm.unit, cm.n, cm.min, cm.minDays, cm.obsDays, cm.enough, cm.stage], ['SESSION', 5, 5, null, 1, true, 2], '역할극 5번(하루) → 단계, 80%')
  const lr = skillOf(r, 'LISTEN_RESPOND')
  assert.equal(GROWTH_AXIS_RECORDED.LISTEN_RESPOND, false)
  assert.deepEqual(lr, { axis: 'LISTEN_RESPOND', unit: 'OBSERVATION', min: 20, minDays: 3, recorded: false, n: 0, success: 0, partial: 0, fail: 0, skipped: 0, obsDays: 0, enough: false, oneSided: false, stage: null, trend: null, spark: [] })
  for (const s of r.skills) assert.equal(s.oneSided, false, `${s.axis} — fromCorrection 칸 없는 행 → C 규칙 영향 없음`)
  assert.ok(!('fromCorrection' in v), '응답에 fromCorrection 칸을 싣지 않는다(oneSided 만)')
})

/** 4주(09-27~10-20) 3일·두 반(각 n=20)에 걸친 문형·조사 관측 — 교정 유래 합 = fc. 날마다는 95%·81.8%·88.9%(합쳐야 90%). */
const oneSidedRows = (fc: { d1: number; d2: number; d3: number }): DailyRowInput[] => [
  { periodKey: '2026-09-28', data: { skills: { GRAMMAR_PARTICLE: { success: 1, partial: 0, fail: 19, skipped: 3, uncertain: 2, fromCorrection: fc.d1 } } } },
  { periodKey: '2026-10-12', data: { skills: { GRAMMAR_PARTICLE: { success: 2, partial: 0, fail: 9, skipped: 0, uncertain: 0, fromCorrection: fc.d2 } } } },
  { periodKey: '2026-10-13', data: { skills: { GRAMMAR_PARTICLE: { success: 1, partial: 0, fail: 8, skipped: 0, uncertain: 0, fromCorrection: fc.d3 } } } },
]

test('buildGrowth — C 규칙: 기간 합 교정 유래 정확히 90%(10c = 9n) → oneSided · stage/trend null · spark [] · enough 그대로', () => {
  const r = buildGrowth(input({ earliestDaily: '2026-09-27', dailyRows: oneSidedRows({ d1: 19, d2: 9, d3: 8 }) })).response
  const g = skillOf(r, 'GRAMMAR_PARTICLE')
  assert.deepEqual([g.n, g.obsDays, g.enough, g.oneSided, g.stage, g.trend, g.spark], [40, 3, true, true, null, null, []], '36/40 = 90%(날마다 따로면 95·81.8·88.9%)')
  assert.deepEqual([g.success, g.fail, g.skipped], [4, 36, 3], '숫자 칸은 그대로 보낸다')
  for (const s of r.skills.filter((x) => x.axis !== 'GRAMMAR_PARTICLE')) assert.equal(s.oneSided, false, s.axis)
})

test('buildGrowth — C 규칙 경계: 35/40(87.5%) → 아님 · 단계·추세·추이선 보임 / 899/1000(89.9%) → 아님 · 900/1000 → 참', () => {
  const r = buildGrowth(input({ earliestDaily: '2026-09-27', dailyRows: oneSidedRows({ d1: 19, d2: 9, d3: 7 }) })).response
  const g = skillOf(r, 'GRAMMAR_PARTICLE')
  assert.deepEqual([g.oneSided, g.enough, g.stage, g.trend], [false, true, 0, 'UP'], '앞 반 5% → 뒤 반 15%')
  assert.deepEqual(g.spark, [0.05, 0.15])
  const big = (fc: number): DailyRowInput[] => ['2026-10-12', '2026-10-13', '2026-10-14'].map((d, i) => ({
    periodKey: d,
    data: { skills: { VOCAB_RECALL: { success: i === 0 ? 100 : 0, partial: 0, fail: i === 0 ? 300 : 300, skipped: 0, uncertain: 0, fromCorrection: i === 0 ? fc - 600 : 300 } } },
  }))
  const below = skillOf(buildGrowth(input({ earliestDaily: '2026-10-12', dailyRows: big(899) })).response, 'VOCAB_RECALL')
  assert.deepEqual([below.n, below.oneSided, below.enough, below.stage !== null], [1000, false, true, true], '10·899 = 8990 < 9000')
  const at = skillOf(buildGrowth(input({ earliestDaily: '2026-10-12', dailyRows: big(900) })).response, 'VOCAB_RECALL')
  assert.deepEqual([at.oneSided, at.stage, at.spark], [true, null, []])
})

test('buildGrowth — C 규칙은 표본이 찼을 때만: 19건·20건 2일은 교정 100% 여도 아님(stage null) · n = 0 → 아님 · 기록 전 축 → 아님 · 옛 행은 0', () => {
  const r = buildGrowth(
    input({
      earliestDaily: '2026-10-12',
      dailyRows: [
        {
          periodKey: '2026-10-12',
          data: {
            skills: {
              SENTENCE_PRODUCTION: { success: 0, partial: 0, fail: 0, skipped: 4, uncertain: 3, fromCorrection: 2 },
              LISTEN_RESPOND: { success: 0, partial: 0, fail: 30, skipped: 0, uncertain: 0, fromCorrection: 30 },
              VOCAB_RECALL: { success: 0, partial: 1, fail: 9, skipped: 0, uncertain: 0, fromCorrection: 10 },
              GRAMMAR_PARTICLE: { success: 2, partial: 0, fail: 8 },
            },
          },
        },
        { periodKey: '2026-10-13', data: { skills: { VOCAB_RECALL: { success: 0, partial: 0, fail: 5, skipped: 0, uncertain: 0, fromCorrection: 5 }, GRAMMAR_PARTICLE: { success: 2, partial: 0, fail: 8 } } } },
        { periodKey: '2026-10-14', data: { skills: { VOCAB_RECALL: { success: 0, partial: 0, fail: 4, skipped: 0, uncertain: 0, fromCorrection: 4 }, GRAMMAR_PARTICLE: { success: 2, partial: 0, fail: 8 } } } },
      ],
    }),
  ).response
  assert.deepEqual([skillOf(r, 'SENTENCE_PRODUCTION').n, skillOf(r, 'SENTENCE_PRODUCTION').oneSided], [0, false])
  assert.deepEqual([skillOf(r, 'LISTEN_RESPOND').recorded, skillOf(r, 'LISTEN_RESPOND').oneSided], [false, false], '기록 전 축은 교정 100% 여도 아님')
  const v = skillOf(r, 'VOCAB_RECALL')
  assert.deepEqual([v.n, v.obsDays, v.enough, v.oneSided, v.stage, v.spark.length > 0], [19, 3, false, false, null, true], '19건·교정 100% — 표본 부족이 먼저(oneSided 아님)')
  const g = skillOf(r, 'GRAMMAR_PARTICLE')
  assert.deepEqual([g.n, g.enough, g.oneSided, g.stage !== null], [30, true, false, true], 'fromCorrection 칸 없는 옛 행 = 0 → 단계 보임')
  // 20건이지만 2일(표본 부족) — 교정 100%
  const twoDays = buildGrowth(
    input({
      earliestDaily: '2026-10-12',
      dailyRows: ['2026-10-12', '2026-10-13'].map((d) => ({ periodKey: d, data: { skills: { GRAMMAR_PARTICLE: { success: 0, partial: 0, fail: 10, skipped: 0, uncertain: 0, fromCorrection: 10 } } } })),
    }),
  ).response
  const t = skillOf(twoDays, 'GRAMMAR_PARTICLE')
  assert.deepEqual([t.n, t.obsDays, t.enough, t.oneSided, t.stage], [20, 2, false, false, null])
  // 같은 20건을 3일로 → 표본이 차서 oneSided
  const threeDays = buildGrowth(
    input({
      earliestDaily: '2026-10-12',
      dailyRows: ['2026-10-12', '2026-10-13', '2026-10-14'].map((d, i) => ({ periodKey: d, data: { skills: { GRAMMAR_PARTICLE: { success: 0, partial: 0, fail: i < 2 ? 7 : 6, skipped: 0, uncertain: 0, fromCorrection: i < 2 ? 7 : 6 } } } })),
    }),
  ).response
  assert.deepEqual([skillOf(threeDays, 'GRAMMAR_PARTICLE').enough, skillOf(threeDays, 'GRAMMAR_PARTICLE').oneSided], [true, true])
})

test('buildGrowth — 역할극 4번은 아직, 5번째에 단계 / 백필 전(skills 칸 없는 행만)은 전 축 n=0', () => {
  const four = buildGrowth(input({ earliestDaily: '2026-10-19', dailyRows: [{ periodKey: '2026-10-19', data: { talkTurns: 9, skills: { CONVERSATION_MAINTAIN: { success: 4 } } } }] })).response
  assert.deepEqual([skillOf(four, 'CONVERSATION_MAINTAIN').n, skillOf(four, 'CONVERSATION_MAINTAIN').enough], [4, false])
  const five = buildGrowth(input({ earliestDaily: '2026-10-19', dailyRows: [{ periodKey: '2026-10-19', data: { skills: { CONVERSATION_MAINTAIN: { success: 4, partial: 1 } } } }] })).response
  assert.deepEqual([skillOf(five, 'CONVERSATION_MAINTAIN').enough, skillOf(five, 'CONVERSATION_MAINTAIN').stage], [true, 3], '(8+1)/10 = 90%')
  const legacy = buildGrowth(input({ earliestDaily: '2026-10-13', dailyRows: [{ periodKey: '2026-10-13', data: { words: { sessions: 3 }, observations: { total: 40, bySkill: { VOCAB_RECALL: { success: 40 } } } } }] })).response
  for (const s of legacy.skills) assert.deepEqual([s.n, s.enough, s.stage], [0, false, null], `${s.axis} — observations.bySkill 은 읽지 않는다`)
})

test('buildGrowth — 추세는 기록 전 주를 빼고 판정(8주, 앞 반 50% → 뒤 반 55%)', () => {
  // 8주 기간 08-30 ~ 10-20, since 09-13 → 앞 두 주(08-30·09-06)는 기록 전, 기록한 주 6개(09-13~10-18) → 앞 반 3주 24건 50%, 뒤 반 3주 24건 62.5%
  const weekStarts = ['2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18']
  const rows: DailyRowInput[] = weekStarts.map((ws, i) => ({ periodKey: ws, data: { skills: { VOCAB_RECALL: i < 3 ? { success: 4, partial: 0, fail: 4 } : { success: 5, partial: 0, fail: 3 } } } }))
  const r = buildGrowth(input({ weeks: 8, earliestDaily: '2026-09-13', dailyRows: rows })).response
  assert.deepEqual(r.weeks.map((w) => w.before), [true, true, false, false, false, false, false, false])
  const v = skillOf(r, 'VOCAB_RECALL')
  assert.deepEqual([v.n, v.obsDays, v.enough, v.trend], [48, 6, true, 'UP'])
  assert.deepEqual(v.spark, [0.5, 0.5, 0.5, 0.625, 0.625, 0.625])
})

test('buildGrowth — 평가: 기간 안만·날짜 오름차순(같은 날은 만든 순)·형식 틀린 행 제외·hasEvaluations 는 전체 기간', () => {
  const { response: r } = buildGrowth(fixtureA())
  assert.deepEqual(r.evaluations.map((e) => e.id), ['ev_words', 'ev_talk'])
  assert.deepEqual(r.evaluations[1], { id: 'ev_talk', kind: 'TALK', level: 'N4', totalScore: 62, grade: 'FAIR', rubric: RUBRIC, date: '2026-10-06', completedAt: '2026-10-06T11:20:00.000Z' })
  assert.equal(r.hasEvaluations, true)
  const onlyOld = buildGrowth(input({ evaluationRows: [fixtureA().evaluationRows[2]] })).response
  assert.deepEqual([onlyOld.evaluations.length, onlyOld.hasEvaluations], [0, true], '기간 밖에만 있음 → 기간 안 0건, 전체 1건')
  assert.equal(evaluationFromSnapshot({ periodKey: 'x', data: { kind: 'TALK', total: 1, date: '2026-10-01', rubric: null }, createdAt: new Date() }), null, 'rubric null')
  assert.equal(evaluationFromSnapshot({ periodKey: 'x', data: { kind: 'EXAM', total: 1, date: '2026-10-01', rubric: RUBRIC }, createdAt: new Date() }), null, '종류 밖')
  assert.equal(evaluationFromSnapshot({ periodKey: 'x', data: { kind: 'TALK', total: 1, date: '2026-10-01', rubric: { ...RUBRIC, accuracy: -1 } }, createdAt: new Date() }), null, '0 미만')
  assert.equal(evaluationFromSnapshot({ periodKey: 'x', data: { kind: 'TALK', total: 1, date: '2026-10-01', rubric: { ...RUBRIC, accuracy: '3' } }, createdAt: new Date() }), null, '문자열')
})

test('buildGrowth — 완전 처음(데이터 없음): since null → 주 전부 기록 전, 숫자 0, 축 전부 아직, 평가 없음', () => {
  const r = buildGrowth(input()).response
  assert.equal(r.since, null)
  assert.ok(r.weeks.every((w) => w.before))
  assert.deepEqual(r.summary, { streak: 0, longestStreak: 0, studyDays: 0, thisWeekStudyDays: 0 })
  assert.ok(r.days.every((d) => !d.attended && d.kinds === 0))
  assert.ok(r.skills.every((s) => s.n === 0 && !s.enough && s.stage === null && s.trend === null))
  assert.deepEqual([r.evaluations, r.hasEvaluations], [[], false])
  // 첫날(오늘 출석만): since = 오늘, 마지막 주만 기록
  const first = buildGrowth(input({ attendanceDates: ['2026-10-20'] })).response
  assert.equal(first.since, '2026-10-20')
  assert.deepEqual(first.weeks.map((w) => w.before), [true, true, true, false])
  assert.deepEqual([first.summary.streak, first.summary.longestStreak], [1, 1])
})

test('buildGrowth — 오늘이 일요일이면 이번 주 = 오늘 하루, 토요일이면 일~토 7일', () => {
  const rows = (ds: string[]) => ds.map((d) => ({ periodKey: d, data: { lessons: 1 } }))
  const sun = buildGrowth(input({ today: '2026-10-18', earliestDaily: '2026-10-17', dailyRows: rows(['2026-10-17', '2026-10-18']) })).response
  assert.equal(sun.weeks.at(-1)!.weekStart, '2026-10-18')
  assert.equal(sun.days.at(-1)!.date, '2026-10-18')
  assert.equal(sun.summary.thisWeekStudyDays, 1, '토요일(10-17)은 지난 주')
  assert.equal(sun.weeks.at(-2)!.studyDays, 1)
  const sat = buildGrowth(input({ today: '2026-10-24', earliestDaily: '2026-10-18', dailyRows: rows(['2026-10-18', '2026-10-21', '2026-10-24']) })).response
  assert.equal(sat.weeks.at(-1)!.weekStart, '2026-10-18')
  assert.equal(sat.summary.thisWeekStudyDays, 3)
  assert.equal(sat.days.length, 28)
})

// ── getGrowth: 질의 조건(가짜 db) ──────────────────────────────────────────────

test('getGrowth — 세션 사용자 행만 읽고(모든 where.userId), DAILY 는 기간 안, 쓰기 메서드 없음, today 는 KST', async () => {
  const ME = 'cuser_t080_me_000000000'
  const calls: { op: string; where: Record<string, unknown> }[] = []
  const db = {
    attendance: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        calls.push({ op: 'attendance.findMany', where: args.where })
        return [{ date: dates.toDbDate('2026-10-19') }, { date: dates.toDbDate('2026-10-20') }]
      },
    },
    statsSnapshot: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        calls.push({ op: 'statsSnapshot.findMany', where: args.where })
        return args.where.kind === 'DAILY'
          ? [{ periodKey: '2026-10-20', data: { words: { sessions: 1 }, skills: { VOCAB_RECALL: { success: 2 } } } }]
          : [{ periodKey: 'ev1', data: { kind: 'TALK', level: 'N4', total: 50, grade: 'FAIR', rubric: RUBRIC, date: '2026-10-19' }, createdAt: new Date('2026-10-19T01:00:00Z') }]
      },
      findFirst: async (args: { where: Record<string, unknown> }) => {
        calls.push({ op: 'statsSnapshot.findFirst', where: args.where })
        return { periodKey: '2026-10-19' }
      },
    },
  } as unknown as GrowthDb
  const r = await getGrowth(ME, 4, new Date('2026-10-19T15:30:00.000Z'), db) // 10-20 00:30 KST
  assert.equal(r.range.today, '2026-10-20')
  assert.equal(calls.length, 4)
  for (const c of calls) assert.equal(c.where.userId, ME, c.op)
  const daily = calls.find((c) => c.op === 'statsSnapshot.findMany' && c.where.kind === 'DAILY')!
  assert.deepEqual(daily.where.periodKey, { gte: '2026-09-27', lte: '2026-10-20' })
  assert.ok(calls.some((c) => c.where.kind === 'EVALUATION'))
  assert.deepEqual([r.summary.streak, r.since, r.evaluations.length, skillOf(r, 'VOCAB_RECALL').n], [2, '2026-10-19', 1, 2])
  await assert.rejects(getGrowth('', 4, new Date(), db), (e: unknown) => e instanceof ApiError && e.code === 'UNAUTHENTICATED')
})
