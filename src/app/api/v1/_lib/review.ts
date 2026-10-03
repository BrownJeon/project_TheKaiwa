/**
 * 라우트 조합 헬퍼(task-010b) — 반복 학습의 L2(conversation: 프롬프트·후검증)와 L3(learning: 재료·잡·저장)를 잇는다. learning 은 conversation 을
 * import 하지 않으므로(module-dependency §3 판독 규칙 1·§4-4) A11 은 함수 묶음(`ReviewDecisionDriver`)으로, A5 는 요청 값으로 넘긴다.
 * 교정 관측 훅도 여기서 만든다(Correction 은 L2, 관측은 L3 — 같은 트랜잭션).
 */
import { ApiError, dates } from '@/modules/infra'
import {
  buildLearnerHeader,
  buildReviewDecisionRequest,
  buildReviewMixRequest,
  normalizeReviewDecision,
  REVIEW_DECISION_PROMPT_VERSION,
  REVIEW_MIX_PROMPT_VERSION,
  ReviewMixInputError,
  type ReviewDecisionResponse,
  type TurnHooks,
  type ReviewHooks,
} from '@/modules/conversation'
import { recordCorrectionsProposed, type LessonGeneration, type ReviewDecisionDriver, type ReviewMixMaterials } from '@/modules/learning'

/** A11 — 학습자 헤더·요청(conversation) → learning 잡이 `llm.completeJson` → 후검증(`normalizeReviewDecision`, 후보 1:1). */
export function reviewDecisionDriver(userId: string): ReviewDecisionDriver<ReviewDecisionResponse> {
  return {
    promptVersion: REVIEW_DECISION_PROMPT_VERSION,
    async build(m) {
      const learner = await buildLearnerHeader(userId, null)
      const request = buildReviewDecisionRequest({
        todayKst: m.todayKst,
        learner,
        candidates: m.candidates.map((c) => ({
          itemId: c.itemId,
          itemType: c.itemType,
          textJa: c.textJa,
          meaningKo: c.meaningKo,
          studiedCount: c.studiedCount,
          correctCount: c.correctCount,
          wrongCount: c.wrongCount,
          feedbackCount: c.feedbackCount,
          lastStudiedAt: c.lastStudiedAt,
          intervalDays: c.intervalDays,
          priority: c.priority,
        })),
        observationSummary: m.observationSummary,
        errorStats: m.errorStats,
      })
      return { request, keptItemIds: request.keptItemIds }
    },
    finalize(kept, data) {
      const n = normalizeReviewDecision({ candidates: kept.map((c) => ({ itemId: c.itemId, intervalDays: c.intervalDays, priority: c.priority })) }, data)
      const pool = new Set(kept.map((c) => c.itemId))
      const byTutor = new Set(data.decisions.filter((d) => pool.has(d.itemId)).map((d) => d.itemId))
      return {
        decisions: n.decisions.map((d) => ({ itemId: d.itemId, intervalDays: d.nextIntervalDays, priority: d.priority, reasonKo: d.reason_ko, byTutor: byTutor.has(d.itemId) })),
        rationaleKo: n.rationale_ko,
        counts: n.counts,
      }
    },
  }
}

/** A5 — mixSpec 재료 → `buildReviewMixRequest`(A4 스키마·후검증 재사용, `chunks ⊆ mixSpec`). 재료가 비면 409 `EMPTY`. */
export async function reviewMixGeneration(userId: string, m: ReviewMixMaterials): Promise<LessonGeneration> {
  const learner = await buildLearnerHeader(userId, m.level)
  try {
    const request = buildReviewMixRequest({
      todayKst: m.todayKst || dates.todayKst(),
      learner,
      level: m.level,
      items: m.items.map((i) => ({ id: i.id, chunkType: i.chunkType, textJa: i.textJa, reading: i.reading, meaningKo: i.meaningKo ?? '' })),
      mixNoteKo: null,
    })
    return {
      request,
      promptVersion: REVIEW_MIX_PROMPT_VERSION,
      inputMeta: { items: m.items.length, kept: request.allowedChunkIds.length, skippedItems: request.skippedItems, withReading: m.items.filter((i) => i.reading).length },
    }
  } catch (e) {
    if (e instanceof ReviewMixInputError) throw new ApiError('CONFLICT', '복습할 항목이 없어요.', { reason: 'EMPTY' })
    throw e
  }
}

/** 턴 저장 트랜잭션의 교정 제안 관측(#32). */
export function correctionProposedHook(userId: string): NonNullable<TurnHooks['recordCorrectionProposed']> {
  return async (tx, r) => {
    await recordCorrectionsProposed(userId, [{ id: r.correctionId, errorType: r.errorType, severity: r.severity, inputSource: r.inputSource }], tx)
  }
}

/** 표현 점검(A3, #33) 저장 트랜잭션의 교정 제안 관측. */
export function reviewCorrectionHooks(userId: string): ReviewHooks {
  return {
    recordCorrectionsProposed: async (tx, rows) => {
      await recordCorrectionsProposed(userId, rows.map((r) => ({ id: r.correctionId, errorType: r.errorType, severity: r.severity })), tx)
    },
  }
}
