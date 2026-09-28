import { ApiError, dates, ok, rateLimit, readJsonObject, requireSession, withApi, withTransaction } from '@/modules/infra'
import {
  buildEvalGradeRequest,
  clampRubric,
  createLevelProposal,
  EVAL_GRADE_PROMPT_VERSION,
  finalizeEvalGradeItems,
  type EvalGradeInput,
  type EvalGradeResponse,
} from '@/modules/conversation'
import { submitEvaluation, type EvaluationGrading } from '@/modules/learning'
import { pickGradingTexts } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const NEXT_FOCUS_MAX = 3

function gradingFor(userId: string): EvaluationGrading<EvalGradeResponse> {
  return {
    promptVersion: EVAL_GRADE_PROMPT_VERSION,
    // learning 재료는 A6 가 스키마로 검증해 저장한 prompt·expected 를 그대로 싣는다 — 모양은 같고 타입만 층 경계에서 좁힌다.
    build: (m) => buildEvalGradeRequest(m as unknown as EvalGradeInput),
    finalize: (data, allowedOrders) => ({
      items: finalizeEvalGradeItems({ allowedOrders }, data).map((g) => ({ order: g.order, score: g.score, feedback: g.feedback_ko })),
      rubric: clampRubric(data.rubric),
      comment: data.comment_ko.trim(),
      nextFocus: data.next_focus.map((f) => f.trim()).filter(Boolean).slice(0, NEXT_FOCUS_MAX),
    }),
    onLevelUp: async (c) => {
      await withTransaction((tx) =>
        createLevelProposal(
          userId,
          {
            fromLevel: c.fromLevel,
            toLevel: c.toLevel,
            evaluationId: c.evaluationId,
            basis: c.basis.map((b) => ({ evaluationId: b.id, kind: b.kind, totalScore: b.totalScore ?? 0, date: dates.todayKst(b.completedAt ?? new Date()) })),
          },
          tx,
        ),
      )
    },
    // task-012b D-B7: 말하기 문항 채점 텍스트는 speech 가 고른다(확정 텍스트 > 재확인 불필요한 분석 텍스트 > 저장된 답) — learning 은 speech 를 모른다.
    speechAnswers: (items) => pickGradingTexts(userId, items),
  }
}

/**
 * #68 제출·채점(A7 잡 120s) — 본문 `{}`. 객관식 재채점(미답 0) → GRADING → 채점 잡. 채점 잡의 마지막 단계는 **단일 트랜잭션**
 * `Evaluation DONE + StudyLog(EVALUATION, DIRECT) + StatsSnapshot(EVALUATION) + DAILY(evals+1)`, 실패하면 GRADING 에 남는다(다시 제출 = 새 잡,
 * 채점 중 다시 제출 = 같은 잡 `reused:true`). 총점은 코드가 `round(Σscore/Σmax×100)`(LLM total 무시). 10분 넘은 제출도 받는다(`overtime` 표시).
 * 트랜잭션 뒤 가장 최근 DONE 두 건이 같은 레벨 ≥90 이면 SET_LEVEL 제안(conversation) — 채택해야 Profile.level 이 바뀐다.
 * 음성으로 답한 서술형은 채점 잡 시작 시점에 speech 가 텍스트를 다시 고른다(task-012b D-B7 — 분석을 기다리지 않음, 고른 텍스트·inputSource 는 채점 트랜잭션에 남는다).
 * 응답 `{evaluationId, jobId, status:'GRADING', reused, overtime}`. DONE 409 ALREADY_DONE, 출제 전·실패 409 NOT_READY. 사용자당 분당 10.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  rateLimit(`eval-submit:${userId}`, 10)
  const body = await readJsonObject(req, 1024)
  const extra = Object.keys(body)
  if (extra.length) throw new ApiError('VALIDATION', `넣을 수 없는 항목입니다: ${extra.join(', ')}`, { field: extra[0], reason: 'unknown_key' })
  return ok(await submitEvaluation(userId, id, gradingFor(userId)))
})
