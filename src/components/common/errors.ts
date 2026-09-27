/**
 * `ApiError` → 화면 분기용 평평한 값. 화면은 **HTTP status 를 먼저** 보고(screens.md §3-4), 같은 status 안의
 * 갈래(409 단어 중복·만료 등)만 `details` 로 가른다. 서버 `message` 를 화면에 띄울지는 `labels.ts` 가 정한다.
 */
import { ApiError } from '@/components/common/api'

export interface Err {
  /** 0 = 네트워크(응답 없음), -1 = 봉투 밖 예외 */
  status: number
  message: string
  code: string | null
  details: Record<string, unknown>
  retryAfterSec: number | null
}

export function toErr(e: unknown): Err {
  if (e instanceof ApiError) {
    return { status: e.status, message: e.message, code: e.code, details: e.details ?? {}, retryAfterSec: e.retryAfterSec }
  }
  return { status: -1, message: '', code: null, details: {}, retryAfterSec: null }
}

/** 429 대기 초: `details.retryAfterSec` → `Retry-After` 헤더 → 10초. */
export function retryAfterOf(err: Err): number {
  const fromDetails = Number(err.details.retryAfterSec)
  if (Number.isFinite(fromDetails) && fromDetails > 0) return Math.ceil(fromDetails)
  if (err.retryAfterSec && err.retryAfterSec > 0) return err.retryAfterSec
  return 10
}

export function detailString(err: Err, key: string): string | null {
  const v = err.details[key]
  return typeof v === 'string' && v ? v : null
}
