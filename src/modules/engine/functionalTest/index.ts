/**
 * Functional Test(api-contract #96, module-dependency L5 `functionalTest/`) — Phase 1 범위(task-005b G4):
 *   LLM : 지정 connection 에 고정 JSON 스키마 요청 1회(재시도·폴백 없음, 30초 상한). 응답 본문은 저장·반환하지 않는다.
 *   STT·TTS : 테스트 자산·합성 경로가 task-003 이라 **실행하지 않는다** — 서비스가 없으면 reason SERVICE_DOWN(상태는 Health 판정),
 *            있으면 UNKNOWN + reason NOT_IMPLEMENTED, ONDEVICE 는 NOT_APPLICABLE(`@/types/admin` HealthSkipReason 표현 규칙).
 * connection 당 30초에 1회(메모리 + DB 최근 기록 이중 확인, 동시 요청은 먼저 온 하나만) — Claude 구독 사용량 보호.
 * 기록: `EngineHealth(FUNCTIONAL)`·`lastFunctionalAt`·`RequestTrace(FUNCTIONAL_TEST)`(단계 ms·상태·모델명만, 원문 없음).
 * connection 상태(status)는 바꾸지 않는다 — 일시적 구독 한도·지연으로 Router 가 연결을 빼 버리지 않게(상태 판정은 Health 몫).
 */
import { prisma } from '@/modules/infra'
import type { EngineConnection, Environment } from '@prisma/client'
import { probeConnection } from '../llm'
import { getProvider } from '../registry'
import type { HealthOutcome } from '../registry/types'
import type { ResolvedConnection } from '../router'
import { newTraceId, recordTrace, type TraceStep } from '../trace'
import { loadTarget, profileOf, recordHealth, type HealthRunResult } from '../health'

export const FUNCTIONAL_TEST_INTERVAL_MS = 30_000
const LLM_TIMEOUT_MS = 30_000

export class FunctionalTestRateLimitedError extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Functional Test 는 connection 당 30초에 1회 — ${retryAfterSec}초 후 다시`)
    this.name = 'FunctionalTestRateLimitedError'
  }
}

const lastStarted = new Map<string, number>()

async function claimSlot(connectionId: string): Promise<void> {
  const now = Date.now()
  const mem = lastStarted.get(connectionId)
  if (mem && now - mem < FUNCTIONAL_TEST_INTERVAL_MS) throw new FunctionalTestRateLimitedError(Math.ceil((FUNCTIONAL_TEST_INTERVAL_MS - (now - mem)) / 1000))
  // 동기 구간에서 먼저 잡는다 — 같은 프로세스의 동시 요청은 여기서 하나만 통과한다.
  lastStarted.set(connectionId, now)
  const last = await prisma.engineHealth.findFirst({ where: { connectionId, kind: 'FUNCTIONAL' }, orderBy: { checkedAt: 'desc' }, select: { checkedAt: true } })
  const age = last ? now - last.checkedAt.getTime() : Infinity
  if (age < FUNCTIONAL_TEST_INTERVAL_MS) throw new FunctionalTestRateLimitedError(Math.ceil((FUNCTIONAL_TEST_INTERVAL_MS - age) / 1000))
}

function asResolved(row: EngineConnection): ResolvedConnection {
  return {
    id: row.id,
    key: row.key,
    engineId: row.engineId,
    connectionType: row.connectionType,
    connection: (row.connection ?? {}) as Record<string, unknown>,
    runtime: (row.runtime ?? {}) as Record<string, unknown>,
    credentialRef: row.credentialRef,
  }
}

const LLM_ERROR: Record<string, { code: string; message: string; status: HealthOutcome['status'] }> = {
  LlmTimeoutError: { code: 'ETIMEDOUT', message: '30초 안에 응답하지 않았습니다', status: 'DEGRADED' },
  ClaudeCliTimeoutError: { code: 'ETIMEDOUT', message: '30초 안에 응답하지 않았습니다', status: 'DEGRADED' },
  ClaudeCliNotFoundError: { code: 'NOT_FOUND', message: 'CLI 실행 파일을 찾을 수 없습니다', status: 'UNAVAILABLE' },
  LlmContractError: { code: 'MISCONFIGURED', message: '연결 설정(주소·자격증명·모델)이 부족합니다', status: 'MISCONFIGURED' },
  JsonSchemaError: { code: 'SCHEMA_INVALID', message: '응답이 고정 스키마를 통과하지 못했습니다', status: 'DEGRADED' },
  LlmHttpError: { code: 'HTTP_ERROR', message: '서비스가 오류를 돌려줬습니다', status: 'DEGRADED' },
}

async function testLlm(row: EngineConnection): Promise<{ outcome: HealthOutcome; steps: TraceStep[] }> {
  const r = await probeConnection(asResolved(row), LLM_TIMEOUT_MS)
  const step: TraceStep = { name: 'LLM', ms: r.elapsedMs, connectionKey: row.key, engineId: row.engineId, model: r.model || null, status: r.ok ? 'OK' : r.errorName?.includes('Timeout') ? 'TIMEOUT' : 'FAILED', outputChars: r.outputChars, attempt: 1 }
  if (r.ok) return { outcome: { ok: true, status: 'HEALTHY', latencyMs: r.elapsedMs, detail: { schemaValid: true, model: r.model, outputChars: r.outputChars, attempts: 1 } }, steps: [step] }
  const m = LLM_ERROR[r.errorName ?? ''] ?? { code: 'ENGINE_ERROR', message: 'LLM 호출에 실패했습니다', status: 'DEGRADED' as const }
  return {
    outcome: { ok: false, status: m.status, latencyMs: r.elapsedMs, detail: { errorCode: m.code, message: m.message, schemaValid: r.schemaValid, ...(r.model ? { model: r.model } : {}), outputChars: r.outputChars, attempts: 1 } },
    steps: [step],
  }
}

async function testSpeech(row: EngineConnection): Promise<{ outcome: HealthOutcome; steps: TraceStep[] }> {
  const provider = getProvider(row.engineId)
  if (!provider) {
    const outcome: HealthOutcome = { ok: false, status: 'MISCONFIGURED', latencyMs: null, detail: { errorCode: 'PLUGIN_NOT_LOADED', message: '엔진 플러그인이 로드되지 않았습니다', skipped: true, reason: 'SERVICE_DOWN' } }
    return { outcome, steps: [{ name: 'HEALTH', ms: 0, connectionKey: row.key, status: 'FAILED' }] }
  }
  const h = await provider.healthCheck(await profileOf(row))
  const steps: TraceStep[] = [{ name: 'HEALTH', ms: h.latencyMs ?? 0, connectionKey: row.key, engineId: row.engineId, status: h.ok ? 'OK' : h.status === 'UNKNOWN' ? 'SKIPPED' : 'FAILED' }]
  // 대상 아님(ONDEVICE 등) — Health 가 이미 NOT_APPLICABLE 로 돌려준다.
  if (h.detail.reason === 'NOT_APPLICABLE') return { outcome: h, steps }
  if (!h.ok) return { outcome: { ...h, detail: { ...h.detail, skipped: true, reason: 'SERVICE_DOWN' } }, steps }
  steps.push({ name: provider.descriptor.type, ms: 0, connectionKey: row.key, status: 'SKIPPED' })
  return {
    outcome: {
      ok: false,
      status: 'UNKNOWN',
      latencyMs: h.latencyMs,
      detail: { ...h.detail, skipped: true, reason: 'NOT_IMPLEMENTED', message: '서비스는 응답하지만 음성 기능 테스트(샘플 전사·고정 문장 합성)는 task-003 에서 열립니다' },
    },
    steps,
  }
}

export async function runFunctionalTest(environment: Environment, connectionId: string, actorUserId: string): Promise<HealthRunResult & { traceId: string }> {
  const row = await loadTarget(environment, connectionId)
  await claimSlot(row.id)
  const traceId = newTraceId()
  const startedAt = Date.now()
  const provider = getProvider(row.engineId)
  const { outcome, steps } = provider?.descriptor.type === 'LLM' ? await testLlm(row) : await testSpeech(row)
  await recordTrace({
    traceId,
    kind: 'FUNCTIONAL_TEST',
    userId: actorUserId,
    status: outcome.ok ? 'OK' : outcome.status === 'UNKNOWN' ? 'PARTIAL' : 'ERROR',
    steps,
    totalMs: Date.now() - startedAt,
    errorCode: outcome.ok ? null : (outcome.detail.errorCode ?? null),
    refType: 'engineConnection',
    refId: row.id,
  })
  const res = await recordHealth(row, 'FUNCTIONAL', outcome, { traceId, updateStatus: false })
  return { ...res, traceId }
}
