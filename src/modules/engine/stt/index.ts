/**
 * 실시간 STT 역할 파사드(module-dependency L5) — L4 `speech/stt` 는 이것만 부른다. 연결 주소·엔진명은 이 아래에만 있다.
 *
 *   realtimeTargets()        : REALTIME_STT 폴백 정책 순서의 connection(**UNAVAILABLE 포함** — 티켓 발급 전 재확인 판단에 필요),
 *                              DISABLED·enabled=false 제외. tts.targets() 와 같은 이유로 Router(가용만)와 따로 둔다.
 *   publicRuntime(target)    : 클라이언트에 내줄 수 있는 실행 값(VAD·partial·스레드·wsPath·manifest) — 주소·시크릿 없음.
 *   devWsUrl(target)         : **개발 서버(NODE_ENV=development)에서만** gateway 에 직접 붙을 ws:// 주소(loopback 만). 운영은 항상 null.
 *   findRealtimeConnection() : id 또는 key 가 현재 환경의 REALTIME_STT connection 인지(`Utterance.realtimeEngine` 스냅샷 검증).
 *   analysisTarget()         : (task-012b) 분석 STT 잡 적재 게이트 — 현재 환경 ANALYSIS_STT 정책의 쓸 수 있는 connection.
 *   findAnalysisConnectionKey(): (task-012b) worker 보고 `analysisEngine` 이 현재 환경 ANALYSIS_STT connection key 인지.
 */
import type { ConnectionType, EngineConnection, EngineStatus } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { profileOf } from '../health'
import { currentEnvironment } from '../router'

export interface SttTarget {
  id: string
  key: string
  connectionType: ConnectionType
  status: EngineStatus
  lastHealthAt: Date | null
  updatedAt: Date
}

export interface SttPublicRuntime {
  wsPath: string
  numThreads: number | null
  decodingMethod: string | null
  vadSilenceMs: number | null
  vadThreshold: number | null
  partial: boolean
  manifestUrl: string | null
  modelBytes: number | null
  modelVersion: string | null
}

const TARGET_CACHE_MS = 5_000
const RUNTIME_CACHE_MS = 30_000
let targetCache: { at: number; env: string; list: SttTarget[] } | null = null
const runtimeCache = new Map<string, { at: number; updatedAt: number; runtime: SttPublicRuntime; baseUrl: unknown }>()

function toTarget(r: EngineConnection): SttTarget {
  return { id: r.id, key: r.key, connectionType: r.connectionType, status: r.status, lastHealthAt: r.lastHealthAt, updatedAt: r.updatedAt }
}

export async function realtimeTargets(): Promise<SttTarget[]> {
  const env = currentEnvironment()
  if (targetCache && targetCache.env === env && Date.now() - targetCache.at < TARGET_CACHE_MS) return targetCache.list
  const policy = await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment: env, role: 'REALTIME_STT' } } })
  let list: SttTarget[] = []
  if (policy?.enabled) {
    const ids = [policy.primaryConnectionId, ...((policy.fallbackConnectionIds as string[] | null) ?? [])]
    const rows = await prisma.engineConnection.findMany({ where: { environment: env, role: 'REALTIME_STT', enabled: true, id: { in: ids } } })
    const byId = new Map(rows.map((r) => [r.id, r]))
    list = ids
      .map((id) => byId.get(id))
      .filter((r): r is EngineConnection => !!r && r.status !== 'DISABLED')
      .map(toTarget)
  }
  targetCache = { at: Date.now(), env, list }
  return list
}

/** Health 가 상태를 바꾼 직후 부른다(다음 판정이 5초 캐시를 기다리지 않게). */
export function clearSttTargetCache(): void {
  targetCache = null
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function str(v: unknown, re: RegExp): string | null {
  return typeof v === 'string' && re.test(v) ? v : null
}

const WS_PATH = /^\/[A-Za-z0-9/_-]{1,60}$/
const MANIFEST = /^\/models\/[A-Za-z0-9._/-]{1,120}\.json$/

/** Effective 값 → 클라이언트에 내줄 실행 값(순수 — task-012c 편집 키 "런타임 실사용값 == Effective" 테스트가 같은 함수를 쓴다). */
export function publicRuntimeFromValues(v: Record<string, unknown>): SttPublicRuntime {
  return {
    wsPath: str(v['connection.wsPath'], WS_PATH) ?? '/ws/speech',
    numThreads: int(v['runtime.numThreads']),
    decodingMethod: str(v['runtime.decodingMethod'], /^[a-z_]{1,30}$/),
    vadSilenceMs: int(v['runtime.vad.endpointSilenceMs']),
    vadThreshold: num(v['runtime.vad.threshold']),
    partial: v['runtime.partial'] !== false,
    manifestUrl: str(v['connection.manifestUrl'], MANIFEST),
    modelBytes: int(v['connection.modelBytes']),
    modelVersion: str(v['runtime.modelVersion'], /^[A-Za-z0-9._-]{1,80}$/),
  }
}

async function loadRuntime(target: SttTarget): Promise<{ runtime: SttPublicRuntime; baseUrl: unknown }> {
  const hit = runtimeCache.get(target.id)
  if (hit && hit.updatedAt === target.updatedAt.getTime() && Date.now() - hit.at < RUNTIME_CACHE_MS) return hit
  const row = await prisma.engineConnection.findUnique({ where: { id: target.id } })
  if (!row) throw new Error('connection 이 사라졌습니다')
  const v = (await profileOf(row)).values
  const runtime = publicRuntimeFromValues(v)
  const entry = { at: Date.now(), updatedAt: target.updatedAt.getTime(), runtime, baseUrl: v['connection.baseUrl'] }
  runtimeCache.set(target.id, entry)
  return entry
}

export async function publicRuntime(target: SttTarget): Promise<SttPublicRuntime> {
  return (await loadRuntime(target)).runtime
}

/**
 * 개발 서버에서 브라우저가 gateway 에 직접 붙을 주소. 운영(`next start` = NODE_ENV production)은 언제나 null —
 * 클라이언트는 같은 호스트의 `wsPath`(nginx `/ws/speech` 프록시)로 붙는다. 주소가 loopback 이 아니면 null(내부 주소 노출 금지).
 */
export async function devWsUrl(target: SttTarget): Promise<string | null> {
  if (process.env.NODE_ENV !== 'development' || target.connectionType !== 'HTTP') return null
  const { runtime, baseUrl } = await loadRuntime(target)
  if (typeof baseUrl !== 'string') return null
  try {
    const u = new URL(baseUrl)
    if (u.protocol !== 'http:' || u.username || u.password || !/^(127\.0\.0\.1|localhost)$/.test(u.hostname)) return null
    return `ws://${u.host}${runtime.wsPath}`
  } catch {
    return null
  }
}

const ANALYSIS_CACHE_MS = 5_000
let analysisCache: { at: number; env: string; target: { id: string; key: string } | null } | null = null

/**
 * 현재 환경의 분석 STT(ANALYSIS_STT) 대상 — 폴백 정책 순서에서 enabled·비DISABLED 인 첫 connection(task-012b 적재 게이트 ③).
 * 정책이 꺼졌거나 대상이 없으면 null. 5초 캐시(발화 업로드마다 DB 를 치지 않게).
 */
export async function analysisTarget(): Promise<{ id: string; key: string } | null> {
  const env = currentEnvironment()
  if (analysisCache && analysisCache.env === env && Date.now() - analysisCache.at < ANALYSIS_CACHE_MS) return analysisCache.target
  const policy = await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment: env, role: 'ANALYSIS_STT' } } })
  let target: { id: string; key: string } | null = null
  if (policy?.enabled) {
    const ids = [policy.primaryConnectionId, ...((policy.fallbackConnectionIds as string[] | null) ?? [])]
    const rows = await prisma.engineConnection.findMany({ where: { environment: env, role: 'ANALYSIS_STT', enabled: true, id: { in: ids } }, select: { id: true, key: true, status: true } })
    const byId = new Map(rows.map((r) => [r.id, r]))
    const hit = ids.map((id) => byId.get(id)).find((r) => !!r && r.status !== 'DISABLED')
    target = hit ? { id: hit.id, key: hit.key } : null
  }
  analysisCache = { at: Date.now(), env, target }
  return target
}

/** key → 현재 환경의 ANALYSIS_STT connection key(worker 가 보고한 `analysisEngine` 스냅샷 검증). 없으면 null. */
export async function findAnalysisConnectionKey(key: string): Promise<string | null> {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(key)) return null
  const row = await prisma.engineConnection.findFirst({ where: { key, environment: currentEnvironment(), role: 'ANALYSIS_STT' }, select: { key: true } })
  return row?.key ?? null
}

/** id 또는 key → 현재 환경의 REALTIME_STT connection(없거나 다른 역할이면 null). */
export async function findRealtimeConnection(idOrKey: string): Promise<{ id: string; key: string; connectionType: ConnectionType } | null> {
  if (typeof idOrKey !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(idOrKey)) return null
  const env = currentEnvironment()
  const row =
    (await prisma.engineConnection.findFirst({ where: { id: idOrKey, environment: env, role: 'REALTIME_STT' }, select: { id: true, key: true, connectionType: true } })) ??
    (await prisma.engineConnection.findFirst({ where: { key: idOrKey, environment: env, role: 'REALTIME_STT' }, select: { id: true, key: true, connectionType: true } }))
  return row
}
