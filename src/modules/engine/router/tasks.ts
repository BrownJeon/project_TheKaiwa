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
  /**
   * CLI 무응답 타임아웃을 1회 더 건다(총 2시도, 시도당 timeoutMs). 기본 꺼짐 — 사용자가 기다리는 지점(A1~A3·A4·A5 …)은
   * 두 배로 기다리게 하지 않는다. 백그라운드 판단 잡(A11)만 켠다(task-010b3).
   * 요청 데드라인(`timeoutMs`)은 **1회차 호출까지만** 적용된다 — 어댑터가 시도마다 `timeoutMs` 를 새로 쓰고 2차는 큐 꼬리로 재진입하므로
   * 유효 상한은 시도당(timeoutMs + SIGKILL 유예 5s) × 2 + 재시도 전 1s + 2차 큐 대기 ≈ A11 은 121~131s(+배치 큐 대기). 2차 뒤에는 데드라인이
   * 지나 ajv 계약 재시도·폴백 후보가 시작되지 않는다. `onTextDelta`(스트리밍) 호출과는 같이 쓸 수 없다.
   */
  retryOnTimeout?: boolean
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
  // 내 말 번역 다시 가져오기(task-026 S2, userTranslation@v1) — 사용자가 기다리는 단건이라 interactive·짧은 상한. 회화 턴과 같은 큐라 상한을 길게 두지 않는다.
  userTranslation: { tier: 'fast', timeoutMs: 15_000, lane: 'interactive' },
  reviewDecision: { tier: 'balanced', timeoutMs: 60_000, lane: 'batch', retryOnTimeout: true }, // A11 — 타임아웃 1회 재시도(task-010b3), 유효 상한 ≈121~131s(위 retryOnTimeout 주석)
  // A12 주제 새 단어(task-042) — 사용자가 [시작하기] 대기 화면에서 기다리는 동기 호출. 큐 대기를 포함한 벽시계 30초는 호출자(learning.vocab)가 따로 건다.
  topicWords: { tier: 'fast', timeoutMs: 20_000, lane: 'interactive' },
  // 상황 역할극 종료 판정(task-010d, scenarioVerdict@v1) — 학습자가 [마치기] 뒤 결과를 기다리는 단건. 재시도 없음(실패·시간 초과면 판정 없이 코드 규칙만으로 기록).
  scenarioVerdict: { tier: 'fast', timeoutMs: 20_000, lane: 'interactive' },
} as const satisfies Record<string, TaskSpec>

export type LlmTask = keyof typeof LLM_TASKS

/** task 표 → 어댑터 재시도 옵션. 켠 task 만 `{ maxAttempts: 2, retryOnTimeout: true }`, 나머지는 시도 1회(재시도는 JSON 계약·router 폴백이 맡는다). */
export function adapterRetryOptions(task: LlmTask): { maxAttempts: number; retryOnTimeout?: true } {
  const spec: TaskSpec = LLM_TASKS[task]
  return spec.retryOnTimeout ? { maxAttempts: 2, retryOnTimeout: true } : { maxAttempts: 1 }
}

export function isLlmTask(task: string): task is LlmTask {
  return Object.prototype.hasOwnProperty.call(LLM_TASKS, task)
}
