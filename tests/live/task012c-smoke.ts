/**
 * task-012c 서버 2단계 라이브 스모크 — 이력서 완료 기준 2~7·9·11·13·14(화면 12 제외, 8·10 은 1단계 게이트 스모크) 를 실제 서버 두 프로세스·실제 DB 로 친다.
 *
 *   A 권한(무세션 401·USER 404·ADMIN Form·DEVELOPER Raw·SUPER 비밀 참조, 교차 환경 403, VOICE_PROFILE 400)
 *   B Validate(rule·stage·잠금·비밀 평문 미반환·제안·x- 키·JSON_SYNTAX 줄/칸·DEPENDENCY)
 *   C Apply(기준선 v1+v2·직전 SUPERSEDED·물화·감사 1:1·변경 0·baseVersion 409·두 프로세스 동시 2요청 1건만·reason CX-3·#93 Form)
 *   D Diff(출처·verifiable·summaryHash 두 프로세스 재현)   E #105 Test(검증 불가 partial·NO_CHANGE·LLM 두 프로세스 동시 → 실행 1·TTS 후보 합성)
 *   F 효과(적용 프로세스 즉시·다른 프로세스 ≤30초 — 실시간 인식 설정 응답)   G Rollback(새 버전·ROLLED_BACK·기본값 복원·NO_CHANGE·ALREADY_ACTIVE·손상 422·droppedKeys·비밀 참조 403)
 *   H #93a·#93b(PRIMARY_IN_USE·켜기/끄기 감사·값 필드 400·허용 목록 422·해제/연결)   I #100 Fallback   J #123b AppSetting(textVersion 파생·행 없는 키 되돌리기)
 *   K #137 감사(필터·접두·LEXICON 옛 행·페이지)   L 비밀값·서버 경로·reason 원문 grep 0
 *
 * 외부 호출: Claude 1회 · M4 합성 2회. DB 는 LOCAL 행만 — 끝(finally)에 대상 행 바이트 원복·대조, 이 실행의 ConfigurationVersion·EngineHealth·Trace 삭제.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, Prisma } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3019'
const BASE2 = process.env.BASE2 ?? 'http://127.0.0.1:3020'
for (const b of [BASE, BASE2]) if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(b)) throw new Error('BASE 는 localhost 만 허용')
if ((process.env.APP_ENV ?? 'LOCAL').toUpperCase() !== 'LOCAL') throw new Error('이 스모크는 APP_ENV=LOCAL 에서만 돈다')
const [cUser, cAdmin, cDev, cSuper] = process.argv.slice(2, 6).map((f) => readFileSync(f, 'utf8').trim())
const DEV_LOGS = process.argv.slice(6)
if (!cUser || !cAdmin || !cDev || !cSuper) throw new Error('사용: task012c-smoke.ts <user> <admin> <developer> <super> 쿠키 [dev 로그…]')
const COOKIE = { USER: cUser, ADMIN: cAdmin, DEVELOPER: cDev, SUPER: cSuper } as const
type Who = keyof typeof COOKIE | 'ANON'

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
  data: Json
  code: string | undefined
  details: Json
  text: string
  headers: Headers
}
const transcript: string[] = []
async function api(who: Who, method: string, path: string, body?: unknown, opt: { base?: string; headers?: Record<string, string> } = {}): Promise<Res> {
  const h: Record<string, string> = { ...(opt.headers ?? {}) }
  if (who !== 'ANON') h.Cookie = COOKIE[who]
  if (body !== undefined) h['Content-Type'] = 'application/json'
  const r = await fetch(`${opt.base ?? BASE}${path}`, { method, headers: h, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  transcript.push(text)
  let data: Json = {}
  try {
    data = ((JSON.parse(text) as { data?: Json }).data ?? {}) as Json
  } catch {
    /* JSON 아님 */
  }
  return { status: r.status, data, code: data.code as string | undefined, details: (data.details ?? {}) as Json, text, headers: r.headers }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const A = '/api/admin/v1'
const MARK = '두루미012c표식'
const reason = (s: string) => `${MARK} ${s}`
const arr = (v: unknown) => (Array.isArray(v) ? (v as Json[]) : [])

// ── 서버 .env 비밀값(메모리에만, 출력하지 않는다) — 005b 방식 ──────────────────────
function secretNeedles(): string[] {
  const out: string[] = []
  for (const n of ['JWT_SECRET', 'GOOGLE_CLIENT_SECRET', 'SPEECH_INTERNAL_SECRET', 'SIGNUP_INVITE_CODE', 'DATABASE_URL', 'HOME_M4_API_KEY', 'AI_API_KEY', 'TTS_SERVICE_SECRET']) {
    const v = process.env[n]?.trim()
    if (v && v.length >= 8) out.push(v)
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

const CONN_KEYS = ['claude-cli-local', 'home-m4-lan', 'reazon-ondevice', 'style-bert-m4'] as const
const SETTING_KEYS = ['voice.preview.defaultText', 'voice.preview.textVersion', 'speech.review.threshold'] as const
const CONN_COLS = { connection: true, runtime: true, credentialRef: true, logLevel: true, enabled: true, status: true, statusReason: true, lastHealthAt: true, lastFunctionalAt: true } as const

async function activeNo(scope: 'ENGINE_CONNECTION' | 'FALLBACK_POLICY' | 'APP_SETTING', targetId: string): Promise<number> {
  return (await prisma.configurationVersion.findFirst({ where: { environment: 'LOCAL', scope, targetId, status: 'ACTIVE' }, select: { version: true } }))?.version ?? 0
}

async function main(): Promise<void> {
  const conns = await prisma.engineConnection.findMany({ where: { environment: 'LOCAL', key: { in: [...CONN_KEYS, 'whisper-voicevault'] } } })
  const byKey = (k: string) => conns.find((c) => c.key === k) ?? (() => { throw new Error(`LOCAL 연결 없음 ${k}`) })()
  const ID = { claude: byKey('claude-cli-local').id, m4: byKey('home-m4-lan').id, ondevice: byKey('reazon-ondevice').id, tts: byKey('style-bert-m4').id, whisper: byKey('whisper-voicevault').id }
  const llmPolicy = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { environment_role: { environment: 'LOCAL', role: 'LLM' } } })
  const connBase = await prisma.engineConnection.findMany({ where: { id: { in: Object.values(ID).filter((id) => id !== ID.whisper) } }, select: { id: true, ...CONN_COLS } })
  const settingBase = await prisma.appSetting.findMany({ where: { environment: 'LOCAL', key: { in: [...SETTING_KEYS] } } })
  const targets = [...connBase.map((c) => c.id), llmPolicy.id, ...SETTING_KEYS]
  const prior = await prisma.configurationVersion.count({ where: { environment: 'LOCAL', targetId: { in: targets } } })
  if (prior > 0) throw new Error(`LOCAL 대상에 이전 실행의 설정 버전 ${prior}행이 남아 있다 — 수동 확인 필요`)
  const qa = await prisma.user.findMany({ where: { email: { in: ['qa-bot@thekaiwa.test', 'qa-admin@thekaiwa.test', 'qa-developer@thekaiwa.test', 'qa-super@thekaiwa.test'] } }, select: { id: true, email: true } })
  const qaIds = qa.map((u) => u.id)
  console.log(`기준선: 연결 ${connBase.length} · LLM 정책 · AppSetting ${settingBase.length}/${SETTING_KEYS.length}행 · 설정 버전 0 · 시작 ${startedAt.toISOString()}`)
  const crafted: string[] = []
  let claudeCalls = 0
  let m4Calls = 0

  // 두 프로세스의 라우트 첫 컴파일을 미리 끝낸다(경합 시험이 컴파일 지연으로 순차가 되지 않게) — 잘못된 본문이라 400·쓰기 0.
  for (const base of [BASE, BASE2]) {
    for (const p of ['config/apply', 'config/test', 'config/diff', 'config/validate']) await api('ADMIN', 'POST', `${A}/${p}`, {}, { base })
    await api('USER', 'GET', '/api/v1/speech/config', undefined, { base, headers: { 'X-Client-Platform': 'app' } })
  }

  try {
    // ── A 권한 ───────────────────────────────────────────────────────────
    const vBody = { scope: 'ENGINE_CONNECTION', targetId: 'claude-cli-local', patch: { 'runtime.prewarmIdleTtlSec': 900 } }
    check('A1 무세션 POST config/validate → 401', (await api('ANON', 'POST', `${A}/config/validate`, vBody)).status === 401)
    const userHits = await Promise.all([
      api('USER', 'POST', `${A}/config/validate`, vBody),
      api('USER', 'GET', `${A}/config/versions`),
      api('USER', 'GET', `${A}/audit`),
      api('USER', 'GET', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`),
      api('USER', 'GET', `${A}/app-settings/voice.preview.defaultText`),
      api('USER', 'PUT', `${A}/engine-connections/${ID.claude}`, { runtime: { prewarm: false }, baseVersion: 0, reason: reason('x') }),
    ])
    check('A2 USER → 편집·이력·감사 API 전부 404', userHits.every((r) => r.status === 404), userHits.map((r) => r.status).join(','))
    const [aVal, aRawGet, aRawPut, aCred, aVers, aAudit] = await Promise.all([
      api('ADMIN', 'POST', `${A}/config/validate`, vBody),
      api('ADMIN', 'GET', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`),
      api('ADMIN', 'PUT', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`, { json: {}, dryRun: true }),
      api('ADMIN', 'PUT', `${A}/engine-connections/${ID.m4}/credential`, { credentialRef: null, baseVersion: 0, reason: reason('x') }),
      api('ADMIN', 'GET', `${A}/config/versions`),
      api('ADMIN', 'GET', `${A}/audit?limit=1`),
    ])
    check('A3 ADMIN — Validate 200 · Raw GET/PUT 403 · #93b 403 · 버전·감사 200', aVal.status === 200 && aVal.data.valid === true && aRawGet.status === 403 && aRawPut.status === 403 && aCred.status === 403 && aVers.status === 200 && aAudit.status === 200, [aVal, aRawGet, aRawPut, aCred, aVers, aAudit].map((r) => r.status).join(','))
    const dRaw = await api('DEVELOPER', 'GET', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`)
    const dCred = await api('DEVELOPER', 'PUT', `${A}/engine-connections/${ID.m4}/credential`, { credentialRef: null, baseVersion: 0, reason: reason('x') })
    const rawJson = (dRaw.data.json ?? {}) as Json
    check('A4 DEVELOPER — Raw GET 200(`_meta` 없음·키 정책 포함) · #93b 403', dRaw.status === 200 && !JSON.stringify(rawJson).includes('_meta') && arr(dRaw.data.keys).length > 5 && dCred.status === 403, `${dRaw.status} ${dCred.status}`)
    const sCred = await api('SUPER', 'PUT', `${A}/engine-connections/${ID.m4}/credential`, { credentialRef: 'env:HOME_M4_API_KEY', value: 'x', baseVersion: 0, reason: reason('x') })
    check('A5 SUPER_ADMIN — #93b 도달(값 필드 → 400 E_CONN_SECRET_VALUE)', sCred.status === 400 && sCred.details.reason === 'E_CONN_SECRET_VALUE', `${sCred.status} ${JSON.stringify(sCred.details)}`)
    const cross = await Promise.all([api('ADMIN', 'POST', `${A}/config/validate`, { ...vBody, environment: 'PRODUCTION' }), api('DEVELOPER', 'POST', `${A}/config/diff`, { ...vBody, environment: 'STAGING' })])
    check('A6 다른 환경 대상(ADMIN·DEVELOPER) → 403(environment.policy) — 대상 행을 읽기 전에', cross.every((r) => r.status === 403), cross.map((r) => r.status).join(','))
    const vp = await api('ADMIN', 'POST', `${A}/config/validate`, { scope: 'VOICE_PROFILE', targetId: 'teacher_haruka', patch: {} })
    check('A7 VOICE_PROFILE → 400 SCOPE_DEFERRED(D-C14 → 012c-2)', vp.status === 400 && vp.details.reason === 'SCOPE_DEFERRED', `${vp.status} ${JSON.stringify(vp.details)}`)

    // ── B Validate ───────────────────────────────────────────────────────
    const val = (who: Who, targetId: string, patch: Json, scope = 'ENGINE_CONNECTION') => api(who, 'POST', `${A}/config/validate`, { scope, targetId, patch })
    const rules = (r: Res) => arr(r.data.errors).map((e) => `${e.key}:${e.rule}${e.lock ? `/${e.lock}` : ''}`)
    const b1 = await val('ADMIN', 'claude-cli-local', { 'runtime.permissionMode': 'default', 'runtime.concurrency': 2 })
    const b2 = await val('ADMIN', 'reazon-gateway', { 'runtime.decodingMethod': 'modified_beam_search' })
    const b3 = await val('ADMIN', 'home-m4-lan', { 'connection.credentialRef': 'env:AI_API_KEY', 'connection.baseUrl': 'http://203.0.113.9:8000' })
    check('B1 잠금 — READ_ONLY → readOnly · RESTART_REQUIRED → restartRequired(CX-2) · Python 소비 → serviceManaged · 비밀 참조 → readOnly/CREDENTIAL_ONLY · 주소 고정 + 허용 밖 → readOnly/ENV_PINNED + hostNotAllowed(stage SCHEMA)',
      b1.data.valid === false && b1.data.stage === 'SCHEMA' && rules(b1).includes('runtime.permissionMode:readOnly/READ_ONLY') && rules(b1).includes('runtime.concurrency:restartRequired/RESTART_REQUIRED') &&
        rules(b2).join() === 'runtime.decodingMethod:serviceManaged/SERVICE_MANAGED' &&
        rules(b3).includes('connection.credentialRef:readOnly/CREDENTIAL_ONLY') && rules(b3).includes('connection.baseUrl:readOnly/ENV_PINNED') && rules(b3).includes('connection.baseUrl:hostNotAllowed'),
      `${rules(b1)} | ${rules(b2)} | ${rules(b3)}`)
    const plain = 'sk-live-0123456789abcdefABCDEF'
    const b4 = await val('SUPER', 'home-m4-lan', { 'connection.credentialRef': plain })
    check('B2 SUPER Validate 비밀 평문 → secretValue, 응답 어디에도 값 없음', rules(b4).join() === 'connection.credentialRef:secretValue' && !b4.text.includes(plain), rules(b4).join())
    const b5 = await val('ADMIN', 'claude-cli-local', { 'runtime.prewarmIdleTtl': 900, 'x-note': 'memo', 'runtime.prewarmMaxIdle': 9 })
    const b6 = await val('ADMIN', 'reazon-ondevice', { 'runtime.decodingMethod': 'beam', 'runtime.vad.threshold': 'high' })
    check('B3 unknownKey + suggestion · x- 경고 · max · enum · type', arr(b5.data.errors).some((e) => e.rule === 'unknownKey' && e.suggestion === 'runtime.prewarmIdleTtlSec') && arr(b5.data.warnings).some((w) => w.code === 'W_EXTENSION_KEY') && rules(b5).includes('runtime.prewarmMaxIdle:max') && rules(b6).join() === 'runtime.decodingMethod:enum,runtime.vad.threshold:type', `${rules(b5)} | ${rules(b6)}`)
    const b7 = await api('DEVELOPER', 'PUT', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`, { json: '{\n  "connection": {,\n}', dryRun: true })
    check('B4 Raw JSON 문법 오류 → 400 stage JSON_SYNTAX + 줄·칸', b7.status === 400 && b7.details.stage === 'JSON_SYNTAX' && typeof b7.details.line === 'number' && typeof b7.details.column === 'number', JSON.stringify(b7.details))
    const b8 = await val('ADMIN', llmPolicy.id, { primaryConnectionId: ID.whisper, fallbackConnectionIds: ['cmnope000000000000000000'] }, 'FALLBACK_POLICY')
    const b9 = await val('ADMIN', 'claude-cli-local', { enabled: false })
    check('B5 DEPENDENCY — 다른 역할 연결·없는 연결 · 켜진 정책의 주 연결 끄기(PRIMARY_IN_USE)', b8.data.stage === 'DEPENDENCY' && rules(b8).includes('primaryConnectionId:dependency') && rules(b8).includes('fallbackConnectionIds:reference') && b9.data.stage === 'DEPENDENCY' && String(arr(b9.data.errors)[0]?.related ?? '').startsWith('PRIMARY_IN_USE'), `${rules(b8)} | ${rules(b9)}`)

    // ── C Apply(claude-cli-local) ──────────────────────────────────────────
    const apply = (who: Who, patch: Json, baseVersion: number, extra: Json = {}, base = BASE) => api(who, 'POST', `${A}/config/apply`, { scope: 'ENGINE_CONNECTION', targetId: 'claude-cli-local', patch, baseVersion, reason: reason('적용 확인'), ...extra }, { base })
    const auditsFor = (targetId: string) => prisma.auditLog.findMany({ where: { environment: 'LOCAL', targetId, createdAt: { gte: startedAt } }, orderBy: { createdAt: 'asc' } })
    const versionsFor = (scope: 'ENGINE_CONNECTION' | 'FALLBACK_POLICY' | 'APP_SETTING', targetId: string) => prisma.configurationVersion.findMany({ where: { environment: 'LOCAL', scope, targetId }, orderBy: { version: 'asc' } })
    const eff0 = await api('ADMIN', 'GET', `${A}/config/effective?scope=ENGINE_CONNECTION&targetId=${ID.claude}`)
    const edit0 = (eff0.data.edit ?? {}) as Json
    check('C0 #102 edit — version 0(버전 없음)·키 정책(editable·lock·verifiable)', edit0.version === 0 && arr(edit0.keys).some((k) => k.key === 'runtime.prewarmIdleTtlSec' && k.editable === true && k.verifiable === 'NO') && arr(edit0.keys).some((k) => k.key === 'runtime.concurrency' && k.lock === 'RESTART_REQUIRED'), `v=${edit0.version}`)
    const c1 = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 900 }, 0)
    const v1 = await versionsFor('ENGINE_CONNECTION', ID.claude)
    const row1 = await prisma.engineConnection.findUniqueOrThrow({ where: { id: ID.claude } })
    const au1 = await auditsFor(ID.claude)
    const snapMeta = (v: (typeof v1)[number]) => ((v.snapshot as Json)?._meta as Json | undefined)?.origin
    check('C1 첫 적용 → 201 · 기준선 v1(BASELINE·작업자 없음·SUPERSEDED) + v2(ACTIVE·APPLY) · 행 물화 · 감사 config.baseline + config.apply = auditIds',
      c1.status === 201 && (c1.data.version as Json)?.version === 2 && (c1.data.baselineVersion as Json)?.version === 1 && (c1.data.previousVersion as Json)?.status === 'SUPERSEDED' &&
        v1.length === 2 && v1[0].status === 'SUPERSEDED' && v1[0].actorUserId === null && snapMeta(v1[0]) === 'BASELINE' && v1[1].status === 'ACTIVE' && snapMeta(v1[1]) === 'APPLY' &&
        (row1.runtime as Json).prewarmIdleTtlSec === 900 && au1.map((a) => a.action).join() === 'config.baseline,config.apply' && JSON.stringify(c1.data.auditIds) === JSON.stringify(au1.map((a) => a.id)),
      `${c1.status} v=${v1.map((v) => `${v.version}${v.status[0]}`).join('/')} audits=${au1.map((a) => a.action)}`)
    const env2 = (v1[1].diff ?? {}) as Json
    check('C2 버전 diff 봉투 {entries, summary, candidateHash} · 스냅샷 `_meta{schemaVersion, origin}`', Array.isArray(env2.entries) && typeof env2.summary === 'string' && String(env2.candidateHash).startsWith('sha256:') && typeof ((v1[1].snapshot as Json)._meta as Json)?.schemaVersion === 'number', String(env2.summary))
    const c3 = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 900 }, 2)
    check('C3 같은 값 다시 → 200 changed:false · 버전·감사 0', c3.status === 200 && c3.data.changed === false && (await versionsFor('ENGINE_CONNECTION', ID.claude)).length === 2 && (await auditsFor(ID.claude)).length === 2, `${c3.status}`)
    const c4 = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 1000 }, 0)
    check('C4 낡은 baseVersion → 409 VERSION_CONFLICT(currentVersion 2)', c4.status === 409 && c4.details.reason === 'VERSION_CONFLICT' && c4.details.currentVersion === 2, JSON.stringify(c4.details))
    const race = await Promise.all([apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 1200 }, 2, {}, BASE), apply('SUPER', { 'runtime.prewarmIdleTtlSec': 1500 }, 2, {}, BASE2)])
    const v3 = await versionsFor('ENGINE_CONNECTION', ID.claude)
    check('C5 두 프로세스 동시 2요청(같은 baseVersion) → 201 1건·409 1건 · 버전 +1 · ACTIVE 1', race.map((r) => r.status).sort().join() === '201,409' && v3.length === 3 && v3.filter((v) => v.status === 'ACTIVE').length === 1, `${race.map((r) => `${r.status}/${r.details.reason ?? ''}`)}`)
    const long = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 1800 }, 3, { reason: 'ㄱ'.repeat(201) })
    const secretReason = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 1800 }, 3, { reason: `${MARK} token=abcd1234efgh5678ijkl` })
    const c6 = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 1800 }, 3, { reason: `${MARK} 첫 줄\n둘째 줄\t끝` })
    const v4 = await prisma.configurationVersion.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, version: 4 } })
    const a4 = await prisma.auditLog.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, action: 'config.apply' }, orderBy: { createdAt: 'desc' } })
    check('C6 CX-3 reason — 201자 400 · 비밀 유사 422 E_REASON_SECRET_LIKE(원문 미반환·쓰기 0) · 줄바꿈·탭 → 공백(버전·감사 같은 값)',
      long.status === 400 && secretReason.status === 422 && secretReason.details.reason === 'E_REASON_SECRET_LIKE' && !secretReason.text.includes('abcd1234') && c6.status === 201 && v4?.reason === `${MARK} 첫 줄 둘째 줄 끝` && a4?.reason === v4?.reason,
      `${long.status} ${secretReason.status} ${c6.status} ${JSON.stringify(v4?.reason)}`)
    const form = await api('ADMIN', 'PUT', `${A}/engine-connections/${ID.claude}`, { runtime: { prewarmMaxIdle: 3 }, baseVersion: 4, reason: reason('Form') })
    const formName = await api('ADMIN', 'PUT', `${A}/engine-connections/${ID.claude}`, { name: 'x', baseVersion: 5, reason: reason('Form') })
    const formRestart = await api('ADMIN', 'PUT', `${A}/engine-connections/${ID.claude}`, { runtime: { concurrency: 2 }, baseVersion: 5, reason: reason('Form') })
    const formCred = await api('ADMIN', 'POST', `${A}/config/apply`, { scope: 'ENGINE_CONNECTION', targetId: 'home-m4-lan', patch: { 'connection.credentialRef': 'env:AI_API_KEY' }, baseVersion: 0, reason: reason('비밀 참조') })
    check('C7 #93 Form(ADMIN) 201 v5 · 이름 400 NOT_EDITABLE · RESTART 키 400 restartRequired · config/apply 로 credentialRef 400(CREDENTIAL_ONLY)',
      form.status === 201 && (form.data.version as Json)?.version === 5 && formName.status === 400 && formName.details.reason === 'NOT_EDITABLE' && formRestart.status === 400 && arr(formRestart.details.errors)[0]?.rule === 'restartRequired' && formCred.status === 400 && arr(formCred.details.errors)[0]?.lock === 'CREDENTIAL_ONLY',
      `${form.status} ${formName.status} ${formRestart.status} ${formCred.status}`)

    // ── D Diff ───────────────────────────────────────────────────────────
    const diffBody = { scope: 'ENGINE_CONNECTION', targetId: 'claude-cli-local', patch: { 'runtime.prewarmIdleTtlSec': 3600, 'runtime.earlySentenceTts': false } }
    const [d1, d2] = await Promise.all([api('ADMIN', 'POST', `${A}/config/diff`, diffBody), api('ADMIN', 'POST', `${A}/config/diff`, diffBody, { base: BASE2 })])
    const ch = arr(d1.data.changes)
    const ttl = ch.find((c) => c.key === 'runtime.prewarmIdleTtlSec')
    const early = ch.find((c) => c.key === 'runtime.earlySentenceTts')
    check('D1 Diff — 바뀐 키만·before/after 값·출처·verifiable(NO·YES)·blocked 없음 · LOCAL = 테스트 불요 · summaryHash 두 프로세스 동일(무상태)',
      d1.status === 200 && ch.length === 2 && ttl?.before === 1800 && ttl?.after === 3600 && ttl?.verifiable === 'NO' && early?.verifiable === 'YES' && early?.beforeSource === 'DEFAULT' && ttl?.blocked === null &&
        d1.data.testRequired === false && d1.data.productionProtected === false && d1.data.baseVersion === 5 && typeof d1.data.summaryHash === 'string' && d1.data.summaryHash === d2.data.summaryHash,
      `${d1.status} ${ch.map((c) => `${c.key}:${c.beforeSource}→${c.afterSource}/${c.verifiable}`)} same=${d1.data.summaryHash === d2.data.summaryHash}`)

    // ── E #105 Test ───────────────────────────────────────────────────────
    const t1 = await api('ADMIN', 'POST', `${A}/config/test`, { scope: 'ENGINE_CONNECTION', targetId: 'reazon-ondevice', patch: { 'runtime.partial': false } })
    check('E1 검증 방법 없는 키 → partial·testResultId 없음·untestedKeys·실행 0(CX-2)', t1.status === 200 && t1.data.status === 'partial' && t1.data.testResultId === null && JSON.stringify(t1.data.untestedKeys) === '["runtime.partial"]' && arr(t1.data.runs).length === 0, JSON.stringify(t1.data).slice(0, 200))
    const t2 = await api('ADMIN', 'POST', `${A}/config/test`, { scope: 'ENGINE_CONNECTION', targetId: 'claude-cli-local', patch: { 'runtime.prewarmMaxIdle': 3 } })
    check('E2 저장값과 같은 후보 → 400 NO_CHANGE', t2.status === 400 && t2.details.reason === 'NO_CHANGE', `${t2.status}`)
    const llmBody = { scope: 'ENGINE_CONNECTION', targetId: 'claude-cli-local', patch: { 'runtime.earlySentenceTts': false } }
    const ftBefore = await prisma.engineHealth.count({ where: { connectionId: ID.claude, kind: 'FUNCTIONAL', checkedAt: { gte: startedAt } } })
    const lt = await Promise.all([api('ADMIN', 'POST', `${A}/config/test`, llmBody), api('SUPER', 'POST', `${A}/config/test`, llmBody, { base: BASE2 })])
    const ftAfter = await prisma.engineHealth.count({ where: { connectionId: ID.claude, kind: 'FUNCTIONAL', checkedAt: { gte: startedAt } } })
    claudeCalls += ftAfter - ftBefore
    const won = lt.find((r) => r.status === 200)
    check('E3 LLM 후보 테스트 두 프로세스 동시 → 200 1건·429 1건(Claude 실행 1) · ok + testResultId + testedKeys(조각 스트리밍 끔 확인)',
      lt.map((r) => r.status).sort().join() === '200,429' && ftAfter - ftBefore === 1 && won?.data.status === 'ok' && typeof won?.data.testResultId === 'string' && JSON.stringify(won?.data.testedKeys) === '["runtime.earlySentenceTts"]',
      `${lt.map((r) => r.status)} runs=${ftAfter - ftBefore} ${won?.data.status}/${won?.data.latencyMs}ms`)
    const e4 = await apply('ADMIN', { 'runtime.earlySentenceTts': false }, 5, { testResultId: won?.data.testResultId })
    const v6 = await prisma.configurationVersion.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, version: 6 } })
    check('E4 LOCAL 적용에 testResultId → 버전 testResult{ok, testResultId, traceId}', e4.status === 201 && (v6?.testResult as Json)?.ok === true && (v6?.testResult as Json)?.testResultId === won?.data.testResultId, JSON.stringify(v6?.testResult))
    const tt = await api('ADMIN', 'POST', `${A}/config/test`, { scope: 'ENGINE_CONNECTION', targetId: 'style-bert-m4', patch: { 'connection.timeoutMs': 15000 } })
    m4Calls++
    check('E5 TTS 후보(요청 상한) → 실제 합성 ok · testResultId · 30분 만료 시각', tt.status === 200 && tt.data.status === 'ok' && typeof tt.data.testResultId === 'string' && typeof tt.data.expiresAt === 'string', `${tt.status} ${tt.data.status} ${JSON.stringify(arr(tt.data.runs)[0] ?? tt.details)}`)
    const ttsApply = await api('ADMIN', 'POST', `${A}/config/apply`, { scope: 'ENGINE_CONNECTION', targetId: 'style-bert-m4', patch: { 'connection.timeoutMs': 15000 }, baseVersion: 0, reason: reason('TTS'), testResultId: tt.data.testResultId })
    check('E6 TTS 적용 201(기준선 v1 + v2)', ttsApply.status === 201 && (ttsApply.data.version as Json)?.version === 2, `${ttsApply.status}`)

    // ── Raw JSON(DEVELOPER) ─────────────────────────────────────────────────
    const rawNow = (await api('DEVELOPER', 'GET', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`)).data
    const doc = JSON.parse(JSON.stringify(rawNow.json)) as Json
    ;(doc.runtime as Json).prewarm = false
    const dry = await api('DEVELOPER', 'PUT', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`, { json: doc, dryRun: true })
    const vAfterDry = (await versionsFor('ENGINE_CONNECTION', ID.claude)).length
    const rawApply = await api('DEVELOPER', 'PUT', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`, { json: JSON.stringify(doc), baseVersion: 6, reason: reason('Raw') })
    const removed = JSON.parse(JSON.stringify(doc)) as Json
    delete (removed.runtime as Json).tools
    const rawRemove = await api('DEVELOPER', 'PUT', `${A}/config/raw/ENGINE_CONNECTION/claude-cli-local`, { json: removed, baseVersion: 7, reason: reason('Raw'), dryRun: true })
    const v7 = await prisma.configurationVersion.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, version: 7 } })
    const rawAudit = await prisma.auditLog.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, action: 'config.raw_apply' } })
    check('R1 Raw PUT dryRun → {validation, diff}·저장 0 · 적용 → origin RAW_JSON·감사 config.raw_apply · 저장 키 지우기 → 400 required',
      dry.status === 200 && (dry.data.validation as Json)?.valid === true && arr((dry.data.diff as Json)?.changes).length === 1 && vAfterDry === 6 && rawApply.status === 201 && ((v7?.snapshot as Json)?._meta as Json)?.origin === 'RAW_JSON' && !!rawAudit && rawRemove.status === 400 && arr(rawRemove.details.errors)[0]?.rule === 'required',
      `${dry.status} ${rawApply.status} ${rawRemove.status}`)

    // ── F 효과(실시간 인식 설정 — 적용 프로세스 즉시, 다른 프로세스 ≤30초) ──────────────────
    const speechCfg = async (base: string) => ((((await api('USER', 'GET', '/api/v1/speech/config', undefined, { base, headers: { 'X-Client-Platform': 'app' } })).data.onDevice as Json)?.runtime as Json)?.vad as Json)?.silenceMs
    const before2 = await speechCfg(BASE2)
    const f1 = await api('ADMIN', 'POST', `${A}/config/apply`, { scope: 'ENGINE_CONNECTION', targetId: 'reazon-ondevice', patch: { 'runtime.vad.endpointSilenceMs': 700 }, baseVersion: 0, reason: reason('효과') })
    const tApplied = Date.now()
    const now1 = await speechCfg(BASE)
    let seen2: unknown = null
    let lagMs = -1
    while (Date.now() - tApplied < 35_000) {
      seen2 = await speechCfg(BASE2)
      if (seen2 === 700) {
        lagMs = Date.now() - tApplied
        break
      }
      await sleep(1_500)
    }
    check('F1 효과 — 적용 프로세스는 즉시(캐시 무효화), 다른 프로세스는 ≤30초 안에 새 값(#19 onDevice.vad.silenceMs)', f1.status === 201 && before2 === 500 && now1 === 700 && seen2 === 700 && lagMs >= 0 && lagMs <= 31_000, `before=${before2} now=${now1} other=${seen2} lag=${lagMs}ms`)

    // ── G Rollback ───────────────────────────────────────────────────────
    const list = await api('ADMIN', 'GET', `${A}/config/versions?scope=ENGINE_CONNECTION&targetId=claude-cli-local`)
    const items = arr(list.data.items)
    check('G1 #108 목록 — 최신순 7건·origin·integrity OK·대상 이름·작업자(기준선은 없음)·diffSummary', items.length === 7 && items[0].version === 7 && items.every((i) => i.integrity === 'OK') && items.at(-1)?.origin === 'BASELINE' && items.at(-1)?.actor === null && items[0].origin === 'RAW_JSON' && items[0].targetKey === 'claude-cli-local' && typeof items[1].diffSummary === 'string', items.map((i) => `${i.version}${String(i.origin)[0]}`).join(','))
    const vBase = await prisma.configurationVersion.findFirstOrThrow({ where: { environment: 'LOCAL', targetId: ID.claude, version: 1 } })
    const detA = await api('ADMIN', 'GET', `${A}/config/versions/${vBase.id}?compare=active`)
    const detD = await api('DEVELOPER', 'GET', `${A}/config/versions/${vBase.id}?compare=active`)
    const entKeys = arr(detA.data.entries).map((e) => e.key)
    check('G2 #108a compare=active — 되돌리면 생길 변화(없던 키 → 기본값) · ADMIN 은 스냅샷 원문 없음, DEVELOPER 는 있음', detA.status === 200 && entKeys.includes('runtime.prewarmIdleTtlSec') && arr(detA.data.entries).find((e) => e.key === 'runtime.prewarmIdleTtlSec')?.after === 600 && JSON.stringify(detA.data.snapshot) === '{}' && Object.keys((detD.data.snapshot ?? {}) as Json).includes('runtime'), entKeys.join(','))
    const rb = await api('ADMIN', 'POST', `${A}/config/versions/${vBase.id}/rollback`, { baseVersion: 7, reason: reason('되돌림') })
    const afterRb = await versionsFor('ENGINE_CONNECTION', ID.claude)
    const rowRb = await prisma.engineConnection.findUniqueOrThrow({ where: { id: ID.claude } })
    const effRb = await api('ADMIN', 'GET', `${A}/config/effective?scope=ENGINE_CONNECTION&targetId=${ID.claude}`)
    const effVal = (k: string) => arr(effRb.data.keys).find((x) => x.key === k)?.value
    check('G3 Rollback → 201 새 v8(ROLLBACK·restoredFromVersion 1) · 밀려난 v7 ROLLED_BACK · v1 상태 불변 · Effective 가 기준선 값(없던 키는 기본값)',
      rb.status === 201 && rb.data.restoredFromVersion === 1 && (rb.data.rolledBack as Json)?.status === 'ROLLED_BACK' && afterRb.find((v) => v.version === 8)?.restoredFromVersion === 1 && afterRb.find((v) => v.version === 7)?.status === 'ROLLED_BACK' && afterRb.find((v) => v.version === 1)?.status === 'SUPERSEDED' &&
        effVal('runtime.prewarmIdleTtlSec') === 600 && effVal('runtime.prewarmMaxIdle') === 2 && effVal('runtime.earlySentenceTts') === true && effVal('runtime.prewarm') === true && (rowRb.runtime as Json).concurrency === 1,
      `${rb.status} ${afterRb.map((v) => `${v.version}${v.status[0]}`).join('/')} ttl=${effVal('runtime.prewarmIdleTtlSec')}`)
    const again = await api('ADMIN', 'POST', `${A}/config/versions/${vBase.id}/rollback`, { baseVersion: 8, reason: reason('되돌림') })
    const v8id = afterRb.find((v) => v.version === 8)!.id
    const active = await api('ADMIN', 'POST', `${A}/config/versions/${v8id}/rollback`, { baseVersion: 8, reason: reason('되돌림') })
    check('G4 같은 내용 → 409 NO_CHANGE · ACTIVE 버전 → 409 ALREADY_ACTIVE', again.status === 409 && again.details.reason === 'NO_CHANGE' && active.status === 409 && active.details.reason === 'ALREADY_ACTIVE', `${again.status}/${again.details.reason} ${active.status}/${active.details.reason}`)
    const good = (afterRb.find((v) => v.version === 8)!.snapshot ?? {}) as Json
    const mk = async (version: number, snapshot: unknown) => {
      const r = await prisma.configurationVersion.create({ data: { environment: 'LOCAL', scope: 'ENGINE_CONNECTION', targetId: ID.claude, version, snapshot: snapshot as Prisma.InputJsonValue, status: 'SUPERSEDED', reason: reason('손상 시험 행') } })
      crafted.push(r.id)
      return r.id
    }
    const malformed = await mk(9, { connection: 'x' })
    const bad = await mk(10, { ...good, runtime: { ...(good.runtime as Json), prewarmIdleTtlSec: 99999 } })
    const dropped = await mk(11, { ...good, runtime: { ...(good.runtime as Json), prewarmIdleTtlSec: 700, zzzRetired: 1 } })
    const cntBefore = await prisma.configurationVersion.count({ where: { environment: 'LOCAL', targetId: ID.claude } })
    const rMal = await api('ADMIN', 'POST', `${A}/config/versions/${malformed}/rollback`, { baseVersion: 8, reason: reason('손상') })
    const rBad = await api('ADMIN', 'POST', `${A}/config/versions/${bad}/rollback`, { baseVersion: 8, reason: reason('손상') })
    const cntAfter = await prisma.configurationVersion.count({ where: { environment: 'LOCAL', targetId: ID.claude } })
    const listBad = arr((await api('ADMIN', 'GET', `${A}/config/versions?scope=ENGINE_CONNECTION&targetId=claude-cli-local&limit=3`)).data.items)
    check('G5 손상 스냅샷 422 E_SNAPSHOT_INTEGRITY(MALFORMED) · 지금 규칙 위반 422(INVALID_ENTRIES·max) · 쓰기 0 · 목록 integrity 배지',
      rMal.status === 422 && rMal.details.reason === 'E_SNAPSHOT_INTEGRITY' && rMal.details.integrity === 'MALFORMED' && rBad.status === 422 && rBad.details.integrity === 'INVALID_ENTRIES' && arr(rBad.details.issues)[0]?.rule === 'max' && cntAfter === cntBefore && listBad.some((i) => i.integrity === 'MALFORMED') && listBad.some((i) => i.integrity === 'INVALID_ENTRIES'),
      `${rMal.status}/${rMal.details.integrity} ${rBad.status}/${rBad.details.integrity}`)
    const rDrop = await api('ADMIN', 'POST', `${A}/config/versions/${dropped}/rollback`, { baseVersion: 8, reason: reason('버린 키') })
    check('G6 지금 스키마에 없는 키 → 버리고 droppedKeys 로 알림(적용 201)', rDrop.status === 201 && JSON.stringify(rDrop.data.droppedKeys) === '["runtime.zzzRetired"]' && (rDrop.data.version as Json)?.version === 12, `${rDrop.status} ${JSON.stringify(rDrop.data.droppedKeys)}`)

    // ── H #93a·#93b(home-m4-lan) ────────────────────────────────────────────
    const prim = await api('ADMIN', 'PUT', `${A}/engine-connections/${ID.claude}/enabled`, { enabled: false, baseVersion: 12, reason: reason('끄기') })
    check('H1 켜진 정책의 주 연결 끄기 → 409 PRIMARY_IN_USE(roles)·쓰기 0', prim.status === 409 && prim.details.reason === 'PRIMARY_IN_USE' && JSON.stringify(prim.details.roles) === '["LLM"]' && (await activeNo('ENGINE_CONNECTION', ID.claude)) === 12, `${prim.status} ${JSON.stringify(prim.details)}`)
    const off = await api('ADMIN', 'PUT', `${A}/engine-connections/${ID.m4}/enabled`, { enabled: false, baseVersion: 0, reason: reason('끄기') })
    const rowOff = await prisma.engineConnection.findUniqueOrThrow({ where: { id: ID.m4 } })
    const on = await api('ADMIN', 'PUT', `${A}/engine-connections/${ID.m4}/enabled`, { enabled: true, baseVersion: 2, reason: reason('켜기') })
    const rowOn = await prisma.engineConnection.findUniqueOrThrow({ where: { id: ID.m4 } })
    const m4Audits = (await auditsFor(ID.m4)).map((a) => a.action)
    check('H2 #93a 끄기 → enabled false·DISABLED · 켜기 → UNKNOWN · 감사 engine.connections.disable|enable(+기준선)', off.status === 201 && !rowOff.enabled && rowOff.status === 'DISABLED' && on.status === 201 && rowOn.enabled && rowOn.status === 'UNKNOWN' && m4Audits.join() === 'config.baseline,engine.connections.disable,engine.connections.enable', m4Audits.join())
    const cred = (body: Json) => api('SUPER', 'PUT', `${A}/engine-connections/${ID.m4}/credential`, { baseVersion: 3, reason: reason('비밀 참조'), ...body })
    const [h3a, h3b, h3c, h3d] = await Promise.all([cred({ credentialRef: 'sk-live-0123456789abcdefABCDEF' }), cred({ credentialRef: 'file:tts-service-token' }), cred({ credentialRef: 'env:JWT_SECRET' }), cred({ credentialRef: 'file:jwt-secret' })])
    check('H3 #93b 평문 400 E_CONN_SECRET_VALUE · 다른 연결의 ref·전역 거부 ref(env:·file:) 422 E_REF_NOT_ALLOWED · 쓰기 0', h3a.status === 400 && h3a.details.reason === 'E_CONN_SECRET_VALUE' && [h3b, h3c, h3d].every((r) => r.status === 422 && r.details.reason === 'E_REF_NOT_ALLOWED') && (await activeNo('ENGINE_CONNECTION', ID.m4)) === 3, [h3a, h3b, h3c, h3d].map((r) => `${r.status}/${r.details.reason}`).join(' '))
    // 이 서버에 값이 있는 허용 ref 가 있으면 연결 성공(credentials.set), 없으면 존재 확인 400(reference)·쓰기 0 — 비밀 값은 만들지 않는다.
    const secRes = (await api('SUPER', 'GET', `${A}/secrets`)).data
    const secretsList = Array.isArray(secRes) ? (secRes as Json[]) : arr(secRes.items)
    const origRef = connBase.find((c) => c.id === ID.m4)?.credentialRef ?? null
    const origExists = secretsList.some((s) => s.ref === origRef && s.exists === true)
    const clr = await cred({ credentialRef: null })
    const set = await api('SUPER', 'PUT', `${A}/engine-connections/${ID.m4}/credential`, { credentialRef: origRef, baseVersion: 4, reason: reason('비밀 참조') })
    const credAudits = await prisma.auditLog.findMany({ where: { environment: 'LOCAL', targetId: ID.m4, action: { startsWith: 'credentials.' }, createdAt: { gte: startedAt } }, orderBy: { createdAt: 'asc' } })
    const clrAfter = JSON.stringify(credAudits[0]?.after ?? null)
    check(`H4 #93b 해제 → credentials.clear(감사 before/after 는 ref 이름뿐) · 다시 연결(${origExists ? '값 있음 → credentials.set' : '서버에 값 없음 → 400 reference·쓰기 0'})`,
      clr.status === 201 && credAudits[0]?.action === 'credentials.clear' && JSON.stringify(credAudits[0]?.before ?? null).includes(String(origRef)) && clrAfter.includes('null') &&
        (origExists ? set.status === 201 && credAudits[1]?.action === 'credentials.set' : set.status === 400 && arr(set.details.errors)[0]?.rule === 'reference' && credAudits.length === 1 && (await activeNo('ENGINE_CONNECTION', ID.m4)) === 4),
      `${clr.status} ${set.status} ${credAudits.map((a) => a.action)} exists=${origExists}`)
    const v3m = await prisma.configurationVersion.findFirstOrThrow({ where: { environment: 'LOCAL', targetId: ID.m4, version: 3 } })
    const nowM4 = await activeNo('ENGINE_CONNECTION', ID.m4)
    const rbCredAdmin = await api('ADMIN', 'POST', `${A}/config/versions/${v3m.id}/rollback`, { baseVersion: nowM4, reason: reason('되돌림') })
    const rbCredSuper = await api('SUPER', 'POST', `${A}/config/versions/${v3m.id}/rollback`, { baseVersion: nowM4, reason: reason('되돌림') })
    check(`H5 비밀 참조가 달라지는 되돌리기 — ADMIN 403(credentials.manage) · SUPER ${origExists ? '201' : '422(그 ref 가 서버에 없음 — 엄격 재검증)'} · ADMIN 쓰기 0`,
      rbCredAdmin.status === 403 && (origExists ? rbCredSuper.status === 201 : rbCredSuper.status === 422 && arr(rbCredSuper.details.issues).some((i) => i.rule === 'reference')),
      `${rbCredAdmin.status} ${rbCredSuper.status} ${JSON.stringify(rbCredSuper.details).slice(0, 160)}`)

    // ── I #100 Fallback(LLM) ─────────────────────────────────────────────
    const fb = (body: Json) => api('ADMIN', 'PUT', `${A}/fallback-policies/LLM`, { reason: reason('예비 연결'), ...body })
    const i1 = await fb({ fallbackConnectionIds: [ID.m4], baseVersion: 0 })
    const i2 = await fb({ retryOnce: false, baseVersion: 2 })
    const i3 = await fb({ fallbackConnectionIds: [], baseVersion: 2 })
    const polNow = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { id: llmPolicy.id } })
    check('I1 #100 예비 연결 추가 201(기준선+v2) · retryOnce 400(NOT_CONSUMED) · 빼기 201 v3 · 행 물화', i1.status === 201 && i2.status === 400 && arr(i2.details.errors)[0]?.lock === 'NOT_CONSUMED' && i3.status === 201 && (i3.data.version as Json)?.version === 3 && JSON.stringify(polNow.fallbackConnectionIds) === '[]', `${i1.status} ${i2.status} ${i3.status}`)

    // ── J #123b AppSetting ────────────────────────────────────────────────
    const g = await api('ADMIN', 'GET', `${A}/app-settings/voice.preview.defaultText`)
    const [jPol, jAuto, jUnknown] = await Promise.all([
      api('ADMIN', 'PUT', `${A}/app-settings/override.production.enabled`, { value: true, baseVersion: 0, reason: reason('정책') }),
      api('ADMIN', 'PUT', `${A}/app-settings/voice.preview.textVersion`, { value: 9, baseVersion: 0, reason: reason('자동') }),
      api('ADMIN', 'PUT', `${A}/app-settings/no.such.key`, { value: 1, baseVersion: 0, reason: reason('없음') }),
    ])
    check('J1 GET(version 0·verifiable YES) · 정책 키·자동 키 400(readOnly) · 모르는 키 404', g.status === 200 && g.data.version === 0 && g.data.verifiable === 'YES' && jPol.status === 400 && jAuto.status === 400 && jUnknown.status === 404, `${g.status} ${jPol.status} ${jAuto.status} ${jUnknown.status}`)
    const newText = 'おはようございます。今日も元気に話しましょう。'
    let tp: Res | null = null
    for (let i = 0; i < 3; i++) {
      tp = await api('ADMIN', 'POST', `${A}/config/test`, { scope: 'APP_SETTING', targetId: 'voice.preview.defaultText', patch: { value: newText } })
      if (tp.status !== 429) break
      await sleep((Number(tp.headers.get('retry-after') ?? tp.details.retryAfterSec ?? 30) + 1) * 1_000)
    }
    m4Calls++
    check('J2 미리듣기 문장 후보 → 실제 합성 ok·testResultId(30초 슬롯은 TTS 연결 공용)', tp?.status === 200 && tp.data.status === 'ok' && typeof tp.data.testResultId === 'string', `${tp?.status} ${tp?.data.status}`)
    const jt = await api('ADMIN', 'PUT', `${A}/app-settings/voice.preview.defaultText`, { value: newText, baseVersion: 0, reason: reason('미리듣기 문장') })
    const tv = await prisma.appSetting.findUnique({ where: { environment_key: { environment: 'LOCAL', key: 'voice.preview.textVersion' } } })
    const tvVers = await versionsFor('APP_SETTING', 'voice.preview.textVersion')
    const textAudits = await prisma.auditLog.count({ where: { environment: 'LOCAL', targetId: { in: ['voice.preview.defaultText', 'voice.preview.textVersion'] }, createdAt: { gte: startedAt } } })
    check('J3 문장 변경 → 같은 트랜잭션에서 textVersion +1(파생 버전·감사) · auditIds 4(기준선 2 + 적용 2)', jt.status === 201 && arr(jt.data.derived)[0]?.targetId === 'voice.preview.textVersion' && tv?.value === 2 && tvVers.length === 2 && textAudits === 4 && arr(jt.data.auditIds).length === 4, `${jt.status} tv=${JSON.stringify(tv?.value)} audits=${textAudits}`)
    const th0 = await api('ADMIN', 'GET', `${A}/app-settings/speech.review.threshold`)
    const th1 = await api('ADMIN', 'PUT', `${A}/app-settings/speech.review.threshold`, { value: 0.9, baseVersion: 0, reason: reason('재확인 임계') })
    const thRow = await prisma.appSetting.findUnique({ where: { environment_key: { environment: 'LOCAL', key: 'speech.review.threshold' } } })
    const thBase = (await versionsFor('APP_SETTING', 'speech.review.threshold'))[0]
    const th2 = await api('ADMIN', 'POST', `${A}/config/versions/${thBase.id}/rollback`, { baseVersion: 2, reason: reason('되돌림') })
    const thGone = await prisma.appSetting.findUnique({ where: { environment_key: { environment: 'LOCAL', key: 'speech.review.threshold' } } })
    check('J4 행 없는 키(재확인 임계) — GET exists:false · 적용 → 행 생성(기준선 exists:false) · 기준선으로 되돌리기 → 행 삭제', th0.data.exists === false && th1.status === 201 && thRow?.value === 0.9 && (thBase.snapshot as Json).exists === false && th2.status === 201 && thGone === null, `${th0.data.exists} ${th1.status} ${th2.status} gone=${thGone === null}`)

    // ── N reason 저장 전 마스킹(Codex C2 ① — CX-3 는 통과하지만 마스킹 규칙에 걸리는 조각) ─────────────────
    const secretish = `${MARK} 교체 pk-live1234567890ab 옛 키 0123456789abcdef0123456789abcdef 주소 https://admin:hunter2@example.com/p`
    const leaked = (s: unknown) => typeof s !== 'string' || /pk-live|0123456789abcdef0123|hunter2/.test(s)
    const nBase = await activeNo('ENGINE_CONNECTION', ID.claude)
    const n1 = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 1200 }, nBase, { reason: secretish })
    const nVer = await prisma.configurationVersion.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, version: nBase + 1 } })
    const nAud = await prisma.auditLog.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, action: 'config.apply' }, orderBy: { createdAt: 'desc' } })
    const nList = arr((await api('ADMIN', 'GET', `${A}/config/versions?scope=ENGINE_CONNECTION&targetId=claude-cli-local&limit=1`)).data.items)[0]
    const nAudit = arr((await api('ADMIN', 'GET', `${A}/audit?targetId=${ID.claude}&action=config.apply&limit=1`)).data.items)[0]
    check('N1 reason 저장 전 마스킹 — CX-3 통과(201)·버전·감사 저장값과 #108·#137 응답에 pk- 접두·32자 hex·URL 자격증명 0(*** 로), 나머지 글자 유지',
      n1.status === 201 && !leaked(nVer?.reason) && !leaked(nAud?.reason) && !leaked(nList?.reason) && !leaked(nAudit?.reason) && String(nVer?.reason).includes('***') && String(nVer?.reason).includes('https://example.com/p') && nVer?.reason === nAud?.reason,
      `${n1.status} ${JSON.stringify(nVer?.reason)}`)
    const ja = `${MARK} 発音が不自然なので例文を差し替えます。`
    const n2 = await apply('ADMIN', { 'runtime.prewarmIdleTtlSec': 1300 }, nBase + 1, { reason: ja })
    const n2Ver = await prisma.configurationVersion.findFirst({ where: { environment: 'LOCAL', targetId: ID.claude, version: nBase + 2 } })
    const oldRow = await prisma.configurationVersion.create({ data: { environment: 'LOCAL', scope: 'ENGINE_CONNECTION', targetId: ID.claude, version: 99, snapshot: good as Prisma.InputJsonValue, status: 'SUPERSEDED', reason: `${MARK} 옛 행 pk-live1234567890ab` } })
    crafted.push(oldRow.id)
    const oldShown = arr((await api('ADMIN', 'GET', `${A}/config/versions?scope=ENGINE_CONNECTION&targetId=claude-cli-local&limit=5`)).data.items).find((i) => i.id === oldRow.id)
    const oldDetail = await api('ADMIN', 'GET', `${A}/config/versions/${oldRow.id}`)
    check('N2 평범한 일본어 이유는 바이트 그대로 저장 · 2단계 이전(마스킹 없이 저장된) 옛 행도 #108 목록·#108a 상세 응답에서 가린다',
      n2.status === 201 && n2Ver?.reason === ja && !leaked(oldShown?.reason) && String(oldShown?.reason).includes('***') && oldDetail.status === 200 && !leaked(oldDetail.data.reason),
      `${n2.status} ${JSON.stringify(oldShown?.reason)}`)

    // ── K #137 감사 ───────────────────────────────────────────────────────
    const au = await api('ADMIN', 'GET', `${A}/audit?scope=ENGINE_CONNECTION&targetId=${ID.claude}&from=${encodeURIComponent(startedAt.toISOString())}&limit=100`)
    const dbCount = await prisma.auditLog.count({ where: { environment: 'LOCAL', scope: 'ENGINE_CONNECTION', targetId: ID.claude, createdAt: { gte: startedAt } } })
    const acts = new Set(arr(au.data.items).map((i) => i.action))
    const pfx = await api('ADMIN', 'GET', `${A}/audit?action=config.&from=${encodeURIComponent(startedAt.toISOString())}&limit=100`)
    const lex = await api('ADMIN', 'GET', `${A}/audit?scope=LEXICON&limit=100`)
    const p1 = await api('ADMIN', 'GET', `${A}/audit?targetId=${ID.claude}&limit=2`)
    const p2 = await api('ADMIN', 'GET', `${A}/audit?targetId=${ID.claude}&limit=2&cursor=${encodeURIComponent(String(p1.data.nextCursor))}`)
    const p1ids = arr(p1.data.items).map((i) => i.id)
    check('K1 #137 대상·기간 필터 = DB 행 수 · action 접두(config.) · LEXICON 에 옛 scope=null lexicon.* 포함 · 커서 페이지 · versionId 링크·ip 마스킹',
      au.status === 200 && arr(au.data.items).length === dbCount && ['config.baseline', 'config.apply', 'config.raw_apply', 'config.rollback'].every((a) => acts.has(a)) &&
        arr(pfx.data.items).length > 0 && arr(pfx.data.items).every((i) => String(i.action).startsWith('config.')) &&
        arr(lex.data.items).some((i) => i.scope === null && String(i.action).startsWith('lexicon.')) &&
        p1ids.length === 2 && typeof p1.data.nextCursor === 'string' && arr(p2.data.items).every((i) => !p1ids.includes(i.id)) &&
        arr(au.data.items).some((i) => typeof i.versionId === 'string') && arr(au.data.items).every((i) => i.ip === null || String(i.ip).endsWith('/24') || String(i.ip).endsWith('/48')),
      `items=${arr(au.data.items).length}/${dbCount} lex=${arr(lex.data.items).length}`)

    // ── 감사 1:1 · 버전 수 ─────────────────────────────────────────────────
    const createdVersions = await prisma.configurationVersion.count({ where: { environment: 'LOCAL', targetId: { in: targets }, createdAt: { gte: startedAt }, id: { notIn: crafted } } })
    const createdAudits = await prisma.auditLog.count({ where: { environment: 'LOCAL', targetId: { in: targets }, createdAt: { gte: startedAt }, OR: [{ action: { startsWith: 'config.' } }, { action: { startsWith: 'credentials.' } }, { action: { startsWith: 'engine.connections.' } }], NOT: { action: { in: ['config.raw.read'] } } } })
    check('M1 감사 1:1 — 이 실행이 만든 설정 버전 수 = 설정 감사 행 수(기준선 포함)', createdVersions === createdAudits && createdVersions > 20, `versions=${createdVersions} audits=${createdAudits}`)
  } catch (e) {
    check('X 스모크 본문 중단(이후 항목 미실행)', false, e instanceof Error ? e.message : String(e))
  } finally {
    // ── 원복 ─────────────────────────────────────────────────────────────
    for (const c of connBase) {
      const { id, ...cols } = c
      await prisma.engineConnection.update({ where: { id }, data: { ...cols, connection: (cols.connection ?? Prisma.JsonNull) as Prisma.InputJsonValue, runtime: (cols.runtime ?? Prisma.JsonNull) as Prisma.InputJsonValue } })
    }
    await prisma.engineFallbackPolicy.update({ where: { id: llmPolicy.id }, data: { primaryConnectionId: llmPolicy.primaryConnectionId, fallbackConnectionIds: llmPolicy.fallbackConnectionIds as Prisma.InputJsonValue, retryOnce: llmPolicy.retryOnce, enabled: llmPolicy.enabled } })
    for (const key of SETTING_KEYS) {
      const b = settingBase.find((s) => s.key === key)
      if (!b) await prisma.appSetting.deleteMany({ where: { environment: 'LOCAL', key } })
      else await prisma.appSetting.upsert({ where: { environment_key: { environment: 'LOCAL', key } }, update: { value: b.value as Prisma.InputJsonValue, description: b.description, editability: b.editability }, create: { environment: 'LOCAL', key, value: b.value as Prisma.InputJsonValue, description: b.description, editability: b.editability } })
    }
    const delV = await prisma.configurationVersion.deleteMany({ where: { environment: 'LOCAL', targetId: { in: targets }, createdAt: { gte: startedAt } } })
    const delH = await prisma.engineHealth.deleteMany({ where: { connectionId: { in: connBase.map((c) => c.id) }, checkedAt: { gte: startedAt } } })
    const delT = await prisma.requestTrace.deleteMany({ where: { kind: 'FUNCTIONAL_TEST', createdAt: { gte: startedAt }, OR: [{ refId: { in: connBase.map((c) => c.id) } }, { userId: { in: qaIds } }] } })
    console.log(`(원복: 설정 버전 ${delV.count}행·EngineHealth ${delH.count}행·Trace ${delT.count}행 삭제, 대상 행 기준선으로 되돌림)`)
  }

  // ── 원복 대조 · grep ──────────────────────────────────────────────────────
  const connAfter = await prisma.engineConnection.findMany({ where: { id: { in: connBase.map((c) => c.id) } }, select: { id: true, ...CONN_COLS } })
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const connSame = connBase.every((b) => same(b, connAfter.find((a) => a.id === b.id)))
  const polAfter = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { id: llmPolicy.id } })
  const setAfter = await prisma.appSetting.findMany({ where: { environment: 'LOCAL', key: { in: [...SETTING_KEYS] } } })
  const setSame = setAfter.length === settingBase.length && settingBase.every((b) => { const a = setAfter.find((x) => x.key === b.key); return same([b.value, b.description, b.editability], [a?.value, a?.description, a?.editability]) })
  const leftV = await prisma.configurationVersion.count({ where: { environment: 'LOCAL', targetId: { in: [...connBase.map((c) => c.id), llmPolicy.id, ...SETTING_KEYS] } } })
  check('Z1 원복 — 연결 4행·LLM 정책·AppSetting 바이트 동일, 이 실행의 설정 버전 0', connSame && same(polAfter.fallbackConnectionIds, llmPolicy.fallbackConnectionIds) && polAfter.primaryConnectionId === llmPolicy.primaryConnectionId && polAfter.retryOnce === llmPolicy.retryOnce && setSame && leftV === 0, `conn=${connSame} setting=${setSame} versions=${leftV}`)
  const needles = secretNeedles()
  const recent = await prisma.auditLog.findMany({ where: { createdAt: { gte: startedAt }, environment: 'LOCAL' }, select: { before: true, after: true, reason: true } })
  const blob = transcript.join('\n') + JSON.stringify(recent)
  const leaks = needles.filter((s) => blob.includes(s)).length
  check(`L1 응답 전체(${transcript.length}건)·이 실행 감사 행에 서버 비밀값 ${needles.length}종 grep → 0`, leaks === 0 && needles.length >= 3, `hits=${leaks}`)
  const paths = ['/home/', '/Users/', ...['DATA_ROOT', 'SECRETS_DIR'].map((n) => process.env[n]).filter((v): v is string => !!v && v.startsWith('/'))]
  check('L2 응답 전체에 서버 절대 경로 0', !paths.some((p) => transcript.join('\n').includes(p)))
  if (DEV_LOGS.length) {
    const logs = DEV_LOGS.map((f) => (existsSync(f) ? readFileSync(f, 'utf8') : '')).join('\n')
    check('L3 dev 서버 로그에 reason 원문·표식·비밀 유사 문자열 0', !logs.includes(MARK) && !logs.includes('abcd1234efgh') && !logs.includes('첫 줄 둘째 줄'), `logs=${DEV_LOGS.length} bytes=${logs.length}`)
  }
  console.log(`외부 호출: Claude ${claudeCalls}회 · M4 합성 ${m4Calls}회`)
  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
  process.exitCode = failed.length ? 1 : 0
}

main()
  .catch((e) => {
    console.error('스모크 중단:', e instanceof Error ? e.message : e)
    process.exitCode = 2
  })
  .finally(() => prisma.$disconnect())
