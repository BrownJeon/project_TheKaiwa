/**
 * AI 지점(task) → tier·상한·레인 표(design-spec §8 A1~A11). **모델명은 여기 없다** — tier 를 모델로 바꾸는 것은
 * connection 의 `runtime.modelByTier`(DB) 다. 그래서 관리자가 콘솔에서 tier→모델을 바꿔도 코드는 그대로다.
 */
export type LlmTier = 'fast' | 'balanced' | 'deep'
export type LlmLane = 'interactive' | 'batch'

export interface TaskSpec {
  tier: LlmTier
  timeoutMs: number
  lane: LlmLane
}

export const LLM_TASKS = {
  talk: { tier: 'fast', timeoutMs: 12_000, lane: 'interactive' }, // A1 — 12s fail-fast
  chat: { tier: 'fast', timeoutMs: 20_000, lane: 'interactive' }, // A2
  chatReview: { tier: 'balanced', timeoutMs: 90_000, lane: 'interactive' }, // A3
  lesson: { tier: 'balanced', timeoutMs: 120_000, lane: 'batch' }, // A4
  reviewMix: { tier: 'balanced', timeoutMs: 120_000, lane: 'batch' }, // A5
  evalGen: { tier: 'balanced', timeoutMs: 60_000, lane: 'batch' }, // A6
  evalGrade: { tier: 'balanced', timeoutMs: 120_000, lane: 'batch' }, // A7
  planAnalysis: { tier: 'deep', timeoutMs: 300_000, lane: 'batch' }, // A8
  ask: { tier: 'balanced', timeoutMs: 120_000, lane: 'interactive' }, // A9
  wordEnrich: { tier: 'fast', timeoutMs: 20_000, lane: 'interactive' }, // A10
  reviewDecision: { tier: 'balanced', timeoutMs: 60_000, lane: 'batch' }, // A11
} as const satisfies Record<string, TaskSpec>

export type LlmTask = keyof typeof LLM_TASKS

export function isLlmTask(task: string): task is LlmTask {
  return Object.prototype.hasOwnProperty.call(LLM_TASKS, task)
}
