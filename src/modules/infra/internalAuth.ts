/**
 * `/api/internal/*` 인증(api-contract §0-3) — gateway/worker 가 보내는 `X-Internal-Secret` 을 `SPEECH_INTERNAL_SECRET` 과 비교한다.
 *
 *   헤더 없음 → MISSING(라우트는 404 — 경로 존재를 숨김) · 값 불일치 → INVALID(401) · 일치 → OK
 *
 * TTS 전용 시크릿(`TTS_SERVICE_SECRET`, secrets.ts)과는 **다른 값·다른 함수**다(task-003d Codex C1 시크릿 분리).
 * 서버 쪽 값이 비었거나 16자 미만이면 설정 누락으로 보고 어떤 값도 통과시키지 않는다.
 * 비교는 양쪽을 SHA-256 으로 고정 길이로 만든 뒤 `timingSafeEqual` — 길이 차이로도 새지 않는다.
 */
import { createHash, timingSafeEqual } from 'node:crypto'

export const INTERNAL_SECRET_HEADER = 'x-internal-secret'
const MIN_SECRET_LENGTH = 16

export type InternalAuthResult = 'OK' | 'MISSING' | 'INVALID'

function digest(v: string): Buffer {
  return createHash('sha256').update(v, 'utf8').digest()
}

export function checkInternalSecret(headers: Headers): InternalAuthResult {
  const got = headers.get(INTERNAL_SECRET_HEADER)
  if (got === null) return 'MISSING'
  const expected = process.env.SPEECH_INTERNAL_SECRET?.trim()
  if (!expected || expected.length < MIN_SECRET_LENGTH) return 'INVALID'
  return timingSafeEqual(digest(got), digest(expected)) ? 'OK' : 'INVALID'
}
