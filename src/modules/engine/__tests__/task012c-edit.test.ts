/**
 * task-012c 서버 2단계(engine) — 편집 키 정책(D-C4·CX-2) · Validate 규칙 16종 · Diff(무상태 summaryHash·candidateHash·verifiable·blocked) ·
 * Rollback 엄격 재검증 · 스냅샷 모양 · **런타임 실사용값 == Effective**(편집 가능 키 전부 — 콘솔 값이 실제 동작과 같다는 보장).
 * DB 가 필요한 적용·버전·감사·경합은 라이브 스모크(tests/live/task012c-smoke)에서 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { OutboundVet } from '@/modules/infra'
import { connectionKeyDefs, FALLBACK_KEY_DEFS, newFallbackIds, verifiabilityOf, type EditKeyDef } from '../configuration/keys'
import { APP_SETTING_SCHEMA, appSettingKeyDefs, PREVIEW_TEXT_KEY, PREVIEW_TEXT_VERSION_KEY, REVIEW_THRESHOLD_KEY, DEFAULT_VOICE_KEY } from '../configuration/appSettingSchema'
import { stableStringify, validatePatch, type ValidateHooks } from '../configuration/validate'
import { buildDiff, hashCandidate, isApplyBlocking } from '../configuration/diff'
import { planRestore, snapshotIntegrity } from '../configuration/rollback'
import {
  applyConnectionPatch,
  connectionFlat,
  connectionFromSnapshot,
  connectionSnapshot,
  fallbackFromSnapshot,
  fallbackSnapshot,
  snapshotMeta,
  type ConnectionManaged,
} from '../configuration/shapes'
import { emptyLayers, mergeLayers, profileLayer } from '../configuration/resolver'
import { getConfigurationSchema, pluginStates } from '../registry'
import type { SchemaKey } from '../registry/types'
import { runtimeReaders } from '../llm'
import { publicRuntimeFromValues } from '../stt'
import { requestTimeoutMs } from '../adapters/tts/styleBertHttp'
import type { ResolvedConnection } from '../router'
import { writeVersion } from '../configuration/versions'
import type { Tx } from '@/modules/infra'

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return await fn()
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

// ── 편집 키 정책(D-C4 표) ────────────────────────────────────────────────────

function combos(): { engineId: string; type: string; schema: NonNullable<ReturnType<typeof getConfigurationSchema>>; defs: EditKeyDef[] }[] {
  return pluginStates().flatMap((s) => {
    const schema = getConfigurationSchema(s.provider.descriptor.id)!
    return s.provider.descriptor.connectionTypes.map((type) => ({ engineId: s.provider.descriptor.id, type, schema, defs: connectionKeyDefs(schema, type) }))
  })
}

/** Leader 채택 D-C4 표(+ 2단계 R3·maxChars 보류). 이 목록이 넓어지면 테스트가 먼저 깨진다 — 새 편집 키는 런타임 대조(아래 READERS)와 함께 연다. */
const EDITABLE: Record<string, string[]> = {
  'claude-cli/CLI': [
    'runtime.modelByTier.fast',
    'runtime.modelByTier.balanced',
    'runtime.modelByTier.deep',
    'runtime.jsonSchemaFlag',
    'runtime.thinkingForDeep',
    'runtime.earlySentenceTts',
    'runtime.prewarm',
    'runtime.prewarmMaxIdle',
    'runtime.prewarmIdleTtlSec',
    'enabled',
  ],
  'home-m4-api/HTTP': ['runtime.model', 'enabled'],
  'sherpa-onnx-reazon/ONDEVICE': ['runtime.decodingMethod', 'runtime.vad.endpointSilenceMs', 'runtime.vad.threshold', 'runtime.partial', 'enabled'],
  'sherpa-onnx-reazon/HTTP': ['runtime.partial', 'enabled'],
  'faster-whisper/HTTP': ['enabled'],
  'faster-whisper/LOCAL': ['enabled'],
  'style-bert-vits2/HTTP': ['connection.timeoutMs', 'enabled'],
}

test('편집 가능 키 = D-C4 표(엔진 × 연결 종류) — 잠금 밖 키가 늘면 실패', () => {
  const seen: Record<string, string[]> = {}
  for (const c of combos()) seen[`${c.engineId}/${c.type}`] = c.defs.filter((d) => d.lock === null).map((d) => d.key)
  assert.deepEqual(seen, EDITABLE)
})

test('잠금 규칙 — 편집 가능 키는 RUNTIME_EDITABLE·비 SECRET·앱/클라이언트 소비·주소 비고정뿐, 잠금 순서(READ_ONLY → RESTART → CREDENTIAL → DEFERRED → SERVICE → NOT_CONSUMED → ENV_PINNED)', () => {
  for (const c of combos()) {
    const byKey = new Map<string, SchemaKey>(c.schema.keys.map((k) => [k.key, k]))
    for (const d of c.defs) {
      const tag = `${c.engineId}/${c.type} ${d.key}`
      const k = byKey.get(d.key)
      if (d.lock === null) {
        assert.equal(d.editability, 'RUNTIME_EDITABLE', tag)
        assert.notEqual(d.type, 'SECRET_REF', tag)
        assert.ok(d.consumer === 'APP' || d.consumer === 'CLIENT', tag)
        assert.ok(!k?.envPinned, tag)
        assert.ok(k?.consoleEdit !== false, tag)
        continue
      }
      if (d.editability === 'READ_ONLY') assert.equal(d.lock, 'READ_ONLY', tag)
      else if (d.editability === 'RESTART_REQUIRED' || d.editability === 'REDEPLOY_REQUIRED') assert.equal(d.lock, 'RESTART_REQUIRED', tag)
      else if (d.type === 'SECRET_REF') assert.equal(d.lock, 'CREDENTIAL_ONLY', tag)
      else if (k?.consoleEdit === false) assert.equal(d.lock, 'DEFERRED', tag)
      else if (d.consumer === 'PYTHON') assert.equal(d.lock, 'SERVICE_MANAGED', tag)
      else if (d.consumer === 'NONE') assert.equal(d.lock, 'NOT_CONSUMED', tag)
      else assert.equal(d.lock, 'ENV_PINNED', tag)
    }
    const enabled = c.defs.find((d) => d.key === 'enabled')
    assert.equal(enabled?.verify, 'SWITCH', `${c.engineId} enabled`)
  }
})

test('R3·보류 키 — TTS 엔진 파라미터(sdpRatio 류)·maxChars·home-m4 allowedTasks 는 DEFERRED, 연결 이름·주소는 편집 키가 아니다', () => {
  const byCombo = new Map(combos().map((c) => [`${c.engineId}/${c.type}`, new Map(c.defs.map((d) => [d.key, d]))]))
  const tts = byCombo.get('style-bert-vits2/HTTP')!
  for (const k of ['runtime.sdpRatio', 'runtime.noise', 'runtime.noiseW', 'runtime.maxChars']) assert.equal(tts.get(k)?.lock, 'DEFERRED', k)
  assert.equal(tts.get('runtime.maxChars')?.max, 100, 'runtimeMax 가 스키마 max 를 줄인다(서비스 상한)')
  assert.equal(tts.get('connection.baseUrl')?.lock, 'ENV_PINNED')
  assert.equal(byCombo.get('home-m4-api/HTTP')!.get('runtime.allowedTasks')?.lock, 'DEFERRED')
  for (const m of byCombo.values()) assert.ok(!m.has('name') && !m.has('connection.name'))
})

test('Fallback 편집 키 — retryOnce 는 Router 가 읽지 않아 NOT_CONSUMED, 주 연결 = CONNECTION_TEST, 예비 = FALLBACK_NEW, enabled = SWITCH', () => {
  const m = new Map(FALLBACK_KEY_DEFS.map((d) => [d.key, d]))
  assert.equal(m.get('retryOnce')?.lock, 'NOT_CONSUMED')
  assert.equal(m.get('primaryConnectionId')?.verify, 'CONNECTION_TEST')
  assert.equal(m.get('fallbackConnectionIds')?.verify, 'FALLBACK_NEW')
  assert.equal(m.get('enabled')?.verify, 'SWITCH')
})

test('AppSetting 키 — 미리듣기 문장(TTS_TEXT·100자)·기본 목소리(TTS_VOICE)·textVersion(AUTO)·재확인 임계(검증 불가 → PRODUCTION 편집 불가)·정책 키(POLICY)·모르는 키 null', () => {
  assert.deepEqual(appSettingKeyDefs(PREVIEW_TEXT_KEY)?.map((d) => [d.key, d.verify, d.maxLength, d.lock]), [['value', 'TTS_TEXT', 100, null]])
  assert.equal(appSettingKeyDefs(DEFAULT_VOICE_KEY)?.[0].verify, 'TTS_VOICE')
  assert.equal(appSettingKeyDefs(PREVIEW_TEXT_VERSION_KEY)?.[0].lock, 'AUTO')
  const th = appSettingKeyDefs(REVIEW_THRESHOLD_KEY)![0]
  assert.equal(th.verify, 'NONE')
  assert.equal(verifiabilityOf(th, null, 0.9), 'NO')
  for (const [k, d] of Object.entries(APP_SETTING_SCHEMA)) if ((d as { policy?: boolean }).policy) assert.equal(appSettingKeyDefs(k)?.[0].lock, 'POLICY', k)
  assert.equal(appSettingKeyDefs('no.such.key'), null)
})

test('verifiabilityOf — SWITCH 끄기는 불요·켜기는 실행, FALLBACK_NEW 는 새 id 가 있을 때만, NONE 은 검증 불가', () => {
  assert.equal(verifiabilityOf({ verify: 'SWITCH' }, true, false), 'NOT_NEEDED')
  assert.equal(verifiabilityOf({ verify: 'SWITCH' }, false, true), 'YES')
  assert.equal(verifiabilityOf({ verify: 'FALLBACK_NEW' }, ['a', 'b'], ['b', 'a']), 'NOT_NEEDED', '순서 변경')
  assert.equal(verifiabilityOf({ verify: 'FALLBACK_NEW' }, ['a', 'b'], ['a']), 'NOT_NEEDED', '빼기')
  assert.equal(verifiabilityOf({ verify: 'FALLBACK_NEW' }, ['a'], ['a', 'c']), 'YES')
  assert.deepEqual(newFallbackIds(['a'], ['c', 'a', 'd']), ['c', 'd'])
  assert.equal(verifiabilityOf({ verify: 'NONE' }, 1, 2), 'NO')
  assert.equal(verifiabilityOf({ verify: 'NOT_NEEDED' }, 1, 2), 'NOT_NEEDED')
  assert.equal(verifiabilityOf({ verify: 'LLM_PROBE_FAST' }, 'a', 'b'), 'YES')
})

// ── Validate 규칙 16종 ───────────────────────────────────────────────────────

const D = (key: string, type: EditKeyDef['type'], extra: Partial<EditKeyDef> = {}): EditKeyDef => ({
  key,
  type,
  default: null,
  description: 'd',
  editability: 'RUNTIME_EDITABLE',
  strict: false,
  consumer: 'APP',
  verify: 'NONE',
  lock: null,
  ...extra,
})

const DEFS: EditKeyDef[] = [
  D('a.int', 'INTEGER', { min: 1, max: 5 }),
  D('a.enum', 'ENUM', { enum: ['x', 'y'] }),
  D('a.pat', 'STRING', { pattern: '^[a-z]+$' }),
  D('a.len', 'STRING', { maxLength: 3 }),
  D('a.req', 'STRING'),
  D('a.bool', 'BOOLEAN'),
  D('a.ro', 'STRING', { lock: 'READ_ONLY' }),
  D('a.rs', 'INTEGER', { lock: 'RESTART_REQUIRED', editability: 'RESTART_REQUIRED' }),
  D('a.svc', 'STRING', { lock: 'SERVICE_MANAGED', consumer: 'PYTHON' }),
  D('a.url', 'URL'),
  D('a.sec', 'SECRET_REF', { lock: 'CREDENTIAL_ONLY', nullable: true, allowedRefs: ['env:KAIWA_T012C_REF'] }),
  D('a.env', 'BOOLEAN', { runtimeEnvWins: ['KAIWA_T012C_SHADOW'] }),
]
const STORED: Record<string, unknown> = { 'a.int': 2, 'a.enum': 'x', 'a.pat': 'abc', 'a.len': 'ab', 'a.req': 'v', 'a.bool': true, 'a.ro': 'r', 'a.rs': 1, 'a.svc': 's', 'a.url': 'http://127.0.0.1:1', 'a.sec': null, 'a.env': false }
const vetDeny = async (): Promise<OutboundVet> => ({ ok: false, reason: 'HOST_NOT_ALLOWED' }) as OutboundVet

async function ruleOf(patch: Record<string, unknown>, hooks: ValidateHooks = {}): Promise<string[]> {
  const v = await validatePatch(DEFS, STORED, patch, { vetUrl: vetDeny, envSet: () => false, ...hooks })
  return v.errors.map((e) => e.rule)
}

test('Validate — 정본 규칙 16종이 각각 해당 입력에서 나온다(바뀐 키만 검사)', async () => {
  const secretHooks: ValidateHooks = { allowLocks: ['CREDENTIAL_ONLY'], checkRefExists: true }
  const cases: [string, Record<string, unknown>, ValidateHooks?][] = [
    ['type', { 'a.bool': 'yes' }],
    ['min', { 'a.int': 0 }],
    ['max', { 'a.int': 9 }],
    ['enum', { 'a.enum': 'z' }],
    ['pattern', { 'a.pat': 'A1' }],
    ['maxLength', { 'a.len': 'abcd' }],
    ['required', { 'a.req': '' }],
    ['unknownKey', { 'a.inx': 3 }],
    ['readOnly', { 'a.ro': 'changed' }],
    ['restartRequired', { 'a.rs': 2 }],
    ['serviceManaged', { 'a.svc': 'changed' }],
    ['hostNotAllowed', { 'a.url': 'http://example.invalid/' }],
    ['secretValue', { 'a.sec': 'sk-plain-text-secret-123456' }, secretHooks],
    ['refNotAllowed', { 'a.sec': 'env:KAIWA_OTHER_REF' }, secretHooks],
    ['reference', { 'a.sec': 'env:KAIWA_T012C_REF' }, secretHooks],
  ]
  const seen = new Set<string>()
  await withEnv({ KAIWA_T012C_REF: undefined }, async () => {
    for (const [rule, patch, hooks] of cases) {
      const rules = await ruleOf(patch, hooks)
      assert.deepEqual(rules, [rule], `${rule} ← ${JSON.stringify(patch)}`)
      seen.add(rule)
    }
  })
  const dep = await validatePatch(DEFS, STORED, { 'a.int': 3 }, { envSet: () => false, dependency: async () => [{ key: 'a.int', rule: 'dependency', message: 'x' }] })
  assert.equal(dep.stage, 'DEPENDENCY')
  assert.deepEqual(dep.errors.map((e) => e.rule), ['dependency'])
  seen.add('dependency')
  assert.equal(seen.size, 16)
})

test('Validate — 같은 값은 변경 아님(잠긴 키가 그대로 있어도 통과), x- 확장 키는 경고, 모르는 키는 가까운 키 제안, 비밀 평문은 오류 어디에도 없다', async () => {
  const same = await validatePatch(DEFS, STORED, { ...STORED }, { envSet: () => false })
  assert.equal(same.valid, true)
  assert.deepEqual(same.changedKeys, [])
  const ext = await validatePatch(DEFS, STORED, { 'x-note': 'memo' }, { envSet: () => false })
  assert.equal(ext.valid, true)
  assert.equal(ext.warnings[0]?.code, 'W_EXTENSION_KEY')
  const unk = await validatePatch(DEFS, STORED, { 'a.inx': 3 }, { envSet: () => false })
  assert.equal(unk.errors[0].suggestion, 'a.int')
  const secret = 'sk-plain-text-secret-123456'
  const s = await validatePatch(DEFS, STORED, { 'a.sec': secret }, { allowLocks: ['CREDENTIAL_ONLY'] })
  assert.ok(!JSON.stringify(s).includes(secret))
  const locked = await validatePatch(DEFS, STORED, { 'a.sec': 'env:KAIWA_T012C_REF' }, { envSet: () => false })
  assert.deepEqual(locked.errors.map((e) => [e.rule, e.lock]), [['readOnly', 'CREDENTIAL_ONLY']], 'credentials.manage 없이는 CREDENTIAL_ONLY 잠금')
  const shadow = await validatePatch(DEFS, STORED, { 'a.env': true }, { envSet: (n) => n === 'KAIWA_T012C_SHADOW' })
  assert.equal(shadow.valid, true)
  assert.equal(shadow.warnings[0]?.code, 'W_SHADOWED_BY_ENVIRONMENT')
})

// ── Diff ──────────────────────────────────────────────────────────────────

const DIFF_DEFS: EditKeyDef[] = [
  D('m.model', 'STRING', { verify: 'LLM_PROBE_FAST' }),
  D('m.label', 'STRING', { verify: 'NOT_NEEDED' }),
  D('m.flag', 'BOOLEAN', { runtimeEnvWins: ['KAIWA_T012C_SHADOW'] }),
  D('m.ro', 'STRING', { lock: 'READ_ONLY' }),
  D('m.sec', 'SECRET_REF', { lock: 'CREDENTIAL_ONLY', nullable: true }),
  D('enabled', 'BOOLEAN', { verify: 'SWITCH' }),
]
const DIFF_STORED = { 'm.model': 'a', 'm.label': 'L', 'm.flag': false, 'm.ro': 'r', 'm.sec': null, enabled: true }

function diffOf(patch: Record<string, unknown>, extra: { environment?: string; baseVersion?: number; envSet?: (n: string) => boolean; allowLocks?: ('CREDENTIAL_ONLY')[] } = {}) {
  const candidate = { ...DIFF_STORED, ...patch }
  return buildDiff({
    scope: 'ENGINE_CONNECTION',
    targetId: 'c1',
    environment: extra.environment ?? 'PRODUCTION',
    baseVersion: extra.baseVersion ?? 3,
    defs: DIFF_DEFS,
    stored: DIFF_STORED,
    candidate,
    changedKeys: Object.keys(patch),
    envSet: extra.envSet ?? (() => false),
    allowLocks: extra.allowLocks,
  })
}

test('Diff — summaryHash 는 baseVersion·후보에 묶이고(무상태 재계산 대조), candidateHash 는 baseVersion 과 무관·키 순서 무관', () => {
  const a = diffOf({ 'm.model': 'b' })
  assert.equal(diffOf({ 'm.model': 'b' }).summaryHash, a.summaryHash, '같은 입력 = 같은 해시')
  assert.notEqual(diffOf({ 'm.model': 'b' }, { baseVersion: 4 }).summaryHash, a.summaryHash, '그 사이 다른 적용 → 불일치')
  assert.equal(diffOf({ 'm.model': 'b' }, { baseVersion: 4 }).candidateHash, a.candidateHash)
  assert.notEqual(diffOf({ 'm.model': 'c' }).summaryHash, a.summaryHash)
  const reordered = Object.fromEntries(Object.entries({ ...DIFF_STORED, 'm.model': 'b' }).reverse())
  assert.equal(hashCandidate('ENGINE_CONNECTION', 'c1', 'PRODUCTION', reordered), a.candidateHash)
  assert.notEqual(hashCandidate('ENGINE_CONNECTION', 'c1', 'LOCAL', reordered), a.candidateHash, '환경이 다르면 다른 후보')
})

test('Diff — testRequired 는 PRODUCTION 이고 NOT_NEEDED 아닌 변경이 있을 때만(표시 전용·끄기는 테스트 면제)', () => {
  assert.equal(diffOf({ 'm.model': 'b' }).testRequired, true)
  assert.equal(diffOf({ 'm.label': 'M' }).testRequired, false, '표시 전용 NOT_NEEDED')
  assert.equal(diffOf({ enabled: false }).testRequired, false, '끄기')
  assert.equal(diffOf({ enabled: false, 'm.model': 'b' }).testRequired, true)
  assert.equal(diffOf({ 'm.model': 'b' }, { environment: 'LOCAL' }).testRequired, false)
  const d = diffOf({ 'm.label': 'M', 'm.model': 'b' })
  assert.deepEqual(d.changes.map((c) => [c.key, c.verifiable]), [['m.label', 'NOT_NEEDED'], ['m.model', 'YES']])
  assert.equal(d.productionProtected, true)
  assert.equal(d.requiredConfirm, 'SUPER_ADMIN')
})

test('Diff — blocked: 잠금은 적용 차단, env 우선은 경고(SHADOWED — 저장은 되나 효력 없음), CREDENTIAL_ONLY 는 풀린 호출에서만 통과, 비밀 평문은 SECRET_VALUE_IN_PAYLOAD', () => {
  const ro = diffOf({ 'm.ro': 'x' })
  assert.equal(ro.changes[0].blocked?.code, 'READ_ONLY')
  assert.equal(isApplyBlocking(ro.changes[0].blocked), true)
  const sh = diffOf({ 'm.flag': true }, { envSet: (n) => n === 'KAIWA_T012C_SHADOW' })
  assert.equal(sh.changes[0].blocked?.code, 'SHADOWED_BY_ENVIRONMENT')
  assert.equal(sh.changes[0].afterSource, 'ENVIRONMENT')
  assert.equal(isApplyBlocking(sh.changes[0].blocked), false)
  assert.equal(sh.summary.shadowed, 1)
  assert.equal(diffOf({ 'm.sec': 'env:KAIWA_T012C_REF' }).changes[0].blocked?.code, 'READ_ONLY')
  assert.equal(diffOf({ 'm.sec': 'env:KAIWA_T012C_REF' }, { allowLocks: ['CREDENTIAL_ONLY'] }).changes[0].blocked, null)
  const plain = diffOf({ 'm.sec': 'sk-plain-text-secret-123456' }, { allowLocks: ['CREDENTIAL_ONLY'] })
  assert.equal(plain.changes[0].blocked?.code, 'SECRET_VALUE_IN_PAYLOAD')
  assert.equal(plain.summary.secretTouched, true)
})

test('Diff — 저장값에 없던 키는 ADDED(출처 DEFAULT), 행은 바뀐 키만', () => {
  const d = buildDiff({ scope: 'APP_SETTING', targetId: 'k', environment: 'LOCAL', baseVersion: 0, defs: [D('value', 'STRING', { verify: 'TTS_TEXT' })], stored: {}, candidate: { value: 'x' }, changedKeys: ['value'], envSet: () => false })
  assert.equal(d.changes[0].changeType, 'ADDED')
  assert.equal(d.changes[0].beforeSource, 'DEFAULT')
  assert.equal(d.changes[0].storedBefore, null)
  assert.equal(diffOf({ 'm.model': 'b' }).changes.length, 1)
})

// ── Rollback 재검증 · 스냅샷 모양 ─────────────────────────────────────────────

test('planRestore — 바뀌는 키만 patch, 지금 스키마에 없는 키는 droppedKeys(같은 값이면 제외), 스냅샷에 없는 새 키는 지금 값 유지', async () => {
  const cur = { 'a.int': 2, 'a.enum': 'x', 'a.bool': true, 'gone.same': 7 }
  const plan = await planRestore(DEFS, cur, { 'a.int': 4, 'a.enum': 'x', 'gone.key': 1, 'gone.same': 7 }, { envSet: () => false })
  assert.equal(plan.integrity, 'OK')
  assert.deepEqual(plan.changedKeys, ['a.int'])
  assert.deepEqual(plan.droppedKeys, ['gone.key'])
  assert.equal(plan.candidate['a.bool'], true, '스냅샷에 없는 키는 지금 값')
})

test('planRestore — 같은 스키마 버전 스냅샷에 없던 키(= 그때 기본값)는 기본값으로 되돌린다, 둘 다 없으면 변화 없음, 다른 스키마 버전이면 지금 값 유지', async () => {
  const defs = [D('r.ttl', 'INTEGER', { min: 60, max: 3600, default: 600 }), D('r.idle', 'INTEGER', { min: 0, max: 4, default: 2 }), D('r.ro', 'INTEGER', { lock: 'READ_ONLY', default: 1 })]
  const cur = { 'r.ttl': 900 }
  const same = await planRestore(defs, cur, {}, { envSet: () => false }, { absentAsDefault: true })
  assert.equal(same.integrity, 'OK')
  assert.deepEqual(same.changedKeys, ['r.ttl'])
  assert.equal(same.candidate['r.ttl'], 600)
  assert.ok(!('r.idle' in same.candidate), '행에도 없던 키는 건드리지 않는다')
  const older = await planRestore(defs, cur, {}, { envSet: () => false })
  assert.deepEqual(older.changedKeys, [], '스키마 버전이 다르면(새 키일 수 있다) 지금 값 유지')
  const locked = await planRestore(defs, { 'r.ro': 5 }, {}, { envSet: () => false }, { absentAsDefault: true })
  assert.deepEqual(locked.issues.map((i) => i.rule), ['readOnly'], '잠긴 키가 기본값으로 바뀌는 되돌리기도 엄격 재검증')
})

test('스냅샷 무결성 — 어댑터 스키마 기본값 행(모든 엔진 × 연결 종류)은 지금 규칙으로 OK, 기본값이 빈 문자열인 키는 빈 값 허용', () => {
  for (const c of combos()) {
    const r = snapshotIntegrity({ ok: true }, c.defs, connectionFlat(seedManaged(c.schema, c.type)))
    assert.equal(r.integrity, 'OK', `${c.engineId}/${c.type} ${JSON.stringify(r.issues.map((i) => `${i.key}:${i.rule}`))}`)
  }
  assert.equal(snapshotIntegrity({ ok: true }, [D('t', 'STRING', { default: '' })], { t: '' }).integrity, 'OK')
  assert.equal(snapshotIntegrity({ ok: true }, [D('t', 'STRING', { default: 'x' })], { t: '' }).issues[0]?.rule, 'required')
})

test('planRestore — 지금 규칙 위반(범위·비밀 평문·잠긴 키 값 차이)은 INVALID_ENTRIES(조용히 버리지 않는다)', async () => {
  const out = await planRestore(DEFS, STORED, { 'a.int': 99 }, { envSet: () => false })
  assert.equal(out.integrity, 'INVALID_ENTRIES')
  assert.deepEqual(out.issues.map((i) => i.rule), ['max'])
  const sec = await planRestore(DEFS, STORED, { 'a.sec': 'sk-plain-text-secret-123456' }, { allowLocks: ['CREDENTIAL_ONLY'], envSet: () => false })
  assert.equal(sec.integrity, 'INVALID_ENTRIES')
  assert.ok(sec.issues.some((i) => i.rule === 'secretValue'))
  assert.ok(!JSON.stringify(sec.issues).includes('sk-plain'))
  const ro = await planRestore(DEFS, STORED, { 'a.ro': 'old' }, { envSet: () => false })
  assert.deepEqual(ro.issues.map((i) => i.rule), ['readOnly'])
  assert.deepEqual(snapshotIntegrity({ ok: false }, DEFS, null), { integrity: 'MALFORMED', issues: [] })
  assert.equal(snapshotIntegrity({ ok: true }, DEFS, { 'a.int': 3 }).integrity, 'OK')
  assert.equal(snapshotIntegrity({ ok: true }, DEFS, { 'a.int': 'x' }).integrity, 'INVALID_ENTRIES')
})

test('스냅샷 모양 — 연결: 평면↔관리 값 왕복·원본 불변·`_meta` 는 값이 아니다 / Fallback·손상 스냅샷은 MALFORMED', () => {
  const m: ConnectionManaged = { connection: { baseUrl: 'http://127.0.0.1:1', credentialRef: 'ignored' }, runtime: { model: 'a', vad: { threshold: 0.5 } }, credentialRef: 'env:X', logLevel: 'INFO', enabled: true }
  const flat = connectionFlat(m)
  assert.equal(flat['connection.credentialRef'], 'env:X', 'credentialRef 칸이 이긴다')
  assert.equal(flat['runtime.vad.threshold'], 0.5)
  const next = applyConnectionPatch(m, { 'runtime.vad.threshold': 0.7, enabled: false })
  assert.equal((m.runtime.vad as Record<string, unknown>).threshold, 0.5, '원본 불변')
  assert.equal(connectionFlat(next)['runtime.vad.threshold'], 0.7)
  const snap = connectionSnapshot(next, { schemaVersion: 1, origin: 'APPLY' })
  const back = connectionFromSnapshot(snap)
  assert.ok(back.ok)
  if (back.ok) {
    assert.equal(stableStringify(connectionFlat(back.value)), stableStringify(connectionFlat(next)))
    assert.deepEqual(back.meta, { schemaVersion: 1, origin: 'APPLY' })
    assert.ok(!Object.keys(connectionFlat(back.value)).some((k) => k.includes('_meta')))
  }
  assert.equal(connectionFromSnapshot({ connection: {}, runtime: [] }).ok, false)
  assert.equal(connectionFromSnapshot('x').ok, false)
  const fb = fallbackFromSnapshot(fallbackSnapshot({ primaryConnectionId: 'p', fallbackConnectionIds: ['f'], retryOnce: true, enabled: true }, { schemaVersion: 1, origin: 'ROLLBACK' }))
  assert.ok(fb.ok && fb.meta?.origin === 'ROLLBACK')
  assert.equal(fallbackFromSnapshot({ primaryConnectionId: 'p', fallbackConnectionIds: [1], retryOnce: true, enabled: true }).ok, false)
  assert.equal(snapshotMeta({ _meta: { origin: 'NOPE' } }), null)
})

// ── 런타임 실사용값 == Effective(편집 가능 키 전부) ─────────────────────────────

type Reader = (c: ResolvedConnection, values: Record<string, unknown>) => unknown
const READERS: Record<string, Record<string, Reader>> = {
  'claude-cli/CLI': {
    'runtime.modelByTier.fast': (c) => runtimeReaders.model(c, 'fast'),
    'runtime.modelByTier.balanced': (c) => runtimeReaders.model(c, 'balanced'),
    'runtime.modelByTier.deep': (c) => runtimeReaders.model(c, 'deep'),
    'runtime.jsonSchemaFlag': (c) => runtimeReaders.jsonSchemaFlag(c),
    'runtime.thinkingForDeep': (c) => runtimeReaders.thinking(c),
    'runtime.earlySentenceTts': (c) => runtimeReaders.earlySentence(c),
    'runtime.prewarm': (c) => runtimeReaders.prewarm(c),
    'runtime.prewarmMaxIdle': (c) => runtimeReaders.prewarmMaxIdle(c),
    'runtime.prewarmIdleTtlSec': (c) => runtimeReaders.prewarmIdleTtlSec(c),
  },
  'home-m4-api/HTTP': { 'runtime.model': (c) => runtimeReaders.model(c, 'fast') },
  'sherpa-onnx-reazon/ONDEVICE': {
    'runtime.decodingMethod': (_c, v) => publicRuntimeFromValues(v).decodingMethod,
    'runtime.vad.endpointSilenceMs': (_c, v) => publicRuntimeFromValues(v).vadSilenceMs,
    'runtime.vad.threshold': (_c, v) => publicRuntimeFromValues(v).vadThreshold,
    'runtime.partial': (_c, v) => publicRuntimeFromValues(v).partial,
  },
  'sherpa-onnx-reazon/HTTP': { 'runtime.partial': (_c, v) => publicRuntimeFromValues(v).partial },
  'faster-whisper/HTTP': {},
  'faster-whisper/LOCAL': {},
  'style-bert-vits2/HTTP': { 'connection.timeoutMs': (_c, v) => requestTimeoutMs(v, 600_000) },
}
/** 행에 값이 없으면 호출이 실패한다(설정 누락이 조용히 다른 모델로 가지 않게 — seed 가 항상 싣는다). */
const NO_RUNTIME_DEFAULT = new Set(['runtime.modelByTier.fast', 'runtime.modelByTier.balanced', 'runtime.modelByTier.deep', 'runtime.model'])

function samples(d: EditKeyDef): unknown[] {
  if (d.type === 'BOOLEAN') return [true, false]
  if (d.type === 'ENUM') return [...(d.enum ?? [])]
  if (d.type === 'INTEGER') return [d.min!, d.max!, Math.round((d.min! + d.max!) / 2)]
  if (d.type === 'NUMBER') return [d.min!, d.max!, Number(((d.min! + d.max!) / 2).toFixed(2))]
  if (d.type === 'STRING') return ['model-a1', 'sonnet']
  throw new Error(`표본 없음 ${d.key}`)
}

function seedManaged(schema: { keys: SchemaKey[] }, type: string): ConnectionManaged {
  const patch: Record<string, unknown> = {}
  for (const k of schema.keys) {
    if (k.appliesTo && !k.appliesTo.includes(type as never)) continue
    if (k.key === 'connection.credentialRef' || k.key === 'logging.level') continue
    patch[k.key] = k.default
  }
  return applyConnectionPatch({ connection: {}, runtime: {}, credentialRef: null, logLevel: 'INFO', enabled: true }, patch)
}

/** 적용 뒤 Effective — DATABASE(새 ACTIVE 스냅샷)·CONNECTION_PROFILE(물화된 행)이 둘 다 후보 값(resolver 의 candidate 경로와 같은 층 구성). */
function effectiveAfter(schema: { keys: SchemaKey[] }, type: string, m: ConnectionManaged): Record<string, unknown> {
  const layers = emptyLayers()
  for (const k of schema.keys) layers.DEFAULT.set(k.key, { value: k.default, sourceRef: '' })
  const row = { id: 'c1', connection: m.connection, runtime: m.runtime, credentialRef: m.credentialRef, logLevel: m.logLevel } as Parameters<typeof profileLayer>[0]
  layers.DATABASE = profileLayer(row, [], true)
  layers.CONNECTION_PROFILE = profileLayer(row, [], true)
  return Object.fromEntries(mergeLayers(schema.keys, type, layers).keys.map((k) => [k.key, k.value]))
}

function resolved(engineId: string, type: string, m: ConnectionManaged): ResolvedConnection {
  return { id: 'c1', key: 'k', engineId, connectionType: type, connection: m.connection, runtime: m.runtime, credentialRef: m.credentialRef }
}

function deletePath(m: ConnectionManaged, key: string): ConnectionManaged {
  const next = applyConnectionPatch(m, {})
  const [head, ...rest] = key.split('.')
  let cur = (head === 'connection' ? next.connection : next.runtime) as Record<string, unknown>
  for (const seg of rest.slice(0, -1)) cur = cur[seg] as Record<string, unknown>
  delete cur[rest.at(-1)!]
  return next
}

test('런타임 실사용값 == Effective — 편집 가능 키 전부(표본 값마다 콘솔 값이 실제 호출·클라이언트 설정에 그대로 쓰인다)', async () => {
  await withEnv({ KAIWA_LLM_JSON_SCHEMA_FLAG: undefined }, async () => {
    let checked = 0
    for (const c of combos()) {
      const combo = `${c.engineId}/${c.type}`
      const readers = READERS[combo]
      assert.ok(readers, `${combo} 대조표 없음`)
      const editable = c.defs.filter((d) => d.lock === null && d.key !== 'enabled')
      assert.deepEqual(editable.map((d) => d.key).sort(), Object.keys(readers).sort(), `${combo} — 편집 가능 키마다 런타임 대조가 있어야 한다`)
      const base = seedManaged(c.schema, c.type)
      for (const def of editable) {
        for (const v of samples(def)) {
          const val = await validatePatch(c.defs, connectionFlat(base), { [def.key]: v }, { envSet: () => false, vetUrl: async () => ({ ok: true }) as OutboundVet })
          assert.equal(val.valid, true, `${combo} ${def.key}=${String(v)} 은 콘솔에서 허용되는 값`)
          const m = applyConnectionPatch(base, { [def.key]: v })
          const eff = effectiveAfter(c.schema, c.type, m)
          assert.deepEqual(eff[def.key], v, `${combo} ${def.key} Effective`)
          assert.deepEqual(readers[def.key](resolved(c.engineId, c.type, m), eff), eff[def.key], `${combo} ${def.key}=${String(v)} 런타임 == Effective`)
          checked++
        }
        if (NO_RUNTIME_DEFAULT.has(def.key)) continue
        const without = deletePath(base, def.key)
        const eff = effectiveAfter(c.schema, c.type, without)
        assert.deepEqual(readers[def.key](resolved(c.engineId, c.type, without), eff), eff[def.key], `${combo} ${def.key} 행에 값이 없을 때 = 스키마 기본값`)
      }
    }
    assert.ok(checked >= 30, `대조 수 ${checked}`)
  })
})

test('런타임 실사용값 — 모델 키는 행에 값이 없으면 호출 실패(기본 모델로 조용히 가지 않는다), env 우선 키는 Diff·정책이 SHADOWED 로 드러낸다', async () => {
  const combo = combos().find((c) => c.engineId === 'claude-cli')!
  const base = seedManaged(combo.schema, combo.type)
  assert.throws(() => runtimeReaders.model(resolved('claude-cli', 'CLI', deletePath(base, 'runtime.modelByTier.balanced')), 'balanced'))
  const def = combo.defs.find((d) => d.key === 'runtime.jsonSchemaFlag')!
  assert.deepEqual(def.runtimeEnvWins, ['KAIWA_LLM_JSON_SCHEMA_FLAG'])
  await withEnv({ KAIWA_LLM_JSON_SCHEMA_FLAG: '1' }, async () => {
    const m = applyConnectionPatch(base, { 'runtime.jsonSchemaFlag': false })
    assert.equal(runtimeReaders.jsonSchemaFlag(resolved('claude-cli', 'CLI', m)), true, 'env 가 이긴다')
    const v = await validatePatch(combo.defs, connectionFlat(base), { 'runtime.jsonSchemaFlag': true })
    assert.ok(v.warnings.some((w) => w.code === 'W_SHADOWED_BY_ENVIRONMENT'))
    const d = buildDiff({ scope: 'ENGINE_CONNECTION', targetId: 'c1', environment: 'LOCAL', baseVersion: 0, defs: combo.defs, stored: connectionFlat(base), candidate: { ...connectionFlat(base), 'runtime.jsonSchemaFlag': true }, changedKeys: ['runtime.jsonSchemaFlag'] })
    assert.equal(d.changes[0].blocked?.code, 'SHADOWED_BY_ENVIRONMENT')
  })
})

test('TTS 요청 제한 시간 = min(호출자 예산, 연결 값) — 문장 경로(8s)보다 큰 값은 상한으로만 남는다', () => {
  assert.equal(requestTimeoutMs({ 'connection.timeoutMs': 5_000 }, 8_000), 5_000)
  assert.equal(requestTimeoutMs({ 'connection.timeoutMs': 20_000 }, 8_000), 8_000)
  assert.equal(requestTimeoutMs({}, 8_000), 8_000)
})

test('writeVersion — ConfigurationVersion.reason 도 저장 직전 maskText(Codex C2 ①), 평범한 이유는 그대로', async () => {
  const saved: Record<string, unknown>[] = []
  const tx = {
    configurationVersion: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      aggregate: async () => ({ _max: { version: 2 } }),
      create: async (args: { data: Record<string, unknown> }) => (saved.push(args.data), { ...args.data, id: `v${saved.length}` }),
    },
  } as unknown as Tx
  const t = { environment: 'LOCAL' as const, scope: 'ENGINE_CONNECTION' as const, targetId: 'c1' }
  const input = { snapshot: {}, diff: null, actorUserId: 'u1', testResult: null, restoredFromVersion: null, replacedStatus: 'SUPERSEDED' as const }
  await writeVersion(tx, t, { ...input, reason: '키 교체 pk-live1234567890ab 반영' })
  await writeVersion(tx, t, { ...input, reason: '発音が不自然なので例文を差し替えます。' })
  assert.equal(saved[0].reason, '키 교체 *** 반영')
  assert.equal(saved[1].reason, '発音が不自然なので例文を差し替えます。')
  assert.equal(saved[0].version, 3)
})
