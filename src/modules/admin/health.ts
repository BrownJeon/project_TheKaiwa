/**
 * `/api/health` 요약(module-dependency §3-1 규칙 4: app → admin.getHealthSummary 로 통일).
 *
 * - 키는 **역할 이름**만 쓴다(`llm`·`stt_gateway`·`stt_analysis`·`tts`) — 엔진명(claude·whisper·style-bert)을
 *   무인증 공개 엔드포인트에 흘리지 않기 위해서다(CLAUDE.md 금기, reviewer 2026-09-26 High-2).
 * - 값은 boolean 만. URL·경로·예외 메시지는 싣지 않는다(api-contract #1).
 * - 외부 서비스는 각 `/health` 를 1.5초 타임아웃으로 찔러 200 이면 true. 결과는 60초 메모리 캐시.
 * - `llm` 은 Phase 0 에서 `CLAUDE_CLI_PATH` 설정 여부만 본다. 실행 파일 `--version` 프로브는 spawn 을
 *   동반하므로 engine 층 EngineHealth(task-004)가 맡는다.
 *
 * 배포 헬스 게이트(task-009): release.sh 는 이 엔드포인트가 2xx 일 때만 새 릴리스를 확정한다(`curl -fsS`).
 * 음성·LLM 같은 선택 의존성만 빠진 상태(`degraded`)는 200 — M4 TTS 가 잠시 꺼져 있다고 웹 배포가 막히면 안 된다.
 * 필수 의존성(`HEALTH_REQUIRED_CHECKS`)이 하나라도 false 면 `down` → 라우트가 503 을 내 새 릴리스를 거부·자동 롤백시킨다.
 * `down` 결과는 5초만 캐시한다 — 60초 캐시면 기동 직후 한 번 실패한 판정이 release.sh 의 30초 대기 내내 굳는다.
 */
import { prisma } from '@/modules/infra'

export type HealthStatus = 'ok' | 'degraded' | 'down'
type Summary = { status: HealthStatus; degraded: string[]; checks: Record<string, boolean> }

/** 없으면 핵심 흐름(로그인·세션·저장·파일)이 동작하지 않는 항목. 나머지는 degraded 로만 보고한다. */
export const HEALTH_REQUIRED_CHECKS = ['env_database', 'env_jwt', 'env_google_oauth', 'env_data_root', 'db'] as const

const CACHE_MS = 60_000
const DOWN_CACHE_MS = 5_000
const PROBE_TIMEOUT_MS = 1_500
const DB_TIMEOUT_MS = 2_000
let cached: { at: number; value: Summary } | null = null

const has = (k: string) => typeof process.env[k] === 'string' && process.env[k]!.length > 0

async function probe(baseUrlEnv: string): Promise<boolean> {
  const base = process.env[baseUrlEnv]
  if (!base) return false
  try {
    const res = await fetch(new URL('/health', base), { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

async function pingDb(): Promise<boolean> {
  if (!has('DATABASE_URL')) return false
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), DB_TIMEOUT_MS)
  })
  const query = prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  )
  try {
    return await Promise.race([query, timeout])
  } finally {
    clearTimeout(timer)
  }
}

export function summarizeHealth(checks: Record<string, boolean>): Summary {
  const degraded = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
  const down = HEALTH_REQUIRED_CHECKS.some((k) => checks[k] !== true)
  return { status: down ? 'down' : degraded.length === 0 ? 'ok' : 'degraded', degraded, checks }
}

export function healthHttpStatus(status: HealthStatus): 200 | 503 {
  return status === 'down' ? 503 : 200
}

export async function getHealthSummary(now = Date.now(), dbPing: () => Promise<boolean> = pingDb): Promise<Summary> {
  if (cached && now - cached.at < (cached.value.status === 'down' ? DOWN_CACHE_MS : CACHE_MS)) return cached.value
  const [sttGateway, sttAnalysis, tts, db] = await Promise.all([
    probe('SPEECH_GATEWAY_URL'),
    probe('WHISPER_SERVICE_URL'),
    probe('TTS_SERVICE_URL'),
    dbPing(),
  ])
  const value = summarizeHealth({
    env_database: has('DATABASE_URL'),
    env_jwt: has('JWT_SECRET'),
    env_google_oauth: has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET'),
    env_data_root: has('DATA_ROOT'),
    env_internal_secret: has('SPEECH_INTERNAL_SECRET'),
    db,
    llm: has('CLAUDE_CLI_PATH'),
    stt_gateway: sttGateway,
    stt_analysis: sttAnalysis,
    tts,
  })
  cached = { at: now, value }
  return value
}
