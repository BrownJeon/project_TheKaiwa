/**
 * Admin Console API 응답 DTO(task-005b, api-contract §1-3·§2-19~§2-27) — 서버(`/api/admin/v1/*`)와 화면(`(admin)`·`components/admin`)이 공유한다.
 * 컴포넌트는 `@/modules/admin` 을 import 할 수 없으므로(eslint 경계) 타입·문자열 유니온은 여기에 둔다.
 *
 * 콘솔은 엔진·모델명을 **보여 주는 곳**이다(console.access 보유자만, task-005b G6). 단 Secret 값·credential 원문·서버 경로는 어떤 DTO 에도 없다:
 * `credentialRef` 는 ref 이름(`env:NAME`·`file:name`)만, 시크릿 의심 값은 `"***"`, 절대 경로는 `…/<basename>` 으로 가려진다.
 */

// ── 열거(Prisma enum 미러 — 컴포넌트가 @prisma/client 를 끌어오지 않게) ────────────────────
export type AdminRole = 'USER' | 'ADMIN' | 'DEVELOPER' | 'SUPER_ADMIN'
export type AdminEnvironment = 'LOCAL' | 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'
export type EngineRoleName = 'REALTIME_STT' | 'ANALYSIS_STT' | 'TTS' | 'LLM'
export type EngineTypeName = 'STT' | 'TTS' | 'LLM'
export type ConnectionTypeName = 'LOCAL' | 'HTTP' | 'ONDEVICE' | 'CLI'
export type EngineStatusName = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'MISCONFIGURED' | 'DISABLED'
export type HealthKindName = 'HEALTH' | 'FUNCTIONAL'
export type TraceKindName = 'TURN' | 'PREVIEW' | 'PLAYGROUND' | 'E2E' | 'FUNCTIONAL_TEST'
export type TraceStatusName = 'OK' | 'ERROR' | 'PARTIAL'
export type ConfigSourceName =
  | 'DEFAULT'
  | 'SOURCE_CODE'
  | 'APPLICATION_CONFIG'
  | 'ENVIRONMENT'
  | 'DATABASE'
  | 'CONNECTION_PROFILE'
  | 'USER_SETTING'
  | 'RUNTIME_OVERRIDE'
export type EditabilityName = 'READ_ONLY' | 'RUNTIME_EDITABLE' | 'RESTART_REQUIRED' | 'REDEPLOY_REQUIRED' | 'SECRET'
/** `LEXICON` 은 AuditLog 전용(task-018 ②) — 발음 사전은 자체 버전 테이블이라 ConfigurationVersion·RuntimeOverride·Effective 에는 나오지 않는다. */
export type ConfigScopeName = 'ENGINE_CONNECTION' | 'FALLBACK_POLICY' | 'PROMPT' | 'APP_SETTING' | 'VOICE_PROFILE' | 'PRESET' | 'LEXICON'
/**
 * 감사 이력(#137 `scope` 필터·History › Audit, Phase 2) 범위 라벨 중 정해진 것. 나머지 범위 라벨은 History 화면 구현 가이드가 정한다.
 * task-018 전 사전 감사 행은 `scope=null` + action `lexicon.*` 이라 LEXICON 필터는 그 행도 함께 잡아야 한다(api-contract #137).
 */
export const AUDIT_SCOPE_LABELS: Partial<Record<ConfigScopeName, string>> = { LEXICON: '발음 사전' }
export type VoiceStatusName = 'IMPORTING' | 'VALIDATING' | 'AVAILABLE' | 'DISABLED' | 'ERROR' | 'DELETING' | 'ARCHIVED'

/** role-permission.md §2 의 capability 이름(정본 순서). 매트릭스 값은 `src/modules/admin/permissions/matrix.ts`. */
export type Capability =
  | 'settings.read'
  | 'settings.write'
  | 'voices.read'
  | 'voices.manage'
  | 'engine.read'
  | 'engine.connections.manage'
  | 'config.effective.read'
  | 'config.raw.read'
  | 'config.edit'
  | 'config.apply.production'
  | 'config.rollback'
  | 'credentials.manage'
  | 'secrets.read_ref'
  | 'plugins.read'
  | 'health.run'
  | 'functional_test.run'
  | 'playground.use'
  | 'e2e.run'
  | 'trace.read'
  | 'debug_session.create'
  | 'override.create'
  | 'override.production'
  | 'prompts.read'
  | 'prompts.edit'
  | 'prompts.activate'
  | 'presets.manage'
  | 'config.export'
  | 'config.import'
  | 'config.import.production'
  | 'audit.read'
  | 'environment.policy'
  | 'users.role.manage'
  | 'console.access'

// ── 공통 ─────────────────────────────────────────────────────────────────────
export interface AdminPage<T> {
  items: T[]
  nextCursor: string | null
}

/** 403 응답 `data.details`(api-contract §2-19) — 화면이 "이 기능에는 ○○ 권한이 필요합니다" 를 띄울 때 쓴다(404 는 힌트 없음). */
export interface ForbiddenDetails {
  missing: Capability[]
}

/**
 * 서버 컴포넌트 헬퍼(`@/modules/admin` 의 `getConsoleAccess()`·`requireConsolePage()`)가 돌려주는 현재 사용자 정보.
 * 매 요청 DB 에서 역할을 읽어 만든다(캐시 없음). menu 는 이미 capability·Phase 로 거른 것.
 */
export interface ConsoleViewer {
  id: string
  email: string
  name: string | null
  role: AdminRole
  environment: AdminEnvironment
  capabilities: Capability[]
  menu: AdminMenuItem[]
}

/** `requireConsolePage(capability)` 결과 — allowed=false 면 콘솔 안 403 화면(메뉴 유지)을 그린다. */
export interface ConsolePageAccess {
  viewer: ConsoleViewer
  allowed: boolean
  missing: Capability[]
}

/** 콘솔 메뉴 한 줄(`src/modules/admin/console/menu.ts` 상수). 서버 컴포넌트가 capability 로 거른 뒤 props 로 넘긴다. */
export interface AdminMenuItem {
  id: string
  path: string
  label: string
  capability: Capability
  phase: 1 | 2 | 3 | 4
  group: 'overview' | 'speech' | 'llm' | 'voices' | 'engines' | 'configuration' | 'diagnostics' | 'tools'
  tabs?: AdminMenuTab[]
}

export interface AdminMenuTab {
  id: string
  label: string
  capability: Capability
  phase: 1 | 2 | 3 | 4
}

// ── #137b GET me/capabilities ────────────────────────────────────────────────
export interface MeCapabilitiesDto {
  role: AdminRole
  environment: AdminEnvironment
  capabilities: Capability[]
  /** PRODUCTION 적용(config.apply.production) 가능 여부 — 버튼 숨김용. 서버는 매 요청 재검사. */
  productionApplyAllowed: boolean
}

// ── #81 GET environment ──────────────────────────────────────────────────────
export interface EnvironmentDto {
  environment: AdminEnvironment
  isProduction: boolean
  appVersion: string
  nodeEnv: string
  protection: {
    strictKeys: string[]
    overrideEnabled: boolean
    debugMaxTtlMinutes: number
    loglevelMaxLevel: string
    audioRetentionDays: number
    traceRetentionDays: number
  }
  activeOverrides: number
  /** Python 서비스 env 보고(Phase 3). Phase 1 은 null. */
  services: null
}

// ── Connection · Health ─────────────────────────────────────────────────────
export interface ConnectionRefDto {
  id: string
  key: string
  name: string
  status: EngineStatusName
  enabled: boolean
}

/** api-contract §2-19 공통 EngineConnection 객체. `connection`/`runtime` 은 저장값(시크릿 의심 값 `"***"`, 절대 경로 가림). */
export interface EngineConnectionDto {
  id: string
  key: string
  environment: AdminEnvironment
  engineId: string
  engineName: string
  name: string
  role: EngineRoleName
  connectionType: ConnectionTypeName
  enabled: boolean
  connection: Record<string, unknown>
  runtime: Record<string, unknown>
  /** ref 이름만(`env:NAME` | `file:name`) — 값 아님. */
  credentialRef: string | null
  logLevel: string
  status: EngineStatusName
  statusReason: string | null
  lastHealthAt: string | null
  lastFunctionalAt: string | null
  /** 최신 ConfigurationVersion.version(없으면 null — Phase 1 은 seed 값 그대로). */
  version: number | null
  fallbackRole: { primaryOf: EngineRoleName[]; fallbackOf: EngineRoleName[] }
  createdAt: string
  updatedAt: string
}

/**
 * "실행하지 않은" 결과의 단일 표현(task-005b H2). `status` 는 항상 EngineStatus enum 값이고 이유는 `detail.reason` 이다.
 *   NOT_APPLICABLE  — 서버에서 확인할 대상이 아님(ONDEVICE·worker 내장 LOCAL)        → ok:false, status:'UNKNOWN',    skipped:true
 *   SERVICE_DOWN    — 기능 테스트 전 서비스 확인에서 실패(연결 거부·타임아웃·5xx 등)  → ok:false, status:'UNAVAILABLE'|'DEGRADED'|'MISCONFIGURED', skipped:true, errorCode 동반
 *   NOT_IMPLEMENTED — 서비스는 응답하지만 음성 기능 테스트 자산·경로가 아직 없음(task-003) → ok:false, status:'UNKNOWN',    skipped:true
 * 실행했는데 실패한 경우는 skipped/reason 이 없고 errorCode·message 만 있다. `status:'UNKNOWN'` 결과는 connection 상태를 바꾸지 않는다.
 */
export type HealthSkipReason = 'NOT_APPLICABLE' | 'SERVICE_DOWN' | 'NOT_IMPLEMENTED'

export interface HealthDetailDto {
  /** 실패 분류: ECONNREFUSED·ETIMEDOUT·ENOTFOUND·HTTP_<status>·NOT_FOUND·SPAWN_FAILED·EXIT_<code>·CREDENTIAL_MISSING·PLUGIN_NOT_LOADED·SCHEMA_INVALID … */
  errorCode?: string
  /** 고정 한국어 문구(URL·경로·stderr 없음). */
  message?: string
  httpStatus?: number
  version?: string
  models?: number
  memoryMb?: number
  device?: string
  serviceEnv?: string
  /** true = 검사·테스트를 실행하지 않았다(이유는 reason). */
  skipped?: boolean
  reason?: HealthSkipReason
  /** FUNCTIONAL(LLM) */
  schemaValid?: boolean
  model?: string
  outputChars?: number
  attempts?: number
  /** FUNCTIONAL(TTS) — 고정 문장 합성 결과(오디오 자체는 저장하지 않음) */
  audioBytes?: number
  durationMs?: number
}

export interface HealthDto {
  id: string
  connectionId: string
  connectionKey: string
  kind: HealthKindName
  ok: boolean
  status: EngineStatusName
  latencyMs: number | null
  detail: HealthDetailDto | null
  traceId: string | null
  checkedAt: string
}

/** #95·#96 실행 결과 = 기록된 EngineHealth + 갱신된 connection 상태. */
export interface HealthRunDto extends HealthDto {
  connectionStatus: EngineStatusName
}

export interface EffectiveSummaryDto {
  keys: number
  bySource: Partial<Record<ConfigSourceName, number>>
  warnings: number
}

export interface EngineConnectionDetailDto extends EngineConnectionDto {
  effectiveSummary: EffectiveSummaryDto
  recentHealth: HealthDto[]
}

// ── #99 Fallback ─────────────────────────────────────────────────────────────
export interface FallbackPolicyDto {
  id: string
  environment: AdminEnvironment
  role: EngineRoleName
  primary: ConnectionRefDto | null
  fallbacks: ConnectionRefDto[]
  retryOnce: boolean
  enabled: boolean
  version: number | null
  /** Router 가 지금 실제로 도는 순서(connection key) — 상태·enabled 반영. */
  effectiveOrder: string[]
}

// ── #80 Overview ─────────────────────────────────────────────────────────────
export interface OverviewRoleDto {
  role: EngineRoleName
  engine: { id: string; displayName: string } | null
  connection: { id: string; key: string; name: string } | null
  status: EngineStatusName | null
  statusReason: string | null
  lastHealthAt: string | null
  fallbacks: number
  configVersion: number | null
  model: string | null
}

export interface OverviewDto {
  environment: AdminEnvironment
  roles: OverviewRoleDto[]
  voices: { total: number; available: number; disabled: number; importing: number; error: number }
  llm: { connection: { id: string; key: string; name: string } | null; tiers: Record<string, string>; status: EngineStatusName | null } | null
  config: { latestVersionAt: string | null; activeOverrides: number; pendingProductionApprovals: number }
  traces24h: { turns: number; errors: number; p50Ms: number | null; p95Ms: number | null }
  recentHealth: HealthDto[]
  generatedAt: string
}

// ── #90 Engines · #103 Schema · #121/#122 Plugins ────────────────────────────
export interface SchemaKeyDto {
  key: string
  group: string
  type: 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'URL' | 'PATH' | 'SECRET_REF' | 'JSON'
  default: unknown
  min?: number
  max?: number
  enum?: readonly (string | number)[]
  pattern?: string
  required?: boolean
  description: string
  impact?: string
  editability: EditabilityName
  restartRequired: boolean
  restartTarget?: string
  secret: boolean
  appliesTo?: ConnectionTypeName[]
  editabilityBy?: Partial<Record<ConnectionTypeName, EditabilityName>>
  userSettable?: boolean
  strict?: boolean
  envAlias?: string[]
  /** SECRET_REF 키만 — 걸 수 있는 ref 의 정확한 목록(task-012c Codex C1 CX-1, admin-console/03 `allowedRefs`). 이름뿐, 값 없음. */
  allowedRefs?: readonly string[]
}

export interface ConfigurationSchemaDto {
  engineId: string
  schemaVersion: number
  groups: { id: string; label: string }[]
  keys: SchemaKeyDto[]
}

export interface EngineDescriptorDto {
  id: string
  displayName: string
  type: EngineTypeName
  roles: EngineRoleName[]
  connectionTypes: ConnectionTypeName[]
  capabilities: string[]
  schemaVersion: number
  pluginVersion: string
  providerClass: string
  enabled: boolean
  loaded: boolean
  initError: string | null
}

export interface EngineDto {
  engine: EngineDescriptorDto
  /** `includeSchema=true` + config.raw.read 일 때만, 아니면 null. */
  schema: ConfigurationSchemaDto | null
  connections: number
}

export interface PluginDto {
  id: string
  displayName: string
  providerClass: string
  version: string
  type: EngineTypeName
  roles: EngineRoleName[]
  connectionTypes: ConnectionTypeName[]
  loaded: boolean
  initError: string | null
  connections: number
  /** DB `Engine` 행은 있는데 코드 레지스트리에 없는 경우 true. */
  orphan: boolean
}

export interface PluginDetailDto extends PluginDto {
  capabilities: string[]
  schemaVersion: number
  defaultConfiguration: Record<string, unknown>
  schema: ConfigurationSchemaDto | null
  /** 저장소 기준 소스 경로(`src/modules/engine/adapters/...`) — 서버 파일시스템 경로 아님. */
  sourcePath: string
}

// ── #101 Secrets ─────────────────────────────────────────────────────────────
export interface SecretRefDto {
  ref: string
  source: 'env' | 'file'
  /** 값이 설정돼 있는가(env: 비어 있지 않음 · file: SECRETS_DIR 아래 파일 존재). 값 자체는 읽지 않는다. */
  exists: boolean
  mtime: string | null
  usedBy: { id: string; key: string }[]
  /**
   * 이 ref 를 걸 수 있는 connection key(어댑터 descriptor 의 정확한 허용 목록 기준, task-012c Codex C1 CX-1 · api-contract #101).
   * 허용됐지만 아직 어느 연결도 쓰지 않는 ref 도 목록에 나온다(usedBy 빈 배열). 전역 거부 분류(부팅·내부 시크릿) ref 는 목록에 싣지 않는다.
   */
  allowedFor: string[]
  /** 사용 시각 추적은 Phase 2(SecretResolver). Phase 1 은 null. */
  lastUsedAt: string | null
}

// ── #102 Effective Configuration ─────────────────────────────────────────────
export interface EffectiveLayerDto {
  source: ConfigSourceName
  value: unknown
  sourceRef: string
}

export interface EffectiveKeyDto {
  key: string
  value: unknown
  source: ConfigSourceName
  /** DEVELOPER 이상(config.raw.read)만. ADMIN 요약에는 없다. */
  sourceRef?: string
  editability: EditabilityName
  restartRequired: boolean
  secret: boolean
  /** secret 키만: ref 가 가리키는 값이 설정돼 있는가. */
  exists?: boolean
  /** 더 낮은 층에 다른 값이 있어 가려졌는가. */
  shadowed: boolean
  /** DEVELOPER 이상만: 낮은 층 → 높은 층, 가려진 값 포함. */
  layers?: EffectiveLayerDto[]
  warnings?: string[]
}

export interface EffectiveConfigDto {
  environment: AdminEnvironment
  scope: ConfigScopeName
  targetId: string
  targetKey: string | null
  engineId: string | null
  schemaVersion: number | null
  resolvedAt: string
  cacheHit: boolean
  /** SUMMARY = ADMIN(값+Source 이름) · FULL = DEVELOPER 이상(sourceRef·layers). */
  detail: 'SUMMARY' | 'FULL'
  keys: EffectiveKeyDto[]
  /** 이번 해석에서 비어 있던 층(Phase 1 미구현 층 포함). */
  emptyLayers: ConfigSourceName[]
  warnings: string[]
  /**
   * 편집 정책(task-012c, ENGINE_CONNECTION·FALLBACK_POLICY 만) — Form 이 칸 잠금·실행 검증 표시를 그린다. `version` = 쓰기 요청의 `baseVersion`.
   * 연결의 `enabled` 처럼 스키마 밖 편집 칸도 `keys` 에 있다.
   */
  edit?: { version: number; keys: ConfigKeyPolicyDto[] }
}

// ── #82 Voices ───────────────────────────────────────────────────────────────
export interface AdminVoiceDto {
  id: string
  displayName: string
  description: string | null
  status: VoiceStatusName
  statusReason: string | null
  enabled: boolean
  sortOrder: number
  ttsEngineId: string
  speaker: string
  speakerId: number | null
  defaults: Record<string, unknown>
  styles: { name: string; label: string; styleWeightDefault: number }[]
  model: { id: string; status: VoiceStatusName; version: string | null; speakers: unknown; styles: unknown } | null
  usage: { users: number }
  previewAvailable: boolean
  updatedAt: string
}

// ── #128/#129 Traces ─────────────────────────────────────────────────────────
export interface TraceStepDto {
  name: string
  ms?: number
  [key: string]: string | number | boolean | null | undefined
}

export interface TraceListItemDto {
  traceId: string
  kind: TraceKindName
  status: TraceStatusName
  totalMs: number | null
  errorCode: string | null
  refType: string | null
  refId: string | null
  /** 앞 4자 + `…` (SUPER_ADMIN 도 마스킹 — 필터에만 원값을 쓴다). */
  userId: string | null
  stepNames: string[]
  createdAt: string
}

export interface TraceDetailDto extends Omit<TraceListItemDto, 'stepNames'> {
  environment: AdminEnvironment
  debugSessionId: string | null
  steps: TraceStepDto[]
  /** DebugSession 캡처물 링크(Phase 3). Phase 1 은 항상 null. */
  captured: null
}

// ── task-012c 설정 편집(#93·#93a·#93b·#100·#104~#111·#123b·#137) — DTO 단일 출처(api-contract #106 기준, admin-console/08 은 여기에 맞춘다) ────
/** 012c 에서 편집하는 scope. VOICE_PROFILE 은 환경 칸 없는 전역 행이라 012c-2 로(D-C14), PROMPT 는 012c-2, PRESET 은 Phase 4. */
export type ConfigEditScopeName = 'ENGINE_CONNECTION' | 'FALLBACK_POLICY' | 'APP_SETTING'
/**
 * 편집 잠금 이유(D-C4 편집 키 표): 읽기 전용 · 재시작 필요(CX-2) · 비밀 참조는 전용 경로(#93b) · 설계 보류 · 서비스 설정 파일에서 관리(Python) ·
 * 앱이 읽지 않음 · 서버 env 주소 고정 · 자동 · 환경 정책 키.
 */
export type ConfigLockReason = 'READ_ONLY' | 'RESTART_REQUIRED' | 'CREDENTIAL_ONLY' | 'DEFERRED' | 'SERVICE_MANAGED' | 'NOT_CONSUMED' | 'ENV_PINNED' | 'AUTO' | 'POLICY'
/** 실행 검증 가능 여부(CX-2) — DYNAMIC = 값에 따라(켜기면 테스트, 끄기면 불요 · 새로 들어간 예비 연결만 테스트). */
export type ConfigVerifiable = 'YES' | 'NO' | 'NOT_NEEDED' | 'DYNAMIC'
export type ConfigRuleName =
  | 'type'
  | 'min'
  | 'max'
  | 'enum'
  | 'pattern'
  | 'maxLength'
  | 'required'
  | 'unknownKey'
  | 'readOnly'
  | 'secretValue'
  | 'dependency'
  | 'reference'
  | 'serviceManaged'
  | 'hostNotAllowed'
  | 'refNotAllowed'
  | 'restartRequired'
export type ConfigVersionOrigin = 'BASELINE' | 'APPLY' | 'RAW_JSON' | 'ROLLBACK'
export type ConfigIntegrity = 'OK' | 'MALFORMED' | 'INVALID_ENTRIES'
export type ConfigVersionStatusName = 'ACTIVE' | 'SUPERSEDED' | 'ROLLED_BACK'

/** 키 한 개의 편집 정책 + 지금 저장값(시크릿 형태 값은 `***`, credentialRef 는 이름만). */
export interface ConfigKeyPolicyDto {
  key: string
  type: SchemaKeyDto['type']
  description: string
  editability: EditabilityName
  strict: boolean
  editable: boolean
  lock: ConfigLockReason | null
  lockMessage: string | null
  verifiable: ConfigVerifiable
  consumer: 'APP' | 'CLIENT' | 'PYTHON' | 'NONE'
  restartTarget: string | null
  min?: number
  max?: number
  enum?: readonly (string | number)[]
  pattern?: string
  maxLength?: number
  nullable?: boolean
  allowedRefs?: readonly string[]
  stored: unknown
  /** 런타임이 이 값보다 먼저 읽는 env 가 설정돼 있음(저장해도 효력 없음 — 편집 칸 잠금 안내). */
  shadowedByEnv: boolean
}

export interface ConfigTargetDto {
  scope: ConfigEditScopeName
  targetId: string
  targetKey: string
  targetName: string
  environment: AdminEnvironment
  /** 지금 ACTIVE 버전 번호(없으면 0 = seed 상태) — 쓰기 요청의 `baseVersion`. */
  version: number
  keys: ConfigKeyPolicyDto[]
}

export interface ConfigIssueDto {
  key: string
  rule: ConfigRuleName
  message: string
  expected?: unknown
  actual?: unknown
  suggestion?: string
  related?: string[]
  lock?: ConfigLockReason
}

export interface ConfigValidateDto {
  valid: boolean
  stage: 'JSON_SYNTAX' | 'SCHEMA' | 'DEPENDENCY' | null
  errors: ConfigIssueDto[]
  warnings: { key: string; code: string; message: string }[]
  changedKeys: string[]
  impact: { runtimeEditable: string[]; restartRequired: string[]; redeployRequired: string[]; strict: string[] }
}

export type ConfigBlockedCode = 'SHADOWED_BY_ENVIRONMENT' | 'READ_ONLY' | 'SERVICE_MANAGED' | 'RESTART_REQUIRED' | 'SECRET_VALUE_IN_PAYLOAD'

export interface ConfigDiffChangeDto {
  key: string
  changeType: 'CHANGED' | 'ADDED'
  /** Effective 값(적용 전·후). env·Override 가 이기면 after 가 저장값과 다를 수 있다. */
  before: unknown
  after: unknown
  beforeSource: ConfigSourceName
  afterSource: ConfigSourceName
  storedBefore: unknown
  storedAfter: unknown
  editability: EditabilityName
  strict: boolean
  restartTarget: string | null
  verifiable: 'YES' | 'NO' | 'NOT_NEEDED'
  /** SHADOWED_BY_ENVIRONMENT 는 경고(저장은 됨), 나머지는 적용 400. */
  blocked: { code: ConfigBlockedCode; lock: ConfigLockReason | null; message: string } | null
}

export interface ConfigDiffDto {
  scope: ConfigEditScopeName
  targetId: string
  targetKey: string
  environment: AdminEnvironment
  baseVersion: number
  /** 무상태 — apply·rollback 이 같은 후보로 다시 계산해 대조(D-C1). */
  summaryHash: string
  candidateHash: string
  changes: ConfigDiffChangeDto[]
  unchanged: number
  summary: { changed: number; strict: number; blocked: number; shadowed: number; secretTouched: boolean; notNeeded: number; unverifiable: number }
  productionProtected: boolean
  requiredConfirm: 'SUPER_ADMIN' | null
  /** PRODUCTION 적용에 기능 테스트(testResultId)가 필요한가. */
  testRequired: boolean
  crossEnvironment: boolean
}

export interface ConfigTestRunDto {
  connectionKey: string
  ok: boolean
  status: EngineStatusName
  errorCode: string | null
  latencyMs: number | null
  healthId: string
  traceId: string
}

/** #105 — `status:"ok"`(바뀐 키 중 실행 검증이 필요한 키 전부를 실제로 검증)일 때만 `testResultId`(CX-2). 전부 NOT_NEEDED 면 ok + id null. */
export interface ConfigTestDto {
  status: 'ok' | 'partial' | 'failed'
  testResultId: string | null
  traceId: string | null
  latencyMs: number | null
  testedKeys: string[]
  untestedKeys: string[]
  notNeededKeys: string[]
  candidateHash: string
  /** testResultId 유효 기한(발급 + 30분). */
  expiresAt: string | null
  runs: ConfigTestRunDto[]
}

export interface ConfigVersionRefDto {
  id: string
  version: number
  status: ConfigVersionStatusName
}

export interface ConfigApplyResultDto {
  /** false = 후보가 지금 저장값과 같음(버전·감사 없음). */
  changed: boolean
  scope: ConfigEditScopeName
  targetId: string
  environment: AdminEnvironment
  version: ConfigVersionRefDto | null
  previousVersion: ConfigVersionRefDto | null
  /** 첫 적용이면 같은 트랜잭션에서 만든 기준선 v1(D-C5). */
  baselineVersion: ConfigVersionRefDto | null
  /** 파생 적용(미리듣기 문장 → textVersion +1, D-C7). */
  derived: { targetId: string; version: ConfigVersionRefDto }[]
  applied: { runtimeEditable: string[]; pushedToService: false; restartRequired: string[]; restartTarget: string | null; redeployRequired: string[] }
  auditIds: string[]
  warnings: string[]
}

export interface ConfigRollbackResultDto extends ConfigApplyResultDto {
  restoredFromVersion: number
  rolledBack: ConfigVersionRefDto | null
  droppedKeys: string[]
}

export interface ConfigVersionItemDto {
  id: string
  scope: ConfigEditScopeName
  targetId: string
  targetKey: string | null
  targetName: string | null
  environment: AdminEnvironment
  version: number
  status: ConfigVersionStatusName
  /** `snapshot._meta.origin`(감사 action 과 같은 뜻). 옛 행·손상이면 null. */
  origin: ConfigVersionOrigin | null
  actor: { id: string; email: string } | null
  reason: string | null
  diffSummary: string | null
  restoredFromVersion: number | null
  testResult: { ok: boolean } | null
  /** 지금 스키마로 엄격 재검증한 결과 — OK 가 아니면 화면은 "기록 손상" + 되돌리기 숨김. */
  integrity: ConfigIntegrity
  createdAt: string
  supersededAt: string | null
}

export interface ConfigVersionListDto {
  items: ConfigVersionItemDto[]
  nextCursor: string | null
}

export interface ConfigVersionEntryDto {
  key: string
  before: unknown
  after: unknown
}

export interface ConfigVersionDetailDto extends ConfigVersionItemDto {
  snapshot: Record<string, unknown>
  compare: 'previous' | 'active'
  /** previous = 바로 앞 버전(없으면 null) · active = 지금 저장값. */
  against: ConfigVersionRefDto | { kind: 'STORED' } | null
  entries: ConfigVersionEntryDto[]
  truncated: number
  droppedKeys: string[]
  issues: ConfigIssueDto[]
}

export interface ConfigRawDto {
  scope: ConfigEditScopeName
  targetId: string
  targetKey: string
  environment: AdminEnvironment
  version: number
  schemaRef: string | null
  /** 저장값(관리 층). `_meta` 없음. 시크릿 형태 값은 `***`. */
  json: Record<string, unknown>
  keys: ConfigKeyPolicyDto[]
  editability: Record<string, EditabilityName>
  /** 저장값과 Effective 가 다른 키(env·Override 가 이김). */
  effectiveDiffers: string[]
}

export interface AppSettingDto {
  key: string
  environment: AdminEnvironment
  value: unknown
  /** false = 행이 없어 기본값을 쓰는 중. */
  exists: boolean
  description: string
  type: SchemaKeyDto['type']
  editability: EditabilityName
  policy: boolean
  lock: ConfigLockReason | null
  lockMessage: string | null
  verifiable: ConfigVerifiable
  version: number
}

export interface AuditItemDto {
  id: string
  environment: AdminEnvironment
  actor: { id: string | null; email: string | null; roleSnap: AdminRole | null }
  action: string
  scope: ConfigScopeName | null
  targetId: string | null
  before: unknown
  after: unknown
  reason: string | null
  /** /24(IPv6 /48) 로 마스킹. */
  ip: string | null
  traceId: string | null
  createdAt: string
  /** after 에서 뽑은 한 줄. */
  summary: string | null
  /** 설정 버전 링크(after.versionId). */
  versionId: string | null
}

export interface AuditListDto {
  items: AuditItemDto[]
  nextCursor: string | null
}
