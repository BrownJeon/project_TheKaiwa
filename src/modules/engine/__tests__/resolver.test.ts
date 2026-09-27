/**
 * 8층 Resolver 순수 부분(mergeLayers·environmentLayer·profileLayer) + Provider 레지스트리·seed 정합.
 * DB 가 필요한 resolveEffective 는 라이브 스모크(tests/live/task005b-smoke)에서 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { emptyLayers, environmentLayer, mergeLayers, parseEnvValue, profileLayer } from '../configuration/resolver'
import { key } from '../adapters/common/schema'
import { healthUrl } from '../adapters/common/httpHealth'
import { getProvider, pluginStates, selfCheckSchema } from '../registry'
import type { SchemaKey } from '../registry/types'

const KEYS: SchemaKey[] = [
  key('connection.baseUrl', 'URL', 'http://127.0.0.1:8090', { envAlias: ['WHISPER_SERVICE_URL'], description: 'd' }),
  key('connection.binPath', 'PATH', 'claude', { editability: 'RESTART_REQUIRED', envAlias: ['CLAUDE_CLI_PATH'], description: 'd' }),
  key('connection.timeoutMs', 'INTEGER', 60000, { min: 5000, max: 180000, description: 'd' }),
  key('connection.credentialRef', 'SECRET_REF', null, { envSecretAlias: ['AI_API_KEY'], description: 'd' }),
  key('runtime.permissionMode', 'ENUM', 'dontAsk', { enum: ['dontAsk'], editability: 'READ_ONLY', description: 'd' }),
  key('runtime.cpuThreads', 'INTEGER', 4, { min: 1, max: 16, editability: 'RESTART_REQUIRED', envAlias: ['SPEECH_THREADS'], description: 'd' }),
  key('runtime.label', 'STRING', 'x', { description: 'd' }),
  key('runtime.onDeviceOnly', 'BOOLEAN', true, { appliesTo: ['ONDEVICE'], description: 'd' }),
]
const set = (layers: ReturnType<typeof emptyLayers>, src: keyof typeof layers, k: string, value: unknown, ref = `${src}:${k}`) => layers[src].set(k, { value, sourceRef: ref })
const pick = (r: ReturnType<typeof mergeLayers>, k: string) => r.keys.find((x) => x.key === k)!

function base() {
  const layers = emptyLayers()
  for (const k of KEYS) set(layers, 'DEFAULT', k.key, k.default)
  return layers
}

test('DEFAULT 만 있는 키는 source=DEFAULT, 모든 적용 키가 결과에 있다(appliesTo 밖은 빠진다)', () => {
  const r = mergeLayers(KEYS, 'HTTP', base())
  assert.equal(pick(r, 'connection.timeoutMs').source, 'DEFAULT')
  assert.equal(r.keys.length, KEYS.length - 1)
  assert.equal(r.keys.find((k) => k.key === 'runtime.onDeviceOnly'), undefined)
})

test('§12-1 threads: APPLICATION_CONFIG 8 을 ENVIRONMENT 4 가 덮고 shadowed, layers 는 낮은→높은 순', () => {
  const l = base()
  set(l, 'APPLICATION_CONFIG', 'runtime.cpuThreads', 8)
  set(l, 'ENVIRONMENT', 'runtime.cpuThreads', 4, 'env:SPEECH_THREADS')
  const k = pick(mergeLayers(KEYS, 'HTTP', l), 'runtime.cpuThreads')
  assert.equal(k.value, 4)
  assert.equal(k.source, 'ENVIRONMENT')
  assert.equal(k.sourceRef, 'env:SPEECH_THREADS')
  assert.equal(k.shadowed, true)
  assert.deepEqual(k.layers.map((x) => x.source), ['DEFAULT', 'APPLICATION_CONFIG', 'ENVIRONMENT'])
})

test('CONNECTION_PROFILE 은 ENVIRONMENT 를 덮는다(DB 가 env 를 덮음), RUNTIME_OVERRIDE 는 RUNTIME_EDITABLE 만', () => {
  const l = base()
  set(l, 'ENVIRONMENT', 'connection.baseUrl', 'http://env:1')
  set(l, 'CONNECTION_PROFILE', 'connection.baseUrl', 'http://db:2')
  set(l, 'RUNTIME_OVERRIDE', 'connection.timeoutMs', 45000)
  set(l, 'RUNTIME_OVERRIDE', 'runtime.cpuThreads', 16)
  const r = mergeLayers(KEYS, 'HTTP', l)
  assert.equal(pick(r, 'connection.baseUrl').source, 'CONNECTION_PROFILE')
  assert.equal(pick(r, 'connection.baseUrl').shadowed, true)
  // 기본값만 덮은 키는 shadowed 가 아니다
  assert.equal(pick(r, 'connection.timeoutMs').shadowed, false)
  assert.equal(pick(r, 'connection.timeoutMs').source, 'RUNTIME_OVERRIDE')
  const threads = pick(r, 'runtime.cpuThreads')
  assert.equal(threads.source, 'DEFAULT')
  assert.ok(threads.warnings.includes('W_IGNORED_RUNTIME_OVERRIDE'))
})

test('READ_ONLY 키는 1~4 층만 — DB 에 있으면 무시 + 경고, SOURCE_CODE 가 이긴다', () => {
  const l = base()
  set(l, 'SOURCE_CODE', 'runtime.permissionMode', 'dontAsk', 'code:x#y')
  set(l, 'CONNECTION_PROFILE', 'runtime.permissionMode', 'bypassPermissions')
  const k = pick(mergeLayers(KEYS, 'CLI', l), 'runtime.permissionMode')
  assert.equal(k.value, 'dontAsk')
  assert.equal(k.source, 'SOURCE_CODE')
  assert.ok(k.warnings.includes('W_IGNORED_CONNECTION_PROFILE'))
})

test('SECRET_REF 에 평문이 오면 값을 버리고 E_CONN_SECRET_VALUE — 결과 어디에도 평문이 없다', () => {
  const l = base()
  const plain = 'sk-live-THIS-IS-A-PLAIN-SECRET-123456'
  set(l, 'CONNECTION_PROFILE', 'connection.credentialRef', plain)
  const r = mergeLayers(KEYS, 'HTTP', l)
  const k = pick(r, 'connection.credentialRef')
  assert.equal(k.value, null)
  assert.ok(k.warnings.some((w) => w.startsWith('E_CONN_SECRET_VALUE')))
  assert.ok(!JSON.stringify(r).includes(plain))
  // ref 형식은 통과
  set(l, 'CONNECTION_PROFILE', 'connection.credentialRef', 'file:home-m4-api-key')
  assert.equal(pick(mergeLayers(KEYS, 'HTTP', l), 'connection.credentialRef').value, 'file:home-m4-api-key')
})

test('"$NAME" 자리표시자: envAlias 이름이면 그 층을 건너뛰어 ENVIRONMENT 가 드러난다, 아니면 해석하지 않는다', () => {
  const l = base()
  set(l, 'ENVIRONMENT', 'connection.binPath', 'claude', 'env:CLAUDE_CLI_PATH')
  set(l, 'CONNECTION_PROFILE', 'connection.binPath', '$CLAUDE_CLI_PATH')
  const k = pick(mergeLayers(KEYS, 'CLI', l), 'connection.binPath')
  assert.equal(k.source, 'ENVIRONMENT')
  assert.equal(k.sourceRef, 'env:CLAUDE_CLI_PATH')
  assert.ok(k.warnings.some((w) => w.startsWith('I_ENV_PLACEHOLDER')))
  // 스키마에 없는 env 이름은 값으로 풀지 않는다(관리자 편집 JSON 으로 임의 env 를 읽는 경로 차단)
  const l2 = base()
  set(l2, 'CONNECTION_PROFILE', 'runtime.label', '$JWT_SECRET')
  const k2 = pick(mergeLayers(KEYS, 'CLI', l2), 'runtime.label')
  assert.equal(k2.value, '$JWT_SECRET')
  assert.ok(k2.warnings.some((w) => w.startsWith('W_UNRESOLVED_PLACEHOLDER')))
})

test('스키마 밖 키·적용 대상 아닌 키는 무시하고 상위 경고로', () => {
  const l = base()
  set(l, 'CONNECTION_PROFILE', 'runtime.unknownThing', 1)
  set(l, 'CONNECTION_PROFILE', 'runtime.onDeviceOnly', false)
  const r = mergeLayers(KEYS, 'HTTP', l)
  assert.ok(r.warnings.includes('W_UNKNOWN_KEY(runtime.unknownThing@CONNECTION_PROFILE)'))
  assert.ok(r.warnings.includes('W_NOT_APPLICABLE(runtime.onDeviceOnly@CONNECTION_PROFILE)'))
})

test('검증 위반은 값을 고치지 않고 경고만(E_RANGE·E_TYPE)', () => {
  const l = base()
  set(l, 'CONNECTION_PROFILE', 'connection.timeoutMs', 999999)
  set(l, 'CONNECTION_PROFILE', 'runtime.label', 3)
  const r = mergeLayers(KEYS, 'HTTP', l)
  assert.equal(pick(r, 'connection.timeoutMs').value, 999999)
  assert.ok(pick(r, 'connection.timeoutMs').warnings.includes('E_RANGE'))
  assert.ok(pick(r, 'runtime.label').warnings.includes('E_TYPE'))
})

test('ENVIRONMENT 층: KAIWA_CONN_* > KAIWA_<ROLE>_*(primary 만) > 별칭, 시크릿 별칭은 값 대신 ref', () => {
  const env = {
    KAIWA_CONN_WHISPER_VOICEVAULT_CONNECTION_TIMEOUTMS: '30000',
    KAIWA_ANALYSIS_STT_CONNECTION_TIMEOUTMS: '40000',
    KAIWA_ANALYSIS_STT_RUNTIME_CPUTHREADS: '6',
    SPEECH_THREADS: '8',
    WHISPER_SERVICE_URL: 'http://127.0.0.1:9999',
    AI_API_KEY: 'sk-should-never-appear-0000000000000000',
    KAIWA_CONN_WHISPER_VOICEVAULT_RUNTIME_LABEL: '',
  } as unknown as NodeJS.ProcessEnv
  const w = new Map<string, string[]>()
  const primary = environmentLayer(KEYS, { connectionKey: 'whisper-voicevault', role: 'ANALYSIS_STT', isRolePrimary: true }, env, w)
  assert.deepEqual(primary.get('connection.timeoutMs'), { value: 30000, sourceRef: 'env:KAIWA_CONN_WHISPER_VOICEVAULT_CONNECTION_TIMEOUTMS' })
  assert.deepEqual(primary.get('runtime.cpuThreads'), { value: 6, sourceRef: 'env:KAIWA_ANALYSIS_STT_RUNTIME_CPUTHREADS' })
  assert.deepEqual(primary.get('connection.baseUrl'), { value: 'http://127.0.0.1:9999', sourceRef: 'env:WHISPER_SERVICE_URL' })
  assert.deepEqual(primary.get('connection.credentialRef'), { value: 'env:AI_API_KEY', sourceRef: 'env:AI_API_KEY' })
  assert.ok(!JSON.stringify([...primary.values()]).includes('sk-should-never-appear'))
  assert.equal(primary.has('runtime.label'), false)
  // primary 가 아니면 KAIWA_<ROLE>_* 는 적용되지 않고 별칭으로 떨어진다
  const other = environmentLayer(KEYS, { connectionKey: 'whisper-local', role: 'ANALYSIS_STT', isRolePrimary: false }, env, new Map())
  assert.deepEqual(other.get('runtime.cpuThreads'), { value: 8, sourceRef: 'env:SPEECH_THREADS' })
})

test('ENVIRONMENT 파싱 실패는 버리고 경고(이름만), SECRET_REF env 값이 ref 가 아니면 버린다', () => {
  const w = new Map<string, string[]>()
  const env = { SPEECH_THREADS: 'eight', KAIWA_CONN_X_CONNECTION_CREDENTIALREF: 'plain-secret-value' } as unknown as NodeJS.ProcessEnv
  const l = environmentLayer(KEYS, { connectionKey: 'x', role: 'LLM', isRolePrimary: false }, env, w)
  assert.equal(l.has('runtime.cpuThreads'), false)
  assert.deepEqual(w.get('runtime.cpuThreads'), ['E_ENV_PARSE(SPEECH_THREADS)'])
  assert.equal(l.has('connection.credentialRef'), false)
  assert.ok(!JSON.stringify([...w.values()]).includes('plain-secret-value'))
  assert.deepEqual(parseEnvValue(KEYS[2], ' 1200 '), { ok: true, value: 1200 })
})

test('profileLayer: 중첩 JSON 을 점 표기로, credentialRef null 은 명시값, 이상한 세그먼트는 버린다', () => {
  const warnings: string[] = []
  const l = profileLayer({ id: 'ec1', connection: { baseUrl: 'http://a', 'bad key': 1 }, runtime: { vad: { endpointSilenceMs: 500 }, allowedTasks: ['a'] }, credentialRef: null, logLevel: 'INFO' }, warnings)
  assert.deepEqual(l.get('runtime.vad.endpointSilenceMs'), { value: 500, sourceRef: 'db:EngineConnection[ec1].runtime.vad.endpointSilenceMs' })
  assert.deepEqual(l.get('runtime.allowedTasks')?.value, ['a'])
  assert.deepEqual(l.get('connection.credentialRef'), { value: null, sourceRef: 'db:EngineConnection[ec1].credentialRef' })
  assert.equal(l.get('logging.level')?.value, 'INFO')
  assert.ok(warnings.includes('W_BAD_KEY_SEGMENT'))
})

test('Provider 전부 스키마 자체 검증 통과(loaded, initError 없음)', () => {
  for (const s of pluginStates()) {
    assert.equal(s.initError, null, s.provider.descriptor.id)
    assert.equal(s.loaded, true)
    assert.deepEqual(selfCheckSchema(s.provider.configurationSchema(), s.provider.descriptor.id), [])
  }
})

test('seed(engines.json) 의 엔진·연결이 코드 Provider 와 맞는다(역할·연결 유형)', () => {
  const seed = JSON.parse(readFileSync(join(process.cwd(), 'prisma/seed-data/engines.json'), 'utf8')) as {
    engines: { id: string; type: string; roles: string[]; connectionTypes: string[] }[]
    connections: { key: string; engineId: string; role: string; connectionType: string; connection: Record<string, unknown>; runtime: Record<string, unknown> }[]
  }
  for (const e of seed.engines) {
    const p = getProvider(e.id)
    assert.ok(p, `provider ${e.id}`)
    assert.equal(p!.descriptor.type, e.type)
    assert.deepEqual([...p!.descriptor.roles].sort(), [...e.roles].sort())
    assert.deepEqual([...p!.descriptor.connectionTypes].sort(), [...e.connectionTypes].sort())
  }
  for (const c of seed.connections) {
    const p = getProvider(c.engineId)!
    assert.ok(p.descriptor.roles.includes(c.role as never), c.key)
    assert.ok(p.descriptor.connectionTypes.includes(c.connectionType as never), c.key)
    // seed 저장값 키가 전부 스키마에 있다(Effective 에 W_UNKNOWN_KEY 가 없게)
    const keys = p.configurationSchema().keys
    const l = profileLayer({ id: c.key, connection: c.connection as never, runtime: c.runtime as never, credentialRef: null, logLevel: 'INFO' }, [], keys.some((k) => k.key === 'connection.credentialRef'))
    const r = mergeLayers(keys, c.connectionType, (() => {
      const layers = emptyLayers()
      layers.CONNECTION_PROFILE = l
      return layers
    })())
    assert.deepEqual(r.warnings.filter((w) => w.startsWith('W_UNKNOWN_KEY')), [], c.key)
  }
})

test('헬스 URL: http(s) 만, URL 자격증명 거부, 경로는 /health 로', () => {
  assert.equal(healthUrl('http://127.0.0.1:8100')?.toString(), 'http://127.0.0.1:8100/health')
  assert.equal(healthUrl('http://192.168.219.100:8000/v1')?.toString(), 'http://192.168.219.100:8000/health')
  assert.equal(healthUrl('file:///etc/passwd'), null)
  assert.equal(healthUrl('http://user:pw@host:1'), null)
  assert.equal(healthUrl('gopher://x'), null)
  assert.equal(healthUrl(42), null)
  assert.equal(healthUrl('$CLAUDE_CLI_PATH'), null)
})
