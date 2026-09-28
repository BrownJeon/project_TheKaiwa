/**
 * task-005b 라이브 스모크 — Admin Console 서버(#80~#129 Phase 1 + me/capabilities)를 실제 서버(127.0.0.1)·실제 DB 에 친다.
 * Leader 완료 기준 2~8·10 을 항목별 PASS/FAIL 로 찍는다(9 = 화면 3폭은 QA 브라우저 몫).
 *
 * 실행(우분투 미러): `bash tests/live/task005b-smoke.sh [포트=3011]` — USER·ADMIN·DEVELOPER·SUPER_ADMIN QA 계정 쿠키 생성·삭제를 감싼다.
 * Claude CLI 호출: LLM 기능 테스트 1회(재실행은 429 로 막히는지 확인).
 * DB(개발·운영 공유): 쓰는 것은 LOCAL connection 의 Health 결과·기능 테스트 Trace·감사 1~2행뿐. 끝나면 이 실행이 만든 EngineHealth·RequestTrace 를 지우고
 * LOCAL connection 상태(status·statusReason·lastHealthAt·lastFunctionalAt)를 시작 전 값으로 되돌린다. **AuditLog 는 지우지 않는다**(불변 — QA 계정 행으로 남음).
 * PRODUCTION 행은 읽기만 하고 절대 실행 대상으로 삼지 않는다(교차 환경 실행이 막히는지만 본다).
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { SESSION_COOKIE_NAME } from '../../src/modules/infra/jwt'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const PROD_ORIGIN = 'https://kaiwa.xn--lh0b87pnudm10a4vd.com'
const [cUser, cAdmin, cDev, cSuper] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!cUser || !cAdmin || !cDev || !cSuper) throw new Error('사용: task005b-smoke.ts <user> <admin> <developer> <super> 쿠키 파일')
const COOKIE = { USER: cUser, ADMIN: cAdmin, DEVELOPER: cDev, SUPER_ADMIN: cSuper } as const
type RoleName = keyof typeof COOKIE

const prisma = new PrismaClient()
const startedAt = new Date()
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  body: { success: boolean; data: Json & { code?: string; details?: Json }; message: string | null }
  text: string
  ms: number
}
const transcript: string[] = []
async function api(role: RoleName | null, method: string, path: string, init: { body?: unknown; headers?: Record<string, string>; cookie?: string } = {}): Promise<Res> {
  const t0 = performance.now()
  const headers: Record<string, string> = { ...(init.headers ?? {}) }
  const cookie = init.cookie ?? (role ? COOKIE[role] : undefined)
  if (cookie) headers.Cookie = cookie
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const r = await fetch(`${BASE}${path}`, { method, headers, redirect: 'manual', body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  const text = await r.text()
  transcript.push(text)
  let parsed: Res['body']
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { success: false, data: {}, message: text.slice(0, 120) }
  }
  return { status: r.status, body: parsed, text, ms: performance.now() - t0 }
}
const d = (r: Res) => r.body.data as Json
const arr = (r: Res) => (Array.isArray(r.body.data) ? (r.body.data as unknown as Json[]) : [])

// ── 서버 .env 의 실제 비밀값·서버 경로(값은 이 프로세스 메모리에만, 출력하지 않는다) ──────────────
function secretNeedles(): string[] {
  const names = ['JWT_SECRET', 'GOOGLE_CLIENT_SECRET', 'SPEECH_INTERNAL_SECRET', 'SIGNUP_INVITE_CODE', 'DATABASE_URL', 'HOME_M4_API_KEY', 'AI_API_KEY', 'OWNER_EMAIL']
  const out: string[] = []
  for (const n of names) {
    const v = process.env[n]?.trim()
    if (v && v.length >= 8) out.push(v)
  }
  const db = process.env.DATABASE_URL
  if (db) {
    try {
      const u = new URL(db)
      if (u.password && u.password.length >= 6) out.push(decodeURIComponent(u.password))
    } catch {
      /* 형식이 달라도 전체 문자열은 이미 넣었다 */
    }
  }
  const dir = process.env.SECRETS_DIR
  if (dir && existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isFile() && statSync(p).size < 4096) {
        const v = readFileSync(p, 'utf8').trim()
        if (v.length >= 8) out.push(v)
      }
    }
  }
  return out
}
function pathNeedles(): string[] {
  const out = ['/home/', '/Users/', '/root/']
  for (const n of ['DATA_ROOT', 'SECRETS_DIR', 'SPEECH_CONFIG_PATH']) {
    const v = process.env[n]?.trim()
    if (v && v.startsWith('/')) out.push(v)
  }
  return out
}

const ENDPOINTS: { method: 'GET' | 'POST'; path: (ids: Ids) => string; cap: string }[] = [
  { method: 'GET', path: () => '/api/admin/v1/me/capabilities', cap: 'console.access' },
  { method: 'GET', path: () => '/api/admin/v1/overview', cap: 'engine.read' },
  { method: 'GET', path: () => '/api/admin/v1/environment', cap: 'console.access' },
  { method: 'GET', path: () => '/api/admin/v1/voices', cap: 'voices.read' },
  { method: 'GET', path: (i) => `/api/admin/v1/voices/${i.voice}`, cap: 'voices.read' },
  { method: 'GET', path: () => '/api/admin/v1/engines', cap: 'engine.read' },
  { method: 'GET', path: () => '/api/admin/v1/engine-connections', cap: 'engine.read' },
  { method: 'GET', path: (i) => `/api/admin/v1/engine-connections/${i.whisper}`, cap: 'engine.read' },
  { method: 'GET', path: (i) => `/api/admin/v1/engine-connections/${i.whisper}/health`, cap: 'engine.read' },
  { method: 'GET', path: () => '/api/admin/v1/fallback-policies', cap: 'engine.read' },
  { method: 'GET', path: () => '/api/admin/v1/fallback-policies/LLM', cap: 'engine.read' },
  { method: 'GET', path: () => '/api/admin/v1/secrets', cap: 'secrets.read_ref' },
  { method: 'GET', path: (i) => `/api/admin/v1/config/effective?scope=ENGINE_CONNECTION&targetId=${i.whisper}`, cap: 'config.effective.read' },
  { method: 'GET', path: () => '/api/admin/v1/config/schema/faster-whisper', cap: 'config.raw.read' },
  { method: 'GET', path: () => '/api/admin/v1/plugins', cap: 'plugins.read' },
  { method: 'GET', path: () => '/api/admin/v1/plugins/faster-whisper', cap: 'plugins.read' },
  { method: 'GET', path: () => '/api/admin/v1/traces', cap: 'trace.read' },
  { method: 'GET', path: (i) => `/api/admin/v1/traces/${i.trace}`, cap: 'trace.read' },
  { method: 'POST', path: (i) => `/api/admin/v1/engine-connections/${i.gateway}/health`, cap: 'health.run' },
  { method: 'POST', path: (i) => `/api/admin/v1/engine-connections/${i.gateway}/test`, cap: 'functional_test.run' },
]
interface Ids {
  whisper: string
  gateway: string
  claude: string
  homeM4: string
  prodWhisper: string
  voice: string
  trace: string
}

/** role-permission §3 에서 이 스모크가 쓰는 capability 의 역할별 값(정본 표 복사). */
const MATRIX: Record<string, RoleName[]> = {
  'console.access': ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'],
  'engine.read': ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'],
  'voices.read': ['USER', 'ADMIN', 'DEVELOPER', 'SUPER_ADMIN'],
  'secrets.read_ref': ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'],
  'config.effective.read': ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'],
  'config.raw.read': ['DEVELOPER', 'SUPER_ADMIN'],
  'plugins.read': ['DEVELOPER', 'SUPER_ADMIN'],
  'trace.read': ['DEVELOPER', 'SUPER_ADMIN'],
  'health.run': ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'],
  'functional_test.run': ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'],
}

async function main() {
  const local = await prisma.engineConnection.findMany({ where: { environment: 'LOCAL' } })
  const snapshot = local.map((c) => ({ id: c.id, status: c.status, statusReason: c.statusReason, lastHealthAt: c.lastHealthAt, lastFunctionalAt: c.lastFunctionalAt }))
  const byKey = (k: string) => local.find((c) => c.key === k)!
  const prodWhisper = await prisma.engineConnection.findUniqueOrThrow({ where: { environment_key: { environment: 'PRODUCTION', key: 'whisper-voicevault' } } })
  const prodBefore = await prisma.engineConnection.findMany({ where: { environment: 'PRODUCTION' }, select: { id: true, status: true, lastHealthAt: true, lastFunctionalAt: true } })
  const voice = await prisma.voiceProfile.findFirstOrThrow({ select: { id: true } })
  const qaUser = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' } })
  const qaAdmin = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-admin@thekaiwa.test' } })
  const ids: Ids = { whisper: byKey('whisper-voicevault').id, gateway: byKey('reazon-gateway').id, claude: byKey('claude-cli-local').id, homeM4: byKey('home-m4-lan').id, prodWhisper: prodWhisper.id, voice: voice.id, trace: 't_00000000000000000000' }

  try {
    // ── 5. Health 전 connection + 기능 테스트(권한 매트릭스보다 먼저 — trace id 확보·30초 창) ──────────
    const health: Record<string, Res> = {}
    for (const c of local) health[c.key] = await api('ADMIN', 'POST', `/api/admin/v1/engine-connections/${c.id}/health`, { body: { baseUrl: 'http://169.254.169.254/latest', url: 'http://evil.test' } })
    check('5a Health: LOCAL seed connection 6개 전부 200(500 없음)', Object.values(health).every((r) => r.status === 200) && local.length === 6, Object.entries(health).map(([k, r]) => `${k}:${r.status}/${d(r).status}`).join(' '))
    const rows = await prisma.engineHealth.count({ where: { connectionId: { in: local.map((c) => c.id) }, kind: 'HEALTH', checkedAt: { gte: startedAt } } })
    check('5b EngineHealth(HEALTH) 행 6개 기록', rows === 6, `${rows}`)
    const gw = d(health['reazon-gateway'])
    check('5c 떠 있지 않은 gateway → UNAVAILABLE + 사유(errorCode·message), URL 미포함', gw.status === 'UNAVAILABLE' && typeof (gw.detail as Json)?.errorCode === 'string' && !JSON.stringify(gw).includes('8100'), JSON.stringify(gw.detail))
    const od = d(health['reazon-ondevice'])
    check('5d ONDEVICE → UNKNOWN + skipped + reason NOT_APPLICABLE(상태 불변)', od.status === 'UNKNOWN' && (od.detail as Json)?.reason === 'NOT_APPLICABLE' && od.connectionStatus === 'UNKNOWN')
    check('5e 요청 본문 URL 은 무시(SSRF) — 결과는 저장된 주소 기준', !JSON.stringify(Object.values(health).map(d)).match(/169\.254|evil\.test/))
    const cl = d(health['claude-cli-local'])
    check('5f CLI Health = claude --version(모델 호출 없음)', cl.status === 'HEALTHY' && typeof (cl.detail as Json)?.version === 'string', JSON.stringify(cl.detail))

    const llm = await api('ADMIN', 'POST', `/api/admin/v1/engine-connections/${ids.claude}/test`, { body: {} })
    const ld = d(llm)
    check('5g LLM 기능 테스트 통과·지연 기록(고정 스키마 1회)', llm.status === 200 && ld.ok === true && ld.kind === 'FUNCTIONAL' && typeof ld.latencyMs === 'number' && (ld.detail as Json)?.schemaValid === true, `${llm.status} ${ld.latencyMs}ms ${JSON.stringify(ld.detail)}`)
    ids.trace = String(ld.traceId)
    const tr = await prisma.requestTrace.findUnique({ where: { traceId: ids.trace } })
    const stepsText = JSON.stringify(tr?.steps ?? null)
    check('5h RequestTrace(FUNCTIONAL_TEST) — 단계 ms·모델만, 프롬프트·응답 원문 없음', tr?.kind === 'FUNCTIONAL_TEST' && !/テスト|ping|echo|점검용/.test(stepsText) && /"ms":\d+/.test(stepsText), stepsText.slice(0, 160))
    const again = await api('SUPER_ADMIN', 'POST', `/api/admin/v1/engine-connections/${ids.claude}/test`, { body: {} })
    check('5i 30초 내 재실행 → 429 + retryAfterSec(다른 역할이어도)', again.status === 429 && typeof again.body.data.details?.retryAfterSec === 'number', `${again.status} ${JSON.stringify(again.body.data)}`)
    const sttTest = await api('ADMIN', 'POST', `/api/admin/v1/engine-connections/${ids.whisper}/test`, { body: {} })
    const gwTest = await api('ADMIN', 'POST', `/api/admin/v1/engine-connections/${ids.gateway}/test`, { body: {} })
    check('5j STT 기능 테스트 미실행 표현: 서비스 있음 → UNKNOWN+NOT_IMPLEMENTED, 없음 → UNAVAILABLE+SERVICE_DOWN', (d(sttTest).detail as Json)?.reason === 'NOT_IMPLEMENTED' && d(sttTest).status === 'UNKNOWN' && (d(gwTest).detail as Json)?.reason === 'SERVICE_DOWN' && d(gwTest).status === 'UNAVAILABLE', `${d(sttTest).status}/${(d(sttTest).detail as Json)?.reason} ${d(gwTest).status}/${(d(gwTest).detail as Json)?.reason}`)
    const ov = await api('ADMIN', 'POST', `/api/admin/v1/engine-connections/${ids.homeM4}/test`, { body: { overrideRuntime: { model: 'x' } } })
    check('5k overrideRuntime(Phase 2) → 400', ov.status === 400)

    // ── 2. 권한: 미인증 401 · USER 404 · 매트릭스 표본 ────────────────────────────────
    const unauth = await Promise.all(ENDPOINTS.map((e) => api(null, e.method, e.path(ids))))
    check('2a 미인증 → /api/admin/* 전부 401', unauth.every((r) => r.status === 401 && r.body.data.code === 'UNAUTHENTICATED'), unauth.map((r) => r.status).join(','))
    const asUser = await Promise.all(ENDPOINTS.map((e) => api('USER', e.method, e.path(ids))))
    const noHint = (r: Res) => r.status === 404 && r.body.data.code === 'NOT_FOUND' && r.body.data.details === undefined
    check('2b USER → /api/admin/* 20개 전부 404(힌트 없음, voices.read 보유 엔드포인트 포함)', asUser.every(noHint), asUser.map((r) => r.status).join(','))
    const unknown = await api('USER', 'GET', '/api/admin/v1/no-such-endpoint')
    check('2c USER → 존재하지 않는 관리자 API 도 같은 404 봉투(존재 여부 구분 불가)', noHint(unknown) && unknown.text === asUser[1].text)
    const forged = `${SESSION_COOKIE_NAME}=${jwt.sign({ userId: qaUser.id, email: qaUser.email, qa: true, role: 'SUPER_ADMIN' }, process.env.JWT_SECRET as string, { expiresIn: '5m' })}`
    const f1 = await api(null, 'GET', '/api/admin/v1/me/capabilities', { cookie: forged })
    check('2d JWT 에 role:SUPER_ADMIN 을 넣어도 USER 는 404(역할은 DB 에서만)', noHint(f1))
    const bypass = await api('USER', 'GET', '/api/admin/v1/me/capabilities', { headers: { 'x-middleware-subrequest': 'proxy:proxy:proxy:proxy:proxy' } })
    check('2e 미들웨어 우회 헤더(x-middleware-subrequest)로도 404(라우트 가드가 최종)', noHint(bypass), `${bypass.status}`)

    let matrixOk = true
    const matrixNotes: string[] = []
    for (const role of ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'] as const) {
      for (const e of ENDPOINTS) {
        if (e.method === 'POST') continue // POST 는 5a~5k 에서 실행(부작용·30초 창)
        const r = await api(role, e.method, e.path(ids))
        const allowed = MATRIX[e.cap].includes(role)
        const good = allowed ? r.status === 200 && r.body.success === true : r.status === 403 && (r.body.data.details?.missing as string[] | undefined)?.includes(e.cap) === true && !('requiredCapability' in (r.body.data.details ?? {}))
        if (!good) {
          matrixOk = false
          matrixNotes.push(`${role} ${e.method} ${e.path(ids)} → ${r.status}`)
        }
      }
    }
    check('2f ADMIN·DEVELOPER·SUPER_ADMIN × GET 18개 = 매트릭스(허용 200 / 부족 403 details.missing)', matrixOk, matrixNotes.slice(0, 6).join(' | '))
    for (const role of ['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'] as const) {
      const r = await api(role, 'POST', `/api/admin/v1/engine-connections/${ids.whisper}/health`)
      if (r.status !== 200) {
        matrixOk = false
        matrixNotes.push(`${role} POST health ${r.status}`)
      }
    }
    check('2g health.run 은 ADMIN·DEVELOPER·SUPER_ADMIN 모두 실행(200)', matrixOk, matrixNotes.join(' | '))
    const caps = await Promise.all((['ADMIN', 'DEVELOPER', 'SUPER_ADMIN'] as const).map((r) => api(r, 'GET', '/api/admin/v1/me/capabilities')))
    check('2h me/capabilities: 역할·capability 목록·productionApplyAllowed(SUPER_ADMIN 만 true)', caps.map((r) => `${d(r).role}:${(d(r).capabilities as string[]).length}:${d(r).productionApplyAllowed}`).join(',') === 'ADMIN:14:false,DEVELOPER:27:false,SUPER_ADMIN:33:true', caps.map((r) => `${d(r).role}:${(d(r).capabilities as string[]).length}:${d(r).productionApplyAllowed}`).join(','))
    const devProd = await api('DEVELOPER', 'GET', '/api/admin/v1/engine-connections?environment=PRODUCTION')
    const superProd = await api('SUPER_ADMIN', 'GET', '/api/admin/v1/engine-connections?environment=PRODUCTION')
    check('2i 다른 환경 보기: DEVELOPER 403(environment.policy), SUPER_ADMIN 200(PRODUCTION 행)', devProd.status === 403 && (devProd.body.data.details?.missing as string[])?.[0] === 'environment.policy' && superProd.status === 200 && arr(superProd).every((c) => c.environment === 'PRODUCTION'), `${devProd.status} ${superProd.status}`)
    const adminCross = await api('ADMIN', 'POST', `/api/admin/v1/engine-connections/${ids.prodWhisper}/health`)
    const superCross = await api('SUPER_ADMIN', 'POST', `/api/admin/v1/engine-connections/${ids.prodWhisper}/test`)
    const prodAfter = await prisma.engineConnection.findMany({ where: { environment: 'PRODUCTION' }, select: { id: true, status: true, lastHealthAt: true, lastFunctionalAt: true } })
    check('2j PRODUCTION 행 실행 불가: ADMIN 404(숨김)·SUPER_ADMIN 403 CROSS_ENVIRONMENT, PRODUCTION 행 불변', adminCross.status === 404 && superCross.status === 403 && superCross.body.data.details?.reason === 'CROSS_ENVIRONMENT' && JSON.stringify(prodAfter) === JSON.stringify(prodBefore), `${adminCross.status} ${superCross.status}`)
    const trUser = await api('DEVELOPER', 'GET', `/api/admin/v1/traces?userId=${qaUser.id}`)
    check('2k traces userId 필터는 SUPER_ADMIN 만(DEVELOPER 403)', trUser.status === 403)

    // ── 3. Dashboard · 환경 ─────────────────────────────────────────────────────
    const ovw = await api('ADMIN', 'GET', '/api/admin/v1/overview')
    const roles = (d(ovw).roles as Json[]) ?? []
    check('3a 대시보드: 역할 4개(활성 connection·엔진·모델·상태)·Voice 수·최근 Health', roles.length === 4 && roles.every((r) => r.connection && r.engine && 'model' in r && 'status' in r) && Array.isArray(d(ovw).recentHealth) && (d(ovw).recentHealth as Json[]).length > 0 && typeof (d(ovw).voices as Json)?.total === 'number', roles.map((r) => `${r.role}:${(r.connection as Json)?.key}:${r.status}`).join(' '))
    const env = await api('ADMIN', 'GET', '/api/admin/v1/environment')
    check('3b 환경 배지: environment·appVersion·nodeEnv·protection(api-contract #81 모양)', ['environment', 'appVersion', 'nodeEnv', 'protection', 'services'].every((k) => k in d(env)) && d(env).environment === 'LOCAL' && (d(env).protection as Json)?.overrideEnabled === false, `${d(env).environment} ${d(env).appVersion}`)

    // ── 4. Effective Config ────────────────────────────────────────────────────
    const effAll: Res[] = []
    for (const c of local) effAll.push(await api('DEVELOPER', 'GET', `/api/admin/v1/config/effective?scope=ENGINE_CONNECTION&targetId=${c.key}`))
    const keysOf = (r: Res) => (d(r).keys as Json[]) ?? []
    check('4a DEVELOPER: 6개 connection 키마다 value·source·sourceRef·editability·shadowed·layers', effAll.every((r) => r.status === 200 && d(r).detail === 'FULL' && keysOf(r).length > 0 && keysOf(r).every((k) => 'value' in k && typeof k.source === 'string' && typeof k.sourceRef === 'string' && typeof k.shadowed === 'boolean' && Array.isArray(k.layers))), effAll.map((r) => keysOf(r).length).join(','))
    const bin = keysOf(effAll[local.findIndex((c) => c.key === 'claude-cli-local')]).find((k) => k.key === 'connection.binPath')
    check('4b env 가 덮은 키는 source=ENVIRONMENT(claude-cli binPath ← CLAUDE_CLI_PATH), 절대 경로 미노출', bin?.source === 'ENVIRONMENT' && bin?.sourceRef === 'env:CLAUDE_CLI_PATH' && !String(bin?.value).startsWith('/'), `${bin?.source} ${bin?.sourceRef} ${JSON.stringify(bin?.value)}`)
    const secretKeys = effAll.flatMap(keysOf).filter((k) => k.secret === true)
    check('4c SECRET 키는 ref 형식(env:/file:)·null 만 + exists boolean', secretKeys.length > 0 && secretKeys.every((k) => (k.value === null || /^(env:[A-Z0-9_]+|file:[a-z0-9][a-z0-9.-]{2,63})$/.test(String(k.value))) && typeof k.exists === 'boolean'), secretKeys.map((k) => `${k.value}:${k.exists}`).join(' '))
    const effAdmin = await api('ADMIN', 'GET', `/api/admin/v1/config/effective?scope=ENGINE_CONNECTION&targetId=${ids.claude}`)
    check('4d ADMIN 요약: sourceRef·layers 없음, shadowed 는 있음', d(effAdmin).detail === 'SUMMARY' && keysOf(effAdmin).every((k) => !('sourceRef' in k) && !('layers' in k) && typeof k.shadowed === 'boolean'))
    const fb = await api('DEVELOPER', 'GET', '/api/admin/v1/config/effective?scope=FALLBACK_POLICY&targetId=LLM')
    check('4e FALLBACK_POLICY scope(역할 이름) 해석', fb.status === 200 && keysOf(fb).some((k) => k.key === 'primaryConnectionId' && k.source === 'DATABASE'))
    const bad = await Promise.all([
      api('DEVELOPER', 'GET', '/api/admin/v1/config/effective?scope=PROMPT&targetId=talk'),
      api('DEVELOPER', 'GET', '/api/admin/v1/config/effective?scope=NOPE&targetId=x'),
      api('DEVELOPER', 'GET', `/api/admin/v1/config/effective?scope=ENGINE_CONNECTION&targetId=${ids.claude}&context=user:${qaUser.id}`),
      api('DEVELOPER', 'GET', '/api/admin/v1/config/effective?scope=ENGINE_CONNECTION&targetId=no-such-connection'),
      api('DEVELOPER', 'GET', `/api/admin/v1/config/effective?scope=ENGINE_CONNECTION&targetId=${ids.prodWhisper}`),
    ])
    check('4f 미지원 scope·잘못된 scope·context 400, 없는 대상·다른 환경 id 404', bad.map((r) => r.status).join(',') === '400,400,400,404,404', bad.map((r) => r.status).join(','))
    const schema = await api('DEVELOPER', 'GET', '/api/admin/v1/config/schema/claude-cli')
    check('4g #103 schema: keys[]·editability·envAlias, 내부 envSecretAlias 비노출', schema.status === 200 && Array.isArray(d(schema).keys) && !schema.text.includes('envSecretAlias'))

    // ── 6. Secrets ─────────────────────────────────────────────────────────────
    const auditBefore = await prisma.auditLog.count({ where: { actorUserId: qaAdmin.id, action: 'secrets.read_ref' } })
    const sec = await api('ADMIN', 'GET', '/api/admin/v1/secrets')
    const sec2 = await api('ADMIN', 'GET', '/api/admin/v1/secrets')
    const auditAfter = await prisma.auditLog.count({ where: { actorUserId: qaAdmin.id, action: 'secrets.read_ref' } })
    const items = arr(sec)
    // task-012c(Codex C1 CX-1): #101 에 allowedFor[](connection key)가 더해졌다 — 값 필드가 없다는 검사는 그대로.
    check(
      '6a #101: ref·source·exists·usedBy·allowedFor·lastUsedAt 만(값 필드 없음)',
      sec.status === 200 && items.length > 0 && items.every((i) => Object.keys(i).sort().join(',') === 'allowedFor,exists,lastUsedAt,mtime,ref,source,usedBy' && Array.isArray(i.allowedFor) && (i.allowedFor as unknown[]).every((k) => typeof k === 'string')),
      JSON.stringify(items).slice(0, 200),
    )
    check('6b 조회마다 AuditLog(secrets.read_ref) 1행', auditAfter - auditBefore === 2 && sec2.status === 200, `${auditAfter - auditBefore}`)
    const lastAudit = await prisma.auditLog.findFirst({ where: { actorUserId: qaAdmin.id, action: 'secrets.read_ref' }, orderBy: { createdAt: 'desc' } })
    check('6c 감사 행: actor 스냅샷(email·role)·environment·after 에 값 없음', lastAudit?.actorEmailSnap === 'qa-admin@thekaiwa.test' && lastAudit?.actorRoleSnap === 'ADMIN' && lastAudit?.environment === 'LOCAL' && !JSON.stringify(lastAudit?.after).includes('env:'), JSON.stringify(lastAudit?.after))

    // ── 7. 읽기 화면 데이터 ─────────────────────────────────────────────────────
    const [plugins, plugin, engines, enginesSchema, fbs, fb1, voices, voice1, traces, trace1, conns, conn1, hist] = await Promise.all([
      api('DEVELOPER', 'GET', '/api/admin/v1/plugins'),
      api('DEVELOPER', 'GET', '/api/admin/v1/plugins/claude-cli'),
      api('ADMIN', 'GET', '/api/admin/v1/engines?includeSchema=true'),
      api('DEVELOPER', 'GET', '/api/admin/v1/engines?includeSchema=true'),
      api('ADMIN', 'GET', '/api/admin/v1/fallback-policies'),
      api('ADMIN', 'GET', '/api/admin/v1/fallback-policies/REALTIME_STT'),
      api('ADMIN', 'GET', '/api/admin/v1/voices'),
      api('ADMIN', 'GET', `/api/admin/v1/voices/${ids.voice}`),
      api('DEVELOPER', 'GET', '/api/admin/v1/traces?kind=FUNCTIONAL_TEST&limit=2'),
      api('DEVELOPER', 'GET', `/api/admin/v1/traces/${ids.trace}`),
      api('ADMIN', 'GET', '/api/admin/v1/engine-connections'),
      api('ADMIN', 'GET', `/api/admin/v1/engine-connections/${ids.claude}`),
      api('ADMIN', 'GET', `/api/admin/v1/engine-connections/${ids.claude}/health?kind=FUNCTIONAL&limit=5`),
    ])
    check('7a plugins 5개 loaded(initError 없음)·상세 schema·defaultConfiguration·sourcePath', arr(plugins).length === 5 && arr(plugins).every((p) => p.loaded === true && p.initError === null) && typeof d(plugin).sourcePath === 'string' && !!d(plugin).schema)
    check('7b engines: ADMIN 은 includeSchema 여도 schema:null, DEVELOPER 는 schema', arr(engines).every((e) => e.schema === null) && arr(enginesSchema).every((e) => e.schema !== null))
    check('7c fallback 4역할 + effectiveOrder(REALTIME_STT: gateway UNAVAILABLE 은 순서에서 빠짐)', arr(fbs).length === 4 && !((d(fb1).effectiveOrder as string[]) ?? []).includes('reazon-gateway'), JSON.stringify(d(fb1).effectiveOrder))
    check('7d voices 목록·상세(모델·스타일·usage)', arr(voices).length >= 1 && arr(voices).every((v) => 'usage' in v && 'model' in v) && d(voice1).id === ids.voice)
    check('7e traces 목록(커서)·상세(steps, userId 마스킹)', arr(traces).length === 0 && Array.isArray((d(traces).items as Json[])) && (d(traces).items as Json[]).length === 2 && typeof d(traces).nextCursor === 'string' && Array.isArray(d(trace1).steps) && String(d(trace1).userId).endsWith('…'))
    check('7f connections 목록·상세(effectiveSummary·recentHealth)·#95a 기능 테스트 이력', arr(conns).length === 6 && typeof (d(conn1).effectiveSummary as Json)?.keys === 'number' && Array.isArray(d(conn1).recentHealth) && arr(hist).length >= 1 && arr(hist).every((h) => h.kind === 'FUNCTIONAL'))
    const traceBad = await api('DEVELOPER', 'GET', '/api/admin/v1/traces/../../etc/passwd')
    const role404 = await api('ADMIN', 'GET', '/api/admin/v1/fallback-policies/NOPE')
    check('7g 잘못된 traceId·역할은 404', traceBad.status === 404 && role404.status === 404, `${traceBad.status} ${role404.status}`)

    // ── 8. /settings 진입 행(화면: developer B) ───────────────────────────────
    const sUser = await api('USER', 'GET', '/settings')
    const sAdmin = await api('ADMIN', 'GET', '/settings')
    const link = (r: Res) => r.text.includes('/admin/dashboard')
    check('8a /settings: USER 에게 콘솔 진입 링크 없음', sUser.status === 200 && !link(sUser), `${sUser.status}`)
    check('8b /settings: engine.read 보유자(ADMIN)에게 콘솔 진입 링크 있음(B 화면 반영 후)', sAdmin.status === 200 && link(sAdmin), `${sAdmin.status} link=${link(sAdmin)}`)
    const pUser = await api('USER', 'GET', '/admin/dashboard')
    check('8c USER → /admin/dashboard 페이지 404(앱 공통 not-found)', pUser.status === 404)

    // ── 10. QA 역할 쿠키는 운영 도메인에서 무효 ─────────────────────────────────
    const prod = async (path: string) => {
      const r = await fetch(`${PROD_ORIGIN}${path}`, { headers: { Cookie: COOKIE.SUPER_ADMIN }, redirect: 'manual' })
      transcript.push(await r.text())
      return r.status
    }
    const p1 = await prod('/api/v1/settings/profile')
    const p2 = await prod('/admin/dashboard')
    const p3 = await prod('/api/admin/v1/me/capabilities')
    check('10 SUPER_ADMIN QA 쿠키 → 운영 도메인 401/307(관리자 API 는 401 또는 404 — 200 아님)', p1 === 401 && p2 === 307 && (p3 === 401 || p3 === 404), `${p1} ${p2} ${p3}`)
  } finally {
    // ── 정리: 이 실행이 만든 Health·Trace 삭제, LOCAL connection 상태 원복 ────────────
    await prisma.engineHealth.deleteMany({ where: { connectionId: { in: local.map((c) => c.id) }, checkedAt: { gte: startedAt } } })
    await prisma.requestTrace.deleteMany({ where: { kind: 'FUNCTIONAL_TEST', createdAt: { gte: startedAt }, user: { email: { endsWith: '@thekaiwa.test' } } } })
    for (const s of snapshot) await prisma.engineConnection.update({ where: { id: s.id }, data: { status: s.status, statusReason: s.statusReason, lastHealthAt: s.lastHealthAt, lastFunctionalAt: s.lastFunctionalAt } })
  }

  // ── 4·전체: 응답 전체에 서버 비밀값·서버 경로 0 ──────────────────────────────────
  const all = transcript.join('\n')
  const secrets = secretNeedles()
  const leaks = secrets.filter((s) => all.includes(s)).length
  check(`4h 응답 전체(${transcript.length}건)에 서버 .env 비밀값 ${secrets.length}종 grep → 0`, leaks === 0 && secrets.length >= 3, `hits=${leaks}`)
  const paths = pathNeedles()
  const pathHits = paths.filter((p) => all.includes(p))
  check('H1 응답 전체에 서버 절대 경로(/home/·/Users/·DATA_ROOT·SECRETS_DIR) 0', pathHits.length === 0, `hits=${pathHits.length}`)

  const fails = results.filter((r) => !r.ok)
  console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`)
  if (fails.length) process.exitCode = 1
}
main().finally(() => prisma.$disconnect())
