/**
 * task-012c 서버 2단계(admin) — PRODUCTION 게이트 분기(confirm·summaryHash·testResultId 8갈래) · 교차 환경 PRODUCTION 은 NOT_NEEDED 만(Leader 결정 —
 * 코드로 강제) · 역할 × 편집 capability · 라우트 첫 줄 requireCapability · 입력 파서(VOICE_PROFILE 은 012c-2) · 키 정책 DTO.
 * 트랜잭션·버전·감사·경합은 라이브 스모크(tests/live/task012c-smoke).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import type { ConfigDiff, ConfigTestMark, EditKeyDef } from '@/modules/engine'
import type { Capability } from '@/types/admin'
import { can } from '../permissions/can'
import { ROLES } from '../permissions/matrix'
import type { AdminActor } from '../permissions/guard'
import { assertCrossEnvironment, productionGate, TEST_RESULT_TTL_MS, verifyTestResult, type GateDeps, type GateTarget } from '../configuration/gate'
import { editEnvironment, keyPolicyDto, parseBaseVersion, parseScope } from '../configuration/editor'
import type { EditTarget } from '../configuration/targets'
import { auditDto, itemDto, versionRawReadAuditEntry } from '../configuration/history'
import type { AuditLog, ConfigurationVersion } from '@prisma/client'

const NOW = Date.parse('2026-09-29T10:00:00Z')
const T: GateTarget = { scope: 'ENGINE_CONNECTION', targetId: 'conn-1', environment: 'PRODUCTION' }

type Change = Pick<ConfigDiff['changes'][number], 'key' | 'verifiable'>
function diff(changes: Change[], extra: Partial<ConfigDiff> = {}): Pick<ConfigDiff, 'candidateHash' | 'changes' | 'summaryHash' | 'testRequired'> {
  return {
    candidateHash: 'sha256:cand',
    summaryHash: 'sha256:sum',
    changes: changes as ConfigDiff['changes'],
    testRequired: changes.some((c) => c.verifiable !== 'NOT_NEEDED'),
    ...extra,
  }
}

function mark(over: Partial<ConfigTestMark> = {}): ConfigTestMark {
  return { scope: 'ENGINE_CONNECTION', targetId: 'conn-1', environment: 'PRODUCTION', candidateHash: 'sha256:cand', testedKeys: ['runtime.modelByTier.fast'], status: 'ok', ...over }
}

function deps(rows: Record<string, { ok?: boolean; ageMs?: number; mark?: Partial<ConfigTestMark> }>): GateDeps {
  return {
    now: () => NOW,
    findTest: async (id) => {
      const r = rows[id]
      if (!r) return null
      return { health: { id, ok: r.ok ?? true, checkedAt: new Date(NOW - (r.ageMs ?? 60_000)), traceId: `tr_${id}` }, mark: mark(r.mark) }
    },
  }
}

const FAST: Change[] = [{ key: 'runtime.modelByTier.fast', verifiable: 'YES' }]
const body = (over: Record<string, unknown> = {}) => ({ confirm: 'PRODUCTION', summaryHash: 'sha256:sum', testResultId: 'h1', ...over })

async function rejects(p: Promise<unknown>, code: string, reason: string, detail?: string): Promise<void> {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof ApiError, String(e))
    assert.equal(e.code, code)
    assert.equal(e.details?.reason, reason)
    if (detail) assert.equal(e.details?.detail, detail)
    return true
  })
}

test('PRODUCTION 게이트 — confirm 문구 없음 403 → summaryHash 불일치 409 → 테스트 필요 403(순서대로)', async () => {
  const d = deps({ h1: {} })
  await rejects(productionGate(body({ confirm: 'production' }), T, diff(FAST), d), 'FORBIDDEN', 'PRODUCTION_CONFIRMATION_REQUIRED')
  await rejects(productionGate(body({ confirm: undefined }), T, diff(FAST), d), 'FORBIDDEN', 'PRODUCTION_CONFIRMATION_REQUIRED')
  await rejects(productionGate(body({ summaryHash: 'sha256:other' }), T, diff(FAST), d), 'CONFLICT', 'SUMMARY_MISMATCH')
  await rejects(productionGate(body({ testResultId: undefined }), T, diff(FAST), d), 'FORBIDDEN', 'PRODUCTION_TEST_REQUIRED', 'MISSING')
  const ok = await productionGate(body(), T, diff(FAST), d)
  assert.deepEqual(ok, { testResultId: 'h1', traceId: 'tr_h1', checkedAt: new Date(NOW - 60_000).toISOString() })
})

test('testResultId 검증 8갈래 — 없음·다른 결과·실패/partial·30분 초과·다른 대상/환경·다른 후보·변경 키 미검증·함께 돈 연결 실패', async () => {
  const cases: [string, Record<string, { ok?: boolean; ageMs?: number; mark?: Partial<ConfigTestMark> }>, string][] = [
    ['nope', {}, 'NOT_FOUND'],
    ['h1', { h1: { mark: { status: 'partial' } } }, 'NOT_OK'],
    ['h1', { h1: { ok: false } }, 'NOT_OK'],
    ['h1', { h1: { mark: { status: 'failed' } } }, 'NOT_OK'],
    ['h1', { h1: { ageMs: TEST_RESULT_TTL_MS + 1 } }, 'EXPIRED'],
    ['h1', { h1: { mark: { targetId: 'conn-2' } } }, 'OTHER_TARGET'],
    ['h1', { h1: { mark: { environment: 'LOCAL' } } }, 'OTHER_TARGET'],
    ['h1', { h1: { mark: { scope: 'FALLBACK_POLICY' } } }, 'OTHER_TARGET'],
    ['h1', { h1: { mark: { candidateHash: 'sha256:other' } } }, 'OTHER_CANDIDATE'],
    ['h1', { h1: { mark: { testedKeys: [] } } }, 'KEYS_NOT_TESTED'],
    ['h1', { h1: { mark: { related: ['r1'] } } }, 'RELATED_NOT_OK'],
    ['h1', { h1: { mark: { related: ['r1'] } }, r1: { ok: false } }, 'RELATED_NOT_OK'],
  ]
  for (const [id, rows, why] of cases) {
    await rejects(verifyTestResult(id, T, diff(FAST), deps(rows)), 'FORBIDDEN', 'PRODUCTION_TEST_REQUIRED', why)
  }
  const twoKeys: Change[] = [...FAST, { key: 'runtime.thinkingForDeep', verifiable: 'YES' }]
  await rejects(verifyTestResult('h1', T, diff(twoKeys), deps({ h1: {} })), 'FORBIDDEN', 'PRODUCTION_TEST_REQUIRED', 'KEYS_NOT_TESTED')
  const withLabel: Change[] = [...FAST, { key: 'x.label', verifiable: 'NOT_NEEDED' }]
  assert.equal((await verifyTestResult('h1', T, diff(withLabel), deps({ h1: {} }))).testResultId, 'h1', 'NOT_NEEDED 키는 testedKeys 에 없어도 된다')
  assert.equal((await verifyTestResult('h1', T, diff(FAST), deps({ h1: { ageMs: TEST_RESULT_TTL_MS - 1, mark: { related: ['r1'] } }, r1: {} }))).testResultId, 'h1')
})

test('PRODUCTION 게이트 — 바뀐 키가 전부 NOT_NEEDED(표시 전용·끄기)면 테스트 면제, confirm·summaryHash 는 그대로 필요', async () => {
  const off: Change[] = [{ key: 'enabled', verifiable: 'NOT_NEEDED' }]
  assert.equal(await productionGate(body({ testResultId: undefined }), T, diff(off), deps({})), null)
  await rejects(productionGate(body({ confirm: '' }), T, diff(off), deps({})), 'FORBIDDEN', 'PRODUCTION_CONFIRMATION_REQUIRED')
  await rejects(productionGate(body({ summaryHash: 'x' }), T, diff(off), deps({})), 'CONFLICT', 'SUMMARY_MISMATCH')
  const unverifiable: Change[] = [{ key: 'runtime.partial', verifiable: 'NO' }]
  await rejects(productionGate(body({ testResultId: undefined }), T, diff(unverifiable), deps({})), 'FORBIDDEN', 'PRODUCTION_TEST_REQUIRED', 'MISSING')
})

test('비 PRODUCTION — confirm·summaryHash·테스트 불요, testResultId 는 확인되는 것만 요약(실패는 조용히 null)', async () => {
  const L: GateTarget = { ...T, environment: 'LOCAL' }
  assert.equal(await productionGate({}, L, diff(FAST), deps({})), null)
  assert.equal(await productionGate({ testResultId: 'nope' }, L, diff(FAST), deps({})), null)
  const r = await productionGate({ testResultId: 'h1' }, L, diff(FAST), deps({ h1: { mark: { environment: 'LOCAL' } } }))
  assert.equal(r?.testResultId, 'h1')
})

test('교차 환경 PRODUCTION 쓰기 — 바뀐 키가 전부 NOT_NEEDED 일 때만, 하나라도 아니면 403 CROSS_ENVIRONMENT_TEST_UNAVAILABLE(Leader 결정)', () => {
  const only: Change[] = [{ key: 'enabled', verifiable: 'NOT_NEEDED' }, { key: 'x.label', verifiable: 'NOT_NEEDED' }]
  assert.doesNotThrow(() => assertCrossEnvironment(true, 'PRODUCTION', diff(only)))
  for (const bad of [[...only, { key: 'runtime.modelByTier.fast', verifiable: 'YES' }], [{ key: 'runtime.partial', verifiable: 'NO' }]] as Change[][]) {
    assert.throws(
      () => assertCrossEnvironment(true, 'PRODUCTION', diff(bad)),
      (e: unknown) => e instanceof ApiError && e.code === 'FORBIDDEN' && e.details?.reason === 'CROSS_ENVIRONMENT_TEST_UNAVAILABLE',
    )
  }
  assert.doesNotThrow(() => assertCrossEnvironment(true, 'STAGING', diff(FAST)), '비 PRODUCTION 교차 대상은 이 규칙 밖(SUPER_ADMIN·감사는 commitEdit)')
  assert.doesNotThrow(() => assertCrossEnvironment(false, 'PRODUCTION', diff(FAST)))
})

// ── 역할 × capability ─────────────────────────────────────────────────────

test('역할 × 편집 capability — ADMIN Form·Rollback, DEVELOPER Raw, SUPER_ADMIN 비밀 참조·운영 적용·교차 환경', () => {
  const expect: Record<string, Capability[]> = {
    USER: [],
    ADMIN: ['config.edit', 'config.rollback', 'engine.connections.manage', 'functional_test.run', 'config.effective.read', 'audit.read'],
    DEVELOPER: ['config.edit', 'config.rollback', 'engine.connections.manage', 'functional_test.run', 'config.effective.read', 'audit.read', 'config.raw.read'],
    SUPER_ADMIN: ['config.edit', 'config.rollback', 'engine.connections.manage', 'functional_test.run', 'config.effective.read', 'audit.read', 'config.raw.read', 'credentials.manage', 'config.apply.production', 'environment.policy'],
  }
  const all: Capability[] = [...new Set(Object.values(expect).flat())]
  for (const role of ROLES) for (const c of all) assert.equal(can(role, c).allowed, expect[role].includes(c), `${role} × ${c}`)
  const P = { targetEnvironment: 'PRODUCTION' as const }
  for (const c of ['config.edit', 'config.rollback', 'engine.connections.manage'] as Capability[]) {
    assert.deepEqual(can('ADMIN', c, P).missing, ['config.apply.production'], `ADMIN ${c} PRODUCTION`)
    assert.deepEqual(can('DEVELOPER', c, P).missing, ['config.apply.production'], `DEVELOPER ${c} PRODUCTION`)
    assert.equal(can('SUPER_ADMIN', c, P).allowed, true)
  }
})

const ROUTES: [string, string, Capability][] = [
  ['config/validate/route.ts', 'POST', 'config.edit'],
  ['config/diff/route.ts', 'POST', 'config.edit'],
  ['config/test/route.ts', 'POST', 'functional_test.run'],
  ['config/apply/route.ts', 'POST', 'config.edit'],
  ['config/versions/route.ts', 'GET', 'config.effective.read'],
  ['config/versions/[id]/route.ts', 'GET', 'config.effective.read'],
  ['config/versions/[id]/rollback/route.ts', 'POST', 'config.rollback'],
  ['config/raw/[scope]/[targetId]/route.ts', 'GET', 'config.raw.read'],
  ['config/raw/[scope]/[targetId]/route.ts', 'PUT', 'config.edit'],
  ['engine-connections/[id]/route.ts', 'PUT', 'engine.connections.manage'],
  ['engine-connections/[id]/enabled/route.ts', 'PUT', 'engine.connections.manage'],
  ['engine-connections/[id]/credential/route.ts', 'PUT', 'credentials.manage'],
  ['fallback-policies/[role]/route.ts', 'PUT', 'engine.connections.manage'],
  ['app-settings/[key]/route.ts', 'GET', 'config.edit'],
  ['app-settings/[key]/route.ts', 'PUT', 'config.edit'],
  ['audit/route.ts', 'GET', 'audit.read'],
]

test('012c 라우트 — 처리 함수의 첫 문장이 정본 capability 의 requireCapability(#105~#111·#93·#93a·#93b·#100·#123b·#137)', () => {
  const base = join(process.cwd(), 'src/app/api/admin/v1')
  for (const [file, method, cap] of ROUTES) {
    const src = readFileSync(join(base, file), 'utf8')
    const re = new RegExp(`export const ${method} = withApi(?:<\\w+>)?\\(async \\([^)]*\\) => \\{\\s*const actor = await requireCapability\\('([a-z_.]+)'\\)`)
    const m = re.exec(src)
    assert.ok(m, `${file} ${method} 첫 줄이 requireCapability 가 아니다`)
    assert.equal(m[1], cap, `${file} ${method}`)
  }
})

// ── 입력 파서 · 키 정책 DTO ─────────────────────────────────────────────────

const actor = (role: AdminActor['role'], environment: AdminActor['environment'] = 'LOCAL'): AdminActor => ({ id: 'u1', email: 'u@x', name: null, role, capabilities: [], environment, ip: null })

test('입력 — VOICE_PROFILE 은 400 SCOPE_DEFERRED(D-C14 → 012c-2), baseVersion 정수만, 교차 환경 대상은 SUPER_ADMIN 만', () => {
  assert.throws(() => parseScope('voice_profile'), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && e.details?.reason === 'SCOPE_DEFERRED')
  assert.throws(() => parseScope('PROMPT'), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
  assert.equal(parseScope('engine_connection'), 'ENGINE_CONNECTION')
  assert.equal(parseBaseVersion(3), 3)
  assert.equal(parseBaseVersion('0'), 0)
  for (const bad of [undefined, null, -1, 1.5, '1e3', 'x']) assert.throws(() => parseBaseVersion(bad), (e: unknown) => e instanceof ApiError && e.details?.field === 'baseVersion', String(bad))
  assert.equal(editEnvironment(actor('ADMIN'), undefined), 'LOCAL')
  assert.equal(editEnvironment(actor('ADMIN'), 'local'), 'LOCAL')
  assert.throws(() => editEnvironment(actor('DEVELOPER'), 'PRODUCTION'), (e: unknown) => e instanceof ApiError && e.code === 'FORBIDDEN')
  assert.equal(editEnvironment(actor('SUPER_ADMIN'), 'PRODUCTION'), 'PRODUCTION')
  assert.throws(() => editEnvironment(actor('SUPER_ADMIN'), 'MARS'), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
})

test('키 정책 DTO — verifiable(YES·NO·NOT_NEEDED·DYNAMIC)·잠금 사유 문구·env 우선 표시, 비밀 참조 값 없음', async () => {
  const def = (over: Partial<EditKeyDef>): EditKeyDef => ({ key: 'value', type: 'STRING', default: null, description: 'd', editability: 'RUNTIME_EDITABLE', strict: false, consumer: 'APP', verify: 'NONE', lock: null, ...over })
  const t = { scope: 'APP_SETTING', environment: 'LOCAL', targetId: 'k', targetKey: 'k', targetName: 'k', defs: [], stored: { value: 'v' }, schemaVersion: 1, row: null } as unknown as EditTarget
  assert.equal(keyPolicyDto(t, def({ verify: 'TTS_TEXT' })).verifiable, 'YES')
  assert.equal(keyPolicyDto(t, def({ verify: 'NONE' })).verifiable, 'NO')
  assert.equal(keyPolicyDto(t, def({ verify: 'NOT_NEEDED' })).verifiable, 'NOT_NEEDED')
  assert.equal(keyPolicyDto(t, def({ verify: 'SWITCH' })).verifiable, 'DYNAMIC')
  const locked = keyPolicyDto(t, def({ lock: 'SERVICE_MANAGED' }))
  assert.equal(locked.editable, false)
  assert.match(locked.lockMessage ?? '', /서비스 설정 파일/)
  const prev = process.env.KAIWA_T012C_SHADOW
  process.env.KAIWA_T012C_SHADOW = '1'
  try {
    assert.equal(keyPolicyDto(t, def({ runtimeEnvWins: ['KAIWA_T012C_SHADOW'] })).shadowedByEnv, true)
  } finally {
    if (prev === undefined) delete process.env.KAIWA_T012C_SHADOW
    else process.env.KAIWA_T012C_SHADOW = prev
  }
  assert.equal(keyPolicyDto(t, def({})).shadowedByEnv, false)
})

test('버전 이력·감사 응답 — 012c 2단계 이전에 저장된 옛 행의 reason 도 응답에서 가린다(평범한 이유는 그대로)', () => {
  const now = new Date('2026-09-29T10:00:00Z')
  const v = { id: 'v1', environment: 'LOCAL', scope: 'ENGINE_CONNECTION', targetId: 'c1', version: 2, snapshot: {}, diff: null, status: 'ACTIVE', actorUserId: null, reason: '옛 키 0123456789abcdef0123456789abcdef 폐기', testResult: null, restoredFromVersion: null, createdAt: now, supersededAt: null } as unknown as ConfigurationVersion
  assert.equal(itemDto(v, null, 'OK').reason, '옛 키 *** 폐기')
  assert.equal(itemDto({ ...v, reason: '発音が不自然なので例文を差し替えます。' }, null, 'OK').reason, '発音が不自然なので例文を差し替えます。')
  assert.equal(itemDto({ ...v, reason: null }, null, 'OK').reason, null)
  const a = { id: 'a1', environment: 'LOCAL', actorUserId: null, actorEmailSnap: 'system', actorRoleSnap: null, action: 'config.apply', scope: 'ENGINE_CONNECTION', targetId: 'c1', before: null, after: { versionId: 'v1', version: 2 }, reason: '주소 https://admin:hunter2@example.com/p 반영', ip: '192.168.219.7', traceId: null, createdAt: now } as unknown as AuditLog
  const dto = auditDto(a)
  assert.equal(dto.reason, '주소 https://example.com/p 반영')
  assert.equal(dto.ip, '192.168.219.0/24')
  assert.equal(dto.versionId, 'v1')
})

test('REV-036 L1 — PRODUCTION 버전 스냅샷 원문(config.raw.read) 조회는 감사 config.raw.read(값 없음), 요약 조회·비 PRODUCTION 은 없음', () => {
  const v = { id: 'v9', environment: 'PRODUCTION' as const, scope: 'ENGINE_CONNECTION' as const, targetId: 'c1', version: 4 }
  const dev = actor('DEVELOPER', 'PRODUCTION')
  const e = versionRawReadAuditEntry(dev, v, true)
  assert.equal(e?.action, 'config.raw.read')
  assert.equal(e?.scope, 'ENGINE_CONNECTION')
  assert.deepEqual(e?.after, { detail: 'VERSION', versionId: 'v9', version: 4 })
  assert.equal(versionRawReadAuditEntry(dev, v, false), null, 'ADMIN 요약(원문 없음)은 감사 대상 아님')
  assert.equal(versionRawReadAuditEntry(dev, { ...v, environment: 'LOCAL' }, true), null)
  assert.deepEqual(versionRawReadAuditEntry(actor('SUPER_ADMIN', 'LOCAL'), v, true)?.after, { detail: 'VERSION', versionId: 'v9', version: 4, crossEnvironment: true })
})
