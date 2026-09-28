/**
 * 연결 주소 허용 목록의 엔진 쪽 입력(task-012c D-C3(c)) — "서버 env 에 적힌 서비스 origin" 을 모은다. 판정 자체는 infra `netPolicy`.
 * Health·Functional Test(Health 경유)·Validate(편집) 가 같은 함수를 쓴다. 시크릿을 싣는 실호출은 이보다 좁은 env origin 고정(D-C3(a))을 따로 건다.
 *
 * 이름 목록은 어댑터 스키마 URL 키의 `envAlias` 합집합과 같아야 한다(단위 테스트가 대조) — providers 를 여기서 import 하면
 * provider → httpHealth → 이 파일 → providers 순환이 생겨 상수로 둔다. `KAIWA_CONN_<KEY>_CONNECTION_BASEURL`·`KAIWA_<ROLE>_CONNECTION_BASEURL`
 * (configuration-resolution §2-1 ENVIRONMENT 층)도 운영자 설정이라 함께 믿는다.
 */
import { vetOutboundUrl, type LookupFn, type OutboundVet } from '@/modules/infra'

export const SERVICE_URL_ENV_NAMES = ['AI_API_BASE', 'SPEECH_GATEWAY_URL', 'WHISPER_SERVICE_URL', 'TTS_SERVICE_URL', 'TTS_BASE_URL'] as const
const KAIWA_URL_ENV = /^KAIWA_(CONN_[A-Z0-9_]+|REALTIME_STT|ANALYSIS_STT|TTS|LLM)_CONNECTION_BASEURL$/

function originOf(raw: string | undefined): string | null {
  const v = raw?.trim().split(/\s+/)[0]
  if (!v) return null
  try {
    const u = new URL(v)
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}

export function trustedServiceOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const names = [...SERVICE_URL_ENV_NAMES, ...Object.keys(env).filter((n) => KAIWA_URL_ENV.test(n)).sort()]
  const out = new Set<string>()
  for (const n of names) {
    const o = originOf(env[n])
    if (o) out.add(o)
  }
  return [...out]
}

/** 연결 주소 판정(허용 밖 = `HOST_NOT_ALLOWED` — Validate `rule:hostNotAllowed`). 통과하면 실제로 연결할 `connectUrl`(이름이면 검사한 주소로 고정). */
export function vetConnectionUrl(raw: unknown, lookup?: LookupFn): Promise<OutboundVet> {
  return vetOutboundUrl(raw, trustedServiceOrigins(), lookup)
}
