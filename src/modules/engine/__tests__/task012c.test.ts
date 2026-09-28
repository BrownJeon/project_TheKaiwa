/**
 * task-012c 1단계 게이트(engine) — home-m4 API 키 전송 대상 고정(D-C3(a)) · credentialRef 허용 목록(CX-1) · 연결 주소 허용 목록의 Health 적용(D-C3(c))
 * · Functional Test 30초 슬롯 원자화(D-C9). 외부 네트워크 없이 127.0.0.1 임시 서버로 "요청이 실제로 나갔는가" 를 센다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PROVIDERS } from '../adapters/providers'
import { SERVICE_URL_ENV_NAMES, trustedServiceOrigins, vetConnectionUrl } from '../adapters/common/targetPolicy'
import { probeHttpHealth } from '../adapters/common/httpHealth'
import { HOME_M4_ALLOWED_REFS, homeM4Provider } from '../adapters/llm/homeM4.provider'
import { LlmMisconfiguredError, prepareHomeM4Call } from '../adapters/llm/homeM4'
import { checkCredentialRef } from '../credentials/policy'
import { allowedRefsFor } from '../credentials'
import { selfCheckSchema } from '../registry'
import type { ConfigurationSchema } from '../registry/types'
import { probeConnection } from '../llm'
import type { ResolvedConnection } from '../router'
import { claimFunctionalSlot, FunctionalTestRateLimitedError, type SlotDb } from '../functionalTest'
import { buildChildEnv, CHILD_ENV_ALLOW } from '../adapters/llm/claudeCli'
import { isDeniedCredentialRef } from '@/modules/infra'

const API_KEY = 'test-home-m4-key-0123456789'

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

interface Recorder {
  server: Server
  origin: string
  requests: { method: string; url: string; apiKey: string | undefined }[]
  close(): Promise<void>
}

/** 127.0.0.1 임시 서버 — 받은 요청(메서드·경로·x-api-key)을 기록한다. */
async function recorder(handle: (req: IncomingMessage) => { status: number; body?: string; headers?: Record<string, string> }): Promise<Recorder> {
  const requests: Recorder['requests'] = []
  const server = createServer((req, res) => {
    requests.push({ method: req.method ?? '', url: req.url ?? '', apiKey: req.headers['x-api-key'] as string | undefined })
    req.resume()
    req.on('end', () => {
      const r = handle(req)
      res.writeHead(r.status, { 'content-type': 'application/json', ...(r.headers ?? {}) })
      res.end(r.body ?? '')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { server, origin: `http://127.0.0.1:${port}`, requests, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

const chatOk = () => ({ status: 200, body: JSON.stringify({ model: 'm', message: { role: 'assistant', content: '{"ok":true,"echo":"テスト"}' } }) })

function homeConn(baseUrl: string, credentialRef: string | null = 'env:HOME_M4_API_KEY'): ResolvedConnection {
  return { id: 'ec_t', key: 'home-m4-test', engineId: 'home-m4-api', connectionType: 'HTTP', connection: { baseUrl }, runtime: { model: 'qwen-test' }, credentialRef }
}

// ── (b) credentialRef 허용 목록 ──────────────────────────────────────────

test('checkCredentialRef — 순서: 평문 → 전역 거부(descriptor 가 실수로 허용해도) → descriptor 목록 → 형식 → 존재', async () => {
  const allowed = ['env:HOME_M4_API_KEY', 'file:home-m4-api-key', 'env:JWT_SECRET', 'file:jwt-secret', 'env:lower_case']
  assert.deepEqual(checkCredentialRef(allowed, null, { checkExists: true }), { ok: true }, 'null = 해제')
  assert.deepEqual(checkCredentialRef(allowed, 'sk-abcdef0123456789', { checkExists: false }), { ok: false, problem: 'PLAINTEXT' })
  assert.deepEqual(checkCredentialRef(allowed, 'env:JWT_SECRET', { checkExists: false }), { ok: false, problem: 'REF_NOT_ALLOWED', deniedBy: 'GLOBAL' })
  assert.deepEqual(checkCredentialRef(allowed, 'file:jwt-secret', { checkExists: false }), { ok: false, problem: 'REF_NOT_ALLOWED', deniedBy: 'GLOBAL' })
  assert.deepEqual(checkCredentialRef(allowed, 'file:tts-service-token', { checkExists: false }), { ok: false, problem: 'REF_NOT_ALLOWED', deniedBy: 'DESCRIPTOR' }, '다른 연결의 ref')
  assert.deepEqual(checkCredentialRef(allowed, 'env:SPEECH_INTERNAL_SECRET', { checkExists: false }), { ok: false, problem: 'REF_NOT_ALLOWED', deniedBy: 'GLOBAL' })
  assert.deepEqual(checkCredentialRef(allowed, 'env:lower_case', { checkExists: false }), { ok: false, problem: 'BAD_FORMAT' })
  await withEnv({ HOME_M4_API_KEY: undefined }, () => {
    assert.deepEqual(checkCredentialRef(allowed, 'env:HOME_M4_API_KEY', { checkExists: true }), { ok: false, problem: 'MISSING' }, '없는 ref')
    assert.deepEqual(checkCredentialRef(allowed, 'env:HOME_M4_API_KEY', { checkExists: false }), { ok: true })
  })
  await withEnv({ HOME_M4_API_KEY: API_KEY }, () => assert.deepEqual(checkCredentialRef(allowed, 'env:HOME_M4_API_KEY', { checkExists: true }), { ok: true }))
})

test('allowedRefsFor — 어댑터별 정확한 목록(home-m4 = 자기 키, TTS = 토큰 파일, whisper = 없음, credentialRef 키 없는 엔진·해당 없는 연결 종류 = 없음)', () => {
  assert.deepEqual([...allowedRefsFor('home-m4-api', 'HTTP')], [...HOME_M4_ALLOWED_REFS])
  assert.deepEqual([...allowedRefsFor('style-bert-vits2', 'HTTP')], ['file:tts-service-token'])
  assert.deepEqual([...allowedRefsFor('faster-whisper', 'HTTP')], [])
  assert.deepEqual([...allowedRefsFor('faster-whisper', 'LOCAL')], [])
  assert.deepEqual([...allowedRefsFor('claude-cli', 'CLI')], [])
  assert.deepEqual([...allowedRefsFor('sherpa-onnx-reazon', 'HTTP')], [])
  assert.deepEqual([...allowedRefsFor('no-such-engine', 'HTTP')], [])
})

test('스키마 자체 검증 — 모든 Provider 통과, SECRET_REF 에 allowedRefs 없음·거부 분류 ref·형식 오류는 로드 실패', () => {
  for (const p of PROVIDERS) assert.deepEqual(selfCheckSchema(p.configurationSchema(), p.descriptor.id), [], p.descriptor.id)
  const base = homeM4Provider.configurationSchema()
  const withKey = (patch: Record<string, unknown>): ConfigurationSchema => ({
    ...base,
    keys: base.keys.map((k) => (k.key === 'connection.credentialRef' ? ({ ...k, ...patch } as typeof k) : k)),
  })
  assert.ok(selfCheckSchema(withKey({ allowedRefs: undefined }), 'home-m4-api').some((e) => e.includes('allowedRefs 없음')))
  assert.ok(selfCheckSchema(withKey({ allowedRefs: ['env:HOME_M4_API_KEY', 'env:JWT_SECRET'] }), 'home-m4-api').some((e) => e.includes('거부 분류')))
  assert.ok(selfCheckSchema(withKey({ allowedRefs: ['env:bad name'] }), 'home-m4-api').some((e) => e.includes('형식 오류')))
})

// ── (c) 연결 주소 허용 목록 ──────────────────────────────────────────────

test('SERVICE_URL_ENV_NAMES = 어댑터 스키마 URL 키 envAlias 합집합(상수와 스키마가 어긋나지 않게)', () => {
  const fromSchemas = new Set(PROVIDERS.flatMap((p) => p.configurationSchema().keys.filter((k) => k.type === 'URL').flatMap((k) => k.envAlias ?? [])))
  assert.deepEqual([...fromSchemas].sort(), [...SERVICE_URL_ENV_NAMES].sort())
})

test('trustedServiceOrigins — 서비스 URL env + KAIWA_*_CONNECTION_BASEURL, 주석·자격증명·비 http 는 제외', () => {
  const env = {
    AI_API_BASE: 'http://192.168.219.100:8000     # 주석',
    TTS_SERVICE_URL: 'http://192.168.219.100:8200',
    SPEECH_GATEWAY_URL: 'http://u:p@127.0.0.1:8100',
    WHISPER_SERVICE_URL: 'ftp://127.0.0.1:8090',
    KAIWA_CONN_HOME_M4_LAN_CONNECTION_BASEURL: 'https://m4.example.org',
    KAIWA_TTS_CONNECTION_BASEURL: 'http://127.0.0.1:8201',
    KAIWA_CONN_X_RUNTIME_MODEL: 'http://1.2.3.4',
    OTHER_URL: 'http://5.6.7.8',
  } as unknown as NodeJS.ProcessEnv
  assert.deepEqual(trustedServiceOrigins(env).sort(), ['http://127.0.0.1:8201', 'http://192.168.219.100:8000', 'http://192.168.219.100:8200', 'https://m4.example.org'].sort())
})

test('vetConnectionUrl — Validate·Health 공용: 허용 밖 host 거부, env origin 은 허용', async () => {
  await withEnv({ AI_API_BASE: 'https://ai.example.org' }, async () => {
    assert.equal((await vetConnectionUrl('https://ai.example.org/v1')).ok, true)
    assert.deepEqual(await vetConnectionUrl('https://evil.example.org/v1'), { ok: false, reason: 'HOST_NOT_ALLOWED' })
    assert.deepEqual(await vetConnectionUrl('http://10.0.0.1:8090'), { ok: false, reason: 'HOST_NOT_ALLOWED' })
    assert.deepEqual(await vetConnectionUrl('http://a:b@127.0.0.1:1'), { ok: false, reason: 'USERINFO' })
  })
})

test('probeHttpHealth — 허용 밖 주소는 요청 0·MISCONFIGURED(HOST_NOT_ALLOWED), 리다이렉트는 따라가지 않는다', async () => {
  const target = await recorder(() => ({ status: 200, body: '{"ok":true}' }))
  const redirector = await recorder(() => ({ status: 302, headers: { location: `${target.origin}/health` } }))
  try {
    const denied = await probeHttpHealth('http://10.255.255.1:8090')
    assert.equal(denied.status, 'MISCONFIGURED')
    assert.equal(denied.detail.errorCode, 'HOST_NOT_ALLOWED')
    const mapped = await probeHttpHealth('http://[::ffff:10.0.0.1]:8090')
    assert.equal(mapped.detail.errorCode, 'HOST_NOT_ALLOWED')
    const userinfo = await probeHttpHealth(`http://u:p@${target.origin.slice(7)}`)
    assert.equal(userinfo.detail.errorCode, 'BAD_BASE_URL')
    assert.equal(target.requests.length, 0)
    const red = await probeHttpHealth(redirector.origin)
    assert.equal(red.ok, false)
    assert.equal(red.detail.errorCode, 'HTTP_302')
    assert.equal(redirector.requests.length, 1)
    assert.equal(target.requests.length, 0, '리다이렉트 대상에 요청이 가지 않았다')
    const ok = await probeHttpHealth(target.origin)
    assert.equal(ok.status, 'HEALTHY')
    assert.equal(target.requests.length, 1)
    assert.equal(target.requests[0].url, '/health')
  } finally {
    await target.close()
    await redirector.close()
  }
})

// ── (a) home-m4 API 키 전송 대상 고정 ─────────────────────────────────────

test('prepareHomeM4Call — 주소 origin 이 서버 env AI_API_BASE 와 다르면 키를 해석하지 않고 던진다(반례 7종)', async () => {
  await withEnv({ AI_API_BASE: 'http://192.168.219.100:8000', HOME_M4_API_KEY: API_KEY, JWT_SECRET: 'jwt-must-never-leave', TTS_SERVICE_SECRET: 'tts-never' }, () => {
    assert.deepEqual(prepareHomeM4Call(homeConn('http://192.168.219.100:8000/')), { base: 'http://192.168.219.100:8000', apiKey: API_KEY })
    const code = (baseUrl: string, ref: string | null = 'env:HOME_M4_API_KEY') => {
      try {
        prepareHomeM4Call(homeConn(baseUrl, ref))
        return 'OK'
      } catch (e) {
        assert.ok(e instanceof LlmMisconfiguredError)
        assert.ok(!e.message.includes(API_KEY) && !e.message.includes('jwt-must'))
        return e.code
      }
    }
    assert.equal(code('http://10.0.0.9:8000'), 'TARGET_NOT_ALLOWED', '다른 origin')
    assert.equal(code('http://192.168.219.100:8200'), 'TARGET_NOT_ALLOWED', '같은 host 다른 port')
    assert.equal(code('https://192.168.219.100:8000'), 'TARGET_NOT_ALLOWED', '스킴 다름')
    assert.equal(code('http://[::ffff:192.168.219.100]:8000'), 'TARGET_NOT_ALLOWED', 'IPv6 표기')
    assert.equal(code('http://3232291684:8000'), 'OK', '10진 표기는 같은 origin 으로 정규화')
    assert.equal(code('http://u:p@192.168.219.100:8000'), 'BAD_BASE_URL', 'userinfo')
    assert.equal(code('not a url'), 'BAD_BASE_URL')
    assert.equal(code('http://192.168.219.100:8000', 'env:JWT_SECRET'), 'REF_NOT_ALLOWED', '부팅 시크릿 ref')
    assert.equal(code('http://192.168.219.100:8000', 'file:jwt-secret'), 'REF_NOT_ALLOWED')
    assert.equal(code('http://192.168.219.100:8000', 'env:TTS_SERVICE_SECRET'), 'REF_NOT_ALLOWED')
    assert.equal(code('http://192.168.219.100:8000', 'file:tts-service-token'), 'REF_NOT_ALLOWED', '다른 연결의 ref')
    assert.equal(code('http://192.168.219.100:8000', null), 'SECRET_MISSING')
  })
  await withEnv({ AI_API_BASE: 'http://192.168.219.100', HOME_M4_API_KEY: API_KEY }, () => {
    assert.equal(prepareHomeM4Call(homeConn('http://192.168.219.100:80/')).apiKey, API_KEY, '기본 포트 표기')
  })
  await withEnv({ AI_API_BASE: undefined, HOME_M4_API_KEY: API_KEY }, () => {
    assert.throws(() => prepareHomeM4Call(homeConn('http://192.168.219.100:8000')), (e: unknown) => e instanceof LlmMisconfiguredError && e.code === 'TARGET_UNSET')
  })
  await withEnv({ AI_API_BASE: 'http://192.168.219.100:8000', HOME_M4_API_KEY: undefined }, () => {
    assert.throws(() => prepareHomeM4Call(homeConn('http://192.168.219.100:8000')), (e: unknown) => e instanceof LlmMisconfiguredError && e.code === 'SECRET_MISSING')
  })
})

test('home-m4 실호출(probeConnection) — 허용 밖 주소면 요청 0, env origin 이면 1회 + X-API-Key', async () => {
  const allowed = await recorder(chatOk)
  const other = await recorder(chatOk)
  try {
    await withEnv({ AI_API_BASE: allowed.origin, HOME_M4_API_KEY: API_KEY }, async () => {
      const denied = await probeConnection(homeConn(other.origin), 5_000)
      assert.equal(denied.ok, false)
      assert.equal(denied.errorName, 'LlmMisconfiguredError')
      assert.equal(denied.errorCode, 'TARGET_NOT_ALLOWED')
      assert.equal(other.requests.length, 0, '다른 origin(같은 127.0.0.1·다른 port)에 요청 0')
      const deniedRef = await probeConnection(homeConn(allowed.origin, 'env:JWT_SECRET'), 5_000)
      assert.equal(deniedRef.errorCode, 'REF_NOT_ALLOWED')
      assert.equal(allowed.requests.length, 0)
      const ok = await probeConnection(homeConn(allowed.origin), 5_000)
      assert.equal(ok.ok, true)
      assert.equal(allowed.requests.length, 1)
      assert.equal(allowed.requests[0].url, '/v1/chat')
      assert.equal(allowed.requests[0].apiKey, API_KEY)
    })
  } finally {
    await allowed.close()
    await other.close()
  }
})

test('home-m4 Health — 주소가 env origin 밖이면 요청 0·MISCONFIGURED(TARGET_NOT_ALLOWED), ref 가 허용 밖이면 REF_NOT_ALLOWED', async () => {
  const allowed = await recorder(() => ({ status: 200, body: '{"ok":true}' }))
  const other = await recorder(() => ({ status: 200, body: '{"ok":true}' }))
  try {
    await withEnv({ AI_API_BASE: allowed.origin, HOME_M4_API_KEY: API_KEY }, async () => {
      const profile = (baseUrl: string, ref: string | null) => ({ id: 'c', key: 'k', connectionType: 'HTTP' as const, values: { 'connection.baseUrl': baseUrl, 'connection.credentialRef': ref } })
      const a = await homeM4Provider.healthCheck(profile(other.origin, 'env:HOME_M4_API_KEY'))
      assert.equal(a.status, 'MISCONFIGURED')
      assert.equal(a.detail.errorCode, 'TARGET_NOT_ALLOWED')
      assert.equal(other.requests.length, 0)
      const b = await homeM4Provider.healthCheck(profile(allowed.origin, 'env:SPEECH_INTERNAL_SECRET'))
      assert.equal(b.detail.errorCode, 'REF_NOT_ALLOWED')
      const c = await homeM4Provider.healthCheck(profile(allowed.origin, 'env:HOME_M4_API_KEY'))
      assert.equal(c.status, 'HEALTHY')
      assert.ok(allowed.requests.every((r) => r.apiKey === undefined), 'Health 요청에는 키를 싣지 않는다')
    })
  } finally {
    await allowed.close()
    await other.close()
  }
})

// ── D-C9 Functional Test 30초 슬롯 ────────────────────────────────────────

/** 조건부 UPDATE 를 원자적으로 흉내 내는 가짜 DB(한 행). */
function fakeSlotDb(initial: Date | null): { db: SlotDb; updates: number; state: () => Date | null } {
  let last = initial
  let updates = 0
  const db = {
    engineConnection: {
      async updateMany(args: { where: { id: string; OR: [{ lastFunctionalAt: null }, { lastFunctionalAt: { lt: Date } }] }; data: { lastFunctionalAt: Date } }) {
        await new Promise((r) => setImmediate(r))
        const cutoff = args.where.OR[1].lastFunctionalAt.lt
        if (last === null || last < cutoff) {
          last = args.data.lastFunctionalAt
          updates++
          return { count: 1 }
        }
        return { count: 0 }
      },
      async findUnique() {
        return { lastFunctionalAt: last }
      },
    },
  }
  return { db: db as unknown as SlotDb, get updates() { return updates }, state: () => last }
}

test('claimFunctionalSlot — 동시 5요청 중 1건만 통과·나머지 429(retryAfterSec), 30초 뒤 다시 통과, 미래 시각이어도 대기 ≤30초', async () => {
  const t0 = new Date('2026-09-29T00:00:00Z')
  const f = fakeSlotDb(null)
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => claimFunctionalSlot('ec_1', t0, f.db)))
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  assert.equal(rejected.length, 4)
  assert.ok(rejected.every((r) => r.reason instanceof FunctionalTestRateLimitedError && r.reason.retryAfterSec === 30))
  await assert.rejects(claimFunctionalSlot('ec_1', new Date(t0.getTime() + 29_500), f.db), (e: unknown) => e instanceof FunctionalTestRateLimitedError && e.retryAfterSec === 1)
  await claimFunctionalSlot('ec_1', new Date(t0.getTime() + 30_001), f.db)
  assert.equal(f.state()?.getTime(), t0.getTime() + 30_001, 'lastFunctionalAt = 마지막 시작 시각')
  const future = fakeSlotDb(new Date(t0.getTime() + 3_600_000))
  await assert.rejects(claimFunctionalSlot('ec_2', t0, future.db), (e: unknown) => e instanceof FunctionalTestRateLimitedError && e.retryAfterSec === 30)
})

// ── Codex C2 ① Claude CLI 자식 env 허용 목록 ───────────────────────────────

test('buildChildEnv — 허용 목록(fail-closed): 시크릿·세션 주입 변수·NODE_OPTIONS 는 빠지고 실행에 필요한 것만 남는다', () => {
  const source: Record<string, string> = {
    PATH: '/usr/bin:/bin',
    HOME: '/home/u',
    LANG: 'ko_KR.UTF-8',
    LC_ALL: 'ko_KR.UTF-8',
    LC_MESSAGES: 'C',
    TZ: 'Asia/Seoul',
    TMPDIR: '/tmp',
    CLAUDE_CONFIG_DIR: '/home/u/.claude',
    CLAUDECODE: '1',
    CLAUDE_CODE_ENTRYPOINT: 'sdk-ts',
    CLAUDE_CODE_OAUTH_TOKEN: 'oauth-token-value',
    ANTHROPIC_API_KEY: 'sk-ant-xxxx',
    JWT_SECRET: 'jwt',
    DATABASE_URL: 'mysql://u:p@h/db',
    GOOGLE_CLIENT_ID: 'gid',
    GOOGLE_CLIENT_SECRET: 'gsecret',
    GOOGLE_NEW_THING: 'g',
    HOME_M4_API_KEY: 'k',
    TTS_SERVICE_SECRET: 't',
    SPEECH_INTERNAL_SECRET: 's',
    SIGNUP_INVITE_CODE: 'i',
    BRAND_NEW_SECRET: 'n',
    PAYMENT_API_TOKEN: 'p',
    SOME_PASSWORD: 'pw',
    NODE_OPTIONS: '--inspect',
    VSCODE_IPC_HOOK_CLI: '/tmp/x',
    npm_config_token: 'npm',
  }
  const env = buildChildEnv(source, { thinking: false, home: '/home/u', npmGlobalBinExists: true })
  const allowed = new Set([...CHILD_ENV_ALLOW, 'MAX_THINKING_TOKENS'])
  for (const k of Object.keys(env)) assert.ok(allowed.has(k) || /^LC_[A-Z]+$/.test(k), `허용 목록 밖 키: ${k}`)
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'JWT_SECRET', 'DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_NEW_THING', 'HOME_M4_API_KEY', 'TTS_SERVICE_SECRET', 'SPEECH_INTERNAL_SECRET', 'SIGNUP_INVITE_CODE', 'BRAND_NEW_SECRET', 'PAYMENT_API_TOKEN', 'SOME_PASSWORD', 'NODE_OPTIONS', 'VSCODE_IPC_HOOK_CLI', 'npm_config_token']) {
    assert.equal(k in env, false, k)
  }
  assert.equal(env.PATH, '/home/u/.npm-global/bin:/usr/bin:/bin')
  assert.equal(env.HOME, '/home/u')
  assert.equal(env.LANG, 'ko_KR.UTF-8')
  assert.equal(env.LC_MESSAGES, 'C')
  assert.equal(env.CLAUDE_CONFIG_DIR, '/home/u/.claude')
  assert.equal(env.MAX_THINKING_TOKENS, '0')
  assert.equal('MAX_THINKING_TOKENS' in buildChildEnv(source, { thinking: true, home: '/home/u', npmGlobalBinExists: false }), false)
  assert.equal(buildChildEnv({ PATH: '/bin' }, { thinking: true, home: '/h', npmGlobalBinExists: false }).HOME, '/h', 'HOME 이 없으면 os.homedir()')
})

test('buildChildEnv — 무작위 새 시크릿 이름(*_SECRET·*_TOKEN·*_KEY·DATABASE_URL·GOOGLE_*) 200개가 하나도 자식에 가지 않는다', () => {
  const src: Record<string, string> = { PATH: '/bin', HOME: '/h' }
  const names: string[] = []
  for (let i = 0; i < 200; i++) {
    const stem = Math.random().toString(36).slice(2, 8).toUpperCase()
    const n = [`${stem}_SECRET`, `${stem}_TOKEN`, `${stem}_API_KEY`, `GOOGLE_${stem}`, `${stem}_DATABASE_URL`][i % 5]
    names.push(n)
    src[n] = `v${i}`
  }
  const env = buildChildEnv(src, { thinking: false, home: '/h', npmGlobalBinExists: false })
  assert.deepEqual(names.filter((n) => n in env), [])
  assert.deepEqual(Object.keys(env).sort(), ['HOME', 'MAX_THINKING_TOKENS', 'PATH'])
})

test('CHILD_ENV_ALLOW — 허용 목록 자체에 시크릿 형태 이름·전역 거부 분류 이름이 없다', () => {
  for (const k of CHILD_ENV_ALLOW) {
    assert.equal(/SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|DATABASE|COOKIE|CREDENTIAL/i.test(k), false, k)
    assert.equal(isDeniedCredentialRef(`env:${k.toUpperCase()}`), false, k)
  }
})
