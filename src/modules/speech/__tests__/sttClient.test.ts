import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStartMessage,
  Downsampler,
  FRAME_BYTES,
  FrameChunker,
  mapCloseCode,
  mapMediaError,
  mapServerError,
  mapTicketFailure,
  parseServerMessage,
  resolveWsUrl,
  rmsDb,
  WebSocketSttClient,
  type SttEvent,
  type SttTicket,
} from '../stt/client'
import type { CaptureDriver } from '../stt/client/capture'

test('서버 메시지: 필요한 필드만 남기고 엔진·추적 값은 버린다', () => {
  assert.deepEqual(parseServerMessage(JSON.stringify({ type: 'ready', v: 1, sessionId: 'ws_1', engine: 'x-gateway', model: 'm@1' })), { type: 'ready' })
  const fin = parseServerMessage(JSON.stringify({ type: 'final', utteranceId: 'cabc', text: 'こんにちは', durationMs: 1200, engine: 'x', traceId: 't_1', segments: [{ text: 'a' }], timings: { sttMs: 1 } }))
  assert.deepEqual(fin, { type: 'final', text: 'こんにちは', durationMs: 1200, utteranceId: 'cabc' })
  assert.deepEqual(parseServerMessage(JSON.stringify({ type: 'final', utteranceId: null, text: '', durationMs: 0 })), { type: 'final', text: '', durationMs: 0, utteranceId: null })
  assert.deepEqual(parseServerMessage(JSON.stringify({ type: 'partial', segIdx: 2, text: 'きのう', atMs: 10 })), { type: 'partial', segIdx: 2, text: 'きのう' })
  assert.deepEqual(parseServerMessage(JSON.stringify({ type: 'error', code: 'RATE_LIMITED', message: 'replaced', fatal: true })), { type: 'error', code: 'REPLACED', fatal: true })
  assert.deepEqual(parseServerMessage(JSON.stringify({ type: 'error', code: 'VALIDATION', message: 'bad frame', fatal: false })), { type: 'error', code: 'VALIDATION', fatal: false })
  assert.equal(parseServerMessage('{bad'), null)
  assert.equal(parseServerMessage(JSON.stringify({ type: 'unknown' })), null)
  assert.equal(parseServerMessage(new ArrayBuffer(4)), null)
  const start = JSON.parse(buildStartMessage({ ticket: 'T', partial: true, clientPlatform: 'web' }))
  assert.deepEqual(start, { type: 'start', v: 1, ticket: 'T', sampleRate: 16000, partial: true, clientPlatform: 'web', endpoint: 'manual' })
})

test('오류·close 코드 → 화면 코드(§8-8 ⓐ)', () => {
  assert.equal(mapServerError('ENGINE_UNAVAILABLE'), 'SERVER_UNAVAILABLE')
  assert.equal(mapServerError('UNAUTHENTICATED'), 'TICKET')
  assert.equal(mapServerError('TICKET_USED'), 'TICKET')
  assert.equal(mapServerError('SESSION_LIMIT'), 'BUSY')
  assert.equal(mapServerError('CALLBACK_FAILED'), null)
  assert.equal(mapServerError('whatever'), 'ENGINE_ERROR')
  assert.equal(mapCloseCode(4422, 'connecting'), 'SERVER_UNAVAILABLE')
  assert.equal(mapCloseCode(4409, 'active'), 'REPLACED')
  assert.equal(mapCloseCode(4429, 'connecting'), 'BUSY')
  assert.equal(mapCloseCode(4413, 'active'), 'ENGINE_ERROR')
  assert.equal(mapCloseCode(1006, 'connecting'), 'CONNECT_FAILED')
  assert.equal(mapCloseCode(1011, 'active'), 'CONNECTION_LOST')
  assert.equal(mapCloseCode(4408, 'idle'), null)
  assert.equal(mapCloseCode(1000, 'idle'), null)
  assert.equal(mapTicketFailure({ status: 422, code: 'ENGINE_UNAVAILABLE' }).code, 'SERVER_UNAVAILABLE')
  const busy = mapTicketFailure({ status: 429, retryAfterSec: 12 })
  assert.equal(busy.code, 'BUSY')
  assert.equal(busy.retryAfterSec, 12)
  assert.equal(mapTicketFailure({ status: 0 }).code, 'CONNECT_FAILED')
  assert.equal(mapTicketFailure({ status: 502 }).code, 'CONNECT_FAILED')
  assert.equal(mapMediaError({ name: 'NotAllowedError' }), 'MIC_DENIED')
  assert.equal(mapMediaError({ name: 'NotFoundError' }), 'MIC_NOT_FOUND')
  assert.equal(mapMediaError({ name: 'NotReadableError' }), 'MIC_BUSY')
})

test('연결 주소: 운영은 같은 호스트 wss, 개발 wsUrl 은 loopback ws:// 만', () => {
  assert.equal(resolveWsUrl({ wsPath: '/ws/speech' }, { protocol: 'https:', host: 'kaiwa.example.com' }), 'wss://kaiwa.example.com/ws/speech')
  assert.equal(resolveWsUrl({ wsPath: '/ws/speech', wsUrl: 'ws://127.0.0.1:8100/ws/speech' }, { protocol: 'http:', host: 'localhost:3011' }), 'ws://127.0.0.1:8100/ws/speech')
  assert.equal(resolveWsUrl({ wsPath: '/ws/speech', wsUrl: 'wss://evil.example.com/ws' }, { protocol: 'https:', host: 'k.com' }), 'wss://k.com/ws/speech')
  assert.equal(resolveWsUrl({ wsPath: '//evil.com/x' }, { protocol: 'https:', host: 'k.com' }), 'wss://k.com/ws/speech')
})

test('PCM: 48k→16k 길이·값, 40ms 프레임 1,280바이트, 끝은 무음 채움', () => {
  const d = new Downsampler(48_000)
  const input = new Float32Array(4800).fill(0.5)
  const out = d.process(input)
  assert.equal(out.length, 1600)
  assert.equal(out[0], Math.round(0.5 * 0x7fff))
  // 청크 경계를 넘어도 샘플 수가 새지 않는다(44.1k 는 비정수 비율)
  const d2 = new Downsampler(44_100)
  let total = 0
  for (let i = 0; i < 10; i++) total += d2.process(new Float32Array(441)).length
  assert.ok(Math.abs(total - 1600) <= 1, `44.1k 0.1초 → ${total}`)
  const same = new Downsampler(16_000).process(new Float32Array([1, -1, 0, 2]))
  assert.deepEqual([...same], [32767, -32768, 0, 32767])

  const frames: ArrayBuffer[] = []
  const c = new FrameChunker()
  c.push(new Int16Array(1000).fill(7), (f) => frames.push(f))
  assert.equal(frames.length, 1)
  assert.equal(frames[0].byteLength, FRAME_BYTES)
  c.flush((f) => frames.push(f))
  assert.equal(frames.length, 2)
  const last = new Int16Array(frames[1])
  assert.equal(last[359], 7)
  assert.equal(last[360], 0)
  assert.equal(rmsDb(0, 10), -100)
  assert.equal(rmsDb(10 * 0.25, 10), -6)
})

// ── WebSocketSttClient: 가짜 캡처·가짜 WS 로 흐름 확인 ─────────────────────────────
class FakeWs {
  static OPEN = 1
  static instances: FakeWs[] = []
  readyState = 0
  binaryType = ''
  sent: (string | ArrayBuffer)[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly url: string) {
    FakeWs.instances.push(this)
  }
  send(d: string | ArrayBuffer) {
    this.sent.push(d)
  }
  close() {
    this.readyState = 3
  }
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  server(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
  drop(code: number) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  json() {
    return this.sent.filter((x): x is string => typeof x === 'string').map((x) => JSON.parse(x) as { type: string })
  }
  binaries() {
    return this.sent.filter((x) => typeof x !== 'string').length
  }
}

function fakeCapture() {
  let feed: ((s: Float32Array) => void) | null = null
  let stopped = 0
  const driver: CaptureDriver = {
    prepare() {},
    async open(onSamples) {
      feed = onSamples
      return { sampleRate: 16_000, stop: () => void stopped++ }
    },
    close() {},
  }
  return { driver, push: (ms: number) => feed?.(new Float32Array((16 * ms) | 0).fill(0.1)), stopped: () => stopped }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

function setup(tickets: Array<SttTicket | Error> = []) {
  FakeWs.instances = []
  const cap = fakeCapture()
  let n = 0
  const fetchTicket = async () => {
    const t = tickets[n++] ?? { ticket: `T${n}`, expiresAt: '', wsPath: '/ws/speech', sampleRate: 16000, frameMs: 40 }
    if (t instanceof Error) throw t
    return t
  }
  const client = new WebSocketSttClient({
    fetchTicket,
    capture: cap.driver,
    WebSocketImpl: FakeWs as unknown as typeof WebSocket,
    location: { protocol: 'https:', host: 'k.test' },
    checkEnvironment: () => null,
  })
  const events: SttEvent[] = []
  client.subscribe((e) => events.push(e))
  return { client, cap, events, tickets: () => n }
}

test('WS 클라이언트: ready 전 프레임은 버퍼 → ready 후 전송, stop → final 1회', async () => {
  const { client, cap, events } = setup()
  await client.begin({ purpose: 'MIC_TEST' })
  cap.push(200) // 5프레임 — 아직 연결 전
  await tick()
  const ws = FakeWs.instances[0]
  assert.equal(ws.url, 'wss://k.test/ws/speech')
  ws.open()
  assert.equal(ws.json()[0].type, 'start')
  assert.equal(ws.binaries(), 0)
  ws.server({ type: 'ready', v: 1, sessionId: 'x' })
  assert.equal(ws.binaries(), 5, '버퍼 5프레임 전송')
  cap.push(100)
  ws.server({ type: 'partial', segIdx: 0, text: 'こん' })
  client.end()
  assert.equal(cap.stopped(), 1, '손 떼면 마이크 즉시 해제')
  assert.equal(ws.json().at(-1)?.type, 'stop')
  ws.server({ type: 'final', utteranceId: null, text: 'こんにちは', durationMs: 300, engine: 'x' })
  const fin = events.find((e) => e.type === 'final')
  assert.deepEqual(fin, { type: 'final', text: 'こんにちは', durationMs: 300, utteranceId: null })
  assert.ok(events.some((e) => e.type === 'partial'))
  assert.ok(events.some((e) => e.type === 'level'))
  // 다음 발화는 같은 연결로(새 티켓·start 없음)
  await client.begin({ purpose: 'MIC_TEST' })
  assert.equal(FakeWs.instances.length, 1)
  assert.equal(ws.json().filter((m) => m.type === 'start').length, 1)
  client.dispose()
})

test('WS 클라이언트: 연결 전 4401 은 새 티켓으로 1번 조용히 재시도, 두 번째는 TICKET', async () => {
  const { client, events, tickets } = setup()
  await client.begin({ purpose: 'TURN' })
  await tick()
  FakeWs.instances[0].open()
  FakeWs.instances[0].drop(4401)
  await tick()
  assert.equal(tickets(), 2)
  assert.equal(events.filter((e) => e.type === 'error').length, 0)
  FakeWs.instances[1].open()
  FakeWs.instances[1].drop(4403)
  await tick()
  assert.deepEqual(events.filter((e) => e.type === 'error'), [{ type: 'error', code: 'TICKET' }])
  client.dispose()
})

test('WS 클라이언트: 티켓 422 → SERVER_UNAVAILABLE, 녹음 중 끊김 → CONNECTION_LOST, 유휴 끊김은 조용히', async () => {
  const a = setup([Object.assign(new Error('x'), { status: 422, code: 'ENGINE_UNAVAILABLE' })])
  await a.client.begin({ purpose: 'MIC_TEST' })
  await tick()
  assert.deepEqual(a.events.filter((e) => e.type === 'error'), [{ type: 'error', code: 'SERVER_UNAVAILABLE' }])
  assert.equal(a.cap.stopped(), 1, '오류면 마이크 해제')
  a.client.dispose()

  const b = setup()
  await b.client.begin({ purpose: 'MIC_TEST' })
  await tick()
  const ws = FakeWs.instances[0]
  ws.open()
  ws.server({ type: 'ready' })
  ws.drop(1006)
  assert.deepEqual(b.events.filter((e) => e.type === 'error'), [{ type: 'error', code: 'CONNECTION_LOST' }])

  const c = setup()
  await c.client.begin({ purpose: 'MIC_TEST' })
  await tick()
  const ws2 = FakeWs.instances[0]
  ws2.open()
  ws2.server({ type: 'ready' })
  c.client.cancel()
  ws2.drop(4408)
  assert.equal(c.events.filter((e) => e.type === 'error').length, 0)
  c.client.dispose()
})

test('WS 클라이언트: 취소한 발화의 늦은 final 은 다음 발화에 섞이지 않는다', async () => {
  const { client, cap, events } = setup()
  await client.begin({ purpose: 'MIC_TEST' })
  await tick()
  const ws = FakeWs.instances[0]
  ws.open()
  ws.server({ type: 'ready' })
  cap.push(80)
  client.end()
  client.cancel() // 결과 대기 중 취소(예: 8초 무응답)
  await client.begin({ purpose: 'MIC_TEST' })
  cap.push(80)
  ws.server({ type: 'partial', segIdx: 0, text: '옛 발화' })
  ws.server({ type: 'final', utteranceId: null, text: '옛 발화', durationMs: 80 })
  assert.equal(events.filter((e) => e.type === 'final' || e.type === 'partial').length, 0)
  client.end()
  ws.server({ type: 'final', utteranceId: null, text: '새 발화', durationMs: 80 })
  assert.deepEqual(events.filter((e) => e.type === 'final').map((e) => (e as { text: string }).text), ['새 발화'])
  client.dispose()
})

test('WS 클라이언트: 서버 치명 오류 + close 4422 → SERVER_UNAVAILABLE, 용도가 바뀌면 새 연결', async () => {
  const { client, events } = setup()
  await client.begin({ purpose: 'MIC_TEST' })
  await tick()
  FakeWs.instances[0].open()
  FakeWs.instances[0].server({ type: 'error', code: 'ENGINE_UNAVAILABLE', message: 'x', fatal: true })
  FakeWs.instances[0].drop(4422)
  assert.deepEqual(events.filter((e) => e.type === 'error'), [{ type: 'error', code: 'SERVER_UNAVAILABLE' }])
  await client.begin({ purpose: 'MIC_TEST' })
  await tick()
  FakeWs.instances[1].open()
  FakeWs.instances[1].server({ type: 'ready' })
  client.cancel()
  await client.begin({ purpose: 'TURN', chatId: 'c1' })
  await tick()
  assert.equal(FakeWs.instances.length, 3, '용도·대화가 바뀌면 새 티켓·새 연결')
  assert.equal(FakeWs.instances[1].readyState, 3)
  client.dispose()
})
