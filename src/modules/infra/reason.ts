/**
 * 관리자 쓰기 `reason` 공용 검사(task-012c Codex C1 CX-3, role-permission.md §7 `reason` 규칙) — 설정 편집·Rollback·credentialRef·발음 사전 쓰기가 같이 쓴다.
 *
 * ① 줄바꿈·탭·제어문자(C0·DEL·C1·U+2028/2029)는 연속 구간마다 공백 하나로 바꾸고 앞뒤 공백 제거(짝 없는 서로게이트는 U+FFFD)
 * ② 길이 1~200자(코드포인트, PRODUCTION 은 10~200자)
 * ③ 비밀 유사 문자열 거부 — 접두(`sk-`·`ghp_`·`gho_`·`github_pat_`·`AKIA`·`xox?-`·`Bearer `·`Basic `·JWT 모양) · 키=값/키:값
 *    (`password`·`passwd`·`secret`·`token`·`api_key`·`apikey`·`credential`, 대소문자 무시) · 공백 없는 고엔트로피 토큰(영숫자·`-_+/=` 로만 된
 *    24자 이상 연속, 문자 종류 — 소문자·대문자·숫자·기호 — 3가지 이상)
 * ④ 통과한 값은 호출자가 `AuditLog.reason`·`ConfigurationVersion.reason` 에만 저장한다. **이 모듈과 호출자는 reason 원문을 프로세스 로그에 싣지 않고**,
 *    오류 응답에도 되돌려주지 않는다(길이만).
 * ⑤ (task-012c Codex C2 ③) 판정은 저장값이 아니라 **판정용 형태**로 한다 — `NFKC` 정규화(전각·호환 문자 → 기본 문자) 뒤 서식(Cf)·기본 무시
 *    (Default_Ignorable — soft hyphen·ZWSP·ZWNJ·ZWJ·BOM·word joiner·CGJ·변이 선택자 등) 문자를 **삭제**(공백 치환 아님 — 끼워 넣어 끊은 패턴을 다시 붙인다).
 *    최소 길이(REQUIRED·TOO_SHORT)도 이 형태의 보이는 글자 수로 센다(폭 0 문자로 채운 이유 거부). 저장값 정책은 그대로 ①(원문 글자는 바꾸지 않는다).
 */
import { ApiError } from './http'
import { codePointLength } from './text'

export const REASON_MAX = 200
export const REASON_MIN = 1
export const REASON_MIN_PRODUCTION = 10

export type ReasonProblem = 'REQUIRED' | 'TOO_SHORT' | 'TOO_LONG' | 'SECRET_LIKE'
export type ReasonCheck = { ok: true; reason: string } | { ok: false; problem: ReasonProblem; length: number; min: number; max: number }

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g
const CONTROL_RUN = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g

export function normalizeReason(raw: string): string {
  return raw.replace(LONE_SURROGATE, '\uFFFD').replace(CONTROL_RUN, ' ').trim()
}

const FORMAT_CHARS = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu

/** 판정용 형태(저장하지 않는다) — 저장 규칙 ① 뒤 NFKC → 서식·기본 무시 문자 삭제 → (NFKC 가 만든 제어문자까지) 공백 정리. */
export function reasonCheckForm(s: string): string {
  return normalizeReason(normalizeReason(s).normalize('NFKC').replace(FORMAT_CHARS, ''))
}

const SECRET_PREFIX = /(?:^|[^A-Za-z0-9])(?:sk-[A-Za-z0-9_-]{8,}|gh[po]_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{12,}|xox[a-z]-[A-Za-z0-9-]{8,})/
const AUTH_SCHEME = /(?:^|[^A-Za-z0-9])(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/i
const JWT_LIKE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/
const KEY_VALUE = /(?:password|passwd|secret|token|api[_-]?key|apikey|credential)s?\s*[:=]\s*\S/i
const TOKEN_RUN = /[A-Za-z0-9\-_+/=]{24,}/g

function charKinds(s: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[-_+/=]/].filter((re) => re.test(s)).length
}

/** 비밀 유사 문자열이 들어 있는가(판정 규칙 정본 role-permission §7 ③) — 판정용 형태(⑤)로 바꾼 뒤 본다. */
export function isSecretLikeText(s: string): boolean {
  const t = reasonCheckForm(s)
  if (SECRET_PREFIX.test(t) || AUTH_SCHEME.test(t) || JWT_LIKE.test(t) || KEY_VALUE.test(t)) return true
  for (const m of t.matchAll(TOKEN_RUN)) if (charKinds(m[0]) >= 3) return true
  return false
}

export function checkReason(raw: unknown, opts: { production: boolean }): ReasonCheck {
  const reason = typeof raw === 'string' ? normalizeReason(raw) : ''
  const min = opts.production ? REASON_MIN_PRODUCTION : REASON_MIN
  const stored = codePointLength(reason)
  const visible = codePointLength(reasonCheckForm(reason))
  if (visible === 0) return { ok: false, problem: 'REQUIRED', length: visible, min, max: REASON_MAX }
  if (stored > REASON_MAX) return { ok: false, problem: 'TOO_LONG', length: stored, min, max: REASON_MAX }
  if (visible < min) return { ok: false, problem: 'TOO_SHORT', length: visible, min, max: REASON_MAX }
  if (isSecretLikeText(reason)) return { ok: false, problem: 'SECRET_LIKE', length: stored, min, max: REASON_MAX }
  return { ok: true, reason }
}

/**
 * 설정 편집 경로용 — 통과하면 정리된 reason, 아니면 ApiError.
 * 길이 = `400 VALIDATION {field:'reason', reason:'REASON_REQUIRED'|'REASON_TOO_SHORT'|'REASON_TOO_LONG', length, min, max}`,
 * 비밀 유사 = `422 UNPROCESSABLE {field:'reason', reason:'E_REASON_SECRET_LIKE'}` — 어느 쪽도 원문을 싣지 않는다.
 */
export function requireReason(raw: unknown, opts: { production: boolean }): string {
  const r = checkReason(raw, opts)
  if (r.ok) return r.reason
  if (r.problem === 'SECRET_LIKE') {
    throw new ApiError('UNPROCESSABLE', '이유에 비밀번호·키처럼 보이는 문자열이 있어요. 그 부분을 빼고 다시 적어 주세요.', { field: 'reason', reason: 'E_REASON_SECRET_LIKE' })
  }
  const message =
    r.problem === 'REQUIRED'
      ? '변경 이유를 입력해 주세요.'
      : r.problem === 'TOO_LONG'
        ? `변경 이유는 ${r.max}자 이하여야 합니다.`
        : `운영(PRODUCTION) 변경은 이유를 ${r.min}자 이상 적어 주세요.`
  throw new ApiError('VALIDATION', message, { field: 'reason', reason: `REASON_${r.problem}`, length: r.length, min: r.min, max: r.max })
}
