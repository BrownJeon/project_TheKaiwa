/**
 * Functional Test(api-contract #96, module-dependency L5 `functionalTest/`) — Phase 1 범위(task-005b G4):
 *   LLM : 지정 connection 에 고정 JSON 스키마 요청 1회(재시도·폴백 없음, 30초 상한). 응답 본문은 저장·반환하지 않는다.
 *   TTS     : (task-003d) Health 통과 후 Provider `functionalTest` — 고정 문장 1회 합성(30초), 오디오는 저장하지 않고 크기·길이만.
 *   STT     : 테스트 자산이 task-003e 라 **실행하지 않는다** — 서비스가 없으면 reason SERVICE_DOWN(상태는 Health 판정),
 *            있으면 UNKNOWN + reason NOT_IMPLEMENTED, ONDEVICE 는 NOT_APPLICABLE(`@/types/admin` HealthSkipReason 표현 규칙).
 * connection 당 30초에 1회 — Claude 구독 사용량 보호. (task-012c D-C9) 슬롯은 **DB 조건부 갱신 한 문장**으로 잡는다:
 *   `UPDATE EngineConnection SET lastFunctionalAt=now WHERE id=? AND (lastFunctionalAt IS NULL OR lastFunctionalAt < now−30s)` 가 1행을 바꿨을 때만 실행
 *   (blue/green 두 프로세스·같은 프로세스 동시 요청 모두 1건 — 옛 메모리 Map 은 프로세스 사이를 못 막았다, REV-009 Low 1).
 *   그래서 `lastFunctionalAt` 은 "마지막 **시작** 시각"이다(결과 시각은 `EngineHealth.checkedAt`).
 * 기록: `EngineHealth(FUNCTIONAL)`·`RequestTrace(FUNCTIONAL_TEST)`(단계 ms·상태·모델명만, 원문 없음).
 * connection 상태(status)는 바꾸지 않는다 — 일시적 구독 한도·지연으로 Router 가 연결을 빼 버리지 않게(상태 판정은 Health 몫).
 */
import { prisma } from '@/modules/infra'
import type { EngineConnection, Environment, PrismaClient } from '@prisma/client'
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

export type SlotDb = Pick<PrismaClient, 'engineConnection'>

/**
 * 30초 슬롯 선점(D-C9). 조건부 UPDATE 가 0행이면 남은 초를 계산해 `FunctionalTestRateLimitedError`(1~30초).
 * 시각은 앱 값(UTC Date)이다 — 두 프로세스가 같은 호스트라 시계가 같다. 다른 호스트 시계가 앞서 미래 시각이 적혀 있어도 대기는 30초를 넘기지 않는다.
 */
export async function claimFunctionalSlot(connectionId: string, now: Date = new Date(), db: SlotDb = prisma): Promise<void> {
  const cutoff = new Date(now.getTime() - FUNCTIONAL_TEST_INTERVAL_MS)
  const r = await db.engineConnection.updateMany({
    where: { id: connectionId, OR: [{ lastFunctionalAt: null }, { lastFunctionalAt: { lt: cutoff } }] },
    data: { lastFunctionalAt: now },
  })
  if (r.count === 1) return
  const row = await db.engineConnection.findUnique({ where: { id: connectionId }, select: { lastFunctionalAt: true } })
  const age = row?.lastFunctionalAt ? now.getTime() - row.lastFunctionalAt.getTime() : 0
  const left = Math.ceil((FUNCTIONAL_TEST_INTERVAL_MS - Math.max(0, age)) / 1000)
  throw new FunctionalTestRateLimitedError(Math.min(FUNCTIONAL_TEST_INTERVAL_MS / 1000, Math.max(1, left)))
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
  LlmMisconfiguredError: { code: 'MISCONFIGURED', message: '연결 설정(주소·자격증명)이 허용 범위 밖이라 호출하지 않았습니다', status: 'MISCONFIGURED' },
  JsonSchemaError: { code: 'SCHEMA_INVALID', message: '응답이 고정 스키마를 통과하지 못했습니다', status: 'DEGRADED' },
  LlmHttpError: { code: 'HTTP_ERROR', message: '서비스가 오류를 돌려줬습니다', status: 'DEGRADED' },
}

async function testLlm(row: EngineConnection): Promise<{ outcome: HealthOutcome; steps: TraceStep[] }> {
  const r = await probeConnection(asResolved(row), LLM_TIMEOUT_MS)
  const step: TraceStep = { name: 'LLM', ms: r.elapsedMs, connectionKey: row.key, engineId: row.engineId, model: r.model || null, status: r.ok ? 'OK' : r.errorName?.includes('Timeout') ? 'TIMEOUT' : 'FAILED', outputChars: r.outputChars, attempt: 1 }
  if (r.ok) return { outcome: { ok: true, status: 'HEALTHY', latencyMs: r.elapsedMs, detail: { schemaValid: true, model: r.model, outputChars: r.outputChars, attempts: 1 } }, steps: [step] }
  const m = LLM_ERROR[r.errorName ?? ''] ?? { code: 'ENGINE_ERROR', message: 'LLM 호출에 실패했습니다', status: 'DEGRADED' as const }
  return {
    outcome: { ok: false, status: m.status, latencyMs: r.elapsedMs, detail: { errorCode: r.errorCode ?? m.code, message: m.message, schemaValid: r.schemaValid, ...(r.model ? { model: r.model } : {}), outputChars: r.outputChars, attempts: 1 } },
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
  if (provider.functionalTest) {
    const outcome = await provider.functionalTest(await profileOf(row))
    steps.push({ name: provider.descriptor.type, ms: outcome.latencyMs ?? 0, connectionKey: row.key, engineId: row.engineId, status: outcome.ok ? 'OK' : 'FAILED' })
    return { outcome, steps }
  }
  steps.push({ name: provider.descriptor.type, ms: 0, connectionKey: row.key, status: 'SKIPPED' })
  return {
    outcome: {
      ok: false,
      status: 'UNKNOWN',
      latencyMs: h.latencyMs,
      detail: { ...h.detail, skipped: true, reason: 'NOT_IMPLEMENTED', message: '서비스는 응답하지만 음성 기능 테스트(샘플 전사)는 task-003e 에서 열립니다' },
    },
    steps,
  }
}

export async function runFunctionalTest(environment: Environment, connectionId: string, actorUserId: string): Promise<HealthRunResult & { traceId: string }> {
  const row = await loadTarget(environment, connectionId)
  await claimFunctionalSlot(row.id)
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
