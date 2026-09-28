/**
 * 단위 테스트용 가짜 온디바이스 플러그인 — 메서드·이벤트·오류 코드 이름은 task-003f "플러그인 JS 계약 v1"(developer A) 그대로.
 * (PC 화면 E2E 용 가짜 `window.Capacitor` 는 `tests/live/fake-capacitor.js` — 번들 밖.)
 */
import type {
  OnDeviceEventMap,
  OnDeviceFinalPayload,
  OnDeviceListenerHandle,
  OnDeviceModelStatus,
  OnDevicePermission,
  OnDeviceStartOptions,
  OnDeviceSttPlugin,
} from '../../infra/native/bridge'
import type { BeginOptions, RealtimeSttClient, SttEvent } from '../stt/client/types'

type Fn = (d: unknown) => void

export function pluginError(code: string): Error {
  return Object.assign(new Error(`fake ${code}`), { code })
}

export class FakeOnDevice implements OnDeviceSttPlugin {
  perm: OnDevicePermission = 'granted'
  askResult: OnDevicePermission = 'granted'
  model: OnDeviceModelStatus = { installed: true, version: 'v1', bytes: 169_824_553, downloading: false }
  calls: string[] = []
  startOpts: OnDeviceStartOptions | null = null
  startError: string | null = null
  stopError: string | null = null
  finalText = 'こんにちは'
  finalWav: string | null = '/data/user/0/app/files/utterances/s1.wav'
  deleted: string[] = []
  current: string | null = null
  private n = 0
  private readonly listeners = new Map<string, Set<Fn>>()
  download: ((o: { manifestUrl: string; wifiOnly?: boolean; expectedVersion?: string }) => Promise<{ version: string; bytes: number; alreadyInstalled: boolean }>) | null = null

  emit<K extends keyof OnDeviceEventMap>(name: K, data: OnDeviceEventMap[K]): void {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn(data)
  }
  listenerCount(name: string): number {
    return this.listeners.get(name)?.size ?? 0
  }

  async checkPermissions() {
    this.calls.push('checkPermissions')
    return { recordAudio: this.perm }
  }
  async requestPermissions() {
    this.calls.push('requestPermissions')
    this.perm = this.askResult
    return { recordAudio: this.perm }
  }
  async checkModel(o?: { verify?: boolean }) {
    this.calls.push(o?.verify ? 'checkModel:verify' : 'checkModel')
    return { ...this.model }
  }
  async downloadModel(o: { manifestUrl: string; wifiOnly?: boolean; expectedVersion?: string }) {
    this.calls.push(`downloadModel:${o.wifiOnly === false ? 'any' : 'wifi'}`)
    if (!this.download) return { version: 'v1', bytes: 1, alreadyInstalled: false }
    return this.download(o)
  }
  async start(o?: OnDeviceStartOptions) {
    this.calls.push('start')
    this.startOpts = o ?? null
    if (this.startError) throw pluginError(this.startError)
    this.current = `s${++this.n}`
    return { sessionId: this.current, modelVersion: 'v1' }
  }
  finalPayload(id: string): OnDeviceFinalPayload {
    return {
      sessionId: id,
      text: this.finalText,
      durationMs: 1200,
      wavPath: this.finalText ? this.finalWav : null,
      segments: [{ segIdx: 0, text: this.finalText, startMs: 0, endMs: 1200 }],
      timings: { vadMs: 20, decodeMs: 180, loadMs: 0, sttMs: 200 },
      reason: 'stop',
      modelVersion: 'v1',
    }
  }
  async stop() {
    this.calls.push('stop')
    if (this.stopError) throw pluginError(this.stopError)
    const id = this.current
    if (!id) return {}
    this.current = null
    const f = this.finalPayload(id)
    this.emit('final', f)
    return { sessionId: id, utterance: f }
  }
  async cancel() {
    this.calls.push('cancel')
    this.current = null
  }
  async release() {
    this.calls.push('release')
  }
  async cancelDownload() {
    this.calls.push('cancelDownload')
  }
  async deleteModel() {
    this.calls.push('deleteModel')
    this.model = { installed: false, downloading: false }
  }
  async deleteWav(o: { wavPath: string }) {
    this.deleted.push(o.wavPath)
  }
  async preload() {
    return { modelVersion: 'v1', loadMs: 900 }
  }
  addListener<K extends keyof OnDeviceEventMap>(event: K, fn: (d: OnDeviceEventMap[K]) => void): Promise<OnDeviceListenerHandle> {
    const set = this.listeners.get(event) ?? new Set<Fn>()
    set.add(fn as Fn)
    this.listeners.set(event, set)
    return Promise.resolve({ remove: async () => void set.delete(fn as Fn) })
  }
}

/** 서버 경로 자리를 차지하는 가짜 — begin 호출을 기록하고 이벤트를 흘릴 수 있다. */
export class FakeGateway implements RealtimeSttClient {
  readonly kind = 'GATEWAY' as const
  begins: BeginOptions[] = []
  ended = 0
  cancelled = 0
  disposed = false
  private readonly fns = new Set<(e: SttEvent) => void>()
  async begin(o: BeginOptions) {
    this.begins.push(o)
  }
  end() {
    this.ended++
  }
  cancel() {
    this.cancelled++
  }
  dispose() {
    this.disposed = true
  }
  subscribe(fn: (e: SttEvent) => void) {
    this.fns.add(fn)
    return () => this.fns.delete(fn)
  }
  emit(e: SttEvent) {
    for (const fn of [...this.fns]) fn(e)
  }
}

export const tick = () => new Promise((r) => setImmediate(r))
