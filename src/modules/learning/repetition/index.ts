/**
 * 반복 학습 항목(RepetitionItem, R-1) — 등록/갱신만(task-010 L5). 강사 판단(A11)·복습 카드·교정 채택/단어 세트 경로는 task-010b 가
 * 같은 `registerRepetitionItems` 를 부른다(module-dependency §10 `registerRepetitionItems(userId, items[], tx)`).
 *
 * - 항목 키는 `@@unique([userId, refType, refId])`. refType 은 원천 종류 문자열(FK 없음): 레슨 경로는 `TopicChunk`(주제 조각 id)·
 *   `Expr`(A4 가 새로 만든 표현 — refId = sha1(정규화 표기))·`Grammar`(refId = sha1(정규화 문형)).
 * - 카운터는 **증가만**. 이번 학습의 정답·오답 수를 더하고 `studiedCount+1`, `lastStudiedAt=now`.
 * - 다음 복습일 = 오늘(KST) + intervalDays. intervalDays 는 기존 값(없으면 3)을 3~7 로, FOCUS 면 ≤3 으로 자른다. 이 경로가 정한
 *   날짜라 `decidedBy=FALLBACK` 으로 적는다(강사 판단은 010b 의 A11 이 다시 `TUTOR` 로 덮는다).
 * - 호출자 트랜잭션 안에서, **사용자 행을 먼저 잠근 뒤** 부른다(없는 행 생성의 경합을 사용자 단위로 직렬화).
 */
import { createHash } from 'node:crypto'
import type { RepetitionItemType, RepetitionPriority } from '@prisma/client'
import { dates, truncateCodePoints, type Tx } from '@/modules/infra'

export const REPETITION_INTERVAL_DEFAULT = 3
export const REPETITION_INTERVAL_MIN = 3
export const REPETITION_INTERVAL_MAX = 7
export const REPETITION_FOCUS_MAX = 3
/** 레슨 1회가 등록하는 항목 상한(조각 우선, task-010 L5). */
export const REPETITION_LESSON_ITEM_CAP = 12

export type RepetitionRefType = 'TopicChunk' | 'Expr' | 'Grammar'

export interface RepetitionItemInput {
  itemType: RepetitionItemType
  refType: string
  refId: string
  textJa: string
  meaningKo: string | null
  /** 이번 학습에서 맞힌·틀린 횟수(증가분). */
  correct?: number
  wrong?: number
  /** 강사 피드백 증가분(교정 채택 경로 — 010b). */
  feedback?: number
}

export interface RegisteredItem {
  id: string
  refType: string
  refId: string
  created: boolean
}

/**
 * 표기 정규화(refId 해시 재료) — NFKC, 공백·문장부호·물결표 제거. 가나 종류는 그대로 둔다(カ·か 는 다른 표현일 수 있다).
 */
export function normalizeRefText(text: string): string {
  return text.normalize('NFKC').replace(/[\s　、。，．,.!！?？・「」『』〜~…]/g, '')
}

/** sha1(정규화 표기) — hex 40자(RepetitionItem.refId 상한 40). */
export function repetitionRefId(text: string): string {
  return createHash('sha1').update(normalizeRefText(text), 'utf8').digest('hex')
}

export function clampInterval(days: number | null | undefined, priority: RepetitionPriority): number {
  const d = typeof days === 'number' && Number.isFinite(days) ? Math.round(days) : REPETITION_INTERVAL_DEFAULT
  const clamped = Math.min(REPETITION_INTERVAL_MAX, Math.max(REPETITION_INTERVAL_MIN, d))
  return priority === 'FOCUS' ? Math.min(REPETITION_FOCUS_MAX, clamped) : clamped
}

const nonNeg = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
const keyOf = (refType: string, refId: string) => `${refType}\u0000${refId}`

/** 같은 키 입력을 하나로 합친다(카운터는 더하고 스냅샷 텍스트는 처음 것). 순서는 처음 나온 순서. */
export function mergeRepetitionInputs(items: readonly RepetitionItemInput[]): RepetitionItemInput[] {
  const out = new Map<string, RepetitionItemInput>()
  for (const it of items) {
    const k = keyOf(it.refType, it.refId)
    const prev = out.get(k)
    if (!prev) out.set(k, { ...it, correct: nonNeg(it.correct), wrong: nonNeg(it.wrong), feedback: nonNeg(it.feedback) })
    else out.set(k, { ...prev, correct: nonNeg(prev.correct) + nonNeg(it.correct), wrong: nonNeg(prev.wrong) + nonNeg(it.wrong), feedback: nonNeg(prev.feedback) + nonNeg(it.feedback) })
  }
  return [...out.values()]
}

/**
 * 항목 등록/갱신 — 호출자 tx 안에서(사용자 행 잠금 뒤). 반환 순서 = 합친 입력 순서.
 * `today` 는 KST 날짜(`YYYY-MM-DD`, 생략 시 오늘) — nextDueAt 계산 기준.
 */
export async function registerRepetitionItems(userId: string, items: readonly RepetitionItemInput[], tx: Tx, opts: { today?: string; now?: Date } = {}): Promise<RegisteredItem[]> {
  const merged = mergeRepetitionInputs(items)
  if (!merged.length) return []
  const today = opts.today ?? dates.todayKst()
  const now = opts.now ?? new Date()
  const existing = await tx.repetitionItem.findMany({
    where: { userId, OR: merged.map((m) => ({ refType: m.refType, refId: m.refId })) },
    select: { id: true, refType: true, refId: true, intervalDays: true, priority: true },
  })
  const byKey = new Map(existing.map((e) => [keyOf(e.refType, e.refId), e]))
  const out: RegisteredItem[] = []
  for (const m of merged) {
    const textJa = truncateCodePoints(m.textJa, 200)
    const meaningKo = m.meaningKo ? truncateCodePoints(m.meaningKo, 200) : null
    const feedback = nonNeg(m.feedback)
    const prev = byKey.get(keyOf(m.refType, m.refId))
    if (prev) {
      const interval = clampInterval(prev.intervalDays, prev.priority)
      await tx.repetitionItem.update({
        where: { id: prev.id },
        data: {
          textJa,
          meaningKo,
          studiedCount: { increment: 1 },
          correctCount: { increment: nonNeg(m.correct) },
          wrongCount: { increment: nonNeg(m.wrong) },
          ...(feedback ? { feedbackCount: { increment: feedback }, lastFeedbackAt: now } : {}),
          lastStudiedAt: now,
          intervalDays: interval,
          nextDueAt: dates.toDbDate(dates.addDays(today, interval)),
          decidedBy: 'FALLBACK',
        },
      })
      out.push({ id: prev.id, refType: m.refType, refId: m.refId, created: false })
    } else {
      const interval = REPETITION_INTERVAL_DEFAULT
      const row = await tx.repetitionItem.create({
        data: {
          userId,
          itemType: m.itemType,
          refType: m.refType.slice(0, 30),
          refId: m.refId.slice(0, 40),
          textJa,
          meaningKo,
          studiedCount: 1,
          lastStudiedAt: now,
          correctCount: nonNeg(m.correct),
          wrongCount: nonNeg(m.wrong),
          feedbackCount: feedback,
          lastFeedbackAt: feedback ? now : null,
          intervalDays: interval,
          nextDueAt: dates.toDbDate(dates.addDays(today, interval)),
          decidedBy: 'FALLBACK',
        },
        select: { id: true },
      })
      out.push({ id: row.id, refType: m.refType, refId: m.refId, created: true })
    }
  }
  return out
}
