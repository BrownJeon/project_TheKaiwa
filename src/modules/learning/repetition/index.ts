/**
 * 반복 학습 항목(RepetitionItem, R-1) — 등록/갱신. 등록 3경로(task-010b): 레슨 완료(task-010 L5)·교정 채택(`Correction`)·단어 세트
 * finish(`WordEntry`). 강사 판단(A11)은 `./decision`, 복습 세션 추출·근거 묶음은 `./review`(순수 함수).
 *
 * - 항목 키는 `@@unique([userId, refType, refId])`. refType 은 원천 종류 문자열(FK 없음): 레슨 경로는 `TopicChunk`(주제 조각 id)·
 *   `Expr`(A4 가 새로 만든 표현 — refId = sha1(정규화 표기))·`Grammar`(refId = sha1(정규화 문형)) / 교정 채택은 `Correction`
 *   (refId = sha1(정규화 교정문) — 같은 표현을 다시 채택하면 같은 항목의 `feedbackCount+1`) / 단어 세트는 `WordEntry`(refId = 단어 id).
 * - 카운터는 **증가만**. 이번 학습의 정답·오답 수를 더하고 `studiedCount+1`, `lastStudiedAt=now`(교정 채택은 `studied:false` — 피드백만 +1).
 * - FOCUS(design-spec §7-4): `feedbackCount ≥ 3`(코드 임계) 또는 강사 지정. 한 번 FOCUS 가 된 항목을 이 경로가 풀지는 않는다
 *   (푸는 것은 강사 판단 — A11 이 NORMAL 로 낼 때, 단 피드백 3회 이상이면 코드가 FOCUS 를 유지).
 * - 다음 복습일 = 오늘(KST) + intervalDays. intervalDays 는 기존 값(없으면 3)을 3~7 로, FOCUS 면 ≤3 으로 자른다. 이 경로가 정한
 *   날짜라 `decidedBy=FALLBACK` 으로 적는다(강사 판단은 A11 이 다시 `TUTOR` 로 덮는다).
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
/** 강사 피드백이 이만큼 쌓이면 코드가 FOCUS 로 올린다(design-spec §7-4 "feedbackCount ≥ 3"). */
export const REPETITION_FOCUS_FEEDBACK = 3
/** 교정 채택 항목의 뜻 스냅샷 — 설명의 첫 문장 앞부분(L8 "explanationKo 앞부분"). */
export const CORRECTION_MEANING_MAX = 80

export type RepetitionRefType = 'TopicChunk' | 'Expr' | 'Grammar' | 'Correction' | 'WordEntry'

/** 화면 출처 3종(Leader 결정 ④ — refType 으로만, 주제명 없음). 모르는 refType 은 수업으로 본다. */
export type RepetitionSource = 'LESSON' | 'CORRECTION' | 'WORDS'
export function repetitionSourceOf(refType: string): RepetitionSource {
  if (refType === 'Correction') return 'CORRECTION'
  if (refType === 'WordEntry') return 'WORDS'
  return 'LESSON'
}

/** 피드백 누적·이전 우선순위로 정한 우선순위 — 코드 임계만 본다(강사 지정은 A11 이 따로 쓴다). */
export function priorityAfterFeedback(prev: RepetitionPriority | null | undefined, feedbackTotal: number): RepetitionPriority {
  return prev === 'FOCUS' || feedbackTotal >= REPETITION_FOCUS_FEEDBACK ? 'FOCUS' : 'NORMAL'
}

/** 교정 설명 → 뜻 스냅샷: 첫 문장(。．.!?！？ 앞)을 80자에서 자른다. 빈 설명이면 null. */
export function correctionMeaningSnap(explanation: string | null | undefined): string | null {
  const t = (explanation ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  const m = /^(.+?[。．.!?！？])(\s|$)/u.exec(t)
  return truncateCodePoints((m ? m[1] : t).trim(), CORRECTION_MEANING_MAX)
}

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
  /**
   * 이번 등록이 "공부"인가(기본 true). false 면 `studiedCount`·`lastStudiedAt` 을 바꾸지 않는다 — 교정 채택은 피드백만 기록한다
   * (design-spec §7-4 "레슨·세트는 학습 횟수, 교정은 피드백 횟수"). 새 항목이면 `studiedCount 0`·`lastStudiedAt null` 로 만든다.
   */
  studied?: boolean
}

export interface RegisteredItem {
  id: string
  refType: string
  refId: string
  created: boolean
  priority: RepetitionPriority
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
    if (!prev) out.set(k, { ...it, correct: nonNeg(it.correct), wrong: nonNeg(it.wrong), feedback: nonNeg(it.feedback), studied: it.studied !== false })
    else
      out.set(k, {
        ...prev,
        correct: nonNeg(prev.correct) + nonNeg(it.correct),
        wrong: nonNeg(prev.wrong) + nonNeg(it.wrong),
        feedback: nonNeg(prev.feedback) + nonNeg(it.feedback),
        studied: prev.studied !== false || it.studied !== false,
      })
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
    select: { id: true, refType: true, refId: true, intervalDays: true, priority: true, feedbackCount: true },
  })
  const byKey = new Map(existing.map((e) => [keyOf(e.refType, e.refId), e]))
  const out: RegisteredItem[] = []
  for (const m of merged) {
    const textJa = truncateCodePoints(m.textJa, 200)
    const meaningKo = m.meaningKo ? truncateCodePoints(m.meaningKo, 200) : null
    const feedback = nonNeg(m.feedback)
    const studied = m.studied !== false
    const prev = byKey.get(keyOf(m.refType, m.refId))
    if (prev) {
      const priority = priorityAfterFeedback(prev.priority, nonNeg(prev.feedbackCount) + feedback)
      const interval = clampInterval(prev.intervalDays, priority)
      await tx.repetitionItem.update({
        where: { id: prev.id },
        data: {
          textJa,
          meaningKo,
          ...(studied ? { studiedCount: { increment: 1 }, lastStudiedAt: now } : {}),
          correctCount: { increment: nonNeg(m.correct) },
          wrongCount: { increment: nonNeg(m.wrong) },
          ...(feedback ? { feedbackCount: { increment: feedback }, lastFeedbackAt: now } : {}),
          priority,
          intervalDays: interval,
          nextDueAt: dates.toDbDate(dates.addDays(today, interval)),
          decidedBy: 'FALLBACK',
        },
      })
      out.push({ id: prev.id, refType: m.refType, refId: m.refId, created: false, priority })
    } else {
      const priority = priorityAfterFeedback(null, feedback)
      const interval = clampInterval(REPETITION_INTERVAL_DEFAULT, priority)
      const row = await tx.repetitionItem.create({
        data: {
          userId,
          itemType: m.itemType,
          refType: m.refType.slice(0, 30),
          refId: m.refId.slice(0, 40),
          textJa,
          meaningKo,
          studiedCount: studied ? 1 : 0,
          lastStudiedAt: studied ? now : null,
          correctCount: nonNeg(m.correct),
          wrongCount: nonNeg(m.wrong),
          feedbackCount: feedback,
          lastFeedbackAt: feedback ? now : null,
          priority,
          intervalDays: interval,
          nextDueAt: dates.toDbDate(dates.addDays(today, interval)),
          decidedBy: 'FALLBACK',
        },
        select: { id: true },
      })
      out.push({ id: row.id, refType: m.refType, refId: m.refId, created: true, priority })
    }
  }
  return out
}

export interface StudiedItemInput {
  id: string
  correct?: number
  wrong?: number
}

/**
 * 복습 레슨 완료(#62 kind=REVIEW) — mixSpec 항목(이미 있는 행, 이 사용자 것만)의 `studiedCount+1`·정오답 증가·`lastStudiedAt`,
 * 다음 복습일은 등록 경로와 같은 규칙(기존 간격 클램프, `decidedBy=FALLBACK` — 뒤이은 A11 이 다시 정한다). 호출자 tx, 사용자 행 잠금 뒤.
 * 없는(남의·지워진) id 는 건너뛴다. 반환 = 실제로 갱신한 항목 id(입력 순서).
 */
export async function markRepetitionStudied(userId: string, items: readonly StudiedItemInput[], tx: Tx, opts: { today?: string; now?: Date } = {}): Promise<string[]> {
  const merged = new Map<string, { correct: number; wrong: number }>()
  for (const it of items) {
    const prev = merged.get(it.id) ?? { correct: 0, wrong: 0 }
    merged.set(it.id, { correct: prev.correct + nonNeg(it.correct), wrong: prev.wrong + nonNeg(it.wrong) })
  }
  if (!merged.size) return []
  const today = opts.today ?? dates.todayKst()
  const now = opts.now ?? new Date()
  const rows = await tx.repetitionItem.findMany({
    where: { userId, id: { in: [...merged.keys()] } },
    select: { id: true, intervalDays: true, priority: true, feedbackCount: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out: string[] = []
  for (const [id, t] of merged) {
    const prev = byId.get(id)
    if (!prev) continue
    const priority = priorityAfterFeedback(prev.priority, nonNeg(prev.feedbackCount))
    const interval = clampInterval(prev.intervalDays, priority)
    await tx.repetitionItem.update({
      where: { id },
      data: {
        studiedCount: { increment: 1 },
        correctCount: { increment: t.correct },
        wrongCount: { increment: t.wrong },
        lastStudiedAt: now,
        priority,
        intervalDays: interval,
        nextDueAt: dates.toDbDate(dates.addDays(today, interval)),
        decidedBy: 'FALLBACK',
      },
    })
    out.push(id)
  }
  return out
}
