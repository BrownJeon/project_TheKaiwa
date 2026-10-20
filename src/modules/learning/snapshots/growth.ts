/**
 * #78 성장 탭(`GET /api/v1/plan/growth?weeks=4|8|12`, task-080 — docs/screens.md §36-6·36-7) — 읽기 전용, 쓰기 없음.
 *
 * 원천: DAILY·EVALUATION `StatsSnapshot`(삭제 후 불변, 규칙 2) + **`Attendance`**(출석·연속·`since` — 삭제 경로가 계정 cascade 뿐이라 같은 불변성,
 * Leader 결정 L1: DAILY `attended` 는 어떤 쓰기 지점도 true 로 넘기지 않아 늘 false 다). 원본 기록·대화·세션 삭제와 무관하게 값이 같다.
 *
 * 판정 규칙은 전부 아래 순수 함수(`buildGrowth` 와 그 부품)에 있고 정수 비교만 쓴다(부동소수 경계 오차 금지). DB 함수는 읽어서 넘길 뿐이다.
 */
import { ApiError, dates, prisma } from '@/modules/infra'
import {
  GROWTH_AXES,
  GROWTH_WEEKS,
  type GrowthAxis,
  type GrowthDay,
  type GrowthEvaluation,
  type GrowthRange,
  type GrowthResponse,
  type GrowthSkill,
  type GrowthWeek,
  type GrowthWeeks,
} from '@/types/plan'
import { computeStreak } from '../attendance'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** 기록 코드가 있는 축. `false` 축은 데이터가 있어도 0·«기록 전»으로 보낸다(듣고 응답 관측 기록 코드가 생기면 true 로). */
export const GROWTH_AXIS_RECORDED: Readonly<Record<GrowthAxis, boolean>> = {
  VOCAB_RECALL: true,
  GRAMMAR_PARTICLE: true,
  LISTEN_RESPOND: false,
  SENTENCE_PRODUCTION: true,
  CONVERSATION_MAINTAIN: true,
}

/** Q3 A 표본 기준. 추세는 앞·뒤 반 기간 각각 `trendMin` 이상. 추이선 점은 그 주 n ≥ `sparkMin`. */
export const GROWTH_THRESHOLDS = {
  OBSERVATION: { min: 20, minDays: 3, trendMin: 20 },
  SESSION: { min: 5, minDays: null, trendMin: 3 },
  sparkMin: 5,
} as const

export const GROWTH_WEEKS_DEFAULT: GrowthWeeks = 4

/** `?weeks=` — 생략·빈 값 = 4, `4|8|12` 밖은 400. */
export function parseGrowthWeeks(raw: string | null | undefined): GrowthWeeks {
  if (raw == null || raw === '') return GROWTH_WEEKS_DEFAULT
  const hit = GROWTH_WEEKS.find((w) => String(w) === raw)
  if (hit === undefined) throw new ApiError('VALIDATION', 'weeks 는 4, 8, 12 중 하나여야 합니다.', { field: 'weeks', reason: '4|8|12' })
  return hit
}

/** `from` = 오늘이 속한 주 첫날에서 (weeks − 1)주 앞, `to` = 오늘. */
export function growthRange(today: string, weeks: GrowthWeeks): GrowthRange {
  const from = dates.addDays(dates.weekStartOf(today), -7 * (weeks - 1))
  return { weeks, from, to: today, today, weekStartsOn: dates.WEEK_START_DOW as 0 }
}

/** DAILY `data` 에서 0 보다 큰 공부 종류 수(단어·수업·복습·대화·평가·교정 채택) — `kinds > 0` ⇔ `repetition/review.ts isStudyDay`. */
export function dailyKinds(data: unknown): number {
  const d = obj(data)
  const parts = [num(obj(d.words).sessions), num(d.lessons), num(d.reviews), num(d.talkTurns) + num(d.chatTurns), num(d.evals), num(obj(d.corrections).accepted)]
  return parts.filter((v) => v > 0).length
}

/** 오름차순 날짜 목록의 가장 긴 연속 일수. */
export function longestRunOfDates(sortedAsc: readonly string[]): number {
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sortedAsc) {
    if (d === prev) continue
    run = prev !== null && dates.addDays(prev, 1) === d ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }
  return best
}

export interface SkillCounts {
  success: number
  partial: number
  fail: number
  skipped: number
}

const zeroCounts = (): SkillCounts => ({ success: 0, partial: 0, fail: 0, skipped: 0 })

/** DAILY `data.skills[axis]` → 칸 값(칸이 없는 옛 행·백필 전 = 0). `uncertain` 은 읽지 않는다. */
export function dailySkillCounts(data: unknown, axis: GrowthAxis): SkillCounts {
  const a = obj(obj(obj(data).skills)[axis])
  return { success: num(a.success), partial: num(a.partial), fail: num(a.fail), skipped: num(a.skipped) }
}

/** 판정된 관측 수(넘김·불확실 제외). */
export const judgedCount = (c: SkillCounts): number => c.success + c.partial + c.fail

/** DAILY `data.skills[axis].fromCorrection`(판정된 관측 중 교정에서 온 수) — 칸이 없는 옛 행은 0. */
export function dailyFromCorrection(data: unknown, axis: GrowthAxis): number {
  return num(obj(obj(obj(data).skills)[axis]).fromCorrection)
}

/**
 * 한쪽 증거 편향(C 규칙, screens.md §36-17-2 L11) — **표본이 충분한(enough) 축에서만**, 판정된 관측 n 중 90% 이상이 교정에서 왔다.
 * 정수 비교(정확히 90% = true). 교정 제안은 틀린 문장만 남기므로 이런 축의 단계는 실력이 아니라 기록 방식을 보여 준다.
 * `!enough` 면 늘 false — 화면은 «표본 부족» 을 먼저 보이고 표본이 차야 «한쪽 증거» 로 바꾼다(Leader 2026-10-21).
 */
export function isOneSided(enough: boolean, n: number, fromCorrection: number): boolean {
  return enough && 10 * fromCorrection >= 9 * n
}

/** 단계(정수 비교) — 맞힌 비율 = (맞힘 + 일부×0.5) ÷ n. 정확히 50%·70%·85% 는 위 칸. n = 0 이면 null. */
export function skillStage(c: SkillCounts): 0 | 1 | 2 | 3 | null {
  const n = judgedCount(c)
  if (n <= 0) return null
  const numer = 2 * c.success + c.partial
  const den = 2 * n
  if (100 * numer < 50 * den) return 0
  if (100 * numer < 70 * den) return 1
  if (100 * numer < 85 * den) return 2
  return 3
}

/** 추세 — 오래된 순 주별 칸(before=false 주만). L < 2 또는 어느 반이든 n < trendMin 이면 null. ±5%p 정확히는 UP/DOWN. */
export function skillTrend(weekCounts: readonly SkillCounts[], trendMin: number): 'UP' | 'DOWN' | 'FLAT' | null {
  const L = weekCounts.length
  if (L < 2) return null
  const half = Math.floor(L / 2)
  const sum = (xs: readonly SkillCounts[]) => xs.reduce<SkillCounts>((a, x) => ({ success: a.success + x.success, partial: a.partial + x.partial, fail: a.fail + x.fail, skipped: a.skipped + x.skipped }), zeroCounts())
  const A = sum(weekCounts.slice(0, half))
  const B = sum(weekCounts.slice(half))
  const nA = judgedCount(A)
  const nB = judgedCount(B)
  if (nA < trendMin || nB < trendMin) return null
  const numA = 2 * A.success + A.partial
  const denA = 2 * nA
  const numB = 2 * B.success + B.partial
  const denB = 2 * nB
  const delta = numB * denA - numA * denB
  if (100 * delta >= 5 * denA * denB) return 'UP'
  if (100 * delta <= -5 * denA * denB) return 'DOWN'
  return 'FLAT'
}

/** 추이선 점 — 주마다(오래된 순) 그 주 n ≥ sparkMin 이면 맞힌 비율(소수 셋째 자리), 모자란 주는 건너뛴다. */
export function skillSpark(weekCounts: readonly SkillCounts[], sparkMin: number = GROWTH_THRESHOLDS.sparkMin): number[] {
  const out: number[] = []
  for (const c of weekCounts) {
    const n = judgedCount(c)
    if (n < sparkMin) continue
    out.push(Math.round(((2 * c.success + c.partial) / (2 * n)) * 1000) / 1000)
  }
  return out
}

export interface DailyRowInput {
  periodKey: string
  data: unknown
}

export interface EvaluationRowInput {
  /** = evaluationId. */
  periodKey: string
  data: unknown
  createdAt: Date
}

export interface GrowthInputs {
  today: string
  weeks: GrowthWeeks
  /** 이 사용자의 출석 날짜 전부(오늘 이하, 오름차순). */
  attendanceDates: readonly string[]
  /** 기간 안 DAILY 행. */
  dailyRows: readonly DailyRowInput[]
  /** 전체 기간 DAILY 가장 이른 periodKey(없으면 null). */
  earliestDaily: string | null
  /** 이 사용자의 EVALUATION 스냅샷 전부. */
  evaluationRows: readonly EvaluationRowInput[]
}

const RUBRIC_KEYS = ['accuracy', 'vocabulary', 'grammar', 'naturalness', 'assembly'] as const

/** EVALUATION 스냅샷 `data` → 응답 행(형식이 틀리면 null — 부르는 쪽이 빼고 수만 로그). */
export function evaluationFromSnapshot(row: EvaluationRowInput): GrowthEvaluation | null {
  const d = obj(row.data)
  if (d.kind !== 'WORDS' && d.kind !== 'TALK') return null
  if (!dates.isDateString(d.date)) return null
  if (typeof d.total !== 'number' || !Number.isFinite(d.total)) return null
  const r = d.rubric
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null
  const rubric = {} as GrowthEvaluation['rubric']
  for (const k of RUBRIC_KEYS) {
    const v = (r as Record<string, unknown>)[k]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 5) return null
    rubric[k] = v
  }
  return {
    id: row.periodKey,
    kind: d.kind,
    level: typeof d.level === 'string' ? d.level : '',
    totalScore: d.total,
    grade: typeof d.grade === 'string' ? d.grade : '',
    rubric,
    date: d.date,
    completedAt: row.createdAt.toISOString(),
  }
}

/** 순수 — #78 응답 전체(§36-6 A·B·C). `rejectedEvaluations` = 형식이 틀려 뺀 평가 스냅샷 수(로그용). */
export function buildGrowth(input: GrowthInputs): { response: GrowthResponse; rejectedEvaluations: number } {
  const range = growthRange(input.today, input.weeks)
  const { from, to, today } = range
  const firstAttendance = input.attendanceDates[0] ?? null
  const since = [firstAttendance, input.earliestDaily].filter((v): v is string => v !== null).sort()[0] ?? null

  const attended = new Set(input.attendanceDates)
  const dailyByDate = new Map<string, unknown>()
  for (const r of input.dailyRows) if (r.periodKey >= from && r.periodKey <= to) dailyByDate.set(r.periodKey, r.data)

  const days: GrowthDay[] = dates.eachDateInRange(from, to).map((date) => ({ date, attended: attended.has(date), kinds: dailyKinds(dailyByDate.get(date)) }))
  const studied = (d: GrowthDay) => d.kinds > 0
  const thisWeekStart = dates.weekStartOf(today)

  const weeks: GrowthWeek[] = []
  const weekSkill: Record<GrowthAxis, SkillCounts>[] = []
  for (let i = 0; i < input.weeks; i++) {
    const weekStart = dates.addDays(from, 7 * i)
    const weekEnd = dates.addDays(weekStart, 6)
    const inWeek = days.filter((d) => d.date >= weekStart && d.date <= weekEnd)
    const w: GrowthWeek = {
      weekStart,
      before: since === null || weekEnd < since,
      attendedDays: inWeek.filter((d) => d.attended).length,
      studyDays: inWeek.filter(studied).length,
      words: { sessions: 0, correct: 0, wrong: 0 },
      lessons: 0,
      reviews: 0,
      talkTurns: 0,
      chatTurns: 0,
      correctionsAccepted: 0,
    }
    const sk = Object.fromEntries(GROWTH_AXES.map((a) => [a, zeroCounts()])) as Record<GrowthAxis, SkillCounts>
    for (const d of inWeek) {
      const data = obj(dailyByDate.get(d.date))
      const words = obj(data.words)
      w.words.sessions += num(words.sessions)
      w.words.correct += num(words.correct)
      w.words.wrong += num(words.wrong)
      w.lessons += num(data.lessons)
      w.reviews += num(data.reviews)
      w.talkTurns += num(data.talkTurns)
      w.chatTurns += num(data.chatTurns)
      w.correctionsAccepted += num(obj(data.corrections).accepted)
      for (const a of GROWTH_AXES) {
        const c = dailySkillCounts(data, a)
        const t = sk[a]
        t.success += c.success
        t.partial += c.partial
        t.fail += c.fail
        t.skipped += c.skipped
      }
    }
    weeks.push(w)
    weekSkill.push(sk)
  }

  const skills: GrowthSkill[] = GROWTH_AXES.map((axis) => {
    const unit = axis === 'CONVERSATION_MAINTAIN' ? 'SESSION' : 'OBSERVATION'
    const th = GROWTH_THRESHOLDS[unit]
    const base = { axis, unit, min: th.min, minDays: th.minDays } as const
    if (!GROWTH_AXIS_RECORDED[axis]) {
      return { ...base, recorded: false, n: 0, success: 0, partial: 0, fail: 0, skipped: 0, obsDays: 0, enough: false, oneSided: false, stage: null, trend: null, spark: [] }
    }
    const total = zeroCounts()
    let fromCorrection = 0
    let obsDays = 0
    for (const d of days) {
      const data = dailyByDate.get(d.date)
      const c = dailySkillCounts(data, axis)
      total.success += c.success
      total.partial += c.partial
      total.fail += c.fail
      total.skipped += c.skipped
      fromCorrection += dailyFromCorrection(data, axis)
      if (judgedCount(c) > 0) obsDays++
    }
    const n = judgedCount(total)
    const enough = n >= th.min && (th.minDays === null || obsDays >= th.minDays)
    const oneSided = isOneSided(enough, n, fromCorrection)
    const shown = enough && !oneSided
    const perWeek = weekSkill.map((w) => w[axis])
    const recordedWeeks = perWeek.filter((_, i) => !weeks[i].before)
    return {
      ...base,
      recorded: true,
      n,
      ...total,
      obsDays,
      enough,
      oneSided,
      stage: shown ? skillStage(total) : null,
      trend: shown ? skillTrend(recordedWeeks, th.trendMin) : null,
      spark: oneSided ? [] : skillSpark(perWeek),
    }
  })

  const parsed = input.evaluationRows.map(evaluationFromSnapshot)
  const rejectedEvaluations = parsed.filter((e) => e === null).length
  const evaluations = input.evaluationRows
    .map((row, i) => ({ row, e: parsed[i] }))
    .filter((x): x is { row: EvaluationRowInput; e: GrowthEvaluation } => x.e !== null && x.e.date >= from && x.e.date <= to)
    .sort((a, b) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : a.row.createdAt.getTime() - b.row.createdAt.getTime()))
    .map((x) => x.e)

  const desc = [...input.attendanceDates].filter((d) => d <= today).reverse()
  const response: GrowthResponse = {
    range,
    since,
    summary: {
      streak: computeStreak(desc, today),
      longestStreak: longestRunOfDates(input.attendanceDates),
      studyDays: days.filter(studied).length,
      thisWeekStudyDays: days.filter((d) => d.date >= thisWeekStart && studied(d)).length,
    },
    days,
    weeks,
    skills,
    evaluations,
    hasEvaluations: input.evaluationRows.length > 0,
  }
  return { response, rejectedEvaluations }
}

export interface GrowthDb {
  attendance: Pick<typeof prisma.attendance, 'findMany'>
  statsSnapshot: Pick<typeof prisma.statsSnapshot, 'findMany' | 'findFirst'>
}

/** #78 — 세션 사용자 한 명의 성장 탭 응답. 쓰기 없음. */
export async function getGrowth(userId: string, weeks: GrowthWeeks, now: Date = new Date(), db: GrowthDb = prisma): Promise<GrowthResponse> {
  if (!userId) throw new ApiError('UNAUTHENTICATED', '로그인이 필요합니다.')
  const today = dates.todayKst(now)
  const { from, to } = growthRange(today, weeks)
  const [att, daily, earliest, evals] = await Promise.all([
    db.attendance.findMany({ where: { userId, date: { lte: dates.toDbDate(today) } }, orderBy: { date: 'asc' }, select: { date: true } }),
    db.statsSnapshot.findMany({ where: { userId, kind: 'DAILY', periodKey: { gte: from, lte: to } }, select: { periodKey: true, data: true } }),
    db.statsSnapshot.findFirst({ where: { userId, kind: 'DAILY' }, orderBy: { periodKey: 'asc' }, select: { periodKey: true } }),
    db.statsSnapshot.findMany({ where: { userId, kind: 'EVALUATION' }, orderBy: { createdAt: 'asc' }, select: { periodKey: true, data: true, createdAt: true } }),
  ])
  const { response, rejectedEvaluations } = buildGrowth({
    today,
    weeks,
    attendanceDates: att.map((r) => dates.fromDbDate(r.date)),
    dailyRows: daily,
    earliestDaily: earliest?.periodKey && dates.isDateString(earliest.periodKey) ? earliest.periodKey : null,
    evaluationRows: evals,
  })
  if (rejectedEvaluations > 0) console.warn(`[growth] 형식이 틀린 평가 스냅샷 ${rejectedEvaluations}건을 뺐습니다`)
  return response
}
