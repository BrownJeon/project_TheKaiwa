/**
 * task-003e 라이브 스모크 — 앱 STT 서버 경로(#19 config · #20 ticket · #21 utterances · internal 콜백 · 30일 정리)와,
 * gateway 가 떠 있으면 WS `/ws/speech` 끝까지(TURN 저장·MIC_TEST 미저장·티켓 재사용/위조/무start·엔진명 0)·관리자 Health.
 *
 * 실행(우분투 미러): `bash tests/live/task003e-smoke.sh [포트=3011]` — QA 쿠키(USER 2개·ADMIN) 생성·삭제를 감싼다.
 * dev 서버는 `next dev -H 127.0.0.1 -p 3011`. gateway 는 DB 의 reazon-gateway baseUrl(기본 127.0.0.1:8100)에 떠 있으면 E2E 까지 본다.
 * DB(개발·운영 공유)에 쓰는 것: QA 계정 Utterance 행(끝에 삭제)·그 wav(삭제)·QA2 임시 Chat(삭제)·LOCAL gateway connection Health 결과(끝에 상태 원복).
 * 출력에 티켓·쿠키·시크릿·전사 전문을 찍지 않는다(길이·판정만).
 */
import { readFileSync, existsSync, statSync, readdirSync, rmdirSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { verifyScopedToken } from '../../src/modules/infra/scopedToken'
import { dataPath, writeDataFile } from '../../src/modules/infra/storage'
import { purgeExpiredAudio } from '../../src/modules/speech/utterances'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [cUser, cUser2, cAdmin] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!cUser || !cUser2 || !cAdmin) throw new Error('사용: task003e-smoke.ts <user 쿠키> <user2 쿠키> <admin 쿠키>')
const ASSETS = process.env.STT_ASSETS ?? join(process.cwd(), 'speech/test-assets/stt20')
const INTERNAL = process.env.SPEECH_INTERNAL_SECRET ?? ''
if (INTERNAL.length < 16) throw new Error('SPEECH_INTERNAL_SECRET 이 .env 에 없다')

const prisma = new PrismaClient()
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
function skip(id: string, note: string): void {
  console.log(`SKIP ${id} — ${note}`)
}

interface Res {
  status: number
  headers: Headers
  json: { success?: boolean; data?: Record<string, unknown> & { code?: string; details?: Record<string, unknown> }; message?: string | null } | null
  text: string
}
const leakCorpus: string[] = []
async function call(cookie: string | null, method: string, path: string, opts: { json?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Promise<Res> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (cookie) headers.Cookie = cookie
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) body = opts.form
  const r = await fetch(`${BASE}${path}`, { method, headers, body, redirect: 'manual' })
  const text = await r.text()
  let json: Res['json'] = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  // 앱 플랫폼 #19 는 onDevice.model(네이티브 플러그인 모델 다운로드용 — #9 경로 고정)을 따로 본다(I3).
  if (!path.startsWith('/api/admin/') && !path.startsWith('/api/internal/') && opts.headers?.['X-Client-Platform'] !== 'app') {
    // 개발 서버 전용 wsUrl(loopback) 은 운영 응답에 없는 키라 누출 검사에서 뺀다(존재 여부는 따로 기록).
    leakCorpus.push(text.replace(/"wsUrl":"[^"]*"/g, ''))
    leakCorpus.push([...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\n'))
  }
  return { status: r.status, headers: r.headers, json, text }
}
const code = (r: Res) => r.json?.data?.code
const data = (r: Res) => (r.json?.data ?? {}) as Record<string, unknown>

function wav(ms: number, rate = 16_000, channels = 1): Buffer {
  const bytes = Math.round((rate * channels * 2 * ms) / 1000)
  const b = Buffer.alloc(44 + bytes)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + bytes, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(channels, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * channels * 2, 28)
  b.writeUInt16LE(channels * 2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(bytes, 40)
  for (let i = 44; i + 1 < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), i)
  return b
}

function uploadForm(audio: Buffer, extra: Record<string, string> = {}): FormData {
  const f = new FormData()
  f.set('audio', new File([new Uint8Array(audio)], 'u.wav', { type: 'audio/wav' }))
  f.set('text', extra.text ?? 'テスト')
  for (const [k, v] of Object.entries(extra)) if (k !== 'text') f.set(k, v)
  return f
}

function jwtPayload(t: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>
}

const createdUtterances = new Set<string>()
let tempChatId: string | null = null

async function main(): Promise<void> {
  const qa = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  const qa2 = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true } })
  const env = (process.env.APP_ENV ?? 'LOCAL').toUpperCase() as 'LOCAL'
  const gwConn = await prisma.engineConnection.findFirst({ where: { environment: env, role: 'REALTIME_STT', connectionType: 'HTTP' } })
  const odConn = await prisma.engineConnection.findFirst({ where: { environment: env, role: 'REALTIME_STT', connectionType: 'ONDEVICE' } })
  const gwStatusBefore = gwConn ? { status: gwConn.status, statusReason: gwConn.statusReason, lastHealthAt: gwConn.lastHealthAt } : null
  const startedAt = new Date()

  // ── A. 인증 ──────────────────────────────────────────────────────────
  check('A1 config 미인증 401', (await call(null, 'GET', '/api/v1/speech/config')).status === 401)
  check('A2 ticket 미인증 401', (await call(null, 'POST', '/api/v1/speech/ticket', { json: {} })).status === 401)
  check('A3 utterances 미인증 401', (await call(null, 'POST', '/api/v1/speech/utterances', { form: uploadForm(wav(300), { realtimeConnectionKey: 'x' }) })).status === 401)

  // ── B. #19 config ───────────────────────────────────────────────────
  const cfg = await call(cUser, 'GET', '/api/v1/speech/config')
  const c = data(cfg)
  check('B1 config 200·필수 필드', cfg.status === 200 && typeof c.configVersion === 'string' && !!c.gateway && !!c.upload && !!c.fallback, `status=${cfg.status}`)
  check('B2 웹 onDevice 세부 없음', JSON.stringify(c.onDevice) === '{"enabled":false}', JSON.stringify(c.onDevice))
  const gw = c.gateway as Record<string, unknown> | undefined
  check('B3 gateway 경로·프레임', gw?.wsPath === '/ws/speech' && gw?.frameMs === 40 && gw?.sampleRate === 16000, JSON.stringify(gw))
  const up = c.upload as Record<string, unknown> | undefined
  check('B4 업로드 상한 2MB·60초', up?.maxBytes === 2097152 && up?.maxDurationMs === 60000)
  const etag = cfg.headers.get('etag')
  const again = await call(cUser, 'GET', '/api/v1/speech/config', { headers: { 'If-None-Match': etag ?? '' } })
  check('B5 ETag 같으면 304', !!etag && again.status === 304, `etag=${etag ? 'y' : 'n'} status=${again.status}`)
  const appCfg = await call(cUser, 'GET', '/api/v1/speech/config', { headers: { 'X-Client-Platform': 'app' } })
  const od = data(appCfg).onDevice as Record<string, unknown> | undefined
  check('B6 앱 응답 ETag 다름', appCfg.status === 200 && appCfg.headers.get('etag') !== etag)
  if (od?.enabled) check('B7 앱 onDevice.connectionKey = 불투명 id', od.connectionKey === odConn?.id, String(od.connectionKey).slice(0, 6))
  else skip('B7 앱 onDevice', `enabled=false(모드 ${String(data(appCfg).recognitionMode)})`)

  // ── C. #20 ticket ───────────────────────────────────────────────────
  const t1 = await call(cUser, 'POST', '/api/v1/speech/ticket', { json: {} })
  const gatewayUp = t1.status === 200
  if (gatewayUp) {
    const tk = data(t1)
    const p = jwtPayload(String(tk.ticket))
    check('C1 티켓 200·aud ws-speech·sub=사용자·60초·purpose TURN', p.aud === 'ws-speech' && p.sub === qa.id && Number(p.exp) - Number(p.iat) === 60 && p.purpose === 'TURN' && typeof p.jti === 'string', `wsPath=${String(tk.wsPath)}`)
    check('C2 티켓에 세션 클레임 없음', p.userId === undefined && p.email === undefined)
    check('C3 서명 검증(JWT_SECRET)', !!(await verifyScopedToken(String(tk.ticket), 'ws-speech')))
    const asSession = await call(`thekaiwa_session=${String(tk.ticket)}`, 'GET', '/api/v1/speech/config')
    check('C4 티켓을 세션 쿠키로 쓰면 401', asSession.status === 401)
    const mt = await call(cUser, 'POST', '/api/v1/speech/ticket', { json: { purpose: 'MIC_TEST' } })
    check('C5 MIC_TEST 클레임', mt.status === 200 && jwtPayload(String(data(mt).ticket)).purpose === 'MIC_TEST')
    console.log(`  (dev wsUrl ${data(t1).wsUrl ? '있음' : '없음'})`)
  } else {
    check('C1 gateway 불가 → 422 ENGINE_UNAVAILABLE·STT_UNAVAILABLE', t1.status === 422 && code(t1) === 'ENGINE_UNAVAILABLE' && t1.json?.data?.details?.reason === 'STT_UNAVAILABLE', `status=${t1.status}`)
  }
  check('C6 purpose 잘못 400', (await call(cUser, 'POST', '/api/v1/speech/ticket', { json: { purpose: 'TALK' } })).status === 400)
  tempChatId = (await prisma.chat.create({ data: { userId: qa2.id, kind: 'TALK', title: 'task003e smoke' }, select: { id: true } })).id
  check('C7 남의 chatId 404', (await call(cUser, 'POST', '/api/v1/speech/ticket', { json: { chatId: tempChatId } })).status === 404)
  check('C8 없는 chatId 404', (await call(cUser, 'POST', '/api/v1/speech/ticket', { json: { chatId: 'cnotexist000000000000000' } })).status === 404)

  // ── D. internal 콜백 ────────────────────────────────────────────────
  const body = { userId: qa.id, chatId: null, durationMs: 1200, sampleRate: 16000, audioBytes: 38444, realtimeEngine: gwConn?.key ?? 'x', realtimeText: 'こんにちは', segments: [{ segIdx: 0, start: 0, end: 1200, text: 'こんにちは' }], timings: { vadMs: 5, sttMs: 200, decodeMs: 180 }, traceId: 't_smoke0000000000000000', tmpPath: 'users/x/utterances/incoming/a.wav.part' }
  const noHdr = await call(null, 'POST', '/api/internal/speech/utterances', { json: body })
  check('D1 헤더 없음 404', noHdr.status === 404)
  check('D2 시크릿 틀림 401', (await call(null, 'POST', '/api/internal/speech/utterances', { json: body, headers: { 'X-Internal-Secret': 'wrong-secret-xxxxxxxxxxxx' } })).status === 401)
  check('D3 GET 도 404(경로 숨김)', (await call(null, 'GET', '/api/internal/speech/utterances', { headers: { 'X-Internal-Secret': INTERNAL } })).status === 404)
  const H = { 'X-Internal-Secret': INTERNAL, 'X-Service': 'gateway' }
  check('D4 realtimeEngine 모름 400', (await call(null, 'POST', '/api/internal/speech/utterances', { json: { ...body, realtimeEngine: 'nope' }, headers: H })).status === 400)
  check('D5 없는 사용자 404', (await call(null, 'POST', '/api/internal/speech/utterances', { json: { ...body, userId: 'cnouser00000000000000000' }, headers: H })).status === 404)
  check('D6 userId 경로 탈출 400', (await call(null, 'POST', '/api/internal/speech/utterances', { json: { ...body, userId: '../../etc' }, headers: H })).status === 400)
  const reg = await call(null, 'POST', '/api/internal/speech/utterances', { json: body, headers: H })
  const rd = data(reg)
  if (typeof rd.utteranceId === 'string') createdUtterances.add(rd.utteranceId)
  const row = typeof rd.utteranceId === 'string' ? await prisma.utterance.findUnique({ where: { id: rd.utteranceId } }) : null
  const expectedPath = row ? `users/${qa.id}/utterances/` : ''
  check(
    'D7 콜백 200 → Utterance(RECORDED·소유자·key 스냅샷·30일)',
    reg.status === 200 && !!row && row.userId === qa.id && row.status === 'RECORDED' && row.realtimeEngine === gwConn?.key && row.realtimeText === 'こんにちは' && !!row.audioExpiresAt && Math.abs(row.audioExpiresAt.getTime() - Date.now() - 30 * 86400_000) < 60_000,
    `status=${reg.status}`,
  )
  check('D8 audioPath = DATA_ROOT 상대·id 기반, 절대경로·finalPath 응답 없음', !!row?.audioPath && row.audioPath.startsWith(expectedPath) && row.audioPath.endsWith(`/${row.id}.wav`) && rd.audioPath === row.audioPath && rd.finalPath === undefined && !String(reg.text).includes(process.env.DATA_ROOT ?? '@@'))
  check('D9 옮겨 넣을 디렉터리 준비됨', !!row?.audioPath && existsSync(join(dataPath(...row.audioPath.split('/')), '..')))

  // ── E. #21 업로드 ───────────────────────────────────────────────────
  const key = odConn?.id ?? gwConn?.id ?? 'x'
  const u1 = await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(wav(1500), { realtimeConnectionKey: key, durationMs: '1500', segments: JSON.stringify([{ start: 0, end: 1500, text: 'テスト' }]), timings: JSON.stringify({ vadMs: 3, decodeMs: 120 }) }) })
  const ud = data(u1)
  if (typeof ud.utteranceId === 'string') createdUtterances.add(ud.utteranceId)
  const urow = typeof ud.utteranceId === 'string' ? await prisma.utterance.findUnique({ where: { id: ud.utteranceId } }) : null
  check('E1 업로드 200 → RECORDED·analysisQueued false', u1.status === 200 && ud.status === 'RECORDED' && ud.analysisQueued === false && !!urow, `status=${u1.status}`)
  check('E2 key 스냅샷(id 로 보내도 key 로 저장)', !!urow && urow.realtimeEngine === (odConn?.key ?? gwConn?.key) && urow.durationMs === 1500 && urow.finalText === 'テスト')
  check('E3 wav 파일 저장(DATA_ROOT, id 기반)', !!urow?.audioPath && existsSync(dataPath(...urow.audioPath.split('/'))) && statSync(dataPath(...urow.audioPath.split('/'))).size === urow.audioBytes)
  const u2 = await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(wav(61_000), { realtimeConnectionKey: key }) })
  check('E4 61초 400 AUDIO_TOO_LONG', u2.status === 400 && u2.json?.data?.details?.reason === 'AUDIO_TOO_LONG', `status=${u2.status} ${String(u2.json?.data?.details?.reason)}`)
  const u3 = await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(wav(500, 48_000), { realtimeConnectionKey: key }) })
  check('E5 48kHz 400 AUDIO_FORMAT', u3.status === 400 && u3.json?.data?.details?.reason === 'AUDIO_FORMAT')
  const big = Buffer.concat([wav(60_000), Buffer.alloc(300_000)])
  const u4 = await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(big, { realtimeConnectionKey: key }) })
  check('E6 2MB 초과 400', u4.status === 400, `status=${u4.status}`)
  check('E7 남의 chatId 404', (await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(wav(300), { realtimeConnectionKey: key, chatId: tempChatId }) })).status === 404)
  const u6 = await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(wav(300), { realtimeConnectionKey: key, lessonId: 'l1' }) })
  check('E8 lessonId 400 FEATURE_NOT_READY', u6.status === 400 && code(u6) === 'FEATURE_NOT_READY')
  check('E9 connection 모름 400', (await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(wav(300), { realtimeConnectionKey: 'nope' }) })).status === 400)
  check('E10 JSON 본문 400', (await call(cUser, 'POST', '/api/v1/speech/utterances', { json: { text: 'x' } })).status === 400)
  // REV-013 M1: data 선언은 1초인데 뒤에 PCM 59초를 덧붙인 파일 → 400(저장 0)
  const forged = Buffer.concat([wav(1000), Buffer.alloc(32_000 * 59)])
  const u7 = await call(cUser, 'POST', '/api/v1/speech/utterances', { form: uploadForm(forged, { realtimeConnectionKey: key }) })
  check('E11 헤더 조작(선언 뒤 덧붙은 PCM) 400 AUDIO_FORMAT', u7.status === 400 && u7.json?.data?.details?.reason === 'AUDIO_FORMAT', `status=${u7.status}`)

  // ── F. 30일 정리 ────────────────────────────────────────────────────
  const oldId = `csmokepurge${Date.now().toString(36)}`.slice(0, 25)
  const oldSegs = ['users', qa.id, 'utterances', '2026-08', `${oldId}.wav`]
  await writeDataFile(oldSegs, wav(200))
  await prisma.utterance.create({ data: { id: oldId, userId: qa.id, audioPath: oldSegs.join('/'), durationMs: 200, realtimeEngine: gwConn?.key ?? 'x', realtimeText: '', audioExpiresAt: new Date(Date.now() - 60_000), createdAt: new Date(Date.now() - 31 * 86400_000) } })
  createdUtterances.add(oldId)
  const purged = await purgeExpiredAudio()
  const after = await prisma.utterance.findUnique({ where: { id: oldId } })
  check('F1 만료 wav 삭제·audioPath null·audioDeletedAt', purged >= 1 && !existsSync(dataPath(...oldSegs)) && after?.audioPath === null && !!after?.audioDeletedAt, `purged=${purged}`)
  check('F2 만료 전 파일은 그대로', !!urow?.audioPath && existsSync(dataPath(...urow.audioPath.split('/'))))

  // ── G. gateway E2E ──────────────────────────────────────────────────
  if (gatewayUp && typeof WebSocket !== 'undefined') await gatewayE2E(qa.id)
  else skip('G gateway E2E', gatewayUp ? 'WebSocket 없음(node --experimental-websocket 필요)' : '티켓 422 — gateway 미기동')

  // ── H. 관리자 Health ────────────────────────────────────────────────
  if (gwConn) {
    const h = await call(cAdmin, 'POST', `/api/admin/v1/engine-connections/${gwConn.id}/health`)
    const hs = data(h).connectionStatus
    check(`H1 관리자 gateway Health(${gatewayUp ? 'HEALTHY 기대' : 'UNAVAILABLE 기대'})`, h.status === 200 && hs === (gatewayUp ? 'HEALTHY' : 'UNAVAILABLE'), `status=${h.status} connection=${String(hs)} ok=${String(data(h).ok)}`)
  }

  // ── I. 누출 ─────────────────────────────────────────────────────────
  const corpus = leakCorpus.join('\n')
  const secretVals = [process.env.JWT_SECRET, INTERNAL, process.env.TTS_SERVICE_SECRET].filter((v): v is string => !!v && v.length >= 8)
  check('I1 사용자 응답에 엔진명·서버 주소·경로 0', !/reazon|sherpa|whisper|style-?bert|127\.0\.0\.1|:8100|credentialRef|\/home\//i.test(corpus))
  check('I2 사용자 응답에 서버 시크릿 0', !secretVals.some((v) => corpus.includes(v)))
  const appData = JSON.parse(JSON.stringify(data(appCfg))) as { onDevice?: { model?: unknown } }
  const hadModel = !!appData.onDevice?.model
  if (appData.onDevice) delete appData.onDevice.model
  check('I3 앱 #19 도 onDevice.model(플러그인 다운로드용) 밖에는 엔진명·주소 0', !/reazon|sherpa|whisper|style-?bert|127\.0\.0\.1|:8100|credentialRef|\/home\//i.test(JSON.stringify(appData)), `model 블록 ${hadModel ? '있음(003f 결정 대상)' : '없음'}`)

  // ── J. 티켓 레이트 리밋(마지막 — 60초 창을 쓴다) ──────────────────────
  let limited: Res | null = null
  for (let i = 0; i < 25 && !limited; i++) {
    const r = await call(cUser2, 'POST', '/api/v1/speech/ticket', { json: { purpose: 'MIC_TEST' } })
    if (r.status === 429) limited = r
  }
  check('J1 티켓 분당 20 → 429 + Retry-After', !!limited && !!limited.headers.get('retry-after'))

  // 원복: 이 실행의 Health 결과를 지우고 gateway connection 상태를 시작 전 값으로(LOCAL 행은 운영 프로세스도 읽는다 — 임시 gateway 로 바꾼 상태를 남기지 않는다).
  if (gwConn && gwStatusBefore) {
    await prisma.engineHealth.deleteMany({ where: { connectionId: gwConn.id, checkedAt: { gte: startedAt } } })
    await prisma.engineConnection.update({ where: { id: gwConn.id }, data: gwStatusBefore })
  }
}

async function gatewayE2E(userId: string): Promise<void> {
  const sent01 = readFileSync(join(ASSETS, '01.wav'))
  const frames = (buf: Buffer): Buffer[] => {
    const out: Buffer[] = []
    const pcm = buf.subarray(44)
    for (let i = 0; i + 1280 <= pcm.length; i += 1280) out.push(pcm.subarray(i, i + 1280))
    return out
  }
  const wsMsgs: string[] = []
  async function session(purpose: 'TURN' | 'MIC_TEST', audio: Buffer): Promise<{ final: Record<string, unknown> | null; msgs: Record<string, unknown>[]; closeCode: number | null; ms: number }> {
    const t = await call(cUser, 'POST', '/api/v1/speech/ticket', { json: { purpose } })
    const tk = data(t)
    const url = String(tk.wsUrl ?? `ws://127.0.0.1:8100${String(tk.wsPath)}`)
    return new Promise((resolve) => {
      const ws = new WebSocket(url)
      const msgs: Record<string, unknown>[] = []
      let final: Record<string, unknown> | null = null
      let stopAt = 0
      let finalMs = 0
      const done = (closeCode: number | null) => resolve({ final, msgs, closeCode, ms: finalMs })
      const timer = setTimeout(() => {
        ws.close()
        done(null)
      }, 30_000)
      ws.onopen = () => ws.send(JSON.stringify({ type: 'start', v: 1, ticket: tk.ticket, sampleRate: 16000, partial: true, clientPlatform: 'web', endpoint: 'manual' }))
      ws.onmessage = async (ev) => {
        if (typeof ev.data !== 'string') return
        wsMsgs.push(ev.data)
        const m = JSON.parse(ev.data) as Record<string, unknown>
        msgs.push(m)
        if (m.type === 'ready') {
          for (const f of frames(audio)) {
            ws.send(f)
            await new Promise((r) => setTimeout(r, 25))
          }
          stopAt = performance.now()
          ws.send(JSON.stringify({ type: 'stop' }))
        }
        if (m.type === 'final') {
          final = m
          finalMs = performance.now() - stopAt
          clearTimeout(timer)
          ws.close(1000)
          done(null)
        }
      }
      ws.onclose = (ev) => {
        clearTimeout(timer)
        done(ev.code)
      }
    })
  }
  const turn = await session('TURN', sent01)
  const tid = typeof turn.final?.utteranceId === 'string' ? turn.final.utteranceId : null
  if (tid) createdUtterances.add(tid)
  const text = String(turn.final?.text ?? '')
  check('G1 TURN 발화 → final 텍스트·utteranceId', !!turn.final && text.length > 0 && !!tid, `len=${text.length} stop→final ${Math.round(turn.ms)}ms`)
  await new Promise((r) => setTimeout(r, 500))
  const trow = tid ? await prisma.utterance.findUnique({ where: { id: tid } }) : null
  check('G2 Utterance 행(소유자·실시간 텍스트)·wav 파일', !!trow && trow.userId === userId && trow.realtimeText === text && !!trow.audioPath && existsSync(dataPath(...trow.audioPath.split('/'))))
  const before = await prisma.utterance.count({ where: { userId } })
  const mic = await session('MIC_TEST', sent01)
  const afterCount = await prisma.utterance.count({ where: { userId } })
  check('G3 MIC_TEST → final 있음·utteranceId null·행 0', !!mic.final && mic.final.utteranceId === null && afterCount === before)
  check('G4 WS 메시지에 엔진 식별값 없음', !wsMsgs.some((m) => /reazon|sherpa|"engine"|"model"|connectionKey/i.test(m)))

  // 티켓 재사용 → 4403, 위조 → 4401, start 없음 → 4401
  const t = data(await call(cUser, 'POST', '/api/v1/speech/ticket', { json: { purpose: 'MIC_TEST' } }))
  const url = String(t.wsUrl ?? `ws://127.0.0.1:8100${String(t.wsPath)}`)
  const closeOf = (ticket: string | null) =>
    new Promise<number>((resolve) => {
      const ws = new WebSocket(url)
      const timer = setTimeout(() => resolve(-1), 8_000)
      ws.onopen = () => {
        if (ticket !== null) ws.send(JSON.stringify({ type: 'start', v: 1, ticket, sampleRate: 16000, partial: true, clientPlatform: 'web' }))
      }
      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string' && JSON.parse(ev.data).type === 'ready') ws.close(1000)
      }
      ws.onclose = (ev) => {
        clearTimeout(timer)
        resolve(ev.code)
      }
    })
  const firstUse = await closeOf(String(t.ticket))
  const reuse = await closeOf(String(t.ticket))
  check('G5 티켓 재사용 4403', firstUse === 1000 && reuse === 4403, `first=${firstUse} reuse=${reuse}`)
  const forged = `${String(t.ticket).slice(0, -3)}abc`
  check('G6 위조 티켓 4401', (await closeOf(forged)) === 4401)
  check('G7 start 없이 3초 → 4401', (await closeOf(null)) === 4401)
}

main()
  .catch((e) => {
    check('RUN', false, e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  })
  .finally(async () => {
    for (const id of createdUtterances) {
      const r = await prisma.utterance.findUnique({ where: { id }, select: { audioPath: true } }).catch(() => null)
      if (r?.audioPath) {
        const p = dataPath(...r.audioPath.split('/'))
        await import('node:fs/promises').then((fs) => fs.rm(p, { force: true })).catch(() => undefined)
        try {
          const dir = join(p, '..')
          if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir)
        } catch {
          // 비어 있지 않으면 둔다
        }
      }
      await prisma.utterance.delete({ where: { id } }).catch(() => undefined)
    }
    // QA 계정 발화 디렉터리 중 빈 것만 지운다(월 → utterances → 사용자 순, 내용이 있으면 둔다).
    const qaUser = await prisma.user.findUnique({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } }).catch(() => null)
    if (qaUser) {
      const pruneEmpty = (dir: string) => {
        try {
          if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir)
        } catch {
          // 남겨 둔다
        }
      }
      const base = dataPath('users', qaUser.id, 'utterances')
      if (existsSync(base)) for (const m of readdirSync(base)) pruneEmpty(join(base, m))
      pruneEmpty(base)
      pruneEmpty(dataPath('users', qaUser.id))
    }
    if (tempChatId) await prisma.chat.delete({ where: { id: tempChatId } }).catch(() => undefined)
    await prisma.$disconnect()
    const fail = results.filter((r) => !r.ok)
    console.log(`\n결과: ${results.length - fail.length}/${results.length} PASS${fail.length ? ` · FAIL ${fail.map((f) => f.id).join(', ')}` : ''} (정리: Utterance ${createdUtterances.size}행)`)
    process.exit(fail.length ? 1 : 0)
  })
