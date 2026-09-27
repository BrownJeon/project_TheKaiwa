/**
 * task-007 지연 실측(완료 기준 7) — 웹 경로 합성 E2E: 우분투에서 TTS 로 만든 테스트 음성(speech/test-assets/stt20)을 gateway WS 로 흘리고
 * `stop` → final → #32 턴(SSE) → **첫 audio 이벤트 수신**까지를 턴마다 잰다(클라 재생 지연 제외 — 폰 실측은 003f).
 *
 * 턴마다: 티켓(TURN·chatId — 이것이 예열 트리거) → WS start → 프레임 → stop → final{text, utteranceId} → 턴(utteranceId·REALTIME_STT·
 * clientTimings{prevMessageId, sttMs}) → audio… → done. 턴 사이 간격은 분당 12턴 제한 안(≥5.5s).
 * 끝나면 Trace 에서 ttfaServerMs·LLM firstSentenceMs·warm·ACCEPT·LLM 총을 모아 p50/p90 표를 찍는다. "조기 추출 끔" 은 같은 턴의
 * `LLM 종료 + ttfaServerMs` 로 계산한 반사실값(조기 경로 없이 최종 검증 뒤 합성했을 때의 첫 음성)이다.
 *
 * 실행: `DEV_PID=<pid> bash tests/live/task007-latency.sh [포트=3011] [턴 수=30]`. Claude CLI 턴 수만큼, M4 TTS 사용.
 * gateway 는 운영(127.0.0.1:8100)을 쓰고 발화 행은 gateway 콜백(운영 앱)이 공유 DB 에 만든다 — 끝에 이 실행의 Chat·Utterance·wav·Trace 를 지운다.
 * 출력에 쿠키·티켓·전사 전문을 찍지 않는다.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { removeDataFile } from '../../src/modules/infra/storage'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const TURNS = Number(process.argv[3] ?? 30)
const ASSETS = process.env.STT_ASSETS ?? join(process.cwd(), 'speech/test-assets/stt20')
const prisma = new PrismaClient()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function api(method: string, path: string, json?: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json) })
  const body = (await r.json().catch(() => ({}))) as { data?: Record<string, unknown> }
  return { status: r.status, data: body.data ?? {} }
}

function frames(buf: Buffer): Buffer[] {
  const out: Buffer[] = []
  const pcm = buf.subarray(44)
  for (let i = 0; i + 1280 <= pcm.length; i += 1280) out.push(pcm.subarray(i, i + 1280))
  return out
}

interface Stt {
  text: string
  utteranceId: string | null
  stopAt: number
  finalAt: number
}

async function speak(chatId: string, audio: Buffer): Promise<Stt | null> {
  const t = await api('POST', '/api/v1/speech/ticket', { chatId, purpose: 'TURN' })
  if (t.status !== 200) return null
  const url = String(t.data.wsUrl ?? `ws://127.0.0.1:8100${String(t.data.wsPath)}`)
  return new Promise((resolve) => {
    // 운영 gateway 는 Origin 허용 목록(SPEECH_GATEWAY_ALLOWED_ORIGINS)을 본다 — 브라우저처럼 앱 도메인 Origin 을 싣는다(undici WebSocketInit.headers).
    const origin = (process.env.SPEECH_GATEWAY_ALLOWED_ORIGINS ?? '').split(',')[0]?.trim()
    const ws = origin ? new WebSocket(url, { headers: { Origin: origin } } as unknown as string[]) : new WebSocket(url)
    let stopAt = 0
    const timer = setTimeout(() => {
      ws.close()
      resolve(null)
    }, 30_000)
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
        const finalAt = performance.now()
        ws.close(1000)
        resolve({ text: String(m.text ?? ''), utteranceId: typeof m.utteranceId === 'string' ? m.utteranceId : null, stopAt, finalAt })
      }
    }
    ws.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

interface TurnRow {
  n: number
  sttMs: number
  stopToFirstAudioMs: number | null
  reqToFirstAudioMs: number | null
  reqToDoneMs: number
  traceId: string
  audioCount: number
  firstCached: boolean | null
  status: string
  warnings: string[]
}

async function runTurn(chatId: string, stt: Stt, prevMessageId: string | null): Promise<{ row: Omit<TurnRow, 'n'>; assistantMessageId: string | null; utteranceUsed: boolean }> {
  const sttMs = Math.round(stt.finalAt - stt.stopAt)
  const body = stt.utteranceId
    ? { text: stt.text, utteranceId: stt.utteranceId, inputSource: 'REALTIME_STT', clientTimings: { prevMessageId, sttMs } }
    : { text: stt.text, inputSource: 'TEXT', clientTimings: { prevMessageId, sttMs } }
  const reqAt = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const txt = await r.text()
    return { row: { sttMs, stopToFirstAudioMs: null, reqToFirstAudioMs: null, reqToDoneMs: performance.now() - reqAt, traceId: '', audioCount: 0, firstCached: null, status: `HTTP${r.status}:${txt.slice(0, 80)}`, warnings: [] }, assistantMessageId: null, utteranceUsed: false }
  }
  let firstAudioAt: number | null = null
  let firstCached: boolean | null = null
  let done: Record<string, unknown> | null = null
  let err: Record<string, unknown> | null = null
  const warnings: string[] = []
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done: end } = await reader.read()
    if (end) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const d = /^data: (.+)$/m.exec(block)?.[1]
      if (!ev || !d) continue
      const data = JSON.parse(d) as Record<string, unknown>
      if (ev === 'audio' && firstAudioAt === null && data.status === 'OK') {
        firstAudioAt = performance.now()
        firstCached = data.cached === true
      }
      if (ev === 'done') done = data
      if (ev === 'error') err = data
      if (ev === 'status' && typeof data.warning === 'string') warnings.push(data.warning)
    }
  }
  const doneAt = performance.now()
  return {
    row: {
      sttMs,
      stopToFirstAudioMs: firstAudioAt === null ? null : Math.round(firstAudioAt - stt.stopAt),
      reqToFirstAudioMs: firstAudioAt === null ? null : Math.round(firstAudioAt - reqAt),
      reqToDoneMs: Math.round(doneAt - reqAt),
      traceId: String(done?.traceId ?? err?.traceId ?? ''),
      audioCount: Number(done?.audioCount ?? 0),
      firstCached,
      status: done ? 'OK' : `ERR:${String(err?.code ?? '?')}`,
      warnings,
    },
    assistantMessageId: done ? String(done.assistantMessageId) : null,
    utteranceUsed: !!stt.utteranceId,
  }
}

function pct(xs: number[], p: number): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!v.length) return null
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))]
}

async function main(): Promise<void> {
  const chat = await api('POST', '/api/v1/chats', { kind: 'TALK', title: 't007 latency' })
  const chatId = String(chat.data.id)
  const utterances: string[] = []
  const rows: TurnRow[] = []
  try {
    await api('GET', `/api/v1/chats/${chatId}`) // 방 진입 = 예열
    await sleep(4_000)
    let prev: string | null = null
    for (let n = 1; n <= TURNS; n++) {
      const started = performance.now()
      const id = String(((n - 1) % 20) + 1).padStart(2, '0')
      const audio = readFileSync(join(ASSETS, `${id}.wav`))
      const stt = await speak(chatId, audio)
      if (!stt || !stt.text) {
        console.log(`#${n} STT 실패`)
        continue
      }
      if (stt.utteranceId) utterances.push(stt.utteranceId)
      const t = await runTurn(chatId, stt, prev)
      prev = t.assistantMessageId ?? prev
      rows.push({ n, ...t.row })
      console.log(`#${n} wav${id} stt=${t.row.sttMs}ms stop→audio=${t.row.stopToFirstAudioMs ?? '-'}ms req→done=${t.row.reqToDoneMs}ms audio=${t.row.audioCount} ${t.row.status}`)
      // 분당 12턴 제한 안으로(턴 시작 간격 ≥ 5.5s) + 재생 시간 흉내.
      const wait = 5_500 - (performance.now() - started)
      if (wait > 0) await sleep(wait)
    }
    await sleep(3_000)
    // Trace 에서 서버 구간을 모은다.
    const traces = await prisma.requestTrace.findMany({ where: { traceId: { in: rows.map((r) => r.traceId).filter(Boolean) } } })
    const byId = new Map(traces.map((t) => [t.traceId, t.steps as Record<string, unknown>[]]))
    const ttfaServer: number[] = []
    const firstSentence: number[] = []
    const firstDelta: number[] = []
    const accept: number[] = []
    const llmTotal: number[] = []
    const noEarly: number[] = []
    const earlyTtfa: number[] = []
    let warmHit = 0
    let warmN = 0
    for (const r of rows) {
      const steps = byId.get(r.traceId) ?? []
      const llm = steps.find((s) => s.name === 'LLM')
      const t0 = steps.find((s) => s.name === 'TTS[0]')
      const acc = steps.find((s) => s.name === 'ACCEPT')
      if (typeof t0?.ttfaServerMs === 'number') ttfaServer.push(t0.ttfaServerMs)
      if (typeof llm?.firstSentenceMs === 'number') firstSentence.push(llm.firstSentenceMs)
      if (typeof llm?.firstDeltaMs === 'number') firstDelta.push(llm.firstDeltaMs)
      if (typeof acc?.ms === 'number') accept.push(acc.ms)
      if (typeof llm?.ms === 'number') llmTotal.push(llm.ms)
      if (llm) {
        warmN++
        if (llm.warm === 'HIT') warmHit++
      }
      // 반사실: 조기 경로 없이 LLM 이 끝난 뒤 첫 문장을 합성했다면 — 손 뗌 기준 첫 음성 ≈ stt + (요청→LLM 시작) + LLM 총 + ttfaServer.
      if (typeof llm?.ms === 'number' && typeof llm?.startMs === 'number' && typeof t0?.ms === 'number') noEarly.push(r.sttMs + (llm.startMs as number) + (llm.ms as number) + (t0.ms as number))
      if (r.stopToFirstAudioMs !== null) earlyTtfa.push(r.stopToFirstAudioMs)
    }
    const fmt = (v: number | null) => (v === null ? '-' : `${Math.round(v)}`)
    const line = (label: string, xs: number[]) => console.log(`| ${label} | ${xs.length} | ${fmt(pct(xs, 50))} | ${fmt(pct(xs, 90))} |`)
    console.log(`\n턴 ${rows.length}/${TURNS} (OK ${rows.filter((r) => r.status === 'OK').length}) · warm HIT ${warmHit}/${warmN}`)
    console.log('| 구간 | n | p50 ms | p90 ms |')
    console.log('|---|---|---|---|')
    line('stop → 첫 audio 이벤트(실측)', earlyTtfa)
    line('stop → final(STT)', rows.map((r) => r.sttMs))
    line('턴 요청 → 첫 audio', rows.map((r) => r.reqToFirstAudioMs ?? NaN))
    line('ACCEPT(LLM 과 병렬)', accept)
    line('LLM 첫 텍스트 조각(LLM 시작 기준)', firstDelta)
    line('LLM 첫 문장 확정(LLM 시작 기준)', firstSentence)
    line('LLM 총', llmTotal)
    line('ttfaServerMs(청크0 합성)', ttfaServer)
    line('턴 요청 → done', rows.map((r) => r.reqToDoneMs))
    line('반사실: 조기 추출 끔 stop → 첫 audio', noEarly)
    console.log(`첫 청크 캐시 HIT ${rows.filter((r) => r.firstCached).length}/${rows.filter((r) => r.firstCached !== null).length}`)
    const w = rows.flatMap((r) => r.warnings)
    console.log(`status 경고: AUDIO_TEXT_MISMATCH ${w.filter((x) => x === 'AUDIO_TEXT_MISMATCH').length} · TTS_UNAVAILABLE ${w.filter((x) => x === 'TTS_UNAVAILABLE').length} · CORRECTION_ORIGINAL_MISMATCH ${w.filter((x) => x === 'CORRECTION_ORIGINAL_MISMATCH').length}`)
  } finally {
    const traceIds = rows.map((r) => r.traceId).filter(Boolean)
    for (const id of utterances) {
      const u = await prisma.utterance.findUnique({ where: { id }, select: { audioPath: true } })
      if (u?.audioPath) await removeDataFile(u.audioPath.split('/')).catch(() => undefined)
    }
    await prisma.utterance.deleteMany({ where: { id: { in: utterances } } })
    await prisma.requestTrace.deleteMany({ where: { traceId: { in: traceIds } } })
    await api('DELETE', `/api/v1/chats/${chatId}`)
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('실측 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  process.exit(1)
})
