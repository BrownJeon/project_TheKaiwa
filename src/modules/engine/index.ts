/**
 * L5 Engine Management — 역할 파사드만 export 한다(어댑터는 export 하지 않는다). 정본 module-dependency L5.
 * Phase 1(task-004): llm 파사드·router·json. task-006: trace 최소판(newTraceId·recordTrace).
 * task-005b: registry(Provider·스키마)·connections·fallbackPolicy 읽기·health·functionalTest·configuration/resolver(8층, 읽기 전용)·trace 조회.
 * task-003d: tts 파사드(targets·synthesize·maxChars, 오류는 TtsEngineError.kind 로 분류).
 */
export * as llm from './llm'
export * as tts from './tts'
export type { TtsTarget, TtsFailureKind, TtsSegmentInput, TtsSynthOutput, TtsVoiceRef, TtsLexiconHint, TtsSynthMetrics } from './tts'
export type { LlmRequest, LlmJsonRequest, LlmTextResult, LlmJsonResult, LlmPersona, LlmTurnMessage } from './llm'
export { resolveConnection, resolveCandidates, withFallback, currentEnvironment, clearRouterCache, NoEngineAvailableError, LLM_TASKS, isLlmTask } from './router'
export type { LlmTask, LlmTier, ResolvedConnection } from './router'
export { extractJson } from './json/extractJson'
export { validateOutput as validateAgainstSchema, JSON_ONLY_INSTRUCTION } from './json/schemaValidate'
export { newTraceId, recordTrace } from './trace'
export type { TraceStep, TraceRecord } from './trace'
export { listTraces, getTrace, turnStats24h } from './trace'
export type { TraceFilter } from './trace'
export { pluginStates, getProvider, getConfigurationSchema, listEngines, defaultConfiguration, checkValue } from './registry'
export type { ConfigurationSchema, EngineDescriptor, EngineProvider, SchemaKey, HealthOutcome, HealthDetail, EngineListItem } from './registry'
export { listConnections, getConnection, fallbackRolesByConnection, latestVersions, configActivity } from './connections'
export type { EngineConnectionRow, ConnectionFilter, FallbackRoles } from './connections'
export { listFallbackPolicies, getFallbackPolicy } from './fallbackPolicy'
export type { FallbackPolicyView } from './fallbackPolicy'
export { resolveEffective, effectiveValues, ConfigTargetNotFoundError, UnsupportedScopeError, SOURCE_ORDER } from './configuration/resolver'
export type { EffectiveConfiguration, EffectiveKey, ConfigSourceName } from './configuration/resolver'
export { runHealthCheck, listHealth, recentHealth, ConnectionNotFoundError, CrossEnvironmentError } from './health'
export type { HealthRunResult } from './health'
export { runFunctionalTest, FunctionalTestRateLimitedError, FUNCTIONAL_TEST_INTERVAL_MS } from './functionalTest'
