/**
 * `POST /api/auth/app-exchange` 요청 판정 — 순수 함수(task-003f REV-021 MEDIUM).
 *
 * 코드 교환을 GET 쿼리스트링에서 **POST JSON 본문**으로 옮겼다: `code_r`·`verifier` 가 nginx 접근 로그·WebView 방문 기록에 남지 않게
 * (RFC 8252 관례). 세션 쿠키를 심는 POST 라 로그인 CSRF(남의 사이트가 공격자 코드로 피해자 WebView 를 공격자 계정에 로그인시키기)를
 * 막는다 — ① `Content-Type: application/json` 만(HTML 폼은 이 형식을 보낼 수 없고, 교차 출처 fetch 는 CORS 사전 요청에서 막힌다)
 * ② 브라우저가 붙이는 `Sec-Fetch-Site`/`Origin` 중 하나 이상이 있어야 하고, 있으면 같은 출처여야 한다.
 */
import { DEFAULT_NEXT_PATH, sanitizeNextPath } from '@/modules/infra/auth/oauth/next-path'

export const APP_EXCHANGE_MAX_BODY = 4 * 1024

/** 같은 출처에서 온 JSON 요청인가. `host` 는 요청 Host 헤더(nginx 가 원래 호스트를 넘긴다). */
export function isSameOriginJsonRequest(headers: Headers): boolean {
  const type = headers.get('content-type') ?? ''
  if (!/^application\/json(\s*;|$)/i.test(type.trim())) return false
  const site = headers.get('sec-fetch-site')
  const origin = headers.get('origin')
  if (!site && !origin) return false
  if (site && site !== 'same-origin') return false
  if (origin) {
    const host = headers.get('host')
    try {
      const u = new URL(origin)
      if (!host || u.host !== host || (u.protocol !== 'https:' && u.protocol !== 'http:')) return false
    } catch {
      return false
    }
  }
  return true
}

export interface AppExchangeInput {
  code: unknown
  verifier: unknown
  next: string
}

/** 본문 → 교환 입력. 형식 판정(64 hex·RFC 7636)은 `consumeAppAuthCode` 가 한다. `next` 는 같은 출처 경로만. */
export function parseAppExchangeBody(body: Record<string, unknown>): AppExchangeInput {
  return { code: body.code, verifier: body.verifier, next: sanitizeNextPath(typeof body.next === 'string' ? body.next : DEFAULT_NEXT_PATH) }
}
