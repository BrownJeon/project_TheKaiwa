/**
 * L0 조합 모듈(app 층) — console·configuration(editor·diff·versions·rollback·presets·export/import·overrides)·diagnostics·playground·audit·permissions. 모든 층 import 가능. Phase 1 = task-005b.
 * task-003g: speech/lexicon(발음 사전 관리 — 권한·PRODUCTION 확인·감사 + speech 저장소 조합).
 *
 * 이 파일이 모듈의 **유일한 공개 API** 다 — 다른 층·모듈은 `@/modules/admin` 만 import 한다(eslint no-restricted-imports).
 * 정본: docs/design/module-dependency.md
 *
 * 라우트(`/api/admin/v1/*`)는 첫 줄에서 `requireCapability`, `(admin)` 서버 컴포넌트는 렌더 전에 `requireConsolePage` 를 부른다.
 */
import type { MeCapabilitiesDto } from '@/types/admin'
import { can } from './permissions/can'
import type { AdminActor } from './permissions/guard'

export { getHealthSummary, healthHttpStatus } from './health'

// 권한(role-permission.md §5)
export { CAPABILITIES, ROLE_CAPABILITIES, ROLES, isCapability, isRole } from './permissions/matrix'
export { can, capabilitiesOf, derivesConsoleAccess } from './permissions/can'
export type { CanContext, CanResult } from './permissions/can'
export {
  requireCapability,
  assertCapability,
  hasCapability,
  viewEnvironment,
  hiddenNotFound,
  getConsoleAccess,
  requireConsolePage,
  userCan,
} from './permissions/guard'
export type { AdminActor } from './permissions/guard'

// 콘솔 메뉴·대시보드·환경
export { ADMIN_MENU, menuFor } from './console/menu'
export { getOverview, getEnvironmentInfo } from './console/overview'

// Engine·Connection·Health·Secret·Plugin
export {
  listEngineConnections,
  getEngineConnectionDetail,
  runConnectionHealth,
  runConnectionFunctionalTest,
  listConnectionHealth,
  listFallbackPolicyDtos,
  getFallbackPolicyDto,
  listSecretRefs,
  listEngineDtos,
  listPluginDtos,
  getPluginDto,
  getSchemaDto,
  parseEngineRole,
  parseEngineStatus,
  parseHealthKind,
  parseEngineId,
  roleParam,
} from './engines'

// Configuration · Diagnostics · Voices
export { getEffectiveConfig } from './configuration/effective'
// 설정 편집·버전·Rollback·감사(task-012c)
export {
  validateConfig,
  diffConfig,
  testConfig,
  applyConfig,
  getRawConfig,
  putRawConfig,
  updateConnectionForm,
  setConnectionEnabled,
  setConnectionCredential,
  updateFallbackPolicy,
  getAppSettingDto,
  putAppSetting,
  commitEdit,
  parseScope,
  parseBaseVersion,
  parseRawJson,
  PRODUCTION_CONFIRM,
  TEST_RESULT_TTL_MS,
} from './configuration/editor'
export { listConfigVersions, getConfigVersion, rollbackConfigVersion, listAuditLogs } from './configuration/history'
export { listTraceDtos, getTraceDto } from './diagnostics/traces'
export type { TraceQuery } from './diagnostics/traces'
export { listVoiceDtos, getVoiceDto } from './voices'

// 발음 사전(task-003g, api-contract §7-2)
export {
  listLexiconDtos,
  getLexiconEntryDto,
  createLexiconEntry,
  updateLexiconEntry,
  disableLexiconEntry,
  importLexicon,
  exportLexiconFile,
  previewLexiconDto,
  previewLexiconWav,
  listLexiconVersionDtos,
  getLexiconVersionDto,
  rollbackLexicon,
  readWriteMeta,
  authorizeLexiconWrite,
  lexiconAuditTarget,
} from './speech/lexicon'
export type { LexiconExportFile, LexiconWriteMeta } from './speech/lexicon'

/** #137b — UI 숨김 용도일 뿐, 서버는 매 요청 재검사. */
export function meCapabilities(actor: AdminActor): MeCapabilitiesDto {
  return {
    role: actor.role,
    environment: actor.environment,
    capabilities: actor.capabilities,
    productionApplyAllowed: can(actor.role, 'config.apply.production').allowed,
  }
}
