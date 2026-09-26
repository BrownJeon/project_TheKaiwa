/**
 * POST /api/auth/complete 초대코드 무차별대입 방어 — VoiceVault
 * `src/lib/auth/completeRateLimit.ts` 이식.
 *
 * 인메모리 슬라이딩 윈도우다(DB를 쓰지 않는 순수 부수효과 함수). `ecosystem.config.js`가
 * Next.js를 **단일 인스턴스**로 기동하는 현재 배포 토폴로지에서만 충분하다 — 다중
 * 인스턴스로 스케일아웃하면 Redis 등 공유 카운터로 교체해야 한다.
 *
 * 이 라우트는 초대코드 검증이 완료되기 **전** 단계라 세션 쿠키(userId)가 없다. IP 기준으로
 * 키를 만들되, `x-forwarded-for`는 **마지막** 항목을 쓴다 — 첫 항목을 쓰면 공격자가 헤더를
 * 조작해 무제한 우회할 수 있다(StockInvest에서 폐기된 구현).
 */

const WINDOW_MS = 60 * 60 * 1000 // 1시간

/** 시간당 상한. */
export const COMPLETE_HOURLY_LIMIT = Number(process.env.AUTH_COMPLETE_HOURLY_LIMIT) || 5

/** 헤더가 없어 IP를 특정할 수 없을 때 쓰는 공용 버킷 키(LAN 내부 직결 등). */
export const UNKNOWN_IP_KEY = 'unknown'

export interface CompleteRateLimitDecision {
  allowed: boolean
}

export function clientIpKey(headers: Headers): string {
  const realIp = headers.get('x-real-ip')
  if (typeof realIp === 'string' && realIp.trim().length > 0) return realIp.trim()

  const xff = headers.get('x-forwarded-for')
  if (typeof xff === 'string') {
    const parts = xff
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return UNKNOWN_IP_KEY
}

/** 순수 판정(부수효과 없음) — `countInWindow`는 이번 시도를 포함하지 않은(아직 기록 전) 값. */
export function decideCompleteRateLimit(countInWindow: number): CompleteRateLimitDecision {
  return { allowed: countInWindow < COMPLETE_HOURLY_LIMIT }
}

// key(IP) → 윈도우 내 시도 타임스탬프(ms) 목록. 이 모듈 인스턴스가 살아있는 동안만 유효하다.
const attempts = new Map<string, number[]>()

function pruneWindow(list: number[], now: number): number[] {
  const windowStart = now - WINDOW_MS
  return list.filter((t) => t > windowStart)
}

/**
 * `key`(클라이언트 IP)의 시도를 판정하고, 허용된 시도만 기록한다(거부된 시도는 기록하지
 * 않는다 — 슬라이딩 윈도우가 자연히 오래된 항목을 밀어내므로 별도 페널티가 필요 없다).
 * 성공/실패 여부와 무관하게 이 라우트에 도달한 모든 시도를 센다.
 */
export function checkAndRecordCompleteAttempt(key: string, now: number = Date.now()): CompleteRateLimitDecision {
  const pruned = pruneWindow(attempts.get(key) ?? [], now)
  const decision = decideCompleteRateLimit(pruned.length)
  if (decision.allowed) {
    pruned.push(now)
  }
  if (pruned.length > 0) {
    attempts.set(key, pruned)
  } else {
    attempts.delete(key)
  }
  return decision
}

/** 테스트 전용 — 전체 상태 초기화. */
export function resetCompleteRateLimit(): void {
  attempts.clear()
}
