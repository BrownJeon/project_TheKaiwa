import type { NextResponse } from 'next/server'
import { checkInternalCaller, fail } from '@/modules/infra'

export const notFound = () => fail('NOT_FOUND', '요청한 항목을 찾을 수 없습니다.')

/**
 * worker 콜백(#138~#140) 공통 인증(api-contract §2-28) — 통과면 null, 아니면 보낼 응답.
 * 시크릿 없음 404(경로 존재 숨김) · 틀림 401 · `X-Service` 가 worker 가 아님 403 · `X-Service-Env` 가 앱 APP_ENV 와 다름 409 ENV_MISMATCH.
 */
export function rejectUnlessWorker(headers: Headers): NextResponse | null {
  const r = checkInternalCaller(headers, 'worker')
  if (r === 'OK') return null
  if (r === 'MISSING') return notFound()
  if (r === 'INVALID') return fail('UNAUTHENTICATED', '인증에 실패했습니다.')
  if (r === 'SERVICE_MISMATCH') return fail('FORBIDDEN', '허용되지 않은 호출입니다.', { reason: 'SERVICE_MISMATCH' })
  return fail('CONFLICT', '서비스 환경이 앱 환경과 다릅니다.', { reason: 'ENV_MISMATCH' })
}
