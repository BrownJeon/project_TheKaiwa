/**
 * Learning History(§70) — `LearnerErrorStat` 증가·조회. 원본 행(교정·분석)을 지워도 불변(domain-model 규칙 2).
 * 증가는 `INSERT … ON DUPLICATE KEY UPDATE count = count + 1` 한 문장이라 동시 채택에서도 잃는 증가가 없다.
 */
import { randomBytes } from 'node:crypto'
import type { ChunkType, ErrorType } from '@prisma/client'
import { prisma, type Tx } from '@/modules/infra'

/** 교정의 조각 유형 → 패턴 키(`chunk:ACTION` 등), 없으면 `general`(task-006 Leader 계획 L3). */
export function errorPatternFor(chunkType: ChunkType | null | undefined): string {
  return chunkType ? `chunk:${chunkType}` : 'general'
}

/** cuid 비슷한 행 id(원시 SQL INSERT 용 — 형식은 식별에만 쓰인다). */
export function rawRowId(): string {
  return `c${Date.now().toString(36)}${randomBytes(9).toString('hex')}`.slice(0, 25)
}

export async function recordErrorStat(userId: string, type: ErrorType, pattern: string, tx?: Tx): Promise<void> {
  const db = tx ?? prisma
  const p = pattern.slice(0, 80)
  await db.$executeRaw`INSERT INTO LearnerErrorStat (id, userId, type, pattern, count, firstAt, lastAt, updatedAt)
    VALUES (${rawRowId()}, ${userId}, ${type}, ${p}, 1, NOW(3), NOW(3), NOW(3))
    ON DUPLICATE KEY UPDATE count = count + 1, lastAt = NOW(3), updatedAt = NOW(3)`
}

export interface ErrorStat {
  type: ErrorType
  pattern: string
  count: number
  lastAt: string
}

export async function getErrorStats(userId: string, limit = 10): Promise<ErrorStat[]> {
  const rows = await prisma.learnerErrorStat.findMany({
    where: { userId, count: { gt: 0 } },
    orderBy: [{ count: 'desc' }, { lastAt: 'desc' }],
    take: Math.max(1, Math.min(50, limit)),
    select: { type: true, pattern: true, count: true, lastAt: true },
  })
  return rows.map((r) => ({ type: r.type, pattern: r.pattern, count: r.count, lastAt: r.lastAt.toISOString() }))
}
