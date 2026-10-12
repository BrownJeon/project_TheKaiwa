/**
 * 라우트 공통 — 응답 봉투(api-contract §0-2)·오류 코드(§0-5)·세션 확인·JSON 본문 파싱.
 * 라우트는 `withApi(async (req) => …)` 로 감싸고, 실패는 `throw new ApiError(...)` 로 던진다.
 * 엔진 층 오류는 **이름으로** 매핑한다(infra 는 engine 을 import 하지 않는다 — 층 규칙).
 */
import { NextResponse, type NextRequest } from 'next/server'
import type { ApiErrorCode } from '@/types/api'
import { auth, type AppSession } from './auth'

/** 서버가 내는 `data.code` — 화면과 같은 목록(`@/types/api`: §0-5 공통 + #28·#32·#38 `FEATURE_NOT_READY`, #33 `ALREADY_REVIEWED`). */
export type ServerErrorCode = ApiErrorCode

const STATUS: Record<ServerErrorCode, number> = {
  VALIDATION: 400,
  FEATURE_NOT_READY: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_REVIEWED: 409,
  UNPROCESSABLE: 422,
  ENGINE_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  ENGINE_ERROR: 502,
  ENGINE_TIMEOUT: 504,
  INTERNAL: 500,
}

const UNAVAILABLE_ERRORS = new Set(['NoEngineAvailableError'])
const TIMEOUT_ERRORS = new Set(['LlmTimeoutError', 'ClaudeCliTimeoutError'])
const ENGINE_ERRORS = new Set(['LlmError', 'LlmHttpError', 'LlmContractError', 'ClaudeCliError', 'ClaudeCliExecError', 'ClaudeCliNotFoundError', 'JsonSchemaError', 'PersonaUnavailableError'])
const VALIDATION_ERRORS = new Set(['ReviewTooLargeError'])

export class ApiError extends Error {
  constructor(
    readonly code: ServerErrorCode,
    readonly userMessage: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(`${code}: ${userMessage}`)
    this.name = 'ApiError'
  }
}

export function ok<T>(data: T, message: string | null = null, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, data, message }, init)
}

export function fail(code: ServerErrorCode, message: string, details?: Record<string, unknown>): NextResponse {
  const init: ResponseInit = { status: STATUS[code] }
  const retryAfter = details?.retryAfterSec
  if (code === 'RATE_LIMITED' && typeof retryAfter === 'number') init.headers = { 'Retry-After': String(retryAfter) }
  return NextResponse.json({ success: false, data: { code, ...(details ? { details } : {}) }, message }, init)
}

export interface ClassifiedError {
  code: ServerErrorCode
  status: number
  userMessage: string
  details?: Record<string, unknown>
}

/**
 * 오류 → (코드·HTTP status·사용자 문구). 봉투 응답과 SSE `error` 이벤트가 같은 판정을 쓴다.
 * 엔진 오류는 **정확한 이름 목록**으로만 매핑한다 — 부분 일치는 무관한 버그를 '일시적 엔진 오류'로 숨긴다(REV-006 M3).
 * 오류 객체에 `traceId`(문자열)가 붙어 있으면 엔진 오류(502/504/422)의 `details.traceId` 로 싣는다(§0-5).
 */
export function classifyError(e: unknown): ClassifiedError {
  if (e instanceof ApiError) return { code: e.code, status: STATUS[e.code], userMessage: e.userMessage, details: e.details }
  const name = (e as { name?: string })?.name ?? ''
  const userMessage = (e as { userMessage?: string })?.userMessage
  const traceId = (e as { traceId?: unknown })?.traceId
  const withTrace = typeof traceId === 'string' ? { traceId } : undefined
  const pick = (code: ServerErrorCode, message: string): ClassifiedError => ({ code, status: STATUS[code], userMessage: message, ...(withTrace ? { details: withTrace } : {}) })
  if (UNAVAILABLE_ERRORS.has(name)) return pick('ENGINE_UNAVAILABLE', userMessage ?? 'AI 엔진을 지금 사용할 수 없습니다.')
  if (TIMEOUT_ERRORS.has(name)) return pick('ENGINE_TIMEOUT', userMessage ?? '응답이 늦어 중단했습니다. 잠시 후 다시 시도해 주세요.')
  if (ENGINE_ERRORS.has(name)) return pick('ENGINE_ERROR', userMessage ?? 'AI 처리에 실패했습니다.')
  if (VALIDATION_ERRORS.has(name)) return { code: 'VALIDATION', status: 400, userMessage: userMessage ?? '요청을 처리할 수 없습니다.' }
  return { code: 'INTERNAL', status: 500, userMessage: '요청을 처리하지 못했습니다.' }
}

/**
 * 엔진·도메인 오류를 봉투로. 알 수 없는 예외는 500 INTERNAL(발생 자체가 결함 — §0-5).
 * `clientGone` — 요청한 손님이 이미 끊긴 'aborted' 계열 오류라 응답을 읽을 사람이 없다: 오류 로그만 건너뛰고 응답·분류는 그대로다.
 */
export function toErrorResponse(e: unknown, opts: { clientGone?: boolean } = {}): NextResponse {
  const c = classifyError(e)
  if (c.code === 'INTERNAL' && !opts.clientGone) console.error('[api] 처리되지 않은 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  return fail(c.code, c.userMessage, c.details)
}

/**
 * 손님이 먼저 끊은 요청에서 난 'aborted' 계열 오류인가. 본문을 읽는 도중 연결이 끊기면 Node 가 읽기를 `Error('aborted')`(보통 code `ECONNRESET` 이 함께 붙는다)로 거절하는데,
 * 그때 `req.signal` 은 이미 abort 돼 있다(task-062 재현: dev 서버에서 본문 절반만 보내고 소켓을 끊음 → signalAborted=true). 이 조합만 소음으로 본다 —
 * 신호가 살아 있는 요청의 같은 문구 오류와 신호가 없는 호출은 진짜 결함일 수 있으니 계속 기록한다.
 * `code === 'ECONNRESET'` 만으로는 소음으로 보지 않는다: 상류(게이트웨이·M4·DB)의 연결 리셋은 손님이 끊긴 뒤에도 실제 백엔드 장애 신호라 관측성을 잃으면 안 된다.
 */
function isClientGoneNoise(req: { signal?: AbortSignal } | null | undefined, e: unknown): boolean {
  if (req?.signal?.aborted !== true) return false
  const x = e as { name?: unknown; message?: unknown } | null
  return x?.message === 'aborted' || x?.name === 'AbortError'
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse | Response>

export function withApi<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (e) {
      return toErrorResponse(e, { clientGone: isClientGoneNoise(req, e) })
    }
  }
}

/** 로그인 세션을 요구한다. 없으면 401 봉투(ApiError). */
export async function requireSession(): Promise<NonNullable<AppSession>> {
  const session = await auth()
  if (!session) throw new ApiError('UNAUTHENTICATED', '로그인이 필요합니다.')
  return session
}

/**
 * 본문을 **상한까지만** 읽는다 — 넘으면 null. `Content-Length` 가 상한을 넘으면 읽기 전에, 없거나 거짓이면 스트림을 읽다가
 * 넘는 순간 끊는다(`req.text()` 는 전부 메모리에 올린 뒤에야 크기를 알 수 있다 — task-003e Codex C2).
 */
export async function readBodyCapped(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) return null
  if (!req.body) return new Uint8Array(0)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/** JSON 본문 — 객체만, 기본 64KB 상한(§0-2). */
export async function readJsonObject(req: NextRequest, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const bytes = await readBodyCapped(req, maxBytes)
  if (!bytes) throw new ApiError('VALIDATION', '요청 본문이 너무 큽니다.')
  const text = new TextDecoder().decode(bytes)
  if (!text.trim()) return {}
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new ApiError('VALIDATION', 'JSON 형식이 올바르지 않습니다.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('VALIDATION', '요청 본문은 JSON 객체여야 합니다.')
  return body as Record<string, unknown>
}

/** 사용자당 고정 창 rate limit(메모리, 단일 프로세스 — blue/green 전환 시 초기화돼도 무해). */
const buckets = new Map<string, { resetAt: number; count: number }>()
export function rateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now()
  // 만료 버킷을 가끔 걷어 낸다(무한 누적 방지, REV-006 M5).
  if (buckets.size > 500) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k)
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { resetAt: now + windowMs, count: 1 })
    return
  }
  b.count++
  if (b.count > limit) throw new ApiError('RATE_LIMITED', '요청이 많아요. 잠시 후 다시 시도해 주세요.', { retryAfterSec: Math.ceil((b.resetAt - now) / 1000) })
}
