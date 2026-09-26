/**
 * 라우트 공통 — 응답 봉투(api-contract §0-2)·오류 코드(§0-5)·세션 확인·JSON 본문 파싱.
 * 라우트는 `withApi(async (req) => …)` 로 감싸고, 실패는 `throw new ApiError(...)` 로 던진다.
 * 엔진 층 오류는 **이름으로** 매핑한다(infra 는 engine 을 import 하지 않는다 — 층 규칙).
 */
import { NextResponse, type NextRequest } from 'next/server'
import type { ApiErrorCode } from '@/types/api'
import { auth, type AppSession } from './auth'

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ENGINE_UNAVAILABLE: 422,
  RATE_LIMITED: 429,
  ENGINE_ERROR: 502,
  ENGINE_TIMEOUT: 504,
  INTERNAL: 500,
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
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

export function fail(code: ApiErrorCode, message: string, details?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: false, data: { code, ...(details ? { details } : {}) }, message }, { status: STATUS[code] })
}

/** 엔진·도메인 오류를 봉투로. 알 수 없는 예외는 500 INTERNAL(발생 자체가 결함 — §0-5). */
export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) return fail(e.code, e.userMessage, e.details)
  const name = (e as { name?: string })?.name ?? ''
  const userMessage = (e as { userMessage?: string })?.userMessage
  if (name === 'NoEngineAvailableError') return fail('ENGINE_UNAVAILABLE', userMessage ?? 'AI 엔진을 지금 사용할 수 없습니다.')
  if (name.includes('Timeout')) return fail('ENGINE_TIMEOUT', userMessage ?? '응답이 늦어 중단했습니다. 잠시 후 다시 시도해 주세요.')
  if (name.startsWith('Llm') || name.startsWith('ClaudeCli') || name === 'JsonSchemaError') return fail('ENGINE_ERROR', userMessage ?? 'AI 처리에 실패했습니다.')
  console.error('[api] 처리되지 않은 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  return fail('INTERNAL', '요청을 처리하지 못했습니다.')
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
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { resetAt: now + windowMs, count: 1 })
    return
  }
  b.count++
  if (b.count > limit) throw new ApiError('RATE_LIMITED', '요청이 많아요. 잠시 후 다시 시도해 주세요.', { retryAfterSec: Math.ceil((b.resetAt - now) / 1000) })
}
