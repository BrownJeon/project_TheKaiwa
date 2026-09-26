/**
 * 앱(Capacitor) 딥링크 인증 코드 — 설계안 §5-2.
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
 * 소각은 `updateMany(where: usedAt=null AND expiresAt>now)` **한 방의 조건부 UPDATE**로
 * 한다. "조회 후 갱신"으로 나누면 동시 요청 두 개가 같은 코드로 각각 세션을 받는 경쟁
 * 조건이 생긴다 — 영향 행 수가 정확히 1일 때만 통과시킨다.
 */
import { randomBytes } from 'node:crypto'
import { prisma } from '@/modules/infra/db'

export const APP_AUTH_CODE_TTL_SEC = 60

/** 32바이트 랜덤의 hex 표현(64자). 형식이 고정이라 DB에 닿기 전에 쓰레기 입력을 걸러낸다. */
const CODE_PATTERN = /^[0-9a-f]{64}$/

/** 소각·만료된 코드를 남겨둘 시간 — 이 뒤에는 청소 대상. */
const RETENTION_MS = 60 * 60 * 1000

export async function issueAppAuthCode(userId: string): Promise<string> {
  const code = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + APP_AUTH_CODE_TTL_SEC * 1000)

  await prisma.appAuthCode.create({ data: { code, userId, expiresAt } })

  // 별도 배치 없이 발급 시점에 흘려보낸다. 실패해도 로그인은 계속돼야 하므로 삼킨다.
  void pruneExpiredAppAuthCodes()

  return code
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
 * 코드를 검증하고 **즉시 소각**한다. 만료·재사용·미존재는 전부 `null` 하나로 수렴한다 —
 * 호출부가 실패 사유를 구분해 노출하면 "그 코드는 존재하지만 만료됐다" 같은 정보가 샌다.
 */
export async function consumeAppAuthCode(rawCode: unknown): Promise<AppAuthCodeUser | null> {
  if (typeof rawCode !== 'string' || !CODE_PATTERN.test(rawCode)) return null

  const now = new Date()
  const burned = await prisma.appAuthCode.updateMany({
    where: { code: rawCode, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  })
  if (burned.count !== 1) return null

  const row = await prisma.appAuthCode.findUnique({
    where: { code: rawCode },
    select: { user: { select: { id: true, email: true } } },
  })
  // 소각에 성공했는데 사용자가 없다면 교환 직전에 계정이 삭제된 경우다 — 실패로 수렴.
  return row?.user ?? null
}
