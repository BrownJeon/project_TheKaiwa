/**
 * task-012b 라이브 스모크 — 분석 STT 파이프라인(#21 적재 게이트·#139 claim·#140 실패·#138 결과·#22·#21a·/api/health·D-B7)을
 * 실제 dev 서버(127.0.0.1, APP_ENV=LOCAL)·실제 DB 로 친다. **QA 계정 행만** 만들고 끝에 지운다(발화·잡·분석·wav·대화·평가·기록·오늘 DAILY 복원).
 *
 * 단계(인자 1 = 단계):
 *   A  가짜 워커(HTTP 로 직접 claim/#140/#138) — 게이트 off/on·내부 인증 매트릭스·모드별 적재·백오프 3회·펜싱·AUDIO_MISSING·#138 판정/멱등·
 *      #22·#21a(동시 2요청·원문 무수정)·고아 회수·가짜 워커 2개 동시 claim 20건 중복 0·D-B7(평가 채점 텍스트, A6·A7 LLM 사용).
 *      **실제 워커가 떠 있지 않을 때만** 돌린다(잡을 뺏긴다).
 *   B  실제 워커 2개가 떠 있을 때 — stt20 20건 업로드 → 전부 ANALYZED·잡 DONE·attempts 1(중복 처리 0)·두 워커 모두 일함, 30초 발화 5건 왕복 p50/p95,
 *      신뢰도 분포.
 *   C  분석 서비스 주소가 죽은 워커 1개가 떠 있을 때 — 재시도 백오프(runAfter 를 앞당겨 가속) 3회 → FAILED·발화 FAILED. 오디오 삭제 → AUDIO_MISSING 즉시 FAILED.
 *   CLEAN  이 스모크가 만든 QA 행 정리(각 단계 끝에서도 한다).
 *
 * 실행은 `tests/live/task012b-smoke.sh`(쿠키·워커 기동). 출력에 쿠키·시크릿·전사 전문을 찍지 않는다(길이·id 만).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, type Prisma } from '@prisma/client'
import { removeDataFile } from '../../src/modules/infra/storage'
import { pickGradingTexts } from '../../src/modules/speech/analysis/grading'
import { speechAnswerOverrides } from '../../src/modules/learning/evaluation/grade'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3017'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
if (BASE.endsWith(':3010')) throw new Error('운영 포트(3010)에는 붙지 않는다')
const [PHASE, c1file, c2file] = process.argv.slice(2)
const COOKIE1 = c1file ? readFileSync(c1file, 'utf8').trim() : ''
const COOKIE2 = c2file ? readFileSync(c2file, 'utf8').trim() : ''
const SECRET = process.env.SPEECH_INTERNAL_SECRET ?? ''
const APP_ENV = (process.env.APP_ENV ?? 'LOCAL').trim().toUpperCase()
if (APP_ENV === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 돌리지 않는다')
const ASSETS = process.env.STT_ASSETS ?? join(process.cwd(), 'speech/test-assets/stt20')
const MARK = 't012b-smoke'
const prisma = new PrismaClient()
const LEAK = /whisper|reazon|sherpa|style-?bert|claude|haiku|sonnet|voicevault|realtimeEngine|analysisEngine|engineVersions|pyopenjtalk/i

type Json = Record<string, unknown>
interface Res {
  status: number
  body: { success: boolean; data: Json & { code?: string; details?: Json }; message: string | null }
  text: string
}
const results: { id: string; ok: boolean; note: string }[] = []
const metrics: Record<string, unknown> = {}
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const d = (r: Res) => r.body.data as Json
const reason = (r: Res) => (r.body.data?.details as Json | undefined)?.reason

function parse(text: string): Res['body'] {
  try {
    return JSON.parse(text)
  } catch {
    return { success: false, data: {}, message: text.slice(0, 200) }
  }
}

async function api(cookie: string | null, method: string, path: string, body?: unknown): Promise<Res> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  return { status: r.status, body: parse(text), text }
}

const WORKER_HEADERS = () => ({ 'X-Internal-Secret': SECRET, 'X-Service': 'worker', 'X-Service-Env': APP_ENV, 'Content-Type': 'application/json' })
async function internal(path: string, body: unknown, headers: Record<string, string> = WORKER_HEADERS(), method = 'POST'): Promise<Res> {
  const r = await fetch(`${BASE}${path}`, { method, headers, body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
  const text = await r.text()
  return { status: r.status, body: parse(text), text }
}
const claim = (workerId: string, max = 1) => internal('/api/internal/speech/jobs/claim', { workerId, kinds: ['ANALYSIS_STT'], max })
const fail = (jobId: string, workerId: string, error: string, retryable: boolean) => internal(`/api/internal/speech/jobs/${jobId}/result`, { workerId, status: 'FAILED', error, retryable })
function analysisBody(jobId: string, workerId: string, p: Json = {}): Json {
  return {
    jobId,
    workerId,
    analysisEngine: analysisKey,
    analysisText: 'きのう学校に行って',
    segments: [{ start: 0, end: 900, text: 'きのう学校に行って' }],
    language: 'ja',
    latencyMs: 1234,
    comparator: { similarity: 0.7, flags: [], realtimeLen: 11, analysisLen: 10, version: '1.0' },
    pronunciation: null,
    engineVersions: { analysisStt: 'smoke', reading: 'smoke' },
    traceId: 't_smoke012b',
    ...p,
  }
}
const postAnalysis = (utteranceId: string, body: Json) => internal(`/api/internal/speech/utterances/${utteranceId}/analysis`, body)

function wav(ms: number): Buffer {
  const bytes = Math.round((16_000 * 2 * ms) / 1000)
  const b = Buffer.alloc(44 + bytes)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + bytes, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(1, 22)
  b.writeUInt32LE(16_000, 24)
  b.writeUInt32LE(32_000, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(bytes, 40)
  for (let i = 44; i + 1 < b.length; i += 2) b.writeInt16LE(Math.round(Math.sin(i / 20) * 3000), i)
  return b
}

/** 여러 wav(PCM16 16k mono, 44바이트 헤더)를 이어 붙인 하나의 wav. */
function concatWav(parts: Buffer[]): Buffer {
  const pcm = Buffer.concat(parts.map((p) => p.subarray(44)))
  const h = Buffer.from(wav(0).subarray(0, 44))
  h.writeUInt32LE(36 + pcm.length, 4)
  h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

let sttKey = ''
let analysisKey = ''
const createdUtterances = new Set<string>()
/** #21 — 사용자당 30/분 제한(429)이면 Retry-After 만큼 기다렸다 다시(스모크가 한 분에 30건 넘게 올린다). */
async function upload(cookie: string, text: string, audio: Buffer = wav(900)): Promise<Res> {
  for (;;) {
    const f = new FormData()
    f.set('audio', new File([new Uint8Array(audio)], 'u.wav', { type: 'audio/wav' }))
    f.set('text', text)
    f.set('realtimeConnectionKey', sttKey)
    const r = await fetch(`${BASE}/api/v1/speech/utterances`, { method: 'POST', headers: { Cookie: cookie }, body: f })
    const t = await r.text()
    if (r.status === 429) {
      await sleep((Number(r.headers.get('retry-after') ?? '5') + 1) * 1000)
      continue
    }
    const body = parse(t)
    const id = String((body.data as Json)?.utteranceId ?? '')
    if (id) createdUtterances.add(id)
    return { status: r.status, body, text: t }
  }
}

async function uid(email: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id
}
async function setMode(userId: string, mode: 'AUTO' | 'FAST' | 'ACCURATE' | 'OFFLINE'): Promise<void> {
  await prisma.userSpeechSetting.upsert({ where: { userId }, update: { recognitionMode: mode }, create: { userId, recognitionMode: mode } })
}
const job = (utteranceId: string) => prisma.speechJob.findFirst({ where: { utteranceId, kind: 'ANALYSIS_STT' } })
/**
 * 디바운스(20초)를 기다리지 않고 바로 집히게 한다(가짜 워커 단계 가속 — 디바운스·claim 재검사 자체는 3e·3g 가 본다):
 * 이 발화들의 QUEUED 잡 runAfter 를 당기고, claim 재검사("그 사용자의 마지막 발화 20초 안이면 미룸")에 걸리지 않게 이 스모크가 만든 최근 발화를 1분 전으로.
 */
async function ready(...utteranceIds: string[]): Promise<void> {
  await prisma.utterance.updateMany({ where: { id: { in: [...createdUtterances] }, createdAt: { gt: new Date(Date.now() - 30_000) } }, data: { createdAt: new Date(Date.now() - 60_000) } })
  await prisma.speechJob.updateMany({ where: { utteranceId: { in: utteranceIds }, status: 'QUEUED' }, data: { runAfter: new Date(Date.now() - 1000) } })
}
const utt = (id: string) => prisma.utterance.findUniqueOrThrow({ where: { id } })
function pct(xs: number[], p: number): number | null {
  const v = [...xs].sort((a, b) => a - b)
  if (!v.length) return null
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))]
}

/** 이 스모크가 만든 발화(잡·분석은 Cascade)·wav, 표시한 대화·평가 정리. 실사용자 행에는 손대지 않는다(QA 사용자 조건). */
async function cleanup(qaIds: string[]): Promise<void> {
  const rows = await prisma.utterance.findMany({ where: { userId: { in: qaIds }, OR: [{ id: { in: [...createdUtterances] } }, { traceId: MARK }] }, select: { id: true, audioPath: true } })
  for (const r of rows) if (r.audioPath) await removeDataFile(r.audioPath.split('/')).catch(() => undefined)
  await prisma.utterance.deleteMany({ where: { id: { in: rows.map((r) => r.id) }, userId: { in: qaIds } } })
  await prisma.chat.deleteMany({ where: { userId: { in: qaIds }, title: MARK } })
}

// ── 단계 A ────────────────────────────────────────────────────────────

async function phaseA(u1: string, u2: string): Promise<void> {
  // A1 게이트 off(이 서버가 아직 claim 을 받지 않았을 때만 의미가 있다 — sh 가 새 서버에서 처음 돌릴 때 EXPECT_NO_WORKER=1)
  await setMode(u1, 'AUTO')
  if (process.env.EXPECT_NO_WORKER === '1') {
    const up = await upload(COOKIE1, 'きのうがっこうにいった')
    const id = String(d(up).utteranceId ?? '')
    check('1a 워커 하트비트 없음 → RECORDED·analysisQueued:false·잡 0행', up.status === 200 && d(up).status === 'RECORDED' && d(up).analysisQueued === false && (await job(id)) === null, up.text.slice(0, 160))
  } else check('1a 워커 하트비트 없음(건너뜀 — 새 서버가 아님)', true, 'EXPECT_NO_WORKER≠1')

  // A2 내부 인증 매트릭스
  const paths = ['/api/internal/speech/jobs/claim', '/api/internal/speech/jobs/cnope/result', '/api/internal/speech/utterances/cnope/analysis']
  for (const p of paths) {
    const noSecret = await internal(p, {}, { 'Content-Type': 'application/json', 'X-Service': 'worker', 'X-Service-Env': APP_ENV })
    const wrong = await internal(p, {}, { ...WORKER_HEADERS(), 'X-Internal-Secret': 'wrong-secret-0123456789' })
    const env = await internal(p, {}, { ...WORKER_HEADERS(), 'X-Service-Env': APP_ENV === 'LOCAL' ? 'PRODUCTION' : 'LOCAL' })
    const noEnv = await internal(p, {}, { 'X-Internal-Secret': SECRET, 'X-Service': 'worker', 'Content-Type': 'application/json' })
    const svc = await internal(p, {}, { ...WORKER_HEADERS(), 'X-Service': 'gateway' })
    const get = await internal(p, null, WORKER_HEADERS(), 'GET')
    check(`2 ${p.split('/').slice(4).join('/')}: 시크릿 없음 404·틀림 401·환경 다름 409 ENV_MISMATCH·환경 헤더 없음 409·서비스 다름 403·GET 404`,
      noSecret.status === 404 && wrong.status === 401 && env.status === 409 && reason(env) === 'ENV_MISMATCH' && noEnv.status === 409 && svc.status === 403 && get.status === 404,
      [noSecret, wrong, env, noEnv, svc, get].map((r) => r.status).join(','))
  }
  const big = await internal('/api/internal/speech/jobs/claim', JSON.stringify({ workerId: 'w', kinds: ['ANALYSIS_STT'], pad: 'x'.repeat(5000) }))
  const badBody = await internal('/api/internal/speech/jobs/claim', { workerId: 'w', kinds: ['ANALYSIS_STT'], max: 9 })
  const bigAnalysis = await postAnalysis('cnope', { pad: 'x'.repeat(300 * 1024) })
  check('2d 본문 상한(claim 4KB·#138 256KB)·범위 오류 → 400', big.status === 400 && badBody.status === 400 && bigAnalysis.status === 400, `${big.status},${badBody.status},${bigAnalysis.status}`)

  // A3 하트비트 → health · 적재
  const c0 = await claim('smoke-w1')
  check('3a claim(빈 큐 가능) 200 {jobs[]}', c0.status === 200 && Array.isArray(d(c0).jobs), c0.text.slice(0, 120))
  for (const j of (d(c0).jobs as Json[]) ?? []) await fail(String(j.id), 'smoke-w1', 'SMOKE_CLEAR', false)
  const h = await api(null, 'GET', '/api/health')
  const checks = (d(h).checks ?? {}) as Json
  check('3b /api/health checks.stt_analysis_worker=true(claim 하트비트)·값 boolean·엔진명 없음', h.status === 200 && checks.stt_analysis_worker === true && Object.values(checks).every((v) => typeof v === 'boolean') && !LEAK.test(h.text), JSON.stringify(checks))

  const modeCases: [string, 'AUTO' | 'FAST' | 'ACCURATE' | 'OFFLINE', boolean, number][] = [
    ['AUTO(+20초 디바운스)', 'AUTO', true, 20_000],
    ['ACCURATE(+20초)', 'ACCURATE', true, 20_000],
    ['FAST(+30초)', 'FAST', true, 30_000],
    ['OFFLINE', 'OFFLINE', false, 0],
  ]
  for (const [label, mode, queued, delay] of modeCases) {
    await setMode(u1, mode)
    const t0 = Date.now()
    const up = await upload(COOKIE1, `モード${label}`)
    const id = String(d(up).utteranceId ?? '')
    const j = await job(id)
    const row = id ? await utt(id) : null
    const okRow = queued ? j?.status === 'QUEUED' && row?.status === 'QUEUED' && Math.abs(j.runAfter.getTime() - (t0 + delay)) < 5_000 : j === null && row?.status === 'RECORDED'
    check(`3c #21 ${label} → analysisQueued:${queued}`, up.status === 200 && d(up).analysisQueued === queued && d(up).status === (queued ? 'QUEUED' : 'RECORDED') && okRow, `${String(d(up).status)} job=${j?.status ?? '-'} Δ=${j ? j.runAfter.getTime() - t0 : '-'}`)
    if (j) await prisma.speechJob.update({ where: { id: j.id }, data: { status: 'FAILED', error: 'SMOKE_CLEAR', finishedAt: new Date() } })
  }
  await setMode(u1, 'AUTO')

  // A3d gateway TURN 콜백(#21 과 같은 게이트) — gateway 흉내(X-Internal-Secret 만). 파일은 콜백 뒤에 gateway 가 옮기므로 집는 시각 +10초.
  const t0g = Date.now()
  const gw = await internal('/api/internal/speech/utterances', { userId: u1, chatId: null, durationMs: 900, sampleRate: 16000, audioBytes: 28800, realtimeEngine: sttKey, realtimeText: 'ゲートウェイ', segments: [], timings: {}, traceId: 't_smoke012bgateway0000' }, { 'X-Internal-Secret': SECRET, 'X-Service': 'gateway', 'X-Service-Env': APP_ENV, 'Content-Type': 'application/json' })
  const gid = String(d(gw).utteranceId ?? '')
  if (gid) createdUtterances.add(gid)
  const gj = gid ? await job(gid) : null
  check('3d gateway 콜백 → status QUEUED·analysisQueued:true·잡 runAfter ≈ +20초(디바운스 — 파일 이동 여유 포함)', gw.status === 200 && d(gw).status === 'QUEUED' && d(gw).analysisQueued === true && !!gj && Math.abs(gj.runAfter.getTime() - (t0g + 20_000)) < 5_000, `${gw.text.slice(0, 120)} Δ=${gj ? gj.runAfter.getTime() - t0g : '-'}`)
  if (gj) await prisma.speechJob.update({ where: { id: gj.id }, data: { status: 'FAILED', error: 'SMOKE_CLEAR', finishedAt: new Date() } })

  // A3e 사용자별 디바운스(D-B8 수정): 새 발화가 오면 같은 사용자의 QUEUED 잡을 +20초로 민다 · 만든 지 5분 지난 잡·RUNNING·다른 사용자 잡은 그대로
  const dx = String(d(await upload(COOKIE1, 'でばうんすX')).utteranceId ?? '')
  const dOld = String(d(await upload(COOKIE1, 'でばうんすOLD')).utteranceId ?? '')
  const dRun = String(d(await upload(COOKIE1, 'でばうんすRUN')).utteranceId ?? '')
  const dOther = String(d(await upload(COOKIE2, 'でばうんすOTHER')).utteranceId ?? '')
  const past = new Date(Date.now() - 1000)
  await prisma.speechJob.updateMany({ where: { utteranceId: dx }, data: { runAfter: past } })
  await prisma.speechJob.updateMany({ where: { utteranceId: dOld }, data: { runAfter: past, createdAt: new Date(Date.now() - 6 * 60_000) } })
  await prisma.speechJob.updateMany({ where: { utteranceId: dRun }, data: { status: 'RUNNING', lockedBy: 'smoke-hold', lockedAt: new Date(), runAfter: past } })
  await prisma.speechJob.updateMany({ where: { utteranceId: dOther }, data: { runAfter: past } })
  const tPush = Date.now()
  const dy = String(d(await upload(COOKIE1, 'でばうんすY')).utteranceId ?? '')
  const [jx, jOld, jRun, jOther, jy] = await Promise.all([job(dx), job(dOld), job(dRun), job(dOther), job(dy)])
  check('3e 디바운스: 같은 사용자 QUEUED → now+20초 · 만든 지 5분 지난 잡 그대로 · RUNNING 그대로 · 다른 사용자 그대로 · 새 잡 +20초',
    !!jx && Math.abs(jx.runAfter.getTime() - (tPush + 20_000)) < 5_000 && jOld?.runAfter.getTime() === past.getTime() && jRun?.status === 'RUNNING' && jRun.runAfter.getTime() === past.getTime() && jOther?.runAfter.getTime() === past.getTime() && !!jy && Math.abs(jy.runAfter.getTime() - (tPush + 20_000)) < 5_000,
    `x Δ=${jx ? jx.runAfter.getTime() - tPush : '-'} old=${jOld ? jOld.runAfter.getTime() - past.getTime() : '-'} run=${jRun?.status} other=${jOther ? jOther.runAfter.getTime() - past.getTime() : '-'}`)
  const capBase = new Date(Date.now() - 4 * 60_000 - 50_000)
  await prisma.speechJob.updateMany({ where: { utteranceId: dx }, data: { createdAt: capBase, runAfter: past } })
  await upload(COOKIE1, 'でばうんすZ')
  const jCap = await job(dx)
  check('3f 디바운스 상한: 만든 지 4분 50초 잡은 createdAt+5분까지만(≈ now+10초)', !!jCap && Math.abs(jCap.runAfter.getTime() - (capBase.getTime() + 5 * 60_000)) < 1_000, `Δcap=${jCap ? jCap.runAfter.getTime() - (capBase.getTime() + 5 * 60_000) : '-'}`)
  await prisma.speechJob.updateMany({ where: { utteranceId: { in: [dx, dOld, dRun, dOther, dy] } }, data: { status: 'FAILED', error: 'SMOKE_CLEAR', finishedAt: new Date() } })
  await prisma.speechJob.updateMany({ where: { userId: { in: [u1, u2] }, status: 'QUEUED' }, data: { status: 'FAILED', error: 'SMOKE_CLEAR', finishedAt: new Date() } })

  // A3g claim 재검사(Codex C2 지적 1): 옛 잡의 runAfter 가 지났어도 그 사용자가 방금 말했으면(디바운스가 못 민 경우 포함) RUNNING 으로 올리지 않는다
  const upG = await upload(COOKIE1, 'ふるいはつわ')
  const uG = String(d(upG).utteranceId ?? '')
  await ready(uG)
  const tNew = new Date()
  const fresh = await prisma.utterance.create({ data: { userId: u1, durationMs: 900, realtimeEngine: sttKey, realtimeText: 'いまはなした', createdAt: tNew }, select: { id: true } })
  createdUtterances.add(fresh.id)
  const cg = await claim('smoke-recheck', 2)
  const jG = await job(uG)
  check('3g 새 발화 직후 claim(디바운스 없이 발화만 커밋된 상황) → 옛 잡 RUNNING 안 됨·runAfter = 새 발화 +20초',
    !((d(cg).jobs as Json[]) ?? []).some((j) => j.utteranceId === uG) && jG?.status === 'QUEUED' && Math.abs(jG.runAfter.getTime() - (tNew.getTime() + 20_000)) < 1_000,
    `claimed=${((d(cg).jobs as Json[]) ?? []).length} status=${jG?.status} Δ=${jG ? jG.runAfter.getTime() - tNew.getTime() : '-'}`)
  const upH = await upload(COOKIE1, 'つぎのはつわ')
  const jG2 = await job(uG)
  check('3h 새 발화 업로드(디바운스 경로) → 같은 옛 잡이 다시 +20초로 밀림', !!jG2 && jG2.status === 'QUEUED' && jG2.runAfter.getTime() >= jG!.runAfter.getTime(), `Δ=${jG2 ? jG2.runAfter.getTime() - Date.now() : '-'}`)
  await prisma.speechJob.updateMany({ where: { utteranceId: { in: [uG, String(d(upH).utteranceId ?? '')] } }, data: { status: 'FAILED', error: 'SMOKE_CLEAR', finishedAt: new Date() } })

  // A4 claim 계약·백오프 3회·펜싱
  const up = await upload(COOKIE1, 'きのうがっこうにいった')
  const u = String(d(up).utteranceId ?? '')
  await ready(u)
  let c = await claim('smoke-w1')
  let got = ((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === u)
  check('4a claim 응답 = {id,kind,utteranceId,audioPath(DATA_ROOT 상대),realtimeText,recognitionMode,attempts:1}·엔진명 없음',
    !!got && got.kind === 'ANALYSIS_STT' && /^users\/[^/]+\/utterances\/\d{4}-\d{2}\/[^/]+\.wav$/.test(String(got.audioPath)) && got.realtimeText === 'きのうがっこうにいった' && got.recognitionMode === 'AUTO' && got.attempts === 1 && !LEAK.test(c.text),
    c.text.slice(0, 200))
  const jid = String(got?.id ?? '')
  const running = await job(u)
  check('4b DB: RUNNING·lockedBy=smoke-w1·attempts 1·발화 QUEUED 유지', running?.status === 'RUNNING' && running.lockedBy === 'smoke-w1' && running.attempts === 1 && (await utt(u)).status === 'QUEUED')
  const stale = await fail(jid, 'smoke-other', 'ANALYSIS_TIMEOUT', true)
  check('4c 다른 워커의 #140 → 409 STALE_CLAIM', stale.status === 409 && reason(stale) === 'STALE_CLAIM', stale.text.slice(0, 120))
  const expectBackoff = [30_000, 120_000]
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now()
    const r = await fail(jid, 'smoke-w1', 'ANALYSIS_UNAVAILABLE', true)
    const row = await job(u)
    if (attempt < 3) {
      check(`4d 시도 ${attempt} 재시도 → QUEUED·runAfter +${expectBackoff[attempt - 1] / 1000}초·락 해제`, r.status === 200 && d(r).jobStatus === 'QUEUED' && row?.status === 'QUEUED' && row.lockedBy === null && Math.abs(row.runAfter.getTime() - (t0 + expectBackoff[attempt - 1])) < 5_000, `${r.text.slice(0, 80)} Δ=${row ? row.runAfter.getTime() - t0 : '-'}`)
      const early = await claim('smoke-w1')
      check(`4e 시도 ${attempt} 뒤 runAfter 전에는 집히지 않음`, !((d(early).jobs as Json[]) ?? []).some((j) => j.id === jid))
      await prisma.speechJob.update({ where: { id: jid }, data: { runAfter: new Date(Date.now() - 1000) } })
      c = await claim('smoke-w1')
      got = ((d(c).jobs as Json[]) ?? []).find((j) => j.id === jid)
      check(`4f 앞당긴 뒤 다시 claim → attempts ${attempt + 1}`, got?.attempts === attempt + 1, c.text.slice(0, 120))
    } else {
      const ur = await utt(u)
      check('4g 시도 3 재시도 → FAILED(한도)·발화 FAILED·finishedAt', r.status === 200 && d(r).jobStatus === 'FAILED' && row?.status === 'FAILED' && !!row.finishedAt && ur.status === 'FAILED', `${r.text.slice(0, 80)} ${row?.status} ${ur.status}`)
    }
  }
  const late = await fail(jid, 'smoke-w1', 'ANALYSIS_UNAVAILABLE', true)
  check('4h FAILED 잡에 #140 → 409 STALE_CLAIM', late.status === 409 && reason(late) === 'STALE_CLAIM')

  // A5 AUDIO_MISSING 은 retryable 을 보내도 즉시 FAILED
  const up2 = await upload(COOKIE1, 'おんせいなし')
  const u2id = String(d(up2).utteranceId ?? '')
  await ready(u2id)
  c = await claim('smoke-w1')
  const j2 = ((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === u2id)
  const r2 = await fail(String(j2?.id), 'smoke-w1', 'AUDIO_MISSING', true)
  check('5 AUDIO_MISSING(retryable:true 라도) → 즉시 FAILED·attempts 1·발화 FAILED', d(r2).jobStatus === 'FAILED' && (await job(u2id))?.attempts === 1 && (await utt(u2id)).status === 'FAILED', r2.text.slice(0, 100))

  // A6 #138 판정·멱등·finalText 불변
  const up3 = await upload(COOKIE1, 'きのうがっこうにいった')
  const u3 = String(d(up3).utteranceId ?? '')
  await ready(u3)
  c = await claim('smoke-w1')
  const j3 = String(((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === u3)?.id ?? '')
  const wrongJob = await postAnalysis(u3, analysisBody(jid, 'smoke-w1'))
  check('6a 다른 발화의 jobId → 404', wrongJob.status === 404, wrongJob.text.slice(0, 100))
  const unknownConn = await postAnalysis(u3, analysisBody(j3, 'smoke-w1', { analysisEngine: 'no-such-conn' }))
  check('6b 모르는 analysisEngine → 400', unknownConn.status === 400, unknownConn.text.slice(0, 100))
  const a1 = await postAnalysis(u3, analysisBody(j3, 'smoke-w1'))
  const r3 = await utt(u3)
  const sa = await prisma.speechAnalysis.findUnique({ where: { utteranceId: u3 } })
  const ev = (sa?.engineVersions ?? {}) as Json
  check('6c #138 → stored·ANALYZED·confidence 0.7·requiresReview(AUTO 0.85)·finalSource REALTIME',
    a1.status === 200 && d(a1).stored === true && d(a1).requiresReview === true && d(a1).transcriptConfidence === 0.7 && d(a1).finalSource === 'REALTIME', a1.text.slice(0, 200))
  check('6d DB 한 트랜잭션 결과: 발화 ANALYZED·분석 텍스트·finalText=실시간 그대로·SpeechAnalysis(임계 스냅샷 0.85)·잡 DONE',
    r3.status === 'ANALYZED' && r3.analysisText === 'きのう学校に行って' && r3.finalText === 'きのうがっこうにいった' && r3.finalSource === 'REALTIME' && r3.requiresReview && r3.analysisEngine === analysisKey && ev.reviewThreshold === 0.85 && (await job(u3))?.status === 'DONE',
    `${r3.status} final=${r3.finalSource} ev=${JSON.stringify(ev)}`)
  const again = await postAnalysis(u3, analysisBody(j3, 'smoke-w1', { comparator: { similarity: 0.99, flags: [], version: '1.0' } }))
  check('6e 재보고 → 200 {stored:false, reason:ALREADY_ANALYZED}·값 불변', again.status === 200 && d(again).stored === false && d(again).reason === 'ALREADY_ANALYZED' && (await utt(u3)).transcriptConfidence === 0.7, again.text.slice(0, 160))
  const doneFail = await fail(j3, 'smoke-w1', 'X', true)
  check('6f DONE 잡에 #140 → 409', doneFail.status === 409)

  // ACCURATE 0.88 → 재확인, AUTO 0.88 → 아님
  await setMode(u1, 'ACCURATE')
  const upAcc = await upload(COOKIE1, 'せいかくモード')
  const uAcc = String(d(upAcc).utteranceId ?? '')
  await ready(uAcc)
  c = await claim('smoke-w1')
  const jAcc = String(((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === uAcc)?.id ?? '')
  const aAcc = await postAnalysis(uAcc, analysisBody(jAcc, 'smoke-w1', { comparator: { similarity: 0.88, flags: [], version: '1.0' } }))
  await setMode(u1, 'AUTO')
  const upAuto = await upload(COOKIE1, 'ふつうモード')
  const uAuto = String(d(upAuto).utteranceId ?? '')
  await ready(uAuto)
  c = await claim('smoke-w1')
  const jAuto = String(((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === uAuto)?.id ?? '')
  const aAuto = await postAnalysis(uAuto, analysisBody(jAuto, 'smoke-w1', { comparator: { similarity: 0.88, flags: [], version: '1.0' } }))
  check('6g 임계: ACCURATE 0.88 → requiresReview · AUTO 0.88 → 아님', d(aAcc).requiresReview === true && d(aAuto).requiresReview === false, `${aAcc.text.slice(0, 80)} / ${aAuto.text.slice(0, 80)}`)

  // A6h ⑫: 이미 학습자가 고친 발화(finalSource=USER)는 낮은 유사도여도 requiresReview=false → #21a 409
  const upU = await upload(COOKIE1, 'ゆーざーがなおした')
  const uU = String(d(upU).utteranceId ?? '')
  await prisma.utterance.update({ where: { id: uU }, data: { finalText: 'ユーザーが直した', finalSource: 'USER' } })
  await ready(uU)
  c = await claim('smoke-w1')
  const jU = String(((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === uU)?.id ?? '')
  const aU = await postAnalysis(uU, analysisBody(jU, 'smoke-w1', { comparator: { similarity: 0.3, flags: [], version: '1.0' } }))
  const rU = await utt(uU)
  const evU = ((await prisma.speechAnalysis.findUnique({ where: { utteranceId: uU } }))?.engineVersions ?? {}) as Json
  const pU = await api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${uU}`, { choice: 'ANALYSIS' })
  check('6h ⑫ finalSource=USER 발화 → requiresReview=false(신뢰도 0.3·임계 스냅샷 0.85 저장)·finalText 그대로·#21a 409 NOT_REVIEWABLE',
    d(aU).requiresReview === false && rU.requiresReview === false && rU.transcriptConfidence === 0.3 && evU.reviewThreshold === 0.85 && rU.finalText === 'ユーザーが直した' && rU.finalSource === 'USER' && pU.status === 409 && reason(pU) === 'NOT_REVIEWABLE',
    `${aU.text.slice(0, 120)} patch=${pU.status}`)

  // A7 #22
  const g = await api(COOKIE1, 'GET', `/api/v1/speech/utterances/${u3}`)
  check('7a #22 소유자 200·분석 텍스트·신뢰도·requiresReview·audioUrl·엔진 칸·엔진명 없음',
    g.status === 200 && d(g).analysisText === 'きのう学校に行って' && d(g).transcriptConfidence === 0.7 && d(g).requiresReview === true && d(g).audioUrl === `/api/v1/speech/utterances/${u3}/audio` && !LEAK.test(g.text) && d(g).analysis !== null,
    g.text.slice(0, 240))
  const gq = await api(COOKIE1, 'GET', `/api/v1/speech/utterances/${uAuto}`)
  check('7b #22 분석 전 발화 → analysisText·transcriptConfidence null', true && (await api(COOKIE1, 'GET', `/api/v1/speech/utterances/${u2id}`)).body.data.analysisText === null && gq.status === 200)
  check('7c #22 남의 발화 404·세션 없음 401·없는 id 404', (await api(COOKIE2, 'GET', `/api/v1/speech/utterances/${u3}`)).status === 404 && (await api(null, 'GET', `/api/v1/speech/utterances/${u3}`)).status === 401 && (await api(COOKIE1, 'GET', '/api/v1/speech/utterances/cnope00000')).status === 404)

  // A8 #21a — 채팅 메시지·교정에 연결된 재확인 발화에 동시 두 요청
  const chat = await prisma.chat.create({ data: { userId: u1, kind: 'TALK', title: MARK } })
  const msg = await prisma.chatMessage.create({ data: { chatId: chat.id, userId: u1, role: 'USER', content: 'きのうがっこうにいった', inputSource: 'REALTIME_STT' } })
  const corr = await prisma.correction.create({ data: { userId: u1, chatId: chat.id, messageId: msg.id, original: 'きのうがっこうにいった', corrected: '昨日学校に行った', explanation: 'smoke', errorType: 'GRAMMAR' } })
  await prisma.utterance.update({ where: { id: u3 }, data: { chatId: chat.id, chatMessageId: msg.id } })
  check('8a 재확인 대상 아님(requiresReview=false) → 409 NOT_REVIEWABLE', reason(await api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${uAuto}`, { choice: 'ANALYSIS' })) === 'NOT_REVIEWABLE')
  check('8b 분석 전 → 409 · 남의 발화 404 · 세션 없음 401 · 본문 오류 400(text 는 USER 만)',
    (await api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${u2id}`, { choice: 'REALTIME' })).status === 409 &&
      (await api(COOKIE2, 'PATCH', `/api/v1/speech/utterances/${u3}`, { choice: 'ANALYSIS' })).status === 404 &&
      (await api(null, 'PATCH', `/api/v1/speech/utterances/${u3}`, { choice: 'ANALYSIS' })).status === 401 &&
      (await api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${u3}`, { choice: 'ANALYSIS', text: 'x' })).status === 400 &&
      (await api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${u3}`, { choice: 'USER' })).status === 400)
  const [p1, p2] = await Promise.all([
    api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${u3}`, { choice: 'ANALYSIS' }),
    api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${u3}`, { choice: 'USER', text: '昨日学校に行きました' }),
  ])
  const winner = p1.status === 200 ? p1 : p2
  const loser = p1.status === 200 ? p2 : p1
  const after = await utt(u3)
  const expectSource = winner === p1 ? 'ANALYSIS' : 'USER'
  check('8c 동시 두 요청 → 한쪽만 200, 다른 쪽 409 NOT_REVIEWABLE', winner.status === 200 && loser.status === 409 && reason(loser) === 'NOT_REVIEWABLE', `${p1.status}/${p2.status}`)
  check('8d 확정: finalSource=고른 출처·finalText=그 안·requiresReview=false·응답 #22 형태',
    after.finalSource === expectSource && after.finalText === (expectSource === 'ANALYSIS' ? 'きのう学校に行って' : '昨日学校に行きました') && !after.requiresReview && d(winner).finalSource === expectSource && !LEAK.test(winner.text),
    `${after.finalSource} ${after.finalText?.length}자`)
  const msgAfter = await prisma.chatMessage.findUniqueOrThrow({ where: { id: msg.id } })
  const corrAfter = await prisma.correction.findUniqueOrThrow({ where: { id: corr.id } })
  check('8e ChatMessage.content·Correction.original 바이트 불변(D-B6)', Buffer.from(msgAfter.content).equals(Buffer.from('きのうがっこうにいった')) && Buffer.from(corrAfter.original).equals(Buffer.from('きのうがっこうにいった')))
  check('8f 이미 확정 → 409', (await api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${u3}`, { choice: 'REALTIME' })).status === 409)

  // A9 고아 회수
  const up4 = await upload(COOKIE1, 'こじのしごと')
  const u4 = String(d(up4).utteranceId ?? '')
  await ready(u4)
  c = await claim('smoke-dead')
  const j4 = String(((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === u4)?.id ?? '')
  await prisma.speechJob.update({ where: { id: j4 }, data: { lockedAt: new Date(Date.now() - 16 * 60_000) } })
  c = await claim('smoke-w2')
  const re = ((d(c).jobs as Json[]) ?? []).find((j) => j.id === j4)
  check('9a lockedAt 16분 전 RUNNING → 다음 claim 이 회수해 다시 줌(attempts 2, lockedBy 새 워커)', re?.attempts === 2 && (await job(u4))?.lockedBy === 'smoke-w2', c.text.slice(0, 120))
  await prisma.speechJob.update({ where: { id: j4 }, data: { lockedAt: new Date(Date.now() - 16 * 60_000), attempts: 3 } })
  await claim('smoke-w3')
  const orphanFailed = await job(u4)
  check('9b 한도(3)를 다 쓴 고아 → FAILED(ORPHANED)·발화 FAILED', orphanFailed?.status === 'FAILED' && orphanFailed.error === 'ORPHANED' && (await utt(u4)).status === 'FAILED', `${orphanFailed?.status} ${orphanFailed?.error}`)

  // A9c 응답 유실 복구: 같은 워커가 결과 없이 다시 claim 하면 그 워커가 쥔 RUNNING 은 바로 되돌려 다시 준다(15분 대기 없음) — 다른 워커 것은 그대로
  const up5 = await upload(COOKIE1, 'おうとうそうしつ')
  const u5 = String(d(up5).utteranceId ?? '')
  const up6 = await upload(COOKIE1, 'ほかのワーカー')
  const u6 = String(d(up6).utteranceId ?? '')
  await ready(u5, u6)
  c = await claim('smoke-lost', 1)
  const lostId = String(((d(c).jobs as Json[]) ?? [])[0]?.id ?? '')
  const lostUtt = String(((d(c).jobs as Json[]) ?? [])[0]?.utteranceId ?? '')
  c = await claim('smoke-other', 1)
  const otherId = String(((d(c).jobs as Json[]) ?? [])[0]?.id ?? '')
  c = await claim('smoke-lost', 1)
  const redelivered = ((d(c).jobs as Json[]) ?? []).find((j) => j.id === lostId)
  const otherRow = await prisma.speechJob.findUnique({ where: { id: otherId } })
  check('9c 같은 워커 재claim → 쥔 채 남은 잡을 다시 줌(attempts 2)·다른 워커가 쥔 잡은 RUNNING 그대로', !!lostId && redelivered?.attempts === 2 && otherRow?.status === 'RUNNING' && otherRow.lockedBy === 'smoke-other' && [u5, u6].includes(lostUtt),
    `${c.text.slice(0, 120)} other=${otherRow?.status}/${otherRow?.lockedBy}`)
  await prisma.speechJob.updateMany({ where: { utteranceId: { in: [u5, u6] } }, data: { status: 'FAILED', error: 'SMOKE_CLEAR', finishedAt: new Date() } })

  // A9d REV-033 M1: 같은 SPEECH_WORKER_ID·다른 부트 nonce(인스턴스 id) 두 워커 — 서로의 잡을 되돌리거나 STALE 로 만들지 않는다
  const upI = await upload(COOKIE1, 'いんすたんすA')
  const upJ = await upload(COOKIE1, 'いんすたんすB')
  const uI = String(d(upI).utteranceId ?? '')
  const uJ = String(d(upJ).utteranceId ?? '')
  await ready(uI, uJ)
  const INST_A = 'smoke-worker-1-aaaa1111'
  const INST_B = 'smoke-worker-1-bbbb2222'
  const jA = String(((d(await claim(INST_A, 1)).jobs as Json[]) ?? [])[0]?.id ?? '')
  const jB = String(((d(await claim(INST_B, 1)).jobs as Json[]) ?? [])[0]?.id ?? '')
  const bLateFail = await fail(jA, INST_B, 'ANALYSIS_TIMEOUT', true)
  const bAgain = await claim(INST_B, 1)
  const rowA = await prisma.speechJob.findUnique({ where: { id: jA } })
  const rowB = await prisma.speechJob.findUnique({ where: { id: jB } })
  check('9d 같은 base·다른 nonce: B 의 재claim 은 A 가 쥔 잡을 되돌리지 않음(A RUNNING·attempts 1)·B 가 A 잡에 실패 보고 → 409 STALE·B 자기 잡만 self-reclaim',
    !!jA && !!jB && jA !== jB && rowA?.status === 'RUNNING' && rowA.lockedBy === INST_A && rowA.attempts === 1 && bLateFail.status === 409 && reason(bLateFail) === 'STALE_CLAIM' &&
      ((d(bAgain).jobs as Json[]) ?? []).some((j) => j.id === jB && j.attempts === 2) && rowB?.lockedBy === INST_B,
    `A=${rowA?.status}/${rowA?.lockedBy}/${rowA?.attempts} late=${bLateFail.status} B=${bAgain.text.slice(0, 80)}`)
  await prisma.speechJob.updateMany({ where: { utteranceId: { in: [uI, uJ] } }, data: { status: 'FAILED', error: 'SMOKE_CLEAR', finishedAt: new Date() } })

  // A10 가짜 워커 2개 동시 claim — 20건 중복 0
  const ids: string[] = []
  for (let i = 0; i < 20; i++) ids.push(String(d(await upload(COOKIE1, `どうじ${i}`)).utteranceId ?? ''))
  await ready(...ids)
  const seen: string[] = []
  for (let round = 0; round < 30; round++) {
    // 라운드마다 새 워커 id — 같은 id 로 결과 없이 다시 claim 하면 쥔 잡을 되돌려 다시 준다(9c 응답 유실 복구)
    const [ca, cb] = await Promise.all([claim(`smoke-ca${round}`, 2), claim(`smoke-cb${round}`, 2)])
    const got2 = [...((d(ca).jobs as Json[]) ?? []), ...((d(cb).jobs as Json[]) ?? [])].filter((j) => ids.includes(String(j.utteranceId)))
    if (got2.length === 0 && seen.length >= 20) break
    seen.push(...got2.map((j) => String(j.id)))
  }
  const jobs20 = await prisma.speechJob.findMany({ where: { utteranceId: { in: ids } } })
  check('10 동시 claim(max 2 ×2) 20건 → 받은 잡 20·중복 0·전부 attempts 1·RUNNING', seen.length === 20 && new Set(seen).size === 20 && jobs20.every((j) => j.attempts === 1 && j.status === 'RUNNING'), `seen=${seen.length} uniq=${new Set(seen).size}`)
  for (const j of jobs20) await fail(j.id, String(j.lockedBy), 'SMOKE_CLEAR', false)

  // A11 D-B7 — 평가 말하기 문항 채점 텍스트: DB 수준 선택(LLM 없음) + (EVAL_LLM=1) 출제·채점 E2E(A6·A7 실제 호출)
  await phaseEvalDb(u1)
  if (process.env.EVAL_LLM === '1') await phaseEval(u1)
}

/** D-B7 선택 규칙을 실제 DB 행·실제 #67 연결·#138·#21a 로 만들고 speech 선택 함수 + learning 주입 지점을 직접 부른다(채점 LLM 없이). */
async function phaseEvalDb(pu: string): Promise<void> {
  const ev = await prisma.evaluation.create({
    data: {
      userId: pu,
      kind: 'TALK',
      level: 'N5',
      status: 'IN_PROGRESS',
      promptVersion: MARK,
      items: {
        create: [1, 2, 3, 4].map((order) => ({
          order,
          kind: order === 3 ? 'LISTEN_RESPOND' : 'SITUATION_RESPOND',
          prompt: { instructionKo: 'smoke', situationKo: 'smoke', textJa: 'こんにちは' },
          expected: { modelAnswerJa: 'はい' },
        })),
      },
    },
    include: { items: { orderBy: { order: 'asc' } } },
  })
  try {
    const [i1, i2, i3, i4] = ev.items
    const ans = (itemId: string, body: Json) => api(COOKIE1, 'POST', `/api/v1/evaluations/${ev.id}/items/${itemId}/answer`, body)
    const idOf = async (text: string) => String(d(await upload(COOKIE1, text)).utteranceId ?? '')
    const uA = await idOf('じつじかんA')
    const uB = await idOf('じつじかんB')
    const uC = await idOf('じつじかんC')
    const uD = await idOf('じつじかんD')
    const r1 = await ans(i1.id, { utteranceId: uA })
    const r2 = await ans(i2.id, { utteranceId: uB })
    const r2b = await ans(i2.id, { utteranceId: uD }) // 같은 문항 재답 — 저장된 답은 D, B 는 연결만 남는다
    const r3 = await ans(i3.id, { utteranceId: uC })
    const r4 = await ans(i4.id, { answerText: 'タイピング' })
    await ready(uA, uB, uC, uD)
    check('11a 준비: #67 발화 연결 4건(재답 포함)·글자 답 1건', [r1, r2, r2b, r3, r4].every((r) => r.status === 200), [r1, r2, r2b, r3, r4].map((r) => r.status).join(','))
    const c = await claim('smoke-eval-1', 2)
    const cj = (d(c).jobs as Json[]) ?? []
    const c2 = await claim('smoke-eval-2', 2)
    const all = [...cj, ...((d(c2).jobs as Json[]) ?? [])]
    const jobOf = (u: string) => String(all.find((j) => j.utteranceId === u)?.id ?? '')
    const workerOf = (u: string) => (cj.some((j) => j.utteranceId === u) ? 'smoke-eval-1' : 'smoke-eval-2')
    await postAnalysis(uA, analysisBody(jobOf(uA), workerOf(uA), { analysisText: '分析のこたえA', comparator: { similarity: 0.97, flags: [], version: '1.0' } }))
    await postAnalysis(uB, analysisBody(jobOf(uB), workerOf(uB), { analysisText: '分析のこたえB', comparator: { similarity: 0.97, flags: [], version: '1.0' } }))
    await postAnalysis(uC, analysisBody(jobOf(uC), workerOf(uC), { analysisText: '分析のこたえC', comparator: { similarity: 0.4, flags: [], version: '1.0' } }))
    const fix = await api(COOKIE1, 'PATCH', `/api/v1/speech/utterances/${uC}`, { choice: 'USER', text: 'ちょくせつなおした' })
    // uD 는 분석 전(QUEUED/RUNNING 그대로)
    const items = await prisma.evaluationItem.findMany({ where: { evaluationId: ev.id }, orderBy: { order: 'asc' } })
    const picked = await pickGradingTexts(pu, items.filter((i) => i.answerText !== null && i.inputSource !== 'TEXT').map((i) => ({ evaluationItemId: i.id, answerText: i.answerText as string })))
    check('11b 분석 완료·재확인 불필요 → 분석 텍스트(SERVER_STT)', picked.get(i1.id)?.text === '分析のこたえA' && picked.get(i1.id)?.inputSource === 'SERVER_STT', JSON.stringify(picked.get(i1.id)))
    check('11c 재답한 문항 — 저장된 답(D, 분석 전)과 맞는 발화만 본다 → 선택 없음(B 의 분석 텍스트를 쓰지 않음)', !picked.has(i2.id) && items[1].answerText === 'じつじかんD')
    check('11d 재확인 → 학습자가 직접 고침(#21a USER) → 그 텍스트(TEXT)', fix.status === 200 && picked.get(i3.id)?.text === 'ちょくせつなおした' && picked.get(i3.id)?.inputSource === 'TEXT', JSON.stringify(picked.get(i3.id)))
    const rows = items.map((i) => ({ id: i.id, order: i.order, kind: i.kind, prompt: i.prompt, expected: i.expected, wordId: i.wordId, wordSurfaceSnap: i.wordSurfaceSnap, chunkType: i.chunkType, answerText: i.answerText, inputSource: i.inputSource, score: i.score, maxScore: i.maxScore, feedback: i.feedback, dims: i.dims, answeredAt: i.answeredAt }))
    let asked: string[] = []
    const over = await speechAnswerOverrides(rows, async (q) => {
      asked = q.map((x) => x.evaluationItemId)
      return pickGradingTexts(pu, q)
    })
    check('11e learning 주입 지점: 음성 답 문항만 묻고(글자 답 제외) 바뀌는 문항만 덮는다', !asked.includes(i4.id) && asked.length === 3 && over.size === 2 && over.get(i1.id)?.inputSource === 'SERVER_STT' && over.get(i3.id)?.inputSource === 'TEXT', `${asked.length} ${over.size}`)
  } finally {
    await prisma.evaluation.deleteMany({ where: { id: ev.id, userId: pu } })
  }
}

async function pollJob(cookie: string, jobId: string, timeoutMs = 180_000): Promise<{ status: string; ms: number }> {
  const t = Date.now()
  for (;;) {
    const r = await api(cookie, 'GET', `/api/v1/jobs/${jobId}`)
    const st = String(d(r).status ?? '')
    if (st === 'DONE' || st === 'FAILED' || r.status !== 200) return { status: r.status === 200 ? st : `HTTP${r.status}`, ms: Date.now() - t }
    if (Date.now() - t > timeoutMs) return { status: 'TIMEOUT', ms: Date.now() - t }
    await sleep(1_500)
  }
}

function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

async function phaseEval(pu: string): Promise<void> {
  const active = await prisma.evaluation.count({ where: { userId: pu, status: { in: ['GENERATING', 'READY', 'IN_PROGRESS', 'GRADING'] } } })
  if (active) return check('12 D-B7(건너뜀 — 주 계정에 진행 중 평가 있음)', true, String(active))
  const before = new Set((await prisma.evaluation.findMany({ where: { userId: pu }, select: { id: true } })).map((e) => e.id))
  const daily = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: pu, kind: 'DAILY', periodKey: todayKst() } }, select: { data: true } })
  let evId = ''
  try {
    for (const [surface, reading, meaning] of [['駅', 'えき', '역'], ['予約', 'よやく', '예약'], ['注文', 'ちゅうもん', '주문'], ['静か', 'しずか', '조용하다']]) {
      await api(COOKIE1, 'POST', '/api/v1/words', { surface, reading, meaning, category: MARK })
    }
    const topic = await prisma.conversationTopic.findFirst({ where: { isSeed: true, userId: null }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    const created = await api(COOKIE1, 'POST', '/api/v1/evaluations', { kind: 'TALK', topicId: topic?.id ?? null })
    evId = String(d(created).evaluationId ?? '')
    const gen = await pollJob(COOKIE1, String(d(created).jobId ?? ''))
    if (gen.status !== 'DONE') return check('12 D-B7 출제(A6)', false, `${created.status} ${gen.status}`)
    const items = await prisma.evaluationItem.findMany({ where: { evaluationId: evId }, orderBy: { order: 'asc' } })
    const sit = items.filter((i) => i.kind === 'SITUATION_RESPOND')
    if (sit.length < 2) return check('12 D-B7 상황 문항 2개', false, items.map((i) => i.kind).join(','))
    const model = (i: (typeof items)[number]) => String((i.expected as Json | null)?.modelAnswerJa ?? 'はい、そうです。')
    // 상황 1: 분석 완료·재확인 불필요 → 분석 텍스트(SERVER_STT) · 상황 2: 분석 전 → 저장된 답(REALTIME_STT)
    const upA = await upload(COOKIE1, 'じつじかんのこたえ')
    const upB = await upload(COOKIE1, 'ぶんせきまえのこたえ')
    const ua = String(d(upA).utteranceId ?? '')
    const ub = String(d(upB).utteranceId ?? '')
    await ready(ua, ub)
    const ansA = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evId}/items/${sit[0].id}/answer`, { utteranceId: ua, inputSource: 'REALTIME_STT' })
    const ansB = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evId}/items/${sit[1].id}/answer`, { utteranceId: ub, inputSource: 'REALTIME_STT' })
    const c = await claim('smoke-eval', 2)
    const ja = String(((d(c).jobs as Json[]) ?? []).find((j) => j.utteranceId === ua)?.id ?? '')
    const analysisText = model(sit[0])
    const stored = await postAnalysis(ua, analysisBody(ja, 'smoke-eval', { analysisText, comparator: { similarity: 0.97, flags: [], version: '1.0' } }))
    check('12a 준비: 발화 연결 답 2건·상황1 분석 완료(재확인 불필요)', ansA.status === 200 && ansB.status === 200 && d(stored).requiresReview === false, `${ansA.status}/${ansB.status} ${stored.text.slice(0, 80)}`)
    const sub = await api(COOKIE1, 'POST', `/api/v1/evaluations/${evId}/submit`, {})
    const graded = await pollJob(COOKIE1, String(d(sub).jobId ?? ''))
    const after = await prisma.evaluationItem.findMany({ where: { id: { in: [sit[0].id, sit[1].id] } } })
    const a = after.find((i) => i.id === sit[0].id)
    const b = after.find((i) => i.id === sit[1].id)
    check('12b 채점(A7) DONE — 상황1 답 = 분석 텍스트·inputSource SERVER_STT(D-B7)', graded.status === 'DONE' && a?.answerText === analysisText && a.inputSource === 'SERVER_STT', `${graded.status} ${graded.ms}ms ${a?.inputSource} ${a?.answerText?.length}자`)
    check('12c 상황2(분석 전) = 저장된 답 그대로·REALTIME_STT(채점이 분석을 기다리지 않음)', b?.answerText === 'ぶんせきまえのこたえ' && b.inputSource === 'REALTIME_STT', `${b?.inputSource}`)
    metrics.evalGradeMs = graded.ms
  } finally {
    const mine = (await prisma.evaluation.findMany({ where: { userId: pu }, select: { id: true } })).map((e) => e.id).filter((id) => !before.has(id))
    await prisma.statsSnapshot.deleteMany({ where: { userId: pu, kind: 'EVALUATION', periodKey: { in: mine } } })
    await prisma.studyLog.deleteMany({ where: { userId: pu, type: 'EVALUATION', refId: { in: mine } } })
    await prisma.aiJob.deleteMany({ where: { userId: pu, kind: { in: ['EVAL_GEN', 'EVAL_GRADE'] }, refId: { in: mine } } })
    await prisma.tutorProposal.deleteMany({ where: { userId: pu, kind: 'SET_LEVEL', createdAt: { gte: new Date(Date.now() - 3_600_000) } } })
    await prisma.requestTrace.deleteMany({ where: { userId: pu, refType: { in: ['evalGen', 'evalGrade'] }, refId: { in: mine } } })
    await prisma.evaluation.deleteMany({ where: { id: { in: mine } } })
    await prisma.wordEntry.deleteMany({ where: { userId: pu, category: MARK } })
    const today = todayKst()
    if (daily) await prisma.statsSnapshot.update({ where: { userId_kind_periodKey: { userId: pu, kind: 'DAILY', periodKey: today } }, data: { data: daily.data as Prisma.InputJsonValue } }).catch(() => undefined)
    else await prisma.statsSnapshot.deleteMany({ where: { userId: pu, kind: 'DAILY', periodKey: today } })
  }
}

// ── 단계 B(실제 워커 2개) ─────────────────────────────────────────────

async function waitDone(ids: string[], timeoutMs: number): Promise<void> {
  const t = Date.now()
  while (Date.now() - t < timeoutMs) {
    const open = await prisma.speechJob.count({ where: { utteranceId: { in: ids }, status: { in: ['QUEUED', 'RUNNING'] } } })
    if (open === 0) return
    await sleep(1_000)
  }
}

async function phaseB(u1: string): Promise<void> {
  await setMode(u1, 'AUTO')
  const meta = JSON.parse(readFileSync(join(ASSETS, 'sentences.json'), 'utf8')) as { sentences: { id: string; text: string }[] }
  const ids: string[] = []
  for (const s of meta.sentences) {
    const up = await upload(COOKIE1, s.text, readFileSync(join(ASSETS, `${s.id}.wav`)))
    if (d(up).analysisQueued !== true) return check('B0 워커 하트비트(업로드가 적재돼야 함)', false, up.text.slice(0, 120))
    ids.push(String(d(up).utteranceId))
  }
  await waitDone(ids, 300_000)
  const jobs = await prisma.speechJob.findMany({ where: { utteranceId: { in: ids } } })
  const rows = await prisma.utterance.findMany({ where: { id: { in: ids } } })
  const workers = new Set(jobs.map((j) => j.lockedBy))
  check('B1 20건 전부 DONE·발화 ANALYZED·attempts 1(중복 처리 0)', jobs.length === 20 && jobs.every((j) => j.status === 'DONE' && j.attempts === 1) && rows.every((r) => r.status === 'ANALYZED'), `${jobs.map((j) => `${j.status}/${j.attempts}`).join(' ')}`)
  check('B2 두 워커가 나눠 처리', workers.size === 2, [...workers].join(','))
  check('B3 finalText·finalSource 불변(실시간 그대로)', rows.every((r) => r.finalSource === 'REALTIME' && r.finalText === r.realtimeText))
  const conf = rows.map((r) => r.transcriptConfidence ?? -1)
  const lat = jobs.map((j) => (j.finishedAt && j.startedAt ? j.finishedAt.getTime() - j.startedAt.getTime() : NaN)).filter(Number.isFinite)
  metrics.stt20 = {
    confidenceP50: pct(conf, 50),
    confidenceMin: Math.min(...conf),
    below085: conf.filter((c) => c < 0.85).length,
    requiresReview: rows.filter((r) => r.requiresReview).length,
    claimToDoneP50Ms: pct(lat, 50),
    claimToDoneP95Ms: pct(lat, 95),
    byWorker: Object.fromEntries([...workers].map((w) => [w, jobs.filter((j) => j.lockedBy === w).length])),
  }
  // 30초 발화 5건
  const clips = meta.sentences.map((s) => ({ text: s.text, wav: readFileSync(join(ASSETS, `${s.id}.wav`)) }))
  const long: string[] = []
  for (let k = 0; k < 5; k++) {
    const parts: Buffer[] = []
    const texts: string[] = []
    let ms = 0
    for (let i = k; ms < 29_000; i = (i + 1) % clips.length) {
      const c = clips[i]
      const cms = ((c.wav.length - 44) / 32_000) * 1000
      if (ms + cms > 30_000) break
      parts.push(c.wav)
      texts.push(c.text)
      ms += cms
    }
    const up = await upload(COOKIE1, texts.join('').slice(0, 1000), concatWav(parts))
    long.push(String(d(up).utteranceId))
    metrics[`long${k}Ms`] = Math.round(ms)
  }
  await waitDone(long, 300_000)
  const lj = await prisma.speechJob.findMany({ where: { utteranceId: { in: long } } })
  const llat = lj.map((j) => (j.finishedAt && j.startedAt ? j.finishedAt.getTime() - j.startedAt.getTime() : NaN)).filter(Number.isFinite)
  const lrows = await prisma.utterance.findMany({ where: { id: { in: long } }, select: { transcriptConfidence: true, status: true } })
  check('B4 30초 발화 5건 분석 완료', lj.length === 5 && lj.every((j) => j.status === 'DONE'), lj.map((j) => j.status).join(','))
  metrics.long30s = { claimToDoneP50Ms: pct(llat, 50), claimToDoneP95Ms: pct(llat, 95), confidence: lrows.map((r) => r.transcriptConfidence) }
}

// ── 단계 C(분석 서비스가 죽은 워커 1개) ───────────────────────────────

async function phaseC(u1: string): Promise<void> {
  await setMode(u1, 'AUTO')
  const up = await upload(COOKIE1, 'ぶんせきサービスがとまっている', readFileSync(join(ASSETS, '01.wav')))
  const id = String(d(up).utteranceId ?? '')
  const seenAttempts: number[] = []
  const t0 = Date.now()
  while (Date.now() - t0 < 120_000) {
    const j = await job(id)
    if (!j) break
    if (j.status === 'QUEUED' && j.attempts > 0 && !seenAttempts.includes(j.attempts)) {
      seenAttempts.push(j.attempts)
      const backoff = j.runAfter.getTime() - Date.now()
      metrics[`retry${j.attempts}BackoffMs`] = backoff
      await prisma.speechJob.update({ where: { id: j.id }, data: { runAfter: new Date(Date.now() - 1000) } })
    }
    if (j.status === 'FAILED') break
    await sleep(500)
  }
  const j = await job(id)
  const b1 = Number(metrics.retry1BackoffMs ?? 0)
  const b2 = Number(metrics.retry2BackoffMs ?? 0)
  check('C1 분석 서비스 불가 → 백오프(≈30초·≈2분) 재시도 2회 → 3회째 FAILED·발화 FAILED·코드값(엔진명 없음)',
    j?.status === 'FAILED' && j.attempts === 3 && j.error === 'ANALYSIS_UNAVAILABLE' && (await utt(id)).status === 'FAILED' && b1 > 20_000 && b1 <= 30_000 && b2 > 110_000 && b2 <= 120_000,
    `${j?.status} attempts=${j?.attempts} error=${j?.error} backoff=${b1},${b2}`)
  // 오디오 없음: 업로드 직후 wav 를 지운다(워커가 집기 전에 — FAST 로 30초 늦춘다)
  await setMode(u1, 'FAST')
  const up2 = await upload(COOKIE1, 'おとがない', readFileSync(join(ASSETS, '02.wav')))
  await setMode(u1, 'AUTO')
  const id2 = String(d(up2).utteranceId ?? '')
  const row = await utt(id2)
  if (row.audioPath) await removeDataFile(row.audioPath.split('/'))
  await prisma.speechJob.updateMany({ where: { utteranceId: id2 }, data: { runAfter: new Date(Date.now() - 1000) } })
  const t1 = Date.now()
  while (Date.now() - t1 < 30_000 && (await job(id2))?.status !== 'FAILED') await sleep(500)
  const j2 = await job(id2)
  check('C2 오디오 없음 → 즉시 FAILED(AUDIO_MISSING, attempts 1)·발화 FAILED', j2?.status === 'FAILED' && j2.error === 'AUDIO_MISSING' && j2.attempts === 1 && (await utt(id2)).status === 'FAILED', `${j2?.status} ${j2?.error} ${j2?.attempts}`)
}

async function main(): Promise<void> {
  // 주 계정(쓰기 전부) = qa-bot2, 다른 계정(남의 발화 404·디바운스 다른 사용자 확인) = qa-developer — 병렬 QA 라이브가 qa-bot 을 쓰므로(Leader 2026-09-29).
  const u1 = await uid(process.env.SMOKE_PRIMARY ?? 'qa-bot2@thekaiwa.test')
  const u2 = await uid(process.env.SMOKE_OTHER ?? 'qa-developer@thekaiwa.test')
  if (u1 === u2) throw new Error('주 계정과 다른 계정이 같다')
  const qa = [u1, u2]
  sttKey = (await prisma.engineConnection.findFirst({ where: { environment: APP_ENV as 'LOCAL', role: 'REALTIME_STT', connectionType: 'HTTP' }, select: { key: true } }))?.key ?? ''
  analysisKey = (await prisma.engineConnection.findFirst({ where: { environment: APP_ENV as 'LOCAL', role: 'ANALYSIS_STT' }, select: { key: true } }))?.key ?? ''
  const modeBackup = await prisma.userSpeechSetting.findUnique({ where: { userId: u1 }, select: { recognitionMode: true } })
  try {
    if (PHASE === 'A') await phaseA(u1, u2)
    else if (PHASE === 'B') await phaseB(u1)
    else if (PHASE === 'C') await phaseC(u1)
  } finally {
    if (modeBackup) await prisma.userSpeechSetting.update({ where: { userId: u1 }, data: { recognitionMode: modeBackup.recognitionMode } })
    else await prisma.userSpeechSetting.deleteMany({ where: { userId: u1 } })
    if (process.env.KEEP !== '1') await cleanup(qa)
    await prisma.$disconnect()
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n[task012b ${PHASE}] ${results.length - failed.length}/${results.length} PASS`)
  if (Object.keys(metrics).length) console.log(`[metrics] ${JSON.stringify(metrics)}`)
  if (failed.length) process.exitCode = 1
}

main().catch(async (e) => {
  console.error('[task012b] 중단:', e instanceof Error ? e.message.slice(0, 300) : String(e))
  process.exitCode = 1
})
