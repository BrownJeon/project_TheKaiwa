/**
 * HTTP 서비스 `/health` 프로브(api-contract #95, 타임아웃 5s) — Python 서비스·home-m4 공용.
 *
 * 보안(task-005b G4): 주소는 **Effective 설정(DB connection·서버 env)** 에서만 온다 — 요청 본문 URL 을 받지 않는다.
 * 그래도 방어적으로: http(s) 만, URL 안 자격증명(`user:pass@`) 거부, 리다이렉트 미추종, 응답 본문 64KB 상한,
 * 결과에는 **화이트리스트 필드(숫자·짧은 식별 문자열)만** 남긴다 — 응답 본문·URL·예외 메시지를 싣지 않는다.
 * 헬스 요청에 시크릿 헤더(X-Internal-Secret 등)를 붙이지 않는다(주소가 관리자 편집 대상이 되는 Phase 2 에서 유출 경로가 되므로).
 */
import type { HealthDetail, HealthOutcome } from '../../registry/types'

const MAX_BODY_BYTES = 64 * 1024
export const HEALTH_TIMEOUT_MS = 5_000

const ENVS = new Set(['LOCAL', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'])
const SAFE_TOKEN = /^[\w.\-+:() ]{1,40}$/

export type HealthInterpreter = (json: Record<string, unknown>) => Partial<Pick<HealthOutcome, 'ok' | 'status'>> & { detail?: HealthDetail }

function fail(status: HealthOutcome['status'], errorCode: string, message: string, latencyMs: number | null = null, httpStatus?: number): HealthOutcome {
  return { ok: false, status, latencyMs, detail: { errorCode, message, ...(httpStatus ? { httpStatus } : {}) } }
}

/** 설정값을 안전한 헬스 URL 로. 형식이 틀리면 null(→ MISCONFIGURED). */
export function healthUrl(baseUrl: unknown, path = '/health'): URL | null {
  if (typeof baseUrl !== 'string' || baseUrl.length === 0 || baseUrl.length > 300) return null
  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    return null
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') return null
  if (base.username || base.password) return null
  return new URL(path, base)
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      break
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** 응답 JSON 에서 공통 필드만 골라 낸다(문자열은 짧은 식별자 형태만). */
export function pickCommonDetail(json: Record<string, unknown>): HealthDetail {
  const d: HealthDetail = {}
  const version = json.version
  if (typeof version === 'string' && SAFE_TOKEN.test(version)) d.version = version
  const models = json.models
  if (typeof models === 'number' && Number.isFinite(models)) d.models = Math.trunc(models)
  else if (Array.isArray(models)) d.models = models.length
  const mem = typeof json.memoryMb === 'number' ? json.memoryMb : json.rssMb
  if (typeof mem === 'number' && Number.isFinite(mem)) d.memoryMb = Math.round(mem)
  if (typeof json.device === 'string' && /^[a-z0-9_-]{1,20}$/i.test(json.device)) d.device = json.device
  const env = typeof json.env === 'string' ? json.env : json.serviceEnv
  if (typeof env === 'string' && ENVS.has(env.toUpperCase())) d.serviceEnv = env.toUpperCase()
  return d
}

function networkCode(e: unknown): string {
  const err = e as { name?: string; code?: string; cause?: { code?: string } }
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'ETIMEDOUT'
  const code = err?.cause?.code ?? err?.code
  return typeof code === 'string' && /^E[A-Z]{2,20}$/.test(code) ? code : 'NETWORK_ERROR'
}

const NETWORK_MESSAGE: Record<string, string> = {
  ETIMEDOUT: '응답 시간이 초과됐습니다',
  ECONNREFUSED: '서비스가 실행 중이 아닙니다(연결 거부)',
  ENOTFOUND: '호스트를 찾을 수 없습니다',
  EHOSTUNREACH: '호스트에 닿을 수 없습니다',
  ECONNRESET: '연결이 끊겼습니다',
}

export async function probeHttpHealth(baseUrl: unknown, opts: { path?: string; timeoutMs?: number; interpret?: HealthInterpreter } = {}): Promise<HealthOutcome> {
  const url = healthUrl(baseUrl, opts.path)
  if (!url) return fail('MISCONFIGURED', 'BAD_BASE_URL', '연결 주소 설정이 올바르지 않습니다')
  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(url, { method: 'GET', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(opts.timeoutMs ?? HEALTH_TIMEOUT_MS), headers: { accept: 'application/json' } })
  } catch (e) {
    const code = networkCode(e)
    return fail('UNAVAILABLE', code, NETWORK_MESSAGE[code] ?? '서비스에 연결하지 못했습니다', Date.now() - startedAt)
  }
  const text = await readCapped(res).catch(() => '')
  const latencyMs = Date.now() - startedAt
  if (res.status >= 500) return fail('UNAVAILABLE', `HTTP_${res.status}`, '서비스가 오류를 돌려줬습니다', latencyMs, res.status)
  if (res.status === 401 || res.status === 403) return fail('DEGRADED', `HTTP_${res.status}`, '헬스 엔드포인트가 인증을 요구합니다', latencyMs, res.status)
  if (res.status < 200 || res.status >= 300) return fail('DEGRADED', `HTTP_${res.status}`, '예상하지 못한 응답입니다', latencyMs, res.status)

  let json: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) json = parsed as Record<string, unknown>
  } catch {
    // JSON 이 아닌 200 도 "살아 있음" 으로 본다.
  }
  const base: HealthOutcome = { ok: true, status: 'HEALTHY', latencyMs, detail: { httpStatus: res.status, ...pickCommonDetail(json) } }
  if (!opts.interpret) return base
  const extra = opts.interpret(json)
  return { ok: extra.ok ?? base.ok, status: extra.status ?? base.status, latencyMs, detail: { ...base.detail, ...(extra.detail ?? {}) } }
}
