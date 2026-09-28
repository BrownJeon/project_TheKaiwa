/**
 * task-003f 라이브 스모크(서버 — developer B) — 완료 기준 3·4·8 + C1-1 PKCE 교환.
 *
 *  A. #9·#10 `/models/ondevice-ja-v1/*`: 공개(쿠키 없음)·manifest 형식(같은 origin 절대 URL·파일별 sha256·크기·합계)·ETag/304·no-cache,
 *     파일 5개 전체를 받아 sha256 = manifest, Range 206·416·If-Range·HEAD·immutable, 경로 탈출·옛 경로·목록 밖·옛 버전 404, 동시 스트림 상한 503.
 *  B. #19 앱/웹: 앱 응답 전체에 엔진명·주소 0(003e I3 의 model 제외 없이), 모델 블록 = 불투명 id·서빙 version, 웹은 onDevice {enabled:false}.
 *  C. #8·#8a: AppRelease 행이 없으면 latest null·다운로드 404, 행이 있으면(deployer 이후) 번호 비교·다운로드 sha256 = 기록값.
 *  D. PKCE(#2·#5): challenge 없는 앱 시작 거부, code_r 만·틀린 verifier·재사용·만료는 같은 app_code_invalid, 맞는 verifier 만 세션.
 *
 * 실행(우분투 미러): `bash tests/live/task003f-smoke.sh [포트=3011]`. dev 서버는 `SPEECH_MODELS_DIR=<NFS>/speech/models next dev -H 127.0.0.1 -p 3011`
 * (배포 위치 DATA_ROOT/models 가 아직 없어 저장소 사본을 가리킨다 — 공유 DATA_ROOT 에 쓰지 않는다).
 * DB(개발·운영 공유)에 쓰는 것: QA 계정 AppAuthCode 행(끝에 삭제). AppRelease 는 읽기만(삭제 경로 없음 규칙).
 * 출력에 쿠키·코드·verifier·시크릿을 찍지 않는다.
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { bindAppAuthCode } from '../../src/modules/infra/auth/oauth/app-code'
import { pkceChallengeOf } from '../../src/modules/infra/auth/oauth/pkce'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const cUser = readFileSync(process.argv[2] ?? '', 'utf8').trim()
if (!cUser) throw new Error('사용: task003f-smoke.ts <user 쿠키>')

const prisma = new PrismaClient()
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
function skip(id: string, note: string): void {
  console.log(`SKIP ${id} — ${note}`)
}

const LEAK = /reazon|sherpa|zipformer|whisper|style-?bert|127\.0\.0\.1|:8100|credentialRef|\/home\//i
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

async function get(path: string, headers: Record<string, string> = {}, method = 'GET'): Promise<Response> {
  return fetch(`${BASE}${path}`, { method, headers, redirect: 'manual' })
}

interface ManifestFile {
  path: string
  sha256: string
  bytes: number
  url: string
}

async function models(): Promise<{ version: string; totalBytes: number } | null> {
  const r = await get('/models/ondevice-ja-v1/manifest.json')
  if (r.status === 404) {
    skip('A*', '배포본 없음(서버를 SPEECH_MODELS_DIR=<NFS>/speech/models 로 띄웠는지 확인)')
    check('A0 배포본이 없을 때 manifest 는 404(쿠키 없이도 로그인 페이지로 가지 않는다)', r.headers.get('location') === null)
    return null
  }
  const text = await r.text()
  const m = JSON.parse(text) as { id: string; version: string; totalBytes: number; baseUrl: string; files: ManifestFile[]; name?: string }
  check('A1 manifest 공개 200·JSON·no-cache·ETag', r.status === 200 && /json/.test(r.headers.get('content-type') ?? '') && r.headers.get('cache-control') === 'no-cache' && !!r.headers.get('etag'))
  const etag = r.headers.get('etag') ?? ''
  check('A2 If-None-Match → 304', (await get('/models/ondevice-ja-v1/manifest.json', { 'If-None-Match': etag })).status === 304)
  const sum = m.files.reduce((a, f) => a + f.bytes, 0)
  check('A3 manifest 형식(C1-3): id·version·파일별 sha256·크기, 합계 = totalBytes ≤ 300MiB', m.id === 'ondevice-ja-v1' && /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(m.version) && m.files.length >= 1 && m.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256) && f.bytes > 0) && sum === m.totalBytes && m.totalBytes <= 300 * 1024 * 1024, `files=${m.files.length} total=${m.totalBytes}`)
  const origin = new URL(BASE).origin
  check('A4 파일 URL = 같은 origin 절대 URL(<manifest 디렉터리>/<version>/<path>)', m.files.every((f) => f.url === `${origin}/models/ondevice-ja-v1/${m.version}/${f.path}`) && m.baseUrl === `${origin}/models/ondevice-ja-v1/${m.version}/`)

  // A5 파일 전부 받아 sha256 대조(≈170MB, localhost)
  let allOk = true
  for (const f of m.files) {
    const fr = await fetch(f.url)
    const body = Buffer.from(await fr.arrayBuffer())
    const ok = fr.status === 200 && body.length === f.bytes && sha(body) === f.sha256 && fr.headers.get('etag') === `"${f.sha256}"` && fr.headers.get('x-content-sha256') === f.sha256
    if (!ok) allOk = false
    console.log(`   ${ok ? 'ok' : 'NG'} ${f.path} ${f.bytes}B`)
  }
  check('A5 파일 5개 200·길이·sha256 = manifest·ETag = "sha256"', allOk)

  const small = [...m.files].sort((a, b) => a.bytes - b.bytes)[0]
  const whole = Buffer.from(await (await fetch(small.url)).arrayBuffer())
  const pr = await fetch(small.url, { headers: { Range: 'bytes=0-99' } })
  const part = Buffer.from(await pr.arrayBuffer())
  check('A6 Range 206·Content-Range·앞 100바이트 일치·Accept-Ranges', pr.status === 206 && pr.headers.get('content-range') === `bytes 0-99/${small.bytes}` && part.equals(whole.subarray(0, 100)) && pr.headers.get('accept-ranges') === 'bytes')
  const tail = await fetch(small.url, { headers: { Range: `bytes=${small.bytes - 10}-` } })
  check('A7 이어받기(열린 끝) 206 = 끝 10바이트', tail.status === 206 && Buffer.from(await tail.arrayBuffer()).equals(whole.subarray(small.bytes - 10)))
  const r416 = await fetch(small.url, { headers: { Range: `bytes=${small.bytes}-` } })
  check('A8 범위 밖 416 + Content-Range */size', r416.status === 416 && r416.headers.get('content-range') === `bytes */${small.bytes}`)
  const ifr = await fetch(small.url, { headers: { Range: 'bytes=0-9', 'If-Range': '"deadbeef"' } })
  check('A9 If-Range 불일치 → 200 전체', ifr.status === 200 && Buffer.from(await ifr.arrayBuffer()).length === small.bytes)
  const head = await fetch(small.url, { method: 'HEAD' })
  check('A10 HEAD 200·Content-Length·immutable', head.status === 200 && head.headers.get('content-length') === String(small.bytes) && /immutable/.test(head.headers.get('cache-control') ?? ''))

  const bad = [
    `/models/ondevice-ja-v1/${m.version}/..%2F..%2F..%2F.env`,
    `/models/ondevice-ja-v1/..%2F..%2F.env`,
    `/models/ondevice-ja-v1/%252e%252e/%252e%252e/etc/passwd`,
    `/models/ondevice-ja-v1/${m.version}/manifest.json`,
    `/models/ondevice-ja-v1/${m.version}/not-listed.onnx`,
    `/models/ondevice-ja-v1/0000-old-version/${small.path}`,
    `/models/${m.name ?? 'x'}/manifest.json`,
    `/models/other-id/manifest.json`,
    `/models/ondevice-ja-v1/${m.version}/${small.path}/x`,
  ]
  const statuses = await Promise.all(bad.map(async (p) => (await get(p)).status))
  check('A11 경로 탈출(인코딩·이중 인코딩)·원래 디렉터리 이름·목록 밖·옛 버전·다른 id 는 전부 404', statuses.every((s) => s === 404), statuses.join(','))
  // `%2e%2e` 는 URL 파서가 먼저 `..` 로 접어 /models 밖 경로(= 로그인 필요한 화면)가 된다 — 파일이 나오지 않으면 된다.
  const folded = await get('/models/ondevice-ja-v1/%2e%2e/%2e%2e/.env')
  check('A11b `%2e%2e` 는 /models 밖으로 접혀 파일을 내주지 않는다', folded.status !== 200, String(folded.status))

  // A12 동시 스트림 상한(4) — 가장 큰 파일 5개를 본문을 읽지 않고 붙잡는다.
  const big = [...m.files].sort((a, b) => b.bytes - a.bytes)[0]
  const holds: Response[] = []
  for (let i = 0; i < 4; i++) holds.push(await fetch(big.url))
  const fifth = await fetch(big.url)
  check('A12 동시 스트림 4 넘으면 503 + Retry-After', holds.every((h) => h.status === 200) && fifth.status === 503 && fifth.headers.get('retry-after') === '30', `5번째=${fifth.status}`)
  for (const h of holds) await h.body?.cancel()
  await new Promise((r) => setTimeout(r, 300))
  const after = await fetch(small.url)
  await after.arrayBuffer()
  check('A13 끊은 스트림은 자리를 돌려준다(다시 200)', after.status === 200)
  return { version: m.version, totalBytes: m.totalBytes }
}

async function speechConfig(served: { version: string; totalBytes: number } | null): Promise<void> {
  const app = await get('/api/v1/speech/config', { Cookie: cUser, 'X-Client-Platform': 'app' })
  const appText = await app.text()
  const a = (JSON.parse(appText) as { data: { onDevice?: { enabled?: boolean; available?: boolean; connectionKey?: string; model?: { id?: string; version?: string | null; manifestUrl?: string; totalBytes?: number | null } } } }).data
  check('B1 #19 앱 응답 전체에 엔진명·서버 주소·경로 0(model 블록 포함)', app.status === 200 && !LEAK.test(appText))
  const od = a.onDevice
  check('B2 #19 앱 모델 블록 = 불투명 id·불투명 manifestUrl', od?.model?.id === 'ondevice-ja-v1' && od.model.manifestUrl === '/models/ondevice-ja-v1/manifest.json')
  if (served) check('B3 #19 model.version·totalBytes = 서빙 manifest, available', od?.model?.version === served.version && od.model.totalBytes === served.totalBytes && od.available === true)
  else check('B3 배포본 없음 → model.version null·available false', od?.model?.version === null && od.available === false)
  const web = await get('/api/v1/speech/config', { Cookie: cUser })
  const w = (JSON.parse(await web.text()) as { data: { onDevice?: Record<string, unknown> } }).data
  check('B4 #19 웹은 onDevice {enabled:false} 만', JSON.stringify(w.onDevice) === '{"enabled":false}')
}

async function appVersion(): Promise<void> {
  const rows = await prisma.appRelease.findMany({ orderBy: { versionCode: 'desc' }, take: 5 })
  const v = await get('/api/app/version', { 'X-App-Build': '1', 'X-App-Version': '1.0.0' })
  const body = (await v.json()) as { success: boolean; data: Record<string, unknown> }
  check('C1 #8 공개 200·no-store', v.status === 200 && body.success && v.headers.get('cache-control') === 'no-store')
  const junk = (await (await get('/api/app/version', { 'X-App-Build': 'abc' })).json()) as { data: Record<string, unknown> }
  check('C2 #8 번호 헤더가 없거나 형식이 다르면 플래그 false', junk.data.reinstallRequired === false && junk.data.updateRequired === false)
  const bad = await Promise.all(['/app/download/..%2F.env', '/app/download/x.txt', '/app/download/%2e%2e%2f.env'].map(async (p) => (await get(p)).status))
  check('C3 /app/download 형식 밖·탈출은 404', bad.every((s) => s === 404), bad.join(','))
  if (rows.length === 0) {
    check('C4 AppRelease 행 없음 → latest null·url null·플래그 false', body.data.latest === null && body.data.latestCode === null && body.data.url === null && body.data.reinstallRequired === false)
    check('C5 행 없음 → /app/download/latest.apk 404(로그인으로 가지 않음)', (await get('/app/download/latest.apk')).status === 404)
    skip('C6', 'AppRelease 행이 생기면(deployer F5) 번호 비교·다운로드 sha256 = 기록값을 본다')
    return
  }
  const latest = rows[0]
  const d = body.data
  check('C4 #8 latest·latestCode·minSupportedCode·sha256 = 행', d.latest === latest.versionName && d.latestCode === latest.versionCode && d.minSupportedCode === latest.minSupported && d.sha256 === latest.sha256)
  const behind = (await (await get('/api/app/version', { 'X-App-Build': String(latest.versionCode - 1) })).json()) as { data: Record<string, unknown> }
  const same = (await (await get('/api/app/version', { 'X-App-Build': String(latest.versionCode) })).json()) as { data: Record<string, unknown> }
  check('C5 번호 비교: 낮으면 reinstallRequired, 같으면 false', behind.data.reinstallRequired === true && same.data.reinstallRequired === false)
  const dl = await fetch(`${BASE}/app/download/latest.apk`)
  const apk = Buffer.from(await dl.arrayBuffer())
  check('C6 다운로드 200·APK 타입·attachment·sha256 = 기록값 = 헤더', dl.status === 200 && dl.headers.get('content-type') === 'application/vnd.android.package-archive' && /attachment/.test(dl.headers.get('content-disposition') ?? '') && sha(apk) === latest.sha256 && dl.headers.get('x-content-sha256') === latest.sha256, `${apk.length}B`)
}

async function pkce(): Promise<void> {
  const noCh = await get('/api/auth/google?platform=app')
  if (noCh.status === 503) {
    skip('D1·D2', 'Google OAuth 미설정 서버')
  } else {
    check('D1 challenge 없는 앱 시작 → Google 로 가지 않고 앱 딥링크 오류', noCh.status === 302 && /^thekaiwa:\/\/auth\/callback\?error=app_login_invalid$/.test(noCh.headers.get('location') ?? ''))
    const ch = pkceChallengeOf(randomBytes(32).toString('base64url'))
    const ok = await get(`/api/auth/google?platform=app&challenge=${ch}`)
    const loc = ok.headers.get('location') ?? ''
    check('D2 challenge 있는 앱 시작 → Google 리다이렉트 + state(서명 — challenge 평문 없음)', (ok.status === 307 || ok.status === 302) && loc.startsWith('https://accounts.google.com/') && !loc.includes(ch))
  }

  const user = await prisma.user.findUnique({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  if (!user) throw new Error('QA 계정 없음')
  const verifier = randomBytes(32).toString('base64url')
  const codeR = randomBytes(32).toString('hex')
  const codeLate = randomBytes(32).toString('hex')
  const stored = bindAppAuthCode(codeR, pkceChallengeOf(verifier))
  const storedLate = bindAppAuthCode(codeLate, pkceChallengeOf(verifier))
  await prisma.appAuthCode.createMany({
    data: [
      { code: stored, userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
      { code: storedLate, userId: user.id, expiresAt: new Date(Date.now() - 1_000) },
    ],
  })
  try {
    const invalid = (r: Response) => r.status === 307 || r.status === 302 ? /\/login\?oauth_error=app_code_invalid$/.test(r.headers.get('location') ?? '') && !r.headers.get('set-cookie') : false
    check('D3 가로챈 code_r 만(verifier 없음) → app_code_invalid·쿠키 없음', invalid(await get(`/api/auth/app-exchange?code=${codeR}`)))
    check('D4 틀린 verifier → 같은 실패', invalid(await get(`/api/auth/app-exchange?code=${codeR}&verifier=${randomBytes(32).toString('base64url')}`)))
    check('D5 DB 에 저장된 결속 값을 code 로 넣어도 실패(code_r 을 되돌릴 수 없다)', invalid(await get(`/api/auth/app-exchange?code=${stored}&verifier=${verifier}`)))
    const good = await get(`/api/auth/app-exchange?code=${codeR}&verifier=${verifier}&next=${encodeURIComponent('//evil.example/x')}`)
    const gl = good.headers.get('location') ?? ''
    check('D6 맞는 verifier → 세션 쿠키 + 같은 출처 착지(오픈 리다이렉트 없음)', (good.status === 307 || good.status === 302) && /thekaiwa_session=/.test(good.headers.get('set-cookie') ?? '') && !gl.includes('evil.example') && /\/study\/today$/.test(gl))
    check('D7 재사용 → 같은 실패', invalid(await get(`/api/auth/app-exchange?code=${codeR}&verifier=${verifier}`)))
    check('D8 만료 → 같은 실패', invalid(await get(`/api/auth/app-exchange?code=${codeLate}&verifier=${verifier}`)))
  } finally {
    await prisma.appAuthCode.deleteMany({ where: { code: { in: [stored, storedLate] } } })
  }
}

async function main(): Promise<void> {
  const served = await models()
  await speechConfig(served)
  await appVersion()
  await pkce()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n== task-003f smoke: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` · FAIL ${failed.map((f) => f.id).join(',')}` : ''}`)
  process.exitCode = failed.length ? 1 : 0
}

main().finally(() => prisma.$disconnect())
