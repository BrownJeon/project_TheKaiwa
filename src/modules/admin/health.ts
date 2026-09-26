/**
 * `/api/health` 요약(module-dependency §3-1 규칙 4: app → admin.getHealthSummary 로 통일).
 *
 * - 키는 **역할 이름**만 쓴다(`llm`·`stt_gateway`·`stt_analysis`·`tts`) — 엔진명(claude·whisper·style-bert)을
 *   무인증 공개 엔드포인트에 흘리지 않기 위해서다(CLAUDE.md 금기, reviewer 2026-09-26 High-2).
 * - 값은 boolean 만. URL·경로·예외 메시지는 싣지 않는다(api-contract #1).
 * - 외부 서비스는 각 `/health` 를 1.5초 타임아웃으로 찔러 200 이면 true. 결과는 60초 메모리 캐시.
 * - `llm` 은 Phase 0 에서 `CLAUDE_CLI_PATH` 설정 여부만 본다. 실행 파일 `--version` 프로브는 spawn 을
 *   동반하므로 engine 층 EngineHealth(task-004)가 맡는다.
 */
type Summary = { status: 'ok' | 'degraded'; degraded: string[]; checks: Record<string, boolean> }

const CACHE_MS = 60_000
const PROBE_TIMEOUT_MS = 1_500
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

export async function getHealthSummary(now = Date.now()): Promise<Summary> {
  if (cached && now - cached.at < CACHE_MS) return cached.value
  const [sttGateway, sttAnalysis, tts] = await Promise.all([
    probe('SPEECH_GATEWAY_URL'),
    probe('WHISPER_SERVICE_URL'),
    probe('TTS_SERVICE_URL'),
  ])
  const checks: Record<string, boolean> = {
    env_database: has('DATABASE_URL'),
    env_jwt: has('JWT_SECRET'),
    env_google_oauth: has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET'),
    env_data_root: has('DATA_ROOT'),
    env_internal_secret: has('SPEECH_INTERNAL_SECRET'),
    llm: has('CLAUDE_CLI_PATH'),
    stt_gateway: sttGateway,
    stt_analysis: sttAnalysis,
    tts,
  }
  const degraded = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
  const value: Summary = { status: degraded.length === 0 ? 'ok' : 'degraded', degraded, checks }
  cached = { at: now, value }
  return value
}
