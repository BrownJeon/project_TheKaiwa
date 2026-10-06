/**
 * 챌린지 DB 읽기·공통 부품. 쓰기는 `Challenge` 표만(이 모듈 소유). 다른 표(스냅샷·수업·세트·주제·반복 항목·잡)는 **읽기만** 한다.
 *
 * DB·트랜잭션·시계·사용자 잠금을 `ChallengeDeps` 로 받는다 — 라우트는 기본값(`prisma`·`withTransaction`·`lockUserRow`·지금 시각)을 쓰고,
 * 단위 테스트는 메모리 가짜를 넘긴다(공유 DB 를 건드리지 않고 동시성·지연 전이·소유자 검사를 확인).
 */
import type { $Enums, Prisma } from '@prisma/client'
import { ApiError, dates, lockUserRow, prisma, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import type { ChallengeStatus } from '@/types/challenge'
import { doneLessonStats } from '../topics'
import { readChallengeSnaps, readDailyGoal, type ChallengeSnaps, type MetricChallenge } from './metrics'

export type ChallengeDb = Tx

export interface ChallengeDeps {
  db: ChallengeDb
  transaction: <T>(fn: (tx: ChallengeDb) => Promise<T>) => Promise<T>
  lockUser: (tx: ChallengeDb, userId: string) => Promise<boolean>
  now: () => Date
  /** 이 주제로 끝낸 수업 수 — #56 주제 카드와 같은 값(`topics.doneLessonStats`). */
  doneLessonCount: (userId: string, topicId: string) => Promise<number>
  /** 단어 장수를 생략했을 때 기준(학습 설정 하루 단어 수). */
  dailyWordCount: (userId: string) => Promise<number>
}

export const defaultChallengeDeps: ChallengeDeps = {
  db: prisma,
  transaction: (fn) => withTransaction(fn),
  lockUser: lockUserRow,
  now: () => new Date(),
  doneLessonCount: async (userId, topicId) => (await doneLessonStats(userId, [topicId])).get(topicId)?.count ?? 0,
  dailyWordCount: async (userId) => (await getProfile(userId)).dailyWordCount,
}

export function withDeps(over: Partial<ChallengeDeps> | undefined): ChallengeDeps {
  return over ? { ...defaultChallengeDeps, ...over } : defaultChallengeDeps
}

export const CHALLENGE_ROW_SELECT = {
  id: true, userId: true, title: true, topicId: true, topicTitleSnap: true, level: true, lengthDays: true, startDate: true, endDate: true,
  dailyGoal: true, status: true, result: true, endedAt: true, createdAt: true,
} as const

export interface ChallengeRow {
  id: string
  userId: string
  title: string
  topicId: string | null
  topicTitleSnap: string
  level: $Enums.JlptLevel
  lengthDays: number
  startDate: Date
  endDate: Date
  dailyGoal: Prisma.JsonValue
  status: ChallengeStatus
  result: Prisma.JsonValue | null
  endedAt: Date | null
  createdAt: Date
}

export function challengeNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '챌린지를 찾을 수 없어요.')
}

export class ChallengeDataError extends Error {
  constructor(readonly challengeId: string, what: string) {
    super(`챌린지 ${what} 형태가 올바르지 않습니다`)
    this.name = 'ChallengeDataError'
  }
}

/** 행 → 계산 입력. `dailyGoal` 형태가 어긋나면 던진다(#62·#51 응답 조합은 잡아서 null, 화면 조회는 500). */
export function toMetricChallenge(row: ChallengeRow): MetricChallenge {
  const dailyGoal = readDailyGoal(row.dailyGoal)
  if (!dailyGoal) throw new ChallengeDataError(row.id, 'dailyGoal')
  return { status: row.status, startDate: dates.fromDbDate(row.startDate), endDate: dates.fromDbDate(row.endDate), endedAt: row.endedAt, topicId: row.topicId, dailyGoal }
}

/** 기간 안 LESSON·VOCAB_SESSION 스냅샷(생성 시각 범위 — 인덱스 `(userId, kind, createdAt)`, #54 와 같은 방식). */
export async function loadChallengeSnaps(db: ChallengeDb, userId: string, from: Date, to: Date): Promise<ChallengeSnaps> {
  if (to.getTime() <= from.getTime()) return { lessons: [], vocab: [] }
  const rows = await db.statsSnapshot.findMany({
    where: { userId, kind: { in: ['LESSON', 'VOCAB_SESSION'] }, createdAt: { gte: from, lt: to } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, kind: true, periodKey: true, data: true, createdAt: true },
  })
  return readChallengeSnaps(rows)
}

export function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === 'P2002'
}
