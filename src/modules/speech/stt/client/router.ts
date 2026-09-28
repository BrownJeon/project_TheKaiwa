/**
 * 실시간 인식 경로 라우터(design-spec §9 "클라이언트 라우팅", screens §11-3 C) — 화면은 이것 하나를 `RealtimeSttClient` 로 본다.
 *
 *  - **누를 때마다** 경로를 고른다(녹음 중이 아닐 때, Leader ⑦): 플러그인 있음 + 서버가 휴대폰 경로를 켬 + 파일 설치됨 → 휴대폰,
 *    그 밖은 서버(gateway). 받기가 끝나면 다음 누름부터 휴대폰, 지우면 다음 누름부터 서버 — 앱 재시작 불필요.
 *  - **전환 카운터는 앱 실행 단위**(모듈 변수): 셀 수 있는 휴대폰 오류가 `fallback.onDeviceFailureThreshold`(2)번 쌓이면 앱을 다시 켤 때까지
 *    서버로 간다. 오프라인 방식은 바꾸지 않는다(글자 입력을 권한다).
 *  - `start()` 거부는 **이번 누름을 서버로 이어 간다**(PERMISSION_DENIED·INTERRUPTED 제외) — 말을 잃지 않는다. 세션 중 오류는 말을 잃는다.
 *  - 강제 업데이트 상태면 휴대폰 경로를 쓰지 않는다(`UPDATE_REQUIRED`, Leader ④ — 옛 플러그인과 새 웹의 계약 어긋남 방지).
 * 경로 이유는 `route` 이벤트로만 화면에 간다(엔진·주소·모델 이름 없음).
 */
import { OnDeviceSttClient, type OnDeviceFailure, type OnDeviceSttDeps } from './OnDeviceSttClient'
import { onDeviceModelStore, type OnDeviceModelStore } from './onDeviceModel'
import { WebSocketSttClient, type WebSocketSttDeps } from './WebSocketSttClient'
import { SttError, type BeginOptions, type RealtimeSttClient, type SttClientConfig, type SttEvent, type SttKind, type SttRoute } from './types'

export const DEFAULT_FAILURE_THRESHOLD = 2

/** 앱 실행 단위 전환 상태(설정 ↔ 회화방을 오가도 이어진다). */
const runState = { failures: 0, failedOver: false }

/** 이번 앱 실행에서 휴대폰 → 서버 전환이 일어났는가(카드 경로 줄). */
export function isOnDeviceFailedOver(): boolean {
  return runState.failedOver
}

/** 테스트 전용 — 앱을 다시 켠 것처럼. */
export function resetOnDeviceRunStateForTest(): void {
  runState.failures = 0
  runState.failedOver = false
}

export interface RouterDeps extends WebSocketSttDeps {
  onDevice?: {
    upload?: OnDeviceSttDeps['upload']
    readWav?: OnDeviceSttDeps['readWav']
    /** 강제 업데이트 상태인가(화면의 업데이트 스토어). */
    isUpdateRequired?: () => boolean
  }
  /** 테스트용 — 기본은 앱 전체 스토어. */
  modelStore?: OnDeviceModelStore
  /** 테스트용 — 서버 경로 클라이언트 주입. */
  gatewayClient?: RealtimeSttClient
}

export interface RoutedSttClient extends RealtimeSttClient {
  readonly kind: SttKind
  /** #19 설정(늦게 와도 된다). */
  configure(config: SttClientConfig | null): void
  /** 다음 누름이 갈 경로. */
  route(): SttRoute
  /** 바깥 상태(강제 업데이트 등)가 바뀌었을 때 경로를 다시 알린다(바뀌었을 때만 이벤트). */
  refresh(): void
}

/** 순수 판정 — 입력이 같으면 경로가 같다(테스트 대상). */
export function decideRoute(i: {
  hasPlugin: boolean
  config: SttClientConfig | null
  installed: boolean
  downloading: boolean
  updateRequired: boolean
  failedOver: boolean
}): SttRoute {
  const od = i.config?.onDevice
  if (!i.hasPlugin || !od) return { kind: 'GATEWAY', reason: 'WEB' }
  const mode = i.config?.recognitionMode
  if (i.updateRequired) return { kind: 'GATEWAY', reason: 'UPDATE_REQUIRED' }
  if (mode === 'ACCURATE') return { kind: 'GATEWAY', reason: 'MODE_ACCURATE' }
  if (!od.enabled) return { kind: 'GATEWAY', reason: 'SERVER_DISABLED' }
  if (mode === 'OFFLINE') return { kind: 'ONDEVICE', reason: 'MODE_OFFLINE' }
  if (i.failedOver) return { kind: 'GATEWAY', reason: 'ONDEVICE_FAILED' }
  if (i.installed) return { kind: 'ONDEVICE', reason: 'READY' }
  return { kind: 'GATEWAY', reason: i.downloading ? 'MODEL_DOWNLOADING' : 'MODEL_ABSENT' }
}

/** start 거부 중 이번 누름을 서버로 이어 가지 않는 것(권한 흐름·앱 전환). */
const STOP_ON_START_FAILURE = new Set(['PERMISSION_DENIED', 'INTERRUPTED'])

export class SttRouter implements RoutedSttClient {
  private readonly listeners = new Set<(e: SttEvent) => void>()
  private readonly store: OnDeviceModelStore
  private config: SttClientConfig | null = null
  private gateway: RealtimeSttClient | null = null
  private onDevice: OnDeviceSttClient | null = null
  private current: RealtimeSttClient | null = null
  private active = false
  private lastRoute: SttRoute | null = null
  private pendingFailure: OnDeviceFailure | null = null
  private unsubStore: (() => void) | null = null
  private disposed = false

  constructor(private readonly deps: RouterDeps) {
    this.store = deps.modelStore ?? onDeviceModelStore()
    this.unsubStore = this.store.subscribe(() => this.publishRoute(false))
  }

  get kind(): SttKind {
    return this.route().kind
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
        // 구독자 오류가 인식 경로를 멈추지 않게
      }
    }
  }

  configure(config: SttClientConfig | null): void {
    this.config = config
    // 설정(연결 id·실행 값)이 바뀌면 다음 누름에 새 값으로 — 녹음 중이면 그 발화가 끝난 뒤 다시 만든다.
    if (this.onDevice && !(this.active && this.current === this.onDevice)) {
      this.onDevice.dispose()
      this.onDevice = null
    }
    if (config?.onDevice) this.store.setConfig(config.onDevice)
    if (config?.onDevice && this.store.getPlugin()) void this.store.refresh()
    this.publishRoute(false)
  }

  route(): SttRoute {
    const snap = this.store.snapshot()
    return decideRoute({
      hasPlugin: !!this.store.getPlugin(),
      config: this.config,
      installed: snap.installed,
      downloading: snap.transfer === 'downloading' || snap.transfer === 'verifying',
      updateRequired: this.deps.onDevice?.isUpdateRequired?.() === true,
      failedOver: runState.failedOver,
    })
  }

  refresh(): void {
    this.publishRoute(false)
  }

  private publishRoute(switched: boolean): void {
    if (this.disposed) return
    const r = this.route()
    if (!switched && this.lastRoute && this.lastRoute.kind === r.kind && this.lastRoute.reason === r.reason) return
    this.lastRoute = r
    this.emit({ type: 'route', route: r, switched })
  }

  private threshold(): number {
    const t = this.config?.fallback?.onDeviceFailureThreshold
    return typeof t === 'number' && Number.isInteger(t) && t >= 1 && t <= 10 ? t : DEFAULT_FAILURE_THRESHOLD
  }

  private offlineMode(): boolean {
    return this.config?.recognitionMode === 'OFFLINE' || this.config?.fallback?.toGateway === false || this.config?.gateway?.enabled === false
  }

  /** 셀 수 있는 실패를 더하고, 이번에 전환이 일어났는지 돌려준다. 오프라인 방식은 전환하지 않는다. */
  private count(f: OnDeviceFailure): boolean {
    this.store.reportFailure(f.code)
    if (!f.countable || this.offlineMode() || runState.failedOver) return false
    runState.failures++
    if (runState.failures < this.threshold()) return false
    runState.failedOver = true
    return true
  }

  private gatewayClient(): RealtimeSttClient {
    if (!this.gateway) {
      const g = this.deps.gatewayClient ?? new WebSocketSttClient(this.deps)
      g.subscribe((e) => this.forward(g, e))
      this.gateway = g
    }
    return this.gateway
  }

  private onDeviceClient(): OnDeviceSttClient | null {
    const plugin = this.store.getPlugin()
    if (!plugin) return null
    if (!this.onDevice) {
      const c = new OnDeviceSttClient({
        plugin,
        config: { ...(this.config?.onDevice ?? { enabled: true }), upload: this.config?.upload },
        upload: this.deps.onDevice?.upload,
        readWav: this.deps.onDevice?.readWav,
        onFailure: (f) => {
          this.pendingFailure = f
        },
      })
      c.subscribe((e) => this.forward(c, e))
      this.onDevice = c
    }
    return this.onDevice
  }

  private forward(from: RealtimeSttClient, e: SttEvent): void {
    if (from !== this.current) return
    if (e.type === 'error' && from === this.onDevice) {
      const f = this.pendingFailure
      this.pendingFailure = null
      this.active = false
      const switched = f ? this.count(f) : false
      this.emit({ ...e, ...(switched ? { switched: true } : {}), ...(this.offlineMode() && e.code === 'ENGINE_ERROR' ? { offlineMode: true } : {}) })
      this.publishRoute(false)
      return
    }
    if (e.type === 'final' || e.type === 'error' || e.type === 'interrupted') this.active = false
    this.emit(e)
    if (e.type === 'final' || e.type === 'error' || e.type === 'interrupted') this.publishRoute(false)
  }

  begin(o: BeginOptions): Promise<void> {
    if (this.active) this.cancel()
    const r = this.route()
    this.lastRoute = r
    this.active = true
    if (r.kind === 'GATEWAY') {
      this.current = this.gatewayClient()
      return this.current.begin(o)
    }
    if (!this.store.snapshot().installed) {
      // 오프라인 방식인데 파일이 없다 — 서버로 바꾸지 않는다.
      this.active = false
      return Promise.reject(new SttError('MODEL_REQUIRED'))
    }
    const od = this.onDeviceClient()
    if (!od) {
      this.active = false
      return Promise.reject(new SttError('UNSUPPORTED'))
    }
    this.current = od
    this.pendingFailure = null
    return od.begin(o).catch((err: unknown) => this.onStartFailure(err, o))
  }

  private onStartFailure(err: unknown, o: BeginOptions): Promise<void> {
    const f = this.pendingFailure
    this.pendingFailure = null
    if (!(err instanceof SttError) || !f || this.current !== this.onDevice) {
      this.active = false
      throw err
    }
    const code = f.code
    if (STOP_ON_START_FAILURE.has(code)) {
      this.active = false
      throw err
    }
    if (this.offlineMode()) {
      this.count(f)
      this.active = false
      if (code === 'MODEL_MISSING' || code === 'MODEL_CORRUPT') throw new SttError('MODEL_REQUIRED', undefined, code)
      if (code === 'AUDIO_INIT_FAILED') throw new SttError('MIC_BUSY', undefined, code)
      throw new SttError('ENGINE_ERROR', undefined, code)
    }
    // 이번 누름을 서버로 이어 간다(말을 잃지 않는다). 전환이 일어났으면 토스트 1회(switched).
    const switched = this.count(f)
    if (code === 'ALREADY_STARTED' || code === 'INVALID_ARGUMENT') this.onDevice?.cancel()
    this.current = this.gatewayClient()
    if (switched) this.publishRoute(true)
    return this.current.begin(o)
  }

  end(): void {
    this.current?.end()
  }

  cancel(): void {
    this.active = false
    this.current?.cancel()
  }

  dispose(): void {
    this.disposed = true
    this.active = false
    this.unsubStore?.()
    this.unsubStore = null
    this.gateway?.dispose()
    this.onDevice?.dispose()
    this.gateway = null
    this.onDevice = null
    this.current = null
  }
}
