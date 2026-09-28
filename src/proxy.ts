import { NextResponse, type NextRequest } from 'next/server'

// Next 16 은 `middleware` 파일 규약을 `proxy` 로 바꿨다(빌드 경고). 동작은 동일 — 페이지 라우트의 세션 유무만 본다.
import { SESSION_COOKIE_NAME, isQaTokenAllowed, verifyJwt } from '@/modules/infra/jwt'
import { prisma } from '@/modules/infra/db'
import { can } from '@/modules/admin/permissions/can'

/**
 * 인증 없이 접근 가능한 경로. 이 목록에 없는 모든 경로는 기본적으로 보호 대상이다 —
 * **화이트리스트** 방식이라 앞으로 추가될 모든 화면이 자동으로 보호된다(블랙리스트로
 * 개별 라우트를 나열하면 신규 라우트 추가 시 보호 누락 위험이 있음).
 *
 * `/api/auth/*`도 공개지만 아래 matcher가 `/api`를 통째로 제외하므로 여기 적을 필요가
 * 없다 — API는 각 핸들러가 `auth()`로 스스로 인증한다.
 */
const PUBLIC_PATHS = new Set(['/', '/login', '/invite'])

/**
 * 접두사로 여는 공개 경로. **지금은 비어 있다.**
 *
 * Phase 0 이 *"Phase 7 SNS 공유 공개 열람"* 을 예상해 `/shared/` 를 미리 열어 뒀는데,
 * Phase 7 을 구현하며 확인해 보니 **그런 기능이 없다**(2026-09-13):
 *   · `src/app` 아래에 `/shared/*` 라우트가 없고, 코드 어디도 그 경로를 쓰지 않는다
 *   · 설계안에 '공개 열람' 이라는 말 자체가 없다 — §7-1(6)의 공유는 **이미지·영상 파일을
 *     SNS 앱으로 내보내는 것**이지 로그인 없이 여는 링크가 아니다
 *
 * 그래서 지웠다. 안 쓰는 채로 두면 **화이트리스트의 약속이 깨진다** — 이 파일 위 주석이
 * *"앞으로 추가될 모든 화면이 자동으로 보호된다"* 고 말하는데, 누군가 나중에 `/shared/`
 * 아래에 화면을 만들면 **의도치 않게 인증 없이 열린다.** 열어 둘 이유가 생겼을 때 그때
 * 다시 넣는 편이 안전하다.
 */
const PUBLIC_PREFIXES: readonly string[] = []

/**
 * JWT 검증은 `infra/jwt`(jose)만 쓴다 — `infra/auth`(next/headers `cookies()`)는 proxy 문맥에서 쓸 수 없다.
 * Next 16 proxy 는 Node.js 런타임이 기본이라(`node_modules/next/dist/docs/.../proxy.md` "Runtime") 관리자 경로에서만
 * Prisma 로 역할을 조회한다(아래 ADMIN_*). 그 밖의 경로는 "유효한 토큰이 있는가"만 판단하고,
 * role 등 상세는 각 페이지/API 라우트가 `auth()` 로 다시 확인한다.
 */
/**
 * 관리자 콘솔 경로(role-permission §5, admin-console/01 §8) — `console.access` 가 없는 사용자(USER)에게는 **존재 자체를 숨긴다**:
 * 페이지는 앱 공통 404 로 rewrite, API 는 라우트와 같은 모양의 404 봉투. 역할은 JWT 가 아니라 **DB 에서** 읽는다
 * (JWT 에 role 이 없다 — Next 16 proxy 는 Node 런타임이라 Prisma 조회가 가능). 이것은 1차 방어선일 뿐이고
 * 최종 판단은 항상 각 라우트의 `requireCapability`·서버 컴포넌트의 `requireConsolePage` 가 다시 한다(미들웨어 우회 대비).
 */
const ADMIN_PAGE = /^\/admin(\/|$)/
const ADMIN_API = /^\/api\/admin(\/|$)/

async function hasConsoleAccess(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    return Boolean(user && can(user.role, 'console.access').allowed)
  } catch {
    return false
  }
}

function apiEnvelope(status: 401 | 404) {
  return status === 401
    ? NextResponse.json({ success: false, data: { code: 'UNAUTHENTICATED' }, message: '로그인이 필요합니다.' }, { status })
    : NextResponse.json({ success: false, data: { code: 'NOT_FOUND' }, message: '요청한 항목을 찾을 수 없습니다.' }, { status })
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const verified = token ? await verifyJwt(token) : null
  // QA 테스트 토큰은 localhost 직접 요청에서만 통과(운영 도메인에서 쿠키가 새어도 무효).
  const payload = verified?.qa && !isQaTokenAllowed(req.headers) ? null : verified

  if (ADMIN_API.test(pathname)) {
    if (!payload) return apiEnvelope(401)
    return (await hasConsoleAccess(payload.userId)) ? NextResponse.next() : apiEnvelope(404)
  }
  if (ADMIN_PAGE.test(pathname) && payload && !(await hasConsoleAccess(payload.userId))) {
    // 존재하지 않는 경로로 rewrite → 앱 공통 not-found(404). 주소창은 그대로라 콘솔이 있다는 힌트가 없다.
    return NextResponse.rewrite(new URL('/__not-found', req.nextUrl.origin))
  }

  if (isPublic || payload) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', req.nextUrl.origin)
  loginUrl.searchParams.set('callbackUrl', `${pathname}${req.nextUrl.search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // API 라우트는 각 핸들러가 자체적으로 auth()로 인증하므로 미들웨어에서는 페이지
  // 라우트만 다룬다 — API에 리다이렉트 응답을 보내면 fetch 클라이언트가 JSON 대신
  // 로그인 HTML을 받게 되는 문제 방지.
  // PWA 자산(manifest·icons·app-shell)도 제외한다 — 매니페스트가 로그인 HTML로 치환되면
  // 설치 배너가 조용히 깨진다.
  // `app/download/`(APK)·`models/`(온디바이스 모델, #9·#10)는 공개 파일 라우트다 — 로그인 전 앱·플러그인이 받는다.
  // `/api/admin/*` 만은 예외로 여기서도 본다 — USER 에게 관리자 API 의 존재를 숨기기 위해(위 ADMIN_API).
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|app-shell/|app/download/|models/).*)',
    '/api/admin/:path*',
  ],
}
