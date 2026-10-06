/**
 * 상황 역할극(Scenario·ScenarioTopic, task-010d) — 공개 API. `learning/index.ts` 가 `export *` 로 다시 내보내므로 이름은 `scenario` 를 넣어 겹치지 않게 한다.
 * A1-서버(2026-10-06): 역할극 대화 시작 재료(#28 읽기 — Chat 행은 conversation)·종료 기록 트랜잭션·표현 판정(순수).
 * A3a(2026-10-07): 목록·상세·추천(코드 규칙)·내 상황 만들기/고치기/지우기(#161~#165) · 입력 정리(shape) · 화면 읽기(view).
 * AI 초안·대답 연습·라우트 가드 해제·`conversation/index.ts` 연결은 A3b.
 */
export {
  readScenarioExpressions,
  scenarioChunkIds,
  scenarioRequiredExpressions,
  scenarioExpressionForms,
  detectScenarioExpressions,
  normalizeScenarioVerdict,
  judgeScenarioCompletion,
  SCENARIO_EXPRESSION_MAX,
  SCENARIO_REQUIRED_DEFAULT,
} from './expressions'
export type { ScenarioExpression, ScenarioChunkRef, ScenarioVerdict, ScenarioOutcome, ScenarioJudgement } from './expressions'
export { resolveScenarioChatStart, scenarioNotFound, scenarioAccessWhere, linkedTopicsFor } from './start'
export type { ScenarioChatStartInput, ScenarioChatStart, ScenarioTopicSource, ScenarioStartDb } from './start'
// A3b(Leader 승인 additive): 역할극 진행 재료 읽기(첫마디·[상황] 헤더·진행 값·#29·종료 판정 공용)
export { readScenarioRolePlayMaterial, readScenarioDraftTopic } from './start'
export type { ScenarioRolePlayMaterial, ScenarioRolePlayRow, ScenarioMaterialDb } from './start'
export {
  endScenarioRolePlay,
  isScenarioRolePlayEnded,
  readScenarioRolePlayResult,
  endedScenarioRolePlayChatIds,
  scenarioEndLookupSince,
  SCENARIO_REPETITION_REF_TYPE,
  SCENARIO_UNJUDGED_CONFIDENCE,
  SCENARIO_DURATION_MAX_SEC,
  SCENARIO_END_LOOKUP_MARGIN_MS,
} from './end'
export type { ScenarioEndInput, ScenarioEndResult } from './end'
export {
  listScenarios,
  getScenarioDetail,
  createScenario,
  updateScenario,
  archiveScenario,
  parseScenarioListQuery,
  mergeScenarioFields,
  SCENARIO_CATALOG_MAX,
  SCENARIO_HISTORY_WINDOW_DAYS,
} from './catalog'
export type { ScenarioDeps, ScenarioListQuery, ScenarioReadOptions, OpenRolePlayChats } from './catalog'
export { recommendScenarios, recommendReasonOf, SCENARIO_RECOMMEND_MAX, SCENARIO_RECOMMEND_REASONS } from './recommend'
export type { RecommendCandidate, RecommendSignals, ScenarioRecommendation } from './recommend'
export { normalizeScenarioInput, cleanScenarioText, assignExpressionIds, isScenarioId, SCENARIO_LEVELS } from './shape'
export type { ScenarioFields, ScenarioExpressionInput, ScenarioInputMode } from './shape'
export { readScenarioRoles, readScenarioGoal, readScenarioSteps, readScenarioOpening, expressionView as scenarioExpressionView } from './view'
