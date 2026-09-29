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
import type { EngineConnection, EngineHealth, Environment, Prisma, PrismaClient } from '@prisma/client'
import { effectiveValues, resolveConnectionCandidate } from '../configuration/resolver'
import { probeConnection } from '../llm'
import { getProvider } from '../registry'
import type { ConfigTestMark, ConnectionProfile, HealthOutcome } from '../registry/types'
import type { LlmTier, ResolvedConnection } from '../router'
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

/**
 * LLM 프로브 — tier 마다 1회(재시도·폴백 없음). `stream` 이면 조각 스트리밍을 함께 확인한다:
 * 행의 `runtime.earlySentenceTts !== false` 면 조각이 1개 이상, false 면 0개여야 통과(첫 문장 조기 추출 설정이 실제로 적용되는지).
 */
async function testLlm(row: EngineConnection, opts: { tiers?: readonly LlmTier[]; stream?: boolean } = {}): Promise<{ outcome: HealthOutcome; steps: TraceStep[] }> {
  const tiers = opts.tiers?.length ? opts.tiers : (['fast'] as const)
  const steps: TraceStep[] = []
  let elapsed = 0
  let last: Awaited<ReturnType<typeof probeConnection>> | null = null
  for (const tier of tiers) {
    const r = await probeConnection(asResolved(row), LLM_TIMEOUT_MS, { tier, stream: opts.stream })
    elapsed += r.elapsedMs
    last = r
    let streamProblem: string | null = null
    if (r.ok && opts.stream) {
      const expectDeltas = (row.runtime as Record<string, unknown> | null)?.earlySentenceTts !== false
      if (expectDeltas && !r.deltas) streamProblem = 'STREAM_NO_DELTA'
      if (!expectDeltas && r.deltas) streamProblem = 'STREAM_UNEXPECTED_DELTA'
    }
    steps.push({ name: 'LLM', ms: r.elapsedMs, connectionKey: row.key, engineId: row.engineId, model: r.model || null, status: r.ok && !streamProblem ? 'OK' : r.errorName?.includes('Timeout') ? 'TIMEOUT' : 'FAILED', outputChars: r.outputChars, attempt: 1 })
    if (streamProblem) {
      return { outcome: { ok: false, status: 'DEGRADED', latencyMs: elapsed, detail: { errorCode: streamProblem, message: '첫 문장 조기 추출(스트리밍) 설정이 호출에 반영되지 않았습니다', schemaValid: true, model: r.model, outputChars: r.outputChars, attempts: 1 } }, steps }
    }
    if (!r.ok) {
      const m = LLM_ERROR[r.errorName ?? ''] ?? { code: 'ENGINE_ERROR', message: 'LLM 호출에 실패했습니다', status: 'DEGRADED' as const }
      return {
        outcome: { ok: false, status: m.status, latencyMs: elapsed, detail: { errorCode: r.errorCode ?? m.code, message: m.message, schemaValid: r.schemaValid, ...(r.model ? { model: r.model } : {}), outputChars: r.outputChars, attempts: 1 } },
        steps,
      }
    }
  }
  return { outcome: { ok: true, status: 'HEALTHY', latencyMs: elapsed, detail: { schemaValid: true, model: last?.model ?? '', outputChars: last?.outputChars ?? 0, attempts: tiers.length } }, steps }
}

/** STT·TTS: Health → Provider 기능 테스트. `profile` 이 있으면 그 값(후보)으로. */
async function testSpeech(row: EngineConnection, profileOverride?: ConnectionProfile): Promise<{ outcome: HealthOutcome; steps: TraceStep[] }> {
  const provider = getProvider(row.engineId)
  if (!provider) {
    const outcome: HealthOutcome = { ok: false, status: 'MISCONFIGURED', latencyMs: null, detail: { errorCode: 'PLUGIN_NOT_LOADED', message: '엔진 플러그인이 로드되지 않았습니다', skipped: true, reason: 'SERVICE_DOWN' } }
    return { outcome, steps: [{ name: 'HEALTH', ms: 0, connectionKey: row.key, status: 'FAILED' }] }
  }
  const profile = profileOverride ?? (await profileOf(row))
  const h = await provider.healthCheck(profile)
  const steps: TraceStep[] = [{ name: 'HEALTH', ms: h.latencyMs ?? 0, connectionKey: row.key, engineId: row.engineId, status: h.ok ? 'OK' : h.status === 'UNKNOWN' ? 'SKIPPED' : 'FAILED' }]
  // 대상 아님(ONDEVICE 등) — Health 가 이미 NOT_APPLICABLE 로 돌려준다.
  if (h.detail.reason === 'NOT_APPLICABLE') return { outcome: h, steps }
  if (!h.ok) return { outcome: { ...h, detail: { ...h.detail, skipped: true, reason: 'SERVICE_DOWN' } }, steps }
  if (provider.functionalTest) {
    const outcome = await provider.functionalTest(profile)
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

// ── config/test(#105, task-012c) — 후보 설정을 메모리에서만 합성해 실행하고 결과 행에 후보 표시(ConfigTestMark)를 남긴다 ─────────

export interface ConnectionCandidate {
  connection: Record<string, unknown>
  runtime: Record<string, unknown>
  credentialRef: string | null
  logLevel: string
}

export interface ConfigConnectionTestInput {
  environment: Environment
  connectionId: string
  actorUserId: string
  /** 없으면 저장된 값 그대로(Fallback 새 연결·연결 켜기 검증). */
  candidate?: ConnectionCandidate | null
  llm?: { tiers: readonly LlmTier[]; stream: boolean }
  /** 결과 행에 남길 후보 표시 — `testedKeys` 는 이 실행이 통과했을 때 검증된 키, `statusIfOk` 는 전체 판정(다른 키가 검증 불가면 partial). */
  mark: Omit<ConfigTestMark, 'status'> & { statusIfOk: ConfigTestMark['status'] }
}

export interface ConfigConnectionTestResult {
  health: EngineHealth
  connection: EngineConnection
  traceId: string
  ok: boolean
  /** 실행하지 않았다(ONDEVICE·STT 샘플 전사 미구현) — 검증 불가로 본다. */
  skipped: boolean
  errorCode: string | null
}

const CANDIDATE_ROW = (row: EngineConnection, c: ConnectionCandidate): EngineConnection => ({
  ...row,
  connection: c.connection as Prisma.JsonValue,
  runtime: c.runtime as Prisma.JsonValue,
  credentialRef: c.credentialRef,
  logLevel: c.logLevel,
})

async function recordConfigRun(row: EngineConnection, actorUserId: string, traceId: string, startedAt: number, outcome: HealthOutcome, steps: TraceStep[], mark: ConfigTestMark): Promise<HealthRunResult> {
  await recordTrace({
    traceId,
    kind: 'FUNCTIONAL_TEST',
    userId: actorUserId,
    status: outcome.ok ? 'OK' : outcome.status === 'UNKNOWN' ? 'PARTIAL' : 'ERROR',
    steps,
    totalMs: Date.now() - startedAt,
    errorCode: outcome.ok ? null : (outcome.detail.errorCode ?? null),
    refType: 'configTest',
    refId: row.id,
  })
  return recordHealth(row, 'FUNCTIONAL', { ...outcome, detail: { ...outcome.detail, config: mark } }, { traceId, updateStatus: false })
}

/** 연결 하나를 (후보 값으로) 실행 검증한다 — 30초 슬롯은 #96 과 공유(D-C9). 사용자 데이터·TtsCache·연결 행 무변경. */
export async function runConfigConnectionTest(input: ConfigConnectionTestInput): Promise<ConfigConnectionTestResult> {
  const row = await loadTarget(input.environment, input.connectionId)
  await claimFunctionalSlot(row.id)
  const traceId = newTraceId()
  const startedAt = Date.now()
  const provider = getProvider(row.engineId)
  const testRow = input.candidate ? CANDIDATE_ROW(row, input.candidate) : row
  let run: { outcome: HealthOutcome; steps: TraceStep[] }
  if (provider?.descriptor.type === 'LLM') run = await testLlm(testRow, input.llm)
  else {
    const profile: ConnectionProfile | undefined = input.candidate
      ? { id: row.id, key: row.key, connectionType: row.connectionType, values: effectiveValues(await resolveConnectionCandidate(input.environment, row, input.candidate)) }
      : undefined
    run = await testSpeech(row, profile)
  }
  const skipped = run.outcome.detail.skipped === true && (run.outcome.detail.reason === 'NOT_APPLICABLE' || run.outcome.detail.reason === 'NOT_IMPLEMENTED')
  const ok = run.outcome.ok && !skipped
  const { statusIfOk, ...markBase } = input.mark
  const mark: ConfigTestMark = { ...markBase, testedKeys: ok ? markBase.testedKeys : [], status: ok ? statusIfOk : skipped ? 'partial' : 'failed' }
  const res = await recordConfigRun(row, input.actorUserId, traceId, startedAt, run.outcome, run.steps, mark)
  return { ...res, traceId, ok, skipped, errorCode: ok ? null : (run.outcome.detail.errorCode ?? (skipped ? (run.outcome.detail.reason ?? 'SKIPPED') : null)) }
}

/**
 * 연결 밖(speech 층)에서 실행한 검증(AppSetting 미리듣기 문장·기본 목소리 = TTS 합성)의 결과를 그 연결의 FUNCTIONAL 행으로 남긴다.
 * 호출자는 실행 **전에** `claimFunctionalSlot(connectionId)` 로 슬롯을 잡는다.
 */
export async function recordConfigTestResult(input: {
  environment: Environment
  connectionId: string
  actorUserId: string
  startedAt: number
  outcome: HealthOutcome
  steps: TraceStep[]
  mark: ConfigTestMark
}): Promise<{ health: EngineHealth; traceId: string }> {
  const row = await loadTarget(input.environment, input.connectionId)
  const traceId = newTraceId()
  const res = await recordConfigRun(row, input.actorUserId, traceId, input.startedAt, input.outcome, input.steps, input.mark)
  return { health: res.health, traceId }
}

/** PRODUCTION Apply 가 `testResultId` 로 읽는 행(FUNCTIONAL + config 표시가 있는 것만). */
export async function findConfigTestResult(id: string): Promise<{ health: EngineHealth; mark: ConfigTestMark } | null> {
  if (!id || id.length > 40 || !/^[A-Za-z0-9_-]+$/.test(id)) return null
  const h = await prisma.engineHealth.findUnique({ where: { id } })
  if (!h || h.kind !== 'FUNCTIONAL') return null
  const d = h.detail && typeof h.detail === 'object' && !Array.isArray(h.detail) ? (h.detail as Record<string, unknown>) : {}
  const c = d.config
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null
  const m = c as Record<string, unknown>
  if (typeof m.scope !== 'string' || typeof m.targetId !== 'string' || typeof m.environment !== 'string' || typeof m.candidateHash !== 'string' || !Array.isArray(m.testedKeys)) return null
  if (m.status !== 'ok' && m.status !== 'partial' && m.status !== 'failed') return null
  return {
    health: h,
    mark: {
      scope: m.scope,
      targetId: m.targetId,
      environment: m.environment,
      candidateHash: m.candidateHash,
      testedKeys: (m.testedKeys as unknown[]).filter((x): x is string => typeof x === 'string'),
      status: m.status,
      ...(Array.isArray(m.related) ? { related: (m.related as unknown[]).filter((x): x is string => typeof x === 'string') } : {}),
    },
  }
}
