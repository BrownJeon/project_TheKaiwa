/**
 * #78 응답 고정값(task-080 화면 시험 · 헤드리스 시각 검증 공용) — 승인 데모 v4 의 성장 ①②③(적음·보통·풍부)을 응답 모양(screens.md §36-7)으로 옮겼다.
 * 서버 계산을 흉내 내지 않는다: 단계·추세·표본 판정 값은 손으로 정한 값이다(화면은 그 값을 그대로 그린다).
 */
import { addDays, countDays, weekStartOf } from '@/modules/infra/dates'
import type { GrowthEvaluation, GrowthResponse, GrowthSkill, GrowthWeeks } from '@/types/plan'

export const TODAY = '2026-10-20' // 화요일

type WeekVals = { words: number; lessons: number; reviews: number; talk: number; chat: number; corr: number }

function build(opts: {
  weeks: GrowthWeeks
  today?: string
  since: string | null
  study: Record<string, number>
  attendOnly?: string[]
  vals?: (WeekVals | null)[]
  skills: GrowthSkill[]
  evaluations?: GrowthEvaluation[]
  hasEvaluations?: boolean
}): GrowthResponse {
  const today = opts.today ?? TODAY
  const from = addDays(weekStartOf(today), -7 * (opts.weeks - 1))
  const att = new Set([...Object.keys(opts.study), ...(opts.attendOnly ?? [])])
  const days = Array.from({ length: countDays(from, today) }, (_, i) => {
    const date = addDays(from, i)
    return { date, attended: att.has(date), kinds: opts.study[date] ?? 0 }
  })
  const weeks = Array.from({ length: opts.weeks }, (_, j) => {
    const ws = addDays(from, 7 * j)
    const inWeek = days.filter((d) => d.date >= ws && d.date <= addDays(ws, 6))
    const v = opts.vals?.[j] ?? null
    return {
      weekStart: ws,
      before: opts.since === null || addDays(ws, 6) < opts.since,
      attendedDays: inWeek.filter((d) => d.attended).length,
      studyDays: inWeek.filter((d) => d.kinds > 0).length,
      words: { sessions: v?.words ?? 0, correct: 0, wrong: 0 },
      lessons: v?.lessons ?? 0,
      reviews: v?.reviews ?? 0,
      talkTurns: v?.talk ?? 0,
      chatTurns: v?.chat ?? 0,
      correctionsAccepted: v?.corr ?? 0,
    }
  })
  let streak = 0
  for (let d = today; att.has(d); d = addDays(d, -1)) streak++
  let longest = 0
  let run = 0
  const first = opts.since ?? today
  for (let d = first; d <= today; d = addDays(d, 1)) {
    run = att.has(d) ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  const thisWeek = weekStartOf(today)
  return {
    range: { weeks: opts.weeks, from, to: today, today, weekStartsOn: 0 },
    since: opts.since,
    summary: {
      streak,
      longestStreak: longest,
      studyDays: days.filter((d) => d.kinds > 0).length,
      thisWeekStudyDays: days.filter((d) => d.date >= thisWeek && d.kinds > 0).length,
    },
    days,
    weeks,
    skills: opts.skills,
    evaluations: opts.evaluations ?? [],
    hasEvaluations: opts.hasEvaluations ?? (opts.evaluations ?? []).length > 0,
  }
}

export function skill(axis: GrowthSkill['axis'], over: Partial<GrowthSkill> = {}): GrowthSkill {
  const session = axis === 'CONVERSATION_MAINTAIN'
  return {
    axis,
    recorded: axis !== 'LISTEN_RESPOND',
    unit: session ? 'SESSION' : 'OBSERVATION',
    n: 0,
    success: 0,
    partial: 0,
    fail: 0,
    skipped: 0,
    obsDays: 0,
    min: session ? 5 : 20,
    minDays: session ? null : 3,
    enough: false,
    oneSided: false,
    stage: null,
    trend: null,
    spark: [],
    ...over,
  }
}

export function evaluation(date: string, kind: 'TALK' | 'WORDS', total: number, grade: string, rb: number[]): GrowthEvaluation {
  return {
    id: `ev_${date}_${kind}`,
    kind,
    level: 'N4',
    totalScore: total,
    grade,
    rubric: { accuracy: rb[0], vocabulary: rb[1], grammar: rb[2], naturalness: rb[3], assembly: rb[4] },
    date,
    completedAt: `${date}T11:20:00.000Z`,
  }
}

/** ① 적음 — 기록 13일째(10/8~), 공부한 날 9일, 출석만 10/19, 평가 0, 4주(늦게 시작). 단계가 보이는 축은 어휘 회상 하나. */
export function fewFixture(weeks: GrowthWeeks = 4): GrowthResponse {
  const pad = (a: (WeekVals | null)[]) => [...Array.from({ length: weeks - a.length }, () => null), ...a]
  return build({
    weeks,
    since: '2026-10-08',
    study: { '2026-10-08': 2, '2026-10-09': 1, '2026-10-10': 1, '2026-10-12': 2, '2026-10-13': 1, '2026-10-15': 3, '2026-10-16': 1, '2026-10-18': 2, '2026-10-20': 1 },
    attendOnly: ['2026-10-19'],
    vals: pad([
      { words: 3, lessons: 1, reviews: 0, talk: 10, chat: 4, corr: 2 },
      { words: 4, lessons: 2, reviews: 1, talk: 20, chat: 4, corr: 6 },
      { words: 2, lessons: 1, reviews: 0, talk: 0, chat: 0, corr: 0 },
    ]),
    skills: [
      skill('VOCAB_RECALL', { n: 90, success: 70, partial: 0, fail: 20, skipped: 6, obsDays: 7, enough: true, stage: 2 }),
      skill('GRAMMAR_PARTICLE', { n: 14, success: 7, partial: 2, fail: 5, obsDays: 4 }),
      skill('LISTEN_RESPOND'),
      skill('SENTENCE_PRODUCTION', { n: 11, success: 6, partial: 2, fail: 3, obsDays: 3 }),
      skill('CONVERSATION_MAINTAIN', { n: 1, success: 1, obsDays: 1 }),
    ],
  })
}

/**
 * ⑩ 한쪽 증거(L11) — 적음(①)과 같은 기록에 문형·조사만 바꿨다: 관측 119건·3일이 다 교정에서 와(틀림만 남음) 서버가 단계를 숨긴다(`enough && oneSided`, stage·trend null).
 * 단계가 보이는 축은 어휘 회상 하나 — 적음 안내는 그대로 «지금은 어휘 회상이…»(한쪽 증거 축을 세지 않는다, 36-6 E).
 */
export function oneSidedFixture(weeks: GrowthWeeks = 4): GrowthResponse {
  const base = fewFixture(weeks)
  return {
    ...base,
    skills: base.skills.map((s) =>
      s.axis === 'GRAMMAR_PARTICLE' ? skill('GRAMMAR_PARTICLE', { n: 119, success: 0, partial: 0, fail: 119, obsDays: 3, enough: true, oneSided: true }) : s,
    ),
  }
}

/** ② 보통 — 9/21 부터(기간 첫날보다 이름), 평가 2번(회화·단어), 단계 축 2개 + 날짜 부족 1개. */
export function normalFixture(): GrowthResponse {
  const study: Record<string, number> = {}
  for (let d = '2026-09-21'; d <= TODAY; d = addDays(d, 1)) if (Number(d.slice(8)) % 3 !== 0) study[d] = 1 + (Number(d.slice(8)) % 3)
  return build({
    weeks: 4,
    since: '2026-09-21',
    study,
    attendOnly: ['2026-10-09'],
    vals: [
      { words: 4, lessons: 2, reviews: 1, talk: 20, chat: 10, corr: 3 },
      { words: 5, lessons: 2, reviews: 1, talk: 30, chat: 12, corr: 4 },
      { words: 6, lessons: 3, reviews: 2, talk: 40, chat: 15, corr: 6 },
      { words: 2, lessons: 1, reviews: 0, talk: 8, chat: 4, corr: 1 },
    ],
    skills: [
      skill('VOCAB_RECALL', { n: 190, success: 160, partial: 4, fail: 26, skipped: 9, obsDays: 18, enough: true, stage: 3, trend: 'UP' }),
      skill('GRAMMAR_PARTICLE', { n: 48, success: 26, partial: 4, fail: 18, obsDays: 12, enough: true, stage: 1, trend: 'FLAT' }),
      skill('LISTEN_RESPOND'),
      skill('SENTENCE_PRODUCTION', { n: 22, success: 12, partial: 5, fail: 5, obsDays: 2 }),
      skill('CONVERSATION_MAINTAIN', { n: 4, success: 2, partial: 1, fail: 1, obsDays: 4 }),
    ],
    evaluations: [evaluation('2026-10-06', 'TALK', 62, 'FAIR', [3, 3, 2, 3, 4]), evaluation('2026-10-14', 'WORDS', 78, 'GOOD', [4, 4, 3, 3, 4])],
  })
}

/** ③ 풍부 — 12주 넘게(7/27~), 평가 6번, 추이선이 보이는 축. */
export function richFixture(weeks: GrowthWeeks = 12): GrowthResponse {
  const study: Record<string, number> = {}
  for (let d = '2026-07-27'; d <= TODAY; d = addDays(d, 1)) {
    const k = Number(d.slice(8)) % 4
    if (k !== 0) study[d] = k
  }
  const vals: WeekVals[] = Array.from({ length: weeks }, (_, j) => ({ words: 3 + (j % 4), lessons: 1 + (j % 3), reviews: j % 2, talk: 20 + j * 3, chat: 5 + j, corr: 2 + (j % 5) }))
  return build({
    weeks,
    since: '2026-07-27',
    study,
    attendOnly: [],
    vals,
    skills: [
      skill('VOCAB_RECALL', { n: 700, success: 600, partial: 10, fail: 90, skipped: 40, obsDays: 60, enough: true, stage: 3, trend: 'UP', spark: [0.78, 0.79, 0.8, 0.82, 0.83, 0.84, 0.86, 0.87, 0.88, 0.89, 0.9] }),
      skill('GRAMMAR_PARTICLE', { n: 200, success: 120, partial: 12, fail: 68, obsDays: 40, enough: true, stage: 1, trend: 'UP', spark: [0.5, 0.52, 0.55, 0.56, 0.58, 0.6, 0.63, 0.66] }),
      skill('LISTEN_RESPOND'),
      skill('SENTENCE_PRODUCTION', { n: 120, success: 80, partial: 10, fail: 30, obsDays: 30, enough: true, stage: 2, trend: 'DOWN', spark: [0.7, 0.68, 0.66, 0.65] }),
      skill('CONVERSATION_MAINTAIN', { n: 14, success: 9, partial: 3, fail: 2, obsDays: 14, enough: true, stage: 2, trend: null, spark: [] }),
    ],
    evaluations: [
      evaluation('2026-08-10', 'TALK', 58, 'NEEDS_WORK', [3, 3, 2, 2, 3]),
      evaluation('2026-08-24', 'WORDS', 70, 'FAIR', [4, 3, 3, 3, 4]),
      evaluation('2026-09-07', 'TALK', 66, 'FAIR', [3, 3, 3, 3, 4]),
      evaluation('2026-09-21', 'WORDS', 76, 'GOOD', [4, 4, 3, 3, 4]),
      evaluation('2026-10-05', 'TALK', 74, 'FAIR', [4, 4, 3, 3, 4]),
      evaluation('2026-10-17', 'TALK', 82, 'GOOD', [4, 4, 3, 4, 5]),
    ],
  })
}

/** ⑧ 완전 처음 — 기록 없음(`since=null`). */
export function emptyFixture(): GrowthResponse {
  return build({
    weeks: 4,
    since: null,
    study: {},
    skills: [skill('VOCAB_RECALL'), skill('GRAMMAR_PARTICLE'), skill('LISTEN_RESPOND'), skill('SENTENCE_PRODUCTION'), skill('CONVERSATION_MAINTAIN')],
  })
}

