/**
 * 공유 패키지(`@workspace/auth-oauth`) 프로바이더의 타입 계약.
 * 공유 패키지는 타입이 없는 CommonJS라 이 형태를 한 번만 적어두고
 * `src/types/workspace-auth-oauth.d.ts`가 참조한다.
 */

export interface NormalizedOAuthProfile {
  providerId: string
  email: string
  name: string
  avatar: string | null
  /** 없거나 boolean이 아니면 소비 지점이 false로 수렴시킨다(fail-closed). */
  emailVerified?: boolean
}

export interface SharedOAuthProvider {
  name: string
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  scope: string
  extraAuthParams?: Record<string, string>
  getProfile(
    accessToken: string,
    tokenData: unknown,
    helpers: {
      getJson: (url: string, accessToken: string, extraHeaders?: Record<string, string>) => Promise<unknown>
    },
  ): Promise<unknown>
  normalizeProfile(raw: unknown): NormalizedOAuthProfile
}
