/**
 * task-012c 1단계 게이트 라이브 스모크 — D-C3(a)(b)(c)·Codex C1 CX-1·CX-3·D-C9 를 실제 서버(127.0.0.1)·실제 DB 로 친다.
 *
 *   A  #101 allowedFor — 어댑터 허용 목록 기준 connection key, 허용됐지만 아무도 안 쓰는 ref 도 표시, 전역 거부 ref 0, 값 필드 0
 *   B  Health 연결 주소 허용 목록(LOCAL whisper 행 주소를 잠시 바꿔) — 허용 밖 IP·IPv4-mapped·메타데이터 주소 = 요청 0·HOST_NOT_ALLOWED,
 *      loopback·localhost(이름 → 검사한 IP 로 연결) = 통과, 리다이렉트 미추종, userinfo 거부
 *   C  home-m4 API 키 전송 대상 고정(LOCAL home-m4 행) — 서버 env 와 다른 origin(같은 127.0.0.1 다른 port·같은 host 다른 port)은
 *      Health·기능 테스트 모두 요청 0·MISCONFIGURED(TARGET_NOT_ALLOWED), 부팅 시크릿 ref = REF_NOT_ALLOWED
 *   D  기능 테스트 30초 슬롯 — 두 프로세스(BASE·BASE2)에 동시 4요청 → 실행 1·429 3, lastFunctionalAt = 시작 시각
 *   E  발음 사전 쓰기 reason(CX-3) — 비밀 유사 422 E_REASON_SECRET_LIKE·원문 미반환·행 0, 서버 로그(DEV_LOG)에 reason 원문 0
 *
 * 실행(격리 복제본): `bash tests/live/task012c-gate-smoke.sh <포트> [두 번째 포트] [dev 서버 로그 파일…]`. LLM(Claude) 호출 0 — home-m4 는 요청 자체가 없어야 한다.
 * DB: LOCAL 행만. 시작 전 대상 connection 3행(connection JSON·credentialRef·status·statusReason·lastHealthAt·lastFunctionalAt)을 기록하고 끝에
 * 바이트 그대로 되돌린 뒤 대조한다. 이 실행이 만든 EngineHealth·FUNCTIONAL_TEST Trace 는 지운다. **AuditLog 는 남는다**(불변 — QA 계정 행).
 */
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PrismaClient, type Prisma } from '@prisma/client'
import { isDeniedCredentialRef } from '../../src/modules/infra/secrets'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3019'
const BASE2 = process.env.BASE2 ?? ''
for (const b of [BASE, BASE2].filter(Boolean)) if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(b)) throw new Error('BASE 는 localhost 만 허용')
const [cAdmin, cSuper] = process.argv.slice(2, 4).map((f) => readFileSync(f, 'utf8').trim())
const DEV_LOGS = process.argv.slice(4)
if (!cAdmin || !cSuper) throw new Error('사용: task012c-gate-smoke.ts <admin 쿠키> <super 쿠키> [dev 로그…]')

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
  data: Json & { code?: string; details?: Json }
  text: string
  ms: number
}
async function api(cookie: string, method: string, path: string, body?: unknown, base = BASE): Promise<Res> {
  const t0 = performance.now()
  const r = await fetch(`${base}${path}`, { method, headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, redirect: 'manual', body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let data: Res['data'] = {}
  try {
    data = (JSON.parse(text) as { data: Res['data'] }).data ?? {}
  } catch {
    /* 본문이 JSON 이 아니면 빈 객체 */
  }
  return { status: r.status, data, text, ms: performance.now() - t0 }
}
const det = (r: Res) => (r.data.detail ?? {}) as Json

interface Listener {
  origin: string
  port: number
  hits: string[]
  close(): Promise<void>
}
/** 127.0.0.1(+ 같은 포트 ::1) 에 뜨는 기록용 서버. */
async function listener(respond: (path: string) => { status: number; body?: string; headers?: Record<string, string> }, both = false): Promise<Listener> {
  const hits: string[] = []
  const handler = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
    hits.push(`${req.method} ${req.url}${req.headers['x-api-key'] ? ' +KEY' : ''}`)
    req.resume()
    const r = respond(req.url ?? '')
    res.writeHead(r.status, { 'content-type': 'application/json', ...(r.headers ?? {}) })
    res.end(r.body ?? '')
  }
  const s4: Server = createServer(handler)
  await new Promise<void>((ok) => s4.listen(0, '127.0.0.1', ok))
  const port = (s4.address() as AddressInfo).port
  let s6: Server | null = null
  if (both) {
    s6 = createServer(handler)
    await new Promise<void>((ok, bad) => {
      s6!.once('error', bad)
      s6!.listen({ port, host: '::1', ipv6Only: true }, ok)
    }).catch(() => {
      s6 = null
    })
  }
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    hits,
    close: async () => {
      await new Promise<void>((ok) => s4.close(() => ok()))
      if (s6) await new Promise<void>((ok) => s6!.close(() => ok()))
    },
  }
}

type ConnSnap = { id: string; connection: Prisma.JsonValue; credentialRef: string | null; status: string; statusReason: string | null; lastHealthAt: Date | null; lastFunctionalAt: Date | null; enabled: boolean; runtime: Prisma.JsonValue }
const snapOf = (c: ConnSnap) => JSON.stringify([c.connection, c.credentialRef, c.status, c.statusReason, c.lastHealthAt?.toISOString() ?? null, c.lastFunctionalAt?.toISOString() ?? null, c.enabled, c.runtime])

async function main() {
  const keys = ['whisper-voicevault', 'home-m4-lan', 'reazon-gateway']
  const rows = await prisma.engineConnection.findMany({ where: { environment: 'LOCAL', key: { in: keys } } })
  if (rows.length !== 3) throw new Error(`LOCAL 대상 connection 3행이 없다(${rows.length})`)
  const byKey = (k: string) => rows.find((r) => r.key === k)!
  const whisper = byKey('whisper-voicevault')
  const home = byKey('home-m4-lan')
  const gateway = byKey('reazon-gateway')
  const before = new Map(rows.map((r) => [r.id, snapOf(r)]))
  const setConn = async (id: string, data: Prisma.EngineConnectionUpdateInput) => prisma.engineConnection.update({ where: { id }, data })
  const withBaseUrl = (row: typeof whisper, baseUrl: string) => ({ ...((row.connection ?? {}) as Json), baseUrl }) as Prisma.InputJsonValue
  const target = await listener(() => ({ status: 200, body: '{"status":"ok","ok":true}' }), true)
  const redirector = await listener(() => ({ status: 302, headers: { location: `${target.origin}/health` } }))
  const transcript: string[] = []

  try {
    // ── A. #101 allowedFor ─────────────────────────────────────────────
    const sec = await api(cAdmin, 'GET', '/api/admin/v1/secrets')
    transcript.push(sec.text)
    const items = (Array.isArray(sec.data) ? sec.data : []) as unknown as Json[]
    const item = (ref: string) => items.find((i) => i.ref === ref)
    check('A1 #101 키 = ref·source·exists·mtime·usedBy·allowedFor·lastUsedAt(값 필드 0)', sec.status === 200 && items.length > 0 && items.every((i) => Object.keys(i).sort().join(',') === 'allowedFor,exists,lastUsedAt,mtime,ref,source,usedBy'))
    check('A2 env:HOME_M4_API_KEY allowedFor=[home-m4-lan]·usedBy home-m4-lan', JSON.stringify(item('env:HOME_M4_API_KEY')?.allowedFor) === '["home-m4-lan"]' && ((item('env:HOME_M4_API_KEY')?.usedBy as Json[]) ?? []).some((u) => u.key === 'home-m4-lan'))
    check('A3 허용됐지만 아무도 안 쓰는 ref 도 이름만(file:home-m4-api-key·file:tts-service-token, usedBy 빈 배열)', JSON.stringify(item('file:home-m4-api-key')?.allowedFor) === '["home-m4-lan"]' && JSON.stringify(item('file:tts-service-token')?.allowedFor) === '["style-bert-m4"]' && (item('file:tts-service-token')?.usedBy as unknown[])?.length === 0)
    check('A4 전역 거부 분류 ref 는 목록에 없음', items.every((i) => !isDeniedCredentialRef(String(i.ref))), items.map((i) => i.ref).join(' '))

    // ── B. Health 연결 주소 허용 목록(whisper 행) ───────────────────────
    const health = async (baseUrl: string) => {
      await setConn(whisper.id, { connection: withBaseUrl(whisper, baseUrl) })
      const r = await api(cAdmin, 'POST', `/api/admin/v1/engine-connections/${whisper.id}/health`, {})
      transcript.push(r.text)
      return r
    }
    for (const [id, url] of [
      ['B1 허용 밖 사설 IP 10.255.255.1', 'http://10.255.255.1:8090'],
      ['B2 IPv4-mapped IPv6 [::ffff:10.0.0.1]', 'http://[::ffff:10.0.0.1]:8090'],
      ['B3 메타데이터 주소 169.254.169.254', 'http://169.254.169.254'],
      ['B4 10진 표기 공인 IP(134744072 = 8.8.8.8)', 'http://134744072:80'],
    ] as const) {
      const r = await health(url)
      check(`${id} → 200·MISCONFIGURED·HOST_NOT_ALLOWED·즉시(연결 시도 없음)`, r.status === 200 && r.data.status === 'MISCONFIGURED' && det(r).errorCode === 'HOST_NOT_ALLOWED' && r.ms < 2_000, `${r.data.status}/${det(r).errorCode} ${Math.round(r.ms)}ms`)
    }
    const okIp = await health(target.origin)
    check('B5 loopback IP → HEALTHY, 대상 서버가 GET /health 1회 받음', okIp.data.status === 'HEALTHY' && target.hits.join('|') === 'GET /health', `${okIp.data.status} hits=${target.hits.join('|')}`)
    const okName = await health(`http://localhost:${target.port}`)
    check('B6 이름(localhost) → 해석 주소가 loopback 이라 통과(검사한 IP 로 연결)', okName.data.status === 'HEALTHY' && target.hits.length === 2, `${okName.data.status}/${det(okName).errorCode ?? ''} hits=${target.hits.length}`)
    const red = await health(redirector.origin)
    check('B7 302 리다이렉트는 따라가지 않음(DEGRADED HTTP_302, 대상 요청 증가 0)', red.data.status === 'DEGRADED' && det(red).errorCode === 'HTTP_302' && redirector.hits.length === 1 && target.hits.length === 2, `${red.data.status}/${det(red).errorCode} target=${target.hits.length}`)
    const ui = await health(`http://u:p@127.0.0.1:${target.port}`)
    check('B8 userinfo → MISCONFIGURED(BAD_BASE_URL), 요청 0', ui.data.status === 'MISCONFIGURED' && det(ui).errorCode === 'BAD_BASE_URL' && target.hits.length === 2)
    check('B9 응답 detail 에 주소 문자열 없음', !transcript.join('\n').match(/10\.255\.255\.1|169\.254|ffff:10|127\.0\.0\.1:\d+/))
    await setConn(whisper.id, { connection: whisper.connection as Prisma.InputJsonValue })

    // ── C. home-m4 API 키 전송 대상 고정 ────────────────────────────────
    const homeHits = () => target.hits.filter((h) => h.includes('/v1/chat') || h.includes('+KEY')).length
    await setConn(home.id, { connection: withBaseUrl(home, target.origin) })
    const hh = await api(cAdmin, 'POST', `/api/admin/v1/engine-connections/${home.id}/health`, {})
    transcript.push(hh.text)
    const hitsBefore = target.hits.length
    check('C1 home-m4 주소 = 127.0.0.1 다른 port(env origin 밖) → Health MISCONFIGURED(TARGET_NOT_ALLOWED)·요청 0', hh.data.status === 'MISCONFIGURED' && det(hh).errorCode === 'TARGET_NOT_ALLOWED' && target.hits.length === 2, `${hh.data.status}/${det(hh).errorCode} hits=${target.hits.length}`)
    const ft = await api(cSuper, 'POST', `/api/admin/v1/engine-connections/${home.id}/test`, {})
    transcript.push(ft.text)
    check('C2 같은 주소로 기능 테스트 → MISCONFIGURED(TARGET_NOT_ALLOWED), /v1/chat·API 키 요청 0', ft.status === 200 && ft.data.status === 'MISCONFIGURED' && det(ft).errorCode === 'TARGET_NOT_ALLOWED' && homeHits() === 0 && target.hits.length === hitsBefore, `${ft.status} ${ft.data.status}/${det(ft).errorCode} chat=${homeHits()}`)
    await setConn(home.id, { connection: withBaseUrl(home, 'http://192.168.219.100:8200') })
    const hh2 = await api(cAdmin, 'POST', `/api/admin/v1/engine-connections/${home.id}/health`, {})
    transcript.push(hh2.text)
    check('C3 같은 host 다른 port(TTS 서비스 주소) → TARGET_NOT_ALLOWED(호출 0)', hh2.data.status === 'MISCONFIGURED' && det(hh2).errorCode === 'TARGET_NOT_ALLOWED' && hh2.ms < 2_000, `${det(hh2).errorCode} ${Math.round(hh2.ms)}ms`)
    await setConn(home.id, { connection: home.connection as Prisma.InputJsonValue, credentialRef: 'env:JWT_SECRET' })
    const hh3 = await api(cAdmin, 'POST', `/api/admin/v1/engine-connections/${home.id}/health`, {})
    transcript.push(hh3.text)
    check('C4 credentialRef = 부팅 시크릿(env:JWT_SECRET) → MISCONFIGURED(REF_NOT_ALLOWED)', hh3.data.status === 'MISCONFIGURED' && det(hh3).errorCode === 'REF_NOT_ALLOWED', `${hh3.data.status}/${det(hh3).errorCode}`)
    await setConn(home.id, { connection: home.connection as Prisma.InputJsonValue, credentialRef: home.credentialRef })
    const hh4 = await api(cAdmin, 'POST', `/api/admin/v1/engine-connections/${home.id}/health`, {})
    // 개발 .env 의 HOME_M4_API_KEY 가 비어 있으면 기존 판정(CREDENTIAL_MISSING)이 정답이다 — 게이트 코드(TARGET_*·REF_NOT_ALLOWED)가 아니면 된다.
    const keySet = (process.env.HOME_M4_API_KEY ?? '').trim().length > 0
    check(
      `C5 원래 주소·ref(= 서버 env origin) → 게이트 통과(키 ${keySet ? '있음 → HEALTHY' : '없음 → 기존 CREDENTIAL_MISSING'})`,
      keySet ? hh4.data.status === 'HEALTHY' : hh4.data.status === 'MISCONFIGURED' && det(hh4).errorCode === 'CREDENTIAL_MISSING',
      `${hh4.data.status}/${det(hh4).errorCode ?? ''}`,
    )

    // ── D. 기능 테스트 30초 슬롯 — 두 프로세스 동시 ────────────────────────
    await setConn(gateway.id, { lastFunctionalAt: null })
    const t0 = new Date()
    const bases = BASE2 ? [BASE, BASE2, BASE, BASE2] : [BASE, BASE, BASE, BASE]
    const race = await Promise.all(bases.map((b, i) => api(i % 2 ? cSuper : cAdmin, 'POST', `/api/admin/v1/engine-connections/${gateway.id}/test`, {}, b)))
    const statuses = race.map((r) => r.status).sort()
    const ftRows = await prisma.engineHealth.count({ where: { connectionId: gateway.id, kind: 'FUNCTIONAL', checkedAt: { gte: t0 } } })
    check(`D1 동시 4요청(${BASE2 ? '두 프로세스' : '한 프로세스'}) → 200 1건·429 3건(retryAfterSec)·FUNCTIONAL 행 1`, statuses.join(',') === '200,429,429,429' && race.filter((r) => r.status === 429).every((r) => typeof r.data.details?.retryAfterSec === 'number') && ftRows === 1, `${statuses.join(',')} rows=${ftRows}`)
    const g = await prisma.engineConnection.findUniqueOrThrow({ where: { id: gateway.id }, select: { lastFunctionalAt: true } })
    const hRow = await prisma.engineHealth.findFirst({ where: { connectionId: gateway.id, kind: 'FUNCTIONAL', checkedAt: { gte: t0 } }, select: { checkedAt: true } })
    check('D2 lastFunctionalAt = 시작 시각(≤ 결과 checkedAt, 요청 시각 이후)', !!g.lastFunctionalAt && !!hRow && g.lastFunctionalAt >= new Date(t0.getTime() - 1000) && g.lastFunctionalAt <= hRow.checkedAt, `${g.lastFunctionalAt?.toISOString()} ≤ ${hRow?.checkedAt.toISOString()}`)

    // ── E. 발음 사전 쓰기 reason(CX-3) ──────────────────────────────────
    const SECRET_REASON = 'rotate password=Zq7vXk2Pw9Lm4Rt8'
    const qa = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
    const lexCounts = () => Promise.all([prisma.pronunciationLexiconEntry.count({ where: { environment: 'LOCAL' } }), prisma.pronunciationLexiconVersion.count({ where: { environment: 'LOCAL' } })])
    const [entriesBefore, versionsBefore] = await lexCounts()
    const active = await prisma.pronunciationLexiconVersion.findFirst({ where: { environment: 'LOCAL', status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true } })
    // 만에 하나 검사가 새도 QA 계정 USER 범위 가짜 표기만 쓰인다(003g 스모크와 같은 안전 범위).
    const entry = { surface: '試験語彙', reading: 'シケンゴイ', scope: 'USER', scopeRefId: qa.id }
    const lx = await api(cAdmin, 'POST', '/api/admin/v1/lexicon', { ...entry, baseVersion: active?.version ?? 0, reason: SECRET_REASON })
    const [entriesAfter, versionsAfter] = await lexCounts()
    check('E1 비밀 유사 이유 → 422 E_REASON_SECRET_LIKE(fields.reason 같은 값)·원문 미반환·사전 행 0', lx.status === 422 && lx.data.details?.reason === 'E_REASON_SECRET_LIKE' && (lx.data.details?.fields as Json)?.reason === 'E_REASON_SECRET_LIKE' && !lx.text.includes('Zq7vXk2Pw9') && entriesAfter === entriesBefore && versionsAfter === versionsBefore, `${lx.status} ${lx.data.details?.reason}`)
    // Codex C2 ③ — 폭 0 서식 문자로 끊어도 같은 판정(서버는 NFKC + Cf·기본 무시 문자 삭제 뒤 본다).
    const hidden = await api(cAdmin, 'POST', '/api/admin/v1/lexicon', { ...entry, baseVersion: active?.version ?? 0, reason: 'rotate pass\u200Bword=\u00ADZq7vXk2Pw9Lm4Rt8' })
    const [entriesHidden, versionsHidden] = await lexCounts()
    check('E1b ZWSP·soft hyphen 으로 끊은 비밀 유사 이유 → 422 E_REASON_SECRET_LIKE·행 0', hidden.status === 422 && hidden.data.details?.reason === 'E_REASON_SECRET_LIKE' && entriesHidden === entriesBefore && versionsHidden === versionsBefore && !hidden.text.includes('Zq7vXk2Pw9'), `${hidden.status} ${hidden.data.details?.reason}`)
    const long = await api(cAdmin, 'POST', '/api/admin/v1/lexicon', { ...entry, baseVersion: active?.version ?? 0, reason: '가'.repeat(201) })
    check('E2 201자 이유 → 422 칸 오류 E_REASON(003g 계약 모양 유지)', long.status === 422 && (long.data.details?.fields as Json)?.reason === 'E_REASON', `${long.status}`)
    if (DEV_LOGS.length) {
      await new Promise((r) => setTimeout(r, 500))
      const logText = DEV_LOGS.map((f) => {
        try {
          return readFileSync(f, 'utf8')
        } catch {
          return ''
        }
      }).join('\n')
      check('E3 dev 서버 로그에 reason 원문 0(grep)', logText.length > 0 && !logText.includes('Zq7vXk2Pw9') && !logText.includes('password='), `logBytes=${logText.length}`)
    }
  } finally {
    await target.close()
    await redirector.close()
    for (const r of rows) {
      await prisma.engineConnection.update({
        where: { id: r.id },
        data: { connection: r.connection as Prisma.InputJsonValue, credentialRef: r.credentialRef, status: r.status, statusReason: r.statusReason, lastHealthAt: r.lastHealthAt, lastFunctionalAt: r.lastFunctionalAt },
      })
    }
    await prisma.engineHealth.deleteMany({ where: { connectionId: { in: rows.map((r) => r.id) }, checkedAt: { gte: startedAt } } })
    await prisma.requestTrace.deleteMany({ where: { kind: 'FUNCTIONAL_TEST', createdAt: { gte: startedAt }, refId: { in: rows.map((r) => r.id) } } })
  }
  const after = await prisma.engineConnection.findMany({ where: { id: { in: rows.map((r) => r.id) } } })
  check('Z1 대상 connection 3행 원복(주소·ref·상태·시각 바이트 대조)', after.length === 3 && after.every((r) => before.get(r.id) === snapOf(r)))
  const left = await prisma.engineHealth.count({ where: { connectionId: { in: rows.map((r) => r.id) }, checkedAt: { gte: startedAt } } })
  check('Z2 이 실행의 EngineHealth 행 정리', left === 0, `${left}`)

  const fails = results.filter((r) => !r.ok)
  console.log(`\n=== ${results.length - fails.length}/${results.length} PASS ===`)
  if (fails.length) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error('스모크 중단:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
