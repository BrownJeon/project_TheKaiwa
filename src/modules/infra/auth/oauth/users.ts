/**
 * OAuth 사용자 조회/연결/생성 — Prisma 기반. 설계안 §5-1의 판정 순서를 그대로 구현한다
 * (계정 탈취 방지 핵심 순서):
 *   1) (provider, oauthId) 일치 → 기존 소셜 계정, 바로 로그인
 *   2) 미검증 이메일 → 여기서 끝(연결도 생성도 안 함, 콜백 라우트가 처리)
 *   3) 검증된 이메일이 기존 계정과 일치 → 소셜 신원을 연결(seed된 OWNER 계정이 이 경로로
 *      최초 로그인 시 매칭된다)
 *   4) 그 외 → 신규. 초대코드 게이트를 통과해야 계정이 생성된다(`/api/auth/complete`).
 *
 * TheMeal `User` 모델에는 VoiceVault에 있던 `image`/`emailVerified` 컬럼이 없다(설계안 §6).
 * 아바타 URL은 대기 토큰에만 싣고 DB에는 저장하지 않는다 — 스키마를 임의로 바꾸지 않는다.
 */
import { prisma } from '@/modules/infra/db'
import { resolveRoleForEmail } from '@/modules/infra/auth/signup-gate'
import type { OAuthProfile } from '@/modules/infra/auth/oauth/providers'

export const OAUTH_PROVIDER = 'google'

export interface OAuthUser {
  id: string
  email: string
  name: string | null
  role: string
}

const SELECT = { id: true, email: true, name: true, role: true } as const

export async function findUserByOAuth(providerId: string): Promise<OAuthUser | null> {
  return prisma.user.findUnique({
    where: { provider_oauthId: { provider: OAUTH_PROVIDER, oauthId: providerId } },
    select: SELECT,
  })
}

export async function findUserByEmail(email: string): Promise<OAuthUser | null> {
  return prisma.user.findUnique({ where: { email }, select: SELECT })
}

/**
 * 검증된 이메일이 가리키는 기존 계정에 이 소셜 신원을 연결한다.
 * **이미 다른 Google 신원에 묶인 계정이면 연결하지 않고 `null`을 돌려준다(fail-closed).**
 *
 * ★ VoiceVault에서 이 단계는 무조건 덮어쓰기였다. 거기서는 `oauthId`가 nullable이고 seed가
 *   OWNER 행을 미리 만들어 뒀기 때문에 "아직 신원이 없는 행에 처음 붙이는" 연산이었다.
 *   TheMeal은 두 전제가 모두 다르다 — `provider`/`oauthId`가 **non-null**이고(설계안 §6),
 *   `prisma/seed.ts`는 행을 미리 만들지 않고 기존 계정의 role만 올린다. 그래서 이 단계에
 *   도달했다는 것은 "같은 이메일인데 **다른** Google 신원"이라는 뜻이고(같은 신원이면 1번
 *   `findUserByOAuth`에서 이미 걸린다), 무조건 덮어쓰면 이메일이 재발급·이관된 계정으로
 *   남의 데이터에 올라탈 수 있다.
 *
 * 조건부 UPDATE 한 방으로 판정한다 — "읽고 나서 갱신"으로 나누면 두 요청이 동시에 검사를
 * 통과하는 경쟁 조건이 생긴다. `oauthId`가 빈 문자열인 행(향후 seed가 자리표시자로 만들 수
 * 있는 미연결 계정)과 이미 같은 신원인 행만 대상으로 삼는다.
 */
export async function linkOAuthToUser(userId: string, profile: OAuthProfile): Promise<OAuthUser | null> {
  const linked = await prisma.user.updateMany({
    where: {
      id: userId,
      provider: { in: [OAUTH_PROVIDER, ''] },
      oauthId: { in: [profile.providerId, ''] },
    },
    data: { provider: OAUTH_PROVIDER, oauthId: profile.providerId },
    // `name`은 건드리지 않는다 — 기존 이름을 Google 표시명이 덮어쓰지 않게.
  })
  if (linked.count !== 1) return null

  return prisma.user.findUnique({ where: { id: userId }, select: SELECT })
}

/** 신규 가입(초대코드 게이트를 통과한 뒤에만 호출). */
export async function createOAuthUser(profile: OAuthProfile): Promise<OAuthUser> {
  return prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      provider: OAUTH_PROVIDER,
      oauthId: profile.providerId,
      role: resolveRoleForEmail(profile.email),
    },
    select: SELECT,
  })
}

/** 로그 노출용 마스킹 — 서버 로그에도 이메일 전체를 남기지 않는다. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 1) return '***' + email.slice(at)
  return `${email[0]}***${email.slice(at - 1)}`
}
