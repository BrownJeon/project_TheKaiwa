/**
 * 시드 사용자별 관리(task-045 T1, 표 `UserSeedOverride`) 공개 API. 계약 `docs/design/topic-scenario-manager.md` §1·§2·§4.
 * learning 안의 다른 하위 모듈(topics·scenarios·challenges·lessons·vocab)은 순환 import 를 피하려고 이 index 가 아니라
 * `../seedOverride/visibility`·`../seedOverride/store` 를 직접 import 한다(ops 가 scenarios/catalog 를 import 하기 때문).
 */
export { hideSeed, forkSeedScenario, forkSeedTopic, restoreSeed, parseSeedRefBody, topicRemovalUnavailable, defaultSeedOverrideDeps } from './ops'
export type { SeedOverrideDeps, TopicRemovalPort } from './ops'
export {
  hiddenSeedIds, visibleSeedWhere, visibleRowsWhere, isSeedVisibleFor, resolvePlaceTopicIds, resolvePlaceTopicId, loadSeedVisibility, placeTopicId, seedTopicOfCopy, mapPlaceLinks,
} from './visibility'
export type { SeedVisibility } from './visibility'
export { planRestoreRelink, loadRestoreRelinkPlan, applyRestoreRelink } from './relink'
export type { RestoreRelinkPlan, ScenarioTopicLink } from './relink'
export { listSeedOverrides, detachCopy, isSeedKind, readOverride, SEED_OVERRIDE_LIST_MAX } from './store'
export { listSeedOverrideItems } from './items'
// task-045 T3 — 주제 삭제(#172 사전 조회 · #173 삭제 · #176 포트 구현). 본체는 topics/remove.ts.
export { previewTopicRemoval, removeUserTopic, removeUserTopicTx, makeTopicRemovalPort, parseTopicRemovalAck } from './topicRemoval'
export type { TopicRemovalServiceDeps } from './topicRemoval'
export type { OverrideRow, OverrideReading } from './store'
export { normalizeTopicInput } from './topicInput'
export type { TopicFieldProblem } from './topicInput'
