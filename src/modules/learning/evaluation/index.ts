/**
 * AI 평가(Evaluation) — api-contract #65~#69·#67a·#67b(task-011). 트랜잭션 구조·잠금 순서는 `rows.ts`·`grade.ts` 머리말.
 * A6·A7 요청은 라우트가 conversation 으로 만들어 값(출제)·함수(채점)로 넘긴다 — 이 모듈은 conversation·speech 를 import 하지 않는다.
 */
export { parseCreateEvaluationBody, parseAnswerBody, parseEvaluationListQuery, isEvaluationId, EVAL_ANSWER_TEXT_MAX } from './validate'
export type { CreateEvaluationInput, AnswerInput, EvaluationListQuery } from './validate'
export { loadEvaluationMaterials, pickEvalMaterials, EVAL_MATERIALS_MAX, EVAL_MATERIAL_MIN, EVAL_RECENT_DAYS } from './materials'
export type { EvaluationMaterials, EvalMaterialWord, RecentEvalItem } from './materials'
export { createEvaluation, buildItemRows, settleEvalGenerating } from './generate'
export type { EvaluationGeneration, EvalGenOutputLike, EvalGenItemLike, CreateEvaluationResult } from './generate'
export { lockEvaluationItemForAnswer, assertAnswerTakesUtterance, saveEvaluationAnswer, startEvaluation, getEvaluationListenSource, revealEvaluationItemText } from './answer'
export type { EvaluationAnswerHandle, EvaluationAnswerResult, EvaluationRevealResult } from './answer'
export { submitEvaluation, gradingMaterials, mergeGrades, findLevelUpCandidate } from './grade'
export type { EvaluationGrading, EvalGradeMaterials, EvalGradeOutputLike, FinalizedEvalGrade, LevelUpCandidate, SubmitEvaluationResult, EvalSubjectiveKind } from './grade'
export { getEvaluation, listEvaluations } from './read'
export type { EvaluationListItem } from './read'
export type { EvaluationDto, EvaluationItemDto, EvaluationResultDto } from './rows'
export { EVAL_TIME_LIMIT_SEC, EVAL_LEVEL_UP_SCORE, gradeOf, computeTotal, levelUpBasis } from './scoring'
export type { EvalGrade, EvalRubricScores, LevelUpBasis } from './scoring'
