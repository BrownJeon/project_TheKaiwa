/**
 * L4 `speech/analysis`(task-012b 음성 P2) — 분석 STT 잡 적재 게이트·claim(고아 회수·SKIP LOCKED·환경 필터·하트비트)·실패 백오프·결과 반영·
 * `requiresReview` 판정·평가 채점 텍스트 선택. 비교기(similarity·flags) 자체는 Python worker(`speech/worker`)다. 엔진명을 모른다.
 */
export { claimAnalysisJobs, reportJobFailure, jobUserScope } from './jobs'
export type { ClaimedJob, FailureResult } from './jobs'
export { applyAnalysisResult, REVIEW_THRESHOLD_SETTING } from './apply'
export type { AnalysisApplyResult } from './apply'
export { analysisEnqueueFor } from './enqueue'
export type { AnalysisEnqueue } from './enqueue'
export { isAnalysisWorkerAlive, recordWorkerHeartbeat } from './heartbeat'
export { pickGradingTexts } from './grading'
export type { GradingText } from './grading'
export { parseClaimBody, parseFailureBody, parseAnalysisBody, JOB_ID_RE } from './validate'
export type { ClaimInput, FailureInput, AnalysisInput } from './validate'
export { reviewThreshold, judgeReview, wasReviewTarget, pickGradingText, WORKER_ALIVE_WINDOW_MS } from './policy'
