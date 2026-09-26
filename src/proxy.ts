import { NextResponse, type NextRequest } from 'next/server'

// Next 16 은 `middleware` 파일 규약을 `proxy` 로 바꿨다(빌드 경고). 동작은 동일 — 페이지 라우트의 세션 유무만 본다.
import { SESSION_COOKIE_NAME, isQaTokenAllowed, verifyJwt } from '@/modules/infra/jwt'

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
 * `src/lib/jwt.ts`만 import한다 — `src/lib/auth.ts`(Prisma·`jsonwebtoken` 포함)를 여기서
 * import하면 안 된다(Edge Runtime에서 `jsonwebtoken`의 `jwt.verify()`가
 * "The edge runtime does not support Node.js 'crypto' module"로 크래시하는 것이
 * VoiceVault·TheThinker에서 실측 확인됨 — `src/lib/jwt.ts` 상단 주석 참고).
 *
 * 미들웨어는 "유효한 토큰이 있는가"만 판단해 통과/리다이렉트를 결정하고, role 등 상세
 * 정보는 각 페이지/API 라우트가 `src/lib/auth.ts`의 `auth()`(Node.js 런타임)로 다시 확인한다.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const verified = token ? await verifyJwt(token) : null
  // QA 테스트 토큰은 localhost 직접 요청에서만 통과(운영 도메인에서 쿠키가 새어도 무효).
  const payload = verified?.qa && !isQaTokenAllowed(req.headers) ? null : verified

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
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|app-shell/|app/download/).*)',
  ],
}
