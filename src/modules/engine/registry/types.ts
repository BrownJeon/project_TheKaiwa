/**
 * Engine Provider 계약(admin-console/03 §4, configuration-resolution §1·§5). 어댑터마다 하나씩 `engine/adapters/**` 에서 구현하고
 * `adapters/providers.ts` 가 목록화한다 — 엔진명은 어댑터 쪽에만 있고 이 파일·registry 는 엔진을 모른다.
 */
import type { ConnectionType, EngineRole, EngineStatus, EngineType } from '@prisma/client'

export type SchemaKeyType = 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN' | 'ENUM' | 'URL' | 'PATH' | 'SECRET_REF' | 'JSON'
export type EditabilityValue = 'READ_ONLY' | 'RUNTIME_EDITABLE' | 'RESTART_REQUIRED' | 'REDEPLOY_REQUIRED' | 'SECRET'

/**
 * 이 키를 **실제로 읽는 쪽**(task-012c D-C4 편집 키 표 — 콘솔 편집 허용의 근거). 생략 = `NONE`(런타임이 읽지 않음 → 편집 불가).
 * APP = 앱(Node) 런타임이 행 JSON 을 읽는다 · CLIENT = 앱이 클라이언트(#19 등)로 넘긴다 · PYTHON = 음성 서비스가 자기 설정 파일로 읽는다(콘솔 편집 불가, 015c).
 */
export type KeyConsumer = 'APP' | 'CLIENT' | 'PYTHON' | 'NONE'

/**
 * 콘솔 `config/test`(#105)가 후보 값으로 이 키를 **실제로 실행해** 검증하는 방법(Codex C1 CX-2). 생략 = `NONE`(검증 불가 → PRODUCTION 편집 불가).
 * LLM_PROBE_* = 그 tier 로 고정 스키마 프로브 1회(STREAM = 첫 조각 스트리밍 확인) · TTS_SYNTH = 후보 프로필로 고정 문장 합성 ·
 * NOT_NEEDED = 런타임 효과가 없어 검증할 것이 없음(표시 전용 등).
 */
export type VerifyMethod = 'LLM_PROBE_FAST' | 'LLM_PROBE_BALANCED' | 'LLM_PROBE_DEEP' | 'LLM_PROBE_STREAM' | 'TTS_SYNTH' | 'NOT_NEEDED' | 'NONE'

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
  /**
   * SECRET_REF 키 필수 — 이 키에 넣을 수 있는 ref 의 정확한 목록(`env:NAME`·`file:name`, 정확 일치, task-012c Codex C1 CX-1).
   * 빈 배열 = 어떤 ref 도 걸 수 없음. 전역 거부 분류(infra `isDeniedCredentialRef`)가 먼저라 여기 적어도 부팅 시크릿은 통과하지 못한다(스키마 자체 검증도 거부).
   */
  allowedRefs?: readonly string[]
  // ── 콘솔 편집 메타(task-012c D-C4 편집 키 표를 어댑터가 선언 — engine/configuration 은 엔진명을 모른 채 이 값으로 판정) ──
  consumer?: KeyConsumer
  consumerBy?: Partial<Record<ConnectionType, KeyConsumer>>
  verify?: VerifyMethod
  /** 주소가 서버 env 로 고정됨(시크릿 전송 대상 고정 D-C3(a)) — DB 값을 바꿔도 다른 origin 은 호출 0 이라 편집 무의미. */
  envPinned?: boolean
  /** 런타임이 스키마 max 보다 좁게 자르는 상한(예: 서비스 상한 100) — 편집은 이 값까지만. */
  runtimeMax?: number
  /** 런타임이 행 값보다 **먼저** 읽는 env 이름 — 설정돼 있으면 콘솔 값은 효력이 없다(Diff `SHADOWED_BY_ENVIRONMENT`). */
  runtimeEnvWins?: readonly string[]
  /** false = 012c 콘솔 편집 보류(설계 판단으로 제외 — 캐시 키 미포함·라우팅 정책·배포 경로 묶임 등). 이유는 description 에. */
  consoleEdit?: boolean
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
  /**
   * `config/test`(#105) 결과 행에만 — PRODUCTION Apply 가 `testResultId` 로 이 행을 읽어 같은 대상·같은 후보(`candidateHash`)·
   * 검증한 키(`testedKeys ⊇ 변경 키`)를 확인한다(D-C1·CX-2). 화면 DTO 에는 싣지 않는다(present.healthDetail 화이트리스트).
   */
  config?: ConfigTestMark
}

export interface ConfigTestMark {
  scope: string
  targetId: string
  environment: string
  candidateHash: string
  testedKeys: string[]
  status: 'ok' | 'partial' | 'failed'
  /** 같은 테스트에서 함께 돈 다른 연결의 결과 행(Fallback 새 연결 등). */
  related?: string[]
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
  /**
   * 5초 이내. 실패는 throw 가 아니라 `{ok:false, status:'UNAVAILABLE'|'DEGRADED'|'MISCONFIGURED'}` 로 돌려준다.
   * `detail:false` = 상태 판정만(표시등 확인 등) — 인증이 필요한 상세 조회를 건너뛴다. 기본은 상세 포함(관리자 콘솔).
   */
  healthCheck(profile: ConnectionProfile, opts?: { detail?: boolean }): Promise<HealthOutcome>
  /** 콘솔 대시보드용 모델 요약(엔진별 키 해석은 어댑터만 안다). */
  modelSummary(values: Record<string, unknown>): string | null
  /** 어댑터 코드 상수(SOURCE_CODE 층). 없으면 빈 층. */
  sourceCodeLayer?(): SourceCodeLayer
  /**
   * 기능 테스트(고정 입력 1회, 30초 상한). 없으면 functionalTest 모듈이 "미실행" 으로 기록한다.
   * `opts.text` = 검증 문장(TTS 상한 길이 확인 — task-012c config/test). 없으면 어댑터 고정 문장.
   */
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
  /** 단어 timing 상태(task-012b-4) — `OK` · `ABSENT`(엔진이 timing 을 주지 않음) · `INVALID`(형식·범위 검사 실패) · 엔진이 알린 사유(대문자). 없으면 모름. */
  timingStatus?: string | null
  /** 엔진이 timing 계산에 쓴 시간(ms, 엔진 보고값). */
  timingMs?: number | null
}

/** 단어 1개 = [startMs, endMs, charStart, charEnd] — 글 좌표는 **코드포인트**(task-012b-4, speech-platform/16 §8). */
export type TtsTimingWord = readonly [number, number, number, number]

/** 엔진 중립 단어 timing. 글 좌표는 어댑터가 받은 `TtsSegmentInput.text` 기준이다(어댑터 내부 치환은 어댑터가 되돌린다). */
export interface TtsTimingOutput {
  method: 'ENGINE_DURATION' | 'FORCED_ALIGN'
  /** 산출기 버전(캐시 `timingVersion`). 엔진명이 아닌 짧은 식별자. */
  version: string
  /** timing 이 기준으로 삼은 오디오 길이(ms). */
  durationMs: number
  /** 오름차순·시간과 글 구간 모두 겹침 0. 구두점만인 구간은 단어가 아니다(빈틈이 있을 수 있다). */
  words: readonly TtsTimingWord[]
}

export interface TtsSynthOutput {
  audio: Buffer
  metrics: TtsSynthMetrics
  /** 단어 timing(task-012b-4). 엔진이 못 주거나 검사에 실패하면 null — 오디오는 그대로다. */
  timing?: TtsTimingOutput | null
}

/** 엔진이 실제로 읽을 읽기·악센트(발음 사전 미리듣기, task-003g). 문자열은 가나·악센트 기호뿐 — 엔진명·모델명 없음. */
export interface TtsG2pOutput {
  normalizedText: string
  reading: string
  /** 상승 `↑`·하강 `↓` 표기(구두점에서 끊김). */
  accent: string
}

export interface TtsAdapter {
  /** 세그먼트 글자 수 상한(Effective 설정). */
  maxChars(values: Record<string, unknown>): number
  synthesize(profile: ConnectionProfile, voice: TtsVoiceRef, segment: TtsSegmentInput, opts: { traceId: string; timeoutMs: number }): Promise<TtsSynthOutput>
  /** 읽기 확인(선택). 사전 힌트 적용은 합성과 같은 방식으로 어댑터가 한다. 없으면 파사드가 MISCONFIGURED(NO_G2P). */
  g2p?(profile: ConnectionProfile, text: string, hints: readonly TtsLexiconHint[], opts: { timeoutMs: number }): Promise<TtsG2pOutput>
}
