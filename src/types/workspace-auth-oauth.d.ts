/**
 * `@workspace/auth-oauth` 타입 선언.
 *
 * 공유 패키지는 순수 CommonJS이고 `types` 필드가 없다. 선언 없이 import하면 TypeScript가
 * "declaration 없는 node_modules 모듈"로 인식해 `tsc --noEmit`/`next build`가 실패한다.
 *
 * ⚠️ **여기 선언한 서브패스만 쓴다.** `adapters/*`와 `core/state`는 의도적으로 선언하지
 *    않는다 — 이 프로젝트는 콜백 라우트를 직접 구현하고(`src/app/api/auth/google/callback`)
 *    state도 자체 `src/lib/auth/oauth/state.ts`(double-submit 쿠키)를 쓴다.
 *    `adapters/nextjs`는 JWT를 `?token=` 쿼리로 실어 보내는데, 그러면 30일짜리 로그인
 *    자격증명이 브라우저 히스토리·Referer·nginx 액세스 로그에 평문으로 남는다.
 *    선언을 두지 않는 것 자체가 실수로 그 경로를 import하지 못하게 하는 컴파일 타임
 *    가드다. GitHub 프로바이더도 이 프로젝트 범위 밖이라 선언하지 않는다.
 */

declare module '@workspace/auth-oauth/providers/google' {
  const provider: import('@/lib/auth/oauth/provider-types').SharedOAuthProvider
  export = provider
}

declare module '@workspace/auth-oauth/core/exchange' {
  export function postForm(url: string, params: Record<string, string>): Promise<Record<string, unknown>>
  export function getJson(
    url: string,
    accessToken: string,
    extraHeaders?: Record<string, string>,
  ): Promise<unknown>
}
