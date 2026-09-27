/**
 * StudyLog — 달력·분석의 원천(domain-model §9-3). task-006 은 **제안 채택(ADD_STUDY_LOG → origin=ACCEPTED)** 경로만.
 * StudyLog 와 DAILY 스냅샷 증가는 같은 트랜잭션(호출자 tx)에서 만든다.
 */
import type { LogOrigin, Prisma, StudyType } from '@prisma/client'
import { dates, truncateCodePoints, type Tx } from '@/modules/infra'
import { bumpDailySnapshot } from '../snapshots'

export interface StudyLogEntry {
  /** KST `YYYY-MM-DD`. 생략하면 오늘. */
  date?: string
  type: StudyType
  origin: LogOrigin
  refId?: string | null
  summary: string
  result?: Prisma.InputJsonValue
  correctionsCount?: number
  durationSec?: number | null
}

export async function recordStudyLog(userId: string, entry: StudyLogEntry, tx: Tx): Promise<{ id: string; date: string }> {
  const date = entry.date ?? dates.todayKst()
  const log = await tx.studyLog.create({
    data: {
      userId,
      date: dates.toDbDate(date),
      type: entry.type,
      origin: entry.origin,
      refId: entry.refId ?? null,
      summary: truncateCodePoints(entry.summary, 500),
      result: entry.result,
      correctionsCount: Math.max(0, entry.correctionsCount ?? 0),
      durationSec: entry.durationSec ?? null,
    },
    select: { id: true },
  })
  return { id: log.id, date }
}

export interface AcceptedChatLogInput {
  chatId: string | null
  chatKind: 'TALK' | 'CHAT'
  /** 학습자 메시지 수(= 턴 수). */
  turns: number
  correctionCount: number
  acceptedCorrections: number
  rejectedCorrections: number
  summaryKo: string | null
  endOfTopic?: boolean
}

/**
 * ADD_STUDY_LOG 채택 — StudyLog(origin=ACCEPTED, type=채팅 종류) + DAILY(`chatTurns|talkTurns`·`corrections.proposed`) 증가.
 * 결과 JSON 은 §9-3 `StudyLog.result (TALK·CHAT)` 형태.
 */
export async function recordAcceptedChatLog(userId: string, input: AcceptedChatLogInput, tx: Tx): Promise<{ id: string; date: string }> {
  const turns = Math.max(0, Math.floor(input.turns))
  const proposed = Math.max(0, Math.floor(input.correctionCount))
  const fallback = `${input.chatKind === 'TALK' ? '회화' : '채팅'} 표현 점검 · 메시지 ${turns}개 · 교정 ${proposed}건`
  const log = await recordStudyLog(
    userId,
    {
      type: input.chatKind,
      origin: 'ACCEPTED',
      refId: input.chatId,
      summary: input.summaryKo?.trim() ? input.summaryKo.trim() : fallback,
      result: {
        turns,
        corrections: { proposed, accepted: Math.max(0, input.acceptedCorrections), ignored: Math.max(0, input.rejectedCorrections) },
        endOfTopic: input.endOfTopic === true,
      },
      correctionsCount: proposed,
    },
    tx,
  )
  await bumpDailySnapshot(userId, log.date, input.chatKind === 'TALK' ? { talkTurns: turns, corrections: { proposed } } : { chatTurns: turns, corrections: { proposed } }, tx)
  return log
}

/** 교정 채택 1건의 DAILY 증가(`corrections.accepted` — domain-model §9-3 정합성 #7). */
export async function recordCorrectionAccepted(userId: string, tx: Tx): Promise<void> {
  await bumpDailySnapshot(userId, dates.todayKst(), { corrections: { accepted: 1 } }, tx)
}
