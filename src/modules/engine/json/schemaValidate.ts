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

export type AnalyzeResult =
  | { ok: true; data: unknown }
  | { ok: false; parseError: true }
  | { ok: false; parseError: false; violations: string[] }

/**
 * `extractJson` 관용 추출 + `validateOutput`. 코드펜스·전후 잡담이 있어도 **추출에 성공하면
 * 재시도 없이 성공 처리**한다 — 재시도는 비싸고, 우리가 원하는 건 형식이 아니라 값이다.
 */
export function extractAndValidate(raw: string, schema: object): AnalyzeResult {
  let parsed: unknown
  try {
    parsed = extractJson(raw)
  } catch {
    return { ok: false, parseError: true }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, parseError: true }
  }

  const result = validateOutput(parsed, schema)
  if (result.ok) return { ok: true, data: parsed }
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

export interface RunJsonOptions {
  schema: object
  /** ajv로 표현할 수 없는 추가 검사(예: 재료명 중복, 합계 불일치). 위반이 있으면 재시도한다. */
  extraCheck?: (data: unknown) => string[]
}

export interface RunJsonResult<T> {
  data: T
  attempts: 1 | 2
}

function evaluateAttempt(raw: string, schema: object, extraCheck?: (data: unknown) => string[]): AnalyzeResult {
  const result = extractAndValidate(raw, schema)
  if (!result.ok) return result
  if (extraCheck) {
    const extra = extraCheck(result.data)
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
  const raw1 = await attempt(null)
  const r1 = evaluateAttempt(raw1, opts.schema, opts.extraCheck)
  if (r1.ok) return { data: r1.data as T, attempts: 1 }

  const hint = r1.parseError ? RETRY_PARSE : RETRY_SCHEMA(r1.violations)
  const raw2 = await attempt({ hint, previousRaw: truncate(raw1, 8000) })
  const r2 = evaluateAttempt(raw2, opts.schema, opts.extraCheck)
  if (r2.ok) return { data: r2.data as T, attempts: 2 }

  throw new JsonSchemaError(r2.parseError ? ['JSON 파싱 실패'] : r2.violations, raw2)
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
    { schema: opts.schema, extraCheck: opts.extraCheck },
  )
}
