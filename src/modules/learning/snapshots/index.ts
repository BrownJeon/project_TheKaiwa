/**
 * StatsSnapshot — 집계 원장(domain-model 규칙 2: **생성·증가만**, 삭제 경로에서 쓰지 않는다). task-006 은 DAILY 증가만.
 *
 * DAILY `data` 형태(domain-model §9-3):
 *   {attended, words:{sessions,correct,wrong}, talkTurns, chatTurns, corrections:{proposed,accepted}, lessons, reviews, evals, repetition:{studied, focus}}
 *
 * 동시성: 행이 없을 때 두 트랜잭션이 동시에 만들면 유니크(userId,kind,periodKey) 충돌, 있을 때 동시에 읽고 쓰면 증가 유실이다.
 * 그래서 `INSERT … ON DUPLICATE KEY UPDATE id=id`(행 보장 + 행 잠금) → `SELECT … FOR UPDATE` → 병합 → UPDATE 를 **호출자 트랜잭션 안**에서 한다.
 */
import type { Prisma } from '@prisma/client'
import { type Tx } from '@/modules/infra'
import { rawRowId } from '../learningHistory'

export interface DailyData {
  attended: boolean
  words: { sessions: number; correct: number; wrong: number }
  talkTurns: number
  chatTurns: number
  corrections: { proposed: number; accepted: number }
  lessons: number
  reviews: number
  evals: number
  repetition: { studied: number; focus: number }
}

export interface DailyDelta {
  attended?: boolean
  words?: Partial<DailyData['words']>
  talkTurns?: number
  chatTurns?: number
  corrections?: Partial<DailyData['corrections']>
  lessons?: number
  reviews?: number
  evals?: number
  repetition?: Partial<DailyData['repetition']>
}

export function emptyDaily(): DailyData {
  return {
    attended: false,
    words: { sessions: 0, correct: 0, wrong: 0 },
    talkTurns: 0,
    chatTurns: 0,
    corrections: { proposed: 0, accepted: 0 },
    lessons: 0,
    reviews: 0,
    evals: 0,
    repetition: { studied: 0, focus: 0 },
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/**
 * 순수 병합 — 기존 `data`(형태가 어긋나도 됨)에 증가분을 더한다. 음수 증가는 무시한다(생성·증가만).
 * 모르는 키는 보존한다(다른 task 가 먼저 넣은 필드를 지우지 않게).
 */
export function mergeDaily(current: unknown, delta: DailyDelta): DailyData & Record<string, unknown> {
  const c = obj(current)
  const add = (a: unknown, d: number | undefined) => num(a) + (d && d > 0 ? d : 0)
  const w = obj(c.words)
  const cr = obj(c.corrections)
  const rp = obj(c.repetition)
  return {
    ...c,
    attended: c.attended === true || delta.attended === true,
    words: { ...w, sessions: add(w.sessions, delta.words?.sessions), correct: add(w.correct, delta.words?.correct), wrong: add(w.wrong, delta.words?.wrong) },
    talkTurns: add(c.talkTurns, delta.talkTurns),
    chatTurns: add(c.chatTurns, delta.chatTurns),
    corrections: { ...cr, proposed: add(cr.proposed, delta.corrections?.proposed), accepted: add(cr.accepted, delta.corrections?.accepted) },
    lessons: add(c.lessons, delta.lessons),
    reviews: add(c.reviews, delta.reviews),
    evals: add(c.evals, delta.evals),
    repetition: { ...rp, studied: add(rp.studied, delta.repetition?.studied), focus: add(rp.focus, delta.repetition?.focus) },
  }
}

/** DAILY(`periodKey` = KST `YYYY-MM-DD`) 증가 — 반드시 호출자 트랜잭션 안에서. */
export async function bumpDailySnapshot(userId: string, date: string, delta: DailyDelta, tx: Tx): Promise<void> {
  const empty = JSON.stringify(emptyDaily())
  await tx.$executeRaw`INSERT INTO StatsSnapshot (id, userId, kind, periodKey, data, createdAt, updatedAt)
    VALUES (${rawRowId()}, ${userId}, 'DAILY', ${date}, ${empty}, NOW(3), NOW(3))
    ON DUPLICATE KEY UPDATE id = id`
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM StatsSnapshot WHERE userId = ${userId} AND kind = 'DAILY' AND periodKey = ${date} FOR UPDATE`
  if (!locked.length) throw new Error('DAILY 스냅샷 행을 잠그지 못했습니다')
  const row = await tx.statsSnapshot.findUnique({ where: { id: locked[0].id }, select: { data: true } })
  await tx.statsSnapshot.update({ where: { id: locked[0].id }, data: { data: mergeDaily(row?.data, delta) as unknown as Prisma.InputJsonValue } })
}
