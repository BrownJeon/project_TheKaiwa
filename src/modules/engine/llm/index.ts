/**
 * LLM 역할 파사드 — 상위 층(conversation·learning)은 이것만 부른다(module-dependency L5 공개 API).
 * 어댑터(claude-cli·home-m4)·모델명·spawn 은 여기 아래에만 있다.
 *
 *   complete(req)        → 텍스트
 *   completeJson(req)    → extractJson + ajv + (위반 시) 1회 재시도, `extraCheck` 로 코드 후검증
 *
 * 프롬프트 구성 규칙:
 *   - `persona` 는 claude-cli 에서 `--agents {name:{description,prompt}} --agent name` 으로 시스템 프롬프트가 된다
 *     (model 은 agents JSON 에 넣지 않는다). home-m4 에서는 system 메시지 앞머리에 들어간다.
 *   - `system` 은 모드별 출력 지시(JSON-only 포함). `messages` 는 대화 창(마지막이 이번 입력).
 */
import { callClaude } from '../adapters/llm/claudeCli'
import { HomeM4ApiCaller, LlmContractError, type LlmMessage } from '../adapters/llm/homeM4'
import { runJsonWithRetry, withJsonOnly, type RunJsonResult } from '../json/schemaValidate'
import { LLM_TASKS, withFallback, type LlmTask, type LlmTier, type ResolvedConnection } from '../router'

export { LlmError, LlmTimeoutError, LlmHttpError, LlmContractError, toUserMessage } from '../adapters/llm/homeM4'
export { JsonSchemaError } from '../json/schemaValidate'

export interface LlmPersona {
  name: string
  description: string
  prompt: string
}

export interface LlmTurnMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmRequest {
  task: LlmTask
  /** 모드 지시·출력 규칙. 페르소나와 분리한다. */
  system: string
  messages: LlmTurnMessage[]
  persona?: LlmPersona
  /** 생략하면 task 표(LLM_TASKS) 값. */
  tier?: LlmTier
  timeoutMs?: number
  priority?: 'interactive' | 'batch'
  /** completeJson 이 채운다. claude-cli 는 `--json-schema` 로 강제(connection `runtime.jsonSchemaFlag !== false`), home-m4 는 프롬프트에 스키마를 싣는다. */
  jsonSchema?: object
}

export interface LlmJsonRequest<T> extends LlmRequest {
  jsonSchema: object
  /** ajv 로 표현할 수 없는 후검증(예: `correction.original` 바이트 일치). 위반 문구 배열을 돌려준다. */
  extraCheck?: (data: T) => string[]
}

export interface LlmMeta {
  connectionKey: string
  model: string
  elapsedMs: number
  promptChars: number
  attempts?: 1 | 2
}

export interface LlmTextResult extends LlmMeta {
  text: string
}

export interface LlmJsonResult<T> extends LlmMeta {
  data: T
}

function modelFor(c: ResolvedConnection, tier: LlmTier): string {
  const byTier = c.runtime.modelByTier as Record<string, string> | undefined
  if (byTier && typeof byTier[tier] === 'string') return byTier[tier]
  if (typeof c.runtime.model === 'string') return c.runtime.model
  throw new LlmContractError(`connection ${c.key} 에 tier=${tier} 모델이 없습니다(runtime.modelByTier/model)`)
}

function resolveCredential(ref: string | null): string | undefined {
  if (!ref) return undefined
  if (ref.startsWith('env:')) return process.env[ref.slice(4)]?.trim() || undefined
  // file:<name> 은 SecretResolver(infra.secrets, task-005b) 도입 시 지원한다.
  throw new LlmContractError(`지원하지 않는 credentialRef 형식입니다: ${ref.split(':')[0]}:`)
}

/** claude-cli 는 단일 사용자 프롬프트를 stdin 으로 받는다 — 창을 역할 표시와 함께 평문으로 펼친다. */
export function renderTranscript(system: string, messages: LlmTurnMessage[]): string {
  const parts = [system.trim()]
  if (messages.length === 1) {
    parts.push(messages[0].content)
  } else {
    parts.push(messages.map((m) => `${m.role === 'user' ? '[학습자]' : '[선생님]'} ${m.content}`).join('\n'))
  }
  return parts.filter(Boolean).join('\n\n')
}

async function callOnce(c: ResolvedConnection, req: LlmRequest, system: string, tier: LlmTier, timeoutMs: number, priority: 'interactive' | 'batch'): Promise<{ text: string; model: string; promptChars: number }> {
  const model = modelFor(c, tier)
  if (c.engineId === 'claude-cli') {
    const useFlag = Boolean(req.jsonSchema) && c.runtime.jsonSchemaFlag !== false
    const prompt = renderTranscript(req.jsonSchema ? withJsonOnly(system, useFlag ? undefined : req.jsonSchema) : system, req.messages)
    const text = await callClaude(prompt, {
      model,
      timeoutMs,
      priority,
      maxAttempts: 1, // 재시도는 JSON 계약 쪽(runJsonWithRetry)과 router 폴백이 맡는다
      ...(useFlag ? { jsonSchema: req.jsonSchema } : {}),
      ...(req.persona
        ? { agents: { [req.persona.name]: { description: req.persona.description, prompt: req.persona.prompt } }, agent: req.persona.name }
        : {}),
    })
    return { text, model, promptChars: prompt.length + (req.persona?.prompt.length ?? 0) }
  }
  if (c.engineId === 'home-m4-api') {
    const base = typeof c.connection.baseUrl === 'string' ? c.connection.baseUrl : ''
    const key = resolveCredential(c.credentialRef)
    if (!base || !key) throw new LlmContractError(`connection ${c.key} 의 baseUrl 또는 credential 이 없습니다`)
    const caller = new HomeM4ApiCaller(base.replace(/\/+$/, ''), key, model)
    const sys = [req.persona?.prompt, req.jsonSchema ? withJsonOnly(system, req.jsonSchema) : system].filter(Boolean).join('\n\n')
    const messages: LlmMessage[] = [{ role: 'system', content: sys }, ...req.messages]
    const text = await caller.chat(messages, { timeoutMs })
    return { text, model, promptChars: messages.reduce((n, m) => n + m.content.length, 0) }
  }
  throw new LlmContractError(`LLM 어댑터가 없는 엔진입니다: ${c.engineId}`)
}

export async function complete(req: LlmRequest): Promise<LlmTextResult> {
  const spec = LLM_TASKS[req.task]
  const tier = req.tier ?? spec.tier
  const timeoutMs = req.timeoutMs ?? spec.timeoutMs
  const priority = req.priority ?? spec.lane
  const startedAt = Date.now()
  const { value, connection } = await withFallback('LLM', { task: req.task }, (c) => callOnce(c, req, req.system, tier, timeoutMs, priority))
  return { text: value.text, model: value.model, promptChars: value.promptChars, connectionKey: connection.key, elapsedMs: Date.now() - startedAt }
}

export async function completeJson<T>(req: LlmJsonRequest<T>): Promise<LlmJsonResult<T>> {
  const spec = LLM_TASKS[req.task]
  const tier = req.tier ?? spec.tier
  const timeoutMs = req.timeoutMs ?? spec.timeoutMs
  const priority = req.priority ?? spec.lane
  const startedAt = Date.now()
  const system = req.system
  let meta = { model: '', promptChars: 0 }
  const { value, connection } = await withFallback('LLM', { task: req.task }, async (c) => {
    const result: RunJsonResult<T> = await runJsonWithRetry<T>(
      async (retry) => {
        const messages = retry
          ? [...req.messages, { role: 'assistant' as const, content: retry.previousRaw }, { role: 'user' as const, content: retry.hint }]
          : req.messages
        const out = await callOnce(c, { ...req, messages }, system, tier, timeoutMs, priority)
        meta = { model: out.model, promptChars: out.promptChars }
        return out.text
      },
      { schema: req.jsonSchema, extraCheck: req.extraCheck as ((d: unknown) => string[]) | undefined },
    )
    return result
  })
  return { data: value.data, attempts: value.attempts, ...meta, connectionKey: connection.key, elapsedMs: Date.now() - startedAt }
}
