/**
 * Engine Provider 계약(admin-console/03 §4, configuration-resolution §1·§5). 어댑터마다 하나씩 `engine/adapters/**` 에서 구현하고
 * `adapters/providers.ts` 가 목록화한다 — 엔진명은 어댑터 쪽에만 있고 이 파일·registry 는 엔진을 모른다.
 */
import type { ConnectionType, EngineRole, EngineStatus, EngineType } from '@prisma/client'

export type SchemaKeyType = 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'URL' | 'PATH' | 'SECRET_REF' | 'JSON'
export type EditabilityValue = 'READ_ONLY' | 'RUNTIME_EDITABLE' | 'RESTART_REQUIRED' | 'REDEPLOY_REQUIRED' | 'SECRET'

export interface SchemaKey {
  /** 점 표기 평면 키(`connection.*`·`runtime.*`·`logging.*`). */
  key: string
  group: 'connection' | 'runtime' | 'logging'
  type: SchemaKeyType
  default: unknown
  min?: number
  max?: number
  enum?: readonly (string | number)[]
  pattern?: string
  required?: boolean
  description: string
  impact?: string
  editability: EditabilityValue
  restartRequired: boolean
  restartTarget?: string
  appliesTo?: ConnectionType[]
  editabilityBy?: Partial<Record<ConnectionType, EditabilityValue>>
  userSettable?: boolean
  strict?: boolean
  /** ENVIRONMENT 층 별칭(configuration-resolution §2-1) — 값을 그대로 쓴다(SECRET_REF 면 값이 ref 형식이어야 한다). */
  envAlias?: string[]
  /** 값이 **시크릿 자체**인 별칭 — 값은 읽지 않고 `env:<NAME>` ref 로만 바꾼다(§2-1 `AI_API_KEY`). */
  envSecretAlias?: string[]
}

export interface ConfigurationSchema {
  engineId: string
  schemaVersion: number
  groups: { id: string; label: string }[]
  keys: SchemaKey[]
}

export interface EngineDescriptor {
  id: string
  displayName: string
  type: EngineType
  roles: EngineRole[]
  connectionTypes: ConnectionType[]
  capabilities: string[]
  schemaVersion: number
  pluginVersion: string
  providerClass: string
  /** 저장소 기준 소스 경로 — 콘솔 Plugins 상세 표시용(서버 파일시스템 경로 아님). */
  sourcePath: string
}

/** Health·Functional 이 받는 연결 정보 — Effective(해석된) 값. 요청 본문에서 오지 않는다. */
export interface ConnectionProfile {
  id: string
  key: string
  connectionType: ConnectionType
  /** Effective 평면 값(키 → 값). SECRET_REF 키는 ref 문자열뿐. */
  values: Record<string, unknown>
}

export interface HealthDetail {
  errorCode?: string
  message?: string
  httpStatus?: number
  version?: string
  models?: number
  memoryMb?: number
  device?: string
  serviceEnv?: string
  skipped?: boolean
  /** 실행하지 않은 이유(`@/types/admin` HealthSkipReason). */
  reason?: 'NOT_APPLICABLE' | 'SERVICE_DOWN' | 'NOT_IMPLEMENTED'
  schemaValid?: boolean
  model?: string
  outputChars?: number
  attempts?: number
  /** FUNCTIONAL(TTS) — 고정 문장 합성 결과 크기·길이(오디오 자체는 저장하지 않는다). */
  audioBytes?: number
  durationMs?: number
}

export interface HealthOutcome {
  ok: boolean
  /** 이 결과로 판정된 상태. `UNKNOWN` = 확인 불가(검사 생략) — connection 상태를 바꾸지 않는다. */
  status: EngineStatus
  latencyMs: number | null
  detail: HealthDetail
}

/** SOURCE_CODE 층 항목 — 어댑터 코드가 고정한 값과 그 위치(`code:<path>#<symbol>`). */
export type SourceCodeLayer = Record<string, { value: unknown; sourceRef: string }>

export interface EngineProvider {
  descriptor: EngineDescriptor
  configurationSchema(): ConfigurationSchema
  /** 5초 이내. 실패는 throw 가 아니라 `{ok:false, status:'UNAVAILABLE'|'DEGRADED'|'MISCONFIGURED'}` 로 돌려준다. */
  healthCheck(profile: ConnectionProfile): Promise<HealthOutcome>
  /** 콘솔 대시보드용 모델 요약(엔진별 키 해석은 어댑터만 안다). */
  modelSummary(values: Record<string, unknown>): string | null
  /** 어댑터 코드 상수(SOURCE_CODE 층). 없으면 빈 층. */
  sourceCodeLayer?(): SourceCodeLayer
  /** 기능 테스트(고정 입력 1회, 30초 상한). 없으면 functionalTest 모듈이 "미실행" 으로 기록한다. */
  functionalTest?(profile: ConnectionProfile): Promise<HealthOutcome>
  /** TTS 역할 합성 어댑터 — 엔진 파라미터 변환은 이 구현 안에서만 한다(speech-platform/16 §1.1). */
  tts?: TtsAdapter
}

// ── TTS 어댑터 계약(엔진 독립 입력 → 오디오) ─────────────────────────────

/** Voice Registry 가 가진 모델 참조 — 값은 DB 데이터(VoiceProfile.voiceModelId·speakerId), 코드에 엔진명 없음. */
export interface TtsVoiceRef {
  model: string
  speakerId: number | null
  modelVersion: string
}

export interface TtsLexiconHint {
  surface: string
  reading: string
  accentType: number
  wordType: string | null
}

/** 세그먼트 1개(= 문장 ≤ maxChars). 수치는 L4 가 범위로 자른 엔진 독립 유효값. */
export interface TtsSegmentInput {
  text: string
  style: string
  styleWeight: number
  speed: number
  pitch: number
  intonation: number
  lexiconHints: readonly TtsLexiconHint[]
  dictionaryVersion: number
  speechProfile: string
}

export interface TtsSynthMetrics {
  /** 앱이 잰 HTTP 왕복(ms). */
  httpMs: number
  synthMs: number | null
  queueMs: number | null
  encodeMs: number | null
  audioMs: number | null
  modelLoadMs: number | null
  modelLoaded: 'hit' | 'cold' | null
  /** 엔진이 요청 스타일을 못 찾아 기본 스타일로 대체했다. */
  styleFallback: boolean
}

export interface TtsSynthOutput {
  audio: Buffer
  metrics: TtsSynthMetrics
}

export interface TtsAdapter {
  /** 세그먼트 글자 수 상한(Effective 설정). */
  maxChars(values: Record<string, unknown>): number
  synthesize(profile: ConnectionProfile, voice: TtsVoiceRef, segment: TtsSegmentInput, opts: { traceId: string; timeoutMs: number }): Promise<TtsSynthOutput>
}
