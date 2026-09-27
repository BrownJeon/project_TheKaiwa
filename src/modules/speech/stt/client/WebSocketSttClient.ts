/**
 * 서버 경로 실시간 인식 클라이언트(`kind:'GATEWAY'`) — #20 티켓 → `/ws/speech` v1 → PCM16 16kHz 40ms 프레임.
 *
 * 흐름(docs/screens.md §8-3 A, 이력서 A 계약):
 *  - `begin()` 은 누름 핸들러 안에서 동기로 불린다: AudioContext 를 깨우고(제스처), 연결(티켓·WS·`start`→`ready`)을 **병행**으로 시작한 뒤
 *    마이크가 열리면 resolve. `ready` 전 프레임은 최대 3초(75프레임) 버퍼했다가 보낸다 — 첫 음절을 잃지 않게.
 *  - `end()` = 남은 샘플을 무음으로 채운 마지막 프레임 + `stop`(→ 서버는 final 정확히 1번). `cancel()` = 보낸 소리가 있으면 `cancel`.
 *  - 연결은 발화 뒤 유휴 60초까지 두고(15초마다 ping) 다음 누름에 새 티켓 없이 그대로 쓴다. 용도(purpose·chatId)가 바뀌면 새로 연다.
 *  - 연결 전 4401·4403(티켓 무효/재사용)은 **새 티켓으로 1번 조용히** 다시 연결한다(버퍼 유지). 유휴 중 닫힘은 오류가 아니다.
 *  - `stop` 을 보낼 때마다 발화 세대를 줄 세워 두고 final 을 순서대로 맞춘다 — 취소한 발화의 늦은 final·partial 이 다음 발화에 섞이지 않는다.
 * 서버 메시지는 protocol.parseServerMessage 가 필요한 필드만 남긴다(엔진·추적 값 없음). 전사·소리를 로그에 남기지 않는다.
 */
import { BrowserCapture, type CaptureDriver, type CaptureHandle } from './capture'
import { Downsampler, FrameChunker, LevelMeter } from './pcm'
import { buildStartMessage, mapCloseCode, mapServerError, mapTicketFailure, parseServerMessage, resolveWsUrl, type ConnPhase } from './protocol'
import { SttError, type BeginOptions, type RealtimeSttClient, type SttErrorCode, type SttEvent, type TicketFetcher } from './types'

export const PRE_READY_BUFFER_FRAMES = 75
export const IDLE_CLOSE_MS = 60_000
export const PING_MS = 15_000
export const SLOW_CONNECT_MS = 1_500

type Timer = ReturnType<typeof setTimeout>

export interface WebSocketSttDeps {
  fetchTicket: TicketFetcher
  capture?: CaptureDriver
  WebSocketImpl?: typeof WebSocket
  location?: { protocol: string; host: string }
  clientPlatform?: 'web' | 'android'
  partial?: boolean
  /** 사전 점검(보안 컨텍스트·API 존재·온라인). 테스트는 끈다. */
  checkEnvironment?: () => SttErrorCode | null
}

export function browserEnvironmentProblem(): SttErrorCode | null {
  if (typeof window === 'undefined') return 'UNSUPPORTED'
  if (!window.isSecureContext) return 'INSECURE'
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined' || typeof WebSocket === 'undefined') return 'UNSUPPORTED'
  if (navigator.onLine === false) return 'OFFLINE'
  return null
}

type UtterState = 'none' | 'capturing' | 'finishing'

export class WebSocketSttClient implements RealtimeSttClient {
  readonly kind = 'GATEWAY' as const
  private readonly listeners = new Set<(e: SttEvent) => void>()
  private readonly capture: CaptureDriver
  private readonly WS: typeof WebSocket

  private ws: WebSocket | null = null
  private wsState: 'none' | 'connecting' | 'ready' = 'none'
  private sessionKey: string | null = null
  private session: BeginOptions | null = null
  private ticketRetried = false
  private serverError: string | null = null
  private slowTimer: Timer | null = null
  private idleTimer: Timer | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null

  private gen = 0
  private utter: UtterState = 'none'
  private buffer: ArrayBuffer[] = []
  private sentAny = false
  private stopPending = false
  /** 보낸 stop 들의 발화 세대(오래된 순). final 하나가 맨 앞 하나와 짝. */
  private stopQueue: number[] = []
  private handle: CaptureHandle | null = null
  private down: Downsampler | null = null
  private chunker = new FrameChunker()
  private meter: LevelMeter | null = null
  private disposed = false

  constructor(private readonly deps: WebSocketSttDeps) {
    this.capture = deps.capture ?? new BrowserCapture()
    this.WS = deps.WebSocketImpl ?? WebSocket
  }

  subscribe(fn: (e: SttEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(e: SttEvent): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(e)
      } catch {
        // 구독자 오류가 오디오 경로를 멈추지 않게
      }
    }
  }

  begin(o: BeginOptions): Promise<void> {
    const problem = (this.deps.checkEnvironment ?? browserEnvironmentProblem)()
    if (problem) return Promise.reject(new SttError(problem))
    if (this.utter !== 'none') this.cancel()
    this.disposed = false
    try {
      this.capture.prepare()
    } catch (e) {
      return Promise.reject(e instanceof SttError ? e : new SttError('UNSUPPORTED'))
    }
    const gen = ++this.gen
    this.utter = 'capturing'
    this.buffer = []
    this.sentAny = false
    this.stopPending = false
    this.chunker.reset()
    this.clearIdle()
    this.ensureConnection(o)
    return this.openCapture(gen)
  }

  private async openCapture(gen: number): Promise<void> {
    let handle: CaptureHandle
    try {
      handle = await this.capture.open((s) => this.onSamples(gen, s))
    } catch (e) {
      if (gen === this.gen) this.dropUtterance()
      throw e instanceof SttError ? e : new SttError('UNSUPPORTED')
    }
    // 권한 프롬프트를 기다리는 사이 취소·다음 발화가 시작됐으면 이 마이크는 바로 닫는다.
    if (gen !== this.gen || this.utter !== 'capturing') {
      handle.stop()
      return
    }
    this.handle = handle
    this.down = new Downsampler(handle.sampleRate)
    this.meter = new LevelMeter(handle.sampleRate)
  }

  private onSamples(gen: number, samples: Float32Array): void {
    if (gen !== this.gen || this.utter !== 'capturing' || !this.down || !this.meter) return
    this.meter.push(samples, (db) => this.emit({ type: 'level', db }))
    this.chunker.push(this.down.process(samples), (f) => this.sendFrame(f))
  }

  private sendFrame(frame: ArrayBuffer): void {
    if (this.wsState === 'ready' && this.ws && this.ws.readyState === this.WS.OPEN) {
      this.ws.send(frame)
      this.sentAny = true
      return
    }
    this.buffer.push(frame)
    if (this.buffer.length > PRE_READY_BUFFER_FRAMES) this.buffer.shift()
  }

  end(): void {
    if (this.utter !== 'capturing') return
    this.chunker.flush((f) => this.sendFrame(f))
    this.stopCapture()
    this.utter = 'finishing'
    if (this.wsState === 'ready') this.sendStop()
    else this.stopPending = true
  }

  cancel(): void {
    const was = this.utter
    this.gen++
    this.stopCapture()
    this.buffer = []
    this.stopPending = false
    if (was === 'capturing' && this.sentAny && this.wsState === 'ready') this.sendJson({ type: 'cancel' })
    this.utter = 'none'
    this.scheduleIdle()
  }

  dispose(): void {
    this.cancel()
    this.disposed = true
    this.closeWs()
    this.capture.close()
  }

  // ── 캡처 ─────────────────────────────────────────────────────────────
  private stopCapture(): void {
    this.handle?.stop()
    this.handle = null
    this.down = null
    this.meter = null
  }

  /** 발화를 버리고 연결 상태와 무관하게 초기화(오류 뒤). */
  private dropUtterance(): void {
    this.gen++
    this.stopCapture()
    this.buffer = []
    this.stopPending = false
    this.utter = 'none'
  }

  private fail(code: SttErrorCode, retryAfterSec?: number): void {
    const active = this.utter !== 'none'
    this.dropUtterance()
    this.stopQueue = []
    if (active) this.emit({ type: 'error', code, ...(retryAfterSec ? { retryAfterSec } : {}) })
  }

  // ── 연결 ─────────────────────────────────────────────────────────────
  private ensureConnection(o: BeginOptions): void {
    const key = `${o.purpose}|${o.chatId ?? ''}`
    if (this.ws && this.sessionKey === key && this.wsState !== 'none') return
    if (this.ws) this.closeWs()
    this.sessionKey = key
    this.session = o
    this.ticketRetried = false
    void this.connect(key)
  }

  private async connect(key: string): Promise<void> {
    const o = this.session
    if (!o) return
    this.wsState = 'connecting'
    this.serverError = null
    this.emit({ type: 'connecting', slow: false })
    this.clearSlow()
    this.slowTimer = setTimeout(() => {
      if (this.wsState === 'connecting' && this.utter !== 'none') this.emit({ type: 'connecting', slow: true })
    }, SLOW_CONNECT_MS)

    let ticket
    try {
      ticket = await this.deps.fetchTicket({ purpose: o.purpose, ...(o.chatId ? { chatId: o.chatId } : {}) })
    } catch (e) {
      if (this.sessionKey !== key || this.disposed) return
      this.wsState = 'none'
      this.clearSlow()
      const err = mapTicketFailure(e)
      this.fail(err.code, err.retryAfterSec)
      return
    }
    if (this.sessionKey !== key || this.disposed) return
    const loc = this.deps.location ?? (typeof window !== 'undefined' ? window.location : { protocol: 'https:', host: 'localhost' })
    let ws: WebSocket
    try {
      ws = new this.WS(resolveWsUrl(ticket, loc))
    } catch {
      this.wsState = 'none'
      this.clearSlow()
      this.fail('CONNECT_FAILED')
      return
    }
    ws.binaryType = 'arraybuffer'
    this.ws = ws
    const start = buildStartMessage({ ticket: ticket.ticket, chatId: o.chatId, partial: this.deps.partial ?? true, clientPlatform: this.deps.clientPlatform ?? 'web' })
    ws.onopen = () => {
      if (this.ws === ws) ws.send(start)
    }
    ws.onmessage = (ev: MessageEvent) => this.onMessage(ws, ev.data)
    ws.onclose = (ev: CloseEvent) => this.onClose(ws, ev.code)
    ws.onerror = () => undefined
  }

  private onMessage(ws: WebSocket, data: unknown): void {
    if (ws !== this.ws) return
    const m = parseServerMessage(data)
    if (!m) return
    switch (m.type) {
      case 'ready':
        this.onReady()
        return
      case 'partial':
        if (this.utter !== 'none' && (this.stopQueue.length === 0 || this.stopQueue[0] === this.gen)) this.emit({ type: 'partial', segIdx: m.segIdx, text: m.text })
        return
      case 'final': {
        const head = this.stopQueue.shift()
        if (head === undefined) {
          // stop 없이 온 final = 서버 강제 끝(60초 상한). 녹음 중이면 결과로 싣는다.
          if (this.utter === 'capturing') this.emit({ type: 'final', text: m.text, durationMs: m.durationMs, utteranceId: m.utteranceId })
          return
        }
        if (head === this.gen && this.utter === 'finishing') {
          this.utter = 'none'
          this.emit({ type: 'final', text: m.text, durationMs: m.durationMs, utteranceId: m.utteranceId })
          this.scheduleIdle()
        }
        return
      }
      case 'error':
        if (m.fatal) this.serverError = m.code
        return
      default:
        return
    }
  }

  private onReady(): void {
    this.wsState = 'ready'
    this.ticketRetried = false
    this.clearSlow()
    this.emit({ type: 'ready' })
    const pending = this.buffer
    this.buffer = []
    for (const f of pending) this.sendFrame(f)
    if (this.stopPending) {
      this.stopPending = false
      this.sendStop()
    }
    this.startPing()
    this.scheduleIdle()
  }

  private onClose(ws: WebSocket, code: number): void {
    if (ws !== this.ws) return
    const prev = this.wsState
    this.ws = null
    this.wsState = 'none'
    this.clearSlow()
    this.clearIdle()
    this.stopPing()
    const phase: ConnPhase = prev === 'connecting' ? 'connecting' : this.utter !== 'none' ? 'active' : 'idle'
    const server = this.serverError
    this.serverError = null
    this.stopQueue = []
    if (phase === 'idle' || this.disposed) return

    const ticketProblem = code === 4401 || code === 4403 || server === 'UNAUTHENTICATED'
    if (ticketProblem && phase === 'connecting' && !this.ticketRetried && this.utter !== 'none' && this.session && this.sessionKey) {
      this.ticketRetried = true
      void this.connect(this.sessionKey)
      return
    }
    const code4xxx = code >= 4400 && code < 4500
    const err = (server && !code4xxx ? mapServerError(server) : null) ?? mapCloseCode(code, phase)
    if (err) this.fail(err)
    else this.dropUtterance()
  }

  private sendJson(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === this.WS.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private sendStop(): void {
    this.stopQueue.push(this.gen)
    this.sendJson({ type: 'stop' })
  }

  private closeWs(): void {
    const ws = this.ws
    this.ws = null
    this.wsState = 'none'
    this.sessionKey = null
    this.stopQueue = []
    this.clearSlow()
    this.clearIdle()
    this.stopPing()
    if (!ws) return
    ws.onopen = null
    ws.onmessage = null
    ws.onclose = null
    ws.onerror = null
    try {
      ws.close(1000)
    } catch {
      // 이미 닫힘
    }
  }

  // ── 타이머 ───────────────────────────────────────────────────────────
  private scheduleIdle(): void {
    this.clearIdle()
    if (this.utter !== 'none' || this.wsState !== 'ready') return
    this.idleTimer = setTimeout(() => {
      if (this.utter === 'none') this.closeWs()
    }, IDLE_CLOSE_MS)
  }
  private clearIdle(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }
  private clearSlow(): void {
    if (this.slowTimer) clearTimeout(this.slowTimer)
    this.slowTimer = null
  }
  private startPing(): void {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      if (this.utter === 'none') this.sendJson({ type: 'ping' })
    }, PING_MS)
  }
  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer)
    this.pingTimer = null
  }
}
