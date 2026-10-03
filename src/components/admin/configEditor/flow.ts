/**
 * 적용 막대 상태 전이(task-012c, 데모 v2 "검증 → 테스트 → 요약 → 적용") · 확인 창 입력 검사 · 쓰기 실패 해석 — 순수 모듈(단위 테스트 대상).
 *
 * - 운영(PRODUCTION): 기능 테스트 필수(바뀐 키가 전부 테스트 불요면 서버가 ok 를 준다), `partial`·`failed` 는 적용 불가, 적용은 최고관리자만.
 *   비 최고관리자는 초안·변경 요약까지(마지막 단계 🔒). 개발 환경은 테스트를 건너뛸 수 있고 `partial` 도 이어서 적용할 수 있다.
 * - 초안이 바뀌면 검증·요약은 처음부터(30초 테스트 대기는 유지).
 */
import type { Err } from '@/components/common/errors'
import type { ConfigIssueDto, ConfigTestDto } from '@/types/admin'

export type ValidateState = null | 'ok' | 'err'
/** wait = 30초 슬롯(429) 대기. */
export type TestState = null | 'run' | 'ok' | 'partial' | 'fail' | 'skip' | 'wait'

export interface FlowState {
  v: ValidateState
  t: TestState
  d: boolean
}

export const FLOW_START: FlowState = { v: null, t: null, d: false }

export function flowAfterEdit(f: FlowState): FlowState {
  return { v: null, t: f.t === 'wait' ? 'wait' : null, d: false }
}

export function testStateOf(dto: Pick<ConfigTestDto, 'status'>): 'ok' | 'partial' | 'fail' {
  return dto.status === 'ok' ? 'ok' : dto.status === 'partial' ? 'partial' : 'fail'
}

/** 테스트 단계를 지났는가(요약으로 갈 수 있는가). */
export function testPassed(t: TestState, production: boolean): boolean {
  return t === 'ok' || t === 'skip' || (t === 'partial' && !production)
}

export type StepState = 'done' | 'err' | 'cur' | 'lock' | 'skip' | 'idle'
export interface FlowStep {
  id: 'validate' | 'test' | 'diff' | 'apply'
  label: string
  state: StepState
  sym: string
}
export type FlowButtonId = 'discard' | 'validate' | 'test' | 'skip' | 'diff' | 'apply'
export interface FlowButton {
  id: FlowButtonId
  label: string
  primary: boolean
  disabled?: boolean
  busy?: boolean
}
/** 굵게 보일 조각은 `{ b }`. */
export type MsgPart = string | { b: string }

export interface FlowInput {
  flow: FlowState
  production: boolean
  canApply: boolean
  canTest: boolean
  syntaxError: boolean
  errorCount: number
  changeCount: number
  cooldownSec: number
  testSec: number
  onRawTab?: boolean
  /** 테스트 방법 안내(예: "미리듣기 합성 1회로 확인"). */
  testHint?: string | null
}

export interface FlowView {
  steps: FlowStep[]
  message: MsgPart[]
  buttons: FlowButton[]
}

export function flowView(i: FlowInput): FlowView {
  const { flow: f, production: p } = i
  const passed = testPassed(f.t, p)
  const s1: FlowStep = f.v === 'ok' ? { id: 'validate', label: '검증', state: 'done', sym: '✓' } : f.v === 'err' ? { id: 'validate', label: '검증', state: 'err', sym: '✗' } : { id: 'validate', label: '검증', state: 'cur', sym: '' }
  let s2: FlowStep
  if (f.t === 'ok') s2 = { id: 'test', label: '테스트', state: 'done', sym: '✓' }
  else if (f.t === 'partial') s2 = { id: 'test', label: '테스트', state: p ? 'err' : 'done', sym: '△' }
  else if (f.t === 'skip') s2 = { id: 'test', label: '테스트', state: 'skip', sym: '' }
  else if (f.t === 'fail') s2 = { id: 'test', label: '테스트', state: 'err', sym: '✗' }
  else s2 = { id: 'test', label: p ? '테스트(필수)' : '테스트', state: f.v === 'ok' ? 'cur' : 'idle', sym: '' }
  const s3: FlowStep = f.d ? { id: 'diff', label: '요약', state: 'done', sym: '✓' } : { id: 'diff', label: '요약', state: f.v === 'ok' && passed ? 'cur' : 'idle', sym: '' }
  const s4: FlowStep = !i.canApply ? { id: 'apply', label: '적용', state: 'lock', sym: '🔒' } : { id: 'apply', label: '적용', state: f.d ? 'cur' : 'idle', sym: '' }

  const buttons: FlowButton[] = [{ id: 'discard', label: '초안 버리기', primary: false }]
  let message: MsgPart[]
  if (i.syntaxError) {
    message = [{ b: 'JSON 문법 오류' }, '를 고쳐야 검증할 수 있어요']
    buttons.push({ id: 'validate', label: '검증', primary: true, disabled: true })
  } else if (f.v !== 'ok') {
    if (f.v === 'err') message = i.onRawTab ? [{ b: `오류 ${i.errorCount}건` }, ' — 편집기 아래 목록을 확인해 주세요'] : [{ b: `고칠 칸 ${i.errorCount}개` }, ' — 칸 아래 안내를 확인해 주세요']
    else message = ['바뀐 값 ', { b: `${i.changeCount}개` }, ' · 먼저 검증해요(저장하지 않아요)']
    buttons.push({ id: 'validate', label: '검증', primary: true })
  } else if (f.t === 'partial' && p) {
    message = [{ b: '실행으로 확인 못 한 키' }, '가 있어 운영에 적용할 수 없어요 — 그 키를 원래대로 돌리면 다시 테스트할 수 있어요']
  } else if (f.t === 'run') {
    message = ['기능 테스트 중… ', { b: `${i.testSec}초` }, ' (최대 30초)']
    buttons.push({ id: 'test', label: '테스트 중…', primary: true, disabled: true, busy: true })
  } else if (!passed) {
    const hint = i.testHint ? ` (${i.testHint})` : ''
    if (f.t === 'wait') message = ['이 연결은 ', { b: '30초에 한 번' }, '만 테스트할 수 있어요']
    else if (f.t === 'fail') message = [{ b: '테스트 실패' }, ' — 결과를 확인하고 값을 고쳐 주세요']
    else if (p && !i.canTest) message = ['운영은 기능 테스트가 필수인데 ', { b: '기능 테스트 권한' }, '이 없어요']
    else message = p ? ['운영은 ', { b: '기능 테스트가 필수' }, `예요${hint}`] : [`검증 통과 · 기능 테스트는 개발 환경에서 건너뛸 수 있어요${hint}`]
    if (!p) buttons.push({ id: 'skip', label: '요약 보기', primary: false })
    if (i.canTest) {
      const cooling = i.cooldownSec > 0
      buttons.push({ id: 'test', label: cooling ? `${i.cooldownSec}초 뒤 다시` : '기능 테스트', primary: true, disabled: cooling })
    }
  } else if (!f.d) {
    message = f.t === 'ok' ? ['테스트 통과 · 결과는 30분 동안 유효해요'] : f.t === 'partial' ? ['테스트 일부만 확인 · 개발 환경이라 이어서 할 수 있어요'] : ['테스트를 건너뛰었어요(개발 환경)']
    buttons.push({ id: 'diff', label: '변경 요약 보기', primary: true })
  } else if (i.canApply) {
    message = ['변경 요약을 확인했어요 · 이유를 적고 적용해요']
    buttons.push({ id: 'apply', label: p ? 'PRODUCTION 에 적용…' : '적용…', primary: true })
  } else {
    message = [{ b: '운영(PRODUCTION) 적용은 최고관리자(SUPER_ADMIN)만' }, ' 할 수 있어요 — 초안·변경 요약까지 만들 수 있어요']
  }
  return { steps: [s1, s2, s3, s4], message, buttons }
}

// ── 확인 창 입력 ───────────────────────────────────────────────────────────

export const REASON_MAX = 200
export const REASON_MIN_PRODUCTION = 10
export const PRODUCTION_CONFIRM = 'PRODUCTION'

/** 서버 저장 규칙과 같은 모양(줄바꿈·제어문자 → 공백 하나, 앞뒤 공백 제거). 길이는 코드포인트. */
export function normalizeReason(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim()
}

export function reasonLength(raw: string): number {
  return Array.from(normalizeReason(raw)).length
}

/** 이유 칸 미리 검사(길이만 — 비밀 유사 판정은 서버가 한다: 422 E_REASON_SECRET_LIKE). */
export function checkReasonInput(raw: string, production: boolean): string | null {
  const n = reasonLength(raw)
  if (n === 0) return '변경 이유를 적어 주세요.'
  if (production && n < REASON_MIN_PRODUCTION) return `운영 변경은 ${REASON_MIN_PRODUCTION}자 이상 적어 주세요(지금 ${n}자).`
  if (n > REASON_MAX) return `${REASON_MAX}자까지 적을 수 있어요(지금 ${n}자).`
  return null
}

export function checkConfirmInput(confirm: string, needed: boolean): string | null {
  return needed && confirm.trim() !== PRODUCTION_CONFIRM ? 'PRODUCTION 을 대문자로 그대로 입력해 주세요.' : null
}

export const REASON_SECRET_TEXT = '이유에 비밀처럼 보이는 글자(키·토큰)가 있어 저장하지 않았어요. 이유에는 비밀 값을 적지 마세요.'

// ── 쓰기 실패 해석 ─────────────────────────────────────────────────────────

export type NoticeAction = 'rebase' | 'discard' | 'remakeDiff' | 'retest' | 'roleLink' | 'reload'

export type WriteErrorView =
  | { kind: 'reason'; text: string }
  | { kind: 'confirm'; text: string }
  | { kind: 'fields'; errors: ConfigIssueDto[]; stage: string | null }
  | { kind: 'notice'; text: string; actions: NoticeAction[]; block: boolean }

const TEST_DETAIL_KO: Record<string, string> = {
  MISSING: '테스트 결과 없음',
  NOT_FOUND: '테스트 결과를 찾을 수 없음',
  NOT_OK: '통과하지 못한 테스트',
  EXPIRED: '30분이 지남',
  OTHER_TARGET: '다른 대상의 테스트',
  OTHER_CANDIDATE: '초안이 테스트 뒤에 바뀜',
  KEYS_NOT_TESTED: '확인 못 한 키가 있음',
  RELATED_NOT_OK: '함께 확인한 연결이 실패',
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** 적용·되돌리기·비밀 참조·켜기/끄기 쓰기 실패 → 화면 갈래(서버 `details.reason` 우선). */
export function writeErrorView(err: Err, ctx: { changeCount: number }): WriteErrorView {
  const d = err.details
  const reason = str(d.reason)
  if (err.status === 0) return { kind: 'notice', text: '연결하지 못했어요. 네트워크를 확인해 주세요.', actions: [], block: false }
  if (d.field === 'reason') {
    if (reason === 'E_REASON_SECRET_LIKE') return { kind: 'reason', text: REASON_SECRET_TEXT }
    const min = typeof d.min === 'number' ? d.min : null
    const max = typeof d.max === 'number' ? d.max : REASON_MAX
    const len = typeof d.length === 'number' ? d.length : null
    if (reason === 'REASON_TOO_SHORT' && min) return { kind: 'reason', text: `${min}자 이상 적어 주세요${len !== null ? `(지금 ${len}자)` : ''}.` }
    if (reason === 'REASON_TOO_LONG') return { kind: 'reason', text: `${max}자까지 적을 수 있어요${len !== null ? `(지금 ${len}자)` : ''}.` }
    return { kind: 'reason', text: '변경 이유를 적어 주세요.' }
  }
  if (err.status === 409) {
    if (reason === 'VERSION_CONFLICT') {
      const cur = typeof d.currentVersion === 'number' ? ` — 지금 v${d.currentVersion}` : ''
      return { kind: 'notice', text: `다른 곳에서 먼저 적용됐어요${cur}. 내가 바꾼 값 ${ctx.changeCount}개는 그대로 있어요.`, actions: ['rebase', 'discard'], block: true }
    }
    if (reason === 'SUMMARY_MISMATCH') return { kind: 'notice', text: '변경 요약을 만든 뒤 설정이 바뀌었어요(요약 불일치). 변경 요약을 다시 만들어 확인해 주세요.', actions: ['remakeDiff'], block: true }
    if (reason === 'PRIMARY_IN_USE') {
      const roles = Array.isArray(d.roles) ? (d.roles as unknown[]).filter((x): x is string => typeof x === 'string') : []
      return { kind: 'notice', text: `이 역할의 기본 연결이라 끌 수 없어요${roles.length ? `(${roles.join(', ')})` : ''}. 역할 페이지에서 기본 연결을 먼저 바꿔 주세요.`, actions: ['roleLink'], block: true }
    }
    if (reason === 'NO_CHANGE') return { kind: 'notice', text: '지금 설정과 내용이 같아 되돌릴 것이 없어요.', actions: [], block: true }
    if (reason === 'ALREADY_ACTIVE') return { kind: 'notice', text: '이미 사용 중인 버전이에요.', actions: ['reload'], block: true }
    return { kind: 'notice', text: '다른 곳에서 설정이 바뀌었어요. 새로 불러온 뒤 다시 확인해 주세요.', actions: ['reload'], block: true }
  }
  if (err.status === 403) {
    if (reason === 'PRODUCTION_CONFIRMATION_REQUIRED') return { kind: 'confirm', text: 'PRODUCTION 을 대문자로 그대로 입력해 주세요.' }
    if (reason === 'PRODUCTION_TEST_REQUIRED') {
      const why = TEST_DETAIL_KO[str(d.detail) ?? ''] ?? '테스트 결과가 맞지 않음'
      return { kind: 'notice', text: `기능 테스트 결과가 만료됐거나 지금 초안과 달라요(${why}). 다시 테스트한 뒤 적용해 주세요.`, actions: ['retest'], block: true }
    }
    if (reason === 'CROSS_ENVIRONMENT_TEST_UNAVAILABLE') return { kind: 'notice', text: '다른 환경 서버에서는 이 변경을 실행 검증할 수 없어요 — 그 환경의 콘솔에서 적용해 주세요.', actions: [], block: true }
    const missing = Array.isArray(d.missing) ? (d.missing as unknown[]).filter((x): x is string => typeof x === 'string') : []
    return { kind: 'notice', text: `이 작업을 할 권한이 없어요${missing.length ? `(필요한 권한 ${missing.join(', ')})` : ''}. 역할이 바뀌었을 수 있어요 — 콘솔을 다시 불러와 주세요.`, actions: [], block: true }
  }
  if (err.status === 422) {
    if (reason === 'E_REASON_SECRET_LIKE') return { kind: 'reason', text: REASON_SECRET_TEXT }
    if (reason === 'E_SNAPSHOT_INTEGRITY') return { kind: 'notice', text: '기록이 손상돼 이 버전으로는 되돌릴 수 없어요. 다시 눌러도 바뀌지 않아요.', actions: [], block: true }
    if (reason === 'E_REF_NOT_ALLOWED') return { kind: 'notice', text: '이 연결에 허용되지 않은 비밀 참조예요. 목록에 있는 참조만 고를 수 있어요.', actions: [], block: false }
    return { kind: 'notice', text: '규칙에 맞지 않아 적용하지 않았어요.', actions: [], block: false }
  }
  if (err.status === 400) {
    if (Array.isArray(d.errors) && d.errors.length) return { kind: 'fields', errors: d.errors as ConfigIssueDto[], stage: str(d.stage) }
    if (reason === 'E_CONN_SECRET_VALUE') return { kind: 'notice', text: '비밀 값은 보낼 수 없어요 — 서버에 둔 참조 이름만 연결해요.', actions: [], block: false }
    if (reason === 'NO_CHANGE') return { kind: 'notice', text: '지금 저장값과 달라지는 값이 없어요.', actions: [], block: false }
    if (reason === 'CREDENTIAL_ONLY') return { kind: 'notice', text: '비밀 참조는 [비밀 참조 연결]에서만 바꿀 수 있어요.', actions: [], block: false }
    if (d.field === 'baseVersion') return { kind: 'notice', text: '기준 버전을 알 수 없어요 — 다시 불러와 주세요.', actions: ['reload'], block: true }
    return { kind: 'notice', text: err.message || '요청을 처리하지 못했어요.', actions: [], block: false }
  }
  if (err.status === 404) return { kind: 'notice', text: '대상을 찾을 수 없어요. 다시 불러와 주세요.', actions: ['reload'], block: true }
  if (err.status === 429) return { kind: 'notice', text: '요청이 많아요. 잠시 뒤에 다시 시도해 주세요.', actions: [], block: false }
  return { kind: 'notice', text: '적용하지 못했어요. 잠시 뒤 다시 시도해 주세요.', actions: [], block: false }
}

/** Validate(#104)·Diff(#106)·Test(#105) 실패 — 칸 오류(400 errors)면 칸으로, 아니면 한 줄. */
export function requestErrorText(err: Err, what: string): string {
  if (err.status === 0) return '연결하지 못했어요. 네트워크를 확인해 주세요.'
  if (err.status === 403) {
    if (err.details.reason === 'CROSS_ENVIRONMENT_TEST_UNAVAILABLE') return '기능 테스트는 그 환경의 서버에서만 실행할 수 있어요.'
    return '이 작업을 할 권한이 없어요 — 역할이 바뀌었을 수 있어요.'
  }
  if (err.status === 404) return '대상을 찾을 수 없어요. 다시 불러와 주세요.'
  if (err.status === 400 && err.details.reason === 'NO_CHANGE') return '지금 저장값과 달라지는 값이 없어요.'
  if (err.status === 400 && err.message) return err.message
  return `${what}을(를) 하지 못했어요. 잠시 뒤 다시 시도해 주세요.`
}

/** 테스트 결과가 남은 분(만료 = 0). expiresAt 이 없으면 null. */
export function testMinutesLeft(expiresAt: string | null, now: number): number | null {
  if (!expiresAt || !now) return null
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.ceil((t - now) / 60_000))
}
