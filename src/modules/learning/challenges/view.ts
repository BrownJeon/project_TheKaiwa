/**
 * 챌린지 한 건의 "보이는 값" — 진행 중이면 스냅샷으로 지금 계산하고, 끝난 챌린지는 얼린 `result` 를 그대로 쓴다(설계서 §9-1 #157).
 * 끝난 챌린지에서 원본 링크(그 점수를 낸 수업·그날 가장 많이 푼 세트)·달성 시각은 `result` 에 없으므로, 링크가 필요한 조회(#157)만
 * 같은 마감 시각으로 다시 계산해 **링크만** 가져온다 — 상태·수치는 `result` 가 이긴다(규칙이 바뀌어도 끝난 기록은 그대로).
 */
import { dates } from '@/modules/infra'
import type { ChallengeDayState, ChallengeResult, ChallengeStats, ChallengeSummary, ChallengeTotals } from '@/types/challenge'
import {
  computeChallengeMetrics, freezeTodayOf, kstDayStart, readChallengeResult, closeAtOf,
  type ChallengeMetrics, type ChallengeSnaps, type ComputedDay, type MetricChallenge,
} from './metrics'
import { loadChallengeSnaps, toMetricChallenge, type ChallengeDb, type ChallengeRow } from './store'

export interface ViewDay {
  date: string
  dayIndex: number
  state: ChallengeDayState
  met: boolean
  goalMetAt: Date | null
  lesson: { done: number; quizCorrect: number; quizTotal: number; lessonId: string | null } | null
  words: { sets: number; correct: number; wrong: number; skipped: number; cardCount: number; answered: number; need: number | null; ok: boolean | null; sessionId: string | null } | null
}

export interface ChallengeView {
  row: ChallengeRow
  metric: MetricChallenge
  /** 서버 KST 오늘(조회 시각 기준). */
  today: string
  days: ViewDay[]
  stats: ChallengeStats
  totals: ChallengeTotals
  /** 지금 계산한 값(진행 중이거나 링크가 필요해 다시 계산했을 때). */
  computed: ChallengeMetrics | null
  result: ChallengeResult | null
}

function fromComputed(d: ComputedDay): ViewDay {
  return { date: d.date, dayIndex: d.dayIndex, state: d.state, met: d.met, goalMetAt: d.goalMetAt, lesson: d.lesson, words: d.words }
}

function finishedDayIndex(ch: MetricChallenge, lengthDays: number): number {
  if (ch.status === 'COMPLETED') return lengthDays
  const endDay = dates.todayKst(ch.endedAt ?? new Date())
  return endDay < ch.startDate ? 0 : Math.min(lengthDays, dates.countDays(ch.startDate, endDay))
}

/** 얼린 `result` → 보이는 날. `rec` 가 있으면 같은 날의 링크·달성 시각만 가져온다. */
function fromResult(ch: MetricChallenge, result: ChallengeResult, rec: Map<string, ComputedDay> | null): ViewDay[] {
  const goal = ch.dailyGoal
  return result.days.map((r, i) => {
    const c = rec?.get(r.date) ?? null
    let words: ViewDay['words'] = null
    if (r.words) {
      const [correct, wrong, skipped, cardCount, sets] = r.words
      const answered = correct + wrong + (goal.countSkipped ? skipped : 0)
      const need = goal.words ? goal.wordsMinAnswered : null
      words = { sets, correct, wrong, skipped, cardCount, answered, need, ok: need === null ? null : answered >= need, sessionId: c?.words?.sessionId ?? null }
    }
    return {
      date: r.date,
      dayIndex: i + 1,
      state: r.state,
      met: r.state === 'MET',
      goalMetAt: r.state === 'MET' ? (c?.goalMetAt ?? null) : null,
      lesson: r.quiz ? { done: c?.lesson?.done ?? 1, quizCorrect: r.quiz[0], quizTotal: r.quiz[1], lessonId: c?.lesson?.lessonId ?? null } : null,
      words,
    }
  })
}

export interface BuildViewOptions {
  /** 끝난 챌린지에서도 원본 링크를 채우려고 다시 계산할지(#157). */
  links?: boolean
  /** 이미 읽은 스냅샷(달력이 여러 챌린지를 한 번에 읽을 때) — 없으면 이 챌린지 범위만 읽는다. */
  snaps?: ChallengeSnaps
}

export async function buildChallengeView(db: ChallengeDb, row: ChallengeRow, now: Date, opts: BuildViewOptions = {}): Promise<ChallengeView> {
  const today = dates.todayKst(now)
  const ch = toMetricChallenge(row)
  const finished = ch.status !== 'ACTIVE'
  const result = finished ? readChallengeResult(row.result) : null
  if (result && !opts.links) {
    const days = fromResult(ch, result, null)
    return { row, metric: ch, today, days, stats: finishedStats(ch, result, days.length), totals: totalsOf(result), computed: null, result }
  }
  const at = finished ? freezeTodayOf(ch) : today
  const closeAt = closeAtOf(ch, at, now)
  const snaps = opts.snaps ?? (await loadChallengeSnaps(db, row.userId, kstDayStart(ch.startDate), closeAt))
  const m = computeChallengeMetrics(ch, snaps, at, now)
  if (result) {
    const days = fromResult(ch, result, new Map(m.days.map((d) => [d.date, d])))
    return { row, metric: ch, today, days, stats: finishedStats(ch, result, days.length), totals: totalsOf(result), computed: m, result }
  }
  if (finished) console.warn('[challenges] 끝난 챌린지의 result 를 읽지 못해 다시 계산했습니다:', row.id)
  return {
    row,
    metric: ch,
    today,
    days: m.days.map(fromComputed),
    stats: { dayIndex: m.dayIndex, elapsedDays: m.elapsedDays, metDays: m.metDays, rate: m.rate, streak: m.streak, longestStreak: m.longestStreak, todayMet: m.todayMet },
    totals: m.totals,
    computed: m,
    result: null,
  }
}

function finishedStats(ch: MetricChallenge, r: ChallengeResult, lengthDays: number): ChallengeStats {
  return { dayIndex: finishedDayIndex(ch, lengthDays), elapsedDays: r.elapsedDays, metDays: r.metDays, rate: r.rate, streak: null, longestStreak: r.longestStreak, todayMet: false }
}

function totalsOf(r: ChallengeResult): ChallengeTotals {
  return { lessonsDone: r.lessonsDone, wordSets: r.wordSets, wordsCorrect: r.wordsCorrect }
}

export function toChallengeSummary(v: ChallengeView): ChallengeSummary {
  const r = v.row
  return {
    id: r.id,
    title: r.title,
    topic: { id: r.topicId, title: r.topicTitleSnap, exists: r.topicId !== null },
    level: r.level,
    lengthDays: r.lengthDays,
    startDate: v.metric.startDate,
    endDate: v.metric.endDate,
    status: r.status,
    dailyGoal: v.metric.dailyGoal,
    stats: v.stats,
    endedAt: r.endedAt ? r.endedAt.toISOString() : null,
  }
}
