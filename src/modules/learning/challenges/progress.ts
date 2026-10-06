/**
 * 다른 라우트가 붙이는 챌린지 칸 — 전부 **읽기 전용**(지연 전이를 하지 않는다. 기간이 지난 ACTIVE 는 `closeAt` 으로 자연히 범위 밖).
 *  - `challengeProgressAfter` — #62 수업 완료·#51 세트 끝내기 응답의 `challenge?`. 라우트가 **커밋 뒤** 부른다. 실패는 로그만 남기고 null
 *    (수업 완료·세트 끝내기는 절대 되돌려지지 않는다 — 설계서 §5-4).
 *  - `challengeDayStates` — #70 달력 `days[].challenge`·`summary.challenge` · #71 하루 시트 `challenge`.
 *  - `getActiveChallengeTopic` — #58 추천의 `reason:'CHALLENGE'`.
 * 수업·세트 완료 코드는 이 파일을 import 하지 않고, 이 모듈도 `../lessons`·`../vocab`·`../studyLog` 를 import 하지 않는다(순환 없음, §10-1).
 */
import type { $Enums } from '@prisma/client'
import { dates } from '@/modules/infra'
import type { CalendarChallengeSummary, ChallengeDayState, ChallengeProgress, DayChallenge } from '@/types/challenge'
import { closeAtOf, computeChallengeMetrics, inChallengeRange, kstDayStart, readChallengeSnaps, readDailyGoal, type ChallengeSnaps } from './metrics'
import { CHALLENGE_ROW_SELECT, loadChallengeSnaps, toMetricChallenge, withDeps, type ChallengeDeps } from './store'
import { buildChallengeView, type ViewDay } from './view'

export type ChallengeSnapKind = 'LESSON' | 'VOCAB_SESSION'

/**
 * 방금 커밋한 스냅샷(`kind`·`refId` = periodKey)이 진행 중 챌린지의 과제로 세어졌는지와 그날 상태. 값이 나오는 조건:
 * ACTIVE 챌린지 · `범위(s)`(주제 일치·기간 안·마감 전) · LESSON 이면 새 수업(kind=NEW) · 그 과제가 `dailyGoal` 에서 켜져 있음. 그 밖은 null.
 */
export async function challengeProgressAfter(userId: string, target: { kind: ChallengeSnapKind; refId: string }, over?: Partial<ChallengeDeps>): Promise<ChallengeProgress | null> {
  try {
    const deps = withDeps(over)
    const row = await deps.db.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: CHALLENGE_ROW_SELECT })
    if (!row || row.topicId === null) return null
    const goal = readDailyGoal(row.dailyGoal)
    if (!goal) {
      console.error('[challenges] 진행 중 챌린지의 dailyGoal 형태가 올바르지 않습니다:', row.id)
      return null
    }
    if (target.kind === 'LESSON' ? !goal.lesson : !goal.words) return null
    const snapRow = await deps.db.statsSnapshot.findFirst({ where: { userId, kind: target.kind, periodKey: target.refId }, select: { id: true, kind: true, periodKey: true, data: true, createdAt: true } })
    if (!snapRow) return null
    const parsed = readChallengeSnaps([snapRow])
    const snap = target.kind === 'LESSON' ? parsed.lessons[0] : parsed.vocab[0]
    if (!snap) return null
    if (target.kind === 'LESSON' && parsed.lessons[0].kind !== 'NEW') return null
    // 스냅샷 createdAt 은 Prisma 엔진이 INSERT 에 싣는 앱 호스트 시각이라 deps.now() 와 같은 시계다(DB 시계 아님 — REV-124 실측).
    // 같은 ms 이거나 앱 시계가 되돌려졌을 때 방금 쓴 스냅샷이 "아직 안 만들어진 것"으로 빠지지 않게 보정한다(진행 중 closeAt = now, 비교는 createdAt < closeAt).
    const real = deps.now()
    const now = real.getTime() > snapRow.createdAt.getTime() ? real : new Date(snapRow.createdAt.getTime() + 1)
    const today = dates.todayKst(now)
    const ch = toMetricChallenge(row)
    const closeAt = closeAtOf(ch, today, now)
    if (!inChallengeRange(ch, closeAt, snap)) return null
    const snaps = await loadChallengeSnaps(deps.db, userId, kstDayStart(ch.startDate), closeAt)
    const m = computeChallengeMetrics(ch, snaps, today, now)
    const day = m.days.find((d) => d.date === snap.date)
    if (!day) return null
    return {
      challengeId: row.id,
      date: day.date,
      dayIndex: day.dayIndex,
      goalMet: day.met,
      goalMetNow: !!day.metBy && day.metBy.kind === target.kind && day.metBy.refId === target.refId,
      words: target.kind === 'VOCAB_SESSION' ? { answered: day.words?.answered ?? 0, need: goal.wordsMinAnswered ?? 0 } : null,
    }
  } catch (e) {
    console.error('[challenges] 완료 응답의 챌린지 칸 계산 실패:', e instanceof Error ? e.name : 'unknown')
    return null
  }
}

export interface ChallengeCalendarDay extends DayChallenge {
  /** 같은 날 두 챌린지가 겹칠 때 고르는 순서 — 그만둔 날(STOPPED)보다 진행·기록된 날, 그다음 나중에 만든 챌린지. */
  createdAt: Date
}

export interface ChallengeDayStatesResult {
  days: Map<string, ChallengeCalendarDay>
  /** 진행 중(기간 안 또는 시작 전) 챌린지 요약 — 없으면 null. */
  active: CalendarChallengeSummary | null
}

const CALENDAR_CHALLENGE_MAX = 20

function dayChallengeOf(row: { id: string; title: string }, d: ViewDay, createdAt: Date): ChallengeCalendarDay {
  return {
    challengeId: row.id,
    title: row.title,
    dayIndex: d.dayIndex,
    state: d.state,
    lesson: d.lesson ? { quizCorrect: d.lesson.quizCorrect, quizTotal: d.lesson.quizTotal } : null,
    words: d.words ? { correct: d.words.correct, wrong: d.words.wrong, skipped: d.words.skipped, cardCount: d.words.cardCount, ok: d.words.ok, need: d.words.need } : null,
    createdAt,
  }
}

const rank = (s: ChallengeDayState) => (s === 'STOPPED' ? 0 : 1)

/** [from, to] 에 걸친 챌린지 날 — 끝난 챌린지는 얼린 결과, 진행 중은 지금 계산(스냅샷은 한 번에 읽는다). */
export async function challengeDayStates(userId: string, range: { from: string; to: string }, over?: Partial<ChallengeDeps>): Promise<ChallengeDayStatesResult> {
  const deps = withDeps(over)
  const now = deps.now()
  const today = dates.todayKst(now)
  const rows = await deps.db.challenge.findMany({
    where: { userId, startDate: { lte: dates.toDbDate(range.to) }, endDate: { gte: dates.toDbDate(range.from) } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: CALENDAR_CHALLENGE_MAX,
    select: CHALLENGE_ROW_SELECT,
  })
  const activeRow = rows.find((r) => r.status === 'ACTIVE') ?? (await deps.db.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: CHALLENGE_ROW_SELECT }))
  const toCompute = [...rows.filter((r) => r.status === 'ACTIVE'), ...(activeRow && !rows.includes(activeRow) ? [activeRow] : [])]
  let snaps: ChallengeSnaps | undefined
  if (toCompute.length) {
    const metrics = toCompute.map(toMetricChallenge)
    const from = new Date(Math.min(...metrics.map((c) => kstDayStart(c.startDate).getTime())))
    const to = new Date(Math.max(...metrics.map((c) => closeAtOf(c, today, now).getTime())))
    snaps = await loadChallengeSnaps(deps.db, userId, from, to)
  }
  const days = new Map<string, ChallengeCalendarDay>()
  let active: CalendarChallengeSummary | null = null
  for (const row of [...rows, ...(activeRow && !rows.includes(activeRow) ? [activeRow] : [])]) {
    const v = await buildChallengeView(deps.db, row, now, { snaps: row.status === 'ACTIVE' ? snaps : undefined })
    if (row === activeRow && today <= v.metric.endDate) active = { id: row.id, metDays: v.stats.metDays, elapsedDays: v.stats.elapsedDays, streak: v.stats.streak }
    if (!rows.includes(row)) continue
    for (const d of v.days) {
      if (d.date < range.from || d.date > range.to) continue
      const cand = dayChallengeOf(row, d, row.createdAt)
      const cur = days.get(d.date)
      if (!cur || rank(cand.state) > rank(cur.state) || (rank(cand.state) === rank(cur.state) && cand.createdAt.getTime() > cur.createdAt.getTime())) days.set(d.date, cand)
    }
  }
  return { days, active }
}

export interface ActiveChallengeTopic {
  challengeId: string
  topicId: string
  topicTitle: string
  level: $Enums.JlptLevel
  /** 오늘(KST) 이 주제의 새 수업을 이미 끝냈는가(LESSON 스냅샷 기준 — 지표와 같은 판정). */
  lessonDoneToday: boolean
}

/**
 * #58 — 진행 중이고 기간 안이며 수업 과제가 켜진 챌린지의 주제. 주제를 볼 수 없으면(지워짐·남의 주제) null.
 * LLM·잡을 만들지 않는다(읽기 3회 이하).
 */
export async function getActiveChallengeTopic(userId: string, over?: Partial<ChallengeDeps>): Promise<ActiveChallengeTopic | null> {
  const deps = withDeps(over)
  const now = deps.now()
  const today = dates.todayKst(now)
  const row = await deps.db.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: CHALLENGE_ROW_SELECT })
  if (!row || row.topicId === null) return null
  const goal = readDailyGoal(row.dailyGoal)
  if (!goal || !goal.lesson) return null
  const ch = toMetricChallenge(row)
  if (today < ch.startDate || today > ch.endDate) return null
  const topic = await deps.db.conversationTopic.findFirst({ where: { id: row.topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true, level: true } })
  if (!topic) return null
  const from = kstDayStart(today)
  const snaps = from.getTime() < now.getTime() ? await loadChallengeSnaps(deps.db, userId, from, now) : { lessons: [], vocab: [] }
  const closeAt = closeAtOf(ch, today, now)
  const lessonDoneToday = snaps.lessons.some((s) => s.kind === 'NEW' && s.date === today && inChallengeRange(ch, closeAt, s))
  return { challengeId: row.id, topicId: topic.id, topicTitle: topic.title, level: topic.level, lessonDoneToday }
}
