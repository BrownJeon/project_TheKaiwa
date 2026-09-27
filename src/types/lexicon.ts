/**
 * 발음 사전 관리 API DTO(task-003g, api-contract §7-2 `/api/admin/v1/lexicon*`) — 서버 라우트와 콘솔 화면(`components/admin/lexicon`)이 공유한다.
 * 컴포넌트는 `@/modules/*` 를 import 할 수 없으므로 상수·타입은 여기에 둔다(화면 DTO 의 단일 출처 — `types/admin.ts` 에 다시 정의하지 않는다).
 * 엔진명·모델명·서버 주소는 어떤 필드에도 없다(읽기 확인 결과는 가나·악센트 표기 문자열만).
 */
import type { AdminEnvironment, AdminRole } from './admin'

export const LEXICON_SCOPES = ['GLOBAL', 'COURSE', 'LESSON', 'VOICE', 'USER'] as const
export type LexiconScopeName = (typeof LEXICON_SCOPES)[number]

export const LEXICON_WORD_TYPES = ['PROPER_NOUN', 'PERSON', 'PLACE', 'COMMON', 'LOANWORD', 'ABBREVIATION'] as const
export type LexiconWordType = (typeof LEXICON_WORD_TYPES)[number]

/** 입력 상한(정본 domain-model·16 §2.2 L-4). reading 60 = DB 컬럼 폭(VarChar 60), 우선순위 0~1000. */
export const LEXICON_LIMITS = {
  surfaceMax: 40,
  readingMax: 60,
  priorityMin: 0,
  priorityMax: 1000,
  priorityDefault: 10,
  noteMax: 200,
  scopeRefIdMax: 40,
  reasonMax: 200,
  /** 미리듣기 예문(서버가 문장 단위로 나눠 합성·읽기 확인 — 한 번에 들을 수 있는 최대). */
  previewTextMax: 200,
  previewDraftsMax: 20,
  /** 미리듣기 읽기 확인(JSON)·소리(audio/wav) 각각 관리자당 분당. */
  previewPerMinute: 10,
  importMaxRows: 2000,
  importMaxBytes: 256 * 1024,
  importChangesMax: 100,
  importErrorsMax: 200,
  diffRowsMax: 100,
  pageSizeDefault: 50,
  pageSizeMax: 100,
  versionPageSizeDefault: 20,
  versionPageSizeMax: 50,
} as const

/** CSV 헤더(순서 고정, Export 가 이 순서로 쓴다). JSON 은 같은 키의 객체 배열(또는 `{entries:[…]}`). */
export const LEXICON_CSV_COLUMNS = ['surface', 'reading', 'accentType', 'priority', 'scope', 'scopeRefId', 'wordType', 'note', 'enabled'] as const
export type LexiconCsvColumn = (typeof LEXICON_CSV_COLUMNS)[number]

/** PRODUCTION 환경 쓰기에 필요한 확인 문구(본문 `confirm` 값). `config.apply.production`(SUPER_ADMIN)도 함께 필요. */
export const LEXICON_PRODUCTION_CONFIRM = 'PRODUCTION'

/**
 * 오류 갈래(`data.details.reason`). 화면은 HTTP status 로 먼저 나누고 같은 status 안에서 이 값으로 가른다.
 *   409 CONFLICT      : VERSION_CONFLICT(details.baseVersion·currentVersion) · E_LEXICON_DUPLICATE(details.existing·existingId) · ALREADY_ACTIVE · NO_CHANGE
 *   422 UNPROCESSABLE : E_LEXICON_ENTRY_INVALID(details.errors·fields) · E_IMPORT_HAS_ERRORS(details.counts·errors) · E_IMPORT_FORMAT · E_IMPORT_HEADER
 *                       · E_IMPORT_TOO_MANY_ROWS · E_IMPORT_TOO_LARGE · E_PREVIEW_TEXT_TOO_LONG
 *   403 FORBIDDEN     : details.missing(['config.apply.production'] 등) · PRODUCTION_CONFIRMATION_REQUIRED
 */
export type LexiconErrorReason =
  | 'VERSION_CONFLICT'
  | 'E_LEXICON_DUPLICATE'
  | 'ALREADY_ACTIVE'
  | 'NO_CHANGE'
  | 'E_LEXICON_ENTRY_INVALID'
  | 'E_IMPORT_HAS_ERRORS'
  | 'E_IMPORT_FORMAT'
  | 'E_IMPORT_HEADER'
  | 'E_IMPORT_TOO_MANY_ROWS'
  | 'E_IMPORT_TOO_LARGE'
  | 'E_PREVIEW_TEXT_TOO_LONG'
  | 'PRODUCTION_CONFIRMATION_REQUIRED'

/**
 * 칸 오류 코드(422 `details.errors[].code`·`details.fields[field]`). 같은 코드 안의 세부(빈 값·길이)는 화면이 입력값으로 구분한다.
 * 가져오기 행 전용: E_DUPLICATE_IN_FILE(같은 키가 파일에 두 번, 뒤 행) · E_ROW_FORMAT(칸 수 초과·객체 아님).
 */
export type LexiconFieldCode =
  | 'E_SURFACE'
  | 'E_SURFACE_NOT_JA'
  | 'E_SURFACE_CHARS'
  | 'E_READING'
  | 'E_ACCENT'
  | 'E_PRIORITY'
  | 'E_SCOPE'
  | 'E_SCOPE_REF'
  | 'E_SCOPE_REF_NOT_FOUND'
  | 'E_WORD_TYPE'
  | 'E_NOTE'
  | 'E_ENABLED'
  | 'E_IMMUTABLE'
  | 'E_REASON'
  | 'E_DUPLICATE_IN_FILE'
  | 'E_ROW_FORMAT'

export type LexiconImportMode = 'MERGE' | 'REPLACE_SCOPE'
export type LexiconFormat = 'csv' | 'json'
export type LexiconVersionStatus = 'ACTIVE' | 'SUPERSEDED' | 'ROLLED_BACK'

/** 항목 값(식별자·시각 제외) — 스냅샷·Import·diff 공통 모양. */
export interface LexiconEntryFields {
  surface: string
  /** 가타카나·長音符(ー)만(저장값). 화면은 히라가나 입력을 보내기 전에 가타카나로 바꾼다. */
  reading: string
  /** 악센트 핵 모라 위치(0 = 平板, ≤ 모라 수). 지금 소리(방식 A 치환)에는 반영되지 않는다 — 저장만. */
  accentType: number
  priority: number
  scope: LexiconScopeName
  scopeRefId: string | null
  wordType: LexiconWordType | null
  note: string | null
  enabled: boolean
}

export interface LexiconEntryDto extends LexiconEntryFields {
  id: string
  moraCount: number
  createdAt: string
  updatedAt: string
}

export interface LexiconFieldError {
  field: LexiconCsvColumn | 'reason' | 'row' | 'file'
  code: LexiconFieldCode | string
  message: string
}

export interface LexiconActorDto {
  /** User.name(없으면 감사 행의 이메일). 작업자가 없으면(시드) actor 자체가 null — 화면은 "시스템". */
  name: string | null
  role: AdminRole | null
}

export interface LexiconVersionDto {
  version: number
  status: LexiconVersionStatus
  createdAt: string
  actor: LexiconActorDto | null
  /** 되돌림은 "v7 로 되돌림: {이유}". */
  changeSummary: string | null
  entryCount: number
  enabledCount: number
  snapshotHash: string
  /** 감사 행의 변경 이유·action(`lexicon.create|update|disable|import|rollback`) — 시드는 null. */
  reason: string | null
  action: string | null
  /** Rollback 으로 만든 버전이면 복원한 원본 번호. */
  restoredFrom: number | null
}

export interface LexiconVersionRefDto {
  version: number
  createdAt: string
}

/** `GET /lexicon` — 페이지 번호 방식(1부터), 정렬 updatedAt desc(기본). counts·active 는 필터와 무관한 사전 전체. */
export interface LexiconListDto {
  environment: AdminEnvironment
  items: LexiconEntryDto[]
  page: number
  pageSize: number
  total: number
  /** 현재 ACTIVE 버전 번호(없으면 0) — 쓰기 요청의 `baseVersion`. */
  dictionaryVersion: number
  counts: { enabled: number; disabled: number }
  active: LexiconVersionDto | null
}

/** 쓰기 결과(추가·수정·비활성). 변경이 없으면 `changed:false` 이고 버전·감사는 만들지 않는다(version = 지금 ACTIVE). */
export interface LexiconWriteResultDto {
  changed: boolean
  entry: LexiconEntryDto | null
  version: LexiconVersionRefDto
  previousVersion: number | null
  /** POST 가 같은 키의 꺼진 항목을 되살렸다(같은 id). */
  revived?: boolean
}

/** diff 행의 항목 값 — 옛 스냅샷(시드 v1)에는 note 가 없어 undefined 일 수 있다. */
export type LexiconSnapshotRowDto = Omit<LexiconEntryFields, 'note'> & { note?: string | null }

export type LexiconDiffKind = 'ADDED' | 'CHANGED' | 'DISABLED' | 'ENABLED'

export interface LexiconDiffRowDto {
  kind: LexiconDiffKind
  surface: string
  scope: LexiconScopeName
  scopeRefId: string | null
  before: LexiconSnapshotRowDto | null
  after: LexiconSnapshotRowDto | null
  /** 가져오기 변경 행이면 파일 행 번호(REPLACE_SCOPE 끄기는 null). */
  row?: number | null
}

export interface LexiconDiffCountsDto {
  added: number
  changed: number
  disabled: number
  enabled: number
}

export interface LexiconVersionListDto {
  environment: AdminEnvironment
  items: LexiconVersionDto[]
  page: number
  pageSize: number
  total: number
  activeVersion: number
}

/** `GET /versions/:v?compare=previous|active` — `against`(바로 앞 버전 또는 지금 ACTIVE) → 이 버전으로 가는 변화. */
export interface LexiconVersionDetailDto extends LexiconVersionDto {
  compare: 'previous' | 'active'
  against: number | null
  counts: LexiconDiffCountsDto
  rows: LexiconDiffRowDto[]
  /** rows 에 싣지 못한 나머지 행 수(0 이면 전부). */
  truncated: number
}

export interface LexiconImportErrorDto {
  /** 데이터 행 번호(1부터, CSV 머리글 제외). */
  row: number
  field: string | null
  code: string
}

export interface LexiconImportScopeDto {
  scope: LexiconScopeName
  scopeRefId: string | null
  /** 이 묶음에서 꺼질 항목 수(REPLACE_SCOPE). MERGE 는 0. */
  disable: number
}

export interface LexiconImportResultDto {
  dryRun: boolean
  mode: LexiconImportMode
  format: LexiconFormat
  /** dryRun 을 계산한 ACTIVE 번호 — 적용 요청의 baseVersion 으로 그대로 보낸다. */
  baseVersion: number
  /** 파일의 데이터 행 수. */
  rows: number
  counts: { add: number; update: number; disable: number; unchanged: number; error: number }
  scopes: LexiconImportScopeDto[]
  changes: LexiconDiffRowDto[]
  changesTruncated: number
  errors: LexiconImportErrorDto[]
  errorsTruncated: number
  /** 알 수 없는 CSV 열·JSON 키(적용을 막지 않음) — `UNKNOWN_COLUMN:x`·`UNKNOWN_KEY:x`. */
  warnings: string[]
  /** 적용 요청에서 새 버전을 만들었는가(dryRun·변경 0 이면 false). */
  applied: boolean
  /** 적용 요청(dryRun=0)이면 처리 뒤 ACTIVE, dryRun 이면 null. */
  version: LexiconVersionRefDto | null
}

export interface LexiconRollbackResultDto {
  version: LexiconVersionRefDto
  replaced: { version: number; status: 'ROLLED_BACK' }
  restoredFrom: number
  /** 되돌리며 항목 표가 바뀐 건수. */
  counts: { add: number; update: number; disable: number }
}

export interface LexiconPreviewMatchDto {
  surface: string
  reading: string
  accentType: number
  scope: LexiconScopeName
  source: 'DRAFT' | 'ACTIVE'
}

/** 읽기 확인 결과 한 쪽 — 엔진이 실제로 읽을 가나와 악센트(`↑`상승·`↓`하강, 구두점에서 끊김). */
export interface LexiconPreviewSideDto {
  normalizedText: string
  reading: string
  accent: string
  /** 적용된 사전 항목(문장 안 등장마다 1개 — 개수 = 적용 횟수, 최대 50). */
  matches: LexiconPreviewMatchDto[]
  /** 이 API 는 서명 URL 을 주지 않는다 — 소리는 같은 경로를 `Accept: audio/wav` + `side` 로 다시 부른다. 늘 null. */
  audioUrl: null
}

export interface LexiconPreviewDto {
  /** 지금 ACTIVE 사전 버전(초안은 저장되지 않는다). */
  dictionaryVersion: number
  voiceId: string
  /** 지금 사전(ACTIVE)으로 읽기. */
  before: LexiconPreviewSideDto
  /** `compare:true` 일 때만 — 지금 사전 + 초안(초안이 같은 키의 저장 항목을 대신하고 범위 문맥과 무관하게 적용). */
  after: LexiconPreviewSideDto | null
  traceId: string
}
