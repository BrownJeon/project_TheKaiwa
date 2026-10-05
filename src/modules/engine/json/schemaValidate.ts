/**
 * 구조화 출력(JSON) 검증 + **위반 목록 첨부 1회 재시도** — 설계안 §8.
 * VoiceVault `src/lib/ai/schemaValidate.ts`에서 이식하되, VoiceVault 고유의
 * "사용자 정의 템플릿 outputSchema 저장 검증"(`assertSupportedSchema`)은 뺐다.
 * TheMeal의 스키마는 전부 `lib/ai/prompts/*`가 코드로 들고 있고 사용자가 만들지 않는다.
 *
 * 이 모듈은 **텍스트 LLM과 비전(Claude CLI) 양쪽에서 같이 쓴다** — 그래서 재시도 루프의
 * 핵심(`runJsonWithRetry`)은 "한 번 호출해서 문자열을 받는다"는 것 말고는 아무것도 모른다.
 *
 * ajv 설정: `new Ajv({ allErrors: true, strict: false })` — draft-07 서브셋.
 */
import Ajv, { type ErrorObject } from 'ajv'

import { extractJson } from './extractJson'
import { repairRootClose } from './repairRootClose'
import { chatMessages, LlmError, type LlmCallOptions, type LlmMessage } from '../adapters/llm/homeM4'

const ajv = new Ajv({ allErrors: true, strict: false })

/** 컴파일된 validator 캐시 — 같은 스키마 객체를 매 호출 재컴파일하지 않는다(스키마는 모듈 상수다). */
const compiledCache = new WeakMap<object, ReturnType<typeof ajv.compile>>()

function compile(schema: object) {
  const hit = compiledCache.get(schema)
  if (hit) return hit
  const fn = ajv.compile(schema)
  compiledCache.set(schema, fn)
  return fn
}

// ── "응답은 JSON 객체 하나뿐" 지시문 ───────────────────────────────────────────

/**
 * 모든 구조화 출력 프롬프트에 반드시 들어가야 하는 지시문(CLAUDE.md AI 연동 원칙).
 *
 * 지시문 없이 부르면 모델이 "네, 분석해 드리겠습니다" 같은 서문을 붙이고, 그러면
 * `extractJson`이 관용적으로 건져내더라도 재시도 확률이 올라가 호출 비용이 두 배가 된다.
 */
export const JSON_ONLY_INSTRUCTION =
  '응답은 JSON 객체 하나뿐이다. 설명·인사말·마크다운 코드펜스를 붙이지 마라. 첫 글자는 { 이고 마지막 글자는 } 여야 한다.'

/**
 * 프롬프트 끝에 JSON-only 지시문을 붙인다(이미 들어 있으면 그대로 둔다).
 * `schema`를 주면 기대 스키마도 함께 실어 모델이 필드명을 추측하지 않게 한다.
 *
 * **프롬프트 모듈(`lib/ai/prompts/*`)은 이 헬퍼를 거쳐서만 최종 프롬프트를 만든다** —
 * 지시문을 손으로 복붙하면 한 곳이 빠지는 것이 결국 시간 문제다.
 */
export function withJsonOnly(prompt: string, schema?: object): string {
  const parts = [prompt.trimEnd()]
  if (schema) {
    parts.push(`\n[출력 JSON 스키마]\n${JSON.stringify(schema)}`)
  }
  if (!prompt.includes(JSON_ONLY_INSTRUCTION)) {
    parts.push(`\n${JSON_ONLY_INSTRUCTION}`)
  }
  return parts.join('\n')
}

// ── ajv 오류 → 한국어 위반 문구 ────────────────────────────────────────────────

function getByPointer(data: unknown, pointer: string): unknown {
  if (!pointer) return data
  const parts = pointer
    .split('/')
    .filter((p) => p.length > 0)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let cur: unknown = data
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function actualTypeLabel(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

function pathOrRoot(instancePath: string): string {
  return instancePath.length > 0 ? instancePath : '(루트)'
}

/** ajv `ErrorObject[]` → 모델이 읽고 고칠 수 있는 한국어 위반 문구. */
function ajvErrorsToViolations(errors: ErrorObject[], data: unknown): string[] {
  const out: string[] = []
  for (const err of errors) {
    const path = pathOrRoot(err.instancePath)
    const params = err.params as Record<string, unknown>

    switch (err.keyword) {
      case 'required':
        out.push(`${path}: 필수 필드 '${String(params.missingProperty)}' 누락`)
        break
      case 'type': {
        const allowed = String(params.type).split(',').join('|')
        const actual = actualTypeLabel(getByPointer(data, err.instancePath))
        out.push(`${path}: 타입 오류 — ${allowed}이어야 함(현재 ${actual})`)
        break
      }
      case 'additionalProperties':
        out.push(`${path}: 허용되지 않은 필드 '${String(params.additionalProperty)}' 포함`)
        break
      case 'enum': {
        const allowed = (params.allowedValues as unknown[]).join('|')
        const actual = JSON.stringify(getByPointer(data, err.instancePath))
        out.push(`${path}: 허용값 [${allowed}] 중 하나여야 함(현재 ${actual})`)
        break
      }
      case 'minLength':
        out.push(`${path}: 최소 길이 ${String(params.limit)} 미달(빈 값 불가)`)
        break
      case 'minimum':
      case 'exclusiveMinimum':
        out.push(`${path}: ${String(params.limit)} 이상이어야 함`)
        break
      case 'maximum':
      case 'exclusiveMaximum':
        out.push(`${path}: ${String(params.limit)} 이하여야 함`)
        break
      case 'minItems':
        out.push(`${path}: 항목이 최소 ${String(params.limit)}개 필요`)
        break
      case 'maxItems':
        out.push(`${path}: 항목 수 ${String(params.limit)}개 초과`)
        break
      default:
        out.push(`${path}: ${err.message ?? '스키마 위반'}`)
    }
  }
  return out
}

/**
 * ajv 통과 후 추가 검사 — 자리표시자(`<...>`)가 그대로 남은 문자열 탐지.
 * 스키마 스켈레톤을 그대로 베껴 보내는 이탈은 타입상 완벽해서 ajv가 절대 못 잡는다.
 */
function checkPlaceholderLeftovers(data: unknown): string[] {
  const out: string[] = []
  function walk(node: unknown, path: string): void {
    if (typeof node === 'string') {
      if (/^<.+>$/.test(node)) {
        out.push(`${path || '(루트)'}: 자리표시자 <...>가 교체되지 않음 — 실제 내용으로 작성하라`)
      }
      return
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}/${i}`))
      return
    }
    if (node !== null && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, `${path}/${k}`)
    }
  }
  walk(data, '')
  return out
}

/** 중복 제거 + 최대 10줄 절단(재시도 프롬프트가 원본보다 커지는 걸 막는다). */
function finalizeViolations(list: string[]): string[] {
  const uniq = [...new Set(list)]
  if (uniq.length <= 10) return uniq
  const head = uniq.slice(0, 10)
  head.push(`- 외 ${uniq.length - 10}건`)
  return head
}

// ── 스키마 밖 필드 제거(요청 옵트인, task-010 후속 → task-019) ────────────────

/**
 * `stripAdditionalProperties: true` 로 부른 요청만 아래 `stripUnknownAdditionalProperties` 대상이 된다(`RunJsonOptions`·
 * `LlmJsonRequest` 의 옵션, 기본 false). 지금 켜는 곳은 A4 `conversation/prompts/lesson.ts` `buildLessonRequest` 하나뿐
 * (2026-09-29, task-010 후속: A4 1차 응답의 `quiz[]` 에 스키마 밖 필드 `q`·`conjugationNote` 가 붙어 `additionalProperties`
 * 위반 → 불필요한 재시도(+약 30s, 한 번은 149s 상한 초과로 FAILED) — 실측: task-010 이력서 "2026-09-29 01:50 Leader").
 * TALK·CHAT·WORD_ENRICH·CHAT_REVIEW·EVAL_GEN·EVAL_GRADE 등 다른 요청은 옵션을 켜지 않으므로 동작이 전혀 바뀌지 않는다.
 * 처음엔 스키마 객체를 모듈 로드 시 전역 WeakSet 에 등록했으나(참조 동일성이 끊기면 조용히 꺼지고, conversation 이 engine 내부
 * 상태를 원격으로 바꿨다) REV-034 ⑥ 권고대로 요청 옵션으로 옮겼다(task-019).
 *
 * 아래 `WalkSchema` 는 `anyOf`(nullable 2분기)만 따라간다 — `oneOf`·`allOf`·`$ref` 노드는 건너뛴다(그 아래는 지우지 않는다,
 * fail-safe; REV-034 Low). 이 옵션을 새 스키마에 켜려면 그런 구성이 없는지 먼저 본다.
 */
interface WalkSchema {
  type?: string
  properties?: Record<string, WalkSchema>
  additionalProperties?: boolean
  items?: WalkSchema
  anyOf?: WalkSchema[]
}

/**
 * `data` 를 스키마 트리를 따라 **in-place** 로 정리한다 — 그 위치의 스키마가 `additionalProperties:false` 이고
 * `properties` 에 없는 키만 지운다. **필수 필드는 절대 건드리지 않는다**(required 키는 항상 `properties` 에도
 * 있으므로 "추가" 취급되지 않는다). 필드 이름이 통째로 바뀐 경우(예: `promptJa` 대신 `q`)는 이 함수가 손대지
 * 않는다 — `promptJa` 자리는 여전히 비어 있어 뒤이은 ajv 검증이 `required` 위반으로 그대로 잡고, 지금처럼
 * 재시도로 간다(이름을 추측해서 매핑하지 않는다). 지운 키의 **경로만**(값은 절대) 돌려준다 — 로그용.
 */
function stripAdditionalPropertiesWalk(data: unknown, schema: WalkSchema, path: string, out: string[]): void {
  if (schema.anyOf) {
    const branch = schema.anyOf.find((s) => (data === null ? s.type === 'null' : s.type !== 'null'))
    if (branch) stripAdditionalPropertiesWalk(data, branch, path, out)
    return
  }
  if (schema.type === 'array') {
    if (!Array.isArray(data) || !schema.items) return
    data.forEach((item, i) => stripAdditionalPropertiesWalk(item, schema.items!, `${path}/${i}`, out))
    return
  }
  if (schema.type === 'object') {
    if (data === null || typeof data !== 'object' || Array.isArray(data) || !schema.properties) return
    const record = data as Record<string, unknown>
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties))
      for (const key of Object.keys(record)) {
        if (!allowed.has(key)) {
          delete record[key]
          out.push(path ? `${path}/${key}` : key)
        }
      }
    }
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in record) stripAdditionalPropertiesWalk(record[key], subSchema, path ? `${path}/${key}` : key, out)
    }
  }
}

/** `data` 를 정리하고 제거한 키 경로 목록을 돌려준다(값은 싣지 않는다). */
function stripUnknownAdditionalProperties(data: unknown, schema: object): string[] {
  const out: string[] = []
  stripAdditionalPropertiesWalk(data, schema as WalkSchema, '', out)
  return out
}

export type ValidateResult = { ok: true } | { ok: false; violations: string[] }

/** ajv 구조 검증 + 자리표시자 잔존 검사. */
export function validateOutput(data: unknown, schema: object): ValidateResult {
  const validateFn = compile(schema)
  const valid = validateFn(data)
  if (!valid) {
    return { ok: false, violations: finalizeViolations(ajvErrorsToViolations(validateFn.errors ?? [], data)) }
  }
  const leftovers = checkPlaceholderLeftovers(data)
  if (leftovers.length > 0) {
    return { ok: false, violations: finalizeViolations(leftovers) }
  }
  return { ok: true }
}

/** `repaired` — 이 결과가 `repairRootClose` 로 구문 슬립을 고친 응답에서 나왔다(옵트인 요청에서만, 정상 응답에는 키 자체가 없다). */
export type JsonRepair = 'ROOT_CLOSE'

export type AnalyzeResult =
  | { ok: true; data: unknown; repaired?: JsonRepair }
  | { ok: false; parseError: true }
  | { ok: false; parseError: false; violations: string[] }

/**
 * `extractJson` 관용 추출 + `validateOutput`. 코드펜스·전후 잡담이 있어도 **추출에 성공하면
 * 재시도 없이 성공 처리**한다 — 재시도는 비싸고, 우리가 원하는 건 형식이 아니라 값이다.
 */
export interface ExtractOptions {
  /** true 면 파싱 직후·ajv 전에 스키마 밖 키를 지운다(위 "스키마 밖 필드 제거" 절). 기본 false. */
  stripAdditionalProperties?: boolean
  /**
   * true 면 `extractJson` 이 **실패했을 때만** `repairRootClose`(루트를 한 칸 일찍 닫는 구문 슬립의 좁은 복구 — task-037)를 시도하고,
   * 복구한 객체도 같은 ajv·extraCheck 를 통과해야 한다. `extractJson` 이 성공하는 응답은 이 옵션과 무관하게 결과가 같다.
   * 기본 false — 켜는 곳은 TALK·CHAT 요청 둘뿐(`buildTalkRequest`·`buildChatRequest`).
   */
  repairRootClose?: boolean
}

/** 복구 문자열을 객체로 읽는다. 읽히지 않으면(또는 객체가 아니면) undefined — 호출자는 원래의 parseError 경로를 그대로 탄다. */
function parseRepaired(raw: string): Record<string, unknown> | undefined {
  const fixed = repairRootClose(raw)
  if (fixed === null) return undefined
  try {
    const parsed: unknown = JSON.parse(fixed)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

export function extractAndValidate(raw: string, schema: object, opts: ExtractOptions = {}): AnalyzeResult {
  let parsed: unknown
  let repaired: JsonRepair | undefined
  try {
    parsed = extractJson(raw)
  } catch {
    const fixed = opts.repairRootClose ? parseRepaired(raw) : undefined
    if (!fixed) return { ok: false, parseError: true }
    parsed = fixed
    repaired = 'ROOT_CLOSE'
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, parseError: true }
  }

  const removed = opts.stripAdditionalProperties ? stripUnknownAdditionalProperties(parsed, schema) : []
  if (removed.length > 0) {
    // 키 이름·개수만(값·원문·학습자 텍스트 없음) — 옵션을 켠 요청(현재 LESSON 하나)에서만 나온다.
    console.info(`[json] 스키마 밖 필드 제거: ${removed.slice(0, 10).join(', ')}${removed.length > 10 ? ` 외 ${removed.length - 10}건` : ''}`)
  }

  const result = validateOutput(parsed, schema)
  if (result.ok) return repaired ? { ok: true, data: parsed, repaired } : { ok: true, data: parsed }
  return { ok: false, parseError: false, violations: result.violations }
}

// ── 재시도 프롬프트 ────────────────────────────────────────────────────────────

export function RETRY_SCHEMA(violations: string[]): string {
  return `방금 출력이 요구한 JSON 형식을 위반했다. 아래 위반 사항을 모두 수정해서, 완전한 JSON 객체 전체를 처음부터 다시 출력하라.

위반 사항:
${violations.join('\n')}

규칙 재확인:
- ${JSON_ONLY_INSTRUCTION}
- 위반된 필드만 고치는 것이 아니라 전체 JSON을 다시 출력한다.
- 스키마에 없는 필드는 제거하고, 누락된 required 필드는 빈 배열([]) 또는 null로라도 반드시 포함한다.`
}

export const RETRY_PARSE = `방금 응답에서 유효한 JSON을 찾지 못했다. 설명·인사말·마크다운 없이, 요구한 스키마를 따르는 JSON 객체 하나만 처음부터 다시 출력하라.
${JSON_ONLY_INSTRUCTION}`

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) : text
}

/** 재시도 1회까지 했는데도 계약을 못 지킨 응답. `raw`는 서버 로그 진단용이다. */
export class JsonSchemaError extends LlmError {
  readonly violations: string[]
  readonly raw: string

  constructor(violations: string[], raw: string) {
    super(
      `AI 응답이 JSON 계약을 어겼습니다(재시도 1회 후에도 실패) — ${violations.join(' / ') || 'JSON 파싱 실패'}`,
      'AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.',
    )
    this.name = 'JsonSchemaError'
    this.violations = violations
    this.raw = raw
  }
}

// ── 재시도 루프(공통) ──────────────────────────────────────────────────────────

/** 시도 1회. `retry`가 null이면 첫 시도, 아니면 위반 목록을 첨부한 재시도다. */
export type JsonAttemptFn = (retry: { hint: string; previousRaw: string } | null) => Promise<string>

/** 한 `runJsonWithRetry` 호출의 최대 시도 수(1차 + 재시도 1회, 아래 "재시도를 1회로 고정하는 이유"). */
export const JSON_MAX_ATTEMPTS = 2

/**
 * `extraCheck` 가 받는 시도 정보 — **이 `runJsonWithRetry` 호출 안에서** 몇 번째 시도인지. router 폴백
 * (`engine/llm` `completeJson` → `withFallback`)은 connection 마다 이 함수를 새로 부르므로 connection 이 바뀌면
 * 다시 1부터 센다(REV-032 M1 — 호출자 클로저 카운터는 폴백 경계를 넘어 누적됐다). ajv 단계에서 걸려 `extraCheck`
 * 가 불리지 않은 시도도 번호를 차지한다.
 */
export interface JsonAttemptInfo {
  /** 1 = 첫 시도, 2 = 위반 목록을 첨부한 재시도. */
  attempt: number
  /** `attempt === maxAttempts` 면 이 호출의 마지막 시도다(더 고칠 기회가 없다). */
  maxAttempts: number
}

export interface RunJsonOptions {
  schema: object
  /**
   * ajv로 표현할 수 없는 추가 검사(예: 재료명 중복, 합계 불일치). 위반이 있으면 재시도한다. 두 번째 인자(시도 정보)는
   * 항상 채워 부르며, 필요 없는 검사는 받지 않아도 된다.
   */
  extraCheck?: (data: unknown, info: JsonAttemptInfo) => string[]
  /**
   * true 면 `extraCheck` 위반은 **재시도 1회 뒤에도 던지지 않는다**(스키마·파싱 위반은 그대로 던진다). 결과의
   * `residualViolations` 에 남은 위반을, `candidates` 에 스키마를 통과한 시도 전부를 담아 돌려주고 항목별로 버리는 판단은
   * 호출자가 한다 — 항목 하나의 위반으로 응답 전체를 잃지 않기 위해서다(task-006 D11). 재시도 호출 자체가 실패하거나
   * 재시도 응답이 스키마를 어기면 첫 응답으로 돌아간다(이미 받은 정상 항목을 버리지 않는다).
   */
  softExtraCheck?: boolean
  /** true 면 매 시도의 파싱 직후·ajv 전에 스키마 밖 키를 지운다(`ExtractOptions`). 기본 false — 켜는 곳은 A4 LESSON 하나. */
  stripAdditionalProperties?: boolean
  /**
   * true 면 `extractJson` 이 실패한 시도에 한해 루트 조기 닫힘 구문 슬립을 고쳐 읽는다(`ExtractOptions.repairRootClose`, task-037). 고친 객체도
   * ajv·`extraCheck` 를 그대로 통과해야 하고, 통과하면 재시도 없이 `attempts: 1` 로 끝난다. 기본 false — 켜는 곳은 TALK·CHAT 둘뿐.
   */
  repairRootClose?: boolean
}

export interface RunJsonResult<T> {
  data: T
  attempts: 1 | 2
  /** softExtraCheck 일 때만: `data` 에 남은 extraCheck 위반(없으면 빈 배열). */
  residualViolations?: string[]
  /** softExtraCheck 일 때만: 스키마를 통과한 시도의 데이터(시도 순서, 마지막이 `data` 와 같지 않을 수 있다). */
  candidates?: T[]
  /** `data` 가 구문 슬립 복구(`repairRootClose`)를 거친 응답에서 나왔을 때만(없으면 키 자체가 없다) — Trace 가 슬립 빈도를 세는 표식. */
  repaired?: JsonRepair
}

function attemptInfo(attempt: number): JsonAttemptInfo {
  return { attempt, maxAttempts: JSON_MAX_ATTEMPTS }
}

function extractOptionsOf(opts: RunJsonOptions): ExtractOptions {
  return { stripAdditionalProperties: opts.stripAdditionalProperties === true, repairRootClose: opts.repairRootClose === true }
}

/**
 * `repaired` 가 있는 시도를 데이터로 **받아들였을 때** 한 줄(응답·문장 내용 없음) — 복구 횟수를 로그로 센다. `savedRetry` 는 이 복구 덕에
 * 재시도를 하지 않았는가(1차 응답을 그대로 받았을 때만 true). 줄 앞부분 `구문 슬립 복구(ROOT_CLOSE)` 는 두 경우 모두 같다.
 */
function noteRepair(r: { repaired?: JsonRepair }, savedRetry: boolean): void {
  if (!r.repaired) return
  console.warn(`[json] 구문 슬립 복구(${r.repaired}) — ${savedRetry ? '재시도 생략' : '재시도 경로에서 복구본 사용'}`)
}

function evaluateAttempt(raw: string, schema: object, info: JsonAttemptInfo, extraCheck: RunJsonOptions['extraCheck'], extract: ExtractOptions): AnalyzeResult {
  const result = extractAndValidate(raw, schema, extract)
  if (!result.ok) return result
  if (extraCheck) {
    const extra = extraCheck(result.data, info)
    if (extra.length > 0) {
      return { ok: false, parseError: false, violations: finalizeViolations(extra) }
    }
  }
  return result
}

/**
 * **구조화 출력의 단일 관문** — 호출 → `extractJson` → ajv → (위반 시) 위반 목록 첨부 재시도
 * **1회** → 그래도 실패면 `JsonSchemaError`.
 *
 * 재시도를 1회로 고정하는 이유: 두 번 어긴 응답이 세 번째에 맞는 경우는 실측상 드물고,
 * 그 사이 사용자는 예산의 3배를 기다린다. 실패를 빨리 드러내는 편이 낫다.
 *
 * 텍스트 LLM(`runJsonAnalysis`)과 비전(`visionClient`)이 같은 함수를 쓴다 — 이 함수는
 * "문자열 하나를 받아온다"는 것 말고 호출 수단을 알지 못한다.
 */
export async function runJsonWithRetry<T = unknown>(
  attempt: JsonAttemptFn,
  opts: RunJsonOptions,
): Promise<RunJsonResult<T>> {
  if (opts.softExtraCheck) return runJsonSoft<T>(attempt, opts)
  const extract = extractOptionsOf(opts)
  const raw1 = await attempt(null)
  const r1 = evaluateAttempt(raw1, opts.schema, attemptInfo(1), opts.extraCheck, extract)
  if (r1.ok) {
    noteRepair(r1, true)
    return { data: r1.data as T, attempts: 1, ...(r1.repaired ? { repaired: r1.repaired } : {}) }
  }

  // 재시도 원인을 남긴다 — 위반 문구는 필드 경로·규칙뿐이라 학습자 원문이 들어가지 않는다(extraCheck 문구도 고정 문장).
  console.warn(`[json] 1차 응답 계약 위반 → 재시도: ${r1.parseError ? 'JSON 파싱 실패' : r1.violations.slice(0, 3).join(' / ').slice(0, 300)}`)
  const hint = r1.parseError ? RETRY_PARSE : RETRY_SCHEMA(r1.violations)
  const raw2 = await attempt({ hint, previousRaw: truncate(raw1, 8000) })
  const r2 = evaluateAttempt(raw2, opts.schema, attemptInfo(2), opts.extraCheck, extract)
  if (r2.ok) {
    noteRepair(r2, false)
    return { data: r2.data as T, attempts: 2, ...(r2.repaired ? { repaired: r2.repaired } : {}) }
  }

  throw new JsonSchemaError(r2.parseError ? ['JSON 파싱 실패'] : r2.violations, raw2)
}

/**
 * softExtraCheck 경로(task-006 D11). 재시도는 기존과 같이 1회뿐이고, 스키마·파싱 위반의 처리도 같다. 다른 점은
 * extraCheck 위반이 남아도 던지지 않고 마지막으로 스키마를 통과한 데이터를 돌려준다는 것 하나다.
 */
async function runJsonSoft<T>(attempt: JsonAttemptFn, opts: RunJsonOptions): Promise<RunJsonResult<T>> {
  const extra = (d: unknown, n: number) => (opts.extraCheck ? finalizeViolations(opts.extraCheck(d, attemptInfo(n))) : [])
  const extract = extractOptionsOf(opts)
  const raw1 = await attempt(null)
  const s1 = extractAndValidate(raw1, opts.schema, extract)
  const v1 = s1.ok ? extra(s1.data, 1) : []
  // 돌려주는 `data` 가 복구한 응답에서 나왔을 때만 표식을 단다(`data` 의 출처를 따라간다).
  const from = (r: AnalyzeResult & { ok: true }, savedRetry: boolean) => {
    noteRepair(r, savedRetry)
    return r.repaired ? ({ repaired: r.repaired } as const) : {}
  }
  if (s1.ok && v1.length === 0) return { data: s1.data as T, attempts: 1, residualViolations: [], candidates: [s1.data as T], ...from(s1, true) }

  const violations = s1.ok ? v1 : s1.parseError ? null : s1.violations
  console.warn(`[json] 1차 응답 계약 위반 → 재시도(soft): ${violations ? violations.slice(0, 3).join(' / ').slice(0, 300) : 'JSON 파싱 실패'}`)
  const hint = violations ? RETRY_SCHEMA(violations) : RETRY_PARSE
  let raw2: string
  try {
    raw2 = await attempt({ hint, previousRaw: truncate(raw1, 8000) })
  } catch (e) {
    // 재시도 호출이 실패(시간 초과 등)해도 스키마를 통과한 첫 응답이 있으면 그것을 쓴다.
    if (s1.ok) return { data: s1.data as T, attempts: 2, residualViolations: v1, candidates: [s1.data as T], ...from(s1, false) }
    throw e
  }
  const s2 = extractAndValidate(raw2, opts.schema, extract)
  if (s2.ok) {
    const candidates = s1.ok ? [s1.data as T, s2.data as T] : [s2.data as T]
    return { data: s2.data as T, attempts: 2, residualViolations: extra(s2.data, 2), candidates, ...from(s2, false) }
  }
  if (s1.ok) return { data: s1.data as T, attempts: 2, residualViolations: v1, candidates: [s1.data as T], ...from(s1, false) }
  throw new JsonSchemaError(s2.parseError ? ['JSON 파싱 실패'] : s2.violations, raw2)
}

// ── 텍스트 LLM(home-m4-api) 경로 ──────────────────────────────────────────────

export type ChatFn = (messages: LlmMessage[], opts?: LlmCallOptions) => Promise<string>

export interface RunJsonAnalysisOptions extends RunJsonOptions {
  /** [system, user, ...] — system이 첫 번째가 아니면 `llmClient`가 던진다. */
  messages: LlmMessage[]
  callOpts?: LlmCallOptions
  /** 테스트에서 mock 주입. 기본은 `llmClient.chatMessages`. */
  chatFn?: ChatFn
  /**
   * **시도마다** 그 시도가 실제로 보낼 messages로 상한을 다시 계산하는 훅.
   * 재시도 프롬프트는 원본 + 1차 원문(≤8,000자) + 지시만큼 커지므로, 1차 프롬프트로 계산한
   * 상한을 재사용하면 **더 큰 프롬프트에 더 작은 예산**을 주게 된다.
   * 미지정이면 상한은 `llmClient`가 각 시도의 프롬프트에서 유도한다(동기 경로 기본값).
   */
  resolveTimeoutMs?: (messages: LlmMessage[]) => number
}

/** home-m4-api 구조화 호출 + 재시도 1회. 라우트·잡 러너는 이 함수만 부른다. */
export async function runJsonAnalysis<T = unknown>(opts: RunJsonAnalysisOptions): Promise<RunJsonResult<T>> {
  const chat = opts.chatFn ?? chatMessages
  const callOptsFor = (messages: LlmMessage[]): LlmCallOptions | undefined =>
    opts.resolveTimeoutMs ? { ...opts.callOpts, timeoutMs: opts.resolveTimeoutMs(messages) } : opts.callOpts

  return runJsonWithRetry<T>(
    (retry) => {
      const messages: LlmMessage[] = retry
        ? [
            ...opts.messages,
            { role: 'assistant', content: retry.previousRaw },
            { role: 'user', content: retry.hint },
          ]
        : opts.messages
      return chat(messages, callOptsFor(messages))
    },
    { schema: opts.schema, extraCheck: opts.extraCheck, stripAdditionalProperties: opts.stripAdditionalProperties, repairRootClose: opts.repairRootClose },
  )
}
