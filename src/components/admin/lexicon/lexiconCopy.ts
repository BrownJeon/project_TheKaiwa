/**
 * 발음 사전 화면 문구(screens.md §10-8). 순수 모듈 — 단위 테스트 대상.
 * 서버 `message` 는 그리지 않는다(§10-0 ⑬) — HTTP status·`data.code`·`details.reason`·필드 코드로 이 표의 문구를 고른다.
 * 엔진·서비스 이름을 쓰지 않는다(엔진 독립 데이터).
 */
import type { Err } from '@/components/common/errors'
import { retryAfterOf } from '@/components/common/errors'
import { LEXICON_LIMITS, type LexiconScopeName, type LexiconSnapshotIntegrity, type LexiconVersionStatus, type LexiconWordType } from '@/types/lexicon'
import type { DraftField, FieldError, FieldErrors } from './kana'

// ── ⓐ 공통 · 라벨 ──────────────────────────────────────────────────────────

export const INTRO = '선생님 목소리가 잘못 읽는 단어(인명·지명·외래어 등)의 읽기를 고쳐요. 바꾸면 다음 문장부터 반영돼요.'

export const RULES = [
  '범위가 좁을수록 먼저 적용돼요: 사용자 > 목소리 > 레슨 > 코스 > 전체',
  '한 문장 안에서는 긴 표기가 먼저예요(日本橋駅 이 日本橋 보다 먼저). 길이가 같으면 우선순위가 큰 쪽이에요.',
  '꺼진 항목은 쓰이지 않지만 버전 기록과 내보내기에 남아요.',
  '바꾸면 다음 문장부터 반영돼요(다른 서버 프로세스에는 최대 30초 뒤). 이미 만든 소리는 새 사전으로 다시 만들어요.',
] as const

export type AccessNote = 'READ_ONLY' | 'PROD_SUPER_ONLY' | 'PROD_WARN'

export const NOTE: Record<AccessNote, string> = {
  READ_ONLY: '보기 전용이에요 — 바꾸려면 voices.manage 권한이 필요해요.',
  PROD_SUPER_ONLY: '운영 환경 사전은 SUPER_ADMIN 만 바꿀 수 있어요. 읽기 확인·미리듣기는 할 수 있어요.',
  PROD_WARN: '운영 환경 사전이에요 — 바꾸면 모든 학습자의 선생님 목소리 읽기가 바뀌어요.',
}

export const SCOPE_KO: Record<LexiconScopeName, string> = {
  GLOBAL: '전체 — 모든 학습자·모든 목소리',
  COURSE: '코스 — 한 주제(코스)에서만',
  LESSON: '레슨 — 한 레슨에서만',
  VOICE: '목소리 — 한 목소리에서만',
  USER: '사용자 — 한 학습자에게만(이름 같은 개인 고유명사)',
}

/** 대상 칸 이름(범위별). */
export const REF_NAME: Record<Exclude<LexiconScopeName, 'GLOBAL'>, string> = {
  COURSE: '코스 id',
  LESSON: '레슨 id',
  VOICE: '목소리',
  USER: '사용자 id',
}

/** "그 id 의 {대상}를 찾을 수 없어요" 의 대상(조사까지). */
const REF_OBJECT: Record<Exclude<LexiconScopeName, 'GLOBAL'>, string> = {
  COURSE: '코스를',
  LESSON: '레슨을',
  VOICE: '목소리를',
  USER: '사용자를',
}

export const WORD_TYPE_KO: Record<LexiconWordType, string> = {
  PROPER_NOUN: '고유명사',
  PERSON: '인명',
  PLACE: '지명',
  COMMON: '일반어',
  LOANWORD: '외래어',
  ABBREVIATION: '약어',
}

export const VERSION_STATUS_KO: Record<LexiconVersionStatus, string> = {
  ACTIVE: '사용 중',
  SUPERSEDED: '이전',
  ROLLED_BACK: '되돌려짐',
}

export const VERSION_STATUS_DESC: Record<LexiconVersionStatus, string> = {
  ACTIVE: '지금 적용 중',
  SUPERSEDED: '새 버전에 밀려났어요',
  ROLLED_BACK: '이 버전의 변경을 되돌려 새 버전으로 바꿨어요',
}

/** 스냅샷 무결성(A Codex C2) — OK 가 아니면 "기록 손상" 뱃지 + 되돌리기 숨김. */
export const DAMAGED_LABEL = '기록 손상'

export const INTEGRITY_KO: Record<Exclude<LexiconSnapshotIntegrity, 'OK'>, string> = {
  MALFORMED: '기록 형식이 깨졌어요',
  INVALID_ENTRIES: '지금 규칙에 맞지 않는 항목이 있어요',
  MISMATCH: '내용이 저장된 기록(해시)과 달라요',
}

export function isDamaged(integrity: LexiconSnapshotIntegrity | null | undefined): boolean {
  return Boolean(integrity) && integrity !== 'OK'
}

/** 항목 수 줄 — entryCount 는 손상 행 포함, enabledCount 는 멀쩡한 행 중 켜진 수라 손상 버전은 그 뜻을 밝힌다. */
export function versionCountText(v: { entryCount: number; enabledCount: number; integrity?: LexiconSnapshotIntegrity | null }): string {
  if (isDamaged(v.integrity)) return `항목 ${v.entryCount}개(손상 행 포함) · 멀쩡한 사용 중 ${v.enabledCount}`
  return `항목 ${v.entryCount}개(사용 중 ${v.enabledCount})`
}

export type DiffKind = 'ADDED' | 'CHANGED' | 'DISABLED' | 'ENABLED'

export const DIFF_KO: Record<DiffKind, string> = {
  ADDED: '추가',
  CHANGED: '수정',
  DISABLED: '끔',
  ENABLED: '다시 켬',
}

export const QUICK_REASONS = {
  save: ['오독 수정', '새 고유명사', '악센트 조정', '우선순위 조정'],
  disable: ['잘못 넣은 항목', '더 이상 필요 없음', '다른 항목과 겹침'],
  enable: ['다시 필요해짐'],
  import: ['일괄 추가', '사전 복원'],
  rollback: ['문제 있는 변경 되돌림'],
} as const

export const ACCENT_HELP = '입력한 악센트는 저장돼요. 지금 목소리에는 읽기만 반영되고 높낮이는 목소리가 스스로 정해요.'
export const PRIORITY_HELP = '우선순위는 같은 길이의 표기가 겹칠 때만 써요(큰 쪽이 먼저).'
export const LIST_FOOT = '항목은 지우지 않고 끄기만 해요 — 버전 기록과 내보내기에 남아요.'
export const EMPTY_ALL_WRITE = '아직 항목이 없어요. [＋ 항목 추가]로 첫 단어를 넣어 보세요.'
export const EMPTY_ALL_READ = '아직 항목이 없어요.'
export const EMPTY_FILTERED = '조건에 맞는 항목이 없어요. 검색어나 범위를 바꿔 보세요.'

/** 작업자: 이름 → 이메일 → (작업자 없음 = 시드) "시스템". 역할이 있으면 `(ROLE)`. */
export function actorLabel(actor: { name?: string | null; email?: string | null; role?: string | null } | null | undefined): string {
  if (!actor) return '시스템'
  const who = actor.name || actor.email || '알 수 없음'
  return actor.role ? `${who}(${actor.role})` : who
}

/** 대상 표시: VOICE → 목소리 이름(못 찾으면 id 앞 8자 + "…") · 그 밖 → id 앞 8자 + "…". */
export function refLabel(e: { scope: LexiconScopeName; scopeRefId: string | null }, voiceName: (id: string) => string | null): string {
  if (!e.scopeRefId) return ''
  const short = e.scopeRefId.length > 9 ? `${e.scopeRefId.slice(0, 8)}…` : e.scopeRefId
  if (e.scope === 'VOICE') return voiceName(e.scopeRefId) ?? short
  return short
}

export function readingHelp(reading: string, moras: number, converts: boolean): string {
  if (!reading) return ''
  return converts ? `저장할 때 가타카나로 바꿔요 · ${moras}모라` : `가타카나로 저장해요 · ${moras}모라`
}

// ── ⓑ 입력 검증 ───────────────────────────────────────────────────────────

const SURFACE_TEXT: Record<string, string> = {
  REQUIRED: '표기를 입력해 주세요.',
  NO_JAPANESE: '일본어 글자(가나·한자)가 들어가야 해요.',
  E_SURFACE_NOT_JA: '일본어 글자(가나·한자)가 들어가야 해요.',
  INVALID_CHARS: '공백이나 보이지 않는 문자가 섞여 있어요. 지우고 다시 입력해 주세요.',
  E_SURFACE_CHARS: '공백이나 보이지 않는 문자가 섞여 있어요. 지우고 다시 입력해 주세요.',
}

/**
 * 칸 오류 → 문구. `ctx.scope` 는 대상 칸 문구(범위별 이름)에, `ctx.moras` 는 악센트 상한에 쓴다.
 * 코드는 서버 `LexiconFieldError.code`(REQUIRED·TOO_LONG·NOT_KANA …)와 화면 제안 코드(E_*) 둘 다 받는다.
 */
export function fieldErrorText(field: DraftField | 'reason' | 'confirm' | 'text', err: FieldError, ctx: { scope?: LexiconScopeName | null; moras?: number } = {}): string {
  const { code, n } = err
  switch (field) {
    case 'surface':
      if (code === 'TOO_LONG') return n ? `표기는 ${LEXICON_LIMITS.surfaceMax}자까지예요(${n}자).` : `표기는 ${LEXICON_LIMITS.surfaceMax}자까지예요.`
      if (code === 'E_SURFACE') return n ? `표기는 ${LEXICON_LIMITS.surfaceMax}자까지예요(${n}자).` : `표기는 1~${LEXICON_LIMITS.surfaceMax}자로 입력해 주세요.`
      return SURFACE_TEXT[code] ?? unknownText(code)
    case 'reading':
      if (code === 'REQUIRED') return '읽기를 입력해 주세요.'
      if (code === 'TOO_LONG') return n ? `읽기는 ${LEXICON_LIMITS.readingMax}자까지예요(${n}자).` : `읽기는 ${LEXICON_LIMITS.readingMax}자까지예요.`
      if (code === 'NOT_KANA' || code === 'E_READING' || code === 'INVALID_TYPE') return '읽기는 가나(히라가나·가타카나)와 장음 ー 만 쓸 수 있어요.'
      return unknownText(code)
    case 'accentType': {
      const max = n ?? ctx.moras
      return max !== undefined ? `악센트는 0(평판)부터 ${max}(모라 수)까지예요.` : '악센트는 0(평판)부터 모라 수까지예요.'
    }
    case 'priority':
      return `우선순위는 ${LEXICON_LIMITS.priorityMin}~${LEXICON_LIMITS.priorityMax} 사이 정수예요.`
    case 'scope':
      return '범위를 골라 주세요.'
    case 'scopeRefId': {
      const s = ctx.scope && ctx.scope !== 'GLOBAL' ? ctx.scope : null
      if (code === 'SCOPE_REF_NOT_FOUND' || code === 'E_SCOPE_REF_NOT_FOUND') return s ? `그 id 의 ${REF_OBJECT[s]} 찾을 수 없어요.` : '그 id 의 대상을 찾을 수 없어요.'
      if (code === 'TOO_LONG') return `대상 id 는 ${LEXICON_LIMITS.scopeRefIdMax}자까지예요.`
      if (code === 'INVALID_FORMAT') return '대상 id 는 영문·숫자·_·- 만 쓸 수 있어요.'
      if (s === 'VOICE') return '목소리를 골라 주세요.'
      return s ? `${REF_NAME[s]}를 입력해 주세요.` : '대상 id 를 확인해 주세요.'
    }
    case 'wordType':
      return '종류를 목록에서 골라 주세요.'
    case 'note':
      return `메모는 ${LEXICON_LIMITS.noteMax}자까지예요.`
    case 'reason':
      if (code === 'TOO_LONG') return n ? `이유는 ${LEXICON_LIMITS.reasonMax}자까지예요(${n}자).` : `이유는 ${LEXICON_LIMITS.reasonMax}자까지예요.`
      return '변경 이유를 입력해 주세요.'
    case 'confirm':
      return 'PRODUCTION 을 그대로 입력해야 바꿀 수 있어요.'
    case 'text':
      if (code === 'REQUIRED') return '예문을 입력해 주세요.'
      if (code === 'TOO_LONG') return n ? `예문은 ${PREVIEW_TEXT_MAX}자까지예요(${n}자).` : `예문은 ${PREVIEW_TEXT_MAX}자까지예요.`
      return unknownText(code)
    default:
      return unknownText(code)
  }
}

function unknownText(code: string): string {
  return `입력값을 확인해 주세요 (${code})`
}

/** 예문 상한 — 서버가 문장 단위로 나눠 합성하므로 계약 상한(200)을 그대로 쓴다(§10-11 ④, A 결정). */
export const PREVIEW_TEXT_MAX = LEXICON_LIMITS.previewTextMax

const DRAFT_FIELDS = new Set<string>(['surface', 'reading', 'accentType', 'priority', 'scope', 'scopeRefId', 'wordType', 'note'])

export interface ServerFieldErrors {
  fields: FieldErrors
  reason?: FieldError
  confirm?: FieldError
}

/**
 * 400/422 봉투 → 칸 오류. `details.errors[{field, code}]`(서버 `LexiconFieldError[]`) · `details.fields{[field]: code}` ·
 * `details.field` + `details.reason|code` 셋 다 받는다. 칸을 못 찾으면 null(호출부가 일반 알림으로).
 */
export function mapServerFieldErrors(err: Err): ServerFieldErrors | null {
  if (err.status !== 400 && err.status !== 422) return null
  const out: ServerFieldErrors = { fields: {} }
  let found = false
  const put = (field: unknown, code: unknown) => {
    if (typeof field !== 'string') return
    const c = typeof code === 'string' && code ? code : 'INVALID'
    if (field === 'reason') out.reason = { code: c }
    else if (field === 'confirm') out.confirm = { code: c }
    else if (DRAFT_FIELDS.has(field)) out.fields[field as DraftField] = out.fields[field as DraftField] ?? { code: c }
    else return
    found = true
  }
  const list = err.details.errors
  if (Array.isArray(list)) for (const x of list) if (x && typeof x === 'object') put((x as Record<string, unknown>).field, (x as Record<string, unknown>).code)
  const map = err.details.fields
  if (map && typeof map === 'object' && !Array.isArray(map)) for (const [k, v] of Object.entries(map as Record<string, unknown>)) put(k, v)
  if (!found) {
    const field = err.details.field
    const code = err.details.reason ?? err.details.code
    // 서버가 칸만 주고 코드가 없으면(이유·기준 버전 누락) 필수 값 누락으로 본다.
    put(field, typeof code === 'string' ? code : field === 'reason' ? 'REQUIRED' : 'INVALID')
  }
  return found ? out : null
}

// ── ⓒ 미리듣기 ────────────────────────────────────────────────────────────

export const PREVIEW = {
  title: '미리듣기',
  compareHelp: '저장하지 않은 입력으로 읽어 봐요. 사전은 바뀌지 않아요.',
  currentHelp: '지금 사전으로 읽어 봐요.',
  sentenceHelp: '선생님이 이상하게 읽는 문장을 넣어 보고, 틀린 단어를 찾아 항목으로 추가해요.',
  lockedVoice: '목소리 범위 항목이라 그 목소리로 들어요',
  check: '읽기 확인',
  checking: '읽는 중…',
  changed: '읽기가 달라져요',
  same: '지금과 같게 읽어요',
  stale: '입력이 바뀌었어요 — 다시 확인해 주세요.',
  invalidDraft: '표기·읽기를 올바르게 입력하면 확인할 수 있어요.',
  audioFailed: '소리를 만들지 못했어요. 읽기는 위에서 확인할 수 있어요.',
  playFailed: '소리를 재생하지 못했어요. [읽기 확인]을 다시 눌러 주세요.',
  readingFailed: '이 예문은 읽기를 확인하지 못했어요. 소리로 들어 보세요.',
} as const

export function notHitText(surface: string): string {
  return `⚠ 이 예문에는 이 항목이 걸리지 않았어요. 예문에 표기 「${surface}」가 있는지, 더 긴 표기의 다른 항목이 먼저 걸리지 않았는지 확인해 주세요.`
}

const ENGINE_CODES = new Set(['ENGINE_UNAVAILABLE', 'ENGINE_ERROR', 'ENGINE_TIMEOUT'])
const SERVICE_DOWN = '지금은 선생님 목소리 서비스에 닿지 않아 읽기 확인·미리듣기를 할 수 없어요. 저장은 할 수 있어요.'

export function previewErrorText(err: Err): string {
  if (err.status === 429) return `미리듣기는 1분에 ${LEXICON_LIMITS.previewPerMinute}번까지예요. ${retryAfterOf(err)}초 뒤에 다시 해 주세요.`
  if ((err.code && ENGINE_CODES.has(err.code)) || err.status === 502 || err.status === 503 || err.status === 504) return SERVICE_DOWN
  if (err.status === 0) return '연결하지 못했어요. 네트워크를 확인해 주세요.'
  if (err.status === 403) return '미리듣기 권한이 없어요 (voices.manage).'
  if (err.status === 400 || err.status === 422) {
    const field = err.details.field
    if (field === 'draftEntries') return PREVIEW.invalidDraft
    return '예문이 너무 길어요. 더 짧게 줄여 주세요.'
  }
  return '읽기를 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요.'
}

// ── ⓓ 쓰기 오류 ───────────────────────────────────────────────────────────

export type WriteKind = 'save' | 'disable' | 'enable' | 'import' | 'rollback'
export type NoticeAction = 'reload' | 'openExisting' | 'redryRun' | 'refreshList'

export interface WriteNotice {
  text: string
  action?: NoticeAction
}

/** 같은 status 안의 갈래: 서버는 `details.reason`(VERSION_CONFLICT·DUPLICATE …), 화면 제안은 `data.code`. */
export function subCode(err: Err): string | null {
  const r = err.details.reason ?? err.details.code
  if (typeof r === 'string' && r) return r
  return err.code
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** 422 E_SNAPSHOT_INTEGRITY — 버전 비교·되돌리기 대상 스냅샷이 손상. 다시 불러와도 풀리지 않는 데이터 문제라 재시도 버튼을 두지 않는다. */
export function isSnapshotIntegrityError(err: Err): boolean {
  return err.status === 422 && subCode(err) === 'E_SNAPSHOT_INTEGRITY'
}

const RESTORE_HINT = '올바른 내보내기 파일이 있으면 가져오기로 복구해 주세요.'

/**
 * 손상 안내. `details.version` 이 보고 있는 버전이면 그 버전 자체가 손상(비교·되돌리기 불가),
 * 다른 번호면 비교 상대(직전 버전)가 손상 — 이 버전으로 되돌리기는 막히지 않는다.
 */
export function integrityErrorText(err: Err, target: number): string {
  const v = num(err.details.version) ?? target
  if (v !== target) return `직전 버전 v${v} 기록이 손상돼 비교할 수 없어요.`
  return `v${v} 기록이 손상돼 비교·되돌리기를 할 수 없어요. ${RESTORE_HINT}`
}

/** 손상 오류가 가리키는 버전이 보고 있는 버전 자신인가(번호가 없으면 자신으로 본다). */
export function integrityErrorIsTarget(err: Err, target: number): boolean {
  const v = num(err.details.version)
  return v === null || v === target
}

function conflictVersions(err: Err, fallbackBase: number | null): string {
  const base = num(err.details.baseVersion) ?? fallbackBase
  const cur = num(err.details.currentVersion)
  if (base !== null && cur !== null) return ` (v${base} → v${cur})`
  if (cur !== null) return ` (지금 v${cur})`
  return ''
}

/**
 * 쓰기 실패 → 확정 버튼 위 알림. 칸 오류(400/422 필드)는 여기 오기 전에 `mapServerFieldErrors` 가 가져간다.
 * `existing` 은 중복 항목의 표기·꺼짐 여부(있으면 문구에 넣는다). 401 은 `api.ts` 가 로그인으로 보낸다.
 */
export function writeErrorNotice(err: Err, kind: WriteKind, ctx: { baseVersion?: number | null; surface?: string; existingDisabled?: boolean } = {}): WriteNotice {
  const sc = subCode(err)
  if (err.status === 409) {
    if (sc === 'VERSION_CONFLICT' || sc === 'CONFLICT') {
      const v = conflictVersions(err, ctx.baseVersion ?? null)
      if (kind === 'import') return { text: `미리 본 뒤에 사전이 바뀌었어요${v}. 변경 내용을 다시 확인해 주세요.`, action: 'redryRun' }
      if (kind === 'rollback') return { text: `다른 곳에서 사전이 바뀌었어요${v}. 목록을 새로 불러온 뒤 다시 확인해 주세요.`, action: 'reload' }
      return { text: `다른 곳에서 사전이 바뀌었어요${v}. 새로 불러온 뒤 다시 저장해 주세요. 입력한 내용은 그대로예요.`, action: 'reload' }
    }
    if (sc === 'DUPLICATE' || sc === 'E_LEXICON_DUPLICATE') {
      const s = ctx.surface ? `「${ctx.surface}」 ` : ''
      return { text: `같은 범위에 ${s}항목이 이미 있어요${ctx.existingDisabled ? ' (꺼져 있어요)' : ''}.`, action: 'openExisting' }
    }
    if (sc === 'ALREADY_ACTIVE') return { text: '지금 쓰는 버전이에요.' }
    if (sc === 'NO_CHANGE') return { text: '지금 사전과 내용이 같아 되돌릴 것이 없어요.' }
    return { text: `다른 곳에서 사전이 바뀌었어요${conflictVersions(err, ctx.baseVersion ?? null)}. 새로 불러온 뒤 다시 해 주세요.`, action: 'reload' }
  }
  if (err.status === 403) {
    const missing = Array.isArray(err.details.missing) ? (err.details.missing as unknown[]).filter((x): x is string => typeof x === 'string') : []
    if (sc === 'PRODUCTION_CONFIRM_REQUIRED' || sc === 'PRODUCTION_CONFIRMATION_REQUIRED' || missing.includes('config.apply.production')) {
      return { text: '운영 환경 사전은 SUPER_ADMIN 이 확인 문구를 넣어야 바꿀 수 있어요.' }
    }
    return { text: `이 변경 권한이 없어요${missing.length ? ` (${missing.join(', ')})` : ''}.` }
  }
  if (err.status === 404) {
    if (kind === 'rollback') return { text: '그 버전을 찾을 수 없어요.' }
    return { text: '이 항목을 찾을 수 없어요. 목록을 새로 불러와 주세요.', action: 'refreshList' }
  }
  if (sc === 'E_SNAPSHOT_INTEGRITY') {
    const v = num(err.details.version)
    return { text: `${v !== null ? `v${v} ` : '이 버전 '}기록이 손상돼 되돌릴 수 없어요. ${RESTORE_HINT}` }
  }
  if (err.status === 413 || sc === 'E_IMPORT_TOO_LARGE' || sc === 'TOO_LARGE' || sc === 'FILE_TOO_LARGE') {
    const kb = num(err.details.kb) ?? num(err.details.sizeKb)
    return { text: `파일이 256KB 를 넘어요${kb ? `(${kb}KB)` : ''}. 나눠서 올려 주세요.` }
  }
  if (err.status === 400 || err.status === 415 || err.status === 422) {
    if (sc === 'E_IMPORT_TOO_MANY_ROWS' || sc === 'TOO_MANY_ROWS') {
      const rows = num(err.details.rows)
      return { text: `${LEXICON_LIMITS.importMaxRows.toLocaleString('en-US')}행을 넘어요${rows ? `(${rows}행)` : ''}. 나눠서 올려 주세요.` }
    }
    if (sc === 'E_IMPORT_HEADER' || sc === 'BAD_HEADER' || sc === 'HEADER') return { text: 'CSV 첫 줄(머리글)이 형식과 달라요. [파일 형식]을 확인해 주세요.' }
    if (sc === 'E_IMPORT_HAS_ERRORS' || sc === 'HAS_ERRORS' || sc === 'IMPORT_HAS_ERRORS') return { text: '오류가 있는 행이 있어 적용하지 않았어요. 고친 파일로 다시 확인해 주세요.', action: 'redryRun' }
    if (kind === 'import') return { text: '파일을 읽지 못했어요. UTF-8 CSV 나 JSON 배열인지 확인해 주세요.' }
    return { text: '입력값을 확인해 주세요.' }
  }
  if (err.status === 429) return { text: `너무 자주 눌렀어요. ${retryAfterOf(err)}초 뒤에 다시 해 주세요.` }
  if (err.status === 0) {
    if (kind === 'import' || kind === 'rollback') return { text: '연결이 끊겼어요. 적용됐는지 모르니 목록을 새로 불러와 확인해 주세요.', action: 'refreshList' }
    return { text: '연결하지 못했어요. 네트워크를 확인해 주세요.' }
  }
  return { text: '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요. 입력한 내용은 그대로예요.' }
}

export const NOTICE_ACTION_LABEL: Record<NoticeAction, string> = {
  reload: '새로 불러오기',
  openExisting: '그 항목 열기',
  redryRun: '다시 미리 보기',
  refreshList: '목록 새로 고침',
}

// ── 가져오기 행 오류 ─────────────────────────────────────────────────────

/** 가져오기 행 오류 → 사유(칸 + 코드). 모르는 코드는 "확인이 필요해요 ({code})". */
export function importErrorText(field: string | null, code: string): string {
  if (code === 'DUPLICATE_IN_FILE' || code === 'E_DUPLICATE_IN_FILE') return '파일 안에 같은 표기·범위가 두 번 있어요'
  if (code === 'ROW_FORMAT' || code === 'E_ROW_FORMAT' || code === 'COLUMN_COUNT') return '칸 수가 머리글과 달라요'
  if (code === 'SCOPE_REF_NOT_FOUND' || code === 'E_SCOPE_REF_NOT_FOUND') return '대상 id 를 찾을 수 없어요'
  switch (field) {
    case 'surface':
      if (code === 'REQUIRED') return '표기가 비었어요'
      if (code === 'TOO_LONG') return `표기가 ${LEXICON_LIMITS.surfaceMax}자를 넘어요`
      if (code === 'NO_JAPANESE' || code === 'E_SURFACE_NOT_JA') return '표기에 일본어 글자(가나·한자)가 없어요'
      if (code === 'INVALID_CHARS' || code === 'E_SURFACE_CHARS') return '표기에 공백이나 보이지 않는 문자가 있어요'
      return '표기가 비었거나 40자를 넘거나, 일본어가 아니거나 보이지 않는 문자가 있어요'
    case 'reading':
      if (code === 'REQUIRED') return '읽기가 비었어요'
      if (code === 'TOO_LONG') return `읽기가 ${LEXICON_LIMITS.readingMax}자를 넘어요`
      return `읽기는 가나와 ー 만 쓸 수 있어요(${LEXICON_LIMITS.readingMax}자까지)`
    case 'accentType':
      return '악센트가 0~모라 수 밖이에요'
    case 'priority':
      return `우선순위는 ${LEXICON_LIMITS.priorityMin}~${LEXICON_LIMITS.priorityMax} 정수예요`
    case 'scope':
      return '범위는 GLOBAL·COURSE·LESSON·VOICE·USER 중 하나예요'
    case 'scopeRefId':
      if (code === 'INVALID_FORMAT') return '대상 id 형식이 올바르지 않아요(영문·숫자·_·-, 40자까지)'
      return 'GLOBAL 은 대상 id 가 비어야 하고, 나머지는 있어야 해요'
    case 'wordType':
      return '종류 값이 목록에 없어요'
    case 'note':
      return `메모가 ${LEXICON_LIMITS.noteMax}자를 넘어요`
    case 'enabled':
      return 'enabled 는 true 또는 false 여야 해요'
    default:
      break
  }
  const byCode: Record<string, string> = {
    E_SURFACE: '표기가 비었거나 40자를 넘거나, 일본어가 아니거나 보이지 않는 문자가 있어요',
    E_READING: `읽기는 가나와 ー 만 쓸 수 있어요(${LEXICON_LIMITS.readingMax}자까지)`,
    E_ACCENT: '악센트가 0~모라 수 밖이에요',
    E_PRIORITY: `우선순위는 ${LEXICON_LIMITS.priorityMin}~${LEXICON_LIMITS.priorityMax} 정수예요`,
    E_SCOPE: '범위는 GLOBAL·COURSE·LESSON·VOICE·USER 중 하나예요',
    E_SCOPE_REF: 'GLOBAL 은 대상 id 가 비어야 하고, 나머지는 있어야 해요',
    E_WORD_TYPE: '종류 값이 목록에 없어요',
    E_NOTE: `메모가 ${LEXICON_LIMITS.noteMax}자를 넘어요`,
    E_ENABLED: 'enabled 는 true 또는 false 여야 해요',
  }
  return byCode[code] ?? `확인이 필요해요 (${code})`
}

// ── ⓔ 토스트 ─────────────────────────────────────────────────────────────

export function savedToast(kind: 'save' | 'disable' | 'enable', version: number, revived = false): string {
  if (revived) return `꺼져 있던 항목을 다시 켜서 저장했어요 · 사전 v${version}`
  if (kind === 'disable') return `껐어요 · 사전 v${version}`
  if (kind === 'enable') return `다시 켰어요 · 사전 v${version}`
  return `저장했어요 · 사전 v${version}`
}

export function importToast(version: number, c: { add: number; update: number; disable: number }): string {
  return `가져왔어요 · 사전 v${version} (추가 ${c.add} · 수정 ${c.update} · 끄기 ${c.disable})`
}

export function rollbackToast(target: number, version: number): string {
  return `되돌렸어요 · v${target} 내용으로 사전 v${version}`
}

export const NO_CHANGE_TOAST = '바뀐 내용이 없어요'

/** 수정에서 표기·범위·대상을 바꾸려 했을 때(422 E_IMMUTABLE) — 편집 칸에 없는 칸이라 칸 아래가 아니라 알림으로. */
export const IMMUTABLE_TEXT = '표기·범위는 바꿀 수 없어요 — 끄고 새로 추가해 주세요.'

export function saveHint(nextVersion: number): string {
  return `저장하면 사전 v${nextVersion} 이 만들어지고 다음 문장부터 반영돼요(다른 서버 프로세스에는 최대 30초 뒤).`
}
