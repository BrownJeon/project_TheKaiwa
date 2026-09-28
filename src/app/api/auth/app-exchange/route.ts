/**
 * POST /api/auth/app-exchange — 앱 딥링크 코드 + PKCE verifier → 세션 쿠키 (설계안 §5-2, task-003f C1-1 · REV-021).
 *
 * 앱 WebView 가 `thekaiwa://auth/callback?code=<code_r>` 를 받으면 로그인 시작 때 만든 verifier 와 함께 **JSON 본문**으로 보낸다
 * (`fetch(…, {method:'POST', credentials:'same-origin'})`). 여기서 `sha256(code_r + ":" + S256(verifier))` 로 행을 찾아 **소각**하고
 * 세션 쿠키를 심은 뒤 `{ next }`(같은 출처 경로만)를 돌려준다 — 화면 이동은 WebView 가 한다.
 * 쿼리스트링을 쓰지 않는 이유: `code_r`·verifier 가 nginx 접근 로그·WebView 방문 기록에 남지 않게(RFC 8252 관례).
 *
 * ★ 실패는 형식 오류·출처·verifier 불일치·만료·재사용·미존재를 구분하지 않는다 — 전부 같은 400 하나로 수렴시켜 "그 코드는 존재하지만
 *   이미 썼다" 같은 정보가 새지 않게 한다(`consumeAppAuthCode` 계약). 화면은 `/login?oauth_error=app_code_invalid` 로 간다.
 * ★ 이 라우트는 인증 **이전** 단계라 `auth()`를 걸 수 없다. 대신 코드+verifier 가 자격증명이며, 같은 출처 JSON(로그인 CSRF 방어) →
 *   형식 검사 → 결속 값 재계산 → 조건부 UPDATE 1건 → 사용자 조회 순으로만 권한이 생긴다.
 * ★ GET 은 405 만 돌려준다(예전 쿼리스트링 교환 경로 — 아무 정보도 주지 않는다).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { readBodyCapped, setSessionCookie } from '@/modules/infra'
import { consumeAppAuthCode } from '@/modules/infra/auth/oauth/app-code'
import { APP_EXCHANGE_MAX_BODY, isSameOriginJsonRequest, parseAppExchangeBody } from '@/modules/infra/auth/oauth/app-exchange'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

function invalid(): NextResponse {
  return NextResponse.json({ success: false, data: { code: 'APP_CODE_INVALID' }, message: '로그인을 마무리하지 못했어요. 다시 눌러 주세요.' }, { status: 400, headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginJsonRequest(req.headers)) return invalid()
    const bytes = await readBodyCapped(req, APP_EXCHANGE_MAX_BODY)
    if (!bytes) return invalid()
    let body: unknown
    try {
      body = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      return invalid()
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid()
    const input = parseAppExchangeBody(body as Record<string, unknown>)

    const user = await consumeAppAuthCode(input.code, input.verifier)
    if (user === null) return invalid()

    const res = NextResponse.json({ success: true, data: { next: input.next }, message: null }, { headers: NO_STORE })
    setSessionCookie(res, { userId: user.id, email: user.email })
    return res
  } catch (e) {
    console.error('[auth] app-exchange 실패:', e instanceof Error ? e.message : String(e))
    return invalid()
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST', ...NO_STORE } })
}
