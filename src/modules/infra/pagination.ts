/**
 * 커서 페이지네이션(api-contract §0-7) — 커서는 서버가 만든 불투명 문자열(정렬키+id 를 base64url JSON 으로)이고
 * 클라이언트는 해석하지 않는다. 해석할 수 없는 커서는 `400 VALIDATION`.
 */
import { ApiError } from './http'

export function encodeCursor(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

export function decodeCursor<T extends Record<string, unknown>>(raw: string | null | undefined, check: (v: Record<string, unknown>) => v is T): T | null {
  if (raw == null || raw === '') return null
  if (raw.length > 400) throw new ApiError('VALIDATION', 'cursor 가 올바르지 않습니다.', { field: 'cursor' })
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
  } catch {
    throw new ApiError('VALIDATION', 'cursor 가 올바르지 않습니다.', { field: 'cursor' })
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !check(parsed as Record<string, unknown>)) {
    throw new ApiError('VALIDATION', 'cursor 가 올바르지 않습니다.', { field: 'cursor' })
  }
  return parsed as T
}

/** `?limit=` — 1~max 정수, 없으면 기본값. */
export function parseLimit(raw: string | null | undefined, def = 20, max = 100): number {
  if (raw == null || raw === '') return def
  if (!/^\d{1,4}$/.test(raw)) throw new ApiError('VALIDATION', `limit 은 1~${max} 사이 정수여야 합니다.`, { field: 'limit' })
  const n = Number(raw)
  if (n < 1 || n > max) throw new ApiError('VALIDATION', `limit 은 1~${max} 사이 정수여야 합니다.`, { field: 'limit' })
  return n
}

/** 정렬키(ISO 시각)+id 커서의 형태 검사. */
export function isTimeIdCursor(v: Record<string, unknown>): v is { t: string; id: string } {
  return typeof v.t === 'string' && !Number.isNaN(Date.parse(v.t)) && typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 40
}

/** 오프셋 커서(작은 목록의 고정 정렬용)의 형태 검사. */
export function isOffsetCursor(v: Record<string, unknown>): v is { o: number } {
  return typeof v.o === 'number' && Number.isInteger(v.o) && v.o >= 0 && v.o <= 100_000
}
