/**
 * 챌린지 수행 지표 — **순수 함수**(설계서 `docs/design/challenge.md` §6-0·§6-4). DB 를 읽지 않고 `today`(KST 날짜)·`now`(시각)를 주입받는다.
 *
 * 원천은 기존 `StatsSnapshot(LESSON·VOCAB_SESSION)` 뿐이다(U7 = iii). 하루 결과를 저장하지 않고 읽을 때 계산하며, 끝난 챌린지는
 * 전이 트랜잭션에서 이 계산을 한 번 돌려 `Challenge.result` 에 얼린다(`freezeChallengeResult`).
 *
 * 마감 기준 시각 `closeAt` = `endedAt`(COMPLETED = endDate 다음 날 00:00 KST · ENDED = 그만둔 시각) ?? (오늘 > endDate 면 endDate 다음 날 00:00 · 아니면 now).
 * 그래서 전이가 늦거나 실패해도 화면 수치와 얼린 결과가 같다(지연 전이 결정성 — 확인 표 6·7·8b).
 * 하루 상태 판정 순서는 STOPPED → UPCOMING → MET → TODAY → PARTIAL → MISSED(그만둔 날 뒤가 "예정"으로 얼지 않게 — 확인 표 8a·10).
 */
import { dates } from '@/modules/infra'
import type {
  ChallengeDailyGoal, ChallengeDayState, ChallengeEndReason, ChallengeLength, ChallengeResult, ChallengeResultDay, ChallengeStatus, ChallengeTotals,
  ChallengeWordCount,
} from '@/types/challenge'

export const CHALLENGE_RULE_VERSION = 1
export const CHALLENGE_LENGTHS: readonly ChallengeLength[] = [7, 14, 30]
export const CHALLENGE_WORD_COUNTS: readonly ChallengeWordCount[] = [5, 10, 15]

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 인정 장수 = ceil(4n/5) — 실수 연산 없이(5·10·15 → 4·8·12). */
export function wordsMinAnsweredOf(wordCount: number): number {
  return Math.floor((4 * wordCount + 4) / 5)
}

/** 그 KST 날짜의 00:00 시각. */
export function kstDayStart(date: string): Date {
  return new Date(dates.toDbDate(date).getTime() - KST_OFFSET_MS)
}

/** #156 이 만들 때 얼리는 값 — `wordsMinAnswered`·`countSkipped`·`ruleVersion` 은 서버가 채운다. */
export function freezeDailyGoal(input: { lesson: boolean; words: boolean; wordCount: number | null }): ChallengeDailyGoal {
  return {
    lesson: input.lesson,
    words: input.words,
    wordCount: input.words ? input.wordCount : null,
    wordsMinAnswered: input.words && input.wordCount ? wordsMinAnsweredOf(input.wordCount) : null,
    countSkipped: false,
    ruleVersion: CHALLENGE_RULE_VERSION,
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const posInt = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

/** 저장된 `dailyGoal` 해석 — 형태가 어긋나면 null(호출자가 오류로 다룬다. 목표 둘 다 꺼짐도 오류: 모든 날이 달성이 된다). */
export function readDailyGoal(v: unknown): ChallengeDailyGoal | null {
  if (!isObj(v) || typeof v.lesson !== 'boolean' || typeof v.words !== 'boolean') return null
  if (!v.lesson && !v.words) return null
  const ruleVersion = posInt(v.ruleVersion)
  if (ruleVersion === null) return null
  let wordCount: number | null = null
  let wordsMinAnswered: number | null = null
  if (v.words) {
    wordCount = posInt(v.wordCount)
    wordsMinAnswered = posInt(v.wordsMinAnswered)
    if (wordCount === null || wordsMinAnswered === null) return null
  }
  return { lesson: v.lesson, words: v.words, wordCount, wordsMinAnswered, countSkipped: v.countSkipped === true, ruleVersion }
}

// ── 스냅샷 해석(방어 파싱 — `vocab/stats.ts` readSnapshot 선례: 형태가 어긋난 칸은 0, 날짜가 없으면 생성 시각의 KST 날짜) ──

export interface LessonSnap {
  id: string
  /** periodKey = lessonId */
  refId: string
  createdAt: Date
  kind: string
  topicId: string | null
  date: string
  quizCorrect: number
  quizTotal: number
}

export interface VocabSnap {
  id: string
  /** periodKey = sessionId */
  refId: string
  createdAt: Date
  topicId: string | null
  date: string
  correct: number
  wrong: number
  skipped: number
  cardCount: number
}

export interface ChallengeSnaps {
  lessons: LessonSnap[]
  vocab: VocabSnap[]
}

export interface SnapshotRow {
  id: string
  kind: string
  periodKey: string
  data: unknown
  createdAt: Date
}

const cnt = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
const idOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 40 ? v : null)

export function readChallengeSnaps(rows: readonly SnapshotRow[]): ChallengeSnaps {
  const out: ChallengeSnaps = { lessons: [], vocab: [] }
  for (const r of rows) {
    const d = isObj(r.data) ? r.data : {}
    const date = dates.isDateString(d.date) ? d.date : dates.todayKst(r.createdAt)
    if (r.kind === 'LESSON') {
      out.lessons.push({ id: r.id, refId: r.periodKey, createdAt: r.createdAt, kind: typeof d.kind === 'string' ? d.kind : '', topicId: idOrNull(d.topicId), date, quizCorrect: cnt(d.quizCorrect), quizTotal: cnt(d.quizTotal) })
    } else if (r.kind === 'VOCAB_SESSION') {
      out.vocab.push({ id: r.id, refId: r.periodKey, createdAt: r.createdAt, topicId: idOrNull(d.topicId), date, correct: cnt(d.correct), wrong: cnt(d.wrong), skipped: cnt(d.skipped), cardCount: cnt(d.cardCount) })
    }
  }
  return out
}

// ── 계산 ─────────────────────────────────────────────────────────────────────

export interface MetricChallenge {
  status: ChallengeStatus
  startDate: string
  endDate: string
  endedAt: Date | null
  topicId: string | null
  dailyGoal: ChallengeDailyGoal
}

export type SnapKind = 'LESSON' | 'VOCAB_SESSION'

export interface ComputedDayLesson {
  done: number
  quizCorrect: number
  quizTotal: number
  lessonId: string
}

export interface ComputedDayWords {
  sets: number
  correct: number
  wrong: number
  skipped: number
  cardCount: number
  answered: number
  need: number | null
  ok: boolean | null
  sessionId: string
}

export interface ComputedDay {
  date: string
  dayIndex: number
  state: ChallengeDayState
  met: boolean
  goalMetAt: Date | null
  /** 그날을 달성으로 바꾼 바로 그 스냅샷(`goalMetNow` 의 기준). */
  metBy: { kind: SnapKind; refId: string } | null
  lesson: ComputedDayLesson | null
  words: ComputedDayWords | null
}

export interface ChallengeMetrics {
  today: string
  closeAt: Date
  endDay: string | null
  lengthDays: number
  days: ComputedDay[]
  dayIndex: number
  elapsedDays: number
  metDays: number
  partialDays: number
  missedDays: number
  stoppedDays: number
  rate: number | null
  streak: number | null
  longestStreak: number
  todayMet: boolean
  totals: ChallengeTotals
}

export function closeAtOf(ch: Pick<MetricChallenge, 'endedAt' | 'endDate'>, today: string, now: Date): Date {
  if (ch.endedAt) return ch.endedAt
  return today > ch.endDate ? kstDayStart(dates.addDays(ch.endDate, 1)) : now
}

/** `범위(s)` — 주제가 끊긴 챌린지(topicId=null)는 아무것도 세지 않는다(null=null 비교로 붙여넣기 수업·내 단어장 세트를 얼리지 않게 — 확인 표 14). */
export function inChallengeRange(ch: Pick<MetricChallenge, 'topicId' | 'startDate' | 'endDate'>, closeAt: Date, s: { topicId: string | null; date: string; createdAt: Date }): boolean {
  if (ch.topicId === null || s.topicId !== ch.topicId) return false
  if (s.createdAt.getTime() < kstDayStart(ch.startDate).getTime() || s.createdAt.getTime() >= closeAt.getTime()) return false
  return s.date >= ch.startDate && s.date <= ch.endDate
}

const round2 = (x: number) => Math.round(x * 100) / 100

const byOrder = (a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }) =>
  a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function dayMet(goal: ChallengeDailyGoal, lessons: number, answered: number): boolean {
  return (goal.lesson ? lessons > 0 : true) && (goal.words ? answered >= (goal.wordsMinAnswered ?? Number.POSITIVE_INFINITY) : true)
}

/** 같은 값 중 나중 것(createdAt·id 순으로 뒤) — "동점이면 나중 것". */
function pickMax<T extends { createdAt: Date; id: string }>(items: readonly T[], score: (t: T) => number): T {
  let best = items[0]
  for (const it of items.slice(1)) {
    const d = score(it) - score(best)
    if (d > 0 || (d === 0 && byOrder(it, best) > 0)) best = it
  }
  return best
}

export function computeChallengeMetrics(ch: MetricChallenge, snaps: ChallengeSnaps, today: string, now: Date): ChallengeMetrics {
  const goal = ch.dailyGoal
  const closeAt = closeAtOf(ch, today, now)
  const endDay = ch.status === 'ENDED' ? dates.todayKst(ch.endedAt ?? now) : null
  const L = snaps.lessons.filter((s) => s.kind === 'NEW' && inChallengeRange(ch, closeAt, s))
  const V = snaps.vocab.filter((s) => inChallengeRange(ch, closeAt, s))
  const ans = (v: VocabSnap) => v.correct + v.wrong + (goal.countSkipped ? v.skipped : 0)
  const allDays = dates.eachDateInRange(ch.startDate, ch.endDate)
  const lengthDays = allDays.length

  const days: ComputedDay[] = allDays.map((date, i) => {
    const Ld = L.filter((s) => s.date === date)
    const Vd = V.filter((s) => s.date === date)
    const ordered = [
      ...Ld.map((s) => ({ kind: 'LESSON' as const, id: s.id, refId: s.refId, createdAt: s.createdAt, answered: 0 })),
      ...Vd.map((s) => ({ kind: 'VOCAB_SESSION' as const, id: s.id, refId: s.refId, createdAt: s.createdAt, answered: ans(s) })),
    ].sort(byOrder)
    let lessonN = 0
    let answered = 0
    let metBy: ComputedDay['metBy'] = null
    let goalMetAt: Date | null = null
    for (const it of ordered) {
      if (it.kind === 'LESSON') lessonN++
      else answered += it.answered
      if (!metBy && dayMet(goal, lessonN, answered)) {
        metBy = { kind: it.kind, refId: it.refId }
        goalMetAt = it.createdAt
      }
    }
    const met = metBy !== null
    const any = Ld.length > 0 || Vd.some((v) => ans(v) > 0)
    let state: ChallengeDayState
    if (ch.status === 'ENDED' && endDay !== null && (date > endDay || (date === endDay && !met))) state = 'STOPPED'
    else if (date > today) state = 'UPCOMING'
    else if (met) state = 'MET'
    else if (ch.status === 'ACTIVE' && date === today) state = 'TODAY'
    else if (any) state = 'PARTIAL'
    else state = 'MISSED'

    let lesson: ComputedDayLesson | null = null
    if (Ld.length) {
      const best = pickMax(Ld, (s) => s.quizCorrect)
      lesson = { done: Ld.length, quizCorrect: best.quizCorrect, quizTotal: best.quizTotal, lessonId: best.refId }
    }
    let words: ComputedDayWords | null = null
    if (Vd.length) {
      const best = pickMax(Vd, ans)
      const need = goal.words ? goal.wordsMinAnswered : null
      words = {
        sets: Vd.filter((v) => ans(v) > 0).length,
        correct: Vd.reduce((n, v) => n + v.correct, 0),
        wrong: Vd.reduce((n, v) => n + v.wrong, 0),
        skipped: Vd.reduce((n, v) => n + v.skipped, 0),
        cardCount: Vd.reduce((n, v) => n + v.cardCount, 0),
        answered,
        need,
        ok: need === null ? null : answered >= need,
        sessionId: best.refId,
      }
    }
    return { date, dayIndex: i + 1, state, met, goalMetAt, metBy, lesson, words }
  })

  const stateOf = new Map(days.map((d) => [d.date, d.state]))
  const countState = (s: ChallengeDayState) => days.filter((d) => d.state === s).length
  const metDays = countState('MET')
  const partialDays = countState('PARTIAL')
  const missedDays = countState('MISSED')
  const elapsedDays = metDays + partialDays + missedDays

  let streak: number | null = null
  if (ch.status === 'ACTIVE' && today <= ch.endDate) {
    streak = 0
    let cursor = stateOf.get(today) === 'MET' ? today : dates.addDays(today, -1)
    while (cursor >= ch.startDate && stateOf.get(cursor) === 'MET') {
      streak++
      cursor = dates.addDays(cursor, -1)
    }
  }
  let longestStreak = 0
  let run = 0
  for (const d of days) {
    run = d.state === 'MET' ? run + 1 : 0
    if (run > longestStreak) longestStreak = run
  }

  let dayIndex: number
  if (ch.status === 'COMPLETED') dayIndex = lengthDays
  else {
    const ref = ch.status === 'ENDED' && endDay !== null ? endDay : today
    dayIndex = ref < ch.startDate ? 0 : Math.min(lengthDays, dates.countDays(ch.startDate, ref))
  }

  return {
    today,
    closeAt,
    endDay,
    lengthDays,
    days,
    dayIndex,
    elapsedDays,
    metDays,
    partialDays,
    missedDays,
    stoppedDays: countState('STOPPED'),
    rate: elapsedDays ? round2(metDays / elapsedDays) : null,
    streak,
    longestStreak,
    todayMet: ch.status === 'ACTIVE' && stateOf.get(today) === 'MET',
    totals: {
      lessonsDone: L.length,
      wordSets: V.filter((v) => ans(v) > 0).length,
      wordsCorrect: V.reduce((n, v) => n + v.correct, 0),
    },
  }
}

/**
 * 끝낼 때 얼리는 기준 — COMPLETED 는 `today` = endDate 다음 날(마감 시각이 `endedAt`), ENDED 는 그만둔 날.
 * 같은 `closeAt` 으로 계산하므로 전이를 언제 실행해도 같은 값이다.
 */
export function freezeTodayOf(ch: Pick<MetricChallenge, 'status' | 'endDate' | 'endedAt'>): string {
  if (ch.status === 'COMPLETED') return dates.addDays(ch.endDate, 1)
  return dates.todayKst(ch.endedAt ?? new Date())
}

export function freezeChallengeResult(m: ChallengeMetrics, goal: ChallengeDailyGoal, endReason: ChallengeEndReason | null): ChallengeResult {
  return {
    ruleVersion: goal.ruleVersion,
    endReason,
    metDays: m.metDays,
    partialDays: m.partialDays,
    missedDays: m.missedDays,
    stoppedDays: m.stoppedDays,
    elapsedDays: m.elapsedDays,
    rate: m.rate,
    longestStreak: m.longestStreak,
    lessonsDone: m.totals.lessonsDone,
    wordSets: m.totals.wordSets,
    wordsCorrect: m.totals.wordsCorrect,
    days: m.days.map((d) => ({
      date: d.date,
      state: d.state,
      quiz: d.lesson ? [d.lesson.quizCorrect, d.lesson.quizTotal] : null,
      words: d.words ? [d.words.correct, d.words.wrong, d.words.skipped, d.words.cardCount, d.words.sets] : null,
    })),
  }
}

const DAY_STATES: readonly ChallengeDayState[] = ['UPCOMING', 'TODAY', 'MET', 'PARTIAL', 'MISSED', 'STOPPED']
const nonNeg = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)
const tuple = (v: unknown, n: number): number[] | null => (Array.isArray(v) && v.length === n && v.every((x) => nonNeg(x) !== null) ? (v as number[]) : null)

/** 저장된 `result` 해석 — 형태가 어긋나면 null(호출자가 스냅샷으로 다시 계산한다). */
export function readChallengeResult(v: unknown): ChallengeResult | null {
  if (!isObj(v) || !Array.isArray(v.days)) return null
  const n = (k: string) => nonNeg(v[k])
  const keys = ['metDays', 'partialDays', 'missedDays', 'stoppedDays', 'elapsedDays', 'longestStreak', 'lessonsDone', 'wordSets', 'wordsCorrect'] as const
  if (keys.some((k) => n(k) === null)) return null
  const ruleVersion = posInt(v.ruleVersion)
  if (ruleVersion === null) return null
  const rate = v.rate === null ? null : typeof v.rate === 'number' && v.rate >= 0 && v.rate <= 1 ? v.rate : undefined
  if (rate === undefined) return null
  const endReason = v.endReason === 'USER' || v.endReason === 'TOPIC_REMOVED' ? v.endReason : v.endReason == null ? null : undefined
  if (endReason === undefined) return null
  const days: ChallengeResultDay[] = []
  for (const d of v.days) {
    if (!isObj(d) || !dates.isDateString(d.date) || !DAY_STATES.includes(d.state as ChallengeDayState)) return null
    const quiz = d.quiz === null ? null : tuple(d.quiz, 2)
    const words = d.words === null ? null : tuple(d.words, 5)
    if ((d.quiz !== null && !quiz) || (d.words !== null && !words)) return null
    days.push({ date: d.date, state: d.state as ChallengeDayState, quiz: quiz as [number, number] | null, words: words as [number, number, number, number, number] | null })
  }
  return {
    ruleVersion,
    endReason,
    metDays: n('metDays')!,
    partialDays: n('partialDays')!,
    missedDays: n('missedDays')!,
    stoppedDays: n('stoppedDays')!,
    elapsedDays: n('elapsedDays')!,
    rate,
    longestStreak: n('longestStreak')!,
    lessonsDone: n('lessonsDone')!,
    wordSets: n('wordSets')!,
    wordsCorrect: n('wordsCorrect')!,
    days,
  }
}
