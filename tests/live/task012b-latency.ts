/**
 * task-012b 완료 기준 8 — 대화 경로 지연이 분석 워커 유무와 무관한지(차이 ≤10%) 잰다. 인자: <모드> <쿠키> <회수> <라벨>
 *   stt  : gateway WS(MIC_TEST — wav 저장·콜백 없음)로 stt20 을 흘려 손 뗌 → final 지연. 실시간 STT 는 우분투 CPU 를 쓰므로
 *          분석 서비스(같은 호스트 CPU)와 부딪히는지가 여기서 드러난다. LLM 불필요.
 *   turn : #21 업로드(QA) → #32 턴 SSE — 요청 → 첫 audio 이벤트·done. Claude CLI 턴 수만큼, M4 TTS 사용.
 *   analysis : 턴 없이 stt20 발화 N개를 올리고(대화 흉내) 마지막 발화 → 분석 완료 p50/max 만 잰다 — LLM 불필요(디바운스·워커 처리량 확인).
 *   LOAD=1 이면 측정 내내 30초 발화를 올려 분석 큐를 비우지 않는다(워커가 떠 있을 때 부하 조건).
 *   turn 모드는 끝에 (task-012b D-B8 수정 — 사용자별 디바운스) 대화 중에 시작된 분석 잡 수(`startedDuringConversation`, 목표 0)와
 *   대화가 멈춘 뒤 마지막 발화 → 각 발화 분석 완료(잡 finishedAt)까지 p50/max 를 잰다(WAIT_ANALYSIS=0 이면 건너뜀).
 * 출력: p50/p90 JSON 한 줄(라벨 포함). 이 실행이 만든 QA 발화·wav·대화는 끝에 지운다. 쿠키·티켓·전사 전문은 찍지 않는다.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { removeDataFile } from '../../src/modules/infra/storage'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3017'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만')
const [MODE, cookieFile, nArg, LABEL = MODE] = process.argv.slice(2)
const COOKIE = readFileSync(cookieFile, 'utf8').trim()
const N = Number(nArg ?? 30)
const ASSETS = process.env.STT_ASSETS ?? join(process.cwd(), 'speech/test-assets/stt20')
const MARK = 't012b-latency'
const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const meta = JSON.parse(readFileSync(join(ASSETS, 'sentences.json'), 'utf8')) as { sentences: { id: string; text: string }[] }
const clips = meta.sentences.map((s) => ({ text: s.text, wav: readFileSync(join(ASSETS, `${s.id}.wav`)) }))
const created = new Set<string>()
let sttKey = ''

async function api(method: string, path: string, json?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json) })
  const body = (await r.json().catch(() => ({}))) as { data?: Record<string, unknown> }
  return { status: r.status, data: body.data ?? {} }
}

async function upload(text: string, wav: Buffer): Promise<{ id: string | null; queued: boolean }> {
  for (;;) {
    const f = new FormData()
    f.set('audio', new File([new Uint8Array(wav)], 'u.wav', { type: 'audio/wav' }))
    f.set('text', text)
    f.set('realtimeConnectionKey', sttKey)
    const r = await fetch(`${BASE}/api/v1/speech/utterances`, { method: 'POST', headers: { Cookie: COOKIE }, body: f })
    if (r.status === 429) {
      await sleep((Number(r.headers.get('retry-after') ?? '5') + 1) * 1000)
      continue
    }
    const b = (await r.json().catch(() => ({}))) as { data?: { utteranceId?: string; analysisQueued?: boolean } }
    const id = b.data?.utteranceId ?? null
    if (id) created.add(id)
    return { id, queued: b.data?.analysisQueued === true }
  }
}

function frames(buf: Buffer): Buffer[] {
  const out: Buffer[] = []
  const pcm = buf.subarray(44)
  for (let i = 0; i + 1280 <= pcm.length; i += 1280) out.push(pcm.subarray(i, i + 1280))
  return out
}

async function micTest(audio: Buffer): Promise<number | null> {
  const t = await api('POST', '/api/v1/speech/ticket', { purpose: 'MIC_TEST' })
  if (t.status !== 200) return null
  const url = String(t.data.wsUrl ?? `ws://127.0.0.1:8100${String(t.data.wsPath)}`)
  return new Promise((resolve) => {
    const origin = (process.env.SPEECH_GATEWAY_ALLOWED_ORIGINS ?? '').split(',')[0]?.trim()
    const ws = origin ? new WebSocket(url, { headers: { Origin: origin } } as unknown as string[]) : new WebSocket(url)
    let stopAt = 0
    const timer = setTimeout(() => (ws.close(), resolve(null)), 30_000)
    ws.onopen = () => ws.send(JSON.stringify({ type: 'start', v: 1, ticket: t.data.ticket, sampleRate: 16000, partial: false, clientPlatform: 'web', endpoint: 'manual' }))
    ws.onmessage = async (ev) => {
      if (typeof ev.data !== 'string') return
      const m = JSON.parse(ev.data) as Record<string, unknown>
      if (m.type === 'ready') {
        for (const f of frames(audio)) {
          ws.send(f)
          await sleep(20)
        }
        stopAt = performance.now()
        ws.send(JSON.stringify({ type: 'stop' }))
      }
      if (m.type === 'final') {
        clearTimeout(timer)
        ws.close(1000)
        resolve(performance.now() - stopAt)
      }
    }
    ws.onerror = () => (clearTimeout(timer), resolve(null))
  })
}

async function turn(chatId: string, text: string, utteranceId: string | null): Promise<{ firstAudio: number | null; done: number; ok: boolean }> {
  const body = utteranceId ? { text, utteranceId, inputSource: 'REALTIME_STT' } : { text, inputSource: 'TEXT' }
  const t0 = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) return { firstAudio: null, done: performance.now() - t0, ok: false }
  let firstAudio: number | null = null
  let ok = false
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      if (ev === 'audio' && firstAudio === null && /"status":"OK"/.test(block)) firstAudio = performance.now() - t0
      if (ev === 'done') ok = true
    }
  }
  return { firstAudio, done: performance.now() - t0, ok }
}

function pct(xs: number[], p: number): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  return Math.round(v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))])
}

let loadOn = false
async function loadLoop(): Promise<number> {
  const long = Buffer.concat([clips[0].wav.subarray(0, 44), ...clips.slice(8, 16).map((c) => c.wav.subarray(44))])
  long.writeUInt32LE(long.length - 8, 4)
  long.writeUInt32LE(long.length - 44, 40)
  let n = 0
  while (loadOn) {
    const open = await prisma.speechJob.count({ where: { status: { in: ['QUEUED', 'RUNNING'] }, utteranceId: { in: [...created] } } })
    if (open < 2) {
      await upload(clips.slice(8, 16).map((c) => c.text).join(''), long)
      n++
    }
    await sleep(1_000)
  }
  return n
}

/** 대화 중 시작된 분석 잡 수(디바운스 — 목표 0)와 마지막 발화 → 각 발화 분석 완료(잡 finishedAt) p50/max, 잡당 처리(startedAt→finishedAt) p50. */
async function analysisLag(out: Record<string, unknown>): Promise<void> {
  const lastUpload = await prisma.utterance.findFirst({ where: { id: { in: [...created] } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  const convEnd = new Date()
  const t0 = Date.now()
  for (;;) {
    const open = await prisma.speechJob.count({ where: { utteranceId: { in: [...created] }, status: { in: ['QUEUED', 'RUNNING'] } } })
    if (open === 0 || Date.now() - t0 > 900_000) break
    await sleep(1_000)
  }
  const jobs = await prisma.speechJob.findMany({ where: { utteranceId: { in: [...created] } }, select: { status: true, startedAt: true, finishedAt: true } })
  const base = lastUpload?.createdAt.getTime() ?? convEnd.getTime()
  const lag = jobs.filter((j) => j.finishedAt).map((j) => j.finishedAt!.getTime() - base)
  const per = jobs.filter((j) => j.finishedAt && j.startedAt).map((j) => j.finishedAt!.getTime() - j.startedAt!.getTime())
  const firstStart = Math.min(...jobs.filter((j) => j.startedAt).map((j) => j.startedAt!.getTime()))
  Object.assign(out, {
    analysisJobs: jobs.length,
    analysisDone: jobs.filter((j) => j.status === 'DONE').length,
    startedDuringConversation: jobs.filter((j) => j.startedAt && j.startedAt < convEnd).length,
    lastUtteranceToFirstStartMs: Number.isFinite(firstStart) ? firstStart - base : null,
    lastUtteranceToAnalyzedP50Ms: pct(lag, 50),
    lastUtteranceToAnalyzedMaxMs: lag.length ? Math.max(...lag) : null,
    perJobP50Ms: pct(per, 50),
  })
}

async function main(): Promise<void> {
  sttKey = (await prisma.engineConnection.findFirst({ where: { environment: 'LOCAL', role: 'REALTIME_STT', connectionType: 'HTTP' }, select: { key: true } }))?.key ?? ''
  loadOn = process.env.LOAD === '1'
  const loader = loadOn ? loadLoop() : Promise.resolve(0)
  const out: Record<string, unknown> = { label: LABEL, mode: MODE, n: N }
  let chatId = ''
  try {
    if (MODE === 'analysis') {
      let queued = 0
      for (let k = 0; k < N; k++) if ((await upload(clips[k % clips.length].text, clips[k % clips.length].wav)).queued) queued++
      Object.assign(out, { queued })
      await analysisLag(out)
    } else if (MODE === 'stt') {
      const xs: number[] = []
      for (let k = 0; k < N; k++) {
        const t = performance.now()
        const ms = await micTest(clips[k % clips.length].wav)
        if (ms !== null) xs.push(ms)
        await sleep(Math.max(0, 3_100 - (performance.now() - t))) // 티켓 사용자당 20/분
      }
      Object.assign(out, { ok: xs.length, sttFinalP50: pct(xs, 50), sttFinalP90: pct(xs, 90) })
    } else {
      const chat = await api('POST', '/api/v1/chats', { kind: 'TALK', title: MARK })
      chatId = String(chat.data.id ?? '')
      await api('GET', `/api/v1/chats/${chatId}`)
      await sleep(4_000)
      const first: number[] = []
      const done: number[] = []
      let queued = 0
      let fails = 0
      for (let k = 0; k < N; k++) {
        const c = clips[k % clips.length]
        const t = performance.now()
        const up = await upload(c.text, c.wav)
        if (up.queued) queued++
        const r = await turn(chatId, c.text, up.id)
        if (!r.ok) fails++
        if (r.firstAudio !== null) first.push(r.firstAudio)
        done.push(r.done)
        await sleep(Math.max(0, 5_600 - (performance.now() - t)))
      }
      Object.assign(out, { queued, fails, firstAudioP50: pct(first, 50), firstAudioP90: pct(first, 90), doneP50: pct(done, 50), doneP90: pct(done, 90) })
      if (queued > 0 && process.env.WAIT_ANALYSIS !== '0') await analysisLag(out)
    }
  } finally {
    loadOn = false
    out.loadUploads = await loader
    const rows = await prisma.utterance.findMany({ where: { id: { in: [...created] } }, select: { id: true, audioPath: true } })
    for (const r of rows) if (r.audioPath) await removeDataFile(r.audioPath.split('/')).catch(() => undefined)
    await prisma.utterance.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
    if (chatId) await prisma.chat.deleteMany({ where: { id: chatId, title: MARK } })
    await prisma.$disconnect()
  }
  console.log(`[latency] ${JSON.stringify(out)}`)
}

main().catch((e) => {
  console.error('[latency] 중단:', e instanceof Error ? e.message.slice(0, 200) : String(e))
  process.exitCode = 1
})
