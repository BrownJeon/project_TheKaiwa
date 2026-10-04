/**
 * L5 Engine Management — 역할 파사드만 export 한다(어댑터는 export 하지 않는다). 정본 module-dependency L5.
 * Phase 1(task-004): llm 파사드·router·json. task-006: trace 최소판(newTraceId·recordTrace).
 * task-005b: registry(Provider·스키마)·connections·fallbackPolicy 읽기·health·functionalTest·configuration/resolver(8층, 읽기 전용)·trace 조회.
 * task-003d: tts 파사드(targets·synthesize·maxChars, 오류는 TtsEngineError.kind 로 분류).
 * task-003e: stt 파사드(REALTIME_STT targets·공개 실행값·개발용 ws 주소·connection 검증).
 * task-007: llm.prewarm(예열 CLI)·onTextDelta(조기 추출)·mentionsEngineIdentity, 경로 인식 증분 JSON 리더, trace appendTraceSteps.
 * task-003g: tts.g2p(발음 사전 미리듣기 읽기 확인).
 * task-012c(1단계 게이트): credentials(ref 허용 목록 판정)·연결 주소 허용 목록(vetConnectionUrl)·Functional Test 슬롯 원자화.
 */
export * as llm from './llm'
export * as tts from './tts'
export * as stt from './stt'
export type { SttTarget, SttPublicRuntime } from './stt'
// task-026 S1: 텍스트 분석(형태소별 표기·읽기) — 레지스트리 밖 내부 서비스 어댑터 하나.
export * as text from './text'
export type { TextSegment, TextBoundary, TextFailureKind } from './text'
export type { TtsTarget, TtsFailureKind, TtsSegmentInput, TtsSynthOutput, TtsVoiceRef, TtsLexiconHint, TtsSynthMetrics, TtsG2pOutput } from './tts'
export type { LlmRequest, LlmJsonRequest, LlmExtraCheckInfo, LlmTextResult, LlmJsonResult, LlmPersona, LlmTurnMessage, WarmUse } from './llm'
export { resolveConnection, resolveCandidates, withFallback, currentEnvironment, clearRouterCache, NoEngineAvailableError, LLM_TASKS, isLlmTask } from './router'
export type { LlmTask, LlmTier, ResolvedConnection } from './router'
export { extractJson } from './json/extractJson'
export { createJsonPathStreamReader } from './json/jsonPathStream'
export type { JsonPathWatch, JsonPathStreamReader } from './json/jsonPathStream'
export { validateOutput as validateAgainstSchema, JSON_ONLY_INSTRUCTION } from './json/schemaValidate'
export { newTraceId, recordTrace, appendTraceSteps } from './trace'
export type { TraceStep, TraceRecord } from './trace'
export { listTraces, getTrace, turnStats24h } from './trace'
export type { TraceFilter } from './trace'
export { pluginStates, getProvider, getConfigurationSchema, listEngines, defaultConfiguration, checkValue } from './registry'
export type { ConfigurationSchema, EngineDescriptor, EngineProvider, SchemaKey, HealthOutcome, HealthDetail, EngineListItem } from './registry'
export { listConnections, getConnection, fallbackRolesByConnection, latestVersions, configActivity, lockConnectionForUpdate, lockConnectionsForUpdate, writeConnectionConfig, enabledPoliciesUsingAsPrimary } from './connections'
export type { EngineConnectionRow, ConnectionFilter, FallbackRoles, ConnectionConfigWrite } from './connections'
export { listFallbackPolicies, getFallbackPolicy, getFallbackPolicyById, lockFallbackPolicyForUpdate, lockFallbackPoliciesForUpdate, writeFallbackPolicy, connectionsByIds } from './fallbackPolicy'
export type { FallbackPolicyView } from './fallbackPolicy'
export * from './configuration'
export { runHealthCheck, listHealth, recentHealth, ConnectionNotFoundError, CrossEnvironmentError } from './health'
export type { HealthRunResult } from './health'
export { runFunctionalTest, claimFunctionalSlot, FunctionalTestRateLimitedError, FUNCTIONAL_TEST_INTERVAL_MS, runConfigConnectionTest, recordConfigTestResult, findConfigTestResult } from './functionalTest'
export type { ConnectionCandidate, ConfigConnectionTestInput, ConfigConnectionTestResult } from './functionalTest'
export type { ConfigTestMark } from './registry/types'
export { allowedRefsFor, checkConnectionCredentialRef, checkCredentialRef } from './credentials'
export type { CredentialRefCheck, CredentialRefProblem } from './credentials'
// 연결 주소 허용 목록(D-C3(c)) — 어댑터가 아니라 정책 함수다. env 이름(엔진명 포함)이 adapters/common 에만 있도록 그 자리에 둔다.
export { vetConnectionUrl, trustedServiceOrigins } from './adapters/common/targetPolicy'

import { clearRouterCache as clearRouter } from './router'
import { clearSttTargetCache } from './stt'
import { clearTargetCache as clearTtsTargets } from './tts'

/** 관리자 설정 적용 커밋 직후(task-012c D-C7) — 이 프로세스의 Router·음성 대상 캐시를 비운다. 다른 프로세스는 기존 TTL(30초·5초)로 따라온다. */
export function clearConfigCaches(): void {
  clearRouter()
  clearTtsTargets()
  clearSttTargetCache()
}
