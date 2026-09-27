import { cookies, headers } from 'next/headers'
import { SESSION_COOKIE_NAME, verifyJwt, isQaTokenAllowed } from '@/modules/infra/jwt'
import { prisma } from '@/modules/infra/db'

/**
 * 커스텀 JWT(httpOnly 쿠키) 인증 — VoiceVault `src/lib/auth.ts` 패턴 이식.
 *
 * 공개 계약: `export async function auth(): Promise<AppSession>`, 반환 모양
 * `{ user: { id, email, name, role } } | null`.
 *
 * 세션 토큰(JWT) payload는 `{ userId, email }`뿐이다 — payload를 얇게 유지하고, 매
 * `auth()` 호출마다 Prisma로 최신 name/role을 조회한다(권한이 바뀔 수 있는 필드를
 * 토큰에 캐싱하면 재로그인 전까지 오래된 role로 판정하는 사고가 난다).
 *
 * `src/lib/jwt.ts`(Edge Runtime 안전)와 달리 이 파일은 Prisma를 import하므로 Node.js
 * 런타임 전용이다 — `middleware.ts`가 이 파일을 import하지 않는 이유는 `src/lib/jwt.ts`
 * 상단 주석 참고.
 *
 * `role`은 Prisma `Role` enum('USER' | 'ADMIN' | 'DEVELOPER' | 'SUPER_ADMIN', 권한 검사는 capability — role-permission.md)이지만 여기서는 `string`으로 노출한다 —
 * Edge/클라이언트 경계를 넘나드는 소비 지점이 생겨도 `@prisma/client` 타입 의존이
 * 전파되지 않게 하기 위함. OWNER 판정은 아래 `isOwner()`를 쓴다.
 */
export type AppSession = {
  user: { id: string; email: string; name: string | null; role: string }
} | null

export async function auth(): Promise<AppSession> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyJwt(token)
  if (!payload) return null
  // QA 테스트 토큰은 localhost 직접 요청에서만 세션이 된다(jwt.ts isQaTokenAllowed).
  if (payload.qa && !isQaTokenAllowed(await headers())) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, role: true },
    })
    // 토큰 발급 이후 계정이 삭제된 엣지 케이스 — 세션 없음으로 처리.
    if (!user) return null
    // 관리자 권한 QA 계정(task-005b, tests/live/qa-session.ts)은 운영 프로세스에서 세션이 되지 않는다 —
    // 운영 호스트의 localhost 로 QA 토큰이 들어와도 콘솔 권한을 얻지 못하게(USER QA 는 기존대로).
    if (payload.qa && user.role !== 'USER' && (process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') return null

    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } }
  } catch (e) {
    console.error('[auth] failed to resolve session user', e)
    return null
  }
}

export function isOwner(session: AppSession): boolean {
  return session?.user.role === 'SUPER_ADMIN'
}

/**
 * 소유자 검사 — 리소스의 `userId`가 현재 세션 사용자와 같은지 확인한다.
 * 남의 리소스는 403이 아니라 **404로 수렴**시키는 것이 이 앱의 규약이다(존재 여부 자체를
 * 흘리지 않기 위해). 이 함수는 boolean만 돌려주고 응답 코드는 호출부가 정한다.
 */
export function ownsResource(session: AppSession, resourceUserId: string | null | undefined): boolean {
  if (session === null) return false
  if (typeof resourceUserId !== 'string' || resourceUserId.length === 0) return false
  return session.user.id === resourceUserId
}
