/**
 * 브라우저 마이크 캡처 — getUserMedia → AudioWorklet → Float32 조각(약 20ms)을 메인 스레드로.
 *
 *  - AudioContext 는 **누름 핸들러 안에서 동기로** 만들고/깨운다(`prepare`) — 제스처 밖에서 만들면 suspended 로 남는다(WebView).
 *    16kHz 로 만들어 보고(브라우저가 리샘플), 안 되면 기본 레이트 — 어느 쪽이든 `Downsampler` 가 16kHz 로 맞춘다.
 *  - 컨텍스트는 발화 사이에 suspend 해 두고 다시 쓴다(워클릿 모듈을 매번 올리지 않게). 마이크 트랙은 발화마다 즉시 stop
 *    — 손을 떼는 순간 브라우저 녹음 표시가 꺼진다.
 *  - 워클릿 모듈은 Blob URL 로 올린다(정적 파일이면 로그인 프록시·캐시를 탄다). CSP 를 붙일 때 `worker-src blob:` 필요(Phase 2 메모).
 * 소리 데이터는 어디에도 저장하지 않는다(프레임은 전송 버퍼에만 잠깐 있다).
 */
import { SttError } from './types'
import { mapMediaError } from './protocol'

export interface CaptureHandle {
  readonly sampleRate: number
  stop(): void
}

export interface CaptureDriver {
  /** 제스처 안에서 동기로. 지원하지 않으면 SttError 를 던진다. */
  prepare(): void
  open(onSamples: (samples: Float32Array) => void): Promise<CaptureHandle>
  close(): void
}

const PROCESSOR = 'kaiwa-stt-capture'
const WORKLET_SOURCE = `
class KaiwaSttCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.size = Math.max(128, Math.round(sampleRate * 0.02))
    this.buf = new Float32Array(this.size)
    this.n = 0
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) {
      let i = 0
      while (i < ch.length) {
        const take = Math.min(this.size - this.n, ch.length - i)
        this.buf.set(ch.subarray(i, i + take), this.n)
        this.n += take
        i += take
        if (this.n === this.size) {
          const out = this.buf
          this.port.postMessage(out, [out.buffer])
          this.buf = new Float32Array(this.size)
          this.n = 0
        }
      }
    }
    return true
  }
}
registerProcessor('${PROCESSOR}', KaiwaSttCapture)
`

let workletUrl: string | null = null
function moduleUrl(): string {
  workletUrl ??= URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }))
  return workletUrl
}

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export class BrowserCapture implements CaptureDriver {
  private ctx: AudioContext | null = null
  private moduleReady: Promise<void> | null = null

  prepare(): void {
    const AC = audioContextCtor()
    if (!AC || typeof AudioWorkletNode === 'undefined') throw new SttError('UNSUPPORTED')
    if (!this.ctx || this.ctx.state === 'closed') {
      try {
        this.ctx = new AC({ sampleRate: 16_000, latencyHint: 'interactive' })
      } catch {
        this.ctx = new AC({ latencyHint: 'interactive' })
      }
      this.moduleReady = null
    }
    void this.ctx.resume().catch(() => undefined)
  }

  private async ensureModule(ctx: AudioContext): Promise<void> {
    this.moduleReady ??= ctx.audioWorklet.addModule(moduleUrl())
    try {
      await this.moduleReady
    } catch {
      this.moduleReady = null
      throw new SttError('UNSUPPORTED')
    }
  }

  async open(onSamples: (samples: Float32Array) => void): Promise<CaptureHandle> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch (e) {
      throw new SttError(mapMediaError(e))
    }
    const stopTracks = () => stream.getTracks().forEach((t) => t.stop())
    try {
      let ctx = this.ctx
      if (!ctx || ctx.state === 'closed') throw new SttError('UNSUPPORTED')
      await this.ensureModule(ctx)
      let source: MediaStreamAudioSourceNode
      try {
        source = ctx.createMediaStreamSource(stream)
      } catch {
        // 일부 브라우저는 마이크와 다른 레이트의 컨텍스트에 연결하지 못한다 — 기본 레이트로 다시.
        await ctx.close().catch(() => undefined)
        const AC = audioContextCtor()
        if (!AC) throw new SttError('UNSUPPORTED')
        ctx = this.ctx = new AC({ latencyHint: 'interactive' })
        this.moduleReady = null
        await ctx.resume().catch(() => undefined)
        await this.ensureModule(ctx)
        source = ctx.createMediaStreamSource(stream)
      }
      const node = new AudioWorkletNode(ctx, PROCESSOR, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' })
      node.port.onmessage = (ev: MessageEvent) => {
        if (ev.data instanceof Float32Array) onSamples(ev.data)
      }
      // 출력이 그래프 끝에 닿아야 렌더링이 돈다 — 소리는 0 으로 내보낸다(자기 목소리 되울림 없음).
      const sink = ctx.createGain()
      sink.gain.value = 0
      source.connect(node)
      node.connect(sink)
      sink.connect(ctx.destination)
      const used = ctx
      return {
        sampleRate: used.sampleRate,
        stop: () => {
          node.port.onmessage = null
          try {
            source.disconnect()
            node.disconnect()
            sink.disconnect()
          } catch {
            // 이미 끊김
          }
          stopTracks()
          if (used.state === 'running') void used.suspend().catch(() => undefined)
        },
      }
    } catch (e) {
      stopTracks()
      throw e instanceof SttError ? e : new SttError('UNSUPPORTED')
    }
  }

  close(): void {
    const ctx = this.ctx
    this.ctx = null
    this.moduleReady = null
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined)
  }
}
