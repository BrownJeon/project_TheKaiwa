/**
 * 콘솔 화면 라벨·문구(screens.md §6-8). 순수 모듈 — 단위 테스트 대상.
 * 콘솔은 엔진·모델명을 보여 주는 곳이지만(G6) 이 파일에는 엔진 이름을 적지 않는다 — 이름은 서버 DTO(`engineName`·`displayName`)가 준다.
 */
import type {
  AdminEnvironment,
  AdminMenuItem,
  ConfigSourceName,
  ConnectionTypeName,
  EditabilityName,
  EngineRoleName,
  EngineStatusName,
  HealthKindName,
  HealthSkipReason,
  TraceKindName,
  TraceStatusName,
  VoiceStatusName,
} from '@/types/admin'

export const ROLE_ORDER: readonly EngineRoleName[] = ['REALTIME_STT', 'ANALYSIS_STT', 'TTS', 'LLM']

export const ROLE_LABEL: Record<EngineRoleName, string> = {
  REALTIME_STT: 'Realtime STT',
  ANALYSIS_STT: 'Analysis STT',
  TTS: 'TTS',
  LLM: 'LLM',
}

export const ROLE_KO: Record<EngineRoleName, string> = {
  REALTIME_STT: '실시간 음성 인식',
  ANALYSIS_STT: '분석용 음성 인식',
  TTS: '선생님 목소리 합성',
  LLM: '대답·교정·레슨 생성',
}

export const ROLE_DESC: Record<EngineRoleName, string> = {
  REALTIME_STT: '회화 중 학습자의 말을 바로 글자로 바꿔요. 기본은 휴대폰 안에서, 안 되면 서버에서.',
  ANALYSIS_STT: '대화가 끝난 뒤 녹음을 다시 정확하게 받아 적어요(발음·교정 분석용).',
  TTS: '선생님 목소리로 문장을 읽어 줘요.',
  LLM: '선생님의 대답·교정·레슨·평가를 만들어요.',
}

export const ROLE_PATH: Record<EngineRoleName, string> = {
  REALTIME_STT: '/admin/speech/realtime',
  ANALYSIS_STT: '/admin/speech/analysis',
  TTS: '/admin/speech/tts',
  LLM: '/admin/llm',
}

export function isEngineRole(v: string): v is EngineRoleName {
  return (ROLE_ORDER as readonly string[]).includes(v)
}

export const CONN_TYPE_KO: Record<ConnectionTypeName, string> = {
  ONDEVICE: '휴대폰(ONDEVICE)',
  HTTP: 'HTTP 서비스',
  CLI: '명령줄(CLI)',
  LOCAL: '로컬 작업자(LOCAL)',
}

/** 상태 뱃지 값 — EngineStatus + 테스트 결과(`resultView`). */
export type BadgeValue = EngineStatusName | 'PASSED' | 'FAILED' | 'TIMEOUT' | 'SKIPPED'

export const STATUS_KO: Record<BadgeValue, string> = {
  HEALTHY: '정상',
  DEGRADED: '저하',
  UNAVAILABLE: '응답 없음',
  MISCONFIGURED: '설정 오류',
  DISABLED: '꺼짐',
  UNKNOWN: '미확인',
  PASSED: '통과',
  FAILED: '실패',
  TIMEOUT: '시간 초과',
  SKIPPED: '건너뜀',
}

export const SOURCE_ORDER: readonly ConfigSourceName[] = [
  'DEFAULT',
  'SOURCE_CODE',
  'APPLICATION_CONFIG',
  'ENVIRONMENT',
  'DATABASE',
  'CONNECTION_PROFILE',
  'USER_SETTING',
  'RUNTIME_OVERRIDE',
]

/** 층 번호(configuration-resolution §2, 1 = 가장 낮음). */
export function sourceLayer(s: ConfigSourceName): number {
  return SOURCE_ORDER.indexOf(s) + 1
}

export const SOURCE_KO: Record<ConfigSourceName, string> = {
  DEFAULT: '스키마 기본값',
  SOURCE_CODE: '코드 상수',
  APPLICATION_CONFIG: '설정 파일(yml)',
  ENVIRONMENT: '환경 변수',
  DATABASE: '콘솔 적용값',
  CONNECTION_PROFILE: '연결 프로필',
  USER_SETTING: '사용자 설정',
  RUNTIME_OVERRIDE: '임시 덮어쓰기',
}

export const EDITABILITY_KO: Record<EditabilityName, string> = {
  READ_ONLY: '읽기 전용',
  RUNTIME_EDITABLE: '즉시 반영',
  RESTART_REQUIRED: '재시작 필요',
  REDEPLOY_REQUIRED: '재배포 필요',
  SECRET: '시크릿(참조만)',
}

export function editabilityText(e: EditabilityName, restartRequired?: boolean): string {
  if (restartRequired && e !== 'RESTART_REQUIRED' && e !== 'REDEPLOY_REQUIRED' && e !== 'SECRET') return EDITABILITY_KO.RESTART_REQUIRED
  return EDITABILITY_KO[e] ?? e
}

export const HEALTH_KIND_KO: Record<HealthKindName, string> = {
  HEALTH: '상태 확인',
  FUNCTIONAL: '기능 테스트',
}

export const TRACE_KIND_KO: Record<TraceKindName, string> = {
  TURN: '회화 턴',
  PREVIEW: '미리듣기',
  PLAYGROUND: '플레이그라운드',
  E2E: 'E2E',
  FUNCTIONAL_TEST: '기능 테스트',
}

export const TRACE_STATUS_KO: Record<TraceStatusName, string> = {
  OK: '정상',
  PARTIAL: '일부 실패',
  ERROR: '실패',
}

export const STEP_STATUS_KO: Record<string, string> = {
  OK: '정상',
  FAILED: '실패',
  TIMEOUT: '시간 초과',
  SKIPPED: '건너뜀',
  FALLBACK: '예비로 넘김',
}

export interface VoiceBadgeView {
  label: string
  tone: 'good' | 'neutral' | 'bad' | 'dashed'
}

export function voiceBadge(status: VoiceStatusName, enabled: boolean): VoiceBadgeView {
  switch (status) {
    case 'AVAILABLE':
      return enabled ? { label: '사용 가능', tone: 'good' } : { label: '꺼짐', tone: 'neutral' }
    case 'DISABLED':
      return { label: '꺼짐', tone: 'neutral' }
    case 'ERROR':
      return { label: '오류', tone: 'bad' }
    case 'IMPORTING':
      return { label: '가져오는 중', tone: 'dashed' }
    case 'VALIDATING':
      return { label: '검증 중', tone: 'dashed' }
    case 'DELETING':
      return { label: '삭제 중', tone: 'neutral' }
    case 'ARCHIVED':
      return { label: '보관됨', tone: 'neutral' }
    default:
      return { label: String(status), tone: 'neutral' }
  }
}

/** Voices 화면 필터 칩 — 받은 목록을 화면에서 거른다. */
export type VoiceFilter = 'ALL' | 'AVAILABLE' | 'OFF' | 'ERROR'

export function voiceFilterOf(status: VoiceStatusName, enabled: boolean): Exclude<VoiceFilter, 'ALL'> | null {
  if (status === 'AVAILABLE' && enabled) return 'AVAILABLE'
  if (status === 'ERROR') return 'ERROR'
  if (status === 'DISABLED' || status === 'AVAILABLE') return 'OFF'
  return null
}

export const ENV_KO: Record<AdminEnvironment, string> = {
  PRODUCTION: '운영',
  LOCAL: '개발',
  DEVELOPMENT: '개발 서버',
  STAGING: '스테이징',
}

export function envMessage(env: AdminEnvironment): string {
  if (env === 'PRODUCTION') return '운영 환경 — 변경은 확인 절차를 거칩니다'
  if (env === 'LOCAL') return '개발 환경 — 운영과 분리된 설정 행을 봐요'
  return `${env} 환경`
}

/** 환경 띠·알약 클래스(§6-2 A). PRODUCTION 은 빨간 띠 — 숨길 수 없다. */
export function envTone(env: AdminEnvironment): { strip: string; pill: string } {
  if (env === 'PRODUCTION') return { strip: 'bg-bad text-surface', pill: 'bg-surface text-bad' }
  if (env === 'LOCAL') return { strip: 'bg-surface2 text-ink2', pill: 'border border-ink2 text-ink' }
  return { strip: 'bg-surface2 text-ink', pill: 'border border-ink text-ink' }
}

// ── 메뉴(값은 서버 `menu.ts`, 여기는 표시용 묶음 이름·설명만) ─────────────────────────

const GROUP_KO: Record<AdminMenuItem['group'], string> = {
  overview: '개요',
  speech: '엔진',
  llm: '엔진',
  voices: '자원',
  engines: '자원',
  configuration: '설정·진단',
  diagnostics: '설정·진단',
  tools: '도구',
}

export function menuGroupLabel(group: AdminMenuItem['group']): string {
  return GROUP_KO[group] ?? group
}

const MENU_SUB: Record<string, string> = {
  dashboard: '역할별 엔진·상태 한눈에',
  'speech-realtime': '실시간 음성 인식',
  'speech-analysis': '분석용 음성 인식',
  'speech-tts': '선생님 목소리 합성',
  'speech-tts-lexicon': '읽기·악센트 고치기·버전',
  llm: '대답·교정·레슨 생성',
  voices: '목소리 목록',
  connections: '연결·Health·기능 테스트',
  plugins: '엔진 플러그인 로드 상태',
  configuration: '실제 적용값과 출처',
  diagnostics: 'Health 기록·요청 Trace',
}

export function menuSub(id: string): string | null {
  return MENU_SUB[id] ?? null
}

/** 같은 묶음 이름이 이어지는 메뉴를 한 무리로(서버 순서 유지). */
export function groupMenu(menu: readonly AdminMenuItem[]): { label: string; items: AdminMenuItem[] }[] {
  const out: { label: string; items: AdminMenuItem[] }[] = []
  for (const m of menu) {
    const label = menuGroupLabel(m.group)
    const last = out.at(-1)
    if (last && last.label === label) last.items.push(m)
    else out.push({ label, items: [m] })
  }
  return out
}

/** `pathname` 을 메뉴 `path` 의 가장 긴 접두사로 찾는다(`/admin/connections/abc` → 연결). */
export function activeMenu(menu: readonly AdminMenuItem[], pathname: string): AdminMenuItem | null {
  let best: AdminMenuItem | null = null
  for (const m of menu) {
    if (pathname === m.path || pathname.startsWith(`${m.path}/`)) {
      if (!best || m.path.length > best.path.length) best = m
    }
  }
  return best
}

// ── 상태 확인·기능 테스트 문구(§6-8 ⓑ) ────────────────────────────────────────

export function panelHelp(connectionType: ConnectionTypeName, role: EngineRoleName): string {
  if (connectionType === 'ONDEVICE') {
    return '상태 확인은 서버에 있는 기기용 모델 파일 목록을 봐요. 기능 테스트는 휴대폰 안에서만 할 수 있어요(앱 기기 테스트는 나중에 열려요).'
  }
  if (connectionType === 'CLI' || role === 'LLM') {
    return '상태 확인은 실행 파일이 뜨는지 봐요. 기능 테스트는 짧은 JSON 질문을 한 번 보내요(30초에 한 번).'
  }
  return '상태 확인은 서비스가 응답하는지만 봐요(최대 5초). 기능 테스트는 실제로 한 번 실행해요(최대 30초).'
}

export const SKIP_TEXT: Record<HealthSkipReason | 'TEST_ASSET_PENDING', string> = {
  NOT_APPLICABLE: '휴대폰 안에서 도는 연결이라 서버에서는 테스트하지 않아요.',
  SERVICE_DOWN: '서비스가 꺼져 있어 기능 테스트를 건너뛰었어요.',
  NOT_IMPLEMENTED: '이 기능 테스트는 아직 열리지 않았어요(테스트 자료 준비 중).',
  TEST_ASSET_PENDING: '테스트 자료가 아직 준비되지 않아 건너뛰었어요.',
}

export const UNAVAILABLE_HINT = '서비스가 꺼져 있으면 정상적인 결과예요. 서비스를 켠 뒤 다시 확인해 주세요.'

const ERROR_CODE_TEXT: Record<string, string> = {
  E_HEALTH_CONNECTION_REFUSED: '서비스에 연결할 수 없어요(연결 거부)',
  ECONNREFUSED: '서비스에 연결할 수 없어요(연결 거부)',
  ENOTFOUND: '서비스 주소를 찾을 수 없어요',
  EAI_AGAIN: '서비스 주소를 찾을 수 없어요',
  EHOSTUNREACH: '서비스가 있는 기기에 닿지 않아요',
  ENETUNREACH: '서비스가 있는 기기에 닿지 않아요',
  ECONNRESET: '서비스가 연결을 끊었어요',
  NETWORK_ERROR: '네트워크 오류로 서비스에 닿지 못했어요',
  E_HEALTH_AUTH: '인증에 실패했어요 — 시크릿 참조를 확인하세요',
  E_TEST_AUTH: '인증에 실패했어요 — 시크릿 참조를 확인하세요',
  AUTH_FAILED: '인증에 실패했어요 — 시크릿 참조를 확인하세요',
  E_HEALTH_CREDENTIAL_MISSING: '시크릿 참조를 찾을 수 없어요',
  CREDENTIAL_MISSING: '시크릿 참조를 찾을 수 없어요',
  E_HEALTH_MODEL_NOT_LOADED: '서비스는 켜졌지만 모델이 아직 올라오지 않았어요',
  MODEL_NOT_LOADED: '서비스는 켜졌지만 모델이 아직 올라오지 않았어요',
  E_HEALTH_MANIFEST_MISSING: '기기용 모델 파일 목록이 없거나 버전이 달라요',
  E_HEALTH_MANIFEST_VERSION: '기기용 모델 파일 목록이 없거나 버전이 달라요',
  MANIFEST_MISSING: '기기용 모델 파일 목록이 없거나 버전이 달라요',
  ENOENT: '실행 파일을 찾을 수 없어요',
  SPAWN_FAILED: '실행 파일을 실행하지 못했어요',
  PLUGIN_NOT_LOADED: '엔진 플러그인이 로드되지 않았어요',
  CHECK_FAILED: '상태 확인을 실행하지 못했어요',
  CONFIG_INVALID: '연결 설정이 올바르지 않아요',
  INVALID_URL: '연결 주소 설정이 올바르지 않아요',
  NOT_SUPPORTED: '이 연결은 이 검사를 지원하지 않아요',
  E_TEST_UPSTREAM: '서비스 호출이 실패했어요',
  E_TEST_OUTPUT_INVALID: '결과 형식이 기준에 맞지 않아요',
  SCHEMA_INVALID: '결과 형식이 기준에 맞지 않아요',
  E_TEST_NOT_APPLICABLE: '(건너뜀) 휴대폰 안에서 도는 연결이라 서버에서는 테스트하지 않아요',
  NOT_APPLICABLE: '(건너뜀) 휴대폰 안에서 도는 연결이라 서버에서는 테스트하지 않아요',
  E_TEST_INPUT_MISSING: '(건너뜀) 테스트 자료가 아직 준비되지 않았어요',
}

const TIMEOUT_CODES = new Set(['E_HEALTH_TIMEOUT', 'E_TEST_TIMEOUT', 'ETIMEDOUT'])

export function isTimeoutCode(code: string | null | undefined): boolean {
  return Boolean(code && TIMEOUT_CODES.has(code))
}

/**
 * 오류 코드 → 사유 한 줄. 모르는 코드는 서버가 준 고정 문구(`message`), 그것도 없으면 "실패했어요 ({code})".
 * `detail` 은 숫자 보조값(timeoutMs·httpStatus·cer)만 읽는다.
 */
export function errorCodeText(code: string, detail: Record<string, unknown> | null = null, fallbackMessage?: string | null): string {
  const num = (k: string) => {
    const v = detail?.[k]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  if (TIMEOUT_CODES.has(code)) {
    const ms = num('timeoutMs')
    return ms ? `응답이 없어요(시간 초과 ${Math.round(ms / 1000)}초)` : '응답이 없어요(시간 초과)'
  }
  const http = /^HTTP_(\d{3})$/.exec(code)
  if (http || code === 'E_HEALTH_HTTP_STATUS') {
    const status = http ? Number(http[1]) : num('httpStatus')
    return status ? `서비스가 오류로 응답했어요(HTTP ${status})` : '서비스가 오류로 응답했어요'
  }
  const exit = /^EXIT_(\w+)$/.exec(code)
  if (exit) return exit[1] === 'SIGNAL' ? '실행 파일이 신호로 중단됐어요' : `실행 파일이 오류로 끝났어요(종료 코드 ${exit[1]})`
  if (code === 'E_TEST_ACCURACY') {
    const cer = num('cer')
    return cer !== null ? `결과가 기준에 못 미쳐요 (CER ${cer})` : '결과가 기준에 못 미쳐요'
  }
  const known = ERROR_CODE_TEXT[code]
  if (known) return known
  if (fallbackMessage) return fallbackMessage
  return `실패했어요 (${code})`
}
