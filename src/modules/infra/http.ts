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

/** 엔진·도메인 오류를 봉투로. 알 수 없는 예외는 500 INTERNAL(발생 자체가 결함 — §0-5). */
export function toErrorResponse(e: unknown): NextResponse {
  const c = classifyError(e)
  if (c.code === 'INTERNAL') console.error('[api] 처리되지 않은 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  return fail(c.code, c.userMessage, c.details)
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<NextResponse | Response>

export function withApi<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (e) {
      return toErrorResponse(e)
    }
  }
}

/** 로그인 세션을 요구한다. 없으면 401 봉투(ApiError). */
export async function requireSession(): Promise<NonNullable<AppSession>> {
  const session = await auth()
  if (!session) throw new ApiError('UNAUTHENTICATED', '로그인이 필요합니다.')
  return session
}

/** JSON 본문 — 객체만, 기본 64KB 상한(§0-2). */
export async function readJsonObject(req: NextRequest, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const text = await req.text()
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new ApiError('VALIDATION', '요청 본문이 너무 큽니다.')
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
