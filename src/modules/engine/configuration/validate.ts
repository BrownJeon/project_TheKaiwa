/**
 * 설정 후보 검증(api-contract §2-23·#104, admin-console/10 §4~§5) — 저장하지 않는다. 단계: JSON_SYNTAX → SCHEMA → DEPENDENCY.
 *
 * - 대상은 **바뀐 키만**이다(저장값과 같은 값은 통과 — Raw JSON 전체 문서에 잠긴 키가 그대로 들어 있어도 된다).
 * - SCHEMA: 모르는 키(`unknownKey` + 가장 가까운 키 `suggestion`, `x-` 접두는 저장하지 않고 경고만) · 잠금(`readOnly`·`restartRequired`·`serviceManaged`) ·
 *   타입·범위·enum·pattern·maxLength · SECRET_REF 평문(`secretValue`, 값은 되돌려주지 않는다) · ref 허용 목록(`refNotAllowed`·`pattern`·`reference`) ·
 *   URL 주소 허용 목록(`hostNotAllowed`, D-C3(c)) · 일반 문자열·목록 값·JSON 값 안의 비밀 유사 문자열(`secretValue`, REV-056 — 값은 되돌려주지 않는다.
 *   비자유 키는 긴 토큰 규칙 대신 구분 기호 없는 긴 혼합 런 규칙, Codex C2 재검토).
 * - DEPENDENCY: 대상 종류별 교차 규칙은 호출자가 넘긴다(Fallback 연결 존재·역할·환경 · 기본 목소리 존재 등).
 * - 오류 항목 `{key, rule, message, expected?, actual?, suggestion?, related?}` 최대 50건.
 */
import { codePointLength, isSecretLikeText, reasonCheckForm, type OutboundVet } from '@/modules/infra'
import { vetConnectionUrl } from '../adapters/common/targetPolicy'
import { checkCredentialRef } from '../credentials/policy'
import { lockMessage, lockRule, type EditKeyDef, type LockReason, type ValidationRuleName } from './keys'

export type ValidationStage = 'JSON_SYNTAX' | 'SCHEMA' | 'DEPENDENCY'

export interface ValidationIssue {
  key: string
  rule: ValidationRuleName
  message: string
  expected?: unknown
  actual?: unknown
  suggestion?: string
  related?: string[]
  lock?: LockReason
}

export interface ValidationWarning {
  key: string
  code: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  stage: ValidationStage | null
  errors: ValidationIssue[]
  warnings: ValidationWarning[]
  /** 저장값과 다른 키(`x-` 확장 키 제외). */
  changedKeys: string[]
  impact: { runtimeEditable: string[]; restartRequired: string[]; redeployRequired: string[]; strict: string[] }
}

export interface ValidateHooks {
  vetUrl?: (raw: unknown) => Promise<OutboundVet>
  /** 이 호출에서만 풀어 줄 잠금(#93b 가 `CREDENTIAL_ONLY` 를 푼다). */
  allowLocks?: readonly LockReason[]
  /** SECRET_REF 존재 확인까지 할지(#93b = true). */
  checkRefExists?: boolean
  dependency?: (candidate: Readonly<Record<string, unknown>>, changedKeys: readonly string[]) => Promise<ValidationIssue[]>
  /** 런타임이 행 값보다 먼저 읽는 env 가 설정됐는가(기본 process.env). */
  envSet?: (name: string) => boolean
}

const MAX_ERRORS = 50
const SAFE_KEY = /^[\w.-]{1,120}$/
const STRING_MAX = 500

/** 키 순서·값이 같은지(JSON 의미 비교 — 객체 키 순서 무시). */
export function sameValue(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

export function stableStringify(v: unknown): string {
  return JSON.stringify(sortDeep(v)) ?? 'undefined'
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sortDeep((v as Record<string, unknown>)[k])
    return out
  }
  return v
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export function suggestKey(key: string, candidates: readonly string[]): string | undefined {
  let best: { k: string; d: number } | null = null
  for (const c of candidates) {
    const d = levenshtein(key.toLowerCase(), c.toLowerCase())
    if (d <= 3 && (!best || d < best.d)) best = { k: c, d }
  }
  return best?.k
}

const TYPE_LABEL: Record<string, string> = { STRING: '문자열', PATH: '문자열', URL: 'http(s) 주소', INTEGER: '정수', NUMBER: '숫자', BOOLEAN: 'true/false', ENUM: '목록 값', JSON: 'JSON', SECRET_REF: 'env:/file: 참조' }

// ── 비밀 유사 값(REV-056) ── 판정 규칙은 reason 과 같은 `isSecretLikeText`(role-permission §7 ③)이고, 여기서 더하는 규칙은 비자유 키 전용
// "긴 혼합 런" 하나뿐이다(task-012c Codex C2 재검토 — 긴 토큰 규칙을 뺀 자리를 좁게 메운다).

const SECRET_VALUE_MESSAGE = '비밀처럼 보이는 글자가 있어 저장하지 않았어요.'
/**
 * "긴 토큰"(24자↑ 영숫자 연속) 규칙만 빼는 창 크기. 그 규칙은 24자 연속에서만 걸리므로 23자 창 안에서는 걸릴 수 없고, 나머지 규칙
 * (접두·인증 스킴·JWT·키=값)의 최소 일치는 왼쪽 경계 1자를 넣어도 20자 이하라 창 하나에 통째로 들어간다. reason.ts 규칙이 길어지면
 * 조용히 우회되므로 단위 테스트(task012c-secret-value "L4 가드")가 규칙 원문과 최소 일치 길이를 고정한다.
 */
export const NO_LONG_TOKEN_WINDOW = 23
/**
 * 비자유 키 보강 규칙 — 구분 기호(`-` `.` `:` `/` 공백)가 없는 `[A-Za-z0-9_+=]` 연속이 이 길이 이상이고 문자 종류(소문자·대문자·숫자·`_+=`)가
 * {@link MIXED_RUN_KINDS} 가지 이상이면 비밀로 본다. 모델 id·경로·URL·uuid 는 구분 기호로 끊기고, cuid·16진수는 2종이라 걸리지 않는다.
 */
export const MIXED_RUN_MIN = 32
export const MIXED_RUN_KINDS = 3
const JSON_SCAN_DEPTH = 8
const JSON_SCAN_ARRAY = 200
const MIXED_RUN = /[A-Za-z0-9_+=]+/g

/** 판정용 형태 — NFKC·폭 0 문자 삭제(reason 과 같은 형태) 뒤 공백 접기. 원문으로 보면 폭 0 문자로 패턴을 끊어 우회할 수 있다. */
const checkForm = (s: string): string => reasonCheckForm(s).replace(/\s+/g, ' ')

function hasLongMixedRun(form: string): boolean {
  for (const m of form.matchAll(MIXED_RUN)) {
    const run = m[0]
    if (run.length >= MIXED_RUN_MIN && [/[a-z]/, /[A-Z]/, /[0-9]/, /[_+=]/].filter((re) => re.test(run)).length >= MIXED_RUN_KINDS) return true
  }
  return false
}

/** 모델 id·경로가 긴 토큰 규칙에 걸리지 않게 그 규칙만 뺀 판정(입력 = 판정용 형태) — 규칙 함수는 그대로 두고 입력을 창으로 잘라 넘긴다. */
function secretLikeExceptLongToken(form: string): boolean {
  if (!isSecretLikeText(form)) return false
  const cps = Array.from(form)
  for (let i = 0; i < cps.length; i++) {
    // 창 첫 글자를 문자열 시작(접두 규칙의 왼쪽 경계)으로 오인하지 않게 숫자를 앞에 붙인다 — 어느 규칙도 숫자로 시작하지 않는다.
    const w = i === 0 ? cps.slice(0, NO_LONG_TOKEN_WINDOW).join('') : '0' + cps.slice(i, i + NO_LONG_TOKEN_WINDOW - 1).join('')
    if (isSecretLikeText(w)) return true
  }
  return false
}

/** 비자유 값(모델명·id·경로·주소·목록 값·JSON 잎/키) 판정 — `checkEditValue` 와 `scanJsonSecret` 이 이 함수 하나만 쓴다. */
function secretLikeNonFreeText(s: string): boolean {
  const form = checkForm(s)
  return hasLongMixedRun(form) || secretLikeExceptLongToken(form)
}

const secretLikeValue = (def: EditKeyDef, s: string): boolean => (def.freeText ? isSecretLikeText(s) : secretLikeNonFreeText(s))

/** JSON 의 문자열 잎·객체 키·`키: 문자열 값` 짝을 본다. `LIMIT` = 깊이·배열 한도를 넘어 다 보지 못했다(통과시키지 않는다). */
function scanJsonSecret(v: unknown, depth: number): 'SECRET' | 'LIMIT' | null {
  if (typeof v === 'string') return secretLikeNonFreeText(v) ? 'SECRET' : null
  if (v === null || typeof v !== 'object') return null
  if (depth > JSON_SCAN_DEPTH) return 'LIMIT'
  if (Array.isArray(v)) {
    if (v.length > JSON_SCAN_ARRAY) return 'LIMIT'
    for (const x of v) {
      const r = scanJsonSecret(x, depth + 1)
      if (r) return r
    }
    return null
  }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (secretLikeNonFreeText(k)) return 'SECRET'
    // `{"password":"hunter2"}` 는 키도 잎도 따로는 평범하다 — 문자열 값은 키와 이어 같은 규칙에 한 번 더 넣는다.
    if (typeof x === 'string' && secretLikeNonFreeText(`${k}: ${x}`)) return 'SECRET'
    const r = scanJsonSecret(x, depth + 1)
    if (r) return r
  }
  return null
}

/** 값 한 개의 타입·범위 검사(SECRET_REF·URL 허용 목록은 호출자). */
export function checkEditValue(def: EditKeyDef, v: unknown): ValidationIssue[] {
  const issue = (rule: ValidationRuleName, message: string, extra: Partial<ValidationIssue> = {}): ValidationIssue[] => [{ key: def.key, rule, message, ...extra }]
  if (v === null) return def.nullable ? [] : issue('type', `${def.key} 는 비울 수 없습니다.`, { expected: TYPE_LABEL[def.type] })
  if (v === undefined) return issue('required', `${def.key} 값이 필요합니다.`)
  switch (def.type) {
    case 'STRING':
    case 'PATH':
    case 'URL':
    case 'ENUM': {
      if (def.type === 'ENUM') {
        if (!def.enum?.includes(v as string | number)) return issue('enum', `${def.key} 는 정해진 값 중 하나여야 합니다.`, { expected: def.enum })
        return typeof v === 'string' && secretLikeValue(def, v) ? issue('secretValue', SECRET_VALUE_MESSAGE) : []
      }
      if (typeof v !== 'string') return issue('type', `${def.key} 는 ${TYPE_LABEL[def.type]}이어야 합니다.`, { expected: TYPE_LABEL[def.type] })
      const len = codePointLength(v)
      const max = def.maxLength ?? STRING_MAX
      if (len > max) return issue('maxLength', `${def.key} 는 ${max}자 이하여야 합니다.`, { expected: max, actual: len })
      if (def.type === 'URL') {
        try {
          const u = new URL(v)
          if (u.protocol !== 'http:' && u.protocol !== 'https:') return issue('type', `${def.key} 는 http(s) 주소여야 합니다.`, { expected: TYPE_LABEL.URL })
        } catch {
          return issue('type', `${def.key} 는 http(s) 주소여야 합니다.`, { expected: TYPE_LABEL.URL })
        }
      }
      if (def.pattern && !new RegExp(def.pattern).test(v)) return issue('pattern', `${def.key} 형식이 올바르지 않습니다.`, { expected: def.pattern })
      // 기본값이 빈 문자열인 키(예: 허용 도구 목록)는 빈 값이 정상이다 — 저장값·스냅샷 재검증에서 오탐하지 않게.
      if (def.type === 'STRING' && len === 0 && def.pattern === undefined && def.default !== '') return issue('required', `${def.key} 값이 필요합니다.`)
      if (secretLikeValue(def, v)) return issue('secretValue', SECRET_VALUE_MESSAGE)
      return []
    }
    case 'INTEGER':
    case 'NUMBER': {
      if (typeof v !== 'number' || !Number.isFinite(v) || (def.type === 'INTEGER' && !Number.isInteger(v))) return issue('type', `${def.key} 는 ${TYPE_LABEL[def.type]}여야 합니다.`, { expected: TYPE_LABEL[def.type] })
      if (def.min != null && v < def.min) return issue('min', `${def.key} 는 ${def.min} 이상이어야 합니다.`, { expected: def.min, actual: v })
      if (def.max != null && v > def.max) return issue('max', `${def.key} 는 ${def.max} 이하여야 합니다.`, { expected: def.max, actual: v })
      return []
    }
    case 'BOOLEAN':
      return typeof v === 'boolean' ? [] : issue('type', `${def.key} 는 true/false 여야 합니다.`, { expected: TYPE_LABEL.BOOLEAN })
    case 'JSON': {
      if (JSON.stringify(v) === undefined || JSON.stringify(v).length > 8_000) return issue('type', `${def.key} 는 8KB 이하 JSON 이어야 합니다.`)
      const scan = scanJsonSecret(v, 1)
      if (scan === 'LIMIT') return issue('type', `${def.key} 는 ${JSON_SCAN_DEPTH}단·배열 ${JSON_SCAN_ARRAY}개 이하 JSON 이어야 합니다.`)
      if (scan === 'SECRET') return issue('secretValue', SECRET_VALUE_MESSAGE)
      return []
    }
    case 'SECRET_REF':
      return []
  }
  return []
}

/** SECRET_REF 값 검사(평문 → secretValue, 허용 목록 → refNotAllowed, 형식 → pattern, 존재 → reference). 값은 오류에 싣지 않는다. */
export function checkSecretRefValue(def: EditKeyDef, v: unknown, checkExists: boolean): ValidationIssue[] {
  if (v === null) return []
  if (typeof v !== 'string') return [{ key: def.key, rule: 'secretValue', message: '비밀 값 대신 env:/file: 참조 이름만 넣을 수 있습니다.' }]
  const r = checkCredentialRef(def.allowedRefs ?? [], v, { checkExists })
  if (r.ok) return []
  switch (r.problem) {
    case 'PLAINTEXT':
      return [{ key: def.key, rule: 'secretValue', message: '비밀 값 대신 env:/file: 참조 이름만 넣을 수 있습니다.' }]
    case 'REF_NOT_ALLOWED':
      return [{ key: def.key, rule: 'refNotAllowed', message: '이 연결에 허용되지 않은 비밀 참조입니다.', ...(def.allowedRefs ? { related: [...def.allowedRefs] } : {}) }]
    case 'BAD_FORMAT':
      return [{ key: def.key, rule: 'pattern', message: '참조 이름 형식이 올바르지 않습니다(env:NAME | file:name).' }]
    case 'MISSING':
      return [{ key: def.key, rule: 'reference', message: '서버에 그 참조 값이 없습니다.' }]
  }
}

const defaultEnvSet = (name: string) => Boolean(process.env[name]?.trim())

/**
 * `patch`(점 표기 키 → 값)를 `stored`(지금 저장값, 평면)에 겹친 후보를 검증한다. `defs` 에 없는 저장 키는 손대지 않은 한 문제 삼지 않는다.
 */
export async function validatePatch(defs: readonly EditKeyDef[], stored: Readonly<Record<string, unknown>>, patch: unknown, hooks: ValidateHooks = {}): Promise<ValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationWarning[] = []
  const changed: string[] = []
  const empty = { runtimeEditable: [], restartRequired: [], redeployRequired: [], strict: [] }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { valid: false, stage: 'JSON_SYNTAX', errors: [{ key: '', rule: 'type', message: 'patch 는 키 → 값 객체여야 합니다.' }], warnings, changedKeys: [], impact: empty }
  }
  const byKey = new Map(defs.map((d) => [d.key, d]))
  const allow = new Set(hooks.allowLocks ?? [])
  const vet = hooks.vetUrl ?? vetConnectionUrl
  const envSet = hooks.envSet ?? defaultEnvSet
  const entries = Object.entries(patch as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (errors.length >= MAX_ERRORS) break
    if (!SAFE_KEY.test(key)) {
      errors.push({ key: key.slice(0, 40), rule: 'unknownKey', message: '키 이름 형식이 올바르지 않습니다.' })
      continue
    }
    const def = byKey.get(key)
    if (!def) {
      if (key.startsWith('x-')) {
        warnings.push({ key, code: 'W_EXTENSION_KEY', message: '확장 키(x-)는 저장하지 않고 적용하지도 않습니다.' })
        continue
      }
      if (Object.prototype.hasOwnProperty.call(stored, key) && sameValue(stored[key], value)) continue
      const suggestion = suggestKey(key, defs.map((d) => d.key))
      errors.push({ key, rule: 'unknownKey', message: suggestion ? `스키마에 없는 키입니다. '${suggestion}' 을 의도했습니까?` : '스키마에 없는 키입니다.', ...(suggestion ? { suggestion } : {}) })
      continue
    }
    if (sameValue(stored[key], value)) continue
    changed.push(key)
    if (def.lock && !allow.has(def.lock)) {
      errors.push({ key, rule: lockRule(def.lock), message: lockMessage(def.lock), lock: def.lock })
    }
    if (def.type === 'SECRET_REF') {
      errors.push(...checkSecretRefValue(def, value, hooks.checkRefExists === true))
      continue
    }
    const typeIssues = checkEditValue(def, value)
    errors.push(...typeIssues)
    if (typeIssues.length === 0 && def.type === 'URL' && typeof value === 'string') {
      const v = await vet(value)
      if (!v.ok) errors.push({ key, rule: 'hostNotAllowed', message: '허용되지 않은 연결 주소입니다(같은 기기·집 LAN·서버에 설정된 서비스 주소만).', related: [v.reason] })
    }
    if (def.runtimeEnvWins?.some(envSet)) warnings.push({ key, code: 'W_SHADOWED_BY_ENVIRONMENT', message: '서버 설정(env)이 이 값보다 우선합니다 — 저장해도 효력이 없습니다.' })
  }
  const impact = {
    runtimeEditable: changed.filter((k) => byKey.get(k)?.editability === 'RUNTIME_EDITABLE'),
    restartRequired: changed.filter((k) => byKey.get(k)?.editability === 'RESTART_REQUIRED'),
    redeployRequired: changed.filter((k) => byKey.get(k)?.editability === 'REDEPLOY_REQUIRED'),
    strict: changed.filter((k) => byKey.get(k)?.strict),
  }
  if (errors.length) return { valid: false, stage: 'SCHEMA', errors: errors.slice(0, MAX_ERRORS), warnings, changedKeys: changed, impact }
  if (hooks.dependency && changed.length) {
    const candidate = { ...stored, ...(patch as Record<string, unknown>) }
    const dep = await hooks.dependency(candidate, changed)
    if (dep.length) return { valid: false, stage: 'DEPENDENCY', errors: dep.slice(0, MAX_ERRORS), warnings, changedKeys: changed, impact }
  }
  return { valid: true, stage: null, errors: [], warnings, changedKeys: changed, impact }
}
