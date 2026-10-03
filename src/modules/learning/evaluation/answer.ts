/**
 * 문항 답 저장(api-contract #67)·시작(#67b, 데모 결정 d=B)·글자로 보기(#67c) — 발화 연결은 speech 소유라 라우트가 한 트랜잭션에서 조합한다
 * (레슨 말하기 #62b 와 같은 모양): 평가 잠금(사용자 → 평가) → 문항 확인 → [speech: 발화 소유·미사용·10분 확인 + 연결] → 답 저장.
 *
 * - 객관식은 코드가 **즉시 채점해 저장**하지만 응답에는 점수·정답을 싣지 않는다(`graded` 만 — 데모 v1 "답해도 '저장했어요'만",
 *   task-008 정답 미노출 원칙). 점수·정답은 DONE 뒤 #66 에서만.
 * - 같은 문항 재답은 제출 전까지 덮어쓴다. 상태 READY·IN_PROGRESS 만(그 밖 409). 첫 답에서 READY → IN_PROGRESS + `startedAt`(10분 시계 시작).
 */
import type { InputSource } from '@prisma/client'
import { ApiError, prisma, withTransaction, type Tx } from '@/modules/infra'
import { answerConflict, evaluationNotFound, ITEM_SELECT, lockEvaluation, toEvaluationDto, type EvaluationDto, type EvaluationItemRow, type EvaluationRow } from './rows'
import { deadlineOf, gradeObjective, normalizeAnswer, SUBJECTIVE_ITEM_KINDS } from './scoring'
import { isEvaluationId, type AnswerInput } from './validate'

export interface EvaluationAnswerHandle {
  evaluation: EvaluationRow
  item: EvaluationItemRow
}

/** #67 쓰기용 잠금 — 사용자 행 → 평가 행. 없거나 남의 것·다른 평가의 문항 404, 상태가 READY·IN_PROGRESS 가 아니면 409. */
export async function lockEvaluationItemForAnswer(tx: Tx, userId: string, id: string, itemId: string): Promise<EvaluationAnswerHandle> {
  if (!isEvaluationId(id) || !isEvaluationId(itemId)) throw evaluationNotFound()
  const evaluation = await lockEvaluation(tx, userId, id)
  const item = await tx.evaluationItem.findFirst({ where: { id: itemId, evaluationId: id }, select: ITEM_SELECT })
  if (!item) throw new ApiError('NOT_FOUND', '문항을 찾을 수 없어요.')
  const conflict = answerConflict(evaluation.status)
  if (conflict) throw conflict
  return { evaluation, item }
}

/** 말하기 문항에만 발화를 붙일 수 있다(객관식에 utteranceId 400). 라우트가 연결 전에 부른다. */
export function assertAnswerTakesUtterance(h: EvaluationAnswerHandle): void {
  if (!SUBJECTIVE_ITEM_KINDS.has(h.item.kind)) throw new ApiError('VALIDATION', '이 문항은 음성으로 답할 수 없어요.', { field: 'utteranceId', reason: 'not_speaking_item' })
}

export interface EvaluationAnswerResult {
  id: string
  answered: true
  /** 코드가 채점을 끝냈는가(객관식) — 점수는 싣지 않는다. 서술형은 false(제출 뒤 강사가 채점). */
  graded: boolean
  expectedShown: false
  answerText: string | null
  answerOrder: number[] | null
  /** 틀린 곳 찾기에서 고른 조각 번호(조각 없이 적은 답·다른 문항은 null). */
  answerSpot: number | null
  inputSource: InputSource
  answeredAt: string
  evaluationStatus: 'IN_PROGRESS'
  startedAt: string
  deadlineAt: string
}

/**
 * 답 저장. `utteranceText` = 라우트가 연결한 발화의 최종 텍스트(말하기) — 있으면 본문 `answerText` 대신 그것을 채점 재료로 쓴다(L1: 실시간 STT
 * 최종 텍스트, `inputSource` 는 본문 값). 반환 DTO 에 점수·정답 없음.
 */
export async function saveEvaluationAnswer(tx: Tx, h: EvaluationAnswerHandle, input: AnswerInput, utteranceText: string | null = null, now = new Date()): Promise<EvaluationAnswerResult> {
  const stored = normalizeAnswer(h.item, { answerText: utteranceText ?? input.answerText, pieceOrder: input.pieceOrder, spotIndex: input.spotIndex })
  const score = gradeObjective(h.item, stored, h.item.maxScore)
  await tx.evaluationItem.update({ where: { id: h.item.id }, data: { answerText: stored, inputSource: input.inputSource, score, answeredAt: now } })
  let startedAt = h.evaluation.startedAt
  if (h.evaluation.status === 'READY') {
    startedAt = now
    await tx.evaluation.update({ where: { id: h.evaluation.id }, data: { status: 'IN_PROGRESS', startedAt } })
  }
  const dto = toEvaluationDto({ ...h.evaluation, status: 'IN_PROGRESS', startedAt }, [{ ...h.item, answerText: stored, inputSource: input.inputSource, answeredAt: now }])
  const item = dto.items[0]
  return {
    id: h.item.id,
    answered: true,
    graded: score !== null,
    expectedShown: false,
    answerText: item.answerText,
    answerOrder: item.answerOrder,
    answerSpot: item.answerSpot,
    inputSource: input.inputSource,
    answeredAt: now.toISOString(),
    evaluationStatus: 'IN_PROGRESS',
    startedAt: startedAt.toISOString(),
    deadlineAt: (deadlineOf(startedAt, true) as Date).toISOString(),
  }
}

/**
 * #67b 시작 — READY → IN_PROGRESS + `startedAt`(10분 시계). IN_PROGRESS 면 그대로(멱등). 그 밖 409.
 * **데모 결정 (d)=B(2026-10-01 사용자 승인)**: 화면이 준비 화면의 [시작하기]에서 부른다. #67 첫 답에서 시작하는 경로도 남아 있어
 * 두 경로가 함께 있어도 `startedAt` 은 처음 한 번만 정해진다.
 */
export async function startEvaluation(userId: string, id: string, now = new Date()): Promise<EvaluationDto> {
  return withTransaction(async (tx) => {
    const row = await lockEvaluation(tx, userId, id)
    const conflict = answerConflict(row.status)
    if (conflict) throw conflict
    let next = row
    if (row.status === 'READY') {
      await tx.evaluation.update({ where: { id }, data: { status: 'IN_PROGRESS', startedAt: now } })
      next = { ...row, status: 'IN_PROGRESS', startedAt: now }
    }
    const items = await tx.evaluationItem.findMany({ where: { evaluationId: id }, select: ITEM_SELECT })
    return toEvaluationDto(next, items, { now: now.getTime() })
  })
}

/** #67a 듣고 답하기 소리 — 들려줄 문장(서버만 안다). 소유자만(404), 문항이 있는 상태(READY 이후)만(409), 듣기 문항이 아니면 400. */
export async function getEvaluationListenSource(userId: string, id: string, itemId: string): Promise<{ text: string; topicId: string | null }> {
  if (!isEvaluationId(id) || !isEvaluationId(itemId)) throw evaluationNotFound()
  const ev = await prisma.evaluation.findFirst({ where: { id, userId }, select: { status: true, topicId: true } })
  if (!ev) throw evaluationNotFound()
  if (ev.status === 'GENERATING' || ev.status === 'FAILED') throw new ApiError('CONFLICT', '아직 풀 수 없는 평가예요.', { reason: 'NOT_READY', status: ev.status })
  const item = await prisma.evaluationItem.findFirst({ where: { id: itemId, evaluationId: id }, select: { kind: true, prompt: true } })
  if (!item) throw new ApiError('NOT_FOUND', '문항을 찾을 수 없어요.')
  if (item.kind !== 'LISTEN_RESPOND') throw new ApiError('VALIDATION', '듣고 답하기 문항이 아니에요.', { field: 'itemId', reason: 'not_listen_item' })
  const p = item.prompt as Record<string, unknown> | null
  const text = typeof p?.textJa === 'string' ? p.textJa : ''
  if (!text) throw new ApiError('CONFLICT', '들려줄 문장이 없어요.', { reason: 'NO_TEXT' })
  return { text, topicId: ev.topicId }
}

export interface EvaluationRevealResult {
  itemId: string
  textJa: string
  textRevealed: true
  /** 처음 공개한 시각 — 다시 불러도 바뀌지 않는다. */
  textRevealedAt: string
}

/**
 * 듣고 답하기 "글자로 보기"(데모 결정 b=B — 푸는 도중 선생님 목소리가 끊기거나 소리를 못 받았을 때 그 문항만) — 제출 전에 들려줄 문장을 주고
 * `EvaluationItem.textRevealedAt` 에 **처음 공개한 시각**을 남긴다(결과의 "글자로 봤어요"). 한 트랜잭션: 평가 잠금(사용자 → 평가) →
 * READY·IN_PROGRESS 만(그 밖 409 — DONE 이면 #66 이 이미 글자를 준다) → 문항(없으면 404) → 듣기 문항만(400) → 이미 공개했으면 그 시각 그대로(멱등).
 * 시계는 건드리지 않는다(시작은 #67b·#67). 소리를 못 들었는지는 서버가 알 수 없어 화면 조건을 믿지 않고 공개 사실만 남긴다.
 */
export async function revealEvaluationItemText(userId: string, id: string, itemId: string, now = new Date()): Promise<EvaluationRevealResult> {
  if (!isEvaluationId(id) || !isEvaluationId(itemId)) throw evaluationNotFound()
  return withTransaction((tx) => revealItemTextInTx(tx, userId, id, itemId, now))
}

/** `revealEvaluationItemText` 의 트랜잭션 본문(테스트가 가짜 tx 로 판정을 본다). */
export async function revealItemTextInTx(tx: Tx, userId: string, id: string, itemId: string, now: Date): Promise<EvaluationRevealResult> {
  const row = await lockEvaluation(tx, userId, id)
  const item = await tx.evaluationItem.findFirst({ where: { id: itemId, evaluationId: id }, select: { id: true, kind: true, prompt: true, textRevealedAt: true } })
  if (!item) throw new ApiError('NOT_FOUND', '문항을 찾을 수 없어요.')
  const conflict = answerConflict(row.status)
  if (conflict) throw conflict
  if (item.kind !== 'LISTEN_RESPOND') throw new ApiError('VALIDATION', '듣고 답하기 문항이 아니에요.', { field: 'itemId', reason: 'not_listen_item' })
  const p = item.prompt as Record<string, unknown> | null
  const textJa = typeof p?.textJa === 'string' ? p.textJa : ''
  if (!textJa) throw new ApiError('CONFLICT', '들려줄 문장이 없어요.', { reason: 'NO_TEXT' })
  let at = item.textRevealedAt
  if (!at) {
    at = now
    await tx.evaluationItem.update({ where: { id: item.id }, data: { textRevealedAt: at } })
  }
  return { itemId: item.id, textJa, textRevealed: true, textRevealedAt: at.toISOString() }
}
