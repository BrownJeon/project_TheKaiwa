/**
 * 휴대폰 경로 실시간 인식 클라이언트(`kind:'ONDEVICE'`) — 앱 네이티브 플러그인을 `RealtimeSttClient` 로 감싼다.
 * 플러그인은 모델 스토어(`onDeviceModel.ts`)가 브리지에서 꺼내 넘겨 준다. 설계 문서의 온디바이스 클라이언트가 이것이다 —
 * 이 디렉터리는 엔진명 0 규칙(경계 테스트)이라 중립 이름을 쓴다(module-dependency §6).
 *
 * 흐름(플러그인 JS 계약 v1, task-003f):
 *  - `begin()` = 권한 확인(없으면 요청) → `start({endpoint:'manual'})` → 마이크가 열리면 resolve(`ready`). 인식기가 아직 안 올라왔어도
 *    플러그인이 소리를 버퍼한다.
 *  - `end()` = `stop()` — 플러그인은 마지막 `final` 이벤트를 낸 뒤 같은 payload 로 resolve 한다. **세션 id 로 한 번만** 처리한다.
 *  - final 처리: TURN 이고 글자가 있으면 wav 를 #21 로 올려 `utteranceId` 를 받고(최대 5초, 실패는 null — 회화방은 글자 턴으로 보낸다),
 *    올린 뒤·올리지 않을 때 모두 `deleteWav`. MIC_TEST 는 wav 를 만들지 않는다(`saveWav:false`) — 서버에 아무것도 남기지 않는다.
 *  - 플러그인 오류는 `SttEvent.error` 로 바꾸고, 라우터가 폴백을 판단하도록 `onFailure` 로도 알린다(셈/즉시/세지 않음 — 계약 v1 권고).
 * 결과 텍스트·소리를 로그에 남기지 않는다. 플러그인 payload 의 모델 버전 등은 화면으로 올리지 않는다.
 */
import { nativeErrorCode, type OnDeviceEventMap, type OnDeviceFinalPayload, type OnDeviceListenerHandle, type OnDeviceStartOptions, type OnDeviceSttPlugin } from '@/modules/infra/native'
import { SttError, type BeginOptions, type RealtimeSttClient, type SttClientConfig, type SttErrorCode, type SttEvent } from './types'

export const UPLOAD_TIMEOUT_MS = 5_000
/** begin 거부의 `pluginCode` — 권한 대화상자만 띄웠고 허용됐다(오류가 아니라 힌트). */
export const PERMISSION_ONLY = 'PERMISSION_ONLY'
export const DEFAULT_UPLOAD_MAX_BYTES = 2 * 1024 * 1024

export interface OnDeviceUpload {
  wav: Blob
  text: string
  durationMs: number
  chatId?: string
  connectionKey: string
  segments: Array<{ segIdx: number; start: number; end: number; text: string }>
  timings: Record<string, number>
}

/** 플러그인 실패(라우터 폴백·모델 스토어 입력). `phase` = start 거부인지 세션 중 오류인지. */
export interface OnDeviceFailure {
  code: string
  phase: 'start' | 'session'
  /** 앱 실행당 전환 카운트에 넣는가(screens §11-3 C 표). */
  countable: boolean
}

export interface OnDeviceSttDeps {
  plugin: OnDeviceSttPlugin
  config: SttClientConfig['onDevice'] & { upload?: SttClientConfig['upload'] }
  /** #21 업로드 → utteranceId. 없으면 업로드하지 않는다. */
  upload?: (u: OnDeviceUpload, signal: AbortSignal) => Promise<string | null>
  /** 플러그인 wav 경로 → Blob(브리지 `readNativeFile`). */
  readWav?: (path: string, maxBytes: number) => Promise<Blob | null>
  onFailure?: (f: OnDeviceFailure) => void
}

/**
 * 세지 않는 코드(플러그인 계약 v1 권고 + screens §11-3 C): 권한·앱 전환·개발 오류·모델 없음(모델 없음은 스토어가 다시 확인해
 * 다음 누름부터 서버로 가므로 셀 필요가 없다). 그 밖(AUDIO_INIT_FAILED·BUSY·MODEL_CORRUPT·OOM·DECODE_FAILED·알 수 없음)은 센다.
 */
const NOT_COUNTED = new Set(['PERMISSION_DENIED', 'INTERRUPTED', 'ALREADY_STARTED', 'INVALID_ARGUMENT', 'MODEL_MISSING'])

export function isCountableFailure(code: string): boolean {
  return !NOT_COUNTED.has(code)
}

/** 세션 중 오류 → 화면 코드. start 거부의 화면 코드는 라우터가 정한다(서버로 이어갈 수 있어서). */
export function sessionErrorCode(code: string): SttErrorCode {
  return code === 'PERMISSION_DENIED' ? 'MIC_DENIED' : 'ENGINE_ERROR'
}

/** 이번 앱 실행의 마지막 휴대폰 인식 계측(관리자 진단 카드 — 글자·소리 없음, 저장·전송하지 않는다). */
let lastTimings: { durationMs: number; decodeMs: number | null; at: number } | null = null
export function lastOnDeviceTimings(): { durationMs: number; decodeMs: number | null; at: number } | null {
  return lastTimings
}

type Utter = 'none' | 'starting' | 'capturing' | 'ended' | 'finishing'

function positiveInt(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined
}

export class OnDeviceSttClient implements RealtimeSttClient {
  readonly kind = 'ONDEVICE' as const
  private readonly listeners = new Set<(e: SttEvent) => void>()
  private handles: OnDeviceListenerHandle[] = []
  private listening: Promise<void> | null = null
  private utter: Utter = 'none'
  private gen = 0
  private sessionId: string | null = null
  private purpose: BeginOptions | null = null
  private handled = new Set<string>()
  private disposed = false

  constructor(private readonly deps: OnDeviceSttDeps) {}

  subscribe(fn: (e: SttEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(e: SttEvent): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(e)
      } catch {
        // 구독자 오류가 인식 경로를 멈추지 않게
      }
    }
  }

  private startFailure(code: string): SttError {
    this.deps.onFailure?.({ code, phase: 'start', countable: isCountableFailure(code) })
    return new SttError(code === 'PERMISSION_DENIED' ? 'MIC_DENIED' : 'ENGINE_ERROR', undefined, code)
  }

  private ensureListeners(): Promise<void> {
    if (this.listening) return this.listening
    const p = this.deps.plugin
    const add = async <K extends keyof OnDeviceEventMap>(name: K, fn: (d: OnDeviceEventMap[K]) => void) => {
      const h = await p.addListener(name, fn)
      if (this.disposed) await h.remove()
      else this.handles.push(h)
    }
    this.listening = Promise.all([
      add('level', (d) => {
        if (d?.sessionId === this.sessionId && this.utter === 'capturing' && typeof d.db === 'number') this.emit({ type: 'level', db: d.db })
      }),
      add('partial', (d) => {
        if (d?.sessionId === this.sessionId && (this.utter === 'capturing' || this.utter === 'finishing') && typeof d.text === 'string') {
          this.emit({ type: 'partial', segIdx: typeof d.segIdx === 'number' ? d.segIdx : 0, text: d.text })
        }
      }),
      add('final', (d) => void this.onFinal(d)),
      add('error', (d) => this.onPluginError(d?.sessionId ?? null, typeof d?.code === 'string' ? d.code : 'UNKNOWN')),
    ]).then(() => undefined)
    return this.listening
  }

  begin(o: BeginOptions): Promise<void> {
    if (this.utter !== 'none') this.cancel()
    this.disposed = false
    const gen = ++this.gen
    this.utter = 'starting'
    this.purpose = o
    return this.start(gen, o)
  }

  /** #19 실행 값 → start 옵션. 범위 밖 값은 빼고 플러그인 기본값에 맡긴다(INVALID_ARGUMENT 로 막히지 않게). */
  private startOptions(o: BeginOptions): OnDeviceStartOptions {
    const rt = this.deps.config?.runtime
    const out: OnDeviceStartOptions = { endpoint: 'manual', partial: rt?.partial !== false, saveWav: o.purpose === 'TURN', maxUtteranceSec: 60, vad: {} }
    const threads = positiveInt(rt?.numThreads, 1, 8)
    if (threads) out.numThreads = threads
    if (rt?.decodingMethod === 'greedy_search' || rt?.decodingMethod === 'modified_beam_search') out.decodingMethod = rt.decodingMethod
    const silence = positiveInt(rt?.vad?.silenceMs, 200, 2000)
    if (silence) out.vad!.silenceMs = silence
    const th = rt?.vad?.threshold
    if (typeof th === 'number' && th >= 0.1 && th <= 0.9) out.vad!.threshold = th
    return out
  }

  private async start(gen: number, o: BeginOptions): Promise<void> {
    const p = this.deps.plugin
    try {
      await this.ensureListeners()
    } catch {
      if (gen === this.gen) this.utter = 'none'
      throw this.startFailure('LISTENER_FAILED')
    }
    const perm = await p.checkPermissions().catch(() => null)
    if (gen !== this.gen) return
    if (perm?.recordAudio !== 'granted') {
      // 첫 누름 = 권한만(screens §8-0 ③·§11-3 D) — 대화상자만 띄우고 이번 누름은 녹음하지 않는다.
      const asked = await p.requestPermissions().catch(() => null)
      if (gen !== this.gen) return
      this.utter = 'none'
      if (asked?.recordAudio === 'granted') throw new SttError('MIC_DENIED', undefined, PERMISSION_ONLY)
      throw this.startFailure('PERMISSION_DENIED')
    }
    let res: { sessionId: string }
    try {
      res = await p.start(this.startOptions(o))
    } catch (e) {
      if (gen !== this.gen) return
      this.utter = 'none'
      throw this.startFailure(nativeErrorCode(e))
    }
    if (gen !== this.gen || this.disposed) {
      // 여는 사이 취소됐다 — 방금 연 마이크를 닫는다(final 없음).
      void p.cancel().catch(() => undefined)
      return
    }
    this.sessionId = res.sessionId
    this.utter = 'capturing'
    this.emit({ type: 'ready' })
  }

  end(): void {
    if (this.utter === 'ended') {
      // 플러그인이 60초 상한으로 먼저 끝낸 발화 — 이미 final 을 냈으니 빈 final 로 화면만 닫는다.
      this.utter = 'none'
      this.emit({ type: 'final', text: '', durationMs: 0, utteranceId: null })
      return
    }
    if (this.utter !== 'capturing') return
    this.utter = 'finishing'
    const gen = this.gen
    this.deps.plugin
      .stop()
      .then((r) => {
        if (r?.utterance) void this.onFinal(r.utterance)
        else if (gen === this.gen && this.utter === 'finishing') {
          // 세션이 이미 닫혀 있었다(오류 이벤트가 먼저 왔거나 앱 전환) — 빈 결과로 닫는다.
          this.utter = 'none'
          this.emit({ type: 'final', text: '', durationMs: 0, utteranceId: null })
        }
      })
      .catch((e: unknown) => {
        if (gen !== this.gen || this.utter !== 'finishing') return
        this.sessionFailure(nativeErrorCode(e))
      })
  }

  cancel(): void {
    const was = this.utter
    this.gen++
    this.utter = 'none'
    this.sessionId = null
    if (was === 'starting' || was === 'capturing' || was === 'finishing') void this.deps.plugin.cancel().catch(() => undefined)
  }

  dispose(): void {
    this.cancel()
    this.disposed = true
    const hs = this.handles
    this.handles = []
    this.listening = null
    for (const h of hs) void Promise.resolve(h.remove()).catch(() => undefined)
  }

  private onPluginError(sessionId: string | null, code: string): void {
    const active = this.utter === 'capturing' || this.utter === 'finishing'
    if (!active || (sessionId !== null && sessionId !== this.sessionId)) return
    this.sessionFailure(code)
  }

  private sessionFailure(code: string): void {
    this.gen++
    this.utter = 'none'
    this.sessionId = null
    if (code === 'INTERRUPTED') {
      this.emit({ type: 'interrupted' })
      return
    }
    // 라우터가 먼저 듣고(카운트·전환 판단) 같은 오류 이벤트에 switched·offlineMode 를 붙인다.
    this.deps.onFailure?.({ code, phase: 'session', countable: isCountableFailure(code) })
    this.emit({ type: 'error', code: sessionErrorCode(code) })
  }

  private async onFinal(d: OnDeviceFinalPayload | undefined): Promise<void> {
    if (!d || typeof d.sessionId !== 'string' || this.handled.has(d.sessionId)) return
    this.handled.add(d.sessionId)
    if (this.handled.size > 50) this.handled = new Set([d.sessionId])
    const wavPath = typeof d.wavPath === 'string' && d.wavPath ? d.wavPath : null
    const mine = d.sessionId === this.sessionId && (this.utter === 'capturing' || this.utter === 'finishing')
    if (!mine) {
      if (wavPath) this.deleteWav(wavPath)
      return
    }
    const text = typeof d.text === 'string' ? d.text : ''
    const durationMs = typeof d.durationMs === 'number' && d.durationMs >= 0 ? Math.round(d.durationMs) : 0
    if (this.utter === 'capturing') {
      // 60초 상한에 플러그인이 먼저 끝냈다. 손을 떼면(end) 빈 final 로 닫는다. 이 발화는 회화 턴으로 보내지 않는다(누른 채라 화면이 finishing 이 아니다).
      this.utter = 'ended'
      if (wavPath) this.deleteWav(wavPath)
      this.emit({ type: 'final', text, durationMs, utteranceId: null })
      return
    }
    const decodeMs = typeof d.timings?.decodeMs === 'number' && d.timings.decodeMs >= 0 ? Math.round(d.timings.decodeMs) : null
    if (text.trim()) lastTimings = { durationMs, decodeMs, at: Date.now() }
    const gen = this.gen
    const utteranceId = await this.uploadIfNeeded(d, text, durationMs, wavPath)
    if (gen !== this.gen || this.utter !== 'finishing') return
    this.utter = 'none'
    this.sessionId = null
    this.emit({ type: 'final', text, durationMs, utteranceId })
  }

  private async uploadIfNeeded(d: OnDeviceFinalPayload, text: string, durationMs: number, wavPath: string | null): Promise<string | null> {
    const key = this.deps.config?.connectionKey
    const o = this.purpose
    try {
      if (!wavPath || !text.trim() || o?.purpose !== 'TURN' || !this.deps.upload || !this.deps.readWav || !key) return null
      const maxBytes = positiveInt(this.deps.config?.upload?.maxBytes, 1, 64 * 1024 * 1024) ?? DEFAULT_UPLOAD_MAX_BYTES
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS)
      try {
        const wav = await this.deps.readWav(wavPath, maxBytes)
        if (!wav) return null
        const segments = Array.isArray(d.segments)
          ? d.segments.slice(0, 50).map((s) => ({ segIdx: s.segIdx, start: Math.max(0, Math.round(s.startMs)), end: Math.max(0, Math.round(s.endMs)), text: String(s.text ?? '') }))
          : []
        const timings: Record<string, number> = {}
        for (const k of ['vadMs', 'decodeMs', 'sttMs'] as const) {
          const v = d.timings?.[k]
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) timings[k] = Math.round(v)
        }
        return await this.deps.upload({ wav, text, durationMs, ...(o.chatId ? { chatId: o.chatId } : {}), connectionKey: key, segments, timings }, ctrl.signal)
      } finally {
        clearTimeout(timer)
      }
    } catch {
      return null
    } finally {
      if (wavPath) this.deleteWav(wavPath)
    }
  }

  private deleteWav(path: string): void {
    const del = this.deps.plugin.deleteWav
    if (typeof del === 'function') void del.call(this.deps.plugin, { wavPath: path }).catch(() => undefined)
  }
}
