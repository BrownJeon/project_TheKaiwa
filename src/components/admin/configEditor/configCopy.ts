/**
 * 설정 편집 화면 문구·라벨(task-012c, 승인 데모 v2). 순수 모듈 — 단위 테스트 대상.
 * 엔진 이름은 적지 않는다(이름은 서버 DTO 가 준다). 잠금 이유 뜻은 서버 `lockMessage` 가 정본이고 여기는 짧은 뱃지 이름만.
 */
import type {
  ConfigEditScopeName,
  ConfigLockReason,
  ConfigRuleName,
  ConfigVerifiable,
  ConfigVersionOrigin,
  ConfigVersionStatusName,
  ConfigScopeName,
} from '@/types/admin'

/** 화면에서만 쓰는 잠금 두 가지: env 가 덮음(SHADOW) · 운영에서 실행 검증 방법이 없는 키(NOVERIFY). */
export type FieldLock = ConfigLockReason | 'SHADOW' | 'NOVERIFY'

export const LOCK_BADGE: Record<FieldLock, string> = {
  READ_ONLY: '읽기 전용',
  RESTART_REQUIRED: '재시작 필요',
  CREDENTIAL_ONLY: '비밀 참조 전용',
  DEFERRED: '편집 보류',
  SERVICE_MANAGED: '서비스 관리',
  NOT_CONSUMED: '앱이 안 씀',
  ENV_PINNED: '서버 주소 고정',
  AUTO: '자동',
  POLICY: '환경 정책',
  SHADOW: '환경 변수가 덮음',
  NOVERIFY: '운영 잠금',
}

/** 화면에서 만든 두 잠금의 설명(서버 잠금은 서버 `lockMessage` 를 그대로 쓴다). */
export const CLIENT_LOCK_WHY: Record<'SHADOW' | 'NOVERIFY', string> = {
  SHADOW: '환경 변수가 이 값을 덮고 있어 잠갔어요 — 여기서 바꿔도 효력이 없어요.',
  NOVERIFY: '실행으로 확인할 방법이 없는 키라 운영에서는 콘솔로 바꾸지 않아요(개발 환경에서는 바꿀 수 있어요).',
}

/** 서버 lockMessage 가 비었을 때의 대체 설명. */
export const LOCK_WHY_FALLBACK: Record<ConfigLockReason, string> = {
  READ_ONLY: '읽기 전용이에요.',
  RESTART_REQUIRED: '재시작해야 반영되는 키라 이번 단계에서는 콘솔로 바꾸지 않아요(서버 설정·배포로).',
  CREDENTIAL_ONLY: '비밀 참조는 [비밀 참조 연결]에서만 바꿔요.',
  DEFERRED: '콘솔 편집을 보류한 키예요.',
  SERVICE_MANAGED: '서비스 설정 파일에서 관리해요 — 콘솔에서 바꾸지 않아요.',
  NOT_CONSUMED: '앱이 이 값을 읽지 않아 바꿔도 효력이 없어요.',
  ENV_PINNED: '서버 환경 변수 주소로 고정돼 있어요.',
  AUTO: '다른 값이 바뀔 때 자동으로 올라가요.',
  POLICY: '환경 정책 키예요 — 나중(Phase 4)에 정책 화면에서 따로 열려요.',
}

export const SCOPE_KO: Record<ConfigScopeName, string> = {
  ENGINE_CONNECTION: '연결',
  FALLBACK_POLICY: '예비 순서',
  APP_SETTING: '운영 설정',
  VOICE_PROFILE: '목소리 기본값',
  PROMPT: '프롬프트',
  PRESET: '프리셋',
  LEXICON: '발음 사전',
}

export const EDIT_SCOPE_OPTIONS: readonly { value: ConfigEditScopeName; label: string }[] = [
  { value: 'ENGINE_CONNECTION', label: '연결' },
  { value: 'APP_SETTING', label: '운영 설정' },
]

export const ORIGIN_KO: Record<ConfigVersionOrigin, string> = {
  BASELINE: '기준선',
  APPLY: 'Form',
  RAW_JSON: 'Raw JSON',
  ROLLBACK: '되돌리기',
}

export const VERSION_STATUS_KO: Record<ConfigVersionStatusName, string> = {
  ACTIVE: '사용 중',
  SUPERSEDED: '이전',
  ROLLED_BACK: '되돌려짐',
}

export const VERIFIABLE_KO: Record<ConfigVerifiable, string> = {
  YES: '실행 검증',
  NO: '실행 검증 없음',
  NOT_NEEDED: '테스트 불요',
  DYNAMIC: '값에 따라 검증',
}

export const RULE_KO: Record<ConfigRuleName, string> = {
  type: '형식',
  min: '최솟값',
  max: '최댓값',
  enum: '선택지',
  pattern: '모양',
  maxLength: '길이',
  required: '필수',
  unknownKey: '없는 키',
  readOnly: '바꿀 수 없음',
  secretValue: '비밀 값',
  dependency: '의존성',
  reference: '참조',
  serviceManaged: '서비스 관리',
  hostNotAllowed: '허용 안 된 주소',
  refNotAllowed: '허용 안 된 참조',
  restartRequired: '재시작 필요',
}

/** 운영 설정(AppSetting) 키 — 서버 `appSettingSchema` 와 같은 순서·이름(api-contract #123b). 목록 조회 API 가 없어 화면이 아는 키만 칩으로 보인다. */
export interface AppSettingMeta {
  key: string
  label: string
  /** 여러 줄 입력(일본어 문장). */
  multiline?: boolean
  ja?: boolean
  /** 값이 목소리 id(목소리 목록에서 고른다). */
  voice?: boolean
}

export const APP_SETTING_KEYS: readonly AppSettingMeta[] = [
  { key: 'voice.preview.defaultText', label: '미리듣기 문장', multiline: true, ja: true },
  { key: 'voice.default.profileId', label: '기본 목소리', voice: true },
  { key: 'speech.review.threshold', label: '다시 확인할 인식 신뢰도' },
  { key: 'voice.preview.textVersion', label: '미리듣기 버전' },
  { key: 'override.production.enabled', label: '운영 임시 덮어쓰기' },
  { key: 'debug.production.maxTtlMinutes', label: '운영 디버그 최대 시간(분)' },
  { key: 'loglevel.production.maxLevel', label: '운영 로그 레벨 상한' },
  { key: 'speech.audio.retentionDays', label: '녹음 보관 일수' },
  { key: 'trace.retentionDays', label: '요청 기록 보관 일수' },
]

export function appSettingMeta(key: string): AppSettingMeta | null {
  return APP_SETTING_KEYS.find((m) => m.key === key) ?? null
}

/**
 * 칸 이름 — 서버 설명(`description`)의 첫 마디(" — ", ". ", " → " 앞, 40자). 설명이 없으면 키의 마지막 두 마디.
 * 원문 설명이 잘렸으면 `rest` 로 돌려 도움말에 그대로 싣는다.
 */
export function fieldLabel(description: string | null | undefined, key: string): { label: string; rest: string | null } {
  const d = (description ?? '').trim()
  if (!d) return { label: key.split('.').slice(-2).join('.'), rest: null }
  const cuts = [' — ', '. ', ' → '].map((s) => d.indexOf(s)).filter((i) => i > 0)
  const first = cuts.length ? d.slice(0, Math.min(...cuts)).trim() : d
  const label = Array.from(first).length > 40 ? `${Array.from(first).slice(0, 39).join('')}…` : first
  return { label, rest: label === d ? null : d }
}

// ── 감사(#137) ─────────────────────────────────────────────────────────────

export const ACTION_KO: Record<string, string> = {
  'config.apply': '설정 적용',
  'config.raw_apply': '설정 적용(Raw JSON)',
  'config.rollback': '설정 되돌리기',
  'config.baseline': '기준선 저장',
  'config.raw.read': '운영 원문 조회',
  'credentials.set': '비밀 참조 연결',
  'credentials.clear': '비밀 참조 해제',
  'engine.connections.enable': '연결 켜기',
  'engine.connections.disable': '연결 끄기',
  'secrets.read_ref': '비밀 참조 목록 조회',
  'lexicon.create': '발음 사전 항목 추가',
  'lexicon.update': '발음 사전 항목 수정',
  'lexicon.disable': '발음 사전 항목 끄기',
  'lexicon.import': '발음 사전 가져오기',
  'lexicon.rollback': '발음 사전 되돌리기',
}

export function actionLabel(action: string): string {
  return ACTION_KO[action] ?? action
}

/** 감사 필터 "작업" 선택지(서버 `action` 필터 — 끝이 `.` 면 접두). */
export const ACTION_FILTERS: readonly { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'config.apply', label: '설정 적용' },
  { value: 'config.raw_apply', label: '설정 적용(Raw JSON)' },
  { value: 'config.rollback', label: '설정 되돌리기' },
  { value: 'config.baseline', label: '기준선 저장' },
  { value: 'credentials.', label: '비밀 참조 연결·해제' },
  { value: 'engine.connections.', label: '연결 켜기·끄기' },
  { value: 'secrets.read_ref', label: '비밀 참조 목록 조회' },
  { value: 'config.raw.read', label: '운영 원문 조회' },
  { value: 'lexicon.', label: '발음 사전 작업' },
]
