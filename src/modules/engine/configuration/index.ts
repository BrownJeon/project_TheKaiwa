/**
 * engine/configuration 공개 면(task-012c) — Effective(8층 읽기)·편집 키 정책·Validate·Diff·버전 기록·Rollback 재검증.
 * 대상 행 물화는 소유 층(engine connections·fallbackPolicy / preferences AppSetting)이, 트랜잭션·감사 조합은 admin(L0)이 한다.
 */
export { resolveEffective, resolveConnectionCandidate, effectiveValues, ConfigTargetNotFoundError, UnsupportedScopeError, SOURCE_ORDER } from './resolver'
export type { EffectiveConfiguration, EffectiveKey, ConfigSourceName } from './resolver'
export { connectionKeyDefs, FALLBACK_KEY_DEFS, verifiabilityOf, newFallbackIds, lockMessage, lockRule, lockBlockedCode } from './keys'
export type { EditKeyDef, LockReason, Verifiable, EditVerify, ValidationRuleName } from './keys'
export { APP_SETTING_SCHEMA, appSettingKeyDefs, isKnownAppSetting, isPolicyAppSetting, PREVIEW_TEXT_KEY, PREVIEW_TEXT_VERSION_KEY, DEFAULT_VOICE_KEY, REVIEW_THRESHOLD_KEY, PREVIEW_TEXT_MAX } from './appSettingSchema'
export { validatePatch, checkEditValue, checkSecretRefValue, sameValue, stableStringify, suggestKey } from './validate'
export type { ValidationIssue, ValidationResult, ValidationStage, ValidationWarning, ValidateHooks } from './validate'
export { buildDiff, hashCandidate, isApplyBlocking } from './diff'
export type { ConfigDiff, DiffChange, DiffBlocked, DiffBlockedCode, KeySource, BuildDiffInput } from './diff'
export {
  flattenObject,
  isPlainObject,
  connectionManaged,
  connectionFlat,
  applyConnectionPatch,
  connectionSnapshot,
  connectionFromSnapshot,
  fallbackManaged,
  fallbackFlat,
  applyFallbackPatch,
  fallbackSnapshot,
  fallbackFromSnapshot,
  snapshotMeta,
} from './shapes'
export type { VersionOrigin, VersionMeta, ConnectionManaged, FallbackManaged, SnapshotParse } from './shapes'
export { activeVersion, currentVersionNumber, ensureBaseline, writeVersion, findVersion, previousOf, listVersionRows, activeVersionNumbers } from './versions'
export type { VersionTarget, NewVersionInput, VersionListFilter } from './versions'
export { planRestore, snapshotIntegrity, snapshotValueIssues, fillAbsentDefaults } from './rollback'
export type { Integrity, IntegrityResult, RestorePlan } from './rollback'
