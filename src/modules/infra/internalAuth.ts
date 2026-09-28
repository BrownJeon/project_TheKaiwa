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

export type InternalCallerResult = InternalAuthResult | 'SERVICE_MISMATCH' | 'ENV_MISMATCH'

/**
 * worker 콜백(#138~#140, task-012b)용 — 시크릿 확인 뒤 `X-Service`(호출 서비스 이름)와 `X-Service-Env`(서비스의 APP_ENV)가
 * 이 경로가 기대하는 서비스·이 앱의 APP_ENV 와 같은지 본다(api-contract §2-28: 다르면 409 ENV_MISMATCH). 헤더가 없으면 불일치로 본다.
 * 순서는 시크릿이 먼저 — 인증 전에는 어떤 불일치도 알려 주지 않는다.
 */
export function checkInternalCaller(headers: Headers, service: 'gateway' | 'worker'): InternalCallerResult {
  const auth = checkInternalSecret(headers)
  if (auth !== 'OK') return auth
  if ((headers.get('x-service') ?? '').trim().toLowerCase() !== service) return 'SERVICE_MISMATCH'
  const appEnv = (process.env.APP_ENV ?? 'LOCAL').trim().toUpperCase()
  if ((headers.get('x-service-env') ?? '').trim().toUpperCase() !== appEnv) return 'ENV_MISMATCH'
  return 'OK'
}
