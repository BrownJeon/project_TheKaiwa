/**
 * Engine Router(module-dependency L5) — 역할별 `EngineFallbackPolicy`(현재 APP_ENV) 를 순회해 쓸 수 있는
 * connection 을 고른다. `status ∈ {UNAVAILABLE, DISABLED, MISCONFIGURED}`·`enabled=false` 는 건너뛰고,
 * `runtime.allowedTasks` 가 있는 connection(home-m4)은 그 task 에만 후보가 된다(회화·채팅·ASK 금지).
 *
 * 정책 행은 자주 바뀌지 않으므로 30초 메모리 캐시한다. 관리자 변경(ConfigurationVersion)은 최대 30초 뒤 반영.
 */
import { prisma } from '@/modules/infra'
import type { Environment, EngineRole } from '@prisma/client'

export type { LlmTier, LlmTask, LlmLane, TaskSpec } from './tasks'
export { LLM_TASKS, isLlmTask, adapterRetryOptions } from './tasks'

export interface ResolvedConnection {
  id: string
  key: string
  engineId: string
  connectionType: string
  connection: Record<string, unknown>
  runtime: Record<string, unknown>
  credentialRef: string | null
}

const SKIP_STATUS = new Set(['UNAVAILABLE', 'DISABLED', 'MISCONFIGURED'])
const CACHE_MS = 30_000
const cache = new Map<string, { at: number; list: ResolvedConnection[] }>()

export function currentEnvironment(): Environment {
  const v = (process.env.APP_ENV ?? 'LOCAL').toUpperCase()
  return (['LOCAL', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'].includes(v) ? v : 'LOCAL') as Environment
}

export class NoEngineAvailableError extends Error {
  readonly userMessage = 'AI 엔진을 지금 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  constructor(role: string, task?: string) {
    super(`역할 ${role}${task ? `(task=${task})` : ''} 에 쓸 수 있는 connection 이 없습니다`)
    this.name = 'NoEngineAvailableError'
  }
}

async function loadChain(role: EngineRole): Promise<ResolvedConnection[]> {
  const env = currentEnvironment()
  const key = `${env}:${role}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.list

  const policy = await prisma.engineFallbackPolicy.findUnique({ where: { environment_role: { environment: env, role } } })
  if (!policy || !policy.enabled) {
    cache.set(key, { at: Date.now(), list: [] })
    return []
  }
  const ids = [policy.primaryConnectionId, ...((policy.fallbackConnectionIds as string[] | null) ?? [])]
  // allowedTasks 가 있는 connection 은 정책 체인 밖에 있어도 그 task 의 후보다(home-m4 보조 작업).
  const rows = await prisma.engineConnection.findMany({ where: { environment: env, role, enabled: true } })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ordered = [
    ...ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r)),
    ...rows.filter((r) => !ids.includes(r.id)),
  ]
  const list: ResolvedConnection[] = ordered
    .filter((r) => !SKIP_STATUS.has(r.status))
    // 정책 체인 밖 connection 은 allowedTasks 가 있을 때만 후보로 남긴다.
    .filter((r) => ids.includes(r.id) || Array.isArray((r.runtime as Record<string, unknown> | null)?.allowedTasks))
    .map((r) => ({
      id: r.id,
      key: r.key,
      engineId: r.engineId,
      connectionType: r.connectionType,
      connection: (r.connection ?? {}) as Record<string, unknown>,
      runtime: (r.runtime ?? {}) as Record<string, unknown>,
      credentialRef: r.credentialRef,
    }))
  cache.set(key, { at: Date.now(), list })
  return list
}

function allowsTask(c: ResolvedConnection, task?: string): boolean {
  const allowed = c.runtime.allowedTasks
  if (!Array.isArray(allowed)) return true
  return task != null && (allowed as unknown[]).includes(task)
}

/**
 * DB 조회 경계 — 운영 코드는 이 객체를 통해서만 정책 체인을 읽고, 단위 테스트는 `mock.method(routerDeps, 'loadChain', …)` 로
 * 후보 connection 을 바꿔 끼워 폴백 경로(후보 2개)를 DB 없이 재현한다(orchestrator `turnDeps` 와 같은 관례, REV-032 M1 회귀 테스트).
 */
export const routerDeps = { loadChain }

/** 역할·task 에 맞는 후보 목록(우선순위 순). 첫 항목이 primary 다. */
export async function resolveCandidates(role: EngineRole, ctx: { task?: string } = {}): Promise<ResolvedConnection[]> {
  const chain = await routerDeps.loadChain(role)
  // allowedTasks 가 task 를 **명시**한 connection 을 앞에 둔다(보조 작업은 전용 connection 우선).
  const explicit = chain.filter((c) => Array.isArray(c.runtime.allowedTasks) && allowsTask(c, ctx.task))
  const general = chain.filter((c) => !Array.isArray(c.runtime.allowedTasks))
  return [...explicit, ...general]
}

export async function resolveConnection(role: EngineRole, ctx: { task?: string } = {}): Promise<ResolvedConnection> {
  const list = await resolveCandidates(role, ctx)
  if (list.length === 0) throw new NoEngineAvailableError(role, ctx.task)
  return list[0]
}

/**
 * 후보를 차례로 시도한다(1회 재시도 = 다음 후보). 실제로 쓴 connection 을 결과와 함께 돌려준다.
 * 모든 후보가 실패하면 마지막 오류를 던진다.
 */
export async function withFallback<T>(
  role: EngineRole,
  ctx: { task?: string },
  fn: (c: ResolvedConnection) => Promise<T>,
): Promise<{ value: T; connection: ResolvedConnection }> {
  const list = await resolveCandidates(role, ctx)
  if (list.length === 0) throw new NoEngineAvailableError(role, ctx.task)
  let lastErr: unknown
  for (const c of list.slice(0, 2)) {
    try {
      return { value: await fn(c), connection: c }
    } catch (e) {
      lastErr = e
      // 예산을 다 쓴 실패(타임아웃)는 다음 후보로 넘겨도 남은 시간이 없다 — 바로 올린다. 호출자가 취소한 요청(AbortError)도 그대로.
      const name = (e as { name?: string })?.name ?? ''
      if (name.includes('Timeout') || name === 'AbortError') throw e
      console.warn(`[router] ${role} connection=${c.key} 실패(${name || 'Error'}) — ${list.length > 1 ? '다음 후보' : '후보 없음'}`)
    }
  }
  throw lastErr
}

/** 테스트·관리자 변경 직후 캐시를 비운다. */
export function clearRouterCache(): void {
  cache.clear()
}
