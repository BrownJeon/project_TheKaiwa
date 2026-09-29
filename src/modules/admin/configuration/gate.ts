/**
 * PRODUCTION 적용 게이트(configuration-resolution §8-1 · role-permission §6 · task-012c D-C1·CX-2) — 순수 판정(테스트 결과 조회만 주입).
 *
 *   confirm = 문자열 "PRODUCTION"(403 PRODUCTION_CONFIRMATION_REQUIRED) → summaryHash = 서버가 같은 후보로 다시 계산한 Diff 해시(409 SUMMARY_MISMATCH) →
 *   (바뀐 키 중 NOT_NEEDED 가 아닌 것이 있으면) testResultId = EngineHealth(FUNCTIONAL, config 표시) — ok · 30분 이내 · 같은 대상·환경 ·
 *   같은 후보(candidateHash) · testedKeys ⊇ 검증 필요 변경 키 · 함께 돈 연결(related)도 ok(403 PRODUCTION_TEST_REQUIRED, `detail` 에 사유 코드).
 * SUPER_ADMIN·reason(10~200)·capability 는 호출자(commitEdit)가 먼저 본다. 비 PRODUCTION 은 testResultId 가 있으면 확인되는 것만 요약으로 남긴다(선택).
 * 교차 환경 PRODUCTION 쓰기는 바뀐 키가 전부 NOT_NEEDED 일 때만(기능 테스트는 자기 환경 연결로만 돈다 — Leader 결정).
 */
import { ApiError } from '@/modules/infra'
import { findConfigTestResult, type ConfigDiff, type ConfigTestMark } from '@/modules/engine'
import type { EngineHealth, Environment } from '@prisma/client'

export const PRODUCTION_CONFIRM = 'PRODUCTION'
export const TEST_RESULT_TTL_MS = 30 * 60_000

export interface GateTarget {
  scope: string
  targetId: string
  environment: Environment
}

export interface VerifiedTest {
  testResultId: string
  traceId: string | null
  checkedAt: string
}

export interface GateDeps {
  findTest: (id: string) => Promise<{ health: Pick<EngineHealth, 'id' | 'ok' | 'checkedAt' | 'traceId'>; mark: ConfigTestMark } | null>
  now: () => number
}

const DEFAULT_DEPS: GateDeps = { findTest: findConfigTestResult, now: () => Date.now() }

export type TestDenyReason = 'MISSING' | 'NOT_FOUND' | 'NOT_OK' | 'EXPIRED' | 'OTHER_TARGET' | 'OTHER_CANDIDATE' | 'KEYS_NOT_TESTED' | 'RELATED_NOT_OK'

function deny(why: TestDenyReason): ApiError {
  return new ApiError('FORBIDDEN', '운영 적용 전에 이 변경으로 기능 테스트를 통과해야 해요(30분 안).', { reason: 'PRODUCTION_TEST_REQUIRED', detail: why })
}

export async function verifyTestResult(raw: unknown, t: GateTarget, d: Pick<ConfigDiff, 'candidateHash' | 'changes'>, deps: GateDeps = DEFAULT_DEPS): Promise<VerifiedTest> {
  if (typeof raw !== 'string' || !raw) throw deny('MISSING')
  const r = await deps.findTest(raw)
  if (!r) throw deny('NOT_FOUND')
  if (r.mark.status !== 'ok' || !r.health.ok) throw deny('NOT_OK')
  if (deps.now() - r.health.checkedAt.getTime() > TEST_RESULT_TTL_MS) throw deny('EXPIRED')
  if (r.mark.scope !== t.scope || r.mark.targetId !== t.targetId || r.mark.environment !== t.environment) throw deny('OTHER_TARGET')
  if (r.mark.candidateHash !== d.candidateHash) throw deny('OTHER_CANDIDATE')
  const needed = d.changes.filter((c) => c.verifiable !== 'NOT_NEEDED').map((c) => c.key)
  if (!needed.every((k) => r.mark.testedKeys.includes(k))) throw deny('KEYS_NOT_TESTED')
  for (const id of r.mark.related ?? []) {
    const rel = await deps.findTest(id)
    if (!rel || !rel.health.ok) throw deny('RELATED_NOT_OK')
  }
  return { testResultId: r.health.id, traceId: r.health.traceId, checkedAt: r.health.checkedAt.toISOString() }
}

/** PRODUCTION 이면 확인 흐름 전부, 아니면 선택 테스트 결과 요약(확인 실패는 무시). */
export async function productionGate(
  body: Record<string, unknown>,
  t: GateTarget,
  d: Pick<ConfigDiff, 'candidateHash' | 'changes' | 'summaryHash' | 'testRequired'>,
  deps: GateDeps = DEFAULT_DEPS,
): Promise<VerifiedTest | null> {
  if (t.environment !== 'PRODUCTION') {
    if (typeof body.testResultId !== 'string' || !body.testResultId) return null
    return verifyTestResult(body.testResultId, t, d, deps).catch(() => null)
  }
  if (body.confirm !== PRODUCTION_CONFIRM) throw new ApiError('FORBIDDEN', `운영(PRODUCTION) 적용은 확인 문구 "${PRODUCTION_CONFIRM}" 를 입력해야 합니다.`, { reason: 'PRODUCTION_CONFIRMATION_REQUIRED' })
  if (body.summaryHash !== d.summaryHash) throw new ApiError('CONFLICT', '확인한 변경 요약과 지금 적용될 변경이 달라요. 변경 요약을 다시 확인해 주세요.', { reason: 'SUMMARY_MISMATCH' })
  return d.testRequired ? verifyTestResult(body.testResultId, t, d, deps) : null
}

export function assertCrossEnvironment(cross: boolean, targetEnvironment: Environment, d: Pick<ConfigDiff, 'changes'>): void {
  if (!cross || targetEnvironment !== 'PRODUCTION') return
  if (d.changes.some((c) => c.verifiable !== 'NOT_NEEDED')) {
    throw new ApiError('FORBIDDEN', '다른 환경 서버에서는 운영(PRODUCTION) 설정을 실행 검증 없이 바꿀 수 없어요 — 운영 서버에서 적용해 주세요.', { reason: 'CROSS_ENVIRONMENT_TEST_UNAVAILABLE' })
  }
}
