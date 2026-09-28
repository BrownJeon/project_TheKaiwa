/**
 * 앱(Capacitor) 딥링크 인증 코드 — 설계안 §5-2 + task-003f C1-1(PKCE 결속).
 *
 * Google은 WebView 안의 OAuth를 거부하므로 로그인만 Custom Tabs에서 한다. Custom Tabs는
 * 별도 브라우저라 거기서 발급된 세션 쿠키가 앱 WebView로 오지 않는다. 그래서 콜백은
 * 세션 대신 **단명 1회용 코드**를 발급하고 `thekaiwa://auth/callback?code=`로 앱에 넘긴다.
 * 앱은 그 코드를 WebView에서 `/api/auth/app-exchange`로 제시해 진짜 세션 쿠키를 받는다.
 *
 * ★ 세션 토큰(30일)을 URL에 싣는 것과 이 코드가 다른 점:
 *   - 60초 TTL, 1회용(소각). 히스토리·로그에 남아도 재사용이 불가능하다.
 *   - 코드 자체로는 아무 권한이 없다 — 교환 라우트 한 곳에서만 의미를 가진다.
 *
 * ★ PKCE 결속(스키마 변경 없음): 딥링크에는 랜덤 `code_r` 만 싣고, DB `AppAuthCode.code` 에는
 *   `sha256hex(code_r + ":" + challenge)` 를 저장한다. 교환은 `code_r`+`verifier` 로 같은 값을 다시 만들어야만 행을 찾는다 —
 *   딥링크를 가로챈 다른 앱은 verifier(WebView 메모리에만 있음)가 없어 교환할 수 없다. DB 가 새도 code_r 을 되돌릴 수 없다.
 *
 * 소각은 `updateMany(where: usedAt=null AND expiresAt>now)` **한 방의 조건부 UPDATE**로
 * 한다. "조회 후 갱신"으로 나누면 동시 요청 두 개가 같은 코드로 각각 세션을 받는 경쟁
 * 조건이 생긴다 — 영향 행 수가 정확히 1일 때만 통과시킨다.
 */
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/modules/infra/db'
import { isPkceChallenge, isPkceVerifier, pkceChallengeOf } from '@/modules/infra/auth/oauth/pkce'

export const APP_AUTH_CODE_TTL_SEC = 60

/** 32바이트 랜덤의 hex 표현(64자). 형식이 고정이라 DB에 닿기 전에 쓰레기 입력을 걸러낸다. */
const CODE_PATTERN = /^[0-9a-f]{64}$/

/** 소각·만료된 코드를 남겨둘 시간 — 이 뒤에는 청소 대상. */
const RETENTION_MS = 60 * 60 * 1000

/** DB 에 저장하는 값(= 조회 키). 순수 함수. */
export function bindAppAuthCode(codeR: string, challenge: string): string {
  return createHash('sha256').update(`${codeR}:${challenge}`, 'utf8').digest('hex')
}

/** 발급·소각이 DB 에 기대는 두 동작 — 테스트는 메모리 구현을 넣는다. */
export interface AppAuthCodeStore {
  create(row: { code: string; userId: string; expiresAt: Date }): Promise<void>
  /** `usedAt=null AND expiresAt>now` 인 행을 소각하고 영향 행 수를 돌려준다. */
  burn(code: string, now: Date): Promise<number>
  userOf(code: string): Promise<AppAuthCodeUser | null>
}

const prismaStore: AppAuthCodeStore = {
  async create(row) {
    await prisma.appAuthCode.create({ data: row })
  },
  async burn(code, now) {
    const r = await prisma.appAuthCode.updateMany({ where: { code, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    return r.count
  },
  async userOf(code) {
    const row = await prisma.appAuthCode.findUnique({ where: { code }, select: { user: { select: { id: true, email: true } } } })
    return row?.user ?? null
  },
}

/**
 * 코드 발급 — 돌려준 `code_r` 만 딥링크에 싣는다. challenge 가 형식에 맞지 않으면 던진다(PKCE 없는 앱 흐름은 없다 — 첫 APK 부터 필수).
 */
export async function issueAppAuthCode(userId: string, challenge: string, store: AppAuthCodeStore = prismaStore): Promise<string> {
  if (!isPkceChallenge(challenge)) throw new Error('앱 로그인에 PKCE challenge 가 없습니다')
  const codeR = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + APP_AUTH_CODE_TTL_SEC * 1000)

  await store.create({ code: bindAppAuthCode(codeR, challenge), userId, expiresAt })

  // 별도 배치 없이 발급 시점에 흘려보낸다. 실패해도 로그인은 계속돼야 하므로 삼킨다.
  if (store === prismaStore) void pruneExpiredAppAuthCodes()

  return codeR
}

async function pruneExpiredAppAuthCodes(): Promise<void> {
  try {
    await prisma.appAuthCode.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    })
  } catch (e) {
    console.warn('[auth] AppAuthCode 정리 실패', e instanceof Error ? e.message : String(e))
  }
}

export interface AppAuthCodeUser {
  id: string
  email: string
}

/**
 * `code_r`+`verifier` 를 검증하고 **즉시 소각**한다. 형식 오류·verifier 불일치·만료·재사용·미존재는 전부 `null` 하나로
 * 수렴한다 — 호출부가 실패 사유를 구분해 노출하면 "그 코드는 존재하지만 만료됐다" 같은 정보가 샌다.
 */
export async function consumeAppAuthCode(rawCode: unknown, rawVerifier: unknown, store: AppAuthCodeStore = prismaStore, now = new Date()): Promise<AppAuthCodeUser | null> {
  if (typeof rawCode !== 'string' || !CODE_PATTERN.test(rawCode)) return null
  if (!isPkceVerifier(rawVerifier)) return null

  const stored = bindAppAuthCode(rawCode, pkceChallengeOf(rawVerifier))
  if ((await store.burn(stored, now)) !== 1) return null

  // 소각에 성공했는데 사용자가 없다면 교환 직전에 계정이 삭제된 경우다 — 실패로 수렴.
  return store.userOf(stored)
}
