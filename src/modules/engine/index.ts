/**
 * L5 Engine Management — 역할 파사드만 export 한다(어댑터는 export 하지 않는다). 정본 module-dependency L5.
 * Phase 1(task-004): llm 파사드·router·json. task-006: trace 최소판(newTraceId·recordTrace). registry·connections·health·configuration 은 task-005b 이후.
 */
export * as llm from './llm'
export type { LlmRequest, LlmJsonRequest, LlmTextResult, LlmJsonResult, LlmPersona, LlmTurnMessage } from './llm'
export { resolveConnection, resolveCandidates, withFallback, currentEnvironment, clearRouterCache, NoEngineAvailableError, LLM_TASKS, isLlmTask } from './router'
export type { LlmTask, LlmTier, ResolvedConnection } from './router'
export { extractJson } from './json/extractJson'
export { validateOutput as validateAgainstSchema, JSON_ONLY_INSTRUCTION } from './json/schemaValidate'
export { newTraceId, recordTrace } from './trace'
export type { TraceStep, TraceRecord } from './trace'
