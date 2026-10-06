/**
 * 지연 전이(설계서 §5-5) — GET 안의 쓰기(선례: #58 이 죽은 생성 잡의 레슨을 FAILED 로 닫는다). 사용자 행 잠금 뒤 **조건부 UPDATE**
 * (`status='ACTIVE'`)라 두 번 일어나지 않는다. 끝내는 모든 경로가 `activeKey=null` 을 함께 쓴다(사용자당 진행 중 1개 유니크).
 *
 *  - 기간 끝(오늘 > endDate) → COMPLETED · `endedAt` = endDate 다음 날 00:00 KST(전이를 실행한 시각이 아님) · `result` 얼림
 *  - 주제가 끊김(topicId=null) → ENDED · `result.endReason='TOPIC_REMOVED'`(1단계 도달 불가 — 주제를 지우는 경로가 없다)
 *  - 그만두기(#159) → ENDED · `endedAt` = 사용자 행 잠금을 얻은 시각 · `endReason='USER'` — `endChallenge`
 * `endedAt` 을 실행 시각으로 쓰는 두 경로(그만두기·TOPIC_REMOVED)는 그 시각을 반드시 잠금 **뒤**에 잡는다 — 스냅샷 `createdAt` 도 같은 앱 시계라
 * 잠금 전에 커밋된 완료는 `createdAt < endedAt`, 잠금 뒤 완료는 `createdAt > endedAt` 로 순서가 늘 맞는다(REV-124).
 */
import { Prisma } from '@prisma/client'
import { dates } from '@/modules/infra'
import type { ChallengeEndReason } from '@/types/challenge'
import { computeChallengeMetrics, freezeChallengeResult, kstDayStart, readDailyGoal, type MetricChallenge } from './metrics'
import { CHALLENGE_ROW_SELECT, loadChallengeSnaps, toMetricChallenge, type ChallengeDb, type ChallengeDeps, type ChallengeRow } from './store'

function expiredWhere(userId: string, today: string): Prisma.ChallengeWhereInput {
  return { userId, status: 'ACTIVE', OR: [{ endDate: { lt: dates.toDbDate(today) } }, { topicId: null }] }
}

/**
 * `row` 를 끝낸다(호출자가 사용자 행을 잠근 트랜잭션 안). 얼린 결과 = 같은 `closeAt` 으로 한 번 계산한 값.
 * `dailyGoal` 이 깨져 계산할 수 없으면 결과 없이 상태만 끝낸다(진행 중 1개 칸을 풀어 새 챌린지를 막지 않게 — 로그만).
 */
export async function finishChallengeTx(tx: ChallengeDb, row: ChallengeRow, to: { status: 'COMPLETED' | 'ENDED'; endedAt: Date; endReason: ChallengeEndReason | null }, now: Date): Promise<boolean> {
  let result: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull
  const goal = readDailyGoal(row.dailyGoal)
  if (goal) {
    const ch: MetricChallenge = { ...toMetricChallenge(row), status: to.status, endedAt: to.endedAt }
    const snaps = ch.topicId === null ? { lessons: [], vocab: [] } : await loadChallengeSnaps(tx, row.userId, kstDayStart(ch.startDate), to.endedAt)
    const freezeToday = to.status === 'COMPLETED' ? dates.addDays(ch.endDate, 1) : dates.todayKst(to.endedAt)
    const m = computeChallengeMetrics(ch, snaps, freezeToday, now)
    result = freezeChallengeResult(m, goal, to.endReason) as unknown as Prisma.InputJsonValue
  } else {
    console.error('[challenges] dailyGoal 형태가 올바르지 않아 결과 없이 끝냅니다:', row.id)
  }
  const done = await tx.challenge.updateMany({
    where: { id: row.id, userId: row.userId, status: 'ACTIVE' },
    data: { status: to.status, activeKey: null, endedAt: to.endedAt, result },
  })
  return done.count > 0
}

/** 트랜잭션 안 — 기간 지난 ACTIVE·주제가 끊긴 ACTIVE 를 끝낸다. 끝낸 수. */
export async function settleExpiredTx(tx: ChallengeDb, userId: string, today: string, now: Date): Promise<number> {
  const rows = await tx.challenge.findMany({ where: expiredWhere(userId, today), select: CHALLENGE_ROW_SELECT })
  let n = 0
  for (const row of rows) {
    const end = row.topicId === null
      ? { status: 'ENDED' as const, endedAt: now, endReason: 'TOPIC_REMOVED' as const }
      : { status: 'COMPLETED' as const, endedAt: kstDayStart(dates.addDays(dates.fromDbDate(row.endDate), 1)), endReason: null }
    if (await finishChallengeTx(tx, row, end, now)) n++
  }
  return n
}

/**
 * 조회 앞 지연 전이 — 끝낼 것이 없으면 잠금·트랜잭션 없이 돌아간다(읽기 1회). 사전 점검은 잠금 전 시각으로 충분하고(확인용),
 * 실제 전이의 `today`·`now`(TOPIC_REMOVED 의 endedAt)는 잠금을 얻은 뒤에 잡는다(REV-124 — 잠금 대기 중 커밋된 완료가 앞에 오게).
 */
export async function settleExpired(userId: string, deps: ChallengeDeps): Promise<void> {
  const due = await deps.db.challenge.findFirst({ where: expiredWhere(userId, dates.todayKst(deps.now())), select: { id: true } })
  if (!due) return
  await deps.transaction(async (tx) => {
    await deps.lockUser(tx, userId)
    const lockedAt = deps.now()
    await settleExpiredTx(tx, userId, dates.todayKst(lockedAt), lockedAt)
  })
}
