/**
 * #155~#159 — 챌린지 목록·만들기·상세·오늘·그만두기(설계서 §5-3·§9-1). 소유자만(`where {id, userId}` — 없거나 남의 것 404).
 * LLM·엔진을 부르지 않는다(5초 지표 ⓐ — 이 경로는 DB 만). 쓰기는 `Challenge` 만 — 수업·세트·스냅샷·잡 행을 새로 만들지 않고,
 * 수업·세트·스냅샷 행은 고치지 않는다. 예외 하나: 오늘 할 일(#157 `today`·#158)이 GENERATING 수업의 생성 잡을 볼 때 쓰는
 * `jobs.findActiveJob` 은 오래된 QUEUED·RUNNING 잡 행을 `FAILED('stale')` 로 닫는 infra 기존 동작을 탄다(설계서 §6-1 허용 —
 * 잡 행 수는 늘지 않는다, #58·#59 와 같은 함수). 그때 레슨 행은 GENERATING 그대로 두고 응답에서만 FAILED 로 보인다(레슨 행을 닫는 것은 #58·#59 몫).
 */
import { ApiError, dates, encodeCursor, jobs, truncateCodePoints } from '@/modules/infra'
import type {
  ChallengeDetail, ChallengeLessonTask, ChallengeListResponse, ChallengeSummary, ChallengeTask, ChallengeTodayResponse, ChallengeTodayTasks, ChallengeWordCount,
  ChallengeWordsTask,
} from '@/types/challenge'
import { isSeedVisibleFor } from '../seedOverride/visibility'
import { buildTopicPool } from '../topics/pool'
import { CHALLENGE_WORD_COUNTS, freezeDailyGoal, kstDayStart } from './metrics'
import { finishChallengeTx, settleExpired, settleExpiredTx } from './settle'
import { CHALLENGE_ROW_SELECT, ChallengeDataError, challengeNotFound, isUniqueViolation, withDeps, type ChallengeDb, type ChallengeDeps, type ChallengeRow } from './store'
import { challengeTopicProgress } from './topicProgress'
import { isChallengeId, type ChallengeListQuery, type CreateChallengeInput } from './validate'
import { buildChallengeView, toChallengeSummary, type ChallengeView, type ViewDay } from './view'

/** 사용자당 하루(KST) 만들기 상한 — 만들기·그만두기 반복으로 행이 쌓이는 것 방어(사용자 삭제 경로가 없다). */
export const CHALLENGE_CREATE_PER_DAY = 20

function activeExists(challengeId: string | null): ApiError {
  return new ApiError('CONFLICT', '이미 진행 중인 챌린지가 있어요.', { reason: 'ACTIVE_EXISTS', challengeId })
}

async function findOwned(db: ChallengeDb, userId: string, id: string): Promise<ChallengeRow> {
  if (!isChallengeId(id)) throw challengeNotFound()
  const row = await db.challenge.findFirst({ where: { id, userId }, select: CHALLENGE_ROW_SELECT })
  if (!row) throw challengeNotFound()
  return row
}

async function findActive(db: ChallengeDb, userId: string): Promise<ChallengeRow | null> {
  return db.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: CHALLENGE_ROW_SELECT })
}

/**
 * 끝난 챌린지(#155 목록의 끝난 쪽·#158 `recentlyEnded`)의 보이는 값 — `dailyGoal` 형태가 깨진 행 하나 때문에 목록·오늘 전체가 500 이 되지 않게
 * 그 행만 건너뛴다(로그 한 줄, REV-120 L-1). 끝난 기록은 표시 전용이라 빼도 상태가 바뀌지 않는다. 진행 중 행은 복구 규칙이 정해지지 않아
 * 여기 오지 않는다(그대로 던진다). DB 오류 등 다른 예외도 그대로 던진다.
 */
async function finishedViewOrSkip(db: ChallengeDb, row: ChallengeRow, now: Date): Promise<ChallengeView | null> {
  try {
    return await buildChallengeView(db, row, now)
  } catch (e) {
    if (!(e instanceof ChallengeDataError)) throw e
    console.error('[challenges] 끝난 챌린지의 dailyGoal 형태가 올바르지 않아 목록에서 뺍니다:', row.id)
    return null
  }
}

/** 생략한 단어 장수 — 학습 설정 하루 단어 수 이하에서 가장 큰 선택지, 그 주제 기본 표현 수를 넘지 않게. 고를 수 없으면 null. */
export function defaultWordCount(dailyWordCount: number, poolSize: number): ChallengeWordCount | null {
  const fit = CHALLENGE_WORD_COUNTS.filter((n) => n <= poolSize)
  if (!fit.length) return null
  const under = fit.filter((n) => n <= dailyWordCount)
  return under.length ? under[under.length - 1] : fit[0]
}

// ── #156 만들기 ──────────────────────────────────────────────────────────────

export async function createChallenge(userId: string, input: CreateChallengeInput, over?: Partial<ChallengeDeps>): Promise<ChallengeDetail> {
  const deps = withDeps(over)
  const now = deps.now()
  const today = dates.todayKst(now)
  const topic = await deps.db.conversationTopic.findFirst({ where: { id: input.topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true, level: true } })
  // 이 사용자가 가린(숨김·내 버전) 시드 주제로는 새 챌린지를 만들지 않는다 — 없는 주제와 같은 404(task-045 §2). 잠금 안 재확인은 T3 공용 헬퍼.
  if (!topic || !(await isSeedVisibleFor(deps.db, userId, 'TOPIC', topic.id))) throw new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.')
  let wordCount: ChallengeWordCount | null = null
  if (input.words) {
    const chunks = await deps.db.topicChunk.findMany({ where: { topicId: topic.id }, orderBy: [{ order: 'asc' }, { id: 'asc' }], select: { id: true, chunkType: true, textJa: true, reading: true, meaningKo: true } })
    const poolSize = buildTopicPool(chunks, []).chunkTotal
    wordCount = input.wordCount ?? defaultWordCount(await deps.dailyWordCount(userId), poolSize)
    if (wordCount === null || wordCount > poolSize) {
      throw new ApiError('VALIDATION', `이 주제의 기본 표현은 ${poolSize}개라 그보다 많은 장수는 고를 수 없어요.`, { field: 'dailyGoal.wordCount', reason: 'WORD_COUNT_OVER_POOL', poolSize })
    }
  }
  const dailyGoal = freezeDailyGoal({ lesson: input.lesson, words: input.words, wordCount })
  const startDate = input.start === 'TODAY' ? today : dates.addDays(today, 1)
  const endDate = dates.addDays(startDate, input.lengthDays - 1)
  const title = input.title ?? `${truncateCodePoints(topic.title, 60)} ${input.lengthDays}일 챌린지`
  let id: string
  try {
    id = await deps.transaction(async (tx) => {
      await deps.lockUser(tx, userId)
      // 끝내는 전이(TOPIC_REMOVED 의 endedAt)는 잠금 뒤 시각으로 — endChallenge 와 같은 이유(REV-124). 시작일·429 는 요청 도착 시각 그대로.
      const lockedAt = deps.now()
      await settleExpiredTx(tx, userId, dates.todayKst(lockedAt), lockedAt)
      const active = await tx.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })
      if (active) throw activeExists(active.id)
      const made = await tx.challenge.count({ where: { userId, createdAt: { gte: kstDayStart(today) } } })
      if (made >= CHALLENGE_CREATE_PER_DAY) {
        const retryAfterSec = Math.max(1, Math.ceil((kstDayStart(dates.addDays(today, 1)).getTime() - now.getTime()) / 1000))
        throw new ApiError('RATE_LIMITED', '오늘은 챌린지를 더 만들 수 없어요. 내일 다시 시도해 주세요.', { retryAfterSec })
      }
      const row = await tx.challenge.create({
        data: {
          userId,
          title,
          topicId: topic.id,
          topicTitleSnap: truncateCodePoints(topic.title, 80),
          level: topic.level,
          lengthDays: input.lengthDays,
          startDate: dates.toDbDate(startDate),
          endDate: dates.toDbDate(endDate),
          dailyGoal: { ...dailyGoal },
          status: 'ACTIVE',
          activeKey: userId,
        },
        select: { id: true },
      })
      return row.id
    })
  } catch (e) {
    // 잠금을 지나 두 요청이 겹쳐도 `activeKey @unique` 가 하나만 남긴다 — 그 위반도 같은 409.
    if (isUniqueViolation(e)) throw activeExists((await findActive(deps.db, userId))?.id ?? null)
    throw e
  }
  return getChallengeDetail(userId, id, deps)
}

// ── #159 그만두기 ────────────────────────────────────────────────────────────

/** ACTIVE → ENDED(멱등 — 이미 ENDED 면 같은 응답). 기간이 지나 COMPLETED 로 전이된 것은 409 NOT_ACTIVE. */
export async function endChallenge(userId: string, id: string, over?: Partial<ChallengeDeps>): Promise<ChallengeSummary> {
  const deps = withDeps(over)
  if (!isChallengeId(id)) throw challengeNotFound()
  await deps.transaction(async (tx) => {
    await deps.lockUser(tx, userId)
    // 시각은 잠금을 얻은 뒤에 잡는다 — 잠금 대기 중 먼저 커밋된 완료 스냅샷(createdAt = 같은 앱 시계)이 endedAt 앞에 오게(REV-124).
    const lockedAt = deps.now()
    await settleExpiredTx(tx, userId, dates.todayKst(lockedAt), lockedAt)
    const row = await findOwned(tx, userId, id)
    if (row.status === 'COMPLETED') throw new ApiError('CONFLICT', '이미 기간이 끝난 챌린지예요.', { reason: 'NOT_ACTIVE', status: 'COMPLETED' })
    if (row.status === 'ACTIVE') await finishChallengeTx(tx, row, { status: 'ENDED', endedAt: lockedAt, endReason: 'USER' }, lockedAt)
  })
  const row = await findOwned(deps.db, userId, id)
  return toChallengeSummary(await buildChallengeView(deps.db, row, deps.now()))
}

// ── #157 상세 ────────────────────────────────────────────────────────────────

async function refExistence(db: ChallengeDb, userId: string, days: ViewDay[]): Promise<{ lessons: Set<string>; sessions: Set<string> }> {
  const lessonIds = [...new Set(days.flatMap((d) => (d.lesson?.lessonId ? [d.lesson.lessonId] : [])))]
  const sessionIds = [...new Set(days.flatMap((d) => (d.words?.sessionId ? [d.words.sessionId] : [])))]
  const [lessons, sessions] = await Promise.all([
    lessonIds.length ? db.lesson.findMany({ where: { userId, id: { in: lessonIds } }, select: { id: true } }) : [],
    sessionIds.length ? db.vocabSession.findMany({ where: { userId, id: { in: sessionIds } }, select: { id: true } }) : [],
  ])
  return { lessons: new Set(lessons.map((r) => r.id)), sessions: new Set(sessions.map((r) => r.id)) }
}

export async function getChallengeDetail(userId: string, id: string, over?: Partial<ChallengeDeps>): Promise<ChallengeDetail> {
  const deps = withDeps(over)
  if (!isChallengeId(id)) throw challengeNotFound()
  await settleExpired(userId, deps)
  const row = await findOwned(deps.db, userId, id)
  const now = deps.now()
  const v = await buildChallengeView(deps.db, row, now, { links: true })
  const [refs, topicProgress, today] = await Promise.all([
    refExistence(deps.db, userId, v.days),
    row.topicId ? challengeTopicProgress(deps, userId, row.topicId) : Promise.resolve(null),
    buildTodayTasks(deps.db, userId, v),
  ])
  return {
    ...toChallengeSummary(v),
    days: v.days.map((d) => ({
      date: d.date,
      dayIndex: d.dayIndex,
      state: d.state,
      goalMetAt: d.goalMetAt ? d.goalMetAt.toISOString() : null,
      lesson: d.lesson ? { ...d.lesson, refExists: !!d.lesson.lessonId && refs.lessons.has(d.lesson.lessonId) } : null,
      words: d.words ? { ...d.words, refExists: !!d.words.sessionId && refs.sessions.has(d.words.sessionId) } : null,
    })),
    topicProgress,
    totals: v.totals,
    today,
    result: v.result,
  }
}

// ── 오늘 할 일(#157 `today`·#158) ────────────────────────────────────────────

/**
 * 진행 중이고 기간 안(시작일 ≤ 오늘 ≤ 마지막 날)일 때만. 완료 여부는 스냅샷(지표와 같은 계산), 진행 상태는 그날 `Lesson`·`VocabSession`·생성 잡.
 * 수업: 오늘 끝냄 → DONE · 오늘 만든 챌린지 주제 새 수업(가장 최근, 끝내지 않은 것) → 그 상태(GENERATING 은 잡이 살아 있을 때만, 죽었으면 FAILED 표시)
 *       · 어제 이전에 만든 챌린지 주제 새 수업이 READY·IN_PROGRESS → CONTINUE · 그 밖 TODO.
 * 단어: 합계 ≥ 인정 장수 → DONE · 오늘 시작한 이 주제 세트를 풀고 있음 → IN_PROGRESS · 1장 이상 답함 → SHORT · 그 밖 TODO.
 */
export async function buildTodayTasks(db: ChallengeDb, userId: string, v: ChallengeView): Promise<ChallengeTodayTasks | null> {
  const ch = v.metric
  const today = v.today
  if (v.row.status !== 'ACTIVE' || ch.topicId === null || today < ch.startDate || today > ch.endDate) return null
  const day = v.days.find((d) => d.date === today)
  if (!day) return null
  const goal = ch.dailyGoal
  const tasks: ChallengeTask[] = []
  const dbToday = dates.toDbDate(today)
  if (goal.words) {
    const open = await db.vocabSession.findFirst({ where: { userId, topicId: ch.topicId, date: dbToday, status: 'IN_PROGRESS' }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], select: { id: true } })
    const answered = day.words?.answered ?? 0
    const need = goal.wordsMinAnswered ?? 0
    const state: ChallengeWordsTask['state'] = answered >= need ? 'DONE' : open ? 'IN_PROGRESS' : answered > 0 ? 'SHORT' : 'TODO'
    tasks.push({ kind: 'WORDS', state, sessionId: open?.id ?? day.words?.sessionId ?? null, wordCount: goal.wordCount, minAnswered: goal.wordsMinAnswered, answered, sets: day.words?.sets ?? 0 })
  }
  if (goal.lesson) tasks.push(await lessonTask(db, userId, ch.topicId, today, day))
  return { date: today, dayIndex: day.dayIndex, topic: { id: ch.topicId, title: v.row.topicTitleSnap }, tasks, goalMet: day.met }
}

async function lessonTask(db: ChallengeDb, userId: string, topicId: string, today: string, day: ViewDay): Promise<ChallengeLessonTask> {
  if (day.lesson) return { kind: 'LESSON', state: 'DONE', lessonId: day.lesson.lessonId, jobId: null }
  const cur = await db.lesson.findFirst({
    where: { userId, topicId, kind: 'NEW', date: dates.toDbDate(today), status: { not: 'DONE' } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, status: true },
  })
  if (cur) {
    if (cur.status === 'GENERATING') {
      const job = await jobs.findActiveJob({ userId, kind: 'LESSON_GEN', refId: cur.id }, db)
      return job ? { kind: 'LESSON', state: 'GENERATING', lessonId: cur.id, jobId: job.id } : { kind: 'LESSON', state: 'FAILED', lessonId: cur.id, jobId: null }
    }
    if (cur.status === 'READY' || cur.status === 'IN_PROGRESS' || cur.status === 'FAILED') return { kind: 'LESSON', state: cur.status, lessonId: cur.id, jobId: null }
  }
  const older = await db.lesson.findFirst({
    where: { userId, topicId, kind: 'NEW', date: { lt: dates.toDbDate(today) }, status: { in: ['READY', 'IN_PROGRESS'] } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: { id: true },
  })
  if (older) return { kind: 'LESSON', state: 'CONTINUE', lessonId: older.id, jobId: null }
  return { kind: 'LESSON', state: 'TODO', lessonId: null, jobId: null }
}

/** #158 — 계획표 카드·오늘 탭·덱 머리용 요약. LLM 호출 없음. */
export async function getChallengeToday(userId: string, over?: Partial<ChallengeDeps>): Promise<ChallengeTodayResponse> {
  const deps = withDeps(over)
  await settleExpired(userId, deps)
  const now = deps.now()
  const today = dates.todayKst(now)
  const [active, recent] = await Promise.all([
    findActive(deps.db, userId),
    deps.db.challenge.findFirst({
      where: { userId, status: { in: ['COMPLETED', 'ENDED'] }, endedAt: { gte: kstDayStart(dates.addDays(today, -1)) } },
      orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
      select: CHALLENGE_ROW_SELECT,
    }),
  ])
  let challenge: ChallengeSummary | null = null
  let todayTasks: ChallengeTodayTasks | null = null
  if (active) {
    const v = await buildChallengeView(deps.db, active, now)
    challenge = toChallengeSummary(v)
    todayTasks = await buildTodayTasks(deps.db, userId, v)
  }
  let recentlyEnded: ChallengeTodayResponse['recentlyEnded'] = null
  if (recent && recent.endedAt && (recent.status === 'COMPLETED' || recent.status === 'ENDED')) {
    const v = await finishedViewOrSkip(deps.db, recent, now)
    if (v) {
      recentlyEnded = {
        id: recent.id,
        status: recent.status,
        title: recent.title,
        endedAt: recent.endedAt.toISOString(),
        result: { lengthDays: recent.lengthDays, metDays: v.stats.metDays, elapsedDays: v.stats.elapsedDays, rate: v.stats.rate, longestStreak: v.stats.longestStreak, endReason: v.result?.endReason ?? null },
      }
    }
  }
  return { challenge, today: todayTasks, recentlyEnded }
}

// ── #155 목록 ────────────────────────────────────────────────────────────────

/**
 * 진행 중 먼저(첫 쪽에만), 끝난 것은 `endedAt desc, id desc`. 커서는 끝난 것의 (endedAt, id).
 * 첫 쪽이 진행 중 1개로 다 찼으면(limit=1) 끝난 것 맨 앞을 가리키는 커서(먼 미래 시각)를 준다.
 */
const CURSOR_HEAD = { t: '9999-12-31T00:00:00.000Z', id: '~' }

export async function listChallenges(userId: string, q: ChallengeListQuery, over?: Partial<ChallengeDeps>): Promise<ChallengeListResponse> {
  const deps = withDeps(over)
  await settleExpired(userId, deps)
  const now = deps.now()
  const items: ChallengeSummary[] = []
  if (!q.cursor && q.status !== 'FINISHED') {
    const active = await findActive(deps.db, userId)
    if (active) items.push(toChallengeSummary(await buildChallengeView(deps.db, active, now)))
  }
  let nextCursor: string | null = null
  if (q.status !== 'ACTIVE') {
    const take = q.limit - items.length
    const c = q.cursor
    const rows = await deps.db.challenge.findMany({
      where: {
        userId,
        status: { in: ['COMPLETED', 'ENDED'] },
        ...(c ? { OR: [{ endedAt: { lt: new Date(c.t) } }, { endedAt: new Date(c.t), id: { lt: c.id } }] } : {}),
      },
      orderBy: [{ endedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      select: CHALLENGE_ROW_SELECT,
    })
    const page = rows.slice(0, take)
    for (const row of page) {
      const v = await finishedViewOrSkip(deps.db, row, now)
      if (v) items.push(toChallengeSummary(v))
    }
    if (rows.length > take) {
      const last = page[page.length - 1]
      nextCursor = encodeCursor(last?.endedAt ? { t: last.endedAt.toISOString(), id: last.id } : CURSOR_HEAD)
    }
  }
  return { items, nextCursor }
}
